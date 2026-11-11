// SOCIAL POST - "WRITE IT ALL AGAIN" AND "WRITE THIS PAGE AGAIN" (cv16, the Page builder's points 2 and 4; SARCLA
// 11.11.2026: "compare the evolution of this page to the other content types and improve them"). Pure: relative imports
// only - the studio (app/.../social/writeAll.ts) and tests/studio-social-cv16.test.ts.
//
// The Page builder writes a page again in four ways (page/WriteAgain.tsx): from the topic, directly (better), as asked,
// or starts again. A post does the same: every page's words AND every network's caption, in one go, with one Undo. The
// words are asked page by page from the canvas AI (the "design" task, set_text on each text id - the texts the person
// added too, so nothing they put is left behind in the old words); its layout, pictures and logo stay. A page is held in
// every format it goes out in, each its own document (design.ts): the new words go into the other formats where the same
// old words stood.

import type { DesignDocument } from "../../../../design-document";
import type { AiOp } from "./canvasAi";
import type { DesignPage, FormatKey } from "./design";

export type WriteMode = "topic" | "better" | "ask" | "reset";

export const WRITE_WAYS: { mode: WriteMode; label: string; line: string }[] = [
  { mode: "topic", label: "From the topic", line: "The brief and the to-do's subject - every page and caption written fresh, the layout kept" },
  { mode: "better", label: "Directly", line: "The post as it stands, written again better - nothing asked" },
  { mode: "ask", label: "Ask", line: "Say what should change - the whole post is written with it" },
  { mode: "reset", label: "Start again", line: "An empty post - one page with its placeholders, no captions; its networks, formats and day kept. Undo brings it back" },
];

/** What the line under the header says once it is done. */
export const WROTE: Record<WriteMode, string> = { topic: "Written again from the topic", better: "Written again, better", ask: "Written again as you asked", reset: "Started again - the post is empty" };

const KEEP = "keep the layout, the pictures and the logo where they are (no template, no pages, no new picture, no format)";
/** The canvas AI's ask for ONE page, in each way. */
export function pageAsk(mode: Exclude<WriteMode, "reset">, request: string, at: number, of: number): string {
  const which = of > 1 ? ` This is page ${at + 1} of ${of}${at === 0 ? " - the cover: the hook" : at === of - 1 ? " - the last: it points to the shop or asks" : ""}.` : "";
  const what = mode === "topic"
    ? `Write every text on this page again, fresh, from the project's brief and this post's subject: set_text on EACH text id in the list - the texts the person added too - in the same roles and about the same lengths; ${KEEP}.`
    : mode === "better"
      ? `Write every text on this page again, better: the same message and facts, tighter and more concrete words - set_text on EACH text id in the list, the texts the person added too; ${KEEP}.`
      : `Write the texts on this page again as the person asks below: set_text on each text id that should change - the texts the person added too; keep the layout, the pictures and the logo unless the ask says otherwise (no pages, no format).`;
  return `${what}${which}${request.trim() ? `\n\nWhat the person asks: ${request.trim().slice(0, 1200)}` : ""}`;
}

/** The ops a page's rewrite may do: words and their look - never a new carousel, a format, a new picture or a template. */
export function wordsOnly(ops: AiOp[], mode: Exclude<WriteMode, "reset">): AiOp[] {
  const allowed = mode === "ask" ? new Set(["set_text", "add_text", "remove", "move", "recolour", "resize", "logo"]) : new Set(["set_text"]);
  return ops.filter((o) => allowed.has(o.do));
}

/** The words that changed on a page's document: old words -> new words (by the same object's id). */
export function textChanges(before: DesignDocument, after: DesignDocument): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of after.nodes) {
    if (n.kind !== "text") continue;
    const old = before.nodes.find((x) => x.id === n.id && x.kind === "text");
    if (old && (old.text ?? "") !== (n.text ?? "") && (old.text ?? "").trim()) out.set(old.text ?? "", n.text ?? "");
  }
  return out;
}

/**
 * The rewrite put on the page as it is NOW (a picture may have landed, a word been typed while the AI wrote): when the
 * format it was asked in is unchanged, its new document and the new words in the other formats; else only the new words,
 * where the old words still stand, in every format - nothing done meanwhile is lost.
 */
export function rewritten(now: DesignPage, f: FormatKey, asked: DesignDocument, after: DesignDocument): DesignPage {
  const cur = now.by[f];
  const same = !!cur && JSON.stringify(cur.nodes) === JSON.stringify(asked.nodes);
  if (same || !cur) return withNewWords({ ...now, by: { ...now.by, [f]: asked } }, f, asked, after);
  const map = textChanges(asked, after);
  const by: DesignPage["by"] = {};
  for (const [g, doc] of Object.entries(now.by) as [FormatKey, DesignDocument | undefined][]) {
    if (doc) by[g] = map.size ? { ...doc, nodes: doc.nodes.map((n) => (n.kind === "text" && map.has(n.text ?? "") ? { ...n, text: map.get(n.text ?? "") } : n)) } : doc;
  }
  return { ...now, by };
}

/** A page with its new document in one format, and the same new words in its other formats where the old words stood. */
export function withNewWords(page: DesignPage, f: FormatKey, before: DesignDocument, after: DesignDocument): DesignPage {
  const map = textChanges(before, after);
  const by: DesignPage["by"] = {};
  for (const [g, doc] of Object.entries(page.by) as [FormatKey, DesignDocument | undefined][]) {
    if (!doc) continue;
    if (g === f) continue;
    by[g] = map.size ? { ...doc, nodes: doc.nodes.map((n) => (n.kind === "text" && map.has(n.text ?? "") ? { ...n, text: map.get(n.text ?? "") } : n)) } : doc;
  }
  by[f] = after;
  return { ...page, by };
}
