// THE ORDER STEPS' RULES, with no HubSpot and no files in them - ported line for line
// from the Compass connector (service/orders_daily.py, stage_load.py, order_sync.py and
// the fixmap of article_report.py, 08.10.2026), so the hub decides every order the same
// way. Where Python's own arithmetic decides a value (round() half-to-even on the exact
// binary value, sum()'s compensated summation, float repr, json.dumps spacing) it is
// reproduced here too: the order payloads are byte-for-byte what the connector sends.
// tests/connectors-orders.test.ts holds them to it; the files are read by
// ./orderFiles.ts and HubSpot is written by ./orders.ts.

/* ── pipeline, stages, enums ───────────────────────────────────────────── */

export const PIPELINE = "3687945443";
export const STAGE_ENTERED = "5093087452";
export const CANCELLED = "5676846286";
/** ERP OrderStatus (lowercased) -> pipeline stage. "completed" = Invoiced here (stage_load). */
export const SMAP: Readonly<Record<string, string>> = {
  entered: "5093087452", "being delivered": "5093087453", pending: "5093087454",
  provisional: "5093087455", "ready for delivery": "5093092549", "ready for tour": "5093092549",
  "partially called off": "5093092550", "ready for invoicing": "5093092551",
  invoiced: "5093092552", completed: "5093092552",
};
/** Profit centres the order_profit_center enum accepts; anything else is "Unknown". */
export const PC_OK: ReadonlySet<string> = new Set(["AT", "DT", "FT", "KT", "SP", "ST", "WS"]);
/** What a web order knows and its ERP delivery does not - carried before the .000 is archived. */
export const WEB_CARRY = ["order_web_order_number", "order_doc_request", "order_doc_status"] as const;
/** The order_order_status enum. "completed" is deliberately absent here (order_sync leaves it blank). */
export const STATUS_ALIAS: Readonly<Record<string, string>> = {
  "ready for tour": "ready_for_delivery", credited: "credit_note", "partially called off": "partial_called_off",
};
export const STATUS_VALUES: ReadonlySet<string> = new Set([
  "entered", "being_delivered", "pending", "provisional", "ready_for_delivery",
  "partial_called_off", "ready_for_invoicing", "invoiced", "credit_note",
]);
export const MAX_LINE_PROPS = 80;
/** Fields an enrich (web order without lines) must not overwrite: Magento owns them. */
export const ENRICH_DROP = ["hs_order_name", "hs_pipeline", "hs_pipeline_stage", "order_order_number"] as const;

/* ── Python's own semantics ────────────────────────────────────────────── */

/** Characters str.strip() / \s treat as whitespace (Py_UNICODE_ISSPACE). Not JS's set: no U+FEFF, plus U+001C-001F and U+0085. */
const PY_WS = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP_RE = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
const WS_RUN_RE = new RegExp(`[${PY_WS}]+`, "g");
const IS_WS_RE = new RegExp(`^[${PY_WS}]$`);

/** str.strip() */
export function pyStrip(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(STRIP_RE, "");
}

/**
 * A copy of s that holds no reference to the text it was cut from. V8 keeps the parent of a
 * sliced string (13+ characters) alive, so one order number kept from a 1 MB chunk of
 * dim_order.csv kept the whole chunk: the stage targets held ~970 MB instead of tens.
 */
export const own = (s: string): string => (s.length < 13 ? s : (JSON.parse(JSON.stringify(s)) as string));

/** s[a:b] by code point, as Python slices a str. */
export function cpSlice(s: string, start: number, end?: number): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(s)) return s.slice(start, end);
  return Array.from(s).slice(start, end).join("");
}

const ND_RE = /\p{Nd}/u;
/** The value of a Unicode decimal digit: they come in runs of ten, 0..9 in order. */
function ndValue(cp: number): number {
  let k = 0;
  while (k < 10 && cp - k - 1 >= 0 && ND_RE.test(String.fromCodePoint(cp - k - 1))) k += 1;
  return k % 10;
}
/** What int()/float() do first: Unicode digits -> ASCII, Unicode spaces -> " ". */
function pyNumText(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(s)) return s;
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp > 127 && ND_RE.test(ch)) out += String(ndValue(cp));
    else if (cp > 127 && IS_WS_RE.test(ch)) out += " ";
    else out += ch;
  }
  return out;
}

const FLOAT_RE = /^[+-]?(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/;
/** float(s); null where Python raises ValueError. */
export function pyFloat(s: string): number | null {
  const t = pyStrip(pyNumText(s));
  if (/^[+-]?(?:inf|infinity)$/i.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
  if (/^[+-]?nan$/i.test(t)) return NaN;
  if (!FLOAT_RE.test(t)) return null;
  return Number(t.replace(/_/g, ""));
}

/** int(s); null where Python raises ValueError. */
export function pyInt(s: string): number | null {
  const t = pyStrip(pyNumText(s));
  if (!/^[+-]?\d(?:_?\d)*$/.test(t)) return null;
  return Number.parseInt(t.replace(/_/g, ""), 10);
}

/** orders_daily._fnum: float((s or "0").replace(",", ".")), 0.0 when unreadable. */
export function fnum(s: string | null | undefined): number {
  const v = pyFloat((s ? s : "0").replace(/,/g, "."));
  return v === null ? 0 : v;
}

/** Python truthiness of a float: 0.0 and -0.0 are false, NaN is true. */
export const truthy = (x: number): boolean => x !== 0;

/**
 * Python 3.12+ sum() over floats: Neumaier's compensated summation, the compensation
 * added at the end only when it is non-zero and finite. Order matters, as in Python.
 */
export function pySum(xs: Iterable<number>): number {
  let f = 0;
  let c = 0;
  for (const x of xs) {
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x;
    else c += (x - t) + f;
    f = t;
  }
  if (c !== 0 && Number.isFinite(c)) f += c;
  return f;
}

/** max(a, b) as Python's builtin picks it: the first unless the second is greater. */
export const pyMax2 = (a: number, b: number): number => (b > a ? b : a);

/**
 * round(x, n) for a float: the decimal nearest the EXACT binary value, ties to even
 * (round(2.675, 2) == 2.67, round(10.125, 2) == 10.12). toFixed rounds the exact value
 * too, but ties away from zero - so ties are found (x * 2^(n+1) an odd integer) and
 * settled to even by hand.
 */
export function pyRound(x: number, n: number): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const ax = Math.abs(x);
  if (ax >= 1e21) return x;
  const neg = x < 0;
  const y = ax * 2 ** (n + 1);
  let r: number;
  if (Number.isInteger(y) && y % 2 === 1) {
    const digits = ax.toFixed(n + 1).replace(".", "").slice(0, -1); // the lower neighbour, as digits
    let q = BigInt(digits);
    if (q % BigInt(2) === BigInt(1)) q += BigInt(1);
    const qs = q.toString().padStart(n + 1, "0");
    r = Number(n ? `${qs.slice(0, -n)}.${qs.slice(-n)}` : qs);
  } else {
    r = Number(ax.toFixed(n));
  }
  return neg ? -r : r;
}

/** repr(float): shortest round-trip digits, exponent below 1e-4 and from 1e16, ".0" on integers. */
export function pyRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expS] = x.toExponential().split("e");
  const exp = Number(expS);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  const sign = neg ? "-" : "";
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (exp >= 0) {
    if (digits.length <= exp + 1) return `${sign}${digits}${"0".repeat(exp + 1 - digits.length)}.0`;
    return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
  }
  return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
}

/** A float as json.dumps writes it (NaN/Infinity as Python allows them). */
function pyJsonFloat(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "Infinity";
  if (x === -Infinity) return "-Infinity";
  return pyRepr(x);
}

/* ── the delta fact: one row per line revision -> one record per order ── */

/** fct_orderlinehist columns (0-based), as the connector reads them. */
export const FCT = {
  TRANS: 3, CN: 6, CUSTUNIQ: 9, ON: 10, SHORT: 11, LINE: 12, ARTKEY: 13, ARTNO: 14, SALESUNIT: 16,
  OQ: 17, SQ: 20, TC: 21, NRTC: 26, MEUR: 30, COGSLC: 39, NRLC: 40, OCREATE: 49, DEL: 55,
} as const;

export type LiveLine = {
  d: string; gone: false; key: string; artno: string; unit: string;
  qty: number; sq: number; rlc: number; clc: number; rtc: number; meur: number;
};
export type FctLine = { d: string; gone: true } | LiveLine;
export type FctOrder = { mand: string; custuniq: string; create: string; lines: Map<string, FctLine> };

/** _dkey: "dd.mm.yyyy…" or "yyyy-mm-dd…" -> "yyyymmdd", compared as text. */
export function dkey(d: string | null | undefined): string {
  const s = d ?? "";
  if (cpSlice(s, 0, 6).includes(".")) {
    const p3 = cpSlice(s, 0, 10).split(".");
    if (p3.length === 3) return p3[2] + p3[1] + p3[0];
  }
  return cpSlice(s, 0, 10).split("-").join("");
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** _ep: "dd.mm.yyyy…" -> epoch ms at UTC midnight; null when it is not that or not a date. */
export function epochDay(raw: string | null | undefined): number | null {
  const cps = Array.from(pyStrip(raw ?? ""));
  if (cps.length < 10 || cps[2] !== "." || cps[5] !== ".") return null;
  const y = pyInt(cps.slice(6, 10).join("")), m = pyInt(cps.slice(3, 5).join("")), d = pyInt(cps.slice(0, 2).join(""));
  if (y === null || m === null || d === null) return null;
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (d > (m === 2 && leap ? 29 : MONTH_DAYS[m - 1])) return null;
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  return t.getTime();
}

/**
 * One fct row into the orders being collapsed (orders_daily's aggregation): mandant
 * 100/110 only; the latest-dated row per (OrderNumber, line) wins - a later row of the
 * same date too; delete_flag=Y removes the line. The order keeps the mandant, customer
 * and create date of its FIRST row. Returns false when the row is not taken.
 */
export function addFctRow(orders: Map<string, FctOrder>, row: string[]): boolean {
  if (row.length < 56 || (row[FCT.CN] !== "100" && row[FCT.CN] !== "110")) return false;
  const full = pyStrip(row[FCT.ON]);
  if (!full) return false;
  let o = orders.get(full);
  if (!o) {
    o = { mand: own(row[FCT.CN]), custuniq: own(pyStrip(row[FCT.CUSTUNIQ])), create: own(row[FCT.OCREATE]), lines: new Map() };
    orders.set(own(full), o);
  }
  const d = dkey(row[FCT.TRANS]);
  const ln = pyStrip(row[FCT.LINE]);
  const have = o.lines.get(ln);
  if (have !== undefined && d < have.d) return true;
  if (pyStrip(row[FCT.DEL]) === "Y") {
    o.lines.set(own(ln), { d, gone: true });
    return true;
  }
  o.lines.set(own(ln), {
    d, gone: false, key: own(row[FCT.ARTKEY]), artno: own(pyStrip(row[FCT.ARTNO])), unit: own(pyStrip(row[FCT.SALESUNIT])),
    qty: fnum(row[FCT.OQ]), sq: fnum(row[FCT.SQ]), rlc: fnum(row[FCT.NRLC]), clc: fnum(row[FCT.COGSLC]),
    rtc: fnum(row[FCT.NRTC]), meur: fnum(row[FCT.MEUR]),
  });
  return true;
}

const liveLines = (o: FctOrder): LiveLine[] => [...o.lines.values()].filter((l): l is LiveLine => !l.gone);

/** "A26.1.002" -> "002"; "" when the number has fewer than two dots. */
export function suffixOf(full: string): string {
  return (full.match(/\./g) ?? []).length >= 2 ? full.slice(full.lastIndexOf(".") + 1) : "";
}

/**
 * The orders worth creating: a value beyond 0.005, and no .000 base created more than
 * 7 days before the newest create date in the file (an old base surfacing through a
 * single line edit would be created with lines missing).
 */
export function candidates(orders: Map<string, FctOrder>): { cand: Map<string, FctOrder>; staleBase: number; newest: number } {
  let newest = 0;
  let first = true;
  for (const o of orders.values()) {
    const e = epochDay(o.create) || 0;
    if (first || e > newest) { newest = e; first = false; }
  }
  const cand = new Map<string, FctOrder>();
  let staleBase = 0;
  for (const [f, o] of orders) {
    if (Math.abs(pySum(liveLines(o).map((l) => l.rlc))) <= 0.005) continue;
    if (suffixOf(f) === "000") {
      const cd = epochDay(o.create) || 0;
      if (cd < newest - 7 * 86_400_000) { staleBase += 1; continue; }
    }
    cand.set(f, o);
  }
  return { cand, staleBase, newest };
}

/* ── the order payload ─────────────────────────────────────────────────── */

/** dim_article row -> [profit centre, article number, text]. */
export type ArtInfo = readonly [pc: string, artno: string, text: string];
export type FixEntry = { n: string; t: string; pc: string; conf?: string; src?: string };
export type FixMap = Readonly<Record<string, FixEntry>>;
export type PayloadCtx = { art: ReadonlyMap<string, ArtInfo>; fixmap: FixMap; companyName: string };

/**
 * _fix_split_qty: a split delivery repeats the line's OrderQty on every position of the
 * group (20.000 / 20.010 both 1500) while ShippedQty splits (1000 + 500). Per group of
 * positions sharing the integer line number: the shipped quantities when any shipped,
 * otherwise the ordered quantity on the first position only. -> quantity per line.
 */
export function fixSplitQty(lines: [string, LiveLine][]): number[] {
  const qty = lines.map(([, l]) => l.qty);
  const groups = new Map<string, number[]>();
  lines.forEach(([ln], i) => {
    const g = ln.split(".")[0];
    const list = groups.get(g);
    if (list) list.push(i); else groups.set(g, [i]);
  });
  for (const idx of groups.values()) {
    if (idx.length === 1) continue;
    const shipped = pySum(idx.map((i) => (truthy(lines[i][1].sq) ? Math.abs(lines[i][1].sq) : 0)));
    if (shipped > 0) for (const i of idx) qty[i] = truthy(lines[i][1].sq) ? lines[i][1].sq : 0;
    else idx.forEach((i, k) => { if (k) qty[i] = 0; });
  }
  return qty;
}

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The article behind a line: dim_article, else the mined fixmap, else the raw number. */
export function articleOf(l: LiveLine, ctx: Pick<PayloadCtx, "art" | "fixmap">): ArtInfo {
  const a = ctx.art.get(l.key);
  if (a) return a;
  const fm = Object.prototype.hasOwnProperty.call(ctx.fixmap, pyStrip(l.artno)) ? ctx.fixmap[pyStrip(l.artno)] : undefined;
  return fm ? [fm.pc, fm.n, fm.t] : ["", l.artno, ""];
}

type PosRow = { a: string; q: number; r: number; gm: number | null; pc: string; t: string };

/** json.dumps(pos, ensure_ascii=False): ", " and ": " separators, floats as repr. */
export function positionsJson(pos: PosRow[]): string {
  const one = (p: PosRow) =>
    `{"a": ${JSON.stringify(p.a)}, "q": ${pyJsonFloat(p.q)}, "r": ${pyJsonFloat(p.r)}, "gm": ${p.gm === null ? "null" : pyJsonFloat(p.gm)}, "pc": ${JSON.stringify(p.pc)}, "t": ${JSON.stringify(p.t)}}`;
  return `[${pos.map(one).join(", ")}]`;
}

/**
 * orders_daily.payload_for: every property a new order gets, as the strings Python's
 * JSON carried (floats as repr, so "1500.0" stays "1500.0"). Properties Python left as
 * None are absent.
 */
export function orderPayload(full: string, o: FctOrder, ctx: PayloadCtx): Record<string, string> {
  const lines = ([...o.lines.entries()].filter(([, l]) => !l.gone) as [string, LiveLine][]).sort((a, b) => cmpStr(a[0], b[0]));
  const qty = fixSplitQty(lines);
  const rlc = pySum(lines.map(([, l]) => l.rlc));
  const clc = pySum(lines.map(([, l]) => l.clc));
  const rtc = pySum(lines.map(([, l]) => l.rtc));
  const nm = ctx.companyName;
  const p: Record<string, string> = {
    order_order_number: full,
    hs_order_name: nm ? `${full} | ${nm}` : full,
    order_mandant: o.mand,
    hs_pipeline: PIPELINE,
    hs_pipeline_stage: STAGE_ENTERED,
    order_order_type: rlc < 0 || full.startsWith("G") ? "Credit note" : "Order",
  };
  if (o.custuniq) {
    const i = o.custuniq.indexOf("-");
    p.order_customer_number = i >= 0 ? o.custuniq.slice(i + 1) : o.custuniq;
  }
  p.order_total_qty = pyRepr(pyRound(pySum(qty), 3));
  p.order_total_net_revenue = pyRepr(pyRound(rlc, 2));
  p.hs_total_price = pyRepr(truthy(rtc) ? pyRound(rtc, 2) : pyRound(rlc, 2));
  if (truthy(rlc)) p.order_avg_gm_pct = pyRepr(pyRound(((rlc - clc) / rlc) * 100, 2));
  p.order_margin_eur = pyRepr(pyRound(pySum(lines.map(([, l]) => l.meur)), 2));
  p.order_line_count = String(lines.length);
  const d = epochDay(o.create);
  if (d) p.order_order_date = String(d);
  const pos: PosRow[] = [];
  const pcrev = new Map<string, number>();
  lines.forEach(([, l], j) => {
    const a = articleOf(l, ctx);
    const gm = truthy(l.rlc) ? pyRound(((l.rlc - l.clc) / l.rlc) * 100, 1) : null;
    pos.push({ a: a[1] || l.artno, q: pyRound(qty[j], 3), r: pyRound(l.rlc, 2), gm, pc: a[0], t: cpSlice(a[2] || "", 0, 80) });
    if (a[0]) pcrev.set(a[0], (pcrev.get(a[0]) ?? 0) + Math.abs(l.rlc));
    if (j < MAX_LINE_PROPS) {
      const pad = String(j + 1).padStart(2, "0");
      p[`order_line_${pad}_article`] = a[1] || l.artno;
      p[`order_line_${pad}_qty`] = pyRepr(pyRound(qty[j], 3));
      p[`order_line_${pad}_revenue`] = pyRepr(pyRound(l.rlc, 2));
      if (a[0]) p[`order_line_${pad}_pc`] = a[0];
      if (gm !== null) p[`order_line_${pad}_gm`] = pyRepr(gm);
    }
  });
  if (pcrev.size) {
    let top = "";
    let best = 0;
    let firstPc = true;
    for (const [pc, v] of pcrev) if (firstPc || v > best) { top = pc; best = v; firstPc = false; }
    p.order_profit_center = PC_OK.has(top) ? top : "Unknown";
  }
  p.order_positions_json = positionsJson(pos);
  return p;
}

/** The payload an existing web order without lines is enriched with: Magento keeps its own fields. */
export function enrichPayload(p: Record<string, string>): Record<string, string> {
  const out = { ...p };
  for (const k of ENRICH_DROP) delete out[k];
  return out;
}

/* ── the .000 duplicate guard ──────────────────────────────────────────── */

/** Bases of the delivery suffixes just created: "A26.1.002" -> "A26.1"; no .000, no undotted numbers. */
export function deliveryBases(created: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const f of created) {
    if ((f.match(/\./g) ?? []).length >= 2 && !f.endsWith(".000")) set.add(f.slice(0, f.lastIndexOf(".")));
  }
  return [...set].sort(cmpStr);
}

/** A delivery of base b: "b.<anything>" that is not the .000 itself. */
export const isDeliveryOf = (num: string | null | undefined, base: string): boolean =>
  (num ?? "").startsWith(`${base}.`) && !(num ?? "").endsWith(".000");

/** The .000 record's base, as the connector keys it: its number minus the last four characters. */
export const baseOf000 = (num: string | null | undefined): string => cpSlice(num ?? "", 0, -4);

/** The web-only fields a .000 carries ({k: v} for the non-empty ones). */
export function webCarry(props: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of WEB_CARRY) { const v = props[k]; if (v) out[k] = v; }
  return out;
}

export type Dedup = { action: "archive"; sfx: number } | { action: "reduce"; sfx: number; remainder: number } | { action: "keep"; sfx: number };

/**
 * The .000 decision. The deliveries carry the same goods as the order entry, so the .000
 * is archived when they cover it within max(0.5, 0.5%), or reduced to the undelivered
 * remainder when it is larger than what has gone out so far. Revenues in search order.
 */
export function dedupDecision(rev0: number, deliveries: number[]): Dedup {
  const sfx = pySum(deliveries);
  if (Math.abs(rev0 - sfx) <= pyMax2(0.5, Math.abs(sfx) * 0.005)) return { action: "archive", sfx };
  if (rev0 > sfx && sfx > 0) return { action: "reduce", sfx, remainder: pyRound(rev0 - sfx, 2) };
  return { action: "keep", sfx };
}

/* ── dim_order rows (stage_load + order_sync) ──────────────────────────── */

/** A dim_order row as csv.DictReader gives it, "" for a missing column. */
export type Get = (column: string) => string;

/** M100/M110 and the current version of the row. -> the order number, or null when not taken. */
export function dimOrderNumber(get: Get): string | null {
  const cn = pyStrip(get("CompanyNumber"));
  if (cn !== "100" && cn !== "110") return null;
  const flag = pyStrip(get("src_current_flag"));
  if (flag !== "Y" && flag !== "") return null;
  return pyStrip(get("OrderNumber")) || null;
}

/** stage_load's target for one row: Cancelled for Inactive=J / DeletedOrder=Y, else the SMAP stage (null = none). */
export function stageOfRow(get: Get): { stage: string | null; cancelled: boolean } {
  if (pyStrip(get("Inactive")) === "J" || pyStrip(get("DeletedOrder")) === "Y") return { stage: CANCELLED, cancelled: true };
  const k = pyStrip(get("OrderStatus")).toLowerCase();
  return { stage: Object.prototype.hasOwnProperty.call(SMAP, k) ? SMAP[k] : null, cancelled: false };
}

/**
 * stage_load's targets, row by row: a cancelled row always sets Cancelled, a row with a
 * known status sets its stage, a row with an unknown status leaves an earlier row's
 * target in place. -> rows counted as cancelled (rows, not orders - as the connector counts).
 */
export function addStageRow(targets: Map<string, string>, get: Get, only?: ReadonlySet<string> | null): number {
  const on = dimOrderNumber(get);
  if (!on) return 0;
  const { stage, cancelled } = stageOfRow(get);
  if (only && !only.has(on)) return cancelled ? 1 : 0;
  if (stage) targets.set(own(on), stage);
  return cancelled ? 1 : 0;
}

/** The stage to write, or null: only a known target that differs from what the order has. */
export const stageUpdate = (cur: string, tgt: string | undefined): string | null => (tgt && tgt !== cur ? tgt : null);

/** erp_status: ERP OrderStatus -> the order_order_status enum, "" when unknown; a G-number is always a credit note. */
export function erpStatus(raw: string | null | undefined, orderNumber: string | null | undefined): string {
  const first = Array.from(pyStrip(orderNumber ?? ""))[0] ?? "";
  if (first.toUpperCase() === "G") return "credit_note";
  let v = pyStrip(raw ?? "").toLowerCase();
  if (!v) return "";
  v = (Object.prototype.hasOwnProperty.call(STATUS_ALIAS, v) ? STATUS_ALIAS[v] : v).split(" ").join("_");
  return STATUS_VALUES.has(v) ? v : "";
}

// person_from_reference's two expressions. Python's \w and \b are Unicode-aware, JS's are
// ASCII-only, so the word class is spelled out and \b becomes lookarounds (every
// alternative starts and ends with a word character, so \b is exactly "no word char
// beside it").
const WC = "[\\p{L}\\p{N}_]";
const ROLE_WORDS = [
  `einkauf${WC}*`, `purchas${WC}*`, `achat${WC}*`, `acquist${WC}*`, "buyer", "procurement", "beschaffung", "inkoop", `zakup${WC}*`,
  "team", "office", "b[uü]ro", "bureau", `admin${WC}*`, "info", "lager", `magazin${WC}*`, "werkstatt", "workshop", "atelier",
  "service", "kundendienst", `bestell${WC}*`, `order${WC}*`, `commande${WC}*`, "technik", "technique", "engineering", "buchhaltung",
  "accounting", `compta${WC}*`, "sekretariat", "secretariat", "empfang", "reception", "labor", "lab", "abteilung", "department",
  `logisti${WC}*`, "produktion", "production", "instandhaltung", "maintenance", "unterhalt", `qualit${WC}*`, "stadt", "gemeinde",
  "kanton", "ville", "commune", "comune", "citt[aà]", `universit${WC}*`, "hochschule", "schule", "[ée]cole", `institut${WC}*`,
  "spital", "hospital", "h[oô]pital", "ospedale", "klinik", "clinique", "zentrum", "centre", "center", "verwaltung",
  "ag", "gmbh", "sa", "sarl", "srl", "spa", "ltd", "bv", "kg", "inc", "llc", "co", "ug", "ohg", "gbr",
];
export const ROLE = new RegExp(`(?<!${WC})(?:${ROLE_WORDS.join("|")})(?!${WC})|${WC}+amt(?!${WC})`, "iu");
const L1 = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF\\u0100-\\u017E\\u1E00-\\u1EFF";
export const WORD = new RegExp(`^[${L1}][${L1}'\\u2019.\\-]*$`, "u");

const LOWER_RE = /\p{Lowercase}/u, UPPER_RE = /\p{Uppercase}/u, TITLE_RE = /\p{Lt}/u;
function pyIsUpper(s: string): boolean {
  let cased = false;
  for (const ch of s) {
    if (LOWER_RE.test(ch) || TITLE_RE.test(ch)) return false;
    if (UPPER_RE.test(ch)) cased = true;
  }
  return cased;
}
function pyIsLower(s: string): boolean {
  let cased = false;
  for (const ch of s) {
    if (UPPER_RE.test(ch) || TITLE_RE.test(ch)) return false;
    if (LOWER_RE.test(ch)) cased = true;
  }
  return cased;
}

/**
 * The person in YourReference ("Name / PO number" -> "Name"): two or three words, letters
 * only, no role/company/department word, at least two real words; ALL-CAPS or all-lower
 * words longer than two letters capitalised. "" when it is not a person.
 */
export function personFromReference(ref: string | null | undefined): string {
  const s = pyStrip((ref ?? "").split("/")[0].replace(WS_RUN_RE, " "));
  const words = s ? s.split(" ") : [];
  if (words.length < 2 || words.length > 3) return "";
  if (words.some((w) => !WORD.test(w)) || ROLE.test(s)) return "";
  if (words.filter((w) => Array.from(w.replace(/^\.+|\.+$/g, "")).length >= 2).length < 2) return "";
  return words
    .map((w) => {
      const cps = Array.from(w);
      return (pyIsUpper(w) || pyIsLower(w)) && cps.length > 2 ? cps[0].toUpperCase() + cps.slice(1).join("").toLowerCase() : w;
    })
    .join(" ");
}

const SHIP_RE = /^(\p{Nd}{2})\.(\p{Nd}{2})\.(\p{Nd}{4})/u;
/** dim_order "dd.mm.yyyy hh:mm:ss" -> "yyyy-mm-dd"; null when empty, unreadable or outside 1990-2100. */
export function shipIso(raw: string | null | undefined): string | null {
  const m = SHIP_RE.exec(pyStrip(raw ?? ""));
  if (!m) return null;
  const [, d, mo, y] = m;
  return y < "1990" || y > "2100" ? null : `${y}-${mo}-${d}`;
}

/** A HubSpot date property (either "yyyy-mm-dd…" or epoch ms) -> "yyyy-mm-dd"; null when empty. */
export function hsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^[0-9]+$/.test(v)) return new Date(Number(v)).toISOString().slice(0, 10);
  return cpSlice(v, 0, 10);
}

/**
 * "A# | person | company". The company is what the title carries after the order number
 * today (its last segment, so a converted title keeps its company); a title that does not
 * start with the order number contributes none.
 */
export function wantedTitle(aNumber: string, current: string | null | undefined, person: string): string {
  const parts = (current ?? "").split(" | ").map(pyStrip);
  let company = parts.length >= 2 && parts[0] === aNumber ? parts[parts.length - 1] : "";
  // FIX (SARCLA 08.10.2026: fix + repair). The connector read the last segment as the
  // company even when it was the person: "A# | Hans Muster" (an order created without a
  // company name) became "A# | Hans Muster | Hans Muster" on the next run. A second
  // segment that is the person we are writing is not a company; and a title already
  // doubled that way ("A# | X | X", X the person) is repaired to "A# | X" by this same run.
  if (person && company === person && (parts.length === 2 || (parts.length === 3 && parts[1] === parts[2]))) company = "";
  return [aNumber, person, company].filter((x) => x).join(" | ");
}

/** What order_sync wants for one order: person, shipment date, status. */
export type DetailTarget = { person: string; ship: string | null; status: string };
export function detailOfRow(get: Get, on: string): DetailTarget {
  return { person: personFromReference(get("YourReference")), ship: shipIso(get("ShipmentDate")), status: erpStatus(get("OrderStatus"), on) };
}

/** The snapshot row order_sync compares: number, title, shipment date, status. */
export type DetailRow = { num: string; title: string; ship: string | null; status: string };

/** order_sync's diff for one order: the properties to write, or null when it is current. */
export function detailUpdate(row: DetailRow, t: DetailTarget | undefined): Record<string, string> | null {
  if (!t) return null;
  const props: Record<string, string> = {};
  const want = wantedTitle(row.num, row.title, t.person);
  if (want && want !== row.title) props.hs_order_name = want;
  if (t.ship && t.ship !== row.ship) props.order_shipment_date = t.ship;
  if (t.status && t.status !== row.status) props.order_order_status = t.status;
  return Object.keys(props).length ? props : null;
}

/** Packs a detail target into one string, so 800,000 of them stay small in memory. */
export const packDetail = (t: DetailTarget): string => own(`${t.person}\u0001${t.ship ?? ""}\u0001${t.status}`);
export function unpackDetail(s: string | undefined): DetailTarget | undefined {
  if (s === undefined) return undefined;
  const [person, ship, status] = s.split("\u0001");
  return { person, ship: ship || null, status };
}

/** A HubSpot order as the snapshot keeps it: the pipeline filter both steps apply. */
export const inPipeline = (pipeline: string | null | undefined): boolean => !pipeline || pipeline === PIPELINE;
