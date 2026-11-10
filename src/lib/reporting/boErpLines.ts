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

export const ERP_LINES_VERSION = 2;
/** the sheet's name in the morning workbook - matched without case or spaces around it */
export const SHEET_ERP_LINES = "KPI LINES";
export const KV_ERP_LINES = "boReport:erpLines";
/** the late lines kept for the list: the first date within this many days */
export const LATE_DAYS = 92;
export const LATE_KEEP = 200;
/** the open lines for the action list: overdue, or due within this many working days (SARCLA 09.11.2026) */
export const OPEN_DUE_WD = 3;
export const OPEN_KEEP = 300;
/** the suppliers kept by name (the most lines); the others are summed as one */
export const SUPPLIER_KEEP = 40;
export const OTHER_SUPPLIERS = "Other suppliers";
export const NO_SUPPLIER = "No supplier known";
/** the late products kept: the articles with the most late eShop lines over the sheet's months */
export const LATE_PRODUCTS_KEEP = 300;

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
  /** the quantity ordered and shipped (the order facts' shipment status) */
  qty?: number; shipped?: number;
  /** the customer (CustomerNumberUnique, "100-12345") when the sheet carries it - for the price changes per owner */
  customer?: string;
  /** when the sheet carries them (SARCLA's Query5, 10.11.2026): the order's shipping mode (DHL, Post Express, picked up -
   *  empty for most EU lines), the ERP's own date at the customer (dim_order DeliveryDateCustomer - on ~21 % of the lines,
   *  97 % equal to the OTD analysis file's), the customer's wish date (dim_orderline CustomerWishDate) */
  mode?: string; deliveredDay?: string; wishDay?: string;
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
  confDay: "ShippingDateConfirmed", article: "Article", artType: "ArticleType", pc: "ProfitCenter", qty: "OrderQty", shipped: "ShippedQty",
  customer: "Customer", mode: "ShippingMode", deliveredDay: "DeliveryDateCustomer", wishDay: "CustomerWishDate",
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
      artType: text(get("artType")), pc: text(get("pc")), qty: Number(text(get("qty"))) || 0, shipped: Number(text(get("shipped"))) || 0,
      ...(this.at!.customer != null ? { customer: text(get("customer")) } : {}),
      ...(this.at!.mode != null ? { mode: text(get("mode")) } : {}),
      ...(this.at!.deliveredDay != null ? { deliveredDay: dayOf(get("deliveredDay")) } : {}),
      ...(this.at!.wishDay != null ? { wishDay: dayOf(get("wishDay")) } : {}),
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
/** [order, article, country, first date, shipped, working days late, "S"|"P", profit centre, mandant, supplier?] */
export type LateRow = [string, string, string, string, string, number, string, string, string, string?];
/** [order, article, country, first date, confirmed date now, ordered, shipped, working days overdue (minus: due in),
 *  "S"|"P", profit centre, mandant, order source, supplier] */
export type OpenRow = [string, string, string, string, string, number, number, number, string, string, string, string, string];
/** the promised lead time: working days from the order to the first confirmed date */
export const LEAD_BANDS = ["0-2 working days", "3-5 working days", "6-10 working days", "11-20 working days", "More than 20"];
const leadBand = (wd: number) => (wd <= 2 ? 0 : wd <= 5 ? 1 : wd <= 10 ? 2 : wd <= 20 ? 3 : 4);
/** [lines, working days summed, then the lines per LEAD_BANDS] */
export type LeadCounts = number[];
/** [article, lines priced by hand, all its lines, profit centre, the last day priced by hand, supplier, "S"|"P"] */
export type ManualArticleRow = [string, number, number, string, string, string, string];
/** [order, article, order day, profit centre, mandant, "S"|"P", supplier] */
export type ManualRow = [string, string, string, string, string, string, string];
/** a late product: the article, its profit centre, "S"|"P", its supplier, its description (from HubSpot), and per month of
 *  the first date [lines shipped, late] */
export type LateProduct = { a: string; pc: string; st: string; sup: string; text?: string; m: Record<string, [number, number]> };

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
  /** a sample of the latest lines on time (the 6th field: working days to spare), for the page that shows how it is counted */
  okRows?: LateRow[];
  lines: number; skipped: Record<string, number>;
  // since v2 (SARCLA 09.11.2026: suppliers, open lines, every order source, lead time; manual prices per profit centre,
  // per article, per owner) - absent from a summary kept before, the page then leaves those graphs out
  /** EVERY order source (eShop, manually entered ...): yyyy-mm ordered -> source -> price counts */
  srcPrice?: Record<string, Record<string, PriceCounts>>;
  /** every order source: yyyy-mm of the first date -> source -> [lines, on time, pushed later] */
  srcOtd?: Record<string, Record<string, OtdCounts>>;
  /** eShop: yyyy-mm ordered -> "S|DT" -> price counts */
  pcPrice?: Record<string, Record<string, PriceCounts>>;
  /** eShop: yyyy-mm ordered -> profit centre -> lead time counts */
  lead?: Record<string, Record<string, LeadCounts>>;
  /** eShop: yyyy-mm of the first date -> supplier -> [lines, on time] */
  supplier?: Record<string, Record<string, [number, number]>>;
  /** every source: the lines not shipped yet whose first date has passed or comes within OPEN_DUE_WD working days */
  open?: { rows: OpenRow[]; overdue: number; due: number; day: string };
  /** eShop, the last LATE_DAYS days: the articles priced by hand most */
  manualArticles?: ManualArticleRow[];
  /** eShop, the latest lines priced by hand */
  manualRows?: ManualRow[];
  /** eShop: yyyy-mm ordered -> the customer's company owner -> price counts (when the sheet carries the customer) */
  ownerPrice?: Record<string, Record<string, PriceCounts>>;
  /** eShop: the articles with the most late lines (LATE_PRODUCTS_KEEP), month by month */
  lateProducts?: LateProduct[];
};

/** What the summary may know beside the lines: each article's main supplier, each customer's company owner. */
export type ErpLinesContext = { supplierOf?: (article: string) => string | undefined; ownerOf?: (customer: string) => string | undefined };

const bumpPrice = (p: PriceCounts, price: string): boolean => {
  if (price === "manually") { p[0]++; p[1]++; return true; }
  if (price === "automatically") { p[0]++; p[2]++; return true; }
  if (price === "calculated") { p[0]++; p[3]++; return true; }
  return false;
};

/** Is the line on time: shipped, plus the transport time to its country, by its first confirmed date. */
export function onTime(l: Pick<ErpLine, "shipDay" | "firstDay" | "country">): boolean {
  return addWd(l.shipDay, transitOf(l.country)) <= l.firstDay;
}

export function summarizeErpLines(lines: Iterable<ErpLine>, today: string, ctx: ErpLinesContext = {}): ErpLinesKept {
  const k: ErpLinesKept = {
    v: ERP_LINES_VERSION, at: new Date().toISOString(), from: "", to: "", price: {}, otd: {}, country: {}, late: {}, lateRows: [], lines: 0, skipped: {},
    srcPrice: {}, srcOtd: {}, pcPrice: {}, lead: {}, supplier: {}, ownerPrice: {},
  };
  const skip = (why: string) => { k.skipped[why] = (k.skipped[why] ?? 0) + 1; };
  const lateFrom = iso(ms(today) - LATE_DAYS * DAY), dueBy = addWd(today, OPEN_DUE_WD);
  const late: LateRow[] = [], ok: LateRow[] = [], open: OpenRow[] = [], manual: ManualRow[] = [];
  let overdue = 0, due = 0;
  const arts = new Map<string, { hand: number; all: number; pc: string; last: string; st: string }>();
  const prods = new Map<string, LateProduct & { late: number }>();
  for (const l of lines) {
    k.lines++;
    const ym = l.orderDay.slice(0, 7);
    if (ym) { if (!k.from || ym < k.from) k.from = ym; if (ym > k.to) k.to = ym; }
    if (l.lineType !== "Order") { skip("not an order line"); continue; }
    if (l.company !== "100" && l.company !== "110") { skip("another mandant"); continue; }
    const src = l.source || "No source";
    const st = l.artType === "Standard" ? "S" : l.artType === "Special" ? "P" : "";
    const sup = ctx.supplierOf?.(l.article) || "";
    // every order source: the price, by the month ordered, service articles out
    if (ym && l.artType !== "Service") bumpPrice(((k.srcPrice![ym] ??= {})[src] ??= [0, 0, 0, 0]), l.price);
    // every order source: the lines not shipped yet, overdue or due soon (the action list)
    if (st && l.firstDay && l.status !== "invoiced" && !/cancel/i.test(l.status) && (l.qty ?? 0) > (l.shipped ?? 0) && l.firstDay <= dueBy) {
      const wd = l.firstDay < today ? wdAfter(l.firstDay, today) : -wdAfter(today, l.firstDay);
      if (l.firstDay < today) overdue++; else due++;
      open.push([l.order, l.article, l.country, l.firstDay, l.confDay, l.qty ?? 0, l.shipped ?? 0, wd, st, l.pc, l.company, src, sup]);
    }
    // every order source: OTD of the lines shipped
    const shipped = !!st && l.status === "invoiced" && !!l.shipDay && !!l.firstDay;
    if (shipped) {
      const so = ((k.srcOtd![l.firstDay.slice(0, 7)] ??= {})[src] ??= [0, 0, 0]);
      so[0]++; if (onTime(l)) so[1]++; if (l.confDay && l.confDay > l.firstDay) so[2]++;
    }
    if (l.source !== "eShop") { skip("not eShop"); continue; }
    // pass rate and manual prices: by the month ordered, service articles out
    if (ym && l.artType !== "Service") {
      if (!bumpPrice(((k.price[l.company] ??= {})[ym] ??= [0, 0, 0, 0]), l.price)) skip("no price source");
      if (st) bumpPrice(((k.pcPrice![ym] ??= {})[`${st}|${l.pc || "?"}`] ??= [0, 0, 0, 0]), l.price);
      const owner = l.customer ? ctx.ownerOf?.(l.customer) : undefined;
      if (l.customer) bumpPrice(((k.ownerPrice![ym] ??= {})[owner || "No owner known"] ??= [0, 0, 0, 0]), l.price);
      if (l.orderDay >= lateFrom && l.orderDay <= today) {
        const a = arts.get(l.article) ?? { hand: 0, all: 0, pc: l.pc, last: "", st };
        a.all++;
        if (l.price === "manually") {
          a.hand++; if (l.orderDay > a.last) a.last = l.orderDay;
          manual.push([l.order, l.article, l.orderDay, l.pc, l.company, st, sup]);
        }
        arts.set(l.article, a);
      }
    }
    // the promised lead time: from the order to the first confirmed date
    if (ym && st && l.firstDay && !/cancel/i.test(l.status)) {
      const wd = wdAfter(l.orderDay, l.firstDay);
      const c = ((k.lead![ym] ??= {})[l.pc || "?"] ??= [0, 0, 0, 0, 0, 0, 0]);
      c[0]++; c[1] += wd; c[2 + leadBand(wd)]++;
    }
    // OTD: shipped (invoiced) standard and special lines with a first date, by the month of that date
    if (!st) continue;
    if (l.status !== "invoiced" || !l.shipDay) { skip("not shipped yet"); continue; }
    if (!l.firstDay) { skip("no first date"); continue; }
    const fm = l.firstDay.slice(0, 7);
    const isOk = onTime(l), pushed = !!l.confDay && l.confDay > l.firstDay;
    const g = `${st}|${l.pc || "?"}`;
    const o = (((k.otd[l.company] ??= {})[fm] ??= {})[g] ??= [0, 0, 0]);
    o[0]++; if (isOk) o[1]++; if (pushed) o[2]++;
    const c = ((k.country[fm] ??= {})[l.country || "Unknown"] ??= [0, 0]);
    c[0]++; if (isOk) c[1]++;
    const su = ((k.supplier![fm] ??= {})[sup || NO_SUPPLIER] ??= [0, 0]);
    su[0]++; if (isOk) su[1]++;
    if (l.article) {
      const pr = prods.get(l.article) ?? { a: l.article, pc: l.pc, st, sup, m: {}, late: 0 };
      const pm = (pr.m[fm] ??= [0, 0]);
      pm[0]++; if (!isOk) { pm[1]++; pr.late++; }
      prods.set(l.article, pr);
    }
    const arrives = addWd(l.shipDay, transitOf(l.country));
    if (isOk && l.firstDay >= lateFrom && l.firstDay <= today) ok.push([l.order, l.article, l.country, l.firstDay, l.shipDay, wdAfter(arrives, l.firstDay), st, l.pc, l.company, sup]);
    if (!isOk) {
      const wd = Math.max(1, wdAfter(l.firstDay, arrives));
      (k.late[fm] ??= [0, 0, 0, 0, 0, 0])[lateBand(wd)]++;
      // the list: lines whose first date has passed - a later one is late only on its way, not yet arrived
      if (l.firstDay >= lateFrom && l.firstDay <= today) late.push([l.order, l.article, l.country, l.firstDay, l.shipDay, wd, st, l.pc, l.company, sup]);
    }
  }
  k.lateRows = late.sort((a, b) => (b[3] > a[3] ? 1 : b[3] < a[3] ? -1 : b[5] - a[5])).slice(0, LATE_KEEP);
  k.okRows = ok.sort((a, b) => (b[3] > a[3] ? 1 : b[3] < a[3] ? -1 : 0)).slice(0, 30);
  // the open lines: the most overdue first
  k.open = { rows: open.sort((a, b) => b[7] - a[7] || (a[3] < b[3] ? -1 : 1)).slice(0, OPEN_KEEP), overdue, due, day: today };
  // the articles priced by hand most (at least twice), the latest lines priced by hand
  k.manualArticles = [...arts].filter(([, a]) => a.hand >= 2).sort((x, y) => y[1].hand - x[1].hand || y[1].all - x[1].all).slice(0, 60)
    .map(([art, a]) => [art, a.hand, a.all, a.pc, a.last, ctx.supplierOf?.(art) || "", a.st]);
  k.manualRows = manual.sort((a, b) => (b[2] > a[2] ? 1 : b[2] < a[2] ? -1 : 0)).slice(0, 40);
  // the suppliers: the SUPPLIER_KEEP with the most lines by name, the others as one
  const tot = new Map<string, number>();
  for (const m of Object.values(k.supplier!)) for (const [s, v] of Object.entries(m)) tot.set(s, (tot.get(s) ?? 0) + v[0]);
  const keep = new Set([...tot].filter(([s]) => s !== NO_SUPPLIER).sort((a, b) => b[1] - a[1]).slice(0, SUPPLIER_KEEP).map(([s]) => s));
  for (const m of Object.values(k.supplier!)) {
    for (const [s, v] of Object.entries(m)) {
      if (s === NO_SUPPLIER || keep.has(s)) continue;
      const o = (m[OTHER_SUPPLIERS] ??= [0, 0]); o[0] += v[0]; o[1] += v[1];
      delete m[s];
    }
  }
  if (!Object.keys(k.ownerPrice!).length) delete k.ownerPrice;
  // the late products: the articles with the most late lines, their months kept
  k.lateProducts = [...prods.values()].filter((p) => p.late > 0).sort((a, b) => b.late - a.late).slice(0, LATE_PRODUCTS_KEEP)
    .map(({ late: _late, ...p }) => p);
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

/** price counts summed: one key of a month -> key -> counts map, over months */
export function priceOf(m: Record<string, Record<string, PriceCounts>> | undefined, yms: string[], key: string | ((k: string) => boolean)): PriceCounts {
  const t: PriceCounts = [0, 0, 0, 0];
  for (const ym of yms) for (const [k, p] of Object.entries(m?.[ym] ?? {})) {
    if (typeof key === "string" ? k !== key : !key(k)) continue;
    for (let i = 0; i < 4; i++) t[i] += p[i];
  }
  return t;
}
/** [lines, on time] (or [lines, on time, pushed]) summed for one key over months */
export function pairOf(m: Record<string, Record<string, number[]>> | undefined, yms: string[], key: string): number[] {
  const t = [0, 0, 0];
  for (const ym of yms) { const v = m?.[ym]?.[key]; if (v) v.forEach((x, i) => { t[i] += x; }); }
  return t;
}
/** the keys a month -> key map holds over these months, the most lines first */
export function keysOf(m: Record<string, Record<string, number[]>> | undefined, yms: string[]): string[] {
  const t = new Map<string, number>();
  for (const ym of yms) for (const [k, v] of Object.entries(m?.[ym] ?? {})) t.set(k, (t.get(k) ?? 0) + v[0]);
  return [...t].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
