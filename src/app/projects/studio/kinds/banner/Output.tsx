"use client";
// WHAT THE BANNER GIVES (08.11.2026): the paste block for Magento (copy it, or download it as a page), the PNGs at their
// real size and sharp (2x), what to check before it goes out - and the assistant that writes its words. Nothing is sent
// to Magento or anywhere else from here.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import UndoIcon from "@mui/icons-material/Undo";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { brandFlags, mediaUrl } from "@/lib/content/studio/kinds/banner/brand";
import { PRESET, overLimits, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { htmlFile, pasteBlock, stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import type { CopyAnswer, Variant } from "@/lib/content/studio/kinds/banner/ai";
import { AssistantPanel, PINK, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { download, fileName, htmlToPng } from "./png";
import { Checks, CopyButton, Hint } from "./ui";

const FIELD_NAME = { eyebrow: "eyebrow", headline: "headline", word: "a changing word", line: "line", button: "button" } as const;

/** Everything worth a look before the banner goes out, in plain sentences. */
export function bannerChecks(d: BannerDoc): string[] {
  const out: string[] = [];
  for (const k of sizesOf(d)) for (const o of overLimits(d, k)) out.push(`${PRESET[k].label}: the ${FIELD_NAME[o.field]} is ${o.by} character${o.by === 1 ? "" : "s"} too long.`);
  const c = d.content;
  const all = [c.eyebrow, c.headline, ...c.rotatingWords, c.line, c.button.label, ...Object.values(d.own).flatMap((o) => (o ? [o.eyebrow, o.headline, o.line, o.button] : []))].join("\n");
  out.push(...brandFlags(all));
  if (!c.headline.trim()) out.push("No headline yet.");
  if (c.button.label.trim() && !c.button.url.trim()) out.push("The button goes nowhere - say where it leads.");
  if (c.rotatingWords.length === 1) out.push("One changing word does not change - add another, or put it in the headline.");
  const pics = c.photos.length >= 2 ? c.photos.map((p) => p.url) : [c.image.url];
  if (pics.some((u) => u && !mediaUrl(u))) out.push("A picture's address cannot be used - pick a shop photo.");
  return [...new Set(out)];
}

async function pngOf(d: BannerDoc, k: PresetKey, prefix: string, scale: number, font: string) {
  const p = PRESET[k];
  const s = stillMarkup(d, k, prefix);
  return htmlToPng({ html: s.html, css: s.css, width: p.w, height: p.h ?? 400, scale, fontCss: font });
}

export function OutputCard({ doc, active, prefix, title, font }: { doc: BannerDoc; active: PresetKey; prefix: string; title: string; font: string | null }) {
  const p = PRESET[active];
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const block = useMemo(() => (p.out === "html" ? pasteBlock(doc, active, prefix, title) : ""), [doc, active, prefix, title, p.out]);
  const checks = useMemo(() => bannerChecks(doc), [doc]);
  const fixed = sizesOf(doc).filter((k) => PRESET[k].h);
  const png = async (keys: PresetKey[], scale: number, tag: string) => {
    setBusy(tag); setNote(null);
    const missed = new Set<string>();
    try {
      for (const k of keys) {
        const { blob, missing } = await pngOf(doc, k, prefix, scale, font ?? "");
        missing.forEach((m) => missed.add(m));
        download(blob, fileName(title, `-${PRESET[k].w}x${PRESET[k].h}${scale > 1 ? "@2x" : ""}.png`));
      }
      if (missed.size) setNote("A picture did not come from the shop - the PNG was drawn without it.");
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  return (
    <Box sx={{ bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)", borderRadius: "18px", p: 2, overflowY: "auto", minHeight: 0 }}>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1.25 }}>Ready to use</Typography>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 650, color: INK }}>{p.label}</Typography>
      {p.out === "html" ? (
        <>
          <Hint sx={{ mb: 1.25 }}>For Magento&apos;s Page Builder: one row without padding, one HTML Code element, the whole block. {Math.max(1, Math.round(new Blob([block]).size / 1024))} KB.</Hint>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <CopyButton main text={block} label="Copy the paste block" />
            <Button size="small" variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: 17 }} />} onClick={() => download(htmlFile(block, title), fileName(title, `-${active}.html`))}
              sx={{ ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>HTML</Button>
          </Box>
        </>
      ) : (
        <Hint sx={{ mb: 1.25 }}>A picture, {p.w} × {p.h}. The 2× file is sharp on high-resolution screens.</Hint>
      )}
      {p.h && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
          {[1, 2].map((sc) => (
            <Button key={sc} size="small" variant={p.out === "image" && sc === 1 ? "contained" : "outlined"} disableElevation disabled={!!busy || font === null}
              startIcon={busy === `one${sc}` ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 17 }} />}
              onClick={() => png([active], sc, `one${sc}`)}
              sx={p.out === "image" && sc === 1 ? { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } } : { ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>
              PNG{sc > 1 ? " 2×" : ""}
            </Button>
          ))}
        </Box>
      )}
      {fixed.length > 1 && (
        <Button size="small" disabled={!!busy || font === null} onClick={() => png(fixed, 1, "all")} startIcon={busy === "all" ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 17 }} />}
          sx={{ ...btn, mt: 1, color: MUTED }}>Every size as PNG · {fixed.length}</Button>
      )}
      {note && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#7f4f0b" }}>{note}</Typography>}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>Before it goes out</Typography>
        <Checks items={checks} ok="Every size fits, and the brand's rules are kept." />
      </Box>
      <Hint sx={{ mt: 1.5 }}>Nothing goes to Magento from here - paste it in, on ACC first.</Hint>
    </Box>
  );
}

/** The AI beside the banner: its words for every size, other headlines to pick from, a change in your words. */
export function BannerAssistant({ api, doc, set }: { api: StudioApi; doc: BannerDoc; set: (fn: (d: BannerDoc) => BannerDoc) => void }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [undo, setUndo] = useState<BannerDoc | null>(null);
  const enabled = api.data.ai && api.data.access.canEdit;
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
      { label: "Write the words", run: () => copy() },
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
              all: "unset", cursor: "pointer", p: 1.25, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff",
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
