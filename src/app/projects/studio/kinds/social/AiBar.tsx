"use client";
// THE AI, ON THE CANVAS (SARCLA 08.11.2026: "improve the AI window a lot, the AI window is really not great, and it
// doesn't create the photo, and it opens another window. Just put it on the canvas, not there"; "the AI module should
// help generate anything that you prompt").
//
// One box under the board. Whatever is asked - a carousel about a service, a photo as the background, a shorter
// headline, the logo bottom right, a story format - comes back as canvas operations (the "design" task, a JSON schema)
// and lands on the board at once: one step of the canvas's undo, and an Undo here that takes back the whole answer
// (pages and pictures too). Pictures are made in the house style (makePicture) and dropped into their frame or behind
// the page while the rest is already there.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import UndoIcon from "@mui/icons-material/Undo";
import CloseIcon from "@mui/icons-material/Close";

import { planOps, scrimFor, type DesignAnswer } from "@/lib/content/studio/kinds/social/canvasAi";
import { pageFrom, setPageDoc, type SocialDesign } from "@/lib/content/studio/kinds/social/design";
import { makePicture } from "../../pictures";
import { T } from "./look";
import { fillFrame } from "./actions";
import type { StudioCtx } from "./Studio";

const IDEAS = [
  "Make a carousel about our cut-to-size service",
  "Make the background a photo of a food production line",
  "Shorter headline",
  "Add our logo bottom right",
  "Use the statement template with this message",
];

type Phase = { kind: "idle" } | { kind: "thinking" } | { kind: "pictures"; done: number; total: number; reply: string } | { kind: "done"; reply: string; undo: boolean } | { kind: "error"; msg: string };

export default function AiBar({ ctx }: { ctx: StudioCtx }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [focus, setFocus] = useState(false);
  const live = useRef(ctx);
  live.current = ctx;
  const before = useRef<SocialDesign | null>(null);
  const gen = useRef(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const enabled = ctx.api.data.ai && ctx.canEdit;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = text ? `${Math.min(96, el.scrollHeight)}px` : "";
  }, [text]);

  /** A picture that came: into its frame (or behind its page), on the canvas when the page is there, in every format. */
  const put = (pageId: string, into: { node: string } | "background", url: string, nat?: { w: number; h: number }) => {
    const c = live.current;
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
  };

  const ask = async (q: string) => {
    const c = live.current;
    if (!q.trim() || !enabled) return;
    const run = (gen.current += 1);
    setPhase({ kind: "thinking" });
    const snapshot = c.doc.design;
    const r = await c.api.ai<DesignAnswer>("design", { ask: q.trim(), page: c.pageIx, format: c.fmt });
    if (run !== gen.current) return;
    if (!r.ok) { setPhase({ kind: "error", msg: r.error }); return; }
    const now = live.current;
    const scene = now.canvas.current?.scene();
    if (!scene) { setPhase({ kind: "error", msg: "The canvas is not ready - try again." }); return; }
    const plan = planOps(r.result.ops, scene, now.mf);
    before.current = snapshot;
    const pageIds: string[] = [];
    if (plan.pages) {
      const made = plan.pages.map((d) => pageFrom(now.doc.design, now.fmt, d));
      pageIds.push(...made.map((p) => p.id));
      now.set((x) => ({ ...x, design: { ...x.design, pages: made } }));
      now.goPage(0);
      now.reload();
    } else if (plan.doc) {
      now.canvas.current?.load(plan.doc);
    }
    // the format after the canvas has saved what it just took
    if (plan.format && plan.format !== now.fmt) { const f = plan.format; setTimeout(() => live.current.goFormat(f), 80); }
    const reply = r.result.reply || (plan.doc || plan.pages ? "Done." : "Nothing to change.");
    const extra = plan.skipped.length ? ` ${plan.skipped.join(" ")}` : "";
    setText("");
    if (!plan.pictures.length) { setPhase({ kind: "done", reply: reply + extra, undo: !!(plan.doc || plan.pages || plan.format) }); return; }
    // the pictures, made side by side; each lands as it comes
    const currentId = now.doc.design.pages[now.pageIx]?.id ?? "";
    let done = 0;
    let failed: string | null = null;
    setPhase({ kind: "pictures", done: 0, total: plan.pictures.length, reply });
    await Promise.all(plan.pictures.map(async (job) => {
      const res = await makePicture(job.prompt, job.aspect, { projectId: now.api.data.piece.projectId, pieceId: now.api.data.piece.id });
      if (run !== gen.current) return;
      done += 1;
      if (!res.ok) { failed = res.error; } else {
        const pageId = job.page !== undefined ? pageIds[job.page] : currentId;
        put(pageId, job.into, res.picture.url, res.picture.width && res.picture.height ? { w: res.picture.width, h: res.picture.height } : undefined);
      }
      setPhase({ kind: "pictures", done, total: plan.pictures.length, reply });
    }));
    if (run !== gen.current) return;
    setPhase({ kind: "done", reply: failed ? `${reply} A picture was not made: ${failed}` : reply + extra, undo: true });
  };

  const undo = () => {
    const c = live.current;
    gen.current += 1;
    const b = before.current;
    if (!b) return;
    c.set((x) => ({ ...x, design: b }));
    c.reload();
    before.current = null;
    setPhase({ kind: "done", reply: "Taken back.", undo: false });
  };

  const busy = phase.kind === "thinking" || phase.kind === "pictures";
  const showIdeas = focus && !text && !busy && enabled;

  return (
    <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
      <Box sx={{ width: "min(720px, calc(100% - 48px))", pointerEvents: "auto", position: "relative" }}>
        {(showIdeas || phase.kind === "done" || phase.kind === "error" || phase.kind === "pictures") && (
          <Box sx={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 8px)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.75 }}>
            {showIdeas && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {IDEAS.map((idea) => (
                  <Box key={idea} component="button" type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(idea); box.current?.focus(); }} sx={{
                    all: "unset", cursor: "pointer", px: 1.25, py: 0.6, borderRadius: "6px", bgcolor: "rgba(255,255,255,.96)", border: `1px solid ${T.line}`,
                    fontSize: "0.8rem", fontWeight: 500, color: T.ink2, boxShadow: "0 4px 14px -8px rgba(16,24,40,.3)", "&:hover": { color: T.accent, borderColor: T.accent },
                  }}>{idea}</Box>
                ))}
              </Box>
            )}
            {(phase.kind === "done" || phase.kind === "error" || phase.kind === "pictures") && (
              <Box sx={{
                display: "flex", alignItems: "center", gap: 1, maxWidth: "100%", px: 1.5, py: 0.9, borderRadius: "10px", bgcolor: phase.kind === "error" ? "#fff4f2" : "rgba(255,255,255,.97)",
                border: `1px solid ${phase.kind === "error" ? "#f3c1b9" : T.line}`, boxShadow: T.shadow,
              }}>
                {phase.kind === "pictures" ? <CircularProgress size={16} sx={{ color: T.accent }} /> : <AutoAwesomeIcon sx={{ fontSize: 17, color: phase.kind === "error" ? "#b42318" : T.accent }} />}
                <Typography sx={{ fontSize: "0.84rem", color: phase.kind === "error" ? "#b42318" : T.ink, flex: 1, minWidth: 0 }}>
                  {phase.kind === "error" ? phase.msg : phase.kind === "pictures" ? `${phase.reply} Making ${phase.total > 1 ? `the pictures - ${phase.done} of ${phase.total}` : "the picture"} (up to 40 s)…` : phase.reply}
                </Typography>
                {phase.kind === "done" && phase.undo && (
                  <Box component="button" type="button" onClick={undo} sx={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, color: T.ink, "&:hover": { bgcolor: T.hover } }}>
                    <UndoIcon sx={{ fontSize: 16 }} />Undo
                  </Box>
                )}
                {phase.kind !== "pictures" && (
                  <Box component="button" type="button" aria-label="Close" onClick={() => setPhase({ kind: "idle" })} sx={{ all: "unset", cursor: "pointer", display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "6px", color: T.ink3, "&:hover": { bgcolor: T.hover } }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void ask(text); }} sx={{
          display: "flex", alignItems: "flex-end", gap: 1, pl: 1.75, pr: 0.75, py: 0.75, borderRadius: "14px", bgcolor: "#fff",
          border: `1px solid ${focus ? "rgba(194,44,110,.45)" : T.line}`, boxShadow: focus ? `0 0 0 4px rgba(194,44,110,.10), ${T.shadowLg}` : T.shadowLg, transition: "box-shadow .15s, border-color .15s",
          position: "relative", overflow: "hidden",
        }}>
          <AutoAwesomeIcon sx={{ fontSize: 20, color: T.accent, mb: 0.9 }} />
          <Box component="textarea" ref={box} rows={1} value={text} disabled={!enabled || busy}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
            placeholder={!ctx.api.data.ai ? "The AI is not set up on this hub." : !ctx.canEdit ? "Only the project's editors can change the design." : busy ? "Working on it…" : "Ask the AI for anything on this design…"}
            sx={{
              all: "unset", flex: 1, minWidth: 0, py: 1, fontSize: "0.92rem", lineHeight: 1.45, color: T.ink, resize: "none", maxHeight: 96, overflowY: "auto",
              whiteSpace: "pre-wrap", "&::placeholder": { color: T.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
            }} />
          <Box component="button" type="submit" aria-label="Ask" disabled={!enabled || busy || !text.trim()} sx={{
            all: "unset", cursor: "pointer", width: 38, height: 38, borderRadius: "10px", display: "grid", placeItems: "center", flexShrink: 0,
            bgcolor: !enabled || busy || !text.trim() ? "#eceef2" : T.accent, color: !enabled || busy || !text.trim() ? T.ink3 : "#fff", transition: "background-color .12s",
            "&:hover": { bgcolor: !enabled || busy || !text.trim() ? undefined : "#a3245c" },
          }}>
            {busy ? <CircularProgress size={18} sx={{ color: T.ink3 }} /> : <ArrowUpwardIcon sx={{ fontSize: 20 }} />}
          </Box>
          {busy && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, bgcolor: "transparent", "& .MuiLinearProgress-bar": { bgcolor: T.accent } }} />}
        </Box>
      </Box>
    </Box>
  );
}
