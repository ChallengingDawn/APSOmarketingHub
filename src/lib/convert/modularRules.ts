// APSOconvert > A VERSION BUILT WITH THE CONTENT STUDIO'S MODULES - the pure part (tests/convert-modular.test.ts).
//
// SARCLA 10.11.2026, on a version whose new block was three tiny bullets in a box: "generation is really shit - the
// content agent ... quality is much higher". So a version of a content page is no longer loose HTML the AI writes: it
// is the Content studio's PLAN (src/lib/content/studio/kinds/page/plan/*) - modules of its library, filled from the shop,
// drawn by its renderer - laid over the page as the version's changes (./modular.ts). What is decided here:
//   - which optimizations take that way (a content page; not a product page - its articles table is the theme's code -
//     and not a shop block in the footer, which the plan cannot reach)
//   - the plan's small extra: new words for an element of the page itself (a button's label), "tweaks"
//   - two modules planned after the same part stand in the plan's order (the browser puts a later "after" first)
//   - a revision keeps the version's other changes: a module given new words takes its change's place, a new one is added
// Pure: no "@/" imports.

import type { Change } from "./versions";
import type { PageKind } from "./model";

/** A change as the version keeps it: the shop's change, with the module it was drawn from (Content's PageChange). */
export type ModChange = Change & { id?: string; module?: { type: string; settings: Record<string, unknown> } };

/** Does this optimization get its version from the module plan? A content page (home, category, CMS); not a product
 * page (the articles table, prices and gallery are the theme's code), not a block in the footer (the plan works in the
 * page's main column). */
export function usesModules(kind: PageKind, block: string | null | undefined): boolean {
  return !block && (kind === "home" || kind === "category" || kind === "cms");
}

/** What the browser needs of a change (its id and module are the hub's own): the runtime and the shop's test get this. */
export function bare(changes: Change[]): Change[] {
  return changes.map((c) => {
    const { id: _i, module: _m, off: _o, ...rest } = c as ModChange & { off?: string };
    return rest as Change;
  });
}

/** The changes with an id each (an older version's changes have none): what the plan names a part the hub put by. */
export function withIds(changes: Change[]): ModChange[] {
  return changes.map((c, i) => {
    const m = c as ModChange;
    return m.id ? m : { ...m, id: `v${i + 1}` };
  });
}

/**
 * Two modules the plan put after the same part: the browser lays each "after" right behind the part, so the later one
 * would stand first. They are one change instead - their blocks in the plan's order.
 */
export function inPlanOrder(changes: ModChange[]): ModChange[] {
  const out: ModChange[] = [];
  for (const c of changes) {
    const prev = out[out.length - 1];
    if (prev && prev.op === "insert" && c.op === "insert" && prev.where === "after" && c.where === "after" && prev.selector === c.selector) {
      out[out.length - 1] = { ...prev, html: `${prev.html}${c.html}`, note: [prev.note, c.note].filter(Boolean).join("; ").slice(0, 300) };
      continue;
    }
    out.push(c);
  }
  return out;
}

/**
 * A revision: the version's changes with the plan's - a change the plan gave new words (same id) takes its place, a new
 * one goes at the end. Nothing the plan did not touch moves.
 */
export function revised(current: ModChange[], made: ModChange[], drop: string[] = []): ModChange[] {
  const byId = new Map(made.filter((c) => c.id).map((c) => [c.id!, c]));
  const kept = current.filter((c) => !(c.id && drop.includes(c.id) && !byId.has(c.id))).map((c) => (c.id && byId.has(c.id) ? byId.get(c.id)! : c));
  const fresh = made.filter((c) => !c.id || !current.some((x) => x.id === c.id));
  return [...kept, ...fresh];
}

export const TWEAKS_SCHEMA = {
  type: "array",
  description: "New words for elements of the page itself (a button's label, a heading) - 0 to 3, only when the optimization asks for it",
  items: {
    type: "object", additionalProperties: false, required: ["selector", "text", "note"],
    properties: {
      selector: { type: "string", description: "The element's selector, exactly as THE PAGE'S ELEMENTS lists it" },
      text: { type: "string", description: "Its new words, in the page's language, under 80 characters" },
      note: { type: "string", description: "What it does, ENGLISH, under 10 words" },
    },
  },
};

export const DROP_SCHEMA = {
  type: "array",
  description: "A revision only: the version's own blocks (M1, B1 ...) to take out - to MOVE one, take it out here and add it again where it should stand; else []",
  items: { type: "string" },
};

/** The version's own blocks the AI took out (its M / B ids), as their changes' ids - a part of the page itself never. */
export function dropIn(raw: unknown, parts: { id: string; kind: string; change: string }[]): string[] {
  const ids = (Array.isArray(raw) ? raw : []).map((x) => String(x ?? "").trim().toUpperCase()).slice(0, 6);
  return parts.filter((p) => p.kind !== "page" && p.change && ids.includes(p.id)).map((p) => p.change);
}

const PROMISE = /\d+([.,]\d+)?\s*%|\b(CHF|EUR|USD|PLN)\b|€|\$|chemours|<|>|\[|\]|\{|\}/i;

/** The AI's tweaks kept when they may stand: a selector the page's outline lists, short plain words, no price, no
 * discount, no placeholder; at most 3, one per element. Every refusal said. */
export function tweaksIn(raw: unknown, selectors: string[]): { changes: ModChange[]; problems: string[] } {
  const problems: string[] = [];
  const changes: ModChange[] = [];
  const seen = new Set<string>();
  for (const x of (Array.isArray(raw) ? raw : []).slice(0, 5)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const selector = typeof o.selector === "string" ? o.selector.trim() : "";
    const text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim() : "";
    const note = typeof o.note === "string" ? o.note.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!selector || !text) continue;
    if (!selectors.includes(selector)) { problems.push(`New words for "${selector.slice(0, 60)}" left out: not an element of the page`); continue; }
    if (text.length > 80 || PROMISE.test(text)) { problems.push(`New words "${text.slice(0, 40)}" left out: too long, or a price, a discount or a placeholder`); continue; }
    if (seen.has(selector) || changes.length >= 3) continue;
    seen.add(selector);
    changes.push({ op: "text", selector, text, ...(note ? { note } : {}) });
  }
  return { changes, problems };
}

/** The element a person pointed at in the preview, from the AI helper's words ("Change this element - SEL (it reads
 * “...”): ..."). */
export function pointedAt(request: string | null | undefined): { selector: string; text: string } | null {
  const m = /^Change this element - (.+?)(?: \(it reads “([^”]*)”\))?: ?/.exec(request ?? "");
  return m ? { selector: m[1].trim().slice(0, 300), text: (m[2] ?? "").slice(0, 160) } : null;
}

/** The selectors of the page's outline ("  div.x > a.y · its words" lines). */
export function outlineSelectors(lines: string[]): string[] {
  return lines.map((l) => l.split(" ·")[0]?.trim() ?? "").filter((s) => s && !/\s{2,}/.test(s));
}

/** A way to fill a module from the shop, as the studio tries it (Content's FillTry). */
export type FillWay = { module: string; fill: { how: string; category: string; numbers: string; count: number }; layout: string; why: string };

/**
 * One more way to fill a module of products after the studio's own (fillTries): the category's products as the shop
 * lists them - the category the AI named or, on a category page, the page itself. The night run of 11.11.2026 left a
 * product bento and a product panel out on /de-DE/kunststofftechnik/platte.html: the category's most bought and most
 * viewed were fewer than the module shows. null when the studio's tries list that category already, or there is none.
 */
export function listingWay<T extends FillWay>(tries: T[], takesProducts: boolean, pageCategory: string | null): T | null {
  const first = tries[0];
  if (!takesProducts || !first) return null;
  const category = first.fill.category.trim() || pageCategory || "";
  if (!category) return null;
  if (tries.some((t) => t.fill.how === "category" && t.fill.category === category)) return null;
  return { ...first, fill: { ...first.fill, how: "category", category, numbers: "" }, why: "the category's products, as the shop lists them" } as T;
}
