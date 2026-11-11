// PAGE - A VERSION DRAWN AT ONCE, FROM THE PAGE AS THE SHOP SERVES IT (Content v14, 11.11.2026). Pure: no "@/" imports -
// tests/studio-page-cv14-verswitch.test.ts.
//
// SARCLA 11.11.2026: "A/B testing is not that good, it doesn't switch version on Content." A block optimization of AI
// testing & personalization comes with 3-4 versions, each ONE change that replaces the SAME block (its selector, often
// by position: div[data-content-type="row"]:nth-of-type(3)) with another module. Clicking B kept A on the stage: the
// stage showed the server's picture of A until the save and a new picture came back, and what it drew at once (the
// module's change, ../../../../app/projects/studio/kinds/page/plan/overlay.ts) went into THAT picture - where A's module
// already stands in the block's place, the block hidden and moved down a row, so B's selector found nothing.
//
// So a version opened is drawn at once from the page as the shop serves it (the preview's "before"), its own changes
// laid over it the server's way (./apply.ts) - never over the picture of the version before. The server's picture
// follows once the switch is saved, as for any change.

import { applyChanges, type AnyChange, type Hit } from "./apply";
import { finalChanges, type PageDoc } from "./model";

export type DrawnVersion = {
  html: string;
  /** each change's hit, by its index in the view's list (as the server's picture says them) */
  hits: { index: number; state: Hit["state"]; count: number }[];
  body: Hit | null;
  problems: string[];
};

/** The open version of a store view laid over `base` - the page as the shop serves it, never a picture with changes. */
export function drawVersion(base: string, view: PageDoc): DrawnVersion {
  const final = finalChanges(view);
  const applied = applyChanges(base, final.changes as AnyChange[], { marks: final.from });
  const hits: DrawnVersion["hits"] = [];
  let body: Hit | null = null;
  applied.hits.forEach((h, k) => {
    const from = final.from[k];
    if (from < 0) body = h;
    else hits.push({ index: from, state: h.state, count: h.count });
  });
  return { html: applied.html, hits, body, problems: final.problems };
}

/** The open version's letter. */
export const letterOf = (view: Pick<PageDoc, "letter">) => view.letter || "A";

/** Is a picture of the page (asked while `held` was open) another version's than the one open now? Then the stage draws
 * the open one itself (drawVersion) until the server's picture of it comes. */
export const otherVersion = (held: string | null | undefined, view: Pick<PageDoc, "letter">) => !!held && held !== letterOf(view);
