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
  /** "kpi:R05" or "report:<its address>" */
  key: string;
  kind: "kpi" | "report";
  name: string;
  /** where it is in Advanced reporting: "ESO Reports › ESO KPIs" */
  path: string;
  href: string;
  unit: string;
  /** a catalogue KPI's id - measured live when the hub reads it */
  kpiId?: string;
  definition?: string;
  /** the catalogue's own target, as written there ("+10% vs 2025") */
  target?: string;
};

/** Every report and page of Advanced reporting, then every KPI of the catalogue - one entry each. */
export function kpiLibrary(): LibraryItem[] {
  const out: LibraryItem[] = [];
  const seen = new Set<string>();
  const add = (x: LibraryItem) => { if (!seen.has(x.key)) { seen.add(x.key); out.push(x); } };
  for (const c of REPORT_CATEGORIES) {
    for (const r of c.reports) {
      add({ key: `report:${r.href}`, kind: "report", name: r.name, path: c.name, href: r.href, unit: "" });
      for (const ch of r.children ?? []) add({ key: `report:${ch.href}`, kind: "report", name: ch.name, path: `${c.name} › ${r.name}`, href: ch.href, unit: "" });
    }
  }
  const stages = new Map(STAGES.map((s) => [s.id, s]));
  for (const k of KPIS) {
    const s = stages.get(k.stage);
    add({
      key: `kpi:${k.id}`, kind: "kpi", name: `${k.id} ${k.name}`, path: `Digital Growth KPIs › ${s ? stageName(s.slug, s.name) : "Other"}`,
      href: s ? `/reporting/marketing-kpis/${s.slug}` : "/reporting/marketing-kpis", unit: k.unit, kpiId: k.id,
      definition: k.definition, target: k.target,
    });
  }
  return out;
}

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
