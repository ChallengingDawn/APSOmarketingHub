// ARTICLES CY/LY - every article's revenue this year against last year.
//
// Moved from the Compass connector's article_report.py (05.10.2026), which built
// it from the Orders object's order_positions_json. Two things are new here:
//
// 1. An order counts ONCE. HubSpot holds an order as placed (`.000`) AND its
//    deliveries (`.001`, `.002` …); the connector summed every document, so a
//    delivered order counted twice - 47% of September 2026's positions, 14% of
//    September 2025's, which also bent every this-year-vs-last-year comparison.
//    Per order and article the larger of "as placed" and "delivered" is taken:
//    an order not delivered yet still counts, a delivered one once.
// 2. Like for like. This year to date is compared with the SAME days of last
//    year; the full last year is shown beside it, never as the delta's base.
//
// `basis: "documents"` reproduces the connector exactly - it exists so the port
// can be checked against it, and to say how much the old figures overstated.

export type FixEntry = { n: string; t?: string; pc?: string };
export type FixMap = Record<string, FixEntry>;
export type Basis = "orders" | "documents";

/** Credit-note / accounting / service pseudo-articles: real revenue, but no "mover". */
export const PSEUDO_ARTICLES = new Set([
  "3394560", "3394578", "3394540", "3390971", "21448654",
  "471395", "471398", "469514", "480864", "480870", "849884",
  "518784", "4834770", "4389942",
  "2049553", "491469", "480861", "471389",
  "2952351", "433933", "22498505",
  "4451607", "4480195", "18485341", "774810",
]);

// cp1252 puts printable characters in 0x80-0x9F where latin-1 has controls.
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** _fix_text: repair a double-encoded text when the round trip is clean (cp1252, then latin-1). */
export function fixText(s: string): string {
  if (!s || (!s.includes("Ã") && !s.includes("Â"))) return s;
  for (const codec of ["cp1252", "latin1"] as const) {
    const bytes: number[] = [];
    let ok = true;
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if (c < 0x100 && (codec === "latin1" || c < 0x80 || c > 0x9f)) bytes.push(c);
      else if (codec === "cp1252" && CP1252[c] !== undefined) bytes.push(CP1252[c]);
      else { ok = false; break; }
    }
    if (!ok) continue;
    try {
      const fixed = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
      if (!fixed.includes("�")) return fixed;
    } catch {
      /* not a clean round trip */
    }
  }
  return s;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Python's round(x, 1): half to even. */
function pyRound1(x: number): number {
  const m = x * 10;
  const f = Math.floor(m);
  const d = m - f;
  const n = Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(m);
  return n / 10;
}

export type Line = { art: string; rev: number; qty: number; text: string; pc: string };

/** The connector's loop over order_positions_json: id repaired through the fixmap, text and PC from it first. */
export function lines(positionsJson: unknown, fixmap: FixMap): Line[] {
  let arr: unknown;
  try {
    arr = JSON.parse(str(positionsJson) || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: Line[] = [];
  for (const raw of arr) {
    if (typeof raw !== "object" || raw === null) continue;
    const x = raw as Record<string, unknown>;
    let art = str(x.a || x.article).trim();
    if (!art) continue;
    const fm = fixmap[art];
    if (fm) art = fm.n;
    out.push({
      art,
      rev: num(x.r || x.revenue),
      qty: num(x.q || x.qty),
      text: (fm?.t || fixText(str(x.t || x.text)).slice(0, 90)),
      pc: fm?.pc || str(x.pc).trim(),
    });
  }
  return out;
}

export type Doc = { no: string; date: string; un: string | null; lines: Line[] };

type Acc = {
  cy: number; lyYtd: number; ly: number;
  qtyCy: number; qtyLyYtd: number; qtyLy: number;
  linesCy: number; linesLyYtd: number; linesLy: number;
  cuCy: Set<string>; cuLyYtd: Set<string>; cuLy: Set<string>;
  text: string; pc: string;
};

/**
 * One order's contribution per article. "documents": every document as it is.
 * "orders": the documents sharing a base number are one order; per article the
 * larger of as-placed (.000) and delivered (.001+), so nothing counts twice.
 */
function orderUnits(docs: Doc[], basis: Basis): { date: string; un: string | null; lines: Line[] }[] {
  if (basis === "documents") return docs;
  const byBase = new Map<string, Doc[]>();
  for (const d of docs) {
    const base = d.no.includes(".") ? d.no.slice(0, d.no.lastIndexOf(".")) : d.no;
    const k = base || `#${d.no}`;
    byBase.set(k, [...(byBase.get(k) ?? []), d]);
  }
  const out: { date: string; un: string | null; lines: Line[] }[] = [];
  for (const group of byBase.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    const placed = group.filter((d) => d.no.endsWith(".000"));
    const delivered = group.filter((d) => !d.no.endsWith(".000"));
    if (!placed.length || !delivered.length) { for (const d of group) out.push(d); continue; }
    const sum = (ds: Doc[]) => {
      const m = new Map<string, Line & { n: number }>();
      for (const d of ds) for (const l of d.lines) {
        const a = m.get(l.art);
        if (a) { a.rev += l.rev; a.qty += l.qty; a.n += 1; a.text ||= l.text; a.pc ||= l.pc; }
        else m.set(l.art, { ...l, n: 1 });
      }
      return m;
    };
    const p = sum(placed), dl = sum(delivered);
    const merged: Line[] = [];
    for (const art of new Set([...p.keys(), ...dl.keys()])) {
      const a = p.get(art), b = dl.get(art);
      // the delivered figure wins unless the order as placed is larger (not all of it delivered yet)
      const take = !b ? a! : !a ? b : (a.rev > b.rev && a.rev >= 0 ? a : b);
      merged.push({ art, rev: take.rev, qty: take.qty, text: a?.text || b?.text || "", pc: a?.pc || b?.pc || "" });
    }
    // the order's day and customer: as placed
    out.push({ date: placed[0].date, un: placed[0].un ?? delivered[0].un, lines: merged });
  }
  return out;
}

export type ArticleRow = {
  article: string;
  description: string;
  pc: string;
  pseudo: boolean;
  /** This year to date. */
  revenueCy: number;
  /** Last year, the same days. */
  revenueLyYtd: number;
  /** Last year, all of it. */
  revenueLy: number;
  /** Like for like: this year to date minus the same days of last year. */
  delta: number;
  deltaPct: number | null;
  qtyCy: number; qtyLyYtd: number; qtyLy: number;
  linesCy: number; linesLyYtd: number; linesLy: number;
  customersCy: number; customersLyYtd: number; customersLy: number;
  countries: string;
};

export type ReportOptions = { cy: number; ly: number; today: string; basis: Basis };

/** Aggregate the documents per article. Description/PC gaps are filled later from the catalogue. */
export function aggregate(docs: Doc[], o: ReportOptions): Map<string, Acc> {
  const md = o.today.slice(5, 10);
  const agg = new Map<string, Acc>();
  for (const u of orderUnits(docs, o.basis)) {
    const year = u.date.slice(0, 4);
    const cur = year === String(o.cy);
    if (!cur && year !== String(o.ly)) continue;
    const ytd = !cur && u.date.slice(5, 10) <= md;
    for (const l of u.lines) {
      let a = agg.get(l.art);
      if (!a) {
        a = { cy: 0, lyYtd: 0, ly: 0, qtyCy: 0, qtyLyYtd: 0, qtyLy: 0, linesCy: 0, linesLyYtd: 0, linesLy: 0,
          cuCy: new Set(), cuLyYtd: new Set(), cuLy: new Set(), text: "", pc: "" };
        agg.set(l.art, a);
      }
      if (cur) {
        a.cy += l.rev; a.qtyCy += l.qty; a.linesCy += 1;
        if (u.un) a.cuCy.add(u.un);
      } else {
        a.ly += l.rev; a.qtyLy += l.qty; a.linesLy += 1;
        if (u.un) a.cuLy.add(u.un);
        if (ytd) {
          a.lyYtd += l.rev; a.qtyLyYtd += l.qty; a.linesLyYtd += 1;
          if (u.un) a.cuLyYtd.add(u.un);
        }
      }
      if (!a.text) a.text = l.text;
      if (!a.pc) a.pc = l.pc;
    }
  }
  return agg;
}

/** Articles still missing a description or a profit centre - for the catalogue. */
export const needsCatalogue = (agg: Map<string, Acc>) => [...agg.entries()].filter(([, a]) => !a.pc || !a.text).map(([k]) => k);

export function fillFromCatalogue(agg: Map<string, Acc>, cat: { article: string; description: string; pc: string }[]) {
  for (const c of cat) {
    const a = agg.get(c.article) ?? agg.get(c.article.replace(/^0+/, ""));
    if (!a) continue;
    if (!a.pc) a.pc = c.pc.trim();
    if (!a.text) a.text = fixText(c.description).slice(0, 90);
  }
}

export function rowsOf(agg: Map<string, Acc>, countryOf: (un: string) => string | null = () => null): ArticleRow[] {
  const rows: ArticleRow[] = [];
  for (const [art, a] of agg) {
    const delta = a.cy - a.lyYtd;
    const ctry = [...new Set([...a.cuCy, ...a.cuLy].map(countryOf).filter((c): c is string => !!c))].sort();
    rows.push({
      article: art, description: a.text, pc: a.pc || "?", pseudo: PSEUDO_ARTICLES.has(art),
      revenueCy: r2(a.cy), revenueLyYtd: r2(a.lyYtd), revenueLy: r2(a.ly),
      delta: r2(delta), deltaPct: a.lyYtd ? pyRound1((delta / a.lyYtd) * 100) : null,
      qtyCy: r2(a.qtyCy), qtyLyYtd: r2(a.qtyLyYtd), qtyLy: r2(a.qtyLy),
      linesCy: a.linesCy, linesLyYtd: a.linesLyYtd, linesLy: a.linesLy,
      customersCy: a.cuCy.size, customersLyYtd: a.cuLyYtd.size, customersLy: a.cuLy.size,
      countries: ctry.slice(0, 4).join("|") + (ctry.length > 4 ? `|+${ctry.length - 4}` : ""),
    });
  }
  return rows.sort((x, y) => y.revenueCy - x.revenueCy);
}

/* ── the figures on screen ─────────────────────────────────────────────── */

export type PcRow = { pc: string; n: number; cy: number; lyYtd: number; ly: number; delta: number };

export type Kpis = {
  articles: number;
  totalCy: number; totalLyYtd: number; totalLy: number; delta: number; deltaPct: number | null;
  gainers: number; losers: number;
  /** Sold this year, not at all last year. */
  newArticles: number; newRevenueCy: number;
  /** Sold by this date last year, nothing this year. */
  lostArticles: number; lostRevenueLyYtd: number;
  byPc: PcRow[];
};

export function kpis(rows: ArticleRow[]): Kpis {
  const totalCy = rows.reduce((a, r) => a + r.revenueCy, 0);
  const totalLyYtd = rows.reduce((a, r) => a + r.revenueLyYtd, 0);
  const pcs = new Map<string, PcRow>();
  for (const r of rows) {
    const p = pcs.get(r.pc) ?? { pc: r.pc, n: 0, cy: 0, lyYtd: 0, ly: 0, delta: 0 };
    p.n += 1; p.cy += r.revenueCy; p.lyYtd += r.revenueLyYtd; p.ly += r.revenueLy; p.delta += r.delta;
    pcs.set(r.pc, p);
  }
  const fresh = rows.filter((r) => r.revenueCy > 0 && !r.revenueLy);
  const lost = rows.filter((r) => r.revenueLyYtd > 0 && !r.revenueCy);
  return {
    articles: rows.length,
    totalCy: r2(totalCy), totalLyYtd: r2(totalLyYtd), totalLy: r2(rows.reduce((a, r) => a + r.revenueLy, 0)),
    delta: r2(totalCy - totalLyYtd), deltaPct: totalLyYtd ? pyRound1(((totalCy - totalLyYtd) / totalLyYtd) * 100) : null,
    gainers: rows.filter((r) => r.delta > 0).length,
    losers: rows.filter((r) => r.delta < 0).length,
    newArticles: fresh.length, newRevenueCy: r2(fresh.reduce((a, r) => a + r.revenueCy, 0)),
    lostArticles: lost.length, lostRevenueLyYtd: r2(lost.reduce((a, r) => a + r.revenueLyYtd, 0)),
    byPc: [...pcs.values()].map((p) => ({ ...p, cy: r2(p.cy), lyYtd: r2(p.lyYtd), ly: r2(p.ly), delta: r2(p.delta) })).sort((a, b) => b.cy - a.cy),
  };
}

export type SortKey = "revenueCy" | "revenueLyYtd" | "revenueLy" | "delta" | "deltaAsc" | "qtyCy" | "linesCy" | "customersCy";

export function filterRows(rows: ArticleRow[], o: { pc?: string | null; q?: string | null }): ArticleRow[] {
  const needle = (o.q ?? "").trim().toLowerCase();
  return rows.filter((r) => (!o.pc || r.pc === o.pc) && (!needle || r.article.includes(needle) || r.description.toLowerCase().includes(needle)));
}

export function sortRows(rows: ArticleRow[], key: SortKey): ArticleRow[] {
  const by: Record<SortKey, (r: ArticleRow) => number> = {
    revenueCy: (r) => -r.revenueCy, revenueLyYtd: (r) => -r.revenueLyYtd, revenueLy: (r) => -r.revenueLy,
    delta: (r) => -r.delta, deltaAsc: (r) => r.delta, qtyCy: (r) => -r.qtyCy, linesCy: (r) => -r.linesCy,
    customersCy: (r) => -r.customersCy,
  };
  const f = by[key] ?? by.revenueCy;
  return [...rows].sort((a, b) => f(a) - f(b));
}

/** Top and flop 20 by the like-for-like delta, pseudo-articles left out. */
export function movers(rows: ArticleRow[], n = 20): { top: ArticleRow[]; flop: ArticleRow[] } {
  const real = rows.filter((r) => !r.pseudo);
  return {
    top: [...real].sort((a, b) => b.delta - a.delta).slice(0, n).filter((r) => r.delta > 0),
    flop: [...real].sort((a, b) => a.delta - b.delta).slice(0, n).filter((r) => r.delta < 0),
  };
}
