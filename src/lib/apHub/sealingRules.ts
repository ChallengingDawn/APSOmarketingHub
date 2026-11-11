// SEALING BUSINESS REVIEW - the rules, no database (SARCLA 10.11.2026: the Angst+Pfister hub's first report, from the
// Executive Committee's pilot "Sealing Business Review" and its workbook "Top DT customers - articles - compounds -
// approvals": every business unit's sealing (profit centre DT) invoices, net revenue and margin in EUR, by customer,
// article, compound and the approval written on the article).
//
// The data is one more query sheet in the morning ERP workbook (the BI cube, as OTD Reports' Query5/Query6), found by
// its columns like the others (connectors/steps/erpWorkbook.ts) - a row per invoice month, business unit, channel,
// customer, article, compound and approval, with its net revenue and gross profit in EUR.
//
// The material family is the pilot's own rule (its revision.js materialOf), word for word, so the hub and the pilot
// put a compound in the same family.

export type SealingRow = {
  /** invoice month, YYYY-MM */
  month: string;
  /** the A+P company that invoiced - APCH, APDE, APFR ... (the cube's CompanySt) */
  bu: string;
  channel: string;
  customer: string;
  customerName: string;
  article: string;
  articleText: string;
  compound: string;
  approval: string;
  rev: number;
  /** gross profit in EUR (net revenue x margin) */
  gp: number;
};

type Cell = string | number | boolean | Date | null | { v: number } | undefined;

const text = (c: Cell): string => {
  if (c == null) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "object") return String((c as { v: number }).v);
  return String(c).trim();
};
const num = (c: Cell): number => {
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && !(c instanceof Date)) return Number((c as { v: number }).v) || 0;
  const n = Number(text(c).replace(/'/g, ""));
  return Number.isFinite(n) ? n : 0;
};
/** A column name as the reader compares it: "[I_NET_REV_EUR]", "dim_article[CompoundDesignationAP]" -> lower letters and digits. */
const norm = (s: string) => s.replace(/^.*\[|\]$/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Each field and the names its column may carry - the query's own first, then the cube's. */
const COLUMNS: Record<keyof SealingRow, string[]> = {
  month: ["month", "invoicemonth", "yearmonth"],
  bu: ["companyst", "company", "companynumber", "businessunit"],
  channel: ["channel"],
  customer: ["customernumberunique", "customernumber"],
  customerName: ["customername"],
  article: ["article", "articlenumber"],
  articleText: ["articletext", "articledescription", "articlename"],
  compound: ["compounddesignationap", "compound"],
  approval: ["approval", "approvals", "conformity", "conformities"],
  rev: ["netrevenueeur", "inetreveur"],
  gp: ["grossprofiteur", "margineur"],
};

/** Is this row the sheet's header? Its compound, its business unit and its revenue name it. */
export function isSealingHeader(cells: Cell[]): boolean {
  const n = new Set(cells.map((c) => norm(text(c))));
  return n.has("compounddesignationap") && ["companyst", "company", "companynumber"].some((k) => n.has(k)) && (n.has("netrevenueeur") || n.has("inetreveur"));
}

/**
 * The business unit of the ERP's company number (dim_order[CompanyNumber], the mandant) - named as the BI cube's
 * CompanySt names them: "AP" + the country, as the pilot shows for 1 (APCH), 20 (APDE), 30 (APAT), 40 (APFR), 50 (APNL)
 * and 80 (APCN) - its customers' numbers start with their mandant (1-324158 is APCH, 20-120385 APDE). The query reads
 * the number, not CompanySt, because the number's table is known (the morning workbook's invoices query uses it).
 */
const BU_OF: Record<string, string> = {
  "1": "APCH", "20": "APDE", "30": "APAT", "40": "APFR", "50": "APNL", "60": "APBE", "70": "APIT", "80": "APCN", "90": "APCZ",
  "100": "APSOparts CH", "110": "APSOparts DE", "120": "APPL", "130": "APUS", "140": "A+P S&P CH", "150": "A+P S&P DE",
};
export function buOf(raw: string): string {
  const s = raw.trim();
  if (!/^\d+(\.0+)?$/.test(s)) return s;
  const n = String(Number(s));
  return BU_OF[n] ?? `M${n}`;
}

/** The month a cell gives: a date, "2026-03", "2026/P03", "202603", "03.2026". */
export function monthOf(c: Cell): string {
  if (c instanceof Date) return c.toISOString().slice(0, 7);
  if (typeof c === "number" && c > 20000 && c < 80000) {
    // an Excel day number
    const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000);
    return d.toISOString().slice(0, 7);
  }
  const s = text(c);
  let m = /^(\d{4})[-/.]?P?(\d{1,2})\b/i.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = /^(\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  return "";
}

/** The sheet, row by row: its header (wherever in the first rows it is), then the rows. */
export class SealingSheet {
  private at: Partial<Record<keyof SealingRow, number>> | null = null;
  private rows: SealingRow[] = [];
  private skipped = 0;
  feed(_n: number, cells: Cell[]): void {
    if (!this.at) {
      if (!isSealingHeader(cells)) return;
      const names = cells.map((c) => norm(text(c)));
      const at: Partial<Record<keyof SealingRow, number>> = {};
      for (const [k, alts] of Object.entries(COLUMNS) as [keyof SealingRow, string[]][]) {
        const i = alts.map((a) => names.indexOf(a)).find((x) => x >= 0);
        if (i !== undefined) at[k] = i;
      }
      this.at = at;
      return;
    }
    const g = (k: keyof SealingRow) => (this.at![k] !== undefined ? cells[this.at![k]!] : null);
    const month = monthOf(g("month"));
    const rev = num(g("rev"));
    if (!month || (!rev && !num(g("gp")))) { this.skipped++; return; }
    this.rows.push({
      month, rev, gp: num(g("gp")),
      bu: buOf(text(g("bu"))), channel: text(g("channel")),
      customer: text(g("customer")), customerName: text(g("customerName")),
      article: text(g("article")), articleText: text(g("articleText")),
      compound: text(g("compound")), approval: text(g("approval")),
    });
  }
  finish(): { rows: SealingRow[]; skipped: number } | null {
    return this.at ? { rows: this.rows, skipped: this.skipped } : null;
  }
}

/* -- the pilot's words ------------------------------------------------------------------------------------------- */

/** The pilot's material family of a compound (revision.js materialOf). */
export function materialOf(name: string): string {
  const s = String(name || "").toUpperCase();
  if (/FFKM|KALREZ|EVOLAST/.test(s)) return "FFKM";
  if (/HNBR/.test(s)) return "HNBR";
  if (/FKM|FPM/.test(s)) return "FKM";
  if (/EPDM/.test(s)) return "EPDM";
  if (/NBR/.test(s)) return "NBR";
  if (/VMQ|SILICONE/.test(s)) return "VMQ";
  if (/PTFE/.test(s)) return "PTFE";
  return "Unclassified";
}

/** No compound named - the pilot's "missing" (index.html): left out of the compound and material views. */
export function noCompound(name: string): boolean {
  const s = String(name || "").trim();
  return s === "" || ["No info", "Unknown", "TBD"].includes(s) || s.startsWith("Drawing :");
}

/** No approval written on the article (the workbook's empty row label). */
export function noApproval(name: string): boolean {
  const s = String(name || "").trim();
  return s === "" || /^\(blank\)$/i.test(s) || s === "-";
}

/* -- a figure per name ------------------------------------------------------------------------------------------- */

/** `prev` / `prevGp`: the same key's net revenue and gross profit in the same months a year before. */
export type Figure = { key: string; name: string; rev: number; gp: number; margin: number; prev?: number; prevGp?: number };

/** Revenue and gross profit summed per key, the margin of the sums (never an average of margins), biggest first. */
export function sumBy<T extends { rev: number; gp: number }>(rows: T[], key: (r: T) => string, name: (r: T) => string = key): Figure[] {
  const m = new Map<string, Figure>();
  for (const r of rows) {
    const k = key(r);
    const f = m.get(k) ?? { key: k, name: name(r), rev: 0, gp: 0, margin: 0 };
    f.rev += r.rev;
    f.gp += r.gp;
    m.set(k, f);
  }
  return [...m.values()].map((f) => ({ ...f, margin: f.rev ? f.gp / f.rev : 0 })).sort((a, b) => b.rev - a.rev);
}

/* -- the months a page shows ------------------------------------------------------------------------------------- */

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
/** A month as the pages and the API write it: YYYY-MM. */
export const isMonth = (s: unknown): s is string => typeof s === "string" && YM.test(s);
/** The same month a year before. */
export const yearBefore = (m: string) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;

/** Every month from `from` to `to`, both in (none when `from` is later). */
export function monthsBetween(from: string, to: string): string[] {
  if (!isMonth(from) || !isMonth(to)) return [];
  const out: string[] = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  for (let i = 0; i < 600; i++) {
    const s = `${y}-${String(m).padStart(2, "0")}`;
    if (s > to) break;
    out.push(s);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * The months a page shows: those asked, kept within the months the figures hold (`first` .. `last`); none asked, the
 * year so far up to the last month the figures hold. No figures yet: up to `now` (YYYY-MM).
 */
export function sealingPeriod(asked: { from?: string | null; to?: string | null }, held: { first: string | null; last: string | null }, now: string): { from: string; to: string } {
  const last = isMonth(held.last) ? held.last : now;
  const first = isMonth(held.first) && held.first <= last ? held.first : null;
  let to = isMonth(asked.to) && asked.to < last ? asked.to : last;
  if (first && to < first) to = first;
  let from = isMonth(asked.from) && asked.from <= to ? asked.from : `${to.slice(0, 4)}-01`;
  if (first && from < first) from = first;
  return { from, to };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 2026", "Jan – Oct 2026", "Nov 2025 – Oct 2026". */
export function periodWords(from: string, to: string): string {
  const name = (m: string) => MON[Number(m.slice(5, 7)) - 1] ?? m;
  if (from === to) return `${name(to)} ${to.slice(0, 4)}`;
  return from.slice(0, 4) === to.slice(0, 4) ? `${name(from)} – ${name(to)} ${to.slice(0, 4)}` : `${name(from)} ${from.slice(0, 4)} – ${name(to)} ${to.slice(0, 4)}`;
}

/* -- from results to action: the pilot's three commercial priorities, from the figures --------------------------- */

/**
 * A card of the pilot's "From results to action": the overview's three commercial priorities (margin, growth, spread),
 * the customers' and articles' reviews (profit, retain, compare), a material family's (portfolio) and the approvals'
 * (capture, validate, interpret).
 */
export type Priority = {
  kind: "margin" | "growth" | "spread" | "profit" | "retain" | "compare" | "portfolio" | "capture" | "validate" | "interpret";
  title: string;
  evidence: string;
  /** the next move - the approvals' cards have none, their evidence is the move */
  next?: string;
  /** the illustrative effect, in EUR of gross profit - never a forecast (0: none) */
  effect: number;
  effectLabel: string;
  /** the compound to inspect ("" none) */
  compound: string;
  /** the pilot's "Suggested owner" */
  owner?: string;
};

/** A compound and one customer's part of it: revenue and gross profit. */
export type CompoundCustomer = { compound: string; customer: string; customerName: string; rev: number; gp: number };

const eur = (v: number) => (Math.abs(v) >= 1e6 ? `€${(v / 1e6).toFixed(2)}m` : Math.abs(v) >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v.toFixed(0)}`);
const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * The three boxes of the pilot, found in the figures rather than written by hand:
 *   margin  the account buying a sizeable compound (>= €100k) furthest below that compound's own margin - +5 pp at its
 *           current sales, illustrative;
 *   growth  the compound of at least €1m with the best margin - +10 % sales at its margin, illustrative;
 *   spread  the leading compound's widest margin gap between two of its larger accounts (>= €50k each) - explained
 *           before any repricing.
 * Compounds with no name are never a priority; nothing qualifies, no box.
 */
export function priorities(compounds: Figure[], pairs: CompoundCustomer[]): Priority[] {
  const out: Priority[] = [];
  const named = compounds.filter((c) => !noCompound(c.name));
  const marginOf = new Map(named.map((c) => [c.name, c.margin]));

  let worst: { p: CompoundCustomer; gap: number } | null = null;
  for (const p of pairs) {
    if (noCompound(p.compound) || p.rev < 100_000) continue;
    const own = marginOf.get(p.compound);
    if (own === undefined) continue;
    const gap = own - p.gp / p.rev;
    if (gap > 0.1 && (!worst || gap * p.rev > worst.gap * worst.p.rev)) worst = { p, gap };
  }
  if (worst) {
    const { p } = worst, m = p.gp / p.rev, own = marginOf.get(p.compound)!;
    out.push({
      kind: "margin", compound: p.compound,
      title: `Review ${p.customerName}'s ${p.compound} economics`,
      evidence: `${p.customerName} buys ${eur(p.rev)} of ${p.compound} at ${pc(m)} GM, versus ${pc(own)} for the compound overall. The comparison may reflect different article mixes.`,
      next: "Review article mix, costs and price conditions with the account manager. Test a 5 percentage-point margin improvement without assuming it is achievable.",
      effect: p.rev * 0.05, effectLabel: "Illustrative +5 pp at current sales", owner: "Account manager + product manager",
    });
  }

  const big = named.filter((c) => c.rev >= 1_000_000).sort((a, b) => b.margin - a.margin)[0];
  if (big) {
    out.push({
      kind: "growth", compound: big.name,
      title: "Test growth in a sizeable, high-margin compound",
      evidence: `${big.name} generates ${eur(big.rev)} at ${pc(big.margin)} GM.`,
      next: "Ask sales to identify application-matched opportunities around existing accounts and validate capacity, pricing and demand before setting a target.",
      effect: big.rev * 0.1 * big.margin, effectLabel: "Illustrative +10% sales at current GM", owner: "Sales leads + product manager",
    });
  }

  for (const c of named.slice(0, 5)) {
    const accounts = pairs.filter((p) => p.compound === c.name && p.rev >= 50_000);
    if (accounts.length < 2) continue;
    const byMargin = [...accounts].sort((a, b) => b.gp / b.rev - a.gp / a.rev);
    const hi = byMargin[0], lo = byMargin[byMargin.length - 1];
    const spread = hi.gp / hi.rev - lo.gp / lo.rev;
    if (spread < 0.15) continue;
    out.push({
      kind: "spread", compound: c.name,
      title: `Explain the ${materialOf(c.name) === "Unclassified" ? c.name : materialOf(c.name)} margin spread`,
      evidence: `For ${c.name}, ${hi.customerName} reports ${pc(hi.gp / hi.rev)} GM and ${lo.customerName} ${pc(lo.gp / lo.rev)}. These are different account and article mixes, not a like-for-like price comparison.`,
      next: "Compare article-level profitability and service costs. Identify whether mix, transfer costs or commercial terms explain the gap before proposing changes.",
      effect: 0, effectLabel: "Validate causes before any repricing", owner: "Account managers + controlling",
    });
    break;
  }
  return out;
}

/* -- the pilot's other "From results to action" cards (revision.js analysis, index.html analysis) ---------------- */

/** The largest position with a low margin (0 % up to `cap`, 20 %: the pilot's review screen, never a target). */
export function lowMarginLead<T extends { rev: number; margin: number }>(rows: T[], cap = 0.2): T | null {
  return [...rows].filter((r) => r.rev > 0 && r.margin >= 0 && r.margin < cap).sort((a, b) => b.rev - a.rev)[0] ?? null;
}

/**
 * The customers' and the articles' three cards (revision.js analysis): the sizeable low-margin position first (+5 pp
 * illustrative), the concentration of the largest, then the compound comparisons - `compound` the one to inspect.
 * `rows` the positions shown, `total` the net revenue they belong to.
 */
export function reviewActions(what: "customers" | "articles", rows: { name: string; rev: number; margin: number }[], total: number, compound = ""): Priority[] {
  const low = lowMarginLead(rows);
  const largest = [...rows].sort((a, b) => b.rev - a.rev)[0];
  const share = largest && total > 0 ? largest.rev / total : null;
  return [
    {
      kind: "profit", compound: "", owner: "Account manager + controlling",
      title: low ? "Start with a sizeable low-margin position" : "Review the largest commercial exposure",
      evidence: low
        ? `${low.name} has ${eur(low.rev)} net revenue at ${pc(low.margin)} GM. The 20% screen is a review filter, not an agreed target.`
        : largest ? `${largest.name} represents ${eur(largest.rev)} in this selection.` : "No matching records.",
      next: "Review article mix, pricing and cost allocation. Prioritise positions where sales and controlling can validate a specific improvement.",
      effect: low ? low.rev * 0.05 : 0, effectLabel: low ? "Illustrative +5 pp on this position" : "",
    },
    {
      kind: "retain", compound: "", owner: "Business-unit sales lead",
      title: "Make concentration part of account planning",
      evidence: share != null
        ? `The largest ${what === "customers" ? "account" : "article"}, ${largest.name}, represents ${pc(share)} of the net revenue in the current selection.`
        : `Select ${what === "customers" ? "an account" : "an article"} to review its exposure.`,
      next: "Confirm renewal timing, technical alternatives and retention actions with the responsible sales team.",
      effect: 0, effectLabel: "",
    },
    {
      kind: "compare", compound, owner: "Product managers + account managers",
      title: "Use compound-level comparisons",
      evidence: "The leading compounds show material differences in profitability across the accounts buying the same compound.",
      next: "Inspect a compound and its customers. Validate product mix before treating a margin gap as a pricing opportunity.",
      effect: 0, effectLabel: "",
    },
  ];
}

/**
 * The compounds' cards for a material family (revision.js analysis): the commercial priorities on its compounds -
 * none, its portfolio review. `family` null: every family, the priorities as they are.
 */
export function familyActions(all: Priority[], family: string | null, rows: { name: string; rev: number }[]): Priority[] {
  const mine = all.filter((p) => !family || materialOf(p.compound) === family);
  if (mine.length || !family) return mine;
  const rev = rows.reduce((a, r) => a + r.rev, 0);
  return [{
    kind: "portfolio", compound: rows[0]?.name ?? "", owner: "Product manager + sales leads",
    title: `Review ${family} account exposure`,
    evidence: `The named ${family} compounds shown represent ${eur(rev)} of net revenue.`,
    next: "Open the leading compound and review its customers. Confirm application fit, purchasing conditions and customer needs before proposing expansion.",
    effect: 0, effectLabel: "",
  }];
}

/** The approvals' three cards (index.html analysis), in the hub's words: an approval as written on the article. */
export const APPROVAL_ACTIONS: Priority[] = [
  {
    kind: "capture", compound: "", effect: 0, effectLabel: "", title: "Require explicit approval names",
    evidence: "Add structured approval fields, a source document and validity information. Generic technical-datasheet references should remain a separate category.",
  },
  {
    kind: "validate", compound: "", effect: 0, effectLabel: "", title: "Check commercial relevance with sales",
    evidence: "Review recurring explicit approval mentions with product managers. Confirm whether certification is mandatory for the customer application before calling it a sales driver.",
  },
  {
    kind: "interpret", compound: "", effect: 0, effectLabel: "", title: "Avoid counting the same sales twice",
    evidence: "A text can name several approvals. Its revenue belongs to one text here; assigning it to several approval rankings would create overlapping values.",
  },
];

/* -- the pilot's approval evidence (index.html approvalCategory, mentionSummary) --------------------------------- */

/** The references the pilot ranks, in its order. */
export const APPROVAL_REFS = ["FDA", "WRAS", "NSF", "ACS", "DVGW", "USP", "KTW", "BfR"] as const;

/**
 * Each reference's figures: the texts naming it, its letters anywhere in the text, as the pilot reads them - a text
 * naming two counts in both, so the references overlap and never add up. The largest first.
 */
export function approvalRefs(approvals: { name: string; rev: number; gp: number }[]): Figure[] {
  return APPROVAL_REFS.map((ref) => {
    const of = approvals.filter((a) => !noApproval(a.name) && a.name.toLowerCase().includes(ref.toLowerCase()));
    const rev = of.reduce((t, a) => t + a.rev, 0), gp = of.reduce((t, a) => t + a.gp, 0);
    return { key: ref, name: ref, rev, gp, margin: rev ? gp / rev : 0 };
  }).sort((a, b) => b.rev - a.rev);
}

export type ApprovalKind = "none" | "datasheet" | "explicit" | "other";
/** The pilot's indicative categories, in its order - a text's keywords, never a validated approval. */
export const APPROVAL_KINDS: { key: ApprovalKind; name: string }[] = [
  { key: "none", name: "No approval written" },
  { key: "datasheet", name: "Datasheet reference" },
  { key: "explicit", name: "Explicit references" },
  { key: "other", name: "Other texts" },
];

/** A text's category, by the pilot's keywords (index.html approvalCategory). */
export function approvalKind(name: string): ApprovalKind {
  if (noApproval(name)) return "none";
  if (/FDA|WRAS|NSF|ACS|DVGW|KTW|USP|1935|3-A|BfR|BFR|LFGB|EN 681|4020|W270|RoHS/i.test(name)) return "explicit";
  if (/datasheet|data sheet|TDS|Datenblatt|Datenvblatt/i.test(name)) return "datasheet";
  return "other";
}

/** The net revenue of each category, every category in the pilot's order (a zero when none). */
export function approvalKinds(approvals: { name: string; rev: number; gp: number }[]): Figure[] {
  return APPROVAL_KINDS.map(({ key, name }) => {
    const of = approvals.filter((a) => approvalKind(a.name) === key);
    const rev = of.reduce((t, a) => t + a.rev, 0), gp = of.reduce((t, a) => t + a.gp, 0);
    return { key, name, rev, gp, margin: rev ? gp / rev : 0 };
  });
}

/* -- the pilot's material cards (revision.js materialCards) ------------------------------------------------------- */

/** A family as the pilot's card shows it: its figures, how many compounds it holds, its share of the named compounds' revenue. */
export type FamilyFigure = Figure & { count: number; share: number };

export function familyFigures(compounds: Figure[]): FamilyFigure[] {
  const named = compounds.filter((c) => !noCompound(c.name));
  const total = named.reduce((t, c) => t + c.rev, 0);
  return sumBy(named, (c) => materialOf(c.name)).map((x) => ({
    ...x, count: named.filter((c) => materialOf(c.name) === x.key).length, share: total > 0 ? x.rev / total : 0,
  }));
}

/* -- the pilot's rankings and their controls (index.html chart, controls, detailView) ------------------------------ */

/** What a ranking ranks by - the pilot's "Rank by revenue / gross profit". */
export type RankBy = "rev" | "gp";

/**
 * The pilot's ranking: by net revenue or gross profit, the largest first (the name breaks a tie), the first `n` -
 * 0 all ("All entries"). The scatter takes the first ten of the same ranking, so its numbers match the list.
 */
export function rankBy<T extends { label: string; rev: number; gp: number }>(rows: T[], by: RankBy, n = 0): T[] {
  const out = [...rows].sort((a, b) => (by === "gp" ? b.gp - a.gp : b.rev - a.rev) || a.label.localeCompare(b.label));
  return n > 0 ? out.slice(0, n) : out;
}

/** The pilot's search: the name and the identifier, any case ("Search customers or identifiers…"). */
export function matchesQuery(name: string, id: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${name} ${id}`.toLowerCase().includes(q);
}

/** The caption of the customers' and articles' cards (revision.js analysis): one business unit chosen names it. */
export function actionsCaption(bus: string[]): string {
  return bus.length === 1 ? `${bus[0]} · account review priorities` : "Commercial priorities";
}

/** "FDA, WRAS and NSF appear in some texts" - the references with revenue, the largest first, the first `n`. */
export function leadingRefs(refs: { name: string; rev: number }[], n = 3): string[] {
  return refs.filter((r) => r.rev > 0).sort((a, b) => b.rev - a.rev).slice(0, n).map((r) => r.name);
}

/**
 * The pilot's "Definitions & source notes" (index.html, with revision.js's pending scope, material grouping and
 * opportunity scenarios) - in the words of the hub's figures: the ERP's invoices, read each morning, not the pilot's
 * top-30 extracts.
 */
export const SEALING_DEFINITIONS: { title: string; text: string }[] = [
  {
    title: "Period and population",
    text: "Every view reads the months chosen in the Filters - the year so far when none is chosen - against the same months a year earlier where the figures hold them. The population is every business unit's sealing invoices (profit centre DT) from the ERP's BI model, read each morning. The views overlap: customers, articles, compounds and approvals are the same invoices seen from different sides and must not be added together.",
  },
  {
    title: "Revenue and margin",
    text: "Revenue is the invoices' net revenue in EUR. Gross profit is the ERP's: the net revenue less the cost of the goods. Every margin is weighted - Σ gross profit / Σ net revenue - never an average of margins.",
  },
  {
    title: "Compound treatment",
    text: "Compounds are shown as written on the article; no names are merged. \"No info\", \"Unknown\", \"TBD\", an empty field and drawing descriptions are unresolved entries: they are left out of the named ranking and of the material families, and Materials & compounds can include them.",
  },
  {
    title: "Material grouping",
    text: "Families are derived from the compound's name, with Kalrez and Evolast treated as FFKM; HNBR, FKM (FPM), EPDM, NBR, VMQ (silicone) and PTFE by their letters. Unrecognised names stay Unclassified.",
  },
  {
    title: "Accounts and approvals",
    text: "Customer numbers remain separate even when two accounts carry the same name. Approvals are the texts written on the articles - not validated certification data. Their indicative categories come from keywords and need review. A text naming several references counts in each reference's card, so the references overlap; in the categories each text counts once.",
  },
  {
    title: "Opportunity scenarios",
    text: "+5 percentage points of margin and +10% revenue are illustrative sensitivities, not forecasts or agreed targets. Gross-profit impacts use the period's figures and current margins. Product mix, costs, demand and capacity must be validated.",
  },
  {
    title: "Recommendations",
    text: "Recommendations are review actions found in these figures. Without targets or market potential, the review cannot establish lost share, business-unit underperformance or causation.",
  },
  {
    title: "Pending scope decisions",
    text: "No customer is excluded from any view. The pilot noted a possible future exclusion of Sonceboz Motion Boncourt SA and a second, unidentified one (\"DMI\"); neither is applied here.",
  },
];

/* -- the pilot's drawer: one customer, article or compound and what it is made of -------------------------------- */

/** What the detail window can open: a customer's articles, an article's customers, a compound's customers. */
export type DetailKind = "customer" | "article" | "compound";
export const isDetailKind = (s: unknown): s is DetailKind => s === "customer" || s === "article" || s === "compound";

/* -- the pages' figures, laid out as Digital Growth's (SARCLA 10.11.2026: "look at Digital Growth for example") ------ */

/** A month of a figure: this period's value and the same month a year earlier (null: before the figures' first month). */
export type MonthPair = { month: string; cur: number | null; prev: number | null };

/** A key's figures in each month of the period, and the same month a year earlier (null: not in the figures). */
export type KeyMonth = { key: string; month: string; rev: number; gp: number; prevRev: number | null; prevGp: number | null };

/**
 * Each key's months of the period, with the same month a year earlier beside it - every key that sold in either, every
 * month of the period (a month without a sale is a zero, a month a year before the figures' first month is not known).
 */
export function keyMonths(
  period: string[],
  now: { key: string; month: string; rev: number; gp: number }[],
  before: { key: string; month: string; rev: number; gp: number }[],
  firstHeld: string | null,
): KeyMonth[] {
  const at = (rows: typeof now) => {
    const m = new Map<string, { rev: number; gp: number }>();
    for (const r of rows) {
      const k = `${r.key}\u0000${r.month}`;
      const x = m.get(k) ?? { rev: 0, gp: 0 };
      x.rev += r.rev;
      x.gp += r.gp;
      m.set(k, x);
    }
    return m;
  };
  const n = at(now), b = at(before);
  const keys = [...new Set([...now, ...before].map((r) => r.key))];
  return keys.flatMap((key) => period.map((month) => {
    const py = yearBefore(month), known = !!firstHeld && py >= firstHeld;
    const x = n.get(`${key}\u0000${month}`), y = b.get(`${key}\u0000${py}`);
    return { key, month, rev: x?.rev ?? 0, gp: x?.gp ?? 0, prevRev: known ? y?.rev ?? 0 : null, prevGp: known ? y?.gp ?? 0 : null };
  }));
}

/**
 * A figure added up over the period, against the same months a year earlier - like for like: when only some of those
 * months are in the figures, `same` is this period on those months alone (`sameMonths`), and `prev` covers them too.
 * None of them known: no comparison (`prev` null).
 */
export function sumMonths(ms: MonthPair[]): { cur: number; prev: number | null; same: number | null; sameMonths: string[] } {
  const cur = ms.reduce((a, m) => a + (m.cur ?? 0), 0);
  const known = ms.filter((m) => m.prev != null);
  if (!known.length) return { cur, prev: null, same: null, sameMonths: [] };
  const prev = known.reduce((a, m) => a + (m.prev ?? 0), 0);
  if (known.length === ms.length) return { cur, prev, same: null, sameMonths: [] };
  return { cur, prev, same: known.reduce((a, m) => a + (m.cur ?? 0), 0), sameMonths: known.map((m) => m.month) };
}

/**
 * A rate of two sums over the period (gross profit over net revenue, the revenue without a compound over all of it) -
 * the rate of the sums, never an average of the months' rates; like for like as sumMonths.
 */
export function rateMonths(num: MonthPair[], den: MonthPair[]): { cur: number | null; prev: number | null; same: number | null; sameMonths: string[] } {
  const n = sumMonths(num), d = sumMonths(den);
  const div = (a: number | null, b: number | null) => (a == null || !b ? null : a / b);
  return { cur: div(n.cur, d.cur), prev: div(n.prev, d.prev), same: d.same != null ? div(n.same, d.same) : null, sameMonths: d.sameMonths };
}

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A figure's months as a tile draws them (Digital Growth's MiniBars): a period inside one calendar year on its twelve
 * months, January first, the months outside it empty (`labels` null: the bars' own January to December); a period over a
 * year end on its own months, each named ("Nov 25").
 */
export function tileSeries(ms: MonthPair[]): { labels: string[] | null; months: (number | null)[]; py: (number | null)[] } {
  const years = new Set(ms.map((m) => m.month.slice(0, 4)));
  if (years.size <= 1) {
    const months: (number | null)[] = Array(12).fill(null), py: (number | null)[] = Array(12).fill(null);
    for (const m of ms) {
      const i = Number(m.month.slice(5, 7)) - 1;
      if (i < 0 || i > 11) continue;
      months[i] = m.cur;
      py[i] = m.prev;
    }
    return { labels: null, months, py };
  }
  return {
    labels: ms.map((m) => `${MON3[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(2, 4)}`),
    months: ms.map((m) => m.cur),
    py: ms.map((m) => m.prev),
  };
}

/** The share of the `n` largest in the total - null without a total. */
export function topShare(figs: { rev: number }[], n: number, total: number): number | null {
  if (!(total > 0)) return null;
  const top = [...figs].sort((a, b) => b.rev - a.rev).slice(0, n).reduce((a, x) => a + x.rev, 0);
  return top / total;
}

/** The months named for a like-for-like comparison: "Mar–Oct", "Oct", "Nov 25–Oct 26". */
export function monthsSpan(ms: string[]): string {
  if (!ms.length) return "";
  const a = ms[0], z = ms[ms.length - 1];
  const name = (m: string, y: boolean) => `${MON3[Number(m.slice(5, 7)) - 1]}${y ? ` ${m.slice(2, 4)}` : ""}`;
  const two = a.slice(0, 4) !== z.slice(0, 4);
  return a === z ? name(a, false) : `${name(a, two)}–${name(z, two)}`;
}

const MON_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The ready-made periods of the Filters window, as Who are our customers offers them: the year to date, the last month,
 * the last 12 months, last year and this year's whole quarters - each kept within the months the figures hold
 * (`min` .. `max`); a period wholly before the first month is left out.
 */
export function sealingPresets(min: string, max: string): { id: string; label: string; from: string; to: string }[] {
  if (!isMonth(min) || !isMonth(max) || min > max) return [];
  const y = Number(max.slice(0, 4));
  const atLeast = (m: string) => (m < min ? min : m);
  const back = (m: string, k: number) => {
    const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 - k;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  };
  const out = [
    { id: "ytd", label: "Year to date", from: atLeast(`${y}-01`), to: max },
    { id: "lm", label: `${MON_FULL[Number(max.slice(5, 7)) - 1]} ${y}`, from: max, to: max },
    { id: "12m", label: "Last 12 months", from: atLeast(back(max, 11)), to: max },
  ];
  if (`${y - 1}-12` >= min) out.push({ id: "ly", label: `Last year (${y - 1})`, from: atLeast(`${y - 1}-01`), to: `${y - 1}-12` });
  for (let q = 0; q < 4; q++) {
    const from = `${y}-${String(q * 3 + 1).padStart(2, "0")}`, to = `${y}-${String(q * 3 + 3).padStart(2, "0")}`;
    if (to <= max && to >= min) out.push({ id: `q${q + 1}`, label: `Q${q + 1} ${y}`, from: atLeast(from), to });
  }
  return out;
}
