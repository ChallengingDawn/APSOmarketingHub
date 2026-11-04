// GQS APPROVALS - the engine (Back Office distribution > GQS > Approvals; the rule in rules.ts). Replaces the HubSpot
// workflow "SARCLA | GQS Ticket Created by Sales" (2670957768), SARCLA 04.11.2026.
//
// Every 2 minutes, one copy of the hub at a time (advisory lock 4107250): the GQS requests that entered "Created by
// Sales" at least 2 minutes ago (the form's fields are in by then - the workflow waited too) and that the hub has not
// looked at for this entry. Each gets what the workflow gave it: the subject, the requester, TYPE OF SALES TICKET, an
// O-number (and the RFQ sheet for DT - New Business), the Sales follow-up ticket, then the rule - the line manager's
// review (status + the two mails) or "Automatically Approved" (stage New for Back-Office, owner Backoffice Team, the
// mail). Paused (shadow): the hub only works it out and, once the workflow has acted, puts its answer next to the
// hub's. Live: writes - only while the workflow is switched off, and only requests that entered after Live was
// switched on. Every write is logged (kv gqsApprovals:log, the last 500).
// The tab's year (history): every GQS request of the last 400 days with how it was decided, from status_of_gqs's
// history - read every 30 minutes (kv gqsApprovals:history). Approve / Refuse on the tab set "Approved / Refused by Line
// Manager" - what a line manager sets in HubSpot; the workflows SARCLA | GQS APPROVED and GQS Refused take it from there.
// GQS_APPROVALS=off stops the schedule.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { hubspotToken } from "@/lib/integrations/status";
import { esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import {
  BACKOFFICE_TEAM, DEFAULT_LIMITS, ESO, GQS, REQUEST_PROPS, STAGE, STATUS, TSA, TSA_OWNERS, decide, factsOf, followUpSubject, isDtNewBusiness,
  mailFields, oNumber, reasonText, reentered, rfqCsv, subjectOf, type Facts, type Limits, type Reason,
} from "./rules";

export const WORKFLOW_ID = "2670957768";
const LOCK = 4_107_250;
const EVERY_MS = 2 * 60_000;
const LIMIT_MS = 10 * 60_000;
const SETTLE_MS = 2 * 60_000;
/** a request that entered more than this long ago is never handled for the first time (a restart, an outage) */
const MAX_AGE_MS = 3 * 86400_000;
const HISTORY_EVERY_MS = 30 * 60_000;
const HISTORY_DAYS = 400;
const ROWS_KEPT = 400;
/** the RFQ sheets' folder in HubSpot's files (the workflow's) */
const RFQ_FOLDER = "315961541855";
const KV = { settings: "gqsApprovals:settings", rows: "gqsApprovals:rows", last: "gqsApprovals:last", history: "gqsApprovals:history", log: "gqsApprovals:log" };
const HUB_URL = process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;

export type Mode = "off" | "shadow" | "live";
export type Settings = { mode: Mode; liveFrom: string | null; limits: Limits; by?: string; at?: string };
/** One entry into "Created by Sales": what the hub decided, what it wrote (Live) or what the workflow did (Paused). */
export type Row = {
  key: string; ticketId: string; enteredAt: string; checkedAt: string;
  subject: string; customer: string; type: string; requester: string | null; approver: string | null;
  facts: Facts; reentry: boolean; review: boolean; reason: Reason | null;
  /** what the hub does (Live) or would do (Paused), in words */
  plan: string[];
  live?: { at: string; done: string[]; error?: string };
  /** Paused: the first status the workflow wrote after the entry */
  workflow?: { status: string | null; at: string | null };
};
export type RunInfo = { at: string; seconds: number; looked: number; handled: number; written: number; live: boolean; error?: string };
/** One request of the year: how it went. */
export type Hist = {
  id: string; subject: string; customer: string; type: string; requester: string | null; approver: string | null; enteredAt: string;
  facts: Facts; path: "auto" | "review" | "none"; status: string | null; stage: string | null; open: boolean;
  decision: { status: string; by: string | null; at: string } | null;
};
export type History = { at: string; rows: Hist[]; owners: Record<string, string> };
type LogEntry = { at: string; ticketId: string; what: string; by?: string };
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, { value: string; timestamp: string; sourceType?: string; sourceId?: string }[]> };

// ---------------- settings, the workflow ----------------
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KV.settings);
  return { mode: s?.mode ?? "shadow", liveFrom: s?.liveFrom ?? null, limits: { ...DEFAULT_LIMITS, ...(s?.limits ?? {}) }, by: s?.by, at: s?.at };
}
export async function saveSettings(patch: { mode?: Mode; limits?: Partial<Limits> }, by: string): Promise<Settings> {
  const cur = await getSettings();
  const mode = patch.mode ?? cur.mode;
  const limits = { ...cur.limits, ...(patch.limits ?? {}) };
  const next: Settings = { mode, limits, liveFrom: mode === "live" ? (cur.mode === "live" ? cur.liveFrom : new Date().toISOString()) : null, by, at: new Date().toISOString() };
  await kvSet(KV.settings, next);
  return next;
}
let wfCache: { at: number; on: boolean | null } | null = null;
/** The old workflow switched on? null = could not be read (then nothing is written). */
export async function workflowOn(): Promise<boolean | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.on;
  let on: boolean | null = null;
  try { on = !!(await hubspotRetry<{ isEnabled?: boolean }>({ path: `/automation/v4/flows/${WORKFLOW_ID}` })).isEnabled; } catch { on = null; }
  wfCache = { at: Date.now(), on };
  return on;
}
export async function writing(): Promise<boolean> {
  return (await getSettings()).mode === "live" && (await workflowOn()) === false;
}
async function log(e: LogEntry) {
  const cur = (await kvGet<LogEntry[]>(KV.log)) ?? [];
  await kvSet(KV.log, [e, ...cur].slice(0, 500));
}

// ---------------- owners ----------------
type Owner = { id: string; userId: string | null; name: string; email: string | null };
let ownersCache: { at: number; list: Owner[] } | null = null;
async function owners(): Promise<Owner[]> {
  if (ownersCache && Date.now() - ownersCache.at < 30 * 60_000) return ownersCache.list;
  const list: Owner[] = [];
  for (const archived of [false, true]) {
    let after = "";
    for (let i = 0; i < 20; i++) {
      const j = await hubspotRetry<{ results?: { id: string; userId?: number; firstName?: string; lastName?: string; email?: string }[]; paging?: { next?: { after?: string } } }>({
        path: `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`,
      });
      for (const o of j.results ?? []) list.push({ id: String(o.id), userId: o.userId ? String(o.userId) : null, name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Owner ${o.id}`, email: o.email ?? null });
      after = j.paging?.next?.after ?? "";
      if (!after) break;
    }
  }
  ownersCache = { at: Date.now(), list };
  return list;
}
const ownerOf = (list: Owner[], id: string | null | undefined) => (id ? list.find((o) => o.id === String(id)) ?? null : null);
const nameOf = (list: Owner[], id: string | null | undefined) => (id ? ownerOf(list, id)?.name ?? `Owner ${id}` : null);

// ---------------- reading a request ----------------
async function readRequest(id: string): Promise<Obj> {
  return hubspotRetry<Obj>({ path: `/crm/v3/objects/tickets/${id}?properties=${REQUEST_PROPS.join(",")}&propertiesWithHistory=hs_pipeline_stage,status_of_gqs` });
}
type Links = { tickets: { id: string; pipeline: string | null }[]; contacts: string[]; companies: string[]; contactName: string; companyName: string };
async function links(id: string): Promise<Links> {
  const assoc = async (to: string) => ((await hubspotRetry<{ results?: { toObjectId: string | number }[] }>({ path: `/crm/v4/objects/tickets/${id}/associations/${to}` })).results ?? []).map((r) => String(r.toObjectId));
  const [tids, contacts, companies] = await Promise.all([assoc("tickets"), assoc("contacts"), assoc("companies")]);
  const others = tids.filter((t) => t !== id);
  const tickets = others.length
    ? ((await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: { inputs: others.map((x) => ({ id: x })), properties: ["hs_pipeline"] } })).results ?? []).map((t) => ({ id: String(t.id), pipeline: t.properties.hs_pipeline }))
    : [];
  let contactName = "", companyName = "";
  if (contacts[0]) { const c = await hubspotRetry<Obj>({ path: `/crm/v3/objects/contacts/${contacts[0]}?properties=firstname,lastname` }).catch(() => null); contactName = [c?.properties.firstname, c?.properties.lastname].filter(Boolean).join(" ").trim(); }
  if (companies[0]) { const c = await hubspotRetry<Obj>({ path: `/crm/v3/objects/companies/${companies[0]}?properties=name` }).catch(() => null); companyName = (c?.properties.name ?? "").trim(); }
  return { tickets, contacts, companies, contactName, companyName };
}
const stagesSeen = (t: Obj) => (t.propertiesWithHistory?.hs_pipeline_stage ?? []).map((h) => h.value);

// ---------------- the plan for one request ----------------
function planOf(t: Obj, l: Links | null, limits: Limits, list: Owner[]): Omit<Row, "key" | "checkedAt" | "live" | "workflow"> {
  const p = t.properties;
  const enteredAt = p[`hs_v2_date_entered_${STAGE.createdBySales}`] ?? p.createdate ?? "";
  // the stage history holds this entry too: a re-entry is one that had been further on BEFORE this one
  const before = (t.propertiesWithHistory?.hs_pipeline_stage ?? []).filter((h) => Date.parse(h.timestamp) < Date.parse(enteredAt) - 1000).map((h) => h.value);
  const reentry = reentered(before);
  const facts = factsOf(p);
  const v = decide(facts, limits);
  const requester = p.hubspot_owner_id ?? null;
  const base = {
    ticketId: String(t.id), enteredAt, subject: p.subject ?? "", customer: p.customer_number_customer_name ?? "", type: p.gqs_type_of_request ?? "",
    requester, approver: p.price_tier_approver ?? null, facts, reentry,
  };
  if (reentry) return { ...base, review: true, reason: null, plan: [`Back after being further on: status "${STATUS.review}" only`] };
  const plan = [
    `Subject "${subjectOf(p.gqs_type_of_request, nameOf(list, requester), p.customer_number_customer_name)}"`,
    `Requester ${nameOf(list, requester) ?? "nobody"}, type of sales ticket GQS, an O-number${isDtNewBusiness(p.gqs_type_of_request) ? " and the RFQ sheet" : ""}`,
  ];
  const sales = l?.tickets.find((x) => x.pipeline === ESO || x.pipeline === TSA);
  plan.push(sales ? `Follow-up: ticket ${sales.id} renamed and labelled GQS` : `Follow-up: a new ${requester && TSA_OWNERS.includes(requester) ? "TSA" : "ESO"} ticket`);
  if (v.review) plan.push(`To ${nameOf(list, p.price_tier_approver) ?? "the line manager (none chosen)"}: ${reasonText(v.reason, limits)} - mails to the requester and the line manager`);
  else plan.push("Approved automatically: New for Back-Office, owner Backoffice Team, a mail to the Backoffice Team");
  return { ...base, review: v.review, reason: v.review ? v.reason : null, plan };
}

// ---------------- mails ----------------
const rowHtml = (k: string, val: string) =>
  `<tr><td style="padding:5px 12px 5px 0;color:#8b97ac;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:14px;color:#15223a">${esc(val)}</td></tr>`;
const table = (rows: [string, string][]) => `<table style="border-collapse:collapse">${rows.map(([k, val]) => rowHtml(k, val)).join("")}</table>`;
const FOOTER = "Sent by APSOhub's GQS approvals (Back Office distribution > GQS > Approvals), which replaced the workflow SARCLA | GQS Ticket Created by Sales.";
async function mail(to: string | null, subject: string, heading: string, intro: string, rows: [string, string][], id: string): Promise<string> {
  if (!to) return "no e-mail address";
  if (!mailConfigured()) return "the hub cannot send mail";
  const html = wrap({ heading, intro, rows: table(rows), cta: { label: "Open the ticket", href: ticketUrl(id) }, hubUrl: HUB_URL, footer: FOOTER });
  const text = [intro, "", ...rows.map(([k, val]) => `${k}: ${val}`), "", ticketUrl(id)].join("\n");
  try { await sendHubMail({ to, subject: subject.slice(0, 180), html, text }); return `mail to ${to}`; }
  catch (e) { return `mail to ${to} failed: ${(e as Error).message.slice(0, 120)}`; }
}

// ---------------- writing one request (Live) ----------------
let gqsLabel: number | null = null;
async function gqsLabelId(): Promise<number | null> {
  if (gqsLabel) return gqsLabel;
  const j = await hubspotRetry<{ results?: { label?: string; typeId?: number }[] }>({ path: "/crm/v4/associations/tickets/tickets/labels" });
  gqsLabel = j.results?.find((x) => x.label === "GQS")?.typeId ?? null;
  return gqsLabel;
}
async function uploadRfq(csv: string, name: string): Promise<string> {
  const token = hubspotToken();
  if (!token) throw new Error("HUBSPOT_TOKEN is not set");
  const fd = new FormData();
  fd.append("file", new Blob([csv], { type: "text/csv" }), name);
  fd.append("folderId", RFQ_FOLDER);
  fd.append("options", JSON.stringify({ access: "PRIVATE", overwrite: false, duplicateValidationStrategy: "NONE" }));
  const r = await fetch("https://api.hubapi.com/files/v3/files", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  const text = await r.text();
  if (!r.ok) throw new Error(`HubSpot files ${r.status}: ${text.slice(0, 200)}`);
  return String((JSON.parse(text) as { id?: string }).id ?? "");
}
const patch = (id: string, props: Record<string, string>) => hubspotRetry({ path: `/crm/v3/objects/tickets/${id}`, method: "PATCH", body: { properties: props } });

async function write(t: Obj, l: Links, row: Row, limits: Limits, list: Owner[]): Promise<string[]> {
  const id = row.ticketId, p = t.properties, done: string[] = [];
  if (row.reentry) {
    await patch(id, { status_of_gqs: STATUS.review });
    done.push(`status ${STATUS.review}`);
    return done;
  }
  const requester = row.requester;
  const reqName = nameOf(list, requester);
  const now = new Date();
  const o = oNumber(now);
  const props: Record<string, string> = {
    subject: subjectOf(p.gqs_type_of_request, reqName, p.customer_number_customer_name), type_of_sales_ticket: "GQS", o_number: o,
    ...(requester ? { back_office_ticket_requester: requester } : {}),
  };
  if (isDtNewBusiness(p.gqs_type_of_request)) {
    try { props.upload_template = await uploadRfq(rfqCsv({ ...p, o_number: o }), `RFQ_${o}_${id}.csv`); done.push("RFQ sheet"); }
    catch (e) { done.push(`RFQ sheet failed: ${(e as Error).message.slice(0, 120)}`); }
  }
  await patch(id, props);
  done.push(`subject, requester, O-number ${o}`);
  // the Sales follow-up ticket
  const label = await gqsLabelId();
  const sales = l.tickets.find((x) => x.pipeline === ESO || x.pipeline === TSA);
  if (sales) {
    await patch(sales.id, { subject: followUpSubject(p.customer_number_customer_name) });
    if (label) await hubspotRetry({ path: `/crm/v4/objects/tickets/${id}/associations/tickets/${sales.id}`, method: "PUT", body: [{ associationCategory: "USER_DEFINED", associationTypeId: label }] }).catch(() => null);
    done.push(`follow-up ${sales.id} renamed`);
  } else {
    const tsa = !!requester && TSA_OWNERS.includes(requester);
    const created = await hubspotRetry<{ id: string }>({ path: "/crm/v3/objects/tickets", method: "POST", body: {
      properties: {
        hs_pipeline: tsa ? TSA : ESO, hs_pipeline_stage: tsa ? STAGE.tsaFollowUp : STAGE.esoFollowUp,
        subject: tsa ? `GQS SALES FOLLOW-UP TICKET | ${l.companyName} | ${l.contactName}` : followUpSubject(p.customer_number_customer_name),
        content: "GQS TASK SALES FOLLOW TICKET", type_of_sales_ticket: "GQS",
        ...(requester ? { hubspot_owner_id: requester, back_office_ticket_requester: requester } : {}),
      },
    } });
    const fid = String(created.id);
    for (const c of l.contacts) await hubspotRetry({ path: `/crm/v4/objects/tickets/${fid}/associations/default/contacts/${c}`, method: "PUT" }).catch(() => null);
    for (const c of l.companies) await hubspotRetry({ path: `/crm/v4/objects/tickets/${fid}/associations/default/companies/${c}`, method: "PUT" }).catch(() => null);
    if (label) await hubspotRetry({ path: `/crm/v4/objects/tickets/${id}/associations/tickets/${fid}`, method: "PUT", body: [{ associationCategory: "USER_DEFINED", associationTypeId: label }] }).catch(() => null);
    done.push(`follow-up ${fid} made (${tsa ? "TSA" : "ESO"})`);
  }
  // the rule
  const fresh = await readRequest(id);
  const q = fresh.properties;
  if (row.review && row.reason) {
    await patch(id, { status_of_gqs: STATUS.review });
    done.push(`status ${STATUS.review}`);
    const approver = ownerOf(list, q.price_tier_approver);
    const why = reasonText(row.reason, limits);
    done.push(await mail(ownerOf(list, requester)?.email ?? null, `⚠️ ${q.subject ?? ""} - In Review ⚠️`, "Your GQS request is waiting for approval",
      `Your request is waiting for the approval of ${approver?.name ?? "your line manager"}, because: ${why}. You will get a mail with the decision.`,
      [["Request", q.subject ?? ""], ...(row.facts.potential !== null ? [["Order potential", `${Math.round(row.facts.potential).toLocaleString("de-CH")} EUR`] as [string, string]] : []), ...(row.facts.margin !== null ? [["Margin", `${Math.round(row.facts.margin * 1000) / 10} %`] as [string, string]] : [])], id));
    done.push(await mail(approver?.email ?? null, `❗Special Request GQS needs your review | ${reqName ?? ""} | ${q.gqs_type_of_request ?? ""}`, "A GQS request needs your review",
      `${reqName ?? "Sales"} has made a GQS request that needs your review (${why}). Set "${STATUS.approved}" or "${STATUS.refused}" on the ticket - or Approve / Refuse on APSOhub > Back Office distribution > GQS > Approvals.`,
      mailFields(q), id));
  } else {
    await patch(id, { status_of_gqs: STATUS.auto, hs_pipeline_stage: STAGE.newForBackOffice, hubspot_owner_id: BACKOFFICE_TEAM });
    done.push("approved automatically: New for Back-Office, Backoffice Team");
    done.push(await mail(ownerOf(list, BACKOFFICE_TEAM)?.email ?? null, "❗Special Request GQS Created", "A GQS request was approved automatically",
      `${reqName ?? "Sales"} has made a GQS request; it was approved automatically and is now in "New for Back-Office".`, mailFields(q), id));
  }
  return done;
}

// ---------------- the run ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const settings = await getSettings();
  const live = await writing();
  const list = await owners();
  const rows = new Map(((await kvGet<Row[]>(KV.rows)) ?? []).map((r) => [r.key, r]));
  const prop = `hs_v2_date_entered_${STAGE.createdBySales}`;
  const found = ((await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
    filterGroups: [{ filters: [
      { propertyName: "hs_pipeline", operator: "EQ", value: GQS }, { propertyName: "hs_pipeline_stage", operator: "EQ", value: STAGE.createdBySales },
      { propertyName: prop, operator: "GTE", value: String(t0 - MAX_AGE_MS) }, { propertyName: prop, operator: "LTE", value: String(t0 - SETTLE_MS) },
    ] }],
    properties: ["hs_object_id", prop], sorts: [{ propertyName: prop, direction: "ASCENDING" }], limit: 100,
  } })).results ?? []);
  let handled = 0, written = 0;
  for (const f of found) {
    const enteredAt = f.properties[prop] ?? "";
    const key = `${f.id}:${enteredAt}`;
    if (rows.has(key)) continue;
    const t = await readRequest(String(f.id));
    const l = await links(String(f.id));
    const row: Row = { key, checkedAt: new Date().toISOString(), ...planOf(t, l, settings.limits, list) };
    // Live acts only on requests that entered after Live was switched on - an older one is the workflow's
    if (live && settings.liveFrom && Date.parse(enteredAt) >= Date.parse(settings.liveFrom)) {
      try { row.live = { at: new Date().toISOString(), done: await write(t, l, row, settings.limits, list) }; written++; await log({ at: row.live.at, ticketId: row.ticketId, what: row.live.done.join("; ") }); }
      catch (e) { row.live = { at: new Date().toISOString(), done: [], error: (e as Error).message.slice(0, 200) }; }
    }
    rows.set(key, row);
    handled++;
  }
  // Paused: what the workflow did with the requests the hub looked at (its first status after the entry)
  for (const r of rows.values()) {
    if (r.live || r.workflow?.status || Date.now() - Date.parse(r.enteredAt) > 2 * 86400_000) continue;
    const t = await hubspotRetry<Obj>({ path: `/crm/v3/objects/tickets/${r.ticketId}?properties=status_of_gqs&propertiesWithHistory=status_of_gqs` }).catch(() => null);
    const first = (t?.propertiesWithHistory?.status_of_gqs ?? []).filter((h) => Date.parse(h.timestamp) >= Date.parse(r.enteredAt) - 60_000).sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
    if (first) r.workflow = { status: first.value, at: first.timestamp };
  }
  const kept = [...rows.values()].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt)).slice(0, ROWS_KEPT);
  await kvSet(KV.rows, kept);
  const info: RunInfo = { at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), looked: found.length, handled, written, live };
  await kvSet(KV.last, info);
  const h = await kvGet<History>(KV.history);
  if (!h?.at || Date.now() - Date.parse(h.at) > HISTORY_EVERY_MS) await readHistory().catch((e) => console.warn(`[gqs-approvals] history: ${(e as Error).message}`));
  return info;
}

/** Every GQS request of the last 400 days and how it was decided (status_of_gqs's history). */
export async function readHistory(): Promise<History> {
  const list = await owners();
  const prop = `hs_v2_date_entered_${STAGE.createdBySales}`;
  const ids: string[] = [];
  let cursor = "0";
  for (let page = 0; page < 50; page++) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: GQS }, { propertyName: "createdate", operator: "GTE", value: String(Date.now() - HISTORY_DAYS * 86400_000) }, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      properties: ["hs_object_id"], sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    } });
    const res = j.results ?? [];
    ids.push(...res.map((r) => String(r.id)));
    if (res.length < 200) break;
    cursor = String(res[res.length - 1].id);
  }
  const userName = (src?: string) => { const u = /userId:(\d+)/.exec(src ?? "")?.[1]; return u ? list.find((o) => o.userId === u)?.name ?? `user ${u}` : null; };
  const rows: Hist[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hubspotRetry<{ results?: Obj[] }>({ path: "/crm/v3/objects/tickets/batch/read", method: "POST", body: {
      inputs: ids.slice(i, i + 50).map((id) => ({ id })),
      properties: ["subject", "customer_number_customer_name", "gqs_type_of_request", "hubspot_owner_id", "back_office_ticket_requester", "price_tier_approver", "order_potential_", "margin__", "liquidation_article", "status_of_gqs", "hs_pipeline_stage", "hs_is_closed", prop],
      propertiesWithHistory: ["status_of_gqs"],
    } });
    for (const t of j.results ?? []) {
      const p = t.properties;
      const entered = p[prop];
      if (!entered) continue;
      const hist = [...(t.propertiesWithHistory?.status_of_gqs ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).filter((h) => Date.parse(h.timestamp) >= Date.parse(entered) - 60_000);
      const first = hist.find((h) => h.value === STATUS.review || h.value === STATUS.auto);
      const dec = first?.value === STATUS.review ? hist.find((h) => (h.value === STATUS.approved || h.value === STATUS.refused) && h.timestamp >= first.timestamp) : undefined;
      rows.push({
        id: String(t.id), subject: p.subject ?? "", customer: p.customer_number_customer_name ?? "", type: p.gqs_type_of_request ?? "",
        requester: p.back_office_ticket_requester ?? p.hubspot_owner_id ?? null, approver: p.price_tier_approver ?? null, enteredAt: entered,
        facts: factsOf(p), path: first ? (first.value === STATUS.auto ? "auto" : "review") : "none",
        status: p.status_of_gqs ?? null, stage: p.hs_pipeline_stage ?? null, open: String(p.hs_is_closed) !== "true",
        decision: dec ? { status: dec.value, by: dec.sourceType === "CRM_UI" ? userName(dec.sourceId) : dec.sourceType === "INTEGRATION" ? "APSOhub" : dec.sourceType ?? null, at: dec.timestamp } : null,
      });
    }
  }
  const used = new Set(rows.flatMap((r) => [r.requester, r.approver]).filter((x): x is string => !!x));
  const h: History = { at: new Date().toISOString(), rows, owners: Object.fromEntries([...used].map((id) => [id, nameOf(list, id) ?? id])) };
  await kvSet(KV.history, h);
  return h;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, looked: 0, handled: 0, written: 0, live: false, error: (e as Error).message.slice(0, 300) };
        await kvSet(KV.last, info);
        return info;
      });
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

let started = false, running = false;
export function startGqsApprovals() {
  if (started || process.env.GQS_APPROVALS === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[gqs-approvals] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 150_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the page ----------------
export async function pageState() {
  const [settings, last, rows, history, log, on] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<Row[]>(KV.rows), kvGet<History>(KV.history), kvGet<LogEntry[]>(KV.log), workflowOn(),
  ]);
  const list = await owners().catch(() => [] as Owner[]);
  const names: Record<string, string> = { ...(history?.owners ?? {}) };
  for (const r of rows ?? []) for (const id of [r.requester, r.approver]) if (id && !names[id]) names[id] = nameOf(list, id) ?? id;
  return { settings, last: last ?? null, rows: rows ?? [], history: history ?? null, log: (log ?? []).slice(0, 100), names, workflowOn: on, writing: settings.mode === "live" && on === false };
}

/** The line managers a signed-in person may decide for: the owners with their e-mail. */
export async function approverIdsOf(email: string | null): Promise<string[]> {
  if (!email) return [];
  const e = email.trim().toLowerCase();
  return (await owners()).filter((o) => (o.email ?? "").toLowerCase() === e).map((o) => o.id);
}

/** Approve / Refuse from the tab: what a line manager sets in HubSpot - only on a request still waiting for it. */
export async function decideRequest(ticketId: string, approve: boolean, by: string, mayFor: string[] | "any"): Promise<{ ok: boolean; why?: string }> {
  const t = await hubspotRetry<Obj>({ path: `/crm/v3/objects/tickets/${ticketId}?properties=hs_pipeline,status_of_gqs,price_tier_approver` });
  const p = t.properties;
  if (p.hs_pipeline !== GQS) return { ok: false, why: "not a GQS request" };
  if (p.status_of_gqs !== STATUS.review) return { ok: false, why: `no longer waiting (status: ${p.status_of_gqs ?? "none"})` };
  if (mayFor !== "any" && !mayFor.includes(String(p.price_tier_approver ?? ""))) return { ok: false, why: "only its line manager (or an admin) decides" };
  const status = approve ? STATUS.approved : STATUS.refused;
  await patch(ticketId, { status_of_gqs: status });
  await log({ at: new Date().toISOString(), ticketId, what: status, by });
  // the year's list shows it at once
  const h = await kvGet<History>(KV.history);
  if (h) {
    const r = h.rows.find((x) => x.id === ticketId);
    if (r) { r.status = status; r.decision = { status, by, at: new Date().toISOString() }; await kvSet(KV.history, h); }
  }
  return { ok: true };
}
