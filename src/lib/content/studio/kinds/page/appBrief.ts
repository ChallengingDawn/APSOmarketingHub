// WHERE A PAGE'S PROJECT CAME FROM, AND WHETHER A NEW PAGE WRITES ITSELF (Content v5, 09.11.2026; the marker since
// 10.11.2026; the rule since Content v9, 10.11.2026). Pure, so it is tested.
//
// SARCLA 10.11.2026: "also new page should be empty and then we start to build, only not when they come from ideas".
// The rule, exactly:
//   a NEW page (an SEO landing page, a page the shop does not have) opens EMPTY - the start card offers "Write it with AI"
//   and "Start empty and add blocks" - EXCEPT when its to-do came from an IDEA: any idea of the Ideas board, whatever its
//   source (Own ideas, AI testing & personalization, AEO & LLM Optimizer, SEO, Search bar, APSOassistant Chat,
//   Personality). Then it writes itself from that idea's brief, once, at the first open.
//   A page that has anything on it already (a word, a picture, a module, a banner, an earlier draft) is never touched.
//
// A project came from an idea when it carries the idea's link (lib/content/start.ts):
//   - the notes' idea lines "[idea seo:12] Title - why" (one per idea it was made from), or
//   - the source column (the first idea's app - "seo", "team", "convert" ... set only for a project made from ideas), or
//   - the marker of a page sent from AI testing & personalization ("[APSOconvert page prod:/de-CH/...]") or of a
//     recommendation sent from AEO & LLM Optimizer ("[AEO recommendation 123]") - their ideas, sent straight to Content.

import { PLACE_ORIGIN, SOURCE_ORIGIN, projectIdeas, type IdeaSource } from "../../../ideaOrigins";
import { markerOf } from "../../../../convert/handoff";
import type { Fields } from "./fields";

const AEO_MARK = /\[AEO recommendation [^\]]*\]/;
/** The older sources of the board (before the Ideas board's own keys) - ideas too, as the board's chip says them. */
const OLDER: Record<string, string> = { geo: "GEO", sea: "SEA" };

/** The idea a project was made from: its title, its app as the menus name it, and how many more ideas it was made from. */
export type ProjectIdea = { key: string | null; title: string; app: string; more: number };

export type AppBriefOut = {
  source: string | null;
  /** the idea's app as the menus name it ("SEO", "Own ideas", "AI testing & personalization"...) - null: no idea */
  app: string | null;
  /** the brief's words as the studio shows them (and the AI reads them) */
  text: string;
  /** the page writes itself from them (while it is empty) */
  auto: boolean;
  /** the idea it came from - null when the to-do came from no idea */
  idea: ProjectIdea | null;
};

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** The idea a project was made from, read from its link - null when it came from none. `title`: the project's own name
 * (the idea's name when it was sent straight from an app, with only a marker). */
export function ideaOfProject(x: { source: string | null; notes: string | null; title?: string | null }): ProjectIdea | null {
  const { ideas } = projectIdeas(x.notes);
  const name = (x.title ?? "").replace(/\s+/g, " ").trim();
  if (ideas.length) {
    const first = ideas[0];
    return { key: first.key, title: clip(first.title || name, 120), app: first.origin.app, more: ideas.length - 1 };
  }
  const notes = x.notes ?? "";
  if (markerOf(notes)) return { key: null, title: clip(name, 120), app: SOURCE_ORIGIN.convert.app, more: 0 };
  if (AEO_MARK.test(notes)) return { key: null, title: clip(name, 120), app: PLACE_ORIGIN.aeoRecommendation.app, more: 0 };
  const src = (x.source ?? "").trim();
  if (src in SOURCE_ORIGIN) return { key: null, title: clip(name, 120), app: SOURCE_ORIGIN[src as IdeaSource].app, more: 0 };
  if (OLDER[src]) return { key: null, title: clip(name, 120), app: OLDER[src], more: 0 };
  return null;
}

/** Where the project came from (its idea's app - null for none), its brief's words as the studio shows them, and whether
 * a new page writes itself from them. `notes`: the project's brief as written (the idea lines, a marker). */
export function appBriefOf(x: { source: string | null; goal: string | null; notes: string | null; title?: string | null }): AppBriefOut {
  const notes = x.notes ?? "";
  const idea = ideaOfProject(x);
  const marked = !!markerOf(notes);
  const words = notes.replace(/^\[idea [^\]]+\]\s*/gm, "").replace(/\[APSOconvert page [^\]]*\]/g, "").replace(new RegExp(AEO_MARK.source, "g"), "").trim();
  const text = [x.goal, words].map((s) => (s ?? "").trim()).filter(Boolean).join("\n").slice(0, 600);
  return { source: x.source ?? (marked ? "convert" : null), app: idea?.app ?? null, text, auto: !!idea && !!text, idea };
}

/** Anything on a new page already: a word, a picture, a block's item, a module, a banner, an earlier draft. A page with
 * anything on it is never written by itself. */
export function pageHasContent(d: { fields: Fields; newPage?: { body: string } | null; inserts?: unknown[] | null }): boolean {
  const f = d.fields;
  const words = [
    f.hero.eyebrow, f.hero.title, f.hero.sub, f.hero.button.label, f.intro, f.benefitsTitle, f.linksTitle, f.faqTitle,
    f.cta.title, f.cta.text, f.cta.button.label, f.seo.title, f.seo.description, f.seo.urlKey,
  ];
  if (words.some((w) => w.trim())) return true;
  if (f.hero.picture.url || f.benefits.length || f.sections.length || f.links.length || f.faq.length) return true;
  if ((f.modules ?? []).length) return true;
  if ((d.inserts ?? []).length) return true;
  return !!d.newPage?.body.trim();
}

/** THE RULE: a new page writes itself only when its to-do came from an idea (with words to write from) and the page has
 * nothing on it. */
export function writesItself(brief: Pick<AppBriefOut, "auto"> | null | undefined, hasContent: boolean): boolean {
  return !!brief?.auto && !hasContent;
}

/** The rule from the project as it is: its notes (the idea lines, a marker), source, goal and name, and the page. */
export function autoWriteOf(project: { source: string | null; goal: string | null; notes: string | null; title?: string | null }, hasContent: boolean): boolean {
  return writesItself(appBriefOf(project), hasContent);
}

/** Where the start card stands: empty (no idea), from an idea - writing, written, failed, waiting for the AI or for an
 * editor. */
export type StartState = "empty" | "writing" | "wrote" | "failed" | "noAi" | "readOnly";

/** "From the idea "Seals for food machines"" (and how many more). */
export function ideaName(idea: ProjectIdea): string {
  const t = idea.title ? `“${clip(idea.title, 70)}”` : `of ${idea.app}`;
  return `From the idea ${t}${idea.more ? ` and ${idea.more} more` : ""}`;
}

/** The start card's one short line: why the page is empty, or why it wrote itself. */
export function startLine(brief: Pick<AppBriefOut, "idea" | "auto"> | null, state: StartState, error?: string | null): string {
  const idea = brief?.idea ?? null;
  if (!idea) return "It starts empty - this to-do did not come from an idea.";
  const from = ideaName(idea);
  if (!brief?.auto) return `${from} - its brief has no words to write from, so it starts empty.`;
  switch (state) {
    case "writing": return `${from} - writing it from its brief.`;
    case "wrote": return `${from} - written from its brief.`;
    case "failed": return `${from} - it could not be written from its brief${error ? ` (${clip(error.replace(/[.\s]+$/, ""), 90)})` : ""}.`;
    case "noAi": return `${from} - the AI is not set up on this hub, so it starts empty.`;
    case "readOnly": return `${from} - it is written from its brief when someone who can edit it opens it.`;
    default: return `${from} - writing it from its brief.`;
  }
}
