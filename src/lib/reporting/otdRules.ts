// OTD REPORTS - the OTD analysis file's rules ("APSOparts-OTD-2025-Q3-2026", the supply chain's workbook, SARCLA
// 09.11.2026: "this is OTD analysis, inside the file you can find how we calculate, to compare to us, + all the types of
// logic and graphs - should be used to create OTD advanced reports on its own and then bring to back office the main
// features") on the ERP's order lines.
//
// The file's rule ("Data Input" column AZ): an order line's LATE DAYS are the working days from its FIRST confirmed date
// (Initially_confirmed_date) to the day it reached the customer (Date_at_customer) - 0 the same day, +n late, -n early;
// on time = 0 or less. Its months are the months the line REACHED THE CUSTOMER. Its categories ("Category late apso"):
// on time or early, 1-2, 3-4, 5-10, 11-30, more than 30 working days late. Around it: the change between the first and the
// last confirmed date (none / earlier / 1-4 ... 20+ working days), the positions per order (1, 2, 3, 4+), a single delivery
// asked (every position the same first date) or several, more deliveries than first confirmed, the lead time promised
// (order -> first date) and real (order -> at the customer), each supplier's impact (its late days; index = 100 x its late
// days / the largest; Critical >= 50, High >= 20, Medium >= 10, else Low), GLC = the lines whose article has no supplier
// (cut to size and made in house - the file's "-" supplier, 18 % of its lines).
//
// Checked 09.11.2026 on the file's own 201,345 lines (eShop, mandants 100 + 110, Jan 2025 - Sep 2026): its rule 79.5 %
// on time; the hub's Back-Office rule (shipped + transport time by the first date's month) 80.6 %; the same verdict on
// 98.4 % of the lines - the rest: the ERP's date at customer later than the shipment plus the line's transport time.
//
// The ERP's daily lines (../reporting/boErpLines.ts, the morning workbook's lines sheet) carry no date at customer: it is
// the shipment plus the ERP's transport time to the country (the file's own "calculated transportation time" equals the
// line's transport time on 90 % of its lines). Pure - the store is ./otdStore.ts.

export const OTD_VERSION = 1;

/* ── working days (Monday to Friday, as Excel's NETWORKDAYS without holidays) ───────── */

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const weekday = (t: number) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6; };
/** Excel's NETWORKDAYS(a, b): the working days from a to b, both counted; negative when b is before a */
export function networkdays(a: string, b: string): number {
  let lo = ms(a), hi = ms(b), sign = 1;
  if (hi < lo) { [lo, hi] = [hi, lo]; sign = -1; }
  // whole weeks at once, then the rest day by day
  const days = Math.round((hi - lo) / DAY) + 1;
  let n = Math.floor(days / 7) * 5;
  for (let t = lo + Math.floor(days / 7) * 7 * DAY; t <= hi; t += DAY) if (weekday(t)) n++;
  return sign * n;
}
/** `n` working days after a day */
export function addWorkdays(day: string, n: number): string {
  let t = ms(day);
  while (n > 0) { t += DAY; if (weekday(t)) n--; }
  return iso(t);
}
/** The file's late days (column AZ): 0 the same day, else NETWORKDAYS - 1 late, NETWORKDAYS + 1 early. */
export function lateDays(first: string, atCustomer: string): number {
  if (first === atCustomer) return 0;
  const n = networkdays(first, atCustomer);
  return atCustomer > first ? n - 1 : n + 1;
}
/** The change between the first and the last confirmed date in working days (column BQ, read the same way as AZ). */
export const dateChange = (first: string, last: string): number => (last ? lateDays(first, last) : 0);

/* ── the categories ───────────────────────────────────────────────────────────────── */

/** "Category late apso" - LOOKUP over -2500 / 0.1 / 2.1 / 4.1 / 10.1 / 30.1 */
export const LATE_CATS = ["On time or early", "1-2 days late", "3-4 days late", "5-10 days late", "11-30 days late", "More than 30 days late"];
export const lateCat = (d: number) => (d <= 0 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d <= 10 ? 3 : d <= 30 ? 4 : 5);
/** "Category of Depth of change btw initial confirmed date and last" - LOOKUP over -1000 / 0 / 1 / 5 / 10 / 15 / 20 */
export const CHANGE_CATS = ["Moved earlier", "No change", "1-4 days later", "5-9 days later", "10-14 days later", "15-19 days later", "20 days later or more"];
export const changeCat = (d: number) => (d < 0 ? 0 : d === 0 ? 1 : d < 5 ? 2 : d < 10 ? 3 : d < 15 ? 4 : d < 20 ? 5 : 6);
/** "Category of Nb of positions in order" */
export const POSITION_CATS = ["1 position", "2 positions", "3 positions", "4 positions or more"];
export const positionCat = (n: number) => Math.min(Math.max(n, 1), 4) - 1;
/** the order's shape: a single delivery asked (every position the same first date) or several */
export const DELIVERY_ASKED = ["Single delivery asked", "Several deliveries asked"];
/** "More deliveries than initialy confirmed ?" */
export const DELIVERIES = ["As many deliveries as confirmed", "More deliveries than confirmed"];
export const PLANNED = ["Planned article", "Not planned", "Not known"];
export const COMMENT = ["No customer comment", "Customer comment on the order"];
/** the supplier of the lines whose article has none - cut to size and made in house */
export const GLC = "GLC (own cut & production)";
/** the suppliers kept by name in each slice (the most lines overall); the others summed as one */
export const SUPPLIER_KEEP = 60;
export const OTHER = "Other suppliers";
/** the articles kept for the list: the most late lines */
export const ARTICLE_KEEP = 300;
/** a supplier's priority by its impact index (the file's "Supplier Impact Rank", column L) */
export const priorityOf = (index: number) => (index >= 50 ? "Critical" : index >= 20 ? "High" : index >= 10 ? "Medium" : "Low");

/* ── one line ─────────────────────────────────────────────────────────────────────── */

export type OtdLine = {
  company: string; order: string; line: string;
  /** "eShop", else how the ERP says the order came in ("manually entered") */
  source: string;
  orderDay: string; firstDay: string; confDay: string; shipDay: string; atCustomer: string;
  article: string;
  /** "S" standard, "P" special, "" not known */
  st: string; pc: string;
  /** the article's main supplier; "" = none in the ERP (GLC) */
  supplier: string;
  /** "J" / "N" / "" */
  planned?: string; group?: string; comment?: boolean;
  /** the customer (CustomerNumberUnique), the customer's wish date, the main supplier's replenishment time in days */
  customer?: string; wishDay?: string; replen?: number;
};

/* ── the slices: a month, a mandant, a source, standard/special, a profit centre ──── */

/** [lines, late lines, late days summed (signed - the file's averages read early days too)] */
export type Trio = [number, number, number];
/** a supplier in a slice: [lines, late, positive late days, late more than 10 days, most late days, signed late days, real lead
 *  days, then its late lines per LATE_CATS 1-5 (the file's "%LatePerSupplier-GLConly")] */
export type SupRow = [number, number, number, number, number, number, number, number, number, number, number, number];
const newSup = (): SupRow => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
export type Slice = {
  /** lines, late lines, positive late days, signed late days, late more than 10 working days */
  n: number; late: number; days: number; signed: number; over10: number;
  /** lines per LATE_CATS, and their signed late days */
  cat: number[]; catDays: number[];
  /** per CHANGE_CATS */
  change: Trio[];
  /** no change / changed */
  changed: Trio[];
  /** per POSITION_CATS, then POSITION_CATS x DELIVERY_ASKED (index pos * 2 + several) */
  pos: Trio[]; shape: Trio[];
  /** per DELIVERIES */
  more: Trio[];
  /** [lines, promised lead days, real lead days, transport days] */
  lead: [number, number, number, number];
  planned: Trio[]; comment: Trio[];
  /** against the customer's wish date: [lines with one, late against it, signed days]; the lines first confirmed later than asked */
  wish?: Trio; wishLater?: number;
  /** articles not planned, by their main supplier's replenishment time: [0] promised at least that long, [1] promised faster */
  replen?: Trio[];
  sup: Record<string, SupRow>;
  group: Record<string, Trio>;
};
const trios = (k: number): Trio[] => Array.from({ length: k }, () => [0, 0, 0]);
export const emptySlice = (): Slice => ({
  n: 0, late: 0, days: 0, signed: 0, over10: 0, cat: Array(6).fill(0), catDays: Array(6).fill(0), change: trios(7), changed: trios(2),
  pos: trios(4), shape: trios(8), more: trios(2), lead: [0, 0, 0, 0], planned: trios(3), comment: trios(2), wish: [0, 0, 0], wishLater: 0, replen: trios(2),
  sup: {}, group: {},
});
/** a slice's key: month | mandant | source ("e" eShop, "m" the others) | "S"/"P"/"" | profit centre */
export const sliceKey = (ym: string, company: string, src: string, st: string, pc: string) => `${ym}|${company}|${src}|${st}|${pc}`;
export const keyParts = (k: string) => { const [ym, company, src, st, pc] = k.split("|"); return { ym, company, src, st, pc }; };
export const srcOf = (source: string) => (/^e-?shop$/i.test(source.trim()) ? "e" : "m");

export type OtdArticle = { a: string; pc: string; st: string; sup: string; group?: string; text?: string;
  /** promised month -> [lines, late, positive late days] */
  m: Record<string, Trio> };
/** a customer with late lines: its number, its company and the company's owner in HubSpot (added when kept) */
export type OtdCustomer = { c: string; name?: string; owner?: string; company: string; m: Record<string, Trio> };
/** the customers kept: the most late lines */
export const CUSTOMER_KEEP = 300;

/** The cube for one month axis. */
export type OtdAxis = { slices: Record<string, Slice> };
export type OtdCube = {
  v: number; at: string;
  /** where the lines came from: "erp" the morning file's lines, "file" the OTD analysis file */
  from: string;
  /** the months the lines cover, by the first confirmed date */
  first: string; last: string;
  lines: number; skipped: Record<string, number>;
  /** by the month of the first confirmed date (the Back Office's KPI) and by the month the line reached the customer (the file's) */
  promised: OtdAxis; delivered: OtdAxis;
  articles: OtdArticle[];
  /** the customers with the most late lines (the morning lines carry the customer since 10.11.2026) */
  customers?: OtdCustomer[];
  /** every supplier's lines over all months - for the "kept" list in the slices */
  suppliers: string[];
  /** the morning lines: how their date at the customer was found (since 10.11.2026) */
  dated?: Dated;
};
/** how many lines took the ERP's own date, the ERP's date from the OTD analysis file (since 10.11.2026 - absent in older
 *  cubes), the shipping mode's days, the customer's transport days, the country's */
export type Dated = { own: number; file?: number; mode: number; customer: number; country: number };
/** an order line's key, the same for the morning lines and the OTD analysis file ("A26.654679.001|10") */
export const lineKey = (order: string, line: string): string => {
  const n = Number(line.trim());
  return `${order.trim()}|${Number.isFinite(n) && line.trim() ? n : line.trim()}`;
};

const add = (t: Trio, late: boolean, d: number) => { t[0]++; if (late) t[1]++; t[2] += d; };

/** Lines -> the cube. Lines not yet at the customer, with no first date, or delivered after `today` are left out. */
export function buildOtdCube(lines: OtdLine[], from: string, today: string): OtdCube {
  const skipped: Record<string, number> = {};
  const skip = (w: string) => { skipped[w] = (skipped[w] ?? 0) + 1; };
  const ok: OtdLine[] = [];
  for (const l of lines) {
    if (!l.firstDay) { skip("no first confirmed date"); continue; }
    if (!l.atCustomer) { skip("not delivered yet"); continue; }
    if (l.atCustomer > today) { skip("delivered after today"); continue; }
    ok.push(l);
  }
  // the order's shape, over the lines kept: positions per order, per (order, first date), per (order, first date, at customer)
  const main = (o: string) => o.replace(/\.\d+$/, "");
  const cnt = new Map<string, number>();
  const bump = (k: string) => cnt.set(k, (cnt.get(k) ?? 0) + 1);
  for (const l of ok) { const m = main(l.order); bump(`o${m}`); bump(`f${m}|${l.firstDay}`); bump(`d${m}|${l.firstDay}|${l.atCustomer}`); }
  // the suppliers kept by name: the most lines overall
  const supN = new Map<string, number>();
  for (const l of ok) { const s = l.supplier || GLC; supN.set(s, (supN.get(s) ?? 0) + 1); }
  const kept = new Set([...supN].sort((a, b) => b[1] - a[1]).slice(0, SUPPLIER_KEEP).map(([s]) => s));
  const promised: OtdAxis = { slices: {} }, delivered: OtdAxis = { slices: {} };
  const arts = new Map<string, OtdArticle & { late: number }>();
  const custs = new Map<string, OtdCustomer & { late: number }>();
  let first = "", last = "";
  for (const l of ok) {
    const d = lateDays(l.firstDay, l.atCustomer), late = d > 0, c = lateCat(d);
    const ch = l.confDay ? dateChange(l.firstDay, l.confDay) : 0;
    const m = main(l.order);
    const positions = cnt.get(`o${m}`)!, sameFirst = cnt.get(`f${m}|${l.firstDay}`)!, sameDay = cnt.get(`d${m}|${l.firstDay}|${l.atCustomer}`)!;
    const several = sameFirst !== positions ? 1 : 0, more = sameDay < sameFirst ? 1 : 0;
    const p = positionCat(positions);
    const sup = l.supplier || GLC, supKey = kept.has(sup) ? sup : OTHER;
    const promisedLead = networkdays(l.orderDay || l.firstDay, l.firstDay), realLead = networkdays(l.orderDay || l.atCustomer, l.atCustomer);
    const transport = l.shipDay ? Math.max(0, networkdays(l.shipDay, l.atCustomer) - 1) : 0;
    const fm = l.firstDay.slice(0, 7), dm = l.atCustomer.slice(0, 7);
    if (!first || fm < first) first = fm;
    if (!last || fm > last) last = fm;
    for (const [axis, ym] of [[promised, fm], [delivered, dm]] as const) {
      const k = sliceKey(ym, l.company, srcOf(l.source), l.st, l.pc);
      const s = (axis.slices[k] ??= emptySlice());
      s.n++; if (late) { s.late++; s.days += d; if (d > 10) s.over10++; }
      s.signed += d; s.cat[c]++; s.catDays[c] += d;
      add(s.change[changeCat(ch)], late, d); add(s.changed[ch !== 0 ? 1 : 0], late, d);
      add(s.pos[p], late, d); add(s.shape[p * 2 + several], late, d); add(s.more[more], late, d);
      s.lead[0]++; s.lead[1] += promisedLead; s.lead[2] += realLead; s.lead[3] += transport;
      add(s.planned[l.planned === "J" ? 0 : l.planned === "N" ? 1 : 2], late, d);
      add(s.comment[l.comment ? 1 : 0], late, d);
      const r = (s.sup[supKey] ??= newSup());
      r[0]++; if (late) { r[1]++; r[2] += d; if (d > 10) r[3]++; if (d > r[4]) r[4] = d; r[6 + c]++; } r[5] += d; r[6] += realLead;
      if (l.group) add((s.group[l.group] ??= [0, 0, 0]), late, late ? d : 0);
      if (l.wishDay) {
        const dw = lateDays(l.wishDay, l.atCustomer);
        add((s.wish ??= [0, 0, 0]), dw > 0, dw);
        if (l.firstDay > l.wishDay) s.wishLater = (s.wishLater ?? 0) + 1;
      }
      if (l.planned === "N" && l.replen && l.orderDay) {
        const promisedCal = Math.round((ms(l.firstDay) - ms(l.orderDay)) / DAY);
        add((s.replen ??= trios(2))[promisedCal < l.replen ? 1 : 0], late, d);
      }
    }
    if (l.customer) {
      const x = custs.get(l.customer) ?? { c: l.customer, company: l.company, m: {}, late: 0 };
      const t = (x.m[fm] ??= [0, 0, 0]);
      t[0]++; if (late) { t[1]++; t[2] += d; x.late++; }
      custs.set(l.customer, x);
    }
    if (l.article) {
      const a = arts.get(l.article) ?? { a: l.article, pc: l.pc, st: l.st, sup, group: l.group, m: {}, late: 0 };
      const t = (a.m[fm] ??= [0, 0, 0]);
      t[0]++; if (late) { t[1]++; t[2] += d; a.late++; }
      arts.set(l.article, a);
    }
  }
  const articles = [...arts.values()].filter((a) => a.late > 0).sort((a, b) => b.late - a.late).slice(0, ARTICLE_KEEP)
    .map(({ late: _late, ...a }) => (a.group ? a : (delete a.group, a)));
  const customers = [...custs.values()].filter((x) => x.late > 0).sort((a, b) => b.late - a.late).slice(0, CUSTOMER_KEEP).map(({ late: _late, ...x }) => x);
  return { v: OTD_VERSION, at: new Date().toISOString(), from, first, last, lines: ok.length, skipped, promised, delivered, articles,
    ...(customers.length ? { customers } : {}), suppliers: [...kept] };
}

/* ── reading the cube: the slices a filter picks, summed ───────────────────────────── */

export type OtdFilter = { company?: string[]; src?: string[]; st?: string[]; pc?: string[] };
const picks = (want: string[] | undefined, v: string) => !want?.length || want.includes(v);
/** the slice keys of an axis that a filter picks, for some months */
export function keysFor(axis: OtdAxis, yms: string[], f: OtdFilter = {}): string[] {
  const months = new Set(yms);
  return Object.keys(axis.slices).filter((k) => {
    const p = keyParts(k);
    return months.has(p.ym) && picks(f.company, p.company) && picks(f.src, p.src) && picks(f.st, p.st) && picks(f.pc, p.pc);
  });
}
const addTrios = (a: Trio[], b: Trio[]) => { for (let i = 0; i < a.length; i++) { a[i][0] += b[i][0]; a[i][1] += b[i][1]; a[i][2] += b[i][2]; } };
/** the slices summed into one */
export function sumSlices(slices: Slice[]): Slice {
  const t = emptySlice();
  for (const s of slices) {
    t.n += s.n; t.late += s.late; t.days += s.days; t.signed += s.signed; t.over10 += s.over10;
    for (let i = 0; i < 6; i++) { t.cat[i] += s.cat[i]; t.catDays[i] += s.catDays[i]; }
    addTrios(t.change, s.change); addTrios(t.changed, s.changed); addTrios(t.pos, s.pos); addTrios(t.shape, s.shape);
    addTrios(t.more, s.more); addTrios(t.planned, s.planned); addTrios(t.comment, s.comment);
    // cubes kept before 10.11.2026 carry neither
    if (s.wish) addTrios([t.wish!], [s.wish]);
    t.wishLater = (t.wishLater ?? 0) + (s.wishLater ?? 0);
    if (s.replen) addTrios(t.replen!, s.replen);
    for (let i = 0; i < 4; i++) t.lead[i] += s.lead[i];
    for (const [k, r] of Object.entries(s.sup)) {
      const x = (t.sup[k] ??= newSup());
      for (let i = 0; i < 12; i++) x[i] = i === 4 ? Math.max(x[4], r[4]) : x[i] + (r[i] ?? 0);
    }
    for (const [k, r] of Object.entries(s.group)) { const x = (t.group[k] ??= [0, 0, 0]); x[0] += r[0]; x[1] += r[1]; x[2] += r[2]; }
  }
  return t;
}
/** a filter's months summed, month by month */
export function monthly(axis: OtdAxis, yms: string[], f: OtdFilter = {}): Slice[] {
  const by = new Map<string, Slice[]>(yms.map((ym) => [ym, []]));
  for (const k of keysFor(axis, yms, f)) by.get(keyParts(k).ym)!.push(axis.slices[k]);
  return yms.map((ym) => sumSlices(by.get(ym)!));
}
export const onTimeShare = (s: Pick<Slice, "n" | "late">) => (s.n ? (s.n - s.late) / s.n : null);
export const avg = (sum: number, n: number) => (n ? sum / n : null);

/** The file's "Supplier Impact Rank": every supplier of a summed slice, the most late days first, with its index and priority. */
export type ImpactRow = { rank: number; supplier: string; lines: number; late: number; lateRate: number; days: number; share: number;
  avgLate: number | null; over10: number; max: number; index: number; priority: string; realLead: number | null };
export function impactRank(s: Slice): ImpactRow[] {
  const all = Object.entries(s.sup);
  // the suppliers folded into one ("Other suppliers") are not a supplier: never ranked, never the 100 of the index - last
  const named = all.filter(([k]) => k !== OTHER), rest = all.find(([k]) => k === OTHER);
  const total = all.reduce((a, [, r]) => a + r[2], 0), top = Math.max(0, ...named.map(([, r]) => r[2]));
  const row = ([supplier, r]: [string, SupRow], rank: number): ImpactRow => {
    const index = top && rank ? (100 * r[2]) / top : 0;
    return { rank, supplier, lines: r[0], late: r[1], lateRate: r[0] ? r[1] / r[0] : 0, days: r[2], share: total ? r[2] / total : 0,
      avgLate: r[1] ? r[2] / r[1] : null, over10: r[3], max: r[4], index, priority: rank ? priorityOf(index) : "—", realLead: r[0] ? r[6] / r[0] : null };
  };
  const rows = named.sort((a, b) => b[1][2] - a[1][2] || b[1][0] - a[1][0]).map((x, i) => row(x, i + 1));
  return rest ? [...rows, row(rest, 0)] : rows;
}

/** Two cubes as one: the morning file's months, the OTD file's for the months before them. */
export function mergeCubes(erp: OtdCube | null, file: OtdCube | null): OtdCube | null {
  if (!erp || !file) return erp ?? file;
  const cut = erp.first;
  const take = (a: OtdAxis, b: OtdAxis): OtdAxis => {
    const slices: Record<string, Slice> = { ...a.slices };
    for (const [k, s] of Object.entries(b.slices)) if (keyParts(k).ym < cut && !slices[k]) slices[k] = s;
    return { slices };
  };
  const arts = new Map(erp.articles.map((a) => [a.a, { ...a, m: { ...a.m } }]));
  for (const a of file.articles) {
    const x = arts.get(a.a);
    const older = Object.fromEntries(Object.entries(a.m).filter(([ym]) => ym < cut));
    if (x) { Object.assign(x.m, older); if (!x.group && a.group) x.group = a.group; }
    else if (Object.keys(older).length) arts.set(a.a, { ...a, m: older });
  }
  return {
    ...erp, from: `${erp.from}+${file.from}`, first: file.first < erp.first ? file.first : erp.first, lines: erp.lines + file.lines,
    promised: take(erp.promised, file.promised), delivered: take(erp.delivered, file.delivered),
    articles: [...arts.values()], ...(erp.customers ? { customers: erp.customers } : {}), ...(erp.dated ? { dated: erp.dated } : {}),
    suppliers: [...new Set([...erp.suppliers, ...file.suppliers])],
  };
}

/* ── where the lines come from ────────────────────────────────────────────────────── */

/** The morning file's ERP lines (./boErpLines.ts ErpLine) as OTD lines: order lines of mandants 100 and 110, standard and
 *  special articles, shipped (invoiced) with a first confirmed date - the Back Office's own choice of lines - every order
 *  source. The date at the customer: the shipment plus the ERP's transport time to the country. */
/** the transport days of a line: none when the customer collects it, Liechtenstein by DHL in one day (the OTD analysis file's
 *  lines: 72 %), else the customer's own transport time in the ERP where the hub has it (otd_transport.csv: the file's
 *  Transport_time is one value per customer on every line - Italy 3 or 4 days, Austria 3 or 4, by the customer), else the
 *  ERP's table per country.
 *  Measured 10.11.2026 against the file (97,409 lines in both). Publish by the verdict and the monthly on-time %, never tune to
 *  "same date" - twice it rose while those got worse:
 *  - holidays NOT counted on purpose: the ERP adds a holiday on ~1 line in 10 crossing it. A calendar by the mandant (100 CH,
 *    110 DE) gave same date 94.1 -> 96.1 % but the verdict 98.91 -> 98.59 % and April 5.6 pts off the file; by the
 *    destination country 98.48 %; both 98.25 %; Switzerland's for all 98.55 %.
 *  - what is left is the forwarder's date at the customer (the ERP OTD report's ForwarderTerminBeimKunden): = the file's date on
 *    100 % of the ~half of the lines that carry it; DeliveryDateCustomer is the same date on fewer lines (equal on all 16,916
 *    with both). With it first: verdict 99.6 %, the months Mar-Aug 2026 = the file's. Not in the BI cube - to be added there;
 *    for the file's own months the hub reads it from otd_dates.csv (fromErpLines' fileDateOf): verdict 99.8 %, Mar-Aug = the
 *    file's, Sep unchanged (the cube's own date is newer than the file's export of 26.10 and stays first). */
export function transportWhy(l: { country: string; mode?: string; customer?: string }, transitOf: (country: string) => number,
  customerDaysOf?: (customer: string) => number | undefined): [number, "mode" | "customer" | "country"] {
  if (/picked up|abgeholt|abholung/i.test(l.mode ?? "")) return [0, "mode"];
  if (l.country === "Liechtenstein" && /^dhl$/i.test((l.mode ?? "").trim())) return [1, "mode"];
  const own = l.customer ? customerDaysOf?.(l.customer) : undefined;
  if (own != null) return [own, "customer"];
  return [transitOf(l.country), "country"];
}
export const transportOf = (l: { country: string; mode?: string; customer?: string }, transitOf: (country: string) => number,
  customerDaysOf?: (customer: string) => number | undefined): number => transportWhy(l, transitOf, customerDaysOf)[0];
export function fromErpLines<L extends { company: string; order: string; line: string; source: string; orderDay: string; status: string;
  shipDay: string; country: string; lineType: string; firstDay: string; confDay: string; article: string; artType: string; pc: string;
  customer?: string; mode?: string; deliveredDay?: string; wishDay?: string }>(
  lines: Iterable<L>, transitOf: (country: string) => number, supplierOf?: (article: string) => string | undefined,
  planningOf?: (article: string) => [string, number] | undefined,
  customerDaysOf?: (customer: string) => number | undefined,
  /** lineKey -> the ERP's date at the customer from the OTD analysis file (otd_dates.csv) */
  fileDateOf?: (key: string) => string | undefined,
): { lines: OtdLine[]; skipped: Record<string, number>; exactDays: number; dated: Dated } {
  const dated: Dated = { own: 0, file: 0, mode: 0, customer: 0, country: 0 };
  const out: OtdLine[] = [], skipped: Record<string, number> = {};
  const skip = (w: string) => { skipped[w] = (skipped[w] ?? 0) + 1; };
  for (const l of lines) {
    if (l.lineType !== "Order") { skip("not an order line"); continue; }
    if (l.company !== "100" && l.company !== "110") { skip("another mandant"); continue; }
    const st = l.artType === "Standard" ? "S" : l.artType === "Special" ? "P" : "";
    if (!st) { skip("service or unknown article type"); continue; }
    if (l.status !== "invoiced" || !l.shipDay) { skip("not shipped yet"); continue; }
    if (!l.firstDay) { skip("no first confirmed date"); continue; }
    // the ERP's own date at the customer where it has one (dim_order DeliveryDateCustomer: 97 % equal to the OTD analysis
    // file's on the lines that carry it), never before the shipment; else the shipment plus the transport days
    const own = l.deliveredDay && l.deliveredDay >= l.shipDay ? l.deliveredDay : "";
    // then the ERP's date the OTD analysis file carries for the line (its export of 26.10.2026 - older than the cube's own
    // date, so second), never before the shipment; then the shipment plus the transport days
    let atCustomer = own;
    const fromFile = own ? "" : fileDateOf?.(lineKey(l.order, l.line)) ?? "";
    if (own) dated.own++;
    else if (fromFile && fromFile >= l.shipDay) { atCustomer = fromFile; dated.file = (dated.file ?? 0) + 1; }
    else {
      const [days, why] = transportWhy(l, transitOf, customerDaysOf);
      dated[why]++;
      atCustomer = addWorkdays(l.shipDay, days);
    }
    const plan = planningOf?.(l.article);
    out.push({
      company: l.company, order: l.order, line: l.line, source: l.source, orderDay: l.orderDay, firstDay: l.firstDay, confDay: l.confDay,
      shipDay: l.shipDay, atCustomer, article: l.article, st, pc: l.pc,
      supplier: supplierOf?.(l.article) ?? "",
      ...(l.customer ? { customer: l.customer } : {}), ...(l.wishDay ? { wishDay: l.wishDay } : {}),
      ...(plan ? { planned: plan[0] === "J" ? "J" : plan[0] === "N" ? "N" : "", replen: plan[1] } : {}),
    });
  }
  return { lines: out, skipped, exactDays: dated.own, dated };
}

/** The OTD analysis file's lines, as the hub keeps them (otd_history.csv - made from the file's "Data Input" sheet, one
 *  line a row, ';' separated, the header first). Its profit centre from the assortment group; standard/special not in it. */
/** The ERP's transport time of each customer, as the OTD analysis file's lines carry it (Transport_time, column R - one value
 *  per customer, 100 % of its lines): otd_transport.csv "customer;days", the customer as the morning lines carry it
 *  (CustomerNumberUnique, "100-704623"); dropped beside the morning workbook like otd_history.csv. */
export const TRANSPORT_FILE = "otd_transport.csv";
/** The ERP's date at the customer from the OTD analysis file's lines, where it is not the shipment plus the line's transport
 *  time (19,316 of its 201,345 lines: the forwarder's date at the customer, a holiday) - on the others the hub's own sum gives
 *  the same day. otd_dates.csv "order;line;atCustomer" (YYYY-MM-DD), dropped beside the morning workbook. */
export const DATES_FILE = "otd_dates.csv";
export function parseDates(text: string): { days: Map<string, string>; rejected: number } {
  const rows = text.split(/\r?\n/);
  const head = rows[0]?.split(";").map((h) => h.trim().toLowerCase()) ?? [];
  const oi = head.indexOf("order"), li = head.indexOf("line"), di = head.indexOf("atcustomer");
  if (oi < 0 || li < 0 || di < 0) throw new Error(`${DATES_FILE}: the header lacks order;line;atCustomer`);
  const days = new Map<string, string>();
  let rejected = 0;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    const c = rows[i].split(";"), o = (c[oi] ?? "").trim(), l = (c[li] ?? "").trim(), d = (c[di] ?? "").trim();
    if (o && l && /^\d{4}-\d{2}-\d{2}$/.test(d)) days.set(lineKey(o, l), d);
    else rejected++;
  }
  return { days, rejected };
}
/** the rows read, and how many were refused (no customer, or days not a whole number from 0 to 30) */
export function parseTransport(text: string): { days: Map<string, number>; rejected: number } {
  const rows = text.split(/\r?\n/);
  const head = rows[0]?.split(";").map((h) => h.trim().toLowerCase()) ?? [];
  const ci = head.indexOf("customer"), di = head.indexOf("days");
  if (ci < 0 || di < 0) throw new Error(`${TRANSPORT_FILE}: the header lacks customer;days`);
  const days = new Map<string, number>();
  let rejected = 0;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    const c = rows[i].split(";"), k = (c[ci] ?? "").trim(), v = (c[di] ?? "").trim(), d = Number(v);
    if (k && v && Number.isInteger(d) && d >= 0 && d <= 30) days.set(k, d);
    else rejected++;
  }
  return { days, rejected };
}

export const HISTORY_FILE = "otd_history.csv";
export const HISTORY_COLS = ["company", "order", "line", "source", "orderDay", "firstDay", "confDay", "shipDay", "atCustomer", "article", "pc",
  "supplier", "planned", "group", "comment"] as const;
export function parseHistory(text: string): OtdLine[] {
  const rows = text.split(/\r?\n/);
  const head = rows[0]?.split(";").map((h) => h.trim()) ?? [];
  const at = Object.fromEntries(HISTORY_COLS.map((c) => [c, head.indexOf(c)]));
  if (HISTORY_COLS.some((c) => at[c] < 0)) throw new Error(`${HISTORY_FILE}: the header lacks ${HISTORY_COLS.filter((c) => at[c] < 0).join(", ")}`);
  const out: OtdLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i]) continue;
    const c = rows[i].split(";");
    const g = (k: (typeof HISTORY_COLS)[number]) => (c[at[k]] ?? "").trim();
    out.push({
      company: g("company"), order: g("order"), line: g("line"), source: g("source"), orderDay: g("orderDay"), firstDay: g("firstDay"),
      confDay: g("confDay"), shipDay: g("shipDay"), atCustomer: g("atCustomer"), article: g("article"), st: "", pc: g("pc"),
      supplier: g("supplier") === "-" ? "" : g("supplier"), planned: g("planned"), group: g("group") || undefined, comment: g("comment") === "1",
    });
  }
  return out;
}

/* ── the Back Office's share of it: the main views, small (SARCLA 09.11.2026: "then bring to back office the main features") ── */

/** per month (eShop lines, by the first confirmed date's month - the Back Office's KPI): the late categories, date changed or
 *  not, and the suppliers with the most late days over every month (GLC among them) - a few KB, sent with the Back Office's read */
export type OtdMain = { at: string; first: string; last: string;
  months: Record<string, { n: number; late: number; days: number; cat: number[]; changed: Trio[] }>;
  /** month -> supplier -> its row (the 12 with the most late days over all months) */
  sup: Record<string, Record<string, SupRow>> };
export const MAIN_SUPPLIERS = 12;
export function otdMainOf(k: OtdCube | null): OtdMain | null {
  if (!k) return null;
  const yms = [...new Set(Object.keys(k.promised.slices).map((x) => x.slice(0, 7)))].sort();
  const ms = monthly(k.promised, yms, { src: ["e"] });
  const all = sumSlices(ms);
  const top = Object.entries(all.sup).filter(([s]) => s !== OTHER).sort((a, b) => b[1][2] - a[1][2]).slice(0, MAIN_SUPPLIERS).map(([s]) => s);
  const months: OtdMain["months"] = {}, sup: OtdMain["sup"] = {};
  yms.forEach((ym, i) => {
    const s = ms[i];
    if (!s.n) return;
    months[ym] = { n: s.n, late: s.late, days: s.days, cat: s.cat, changed: s.changed };
    sup[ym] = Object.fromEntries(top.filter((x) => s.sup[x]).map((x) => [x, s.sup[x]]));
  });
  return { at: k.at, first: k.first, last: k.last, months, sup };
}
