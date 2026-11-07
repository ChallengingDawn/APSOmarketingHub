// CERTIFICATES - the engine (UC & HubSpot Apps > Certificates; the rule in rules.ts). The Back Office's certificate
// process, run by the hub (SARCLA 04.11.2026: "migrate ASAP this certificates process to the hub as a sub-app, follow the
// logic"; 07.11.2026: "I want to do it only via the hub" - no HubSpot workflow is read any more).
//
// Every 3 minutes, one copy of the hub at a time (advisory lock 4107260): the open Back Office tickets that ask for a
// certificate (a certificate named, or an action set), their history (when the action was set, when it first went to
// Certificates, a merge) and their company. Each step that fell due since the hub took the process (WORKFLOW_OFF_AT)
// and that the hub has not done is done: one PATCH per ticket (and the note, for the 15-day escalation). Off / Preview
// (lists what it would do, writes nothing) / Live (writes). Every step done or listed is kept (kv certificates:rows, the
// last 500); the open tickets with their step and the next one are kept for the page (certificates:open); the year in
// figures every 30 minutes (certificates:stats). CERTIFICATES=off stops the schedule.
//
// The Back Office's reminders (SARCLA 05.11.2026, "migrate the rest of certificates"): the mails to the owner and the
// chain after the delivery date, the hub's since REMIND_OFF_AT. The mails go out on the hub's own post (notify/mailer),
// to the ticket's owner.
//
// Every other Back Office ticket (no certificate named) that enters stage Remind Back Office: "⚠️REMINDER: Back Office
// Ticket" to its owner, straight to the person (SARCLA 07.11.2026: "only mails directly to people - the reminder however
// should work"), once per entry, since OTHERS_OFF_AT.

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { IntegrationError } from "@/lib/integrations/status";
import { esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import {
  ACT, BO_PIPELINE, CATEGORY, DEFAULT_PEOPLE, DEFAULT_STEPS, DEFAULT_TIMING, MAIL_TEXT, OTHERS_OFF_AT, REMIND_OFF_AT, STAGE, STEP_GROUP, WORKFLOW_OFF_AT,
  type StepSwitches,
  HEAD, PLAN_PROP, certsText, dueShort, merge, owed, planOf, position, reminderTo, stepsOf, subjectOf,
  type Facts, type MailName, type People, type Phase, type StepName, type Timing,
} from "./rules";
import { createdPreview, intakeState } from "@/lib/boDistribution/intakeRun";
import { INTAKE_FROM } from "@/lib/boDistribution/intake";
import { datePass, dateRows, erpReadAt, erpRequests, type DateInfo, type DateMode } from "./erpData";
import { shopPass, shopRows, type ShopMode } from "./shopIntake";
import { INBOX_OWNERS, teamRecipients, type Recipient } from "@/lib/notify/teamRecipients";

const LOCK = 4_107_260;
const EVERY_MS = 3 * 60_000;
const LIMIT_MS = 8 * 60_000;
const STATS_EVERY_MS = 30 * 60_000;
const ROWS_KEPT = 500;
const KV = {
  settings: "certificates:settings", rows: "certificates:rows", last: "certificates:last", open: "certificates:open",
  done: "certificates:done", rotation: "certificates:rotation", stats: "certificates:stats",
  othersDone: "certificates:othersDone", othersRows: "certificates:othersRows",
};

export type Mode = "off" | "preview" | "live";
/** The mail switches (SARCLA 05.11.2026): the reminders to the owners, the reminder on every other ticket in Remind,
 *  and "❗Back Office Ticket Created" (sent by the way in, boDistribution/intakeRun - steered on its Way in tab). */
export type Mails = { owner: boolean; team: boolean; created: boolean };
export const DEFAULT_MAILS: Mails = { owner: true, team: true, created: true };
/** A ticket on hold: the hub leaves it alone until it is released. */
export type Hold = { by: string; at: string };
/** teamTo: who also gets the reminder on every other ticket in Remind (its owner always does; when the owner is not a
 *  person, these people, else the Back Office rotation) - never an inbox (notify/teamRecipients).
 *  erpDates: follow the ERP's delivery date (show only by default); shop: tickets from the shop's orders (Preview by
 *  default), shopFrom = when Live was switched on (only orders first seen after it are created). */
export type Settings = {
  mode: Mode; people: People; mails: Mails; timing: Timing; held: Record<string, Hold>; teamTo: string[];
  erpDates: DateMode; shop: ShopMode; shopFrom: string | null;
  /** the step groups on / off (console) */
  steps: StepSwitches;
  by?: string; at?: string;
};
export type RunInfo = {
  at: string; seconds: number; mode: Mode; writing: boolean; tickets: number; owed: number; written: number; listed: number; failed: number;
  mailed?: number; error?: string;
  /** dates moved to the ERP's (or listed), tickets created from the shop (or listed) */
  dates?: number; shop?: number; notes?: string[];
  /** plans written into the tickets (the ticket card) */
  plans?: number;
};
/** One ticket's steps done (or, in Preview, listed) in one look. */
export type Row = {
  at: string; ticketId: string; subject: string | null; phase: Phase; steps: StepName[];
  /** skipped = its step group is switched off on the console */
  what: "done" | "would" | "failed" | "skipped"; props: Record<string, string>; note: boolean; error?: string;
  /** the mail: "mail to Sara Gashi", "would mail Sara Gashi", or why it did not go (mailFailed) */
  mail?: string; mailFailed?: boolean;
};
/** An open ticket of the process, for the page. */
export type OpenTicket = {
  id: string; subject: string | null; company: string | null; order: string | null; certs: string; due: string | null;
  stage: string | null; actions: string | null; owner: string | null; expert: string | null; createdAt: string;
  phase: Phase; step: StepName | null; next: { name: StepName; at: string } | null;
  /** the last entry into stage Remind Back Office */
  remindAt?: string | null;
  /** on hold on the console: the hub leaves it alone */
  held?: boolean;
  /** its steps in the next 7 days (the Agenda) */
  upcoming?: { name: StepName; at: string }[];
  /** the ERP's delivery date for it, and whether the hub follows it */
  erp?: DateInfo;
  articles?: string | null;
};
/** A reminder on a Back Office ticket without a certificate that entered stage Remind Back Office (to its owner). */
export type OthersRow = { at: string; ticketId: string; subject: string | null; enteredAt: string; what: "done" | "would" | "failed"; mail: string };
export type Stats = {
  at: string;
  months: { month: string; created: number; resolved: number }[];
  /** median days from the request to Resolved, the last 90 days */
  medianDays: number | null; resolved90: number;
  /** resolved with a delivery date, the last 90 days: how many on or before it (Swiss day) */
  onTime90?: { n: number; onTime: number; medianAfter?: number | null };
  /** per month: resolved on time / after the delivery date */
  punctual?: { month: string; onTime: number; late: number }[];
};
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, { value: string; timestamp: string; sourceType?: string }[]> };
const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });

// ---------------- settings ----------------
export async function getSettings(): Promise<Settings> {
  const s = await kvGet<Partial<Settings>>(KV.settings);
  return {
    mode: s?.mode ?? "preview", people: { ...DEFAULT_PEOPLE, ...(s?.people ?? {}) }, mails: { ...DEFAULT_MAILS, ...(s?.mails ?? {}) },
    timing: { ...DEFAULT_TIMING, ...(s?.timing ?? {}) }, held: s?.held ?? {}, teamTo: (s?.teamTo ?? []).filter((id) => !INBOX_OWNERS.has(id)),
    erpDates: s?.erpDates ?? "show", shop: s?.shop ?? "preview", shopFrom: s?.shopFrom ?? null, steps: { ...DEFAULT_STEPS, ...(s?.steps ?? {}) }, by: s?.by, at: s?.at,
  };
}
export type SettingsPatch = {
  mode?: Mode; people?: Partial<People>; mails?: Partial<Mails>; timing?: Partial<Timing> | "default"; hold?: string; release?: string; teamTo?: string[];
  erpDates?: DateMode; shop?: ShopMode; steps?: Partial<StepSwitches>;
};
export async function saveSettings(patch: SettingsPatch, by: string): Promise<Settings> {
  const cur = await getSettings();
  const held = { ...cur.held };
  if (patch.hold) held[patch.hold] = { by, at: new Date().toISOString() };
  if (patch.release) delete held[patch.release];
  const next: Settings = {
    mode: patch.mode ?? cur.mode, people: { ...cur.people, ...(patch.people ?? {}) }, mails: { ...cur.mails, ...(patch.mails ?? {}) },
    timing: patch.timing === "default" ? { ...DEFAULT_TIMING } : { ...cur.timing, ...(patch.timing ?? {}) }, held,
    teamTo: (patch.teamTo ?? cur.teamTo).filter((id) => !INBOX_OWNERS.has(id)),
    erpDates: patch.erpDates ?? cur.erpDates, shop: patch.shop ?? cur.shop, steps: { ...cur.steps, ...(patch.steps ?? {}) },
    // Live from now on: the orders the shop sync saw before stay the Back Office's
    shopFrom: patch.shop === "live" && cur.shop !== "live" ? new Date().toISOString() : patch.shop && patch.shop !== "live" ? null : cur.shopFrom,
    by, at: new Date().toISOString(),
  };
  await kvSet(KV.settings, next);
  return next;
}
// ---------------- the mails ----------------
const HUB_URL = process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com";
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;
const FOOTER = "Sent by APSOhub (UC & HubSpot Apps > Certificates).";
const rowHtml = (k: string, v: string) =>
  `<tr><td style="padding:5px 12px 5px 0;color:#8b97ac;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:5px 0;font-size:14px;color:#15223a">${esc(v)}</td></tr>`;
/** The reminder mail to the ticket's owner, as it goes out (the Mails tab shows it, the step sends it). */
function renderReminder(m: MailName, f: Facts): { html: string; text: string } {
  const t = MAIL_TEXT[m];
  const rows: [string, string][] = [
    ["Company", f.company || "-"], ["Order number", f.order || "-"], ["Article(s)", f.articles || "-"],
    ["Certificates", certsText(f) || "-"], ["Delivery date", dueShort(f.due) || "-"],
  ];
  const html = wrap({ heading: t.line, intro: t.ask, rows: `<table style="border-collapse:collapse">${rows.map(([k, v]) => rowHtml(k, v)).join("")}</table>`, cta: { label: "Open the ticket", href: ticketUrl(f.id), red: true }, hubUrl: HUB_URL, footer: FOOTER });
  const text = [t.line, t.ask, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ticketUrl(f.id)].join("\n");
  return { html, text };
}
async function sendReminder(m: MailName, f: Facts, subject: string, to: Owner | undefined): Promise<{ ok: boolean; text: string }> {
  const who = to?.name ?? "the owner";
  if (!to?.email) return { ok: false, text: `no e-mail address for ${who}` };
  if (!mailConfigured()) return { ok: false, text: "the hub cannot send mail" };
  const { html, text } = renderReminder(m, f);
  try { await sendHubMail({ to: to.email, subject: subject.slice(0, 180), html, text }); return { ok: true, text: `mail to ${who}` }; }
  catch (e) { return { ok: false, text: `mail to ${who} failed: ${(e as Error).message.slice(0, 120)}` }; }
}

/** Every mail the hub sends for the Back Office (the Mails tab - SARCLA 07.11.2026: "a tab mails so we can see each mail
 *  and preview the design"). The owner's reminders, the reminder on every other ticket in Remind, and the way in's
 *  "❗Back Office Ticket Created" (boDistribution/intakeRun, steered on its Way in tab). */
export type MailKey = MailName | "team" | "created";
export const MAIL_KEYS: MailKey[] = ["bo3days", "boToday", "bo48", "bo96", "boWeek", "boRose", "team", "created"];
export type MailPreview = { key: MailKey; subject: string; html: string; to: string; ticket: { id: string; subject: string | null } | null; note?: string };

/** A mail as it would go out today, on a real ticket - nothing is sent. */
export async function previewMail(key: MailKey): Promise<MailPreview> {
  if (key === "team") {
    // the latest ticket that went to Remind without a certificate
    const rows = (await kvGet<OthersRow[]>(KV.othersRows)) ?? [];
    const id = rows[0]?.ticketId ?? (await search([{ propertyName: "hs_pipeline_stage", operator: "EQ", value: STAGE.remind }, { propertyName: "which_certificate__", operator: "NOT_HAS_PROPERTY" }]))[0]?.id;
    if (!id) return { key, subject: TEAM_SUBJECT, html: "", to: "", ticket: null, note: "No ticket in Remind Back Office to show it on." };
    const t = await hs<Obj>(`/crm/v3/objects/tickets/${id}?properties=${OTHERS_PROPS.join(",")}`);
    const s = await getSettings();
    const owner = t.properties.hubspot_owner_id ? (await teamRecipients([t.properties.hubspot_owner_id]))[0] ?? null : null;
    const picked = await teamRecipients(s.teamTo);
    const to = reminderTo(owner, picked, owner || picked.length ? [] : await teamRecipients(s.people.backOffice));
    return { key, subject: TEAM_SUBJECT, ...renderTeamReminder(t), to: to.map((r) => `${r.name} <${r.email}>`).join(", ") || "nobody", ticket: { id: String(id), subject: t.properties.subject ?? null } };
  }
  if (key === "created") {
    const p = await createdPreview();
    return { key, ...p };
  }
  // the owner's reminders: on an open request - one at that step if there is one, else one with a delivery date
  const open = (await kvGet<OpenTicket[]>(KV.open)) ?? [];
  const pick = open.find((t) => t.step === key) ?? open.find((t) => t.next?.name === key) ?? open.find((t) => t.due && t.phase === "backOffice") ?? open.find((t) => t.due) ?? open[0];
  if (!pick) return { key, subject: HEAD.boToday, html: "", to: "", ticket: null, note: "No open request to show it on." };
  const [f] = await readTickets([pick.id]);
  if (!f) return { key, subject: HEAD.boToday, html: "", to: "", ticket: null, note: "The request could not be read." };
  const s = await getSettings();
  const list = await owners().catch(() => [] as Owner[]);
  // boRose goes to the hand-over person, the others to the ticket's owner
  const toId = key === "boRose" ? s.people.escalation : f.owner;
  const o = list.find((x) => x.id === toId);
  return {
    key, subject: subjectOf(key === "boRose" ? HEAD.boWeek : HEAD[key], f), ...renderReminder(key, f),
    to: o ? `${o.name}${o.email ? ` <${o.email}>` : ""}` : "the owner", ticket: { id: f.id, subject: f.subject },
  };
}

/** The console's "send me a sample": a mail as previewMail builds it, to the person asking ("[Sample]" in front). */
export async function sendSample(to: { name: string; email: string }, key: MailKey = "boToday"): Promise<{ ok: boolean; text: string }> {
  if (!mailConfigured()) return { ok: false, text: "the hub cannot send mail" };
  const p = await previewMail(key);
  if (!p.html) return { ok: false, text: p.note ?? "nothing to show it on" };
  try { await sendHubMail({ to: to.email, subject: `[Sample] ${p.subject}`.slice(0, 180), html: p.html, text: p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }); return { ok: true, text: `mail to ${to.name}` }; }
  catch (e) { return { ok: false, text: `failed: ${(e as Error).message.slice(0, 120)}` }; }
}

// ---------------- the reminder on every other ticket in Remind ----------------
/** "Backoffice Team" - the queue's owner and user (76164822); its address is a HubSpot inbox, never mailed */
export const BO_TEAM = "76164822";
const SUBCATS = [
  "enquiry_sub_category___delivery___1", "enquiry_sub_category___price_1", "enquiry_sub_category___invoicing___accounting___1",
  "enquiry_sub_category___order_cancellation___1", "enquiry_sub_category___product_information___1", "enquiry_sub_category___website_issue___1",
];
const TEXTBOXES = [
  "enquiry_textbox___delivery", "enquiry_textbox___order_cancellation", "enquiry_textbox___invoicing___accounting",
  "enquiry_textbox___price", "enquiry_textbox___product_information", "enquiry_textbox___website_issue",
];
const OTHERS_PROPS = ["subject", "content", "which_certificate__", "hs_pipeline_stage", "hubspot_owner_id", "article_number", "order_number", "invoice_number", "order_issue_information", "others_bo_case", ...SUBCATS, ...TEXTBOXES];
const OTHERS_ROWS_KEPT = 300;
const joined = (p: Record<string, string | null>, keys: string[]) => keys.map((k) => (p[k] ?? "").trim()).filter(Boolean).join(" ");
// 05.11.2026 10:47-11:31: the Backoffice Team's address is a HubSpot inbox - every mail the hub sent there came back as a
// new Back Office ticket, which the way in mailed again (120 tickets in 44 minutes). The hub never mails it: the
// reminder goes to people, each to their own address.
export const TEAM_SUBJECT = "⚠️REMINDER: Back Office Ticket";
function renderTeamReminder(t: Obj): { html: string; text: string } {
  const p = t.properties;
  const rows: [string, string][] = ([
    ["Name", p.subject ?? ""], ["Category", joined(p, SUBCATS)], ["Description", p.content ?? ""], ["Article Number", p.article_number ?? ""],
    ["Order Number", p.order_number ?? ""], ["Invoice Number", p.invoice_number ?? ""], ["Order Issue Information", p.order_issue_information ?? ""],
    ["Additional Information for Back Office", joined(p, TEXTBOXES)], ["Other", p.others_bo_case ?? ""],
  ] as [string, string][]).map(([k, v]) => [k, v.replace(/\s+/g, " ").trim().slice(0, 600) || "-"] as [string, string]);
  const id = String(t.id);
  const html = wrap({
    heading: "Reminder to Review Ticket ⚠️", intro: "A Back Office ticket went to stage Remind Back Office.",
    rows: `<table style="border-collapse:collapse">${rows.map(([k, v]) => rowHtml(k, v)).join("")}</table>`,
    cta: { label: "Open the ticket", href: ticketUrl(id), red: true }, hubUrl: HUB_URL,
    footer: "Sent by APSOhub (UC & HubSpot Apps > Certificates).",
  });
  const text = ["Reminder to Review Ticket", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ticketUrl(id)].join("\n");
  return { html, text };
}
async function sendTeamReminder(t: Obj, to: Recipient[]): Promise<{ ok: boolean; sent: boolean; text: string }> {
  if (!to.length) return { ok: true, sent: false, text: "not sent - the ticket's owner is not a person and nobody is picked" };
  const who = to.map((r) => r.name).join(", ");
  if (!mailConfigured()) return { ok: false, sent: false, text: "the hub cannot send mail" };
  const { html, text } = renderTeamReminder(t);
  try { await sendHubMail({ to: to.map((r) => r.email).join(", "), subject: TEAM_SUBJECT, html, text }); return { ok: true, sent: true, text: `mail to ${who}` }; }
  catch (e) { return { ok: false, sent: false, text: `mail to ${who} failed: ${(e as Error).message.slice(0, 120)}` }; }
}
/**
 * Every entry into stage Remind Back Office of a Back Office ticket without a certificate, the last 2 days (since
 * OTHERS_OFF_AT): the mail to its owner (reminderTo), once per entry. In Preview: listed once as what the hub would mail.
 */
async function remindOthers(writing: boolean, mailOn: boolean, pickedIds: string[], rotationIds: string[]): Promise<{ rows: OthersRow[]; mailed: number }> {
  const now = Date.now();
  const since = Math.max(now - 2 * 86400_000, OTHERS_OFF_AT);
  const hits = await search([
    { propertyName: "hs_v2_date_entered_2338266327", operator: "GTE", value: String(since) },
    { propertyName: "which_certificate__", operator: "NOT_HAS_PROPERTY" },
  ]);
  const ids = hits.map((h) => String(h.id));
  const objs: Obj[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/batch/read", "POST", { inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: OTHERS_PROPS, propertiesWithHistory: ["hs_pipeline_stage"] });
    objs.push(...(j.results ?? []));
  }
  const done = new Set((await kvGet<string[]>(KV.othersDone)) ?? []);
  const picked = await teamRecipients(pickedIds);
  let rotation: Recipient[] | null = null;
  const rows: OthersRow[] = [];
  let mailed = 0;
  for (const t of objs) {
    if ((t.properties.which_certificate__ ?? "").trim()) continue;
    const entries = (t.propertiesWithHistory?.hs_pipeline_stage ?? []).filter((h) => h.value === STAGE.remind && ts(h.timestamp) >= since).map((h) => ts(h.timestamp)).sort((a, b) => a - b);
    if (!entries.some((at) => !done.has(`${t.id}@${new Date(at).toISOString()}`))) continue;
    const ownerId = t.properties.hubspot_owner_id ?? "";
    const owner = ownerId ? (await teamRecipients([ownerId]))[0] ?? null : null;
    if (!owner && !picked.length && !rotation) rotation = await teamRecipients(rotationIds);
    const to = reminderTo(owner, picked, rotation ?? []);
    const names = to.map((r) => r.name).join(", ") || "nobody";
    for (const at of entries) {
      const key = `${t.id}@${new Date(at).toISOString()}`;
      if (done.has(key)) continue;
      const base = { at: new Date().toISOString(), ticketId: String(t.id), subject: t.properties.subject ?? null, enteredAt: new Date(at).toISOString() };
      if (writing && !mailOn) {
        rows.push({ ...base, what: "would", mail: "not sent - the mail is switched off on the Settings tab" });
        done.add(key);
      } else if (writing) {
        const sent = await sendTeamReminder(t, to);
        rows.push({ ...base, what: sent.ok ? "done" : "failed", mail: sent.text });
        if (sent.sent) mailed++;
        done.add(key);
      } else if (!done.has(`~${key}`)) {
        rows.push({ ...base, what: "would", mail: `would mail ${names}` });
        done.add(`~${key}`);
      }
    }
  }
  // keep 3 days of keys
  const keep = [...done].filter((k) => { const iso = k.split("@")[1]; return iso && now - Date.parse(iso) < 3 * 86400_000; });
  await kvSet(KV.othersDone, keep);
  if (rows.length) await kvSet(KV.othersRows, [...rows, ...((await kvGet<OthersRow[]>(KV.othersRows)) ?? [])].slice(0, OTHERS_ROWS_KEPT));
  return { rows, mailed };
}

// ---------------- owners ----------------
/** userId: the HubSpot user behind the owner (hs_created_by_user_id is a user id) */
export type Owner = { id: string; name: string; archived: boolean; email: string | null; userId?: string };
let ownersCache: { at: number; list: Owner[] } | null = null;
export async function owners(): Promise<Owner[]> {
  if (ownersCache && Date.now() - ownersCache.at < 30 * 60_000) return ownersCache.list;
  const list: Owner[] = [];
  for (const archived of [false, true]) {
    let after = "";
    for (let i = 0; i < 20; i++) {
      const j = await hs<{ results?: { id: string; firstName?: string; lastName?: string; email?: string; userId?: number | string }[]; paging?: { next?: { after?: string } } }>(
        `/crm/v3/owners?limit=100&archived=${archived}${after ? `&after=${after}` : ""}`);
      for (const o of j.results ?? []) list.push({ id: String(o.id), name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || `Owner ${o.id}`, archived, email: o.email || null, ...(o.userId ? { userId: String(o.userId) } : {}) });
      after = j.paging?.next?.after ?? "";
      if (!after) break;
    }
  }
  ownersCache = { at: Date.now(), list };
  return list;
}

// ---------------- reading the tickets ----------------
const PROPS = [
  "subject", "hs_pipeline_stage", "hubspot_owner_id", "actions_for_certificates", "which_certificate__", "other_certificates",
  "sarcla_pm_witch_mandant__", "order_number", "delivery_date_for_certificate", "conformity_expert", "back_office_ticket_requester",
  "enquiry_category", "hs_merged_object_ids", "createdate", "sarcla_article_number_order_pm", PLAN_PROP,
];
const HIST = ["actions_for_certificates", "hs_pipeline_stage", "hs_merged_object_ids", "delivery_date_for_certificate"];

async function search(filters: { propertyName: string; operator: string; value?: string }[], properties = ["hs_object_id"]): Promise<Obj[]> {
  const out: Obj[] = [];
  let after = "0";
  for (let page = 0; page < 50; page++) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO_PIPELINE }, ...filters, { propertyName: "hs_object_id", operator: "GT", value: after }] }],
      properties, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }], limit: 200,
    });
    const res = j.results ?? [];
    out.push(...res);
    if (res.length < 200) break;
    after = String(res[res.length - 1].id);
  }
  return out;
}

/** The open tickets of the process: a certificate named, an action set, or a new Certificates request. */
export async function openIds(): Promise<string[]> {
  const open = { propertyName: "hs_pipeline_stage", operator: "NEQ", value: STAGE.resolved };
  const a = await search([open, { propertyName: "which_certificate__", operator: "HAS_PROPERTY" }]);
  const b = await search([open, { propertyName: "actions_for_certificates", operator: "HAS_PROPERTY" }]);
  return [...new Set([...a, ...b].map((t) => String(t.id)))];
}

const ts = (s: string) => Date.parse(s);
function factsOf(t: Obj, company: string | null): Facts {
  const p = t.properties;
  const h = t.propertiesWithHistory ?? {};
  const act = [...(h.actions_for_certificates ?? [])].sort((x, y) => ts(y.timestamp) - ts(x.timestamp));
  const stages = [...(h.hs_pipeline_stage ?? [])].sort((x, y) => ts(x.timestamp) - ts(y.timestamp));
  const merges = [...(h.hs_merged_object_ids ?? [])].filter((x) => x.value).sort((x, y) => ts(y.timestamp) - ts(x.timestamp));
  const firstCert = stages.find((x) => x.value === STAGE.certificates);
  const lastRemind = [...stages].reverse().find((x) => x.value === STAGE.remind);
  const dueWrites = (h.delivery_date_for_certificate ?? []).map((x) => ts(x.timestamp)).filter((x) => !Number.isNaN(x));
  return {
    id: String(t.id), stage: p.hs_pipeline_stage ?? null, actions: p.actions_for_certificates || null,
    actionsAt: act[0] ? ts(act[0].timestamp) : null, actionsBy: act[0]?.sourceType ?? null, actionsBefore: act[1]?.value || null,
    certs: (p.which_certificate__ ?? "").split(";").map((x) => x.trim()).filter(Boolean),
    other: p.other_certificates ?? null, mandant: p.sarcla_pm_witch_mandant__ ?? null, order: p.order_number ?? null,
    due: p.delivery_date_for_certificate ? p.delivery_date_for_certificate.slice(0, 10) : null,
    dueAt: p.delivery_date_for_certificate && dueWrites.length ? Math.max(...dueWrites) : null,
    company, owner: p.hubspot_owner_id ?? null, requester: p.back_office_ticket_requester ?? null, expert: p.conformity_expert ?? null,
    category: p.enquiry_category ?? null, createdAt: ts(p.createdate ?? new Date().toISOString()),
    mergedAt: p.hs_merged_object_ids && merges[0] ? ts(merges[0].timestamp) : null,
    startedAt: firstCert ? ts(firstCert.timestamp) : null, subject: p.subject ?? null,
    articles: p.sarcla_article_number_order_pm ?? null, remindAt: lastRemind ? ts(lastRemind.timestamp) : null,
    plan: p[PLAN_PROP] ?? null,
  };
}

// ---------------- the plan in the ticket (rules.ts PLAN_PROP - the ticket card reads it) ----------------
let planPropReady = false;
/** The hidden ticket property the plan goes into - made once, by the hub itself (the app has crm.schemas.tickets.write). */
async function ensurePlanProp(): Promise<void> {
  if (planPropReady) return;
  try {
    await hs(`/crm/v3/properties/tickets/${PLAN_PROP}`);
  } catch (e) {
    if (!(e instanceof IntegrationError) || e.status !== 404) throw e;
    await hs("/crm/v3/properties/tickets", "POST", {
      name: PLAN_PROP, label: "APSOhub certificate plan", type: "string", fieldType: "textarea", groupName: "ticketinformation", formField: false, hidden: true,
      description: "Written by APSOhub (UC & HubSpot Apps > Certificates): the steps the hub plans for this certificate request. The Certificates ticket card shows them. Do not edit.",
    });
  }
  planPropReady = true;
}

/** The ticket's company name, as the workflow's subject had it (Company Name (unique), else the name). */
async function companies(ids: string[]): Promise<Map<string, string>> {
  const toCompany = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const j = await hs<{ results?: { from: { id: string | number }; to?: { toObjectId: string | number; associationTypes?: { typeId: number; label?: string | null }[] }[] }[] }>(
      "/crm/v4/associations/tickets/companies/batch/read", "POST", { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) });
    for (const r of j.results ?? []) {
      const to = r.to ?? [];
      // the primary company (26) - the workflow took the last-modified of the links, often A+P itself
      const primary = to.find((x) => (x.associationTypes ?? []).some((a) => a.typeId === 26 || a.label === "Primary")) ?? to[0];
      if (primary) toCompany.set(String(r.from.id), String(primary.toObjectId));
    }
  }
  const names = new Map<string, string>();
  const cids = [...new Set(toCompany.values())];
  for (let i = 0; i < cids.length; i += 100) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/companies/batch/read", "POST", { inputs: cids.slice(i, i + 100).map((id) => ({ id })), properties: ["company_name__unique_", "name"] });
    for (const c of j.results ?? []) names.set(String(c.id), c.properties.company_name__unique_ || c.properties.name || "");
  }
  const out = new Map<string, string>();
  for (const [t, c] of toCompany) if (names.get(c)) out.set(t, names.get(c)!);
  return out;
}

export async function readTickets(ids: string[]): Promise<Facts[]> {
  const objs: Obj[] = [];
  // with history: 50 at most per call
  for (let i = 0; i < ids.length; i += 50) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/batch/read", "POST", { inputs: ids.slice(i, i + 50).map((id) => ({ id })), properties: PROPS, propertiesWithHistory: HIST });
    objs.push(...(j.results ?? []));
  }
  const names = await companies(objs.map((o) => String(o.id))).catch(() => new Map<string, string>());
  return objs.map((o) => factsOf(o, names.get(String(o.id)) ?? null));
}

// ---------------- one look ----------------
async function run(): Promise<RunInfo> {
  const t0 = Date.now();
  const settings = await getSettings();
  const writing = settings.mode === "live";
  const remindOffAt = REMIND_OFF_AT;
  const info: RunInfo = { at: new Date().toISOString(), seconds: 0, mode: settings.mode, writing, tickets: 0, owed: 0, written: 0, listed: 0, failed: 0, mailed: 0 };
  const facts = await readTickets(await openIds());
  info.notes = [];
  // the ERP's delivery dates first - the steps go by the new date in the same look (SARCLA 06.11.2026)
  const inProcess = facts.filter((f) => position(f, Date.now(), settings.timing));
  const dates = await datePass(inProcess, settings.erpDates, writing).catch((e) => ({ info: new Map<string, DateInfo>(), rows: [], error: (e as Error).message.slice(0, 200) }));
  info.dates = dates.rows.length;
  if (dates.error) info.notes.push(`ERP dates: ${dates.error}`);
  // the way in's part for certificate tickets (the way in hands them on - boDistribution/intakeRun)
  const wayinFrom = INTAKE_FROM;
  const doneMap = (await kvGet<Record<string, string[]>>(KV.done)) ?? {};
  const rot = (await kvGet<{ backOffice: number; experts: number }>(KV.rotation)) ?? { backOffice: 0, experts: 0 };
  const list = await owners().catch(() => [] as Owner[]);
  const active = (ids: string[]) => ids.filter((id) => !list.length || list.some((o) => o.id === id && !o.archived));
  const rows: Row[] = [];
  const open: OpenTicket[] = [];
  const now = Date.now();
  const nextDone: Record<string, string[]> = {};
  const tm = settings.timing;
  for (const f of facts) {
    const pos = position(f, now, tm);
    if (!pos) continue;
    info.tickets++;
    const done = new Set(doneMap[f.id] ?? []);
    // on hold: nothing owed - what falls due meanwhile is taken when it is released
    const held = !!settings.held[f.id];
    if (!held && !f.requester && f.owner && f.createdAt >= wayinFrom && !done.has(writing ? "wayin" : "~wayin")) {
      const props = { back_office_ticket_requester: f.owner };
      const row: Row = { at: new Date().toISOString(), ticketId: f.id, subject: f.subject, phase: pos.phase, steps: ["wayin"], what: "would", props, note: false };
      if (writing) {
        try { await hs(`/crm/v3/objects/tickets/${f.id}`, "PATCH", { properties: props }); f.requester = f.owner; row.what = "done"; info.written++; done.add("wayin"); }
        catch (e) { row.what = "failed"; row.error = (e as Error).message.slice(0, 200); info.failed++; }
      } else { done.add("~wayin"); info.listed++; }
      rows.push(row);
    }
    const owedNow = held ? [] : owed(f, done, now, WORKFLOW_OFF_AT, remindOffAt, tm);
    // a step group switched off on the console: its steps are skipped (not taken later), listed once
    const skipped = owedNow.filter((x) => { const g = STEP_GROUP[x.name]; return !!g && !settings.steps[g]; });
    if (skipped.length) {
      for (const x of skipped) done.add(x.key);
      rows.push({ at: new Date().toISOString(), ticketId: f.id, subject: f.subject, phase: pos.phase, steps: skipped.map((x) => x.name), what: "skipped", props: {}, note: false });
    }
    const due = owedNow.filter((x) => !skipped.includes(x));
    if (due.length) {
      info.owed += due.length;
      // the rotation: the next of the list, moved on only by a write that went through
      const used = { backOffice: 0, experts: 0 };
      const pick = (who: "backOffice" | "experts") => {
        const people = active(settings.people[who]);
        if (!people.length) return null;
        return people[(rot[who] + used[who]++) % people.length];
      };
      const { props, note, mail: mailed } = merge(f, due, pick, settings.people, remindOffAt);
      // the owners' reminder mails, switched on the console
      const mail = settings.mails.owner ? mailed : null;
      const row: Row = { at: new Date().toISOString(), ticketId: f.id, subject: f.subject, phase: pos.phase, steps: due.map((x) => x.name), what: "would", props, note };
      // the mail goes to the owner after the writes (Rose, after the 15 days)
      const mailTo = mail ? list.find((o) => o.id === (props.hubspot_owner_id ?? f.owner)) : undefined;
      if (mail) row.mail = `would mail ${mailTo?.name ?? "the owner"}`;
      if (writing) {
        try {
          if (Object.keys(props).length) await hs(`/crm/v3/objects/tickets/${f.id}`, "PATCH", { properties: props });
          if (note) {
            const who = list.find((o) => o.id === settings.people.escalation)?.name ?? "";
            await hs("/crm/v3/objects/notes", "POST", {
              properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `<p>Dear ${who} more than ${tm.escalationDays} days and no certificates - please handle it manually</p><p>APSOhub - Certificates</p>` },
              associations: [{ to: { id: f.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
            });
          }
          for (const x of due) done.add(x.key);
          rot.backOffice += used.backOffice; rot.experts += used.experts;
          row.what = "done"; info.written++;
          if (mail) {
            const sent = await sendReminder(mail, f, props.subject ?? f.subject ?? "Certificate", mailTo);
            row.mail = sent.text;
            if (sent.ok) info.mailed = (info.mailed ?? 0) + 1; else row.mailFailed = true;
          }
        } catch (e) {
          row.what = "failed"; row.error = (e as Error).message.slice(0, 200); info.failed++;
        }
        rows.push(row);
      } else {
        // Preview: each step listed once ("~" = listed, not done - Live still does it)
        const fresh = due.filter((x) => !done.has(`~${x.key}`));
        if (fresh.length) { rows.push({ ...row, steps: fresh.map((x) => x.name) }); info.listed++; }
        for (const x of due) done.add(`~${x.key}`);
      }
    }
    if (done.size) nextDone[f.id] = [...done];
    if (writing) {
      const plan = planOf(f, done, now, tm, held, settings.people, remindOffAt);
      const text = plan ? JSON.stringify(plan) : "";
      if (plan && text !== (f.plan ?? "")) {
        try { await ensurePlanProp(); await hs(`/crm/v3/objects/tickets/${f.id}`, "PATCH", { properties: { [PLAN_PROP]: text } }); info.plans = (info.plans ?? 0) + 1; }
        catch (e) { (info.notes ??= []).push(`plan of ${f.id}: ${(e as Error).message.slice(0, 120)}`); }
      }
    }
    const p2 = pos;
    open.push({
      id: f.id, subject: f.subject, company: f.company, order: f.order, certs: [f.certs.join(", "), f.other].filter(Boolean).join(" "), due: f.due,
      stage: f.stage, actions: f.actions, owner: f.owner, expert: f.expert, createdAt: new Date(f.createdAt).toISOString(),
      phase: p2.phase, step: p2.at, next: p2.next ? { name: p2.next.name, at: new Date(p2.next.at).toISOString() } : null,
      remindAt: f.remindAt ? new Date(f.remindAt).toISOString() : null,
      held,
      upcoming: (stepsOf(f, tm)?.steps ?? []).filter((x) => x.at > now && x.at <= now + 7 * 86400_000).map((x) => ({ name: x.name, at: new Date(x.at).toISOString() })),
      erp: dates.info.get(f.id), articles: f.articles ?? null,
    });
  }
  // tickets from the shop's orders with the declaration line (the rotation moves on only for a ticket created)
  try {
    const people = active(settings.people.backOffice);
    let used = 0;
    const shop = await shopPass({
      mode: settings.shop, writing, from: settings.shopFrom,
      pick: () => (people.length ? people[(rot.backOffice + used) % people.length] : null), taken: () => { used++; },
    });
    rot.backOffice += used;
    info.shop = shop.created + shop.listed;
    if (shop.error) info.notes.push(`Shop: ${shop.error}`);
  } catch (e) {
    info.notes.push(`Shop: ${(e as Error).message.slice(0, 200)}`);
  }
  // only the tickets still open are remembered
  await kvSet(KV.done, nextDone);
  await kvSet(KV.rotation, rot);
  if (rows.length) await kvSet(KV.rows, [...rows, ...((await kvGet<Row[]>(KV.rows)) ?? [])].slice(0, ROWS_KEPT));
  await kvSet(KV.open, open);
  // the reminder on every other ticket in Remind, to its owner
  try {
    const others = await remindOthers(writing, settings.mails.team, settings.teamTo, active(settings.people.backOffice));
    info.mailed = (info.mailed ?? 0) + others.mailed;
  } catch (e) {
    console.warn(`[certificates] team reminders: ${(e as Error).message}`);
  }
  info.seconds = Math.round((Date.now() - t0) / 1000);
  await kvSet(KV.last, info);
  const st = await kvGet<Stats>(KV.stats);
  if (!st?.at || Date.now() - Date.parse(st.at) > STATS_EVERY_MS) await readStats().catch((e) => console.warn(`[certificates] stats: ${(e as Error).message}`));
  return info;
}

/** The year in figures: certificate tickets created and resolved per month, days to resolve. */
export async function readStats(): Promise<Stats> {
  const since = Date.now() - 400 * 86400_000;
  const all = await search([{ propertyName: "which_certificate__", operator: "HAS_PROPERTY" }, { propertyName: "createdate", operator: "GTE", value: String(since) }], ["createdate", "closed_date", "hs_pipeline_stage", "enquiry_category", "delivery_date_for_certificate"]);
  const m = new Map<string, { created: number; resolved: number }>();
  const punct = new Map<string, { onTime: number; late: number }>();
  const on90: { n: number; onTime: number; medianAfter?: number | null } = { n: 0, onTime: 0 };
  const after90: number[] = [];
  const swissDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
  const bump = (k: string, f: "created" | "resolved") => { const x = m.get(k) ?? { created: 0, resolved: 0 }; x[f]++; m.set(k, x); };
  const days: number[] = [];
  for (const t of all) {
    const c = t.properties.createdate, r = t.properties.closed_date;
    if (c) bump(c.slice(0, 7), "created");
    if (r && t.properties.hs_pipeline_stage === STAGE.resolved) {
      bump(r.slice(0, 7), "resolved");
      const due = (t.properties.delivery_date_for_certificate ?? "").slice(0, 10);
      if (due) {
        const ok = swissDay(r) <= due;
        const p = punct.get(r.slice(0, 7)) ?? { onTime: 0, late: 0 };
        if (ok) p.onTime++; else p.late++;
        punct.set(r.slice(0, 7), p);
        if (Date.now() - ts(r) <= 90 * 86400_000) { on90.n++; if (ok) on90.onTime++; after90.push((ts(r) - Date.parse(`${due}T12:00:00Z`)) / 86400_000); }
      }
      if (c && Date.now() - ts(r) <= 90 * 86400_000) days.push((ts(r) - ts(c)) / 86400_000);
    }
  }
  days.sort((a, b) => a - b);
  after90.sort((a, b) => a - b);
  on90.medianAfter = after90.length ? Math.round(after90[Math.floor(after90.length / 2)] * 10) / 10 : null;
  const stats: Stats = {
    at: new Date().toISOString(),
    months: [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-13).map(([month, v]) => ({ month, ...v })),
    medianDays: days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null, resolved90: days.length,
    onTime90: on90, punctual: [...punct.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-13).map(([month, v]) => ({ month, ...v })),
  };
  await kvSet(KV.stats, stats);
  return stats;
}

export async function runOnce(): Promise<RunInfo | null> {
  if ((await getSettings()).mode === "off") return null;
  const client: PoolClient = await getPool().connect();
  try {
    const got = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK]);
    if (!got.rows[0]?.ok) return null;
    try {
      return await run().catch(async (e) => {
        const s = await getSettings().catch(() => null);
        const info: RunInfo = { at: new Date().toISOString(), seconds: 0, mode: s?.mode ?? "preview", writing: false, tickets: 0, owed: 0, written: 0, listed: 0, failed: 0, mailed: 0, error: (e as Error).message.slice(0, 300) };
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
export function startCertificates() {
  if (started || process.env.CERTIFICATES === "off") return;
  started = true;
  const tick = () => {
    if (running) return;
    running = true;
    const timer = setTimeout(() => { running = false; }, LIMIT_MS);
    timer.unref?.();
    void runOnce()
      .catch((e) => console.warn(`[certificates] ${(e as Error).message}`))
      .finally(() => { clearTimeout(timer); running = false; });
  };
  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, EVERY_MS).unref?.();
}

// ---------------- the console's board: what the hub runs ----------------
export type BoardRow = {
  id: string; name: string; what: string; by: "hub" | "preview" | "off";
  today: { written: number; mailed: number; failed: number }; last: string | null; error: string | null; where: string;
};
const isToday = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
async function board(settings: Settings, last: RunInfo | null, rows: Row[], others: OthersRow[]): Promise<BoardRow[]> {
  const steps = rows.filter((r) => isToday(r.at));
  const team = others.filter((r) => isToday(r.at));
  const intake = await intakeState().catch(() => null);
  const intakeToday = (intake?.rows ?? []).filter((r) => isToday(r.at));
  const by: BoardRow["by"] = settings.mode === "live" ? "hub" : settings.mode === "preview" ? "preview" : "off";
  return [
    {
      id: "requests", name: "The certificate requests", what: "AVOR, the Back Office, the conformity experts, the hand-over - and their reminders to the owner", by,
      today: { written: steps.filter((r) => r.what === "done").length, mailed: steps.filter((r) => r.mail && !r.mailFailed && r.what === "done").length, failed: steps.filter((r) => r.what === "failed").length },
      last: last?.at ?? null, error: last?.error ?? null, where: "#tickets",
    },
    {
      id: "reminders", name: "The reminder on every other ticket in Remind", what: "\"⚠️REMINDER: Back Office Ticket\" to the ticket's owner, when it goes to stage Remind Back Office", by,
      today: { written: team.filter((r) => r.what === "done").length, mailed: team.filter((r) => r.mail.startsWith("mail to")).length, failed: team.filter((r) => r.what === "failed").length },
      last: last?.at ?? null, error: null, where: "#activity",
    },
    {
      id: "wayin", name: "The way in", what: "Every Back Office ticket as it enters New: subject, requester, Backoffice Team, the mail - before the distribution assigns", by: "hub",
      today: { written: intakeToday.filter((r) => r.what === "done").length, mailed: intakeToday.filter((r) => (r.mailText ?? "").startsWith("mail to")).length, failed: intakeToday.filter((r) => r.what === "failed").length },
      last: intake?.last?.at ?? null, error: intake?.last?.error ?? null, where: "/uc/bo-distribution#way-in",
    },
  ];
}

// ---------------- the page ----------------
export async function pageState() {
  const [settings, last, rows, open, stats, othersRows, dRows, sRows, reqs, read] = await Promise.all([
    getSettings(), kvGet<RunInfo>(KV.last), kvGet<Row[]>(KV.rows), kvGet<OpenTicket[]>(KV.open), kvGet<Stats>(KV.stats), kvGet<OthersRow[]>(KV.othersRows),
    dateRows(), shopRows(), erpRequests(), erpReadAt(),
  ]);
  const list = await owners().catch(() => [] as Owner[]);
  const ids = new Set<string>([...settings.people.backOffice, ...settings.people.experts, settings.people.escalation]);
  for (const t of open ?? []) for (const id of [t.owner, t.expert]) if (id) ids.add(id);
  for (const r of rows ?? []) for (const k of ["hubspot_owner_id", "conformity_expert"]) if (r.props[k]) ids.add(r.props[k]);
  const names = Object.fromEntries([...ids].map((id) => [id, list.find((o) => o.id === id)?.name ?? `Owner ${id}`]));
  // people a rotation may hold: the owners who are not archived
  const choices = list.filter((o) => !o.archived).map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    settings, last: last ?? null, rows: (rows ?? []).slice(0, 300), open: open ?? [], stats: stats ?? null, names, choices,
    writing: settings.mode === "live", since: new Date(WORKFLOW_OFF_AT).toISOString(),
    category: CATEGORY, actions: ACT,
    mailReady: mailConfigured(),
    // the reminder on every other ticket in Remind
    others: { rows: (othersRows ?? []).slice(0, 150) },
    board: await board(settings, last ?? null, rows ?? [], othersRows ?? []),
    // the ERP's delivery dates followed (or listed), the shop's orders with the declaration, the ERP's requests known and
    // when the ERP's order file was last read for them
    dates: dRows.slice(0, 150), shop: sRows.slice(0, 200), erpRequests: Object.keys(reqs).length, erpRead: read,
  };
}
