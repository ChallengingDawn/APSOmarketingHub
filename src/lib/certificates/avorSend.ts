// CERTIFICATES - the mail to AVOR from the ticket card, and AVOR's answer back on the ticket (SARCLA 08.11.2026: "can we
// send the mail directly from here"; the rules in makerRules.ts).
//
// avorPass (the engine's 3-minute look, in Live): a mail queued on the card is claimed ("sending" - never twice), sent in
// the user's name to avor@angst-pfister.com, replies to support@apsoparts.com (as the mails written on the ticket), and
// logged on the ticket. A DEMO goes to the demo user only - never to AVOR; his reply goes to support@ like AVOR's, so
// the demo shows the answer merged in too (SARCLA 08.11.2026: "the answer will not be associated to this ticket").
//
// mergeAvorAnswer (the way in, boDistribution/intakeRun, before anything is decided on a new Back Office ticket): AVOR's
// answer opens a new support@ ticket - HubSpot lets no app start a conversation from the inbox, so there is no thread to
// answer on. When that ticket's mail is AVOR's answer to a mail the hub sent for an open request, it is merged into the
// request (the request stays, the answer's conversation moves onto it), the request remembers it and its owner gets a mail.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { FROM, REPLY_TO, addressOf, esc, sendHubMail, wrap } from "@/lib/notify/mailer";
import { INBOX_OWNERS, isInbox } from "@/lib/notify/teamRecipients";
import { AVOR_PROP, AVOR_TO, DEMO_PROP, avorNotSending, avorRefOf, demoOf, isAvorAnswer, parseAvor, type AvorState, type MakerRow } from "./makerRules";
import type { Facts } from "./rules";

const hs = <T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" = "GET", body?: unknown) => hubspotRetry<T>({ path, method, body });
const ticketUrl = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-5/${id}`;
const HUB_URL = process.env.HUB_PUBLIC_URL ?? "https://apsomarketinghub-dev.awssandbox.angst-pfister.com";
const BO = "1726786777";
const RESOLVED = "2338266328";
const EC1935 = "EC 1935/2004";
/** engine.ts KV.makerRows */
const MAKER_ROWS = "certificates:makerRows";

async function write(id: string, s: AvorState) {
  await hs(`/crm/v3/objects/tickets/${id}`, "PATCH", { properties: { [AVOR_PROP]: JSON.stringify(s) } });
}

/** The text as a person writes it - no hub frame around it. */
const htmlOf = (text: string) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#15223a;line-height:1.5">${esc(text).replace(/\n/g, "<br>")}</div>`;

/** The mail on the ticket's timeline - as sent, with who sent it and where answers go. */
async function logOnTicket(ticketId: string, s: AvorState, to: string, replyTo: string, subject: string) {
  const note = `- sent by APSOhub for ${s.by.name}; answers go to ${replyTo} and come onto this ticket`;
  const e = await hs<{ id: string }>("/crm/v3/objects/emails", "POST", {
    properties: {
      hs_timestamp: new Date().toISOString(), hs_email_direction: "EMAIL", hs_email_status: "SENT",
      hs_email_subject: subject, hs_email_text: `${s.body}\n\n${note}`,
      hs_email_html: `${htmlOf(s.body)}<p style="color:#7c98b6;font-size:12px;font-family:Arial">${esc(note)}</p>`,
      hs_email_headers: JSON.stringify({ from: { email: addressOf(FROM), firstName: s.by.name }, to: [{ email: to }], cc: [], bcc: [] }),
    },
  });
  await hs(`/crm/v4/objects/emails/${e.id}/associations/tickets/${ticketId}`, "PUT", [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 224 }]);
}

/** One look: every request whose AVOR mail the card queued. writing = the engine is Live; on = the switch on Settings
 *  (off: a queued mail is not sent and the card says to write it from the ticket - a DEMO goes whatever the switch). */
export async function avorPass(facts: (Facts & { avor?: string | null })[], held: Record<string, unknown>, writing: boolean, on = true): Promise<{ rows: MakerRow[]; mailed: number }> {
  const rows: MakerRow[] = [];
  let mailed = 0;
  if (!writing) return { rows, mailed };
  for (const f of facts) {
    const s = parseAvor(f.avor);
    if (!s || s.status !== "queued") continue;
    const why = avorNotSending(f, s, held, on);
    const at = new Date().toISOString();
    // on hold: it waits (the card says so) and goes once released
    if (why === "on hold") continue;
    if (why) {
      await write(f.id, { ...s, status: "failed", error: `not sent: ${why}` }).catch(() => undefined);
      rows.push({ at, ticketId: f.id, what: "avorFailed", to: s.to, eda: null, error: why, subject: s.subject });
      continue;
    }
    // claimed before anything goes out: never twice
    const claim: AvorState = { ...s, status: "sending" };
    await write(f.id, claim);
    const demo = demoOf(f.demo);
    const to = demo ? demo.email : AVOR_TO;
    const replyTo = addressOf(REPLY_TO);
    const subject = `${demo ? "[DEMO] " : ""}${s.subject}`.slice(0, 200);
    try {
      await sendHubMail({ to, subject, html: htmlOf(s.body), text: s.body, fromName: `${s.by.name} | APSOparts®`, replyTo });
      mailed++;
      await logOnTicket(f.id, s, to, replyTo, subject).catch((e) => console.warn(`[certificates] avor log ${f.id}: ${(e as Error).message}`));
      const sent = [...(s.sent ?? []), { at: new Date().toISOString(), to, by: s.by.name, replyTo, ...(s.remind ? { remind: true } : {}) }];
      await write(f.id, { ...claim, status: "sent", sent, error: undefined });
      rows.push({ at, ticketId: f.id, what: "avor", to, eda: null, subject });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      await write(f.id, { ...claim, status: "failed", error: msg }).catch(() => undefined);
      rows.push({ at, ticketId: f.id, what: "avorFailed", to, eda: null, error: msg, subject });
    }
  }
  return { rows, mailed };
}

type Obj = { id: string; properties: Record<string, string | null> };

/** The Mails tab's view of the mail to AVOR: the last one the hub sent (else the newest on a card), as it went out -
 *  nothing is sent. */
export async function avorPreview(ticketId: string | null): Promise<{ subject: string; html: string; to: string; ticket: { id: string; subject: string | null } | null; note?: string }> {
  const props = ["subject", AVOR_PROP, DEMO_PROP];
  let t: Obj | null = null;
  if (ticketId) t = await hs<Obj>(`/crm/v3/objects/tickets/${ticketId}?properties=${props.join(",")}`).catch(() => null);
  if (!t || !parseAvor(t.properties[AVOR_PROP])) {
    const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: AVOR_PROP, operator: "HAS_PROPERTY" }] }], properties: props,
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }], limit: 1,
    });
    t = j.results?.[0] ?? null;
  }
  const s = t ? parseAvor(t.properties[AVOR_PROP]) : null;
  if (!t || !s) return { subject: "WSMB | EG1935/2004 | M### | A##.###### | <customer> | APSOparts®", html: "", to: AVOR_TO, ticket: null, note: "No mail to AVOR sent from a ticket card yet - it shows here once one has gone." };
  const demo = demoOf(t.properties[DEMO_PROP]);
  return {
    subject: `${demo ? "[DEMO] " : ""}${s.subject}`, html: htmlOf(s.body),
    to: `${demo ? `${demo.email} (DEMO - never AVOR)` : AVOR_TO} · from "${s.by.name} | APSOparts®" · answers to ${addressOf(REPLY_TO)}`,
    ticket: { id: String(t.id), subject: t.properties.subject ?? null },
  };
}

/** The open request this AVOR answer belongs to: the Back Office ticket naming the A-number, with EC 1935/2004, whose
 *  AVOR mail the hub sent. */
async function requestOf(ref: string, not: string): Promise<{ id: string; owner: string | null; subject: string | null; s: AvorState } | null> {
  const digits = ref.slice(4);
  const props = ["order_number", "subject", "which_certificate__", "hs_pipeline_stage", "hubspot_owner_id", AVOR_PROP];
  const j = await hs<{ results?: Obj[] }>("/crm/v3/objects/tickets/search", "POST", {
    filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: BO }, { propertyName: AVOR_PROP, operator: "HAS_PROPERTY" }, { propertyName: "hs_pipeline_stage", operator: "NEQ", value: RESOLVED }] }],
    properties: props, sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100,
  });
  const hits = (j.results ?? []).filter((t) => String(t.id) !== not && (t.properties.which_certificate__ ?? "").includes(EC1935)
    && `${t.properties.order_number ?? ""} ${t.properties.subject ?? ""}`.includes(digits));
  for (const t of hits) {
    const s = parseAvor(t.properties[AVOR_PROP]);
    if (s && (s.sent ?? []).length) return { id: String(t.id), owner: t.properties.hubspot_owner_id ?? null, subject: t.properties.subject ?? null, s };
  }
  return null;
}

/**
 * The way in asks for every new Back Office ticket before it decides: is its mail AVOR's answer to a request? Then it is
 * merged into the request - true = handled (the way in leaves it: it no longer exists on its own).
 */
export async function mergeAvorAnswer(ticketId: string, ticketSubject: string | null, email: { from: string | null; subject: string | null; at: number } | null): Promise<{ merged: string; from: string | null } | null> {
  const ref = avorRefOf(email?.subject) ?? avorRefOf(ticketSubject);
  if (!ref || !email) return null;
  const req = await requestOf(ref, ticketId);
  if (!req || !isAvorAnswer(email, ref, req.s)) return null;
  // the request stays the one: the answer's conversation and mail move onto it
  const m = await hs<{ id?: string | number }>("/crm/v3/objects/tickets/merge", "POST", { primaryObjectId: req.id, objectIdToMerge: ticketId });
  const into = String(m.id ?? req.id);
  const answered = [...(req.s.answered ?? []), { at: new Date(email.at || Date.now()).toISOString(), ticket: ticketId, from: email.from }];
  await write(into, { ...req.s, answered }).catch((e) => console.warn(`[certificates] avor answered ${into}: ${(e as Error).message}`));
  // on Certificates > Settings, with the declarations and the AVOR mails
  const row: MakerRow = { at: new Date().toISOString(), ticketId: into, what: "avorAnswer", to: AVOR_TO, eda: null, from: email.from ?? undefined };
  await kvSet(MAKER_ROWS, [row, ...((await kvGet<MakerRow[]>(MAKER_ROWS)) ?? [])].slice(0, 200)).catch(() => undefined);
  // the owner hears it - the new article is then checked and "Article received" set on the card
  // never an inbox (the 05.11.2026 loop): not a queue user (Backoffice Team, TSA Team), not an inbox address
  if (req.owner && !INBOX_OWNERS.has(req.owner)) {
    try {
      const o = await hs<{ email?: string; firstName?: string }>(`/crm/v3/owners/${req.owner}`);
      if (o.email && !/hs-inbox\.com$/i.test(o.email) && !(await isInbox(o.email))) {
        const subject = `AVOR answered - ${req.subject ?? ref}`.slice(0, 180);
        const html = wrap({
          heading: "AVOR answered", intro: `AVOR answered on the EC 1935/2004 request ${ref}${email.from ? ` (${email.from})` : ""} - the mail is on the ticket. When the new article is there: "Article received" on the card "Certificate request".`,
          rows: "", cta: { label: "Open the ticket", href: ticketUrl(into), red: true }, hubUrl: HUB_URL,
          footer: "Sent by APSOhub (UC & HubSpot Apps > Certificates): AVOR's answer to the mail sent from the ticket card.",
        });
        await sendHubMail({ to: o.email, subject, html, text: `AVOR answered on ${ref}${email.from ? ` (${email.from})` : ""} - the mail is on the ticket.\nWhen the new article is there: "Article received" on the card "Certificate request".\n\n${ticketUrl(into)}` });
      }
    } catch (e) { console.warn(`[certificates] avor owner mail ${into}: ${(e as Error).message}`); }
  }
  return { merged: into, from: email.from };
}
