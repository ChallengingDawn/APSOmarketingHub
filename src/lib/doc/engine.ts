// DoC - Declarations of Conformity for seal orders, emailed once the order is invoiced.
//
// Moved here from SARCLA C2S V1, which had it only because it already polled the
// shop; the two have nothing else in common. The flow is unchanged:
//
//   web order arrives  -> capture (every 15 min, straight from Magento) flags its
//                         HubSpot order: order_web_order_number, order_doc_request=
//                         seal, order_doc_status=waiting
//   Compass, daily     -> creates the delivery record (A26.x.001) and archives the
//                         web order's .000 - after carrying those three fields over
//                         (compass-connector service/orders_daily.py, WEB_CARRY)
//   ERP invoices       -> Compass moves the delivery to "Invoiced (Sent to customer)"
//   the sweep (hourly) -> article -> compound -> newest AP-Link declaration (PricingHub
//                         backend /api/doc/*), email with the PDFs ATTACHED through
//                         HubSpot's transactional SMTP, logged on the order, contact
//                         and company, stamped order_doc_status=sent
//
// The PDF is attached, so the email goes through SMTP: HubSpot's single-send API
// cannot carry attachments. Positions without a declaration were not eligible in
// the shop and are left out. Plastics (8001133004) stay with the Back Office.
//
// The HubSpot fields are the whole state - no state file, no table - so C2S V1 and
// the hub read and write the same thing, and switching over is a matter of which
// one has DOC_CAPTURE_FROM and DOC_SEND_EMAIL set.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { kvGet, kvSet } from "@/lib/db/init";
import {
  AP_NUMBER, CANCELLED, DOC_SKU, FEE_SKUS, FROM, INVOICED, REPLY_TO, REQUEST_PROP, STATUS_PROP,
  TICKET_PIPELINE_ID, TICKET_STAGE_ID, WEB_PROP, backend, captureFrom, captureOn, expireDays,
  maxPerDay, sendingOn, smtp,
} from "./config";
import { esc, greetingFor, languageFor, renderEmail, type Greeting, type RenderedEmail } from "./email";
import { orderByIncrementId, orderSkusCreatedSince, type ShopOrder } from "./magento";
import { phaseOf, boardRow, type BoardRow } from "./board";
import type { DocLang } from "./texts";

type Log = Pick<Console, "log" | "warn" | "error">;

// ── HubSpot ────────────────────────────────────────────────────────────────

type Props = Record<string, string | null | undefined>;
type Rec = { id: string; properties?: Props };
type Search = { results?: Rec[]; paging?: { next?: { after?: string } } };

function hs<T>(method: "GET" | "POST" | "PATCH" | "PUT", path: string, body?: unknown): Promise<T> {
  return hubspotFetchJson<T>({ method, path, body, useTicketsToken: path.includes("/tickets") });
}

const searchOrders = (body: unknown) => hs<Search>("POST", "/crm/v3/objects/orders/search", body);

const setStatus = async (ids: string[], status: string) => {
  for (const id of ids) {
    await hs("PATCH", `/crm/v3/objects/orders/${id}`, { properties: { [STATUS_PROP]: status } });
  }
};

/** Every record of one ERP order: its deliveries (.001, .002 ...) carry the invoicing. */
async function stagesOfErpOrder(base: string): Promise<string[]> {
  const all = await searchOrders({
    filterGroups: [{ filters: [{ propertyName: "order_order_number", operator: "CONTAINS_TOKEN", value: base }] }],
    properties: ["order_order_number", "hs_pipeline_stage"],
    limit: 50,
  });
  return (all.results ?? [])
    .filter((o) => String(o.properties?.order_order_number ?? "").startsWith(base + "."))
    .map((o) => String(o.properties?.hs_pipeline_stage ?? ""))
    .filter(Boolean);
}

type Contact = { id: string; lang: string; companyId: string | null; props: Props };

/** The customer's contact: language, the fields the greeting needs, and its company. */
async function contactByEmail(email: string): Promise<Contact | null> {
  if (!email) return null;
  const filter = { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], limit: 1 };
  let r: Search;
  try {
    r = await hs<Search>("POST", "/crm/v3/objects/contacts/search", {
      ...filter,
      properties: ["email", "hs_language", "firstname", "lastname", "salutation", "salutation_phrase", "eyemagine_prefix"],
    });
  } catch {
    // a portal missing one of the optional properties must not break the lookup
    r = await hs<Search>("POST", "/crm/v3/objects/contacts/search", {
      ...filter,
      properties: ["email", "hs_language", "firstname", "lastname", "salutation"],
    });
  }
  const c = r.results?.[0];
  if (!c) return null;
  let companyId: string | null = null;
  try {
    const a = await hs<{ results?: { toObjectId: number | string }[] }>("GET", `/crm/v4/objects/contacts/${c.id}/associations/companies`);
    companyId = a.results?.[0] ? String(a.results[0].toObjectId) : null;
  } catch {
    /* the company is optional */
  }
  return {
    id: c.id,
    lang: String(c.properties?.hs_language ?? "").slice(0, 2).toLowerCase(),
    companyId,
    props: c.properties ?? {},
  };
}

// ── shared run state (kv: whichever hub task runs, they all see the same) ──

export type RunStats = { at: string; error?: string; [k: string]: unknown };
export type Runs = {
  lastCapture?: RunStats;
  lastSweep?: RunStats;
  /** Start of the last capture that completed - the next one reads from an hour before it. */
  captureOkFrom?: number;
  /** When a run was last STARTED, ok or not: a failing shop is retried after the
   *  full interval, never every minute (its WAF bans bursts). */
  captureTriedAt?: string;
  sweepTriedAt?: string;
};

const RUNS_KEY = "doc:runs";
export const readRuns = async (): Promise<Runs> => (await kvGet<Runs>(RUNS_KEY)) ?? {};
export async function writeRuns(patch: Partial<Runs>) {
  await kvSet(RUNS_KEY, { ...(await readRuns()), ...patch });
}

const todayKey = () => `doc:sent:${new Date().toISOString().slice(0, 10)}`;
export const sentToday = async () => (await kvGet<number>(todayKey())) ?? 0;
async function countSent() {
  await kvSet(todayKey(), (await sentToday()) + 1);
}

// ── capture ────────────────────────────────────────────────────────────────
// Only orders placed from DOC_CAPTURE_FROM on: earlier ones were handled by hand
// (or by C2S V1) and must not get a second, automatic mail.

const magentoTs = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

export async function capture(log: Log = console) {
  if (!captureOn()) return { skipped: "DOC_CAPTURE_FROM is not set (or the Magento keys are missing)" };
  const startedAt = Date.now();
  const runs = await readRuns();
  // overlap an hour so an order whose HubSpot record lagged is seen again; 48 h after a gap
  const since = Math.max(captureFrom(), runs.captureOkFrom ? runs.captureOkFrom - 3600_000 : startedAt - 48 * 3600_000);
  const orders = await orderSkusCreatedSince(magentoTs(since));
  const out = { at: new Date(startedAt).toISOString(), scanned: orders.length, withDeclaration: 0, flagged: 0, notInHubSpotYet: 0 };
  for (const o of orders) {
    if (!o.skus.includes(DOC_SKU)) continue;
    out.withDeclaration++;
    const r = await searchOrders({
      filterGroups: [{ filters: [{ propertyName: "hs_external_order_id", operator: "EQ", value: o.incrementId }] }],
      properties: [STATUS_PROP],
      limit: 5,
    });
    const recs = r.results ?? [];
    if (!recs.length) {
      out.notInHubSpotYet++; // the order connector is a minute behind: next pass
      continue;
    }
    for (const rec of recs) {
      if (rec.properties?.[STATUS_PROP]) continue; // never reset a "sent" to "waiting"
      await hs("PATCH", `/crm/v3/objects/orders/${rec.id}`, {
        properties: { [WEB_PROP]: o.incrementId, [REQUEST_PROP]: "seal", [STATUS_PROP]: "waiting" },
      });
      out.flagged++;
      log.log(`[doc] ${o.incrementId}: Declaration of Conformity ordered - flagged, emailed once invoiced`);
    }
  }
  await writeRuns({ lastCapture: out, captureOkFrom: startedAt });
  return out;
}

// ── the documents for one web order ────────────────────────────────────────

type Resolved = {
  article: string;
  compound?: string;
  reason?: string;
  declaration?: { id: string | number; name: string; key?: string } | null;
};

export type DeclarationGroup = { id: string; file: string; compound: string; positions: { sku: string; name: string }[] };
export type NotEligible = { sku: string; name: string; reason: string };

async function fromBackend(path: string): Promise<Response> {
  const b = backend();
  const r = await fetch(`${b.url}${path}`, { headers: { "x-internal-key": b.key }, cache: "no-store" });
  if (!r.ok) throw new Error(`declaration backend ${r.status} ${path.split("?")[0]}`);
  return r;
}

export async function prepare(webNo: string): Promise<{ mo: ShopOrder; groups: DeclarationGroup[]; notEligible: NotEligible[] }> {
  const mo = await orderByIncrementId(webNo);
  if (!mo) throw new Error(`Magento order ${webNo} not found`);
  const lines = mo.items.filter((it) => it.sku && !FEE_SKUS.has(it.sku));
  const found: Resolved[] = lines.length
    ? ((await (await fromBackend(`/api/doc/resolve?articles=${encodeURIComponent(lines.map((l) => l.sku).join(","))}`)).json()) as {
        declarations?: Resolved[];
      }).declarations ?? []
    : [];
  const bySku = new Map(found.map((f) => [f.article, f]));
  const groups = new Map<string, DeclarationGroup>();
  const notEligible: NotEligible[] = [];
  for (const l of lines) {
    const f = bySku.get(l.sku.replace(/\D/g, ""));
    if (!f || !f.declaration) {
      notEligible.push({ sku: l.sku, name: l.name, reason: f?.reason ?? "not resolved" });
      continue;
    }
    // FEP-O-SEAL's declaration is for the product line, not its core compound
    const label = f.declaration.key === "FEP-O-SEAL" ? "FEP-O-SEAL®" : (f.compound ?? "");
    const id = String(f.declaration.id);
    const g = groups.get(id) ?? { id, file: f.declaration.name, compound: label, positions: [] };
    g.positions.push({ sku: l.sku, name: l.name });
    groups.set(id, g);
  }
  return { mo, groups: [...groups.values()], notEligible };
}

type Attachment = { filename: string; content: Buffer; contentType: string };

async function attachments(groups: DeclarationGroup[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const g of groups) {
    const buf = Buffer.from(await (await fromBackend(`/api/doc/${g.id}/file`)).arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`declaration ${g.id} is not a PDF`);
    out.push({ filename: g.file, content: buf, contentType: "application/pdf" });
  }
  return out;
}

let transport: Transporter | null = null;

async function sendMail(m: { to: string; subject: string; html: string; text: string; files: Attachment[] }) {
  const s = smtp();
  transport ??= nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.port === 465,
    requireTLS: s.port !== 465,
    auth: { user: s.user, pass: s.pass },
  });
  const info = await transport.sendMail({
    from: FROM, replyTo: REPLY_TO, to: m.to, subject: m.subject, html: m.html, text: m.text, attachments: m.files,
  });
  if (!info.accepted || !info.accepted.length) throw new Error(`SMTP refused ${m.to}: ${JSON.stringify(info.rejected ?? [])}`);
  return info;
}

// ── what the Back Office sees on the records ───────────────────────────────

const EMAIL_ASSOC = { orders: 777, contacts: 198, companies: 186 } as const;
const TICKET_ASSOC = { orders: 526, contacts: 16, companies: 339 } as const;
type AssocType = keyof typeof EMAIL_ASSOC;

function targets(orderIds: string[], contactId?: string | null, companyId?: string | null): [AssocType, string][] {
  const out: [AssocType, string][] = orderIds.map((id) => ["orders", id]);
  if (contactId) out.push(["contacts", contactId]);
  if (companyId) out.push(["companies", companyId]);
  return out;
}

async function logEmail(p: {
  orderIds: string[]; contactId?: string | null; companyId?: string | null;
  to: string; mail: RenderedEmail; files: Attachment[]; log: Log;
}) {
  const note = `— sent automatically to ${p.to} by the APSOhub DoC app, attached: ${p.files.map((f) => f.filename).join(", ")}`;
  const e = await hs<{ id: string }>("POST", "/crm/v3/objects/emails", {
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_email_direction: "EMAIL",
      hs_email_status: "SENT",
      hs_email_subject: p.mail.subject,
      hs_email_text: `${p.mail.text}\n\n${note}`,
      hs_email_html: p.mail.html.replace(
        "</body>",
        `<p style="color:#7c98b6;font-size:12px;font-family:Arial;text-align:center">${esc(note)}</p></body>`,
      ),
      hs_email_headers: JSON.stringify({
        from: { email: "info@news.apsoparts.com", firstName: "APSOparts®" }, to: [{ email: p.to }], cc: [], bcc: [],
      }),
    },
  });
  for (const [type, id] of targets(p.orderIds, p.contactId, p.companyId)) {
    try {
      await hs("PUT", `/crm/v4/objects/emails/${e.id}/associations/${type}/${id}`, [
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: EMAIL_ASSOC[type] },
      ]);
    } catch (err) {
      p.log.warn(`[doc] email-${type} association failed: ${(err as Error).message}`);
    }
  }
}

// The shop only offers the declaration for seals that have one, so an order with
// the fee line where we find NONE means our matching broke - the customer paid and
// would get nothing. That one case goes to the Back Office.
async function nothingFoundTicket(p: {
  webNo: string; base: string | null; company: string; lines: NotEligible[];
  orderIds: string[]; contactId?: string | null; companyId?: string | null; log: Log;
}) {
  const t = await hs<{ id: string }>("POST", "/crm/v3/objects/tickets", {
    properties: {
      subject: `CERTIFICATES | ${p.webNo} | ${p.company}`,
      content: [
        `Order ${p.base ?? ""} (shop ${p.webNo}) was invoiced. The customer paid for a Declaration of Conformity (8001228582),`,
        "but no declaration could be found in AP-Link for any of its positions, so nothing was emailed. Please send it:",
        "",
        ...p.lines.map((l) => `- ${l.sku} ${l.name}  (${l.reason || "no declaration"})`),
      ].join("\n"),
      hs_ticket_priority: "MEDIUM",
      source_type: "AUTOMATION",
      enquiry_category: "Certificates (ONLY FOR BO)",
      hs_ticket_category: "Data Sheets and Conformities",
      hs_pipeline: TICKET_PIPELINE_ID,
      hs_pipeline_stage: TICKET_STAGE_ID,
    },
  });
  for (const [type, id] of targets(p.orderIds, p.contactId, p.companyId)) {
    try {
      await hs("PUT", `/crm/v4/objects/tickets/${t.id}/associations/${type}/${id}`, [
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: TICKET_ASSOC[type] },
      ]);
    } catch (err) {
      p.log.warn(`[doc] ticket-${type} association failed: ${(err as Error).message}`);
    }
  }
  return t;
}

// ── one order ──────────────────────────────────────────────────────────────

export type Preview = {
  summary: string;
  lang: DocLang;
  greeting: Greeting;
  recipient: string;
  company: string;
  groups: DeclarationGroup[];
  notEligible: NotEligible[];
  mail: RenderedEmail;
};

/** Everything the email would be, decided on the CUSTOMER's contact - nothing is sent or written. */
export async function preview(webNo: string, opts: { to?: string | null; lang?: string | null } = {}) {
  const p = await prepare(webNo);
  const contact = await contactByEmail(p.mo.email).catch(() => null);
  const lang = languageFor({ override: opts.lang, contactLang: contact?.lang, webNo, country: p.mo.country });
  const recipient = opts.to || p.mo.email;
  const greeting = greetingFor({ lang, props: contact?.props, email: p.mo.email });
  const mail = renderEmail({ lang, to: recipient, greeting: greeting.text });
  const positions = p.groups.reduce((n, g) => n + g.positions.length, 0);
  const summary =
    `${webNo} (${p.mo.company}): ${p.groups.length} declaration(s) for ${positions} position(s)` +
    `${p.notEligible.length ? `, ${p.notEligible.length} without one` : ""} [${lang}, ${greeting.personal ? "personal" : "generic"} greeting]`;
  const out: Preview = { summary, lang, greeting, recipient, company: p.mo.company, groups: p.groups, notEligible: p.notEligible, mail };
  return { ...out, contact };
}

/**
 * Operator test: this order's real email, PDFs attached, to ONE internal address.
 * Nothing is stamped, logged or counted - it proves the whole chain from AWS.
 */
export async function sendTest(webNo: string, to: string, lang?: string | null) {
  const v = await preview(webNo, { to, lang });
  if (!v.groups.length) return { sent: false, summary: v.summary, error: "no declaration found for this order" };
  const files = await attachments(v.groups);
  const info = await sendMail({ to, subject: v.mail.subject, html: v.mail.html, text: v.mail.text, files });
  return {
    sent: true, summary: v.summary, to, lang: v.lang, subject: v.mail.subject, messageId: info.messageId,
    attached: files.map((f) => `${f.filename} (${Math.round(f.content.length / 1024)} KB)`),
  };
}

async function deliver(p: { webNo: string; base: string; orderIds: string[]; log: Log }) {
  const v = await preview(p.webNo);
  const contact = v.contact;
  if (!v.groups.length) {
    const t = await nothingFoundTicket({
      webNo: p.webNo, base: p.base, company: v.company, lines: v.notEligible,
      orderIds: p.orderIds, contactId: contact?.id, companyId: contact?.companyId, log: p.log,
    });
    const status = `back office ${new Date().toISOString().slice(0, 16)}Z (no declaration found) ticket ${t.id}`;
    await setStatus(p.orderIds, status);
    p.log.warn(`[doc] ${v.summary} -> ${status}`);
    return { status };
  }

  const files = await attachments(v.groups); // a failure here leaves the order waiting

  // Claim the order BEFORE sending: if anything dies between the send and the
  // final stamp, the order sits at "sending" and is never mailed twice.
  await setStatus(p.orderIds, `sending ${new Date().toISOString()}`);
  try {
    await sendMail({ to: v.recipient, subject: v.mail.subject, html: v.mail.html, text: v.mail.text, files });
  } catch (e) {
    await setStatus(p.orderIds, "waiting").catch(() => {});
    throw new Error(`email failed (${(e as Error).message}) - stays waiting, retried next sweep`);
  }
  await countSent();
  const status = `sent ${new Date().toISOString().slice(0, 16)}Z (${files.length} declaration${files.length === 1 ? "" : "s"})`;
  await setStatus(p.orderIds, status);
  try {
    await logEmail({ orderIds: p.orderIds, contactId: contact?.id, companyId: contact?.companyId, to: v.recipient, mail: v.mail, files, log: p.log });
  } catch (e) {
    p.log.warn(`[doc] logging the email on ${p.webNo} failed: ${(e as Error).message}`);
  }
  p.log.log(`[doc] ${v.summary} -> ${status}`);
  return { status };
}

// ── the sweep ──────────────────────────────────────────────────────────────

/** Groups flagged order records by their web order: the .000 and its delivery may both carry it. */
function byWebOrder(recs: Rec[]): Map<string, Rec[]> {
  const byWeb = new Map<string, Rec[]>();
  for (const o of recs) {
    const web = o.properties?.[WEB_PROP];
    if (!web) continue;
    if (!byWeb.has(web)) byWeb.set(web, []);
    byWeb.get(web)!.push(o);
  }
  return byWeb;
}

const erpBase = (recs: Rec[]) =>
  recs.map((o) => AP_NUMBER.exec(o.properties?.order_order_number ?? "")).find(Boolean)?.[1] ?? null;

export async function sweep(log: Log = console) {
  if (!sendingOn()) return { skipped: "DOC_SEND_EMAIL is not 1 (or SMTP / Magento / backend keys are missing)" };
  const out = { at: new Date().toISOString(), waiting: 0, due: 0, sent: 0, backOffice: 0, cancelled: 0, expired: 0, errors: 0, breaker: false };
  const r = await searchOrders({
    filterGroups: [{ filters: [{ propertyName: STATUS_PROP, operator: "EQ", value: "waiting" }] }],
    properties: [WEB_PROP, "order_order_number", "hs_pipeline_stage", "hs_createdate"],
    sorts: [{ propertyName: "hs_createdate", direction: "ASCENDING" }],
    limit: 100,
  });
  const byWeb = byWebOrder(r.results ?? []);
  out.waiting = byWeb.size;
  const budget = maxPerDay();
  for (const [webNo, recs] of byWeb) {
    try {
      const ids = recs.map((o) => o.id);
      const base = erpBase(recs);
      const oldest = Math.min(...recs.map((o) => Date.parse(o.properties?.hs_createdate ?? "") || Date.now()));
      if (!base) {
        // no ERP number yet (it lands 5-8 days after the order); give up only after months
        if (Date.now() - oldest > expireDays() * 86400_000) {
          await setStatus(ids, "expired (never linked to an ERP order)");
          out.expired++;
        }
        continue;
      }
      const stages = await stagesOfErpOrder(base);
      if (!stages.includes(INVOICED)) {
        if (stages.length && stages.every((s) => s === CANCELLED)) {
          await setStatus(ids, "cancelled");
          out.cancelled++;
        }
        continue;
      }
      out.due++;
      if ((await sentToday()) >= budget) {
        out.breaker = true;
        log.error(`[doc] ALARM: daily breaker (${budget}) reached - ${webNo} waits for tomorrow. Investigate before raising DOC_MAX_PER_DAY.`);
        break;
      }
      const res = await deliver({ webNo, base, orderIds: ids, log });
      if (res.status.startsWith("sent")) out.sent++;
      else out.backOffice++;
    } catch (e) {
      out.errors++;
      log.warn(`[doc] ${webNo} failed: ${(e as Error).message}`); // stays waiting, retried next sweep
    }
  }
  await writeRuns({ lastSweep: out });
  return out;
}

// ── the board: every flagged order and where it stands ─────────────────────
// One row per web order: ordered -> ERP number -> invoiced -> emailed. Read-only,
// cached briefly so a screen left open does not become a stream of searches.

export type Board = { at: string; total: number; counts: Partial<Record<BoardRow["phase"], number>>; rows: BoardRow[] };

const BOARD_TTL = 2 * 60_000;
const cache: { at: number; data: Board | null; inflight: Promise<Board> | null } = { at: 0, data: null, inflight: null };

export function declarationBoard(fresh = false): Promise<Board> {
  if (!fresh && cache.data && Date.now() - cache.at < BOARD_TTL) return Promise.resolve(cache.data);
  if (cache.inflight) return cache.inflight;
  cache.inflight = buildBoard()
    .then((d) => {
      cache.data = d;
      cache.at = Date.now();
      return d;
    })
    .finally(() => {
      cache.inflight = null;
    });
  return cache.inflight;
}

async function buildBoard(): Promise<Board> {
  const recs: Rec[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const r = await searchOrders({
      filterGroups: [{ filters: [{ propertyName: REQUEST_PROP, operator: "EQ", value: "seal" }] }],
      properties: [WEB_PROP, STATUS_PROP, "order_order_number", "order_customer_name", "hs_order_name", "hs_pipeline_stage", "hs_createdate"],
      sorts: [{ propertyName: "hs_createdate", direction: "DESCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    });
    recs.push(...(r.results ?? []));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const rows: BoardRow[] = [];
  for (const [web, list] of byWebOrder(recs)) {
    const base = erpBase(list);
    let stages = list.map((o) => String(o.properties?.hs_pipeline_stage ?? "")).filter(Boolean);
    const statuses = list.map((o) => String(o.properties?.[STATUS_PROP] ?? "waiting"));
    // how far the ERP order got: the deliveries carry it, so ask for the whole order while it waits
    if (base && phaseOf({ statuses, stages: [], base }) === "awaiting-invoice") {
      try {
        stages = await stagesOfErpOrder(base);
      } catch {
        /* keep what the flagged records say */
      }
    }
    rows.push(boardRow({
      web,
      ids: list.map((o) => o.id),
      statuses,
      stages,
      base,
      company:
        list.map((o) => o.properties?.order_customer_name).find(Boolean) ??
        list.map((o) => String(o.properties?.hs_order_name ?? "").split(" | ")[1]).find(Boolean) ??
        "",
      orderedAt: list.map((o) => o.properties?.hs_createdate).filter(Boolean).sort()[0] ?? null,
    }));
  }
  rows.sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)));
  const counts: Board["counts"] = {};
  for (const row of rows) counts[row.phase] = (counts[row.phase] ?? 0) + 1;
  return { at: new Date().toISOString(), total: rows.length, counts, rows };
}
