// THE REVENUE STEPS' RULES, with no HubSpot in them - ported line for line from the
// Compass connector (service/revenue_load.py, revenue_monthly.py, revenue_kpi.py,
// revenue_history.py, 08.10.2026) so the hub computes every figure the way the
// connector does, to the last bit. The connector runs Python 3.12: its round()
// rounds the EXACT binary value half-to-even and its sum() is compensated
// (Neumaier), and json.loads keeps a blob's keys in file order (a JS object would
// move "100" ahead of "dt" and change the order the floats are added in). All
// three are reproduced here rather than approximated.
//
// tests/connectors-revenue.test.ts holds the rules to it; the I/O is ./revenue.ts.
// Relative imports only: the tests compile without the "@/..." paths.

import { createHash } from "node:crypto";

/* ── Python's arithmetic, exactly ──────────────────────────────────────── */

function incDecimal(digits: string): string {
  const a = digits.split("");
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === "9") { a[i] = "0"; i -= 1; continue; }
    a[i] = String.fromCharCode(a[i].charCodeAt(0) + 1);
    return a.join("");
  }
  return `1${a.join("")}`;
}

/**
 * Python's round(x, nd) on a float: the exact binary value, ties to even, sign kept
 * (round(2.675, 2) = 2.67, round(0.125, 2) = 0.12, round(-0.001, 2) = -0.0).
 */
export function pyRound(x: number, nd = 0): number {
  if (!Number.isFinite(x) || x === 0) return x;
  const ax = Math.abs(x);
  if (ax >= 2 ** 52) return x; // already a whole number
  // fast path: far from a half, the scaled product (error < 1e-5 below 1e11) cannot
  // decide differently from the exact value; k / 10^nd is the nearest double to the
  // decimal, exactly what Python builds from its digits
  const p = 10 ** nd;
  const sc = ax * p;
  if (sc < 1e11) {
    const fl = Math.floor(sc);
    const fr = sc - fl;
    if (Math.abs(fr - 0.5) > 1e-4) {
      const v = (fr > 0.5 ? fl + 1 : fl) / p;
      return x < 0 ? -v : v;
    }
  }
  // toFixed works on the exact value; 100 places hold it exactly for |x| >= 2^-48,
  // and anything smaller is zero at the precisions used here
  const s = ax.toFixed(100);
  const dot = s.indexOf(".");
  const kept = s.slice(0, dot) + s.slice(dot + 1, dot + 1 + nd);
  const rest = s.slice(dot + 1 + nd);
  const d0 = rest.charCodeAt(0) - 48;
  const up = d0 > 5 || (d0 === 5 && (/[1-9]/.test(rest.slice(1)) || (kept.charCodeAt(kept.length - 1) - 48) % 2 === 1));
  const digits = up ? incDecimal(kept) : kept;
  const v = nd > 0 ? Number(`${digits.slice(0, digits.length - nd)}.${digits.slice(digits.length - nd)}`) : Number(digits);
  return x < 0 ? -v : v;
}

/** Python 3.12's sum() of floats: Neumaier-compensated, as CPython does it. Empty = 0. */
export function pySum(xs: Iterable<number>): number {
  let first = true;
  let f = 0;
  let c = 0;
  for (const x of xs) {
    if (first) { f = 0 + x; first = false; continue; }
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x;
    else c += (x - t) + f;
    f = t;
  }
  if (c !== 0 && Number.isFinite(c)) f += c;
  return f;
}

const FLOAT_RE = /^[+-]?(?:\d(?:_?\d)*\.?(?:\d(?:_?\d)*)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/;
const SPECIAL_RE = /^[+-]?(?:inf|infinity|nan)$/i;
const INT_RE = /^[+-]?\d(?:_?\d)*$/;

/** Python's float(v): a number, a bool, or a string Python would accept; null where Python raises. */
export function pyFloat(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (FLOAT_RE.test(s)) return Number(s.replace(/_/g, ""));
  if (SPECIAL_RE.test(s)) return /nan$/i.test(s) ? NaN : s.startsWith("-") ? -Infinity : Infinity;
  return null;
}

/** Python's int(s) on a string; null where Python raises. */
export function pyInt(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return INT_RE.test(s) ? Number(s.replace(/_/g, "")) : null;
}

/** repr() of a Python float, as json.dumps writes it: 99.0, 1e+16, 1.5e-05, -0.0. */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "Infinity";
  if (x === -Infinity) return "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expS] = x.toExponential().split("e"); // shortest digits that round-trip
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

/** A parsed JSON value with objects as Maps, so keys stay in file order. */
export type J = null | boolean | number | string | J[] | Map<string, J>;

/** Python's json.loads: file order kept, NaN/Infinity accepted, anything else invalid throws. */
export function pyJsonLoads(text: string): J {
  let i = 0;
  const n = text.length;
  const NUM = /-?(?:0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?/y;
  const fail = (): never => { throw new SyntaxError(`invalid JSON at ${i}`); };
  const ws = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i += 1;
      else break;
    }
  };
  const str = (): string => {
    i += 1; // opening quote
    let out = "";
    for (;;) {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === 34 || c === 92 || c < 32) break;
        j += 1;
      }
      out += text.slice(i, j);
      i = j;
      if (i >= n) fail();
      const c = text.charCodeAt(i);
      if (c === 34) { i += 1; return out; }
      if (c < 32) fail(); // strict: no raw control characters
      const e = text[i + 1]; // backslash
      i += 2;
      if (e === "u") {
        const h = text.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(h)) fail();
        out += String.fromCharCode(parseInt(h, 16));
        i += 4;
      } else {
        const m = ({ '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" } as Record<string, string>)[e ?? ""];
        if (m === undefined) fail();
        out += m;
      }
    }
  };
  const value = (): J => {
    ws();
    if (i >= n) fail();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const m = new Map<string, J>();
      ws();
      if (text[i] === "}") { i += 1; return m; }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        const k = str();
        ws();
        if (text[i] !== ":") fail();
        i += 1;
        m.set(k, value()); // a repeated key keeps its first place, takes the last value - as in Python
        ws();
        if (text[i] === ",") { i += 1; continue; }
        if (text[i] === "}") { i += 1; return m; }
        fail();
      }
    }
    if (c === "[") {
      i += 1;
      const a: J[] = [];
      ws();
      if (text[i] === "]") { i += 1; return a; }
      for (;;) {
        a.push(value());
        ws();
        if (text[i] === ",") { i += 1; continue; }
        if (text[i] === "]") { i += 1; return a; }
        fail();
      }
    }
    if (c === '"') return str();
    if (text.startsWith("null", i)) { i += 4; return null; }
    if (text.startsWith("true", i)) { i += 4; return true; }
    if (text.startsWith("false", i)) { i += 5; return false; }
    NUM.lastIndex = i;
    const mm = NUM.exec(text);
    if (mm) {
      i = NUM.lastIndex;
      const x = Number(mm[0]);
      return !mm[1] && !mm[2] && x === 0 ? 0 : x; // a Python int has no negative zero
    }
    if (text.startsWith("NaN", i)) { i += 3; return NaN; }
    if (text.startsWith("Infinity", i)) { i += 8; return Infinity; }
    if (text.startsWith("-Infinity", i)) { i += 9; return -Infinity; }
    return fail();
  };
  const out = value();
  ws();
  if (i !== n) fail();
  return out;
}

/* ── shared tables ─────────────────────────────────────────────────────── */

export const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const MON_SET = new Set<string>(MON);
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
/** Profit centres with their own property; everything else (pw, ws, unknown, …) is "other". */
export const MAIN = new Set(["at", "dt", "ft", "kt", "st"]);
export const BUCKETS = ["at", "dt", "ft", "kt", "st", "other"] as const;

const pad2 = (m: number) => String(m).padStart(2, "0");
/** Python's list[i] for i in -12..11. */
const nameAt = (i: number) => MONTH_NAMES[((i % 12) + 12) % 12];
export const monthLabel = (m: number) => `${pad2(m)} ${nameAt(m - 1)}`;
const todayParts = (today: string) => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });

/** The two years the monthly series compare: last year and this one (UTC) - was 2025/2026 in the code. */
export const compareYears = (today: string): [number, number] => {
  const y = todayParts(today).y;
  return [y - 1, y];
};

/* ── countries: two spellings folded to ISO-2, ISO spelled out for charts ─ */

export const NAME2ISO = new Map(Object.entries({
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

export const ISO2NAME = new Map(Object.entries({
  AE: "United Arab Emirates", AL: "Albania", AM: "Armenia", AR: "Argentina", AT: "Austria", AU: "Australia",
  AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BE: "Belgium", BG: "Bulgaria", BR: "Brazil", BY: "Belarus",
  CA: "Canada", CH: "Switzerland", CL: "Chile", CN: "China", CO: "Colombia", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", EG: "Egypt", ES: "Spain", FI: "Finland", FR: "France",
  GB: "United Kingdom", GE: "Georgia", GR: "Greece", HK: "Hong Kong", HR: "Croatia", HU: "Hungary",
  ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland", IT: "Italy", JP: "Japan",
  KR: "South Korea", KZ: "Kazakhstan", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia",
  MA: "Morocco", MC: "Monaco", MD: "Moldova", ME: "Montenegro", MK: "North Macedonia", MT: "Malta",
  MX: "Mexico", MY: "Malaysia", NL: "Netherlands", NO: "Norway", NZ: "New Zealand", PE: "Peru", PL: "Poland",
  PT: "Portugal", RO: "Romania", RS: "Serbia", RU: "Russia", SA: "Saudi Arabia", SE: "Sweden",
  SG: "Singapore", SI: "Slovenia", SK: "Slovakia", TH: "Thailand", TN: "Tunisia", TR: "Turkey", TW: "Taiwan",
  UA: "Ukraine", US: "United States", UZ: "Uzbekistan", VN: "Vietnam", XX: "Unknown", ZA: "South Africa",
}));

export const ENTITY = new Map([["100", "APSOparts AG (CH)"], ["110", "APSOparts GmbH (DE)"]]);

// built at run time: a \p{…} literal would need an ES2018 target in the type check
const ALPHA2 = new RegExp("^\\p{L}{2}$", "u");

/** revenue_monthly._iso: "CH", "ch", "Switzerland" -> "CH"; an unknown name -> its first two letters; empty -> "XX". */
export function countryIso(c: string | null | undefined): string {
  const s = (c ?? "").trim();
  if (ALPHA2.test(s)) return s.toUpperCase();
  const hit = NAME2ISO.get(s.toLowerCase());
  if (hit !== undefined) return hit;
  return s ? Array.from(s.toUpperCase()).slice(0, 2).join("") : "XX";
}

export const countryName = (code: string): string => ISO2NAME.get(code) ?? code;

/* ── the rollup file -> each company's revenue stack (revenue_load) ────── */

export type RollupRow = Record<string, string | null | undefined>;
/** profit centre -> amount, in the order the file first named them */
export type Pcs = Map<string, number>;
/** year -> month -> profit centre -> amount */
export type CustomerYears = Map<number, Map<number, Pcs>>;
/** `oi` false: order intake is still checked line by line, but not kept (OI_FROM_CSV off - half the memory). */
export type Rollup = { rows: number; oi: boolean; agg: Map<string, CustomerYears>; oagg: Map<string, CustomerYears> };

export const newRollup = (oi = true): Rollup => ({ rows: 0, oi, agg: new Map(), oagg: new Map() });

function bump(root: Map<string, CustomerYears>, un: string, y: number, mo: number, pc: string, v: number) {
  let ys = root.get(un);
  if (!ys) { ys = new Map(); root.set(un, ys); }
  let ms = ys.get(y);
  if (!ms) { ms = new Map(); ys.set(y, ms); }
  let pcs = ms.get(mo);
  if (!pcs) { pcs = new Map(); ms.set(mo, pcs); }
  pcs.set(pc, (pcs.get(pc) ?? 0) + v);
}

/**
 * One line of revenue_oi_rollup.csv. Mandant 100/110 only; a line without a customer
 * key, a month 1-12, or a readable year/month/amount is passed over. A present but
 * unreadable OI_NetRevenueEUR stops the load, as it stops the connector.
 */
export function addRollupRow(acc: Rollup, r: RollupRow, record?: number): void {
  const company = (r.CompanyNumber || "").trim();
  if (company !== "100" && company !== "110") return;
  const un = (r.CustomerNumberUnique || "").trim();
  const y = pyInt(r.InvoiceYear);
  const mo = y === null ? null : pyInt(r.InvoiceMonth);
  const v = mo === null ? null : pyFloat(r.NetRevenueEUR ?? null);
  if (y === null || mo === null || v === null) return;
  if (!un || !(mo >= 1 && mo <= 12)) return;
  const oiRaw = r.OI_NetRevenueEUR;
  const oi = oiRaw ? pyFloat(oiRaw) : 0;
  if (oi === null) throw new Error(`OI_NetRevenueEUR is not a number (${JSON.stringify(oiRaw).slice(0, 40)})${record ? ` in record ${record}` : ""}`);
  const pc = (r.ProfitCenter || "unknown").trim().toLowerCase();
  bump(acc.agg, un, y, mo, pc, v);
  if (acc.oi) bump(acc.oagg, un, y, mo, pc, oi);
  acc.rows += 1;
}

export type RevenueProps = Record<string, number | string>;

/** json.dumps({"jan": {"dt": 1234.5, …}, …}, ensure_ascii=False) - byte for byte. */
export function pcMonthlyJson(jm: [string, [string, number][]][]): string {
  const obj = (entries: string[]) => `{${entries.join(", ")}}`;
  return obj(jm.map(([mk, pcs]) => `${JSON.stringify(mk)}: ${obj(pcs.map(([pc, v]) => `${JSON.stringify(pc)}: ${pyFloatRepr(v)}`))}`));
}

/**
 * Every property one customer's years give its company: rev_<y>_<mon>, …_pc_<bucket>,
 * the four quarters (+ per bucket), rev_<y>_pc_monthly, revenue_<y>; oi_<y>_<mon> and
 * oi_<y> only with OI_FROM_CSV (off: the ERP workbook owns order intake).
 */
export function revenueProps(years: CustomerYears, oyears: CustomerYears | undefined, oiFromCsv: boolean): RevenueProps {
  const props: RevenueProps = {};
  for (const [y, months] of years) {
    const jm: [string, [string, number][]][] = [];
    let ytot = 0;
    const qtot = new Map<number, number>();
    const qpc = new Map<number, Map<string, number>>();
    for (const [mo, pcs] of months) {
      const mk = MON[mo - 1];
      const q = Math.floor((mo - 1) / 3) + 1;
      jm.push([mk, [...pcs].map(([pc, v]) => [pc, pyRound(v, 2)] as [string, number])]);
      const mtot = pySum(pcs.values());
      ytot += mtot;
      qtot.set(q, (qtot.get(q) ?? 0) + mtot);
      props[`rev_${y}_${mk}`] = pyRound(mtot, 2);
      const bt = new Map<string, number>();
      for (const [pc, v] of pcs) {
        const b = MAIN.has(pc) ? pc : "other";
        bt.set(b, (bt.get(b) ?? 0) + v);
      }
      let qm = qpc.get(q);
      if (!qm) { qm = new Map(); qpc.set(q, qm); }
      for (const [b2, v] of bt) {
        props[`rev_${y}_${mk}_pc_${b2}`] = pyRound(v, 2);
        qm.set(b2, (qm.get(b2) ?? 0) + v);
      }
    }
    for (let q = 1; q <= 4; q++) {
      props[`rev_${y}_q${q}`] = pyRound(qtot.get(q) ?? 0, 2);
      for (const b2 of BUCKETS) props[`rev_${y}_q${q}_pc_${b2}`] = pyRound(qpc.get(q)?.get(b2) ?? 0, 2);
    }
    props[`rev_${y}_pc_monthly`] = pcMonthlyJson(jm);
    props[`revenue_${y}`] = pyRound(ytot, 2);
    if (oiFromCsv) {
      const om = oyears?.get(y);
      if (om && om.size) {
        let oytot = 0;
        for (const [mo, pcs] of om) {
          const mtot = pySum(pcs.values());
          oytot += mtot;
          props[`oi_${y}_${MON[mo - 1]}`] = pyRound(mtot, 2);
        }
        props[`oi_${y}`] = pyRound(oytot, 2);
      }
    }
  }
  return props;
}

/** A customer's whole revenue in the file, for the review queue. */
export function customerTotal(years: CustomerYears): number {
  function* all() {
    for (const ms of years.values()) for (const pcs of ms.values()) yield* pcs.values();
  }
  return pyRound(pySum(all()), 2);
}

/* ── which properties may be written ───────────────────────────────────── */

export type PropDef = { name: string; calculated?: boolean; fieldType?: string; modificationMetadata?: { readOnlyValue?: boolean } };
export type PropRules = { known: Set<string>; readOnly: Set<string> };

/** From the portal's own definitions: what exists, and what is a calculation (or read-only) HubSpot keeps itself. */
export function propRules(defs: PropDef[]): PropRules {
  const known = new Set<string>();
  const readOnly = new Set<string>();
  for (const d of defs) {
    known.add(d.name);
    if (d.calculated === true || (d.fieldType ?? "").startsWith("calculation") || d.modificationMetadata?.readOnlyValue === true) readOnly.add(d.name);
  }
  return { known, readOnly };
}

export type Skipped = { calculated: Set<string>; unknown: Set<string> };

/** The properties that can be written: calculated and non-existent ones are left out and named. */
export function writableProps(props: RevenueProps, rules: PropRules | null, skipped: Skipped): RevenueProps {
  if (!rules) return props;
  const out: RevenueProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (rules.readOnly.has(k)) { skipped.calculated.add(k); continue; }
    if (!rules.known.has(k)) { skipped.unknown.add(k); continue; }
    out[k] = v;
  }
  return out;
}

/** The change hash: the same properties with the same values hash the same, whatever their order. */
export function propsHash(props: RevenueProps): string {
  const keys = Object.keys(props).sort();
  return createHash("md5").update(JSON.stringify(keys.map((k) => [k, props[k]]))).digest("hex");
}

/* ── customer key -> company, and the review queue ─────────────────────── */

export type QueueItem = {
  type?: string; un?: string; status?: string; revenue_eur?: number; years?: (string | number)[];
  ts?: number; note?: string; resolved_un?: string | null; [k: string]: unknown;
};
export type Unmatched = { type: "revenue"; un: string; revenue_eur: number; years: number[] };

/** A person's resolutions: customer key -> the key it really is. */
export function aliasMap(queue: QueueItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of queue) if (i.status === "resolved" && i.resolved_un && i.un !== undefined) m.set(String(i.un), String(i.resolved_un));
  return m;
}

/** Keys (after the resolutions) the map does not know - to be asked of HubSpot live, once each. */
export function keysToLookUp(roll: Rollup, alias: Map<string, string>, map: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const un of roll.agg.keys()) {
    const key = alias.get(un) ?? un;
    if (!map.has(key)) out.add(key);
  }
  return [...out];
}

export type RevenuePlan = {
  /** company id -> what to write; a company two keys point at gets the later one, as in the connector */
  ups: Map<string, { un: string; props: RevenueProps; hash: string }>;
  unmatched: Unmatched[];
  unchanged: number;
  /** companies more than one customer key points at */
  shared: number;
  skipped: Skipped;
};

/** Customer by customer: its company, its properties, and whether they changed since the last good write. */
export function planRevenueWrites(
  roll: Rollup, alias: Map<string, string>, map: Map<string, string>, oiFromCsv: boolean,
  rules: PropRules | null, stored: Map<string, string>,
): RevenuePlan {
  const ups: RevenuePlan["ups"] = new Map();
  const unmatched: Unmatched[] = [];
  const skipped: Skipped = { calculated: new Set(), unknown: new Set() };
  const runHash = new Map<string, string>();
  const keysOf = new Map<string, number>();
  let unchanged = 0;
  for (const [un, years] of roll.agg) {
    const cid = map.get(alias.get(un) ?? un);
    if (!cid) {
      unmatched.push({ type: "revenue", un, revenue_eur: customerTotal(years), years: [...years.keys()].sort((a, b) => a - b) });
      continue;
    }
    keysOf.set(cid, (keysOf.get(cid) ?? 0) + 1);
    const props = writableProps(revenueProps(years, roll.oagg.get(un), oiFromCsv), rules, skipped);
    const h = propsHash(props);
    if ((runHash.get(cid) ?? stored.get(cid)) === h) { unchanged += 1; continue; }
    runHash.set(cid, h);
    ups.set(cid, { un, props, hash: h });
  }
  return { ups, unmatched, unchanged, shared: [...keysOf.values()].filter((n) => n > 1).length, skipped };
}

/**
 * Hold the unmatched in the queue, as the connector does: a new key is added
 * "pending"; one a person had resolved comes back "pending" - the resolution did not
 * lead to a HubSpot company; one already pending (or anything else) is left alone.
 */
export function mergeReviewQueue(queue: QueueItem[], unmatched: Unmatched[], nowS: number): { queue: QueueItem[]; added: number; resurfaced: number } {
  const q = queue.map((i) => ({ ...i }));
  const byUn = new Map<unknown, QueueItem>();
  for (const i of q) byUn.set(i.un, i);
  let added = 0, resurfaced = 0;
  for (const u of unmatched) {
    const ex = byUn.get(u.un);
    if (ex === undefined) {
      q.push({ ...u, status: "pending", ts: nowS });
      added += 1;
    } else if (ex.status === "resolved") {
      ex.status = "pending";
      ex.note = `resolution '${ex.resolved_un === undefined ? "" : ex.resolved_un === null ? "None" : ex.resolved_un}' not found in HubSpot`;
      ex.ts = nowS;
      resurfaced += 1;
    }
  }
  return { queue: q, added, resurfaced };
}

/* ── the company-wide monthly figures (revenue_monthly) ────────────────── */

type Blobs = Record<string, string | null | undefined>;
type GeoCell = { mandant: string; country: string; year: number; mon: string; v: number };
export type MonthlyAcc = {
  years: number[]; scanned: number; parsed: number;
  tot: Map<number, Map<string, number>>; pc: Map<number, Map<string, number>>; geo: Map<string, GeoCell>;
};

export const newMonthlyAcc = (years: number[]): MonthlyAcc => ({
  years, scanned: 0, parsed: 0,
  tot: new Map(years.map((y) => [y, new Map()])), pc: new Map(years.map((y) => [y, new Map()])), geo: new Map(),
});

const addTo = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/** One company's rev_<y>_pc_monthly blobs into the totals, by profit centre, and by mandant x country. */
export function addMonthlyCompany(acc: MonthlyAcc, p: Blobs): void {
  acc.scanned += 1;
  const un = (p.company_unique_number || "").trim();
  const mandant = un.includes("-") ? un.split("-")[0] : "?";
  const iso = countryIso(p.country);
  for (const y of acc.years) {
    const raw = p[`rev_${y}_pc_monthly`];
    if (!raw || raw === "{}") continue;
    let blob: J;
    try { blob = pyJsonLoads(raw); } catch { continue; }
    acc.parsed += 1;
    if (!(blob instanceof Map)) continue; // the connector would stop on it
    for (const [mon, by] of blob) {
      if (!(by instanceof Map)) continue;
      const m3 = mon.toLowerCase().slice(0, 3);
      if (!MON_SET.has(m3)) continue; // the connector would stop on it (MONTHS.index)
      for (const [centre, rv] of by) {
        const v = pyFloat(rv);
        if (v === null) continue;
        addTo(acc.tot.get(y)!, m3, v);
        addTo(acc.pc.get(y)!, centre, v);
        const k = `${mandant}\u0000${iso}\u0000${y}\u0000${m3}`;
        const g = acc.geo.get(k);
        if (g) g.v += v;
        else acc.geo.set(k, { mandant, country: iso, year: y, mon: m3, v: 0 + v });
      }
    }
  }
}

export type GeoRow = { mandant: string; entity: string; country: string; country_name: string; year: number; month: number; value: number };
export type MonthlyDoc = {
  generated: string; as_of: string; scanned: number; blobs: number;
  months: string[]; month_names: string[];
  series: Record<string, number[]>;
  by_profit_centre: Record<string, Record<string, number>>;
  /** months finished in every year compared: the only fair comparison */
  complete_months: number;
  currency: "EUR";
  geo: GeoRow[];
  like_for_like: { months: number; prev: number; cur: number; pct: number | null };
};

export function finishMonthly(acc: MonthlyAcc, today: string, generated: string): MonthlyDoc {
  const { m } = todayParts(today);
  const series: Record<string, number[]> = {};
  const byPc: Record<string, Record<string, number>> = {};
  for (const y of acc.years) {
    series[String(y)] = MON.map((mk) => pyRound(acc.tot.get(y)!.get(mk) ?? 0, 2));
    byPc[String(y)] = Object.fromEntries(acc.pc.get(y)!);
  }
  const geo: GeoRow[] = [];
  for (const g of acc.geo.values()) {
    if (!(Math.abs(g.v) >= 0.005)) continue;
    geo.push({
      mandant: g.mandant, entity: ENTITY.get(g.mandant) ?? g.mandant, country: g.country, country_name: countryName(g.country),
      year: g.year, month: MON.indexOf(g.mon as (typeof MON)[number]) + 1, value: pyRound(g.v, 2),
    });
  }
  const n = m - 1;
  const a = series[String(Math.min(...acc.years))].slice(0, n);
  const b = series[String(Math.max(...acc.years))].slice(0, n);
  const sa = pySum(a), sb = pySum(b);
  return {
    generated, as_of: today, scanned: acc.scanned, blobs: acc.parsed,
    months: [...MON], month_names: [...MONTH_NAMES],
    series, by_profit_centre: byPc, complete_months: n, currency: "EUR", geo,
    like_for_like: { months: n, prev: pyRound(sa, 2), cur: pyRound(sb, 2), pct: sa ? pyRound((100.0 * (sb - sa)) / sa, 1) : null },
  };
}

/* ── the KPI object's rows (revenue_kpi) ───────────────────────────────── */

export const KPI_OBJECT = "2-201387076";
export const CAT = {
  monthly: "revenue_monthly", oi: "oi_monthly", geo: "revenue_geo_monthly",
  deltaMonth: "revenue_delta_monthly", deltaCountry: "revenue_delta_country",
} as const;
const METRIC = "revenue_sum";
const OI_METRIC = "order_intake_sum";
const DELTA_METRIC = "revenue_delta_sum";

export type KpiProps = Record<string, string | number>;
export type KpiRow = { name: string; props: KpiProps };

/** "yes" when the month is finished in both years compared - a report filtered on it compares like for like. */
export const comparable = (month: number, complete: number): "yes" | "no" => (month <= complete ? "yes" : "no");

/** Python's `x or 0` for a number. */
const or0 = (x: number | null | undefined) => (x === null || x === undefined || x === 0 ? 0 : x);

/** revenue_monthly|<y>-<mm>: the series, one row per year and month. */
export function revenueMonthlyRows(doc: Pick<MonthlyDoc, "series" | "complete_months">): KpiRow[] {
  const rows: KpiRow[] = [];
  const complete = doc.complete_months || 12; // as the connector: none complete reads as all (see the report)
  for (const [year, series] of Object.entries(doc.series)) {
    const y = Number(year);
    series.forEach((amount, i) => {
      const m = i + 1;
      const name = `${CAT.monthly}|${y}-${pad2(m)}`;
      rows.push({ name, props: {
        name, kpi_category: CAT.monthly, metric_name: METRIC, metric_value: pyRound(or0(amount), 2),
        snapshot_date: `${y}-${pad2(m)}-01`, kpi_year: y, kpi_month_label: monthLabel(m), kpi_comparable: comparable(m, complete),
      } });
    });
  }
  return rows;
}

/** _oi_from_erp: the oi_erp_monthly rows the ERP load writes, as {year: [12 months]}; null when there are none. */
export function oiSeriesFromErp(rows: Record<string, string | null | undefined>[]): Record<string, number[]> | null {
  const out: Record<string, number[]> = {};
  let any = false;
  for (const p of rows) {
    const yf = pyFloat(p.kpi_year ?? null);
    if (yf === null || !Number.isFinite(yf)) continue;
    const m = pyInt(String(p.kpi_month_label ?? "None").slice(0, 2));
    if (m === null || m < 1 || m > 12) continue;
    const y = String(Math.trunc(yf));
    const v = p.metric_value ? pyFloat(p.metric_value) : 0;
    if (v === null) continue;
    (out[y] ??= new Array<number>(12).fill(0))[m - 1] = v;
    any = true;
  }
  return any ? out : null;
}

/** oi_monthly|<y>-<mm>: order intake as the ERP states it; comparable = finished this year. */
export function oiMonthlyRows(series: Record<string, number[]>, today: string): KpiRow[] {
  const complete = todayParts(today).m - 1;
  const rows: KpiRow[] = [];
  for (const [year, months] of Object.entries(series)) {
    const y = Number(year);
    months.forEach((amount, i) => {
      const m = i + 1;
      const name = `${CAT.oi}|${y}-${pad2(m)}`;
      rows.push({ name, props: {
        name, kpi_category: CAT.oi, metric_name: OI_METRIC, metric_value: pyRound(or0(amount), 2),
        snapshot_date: `${y}-${pad2(m)}-01`, kpi_year: y, kpi_month_label: monthLabel(m), kpi_comparable: comparable(m, complete),
      } });
    });
  }
  return rows;
}

/** revenue_geo|<mandant>|<ISO>|<y>-<mm>: selling entity x country x month. */
export function geoMonthlyRows(doc: Pick<MonthlyDoc, "geo" | "complete_months">): KpiRow[] {
  const complete = doc.complete_months || 12;
  return (doc.geo ?? []).map((r) => {
    const y = r.year, m = r.month;
    const name = `revenue_geo|${r.mandant}|${r.country}|${y}-${pad2(m)}`;
    return { name, props: {
      name, kpi_category: CAT.geo, metric_name: METRIC, metric_value: pyRound(or0(r.value), 2),
      snapshot_date: `${y}-${pad2(m)}-01`, kpi_year: y, kpi_month_label: monthLabel(m),
      kpi_country: r.country_name || r.country, kpi_entity: r.entity, kpi_comparable: comparable(m, complete),
    } };
  });
}

/**
 * The delta against last year, by month and by country - finished months only. `months`
 * 0 (January) means there is nothing to compare yet: the hub then writes and ARCHIVES
 * nothing, where the connector archived every row.
 */
export function deltaRows(doc: Pick<MonthlyDoc, "series" | "geo" | "complete_months">, today: string): { months: number; byMonth: KpiRow[]; byCountry: KpiRow[] | null } {
  const years = Object.keys(doc.series).map(Number).sort((a, b) => a - b);
  const curY = years[years.length - 1], prevY = years[years.length - 2];
  const complete = doc.complete_months || todayParts(today).m - 1;
  const cur = doc.series[String(curY)], prev = doc.series[String(prevY)];
  const byMonth: KpiRow[] = [];
  for (let i = 0; i < Math.min(complete, 12); i++) {
    const m = i + 1;
    const name = `revenue_delta|${curY}-${pad2(m)}`;
    byMonth.push({ name, props: {
      name, kpi_category: CAT.deltaMonth, metric_name: DELTA_METRIC, metric_value: pyRound(Number(cur[i]) - Number(prev[i]), 2),
      snapshot_date: `${curY}-${pad2(m)}-01`, kpi_year: curY, kpi_month_label: monthLabel(m),
    } });
  }
  let byCountry: KpiRow[] | null = null;
  if (doc.geo && doc.geo.length) {
    const cCur = new Map<string, number>(), cPrev = new Map<string, number>();
    for (const r of doc.geo) {
      if (Math.trunc(r.month) > complete) continue;
      addTo(Math.trunc(r.year) === curY ? cCur : cPrev, r.country, Number(r.value));
    }
    byCountry = [];
    for (const country of [...new Set([...cCur.keys(), ...cPrev.keys()])].sort()) {
      const delta = pyRound((cCur.get(country) ?? 0) - (cPrev.get(country) ?? 0), 2);
      if (pyRound(delta, 0) === 0) continue;
      const name = `revenue_delta_country|${country}`;
      byCountry.push({ name, props: {
        name, kpi_category: CAT.deltaCountry, metric_name: DELTA_METRIC, metric_value: delta,
        snapshot_date: `${curY}-01-01`, kpi_year: curY, kpi_country: countryName(country),
        kpi_month_label: `Jan-${nameAt(complete - 1).slice(0, 3)}`,
      } });
    }
  }
  return { months: complete, byMonth, byCountry };
}

/** Upsert by name: what to create, what to update, and - for a series that sweeps - what to archive. */
export function kpiPlan(existing: Map<string, string>, rows: KpiRow[], sweep: boolean): { create: KpiRow[]; update: { id: string; row: KpiRow }[]; archive: string[] } {
  const create: KpiRow[] = [];
  const update: { id: string; row: KpiRow }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.name);
    const id = existing.get(row.name);
    if (id) update.push({ id, row });
    else create.push(row);
  }
  const archive = sweep ? [...existing].filter(([nm]) => !seen.has(nm)).map(([, id]) => id) : [];
  return { create, update, archive };
}

/* ── twelve years and the customer cohorts (revenue_history) ───────────── */

export const FIRST_YEAR = 2015;
export const GAP_MONTHS = 13; // silence that makes the next order a reactivation
export const YTD_LABEL = "00 YTD";
export const FULL_LABEL = "13 Full year";
export const TOP_LABEL = "01 Top line";
export const PC_LABEL = new Map(Object.entries({
  dt: "Sealing Technology", kt: "Engineering Plastics", ft: "Fluid Technology", st: "Antivibration Technology",
  at: "Drive Technology", sp: "Sensors & Power", pw: "Sensors & Power", ws: "WS", asw: "ASW", other: "Other", unknown: "Unknown",
}));

export function pcLabel(code: string | null | undefined): string {
  const c = (code ?? "").toLowerCase();
  return `${PC_LABEL.get(c) ?? c.toUpperCase()} (${c.toUpperCase()})`;
}

export const historyYears = (today: string): number[] => {
  const out: number[] = [];
  for (let y = FIRST_YEAR; y <= todayParts(today).y; y++) out.push(y);
  return out;
};

type Cell<K> = K & { v: number };
export type HistoryAcc = {
  years: number[]; ty: number; tm: number; seen: number; withblob: number;
  byYear: Map<number, number>; byWindow: Map<number, number>;
  byPcYear: Map<string, Cell<{ pc: string; y: number }>>;
  byGeoPc: Map<string, Cell<{ iso: string; pc: string; y: number }>>;
  newcustRev: Map<string, Cell<{ y: number; mi: number }>>;
  neu: Map<string, { y: number; m0: number; n: number }>;
  react: Map<string, { y: number; m0: number; n: number }>;
};

export function newHistoryAcc(years: number[], today: string): HistoryAcc {
  const { y, m } = todayParts(today);
  return {
    years, ty: y, tm: m, seen: 0, withblob: 0, byYear: new Map(), byWindow: new Map(),
    byPcYear: new Map(), byGeoPc: new Map(), newcustRev: new Map(), neu: new Map(), react: new Map(),
  };
}

function addCell<K extends object>(m: Map<string, Cell<K>>, key: string, base: K, v: number) {
  const c = m.get(key);
  if (c) c.v += v;
  else m.set(key, { ...base, v: 0 + v });
}

function count(m: Map<string, { y: number; m0: number; n: number }>, y: number, m0: number) {
  const k = `${y}|${m0}`;
  const c = m.get(k);
  if (c) c.n += 1;
  else m.set(k, { y, m0, n: 1 });
}

/** int(float(compass_first_order_year or 0)), 0 where Python gives up. */
function firstOrderYear(raw: string | null | undefined): number {
  if (!raw) return 0;
  const f = pyFloat(raw);
  return f === null || !Number.isFinite(f) ? 0 : Math.trunc(f) || 0;
}

/** One company: its years of blobs into the year, window, profit-centre and country sums, and its cohort months. */
export function addHistoryCompany(acc: HistoryAcc, p: Blobs): void {
  acc.seen += 1;
  const iso = countryIso(p.country);
  const firstYear = firstOrderYear(p.compass_first_order_year);
  const recent = (y: number) => y === acc.ty || y === acc.ty - 1;
  const active = new Set<number>(); // year*12 + month index, months with revenue
  let touched = false;
  for (const y of acc.years) {
    const raw = p[`rev_${y}_pc_monthly`];
    if (!raw) continue;
    let d: J;
    try { d = pyJsonLoads(raw); } catch { continue; }
    touched = true;
    if (!(d instanceof Map)) continue; // the connector would stop on it
    for (const [mkey, split] of d) {
      const m = mkey.toLowerCase().slice(0, 3);
      if (!MON_SET.has(m) || !(split instanceof Map)) continue;
      const mi = MON.indexOf(m as (typeof MON)[number]) + 1;
      let monthTotal = 0;
      for (const [pc, rv] of split) {
        if (typeof rv !== "number" && typeof rv !== "boolean") continue; // isinstance(v, (int, float)) - a bool is an int
        const v = typeof rv === "boolean" ? (rv ? 1 : 0) : rv;
        monthTotal += v;
        acc.byYear.set(y, (acc.byYear.get(y) ?? 0) + v);
        if (mi <= acc.tm) acc.byWindow.set(y, (acc.byWindow.get(y) ?? 0) + v);
        const pcl = pc.toLowerCase();
        addCell(acc.byPcYear, `${pcl}\u0000${y}`, { pc: pcl, y }, v);
        if (recent(y) && mi <= acc.tm - 1) addCell(acc.byGeoPc, `${iso}\u0000${pcl}\u0000${y}`, { iso, pc: pcl, y }, v);
        if (firstYear === y && recent(y) && mi <= acc.tm) addCell(acc.newcustRev, `${y}\u0000${mi}`, { y, mi }, v);
      }
      if (monthTotal > 0) active.add(y * 12 + (mi - 1));
    }
  }
  if (touched) acc.withblob += 1;
  // cohorts: this company's active months in order
  const order = [...active].sort((a, b) => a - b);
  order.forEach((mth, i) => {
    const y = Math.floor(mth / 12);
    if (!recent(y)) return;
    const m0 = mth % 12;
    if (i === 0) {
      // nothing earlier in the window: new only if the ERP agrees it started this
      // year, otherwise a long-dormant customer
      if (firstYear && firstYear < y) count(acc.react, y, m0);
      else count(acc.neu, y, m0);
    } else if (mth - order[i - 1] >= GAP_MONTHS) count(acc.react, y, m0);
  });
}

/** _erp_current_year: the running year as the ERP rows state it; null when unreadable or nothing. */
export function erpYearTotal(values: (string | null | undefined)[]): number | null {
  const xs: number[] = [];
  for (const v of values) {
    const f = pyFloat(v ?? null);
    if (f === null) return null;
    xs.push(f);
  }
  const t = pySum(xs);
  return t !== 0 && Number.isFinite(t) ? t : null;
}

export type HistoryCategory = { cat: string; sweep: boolean; rows: KpiRow[] };
export type HistoryPlan = { erpAlignment?: { blobs: number; erp: number }; categories: HistoryCategory[] };

/** The six series. A label never holds a date: the window lives in kpi_window, the running month is "MTD". */
export function historyRows(acc: HistoryAcc, erp: number | null): HistoryPlan {
  const ty = acc.ty, cut = acc.tm;
  const byYear = new Map(acc.byYear), byWindow = new Map(acc.byWindow);
  const windowLabel = `Jan-${nameAt(cut - 1).slice(0, 3)}`;
  const plan: HistoryPlan = { categories: [] };
  if (erp) {
    plan.erpAlignment = { blobs: pyRound(byYear.get(ty) ?? 0, 2), erp: pyRound(erp, 2) };
    byYear.set(ty, erp);
    byWindow.set(ty, erp);
  }
  const base = (name: string, cat: string, v: number) => ({ name, kpi_category: cat, metric_name: METRIC, metric_value: pyRound(v, 2) });

  const year: KpiRow[] = [];
  for (const y of acc.years) {
    const full = byYear.get(y) ?? 0, win = byWindow.get(y) ?? 0;
    if (full !== 0) {
      const name = `revyear|full|${y}`;
      year.push({ name, props: { ...base(name, "revenue_year", full), snapshot_date: `${y}-12-01`, kpi_year: y, kpi_month_label: FULL_LABEL, kpi_comparable: y === ty ? "no" : "yes" } });
    }
    if (win !== 0) {
      const name = `revyear|ytd|${y}`;
      year.push({ name, props: { ...base(name, "revenue_year", win), snapshot_date: `${y}-01-01`, kpi_year: y, kpi_month_label: YTD_LABEL, kpi_window: windowLabel + (y === ty ? " (partial)" : ""), kpi_comparable: "yes" } });
    }
    // every finished year at its full size, the running year at what it has booked
    const v = y === ty ? win : full;
    if (v !== 0) {
      const name = `revyear|top|${y}`;
      year.push({ name, props: { ...base(name, "revenue_year", v), snapshot_date: `${y}-06-01`, kpi_year: y, kpi_month_label: TOP_LABEL, kpi_window: y === ty ? windowLabel : "Full year", kpi_comparable: "yes" } });
    }
  }
  plan.categories.push({ cat: "revenue_year", sweep: true, rows: year });

  const pcYear: KpiRow[] = [];
  for (const { pc, y, v } of acc.byPcYear.values()) {
    if (v === 0) continue;
    const name = `revpcyear|${pc}|${y}`;
    pcYear.push({ name, props: { ...base(name, "revenue_pc_year", v), snapshot_date: `${y}-12-01`, kpi_year: y, kpi_month_label: FULL_LABEL, kpi_profit_center: pcLabel(pc), kpi_comparable: y === ty ? "no" : "yes" } });
  }
  plan.categories.push({ cat: "revenue_pc_year", sweep: false, rows: pcYear });

  const geoPc: KpiRow[] = [];
  for (const { iso, pc, y, v } of acc.byGeoPc.values()) {
    if (v === 0) continue;
    const name = `revgeopc|${iso}|${pc}|${y}`;
    geoPc.push({ name, props: {
      ...base(name, "revenue_geo_pc_yearly", v), snapshot_date: `${y}-01-01`, kpi_year: y, kpi_month_label: YTD_LABEL,
      kpi_window: `Jan-${nameAt(cut - 2).slice(0, 3)}`, kpi_country: countryName(iso), kpi_profit_center: pcLabel(pc), kpi_comparable: "yes",
    } });
  }
  plan.categories.push({ cat: "revenue_geo_pc_yearly", sweep: false, rows: geoPc });

  // the year's own new customers, month by month, both years cut at the same month
  const ncRev: KpiRow[] = [];
  for (const { y, mi, v } of acc.newcustRev.values()) {
    if (v === 0) continue;
    const name = `newcustrev|${y}-${pad2(mi)}`;
    ncRev.push({ name, props: {
      ...base(name, "newcust_revenue_monthly", v), snapshot_date: `${y}-${pad2(mi)}-01`, kpi_year: y, kpi_month_label: monthLabel(mi),
      kpi_window: `customers first acquired in ${y}`, kpi_period: mi === cut ? "MTD" : "past",
      kpi_comparable: y === ty && mi === cut ? "no" : "yes",
    } });
  }
  plan.categories.push({ cat: "newcust_revenue_monthly", sweep: true, rows: ncRev });

  for (const [key, cat, prefix, metric] of [
    ["neu", "newcust_monthly", "newcust", "new_customers_count"],
    ["react", "reactivated_monthly", "react", "reactivated_customers_count"],
  ] as const) {
    const rows: KpiRow[] = [];
    for (const { y, m0, n } of acc[key].values()) {
      const name = `${prefix}|${y}-${pad2(m0 + 1)}`;
      rows.push({ name, props: {
        name, kpi_category: cat, metric_name: metric, metric_value: n, snapshot_date: `${y}-${pad2(m0 + 1)}-01`,
        kpi_year: y, kpi_month_label: monthLabel(m0 + 1), kpi_comparable: y === ty && m0 + 1 === cut ? "no" : "yes",
      } });
    }
    plan.categories.push({ cat, sweep: false, rows });
  }
  return plan;
}
