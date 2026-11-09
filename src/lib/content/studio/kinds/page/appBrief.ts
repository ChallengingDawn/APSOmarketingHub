// WHERE A PAGE'S PROJECT CAME FROM (Content v5, 09.11.2026; the marker since 10.11.2026). Pure, so it is tested.
//
// SARCLA 09.11.2026: "write the new page with AI: it depends - if the project was created via an SEO brief, writing the
// page should be by default; otherwise the user should prompt each page he wants". A project started from an idea of
// one of the apps carries that app as its source (lib/content/start.ts). A project sent from AI testing &
// personalization carries its page's marker in the brief ("[APSOconvert page prod:/de-CH/...]") - that is an app's
// brief too (agreed with that app's hand-over): a NEW page (a landing page) is written from it by itself, the marker's
// page being only context.

import { SOURCE_ORIGIN, type IdeaSource } from "../../../ideaOrigins";
import { markerOf } from "../../../../convert/handoff";

const APP_SOURCES: IdeaSource[] = ["seo", "aeo", "search", "brand", "convert", "buyers"];

export type AppBriefOut = { source: string | null; app: string | null; text: string; auto: boolean };

/** The app a project's brief came from (null for a person's own idea), its words as the studio shows them, and whether
 * the page writes itself from them. `notes`: the project's brief as written (it may carry the marker). */
export function appBriefOf(x: { source: string | null; goal: string | null; notes: string | null }): AppBriefOut {
  const notes = x.notes ?? "";
  const marked = !!markerOf(notes);
  const src = x.source && (APP_SOURCES as string[]).includes(x.source) ? (x.source as IdeaSource) : marked ? "convert" : null;
  const app = src ? SOURCE_ORIGIN[src].app : null;
  const words = notes.replace(/^\[idea [^\]]+\]\s*/gm, "").replace(/\[APSOconvert page [^\]]*\]/g, "").trim();
  const text = [x.goal, words].map((s) => (s ?? "").trim()).filter(Boolean).join("\n").slice(0, 600);
  return { source: x.source ?? (marked ? "convert" : null), app, text, auto: !!app && !!text };
}
