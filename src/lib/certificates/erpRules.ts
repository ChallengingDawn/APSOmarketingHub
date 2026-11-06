// CERTIFICATES - what the ERP and the shop say about a certificate request. Pure, relative imports only (the tests).
//
// THE ERP'S REQUESTS. A customer who adds the Declaration of Conformity (8001133004, plastics) in the shop gets it in
// the ERP order's internal comment, one request per line, the same German on every shop:
//   "Auftragspos.: 10 - Bitte Konformitätserklärung erstellen: FDA."
//   "Auftragspos.: 30 - Bitte Konformitätserklärung erstellen: EG 1935/2004 + EU 10/2011. / Auftragspos.: 30 - ...: FDA."
// Checked 06.11.2026 on the ERP's order file of July (36 orders): the certificates on the Back Office's ticket were the
// same on 32 - the other 4, the Back Office added or left out FDA - and the ticket's position was the ERP's every time
// it named one. Position N is the N/10-th article line of the web order (25 of 26 checked).
//
// THE DELIVERY DATE (SARCLA 06.11.2026: "some time we trigger the certificate based on the first delivery date via the
// connector and Compass - are we able to update the date as it goes?"). The ticket's date is typed by hand from the
// ERP's first planned date and never moves; the ERP's does, and the Compass chain keeps it on each delivery in HubSpot
// (order_shipment_date, A26.x.001 / .002). Checked 06.11 on the open tickets: of 19 with a clear delivery, 17 left
// EARLIER than the ticket's date (1 to 24 days), 1 later, 1 on the day.

export const FEE_PLASTICS = "8001133004";
export const FEE_SEALS = "8001228582";
export const FEE_SKUS: ReadonlySet<string> = new Set([FEE_PLASTICS, FEE_SEALS]);

// ---------------- the ERP's requests ----------------
export type ErpRequest = { pos: string; type: string };
const REQ = /Auftragspos\.?:?\s*(\d+)\s*-\s*Bitte\s+Konformit\S*\s+erstellen:?\s*([\s\S]+?)\.(?=\s*\/|\s*https?:|\s*$|\s+\S)/gi;

/** Every request in one internal comment, once each, in order. */
export function parseRequests(comment: string | null | undefined): ErpRequest[] {
  const out: ErpRequest[] = [];
  for (const m of (comment ?? "").matchAll(REQ)) {
    const r = { pos: m[1], type: m[2].replace(/\s+/g, " ").trim() };
    if (r.type && !out.some((x) => x.pos === r.pos && x.type === r.type)) out.push(r);
  }
  return out;
}

/** "A26.658554.001" -> "A26.658554"; null when it is no ERP order number. */
export function baseOf(orderNumber: string | null | undefined): string | null {
  return /([A-Z]\d{2}\.\d{6})/.exec(orderNumber ?? "")?.[1] ?? null;
}

const CERT_ORDER = ["FDA", "EC 1935/2004", "OTHERS"];
/** The ERP's words -> the ticket's "Which certificate" options, and the rest as other certificates. */
export function certsOf(reqs: ErpRequest[]): { certs: string[]; other: string | null } {
  const certs = new Set<string>();
  const other: string[] = [];
  for (const r of reqs) {
    if (/^FDA$/i.test(r.type)) certs.add("FDA");
    else if (/1935\s*\/\s*2004/.test(r.type)) certs.add("EC 1935/2004");
    else { certs.add("OTHERS"); if (!other.includes(r.type)) other.push(r.type); }
  }
  return { certs: [...certs].sort((a, b) => CERT_ORDER.indexOf(a) - CERT_ORDER.indexOf(b)), other: other.length ? other.join(", ") : null };
}

/** "Pos 10. 8001260406 / Pos 20. 8001098176" - the article of position N is the N/10-th article line of the web order. */
export function positionsText(reqs: ErpRequest[], lines: string[]): string {
  const pos = [...new Set(reqs.map((r) => r.pos).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  return pos.map((p) => { const a = lines[Number(p) / 10 - 1]; return a ? `Pos ${p}. ${a}` : `Pos ${p}`; }).join(" / ");
}

// ---------------- the delivery date ----------------
/** One ERP record of the order in HubSpot: the order (.000) or a delivery (.001, .002 ...). changedAt = when its date
 *  last changed (ms). */
export type Delivery = { num: string; ship: string | null; status: string | null; history: string[]; lines: string[]; changedAt: number | null };
/** The goods have left */
export const SHIPPED: ReadonlySet<string> = new Set(["ready_for_invoicing", "invoiced"]);
const GONE: ReadonlySet<string> = new Set(["credit_note", "cancelled"]);
export const isShipped = (d: Pick<Delivery, "status">) => SHIPPED.has(d.status ?? "");

/** The articles a ticket names (sarcla_article_number_order_pm: "Pos 20. 8001195777", "0232020132 POM-C ..."). */
export function articlesIn(text: string | null | undefined): string[] {
  return [...new Set([...(text ?? "").matchAll(/\b(\d{8,10})\b/g)].map((m) => m[1]))];
}

/**
 * The delivery the certificate goes with: the ERP's records with a date (never a credit note or a cancelled one); those
 * carrying the ticket's article if any do; then the only one, or the one whose date the ticket was given, or the first
 * that has not left yet. null = the ERP has no date yet, or it cannot be told which.
 */
export function pickDelivery(due: string | null, articles: string[], ds: Delivery[]): { d: Delivery | null; why: string } {
  let c = ds.filter((d) => d.ship && !GONE.has(d.status ?? ""));
  if (!c.length) return { d: null, why: ds.length ? "the ERP has no delivery date yet" : "no ERP order in HubSpot yet" };
  const withArticle = c.filter((d) => d.lines.some((l) => articles.includes(l)));
  if (withArticle.length) c = withArticle;
  if (c.length === 1) return { d: c[0], why: withArticle.length ? "the delivery with the ticket's article" : "the order's delivery" };
  const given = c.filter((d) => !!due && (d.history.includes(due) || d.ship === due));
  if (given.length === 1) return { d: given[0], why: "the delivery whose date the ticket was given" };
  const open = c.filter((d) => !isShipped(d)).sort((a, b) => String(a.ship).localeCompare(String(b.ship)));
  if (open.length) return { d: open[0], why: "the first delivery that has not left" };
  return { d: null, why: "several deliveries, all left - which one is not clear" };
}

export type DateCheck = {
  /** the ERP's date for the ticket's delivery, or null */
  erp: { date: string; delivery: string; shipped: boolean } | null;
  /** the date to write, or null */
  move: { from: string | null; to: string } | null;
  why: string;
};
/**
 * Does the ticket's delivery date follow the ERP? The newer one wins: the ERP's date moves the ticket's only when it
 * changed after the ticket's date was written (dueAt, ms; null = no date). A date typed (or corrected) by hand after the
 * ERP's last change stands - until the ERP's changes again. (06.11.2026: two old tickets, a date fixed by hand in
 * October, would otherwise have gone back to a delivery the ERP had planned in August.)
 */
export function dateCheck(due: string | null, dueAt: number | null, articles: string[], ds: Delivery[]): DateCheck {
  const { d, why } = pickDelivery(due, articles, ds);
  if (!d || !d.ship) return { erp: null, move: null, why };
  const erp = { date: d.ship, delivery: d.num, shipped: isShipped(d) };
  if (erp.date === due) return { erp, move: null, why: `the same as the ERP (${why})` };
  if (due && dueAt !== null && (d.changedAt === null || d.changedAt <= dueAt)) return { erp, move: null, why: "the ticket's date was written after the ERP's last change - it stands until the ERP's changes" };
  return { erp, move: { from: due, to: erp.date }, why };
}

/** The subject keeps its words; only the date in it changes (24.11.26 -> 03.11.26). */
export function subjectWithDate(subject: string | null, from: string | null, to: string): string | null {
  if (!subject || !from) return null;
  const short = (x: string) => { const [y, m, d] = x.slice(0, 10).split("-"); return `${d}.${m}.${y.slice(2)}`; };
  const a = short(from), b = short(to);
  return subject.includes(a) ? subject.split(a).join(b) : null;
}

// ---------------- a shop order with the declaration ----------------
/** Where a shop order with the plastics declaration stands. */
export type ShopState =
  | "waiting-number" /** the ERP's order number not on the web order yet (the hub stamps it within ~15 min) */
  | "waiting-type"   /** which certificate: not known yet - the ERP's comment comes with the next ERP file */
  | "would"          /** Preview: the hub would create the ticket now */
  | "created"        /** the hub created the ticket */
  | "by-hand"        /** the Back Office had already made one */
  | "cancelled"      /** the order was cancelled in the shop */
  | "no-type"        /** no certificate named anywhere after the wait - left to the Back Office */
  | "failed";
/** The final states: nothing more to do. */
export const SHOP_DONE: ReadonlySet<ShopState> = new Set(["created", "by-hand", "cancelled", "no-type"]);

/** The shop's own words for the certificate, when its line options carry them. */
export function typesInOptions(values: string[]): ErpRequest[] {
  const out: ErpRequest[] = [];
  for (const v of values) {
    const t = v.replace(/\s+/g, " ").trim();
    if (/^FDA\b/i.test(t) || /1935\s*\/\s*2004|BfR|DM\s*21\/03\/1973|10\/2011/i.test(t)) if (!out.some((x) => x.type === t)) out.push({ pos: "", type: t.replace(/\.$/, "") });
  }
  return out;
}
