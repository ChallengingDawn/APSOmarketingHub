// APSOconvert > A VERSION BUILT WITH THE CONTENT STUDIO'S MODULES (server).
//
// SARCLA 10.11.2026, on a version whose new block was three tiny bullets in a dashed box: "generation is really shit -
// the content agent ... quality is much higher" - and asked how: "its engine builds versions". So a version of a
// content page (./modularRules.ts usesModules) is made the way the Content page studio makes a page better
// (src/lib/content/studio/kinds/page/plan/*, the studio's own code, read only here):
//   1. the page's real parts (places.ts pageMap: P1, P2 ... with checked selectors; a revision's modules M1 ...)
//   2. the AI answers with a PLAN: modules of the library by id, at a part, with their words for this page (plan.ts) -
//      plus, for APSOconvert, "tweaks": new words for an element of the page itself (a button's label)
//   3. the plan checked (cleanPlan: a module the library has, a part the page has, no price, no discount, no stock or
//      delivery promise, no certificate the page does not name, the page's language)
//   4. each module filled from the shop (fill.ts: its products, categories, photos - never invented), FULL or left out,
//      drawn by the library's renderer - the same HTML the studio and Magento get
//   5. laid over the page as the version's changes, each with its module (so Content opens it again as a module)
// The module's words are in the page's language (what a visitor of that store view reads); what the person approving
// reads - the summary, each change's note - is English. Nothing comes back: the caller writes the old way.

import { brandSystemPrompt, readBrain } from "@/lib/brain";
import { changeId, emptyPage, languageOfStore, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { mapText, pageLinks, pageMap, partOfSelection } from "@/lib/content/studio/kinds/page/plan/places";
import { PLAN_SCHEMA, cleanPlan, pageWords, planSystem, planUser, stepChange, withFill, type PlanStep } from "@/lib/content/studio/kinds/page/plan/plan";
import { drawModule, fitModuleOf, fullGap, libModule, makeModule, moduleGapOf, readModule, withWords } from "@/lib/content/studio/kinds/page/plan/library";
import { fillModule, readStore, treeFor } from "@/lib/content/studio/kinds/page/plan/fill";
import { fillTries, needsShop } from "@/lib/content/studio/kinds/page/plan/newpage";
import type { ModuleRef } from "@/lib/content/studio/kinds/page/modules/types";
import { classify, type Env, type PageKind } from "./model";
import { validateChanges, type Change } from "./versions";
import { riskOf } from "./safety";
import { shopPart } from "./blockRules";
import { DROP_SCHEMA, TWEAKS_SCHEMA, bare, dropIn, inPlanOrder, listingWay, outlineSelectors, pointedAt, revised, tweaksIn, withIds, type ModChange } from "./modularRules";

type AskFn = <T>(system: string, user: string, schema: Record<string, unknown>, maxTokens: number) => Promise<{ ok: true; data: T } | { ok: false; error: string }>;

export type ModularIn = {
  /** the hub's AI (studio.ts ask: its daily budget) */
  ask: AskFn;
  page: { env: Env; path: string; url: string; html: string; kind: PageKind };
  /** the page's elements as the hub read them (studio.ts pageOutline: "selector · words") - for the tweaks */
  outline: string[];
  /** the optimization and the page's numbers, as the version's writer is told them */
  brief: string;
  letter: string;
  /** the person's words (the AI helper) */
  request: string | null;
  /** another version (B, C, D): the ones it has already */
  others: { letter: string; summary: string }[] | null;
  /** a revision: the version's changes now */
  current: Change[] | null;
  /** an optimization of one block: its selector - the plan works on that block (./blockRules.ts) */
  target?: string | null;
};
export type ModularOut = { ok: true; changes: Change[]; summary: string; problems: string[] } | { ok: false; error: string; budget: boolean };

const FRAME = `THIS PLAN IS ONE VERSION OF THE PAGE FOR AN A/B TEST (APSOconvert). The hub lays it over the shop's page and shows it
beside the page as it is; the version that wins is built in Magento by Content. It makes exactly THE OPTIMIZATION it is
given - the modules that do that, where a buyer meets them - and nothing else: 1 to 3 steps, the strongest first. Not a
redesign of the page.
Beside the steps, "tweaks": new words for an element of the page itself (a button's label, a heading) - only when the
optimization asks for exactly that, its selector exactly as THE PAGE'S ELEMENTS lists it, its words in the page's
language and under 80 characters. Otherwise [].
"drop" (a revision only): the version's own blocks to take out - when the person asks to remove one, or to MOVE one
(take it out and add the same module, with the same words, where it should stand). Never a part of the page itself.
"note" is the version's summary for the person approving it: ENGLISH, one line, under 16 words.`;

const cutLines = (lines: string[], max: number) => {
  const out: string[] = [];
  let n = 0;
  for (const l of lines) { if (n + l.length > max) break; out.push(l); n += l.length + 1; }
  return out;
};

/** The module a step brings, with its words for the page (not filled yet) - as the studio makes it (usePlan moduleOf). */
function moduleOf(step: Pick<PlanStep, "do" | "module" | "layout" | "words" | "link" | "link2" | "extras">, base: PageChange | null, store: string): ModuleRef | null {
  if (step.do === "words") {
    const m = base ? readModule((base as { module?: unknown }).module) : null;
    return m ? withWords(m, step.words, step.link, step.extras, step.link2) : null;
  }
  const m0 = makeModule(step.module, store);
  if (!m0) return null;
  const m1 = withWords(m0, step.words, step.link, step.extras, step.link2);
  return step.layout ? { ...m1, settings: { ...m1.settings, layout: step.layout } } : m1;
}

/**
 * A plan's steps made into the changes a version keeps, the way the Content studio applies them (usePlan apply): the
 * module with its words, filled from the shop and FULL (else left out, said), drawn by the library, at its place.
 */
export async function buildSteps(steps: PlanStep[], current: ModChange[], store: string, pageCategory: string | null = null): Promise<{ made: ModChange[]; problems: string[] }> {
  const problems: string[] = [];
  const made: ModChange[] = [];
  const shopStore = readStore(store);
  for (const step of steps) {
    problems.push(...step.problems);
    const base = step.place.how === "change" ? (current.find((c) => c.id === (step.place as { change: string }).change) as PageChange | undefined) ?? null : null;
    if (step.place.how === "change" && !base) { problems.push(`"${step.line}" left out: what it was to change is not in the version`); continue; }
    if (step.do === "block") {
      const ch = stepChange(step, step.html, null, base);
      if (ch) made.push(ch as ModChange);
      continue;
    }
    const m1 = moduleOf(step, base, store);
    if (!m1) { problems.push(`"${step.line}" left out: its module is not in the library`); continue; }
    let m2 = m1;
    if (step.do !== "words" && needsShop(m1.type)) {
      // filled from the shop, FULL: the AI's own fill, then the studio's other ways (most bought, most viewed ...)
      let filled: ModuleRef | null = null;
      let lack = "";
      // and last the category's products as the shop lists them (the AI's category, or this category page)
      const tries = fillTries(step);
      const listing = listingWay(tries, libModule(m1.type)?.takes === "products", pageCategory);
      // what each way gave, for the log when none filled it (the home pages' "Hero with three products", 11.11.2026)
      const tried: string[] = [];
      for (const t of listing ? [...tries, listing] : tries) {
        const mt = t.module === m1.type ? m1 : moduleOf({ ...step, module: t.module, layout: t.layout }, base, store);
        if (!mt) { tried.push(`${t.module}: not in the library`); continue; }
        const way = `${t.module} ${t.fill.how}${t.fill.category ? ` ${t.fill.category}` : ""}`;
        const out = await fillModule({ module: mt.type, store: shopStore, fill: t.fill, count: t.fill.count || undefined }).catch((e: Error) => { tried.push(`${way}: ${e.message.slice(0, 80)}`); return null; });
        if (!out) continue;
        const m = withFill(mt, out, t.fill);
        lack = fullGap(m);
        tried.push(`${way}: ${lack ? low(lack) : "full"}`);
        if (!lack) { filled = m; break; }
      }
      if (!filled) {
        console.log(`[convert-fill] ${store} "${step.line.slice(0, 80)}" not filled - ${tried.join(" | ").slice(0, 600)}`);
        problems.push(`"${step.line}" left out: the shop could not fill it${lack ? ` (${low(lack)})` : ""}`);
        continue;
      }
      m2 = filled;
    }
    const gap = step.do === "words" ? moduleGapOf(m2) : fullGap(m2);
    if (gap) { problems.push(`"${step.line}" left out: ${low(gap)}`); continue; }
    const fit = fitModuleOf(m2);
    const ch = stepChange(step, drawModule(fit.m), fit.m, base);
    if (ch) made.push(ch as ModChange);
  }
  return { made, problems };
}

/** The changes a version may carry - each validated with its module kept beside it; none that rewrites the shop's own
 * parts, except a whole block of the page the hub itself found (`own`: its parts' selectors - phase 1 replaces those). */
export function keepSafe(all: ModChange[], own: Set<string>, problems: string[]): ModChange[] {
  const kept: ModChange[] = [];
  for (const c of all) {
    const v = validateChanges(bare([c]));
    if (!v.changes[0]) { problems.push(...v.problems); continue; }
    const whole = (c.op === "replace" || c.op === "insert") && own.has((c as { selector: string }).selector);
    const risk = whole ? [] : riskOf(v.changes).flatMap((x) => x.problems);
    if (risk.length) { problems.push(`left out - it ${risk[0]}`); continue; }
    kept.push(c);
  }
  return kept;
}

const low = (t: string) => (t ? `${t.charAt(0).toLowerCase()}${t.slice(1).replace(/[.\s]+$/, "")}` : t);

export async function moduleVersion(a: ModularIn): Promise<ModularOut> {
  const store = classify(a.page.path).store ?? "de-CH";
  const language = languageOfStore(store) ?? "German";
  const current = a.current ? withIds(a.current) : [];
  const view: PageDoc = { ...emptyPage(), env: a.page.env, path: a.page.path, store, changes: current as PageChange[] };
  const map = pageMap(a.page.html, view);
  // a block of the shop outside the main column (the newsletter band): a part of its own
  if (a.target && !map.parts.some((p) => p.selector === a.target)) {
    const sp = shopPart(a.page.html, a.target, "the block");
    if (sp && !partOfSelection(a.page.html, view, map.parts, { selector: a.target })) map.parts.push(sp);
  }
  if (!map.parts.length) return { ok: false, error: "The page's parts could not be read for the modules.", budget: false };
  const [tree, brain] = await Promise.all([treeFor(store).catch(() => []), readBrain().catch(() => null)]);
  const links = pageLinks(a.page.html, store);
  const pointed = pointedAt(a.request);
  const selected = pointed ? partOfSelection(a.page.html, view, map.parts, { selector: pointed.selector })
    : a.target ? map.parts.find((p) => p.selector === a.target) ?? partOfSelection(a.page.html, view, map.parts, { selector: a.target }) : null;

  const context = `${a.brief}${a.others?.length ? `

THE VERSIONS IT HAS ALREADY:
${a.others.map((v) => `Version ${v.letter}: ${v.summary}`).join("\n")}
THIS IS VERSION ${a.letter}: a clearly different way to make the same optimization - other modules, another place or
another emphasis - so the versions can be tested against the page and against each other.` : ""}${current.length ? `

THIS IS A REVISION OF VERSION ${a.letter}: its blocks are on the page already (the parts M1, B1 ...). Change what the person
asks - new words for a module, a better module in its place, one more - and leave the rest as it is.` : ""}`;
  const request = a.request?.trim()
    ? a.request.trim()
    : current.length ? "Improve this version." : "Make THE OPTIMIZATION above on this page.";
  const elements = cutLines(a.outline, 3500);
  const user = `${planUser({
    context, page: `PAGE: ${a.page.url} · ${a.page.kind} page · store view ${store} (${language})`,
    parts: map.parts, partsText: mapText(map.parts), tree, links, language, store,
    mode: selected ? "part" : "ask", request, selected, selectedText: pointed?.text ?? "",
  })}

THE PAGE'S ELEMENTS (for "tweaks" only - selector · its words):
${elements.join("\n") || "(none read)"}`;
  const system = `${brain ? `${brandSystemPrompt(brain, "seo")}\n\n` : ""}${planSystem()}\n\n${FRAME}`;
  const schema = { ...PLAN_SCHEMA, required: [...PLAN_SCHEMA.required, "tweaks", "drop"], properties: { ...PLAN_SCHEMA.properties, tweaks: TWEAKS_SCHEMA, drop: DROP_SCHEMA } };
  const r = await a.ask<Record<string, unknown>>(system, user, schema, 9000);
  if (!r.ok) return { ok: false, error: r.error, budget: /times today/.test(r.error) };

  const facts = brain ? JSON.stringify([brain.brandVoice, brain.positioningGuard, brain.productContentRules]) : "";
  const linkNames = Object.fromEntries([...tree.map((t) => [t.url, t.name]), ...links.map((l) => [l.url, l.text])]);
  const plan = cleanPlan(r.data, {
    parts: map.parts, container: map.container, categories: tree.map((t) => t.url), links: links.map((l) => l.url), linkNames,
    pageUrl: `https://www.apsoparts.com${a.page.path}`, pageKind: a.page.kind, pageText: `${pageWords(map.parts)} ${facts}`,
    newId: () => changeId(), lang: store.slice(0, 2), store,
  });
  const problems: string[] = [...plan.problems];
  const built = await buildSteps(plan.steps, current, store, a.page.kind === "category" ? a.page.path : null);
  problems.push(...built.problems);
  const made = built.made;

  const raw = r.data as { tweaks?: unknown; drop?: unknown };
  const tw = tweaksIn(raw.tweaks, outlineSelectors(a.outline));
  problems.push(...tw.problems);
  const fresh = [...inPlanOrder(made), ...tw.changes];
  const drop = current.length ? dropIn(raw.drop, map.parts) : [];
  if (!fresh.length && !drop.length) return { ok: false, error: plan.problems[0] ?? "The plan brought no module for this optimization.", budget: false };

  // each change as a version may carry it (its module kept beside it), and none that rewrites the shop's own parts
  const all = current.length ? revised(current, fresh, drop) : fresh;
  const kept = keepSafe(all, new Set([...map.parts.map((p) => p.selector).filter(Boolean), ...(a.target ? [a.target] : [])]), problems);
  if (!kept.some((c) => fresh.includes(c)) && !drop.length) return { ok: false, error: problems[0] ?? "The plan's changes could not be laid over the page.", budget: false };
  if (!kept.length) return { ok: false, error: "The revision would take every change out - say what should stay.", budget: false };
  const summary = plan.note && plan.note !== "Nothing to change"
    ? `${plan.note}${tw.changes.length ? `; ${tw.changes.map((c) => c.note).filter(Boolean).join("; ")}` : ""}`
    : fresh.map((c) => c.note).filter(Boolean).join("; ");
  return { ok: true, changes: kept as Change[], summary: summary.slice(0, 600), problems: [...new Set(problems)].slice(0, 8) };
}
