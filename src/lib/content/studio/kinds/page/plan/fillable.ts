// PAGE - WHICH MODULES THE AI CAN FILL (Content v11, 10.11.2026). Pure: relative imports only
// (tests/studio-page-cv11-fill.test.ts runs it over the whole library).
//
// SARCLA 10.11.2026 ("I can't see launch the AI to fill me the block"; a "Campaign with its dates" left "Not on the page
// yet" on the first write and after "Write it all again"): Content v10 promised that every module the AI brings comes out
// full. The rule behind the promise, made one thing the planners read: a module is offered to the AI's plans (the new
// page's write, a page of the shop's plan) only when the fill rules CAN fill it - the words the AI writes (its headline,
// its lines, its buttons, its points or questions) and what the shop gives (its products, its categories, its photo, its
// teasers' pictures and pages) - in every store view the shop writes pages in. A module that needs what neither gives (a
// table of figures, the quote pictures the shop published) is never picked by a plan; a person who puts one on the page
// fills it in its settings ("Fill it with AI" writes its table from the page).

import { countFor, moduleDef } from "../modules/registry";
import type { Card, ModuleRef } from "../modules/types";
import { emptyWords, fullGap, libModule, library, makeModule, moduleGapOf, teaserField, withWords, type LibModule, type PlanWords } from "./library";
import { withFill } from "./plan";

/** The store views a plan's module must fill in (one per language the shop writes pages in). */
export const PLAN_STORES = ["de-CH", "fr-CH", "it-CH", "en-INT", "nl-NL", "pl-PL"] as const;

const B = "https://www.apsoparts.com";

/** A module of the shop's products, categories, photo or teasers - filled by the shop, not by the AI's words. */
export const shopFills = (m: Pick<LibModule, "id" | "takes" | "needs">) => m.takes !== "none" || m.needs.includes("picture") || !!teaserField(m.id);

/** The words the AI writes at its fullest: every word the module takes, as many points or questions as it shows - no
 * extras (a date, a badge: only when the page gives them) and no table. */
export function fullestWords(lib: LibModule): PlanWords {
  const w = emptyWords();
  for (const f of lib.words) {
    if (f.key === "points") w.points = Array.from({ length: f.max }, (_, i) => ({ title: `Point ${i + 1}`, text: `Its line ${i + 1}.` }));
    else if (f.key === "faq") w.faq = Array.from({ length: f.max }, (_, i) => ({ q: `Question ${i + 1}?`, a: `Its answer ${i + 1}.` }));
    else w[f.key] = f.key === "title" ? "A headline" : f.key === "eyebrow" ? "Range" : f.key === "text" ? "One line under it." : "More";
  }
  return w;
}

/** What the shop gives a module at its fullest: as many products or categories as it shows (each category with what it
 * carries), a photo, its teasers' pictures and pages. */
function shopFill(id: string, m: ModuleRef, store: string): { items: Card[]; feature: Card } {
  const d = moduleDef(id);
  const teaser = teaserField(id);
  const n = Math.max(d ? countFor(d, m.settings) : 6, teaser?.n ?? 0) + 2;
  const cats = d?.takes === "categories" || !!teaser;
  const kids: Card[] = d?.takes === "categories" ? Array.from({ length: 4 }, (_, k) => ({ kind: "product", name: `Product ${k + 1}`, url: `${B}/${store}/p${k}.html`, img: `${B}/media/p${k}.jpg`, meta: "12 articles", number: `1140010${k}`, children: [] })) : [];
  const items: Card[] = Array.from({ length: n }, (_, i) => ({ kind: cats ? "category" : "product", name: `Card ${i + 1}`, url: `${B}/${store}/c${i}.html`, img: `${B}/media/c${i}.jpg`, meta: "31 products", number: cats ? "" : `1150010${i}`, children: kids }));
  return { items, feature: { kind: "category", name: "Its photo", url: `${B}/${store}/f.html`, img: `${B}/media/f.jpg`, meta: "", number: "", children: [] } };
}

/** The module as the AI and the shop fill it at their fullest, in a store view (null: not in the library). */
export function filledAtBest(id: string, store: string): ModuleRef | null {
  const lib = libModule(id);
  const m0 = makeModule(id, store);
  if (!lib || !m0) return null;
  let m = withWords(m0, fullestWords(lib), `${B}/${store}/a.html`, [], `${B}/${store}/b.html`);
  if (shopFills(lib)) m = withFill(m, shopFill(id, m, store), { how: "category", category: `${B}/${store}/a.html`, numbers: "", count: 0 });
  return m;
}

/** Can the fill rules fill this module in this store view - nothing left that keeps it off the page, nothing it shows
 * empty? */
export function aiCanFill(id: string, store: string): boolean {
  const m = filledAtBest(id, store);
  return !!m && !moduleGapOf(m) && !fullGap(m);
}

let held: Set<string> | null = null;
/** The modules a plan may pick: those the fill rules fill in every store view the shop writes pages in. */
export function plannableIds(): Set<string> {
  return (held ??= new Set(library().filter((m) => PLAN_STORES.every((s) => aiCanFill(m.id, s))).map((m) => m.id)));
}
export const isPlannable = (id: string) => plannableIds().has(id);
/** The library as the plans are shown it. */
export const plannableLibrary = (lib: LibModule[] = library()): LibModule[] => lib.filter((m) => isPlannable(m.id));
