"use client";
// WHAT EACH PLACE GIVES (08.11.2026; SARCLA about the old output panel: "this is also wrong, the banner can be in
// multiple places"). Per place: its own shorter words, what to look at before it goes out, and what it gives - the paste
// block for Magento (copy it, or as a page), the picture at its real size and sharp (2x). And the assistant that writes
// the words for every place. Nothing is sent to Magento or anywhere else from here.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { isHubPicture } from "@/lib/content/studio/kinds/banner/brand";
import { placeChecks, picturesOf, type Check } from "@/lib/content/studio/kinds/banner/checks";
import { PRESET, sizesOf, wordsFor, type BannerDoc, type OwnWords, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { htmlFile, pasteBlock, stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import type { CopyAnswer, Variant } from "@/lib/content/studio/kinds/banner/ai";
import { AssistantPanel, Field, PINK, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { download, fileName, htmlToPng } from "./png";
import { CopyButton, Hint } from "./ui";

const label = { fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: MUTED, mb: 1 };

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

const OWN_EMPTY: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };

/** The words this place shows: empty fields take the banner's; shorter ones where the room is small. */
export function PlaceWords({ doc, set, k, canEdit }: { doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; k: PresetKey; canEdit: boolean }) {
  const p = PRESET[k];
  const own = doc.own[k] ?? OWN_EMPTY;
  const base = wordsFor({ ...doc, own: {} }, k);
  const put = (f: keyof OwnWords, v: string) => set((d) => ({ ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? OWN_EMPTY), [f]: v } } }));
  const any = !!(own.eyebrow || own.headline || own.line || own.button);
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ ...label, flex: 1 }}>Words here</Typography>
        {any && canEdit && <Button size="small" onClick={() => set((d) => { const o = { ...d.own }; delete o[k]; return { ...d, own: o }; })} sx={{ ...btn, color: MUTED, fontSize: "0.74rem", py: 0, minWidth: 0 }}>Use the banner&apos;s</Button>}
      </Box>
      {p.limits.eyebrow > 0 && <Field label="Eyebrow" value={own.eyebrow} onChange={(v) => put("eyebrow", v)} max={p.limits.eyebrow} placeholder={base.eyebrow} disabled={!canEdit} />}
      <Field label="Headline" value={own.headline} onChange={(v) => put("headline", v)} max={p.limits.headline} placeholder={base.headline} disabled={!canEdit} />
      {p.limits.line > 0 && <Field label="Line" value={own.line} onChange={(v) => put("line", v)} max={p.limits.line} multiline rows={2} placeholder={base.line} disabled={!canEdit} />}
      {p.limits.button > 0 && <Field label="Button" value={own.button} onChange={(v) => put("button", v)} max={p.limits.button} placeholder={base.button} disabled={!canEdit} />}
      <Hint>Empty = the banner&apos;s words (shown in grey). {p.limits.word ? "" : "No changing words here: the headline reads with the first one."}</Hint>
    </Box>
  );
}

/** What this place gives: the paste block or the picture, at its real size. */
export function PlaceGet({ doc, k, prefix, title, font, png }: { doc: BannerDoc; k: PresetKey; prefix: string; title: string; font: string | null; png: ReturnType<typeof usePng> }) {
  const p = PRESET[k];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const block = useMemo(() => (p.out === "html" ? pasteBlock(doc, k, prefix, title, { origin }) : ""), [doc, k, prefix, title, p.out, origin]);
  const hubPic = picturesOf(doc).find(isHubPicture);
  return (
    <Box>
      <Typography sx={label}>Get it</Typography>
      {p.out === "html" ? (
        <>
          <Hint sx={{ mb: 1 }}>For Magento&apos;s Page Builder: one row without padding, one HTML Code element, the whole block. {Math.max(1, Math.round(new Blob([block]).size / 1024))} KB.</Hint>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <CopyButton main text={block} label="Copy the paste block" />
            <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 17 }} />} onClick={() => download(htmlFile(block, title), fileName(title, `-${k}.html`))}
              sx={{ ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>HTML</Button>
          </Box>
        </>
      ) : (
        <Hint sx={{ mb: 1 }}>A picture, {p.w} × {p.h}. The 2× file is sharp on high-resolution screens.</Hint>
      )}
      {p.h && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
          {[1, 2].map((sc) => {
            const main = p.out === "image" && sc === 1;
            return (
              <Button key={sc} size="small" variant={main ? "contained" : "outlined"} disableElevation disabled={!!png.busy}
                startIcon={png.busy === `${k}${sc}` ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 17 }} />}
                onClick={() => png.run([k], sc, `${k}${sc}`)}
                sx={main ? { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } } : { ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>
                PNG{sc > 1 ? " 2×" : ""}
              </Button>
            );
          })}
        </Box>
      )}
      {hubPic && p.out === "html" && (
        <Button size="small" component="a" href={hubPic} download startIcon={<DownloadIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, color: MUTED, mt: 1 }}>The picture, for the shop&apos;s media</Button>
      )}
      {png.note && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b" }}>{png.note}</Typography>}
      <Hint sx={{ mt: 1.25 }}>{p.out === "html" ? "Nothing goes to Magento from here - paste it in, on ACC first." : "Made in your browser, from what you see."}</Hint>
    </Box>
  );
}

/** The sheet under a place's preview: its words, its checks, what it gives. */
export function PlaceSheet(props: { doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void; k: PresetKey; canEdit: boolean; prefix: string; title: string; font: string | null; png: ReturnType<typeof usePng> }) {
  const checks = useMemo(() => placeChecks(props.doc, props.k), [props.doc, props.k]);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 1.5, mt: 3 }}>
      <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${HAIRLINE}`, p: 2 }}><PlaceWords {...props} /></Box>
      <Box sx={{ display: "grid", gap: 1.5, alignContent: "start" }}>
        <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${HAIRLINE}`, p: 2 }}>
          <Typography sx={label}>Before it goes out</Typography>
          <CheckLines items={checks} ok="It fits, and the brand's rules are kept." />
        </Box>
        <Box sx={{ bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${HAIRLINE}`, p: 2 }}><PlaceGet {...props} /></Box>
      </Box>
    </Box>
  );
}

/** The AI beside the banner: its words for every place, other headlines to pick from, a change in your words. */
export function BannerAssistant({ api, doc, set }: { api: StudioApi; doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [undo, setUndo] = useState<BannerDoc | null>(null);
  const enabled = api.data.ai && api.data.access.canEdit;
  const n = sizesOf(doc).length;
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
  return (
    <AssistantPanel enabled={enabled} placeholder="Shorter, for buyers in Germany…" onAsk={copy} quick={[
      { label: n > 1 ? `Write the words for the ${n} places` : "Write the words", run: () => copy() },
      {
        label: "Three other headlines", run: async () => {
          const r = await api.ai<{ headlines: Variant[] }>("variants");
          if (!r.ok) return r.error;
          setVariants(r.result.headlines);
          return r.result.headlines.length ? null : "No headline came back - try again.";
        },
      },
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
