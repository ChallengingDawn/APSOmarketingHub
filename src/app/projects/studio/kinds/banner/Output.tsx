"use client";
// WHAT THE BANNER GIVES, AND THE AI BESIDE IT (08.11.2026; Content v3 - SARCLA: "banner also" - the editing "very
// confusing"). "Get it" on the stage's bar: for the place shown, the paste block for Magento (copy it, or as a page)
// and the picture at its real size and sharp (2x); every picture at once where there are several. What to look at
// before it goes out, as lines under the banner. And the assistant, which works on the part of the banner that is open
// ("Shorter", "Another one") or on the words of every place. Nothing is sent to Magento or anywhere else from here.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { isHubPicture } from "@/lib/content/studio/kinds/banner/brand";
import { picturesOf, type Check } from "@/lib/content/studio/kinds/banner/checks";
import { PRESET, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { htmlFile, pasteBlock, stillMarkup, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import type { CopyAnswer, Variant } from "@/lib/content/studio/kinds/banner/ai";
import { AssistantPanel, PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { PART_NAME } from "./Editor";
import { download, fileName, htmlToPng } from "./png";

async function pngOf(d: BannerDoc, k: PresetKey, prefix: string, scale: number, font: string) {
  const p = PRESET[k];
  const s = stillMarkup(d, k, prefix);
  return htmlToPng({ html: s.html, css: s.css, width: p.w, height: p.h ?? 400, scale, fontCss: font });
}

/** The place's PNGs, downloaded one after another; what could not be drawn is said. */
export function usePng(doc: BannerDoc, prefix: string, title: string, font: string | null) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (keys: PresetKey[], scale: number, tag: string) => {
    setBusy(tag); setNote(null);
    const missed = new Set<string>();
    try {
      for (const k of keys) {
        const { blob, missing } = await pngOf(doc, k, prefix, scale, font ?? "");
        missing.forEach((m) => missed.add(m));
        download(blob, fileName(title, `-${PRESET[k].w}x${PRESET[k].h}${scale > 1 ? "@2x" : ""}.png`));
      }
      if (missed.size) setNote("A picture could not be fetched - the PNG was drawn without it.");
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  return { busy, note, run };
}

/** A check, in a line: red where it stops the place, amber where it is worth a look. */
export function CheckLines({ items, ok }: { items: Check[]; ok: string }) {
  if (!items.length) return <Typography sx={{ fontSize: "0.82rem", color: "#1b7a55", display: "flex", alignItems: "center", gap: 0.75 }}><CheckIcon sx={{ fontSize: 17 }} />{ok}</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      {items.map((c, i) => (
        <Box key={i} sx={{ display: "flex", gap: 0.9, alignItems: "flex-start", fontSize: "0.82rem", color: INK, lineHeight: 1.4 }}>
          {c.level === "stop"
            ? <ErrorOutlineRoundedIcon sx={{ fontSize: 17, color: "#c5221f", mt: "1px", flexShrink: 0 }} />
            : <WarningAmberRoundedIcon sx={{ fontSize: 17, color: AMBER, mt: "1px", flexShrink: 0 }} />}
          <span>{c.text}</span>
        </Box>
      ))}
    </Box>
  );
}

const copyText = async (t: string) => {
  try { await navigator.clipboard.writeText(t); } catch {
    const a = document.createElement("textarea");
    a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove();
  }
};

/** "Get it": what the place shown gives - the paste block, the PNGs - and every picture at once. */
export function GetIt({ doc, k, prefix, title, png }: { doc: BannerDoc; k: PresetKey | null; prefix: string; title: string; png: ReturnType<typeof usePng> }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [done, setDone] = useState(false);
  const p = k ? PRESET[k] : null;
  const pictures = sizesOf(doc).filter((x) => PRESET[x].h);
  const hubPic = picturesOf(doc).find(isHubPicture);
  const block = () => (k ? pasteBlock(doc, k, prefix, title, { origin: window.location.origin }) : "");
  const close = () => setAnchor(null);
  const item = { fontSize: "0.86rem", gap: 1.25, py: 0.9, whiteSpace: "normal", lineHeight: 1.35 };
  return (
    <>
      <Button size="small" variant="contained" disableElevation onClick={(e) => setAnchor(e.currentTarget)} disabled={!!png.busy}
        startIcon={png.busy ? <CircularProgress size={14} color="inherit" /> : done ? <CheckIcon sx={{ fontSize: 17 }} /> : <DownloadIcon sx={{ fontSize: 17 }} />}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />} sx={{ ...mainBtn, borderRadius: "6px", py: 0.4 }}>
        {done ? "Copied" : "Get it"}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 300, borderRadius: "10px" } } }}>
        {p && k && (
          <Typography sx={{ px: 2, pt: 0.75, pb: 0.5, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>{p.label}</Typography>
        )}
        {p && k && p.out === "html" && [
          <MenuItem key="copy" sx={item} onClick={async () => { await copyText(block()); close(); setDone(true); setTimeout(() => setDone(false), 1600); }}>Copy the paste block for Magento</MenuItem>,
          <MenuItem key="html" sx={item} onClick={() => { download(htmlFile(block(), title), fileName(title, `-${k}.html`)); close(); }}>The paste block as a page (HTML)</MenuItem>,
        ]}
        {p && k && p.h && [
          <MenuItem key="png1" sx={item} onClick={() => { close(); void png.run([k], 1, `${k}1`); }}>PNG, {p.w} × {p.h}</MenuItem>,
          <MenuItem key="png2" sx={item} onClick={() => { close(); void png.run([k], 2, `${k}2`); }}>PNG, sharp on fine screens (2×)</MenuItem>,
        ]}
        {pictures.length > 1 && [
          <Divider key="d1" />,
          <MenuItem key="all" sx={item} onClick={() => { close(); void png.run(pictures, 1, "all"); }}>Every picture of the banner · {pictures.length} PNG</MenuItem>,
        ]}
        {hubPic && p?.out === "html" && [
          <Divider key="d2" />,
          <MenuItem key="pic" sx={item} component="a" href={hubPic} download onClick={close}>The picture, for the shop&apos;s media</MenuItem>,
        ]}
        <Typography sx={{ px: 2, pt: 1, pb: 0.75, fontSize: "0.72rem", color: MUTED, whiteSpace: "normal", lineHeight: 1.45 }}>
          {p?.out === "html" ? "Magento's Page Builder: one row without padding, one HTML Code element, the whole block. Nothing goes to Magento from here - paste it in, on ACC first." : "Made in your browser, from what you see."}
        </Typography>
      </Menu>
    </>
  );
}

const ASK_FOR: Partial<Record<PickPart, { shorter: string; another: string }>> = {
  eyebrow: { shorter: "Make only the small line over the headline (the eyebrow) shorter. Keep everything else word for word.", another: "Write another small line over the headline (the eyebrow). Keep everything else word for word." },
  headline: { shorter: "Make only the headline shorter. Keep everything else word for word.", another: "Write another headline from another angle. Keep everything else word for word." },
  line: { shorter: "Make only the line under the headline shorter. Keep everything else word for word.", another: "Write another line under the headline. Keep everything else word for word." },
  button: { shorter: "Make only the button's words shorter. Keep everything else word for word.", another: "Write other words for the button - one to three, an action. Keep everything else word for word." },
};

/** The AI beside the banner: on the part that is open, or on the words of every place; other headlines to pick from. */
export function BannerAssistant({ api, doc, set, pick, setPick }: { api: StudioApi; doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; pick: PickPart | null; setPick: (p: PickPart | null) => void }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [undo, setUndo] = useState<BannerDoc | null>(null);
  const enabled = api.data.ai && api.data.access.canEdit;
  const n = sizesOf(doc).length;
  const asks = pick ? ASK_FOR[pick] : undefined;
  const apply = (a: CopyAnswer) => {
    setUndo(doc);
    set((d) => ({
      ...d,
      content: { ...d.content, eyebrow: a.content.eyebrow, headline: a.content.headline, rotatingWords: a.content.rotatingWords, line: a.content.line, button: { ...d.content.button, label: a.content.button } },
      own: a.own,
    }));
  };
  const copy = async (ask?: string): Promise<string | null> => {
    const r = await api.ai<CopyAnswer>("copy", ask ? { ask } : {});
    if (!r.ok) return r.error;
    apply(r.result);
    return null;
  };
  const headlines = async () => {
    const r = await api.ai<{ headlines: Variant[] }>("variants");
    if (!r.ok) return r.error;
    setVariants(r.result.headlines);
    return r.result.headlines.length ? null : "No headline came back - try again.";
  };
  const forPart = (text: string) => (pick && asks ? `About the ${PART_NAME[pick].toLowerCase()} only: ${text} Keep everything else word for word.` : text);
  return (
    <AssistantPanel enabled={enabled} placeholder={asks ? `The ${PART_NAME[pick!].toLowerCase()} in your words - e.g. for buyers in food plants` : "Shorter, for buyers in food plants…"}
      onAsk={(text) => copy(forPart(text))}
      top={asks ? (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 0.5 }}>Working on</Typography>
          <SquareChoice<string> value="part" onChange={(v) => { if (v === "all") setPick(null); }} options={[{ key: "part", label: PART_NAME[pick!] }, { key: "all", label: "Every word" }]} />
        </Box>
      ) : undefined}
      quick={asks ? [
        { label: "Shorter", run: () => copy(asks.shorter) },
        pick === "headline" ? { label: "Three other headlines", run: headlines } : { label: "Another one", run: () => copy(asks.another) },
      ] : [
        { label: n > 1 ? `Write the words for the ${n} places` : "Write the words", run: () => copy() },
        { label: "Three other headlines", run: headlines },
      ]}>
      {variants.length > 0 && (
        <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>Pick one</Typography>
          {variants.map((v, i) => (
            <Box key={i} component="button" type="button" disabled={!enabled} onClick={() => { setUndo(doc); set((d) => ({ ...d, content: { ...d.content, headline: v.headline } })); }} sx={{
              all: "unset", cursor: "pointer", p: 1.25, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff",
              "&:hover": { borderColor: PINK }, "&:focus-visible": { outline: `2px solid ${PINK}` },
            }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK, lineHeight: 1.3 }}>{v.headline}</Typography>
              {v.angle && <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.25 }}>{v.angle}</Typography>}
            </Box>
          ))}
        </Box>
      )}
      {undo && (
        <Button size="small" startIcon={<UndoIcon sx={{ fontSize: 17 }} />} onClick={() => { const u = undo; setUndo(null); set(() => u); }} sx={{ ...btn, mt: 1.5, color: MUTED }}>
          Undo the AI&apos;s change
        </Button>
      )}
    </AssistantPanel>
  );
}
