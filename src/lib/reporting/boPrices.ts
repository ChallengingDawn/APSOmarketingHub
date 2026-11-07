// MANUAL PRICE ADJUSTMENTS (Back-Office Reports > KPI autonomy, SARCLA 07.11.2026: "do manual price adjustment"): the
// price the customer accepted in the shop against the price the ERP invoiced. The shop's lines are on the web order's
// .000 record (written from Magento when the order came in, never touched again - magento/rules.ts); the ERP's are the
// deliveries' order_positions_json (.001, .002, ...). A line whose price per piece is not the shop's = changed after the
// shop - except the customer's own price: a customer whose lines come out 3-10 % lower on 2 orders or more is the ERP's
// customer price, not a hand (07.11.2026: 73 customers in mandant 100, every line 4-8 % lower, every order). Measured on
// Jun + Aug-Oct 2026 against the Back Office's typed figures: by hand 2.9-4.0 % of the orders in 100 (typed 3.3 %), 3.4-3.8 %
// in 110 (typed 3.8 %). A line is compared only when the ERP invoiced the quantity ordered: another quantity (packs against
// pieces, rounded up, a delivery still open) makes the price per piece meaningless (07.11.2026: 26.43 a "piece" in the shop,
// 0.2643 in the ERP). A line the shop had at 0 and the ERP priced is always counted. A person who changes nothing on the
// lines is not seen. Pure: the read is boPricesRead.ts.

export const PRICES_VERSION = 1;
/** the shop's lines are kept on the web records from June 2026 (none before, hardly any in July) */
export const PRICES_FROM = "2026-06";
/** at most this many lines on a web record are read (magento/rules.ts writes up to 80) */
export const SHOP_LINES = 40;
/** the customer's own price: the ERP's price per piece this far below the shop's */
export const OWN_LO = 0.9, OWN_HI = 0.97;
/** ... on this many orders of the same customer */
export const OWN_ORDERS = 2;
/** the biggest changes kept per month and mandant, for the table */
export const BIG_PER_MONTH = 40;

type P = Record<string, string | null | undefined>;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/** "A26.648373.000 | Person | Company" -> ["A26.648373", "000"]; the number alone works too */
export function baseOf(name: string | null | undefined): [string, string] | null {
  const m = /^([A-Z]\d{2}\.\d+)\.(\d{3})$/.exec(String(name ?? "").split(" | ")[0].trim());
  return m ? [m[1], m[2]] : null;
}
/** the last " | " part of a record's name - the company */
const companyOf = (name: string | null | undefined) => {
  const parts = String(name ?? "").split(" | ").map((x) => x.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : "";
};

export type Lines = Map<string, { q: number; r: number }>;
export type ShopOrder = { base: string; day: string; mandant: string; company: string; lines: Lines; coupon: boolean };

/** yyyy-mm-dd from HubSpot's date (epoch millis as text, or an ISO date) */
export function dayOf(v: string | null | undefined): string {
  const s = String(v ?? "");
  const d = /^\d+$/.test(s) ? new Date(Number(s)).toISOString().slice(0, 10) : s.slice(0, 10);
  return /^\d{4}-\d\d-\d\d$/.test(d) ? d : "";
}

/** A web order's .000 record -> the shop's lines, or null when it is not one */
export function shopOrderOf(p: P): ShopOrder | null {
  const nb = baseOf(p.order_order_number || p.hs_order_name);
  if (!nb || nb[1] !== "000" || !nb[0].startsWith("A") || !p.hs_external_order_id) return null;
  const lines: Lines = new Map();
  for (let i = 1; i <= SHOP_LINES; i++) {
    const k = `order_line_${String(i).padStart(2, "0")}_`;
    const a = String(p[`${k}article`] ?? "").trim(), q = num(p[`${k}qty`]), r = num(p[`${k}revenue`]);
    if (!a || !q || q <= 0) continue;
    const was = lines.get(a);
    lines.set(a, { q: (was?.q ?? 0) + q, r: (was?.r ?? 0) + (r ?? 0) });
  }
  const day = dayOf(p.order_order_date);
  if (!lines.size || !day) return null;
  const disc = Math.abs(num(p.hs_order_discount) ?? 0);
  return {
    base: nb[0], day, mandant: String(p.hs_currency_code ?? "").toUpperCase() === "EUR" ? "110" : "100", company: companyOf(p.hs_order_name),
    lines, coupon: disc > 0.005 || !!String(p.hs_discount_codes ?? "").trim(),
  };
}

export type ErpOrder = { mandant: string; company: string; lines: Lines };

/** One ERP delivery (.001, ...) folded into its order's lines by article. Returns the base, or null when not one. */
export function addDelivery(into: Map<string, ErpOrder>, p: P): string | null {
  const nb = baseOf(p.order_order_number || p.hs_order_name);
  if (!nb || nb[1] === "000" || !nb[0].startsWith("A")) return null;
  let pos: { a?: unknown; q?: unknown; r?: unknown }[] = [];
  try { const j = JSON.parse(String(p.order_positions_json ?? "[]")); if (Array.isArray(j)) pos = j; } catch { /* no lines */ }
  const o = into.get(nb[0]) ?? { mandant: "", company: "", lines: new Map() };
  if (!o.mandant && p.order_mandant) o.mandant = String(p.order_mandant);
  if (!o.company) o.company = companyOf(p.hs_order_name);
  for (const x of pos) {
    const a = String(x.a ?? "").trim(), q = num(x.q) ?? 0, r = num(x.r) ?? 0;
    if (!a) continue;
    const was = o.lines.get(a);
    o.lines.set(a, { q: (was?.q ?? 0) + q, r: (was?.r ?? 0) + r });
  }
  into.set(nb[0], o);
  return nb[0];
}

/** the price per piece changed: the ERP's line total against the shop's price for the pieces invoiced, 0.5 % or 5 cents */
export function priceChanged(shop: { q: number; r: number }, erp: { q: number; r: number }): boolean {
  if (shop.q <= 0 || erp.q <= 0) return false;
  const expected = (shop.r / shop.q) * erp.q;
  return Math.abs(erp.r - expected) > Math.max(0.05, 0.005 * Math.max(Math.abs(erp.r), Math.abs(expected)));
}

/**
 * A month of one mandant. `o` orders compared (ERP deliveries, no coupon, a line in the quantity ordered), `l` those lines;
 * `hl`/`ho` lines changed and the orders with one - outside the customer's own price; `dn`/`up`/`z` of those lines: lower,
 * higher, priced from 0; `band` per company the lines 3-10 % lower, the orders with one, the orders with nothing else;
 * `cpn` orders with a coupon, left out; `miss` shop lines the ERP has not, `extra` ERP lines the shop had not; `qd` lines the
 * ERP invoiced in another quantity, not compared.
 */
export type PMonth = {
  o: number; l: number; hl: number; ho: number; dn: number; up: number; z: number; cpn: number; miss: number; extra: number; qd: number;
  band: Record<string, [number, number, number]>;
  big: BigRow[];
};
/** [order, article, shop price per piece, ERP price per piece, pieces invoiced, day, company, 1 = 3-10 % lower] */
export type BigRow = [string, string, number, number, number, string, string, 0 | 1];
export type PricesKept = {
  v: number; at: string;
  /** mandant -> yyyy-mm -> the month */
  months: Record<string, Record<string, PMonth>>;
};
const zero = (): PMonth => ({ o: 0, l: 0, hl: 0, ho: 0, dn: 0, up: 0, z: 0, cpn: 0, miss: 0, extra: 0, qd: 0, band: {}, big: [] });
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** The shop's orders against the ERP's deliveries, month by month (by the order's day). */
export function comparePrices(shops: Iterable<ShopOrder>, erp: Map<string, ErpOrder>): Record<string, Record<string, PMonth>> {
  const months: Record<string, Record<string, PMonth>> = {};
  const weight = new Map<BigRow, number>();
  for (const s of shops) {
    const e = erp.get(s.base);
    if (!e || !e.lines.size) continue;
    const mandant = e.mandant === "110" || e.mandant === "100" ? e.mandant : s.mandant;
    const m = ((months[mandant] ??= {})[s.day.slice(0, 7)] ??= zero());
    if (s.coupon) { m.cpn++; continue; }
    const company = s.company || e.company;
    let hand = false, band = false, seen = 0;
    for (const [a, sl] of s.lines) {
      const el = e.lines.get(a);
      if (!el) { m.miss++; continue; }
      if (el.q <= 0) continue;
      const fromZero = sl.r === 0 && el.r > 0;
      if (!fromZero && Math.abs(el.q - sl.q) > 1e-6) { m.qd++; continue; }
      m.l++; seen++;
      if (!fromZero && !priceChanged(sl, el)) continue;
      const su = sl.r / sl.q, eu = el.r / el.q;
      const ratio = su > 0 ? eu / su : 0;
      const own = !fromZero && company !== "" && ratio >= OWN_LO && ratio <= OWN_HI;
      if (own) {
        band = true;
        (m.band[company] ??= [0, 0, 0])[0]++;
      } else {
        hand = true; m.hl++;
        if (fromZero) m.z++; else if (eu < su) m.dn++; else m.up++;
      }
      const row: BigRow = [s.base, a, round4(su), round4(eu), el.q, s.day, company, own ? 1 : 0];
      m.big.push(row);
      weight.set(row, Math.abs(el.r - su * el.q));
    }
    for (const a of e.lines.keys()) if (!s.lines.has(a)) m.extra++;
    // an order counts once one of its lines could be compared
    if (seen) m.o++;
    if (hand) m.ho++;
    if (band) { m.band[company][1]++; if (!hand) m.band[company][2]++; }
  }
  for (const byYm of Object.values(months)) for (const m of Object.values(byYm)) {
    m.big = m.big.sort((x, y) => (weight.get(y) ?? 0) - (weight.get(x) ?? 0)).slice(0, BIG_PER_MONTH);
  }
  return months;
}

/** The customers whose own price the ERP gives: 3-10 % lower on OWN_ORDERS orders or more, all months and mandants. */
export function ownPriceCustomers(k: PricesKept | null | undefined): Set<string> {
  const n = new Map<string, number>();
  for (const byYm of Object.values(k?.months ?? {})) for (const m of Object.values(byYm)) for (const [c, b] of Object.entries(m.band)) n.set(c, (n.get(c) ?? 0) + b[1]);
  return new Set([...n].filter(([, x]) => x >= OWN_ORDERS).map(([c]) => c));
}

/** A month's (or a sum's) figures once the customers' own prices are known: orders and lines changed by hand, and with
 *  the customer's own price; lower, higher and from 0 among the hand's lines. */
export type PFig = { o: number; l: number; handO: number; handL: number; ownO: number; ownL: number; dn: number; up: number; z: number; cpn: number; qd: number };
export function figOf(ms: (PMonth | undefined)[], own: Set<string>): PFig {
  const t: PFig = { o: 0, l: 0, handO: 0, handL: 0, ownO: 0, ownL: 0, dn: 0, up: 0, z: 0, cpn: 0, qd: 0 };
  for (const m of ms) {
    if (!m) continue;
    t.o += m.o; t.l += m.l; t.handO += m.ho; t.handL += m.hl; t.dn += m.dn; t.up += m.up; t.z += m.z; t.cpn += m.cpn; t.qd += m.qd ?? 0;
    for (const [c, [lines, orders, only]] of Object.entries(m.band)) {
      if (own.has(c)) { t.ownO += orders; t.ownL += lines; }
      else { t.handO += only; t.handL += lines; t.dn += lines; }
    }
  }
  return t;
}
/** the share of the orders compared with a price changed by hand */
export const handShare = (f: PFig) => (f.o ? f.handO / f.o : null);
/** the rows changed by hand, the biggest first - the customers' own prices left out */
export function handRows(ms: (PMonth | undefined)[], own: Set<string>, max = 200): BigRow[] {
  const rows = ms.flatMap((m) => m?.big ?? []).filter((r) => !(r[7] === 1 && own.has(r[6])));
  return rows.sort((x, y) => Math.abs((y[3] - y[2]) * y[4]) - Math.abs((x[3] - x[2]) * x[4])).slice(0, max);
}
