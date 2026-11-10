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
import { mapText, pageMap, partOfSelection, type PagePart } from "./places";
import { PLAN_SCHEMA, cleanPlan, pageWords, planSystem, planUser, type FillHow, type PlanMode } from "./plan";

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

/** "Fill a plan's module from the shop" (read only). */
const planFill: ServerAction = async (ctx, raw, input) => {
  const d = viewOf(pageDoc(raw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);
  const f = (input.fill && typeof input.fill === "object" ? input.fill : {}) as Record<string, unknown>;
  const how = (["page", "category", "technologies", "viewed", "bought", "numbers", "none"] as FillHow[]).find((h) => h === f.how) ?? "none";
  return fillModule({
    module: s(input.module, 60), store: readStore(d.store),
    fill: { how, category: s(f.category, 400), numbers: s(f.numbers, 600), count: Math.max(0, Math.min(24, Math.round(Number(f.count) || 0))) },
    count: Math.round(Number(input.count) || 0) || undefined,
  });
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
        context: context(ctx, d), page, parts: p.parts, partsText: mapText(p.parts), tree: p.tree, language: languageOfStore(d.store) ?? "German", store: d.store,
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
        parts: p.parts, container: p.container, categories: p.tree.map((t) => t.url), pageUrl: shopUrl("prod", p.d.path), pageKind: c.kind,
        pageText: `${pageWords(p.parts)} ${facts}`, newId: () => changeId(),
      });
      // the parts the steps aim at, for the studio's lines and its "+" (small: ids, headings, selectors)
      const used = new Set(plan.steps.map((x) => x.at));
      return { plan, parts: p.parts.filter((x) => used.has(x.id)).map(({ text: _t, ...x }) => x) };
    },
  };
}
