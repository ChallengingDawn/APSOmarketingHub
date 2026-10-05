// SMART SEGMENTATION - the rules, with no HubSpot in them.
//
// Ported line for line from the Compass connector's segmentation_load.py
// (05.10.2026) so the hub and the connector decide every company the same way;
// tests/segmentation.test.ts and a side-by-side run on live companies hold
// the two together. The I/O lives in src/lib/integrations/segmentation.ts.
//
// CEO formula (verified, do not change without CEO sign-off):
//     basis = MAX(yearly_customer_potential, MAX(revenue_2015..revenue_2026))
//     >=25000 -> Prio 1 | >=2500 -> Prio 2 | >=500 -> Prio 3 | else "4- No priority"
// Guard rails: a potential above 1'000'000 AND 20x the best revenue year is
// ignored for the basis (merge-polluted values) - reported, never touched;
// the sweep never downgrades; max_* are facts, always synced when changed.

export type Props = Record<string, string | null | undefined>;

export const FIRST_REV_YEAR = 2015;
/** revenue_2015 .. revenue_<this year>: the connector's REV list ran to 2026; it grows with the calendar here. */
export const revProps = (curYear: number) => Array.from({ length: Math.max(2026, curYear) - FIRST_REV_YEAR + 1 }, (_, i) => `revenue_${FIRST_REV_YEAR + i}`);

export const READ_PROPS_BASE = [
  "name", "sales_priority", "yearly_customer_potential", "max_pot_or_turnover", "max_revenue_2015_2026",
  "max_revenue_bucket", "createdate", "apic_ap", "apso_customer", "industry", "description", "hs_keywords",
];

export const INDUSTRY_TO_APIC_CODE: Record<string, string> = {
  PHARMACEUTICALS: "1.9", MEDICAL_DEVICES: "1.9.2", HOSPITAL_HEALTH_CARE: "1.9",
  CHEMICALS: "1.11", AUTOMOTIVE: "1.3", FOOD_PRODUCTION: "1.1.2",
  MACHINERY: "1.1", MECHANICAL_OR_INDUSTRIAL_ENGINEERING: "4.1",
  ELECTRICAL_ELECTRONIC_MANUFACTURING: "1.12", INDUSTRIAL_AUTOMATION: "1.12.4",
  CONSTRUCTION: "1.8", WHOLESALE: "3.3", AVIATION_AEROSPACE: "1.5",
  RENEWABLES_ENVIRONMENT: "1.7", PACKAGING_AND_CONTAINERS: "1.1.8",
  MINING_METALS: "1.8.2", RESEARCH: "2.8", FARMING: "1.3.3",
};

/** name/description keywords (DE/FR/IT/EN), specific before generic, first match wins. */
export const KEYWORD_RULES: [string[], string, string | null][] = [
  [["pharma"], "1.9", "PHARMACEUTICALS"],
  [["medizin", "medical", "medicale", "diagnost", "medtech"], "1.9.2", "MEDICAL_DEVICES"],
  [["chemie", "chemical", "chimie", "chimic"], "1.11", "CHEMICALS"],
  [["pumpe", "pump", "pompe", "pompa"], "1.10", "MACHINERY"],
  [["ventil", "valve", "vanne", "valvol", "armatur"], "1.10", "MACHINERY"],
  [["verpack", "packaging", "emball", "imball"], "1.1.8", "PACKAGING_AND_CONTAINERS"],
  [["automobil", "automotive", "fahrzeug", "veicol"], "1.3", "AUTOMOTIVE"],
  [["agrar", "landwirtschaft", "agricol", "farming", "traktor", "tracteur"], "1.3.3", "FARMING"],
  [["luftfahrt", "aerospace", "aviation", "aeronautic", "aeronautiq"], "1.5", "AVIATION_AEROSPACE"],
  [["eisenbahn", "railway", "ferrovia"], "1.4", null],
  [["werft", "shipyard", "navale", "nautic"], "1.6", null],
  [["solar", "photovolta", "windkraft", "renewable", "erneuerbar"], "1.7", "RENEWABLES_ENVIRONMENT"],
  [["uhren", "watchmak", "horlog", "orolog"], "2.9", null],
  [["robotik", "robotic", "automation", "automatis"], "1.12.4", "INDUSTRIAL_AUTOMATION"],
  [["elektronik", "electronic", "elettronic"], "1.12", "ELECTRICAL_ELECTRONIC_MANUFACTURING"],
  [["lebensmittel", "aliment", "food "], "1.1.2", "FOOD_PRODUCTION"],
  [["kunststoff", "plastic", "plastiq", "plastica", "polymer"], "4.1", "PLASTICS"],
  [["metallverarbeitung", "metallbau", "zerspanung", "usinage", "machining", "cnc"], "4.1", "MECHANICAL_OR_INDUSTRIAL_ENGINEERING"],
  [["grosshandel", "wholesale", "distribut", "trading", "commercio", "reseller"], "3.3", "WHOLESALE"],
  [["ingenieur", "engineering", "ingegneria", "ingenierie"], "5.1", "MECHANICAL_OR_INDUSTRIAL_ENGINEERING"],
  [["forschung", "research", "recherche", "ricerca", "universit", "institut"], "2.8", "RESEARCH"],
  [["construction", "costruzion", "batiment", "tiefbau", "hochbau"], "1.8", "CONSTRUCTION"],
  [["hvac", "klima", "heizung", "chauffage", "riscald", "sanitar"], "1.8.4", null],
  [["maschinen", "machine", "macchin", "mecanique", "mechanik"], "1.1", "MACHINERY"],
];

/** APIC code -> hs_keywords tag (written only when the keywords field is empty). */
export const KEYWORD_TAGS: Record<string, string> = {
  "1.9": "pharma", "1.9.2": "medical devices", "1.11": "chemicals", "1.10": "pumps and valves", "1.1.8": "packaging",
  "1.3": "automotive", "1.3.3": "agriculture", "1.5": "aerospace", "1.4": "railway", "1.6": "shipbuilding",
  "1.7": "renewables", "2.9": "watch industry", "1.12.4": "automation", "1.12": "electronics", "1.1.2": "food processing",
  "4.1": "processing", "3.3": "wholesale", "5.1": "engineering", "2.8": "research", "1.8": "construction",
  "1.8.4": "hvac", "1.1": "machinery",
};

/** APIC potential multipliers (A+P product fit). Longest matching prefix wins. */
export const APIC_MULT: [string, number][] = [
  ["3.1", 3.8], ["3.2", 3.8], ["3.3", 3.8], ["1.10", 3.0], ["1.9", 2.5], ["2.6", 2.5], ["1.11", 2.5], ["2.2", 2.5],
  ["1.1.2", 2.2], ["2.3", 2.2], ["1.3", 2.0], ["1.5", 2.0], ["1.12.5", 2.0], ["1.8.4", 2.0], ["1.1", 1.8], ["2.5", 1.5],
  ["4.1", 1.5], ["1.7", 1.5], ["1.4", 1.5], ["1.6", 1.5], ["1.12", 1.4], ["1.8", 1.2], ["1.2", 1.0], ["5.1", 0.8], ["2.9", 0.7],
];

export const GARBAGE_ABS = 1_000_000;
export const GARBAGE_FACTOR = 20;

/** The portal's enum values, read from the property definitions (never hard-coded: the euro sign's encoding). */
export type Enums = {
  /** "1".."4" -> exact sales_priority option value. */
  prio: Record<string, string>;
  /** "0".."8" -> exact max_revenue_bucket option value. */
  revbucket: Record<string, string>;
  /** APIC code -> exact apic_ap option value (first option per code). */
  apic: Record<string, string>;
  industry: Set<string>;
  kwType: string | null;
  kwOpts: Set<string>;
};

/* ── numbers, the way Python reads them ───────────────────────────────── */

/** float(x), or null - Python accepts surrounding whitespace, "inf"/"nan" too. */
export function fnum(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return x;
  const s = String(x).trim();
  if (!s) return null;
  if (/^[+-]?(inf|infinity)$/i.test(s)) return s.startsWith("-") ? -Infinity : Infinity;
  if (/^[+-]?nan$/i.test(s)) return NaN;
  if (!/^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)([eE][+-]?\d+)?$/.test(s)) return null;
  return Number(s.replace(/_/g, ""));
}

/** Python's round(x, n): half to even, on the decimal value. */
export function pyRound(x: number, n = 0): number {
  const f = 10 ** n;
  const v = x * f;
  const fl = Math.floor(v);
  const diff = v - fl;
  let r: number;
  if (Math.abs(diff - 0.5) < 1e-9) r = fl % 2 === 0 ? fl : fl + 1;
  else r = Math.round(v);
  return r / f;
}

/** str(round(x, 2)) / str(float) as Python prints it: "1234.5", "1234.0", "1e+16" style aside. */
export function pyStr(x: number): string {
  if (Number.isInteger(x)) return `${x}.0`;
  return String(x);
}

export function prioBucket(v: number | null): string {
  if (v === null) return "4";
  if (v >= 25000) return "1";
  if (v >= 2500) return "2";
  if (v >= 500) return "3";
  return "4";
}

export function revBucket(v: number | null): string {
  if (v === null || v <= 0) return "0";
  if (v < 200) return "1";
  if (v < 500) return "2";
  if (v < 1000) return "3";
  if (v < 2500) return "4";
  if (v < 10000) return "5";
  if (v < 25000) return "6";
  if (v < 100000) return "7";
  return "8";
}

/** Python truthiness of a number: None and 0 are false (NaN is true). */
const truthy = (x: number | null): x is number => x !== null && x !== 0;

/* ── the rules ────────────────────────────────────────────────────────── */

/** _enrich: fill-only-empty apic_ap / industry / hs_keywords from the industry mapping or name/description keywords. */
export function enrich(p: Props, en: Enums): Props {
  let apic = (p.apic_ap ?? "").trim();
  const ind = (p.industry ?? "").trim();
  if (apic && ind) return {};
  const upd: Props = {};
  if (!apic && ind && ind in INDUSTRY_TO_APIC_CODE) {
    const v = en.apic[INDUSTRY_TO_APIC_CODE[ind]];
    if (v) {
      upd.apic_ap = v;
      apic = v;
    }
  }
  if (!apic || !ind) {
    const text = `${p.description ?? ""} ${p.name ?? ""}`.toLowerCase();
    if (text.length > 4) {
      for (const [pats, code, industry] of KEYWORD_RULES) {
        if (pats.some((s) => text.includes(s))) {
          if (!apic) {
            const v = en.apic[code];
            if (v) upd.apic_ap = v;
          }
          if (!ind && industry && en.industry.has(industry)) upd.industry = industry;
          const tag = KEYWORD_TAGS[code];
          if (tag && !(p.hs_keywords ?? "").trim() && en.kwType) {
            if (en.kwType === "string" || en.kwOpts.has(tag)) upd.hs_keywords = tag;
          }
          break;
        }
      }
    }
  }
  return upd;
}

/** _unlost: APSOlost means no purchase in the last 12 months - a current-year buyer is recovered. */
export function unlost(p: Props, curYear: number): Props {
  if ((p.apso_customer ?? "") !== "APSOlost") return {};
  const r = fnum(p[`revenue_${curYear}`]);
  if (truthy(r) && r > 0) return { apso_customer: r >= 500 ? "APSOcore" : "APSOprospect" };
  return {};
}

export type Computed = { prefix: string; upd: Props; clamped: boolean; basis: number | null };

/** _compute: the priority prefix, the max_* facts that changed, whether the potential was clamped, the basis. */
export function compute(props: Props, en: Enums, rev: string[]): Computed {
  const pot = fnum(props.yearly_customer_potential);
  const revs = rev.map((k) => fnum(props[k])).filter((x): x is number => x !== null);
  const maxrev = revs.length ? Math.max(...revs) : null;
  let clamped = false;
  let usePot = pot;
  if (pot !== null && pot > GARBAGE_ABS && pot > GARBAGE_FACTOR * (maxrev || 0)) {
    usePot = null;
    clamped = true;
  }
  const cands = [usePot, maxrev].filter((x): x is number => x !== null);
  const basis = cands.length ? Math.max(...cands) : null;
  const upd: Props = {};
  if (maxrev !== null) {
    const cur = fnum(props.max_revenue_2015_2026);
    if (cur === null || Math.abs(cur - maxrev) > 0.01) upd.max_revenue_2015_2026 = pyStr(pyRound(maxrev, 2));
    const wantRb = en.revbucket[revBucket(maxrev)];
    if (wantRb && props.max_revenue_bucket !== wantRb) upd.max_revenue_bucket = wantRb;
  }
  if (basis !== null) {
    const cur = fnum(props.max_pot_or_turnover);
    if (cur === null || Math.abs(cur - basis) > 0.01) upd.max_pot_or_turnover = pyStr(pyRound(basis, 2));
  }
  return { prefix: prioBucket(basis), upd, clamped, basis };
}

export function apicMult(apic: string | null | undefined): number {
  const code = (apic ?? "").split(" ")[0];
  let best = 1.0, blen = -1;
  for (const [pref, f] of APIC_MULT) {
    if (code.startsWith(pref) && pref.length > blen) {
      best = f;
      blen = pref.length;
    }
  }
  return best;
}

const recentRevenue = (p: Props) =>
  [fnum(p.revenue_2026), fnum(p.revenue_2025), fnum(p.revenue_2024)].filter(truthy);

/** _initial_potential: a starter yearly potential for a company that has NONE (reps' values always win). */
export function initialPotential(p: Props, rev: string[]): number {
  const revs = rev.map((k) => fnum(p[k])).filter(truthy);
  const recent = recentRevenue(p);
  const m = apicMult(p.apic_ap);
  if (recent.length) {
    const base = recent.reduce((a, b) => a + b, 0) / recent.length;
    const pot = Math.max(base * m, 1.3 * Math.max(...revs));
    return pyRound(Math.min(pot, 1_000_000), 0);
  }
  if ((p.apso_customer ?? "") === "APSOmicro") return 300;
  return m >= 2.0 ? 800 : m >= 1.5 ? 600 : 500;
}

/** _potential_formula: avg of the last three revenue years x APIC, floor 1.3x the best year, +40% cap, ceiling 1M. */
export function potentialFormula(p: Props, rev: string[]): number | null {
  const revs = rev.map((k) => fnum(p[k])).filter(truthy);
  const recent = recentRevenue(p);
  if (!recent.length) return null;
  const base = recent.reduce((a, b) => a + b, 0) / recent.length;
  let pot = Math.max(base * apicMult(p.apic_ap), 1.3 * Math.max(...revs));
  const cur = fnum(p.yearly_customer_potential);
  if (truthy(cur) && cur > 0 && cur <= GARBAGE_ABS && pot > cur * 1.4) pot = cur * 1.4;
  return pyRound(Math.min(pot, GARBAGE_ABS), 0);
}

/* ── who wrote a potential ────────────────────────────────────────────── */

/**
 * Apps whose writes are OUR machines': the old calculator ("SARCLA - Reports"), the
 * Compass connector, the Dec-2025 segmentation scripts - plus the hub's own app, which
 * the integration learns on its first write. Everything else is a person's number,
 * including WORKFLOWS (the Customer Visit workflow copies a rep's form value).
 */
export const OWN_MACHINE_APPS = new Set(["36826356", "41691680", "26291976"]);
const MACHINE_SOURCES = new Set(["CALCULATED"]);

export type HistoryEntry = { value?: string | null; timestamp?: string; sourceType?: string; sourceId?: string | number | null };

export function isOwnMachine(entry: HistoryEntry | null | undefined, own: Set<string> = OWN_MACHINE_APPS): boolean {
  if (!entry) return true; // no history at all = nothing a person typed
  if (entry.sourceType === "INTEGRATION") return own.has(String(entry.sourceId));
  return MACHINE_SOURCES.has(entry.sourceType ?? "");
}

export function lastHumanValue(hist: HistoryEntry[], own: Set<string> = OWN_MACHINE_APPS): number | null {
  for (const e of hist) {
    if (!isOwnMachine(e, own)) {
      const v = fnum(e.value);
      if (truthy(v) && v > 0) return v;
    }
  }
  return null;
}

export type RecalcDecision =
  | { kind: "manual_kept" | "no_revenue" | "kept_higher" | "unchanged" }
  | { kind: "human_restored" | "filled" | "machine_recalc"; value: number };

/** One company in potential_recalc: raise-only, machine-written or empty values only, a clobbered human value restored. */
export function recalcDecision(p: Props, hist: HistoryEntry[], rev: string[], own: Set<string> = OWN_MACHINE_APPS): RecalcDecision {
  const cur = fnum(p.yearly_customer_potential);
  if (truthy(cur) && !isOwnMachine(hist[0] ?? null, own)) return { kind: "manual_kept" };
  let human = lastHumanValue(hist, own);
  if (human !== null && human > GARBAGE_ABS) human = null; // an absurd typo is never restored
  let next = potentialFormula(p, rev);
  let restored = false;
  if (human !== null && (next === null || human > next)) {
    next = human;
    restored = true;
  }
  if (next === null) return { kind: "no_revenue" };
  if (truthy(cur) && next < cur) return { kind: "kept_higher" };
  if (truthy(cur) && Math.abs(next - cur) <= 0.1 * cur) return { kind: "unchanged" };
  return { kind: restored ? "human_restored" : truthy(cur) ? "machine_recalc" : "filled", value: next };
}

/* ── the website (web enrichment) ─────────────────────────────────────── */

export const GENERIC_DOMAINS = new Set([
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "aol.com", "live.com",
  "icloud.com", "gmx.de", "gmx.ch", "gmx.at", "gmx.net", "web.de", "t-online.de",
  "bluewin.ch", "sunrise.ch", "hispeed.ch", "free.fr", "orange.fr", "sfr.fr",
  "laposte.net", "wanadoo.fr", "libero.it", "virgilio.it", "alice.it", "tin.it",
  "tiscali.it", "mail.com", "protonmail.com", "proton.me", "yandex.com",
]);
export const TLD_COUNTRY: Record<string, string> = {
  ch: "Switzerland", de: "Germany", fr: "France", it: "Italy", at: "Austria", nl: "Netherlands", be: "Belgium",
  es: "Spain", pt: "Portugal", pl: "Poland", cz: "Czech Republic", se: "Sweden", no: "Norway", dk: "Denmark",
  fi: "Finland", hu: "Hungary", ro: "Romania", si: "Slovenia", sk: "Slovakia", tr: "Turkey", li: "Liechtenstein",
  lu: "Luxembourg", uk: "United Kingdom",
};
const ISO_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TLD_COUNTRY).map(([k, v]) => [k.toUpperCase(), v])),
  GB: "United Kingdom", US: "United States",
};
export const WEB_PROPS = ["name", "domain", "website", "description", "country", "city", "zip", "numberofemployees", "apic_ap", "industry", "hs_keywords"];

/** html.unescape for what meta descriptions carry: named basics and numeric entities. */
function unescapeHtml(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", reg: "®", copy: "©", trade: "™" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[e] ?? m;
  });
}

function* ldObjs(data: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(data)) {
    for (const d of data) yield* ldObjs(d);
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    yield o;
    for (const k of ["@graph", "itemListElement", "item"]) {
      const v = o[k];
      if (v && typeof v === "object") yield* ldObjs(v);
    }
  }
}

export type Site = { description?: string; employees?: number; city?: string; zip?: string; country?: string; text: string };

/** _parse_site: meta/og description, schema.org JSON-LD (description, employees, address), and the page text. */
export function parseSite(page: string): Site {
  const out: Partial<Site> = {};
  for (const pat of [
    /<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']{25,1500})["']/i,
    /<meta[^>]+content=["']([^"']{25,1500})["'][^>]*(?:name|property)=["'](?:og:)?description["']/i,
  ]) {
    const m = pat.exec(page);
    if (m) {
      out.description = unescapeHtml(m[1]).trim();
      break;
    }
  }
  for (const m of page.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const o of ldObjs(data)) {
      if (!out.description && typeof o.description === "string" && o.description.length > 25) out.description = o.description.trim().slice(0, 1500);
      let emp: unknown = o.numberOfEmployees;
      if (emp && typeof emp === "object") emp = (emp as Record<string, unknown>).value || (emp as Record<string, unknown>).minValue;
      const n = emp ? Math.trunc(parseFloat(String(emp))) : NaN;
      if (emp && Number.isFinite(n) && n > 0) out.employees = n;
      const addr = o.address;
      if (addr && typeof addr === "object" && !Array.isArray(addr)) {
        const a = addr as Record<string, unknown>;
        if (a.addressLocality) out.city = String(a.addressLocality).slice(0, 80);
        if (a.postalCode) out.zip = String(a.postalCode).slice(0, 20);
        let c: unknown = a.addressCountry;
        if (c && typeof c === "object") c = (c as Record<string, unknown>).name;
        if (typeof c === "string" && c.trim()) out.country = (ISO_COUNTRY[c.trim().toUpperCase()] ?? c.trim()).slice(0, 60);
      }
    }
  }
  let text = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  out.text = text.split(/\s+/).filter(Boolean).join(" ").slice(0, 6000).toLowerCase();
  return out as Site;
}

/** _web_enrich_one after the fetch: what to fill (empty fields only). Null = no usable domain; {} = site unreachable. */
export function webUpdates(p: Props, page: string | null, en: Enums): Props | null {
  const domain = (p.domain ?? "").toLowerCase().trim();
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;
  if (page === null) return {};
  const parsed = parseSite(page);
  const upd: Props = {};
  if (!p.website) upd.website = `https://www.${domain}`;
  if (!p.description && parsed.description) upd.description = parsed.description.slice(0, 1500);
  if (!p.numberofemployees && parsed.employees) upd.numberofemployees = String(parsed.employees);
  for (const k of ["city", "zip", "country"] as const) {
    if (!p[k] && parsed[k]) upd[k] = parsed[k];
  }
  if (!p.country) {
    const tld = domain.split(".").at(-1) ?? "";
    if (tld in TLD_COUNTRY) upd.country = TLD_COUNTRY[tld];
  }
  if (!p.apic_ap || !p.industry) {
    const p2 = { ...p, description: `${p.description ?? ""} ${parsed.text}`.slice(0, 6000) };
    Object.assign(upd, enrich(p2, en));
  }
  return upd;
}

/* ── sales edits of the potential (the "Potential changes" measure) ───── */

export type EditSource = "rep" | "bulk" | "visit" | "workflow" | "import" | "merge" | "other";

export type PotentialEdit = {
  companyId: string;
  name: string;
  /** ISO timestamp of the edit. */
  at: string;
  value: number | null;
  prev: number | null;
  source: EditSource;
  /** HubSpot user id for a person's edit (CRM_UI, bulk), else null. */
  userId: string | null;
  /** The priority the potential gave before and after, at today's revenue ("1".."4"). */
  prioBefore: string;
  prioAfter: string;
  /** Set when a workflow's write matches a customer visit: the visit, and its owner (the person). */
  visitId?: string | null;
  visitOwnerId?: string | null;
  /** Part of a mass update (hundreds in a day from one source) - not a sales input. */
  mass?: boolean;
};

export type Visit = { id: string; created: string; modified: string; ownerId: string | null };

/** A workflow's write within this long of a visit on the same company is that visit's report. */
export const VISIT_MATCH_MS = 2 * 60 * 60_000;
/** More than this many changes in one day from one source and person is a mass update. */
export const MASS_PER_DAY = 200;
/** A potential above this is a typo or a merge artefact - shown, never summed. */
export const ABSURD_POTENTIAL = 1_000_000;

/**
 * A workflow's write that lands within two hours of a customer visit on the same
 * company is the visit report copying the rep's figure (05.10: 41% of them, a
 * median 22 seconds apart) - the visit's owner is the person. The rest stay
 * "workflow": some other automation, no person on record.
 */
export function labelVisits(edits: PotentialEdit[], visitsByCompany: Map<string, Visit[]>): PotentialEdit[] {
  return edits.map((e) => {
    if (e.source !== "workflow") return e;
    const t = Date.parse(e.at);
    let best: { d: number; v: Visit } | null = null;
    for (const v of visitsByCompany.get(e.companyId) ?? []) {
      for (const when of [v.created, v.modified]) {
        const d = Math.abs(t - Date.parse(when));
        if (d <= VISIT_MATCH_MS && (!best || d < best.d)) best = { d, v };
      }
    }
    return best ? { ...e, source: "visit" as const, visitId: best.v.id, visitOwnerId: best.v.ownerId } : e;
  });
}

/** Mark the mass updates: one source (and person) changing hundreds of potentials in a day. */
export function markMass(edits: PotentialEdit[]): PotentialEdit[] {
  const key = (e: PotentialEdit) => `${e.at.slice(0, 10)}|${e.source}|${e.userId ?? ""}`;
  const n = new Map<string, number>();
  for (const e of edits) n.set(key(e), (n.get(key(e)) ?? 0) + 1);
  return edits.map((e) => ((n.get(key(e)) ?? 0) > MASS_PER_DAY ? { ...e, mass: true } : e));
}

/** The EUR a change adds, absurd values (typos, merge artefacts) left out. */
export function editDelta(e: PotentialEdit): number {
  const ok = (v: number | null) => (v === null || Math.abs(v) > ABSURD_POTENTIAL ? null : v);
  const a = ok(e.prev), b = ok(e.value);
  if ((e.prev !== null && a === null) || (e.value !== null && b === null)) return 0;
  return (b ?? 0) - (a ?? 0);
}

export const isAbsurd = (e: PotentialEdit) => Math.abs(e.value ?? 0) > ABSURD_POTENTIAL || Math.abs(e.prev ?? 0) > ABSURD_POTENTIAL;

export function editSource(e: HistoryEntry): EditSource {
  switch (e.sourceType) {
    case "CRM_UI": return "rep";
    case "CRM_UI_BULK_ACTION": return "bulk";
    case "AUTOMATION_PLATFORM": return "workflow";
    case "IMPORT": return "import";
    case "MERGE_OBJECTS": return "merge";
    default: return "other";
  }
}

/** The priority a potential gives with this company's revenue - the CEO formula, garbage clamp included. */
export function prioWith(potential: number | null, p: Props, rev: string[]): string {
  const revs = rev.map((k) => fnum(p[k])).filter((x): x is number => x !== null);
  const maxrev = revs.length ? Math.max(...revs) : null;
  const use = potential !== null && potential > GARBAGE_ABS && potential > GARBAGE_FACTOR * (maxrev || 0) ? null : potential;
  const c = [use, maxrev].filter((x): x is number => x !== null);
  return prioBucket(c.length ? Math.max(...c) : null);
}

/**
 * Every change to the yearly potential made by a person or for one (typed, bulk,
 * a form copied by a workflow, an import, a merge) - our own machines' writes are
 * not edits. History comes newest first; an entry that repeats the value before it
 * is not a change.
 */
export function potentialEdits(companyId: string, p: Props, hist: HistoryEntry[], rev: string[], own: Set<string> = OWN_MACHINE_APPS): PotentialEdit[] {
  const out: PotentialEdit[] = [];
  for (let i = 0; i < hist.length; i++) {
    const e = hist[i];
    if (!e || !e.timestamp || isOwnMachine(e, own)) continue;
    const value = fnum(e.value);
    const prev = hist[i + 1] ? fnum(hist[i + 1].value) : null;
    if (value === prev || (value !== null && prev !== null && Math.abs(value - prev) < 0.005)) continue;
    const uid = (e as HistoryEntry & { updatedByUserId?: number | string }).updatedByUserId;
    out.push({
      companyId, name: p.name ?? "", at: e.timestamp, value, prev, source: editSource(e),
      userId: uid !== undefined && uid !== null ? String(uid) : null,
      prioBefore: prioWith(prev, p, rev), prioAfter: prioWith(value, p, rev),
    });
  }
  return out;
}

/** Who set the potential a company carries now: a person, one of our machines, or nobody. */
export function potentialSetter(p: Props, hist: HistoryEntry[], own: Set<string> = OWN_MACHINE_APPS): "person" | "machine" | "empty" {
  const cur = fnum(p.yearly_customer_potential);
  if (cur === null || cur === 0) return "empty";
  return isOwnMachine(hist[0] ?? null, own) ? "machine" : "person";
}
