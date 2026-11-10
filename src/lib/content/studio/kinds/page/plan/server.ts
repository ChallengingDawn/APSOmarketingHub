// PAGE - THE AI'S PLAN ON THE SERVER (Content v7, 10.11.2026). Behind the project's own access (the to-do's route).
//
// AI task  plan        "Ideas for this page", "Make it more convincing", a part's ask, a free ask: the AI is given the
//                      page's real parts (./places.ts, read from the shop's page with this store view's changes laid
//                      over it), the shop's categories, the library and worked plans (./plan.ts) - and answers with a
//                      plan of modules; what comes back is checked and resolved to places (./plan.ts cleanPlan)
// Action   plan_fill   one step's module filled from the shop (./fill.ts) - read only, nothing is written: the studio
//                      draws the module and saves it as a change of the store view

import type { AiTask, ServerAction, StudioCtx } from "../../../contract";
import { s } from "../../../contract";
import { classify } from "../../../../../convert/model";
import { changeId, languageOfStore, pageDoc, shopUrl, viewOf, type PageDoc } from "../model";
import { readShopPage } from "../shop";
import { readBrain } from "@/lib/brain";
import { fillModule, readStore, treeFor } from "./fill";
import { mapText, pageLinks, pageMap, partOfSelection, type PagePart } from "./places";
import { PLAN_SCHEMA, cleanPlan, pageWords, placeNow, planSystem, planUser, type FillHow, type PlanMode, type StepDo, type StepPlace } from "./plan";

const MODES: PlanMode[] = ["ideas", "convincing", "part", "ask"];
const modeIn = (input: Record<string, unknown>): PlanMode => MODES.find((m) => m === input.mode) ?? "ask";

/** The page as the plan reads it: its parts on the shop's page with this store view's changes, its categories. */
async function readPlanPage(ctx: StudioCtx, raw: unknown, input: Record<string, unknown>): Promise<{ d: PageDoc; parts: PagePart[]; container: string; html: string; tree: { name: string; url: string; depth: number }[] }> {
  const d = viewOf(pageDoc(raw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);
  if (d.source === "new" || !d.path) throw new Error("Pick the page first.");
  const r = await readShopPage(d);
  if (!r.ok) throw new Error(r.error);
  const map = pageMap(r.page.html, d);
  const tree = await treeFor(d.store).catch(() => []);
  return { d, parts: map.parts, container: map.container, html: r.page.html, tree };
}

/**
 * One step of a plan made ready (read only): its place found again on the page as it is NOW - every change applied, the
 * plan's earlier steps too, so a place by position never points at a block an earlier step put there (point 4) - and,
 * when it brings a module of products, categories or a picture, that module filled from the shop.
 */
const planFill: ServerAction = async (ctx, raw, input) => {
  const d = viewOf(pageDoc(raw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);
  const t = (input.target && typeof input.target === "object" ? input.target : null) as Record<string, unknown> | null;
  let place: StepPlace | null = null;
  let placeWhy = "";
  if (t) {
    const p = await readPlanPage(ctx, raw, input);
    const kind = t.kind === "module" || t.kind === "block" ? t.kind : "page";
    const doing = (["add", "replace", "words", "block"] as StepDo[]).find((x) => x === input.do) ?? "add";
    const earlier = Array.isArray(input.earlier) ? input.earlier.map((x) => s(x, 30)).filter(Boolean).slice(0, 8) : [];
    const r = placeNow({ do: doing, where: input.where === "before" || input.where === "after" ? input.where : "", target: { kind, fp: s(t.fp, 600) } }, p, earlier);
    place = r.place; placeWhy = r.why;
  }
  const f = (input.fill && typeof input.fill === "object" ? input.fill : {}) as Record<string, unknown>;
  const how = (["page", "category", "technologies", "viewed", "bought", "numbers", "none"] as FillHow[]).find((h) => h === f.how) ?? "none";
  const filled = input.module && input.shop === true ? await fillModule({
    module: s(input.module, 60), store: readStore(d.store),
    fill: { how, category: s(f.category, 400), numbers: s(f.numbers, 600), count: Math.max(0, Math.min(24, Math.round(Number(f.count) || 0))) },
    count: Math.round(Number(input.count) || 0) || undefined,
  }) : { items: [], feature: null, note: "", missing: [] };
  return { ...filled, place, placeWhy };
};

export const planActions: Record<string, ServerAction> = { plan_fill: planFill };

/** The plan as a task of the page studio, given how it says the project (its brief) - ../server.ts registers it. */
export function planTask(context: (ctx: StudioCtx, d: PageDoc) => string): AiTask {
  return {
    label: "Plan the page",
    schema: PLAN_SCHEMA,
    system: planSystem(),
    maxTokens: 9000,
    effort: "medium",
    user: async (ctx, raw, input) => {
      const p = await readPlanPage(ctx, raw, input);
      const d = p.d;
      const c = classify(d.path);
      const o = d.outline && d.outline.path === d.path ? d.outline : null;
      const selected = partOfSelection(p.html, d, p.parts, { selector: s(input.selector, 300), change: s(input.change, 30) });
      const page = `PAGE: ${shopUrl(d.env, d.path)} · ${c.kind} page · store view ${d.store} (${languageOfStore(d.store) ?? "German"})${o ? `
Title: ${o.title}
The page's H1 (above its content - it stays as it is): ${o.h1.join(" | ") || "-"}` : ""}`;
      return planUser({
        context: context(ctx, d), page, parts: p.parts, partsText: mapText(p.parts), tree: p.tree, links: pageLinks(p.html, d.store), language: languageOfStore(d.store) ?? "German", store: d.store,
        mode: modeIn(input), request: s(input.request, 2000), selected, selectedText: s(input.text, 400),
      });
    },
    clean: async (raw, docRaw, ctx, input) => {
      const p = await readPlanPage(ctx, docRaw, input);
      const c = classify(p.d.path);
      // what a word may name: the page's own words and the brand's facts
      const brain = await readBrain().catch(() => null);
      const facts = brain ? JSON.stringify([brain.brandVoice, brain.positioningGuard, brain.productContentRules]) : "";
      const plan = cleanPlan(raw, {
        parts: p.parts, container: p.container, categories: p.tree.map((t) => t.url), links: pageLinks(p.html, p.d.store).map((l) => l.url),
        linkNames: Object.fromEntries([...p.tree.map((t) => [t.url, t.name]), ...pageLinks(p.html, p.d.store).map((l) => [l.url, l.text])]), pageUrl: shopUrl("prod", p.d.path), pageKind: c.kind,
        pageText: `${pageWords(p.parts)} ${facts}`, newId: () => changeId(), lang: p.d.store.slice(0, 2), store: p.d.store,
      });
      // the parts the steps aim at, for the studio's lines and its "+" (small: ids, headings, selectors)
      const used = new Set(plan.steps.map((x) => x.at));
      return { plan, parts: p.parts.filter((x) => used.has(x.id)).map(({ text: _t, ...x }) => x) };
    },
  };
}
