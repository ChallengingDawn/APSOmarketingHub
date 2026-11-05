// THE WAY IN, run (the rule in intake.ts) - "SARCLA | Back Office Ticket Created | Notification" (2322831592) inside the
// Back Office distribution's minute (engine.ts run), before anything is decided (SARCLA 05.11.2026: "This is the one we
// need to migrate").
//
// While the workflow is ON (shadow): ten minutes after a ticket entered Back Office "New", the hub reads what the
// workflow wrote (its writes in the ticket's history), works out from the ticket as it was just before what the hub
// would have written, and keeps both - the page shows how many are the same.
// Once the workflow is OFF (the moment is kept): every ticket that enters "New" from then on, 20 seconds after (an
// e-mail ticket waits up to 3 minutes for its e-mail): the hub writes subject / requester / owner / stage in one PATCH
// and mails the Backoffice Team "❗Back Office Ticket Created" - and the distribution decides that ticket only after
// (pending), as it did after the workflow. Switching the workflow back on is the whole roll-back.
// Today's race goes with it: the workflow fired 10 s to 6 min after entry and 8 times in 7 days put "Backoffice Team"
// back after the hub had assigned someone.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { FROM, addressOf, esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import { NOBODY, teamRecipients } from "@/lib/notify/teamRecipients";
import { BO_TEAM, CREATED_WORKFLOW, MAIL_SUBJECT, STAGE_ASSIGNED, STAGE_NEW, intakeOf, type Intake, type IntakeFacts } from "./intake";

const BO = "1726786777";
const KV = { rows: "boDist:intake:rows", done: "boDist:intake:done", off: "boDist:intake:off", last: "boDist:intake:last" };
const WINDOW_MS = 35 * 60_000;
const MIN_AGE_MS = 20_000;
const EMAIL_WAIT_MS = 3 * 60_000;
/** older than this and never taken in (the hub was down): left alone - a person may already have it */
const LIVE_MAX_AGE_MS = 30 * 60_000;
const COMPARE_AFTER_MS = 10 * 60_000;
const COMPARE_PER_RUN = 15;
const ROWS_KEPT = 700;

type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string };
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist[]> };
const hs = <T,>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const ts = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);

export type IntakeRow = {
  ticketId: string; enteredAt: string; at: string; subjectBefore: string | null;
  branch: Intake["branch"] | null; team: string | null; props: Record<string, string>; mail: boolean;
  /** shadow = the workflow wrote it, compared; done / failed = the hub wrote it; skipped = left alone */
  what: "shadow" | "done" | "failed" | "skipped"; why?: string; error?: string; mailText?: string;
  /** shadow: what the workflow wrote and whether the hub's is the same */
  actual?: { props: Record<string, string>; same: boolean; diffs: string[]; wrote: boolean };
};
export type IntakeLast = { at: string; seen: number; done: number; shadow: number; pending: number; error?: string };

// ---------------- the workflow ----------------
let wfCache: { at: number; v: { on: boolean; updatedAt: string | null } | null } | null = null;
export async function createdWorkflow(): Promise<{ on: boolean; updatedAt: string | null } | null> {
  if (wfCache && Date.now() - wfCache.at < 2 * 60_000) return wfCache.v;
  let v: { on: boolean; updatedAt: string | null } | null = null;
  try { const d = await hs<{ isEnabled?: boolean; updatedAt?: string }>(`/automation/v4/flows/${CREATED_WORKFLOW.id}`); v = { on: !!d.isEnabled, updatedAt: d.updatedAt ?? null }; } catch { v = null; }
  wfCache = { at: Date.now(), v };
  return v;
}
/** From when the way in is the hub's: the moment the workflow was switched off (null = it runs, or not readable now). */
async function offMoment(): Promise<number | null> {
  const wf = await createdWorkflow();
  const kept = await kvGet<{ offAt: string | null }>(KV.off);
  // not readable now: as it was last seen
  if (!wf) return kept?.offAt ? Date.parse(kept.offAt) : null;
  if (wf.on) {
    if (kept?.offAt) await kvSet(KV.off, { offAt: null, at: new Date().toISOString() });
    return null;
  }
  if (kept?.offAt) return Date.parse(kept.offAt);
  const off = wf.updatedAt && !Number.isNaN(Date.parse(wf.updatedAt)) ? wf.updatedAt : new Date().toISOString();
  await kvSet(KV.off, { offAt: off, at: new Date().toISOString() });
  return Date.parse(off);
}

// ---------------- reading a ticket ----------------
const SUBCATS = [
  "enquiry_sub_category___delivery___1", "enquiry_sub_category___price_1", "enquiry_sub_category___invoicing___accounting___1",
  "enquiry_sub_category___order_cancellation___1", "enquiry_sub_category___product_information___1", "enquiry_sub_category___website_issue___1",
];
const TEXTBOXES = [
  "enquiry_textbox___delivery", "enquiry_textbox___order_cancellation", "enquiry_textbox___invoicing___accounting",
  "enquiry_textbox___price", "enquiry_textbox___product_information", "enquiry_textbox___website_issue",
];
const FACT_PROPS = [
  "subject", "hs_pipeline", "hs_pipeline_stage", "hs_created_by_user_id", "enquiry_category", "which_certificate__", "source_type",
  "back_office_ticket_requirement", "hs_originating_generic_channel_id", "hubspot_owner_id", "createdate",
  "content", "article_number", "order_number", "invoice_number", "order_issue_information", "others_bo_case", ...SUBCATS, ...TEXTBOXES,
];
const HIST = ["subject", "hubspot_owner_id", "back_office_ticket_requester", "hs_pipeline_stage", "enquiry_category", "which_certificate__", "source_type"];
type Email = { id: string; from: string | null; subject: string | null; owner: string | null; created: number; modified: number };

async function emailsOf(id: string): Promise<Email[]> {
  const a = await hs<{ results?: { to?: { toObjectId: string | number }[] }[] }>("/crm/v4/associations/tickets/emails/batch/read", "POST", { inputs: [{ id }] });
  const ids = [...new Set((a.results?.[0]?.to ?? []).map((x) => String(x.toObjectId)))];
  if (!ids.length) return [];
  const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/emails/batch/read", "POST", {
    inputs: ids.slice(0, 100).map((x) => ({ id: x })), properties: ["hs_email_from_email", "hs_email_subject", "hubspot_owner_id", "hs_lastmodifieddate", "hs_createdate"],
  });
  return (j.results ?? []).map((e) => ({
    id: String(e.id), from: e.properties.hs_email_from_email ?? null, subject: e.properties.hs_email_subject ?? null, owner: e.properties.hubspot_owner_id ?? null,
    created: ts(e.properties.hs_createdate) || 0, modified: ts(e.properties.hs_lastmodifieddate) || 0,
  }));
}
function factsOf(p: Record<string, string | null>, email: Email | null, names: Map<string, string>, owner: string | null): IntakeFacts {
  return {
    createdBy: p.hs_created_by_user_id ?? null, stage: p.hs_pipeline_stage ?? null, category: p.enquiry_category || null, certs: p.which_certificate__ || null,
    sourceType: p.source_type || null, requirement: p.back_office_ticket_requirement || null, channel: p.hs_originating_generic_channel_id || null,
    owner, ownerName: owner ? names.get(owner) ?? owner : null,
    email: email ? { from: email.from, subject: email.subject, owner: email.owner } : null,
  };
}

// ---------------- the mail ----------------
const HUB_URL = process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;
const joined = (p: Record<string, string | null>, keys: string[]) => keys.map((k) => (p[k] ?? "").trim()).filter(Boolean).join(" ");
const rowHtml = (k: string, v: string) =>
  `<tr><td style="padding:5px 12px 5px 0;color:#8b97ac;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:14px;color:#15223a">${esc(v)}</td></tr>`;
// 05.11.2026 10:47-11:31: the Backoffice Team's address is a HubSpot inbox - every mail the hub sent there came back as a
// new Back Office ticket, which the way in mailed again (120 tickets in 44 minutes). The mail goes to the people picked
// on Certificates > Console - never an inbox (notify/teamRecipients); nobody picked = not sent.
async function mailTeam(id: string, p: Record<string, string | null>, subject: string): Promise<{ ok: boolean; text: string }> {
  const to = await teamRecipients();
  if (!to.length) return { ok: true, text: NOBODY };
  if (!mailConfigured()) return { ok: false, text: "the hub cannot send mail" };
  const rows: [string, string][] = ([
    ["Name", subject], ["Category", joined(p, SUBCATS)], ["Description", p.content ?? ""], ["Article Number", p.article_number ?? ""],
    ["Order Number", p.order_number ?? ""], ["Invoice Number", p.invoice_number ?? ""], ["Order Issue Information", p.order_issue_information ?? ""],
    ["Additional Information for Back Office", joined(p, TEXTBOXES)], ["Other", p.others_bo_case ?? ""],
  ] as [string, string][]).map(([k, v]) => [k, v.replace(/\s+/g, " ").trim().slice(0, 600) || "-"] as [string, string]);
  const html = wrap({
    heading: "Ticket Information", intro: "A new Back Office ticket.",
    rows: `<table style="border-collapse:collapse">${rows.map(([k, v]) => rowHtml(k, v)).join("")}</table>`,
    cta: { label: "Open the ticket", href: ticketUrl(id) }, hubUrl: HUB_URL,
    footer: "Sent by APSOhub (UC & HubSpot Apps > Back Office distribution), which replaced the workflow SARCLA | Back Office Ticket Created | Notification.",
  });
  const text = ["Ticket Information", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ticketUrl(id)].join("\n");
  const who = to.map((r) => r.name).join(", ");
  try { await sendHubMail({ to: to.map((r) => r.email).join(", "), subject: MAIL_SUBJECT, html, text }); return { ok: true, text: `mail to ${who}` }; }
  catch (e) { return { ok: false, text: `mail to ${who} failed: ${(e as Error).message.slice(0, 120)}` }; }
}

// ---------------- shadow: the hub's answer against the workflow's writes ----------------
const enrolment = (h: Hist) => /enrollmentId:(\d+)/.exec(h.sourceId ?? "")?.[1] ?? null;
const sorted = (t: Obj, k: string) => [...(t.propertiesWithHistory?.[k] ?? [])].sort((a, b) => ts(a.timestamp) - ts(b.timestamp));
const valueBefore = (t: Obj, k: string, when: number) => { let v: string | null = null; for (const x of sorted(t, k)) if (ts(x.timestamp) < when) v = x.value; return v || null; };

/** What the workflow wrote (its enrolment: the one that wrote the requester, a "BO |" subject or the Assigned stage),
 *  and what the hub works out from the ticket as it was just before. Values already in place count as the same. */
export function compareWithWorkflow(t: Obj, emails: Email[], enteredAt: number, names: Map<string, string>): { want: Intake; actual: NonNullable<IntakeRow["actual"]> } {
  const KEYS = ["subject", "hubspot_owner_id", "back_office_ticket_requester", "hs_pipeline_stage"];
  const writes = KEYS.flatMap((k) => sorted(t, k).filter((x) => x.sourceType === "AUTOMATION_PLATFORM" && ts(x.timestamp) >= enteredAt - 2000 && ts(x.timestamp) <= enteredAt + COMPARE_AFTER_MS).map((x) => ({ k, ...x })));
  const ids = new Set(writes.filter((w) => w.k === "back_office_ticket_requester" || (w.k === "subject" && /^BO \|/.test(w.value)) || (w.k === "hs_pipeline_stage" && w.value === STAGE_ASSIGNED)).map(enrolment));
  const mine = writes.filter((w) => ids.has(enrolment(w)));
  const tW = mine.length ? Math.min(...mine.map((w) => ts(w.timestamp))) : enteredAt + 45_000;
  const p = { ...t.properties };
  // as they were just before (a value set later - the classifier's category - was not there yet)
  for (const k of ["hs_pipeline_stage", "enquiry_category", "which_certificate__", "source_type"]) p[k] = valueBefore(t, k, tW);
  const owner = valueBefore(t, "hubspot_owner_id", tW);
  const then = emails.filter((e) => !e.created || e.created <= tW + 5000).sort((a, b) => a.modified - b.modified);
  const want = intakeOf(factsOf(p, then[then.length - 1] ?? null, names, owner));
  const got: Record<string, string> = {};
  for (const w of mine) got[w.k] = w.value;
  const diffs: string[] = [];
  for (const k of new Set([...Object.keys(want.props), ...Object.keys(got)])) {
    const a = want.props[k], b = got[k];
    if (a === b) continue;
    if (a !== undefined && b === undefined && valueBefore(t, k, tW + 1) === a) continue; // already so - HubSpot logs no change
    if (k === "subject" && a !== undefined && b !== undefined && a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim()) continue;
    diffs.push(`${k}: hub ${a ?? "(nothing)"} | workflow ${b ?? "(nothing)"}`);
  }
  return { want, actual: { props: got, same: !diffs.length, diffs, wrote: mine.length > 0 } };
}

// ---------------- one pass ----------------
/**
 * Called first in each distribution run. pending = Back Office tickets the hub still has to take in (the workflow off):
 * the distribution leaves them for the next minute. failed = the pass could not look - the distribution then holds every
 * ticket younger than 5 minutes.
 */
export async function intakePass(): Promise<{ pending: Set<string>; failed: boolean; live: boolean | null }> {
  const pending = new Set<string>();
  let live: boolean | null = null;
  const last: IntakeLast = { at: new Date().toISOString(), seen: 0, done: 0, shadow: 0, pending: 0 };
  try {
    const offAt = await offMoment();
    live = offAt !== null;
    const now = Date.now();
    const prop = `hs_v2_date_entered_${STAGE_NEW}`;
    const r = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: prop, operator: "GTE", value: String(now - WINDOW_MS) }] }],
      properties: [prop], sorts: [{ propertyName: prop, direction: "ASCENDING" }], limit: 100,
    });
    const done = new Set((await kvGet<string[]>(KV.done)) ?? []);
    const rows = (await kvGet<IntakeRow[]>(KV.rows)) ?? [];
    const names = await ownerNames().catch(() => new Map<string, string>());
    for (const hit of r.results ?? []) {
      const id = String(hit.id);
      const entered = ts(hit.properties[prop]);
      if (!entered || done.has(id)) continue;
      last.seen++;
      const age = now - entered;
      // the workflow runs: compared in the shadow pass below
      if (offAt === null || entered < offAt) continue;
      const base = { ticketId: id, enteredAt: new Date(entered).toISOString(), at: new Date().toISOString() };
      if (age > LIVE_MAX_AGE_MS) {
        rows.unshift({ ...base, subjectBefore: null, branch: null, team: null, props: {}, mail: false, what: "skipped", why: "older than 30 minutes - the hub was not running; left to the Back Office" });
        done.add(id);
        continue;
      }
      if (age < MIN_AGE_MS) { pending.add(id); continue; }
      try {
        const t = await hs<Obj>(`/crm/v3/objects/tickets/${id}?properties=${FACT_PROPS.join(",")}`);
        const p = t.properties;
        if (p.hs_pipeline !== BO || p.hs_pipeline_stage !== STAGE_NEW) {
          rows.unshift({ ...base, subjectBefore: p.subject ?? null, branch: null, team: null, props: {}, mail: false, what: "skipped", why: "already out of New (the workflow would not have taken it either)" });
          done.add(id);
          continue;
        }
        const emails = await emailsOf(id);
        // a mail of the hub's own that reached an inbox: never taken in, never mailed again (the hub's sender is also the
        // Back Office's own address to customers - so its sender AND one of its own subjects)
        if (emails.some((e) => (e.from ?? "").toLowerCase() === addressOf(FROM).toLowerCase() && /^\s*(❗Back Office Ticket Created|⚠️REMINDER: Back Office Ticket)\s*$/.test(e.subject ?? ""))) {
          rows.unshift({ ...base, subjectBefore: p.subject ?? null, branch: null, team: null, props: {}, mail: false, what: "skipped", why: "made from a mail of the hub's own - left alone" });
          done.add(id);
          continue;
        }
        if ((p.source_type ?? "") === "EMAIL" && !emails.length && age < EMAIL_WAIT_MS) { pending.add(id); continue; }
        const email = [...emails].sort((a, b) => b.modified - a.modified)[0] ?? null;
        const want = intakeOf(factsOf(p, email, names, p.hubspot_owner_id ?? null));
        const row: IntakeRow = { ...base, subjectBefore: p.subject ?? null, branch: want.branch, team: want.team, props: want.props, mail: want.mail, what: "done" };
        try {
          if (Object.keys(want.props).length) await hs(`/crm/v3/objects/tickets/${id}`, "PATCH", { properties: want.props });
          // the console's switch (Certificates > Console, "❗Back Office Ticket Created")
          const mailOn = (await kvGet<{ mails?: { created?: boolean } }>("certificates:settings"))?.mails?.created !== false;
          if (want.mail && !mailOn) row.mailText = "mail switched off on the console";
          else if (want.mail) {
            const sent = await mailTeam(id, p, want.props.subject ?? p.subject ?? "");
            row.mailText = sent.text;
            if (!sent.ok) row.error = sent.text;
          }
          last.done++;
        } catch (e) {
          row.what = "failed"; row.error = (e as Error).message.slice(0, 200);
        }
        rows.unshift(row);
        done.add(id);
      } catch (e) {
        // read failed: try again next minute, and hold the distribution for it meanwhile
        pending.add(id);
        last.error = (e as Error).message.slice(0, 200);
      }
    }
    // shadow: tickets 10 minutes in, the workflow on when they entered - what it wrote against the hub's answer
    let compared = 0;
    for (const hit of r.results ?? []) {
      if (compared >= COMPARE_PER_RUN) break;
      const id = String(hit.id);
      const entered = ts(hit.properties[prop]);
      if (!entered || done.has(id) || (offAt !== null && entered >= offAt) || now - entered < COMPARE_AFTER_MS) continue;
      try {
        const qs = `properties=${FACT_PROPS.join(",")}&propertiesWithHistory=${HIST.join(",")}`;
        const t = await hs<Obj>(`/crm/v3/objects/tickets/${id}?${qs}`);
        const { want, actual } = compareWithWorkflow(t, await emailsOf(id), entered, names);
        rows.unshift({
          ticketId: id, enteredAt: new Date(entered).toISOString(), at: new Date().toISOString(), subjectBefore: valueBefore(t, "subject", entered + 1000) ?? t.properties.subject ?? null,
          branch: want.branch, team: want.team, props: want.props, mail: want.mail, what: "shadow", actual,
        });
        done.add(id);
        compared++;
        last.shadow++;
      } catch (e) { last.error = (e as Error).message.slice(0, 200); }
    }
    last.pending = pending.size;
    // keep the ids of the last 2 days (the search window is 35 minutes)
    const keepIds = new Set(rows.filter((x) => now - Date.parse(x.enteredAt) < 2 * 86400_000).map((x) => x.ticketId));
    await kvSet(KV.done, [...done].filter((x) => keepIds.has(x) || pending.has(x)));
    await kvSet(KV.rows, rows.slice(0, ROWS_KEPT));
    await kvSet(KV.last, last);
    return { pending, failed: false, live };
  } catch (e) {
    last.error = (e as Error).message.slice(0, 200);
    await kvSet(KV.last, last).catch(() => {});
    return { pending, failed: true, live };
  }
}

// ---------------- the page ----------------
export async function intakeState() {
  const [wf, kept, rows, last] = await Promise.all([createdWorkflow(), kvGet<{ offAt: string | null }>(KV.off), kvGet<IntakeRow[]>(KV.rows), kvGet<IntakeLast>(KV.last)]);
  const all = rows ?? [];
  const week = all.filter((r) => Date.now() - Date.parse(r.enteredAt) < 7 * 86400_000);
  const shadow = week.filter((r) => r.what === "shadow" && r.actual);
  const byBranch: Record<string, { n: number; same: number }> = {};
  for (const r of shadow) { const k = r.branch ?? "-"; byBranch[k] ??= { n: 0, same: 0 }; byBranch[k].n++; if (r.actual!.same) byBranch[k].same++; }
  return {
    workflow: wf, workflowName: CREATED_WORKFLOW.name, offAt: wf && !wf.on ? kept?.offAt ?? null : null, last: last ?? null, mailReady: mailConfigured(),
    figures: { compared: shadow.length, same: shadow.filter((r) => r.actual!.same).length, byBranch, done: week.filter((r) => r.what === "done").length, failed: week.filter((r) => r.what === "failed").length },
    rows: all.slice(0, 200),
  };
}
