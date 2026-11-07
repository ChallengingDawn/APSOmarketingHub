// THE ERP'S ORDER LINES, FROM ITS BI MODEL (SARCLA 07.11.2026: "means that we can build OTD and manual prices KPI and OTD
// report"). The nightly order file carries neither the first confirmed date nor where a line's price came from; the BI
// model (SSAS sa1030020 / I_OI_OB, only inside Citrix) carries both. SARCLA adds a query of it as a sheet of the morning
// ERP workbook ("KPI LINES": the order lines of mandants 100 and 110, the last 13 months, one row per line), which the
// chain already brings in every night; this file turns those rows into the Back Office's three KPIs.
//
// Calibrated on his Jan-Oct 2026 extract against what the Back Office typed in (Jan-Sep):
// - PASS RATE = the eShop order lines whose price the ERP set "automatically"; MANUAL PRICES = those priced "manually"
//   (dim_orderline[PriceSource]; the third value, "calculated", is ~0.1 % - typed pass + manual = 99.9 % every month).
//   Order lines (LineType "Order"), service articles left out, by the month ordered: 0.34 points from the typed on average.
//   Per order it would be 6-10 % - not their unit.
// - OTD = an eShop order line shipped early enough to arrive by its FIRST confirmed date (dim_orderline
//   [ShippingDateInitial] - a date at the customer, 2-7 days after the order): shipment + the ERP's own transport time
//   to the delivery country, in working days, on or before it. By the month of that first date, standard and special =
//   dim_article[ArticleType]. Online: within ~1.5 points of the typed every month Jan-Sep (Jan 72.5/74, Jun 68.0/68,
//   Sep 80.7/80.8), no parameter fitted - the transport table is the ERP's.
// Pure: the sheet reader is ../connectors/steps/erpWorkbook.ts, the store ./boErpLinesStore.ts.

export const ERP_LINES_VERSION = 1;
/** the sheet's name in the morning workbook - matched without case or spaces around it */
export const SHEET_ERP_LINES = "KPI LINES";
export const KV_ERP_LINES = "boReport:erpLines";
/** the late lines kept for the list: the first date within this many days */
export const LATE_DAYS = 92;
export const LATE_KEEP = 200;

/** The ERP's transport time per delivery country, in working days ("Transportation times from GLC by country",
 *  Performis, 07.11.2026 - the column "Transportation Time (days)"). */
export const TRANSIT: Record<string, number> = {
  Switzerland: 1, Liechtenstein: 2, Germany: 2, Netherlands: 2, Italy: 4, Austria: 4, France: 5, Belgium: 3, Luxembourg: 3,
  Denmark: 3, Croatia: 3, Monaco: 3, Malta: 3, "United Kingdom": 4, Ireland: 4, Sweden: 4, Finland: 4, Estonia: 4,
  "Czech Republic": 4, Slovakia: 4, Slovenia: 4, Hungary: 4, Turkey: 4, Cyprus: 4, "San Marino": 4, Spain: 5, Portugal: 5,
  Romania: 5, Latvia: 5, Lithuania: 5, Norway: 5, Bulgaria: 6, Greece: 7, Poland: 7, "Bosnia and Herzegovina": 4,
  "Serbia and Montenegro": 4, "North Macedonia": 4, Ukraine: 4, Belarus: 4, Russia: 6, Iceland: 4,
  "United States of America": 4, Canada: 4, Mexico: 6, China: 15, India: 4, Japan: 5, Korea: 5, Singapore: 5, Australia: 5,
  Israel: 5, "UAE": 5, "Saudi Arabia": 4, "South Africa": 4, Morocco: 3, Tunisia: 4, Egypt: 5, Brazil: 5,
};
/** the BI model's names that the ERP's table spells otherwise */
const ALIAS: Record<string, string> = {
  "The Netherlands": "Netherlands", "Great Britain": "United Kingdom", "England": "United Kingdom", "USA": "United States of America",
  "United States": "United States of America", "Czechia": "Czech Republic", "Republic of North Macedonia": "North Macedonia",
};
/** the table's own value for a country it does not know ("ZZ unbekannt") */
export const TRANSIT_UNKNOWN = 6;
export const transitOf = (country: string) => TRANSIT[ALIAS[country] ?? country] ?? TRANSIT_UNKNOWN;

/* ── working days (Monday to Friday; the ERP's table counts them so) ─────────────────── */

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const weekend = (t: number) => { const w = new Date(t).getUTCDay(); return w === 0 || w === 6; };
/** `n` working days after a day */
export function addWd(day: string, n: number): string {
  let t = ms(day);
  while (n > 0) { t += DAY; if (!weekend(t)) n--; }
  return iso(t);
}
/** the working days from a to b (0 when b is not after a) */
export function wdAfter(a: string, b: string): number {
  let t = ms(a), n = 0;
  const end = ms(b);
  while (t < end) { t += DAY; if (!weekend(t)) n++; }
  return n;
}

/* ── one order line ─────────────────────────────────────────────────────────────────── */

export type ErpLine = {
  company: string; order: string; source: string; orderDay: string; status: string; shipDay: string; country: string;
  line: string; lineType: string; price: string; firstDay: string; confDay: string; article: string; artType: string; pc: string;
};

type Cell = string | number | boolean | Date | { v: number } | null | undefined;
const text = (c: Cell): string => {
  if (c == null) return "";
  if (c instanceof Date) return iso(c.getTime());
  if (typeof c === "object") return String(c.v);
  return String(c).trim();
};
/** yyyy-mm-dd from a date cell (a Date, an Excel serial number, or text that starts with the date) */
export function dayOf(c: Cell): string {
  if (c == null || c === "") return "";
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : iso(c.getTime());
  const n = typeof c === "number" ? c : typeof c === "object" && c && "v" in c ? c.v : NaN;
  if (Number.isFinite(n) && n > 20000 && n < 80000) return iso(Date.UTC(1899, 11, 30) + Math.round(n) * DAY);
  const s = String(c).trim();
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s) ?? null;
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const e = /^(\d\d)\.(\d\d)\.(\d{4})/.exec(s);
  return e ? `${e[3]}-${e[2]}-${e[1]}` : "";
}

const COLS = {
  company: "Company", order: "Order", source: "OrderSource", orderDay: "OrderDate", status: "OrderStatus", shipDay: "ShipmentDate",
  country: "ShippedToCountry", line: "Line", lineType: "LineType", price: "PriceSource", firstDay: "ShippingDateInitial",
  confDay: "ShippingDateConfirmed", article: "Article", artType: "ArticleType", pc: "ProfitCenter",
} as const;
type Key = keyof typeof COLS;
const norm = (s: string) => s.replace(/^\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** The sheet, row by row as the workbook reader gives it: the header (the first row naming PriceSource and
 *  ShippingDateInitial), then one order line a row - the same line twice is kept once. */
export class ErpLinesSheet {
  private at: Partial<Record<Key, number>> | null = null;
  private lines = new Map<string, ErpLine>();
  rows = 0;
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      const names = cells.map((c) => norm(text(c)));
      if (!names.includes("pricesource") || !names.includes("shippingdateinitial")) return;
      const at: Partial<Record<Key, number>> = {};
      for (const k of Object.keys(COLS) as Key[]) { const i = names.indexOf(norm(COLS[k])); if (i >= 0) at[k] = i; }
      this.at = at;
      return;
    }
    const get = (k: Key) => { const i = this.at![k]; return i == null ? null : cells[i]; };
    const order = text(get("order"));
    if (!order) return;
    this.rows++;
    const l: ErpLine = {
      company: text(get("company")), order, source: text(get("source")), orderDay: dayOf(get("orderDay")), status: text(get("status")),
      shipDay: dayOf(get("shipDay")), country: text(get("country")), line: text(get("line")), lineType: text(get("lineType")),
      price: text(get("price")), firstDay: dayOf(get("firstDay")), confDay: dayOf(get("confDay")), article: text(get("article")),
      artType: text(get("artType")), pc: text(get("pc")),
    };
    this.lines.set(`${order}|${l.line}`, l);
  }
  /** null when the sheet had no header the rules know */
  finish(): { lines: ErpLine[]; rows: number } | null {
    return this.at ? { lines: [...this.lines.values()], rows: this.rows } : null;
  }
}

/* ── the three KPIs ─────────────────────────────────────────────────────────────────── */

export const MANDANTS = ["100", "110"] as const;
/** price lines per month: [lines, manually, automatically, calculated] */
export type PriceCounts = [number, number, number, number];
/** OTD per month and group ("S|DT" standard in DT, "P|KT" special in KT, ...): [lines, on time, first date pushed later] */
export type OtdCounts = [number, number, number];
/** how late, in working days after the line could have arrived: 1, 2, 3, 4-5, 6-10, more */
export const LATE_BANDS = ["1 working day", "2 working days", "3 working days", "4-5 working days", "6-10 working days", "More than 10"];
const lateBand = (wd: number) => (wd <= 3 ? wd - 1 : wd <= 5 ? 3 : wd <= 10 ? 4 : 5);
/** [order, article, country, first date, shipped, working days late, "S"|"P", profit centre, mandant] */
export type LateRow = [string, string, string, string, string, number, string, string, string];

export type ErpLinesKept = {
  v: number; at: string;
  /** the first and last month the sheet covered */
  from: string; to: string;
  /** mandant -> yyyy-mm (ordered) -> counts */
  price: Record<string, Record<string, PriceCounts>>;
  /** mandant -> yyyy-mm (first date) -> group -> counts */
  otd: Record<string, Record<string, Record<string, OtdCounts>>>;
  /** yyyy-mm (first date) -> delivery country -> [lines, on time] */
  country: Record<string, Record<string, [number, number]>>;
  /** yyyy-mm (first date) -> the late lines per band (LATE_BANDS) */
  late: Record<string, number[]>;
  /** the latest late lines, the latest first date first */
  lateRows: LateRow[];
  lines: number; skipped: Record<string, number>;
};

/** eShop order lines of mandant 100 or 110 - the Back Office's KPIs are the web orders' */
const counted = (l: ErpLine) => l.source === "eShop" && l.lineType === "Order" && (l.company === "100" || l.company === "110");

/** Is the line on time: shipped, plus the transport time to its country, by its first confirmed date. */
export function onTime(l: Pick<ErpLine, "shipDay" | "firstDay" | "country">): boolean {
  return addWd(l.shipDay, transitOf(l.country)) <= l.firstDay;
}

export function summarizeErpLines(lines: Iterable<ErpLine>, today: string): ErpLinesKept {
  const k: ErpLinesKept = { v: ERP_LINES_VERSION, at: new Date().toISOString(), from: "", to: "", price: {}, otd: {}, country: {}, late: {}, lateRows: [], lines: 0, skipped: {} };
  const skip = (why: string) => { k.skipped[why] = (k.skipped[why] ?? 0) + 1; };
  const lateFrom = iso(ms(today) - LATE_DAYS * DAY);
  const late: LateRow[] = [];
  for (const l of lines) {
    k.lines++;
    const ym = l.orderDay.slice(0, 7);
    if (ym) { if (!k.from || ym < k.from) k.from = ym; if (ym > k.to) k.to = ym; }
    if (!counted(l)) { skip(l.source !== "eShop" ? "not eShop" : l.lineType !== "Order" ? "not an order line" : "another mandant"); continue; }
    // pass rate and manual prices: by the month ordered, service articles out
    if (ym && l.artType !== "Service") {
      const p = ((k.price[l.company] ??= {})[ym] ??= [0, 0, 0, 0]);
      if (l.price === "manually") { p[0]++; p[1]++; }
      else if (l.price === "automatically") { p[0]++; p[2]++; }
      else if (l.price === "calculated") { p[0]++; p[3]++; }
      else skip("no price source");
    }
    // OTD: shipped (invoiced) standard and special lines with a first date, by the month of that date
    if (l.artType !== "Standard" && l.artType !== "Special") continue;
    if (l.status !== "invoiced" || !l.shipDay) { skip("not shipped yet"); continue; }
    if (!l.firstDay) { skip("no first date"); continue; }
    const fm = l.firstDay.slice(0, 7);
    const ok = onTime(l), pushed = !!l.confDay && l.confDay > l.firstDay;
    const g = `${l.artType === "Standard" ? "S" : "P"}|${l.pc || "?"}`;
    const o = (((k.otd[l.company] ??= {})[fm] ??= {})[g] ??= [0, 0, 0]);
    o[0]++; if (ok) o[1]++; if (pushed) o[2]++;
    const c = ((k.country[fm] ??= {})[l.country || "Unknown"] ??= [0, 0]);
    c[0]++; if (ok) c[1]++;
    if (!ok) {
      const wd = Math.max(1, wdAfter(l.firstDay, addWd(l.shipDay, transitOf(l.country))));
      (k.late[fm] ??= [0, 0, 0, 0, 0, 0])[lateBand(wd)]++;
      // the list: lines whose first date has passed - a later one is late only on its way, not yet arrived
      if (l.firstDay >= lateFrom && l.firstDay <= today) late.push([l.order, l.article, l.country, l.firstDay, l.shipDay, wd, l.artType === "Standard" ? "S" : "P", l.pc, l.company]);
    }
  }
  k.lateRows = late.sort((a, b) => (b[3] > a[3] ? 1 : b[3] < a[3] ? -1 : b[5] - a[5])).slice(0, LATE_KEEP);
  return k;
}

/* ── reading it back (the page) ─────────────────────────────────────────────────────── */

/** [lines, manually, automatically, calculated] summed over months */
export function priceSum(k: ErpLinesKept | null | undefined, mandant: string, yms: string[]): PriceCounts {
  const t: PriceCounts = [0, 0, 0, 0];
  for (const ym of yms) { const p = k?.price[mandant]?.[ym]; if (p) for (let i = 0; i < 4; i++) t[i] += p[i]; }
  return t;
}
/** which groups an OTD figure takes: all, standard ("S"), special ("P"), and/or one profit centre */
export type OtdPick = { type?: "S" | "P"; pc?: string; mandant?: string };
export function otdSum(k: ErpLinesKept | null | undefined, yms: string[], pick: OtdPick = {}): OtdCounts {
  const t: OtdCounts = [0, 0, 0];
  for (const m of pick.mandant ? [pick.mandant] : MANDANTS) for (const ym of yms) {
    for (const [g, c] of Object.entries(k?.otd[m]?.[ym] ?? {})) {
      const [ty, pc] = g.split("|");
      if (pick.type && ty !== pick.type) continue;
      if (pick.pc && pc !== pick.pc) continue;
      t[0] += c[0]; t[1] += c[1]; t[2] += c[2];
    }
  }
  return t;
}
export const rate = (n: number, of: number) => (of > 0 ? n / of : null);
