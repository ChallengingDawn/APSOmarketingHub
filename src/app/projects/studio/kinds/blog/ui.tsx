"use client";
// THE BLOG AND NEWSLETTER STUDIOS' OWN SMALL PIECES (Content v2, 08.11.2026). SARCLA: "tags should be squared", the build
// pane's tabs "wrap onto two lines", "pictures are not being generated".
//   PictureSlot  where a picture goes: the picture itself with Change / Remove, or - when there is none - the hub's picture
//                panel open in place (make one from words, prefilled; upload; the galleries)
//   Working      the assistant at work: a moving band over the thing being made (Content v3)
//   Block, Hint, PasteCard, useCopy, mono   the quiet structure of a build pane

import { useEffect, useState } from "react";
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

/** Small squared buttons (a block's tools, a part's). */
export const toolBtn = {
  ...btn, minWidth: 0, px: 1, py: 0.25, height: 28, fontSize: "0.76rem", borderRadius: "4px", color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff",
  "&:hover": { borderColor: BLUE, color: BLUE, bgcolor: "#fff" }, "& .MuiButton-startIcon": { mr: 0.5 },
};

const RATIO: Record<PictureAspect, string> = { "1:1": "1 / 1", "4:5": "4 / 5", "16:9": "16 / 9", "3:2": "3 / 2" };

/**
 * Where a picture goes. With one: the picture, what it shows, and Change / Remove. Without: the picture panel open in
 * place - "Make one" prefilled with `suggestion` (the AI's idea, or the text around it), so one click makes it.
 */
export function PictureSlot({ url, alt, onPick, onAlt, onRemove, aspect = "16:9", suggestion, projectId, pieceId, me, disabled, altLabel = "What it shows", startOpen = true, tabs, fit = "cover", addLabel = "Add a picture" }: {
  url: string; alt: string; onPick: (p: Picture) => void; onAlt?: (alt: string) => void; onRemove: () => void;
  aspect?: PictureAspect; suggestion?: string; projectId?: number | null; pieceId?: number | null; me?: string; disabled?: boolean; altLabel?: string;
  /** Without a picture: the panel shows at once (true), or behind an "Add a picture" button. */
  startOpen?: boolean;
  tabs?: ("make" | "upload" | "mine" | "project" | "logos")[];
  /** "contain" for a logo. */
  fit?: "cover" | "contain";
  addLabel?: string;
}) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(startOpen);
  const panel = (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.25, bgcolor: "#fbfcfd" }}>
      <PicturePanel key={suggestion ?? ""} onPick={(p) => { onPick(p); setChanging(false); setAdding(false); }} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect}
        suggestion={suggestion} columns={4} {...(tabs ? { tabs, start: tabs[0] } : {})} />
    </Box>
  );
  if (!url) {
    if (disabled) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No picture.</Typography>;
    if (!adding) return <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 17 }} />} onClick={() => setAdding(true)} sx={toolBtn}>{addLabel}</Button>;
    return panel;
  }
  return (
    <Box>
      <Box sx={{ position: "relative", aspectRatio: RATIO[aspect], borderRadius: "6px", overflow: "hidden", bgcolor: fit === "contain" ? "#fff" : "#eef1f6", border: `1px solid ${HAIRLINE}`, "&:hover .tools": { opacity: 1 } }}>
        <Box component="img" src={url} alt={alt} sx={{ width: "100%", height: "100%", objectFit: fit, display: "block", p: fit === "contain" ? 1.5 : 0, boxSizing: "border-box" }} />
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

/** The document a moment after the last keystroke - the frame is not rebuilt on every letter. */
export function useSettled<T>(v: T, ms = 350): T {
  const [x, setX] = useState(v);
  useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return x;
}

/**
 * The assistant at work, over the thing being made (SARCLA 08.11.2026: "an AI animation as soon as it starts working"):
 * a band that moves, what it is doing, and the seconds since it started - a whole post takes a minute or two.
 */
export function Working({ label, since }: { label: string; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return (
    <Box role="status" aria-live="polite" sx={{
      position: "sticky", top: 0, zIndex: 3, mx: "auto", mb: 1.5, maxWidth: 560, display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1,
      borderRadius: "10px", bgcolor: "rgba(255,255,255,.96)", boxShadow: "0 8px 26px rgba(31,45,78,.16)", overflow: "hidden",
      "&::after": {
        content: '""', position: "absolute", left: 0, right: 0, bottom: 0, height: 3,
        background: "linear-gradient(90deg, transparent, #c22c6e, #2459d1, transparent)", backgroundSize: "50% 100%", backgroundRepeat: "no-repeat",
        animation: "xwork 1.6s ease-in-out infinite",
      },
      "@keyframes xwork": { "0%": { backgroundPosition: "-60% 0" }, "100%": { backgroundPosition: "160% 0" } },
      "@keyframes xspark": { "0%, 100%": { transform: "scale(1) rotate(0deg)", opacity: 0.7 }, "50%": { transform: "scale(1.25) rotate(20deg)", opacity: 1 } },
    }}>
      <Box component="span" sx={{ display: "inline-flex", color: "#c22c6e", animation: "xspark 1.2s ease-in-out infinite" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z" /></svg>
      </Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 600, color: INK }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s}s</Typography>
    </Box>
  );
}
