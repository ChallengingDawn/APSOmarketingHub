"use client";
// A BIG CHANGE TO A STUDIO'S DOCUMENT, SAVED IN TWO STEPS (08.11.2026). The studio saves in small ops under the hub's
// 8 KB request limit (studio/doc.ts batches), and slices a long text - but an item put into a list goes whole, so an AI
// answer with a 7 KB block of HTML (a page's change, a post's section) would be refused by the firewall with a bare 403.
// So a list that comes back heavy is saved first with its long texts empty (every item small), the studio waits for
// that save (any action waits for it), and then the texts go in - set field by field, each sliced to fit.
//
// The texts go back into the document as it is THEN (studio/doc.ts restoreLight), never as the document this change was
// made on: SARCLA 11.11.2026 ("A/B testing ... doesn't switch version on Content") - a version opened while the first
// step was saving was swapped back to the one before, and its module's HTML could stay empty.

import { lightFirst, restoreLight } from "@/lib/content/studio/doc";
import type { StudioApi } from "../../useStudio";

/** `cur` is the document as it is now (the studio's latest, not the one a slow answer started from). */
export async function setDocSafely(api: StudioApi, cur: unknown, next: unknown): Promise<void> {
  const split = lightFirst(cur, next);
  if (!split) { api.setDoc(next); return; }
  api.setDoc(split.first);
  await api.act("ping");
  api.setDoc((now: unknown) => restoreLight(now, split.pairs));
}
