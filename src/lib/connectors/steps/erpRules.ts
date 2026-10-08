// THE ERP MORNING WORKBOOK'S RULES, with no HubSpot and no file in them - ported
// line for line from the Compass connector (service/erp_revenue.py, with the
// country helpers of service/revenue_monthly.py, 08.10.2026) so the hub reads the
// workbook exactly as the connector did. The file is read in ./erpWorkbook.ts,
// HubSpot is written in ./erpRevenue.ts; tests/connectors-erp.test.ts holds these
// rules, and the connector's own Python run on the same workbooks found no
// difference.
//
// The workbook holds FOUR pivots across two sheets, and each one has bitten:
//   FIGURES (3) col 1    revenue per customer       MTD / PY_MTD / YTD / PY_YTD
//   FIGURES (3) col 49   forecast per MANDANT       + a "Grand Total" row
//   FIGURES (3) col 86   order intake per customer  own key column, own row order
//   FIGURES (4)          revenue per profit centre  + a "Grand Total" row
// Three rules keep the figures honest (learned on 24.09.2026):
//   1. A measure belongs to the nearest CustomerNumberUnique on its LEFT. Reading the
//      OI pivot against column 1 put 11,438 customers' order intake on the wrong company.
//   2. Never sum a row whose key is not a detail key. The forecast doubled to 43.4M
//      because the Grand Total row was added to the two mandant rows.
//   3. YTD is NOT monotonic - it falls on a credit note. Take the LAST month carrying a
//      value, never max(), and keep zero cells so a YTD dropping back to 0 is seen.
// Both years come from this one file, cut on the same day: every PY comparison made
// here is like-for-like. The blob-built revenue_monthly is not - never mix the two.

/* ── Python's arithmetic, exactly ──────────────────────────────────────── */

/**
 * A whole number the file wrote as a float ("100.0", "1E2"). openpyxl keeps it a
 * float, so str() says "100.0" - which is not a mandant number to the forecast.
 */
export class PyFloat {
  constructor(readonly v: number) {}
}

/** A cell as openpyxl gives it (read-only, data_only): text, a number, a bool, a date, or nothing. */
export type Cell = string | number | boolean | Date | PyFloat | null;
export type Row = readonly Cell[];

/**
 * Python's round(x, n): the exact binary value rounded, an exact tie to the even
 * neighbour. Not the hub's segmentation pyRound - that one rounds 2.675 to 2.68,
 * Python (and the connector) to 2.67.
 */
export function pyRound(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x;
  const ax = Math.abs(x);
  if (ax >= 1e21) return x; // far past a cent: Python returns x itself
  let s = ax.toFixed(n); // the exact value, a tie away from zero
  const ext = ax.toFixed(Math.min(100, n + 30));
  const tail = ext.slice(ext.length - 30);
  if (/^50*$/.test(tail)) {
    // exactly half (0.125, 2.5 ...): toFixed went up; Python goes to the even digit
    const last = s.charCodeAt(s.length - 1) - 48;
    if (last % 2 === 1) s = s.slice(0, -1) + String(last - 1);
  }
  const r = Number(s);
  return x < 0 ? -r : r;
}

/** Python 3.12+ sum() of floats: Neumaier's compensated sum, in the given order. */
export function pySum(xs: Iterable<number>): number {
  let s = 0;
  let c = 0;
  for (const x of xs) {
    const t = s + x;
    if (Math.abs(s) >= Math.abs(x)) c += s - t + x;
    else c += x - t + s;
    s = t;
  }
  if (c && Number.isFinite(c)) s += c;
  return s;
}

const SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP = new RegExp(`^[${SPACE}]+|[${SPACE}]+$`, "g");
/** str.strip(): Python's whitespace, which is not quite JavaScript's (no BOM, plus \x1c-\x1f and \x85). */
export const pyStrip = (s: string): string => s.replace(STRIP, "");

const DIGITS = new RegExp("^[\\p{Nd}\\u00b2\\u00b3\\u00b9\\u2070\\u2074-\\u2079\\u2080-\\u2089]+$", "u");
/** str.isdigit() */
export const isDigits = (s: string): boolean => DIGITS.test(s);

const LETTER = new RegExp("^\\p{L}$", "u");

/** isinstance(v, (int, float)) - a bool is an int in Python. */
export const isNum = (v: Cell | undefined): v is number | boolean | PyFloat => typeof v === "number" || typeof v === "boolean" || v instanceof PyFloat;
export const num = (v: number | boolean | PyFloat): number => (typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "number" ? v : v.v);
/** Python truthiness of a cell (`v or ""`). */
const truthy = (v: Cell): boolean => v !== null && v !== "" && v !== 0 && v !== false && !(v instanceof PyFloat && v.v === 0);

function floatRepr(x: number): string {
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expS] = x.toExponential().split("e");
  const exp = Number(expS);
  const digits = mant.replace("-", "").replace(".", "");
  const sign = x < 0 ? "-" : "";
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  if (digits.length <= exp + 1) return `${sign}${digits}${"0".repeat(exp + 1 - digits.length)}.0`;
  return `${sign}${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
}

const two = (n: number) => String(n).padStart(2, "0");

/** str(cell): a whole number is an int ("100"), unless the file wrote it as a float (PyFloat, "100.0"). */
export function pyStr(v: Cell): string {
  if (v === null) return "None";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) < 1e21 ? String(v) : floatRepr(v);
  if (v instanceof PyFloat) return floatRepr(v.v);
  const d = v;
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
}

/** _ff: a pivot writes a level once; carry it forward across the merged cells. */
export function ff(row: Row): Cell[] {
  let cur: Cell = null;
  const out: Cell[] = new Array(row.length);
  for (let i = 0; i < row.length; i++) {
    const v = row[i] ?? null;
    if (v !== null && v !== "") cur = v;
    out[i] = cur;
  }
  return out;
}

const padTo = (row: Row, n: number): Cell[] => {
  const out: Cell[] = new Array(Math.max(n, row.length)).fill(null);
  for (let i = 0; i < row.length; i++) out[i] = row[i] ?? null;
  return out;
};

/* ── the constants ─────────────────────────────────────────────────────── */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MONTH_SET = new Set<string>(MONTHS);

export const SHEET_CUSTOMERS = "FIGURES (3)";
export const SHEET_PROFIT_CENTRES = "FIGURES (4)";
const CNU = "CustomerNumberUnique";
const FC = "I_NET_REV_EUR_FC";
export const TAG = {
  mtd: "I_NET_REV_EUR_MTD", mtdPy: "I_NET_REV_EUR_PY_MTD", ytd: "I_NET_REV_EUR_YTD", ytdPy: "I_NET_REV_EUR_PY_YTD",
  oMtd: "OI_NET_REV_EUR_MTD", oMtdPy: "OI_NET_REV_EUR_PY_MTD", oYtd: "OI_NET_REV_EUR_YTD", oYtdPy: "OI_NET_REV_EUR_PY_YTD",
} as const;

/** A doubled forecast is the Grand Total row creeping back in. */
export const FORECAST_SUSPECT_EUR = 30_000_000;

export const PC_LABEL = new Map<string, string>([
  ["DT", "Sealing Technology"], ["KT", "Engineering Plastics"], ["FT", "Fluid Technology"],
  ["ST", "Antivibration Technology"], ["AT", "Drive Technology"], ["SP", "Sensors & Power"],
]);

/** The 21 company properties, group erp_revenue - created by the connector, never by the hub. */
export const COMPANY_PROPS = [
  "erp_rev_mtd_cy", "erp_rev_mtd_py", "erp_rev_mtd_delta", "erp_rev_mtd_delta_pct",
  "erp_rev_ytd_cy", "erp_rev_ytd_py", "erp_rev_ytd_delta", "erp_rev_ytd_delta_pct",
  "erp_oi_mtd_cy", "erp_oi_mtd_py", "erp_oi_mtd_delta", "erp_oi_mtd_delta_pct",
  "erp_oi_ytd_cy", "erp_oi_ytd_py", "erp_oi_ytd_delta", "erp_oi_ytd_delta_pct",
  "erp_oi_ytd_pct_of_rev", "erp_rev_rank_ytd", "erp_rev_rank_growth", "erp_rev_rank_decline", "erp_rev_as_of",
] as const;
export type CompanyProp = (typeof COMPANY_PROPS)[number];

/** The KPI properties these rows carry, and the metric_name options they use. */
export const KPI_PROPS = [
  "name", "kpi_category", "metric_name", "metric_value", "snapshot_date", "kpi_year", "kpi_month_label",
  "kpi_comparable", "kpi_profit_center", "kpi_country", "kpi_entity", "kpi_priority",
] as const;
export const METRIC_NAMES = ["order_intake_sum", "revenue_sum", "forecast_sum"] as const;
export const KPI_CATEGORIES = [
  "forecast_monthly", "oi_erp_monthly", "revenue_pc_monthly", "revenue_geo_erp_monthly",
  "oi_geo_monthly", "revenue_prio_monthly", "oi_prio_monthly",
] as const;
export const REALIGN_CATEGORY = "revenue_monthly";

/* ── countries (service/revenue_monthly.py) ────────────────────────────── */

// the company "country" field is written in two styles (CH and Switzerland ...);
// everything is folded to ISO-2 so the by-country rows line up
const NAME2ISO = new Map<string, string>(Object.entries({
  switzerland: "CH", germany: "DE", italy: "IT", france: "FR", austria: "AT",
  netherlands: "NL", "the netherlands": "NL", poland: "PL", belgium: "BE",
  "czech republic": "CZ", czechia: "CZ", "united kingdom": "GB", "great britain": "GB",
  spain: "ES", hungary: "HU", slovakia: "SK", slovenia: "SI", romania: "RO",
  bulgaria: "BG", portugal: "PT", sweden: "SE", denmark: "DK", finland: "FI",
  norway: "NO", turkey: "TR", turkiye: "TR", japan: "JP", liechtenstein: "LI",
  croatia: "HR", greece: "GR", estonia: "EE", lithuania: "LT", latvia: "LV",
  monaco: "MC", luxembourg: "LU", ireland: "IE", usa: "US", "united states": "US",
  china: "CN", india: "IN", serbia: "RS", "bosnia and herzegovina": "BA",
  ukraine: "UA", russia: "RU", israel: "IL", brazil: "BR", canada: "CA",
  mexico: "MX", australia: "AU", "south africa": "ZA", singapore: "SG",
  "south korea": "KR", taiwan: "TW", thailand: "TH",
}));
export const ENTITY = new Map<string, string>([["100", "APSOparts AG (CH)"], ["110", "APSOparts GmbH (DE)"]]);
// charts read better with the country spelled out; the ISO code stays the key
const ISO2NAME = new Map<string, string>(Object.entries({
  AE: "United Arab Emirates", AL: "Albania", AM: "Armenia", AR: "Argentina", AT: "Austria", AU: "Australia",
  AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BE: "Belgium", BG: "Bulgaria", BR: "Brazil", BY: "Belarus",
  CA: "Canada", CH: "Switzerland", CL: "Chile", CN: "China", CO: "Colombia", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", EG: "Egypt", ES: "Spain", FI: "Finland", FR: "France",
  GB: "United Kingdom", GE: "Georgia", GR: "Greece", HK: "Hong Kong", HR: "Croatia", HU: "Hungary",
  ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland", IT: "Italy", JP: "Japan",
  KR: "South Korea", KZ: "Kazakhstan", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia",
  MA: "Morocco", MC: "Monaco", MD: "Moldova", ME: "Montenegro", MK: "North Macedonia", MT: "Malta",
  MX: "Mexico", MY: "Malaysia", NL: "Netherlands", NO: "Norway", NZ: "New Zealand", PE: "Peru", PL: "Poland",
  PT: "Portugal", RO: "Romania", RS: "Serbia", RU: "Russia", SA: "Saudi Arabia", SE: "Sweden", SG: "Singapore",
  SI: "Slovenia", SK: "Slovakia", TH: "Thailand", TN: "Tunisia", TR: "Turkey", TW: "Taiwan", UA: "Ukraine",
  US: "United States", UZ: "Uzbekistan", VN: "Vietnam", XX: "Unknown", ZA: "South Africa",
}));

/** revenue_monthly._iso: a company's country as ISO-2 ("Switzerland" and "CH" alike), "XX" when empty. */
export function iso(c: string | null | undefined): string {
  const s = pyStrip(c ?? "");
  const cps = [...s];
  if (cps.length === 2 && cps.every((ch) => LETTER.test(ch))) return s.toUpperCase();
  const hit = NAME2ISO.get(s.toLowerCase());
  if (hit !== undefined) return hit;
  return s ? [...s.toUpperCase()].slice(0, 2).join("") : "XX";
}

export const countryName = (code: string): string => ISO2NAME.get(code) ?? code;

/** _short_prio: '1-Prio 1 - Pot >25000EUR' -> '1 - Prio 1'; the rank digit keeps chart order. */
export function shortPrio(v: string | null | undefined): string {
  const s = pyStrip(v ?? "");
  if (!s) return "5 - Not set";
  const head = pyStrip(s.split("-")[0]);
  const low = s.toLowerCase();
  for (const n of ["1", "2", "3"]) {
    if (head === n || low.includes(`prio ${n}`)) return `${n} - Prio ${n}`;
  }
  return "4 - No priority";
}

/* ── FIGURES (3): customers, order intake, forecast ────────────────────── */

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutError";
  }
}

/** One customer's figures, keyed "Mon|MEASURE" ("Oct|I_NET_REV_EUR_YTD"). */
export interface Rec {
  get(key: string): number | undefined;
}

/** A customer's figures in one slot per measure column - small for ~12,000 customers. NaN = no cell. */
export class SlotRec implements Rec {
  constructor(private readonly slots: ReadonlyMap<string, number>, readonly v: Float64Array) {}
  get(key: string): number | undefined {
    const s = this.slots.get(key);
    if (s === undefined) return undefined;
    const x = this.v[s];
    return Number.isNaN(x) ? undefined : x;
  }
  entries(): [string, number][] {
    const out: [string, number][] = [];
    for (const [k, s] of this.slots) if (!Number.isNaN(this.v[s])) out.push([k, this.v[s]]);
    return out;
  }
}

export type Figures3Result = {
  /** read_customers: un -> figures, in the order the sheet first carried each customer; all-zero customers left out. */
  customers: Map<string, SlotRec>;
  /** how many CustomerNumberUnique key columns the header has */
  pivots: number;
  /** read_forecast: month -> forecast summed over the mandant rows */
  forecast: Map<string, number>;
  /** rows carrying a forecast whose mandant cell is not a number - the Grand Total */
  forecastSkipped: number;
};

type Plan3 = {
  /** the header's width: the sheet's dimension when it has one (openpyxl pads to it), else the longest header row */
  n: number;
  keys: number[];
  slots: Map<string, number>;
  colKc: Int32Array;
  colSlot: Int32Array;
  fc: Map<string, number>;
  mandantCol: number;
};

function plan3(hdr: Map<number, Row>): Plan3 {
  const r14 = hdr.get(14) ?? [], r15 = hdr.get(15) ?? [], r16 = hdr.get(16) ?? [];
  const n = Math.max(r14.length, r15.length, r16.length);
  const M = ff(padTo(r15, n));
  const MEA = ff(padTo(r16, n));
  const keys: number[] = [];
  for (let c = 0; c < n; c++) if (pyStrip(pyStr(truthy(MEA[c]) ? MEA[c] : "")) === CNU) keys.push(c);
  if (!keys.length) throw new LayoutError(`${SHEET_CUSTOMERS}: no ${CNU} header - layout changed`);
  const keyFor = (c: number): number => {
    let own = -1;
    for (const kc of keys) if (kc < c) own = kc;
    return own;
  };
  const isMeasure = (mea: string) => !mea.startsWith(FC) && (mea.startsWith("I_NET_REV_EUR") || mea.startsWith("OI_NET_REV_EUR"));
  const slots = new Map<string, number>();
  const slotOf = (key: string) => {
    let s = slots.get(key);
    if (s === undefined) slots.set(key, (s = slots.size));
    return s;
  };
  const colKc = new Int32Array(n).fill(-1), colSlot = new Int32Array(n).fill(-1);
  for (let c = 0; c < n; c++) {
    const mea = pyStr(truthy(MEA[c]) ? MEA[c] : "");
    if (!isMeasure(mea)) continue; // the forecast pivot is per mandant, read below
    const kc = keyFor(c);
    if (kc < 0) continue;
    colKc[c] = kc;
    colSlot[c] = slotOf(`${pyStr(M[c])}|${mea}`);
  }

  // read_forecast: the month row carried forward, the measure row as it is
  const fc = new Map<string, number>();
  for (let c = 0; c < r16.length; c++) {
    if (pyStrip(pyStr(truthy(r16[c]) ? r16[c] : "")) !== FC) continue;
    const m = pyStrip(pyStr(M[c]));
    if (MONTH_SET.has(m)) fc.set(m, c);
  }
  if (!fc.size) throw new LayoutError(`${SHEET_CUSTOMERS}: forecast columns not found - layout changed`);
  const mandantCol = Math.min(...fc.values()) - 1;
  // the connector would read the row's last cell here (Python's row[-1]); no mandant column is a layout change
  if (mandantCol < 0) throw new LayoutError(`${SHEET_CUSTOMERS}: the forecast starts in column A - no mandant column, layout changed`);
  return { n, keys, slots, colKc, colSlot, fc, mandantCol };
}

/**
 * FIGURES (3), fed row by row so the file can stream: header rows 14-16, data from 17.
 * Rows come as openpyxl's read-only iter_rows gives them: padded to the sheet's
 * dimension, so a header label carries on across the padded columns too.
 */
export class Figures3 {
  private hdr = new Map<number, Row>();
  private plan: Plan3 | null = null;
  private recs = new Map<string, Float64Array>();
  private nonzero = new Set<string>();
  private fcTot = new Map<string, number>();
  private fcSkipped = 0;

  feed(n: number, row: Row): void {
    if (n < 17) {
      if (n >= 14) this.hdr.set(n, row);
      return;
    }
    const p = this.plan ?? (this.plan = plan3(this.hdr));
    this.customers(p, row);
    this.forecast(p, row);
  }

  /** read_customers: each measure bound to its OWN key column, zeros kept (rule 3). */
  private customers(p: Plan3, row: Row): void {
    const S = p.slots.size;
    const end = Math.min(row.length, p.n);
    for (let c = 0; c < end; c++) {
      const slot = p.colSlot[c];
      if (slot < 0) continue;
      const kc = p.colKc[c];
      const raw = kc < row.length ? row[kc] : null;
      if (typeof raw !== "string" || !raw.includes("-")) continue;
      const v = row[c];
      if (!isNum(v)) continue;
      const un = pyStrip(raw);
      let rec = this.recs.get(un);
      if (!rec) {
        rec = new Float64Array(S).fill(NaN);
        this.recs.set(un, rec);
      }
      const x = num(v);
      rec[slot] = (Number.isNaN(rec[slot]) ? 0 : rec[slot]) + x;
      if (x !== 0) this.nonzero.add(un);
    }
  }

  /** read_forecast: one row per mandant PLUS a Grand Total - only a numeric mandant counts. */
  private forecast(p: Plan3, row: Row): void {
    let carries = false;
    for (const c of p.fc.values()) {
      const v = c < row.length ? row[c] : null;
      if (isNum(v) && num(v) !== 0) {
        carries = true;
        break;
      }
    }
    if (!carries) return;
    const cell = p.mandantCol < row.length ? row[p.mandantCol] : null;
    if (!isDigits(pyStrip(pyStr(cell)))) {
      this.fcSkipped += 1; // "Grand Total" and anything else
      return;
    }
    for (const [m, c] of p.fc) {
      const v = c < row.length ? row[c] : null;
      if (isNum(v)) this.fcTot.set(m, (this.fcTot.get(m) ?? 0) + num(v));
    }
  }

  finish(): Figures3Result {
    const p = this.plan ?? (this.plan = plan3(this.hdr));
    const customers = new Map<string, SlotRec>();
    for (const [un, v] of this.recs) if (this.nonzero.has(un)) customers.set(un, new SlotRec(p.slots, v));
    return { customers, pivots: p.keys.length, forecast: new Map(this.fcTot), forecastSkipped: this.fcSkipped };
  }
}

/* ── FIGURES (4): revenue per profit centre ────────────────────────────── */

export type PcPoint = { pc: string; off: 0 | -1; m: number; v: number };
export type Figures4Result = {
  /** (profit centre, 0 = this year / -1 = last year, month) -> the month's own revenue */
  series: Map<string, PcPoint>;
  /** "Grand Total" and every other row naming a total */
  skipped: number;
};

const pcKey = (pc: string, off: number, m: number) => `${pc}\u0001${off}\u0001${m}`;

/** FIGURES (4), fed row by row: header rows 13-16, data from 17. */
export class Figures4 {
  private hdr = new Map<number, Row>();
  private cols: Map<string, number> | null = null;
  private series = new Map<string, PcPoint>();
  private skipped = 0;

  private plan(): Map<string, number> {
    const r15 = this.hdr.get(15) ?? [], r16 = this.hdr.get(16) ?? [];
    const mo = ff(padTo(r15, r16.length));
    const cols = new Map<string, number>();
    for (let c = 0; c < r16.length; c++) {
      const m = pyStrip(pyStr(mo[c]));
      const tag = pyStrip(pyStr(truthy(r16[c]) ? r16[c] : ""));
      if (MONTH_SET.has(m) && tag.startsWith("I_NET_REV_EUR")) cols.set(`${m}|${tag}`, c);
    }
    return cols;
  }

  feed(n: number, row: Row): void {
    if (n < 17) {
      if (n >= 13) this.hdr.set(n, row);
      return;
    }
    const cols = this.cols ?? (this.cols = this.plan());
    const raw = row.length ? row[0] : null;
    if (typeof raw !== "string" || !pyStrip(raw)) return;
    const pc = pyStrip(raw);
    if (pc.toLowerCase().includes("total")) {
      this.skipped += 1;
      return;
    }
    for (const [off, tag] of [[0, TAG.ytd], [-1, TAG.ytdPy]] as const) {
      let prev = 0;
      MONTHS.forEach((m, i) => {
        const c = cols.get(`${m}|${tag}`);
        if (c === undefined) return;
        const v = c < row.length ? row[c] : null;
        const y = isNum(v) ? num(v) : 0; // an empty cell reads as 0 here, as in the connector
        this.series.set(pcKey(pc, off, i + 1), { pc, off, m: i + 1, v: pyRound(y - prev, 2) });
        prev = y;
      });
    }
  }

  finish(): Figures4Result {
    return { series: new Map(this.series), skipped: this.skipped };
  }
}

/** Feed whole sheets at once (tests, parity): rows[i] is sheet row i + 1. */
export function readFigures3(rows: readonly Row[]): Figures3Result {
  const f = new Figures3();
  rows.forEach((r, i) => f.feed(i + 1, r));
  return f.finish();
}
export function readFigures4(rows: readonly Row[]): Figures4Result {
  const f = new Figures4();
  rows.forEach((r, i) => f.feed(i + 1, r));
  return f.finish();
}

/* ── the load ──────────────────────────────────────────────────────────── */

/** The latest month any customer has an MTD for. */
export function latestMonth(data: ReadonlyMap<string, Rec>): string {
  for (let i = MONTHS.length - 1; i >= 0; i--) {
    const k = `${MONTHS[i]}|${TAG.mtd}`;
    for (const r of data.values()) if (r.get(k) !== undefined) return MONTHS[i];
  }
  return MONTHS[0];
}

export const monthsUpTo = (cur: string): string[] => MONTHS.slice(0, MONTHS.indexOf(cur as (typeof MONTHS)[number]) + 1);

/** _ladder: each month's own figure from the YTD ladder (month 1-12 -> value), months without a cell skipped. */
export function ladder(rec: Rec, tag: string, upto: readonly string[]): Map<number, number> {
  const out = new Map<number, number>();
  let prev = 0;
  upto.forEach((mo, i) => {
    const v = rec.get(`${mo}|${tag}`);
    if (v === undefined) return;
    out.set(i + 1, v - prev);
    prev = v;
  });
  return out;
}

/** _last: the LAST month carrying a value - never max(): YTD falls on a credit note. */
export function last(rec: Rec, tag: string, upto: readonly string[]): number {
  for (let i = upto.length - 1; i >= 0; i--) {
    const v = rec.get(`${upto[i]}|${tag}`);
    if (v !== undefined) return v;
  }
  return 0;
}

/** _pct: change in %, one decimal; null when there is no base. */
export const pct = (a: number, b: number): number | null => (b ? pyRound((100 * (a - b)) / b, 1) : null);

export const FIGURE_KEYS = ["mtd", "mtd_py", "ytd", "ytd_py", "o_mtd", "o_mtd_py", "o_ytd", "o_ytd_py"] as const;
export type CompanyFigures = Record<(typeof FIGURE_KEYS)[number], number>;

/** The eight figures per customer, rounded to the cent as the connector writes them. */
export function companyFigures(data: ReadonlyMap<string, Rec>, cur: string, upto: readonly string[]): Map<string, CompanyFigures> {
  const rows = new Map<string, CompanyFigures>();
  for (const [un, r] of data) {
    const g = (tag: string) => r.get(`${cur}|${tag}`) ?? 0;
    rows.set(un, {
      mtd: pyRound(g(TAG.mtd), 2), mtd_py: pyRound(g(TAG.mtdPy), 2),
      ytd: pyRound(last(r, TAG.ytd, upto), 2), ytd_py: pyRound(last(r, TAG.ytdPy, upto), 2),
      o_mtd: pyRound(g(TAG.oMtd), 2), o_mtd_py: pyRound(g(TAG.oMtdPy), 2),
      o_ytd: pyRound(last(r, TAG.oYtd, upto), 2), o_ytd_py: pyRound(last(r, TAG.oYtdPy, upto), 2),
    });
  }
  return rows;
}

export function figureTotals(rows: ReadonlyMap<string, CompanyFigures>): CompanyFigures {
  const out = {} as CompanyFigures;
  for (const k of FIGURE_KEYS) out[k] = pyRound(pySum([...rows.values()].map((v) => v[k])), 2);
  return out;
}

export type Ranks = { rev: Map<string, number>; growth: Map<string, number>; decline: Map<string, number> };

const asc = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Ranks over the MATCHED customers only, so the numbers mean what a report shows.
 * `found` in HubSpot's order: Python's sort is stable, ties keep that order.
 */
export function rankCompanies(rows: ReadonlyMap<string, CompanyFigures>, found: Iterable<string>): Ranks {
  const matched = [...found].filter((u) => rows.has(u));
  const fig = (u: string) => rows.get(u)!;
  const toRank = (order: string[]) => new Map(order.map((u, i) => [u, i + 1] as const));
  const rev = matched.filter((u) => fig(u).ytd).sort((a, b) => asc(fig(b).ytd, fig(a).ytd));
  const delta = new Map(matched.map((u) => [u, fig(u).ytd - fig(u).ytd_py] as const));
  const gain = matched.filter((u) => delta.get(u)! > 0).sort((a, b) => asc(-delta.get(a)!, -delta.get(b)!));
  const loss = matched.filter((u) => delta.get(u)! < 0).sort((a, b) => asc(delta.get(a)!, delta.get(b)!));
  return { rev: toRank(rev), growth: toRank(gain), decline: toRank(loss) };
}

export type CompanyValues = Record<CompanyProp, number | string | null>;

/** The 21 properties for one company; null = no value (no base for a %, not ranked). */
export function companyProperties(un: string, r: CompanyFigures, ranks: Ranks, today: string): CompanyValues {
  return {
    erp_rev_mtd_cy: r.mtd, erp_rev_mtd_py: r.mtd_py,
    erp_rev_mtd_delta: pyRound(r.mtd - r.mtd_py, 2), erp_rev_mtd_delta_pct: pct(r.mtd, r.mtd_py),
    erp_rev_ytd_cy: r.ytd, erp_rev_ytd_py: r.ytd_py,
    erp_rev_ytd_delta: pyRound(r.ytd - r.ytd_py, 2), erp_rev_ytd_delta_pct: pct(r.ytd, r.ytd_py),
    erp_oi_mtd_cy: r.o_mtd, erp_oi_mtd_py: r.o_mtd_py,
    erp_oi_mtd_delta: pyRound(r.o_mtd - r.o_mtd_py, 2), erp_oi_mtd_delta_pct: pct(r.o_mtd, r.o_mtd_py),
    erp_oi_ytd_cy: r.o_ytd, erp_oi_ytd_py: r.o_ytd_py,
    erp_oi_ytd_delta: pyRound(r.o_ytd - r.o_ytd_py, 2), erp_oi_ytd_delta_pct: pct(r.o_ytd, r.o_ytd_py),
    erp_oi_ytd_pct_of_rev: r.ytd ? pyRound((100 * r.o_ytd) / r.ytd, 1) : null,
    erp_rev_rank_ytd: ranks.rev.get(un) ?? null,
    erp_rev_rank_growth: ranks.growth.get(un) ?? null,
    erp_rev_rank_decline: ranks.decline.get(un) ?? null,
    erp_rev_as_of: today,
  };
}

/* ── the KPI series (object 2-201387076) ───────────────────────────────── */

export type KpiProps = Record<string, string | number>;
export type KpiRows = Map<string, KpiProps>;

const ym = (y: number, m: number) => `${y}-${two(m)}`;
const base = (name: string, cat: string, metric: string, value: number, y: number, m: number): KpiProps => ({
  name, kpi_category: cat, metric_name: metric, metric_value: value, snapshot_date: `${ym(y, m)}-01`,
  kpi_year: y, kpi_month_label: `${two(m)} ${NAMES[m - 1]}`, kpi_comparable: "yes",
});

/** forecast_monthly: this year's months that carry a forecast. */
export function forecastRows(fc: ReadonlyMap<string, number>, year: number): KpiRows {
  const out: KpiRows = new Map();
  MONTHS.forEach((mo, i) => {
    const v = fc.get(mo);
    if (!v) return;
    const nm = `forecast|${ym(year, i + 1)}`;
    out.set(nm, base(nm, "forecast_monthly", "forecast_sum", pyRound(v, 2), year, i + 1));
  });
  return out;
}

/** The whole file's month-by-month figure from the customers' YTD ladders. */
export function totalsByMonth(data: ReadonlyMap<string, Rec>, tag: string, upto: readonly string[]): Map<number, number> {
  const t = new Map<string, number>();
  for (const r of data.values()) {
    for (const m of upto) {
      const v = r.get(`${m}|${tag}`);
      if (v !== undefined) t.set(m, (t.get(m) ?? 0) + v);
    }
  }
  const out = new Map<number, number>();
  let prev = 0;
  upto.forEach((m, i) => {
    const tm = t.get(m) ?? 0;
    out.set(i + 1, pyRound(tm - prev, 2));
    prev = tm;
  });
  return out;
}

/** oi_erp_monthly: order intake per month, this year and last. */
export function oiErpRows(oiCy: ReadonlyMap<number, number>, oiPy: ReadonlyMap<number, number>, year: number): KpiRows {
  const out: KpiRows = new Map();
  for (const [yr, series] of [[year, oiCy], [year - 1, oiPy]] as const) {
    for (const [m, v] of series) {
      const nm = `oierp|${ym(yr, m)}`;
      out.set(nm, base(nm, "oi_erp_monthly", "order_intake_sum", v, yr, m));
    }
  }
  return out;
}

/** revenue_pc_monthly: revenue per profit centre per month, months with a figure. */
export function profitCentreRows(pcs: ReadonlyMap<string, PcPoint>, year: number): KpiRows {
  const out: KpiRows = new Map();
  for (const { pc, off, m, v } of pcs.values()) {
    if (!v) continue;
    const yr = year + off;
    const nm = `revpc|${pc}|${ym(yr, m)}`;
    out.set(nm, { ...base(nm, "revenue_pc_monthly", "revenue_sum", v, yr, m), kpi_profit_center: `${PC_LABEL.get(pc) ?? pc} (${pc})` });
  }
  return out;
}

export type Dims = { country: Map<string, string>; prio: Map<string, string> };

/** The country and priority of each matched customer, from its company. */
export function dimsOf(found: ReadonlyMap<string, { country?: string | null; sales_priority?: string | null }>): Dims {
  const dims: Dims = { country: new Map(), prio: new Map() };
  for (const [un, p] of found) {
    dims.country.set(un, iso(p.country));
    dims.prio.set(un, shortPrio(p.sales_priority));
  }
  return dims;
}

const SPEC = [
  ["revenue_geo_erp_monthly", "revgeoerp", "revenue_sum", "country", TAG.ytd, TAG.ytdPy],
  ["oi_geo_monthly", "oi_geo", "order_intake_sum", "country", TAG.oYtd, TAG.oYtdPy],
  ["revenue_prio_monthly", "revprio", "revenue_sum", "prio", TAG.ytd, TAG.ytdPy],
  ["oi_prio_monthly", "oiprio", "order_intake_sum", "prio", TAG.oYtd, TAG.oYtdPy],
] as const;

/** By country (and selling entity) and by priority, matched customers only, both years. */
export function dimensionRows(data: ReadonlyMap<string, Rec>, dims: Dims, upto: readonly string[], year: number): { cat: string; rows: KpiRows }[] {
  return SPEC.map(([cat, prefix, metric, dim, tagCy, tagPy]) => {
    const agg = new Map<string, { mand: string; key: string; yr: number; m: number; v: number }>();
    for (const [un, rec] of data) {
      const key = dims[dim].get(un);
      if (!key) continue;
      const mand = un.split("-")[0];
      for (const [yr, tag] of [[year, tagCy], [year - 1, tagPy]] as const) {
        for (const [m, v] of ladder(rec, tag, upto)) {
          if (!v) continue;
          const md = dim === "country" ? mand : "";
          const k = `${md}\u0001${key}\u0001${yr}\u0001${m}`;
          const a = agg.get(k);
          if (a) a.v += v;
          else agg.set(k, { mand: md, key, yr, m, v: 0 + v });
        }
      }
    }
    const rows: KpiRows = new Map();
    for (const { mand, key, yr, m, v } of agg.values()) {
      let nm: string, extra: KpiProps;
      if (dim === "country") {
        nm = `${prefix}|${mand}|${key}|${ym(yr, m)}`;
        extra = { kpi_country: countryName(key), kpi_entity: ENTITY.get(mand) ?? mand };
      } else {
        nm = `${prefix}|${key.split(" - ")[0]}|${ym(yr, m)}`;
        extra = { kpi_priority: key };
      }
      rows.set(nm, { ...base(nm, cat, metric, pyRound(v, 2), yr, m), ...extra });
    }
    return { cat, rows };
  });
}

/**
 * The blob-built revenue_monthly rows of this year get this file's figure (it is
 * fresher): month m goes to the FIRST existing row, in HubSpot's order, whose name
 * ends in -mm and carries the year.
 */
export function realignTargets(revCy: ReadonlyMap<number, number>, existing: ReadonlyMap<string, string>, year: number): { id: string; name: string; metric_value: number }[] {
  const out: { id: string; name: string; metric_value: number }[] = [];
  for (const [m, v] of revCy) {
    for (const [n, id] of existing) {
      if (n.endsWith(`-${two(m)}`) && n.includes(String(year))) {
        if (id) out.push({ id, name: n, metric_value: v });
        break;
      }
    }
  }
  return out;
}

/* ── everything the workbook feeds, before HubSpot is touched ──────────── */

export type ErpParsed = { customers: ReadonlyMap<string, Rec>; forecast: ReadonlyMap<string, number>; profitCentres: ReadonlyMap<string, PcPoint> };
export type FoundCompany = { id: string; country?: string | null; sales_priority?: string | null };

export type ErpPlan = {
  month: string;
  upto: string[];
  rows: Map<string, CompanyFigures>;
  totals: CompanyFigures;
  ranks: Ranks;
  /** one input per matched company, in HubSpot's order */
  companies: { un: string; id: string; properties: CompanyValues }[];
  forecastYearTotal: number;
  forecastSuspect: boolean;
  /** the KPI series in the order the connector writes them */
  series: { cat: string; rows: KpiRows }[];
  /** this year's month -> revenue, for the revenue_monthly realign */
  revCy: Map<number, number>;
};

/** Step 1 of the load: the figures per customer (what HubSpot is searched for). */
export function customerPlan(data: ReadonlyMap<string, Rec>): { month: string; upto: string[]; rows: Map<string, CompanyFigures> } {
  const month = latestMonth(data);
  const upto = monthsUpTo(month);
  return { month, upto, rows: companyFigures(data, month, upto) };
}

/** Step 2: with the matched companies, every value the load writes. `today` is yyyy-mm-dd. */
export function planErp(parsed: ErpParsed, found: ReadonlyMap<string, FoundCompany>, today: string): ErpPlan {
  const year = Number(today.slice(0, 4));
  const { month, upto, rows } = customerPlan(parsed.customers);
  const ranks = rankCompanies(rows, found.keys());
  const companies: ErpPlan["companies"] = [];
  for (const [un, c] of found) {
    const r = rows.get(un);
    if (r) companies.push({ un, id: c.id, properties: companyProperties(un, r, ranks, today) });
  }
  const forecastYearTotal = pyRound(pySum(parsed.forecast.values()), 2);
  const revCy = totalsByMonth(parsed.customers, TAG.ytd, upto);
  const oiCy = totalsByMonth(parsed.customers, TAG.oYtd, upto);
  const oiPy = totalsByMonth(parsed.customers, TAG.oYtdPy, upto);
  const series = [
    { cat: "forecast_monthly", rows: forecastRows(parsed.forecast, year) },
    { cat: "oi_erp_monthly", rows: oiErpRows(oiCy, oiPy, year) },
    { cat: "revenue_pc_monthly", rows: profitCentreRows(parsed.profitCentres, year) },
    ...dimensionRows(parsed.customers, dimsOf(found), upto, year),
  ];
  return {
    month, upto, rows, totals: figureTotals(rows), ranks, companies,
    forecastYearTotal, forecastSuspect: forecastYearTotal > FORECAST_SUSPECT_EUR, series, revCy,
  };
}
