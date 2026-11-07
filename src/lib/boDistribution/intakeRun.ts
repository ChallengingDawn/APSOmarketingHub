// THE WAY IN, run (the rule in intake.ts) - every ticket that enters Back Office "New", inside the Back Office
// distribution's minute (engine.ts run), before anything is decided (SARCLA 05.11.2026: "This is the one we need to
// migrate"; 07.11.2026: "I want to do it only via the hub").
//
// From INTAKE_FROM on, every ticket that enters "New", 20 seconds after (an e-mail ticket waits up to 3 minutes for its
// e-mail): the hub writes subject / requester / owner / stage in one PATCH and mails "❗Back Office Ticket Created" to
// the people picked on the Way in tab - and the distribution decides that ticket only after (pending).
// Older than the steered age (the hub was down) = left alone - a person may have it.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { FROM, addressOf, esc, mailConfigured, sendHubMail, wrap } from "@/lib/notify/mailer";
import { NOBODY, teamRecipients } from "@/lib/notify/teamRecipients";
import { INTAKE_FROM, MAIL_SUBJECT, STAGE_NEW, intakeOf, type Intake, type IntakeConfig, type IntakeFacts } from "./intake";
import { getIntakeSettings, type IntakeSettings } from "./intakeSettings";

const BO = "1726786777";
const KV = { rows: "boDist:intake:rows", done: "boDist:intake:done", last: "boDist:intake:last" };
// the waits are steered on Back Office distribution > Way in (intakeSettings.ts): 20 s after entry, an e-mail ticket up
// to 3 min for its e-mail, and older than 30 min never taken in (the hub was down) = left alone - a person may have it.
// The search reaches 5 minutes past that (at least 35 minutes).
const windowMs = (maxAgeMs: number) => Math.max(35 * 60_000, maxAgeMs + 5 * 60_000);
const ROWS_KEPT = 700;

type Hist = { value: string; timestamp: string; sourceType?: string; sourceId?: string };
type Obj = { id: string; properties: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist[]> };
const hs = <T,>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const ts = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);

export type IntakeRow = {
  ticketId: string; enteredAt: string; at: string; subjectBefore: string | null;
  branch: Intake["branch"] | null; team: string | null; props: Record<string, string>; mail: boolean;
  /** done / failed = the hub wrote it; skipped = left alone; certificates = handed to Certificates
   *  (shadow: an old row from before 07.11.2026, never shown) */
  what: "shadow" | "done" | "failed" | "skipped" | "certificates"; why?: string; error?: string; mailText?: string;
};
export type IntakeLast = { at: string; seen: number; done: number; pending: number; error?: string };

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
// on the Way in tab, each to their own address - never an inbox (notify/teamRecipients); nobody picked = not sent.
/** "❗Back Office Ticket Created" as it goes out (the Certificates > Mails tab shows it, mailTeam sends it). */
function renderCreated(id: string, p: Record<string, string | null>, subject: string): { html: string; text: string } {
  const rows: [string, string][] = ([
    ["Name", subject], ["Category", joined(p, SUBCATS)], ["Description", p.content ?? ""], ["Article Number", p.article_number ?? ""],
    ["Order Number", p.order_number ?? ""], ["Invoice Number", p.invoice_number ?? ""], ["Order Issue Information", p.order_issue_information ?? ""],
    ["Additional Information for Back Office", joined(p, TEXTBOXES)], ["Other", p.others_bo_case ?? ""],
  ] as [string, string][]).map(([k, v]) => [k, v.replace(/\s+/g, " ").trim().slice(0, 600) || "-"] as [string, string]);
  const html = wrap({
    heading: "Ticket Information", intro: "A new Back Office ticket.",
    rows: `<table style="border-collapse:collapse">${rows.map(([k, v]) => rowHtml(k, v)).join("")}</table>`,
    cta: { label: "Open the ticket", href: ticketUrl(id) }, hubUrl: HUB_URL,
    footer: "Sent by APSOhub (UC & HubSpot Apps > Back Office distribution > Way in).",
  });
  const text = ["Ticket Information", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ticketUrl(id)].join("\n");
  return { html, text };
}
async function mailTeam(id: string, p: Record<string, string | null>, subject: string, ids: string[]): Promise<{ ok: boolean; text: string }> {
  const to = await teamRecipients(ids);
  if (!to.length) return { ok: true, text: NOBODY };
  if (!mailConfigured()) return { ok: false, text: "the hub cannot send mail" };
  const { html, text } = renderCreated(id, p, subject);
  const who = to.map((r) => r.name).join(", ");
  try { await sendHubMail({ to: to.map((r) => r.email).join(", "), subject: MAIL_SUBJECT, html, text }); return { ok: true, text: `mail to ${who}` }; }
  catch (e) { return { ok: false, text: `mail to ${who} failed: ${(e as Error).message.slice(0, 120)}` }; }
}

/** The mail on the latest ticket the way in wrote (nothing is sent) - and who would get it. */
export async function createdPreview(): Promise<{ subject: string; html: string; to: string; ticket: { id: string; subject: string | null } | null; note?: string }> {
  const rows = (await kvGet<IntakeRow[]>(KV.rows)) ?? [];
  const row = rows.find((r) => r.what === "done" && r.mail) ?? rows.find((r) => r.what === "done");
  if (!row) return { subject: MAIL_SUBJECT, html: "", to: "", ticket: null, note: "No ticket taken in yet to show it on." };
  const t = await hs<Obj>(`/crm/v3/objects/tickets/${row.ticketId}?properties=${FACT_PROPS.join(",")}`);
  const set = await getIntakeSettings();
  const to = set.mail ? await teamRecipients(set.to) : [];
  const subject = row.props.subject ?? t.properties.subject ?? "";
  return {
    subject: MAIL_SUBJECT, ...renderCreated(row.ticketId, t.properties, subject),
    to: !set.mail ? "nobody - switched off on the Way in tab" : to.map((r) => `${r.name} <${r.email}>`).join(", ") || "nobody - no one picked on the Way in tab",
    ticket: { id: row.ticketId, subject },
  };
}

// ---------------- one pass ----------------
/**
 * Called first in each distribution run. pending = Back Office tickets the hub still has to take in: the distribution
 * leaves them for the next minute. failed = the pass could not look - the distribution then holds every ticket younger
 * than 5 minutes.
 */
export async function intakePass(): Promise<{ pending: Set<string>; failed: boolean; live: boolean | null }> {
  const pending = new Set<string>();
  let live: boolean | null = null;
  const last: IntakeLast = { at: new Date().toISOString(), seen: 0, done: 0, pending: 0 };
  try {
    live = true;
    const now = Date.now();
    const set: IntakeSettings = await getIntakeSettings();
    const cfg: IntakeConfig = { teams: set.teams, creators: set.creators };
    const MIN_AGE_MS = set.waitS * 1000, EMAIL_WAIT_MS = set.emailWaitS * 1000, LIVE_MAX_AGE_MS = set.maxAgeMin * 60_000;
    const prop = `hs_v2_date_entered_${STAGE_NEW}`;
    const r = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: prop, operator: "GTE", value: String(now - windowMs(LIVE_MAX_AGE_MS)) }] }],
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
      // before the way in was the hub's alone
      if (entered < INTAKE_FROM) continue;
      const base = { ticketId: id, enteredAt: new Date(entered).toISOString(), at: new Date().toISOString() };
      if (age > LIVE_MAX_AGE_MS) {
        rows.unshift({ ...base, subjectBefore: null, branch: null, team: null, props: {}, mail: false, what: "skipped", why: `older than ${set.maxAgeMin} minutes - the hub was not running; left to the Back Office` });
        done.add(id);
        continue;
      }
      if (age < MIN_AGE_MS) { pending.add(id); continue; }
      try {
        const t = await hs<Obj>(`/crm/v3/objects/tickets/${id}?properties=${FACT_PROPS.join(",")}`);
        const p = t.properties;
        if (p.hs_pipeline !== BO || p.hs_pipeline_stage !== STAGE_NEW) {
          rows.unshift({ ...base, subjectBefore: p.subject ?? null, branch: null, team: null, props: {}, mail: false, what: "skipped", why: "already out of New when the hub looked" });
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
        const want = intakeOf(factsOf(p, email, names, p.hubspot_owner_id ?? null), cfg);
        // a certificate request: Certificates takes it on - the requester, then the steps (SARCLA 06.11.2026: "the
        // certificates part should be on certificates")
        if (want.branch === "CERTIFICATE") {
          rows.unshift({ ...base, subjectBefore: p.subject ?? null, branch: want.branch, team: null, props: {}, mail: false, what: "certificates", why: "a certificate request - Certificates sets the requester and takes it on" });
          done.add(id);
          continue;
        }
        const row: IntakeRow = { ...base, subjectBefore: p.subject ?? null, branch: want.branch, team: want.team, props: want.props, mail: want.mail, what: "done" };
        try {
          if (Object.keys(want.props).length) await hs(`/crm/v3/objects/tickets/${id}`, "PATCH", { properties: want.props });
          // the way in's switch (Back Office distribution > Way in, "❗Back Office Ticket Created")
          if (want.mail && !set.mail) row.mailText = "mail switched off on the Way in tab";
          else if (want.mail) {
            const sent = await mailTeam(id, p, want.props.subject ?? p.subject ?? "", set.to);
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
  const [rows, last] = await Promise.all([kvGet<IntakeRow[]>(KV.rows), kvGet<IntakeLast>(KV.last)]);
  const all = (rows ?? []).filter((r) => r.what !== "shadow");
  const week = all.filter((r) => Date.now() - Date.parse(r.enteredAt) < 7 * 86400_000);
  const mailed = week.filter((r) => (r.mailText ?? "").startsWith("mail to")).length;
  return {
    from: new Date(INTAKE_FROM).toISOString(), last: last ?? null, mailReady: mailConfigured(),
    figures: { done: week.filter((r) => r.what === "done").length, failed: week.filter((r) => r.what === "failed").length, mailed, skipped: week.filter((r) => r.what === "skipped").length, certificates: week.filter((r) => r.what === "certificates").length },
    rows: all.slice(0, 200),
  };
}
