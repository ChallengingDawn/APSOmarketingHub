"use client";
// ONE ELEMENT OF THE POST, IN ITS OWN POPUP (cv16, SARCLA 11.11.2026: "compare the evolution of this page [the Page builder]
// to the other content types' generators, and improve them"). As in the Page builder (page/pops.tsx), a click on the post
// selects ONE thing and its popup opens beside it, its sections in one order:
//   a text      WORDS (the key words between *stars* are drawn red) -> ITS LINK (a button's words: the post's link) ->
//               LOOK (colour, size, alignment) -> ASK AI (its own box: the change lands at once, with the Undo of exactly
//               that) -> Take it out · Duplicate · Forward / Back
//   a picture   the Page builder's own picture popup (page/pops.tsx PicturePop): This picture (made from the words in its
//               box NOW, "From: …" while it is made, the newest ask wins) · Gallery · Products · Fine-tune
// The canvas's label's "Ask AI" puts the cursor in THIS popup's AI box (page/barAi.ts AI_BOX_ATTR), never the whole post's.
// The element's full properties (font, effects, arrange) stay in its row of the map.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";
import FlipToBackIcon from "@mui/icons-material/FlipToBack";
import SendRoundedIcon from "@mui/icons-material/SendRounded";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { DesignNode } from "@/lib/design-document";
import { plainText } from "@/lib/editor/richText";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { C } from "@/lib/content/studio/kinds/social/design";
import { leftOutLine } from "@/lib/content/studio/kinds/social/ai";
import { aspectFor } from "@/lib/content/studio/kinds/social/canvasAi";
import { PicturePop, PopCard } from "../page/pops";
import { PINK, btn } from "../../parts";
import { T } from "./look";
import { isPictureNode } from "./useDesignAi";
import type { StudioCtx } from "./Studio";

const SWATCHES: { c: string; name: string }[] = [
  { c: C.red, name: "APSOparts red" }, { c: C.petrol, name: "Petrol" }, { c: C.ink, name: "Ink" }, { c: C.mute, name: "Grey" }, { c: C.white, name: "White" },
];
const ASKS: { label: string; ask: string }[] = [
  { label: "Shorter", ask: "Make it shorter - fewer words, the same message." },
  { label: "Clearer", ask: "Simpler words, the same facts." },
  { label: "More convincing", ask: "More convincing for an engineer or a buyer - concrete, no slogans." },
  { label: "Key word in red", ask: "Mark its one key word between stars so it shows in red." },
];
/** The store view a picture's Products tab names products in, by the post's language. */
const STORE: Record<string, string> = { DE: "de-CH", FR: "fr-CH", IT: "it-CH", EN: "en-INT", NL: "nl-NL", PL: "pl-PL", ES: "es-ES" };
export const storeFor = (lang: string) => STORE[lang] ?? "de-CH";

const Sub = ({ children, mt = 1.5 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.ink3, mt, mb: 0.6 }}>{children}</Typography>
);
const quiet = { ...btn, color: T.ink, px: 1, borderRadius: "7px", fontSize: "0.8rem", minWidth: 0 } as const;

type Said = { tone: "ok" | "warn"; text: string; undo: (() => void) | null } | null;

/** A button's words: a text grouped with a filled shape (the pill under it). */
export function isButtonText(n: DesignNode, nodes: DesignNode[]): boolean {
  return n.kind === "text" && !!n.groupId && nodes.some((x) => x.kind === "rect" && x.groupId === n.groupId && (x.width ?? 0) > 0 && (x.height ?? 0) > (n.fontSize ?? 0));
}

function TextBody({ ctx, node, name, nodes }: { ctx: StudioCtx; node: DesignNode; name: string; nodes: DesignNode[] }) {
  const [draft, setDraft] = useState(node.text ?? "");
  const focused = useRef(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [said, setSaid] = useState<Said>(null);
  useEffect(() => { if (!focused.current) setDraft(node.text ?? ""); }, [node.text]);
  useEffect(() => { setSaid(null); setQ(""); }, [node.id]);
  const commit = (fn: (n: DesignNode) => DesignNode) => ctx.canvas.current?.commit((all) => all.map((n) => (n.id === node.id ? fn(n) : n)));
  // the words land on the post a moment after the typing stops (one undo step, not one per letter)
  useEffect(() => {
    if (draft === (node.text ?? "")) return;
    const t = setTimeout(() => commit((n) => ({ ...n, text: draft })), 500);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const button = isButtonText(node, nodes);
  const size = Math.round(node.fontSize ?? 24);
  const can = ctx.canEdit && !node.locked;
  const aiOn = ctx.canEdit && ctx.api.data.ai;

  const run = async (ask: string) => {
    if (!ask.trim() || busy) return;
    setBusy(true); setSaid(null);
    const before = { ...node };
    const design = ctx.doc.design;
    const r = await ctx.api.ai<{ text: string; leftOut: string[] }>("retext", { text: node.text ?? "", ask: ask.trim(), role: name.toLowerCase(), page: ctx.pageIx });
    setBusy(false);
    if (!r.ok) { setSaid({ tone: "warn", text: r.error, undo: null }); return; }
    const left = leftOutLine(r.result.leftOut);
    if (!r.result.text.trim()) { setSaid({ tone: "warn", text: left || "No words came back - try again.", undo: null }); return; }
    commit((n) => ({ ...n, text: r.result.text }));
    setQ("");
    ctx.ai.record(`${name}: ${ask.trim().slice(0, 60)}`, design, left || undefined, "ai");
    setSaid({ tone: left ? "warn" : "ok", text: left || `Changed: "${plainText(r.result.text).replace(/\s+/g, " ").slice(0, 80)}"`, undo: () => { commit(() => before); setSaid(null); } });
  };

  return (
    <Box>
      <Sub mt={0}>Words</Sub>
      <TextField fullWidth multiline minRows={2} maxRows={6} size="small" value={draft} disabled={!can}
        onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; if (draft !== (node.text ?? "")) commit((n) => ({ ...n, text: draft })); }}
        onChange={(e) => setDraft(e.target.value.slice(0, 600))}
        helperText="*A word between stars* is drawn in APSOparts red." sx={{ "& .MuiInputBase-root": { fontSize: "0.86rem", borderRadius: "8px" }, "& .MuiFormHelperText-root": { mx: 0.25, fontSize: "0.72rem" } }} />
      {button && (
        <>
          <Sub>Its link</Sub>
          <TextField fullWidth size="small" value={ctx.doc.link.url} disabled={!ctx.canEdit} placeholder="https://www.apsoparts.com/…"
            onChange={(e) => { const url = e.target.value.trim(); ctx.set((d) => ({ ...d, link: { ...d.link, url } })); }}
            helperText={ctx.doc.link.url ? "The post's link - where this button points, in each network's text where links work." : "The post's link - a picture cannot be clicked, so the texts carry it."}
            sx={{ "& .MuiInputBase-root": { fontSize: "0.84rem", borderRadius: "8px" }, "& .MuiFormHelperText-root": { mx: 0.25, fontSize: "0.72rem" } }} />
        </>
      )}
      <Sub>Look</Sub>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
        {SWATCHES.map((s) => {
          const on = (node.fill ?? "").toUpperCase() === s.c.toUpperCase();
          return (
            <Tooltip key={s.c} title={s.name}>
              <Box component="button" type="button" disabled={!can} aria-label={s.name} aria-pressed={on} onClick={() => commit((n) => ({ ...n, fill: s.c }))} sx={{
                all: "unset", cursor: can ? "pointer" : "default", width: 22, height: 22, borderRadius: "6px", bgcolor: s.c, boxSizing: "border-box",
                border: `1px solid ${s.c === C.white ? T.line2 : "transparent"}`, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${T.focus}` : "none",
              }} />
            </Tooltip>
          );
        })}
        <Box sx={{ flex: 1 }} />
        <Button size="small" disabled={!can} onClick={() => commit((n) => ({ ...n, fontSize: Math.max(8, Math.round((n.fontSize ?? 24) / 1.12)) }))} sx={{ ...quiet, border: `1px solid ${T.line}`, px: 0.9 }} aria-label="Smaller">A−</Button>
        <Typography sx={{ fontSize: "0.76rem", color: T.ink3, fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "center" }}>{size} px</Typography>
        <Button size="small" disabled={!can} onClick={() => commit((n) => ({ ...n, fontSize: Math.round((n.fontSize ?? 24) * 1.12) }))} sx={{ ...quiet, border: `1px solid ${T.line}`, px: 0.9 }} aria-label="Bigger">A+</Button>
      </Box>
      <Box sx={{ mt: 1 }}>
        <SquareChoice value={node.align ?? "left"} onChange={(a) => commit((n) => ({ ...n, align: a }))}
          options={[{ key: "left", label: "Left", disabled: !can }, { key: "center", label: "Centre", disabled: !can }, { key: "right", label: "Right", disabled: !can }]} />
      </Box>
      <Sub>Ask AI</Sub>
      <Box sx={{ p: 1, borderRadius: "9px", bgcolor: "rgba(194,44,110,.045)", border: "1px solid rgba(194,44,110,.16)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {busy ? <CircularProgress size={15} thickness={5} sx={{ color: PINK, flexShrink: 0 }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17, color: PINK, flexShrink: 0 }} />}
          <InputBase fullWidth value={q} disabled={busy || !aiOn} onChange={(e) => setQ(e.target.value)} placeholder={!aiOn ? "The AI is not set up here" : busy ? "Writing…" : `Ask AI for this ${name.toLowerCase()}…`}
            inputProps={{ [AI_BOX_ATTR]: "1" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(q); } }} sx={{ fontSize: "0.84rem", "& input::placeholder": { color: "#8a95a3", opacity: 1 } }} />
          <IconButton size="small" disabled={busy || !q.trim() || !aiOn} onClick={() => void run(q)} aria-label="Ask" sx={{ color: PINK }}><SendRoundedIcon sx={{ fontSize: 17 }} /></IconButton>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
          {ASKS.map((a) => (
            <Box key={a.label} component="button" type="button" disabled={busy || !aiOn} onClick={() => void run(a.ask)} sx={{
              all: "unset", cursor: busy || !aiOn ? "default" : "pointer", fontSize: "0.74rem", fontWeight: 650, color: busy || !aiOn ? "#b3bccb" : T.ink, px: 0.9, py: 0.3, borderRadius: "5px",
              border: `1px solid ${T.line}`, bgcolor: "#fff", "&:hover": busy ? {} : { borderColor: PINK, color: PINK },
            }}>{a.label}</Box>
          ))}
        </Box>
      </Box>
      {said && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
          <Typography sx={{ flex: 1, fontSize: "0.78rem", color: said.tone === "warn" ? "#a96a12" : "#1b7a55", lineHeight: 1.4 }}>{said.text}</Typography>
          {said.undo && <Button size="small" onClick={said.undo} sx={{ ...btn, px: 1, py: 0, minWidth: 0, color: PINK, border: `1px solid ${T.line}`, borderRadius: "6px", flexShrink: 0, fontSize: "0.76rem" }}>Undo</Button>}
        </Box>
      )}
    </Box>
  );
}

/** Take it out · Duplicate · Forward / Back - the popup's foot for any element. */
function Foot({ ctx, node, onClose }: { ctx: StudioCtx; node: DesignNode; onClose: () => void }) {
  const c = ctx.canvas.current;
  const can = ctx.canEdit && !node.locked;
  const group = (all: DesignNode[]) => (node.groupId ? all.filter((n) => n.groupId === node.groupId) : all.filter((n) => n.id === node.id));
  const ib = { p: 0.45, color: T.ink3, "&:hover": { color: T.ink, bgcolor: "rgba(21,34,58,.06)" } } as const;
  const order = (front: boolean) => c?.commit((all) => {
    const ids = new Set(group(all).map((n) => n.id));
    const moved = all.filter((n) => ids.has(n.id));
    const rest = all.filter((n) => !ids.has(n.id));
    return front ? [...rest, ...moved] : [...rest.filter((n) => n.kind === "scrim"), ...moved, ...rest.filter((n) => n.kind !== "scrim")];
  });
  if (!can) return null;
  return (
    <>
      <Button size="small" onClick={() => { c?.commit((all) => { const ids = new Set(group(all).map((n) => n.id)); return all.filter((n) => !ids.has(n.id)); }); onClose(); }}
        startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: T.ink3 }}>Take it out</Button>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Duplicate - one more next to it"><IconButton size="small" aria-label="Duplicate" sx={ib} onClick={() => {
        if (!c) return;
        const tag = Date.now().toString(36);
        let first = "";
        c.commit((all) => {
          const g = group(all);
          const gid = node.groupId ? `${node.groupId.slice(0, 60)}d${tag}` : undefined;
          const copies = g.map((n, i) => ({ ...n, id: `${n.id.slice(0, 60)}d${tag}${i}`, x: n.x + 24, y: n.y + 24, ...(gid ? { groupId: gid } : {}) }));
          first = copies.find((n) => n.kind === node.kind)?.id ?? copies[0]?.id ?? "";
          return [...all, ...copies];
        });
        if (first) setTimeout(() => c.select([first]), 0);
      }}><ContentCopyOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      <Tooltip title="Bring it forward - over the rest"><IconButton size="small" aria-label="Bring forward" sx={ib} onClick={() => order(true)}><FlipToFrontIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      <Tooltip title="Send it back - under the rest"><IconButton size="small" aria-label="Send back" sx={ib} onClick={() => order(false)}><FlipToBackIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
    </>
  );
}

export default function ElementPop({ ctx, node, name, nodes, onClose }: { ctx: StudioCtx; node: DesignNode; name: string; nodes: DesignNode[]; onClose: () => void }) {
  const ai = ctx.ai;
  const file = useRef<HTMLInputElement>(null);
  const kicker = `${ctx.doc.design.pages.length > 1 ? `Page ${ctx.pageIx + 1}` : "The post"}${ctx.lang ? ` · ${ctx.lang}` : ""} · ${name}`;
  if (node.kind === "text") {
    const words = plainText(node.text).replace(/\s+/g, " ").trim();
    return (
      <PopCard kicker={kicker} title={words || name} onClose={onClose} maxBody="min(50vh, 430px)" foot={<Foot ctx={ctx} node={node} onClose={onClose} />}>
        <TextBody key={node.id} ctx={ctx} node={node} name={name} nodes={nodes} />
      </PopCard>
    );
  }
  // a picture or an empty frame: the Page builder's picture popup
  const pic = isPictureNode(node);
  const m = ai.making[node.id];
  const err = ai.slotError[node.id];
  return (
    <>
      <PicturePop kicker={kicker} title={pic ? "Picture" : "Picture frame - no picture yet"} api={ctx.api} store={storeFor(ctx.lang ?? ctx.mainLang)}
        aspect={aspectFor(node.width ?? 1, node.height ?? 1)} url={pic ? node.src ?? "" : ""} alt="" noAlt
        idea={ai.ideaFor(node.id)} making={m ? { state: "making", label: m.label, idea: m.idea ?? undefined } : err ? { state: "error", error: err } : null}
        canEdit={ctx.canEdit && !node.locked} canMake={!!ctx.api.data.ai}
        onMake={(idea) => void ai.makeFor(node.id, idea)} onIdea={(v) => ai.setIdea(node.id, v)}
        onUpload={() => file.current?.click()} onPick={(p) => void ai.pickFor(node.id, p)} onAlt={() => undefined}
        onRemove={pic ? () => ai.removeFrom(node.id) : undefined}
        onRefine={pic && ctx.api.data.ai ? (ask) => ai.refineFor(node.id, ask) : null}
        onClose={onClose} />
      <input ref={file} type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void ai.uploadFor(node.id, f); }} />
    </>
  );
}
