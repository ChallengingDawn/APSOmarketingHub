"use client";
// THE BLOG AND NEWSLETTER STUDIOS' OWN SMALL PIECES (Content v2, 08.11.2026). SARCLA: "tags should be squared", the build
// pane's tabs "wrap onto two lines", "pictures are not being generated".
//   StepTabs     one squared row of equal steps that never wraps (a count in small type beside a label)
//   PictureSlot  where a picture goes: the picture itself with Change / Remove, or - when there is none - the hub's picture
//                panel open in place (make one from words, prefilled; upload; the galleries)
//   Frame        the real page in a frame at its device's width, zoomed to fit, as tall as its content
//   Block, Hint, PasteCard, useCopy, mono   the quiet structure of a build pane

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { btn, field } from "../../parts";
import { PicturePanel, type Picture, type PictureAspect } from "../../pictures";

export const BLUE = "#2459d1";
export const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.78rem", lineHeight: 1.5 };

/** A quiet line under a field or a section. */
export const Hint = ({ children, mt = 0.5 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt, lineHeight: 1.45 }}>{children}</Typography>
);

/** A block of the build pane: its title, an optional control on the right, then its content. */
export function Block({ title, right, children, first }: { title: string; right?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <Box sx={{ pt: first ? 0 : 2.25, mt: first ? 0 : 2.25, borderTop: first ? "none" : `1px solid ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, minHeight: 28 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, flex: 1, letterSpacing: "-0.01em" }}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** The build pane's steps: one squared row, equal widths, never on two lines. */
export function StepTabs<K extends string>({ value, onChange, options }: { value: K; onChange: (k: K) => void; options: { key: K; label: string; count?: number }[] }) {
  return (
    <Box role="tablist" sx={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Box key={o.key} component="button" type="button" role="tab" aria-selected={on} onClick={() => onChange(o.key)} title={o.label}
            sx={{
              all: "unset", cursor: "pointer", boxSizing: "border-box", height: 36, px: 0.75, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
              fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", minWidth: 0,
              borderLeft: i ? `1px solid ${HAIRLINE}` : "none", bgcolor: on ? BLUE : "transparent", color: on ? "#fff" : INK, transition: "background-color .12s, color .12s",
              "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)", color: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
            }}>
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</Box>
            {o.count ? <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, opacity: on ? 0.85 : 0.55, fontVariantNumeric: "tabular-nums" }}>{o.count}</Box> : null}
          </Box>
        );
      })}
    </Box>
  );
}

/** Small squared buttons in a row (a section's AI actions, a block's tools). */
export function ToolRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{children}</Box>;
}
export const toolBtn = {
  ...btn, minWidth: 0, px: 1, py: 0.25, height: 28, fontSize: "0.76rem", borderRadius: "4px", color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff",
  "&:hover": { borderColor: BLUE, color: BLUE, bgcolor: "#fff" }, "& .MuiButton-startIcon": { mr: 0.5 },
};

const RATIO: Record<PictureAspect, string> = { "1:1": "1 / 1", "4:5": "4 / 5", "16:9": "16 / 9", "3:2": "3 / 2" };

/**
 * Where a picture goes. With one: the picture, what it shows, and Change / Remove. Without: the picture panel open in
 * place - "Make one" prefilled with `suggestion` (the AI's idea, or the text around it), so one click makes it.
 */
export function PictureSlot({ url, alt, onPick, onAlt, onRemove, aspect = "16:9", suggestion, projectId, pieceId, me, disabled, altLabel = "What it shows", startOpen = true }: {
  url: string; alt: string; onPick: (p: Picture) => void; onAlt?: (alt: string) => void; onRemove: () => void;
  aspect?: PictureAspect; suggestion?: string; projectId?: number | null; pieceId?: number | null; me?: string; disabled?: boolean; altLabel?: string;
  /** Without a picture: the panel shows at once (true), or behind an "Add a picture" button. */
  startOpen?: boolean;
}) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(startOpen);
  const panel = (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.25, bgcolor: "#fbfcfd" }}>
      <PicturePanel key={suggestion ?? ""} onPick={(p) => { onPick(p); setChanging(false); }} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect}
        suggestion={suggestion} columns={4} />
    </Box>
  );
  if (!url) {
    if (disabled) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No picture.</Typography>;
    if (!adding) return <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 17 }} />} onClick={() => setAdding(true)} sx={toolBtn}>Add a picture</Button>;
    return panel;
  }
  return (
    <Box>
      <Box sx={{ position: "relative", aspectRatio: RATIO[aspect], borderRadius: "6px", overflow: "hidden", bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, "&:hover .tools": { opacity: 1 } }}>
        <Box component="img" src={url} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {!disabled && (
          <Box className="tools" sx={{ position: "absolute", right: 8, bottom: 8, display: "flex", gap: 0.5, opacity: { xs: 1, md: 0.92 }, transition: "opacity .15s" }}>
            <Button size="small" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />} onClick={() => setChanging((v) => !v)} sx={{ ...toolBtn, bgcolor: "rgba(255,255,255,.95)" }}>{changing ? "Keep it" : "Change"}</Button>
            <Button size="small" aria-label="Remove the picture" onClick={() => { setChanging(false); onRemove(); }} sx={{ ...toolBtn, bgcolor: "rgba(255,255,255,.95)", px: 0.75 }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></Button>
          </Box>
        )}
      </Box>
      {onAlt && (
        <TextField fullWidth size="small" label={altLabel} value={alt} disabled={disabled} onChange={(e) => onAlt(e.target.value)} sx={{ ...field, mt: 1 }} />
      )}
      {changing && <Box sx={{ mt: 1 }}>{panel}</Box>}
    </Box>
  );
}

/** Copies a text; says "Copied" for a moment. */
export function useCopy() {
  const [done, setDone] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea");
      t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setDone(key);
    setTimeout(() => setDone((k) => (k === key ? null : k)), 1800);
  };
  return { done, copy };
}

/** Code to paste, with how to paste it and a copy button. */
export function PasteCard({ label, steps, code, copied, onCopy }: { label: string; steps: string[]; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.5, mb: 1.5, bgcolor: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, flex: 1 }}>{label}</Typography>
        <Button size="small" onClick={onCopy} startIcon={copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          sx={{ ...toolBtn, color: copied ? "#1b7a55" : INK }}>{copied ? "Copied" : "Copy"}</Button>
      </Box>
      <Box component="ol" sx={{ m: 0, mb: 1, pl: 2.25, color: MUTED, fontSize: "0.8rem", lineHeight: 1.5 }}>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </Box>
      <Box component="pre" sx={{ ...mono, m: 0, p: 1.25, maxHeight: 180, overflow: "auto", bgcolor: "#f6f8fb", borderRadius: "6px", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {code.length > 60_000 ? `${code.slice(0, 60_000)}\n… (the copy has it whole)` : code}
      </Box>
    </Box>
  );
}

export type Device = "desktop" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };

/**
 * One page in a frame: the HTML at the device's real width, zoomed down to the space it has, as tall as its content (the
 * pane scrolls, not the frame). No script runs in it; same-origin only so its height can be read - and so `onDoc` can
 * listen to it (a click on a block selects it in the build pane).
 */
export function Frame({ html, device, title, width, onDoc }: { html: string; device: Device; title: string; width?: number; onDoc?: (d: Document) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [avail, setAvail] = useState(800);
  const [height, setHeight] = useState(900);
  const w = device === "mobile" ? DEVICE_WIDTH.mobile : width ?? DEVICE_WIDTH.desktop;
  const docCb = useRef(onDoc);
  docCb.current = onDoc;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const d = frame.current?.contentDocument;
      if (!d?.documentElement) return;
      setHeight(Math.min(30_000, Math.max(400, d.documentElement.scrollHeight)));
      if (!ro && d.body) { ro = new ResizeObserver(() => setHeight(Math.min(30_000, Math.max(400, d.documentElement.scrollHeight)))); ro.observe(d.body); }
      docCb.current?.(d);
    };
    const f = frame.current;
    f?.addEventListener("load", measure);
    const t = setTimeout(measure, 300);
    return () => { f?.removeEventListener("load", measure); clearTimeout(t); ro?.disconnect(); };
  }, [html, device]);

  const zoom = Math.min(1, (avail - 8) / w);
  const mobile = device === "mobile";
  return (
    <Box ref={box} sx={{ display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
      <Box sx={{
        width: w * zoom + (mobile ? 16 : 2), height: height * zoom + (mobile ? 16 : 2), flexShrink: 0, borderRadius: mobile ? "26px" : "8px", overflow: "hidden",
        boxShadow: "0 18px 50px rgba(31,45,78,.18)", border: mobile ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: "#fff", boxSizing: "border-box", transition: "width .25s ease",
      }}>
        <iframe ref={frame} title={title} srcDoc={html} sandbox="allow-same-origin"
          style={{ width: w, height, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background: "#fff" }} />
      </Box>
    </Box>
  );
}

/** The document a moment after the last keystroke - the frame is not rebuilt on every letter. */
export function useSettled<T>(v: T, ms = 350): T {
  const [x, setX] = useState(v);
  useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return x;
}
