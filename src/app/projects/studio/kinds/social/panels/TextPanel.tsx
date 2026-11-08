"use client";
// TEXT (SARCLA 08.11.2026: "improve text tiles and allow generating text with AI by describing, and this should be
// motion-design quality we are used to"). The AI first: describe what to say, pick its shape, and the words land on the
// page set like our films - bold Futura, the key words red, on the grid. Then the tiles, each drawn as it will look.

import { useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { FUTURA_STACK } from "@/app/editor/richKonva";
import { placeWords, type WordsStyle } from "@/lib/content/studio/kinds/social/canvasAi";
import { composeWords, type TextRole } from "@/lib/content/studio/kinds/social/templates";
import { C } from "@/lib/content/studio/kinds/social/design";
import { Btn, Head, Note, PanelFrame, T, Tile } from "../look";
import { addText } from "../actions";
import type { StudioCtx } from "../Studio";

const F = FUTURA_STACK;
/** Key words between stars, painted red in a tile. */
function Words({ text }: { text: string }) {
  return <>{text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <span key={i} style={{ color: C.red }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}</>;
}

const TILES: { role: TextRole; label: string; sample: string; view: React.ReactNode }[] = [
  { role: "headline", label: "Headline", sample: "Your headline with a *key word*", view: <Box sx={{ font: `700 26px/1.04 ${F}`, letterSpacing: "-0.01em", color: C.ink }}><Words text="Add a *headline*" /></Box> },
  { role: "subhead", label: "Subheading", sample: "A line that *explains* it", view: <Box sx={{ font: `700 18px/1.15 ${F}`, color: C.ink }}><Words text="Add a *subheading*" /></Box> },
  { role: "body", label: "Body text", sample: "A sentence or two that says what it is and why it matters.", view: <Box sx={{ font: `500 14px/1.35 ${F}`, color: C.mute }}>Add a little body text</Box> },
  { role: "eyebrow", label: "Kicker", sample: "Sealing technology", view: <Box sx={{ display: "flex", alignItems: "center", gap: 1, font: `500 14px/1.2 ${F}`, color: C.mute }}><Box sx={{ width: 22, height: 4, borderRadius: 2, bgcolor: C.red }} />Add a kicker</Box> },
  { role: "quote", label: "Quote", sample: "The words exactly as they were *said*.", view: <Box sx={{ font: `500 17px/1.2 ${F}`, color: C.ink }}><Box component="span" sx={{ color: C.red, fontWeight: 700, fontSize: 30, lineHeight: 0, verticalAlign: "-0.35em", mr: 0.25 }}>&ldquo;</Box><Words text="A *quote*, as it was said" /></Box> },
  { role: "number", label: "Big number", sample: "6", view: <Box sx={{ font: `700 40px/0.95 ${F}`, color: C.red, letterSpacing: "-0.02em" }}>24<Box component="span" sx={{ font: `500 14px ${F}`, color: C.mute, ml: 1, letterSpacing: 0 }}>a big number</Box></Box> },
  { role: "list", label: "List", sample: "The first point\nThe second point\nThe third point", view: <Box sx={{ font: `500 14px/1.5 ${F}`, color: C.ink }}><b style={{ color: C.red }}>1.</b> A list<br /><b style={{ color: C.red }}>2.</b> Of short points</Box> },
  { role: "caption", label: "Caption", sample: "A small line - a source, a place, a name", view: <Box sx={{ font: `500 12px/1.3 ${F}`, color: C.mute }}>Add a caption</Box> },
  { role: "cta", label: "Call to action", sample: "apsoparts.com", view: <Box component="span" sx={{ display: "inline-block", px: 1.5, py: 0.6, borderRadius: "6px", bgcolor: C.red, color: "#fff", font: `700 13px/1.2 ${F}` }}>apsoparts.com</Box> },
];

const COMBOS: { label: string; blocks: { role: TextRole; text: string }[]; view: React.ReactNode }[] = [
  {
    label: "Type poster", blocks: [{ role: "headline", text: "Cut.\nSized.\n*Shipped.*" }, { role: "body", text: "Engineering plastics, cut to your size with DirectCUT." }],
    view: <Box sx={{ font: `700 22px/0.98 ${F}`, color: C.ink, letterSpacing: "-0.01em" }}>Cut.<br />Sized.<br /><span style={{ color: C.red }}>Shipped.</span></Box>,
  },
  {
    label: "Kicker, headline, text, button", blocks: [{ role: "eyebrow", text: "Engineering plastics" }, { role: "headline", text: "Plates and rods, *cut to your size*" }, { role: "body", text: "Order the exact dimensions you need, right in the shop." }, { role: "cta", text: "apsoparts.com" }],
    view: (
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, font: `500 10px ${F}`, color: C.mute }}><Box sx={{ width: 14, height: 3, bgcolor: C.red, borderRadius: 2 }} />Engineering plastics</Box>
        <Box sx={{ font: `700 17px/1.05 ${F}`, color: C.ink, mt: 0.5 }}>Plates and rods, <span style={{ color: C.red }}>cut to your size</span></Box>
        <Box component="span" sx={{ display: "inline-block", mt: 0.75, px: 1, py: 0.3, borderRadius: "4px", bgcolor: C.red, color: "#fff", font: `700 9px ${F}` }}>apsoparts.com</Box>
      </Box>
    ),
  },
  {
    label: "Number and meaning", blocks: [{ role: "number", text: "6" }, { role: "headline", text: "technologies, *one shop*" }],
    view: <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}><Box sx={{ font: `700 44px/0.9 ${F}`, color: C.red }}>6</Box><Box sx={{ font: `700 16px/1.05 ${F}`, color: C.ink }}>technologies, <span style={{ color: C.red }}>one shop</span></Box></Box>,
  },
];

export default function TextPanel({ ctx }: { ctx: StudioCtx }) {
  const [describe, setDescribe] = useState("");
  const [style, setStyle] = useState<WordsStyle>("headline");
  const hasWords = (ctx.live?.nodes ?? []).some((n) => n.kind === "text");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ai = ctx.api.data.ai && ctx.canEdit;

  const write = async () => {
    setBusy(true); setMsg(null);
    const r = await ctx.api.ai<{ blocks: { role: TextRole; text: string }[] }>("words", { describe, style });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    if (!r.result.blocks.length) { setMsg("No words came back - say a little more about it."); return; }
    const c = ctx.canvas.current;
    const scene = c?.scene();
    if (!c || !scene) return;
    c.load(placeWords(scene, r.result.blocks, replace && hasWords, ctx.mf));
    setMsg("On the page - Ctrl+Z takes it back.");
  };
  const combo = (blocks: { role: TextRole; text: string }[]) => {
    const c = ctx.canvas.current;
    const scene = c?.scene();
    if (!c || !scene) return;
    const nodes = composeWords(blocks, scene.canvas, ctx.mf, { place: "middle" });
    c.commit((cur) => [...cur, ...nodes]);
    c.select(nodes.map((n) => n.id));
  };

  return (
    <PanelFrame title="Text">
      <Box sx={{ p: 1.5, borderRadius: "12px", bgcolor: T.sunken, border: `1px solid ${T.line}` }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
          <AutoAwesomeIcon sx={{ fontSize: 17, color: T.accent }} />
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: T.ink }}>Write it with AI</Typography>
        </Box>
        <Box component="textarea" value={describe} disabled={!ai || busy} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescribe(e.target.value)} rows={3}
          placeholder="What should it say? e.g. our O-rings in every size, for maintenance teams who need one today"
          sx={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${T.line}`, fontSize: "0.86rem", lineHeight: 1.45, color: T.ink, "&:focus": { borderColor: T.accent }, "&::placeholder": { color: T.ink3 } }} />
        <Box sx={{ mt: 1.25 }}>
          <SquareChoice value={style} onChange={setStyle} options={[{ key: "headline", label: "Headline" }, { key: "poster", label: "Poster" }, { key: "list", label: "List" }, { key: "quote", label: "Quote" }, { key: "number", label: "Number" }]} />
        </Box>
        {hasWords && (
          <FormControlLabel sx={{ mt: 0.5, ml: -0.75, "& .MuiFormControlLabel-label": { fontSize: "0.8rem", color: T.ink2 } }}
            control={<Checkbox size="small" checked={replace} onChange={(e) => setReplace(e.target.checked)} />} label="Replace the words on the page" />
        )}
        <Btn main disabled={!ai || busy} onClick={() => void write()} icon={busy ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />} sx={{ width: "100%", mt: 1 }}>
          {busy ? "Writing…" : "Write it on the page"}
        </Btn>
        {msg && <Note sx={{ mt: 1, color: msg.startsWith("On the page") ? T.ink2 : "#b42318" }}>{msg}</Note>}
        {!ctx.api.data.ai && <Note sx={{ mt: 1 }}>The AI is not set up on this hub.</Note>}
      </Box>

      <Head>Text</Head>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {TILES.map((t) => (
          <Tile key={t.role} onClick={() => addText(ctx, t.role, t.sample)} disabled={!ctx.canEdit} title={`Add a ${t.label.toLowerCase()}`} sx={{ px: 1.75, py: 1.4 }}>
            {t.view}
          </Tile>
        ))}
      </Box>

      <Head>Combinations</Head>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {COMBOS.map((c) => (
          <Tile key={c.label} onClick={() => combo(c.blocks)} disabled={!ctx.canEdit} sx={{ px: 1.75, py: 1.5, bgcolor: "#f8f9fb" }}>
            {c.view}
            <Typography sx={{ mt: 1, fontSize: "0.72rem", color: T.ink3 }}>{c.label}</Typography>
          </Tile>
        ))}
      </Box>
      <Note sx={{ mt: 2 }}>Put *stars* around a word to make it red - as in our films.</Note>
    </PanelFrame>
  );
}
