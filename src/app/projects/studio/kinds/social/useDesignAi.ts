"use client";
// THE SOCIAL STUDIO'S AI (night of 09.11.2026, flow standard §1 + §4; SARCLA 08.11: "improve the AI window a lot ... and
// it doesn't create the photo, and it opens another window. Just put it on the canvas, not there").
//
// What was the box under the board, now the assistant's engine on the right: an ask - about the selection or the whole
// post - comes back as canvas operations (the "design" task) and lands ON the board at once; pictures are made in the
// house style and dropped into their frame while the rest is already there. Every answer is one line in "Changes made
// here" with an Undo that puts the post back as it was before it (and every later change).
//
// The picture slots live here too (flow standard §3): Make it / Make another / Upload / Gallery / Remove, per frame, with
// the frame shimmering while its picture is made. What is being written shimmers in the map and on the canvas.

import { useCallback, useRef, useState } from "react";
import type { DesignNode } from "@/lib/design-document";
import { plainText } from "@/lib/editor/richText";
import { aspectFor, planOps, scrimFor, type DesignAnswer } from "@/lib/content/studio/kinds/social/canvasAi";
import { LOGOS, pageFrom, setPageDoc, type SocialDesign } from "@/lib/content/studio/kinds/social/design";
import { loadImage } from "@/app/editor/designRender";
import { makePicture, uploadPicture, type Picture } from "../../pictures";
import { fillFrame } from "./actions";
import type { StudioCtx } from "./Studio";

export type AiEntry = { id: number; label: string; note?: string; at: number; before: SocialDesign; undone: boolean; by: "ai" | "you" };
/** What the AI is writing now: its words, the objects it works on (on the page with that id), since when. */
export type Working = { label: string; ids: string[] | "all"; pageId: string; since: number } | null;
export type Scope = { id: string; name: string; text?: string } | null;

export const FRAME_FILL = "#DDE5EB";
export const isLogoNode = (n: DesignNode) => n.kind === "image" && Object.values(LOGOS).some((l) => l.src === n.src);
/** A place for a picture that has none yet. */
export const isEmptyFrame = (n: DesignNode) => (n.kind === "rect" || n.kind === "ellipse") && (n.fill ?? "").toUpperCase() === FRAME_FILL;
/** A picture on the page (not the logo). */
export const isPictureNode = (n: DesignNode) => n.kind === "image" && !isLogoNode(n);

/** The page's headline: its biggest words - words, not a slide's number ("02"). */
export function headlineNode(nodes: DesignNode[]): DesignNode | null {
  const texts = nodes.filter((n) => n.kind === "text" && !n.hidden && plainText(n.text).trim());
  const worded = texts.filter((n) => /[A-Za-zÀ-ɏ]{2,}/.test(plainText(n.text)));
  const pool = worded.length ? worded : texts;
  return pool.length ? [...pool].sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0))[0] : null;
}
export function headlineOf(nodes: DesignNode[]): string {
  const top = headlineNode(nodes);
  return top ? plainText(top.text).replace(/\s+/g, " ").trim() : "";
}

/** The picture's idea, before the person writes their own: what the page is about, in the house style. */
export function defaultIdea(nodes: DesignNode[], title: string): string {
  const about = headlineOf(nodes) || title || "industrial components";
  return `A real, industrial photo for "${about.slice(0, 90)}" - no text, no logos.`;
}

/** An empty frame again, in the box the picture had. */
function emptyFrame(n: DesignNode): DesignNode {
  const circle = n.mask === "circle";
  return {
    id: n.id, kind: circle ? "ellipse" : "rect", x: n.x, y: n.y, width: n.width ?? 100, height: n.height ?? 100, fill: FRAME_FILL, opacity: n.opacity ?? 1,
    ...(n.rotation ? { rotation: n.rotation } : {}), ...(n.groupId ? { groupId: n.groupId } : {}), ...(!circle && n.cornerRadius ? { cornerRadius: n.cornerRadius } : {}),
  };
}

export type DesignAi = ReturnType<typeof useDesignAi>;

export function useDesignAi(ctxRef: React.MutableRefObject<StudioCtx | null>) {
  const [working, setWorking] = useState<Working>(null);
  const [history, setHistory] = useState<AiEntry[]>([]);
  const [making, setMaking] = useState<Record<string, number>>({});
  const [slotError, setSlotError] = useState<Record<string, string>>({});
  const [ideas, setIdeas] = useState<Record<string, string>>({});
  const gen = useRef(0);
  const seq = useRef(0);

  const record = useCallback((label: string, before: SocialDesign, note?: string, by: "ai" | "you" = "ai") => {
    seq.current += 1;
    const e: AiEntry = { id: seq.current, label, note, at: Date.now(), before, undone: false, by };
    setHistory((h) => [e, ...h].slice(0, 30));
  }, []);

  /** A picture that came: into its frame (or behind its page), on the canvas when the page is there, in every format. */
  const put = useCallback((pageId: string, into: { node: string } | "background", url: string, nat?: { w: number; h: number }) => {
    const c = ctxRef.current;
    if (!c) return;
    const onCanvas = c.doc.design.pages[c.pageIx]?.id === pageId;
    c.set((x) => {
      const i = x.design.pages.findIndex((p) => p.id === pageId);
      if (i < 0) return x;
      let design = x.design;
      for (const [f, doc] of Object.entries(x.design.pages[i].by)) {
        if (!doc || (onCanvas && f === c.fmt)) continue;
        const next = into === "background" ? { ...doc, background: { ...doc.background, src: url, gradientId: null } } : { ...doc, nodes: fillFrame(doc.nodes, into.node, url, nat) };
        design = setPageDoc(design, i, f as typeof c.fmt, next);
      }
      return { ...x, design };
    });
    if (onCanvas) {
      const scene = c.canvas.current?.scene();
      if (into === "background") c.canvas.current?.setBackground({ src: url, gradientId: null, scrim: scene ? scrimFor(scene) : 30 });
      else c.canvas.current?.commit((nodes) => fillFrame(nodes, into.node, url, nat));
    }
  }, [ctxRef]);

  /** An ask to the canvas AI. Null when it is done (the change is on the board and in the list), else what to tell. */
  const ask = useCallback(async (q: string, scope: Scope = null, label?: string): Promise<string | null> => {
    const c = ctxRef.current;
    if (!c || !q.trim()) return null;
    if (!c.api.data.ai) return "The AI is not set up on this hub.";
    if (!c.canEdit) return "Only the project's editors can change the design.";
    const run = (gen.current += 1);
    const pageId = c.doc.design.pages[c.pageIx]?.id ?? "";
    setWorking({ label: scope ? `Changing the ${scope.name.toLowerCase()}` : "Writing the post", ids: scope ? [scope.id] : "all", pageId, since: Date.now() });
    const snapshot = c.doc.design;
    const said = scope
      ? `Work only on the selected object ${scope.id} (${scope.name}${scope.text ? `: "${scope.text.slice(0, 160)}"` : ""}); leave the rest as it is. ${q.trim()}`
      : q.trim();
    const r = await c.api.ai<DesignAnswer>("design", { ask: said.slice(0, 1200), page: c.pageIx, format: c.fmt });
    if (run !== gen.current) return null;
    if (!r.ok) { setWorking(null); return r.error; }
    const now = ctxRef.current!;
    const scene = now.canvas.current?.scene();
    if (!scene) { setWorking(null); return "The canvas is not ready - try again."; }
    const plan = planOps(r.result.ops, scene, now.mf);
    const pageIds: string[] = [];
    if (plan.pages) {
      const made = plan.pages.map((d) => pageFrom(now.doc.design, now.fmt, d));
      pageIds.push(...made.map((p) => p.id));
      now.set((x) => ({ ...x, design: { ...x.design, pages: made } }));
      now.goPage(0);
      now.reload();
    } else if (plan.doc) {
      now.canvas.current?.load(plan.doc);
      // the element worked on stays selected - the next ask goes on with it
      if (scope && plan.doc.nodes.some((n) => n.id === scope.id)) now.canvas.current?.select([scope.id]);
    }
    if (plan.format && plan.format !== now.fmt) { const f = plan.format; setTimeout(() => ctxRef.current?.goFormat(f), 80); }
    const changed = !!(plan.doc || plan.pages || plan.format || plan.pictures.length);
    const reply = r.result.reply || (changed ? "Done." : "Nothing to change.");
    const extra = plan.skipped.length ? ` ${plan.skipped.join(" ")}` : "";
    if (!changed) { setWorking(null); return reply + extra; }
    const entryLabel = label ?? (q.trim().length > 70 ? `${q.trim().slice(0, 68)}…` : q.trim());
    if (!plan.pictures.length) { setWorking(null); record(entryLabel, snapshot, reply + extra); return null; }
    // the pictures, made side by side; each lands in its frame as it comes - the frames shimmer meanwhile
    const currentId = now.doc.design.pages[now.pageIx]?.id ?? "";
    const frameIds = plan.pictures.map((j) => (j.into === "background" ? null : j.into.node)).filter((x): x is string => !!x);
    setWorking({ label: plan.pictures.length > 1 ? `Making ${plan.pictures.length} pictures` : "Making the picture", ids: frameIds.length ? frameIds : "all", pageId: pageIds[0] ?? currentId, since: Date.now() });
    let failed: string | null = null;
    await Promise.all(plan.pictures.map(async (job) => {
      const res = await makePicture(job.prompt, job.aspect, { projectId: now.api.data.piece.projectId, pieceId: now.api.data.piece.id });
      if (run !== gen.current) return;
      if (!res.ok) { failed = res.error; return; }
      // in the browser before it goes in: the frame never shows empty while the picture travels (09.11.2026)
      await loadImage(res.picture.url);
      if (run !== gen.current) return;
      const pid = job.page !== undefined ? pageIds[job.page] : currentId;
      put(pid, job.into, res.picture.url, res.picture.width && res.picture.height ? { w: res.picture.width, h: res.picture.height } : undefined);
    }));
    if (run !== gen.current) return null;
    setWorking(null);
    record(entryLabel, snapshot, failed ? `${reply} A picture was not made: ${failed}` : reply + extra);
    return failed ? `A picture was not made: ${failed}` : null;
  }, [ctxRef, put, record]);

  /** Put the post back as it was before this change (and every later one). */
  const undo = useCallback((e: AiEntry) => {
    const c = ctxRef.current;
    if (!c) return;
    gen.current += 1;
    setWorking(null);
    c.set((x) => ({ ...x, design: e.before }));
    c.reload();
    setHistory((h) => h.map((x) => (x.id >= e.id ? { ...x, undone: true } : x)));
  }, [ctxRef]);

  /* ── the picture slots ── */

  const nodeOf = (id: string) => ctxRef.current?.canvas.current?.scene().nodes.find((n) => n.id === id) ?? null;
  const ideaFor = useCallback((id: string) => {
    const c = ctxRef.current;
    if (ideas[id] !== undefined) return ideas[id];
    return defaultIdea(c?.canvas.current?.scene().nodes ?? c?.live?.nodes ?? [], c?.api.data.piece.title ?? "");
  }, [ctxRef, ideas]);
  const setIdea = useCallback((id: string, v: string) => setIdeas((m) => ({ ...m, [id]: v })), []);
  const clearError = (id: string) => setSlotError((m) => { const n = { ...m }; delete n[id]; return n; });

  const landIn = useCallback(async (id: string, pic: Picture | { url: string; width?: number | null; height?: number | null }, label: string) => {
    const c = ctxRef.current;
    if (!c) return;
    const pageId = c.doc.design.pages[c.pageIx]?.id ?? "";
    await loadImage(pic.url);
    const before = c.doc.design;
    put(pageId, { node: id }, pic.url, pic.width && pic.height ? { w: pic.width, h: pic.height } : undefined);
    record(label, before, undefined, label.startsWith("Picture made") ? "ai" : "you");
  }, [ctxRef, put, record]);

  /** Make it / Make another: the picture from its idea, in the frame's own shape. */
  const makeFor = useCallback(async (id: string) => {
    const c = ctxRef.current;
    const n = nodeOf(id);
    if (!c || !n) return;
    if (!c.api.data.ai) { setSlotError((m) => ({ ...m, [id]: "The AI is not set up on this hub." })); return; }
    clearError(id);
    const prompt = ideaFor(id);
    const pageId = c.doc.design.pages[c.pageIx]?.id ?? "";
    setMaking((m) => ({ ...m, [id]: Date.now() }));
    setWorking((w) => w ?? { label: "Making the picture", ids: [id], pageId, since: Date.now() });
    const res = await makePicture(prompt, aspectFor(n.width ?? 1, n.height ?? 1), { projectId: c.api.data.piece.projectId, pieceId: c.api.data.piece.id });
    if (res.ok) await landIn(id, res.picture, "Picture made for the frame");
    setMaking((m) => { const x = { ...m }; delete x[id]; return x; });
    setWorking((w) => (w && w.ids !== "all" && w.ids.length === 1 && w.ids[0] === id ? null : w));
    if (!res.ok) setSlotError((m) => ({ ...m, [id]: res.error }));
  }, [ctxRef, ideaFor, landIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFor = useCallback(async (id: string, file: File) => {
    const c = ctxRef.current;
    if (!c) return;
    clearError(id);
    setMaking((m) => ({ ...m, [id]: Date.now() }));
    const r = await uploadPicture(file, { projectId: c.api.data.piece.projectId, pieceId: c.api.data.piece.id });
    if (r.ok) await landIn(id, r.picture, "Picture uploaded into the frame");
    setMaking((m) => { const x = { ...m }; delete x[id]; return x; });
    if (!r.ok) setSlotError((m) => ({ ...m, [id]: r.error }));
  }, [ctxRef, landIn]);

  const pickFor = useCallback(async (id: string, p: Picture) => { clearError(id); await landIn(id, p, "Picture from the gallery"); }, [landIn]);

  const removeFrom = useCallback((id: string) => {
    const c = ctxRef.current;
    if (!c) return;
    const before = c.doc.design;
    c.canvas.current?.commit((nodes) => nodes.map((n) => (n.id === id ? emptyFrame(n) : n)));
    record("Picture taken out of the frame", before, undefined, "you");
  }, [ctxRef, record]);

  return { ask, working, history, undo, making, slotError, ideaFor, setIdea, makeFor, uploadFor, pickFor, removeFrom };
}
