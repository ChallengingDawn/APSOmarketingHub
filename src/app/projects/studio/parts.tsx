"use client";
// THE PIECES EVERY STUDIO IS BUILT FROM (08.11.2026), so six studios read as one product:
//   StudioPanes     build on the left, the live preview in the middle, the assistant on the right - the whole window
//   Pane            a column with its title and its own scroll
//   PreviewFrame    the real thing rendered in a frame: desktop / mobile, zoomed to fit, never a mock of it
//   AssistantPanel  the AI beside the work: quick asks for this kind, a free ask, its answers to take or leave
//   Counter, Field  a text field that counts against its limit (a subject under 55, a headline under 30)
//   AiLine, AiWorking  the AI at work (SARCLA 08.11.2026: "an AI animation as soon as it starts working"): a moving line
//                   in the brand's pink and red, and a block or a line saying what it does - still for reduced motion

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";

export const PINK = "#c22c6e";
export const STUDIO_BAR = 60;
export const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" as const };
export const mainBtn = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };
export { field };

/** A side column's width, dragged by its edge and kept for next time (SARCLA 08.11.2026: the page list "should be visible", "sizeable"). */
function usePaneWidth(key: string, initial: number, min: number, max: number) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    try { const v = Number(window.localStorage.getItem(`studio-pane:${key}`)); if (v >= min && v <= max) setW(v); } catch { /* no storage */ }
  }, [key, min, max]);
  const keep = (v: number) => { try { window.localStorage.setItem(`studio-pane:${key}`, String(Math.round(v))); } catch { /* no storage */ } };
  return [w, setW, keep] as const;
}

/** The edge between two columns: drag it to make a side wider or narrower; a double-click puts it back. */
function Gutter({ onDrag, onEnd, onReset, label }: { onDrag: (dx: number) => void; onEnd: () => void; onReset: () => void; label: string }) {
  const start = useRef<number | null>(null);
  return (
    <Box role="separator" aria-orientation="vertical" aria-label={label} title="Drag to resize · double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(e) => { start.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (start.current === null) return; onDrag(e.clientX - start.current); start.current = e.clientX; }}
      onPointerUp={() => { start.current = null; onEnd(); }}
      sx={{
        display: { xs: "none", lg: "block" }, width: 12, mx: -0.75, cursor: "col-resize", position: "relative", zIndex: 2, touchAction: "none",
        "&::after": { content: '""', position: "absolute", top: "50%", left: 5, width: 2, height: 36, mt: "-18px", borderRadius: 2, bgcolor: "rgba(21,34,58,.14)", transition: "background-color .12s, height .12s" },
        "&:hover::after, &:active::after": { bgcolor: "#2459d1", height: 64, mt: "-32px" },
      }} />
  );
}

/** The three columns under the studio's bar, each scrolling on its own; the side ones resized by dragging their edge. */
export function StudioPanes({ build, preview, assist, buildWidth = 380, assistWidth = 340, id = "studio", hideBuild = false, hideAssist = false }: {
  build: React.ReactNode; preview: React.ReactNode; assist?: React.ReactNode; buildWidth?: number; assistWidth?: number;
  /** Keeps this studio's widths apart from another's. */
  id?: string;
  /** A side column folded away (the preview takes its room) - on wide screens; a narrow one stacks them anyway. */
  hideBuild?: boolean; hideAssist?: boolean;
}) {
  const [bw, setBw, keepB] = usePaneWidth(`${id}:build`, buildWidth, 260, 760);
  const [aw, setAw, keepA] = usePaneWidth(`${id}:assist`, assistWidth, 260, 620);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // the panes fill the window under whatever sits above them (the studio's bar, a sandbox's banner) - with the fixed
  // bar height alone, the sandbox's banner pushed the foot of every pane (the LAST STEP) under the window's edge
  const [top, setTop] = useState(STUDIO_BAR);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const measure = () => { const el = rootRef.current; if (el) setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY))); };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 400);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, []);
  return (
    <Box ref={rootRef} sx={{
      display: "grid", gap: 1.5, p: 1.5, boxSizing: "border-box", height: { lg: `calc(100vh - ${top}px)` },
      gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: [hideBuild ? "" : `${bw}px 0`, "minmax(420px, 1fr)", assist && !hideAssist ? `0 ${aw}px` : ""].filter(Boolean).join(" ") },
    }}>
      <Box sx={{ minHeight: 0, minWidth: 0, order: { xs: 2, lg: 1 }, display: { lg: hideBuild ? "none" : "block" } }}>{build}</Box>
      <Box sx={{ order: { xs: 9, lg: 2 }, display: { xs: "none", lg: hideBuild ? "none" : "block" } }}>
        <Gutter label="Resize the build column" onDrag={(dx) => setBw((v) => clamp(v + dx, 260, 760))} onEnd={() => keepB(bw)} onReset={() => { setBw(buildWidth); keepB(buildWidth); }} />
      </Box>
      <Box sx={{ minHeight: 0, minWidth: 0, order: { xs: 1, lg: 3 } }}>{preview}</Box>
      {assist && (
        <Box sx={{ order: { xs: 9, lg: 4 }, display: { xs: "none", lg: hideAssist ? "none" : "block" } }}>
          <Gutter label="Resize the assistant" onDrag={(dx) => setAw((v) => clamp(v - dx, 260, 620))} onEnd={() => keepA(aw)} onReset={() => { setAw(assistWidth); keepA(assistWidth); }} />
        </Box>
      )}
      {assist && <Box sx={{ minHeight: 0, minWidth: 0, order: { xs: 3, lg: 5 }, display: { lg: hideAssist ? "none" : "block" } }}>{assist}</Box>}
    </Box>
  );
}

/** A column: a quiet title, then its body scrolling inside. */
export function Pane({ title, right, children, tone = "glass", pad = true }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; tone?: "glass" | "stage"; pad?: boolean }) {
  return (
    <Box sx={{
      height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden",
      ...(tone === "glass"
        ? { bgcolor: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)" }
        : { bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, backgroundImage: "radial-gradient(rgba(21,34,58,.07) 1px, transparent 1px)", backgroundSize: "18px 18px" }),
    }}>
      {(title || right) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: tone === "glass" ? `1px solid ${HAIRLINE}` : "none", flexShrink: 0 }}>
          <Typography component="div" sx={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, flex: 1 }}>{title}</Typography>
          {right}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", ...(pad ? { p: 2 } : {}) }}>{children}</Box>
    </Box>
  );
}

/** A small uppercase heading inside a pane. */
export const Label = ({ children, mt = 2 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mt, mb: 0.75 }}>{children}</Typography>
);

/** A text field that counts against its limit; over it, the count turns red and says by how much. */
export function Field({ label, value, onChange, max, multiline, rows, placeholder, disabled, helper }: {
  label: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean; rows?: number; placeholder?: string; disabled?: boolean; helper?: string;
}) {
  const over = max != null && value.length > max;
  return (
    <TextField fullWidth size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      multiline={multiline} minRows={multiline ? rows ?? 3 : undefined} placeholder={placeholder}
      helperText={max != null || helper ? (
        <Box component="span" sx={{ display: "flex", gap: 1 }}>
          <span style={{ flex: 1 }}>{helper}</span>
          {max != null && <span style={{ color: over ? "#c5221f" : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${value.length - max} too many` : `${value.length} / ${max}`}</span>}
        </Box>
      ) : undefined}
      sx={{ ...field, mb: 1.25, "& .MuiFormHelperText-root": { mx: 0.5 } }} />
  );
}

export type Device = "desktop" | "mobile";

/**
 * The real thing in a frame (an e-mail's HTML, a page, a band), at its real width, zoomed down to fit the pane - so what
 * the reviewer sees is what goes out. `width` is the desktop width; mobile is 390.
 */
export function PreviewFrame({ html, width = 1200, device, onDevice, title = "Preview", height, background = "#fff" }: {
  html: string; width?: number; device: Device; onDevice?: (d: Device) => void; title?: string; height?: number; background?: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [avail, setAvail] = useState(800);
  const [inner, setInner] = useState(height ?? 900);
  const w = device === "mobile" ? 390 : width;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth - 48));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // the frame takes its content's height, so the pane scrolls - not the frame
  const measure = () => {
    const d = frame.current?.contentDocument;
    if (d?.body && !height) setInner(Math.max(300, d.documentElement.scrollHeight));
  };
  useEffect(() => { const t = setTimeout(measure, 120); return () => clearTimeout(t); });
  const zoom = Math.min(1, avail / w);
  return (
    <Pane tone="stage" pad={false} title={title} right={onDevice && (
      <ToggleButtonGroup size="small" exclusive value={device} onChange={(_, v) => v && onDevice(v)} sx={{ bgcolor: "#fff", "& .MuiToggleButton-root": { px: 1.25, py: 0.4, textTransform: "none", fontWeight: 600, fontSize: "0.78rem", gap: 0.5 } }}>
        <ToggleButton value="desktop" aria-label="Desktop"><DesktopWindowsOutlinedIcon sx={{ fontSize: 16 }} />Desktop</ToggleButton>
        <ToggleButton value="mobile" aria-label="Mobile"><PhoneIphoneOutlinedIcon sx={{ fontSize: 16 }} />Mobile</ToggleButton>
      </ToggleButtonGroup>
    )}>
      <Box ref={box} sx={{ p: 3, display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: w * zoom, height: (height ?? inner) * zoom, flexShrink: 0, transition: "width .3s ease", borderRadius: device === "mobile" ? "26px" : "12px", overflow: "hidden", boxShadow: "0 18px 50px rgba(31,45,78,.18)", border: device === "mobile" ? "8px solid #15223a" : `1px solid ${HAIRLINE}`, bgcolor: background }}>
          <iframe ref={frame} title={title} srcDoc={html} onLoad={measure} sandbox="allow-same-origin"
            style={{ width: w, height: height ?? inner, border: 0, transform: `scale(${zoom})`, transformOrigin: "0 0", display: "block", background }} />
        </Box>
      </Box>
    </Pane>
  );
}

export type QuickAsk = { label: string; run: () => Promise<string | null> };

/**
 * The AI beside the work. Quick asks are the studio's own (each returns null when done, or a message); the free ask goes
 * to `onAsk`. Every answer is applied by the studio as a change the person sees - and can undo with the version history.
 */
export function AssistantPanel({ quick, onAsk, enabled, placeholder, children, top, inputRef }: {
  quick: QuickAsk[]; onAsk?: (text: string) => Promise<string | null>; enabled: boolean; placeholder?: string; children?: React.ReactNode;
  /** shown above the quick asks - what the assistant works on (a selected element, the language) */
  top?: React.ReactNode;
  /** the free ask's field, for a studio that puts the cursor there ("Change it with AI") */
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const run = async (label: string, fn: () => Promise<string | null>) => {
    setBusy(label); setMsg(null);
    try { setMsg(await fn()); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  return (
    <Pane title={<Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}><AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: PINK }} />Assistant</Box>}>
      {!enabled && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>The AI is not set up on this hub.</Typography>}
      {top}
      <Box sx={{ display: "grid", gap: 1 }}>
        {quick.map((q) => (
          <Button key={q.label} variant="outlined" disabled={!enabled || !!busy} onClick={() => run(q.label, q.run)}
            startIcon={busy === q.label ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{ ...btn, justifyContent: "flex-start", borderColor: HAIRLINE, color: INK, bgcolor: "#fff", "&:hover": { borderColor: PINK, bgcolor: "#fff" } }}>
            {q.label}
          </Button>
        ))}
      </Box>
      {onAsk && (
        <Box sx={{ mt: 2 }}>
          <TextField fullWidth multiline minRows={3} size="small" value={text} onChange={(e) => setText(e.target.value)} disabled={!enabled} inputRef={inputRef}
            placeholder={placeholder ?? "Ask for a change in your words"} sx={field}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) void run("ask", async () => { const r = await onAsk(text.trim()); if (!r) setText(""); return r; }); }} />
          <Button fullWidth variant="contained" disableElevation disabled={!enabled || !!busy || !text.trim()} sx={{ ...mainBtn, mt: 1 }}
            startIcon={busy === "ask" ? <CircularProgress size={14} color="inherit" /> : undefined}
            onClick={() => run("ask", async () => { const r = await onAsk(text.trim()); if (!r) setText(""); return r; })}>Ask</Button>
        </Box>
      )}
      {msg && <Typography sx={{ mt: 1.5, fontSize: "0.84rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1.25, borderRadius: "10px" }}>{msg}</Typography>}
      {children}
    </Pane>
  );
}

/* ── the AI at work ─────────────────────────────────────────────────────────────────────────────────────────────── */

export const AI_RED = "#D80901";
const still = { "@media (prefers-reduced-motion: reduce)": { animation: "none" } };

/** The moving line of the AI at work: a pink-to-red light running along a faint track. Fades out when `on` ends. */
export function AiLine({ on, height = 3 }: { on: boolean; height?: number }) {
  return (
    <Box aria-hidden sx={{ position: "relative", height, overflow: "hidden", opacity: on ? 1 : 0, transition: "opacity .3s ease", bgcolor: on ? "rgba(194,44,110,.12)" : "transparent" }}>
      <Box sx={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: "42%", borderRadius: height,
        backgroundImage: `linear-gradient(90deg, rgba(194,44,110,0), ${PINK} 30%, ${AI_RED} 60%, rgba(216,9,1,0))`,
        animation: on ? "aiRun 1.5s cubic-bezier(.45,.05,.55,.95) infinite" : "none",
        "@keyframes aiRun": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(240%)" } },
        // less motion asked: the line stands, whole
        "@media (prefers-reduced-motion: reduce)": { animation: "none", width: "100%", backgroundImage: `linear-gradient(90deg, ${PINK}, ${AI_RED})` },
      }} />
    </Box>
  );
}

/** The spark that breathes while the AI works. */
function AiSpark({ size = 17 }: { size?: number }) {
  return (
    <AutoAwesomeOutlinedIcon aria-hidden sx={{
      fontSize: size, color: PINK, animation: "aiBreathe 1.6s ease-in-out infinite",
      "@keyframes aiBreathe": { "0%, 100%": { transform: "scale(.88) rotate(0deg)", opacity: 0.75 }, "50%": { transform: "scale(1.08) rotate(8deg)", opacity: 1 } }, ...still,
    }} />
  );
}

/** Words in the brand's pink and red with a light passing over them. */
function AiWords({ children, size = "0.84rem" }: { children: React.ReactNode; size?: string }) {
  return (
    <Box component="span" sx={{
      fontSize: size, fontWeight: 700, whiteSpace: "nowrap", color: PINK,
      backgroundImage: `linear-gradient(90deg, ${PINK} 0%, ${AI_RED} 35%, #f08aa8 50%, ${AI_RED} 65%, ${PINK} 100%)`, backgroundSize: "220% 100%",
      WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "aiShine 2.2s linear infinite", "@keyframes aiShine": { from: { backgroundPosition: "100% 0" }, to: { backgroundPosition: "-120% 0" } },
      "@media (prefers-reduced-motion: reduce)": { animation: "none", backgroundImage: "none", WebkitTextFillColor: PINK },
    }}>{children}</Box>
  );
}

/**
 * The AI at work, where its answer will come (SARCLA 08.11.2026). `inline`: the spark and the words, for a bar or a button
 * row. `block` (the default): the moving line on top, the words, and the shape of what is coming - for a form or a pane the
 * answer fills. A kind studio puts it where its answer lands; the studio's frame already shows the line under its bar.
 */
export function AiWorking({ label = "AI is writing…", note, variant = "block", lines = 3 }: {
  label?: string; note?: string; variant?: "block" | "inline"; lines?: number;
}) {
  if (variant === "inline") {
    return (
      <Box role="status" aria-live="polite" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
        <AiSpark /><AiWords>{label}</AiWords>
      </Box>
    );
  }
  return (
    <Box role="status" aria-live="polite" sx={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(194,44,110,.22)", bgcolor: "#fffafc", animation: "aiIn .25s ease", "@keyframes aiIn": { from: { opacity: 0 }, to: { opacity: 1 } } }}>
      <AiLine on />
      <Box sx={{ p: 1.75, display: "grid", gap: 1.1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <AiSpark /><AiWords size="0.9rem">{label}</AiWords>
          {note && <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED, ml: 0.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</Typography>}
        </Box>
        {Array.from({ length: lines }, (_, i) => (
          <Box key={i} aria-hidden sx={{
            height: 10, borderRadius: "5px", width: ["94%", "78%", "86%", "62%"][i % 4],
            backgroundImage: "linear-gradient(90deg, #f6e9ef 0%, #fbeff4 40%, #fff 50%, #fbeff4 60%, #f6e9ef 100%)", backgroundSize: "300% 100%",
            animation: `aiShimmer 1.6s ease-in-out ${i * 0.12}s infinite`, "@keyframes aiShimmer": { from: { backgroundPosition: "100% 0" }, to: { backgroundPosition: "0 0" } }, ...still,
          }} />
        ))}
      </Box>
    </Box>
  );
}

/** A short random id for a block. */
export const newId = () => Math.random().toString(36).slice(2, 10);
