"use client";
// WHAT THE BANNER GIVES, AND THE AI BESIDE IT (08.11.2026; Content v3 - SARCLA: "banner also" - the editing "very
// confusing"; 09.11.2026 the flow standard: "Get it" is the map's pinned last step, every AI change is listed with an
// Undo, a part's ask changes that part only). "Get it": for the place shown, the paste block for Magento (copy it, or as a page)
// and the picture at its real size and sharp (2x); every picture at once where there are several. What to look at
// before it goes out, as lines under the banner. And the assistant, which works on the part of the banner that is open
// ("Shorter", "Another one") or on the words of every place. Nothing is sent to Magento or anywhere else from here.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { isHubPicture } from "@/lib/content/studio/kinds/banner/brand";
import { picturesOf, placeChecks, type Check } from "@/lib/content/studio/kinds/banner/checks";
import { PHONE, PRESET, hasPhone, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { htmlFile, pasteBlock, sizeOf, stillMarkup, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import { applyCopy, applyPlace, type CopyAnswer, type Variant } from "@/lib/content/studio/kinds/banner/ai";
import { AssistantPanel, PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { PART_NAME, inLine } from "./Editor";
import { download, fileName, htmlToPng } from "./png";
import { ChangesList, StepView, WorkingOn, useChanges, type Change } from "../video/map";

async function pngOf(d: BannerDoc, k: PresetKey, prefix: string, scale: number, font: string, phone = false) {
  const z = sizeOf(k, phone) ?? { w: PRESET[k].w, h: 400 };
  const s = stillMarkup(d, k, prefix, { phone });
  return htmlToPng({ html: s.html, css: s.css, width: z.w, height: z.h, scale, fontCss: font });
}

/** The place's PNGs, downloaded one after another; what could not be drawn is said. */
export function usePng(doc: BannerDoc, prefix: string, title: string, font: string | null) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (keys: PresetKey[], scale: number, tag: string) => {
    setBusy(tag); setNote(null);
    const missed = new Set<string>();
    try {
      // the shop banner comes with its picture for phones (1080 x 900), as the shop's slider takes both
      for (const [k, phone] of keys.flatMap((x): [PresetKey, boolean][] => (hasPhone(x) ? [[x, false], [x, true]] : [[x, false]]))) {
        const { blob, missing } = await pngOf(doc, k, prefix, scale, font ?? "", phone);
        missing.forEach((m) => missed.add(m));
        const z = sizeOf(k, phone) ?? { w: PRESET[k].w, h: PRESET[k].h };
        download(blob, fileName(title, `-${z.w}x${z.h}${scale > 1 ? "@2x" : ""}.png`));
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

/* ── the last step's own view ─────────────────────────────────────────────────────────────────────────────────── */

/** "Get it" in the map's last step: what the place shown gives - the paste block, the PNGs - and every picture at once. */
export function GetItView({ doc, k, prefix, title, png, onBack, onPlace }: {
  doc: BannerDoc; k: PresetKey | null; prefix: string; title: string; png: ReturnType<typeof usePng>; onBack: () => void; onPlace: (k: PresetKey) => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  const made = sizesOf(doc);
  const shown = k ?? made[0];
  const p = PRESET[shown];
  const pictures = made.filter((x) => PRESET[x].h);
  const hubPic = picturesOf(doc).find(isHubPicture);
  const block = () => pasteBlock(doc, shown, prefix, title, { origin: window.location.origin });
  const checks = placeChecks(doc, shown);
  const stop = checks.some((c) => c.level === "stop");
  const row = { ...btn, justifyContent: "flex-start", textAlign: "left" as const, whiteSpace: "normal" as const, lineHeight: 1.3, borderColor: HAIRLINE, color: INK, bgcolor: "#fff", py: 1, px: 1.5, borderRadius: "8px", "&:hover": { borderColor: PINK, bgcolor: "#fff" } };
  const main = { ...mainBtn, borderRadius: "8px", minHeight: 42, whiteSpace: "normal" as const, lineHeight: 1.25 };
  const flash = (t: string) => { setDone(t); setTimeout(() => setDone(null), 1600); };
  return (
    <StepView back="The banner" onBack={onBack} name="Get it">
      {made.length > 1 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>For the place</Typography>
          <SquareChoice<string> value={shown} onChange={(v) => onPlace(v as PresetKey)} options={made.map((x) => ({ key: x, label: PRESET[x].short }))} />
        </Box>
      )}
      <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 650 }}>{p.label}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.25 }}>{p.h ? `${p.w} × ${p.h}` : `up to ${p.w} wide`} · {p.out === "html" ? "a paste block for Magento" : "a picture"}</Typography>
      <Box sx={{ mb: 1.5, p: 1.25, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
        <CheckLines items={checks} ok={`Ready for the ${inLine(p.short)}.`} />
      </Box>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {p.out === "html" && (
          <>
            <Button variant="contained" disableElevation disabled={stop} onClick={async () => { await copyText(block()); flash("copy"); }}
              startIcon={done === "copy" ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 17 }} />} sx={main}>
              {done === "copy" ? "Copied" : "Copy the paste block for Magento"}
            </Button>
            <Button variant="outlined" disabled={stop} onClick={() => download(htmlFile(block(), title), fileName(title, `-${shown}.html`))} sx={row}>The paste block as a page (HTML)</Button>
          </>
        )}
        {p.h && (
          <>
            <Button variant={p.out === "html" ? "outlined" : "contained"} disableElevation disabled={stop || !!png.busy} onClick={() => void png.run([shown], 2, `${shown}2`)}
              startIcon={png.busy === `${shown}2` ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 17 }} />}
              sx={p.out === "html" ? row : main}>PNG, sharp on fine screens ({p.w * 2} × {p.h * 2}){PHONE[shown] ? ` + phones (${PHONE[shown]!.w * 2} × ${PHONE[shown]!.h * 2})` : ""}</Button>
            <Button variant="outlined" disabled={stop || !!png.busy} onClick={() => void png.run([shown], 1, `${shown}1`)}
              startIcon={png.busy === `${shown}1` ? <CircularProgress size={14} /> : undefined} sx={row}>PNG, {p.w} × {p.h}{PHONE[shown] ? ` + phones ${PHONE[shown]!.w} × ${PHONE[shown]!.h}` : ""}</Button>
          </>
        )}
        {pictures.length > 1 && (
          <Button variant="outlined" disabled={!!png.busy} onClick={() => void png.run(pictures, 1, "all")} startIcon={png.busy === "all" ? <CircularProgress size={14} /> : undefined} sx={row}>
            Every picture of the banner · {pictures.length} PNG
          </Button>
        )}
        {hubPic && p.out === "html" && <Button variant="outlined" component="a" href={hubPic} download sx={row}>The picture, for the shop&apos;s media</Button>}
      </Box>
      {stop && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>Fix what is in red first - it cannot go out like this.</Typography>}
      {png.note && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b" }}>{png.note}</Typography>}
      <Typography sx={{ mt: 1.5, fontSize: "0.74rem", color: MUTED, lineHeight: 1.5 }}>
        {p.out === "html" ? "Magento's Page Builder: one row without padding, one HTML Code element, the whole block. Nothing goes to Magento from here - paste it in, on ACC first." : "Made in your browser, from what you see."}
      </Typography>
    </StepView>
  );
}

/* ── the AI on the banner ─────────────────────────────────────────────────────────────────────────────────────── */

export type BannerBusy = { part: PickPart | "all"; label: string; since: number };

/** The banner's AI: every word, or one part's; other headlines to pick from; each change listed with an Undo. */
export function useBannerAi(api: StudioApi, doc: BannerDoc, set: (fn: (d: BannerDoc) => BannerDoc) => void) {
  const [busy, setBusy] = useState<BannerBusy | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  // a version looked at (read-only) leaves this browser's list of changes alone
  const changes = useChanges<BannerDoc>(api.looking ? undefined : `banner-${api.data.piece.id}`, api.doc ? doc : undefined);
  const copy = async (part: PickPart | null, label: string, askText?: string): Promise<string | null> => {
    const before = doc;
    setBusy({ part: part ?? "all", label, since: Date.now() });
    try {
      const r = await api.ai<CopyAnswer>("copy", askText ? { ask: askText } : {});
      if (!r.ok) return r.error;
      const next = applyCopy(before, r.result, part);
      if (JSON.stringify(next.content) === JSON.stringify(before.content) && JSON.stringify(next.own) === JSON.stringify(before.own)) return "The words came back as they were.";
      set((d) => applyCopy(d, r.result, part));
      changes.record(label, before);
      return null;
    } finally { setBusy(null); }
  };
  /** Shorter words of its own for a place where the banner's do not fit - the banner's own words stay as they are. */
  const fitPlace = async (k: PresetKey): Promise<string | null> => {
    const before = doc;
    setBusy({ part: "all", label: `Shorter words for the ${inLine(PRESET[k].short)}`, since: Date.now() });
    try {
      const r = await api.ai<CopyAnswer>("copy", { ask: `Give the ${PRESET[k].label} ("${k}") its own shorter words where the banner's words do not fit its room. Keep the banner's own words exactly as they are.` });
      if (!r.ok) return r.error;
      if (!r.result.own[k]) return "No shorter words came back for this place - try again, or shorten them yourself.";
      set((d) => applyPlace(d, r.result, k));
      changes.record(`${PRESET[k].label}: shorter words of its own`, before);
      return null;
    } finally { setBusy(null); }
  };
  const headlines = async (): Promise<string | null> => {
    setBusy({ part: "headline", label: "Finding headlines", since: Date.now() });
    try {
      const r = await api.ai<{ headlines: Variant[] }>("variants");
      if (!r.ok) return r.error;
      setVariants(r.result.headlines);
      return r.result.headlines.length ? null : "No headline came back - try again.";
    } finally { setBusy(null); }
  };
  const pickVariant = (v: Variant) => {
    changes.record(`Headline: "${v.headline}"`, doc);
    setVariants([]);
    set((d) => ({ ...d, content: { ...d.content, headline: v.headline } }));
  };
  const undo = (e: Change<BannerDoc>) => { const b = changes.undo(e); set(() => b); };
  /** A change made by hand (words typed on the banner), listed with its Undo like the AI's. */
  const note = (label: string, before: BannerDoc) => changes.record(label, before, undefined, "you");
  return { busy, copy, fitPlace, headlines, variants, pickVariant, changes: changes.list, undo, note };
}
export type BannerAi = ReturnType<typeof useBannerAi>;

const ASK_FOR: Partial<Record<PickPart, { shorter: string; another: string }>> = {
  eyebrow: { shorter: "Make only the small line over the headline (the eyebrow) shorter. Keep everything else word for word.", another: "Write another small line over the headline (the eyebrow). Keep everything else word for word." },
  headline: { shorter: "Make only the headline shorter. Keep everything else word for word.", another: "Write another headline from another angle. Keep everything else word for word." },
  line: { shorter: "Make only the line under the headline shorter. Keep everything else word for word.", another: "Write another line under the headline. Keep everything else word for word." },
  button: { shorter: "Make only the button's words shorter. Keep everything else word for word.", another: "Write other words for the button - one to three, an action. Keep everything else word for word." },
};

/** The AI beside the banner: on the part selected, or on every word; other headlines to pick from; the changes made. */
export function BannerAssistant({ api, doc, ai, pick, setPick, inputRef }: {
  api: StudioApi; doc: BannerDoc; ai: BannerAi; pick: PickPart | null; setPick: (p: PickPart | null) => void; inputRef: React.Ref<HTMLTextAreaElement>;
}) {
  const enabled = api.data.ai && api.data.access.canEdit;
  const n = sizesOf(doc).length;
  const written = !!(doc.content.headline.trim() || doc.content.line.trim() || doc.content.eyebrow.trim());
  const asks = pick ? ASK_FOR[pick] : undefined;
  const name = pick ? PART_NAME[pick] : "";
  const forPart = (text: string) => (pick && asks ? `About the ${name.toLowerCase()} only: ${text} Keep everything else word for word.` : text);
  return (
    <AssistantPanel enabled={enabled} inputRef={inputRef}
      placeholder={asks ? `What should change in the ${name.toLowerCase()}? E.g. for buyers in food plants` : "What should change? E.g. shorter, for buyers in food plants"}
      onAsk={(text) => ai.copy(asks ? pick : null, asks ? `${name}: "${text.slice(0, 50)}"` : `Every word: "${text.slice(0, 50)}"`, forPart(text))}
      top={<WorkingOn selection={pick ? name : null} whole="The whole banner" hint="click a part of it to work on it alone" onClear={() => setPick(null)} />}
      quick={asks ? [
        { label: "Shorter", run: () => ai.copy(pick, `${name}: shorter`, asks.shorter) },
        pick === "headline" ? { label: "Three other headlines", run: ai.headlines } : { label: "Another one", run: () => ai.copy(pick, `${name}: another one`, asks.another) },
      ] : pick ? [] : [
        // the same words as the start card and the map's header (the flow standard)
        { label: `${written ? "Write it all again" : "Write the whole banner with AI"}${n > 1 ? `, for the ${n} places` : ""}`, run: () => ai.copy(null, "Every word written") },
        { label: "Three other headlines", run: ai.headlines },
      ]}>
      {pick && !asks && <Typography sx={{ mt: 1.5, fontSize: "0.8rem", color: MUTED }}>The AI writes words; change the {name.toLowerCase()} on the left, or let it go to ask about every word.</Typography>}
      {ai.variants.length > 0 && (
        <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>Pick one</Typography>
          {ai.variants.map((v, i) => (
            <Box key={i} component="button" type="button" disabled={!enabled} onClick={() => ai.pickVariant(v)} sx={{
              all: "unset", cursor: "pointer", p: 1.25, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff",
              "&:hover": { borderColor: PINK }, "&:focus-visible": { outline: `2px solid ${PINK}` },
            }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK, lineHeight: 1.3 }}>{v.headline}</Typography>
              {v.angle && <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.25 }}>{v.angle}</Typography>}
            </Box>
          ))}
        </Box>
      )}
      <ChangesList list={ai.changes} what="banner" onUndo={ai.undo} />
    </AssistantPanel>
  );
}
