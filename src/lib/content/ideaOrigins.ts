// WHERE AN IDEA COMES FROM, NAMED AS THE HUB'S MENUS NAME IT (SARCLA 08.11.2026: "if it comes from AI Personalization,
// call it like that - we need to identify exactly where they come from"). Pure, no database: the Ideas page, the new
// project's "It starts from" and the board's chip read the same names.
//
// `app` is the app as the side panel names it (src/app/hubApps.ts WEBSITE_SECTIONS / MARKETING_SECTIONS, the panel rows of
// src/app/Sidebar.tsx); `place` is the page or the tab inside it where the idea is to be found; `href` opens that place.
// A name changed in a menu is changed here too - tests/content-ideas.test.ts holds the two together for the names it can.

import { PAGE_BUILDER } from "./contentTypes";

export type IdeaSource = "team" | "convert" | "buyers" | "aeo" | "seo" | "search" | "chat" | "brand";

export type Origin = { app: string; place: string | null; href: string | null };

/** Each source as a filter: the exact menu name, and what it holds. */
export const SOURCE_ORIGIN: Record<IdeaSource, Origin & { note: string }> = {
  team: { app: "Own ideas", place: null, href: null, note: "Written here by someone of the team - from none of the apps" },
  convert: { app: "AI testing & personalization", place: "Insights", href: "/website/ai-personalization/insights", note: "What the AI found on a shop page and proposes to change" },
  buyers: { app: "AI testing & personalization", place: "What stops buyers", href: "/website/ai-personalization/problems", note: "The AI's reading of the problem pages (Problem pages)" },
  aeo: { app: "AEO & LLM Optimizer", place: null, href: "/aeo", note: "HubSpot's recommendations, and the questions AI assistants answer without us" },
  seo: { app: "SEO", place: null, href: "/seo/work-queue", note: "Google Search: pages close to page one, pages losing clicks" },
  search: { app: "Search bar", place: "Gaps", href: "/website/search-bar#gaps", note: "What people searched in the shop and found nothing" },
  chat: { app: "APSOassistant Chat", place: "Filing", href: "/website/chat#topics", note: "What customers ask in the chat, by topic" },
  brand: { app: "Personality", place: "Keyword Signals", href: "/personality", note: "The brain: brand terms with no landing page, rising searches" },
};

/** The two places of a source that has two (AEO's recommendations and its prompts; SEO's quick wins and decay). */
export const PLACE_ORIGIN = {
  aeoRecommendation: { app: "AEO & LLM Optimizer", place: "Recommendations", href: "/aeo/recommendations" },
  aeoPrompt: { app: "AEO & LLM Optimizer", place: "Prompts and answers", href: "/aeo/prompts" },
  seoQuickWin: { app: "SEO", place: "Quick wins", href: "/seo/quick-wins" },
  seoDecay: { app: "SEO", place: "Decay", href: "/seo/decay" },
} satisfies Record<string, Origin>;

/**
 * The type an idea of an app makes (SARCLA 09.11.2026: "Page refresh becomes only Page builder" - the editor for the
 * webshop's own pages, where the optimization lands). An idea that changes a page ALREADY on the shop makes a Page
 * builder: AI testing & personalization's Insights (a change on one page) and What stops buyers (its problem pages),
 * SEO's Decay (a page losing clicks), AEO's "update this content" and its product pages. A page the shop does not have
 * yet is an SEO landing page.
 *   aeo  `action` / `contentType` as HubSpot's recommendation says them (UPDATE_CONTENT, CREATE_CONTENT; BLOG_POST...)
 *   seo  `seo` = which list of the work queue it is on
 */
export function ideaKind(source: IdeaSource, hint: { action?: string | null; contentType?: string | null; seo?: "quick-win" | "decay" | string } = {}): string | null {
  switch (source) {
    case "convert": case "buyers": return PAGE_BUILDER;
    case "seo": return hint.seo === "decay" ? PAGE_BUILDER : "landing-page";
    case "aeo":
      if (hint.action === "UPDATE_CONTENT" || /PRODUCT/i.test(hint.contentType ?? "")) return PAGE_BUILDER;
      return /BLOG/i.test(hint.contentType ?? "") ? "blog-article" : "landing-page";
    default: return null;
  }
}

/** "AI testing & personalization · Insights" - one line, the way a card and a filter say it. */
export const originLabel = (o: Pick<Origin, "app" | "place">) => (o.place ? `${o.app} · ${o.place}` : o.app);

/** A source's label as a filter. */
export const sourceLabel = (s: IdeaSource) => originLabel(SOURCE_ORIGIN[s]);

/**
 * A project's source (apsomh_content_projects.source - an idea's source key, or the older seo / geo / aeo / sea / team)
 * as its board card says it: "From AI testing & personalization". Unknown -> null (no chip).
 */
export function projectSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  if (source === "team") return "Own idea";
  if (source in SOURCE_ORIGIN) return `From ${SOURCE_ORIGIN[source as IdeaSource].app}`;
  const older: Record<string, string> = { geo: "From GEO", sea: "From SEA" };
  return older[source] ?? null;
}

/* ── a project's ideas, read back ───────────────────────────────────────────────────────────────────────────────── */

/** Where an idea is from, by its key ("convert:12", "aeo-q:7", "seo:3", "team:5"...) - the menu names as above. */
export function originOfKey(key: string): Origin {
  const prefix = key.split(":")[0];
  if (prefix === "aeo-q") return PLACE_ORIGIN.aeoPrompt;
  if (prefix === "aeo") return PLACE_ORIGIN.aeoRecommendation;
  if (prefix in SOURCE_ORIGIN) { const o = SOURCE_ORIGIN[prefix as IdeaSource]; return { app: o.app, place: o.place, href: o.href }; }
  return { app: "Own ideas", place: null, href: null };
}

export type ProjectIdea = { key: string; title: string; why: string; origin: Origin };

/**
 * The ideas a project was made from - every one, not only the first (SARCLA's night list, 09.11.2026) - out of the
 * lines start.ts keeps in its notes ("[idea convert:12] Title - why"); `rest` = the notes' other lines.
 */
export function projectIdeas(notes: string | null | undefined): { ideas: ProjectIdea[]; rest: string } {
  const ideas: ProjectIdea[] = [];
  const rest: string[] = [];
  for (const line of String(notes ?? "").split(/\r?\n/)) {
    const m = /^\[idea ([^\]]+)\]\s*(.*)$/.exec(line.trim());
    if (!m) { rest.push(line); continue; }
    const cut = m[2].indexOf(" - ");
    ideas.push({ key: m[1].trim(), title: (cut >= 0 ? m[2].slice(0, cut) : m[2]).trim(), why: cut >= 0 ? m[2].slice(cut + 3).trim() : "", origin: originOfKey(m[1].trim()) });
  }
  return { ideas, rest: rest.join("\n").trim() };
}
