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

export type Priority = {
  kind: "margin" | "growth" | "spread";
  title: string;
  evidence: string;
  next: string;
  /** the illustrative effect, in EUR of gross profit - never a forecast */
  effect: number;
  effectLabel: string;
  compound: string;
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
      effect: p.rev * 0.05, effectLabel: "Illustrative +5 pp at current sales",
    });
  }

  const big = named.filter((c) => c.rev >= 1_000_000).sort((a, b) => b.margin - a.margin)[0];
  if (big) {
    out.push({
      kind: "growth", compound: big.name,
      title: "Test growth in a sizeable, high-margin compound",
      evidence: `${big.name} generates ${eur(big.rev)} at ${pc(big.margin)} GM.`,
      next: "Ask sales to identify application-matched opportunities around existing accounts and validate capacity, pricing and demand before setting a target.",
      effect: big.rev * 0.1 * big.margin, effectLabel: "Illustrative +10% sales at current GM",
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
      effect: 0, effectLabel: "Validate causes before any repricing",
    });
    break;
  }
  return out;
}
