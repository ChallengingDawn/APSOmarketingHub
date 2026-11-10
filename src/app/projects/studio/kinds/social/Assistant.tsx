"use client";
// THE SOCIAL STUDIO'S ASSISTANT (night of 09.11.2026, flow standard §1: right = the assistant, as in the page studio).
// "Working on" the selection ("Headline" with ×) or the whole post; 3-4 quick asks for that; the free box. "Changes made
// here", each with an Undo, is the bar's history icon since Content v7 (SARCLA 10.11.2026: "a small icon on top - a
// timeline") - handed there from here (../../frame.tsx). Whatever is asked still lands ON the canvas at once (SARCLA 08.11: "it opens another
// window. Just put it on the canvas, not there") - the assistant only says what it did.

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import type { DesignNode } from "@/lib/design-document";
import { plainText } from "@/lib/editor/richText";
import { AssistantPanel, PINK, type QuickAsk } from "../../parts";
import { useTimeline } from "../../frame";
import { useClock } from "../../standard";
import { T } from "./look";
import { elementName, headlineIdOf } from "./Map";
import { isEmptyFrame, isPictureNode, type Scope } from "./useDesignAi";
import type { StudioCtx } from "./Studio";

/** What the assistant works on: the one selected element, or nothing (the whole post). */
export function scopeOf(ctx: StudioCtx): { scope: Scope; node: DesignNode | null } {
  const nodes = ctx.live?.nodes ?? [];
  const sel = ctx.selection.map((id) => nodes.find((n) => n.id === id)).filter((n): n is DesignNode => !!n);
  if (!sel.length) return { scope: null, node: null };
  const n = sel.find((x) => x.kind === "text") ?? sel[0];
  const name = elementName(n, headlineIdOf(nodes));
  return { scope: { id: n.id, name, text: n.kind === "text" ? plainText(n.text).replace(/\s+/g, " ").trim() : undefined }, node: n };
}

export default function Assistant({ ctx, inputRef }: { ctx: StudioCtx; inputRef: React.Ref<HTMLTextAreaElement> }) {
  const ai = ctx.ai;
  const { scope, node } = scopeOf(ctx);
  const enabled = ctx.api.data.ai && ctx.canEdit;
  const clock = useClock(!!ai.working);
  useTimeline(ctx.doc.log.map((e) => ({
    id: e.id, label: e.label, note: e.note, at: e.at, by: e.by, undone: e.undone,
    undo: ai.canUndo(e) && ctx.canEdit ? { tip: "Put the post back as it was before this (and every later change)", run: () => void ai.undo(e) } : null,
    why: !e.undone && !ai.canUndo(e) ? "to go back: Versions, top right" : null,
  })));
  const ask = (q: string, label?: string) => () => ai.ask(q, scope, label);

  const quick: QuickAsk[] = !node ? [
    { label: "Write the post from the brief", run: ask("Write this post's design from the project's brief: the words of this page in our manner. Keep the layout and the photos.", "Wrote the whole post") },
    { label: "Shorter words on the page", run: ask("Make every text on this page shorter - fewer words, the same message.", "Shorter words on the page") },
    { label: "Make it a carousel of 5 pages", run: ask("Make a carousel of 5 pages from this post and the brief: a cover, one idea per page, the last page points to the shop. Keep the shop's own photos; no new pictures.", "Made a carousel") },
    { label: "Our logo top left", run: ask("Put our logo top left.", "Logo top left") },
  ] : node.kind === "text" ? [
    { label: "Shorter", run: ask("Make it shorter - fewer words, the same message.", `${scope!.name}: shorter`) },
    { label: "Make it more convincing", run: ask("Make it more convincing for an engineer or a buyer - concrete, no slogans.", `${scope!.name}: more convincing`) },
    { label: "Say it another way", run: ask("Say it another way - a different angle, the same length.", `${scope!.name}: another way`) },
    { label: "Mark the key word in red", run: ask("Mark its one key word between stars so it shows in red.", `${scope!.name}: key word in red`) },
  ] : isEmptyFrame(node) || isPictureNode(node) ? [
    { label: isPictureNode(node) ? "Make another picture" : "Make the picture", run: async () => { await ai.makeFor(node.id); return null; } },
    { label: "A picture that fits the headline", run: ask("Put a new photo in this frame that shows what the headline says - real, industrial, no text.", `${scope!.name}: a fitting picture`) },
  ] : [
    { label: "Our red for it", run: ask("Give it APSOparts red.", `${scope!.name}: red`) },
    { label: "Our petrol for it", run: ask("Give it APSOparts petrol (#274e64).", `${scope!.name}: petrol`) },
  ];

  const top = (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: "0.76rem", color: T.ink3, mb: 0.75 }}>Working on</Typography>
      {scope ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.07)", border: "1px solid rgba(194,44,110,.25)" }}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: PINK }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: PINK }}>Page {ctx.pageIx + 1} · {scope.name}</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{scope.text || (node && isEmptyFrame(node) ? "An empty frame" : "This element alone")}</Typography>
          </Box>
          <Tooltip title="The whole post again"><IconButton size="small" aria-label="Work on the whole post" onClick={() => ctx.canvas.current?.select([])}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Box>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: T.ink, fontWeight: 600 }}>The whole post <Box component="span" sx={{ color: T.ink3, fontWeight: 400 }}>· select something on the canvas to work on it alone</Box></Typography>
      )}
      {ai.working && (
        <Typography role="status" sx={{ mt: 1, fontSize: "0.8rem", fontWeight: 700, color: PINK }}>
          {ai.working.label}… <Box component="span" sx={{ color: T.ink3, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{clock}</Box>
        </Typography>
      )}
    </Box>
  );

  return (
    <AssistantPanel quick={quick} enabled={enabled} top={top} inputRef={inputRef}
      onAsk={(text) => ai.ask(text, scope)}
      placeholder={scope ? `What should change in the ${scope.name.toLowerCase()}? (Ctrl+Enter)` : "What should change on the post? A carousel about a service, a photo as the background, the story format… (Ctrl+Enter)"}>
    </AssistantPanel>
  );
}
