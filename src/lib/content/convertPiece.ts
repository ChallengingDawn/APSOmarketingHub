// THE FIRST TO-DO OF A PROJECT SENT FROM AI TESTING & PERSONALIZATION (10.11.2026). Pure, so it is tested.
//
// A page sent from AI testing & personalization arrives as a project whose brief carries the page's marker
// ("[APSOconvert page prod:/de-CH/...]"); its first to-do is made the first time the project is read (./workflow.ts
// pieceFromConvert). Its kind is the PROJECT's own content type when the person sending it chose one the board offers
// (a landing page, a banner, a newsletter, a blog article ... - agreed 09.11.2026 with that app's hand-over), else the
// Page builder - the page is on the shop and Content changes it.

import { OFFERED_KEYS } from "./contentTypes";
import { contentTypeForPage } from "../convert/handoff";

export function pieceKindFromConvert(projectType: string | null | undefined, path: string): string {
  const t = String(projectType ?? "").trim();
  return t && (OFFERED_KEYS as readonly string[]).includes(t) ? t : contentTypeForPage(path);
}
