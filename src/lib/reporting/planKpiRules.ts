// THE ACTION PLAN'S KPIS - what can measure an action or a category, and how far it is from its target (SARCLA
// 03.11.2026: "for the KPI we should have a library of the reports available on Advanced reporting - every time one is
// deleted, changed or added it should also change here - select multiple, set up a target and measure the success per
// KPI; or ask the AI to read all the actions and bring proposed KPIs aligned with the sub-actions"). The library is
// read from the two lists the hub itself runs on, nothing kept by hand: Advanced reporting's menu (categories.ts) - every
// report and page in it - and the KPI catalogue (catalogue.ts), each KPI with its stage page. A report added, renamed or
// removed there is one here with the same release. Picked: "Both kinds" - a catalogue KPI the hub reads is measured
// live, its year so far against the target; a report, or a KPI the hub does not read, by a figure typed with its date.
import { REPORT_CATEGORIES } from "./categories";
import { KPIS, STAGES } from "../marketingKpis/catalogue";
import { stageName } from "../marketingKpis/stageNames";

export type LibraryItem = {
  /** "kpi:R05", "report:<a page's address>" or "tile:<a page's address>#<the graph's key>" */
  key: string;
  kind: "kpi" | "report" | "graph";
  name: string;
  /** where it is in Advanced reporting: "ESO Reports › ESO KPIs › Visits" */
  path: string;
  href: string;
  unit: string;
  /** a catalogue KPI's id - measured live when the hub reads it */
  kpiId?: string;
  definition?: string;
  /** the catalogue's own target, as written there ("+10% vs 2025") */
  target?: string;
};

/** A place of Advanced reporting and what is in it - a category, a report, a page, a graph or a KPI on a page. */
export type LibNode = {
  key: string;
  kind: "category" | "report" | "page" | "graph" | "kpi";
  name: string;
  href: string;
  path: string;
  /** a page's heading in the side panel ("Other reports") */
  group?: string;
  /** what a graph shows, as its page last drew it - its words, the figure they open with, when */
  shown?: { text: string; value: number | null; at: string | null };
  unit?: string; kpiId?: string; definition?: string; target?: string;
  children: LibNode[];
};
/** A graph a page has drawn (reportTiles.ts). */
export type TileSeen = { path: string; key: string; title: string; kind: string; kpiId: string | null; summary?: string | null; value?: number | null; at?: string | null };

/** The figure a graph's own words open with - "30,216 Jan-Sep" 30216, "12.5% of visits" 12.5, "CHF 4'000" 4000 - or null. */
export function figureOf(text: string): number | null {
  const m = text.replace(/(CHF|EUR|€|\$)\s*/gi, "").match(/-?\d[\d',’]*(?:\.\d+)?/);
  return m ? numberOf(m[0]) : null;
}

const STAGE_PAGE = /^\/reporting\/marketing-kpis\/([a-z-]+)$/;

/**
 * Advanced reporting as its side panel has it (SARCLA 03.11.2026: "the individual reports like a library ... this should
 * be hierarchy dynamic for picking up"): each category, its reports, their pages, and in each page what it draws - the
 * graphs it said it draws (TileSeen) and, on a Digital Growth stage page, the catalogue's KPIs of that stage, a graph
 * showing one of them being that KPI. A KPI of the catalogue on no page yet goes under Digital Growth's own report.
 */
export function libraryTree(tiles: TileSeen[] = []): LibNode[] {
  const byPage = new Map<string, TileSeen[]>();
  for (const t of tiles) (byPage.get(t.path) ?? byPage.set(t.path, []).get(t.path)!).push(t);
  const shownOf = (t: TileSeen | undefined) => (t?.summary ? { text: t.summary, value: t.value ?? null, at: t.at ?? null } : undefined);
  // a KPI's figure: the latest a graph showing it said, wherever it is drawn (its page, the BUC View)
  const byKpi = new Map<string, TileSeen>();
  for (const t of tiles) if (t.kpiId && t.summary && (!byKpi.has(t.kpiId) || (t.at ?? "") > (byKpi.get(t.kpiId)!.at ?? ""))) byKpi.set(t.kpiId, t);
  const stageBySlug = new Map(STAGES.map((s) => [s.slug, s]));
  const placed = new Set<string>();
  const kpiNode = (id: string, href: string, path: string, name?: string): LibNode | null => {
    const k = KPIS.find((x) => x.id === id);
    if (!k && !name) return null;
    placed.add(id);
    return { key: `kpi:${id}`, kind: "kpi", name: k ? `${k.id} ${k.name}` : `${id} ${name}`, href, path, unit: k?.unit ?? "", kpiId: id, definition: k?.definition, target: k?.target,
      ...(byKpi.has(id) ? { shown: shownOf(byKpi.get(id)) } : {}), children: [] };
  };
  const inside = (href: string, path: string): LibNode[] => {
    const out: LibNode[] = [];
    const ids = new Set<string>();
    for (const t of byPage.get(href) ?? []) {
      if (t.kpiId) { if (!ids.has(t.kpiId)) { const n = kpiNode(t.kpiId, href, path, t.title); if (n) { out.push(n); ids.add(t.kpiId); } } continue; }
      out.push({ key: `tile:${href}#${t.key}`, kind: "graph", name: t.title, href, path, ...(t.summary ? { shown: shownOf(t) } : {}), children: [] });
    }
    const m = href.match(STAGE_PAGE);
    const stage = m ? stageBySlug.get(m[1]) : undefined;
    if (stage) for (const k of KPIS) if (k.stage === stage.id && !ids.has(k.id)) { const n = kpiNode(k.id, href, path); if (n) { out.push(n); ids.add(k.id); } }
    return out;
  };
  const tree = REPORT_CATEGORIES.map((c): LibNode => ({
    key: `category:${c.slug}`, kind: "category", name: c.name, href: "", path: "",
    children: c.reports.map((r): LibNode => {
      const here = `${c.name} › ${r.name}`;
      const pages = (r.children ?? []).map((ch): LibNode => ({ key: `report:${ch.href}`, kind: "page", name: ch.name, href: ch.href, path: here, group: ch.group, children: inside(ch.href, `${here} › ${ch.name}`) }));
      // the report as a whole: its own page (its BUC View) - a report that opens on its first page keeps a key of its own
      const own = r.overviewHref ?? r.href;
      const key = pages.some((pg) => pg.href === own) ? `report:${own}#report` : `report:${own}`;
      return { key, kind: "report", name: r.name, href: own, path: c.name, children: pages.length ? pages : inside(r.href, here) };
    }),
  }));
  // the catalogue's KPIs on no page: under Digital Growth's report, so every one can be picked
  const rest = KPIS.filter((k) => !placed.has(k.id));
  const dg = tree.flatMap((c) => c.children).find((r) => r.href.startsWith("/reporting/marketing-kpis"));
  if (rest.length && dg) {
    const path = `${dg.path} › ${dg.name}`;
    dg.children.push({ key: "report:/reporting/marketing-kpis#no-page", kind: "page", name: "KPIs on no page yet", href: "/reporting/marketing-kpis", path, group: "Other reports",
      children: rest.map((k) => kpiNode(k.id, "/reporting/marketing-kpis", `${path} › KPIs on no page yet`)!).filter(Boolean) });
  }
  return tree;
}

/** The library as a list - every report, page, graph and KPI once, for a search and for what is picked. */
export function flatLibrary(tree: LibNode[]): LibraryItem[] {
  const out: LibraryItem[] = [];
  const seen = new Set<string>();
  const walk = (n: LibNode) => {
    if (n.kind !== "category" && !seen.has(n.key)) {
      seen.add(n.key);
      out.push({ key: n.key, kind: n.kind === "kpi" ? "kpi" : n.kind === "graph" ? "graph" : "report", name: n.name, path: n.path, href: n.href, unit: n.unit ?? "",
        ...(n.kpiId ? { kpiId: n.kpiId } : {}), ...(n.definition ? { definition: n.definition } : {}), ...(n.target ? { target: n.target } : {}) });
    }
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

/** Every report and page of Advanced reporting, every KPI of the catalogue - and the graphs pages have drawn. */
export const kpiLibrary = (tiles: TileSeen[] = []): LibraryItem[] => flatLibrary(libraryTree(tiles));

export type Progress = { share: number | null; state: "none" | "behind" | "close" | "reached" };
/**
 * How far a KPI is to its target: the share of it reached - the value over the target, or, where lower is better (cost,
 * position, bounce), the target over the value - and whether it is reached, close (four fifths) or behind.
 */
export function progressOf(current: number | null | undefined, target: number | null | undefined, goodUp = true): Progress {
  if (current == null || target == null || !Number.isFinite(current) || !Number.isFinite(target)) return { share: null, state: "none" };
  const share = Math.max(0, goodUp ? (target === 0 ? (current >= 0 ? 1 : 0) : current / target) : current <= 0 ? 1 : target / current);
  return { share, state: share >= 1 ? "reached" : share >= 0.8 ? "close" : "behind" };
}

/** A figure as people type it - "1'250", "1,250", "12.5", "12,5 %" - or null. */
export function numberOf(text: string): number | null {
  let t = text.replace(/[\s'’%€]|chf/gi, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (/^-?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
