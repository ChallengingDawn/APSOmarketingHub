"use client";
// WRITE IT ALL AGAIN / WRITE THIS PAGE AGAIN (cv16, the Page builder's points 2 and 4 - the pure part and the why in
// lib/.../social/rewrite.ts). Every page asked side by side (the canvas AI, words only), the captions with them (the
// "write" task in the same way), applied at once - one line in "Changes made here" whose Undo puts the pages AND the
// captions back. "Start again" needs no AI: one page with its placeholders, no captions.

import type { DesignDocument } from "@/lib/design-document";
import { planOps, type DesignAnswer } from "@/lib/content/studio/kinds/social/canvasAi";
import { leftOutLine, type WriteAnswer } from "@/lib/content/studio/kinds/social/ai";
import { insertPage, pageId, pageIn, type SocialDesign } from "@/lib/content/studio/kinds/social/design";
import { enabled } from "@/lib/content/studio/kinds/social/model";
import { pageAsk, rewritten, wordsOnly, WROTE, type WriteMode } from "@/lib/content/studio/kinds/social/rewrite";
import { realColours } from "@/lib/content/studio/kinds/social/start";
import { templateByKey } from "@/lib/content/studio/kinds/social/templates";
import { startPage } from "./actions";
import type { LogEntry } from "@/lib/content/studio/kinds/social/model";
import type { StudioCtx } from "./Studio";

export type WriteResult = { said: string; entry: LogEntry | null; error: string | null };

/** The post (every page, or the pages given) written again in one way; the captions too when the whole post is. */
export async function writeAgain(ctx: StudioCtx, mode: WriteMode, request = "", only: number[] | null = null): Promise<WriteResult> {
  const d0 = ctx.doc;
  const before = { design: d0.design, texts: { networks: d0.networks, firstComment: d0.firstComment, hashtags: d0.hashtags } };
  const whole = !only;
  const label = only ? `Page ${only[0] + 1} written again${request.trim() ? `: ${request.trim().slice(0, 50)}` : ""}` : WROTE[mode];

  if (mode === "reset") {
    const t = templateByKey("spotlight")!;
    let design: SocialDesign = { ...d0.design, pages: [] };
    design = insertPage(design, 0, { id: pageId(), by: startPage(design, t, ctx.mf) });
    ctx.set((x) => {
      const networks = { ...x.networks };
      for (const n of Object.keys(networks) as (keyof typeof networks)[]) networks[n] = { ...networks[n], text: "" };
      return { ...x, design, networks, firstComment: "", hashtags: [] };
    });
    ctx.goPage(0);
    ctx.reload();
    const entry = ctx.ai.record(label, before, "Every page and caption out - Undo brings them back.", "you");
    return { said: WROTE.reset, entry, error: null };
  }

  if (!ctx.api.data.ai) return { said: "", entry: null, error: "The AI is not set up on this hub." };
  const pages = d0.design.pages.map((_, i) => i).filter((i) => !only || only.includes(i));
  const f = ctx.fmt;
  const pageNow = d0.design.pages[ctx.pageIx]?.id ?? "";
  ctx.ai.setWorking({ label: whole ? "Writing the post again" : `Writing page ${pages[0] + 1} again`, ids: "all", pageId: pageNow, since: Date.now() });
  const versionId = ctx.api.keepVersion ? await ctx.api.keepVersion(`Before the AI: ${label}`.slice(0, 110)).catch(() => null) : null;
  const scene = ctx.canvas.current?.scene() ?? null;
  const said: string[] = [];
  let failed: string | null = null;

  const asks = pages.map(async (i) => {
    const page = d0.design.pages[i];
    const doc: DesignDocument = i === ctx.pageIx && scene ? scene : pageIn(d0.design, page, f);
    const r = await ctx.api.ai<DesignAnswer & { leftOut?: string[] }>("design", { ask: pageAsk(mode, request, i, d0.design.pages.length), page: i, format: f });
    if (!r.ok) { failed = r.error; return null; }
    said.push(...(r.result.leftOut ?? []));
    const plan = planOps(wordsOnly(r.result.ops, mode), doc, ctx.mf);
    if (!plan.doc) return null;
    const after = { ...plan.doc, nodes: realColours(plan.doc.nodes) ?? plan.doc.nodes };
    return { id: page.id, asked: doc, after };
  });
  const captions = whole && enabled(d0).length
    ? ctx.api.ai<WriteAnswer & { leftOut?: string[] }>("write", { networks: enabled(d0), mode, ask: request.trim() || undefined })
    : Promise.resolve(null);
  const [done, cap] = await Promise.all([Promise.all(asks), captions]);
  const pagesNew = done.filter((x): x is NonNullable<typeof x> => !!x);
  if (cap && !cap.ok) failed = failed ?? cap.error;
  if (cap && cap.ok) said.push(...(cap.result.leftOut ?? []));
  ctx.ai.setWorking(null);
  if (!pagesNew.length && !(cap && cap.ok && Object.keys(cap.result.texts).length)) return { said: "", entry: null, error: failed ?? "Nothing came back - try again." };

  ctx.set((x) => {
    // onto each page as it is now - a picture that landed or a word typed meanwhile stays
    const design = { ...x.design, pages: x.design.pages.map((p) => { const n = pagesNew.find((y) => y.id === p.id); return n ? rewritten(p, f, n.asked, n.after) : p; }) };
    if (!cap || !cap.ok) return { ...x, design };
    const networks = { ...x.networks };
    for (const n of enabled(x)) { const t = cap.result.texts[n]; if (t) networks[n] = { ...networks[n], text: t }; }
    return {
      ...x, design, networks,
      firstComment: x.networks.linkedin.on && cap.result.firstComment ? cap.result.firstComment : x.firstComment,
      hashtags: mode === "topic" && cap.result.hashtags.length ? cap.result.hashtags : x.hashtags.length ? x.hashtags : cap.result.hashtags,
    };
  });
  ctx.reload();
  const left = leftOutLine([...new Set(said)]);
  const note = `${pagesNew.length} page${pagesNew.length === 1 ? "" : "s"}${cap && cap.ok ? " and the captions" : ""} written again.${left ? ` ${left}` : ""}${failed ? ` Not all of it: ${failed}` : ""}`;
  const entry = ctx.ai.record(label, before, note, "ai", versionId);
  return { said: note, entry, error: null };
}
