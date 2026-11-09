"use client";
// THE BLOG AND NEWSLETTER STUDIOS' OWN SMALL PIECES (Content v2, 08.11.2026). SARCLA: "tags should be squared", the build
// pane's tabs "wrap onto two lines", "pictures are not being generated".
//   PictureSlot  where a picture goes: the picture itself with Change / Remove, or - when there is none - the hub's picture
//                panel open in place (make one from words, prefilled; upload; the galleries)
//   Working      the assistant at work: a moving band over the thing being made (Content v3)
//   Block, Hint, PasteCard, useCopy, mono   the quiet structure of a build pane

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CollectionsOutlinedIcon from "@mui/icons-material/CollectionsOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { PINK, btn, field } from "../../parts";
import { PicturePanel, makePicture, uploadPicture, type Picture, type PictureAspect } from "../../pictures";

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

/** Seconds since, ticking. */
function useSince(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (since === null) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [since]);
  return since === null ? 0 : Math.max(0, Math.round((now - since) / 1000));
}

/**
 * Where a picture goes - ONE slot, the same in every studio (the flow standard, 09.11.2026). Empty: a dashed frame with
 * the idea for it in small grey words, "Make it" (pink) and "Upload". Being made: the frame shimmers with a moving bar,
 * "Making the picture..." and the seconds. With one: the picture, and Make another / Upload / Gallery / Remove. "Gallery":
 * the hub's pictures (made, uploaded, the project's, the logos) and the words for a new one.
 */
export function PictureSlot({ url, alt, onPick, onAlt, onRemove, aspect = "16:9", suggestion, projectId, pieceId, me, disabled, altLabel = "What it shows", startOpen = true, tabs, fit = "cover", addLabel = "Add a picture" }: {
  url: string; alt: string; onPick: (p: Picture) => void; onAlt?: (alt: string) => void; onRemove: () => void;
  aspect?: PictureAspect; suggestion?: string; projectId?: number | null; pieceId?: number | null; me?: string; disabled?: boolean; altLabel?: string;
  /** Without a picture: the slot shows at once (true), or behind an "Add a picture" button. */
  startOpen?: boolean;
  tabs?: ("make" | "upload" | "mine" | "project" | "logos")[];
  /** "contain" for a logo. */
  fit?: "cover" | "contain";
  addLabel?: string;
}) {
  const [adding, setAdding] = useState(startOpen);
  const [gallery, setGallery] = useState(false);
  const [making, setMaking] = useState<number | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const secs = useSince(making);
  const idea = (suggestion ?? "").trim();
  const canMake = !disabled && !!idea && (!tabs || tabs.includes("make"));
  const make = async () => {
    if (!canMake || making) return;
    setErr(null); setGallery(false); setMaking(Date.now());
    const r = await makePicture(idea, aspect, { projectId, pieceId });
    setMaking(null);
    if (!r.ok) { setErr(r.error); return; }
    onPick(r.picture);
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setUp(0);
    const r = await uploadPicture(f, { projectId, pieceId }, setUp);
    setUp(null);
    if (!r.ok) { setErr(r.error); return; }
    onPick(r.picture);
  };
  if (!url && disabled) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>No picture.</Typography>;
  if (!url && !adding && !making) return <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 17 }} />} onClick={() => setAdding(true)} sx={toolBtn}>{addLabel}</Button>;
  const act = { ...toolBtn, bgcolor: "rgba(255,255,255,.96)", height: 28 };
  const actions = (
    <>
      {canMake && (
        <Button size="small" onClick={() => void make()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
          sx={url ? { ...act, color: PINK } : { ...act, bgcolor: PINK, color: "#fff", borderColor: PINK, "&:hover": { bgcolor: "#a3245c", borderColor: "#a3245c", color: "#fff" } }}>
          {url ? "Make another" : err ? "Try again" : "Make it"}
        </Button>
      )}
      <Button size="small" disabled={up !== null} onClick={() => file.current?.click()} startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 15 }} />} sx={act}>Upload</Button>
      <Button size="small" onClick={() => setGallery((v) => !v)} startIcon={<CollectionsOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...act, ...(gallery ? { borderColor: BLUE, color: BLUE } : {}) }}>Gallery</Button>
      {url && <Button size="small" aria-label="Remove the picture" onClick={() => { setGallery(false); onRemove(); }} sx={{ ...act, px: 0.75 }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></Button>}
    </>
  );
  return (
    <Box>
      <Box sx={{
        position: "relative", aspectRatio: RATIO[aspect], borderRadius: "6px", overflow: "hidden", boxSizing: "border-box",
        bgcolor: url ? (fit === "contain" ? "#fff" : "#eef1f6") : "#f7f9fa", border: url ? `1px solid ${HAIRLINE}` : "2px dashed #b9c3c9",
        ...(making ? { backgroundImage: "linear-gradient(110deg, #f1f4f6 30%, #fbe9f1 45%, #f1f4f6 60%)", backgroundSize: "260% 100%", animation: "xslot 1.4s linear infinite", "@keyframes xslot": { "0%": { backgroundPosition: "130% 0" }, "100%": { backgroundPosition: "-130% 0" } } } : {}),
        "&:hover .tools": { opacity: 1 },
      }}>
        {url && <Box component="img" src={url} alt={alt} sx={{ width: "100%", height: "100%", objectFit: fit, display: "block", p: fit === "contain" ? 1.5 : 0, boxSizing: "border-box", opacity: making ? 0.45 : 1 }} />}
        {!url && !making && (
          <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, p: 1.5, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", maxWidth: 320 }}>
              {idea ? idea : "No idea for it yet - upload one, or pick one in the gallery."}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>{actions}</Box>
          </Box>
        )}
        {making && (
          <Box role="status" sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
            <AutoAwesomeOutlinedIcon sx={{ color: PINK, fontSize: 22 }} />
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 650, color: INK }}>Making the picture… <Box component="span" sx={{ color: MUTED, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>0:{String(secs).padStart(2, "0")}</Box></Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Up to 40 seconds</Typography>
            <LinearProgress sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
          </Box>
        )}
      </Box>
      {/* with a picture: its actions under it, the picture itself left clear */}
      {url && !making && <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.75 }}>{actions}</Box>}
      {up !== null && <LinearProgress variant="determinate" value={up * 100} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />}
      {err && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f", mt: 0.5 }}>{err}</Typography>}
      <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <Collapse in={gallery} timeout={200} unmountOnExit>
        <Box sx={{ mt: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.25, bgcolor: "#fbfcfd" }}>
          <PicturePanel key={idea} onPick={(p) => { onPick(p); setGallery(false); }} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect}
            suggestion={idea || undefined} columns={3} tabs={tabs ? tabs.filter((t) => t !== "upload") : ["project", "mine", "make"]} start={tabs ? tabs.filter((t) => t !== "upload")[0] : "project"} />
        </Box>
      </Collapse>
      {url && onAlt && (
        <TextField fullWidth size="small" label={altLabel} value={alt} disabled={disabled} onChange={(e) => onAlt(e.target.value)} sx={{ ...field, mt: 1 }} />
      )}
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
