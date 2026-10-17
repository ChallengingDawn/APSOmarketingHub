// HOW EACH MEASURED KPI IS SHOWN AND ADDED UP - pure, shared by the server and
// the pages. A KPI in the catalogue without an entry here is "not connected
// yet" and is shown as such, named, with the source it is waiting for.
//
//   sheet  typed monthly on the Monthly inputs page - today's numbers from
//          SARCLA's "Dashboard 2026" (SEA has no connector yet, cart and
//          check-out abandonment and the GA4 figures as reported come from it)
//   live   read by the hub itself (HubSpot, GA4, Search Console)

export type Fmt = "int" | "pct" | "chf" | "dec1" | "dec2" | "x";
export type Agg =
  | { kind: "sum" }
  | { kind: "avg" }
  | { kind: "ratio"; num: string; den: string }
  | { kind: "wavg"; weight: string }
  /** a count measured for the year so far, not month by month */
  | { kind: "ytd" };

export type Measure = {
  id: string;
  label: string;
  fmt: Fmt;
  agg: Agg;
  origin: "sheet" | "live";
  /** false when lower is better (bounce, abandonment, position, cost) */
  goodWhenUp?: boolean;
  /** monthly values derived from other KPIs rather than typed (conversion, CTR, ROAS) */
  derived?: boolean;
  /**
   * The Journey dashboard's KPI under an id the catalogue uses for something
   * else: SARCLA renamed L02 to "Leads to sales" on the Journey tab, while the
   * catalogue's L02 is still "Leads by country" - which stays not connected.
   */
  notCatalogue?: boolean;
  /**
   * Last year is compared on the same months only, where both years have a
   * figure: Search Console keeps 16 months, so last year starts mid-year.
   */
  likeForLike?: boolean;
  /** where a live KPI is read - named when it does not answer and the typed months stand in */
  liveSource?: string;
  /** what the KPI counts, when the catalogue's own words no longer fit the source (SEA: Google Ads only) */
  definition?: string;
  note?: string;
  /** a figure outside the catalogue shown as a card of its own in this stage (the email open and click rates beside R11) */
  extraIn?: string;
};

const M = (m: Measure) => m;

export const MEASURES: Record<string, Measure> = Object.fromEntries([
  // sheet - typed monthly
  M({ id: "V01", label: "Users (visitors)", fmt: "int", agg: { kind: "sum" }, origin: "sheet" }),
  M({ id: "E01", label: "Bounce rate", fmt: "pct", agg: { kind: "avg" }, origin: "sheet", goodWhenUp: false, note: "Max 50%, lower is better" }),
  M({ id: "E02", label: "Engagement rate", fmt: "pct", agg: { kind: "avg" }, origin: "sheet", note: "60% B2B standard, 75% strong" }),
  M({ id: "K02", label: "Cart abandonment rate", fmt: "pct", agg: { kind: "avg" }, origin: "sheet", goodWhenUp: false }),
  M({ id: "K03", label: "Check-out abandonment rate", fmt: "pct", agg: { kind: "avg" }, origin: "sheet", goodWhenUp: false }),
  M({ id: "P01", label: "Purchases (online orders)", fmt: "int", agg: { kind: "sum" }, origin: "sheet" }),
  M({ id: "P02", label: "Conversion rate users", fmt: "pct", agg: { kind: "ratio", num: "P01", den: "V01" }, origin: "sheet", derived: true }),
  // SEA: live from Google Ads through GA4's Ads link since 17.10.2026 (SARCLA: "make SEA live"), the whole
  // of last year too; Microsoft Ads is not in GA4, so these are Google Ads only. Typed months as the fallback.
  M({ id: "R01", label: "SEA impressions", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Google Ads", definition: "Impressions from Google Ads", note: "Through GA4's Google Ads link - Microsoft Ads not included" }),
  M({ id: "R02", label: "SEA clicks", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Google Ads", definition: "Clicks from Google Ads", note: "Through GA4's Google Ads link - Microsoft Ads not included" }),
  M({ id: "R03", label: "SEA CTR", fmt: "pct", agg: { kind: "ratio", num: "R02", den: "R01" }, origin: "live", likeForLike: true, liveSource: "Google Ads", definition: "Google Ads clicks / Google Ads impressions" }),
  M({ id: "X01", label: "SEA cost", fmt: "chf", agg: { kind: "sum" }, origin: "sheet", goodWhenUp: false }),
  M({ id: "P05", label: "SEA revenue", fmt: "chf", agg: { kind: "sum" }, origin: "sheet" }),
  M({ id: "P06", label: "ROAS (SEA)", fmt: "x", agg: { kind: "ratio", num: "P05", den: "X01" }, origin: "sheet", derived: true }),
  // Reach (SEO): live from Search Console since 17.10.2026 (SARCLA: "this should update live, last year against
  // this year"); the typed months stay as the fallback while Google is not connected
  M({ id: "R04", label: "SEO impressions", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Search Console" }),
  M({ id: "R05", label: "SEO clicks", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Search Console" }),
  M({ id: "R06", label: "SEO CTR", fmt: "pct", agg: { kind: "ratio", num: "R05", den: "R04" }, origin: "live", likeForLike: true, liveSource: "Search Console" }),
  M({ id: "R07", label: "SEO average position", fmt: "dec1", agg: { kind: "wavg", weight: "R04" }, origin: "live", likeForLike: true, liveSource: "Search Console", goodWhenUp: false, note: "Lower is better" }),
  M({ id: "R08", label: "Brand share of search clicks", fmt: "pct", agg: { kind: "ratio", num: "R08B", den: "R05" }, origin: "live", likeForLike: true, liveSource: "Search Console", definition: "Share of Google search clicks from searches naming APSO, Angst or Pfister" }),
  // GEO: the share of AI answers naming APSO, from HubSpot's AEO prompts as the hub keeps them (SARCLA 17.10)
  M({ id: "R10", label: "AI search visibility (GEO)", fmt: "pct", agg: { kind: "ratio", num: "R10N", den: "R10D" }, origin: "live", liveSource: "HubSpot AEO", definition: "Share of the AI assistants' answers to the AEO prompts (ChatGPT, Gemini, Perplexity) that named APSO", note: "Details on Marketing & Content > AI answers (AEO)" }),
  // R09: Search Console clicks from the focus markets, month by month (SARCLA 18.10: "we need to build this as well")
  M({ id: "R09", label: "Search clicks from our focus markets", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Search Console", definition: "Google search clicks from Switzerland, Germany, Italy, France, Austria, the Netherlands, Liechtenstein and Poland", note: "Every country below" }),
  // R11: HubSpot's marketing emails, delivered and their open and click rates (SARCLA 18.10)
  M({ id: "R11", label: "Emails delivered", fmt: "int", agg: { kind: "sum" }, origin: "live", liveSource: "HubSpot marketing email", definition: "Marketing emails delivered by HubSpot, newsletters and automated emails" }),
  M({ id: "R11O", label: "Email open rate", fmt: "pct", agg: { kind: "ratio", num: "R11OP", den: "R11" }, origin: "live", notCatalogue: true, extraIn: "1", liveSource: "HubSpot marketing email", definition: "Opens / emails delivered", note: "Apple Mail opens every email it receives, so this reads high" }),
  M({ id: "R11C", label: "Email click rate", fmt: "pct", agg: { kind: "ratio", num: "R11CL", den: "R11" }, origin: "live", notCatalogue: true, extraIn: "1", liveSource: "HubSpot marketing email", definition: "Clicks / emails delivered" }),
  M({ id: "R11OP", label: "Email opens", fmt: "int", agg: { kind: "sum" }, origin: "live", notCatalogue: true }),
  M({ id: "R11CL", label: "Email clicks", fmt: "int", agg: { kind: "sum" }, origin: "live", notCatalogue: true }),
  M({ id: "R10N", label: "AI answers naming APSO", fmt: "int", agg: { kind: "sum" }, origin: "live", notCatalogue: true }),
  M({ id: "R10D", label: "AI answers", fmt: "int", agg: { kind: "sum" }, origin: "live", notCatalogue: true }),
  M({ id: "R08B", label: "Brand search clicks", fmt: "int", agg: { kind: "sum" }, origin: "live", likeForLike: true, liveSource: "Search Console", notCatalogue: true }),
  M({ id: "P07", label: "SEO revenue", fmt: "chf", agg: { kind: "sum" }, origin: "sheet" }),
  M({ id: "F01", label: "Paid revenue (SEA) vs SMEC target", fmt: "chf", agg: { kind: "sum" }, origin: "sheet", derived: true, note: "SEA revenue against the year's SMEC target" }),
  // live - read by the hub
  M({ id: "L01", label: "Leads (contact requests)", fmt: "int", agg: { kind: "sum" }, origin: "live", note: "Contact Us form requests - a minimum (HubSpot keeps each contact's latest form only)" }),
  M({ id: "L02", label: "Leads to sales", fmt: "int", agg: { kind: "sum" }, origin: "live", notCatalogue: true, note: "ESO + TSA tickets created from forms and chat" }),
  M({ id: "L04", label: "Shop registrations", fmt: "int", agg: { kind: "sum" }, origin: "live", note: "New contacts with a shop account" }),
  M({ id: "H01", label: "Leads handed to ESO", fmt: "int", agg: { kind: "sum" }, origin: "live", note: "ESO tickets from forms and chat" }),
  M({ id: "C01", label: "Active companies (bought this year)", fmt: "int", agg: { kind: "ytd" }, origin: "live", note: "Invoiced revenue this year so far" }),
  M({ id: "G01", label: "Active customers", fmt: "int", agg: { kind: "ytd" }, origin: "live", note: "Invoiced revenue this year so far" }),
  M({ id: "V06", label: "Companies logged in", fmt: "int", agg: { kind: "ytd" }, origin: "live", note: "This year so far; last year whole" }),
].map((m) => [m.id, m]));

/** The sheet KPIs typed month by month (the derived ones are computed). */
export const TYPED: string[] = Object.values(MEASURES).filter((m) => m.origin === "sheet" && !m.derived).map((m) => m.id);

export type Series = { months: (number | null)[]; py: (number | null)[] };

/** One month of a derived KPI from its parts. */
export function derive(id: string, get: (id: string) => Series): Series {
  const m = MEASURES[id];
  const out: Series = { months: Array(12).fill(null), py: Array(12).fill(null) };
  if (id === "F01") return get("P05");
  if (m?.agg.kind !== "ratio") return out;
  const a = get(m.agg.num), b = get(m.agg.den);
  for (const k of ["months", "py"] as const) {
    for (let i = 0; i < 12; i++) {
      const x = a[k][i], y = b[k][i];
      out[k][i] = x != null && y ? x / y : null;
    }
  }
  return out;
}

/** The year so far, the way the KPI adds up - over the months `only` keeps, when given (like for like). */
export function total(id: string, s: Series, side: "months" | "py", get: (id: string) => Series, upTo = 12, only?: boolean[]): number | null {
  const m = MEASURES[id];
  const vals = s[side].slice(0, upTo).map((v, i) => (only && !only[i] ? null : v));
  const have = vals.filter((v): v is number => v != null);
  if (!m || !have.length) return null;
  switch (m.agg.kind) {
    case "sum": case "ytd": return have.reduce((a, b) => a + b, 0);
    case "avg": return have.reduce((a, b) => a + b, 0) / have.length;
    case "ratio": {
      const a = total(m.agg.num, get(m.agg.num), side, get, upTo, only), b = total(m.agg.den, get(m.agg.den), side, get, upTo, only);
      return a != null && b ? a / b : null;
    }
    case "wavg": {
      const w = get(m.agg.weight)[side];
      let sw = 0, sv = 0;
      vals.forEach((v, i) => { if (v != null && w[i] != null) { sw += w[i]!; sv += v * w[i]!; } });
      return sw ? sv / sw : null;
    }
  }
}

export function fmtValue(fmt: Fmt, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (fmt) {
    case "int": return Math.round(v).toLocaleString("en");
    case "pct": return `${(v * 100).toFixed(1)}%`;
    // in full, never "CHF 4.14M" (SARCLA 18.10: abbreviations make the pages hard to read)
    case "chf": return `CHF ${Math.round(v).toLocaleString("en")}`;
    case "dec1": return v.toFixed(1);
    case "dec2": return v.toFixed(2);
    case "x": return v.toFixed(1);
  }
}
