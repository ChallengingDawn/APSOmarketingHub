"use client";
// THE SMALL PIECES THE BANNER AND SOCIAL STUDIOS SHARE (08.11.2026), in the hub's UC look: a section with its heading,
// the shop's photos to pick from, words as chips, a copy button, a banner or slide drawn at its real size and zoomed to
// fit, and the brand's type loaded once.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SHOP_PHOTOS, photoLabel, type ShopPhoto } from "@/lib/content/studio/kinds/banner/brand";
import { PINK, btn, field } from "../../parts";
import { brandFontCss, putFontInPage } from "./png";

/** A part of a build pane: a quiet heading, an optional control on its right, then its fields. */
export function Section({ title, right, children, first }: { title: string; right?: React.ReactNode; children: React.ReactNode; first?: boolean }) {
  return (
    <Box sx={{ pt: first ? 0 : 2.25, mt: first ? 0 : 2.25, borderTop: first ? "none" : `1px solid ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Typography sx={{ flex: 1, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** A quiet line of help under a field. */
export const Hint = ({ children, sx }: { children: React.ReactNode; sx?: object }) => (
  <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45, ...sx }}>{children}</Typography>
);

export type BrandFont = { css: string; state: "loading" | "ready" | "failed" };
let known: BrandFont = { css: "", state: "loading" };

/**
 * The brand's type, loaded once for the whole hub - NEVER waited on (lead 08.11.2026: the preview stuck on "Loading the
 * brand's type" when the font route answered 503): everything draws at once in the look-alike stack (futura-pt, Jost,
 * Century Gothic, Arial), and the brand's file is swapped in when it arrives. A failed font is a quiet note.
 */
export function useBrandFontState(): BrandFont {
  const [f, setF] = useState<BrandFont>(known);
  useEffect(() => {
    let live = true;
    void brandFontCss().then((c) => {
      known = { css: c, state: c ? "ready" : "failed" };
      if (c) putFontInPage(c);
      if (live) setF(known);
    });
    return () => { live = false; };
  }, []);
  return f;
}

/** The brand's type as CSS: "" until it comes, or when it cannot (draw in the look-alike stack) - never null now. */
export function useBrandFont(): string | null {
  return useBrandFontState().css;
}

/** The width of a box, kept up to date. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Markup drawn at its real size, zoomed: `w` wide (and `h` tall, or as tall as it is), shown at `scale`. Used for every
 * still banner and slide in the studios, so what is seen is what the PNG draws.
 */
export function Scaled({ css, html, w, h, scale, radius = 0, shadow = true, onClick, title }: {
  css: string; html: string; w: number; h?: number | null; scale: number; radius?: number; shadow?: boolean; onClick?: () => void; title?: string;
}) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState(h ?? 0);
  useLayoutEffect(() => {
    if (h) { setNatural(h); return; }
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNatural(el.offsetHeight));
    ro.observe(el);
    setNatural(el.offsetHeight);
    return () => ro.disconnect();
  }, [h, html]);
  return (
    <Box onClick={onClick} title={title} sx={{
      width: w * scale, height: natural * scale, flexShrink: 0, overflow: "hidden", borderRadius: `${radius}px`, cursor: onClick ? "pointer" : "default",
      boxShadow: shadow ? "0 14px 40px rgba(31,45,78,.16)" : "none", bgcolor: "#fff", transition: "box-shadow .2s",
      ...(onClick ? { "&:hover": { boxShadow: `0 0 0 2px ${PINK}, 0 14px 40px rgba(31,45,78,.18)` } } : {}),
    }}>
      <div ref={inner} style={{ width: w, height: h ?? undefined, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        dangerouslySetInnerHTML={{ __html: `<style>${css}</style>${html}` }} />
    </Box>
  );
}

/** Copies a text, says so for a moment. */
export function CopyButton({ text, label, main, disabled, size = "small" }: { text: string | (() => string); label: string; main?: boolean; disabled?: boolean; size?: "small" | "medium" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    const t = typeof text === "function" ? text() : text;
    try { await navigator.clipboard.writeText(t); } catch {
      const a = document.createElement("textarea");
      a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <Button size={size} variant={main ? "contained" : "outlined"} disableElevation disabled={disabled} onClick={copy}
      startIcon={done ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
      sx={main ? { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } } : { ...btn, color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>
      {done ? "Copied" : label}
    </Button>
  );
}

/** Words as chips: Enter (or a comma, where `comma`) adds one, the cross takes it out. */
export function ChipsInput({ values, onChange, placeholder, max, clean = (s) => s.trim(), comma = false, disabled, tone = "petrol" }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number; clean?: (s: string) => string; comma?: boolean; disabled?: boolean; tone?: "petrol" | "pink";
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = (comma ? raw.split(/[,\n]/) : [raw]).map(clean).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase()) && (!max || next.length < max)) next.push(p);
    if (next.length !== values.length) onChange(next);
    setText("");
  };
  const fg = tone === "pink" ? "#b63a76" : "#274e64";
  const bg = tone === "pink" ? "#fde8f1" : "#e6eef2";
  return (
    <Box>
      {values.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
          {values.map((v, i) => (
            <Box key={`${v}-${i}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.1, pr: 0.4, py: 0.35, borderRadius: "5px", bgcolor: bg, color: fg, fontSize: "0.82rem", fontWeight: 600, maxWidth: "100%" }}>
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</Box>
              {!disabled && (
                <Box component="button" type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((_, k) => k !== i))}
                  sx={{ all: "unset", cursor: "pointer", display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "4px", "&:hover": { bgcolor: "rgba(0,0,0,.07)" } }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
      <TextField fullWidth size="small" value={text} placeholder={placeholder} disabled={disabled || (!!max && values.length >= max)} sx={field}
        onChange={(e) => { const v = e.target.value; if (comma && /[,\n]/.test(v)) add(v); else setText(v); }}
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { e.preventDefault(); add(text); } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1)); }}
        onBlur={() => { if (text.trim()) add(text); }} />
    </Box>
  );
}

/** The shop's own photos: one picked (or several, in order, where `multi`). */
export function PhotoPicker({ selected, onPick, multi, lang }: { selected: string[]; onPick: (p: ShopPhoto) => void; multi?: boolean; lang: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
      {SHOP_PHOTOS.map((p) => {
        const at = selected.indexOf(p.url);
        const on = at >= 0;
        return (
          <Tooltip key={p.key} title={photoLabel(p, lang)}>
            <Box component="button" type="button" onClick={() => onPick(p)} aria-pressed={on} aria-label={photoLabel(p, lang)} sx={{
              all: "unset", cursor: "pointer", position: "relative", aspectRatio: "4 / 3", borderRadius: "10px", overflow: "hidden", bgcolor: "#e9ebed",
              outline: on ? `2px solid ${PINK}` : `1px solid ${HAIRLINE}`, outlineOffset: on ? 1 : 0, transition: "outline-color .15s",
              "&:hover": { outline: `2px solid ${on ? PINK : "#9fb3c0"}` }, "&:focus-visible": { outline: `2px solid ${PINK}` },
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {on && (
                <Box sx={{ position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, px: 0.4, borderRadius: "9px", bgcolor: PINK, color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "grid", placeItems: "center" }}>
                  {multi ? at + 1 : <CheckIcon sx={{ fontSize: 13 }} />}
                </Box>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/** Where a picture's address can come from - and why another one would not show. */
export function pictureProblem(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (/^\/api\/content\/picture\/\d+-[\w-]+$/.test(u)) return null;
  if (u.startsWith("data:")) return "A picture pasted as data is too heavy to keep - put it in the shop's media and use its address.";
  if (/^(wysiwyg|catalog)\//.test(u) || u.startsWith("/media/") || /^\{\{\s*media/.test(u)) return null;
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "www.apsoparts.com" ? null : "Only the shop's pictures show here (www.apsoparts.com/media/…) - put it in the shop's media first.";
  } catch { return "That is not a picture's address."; }
}

/** What to look at before it goes out: limits, the brand's rules, missing pieces. */
export function Checks({ items, ok }: { items: string[]; ok: string }) {
  if (!items.length) {
    return <Typography sx={{ fontSize: "0.82rem", color: "#1b7a55", display: "flex", alignItems: "center", gap: 0.75 }}><CheckIcon sx={{ fontSize: 17 }} />{ok}</Typography>;
  }
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      {items.map((t, i) => (
        <Box key={i} sx={{ display: "flex", gap: 0.9, alignItems: "flex-start", fontSize: "0.82rem", color: INK, lineHeight: 1.4 }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 17, color: AMBER, mt: "1px", flexShrink: 0 }} />
          <span>{t}</span>
        </Box>
      ))}
    </Box>
  );
}

/** A row of small round swatches. */
export function Swatches<K extends string>({ value, onChange, options, disabled }: {
  value: K; onChange: (k: K) => void; options: { key: K; label: string; fill: string; ring?: string }[]; disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.1 }}>
      {options.map((o) => (
        <Tooltip key={o.key} title={o.label}>
          <Box component="button" type="button" disabled={disabled} aria-label={o.label} aria-pressed={value === o.key} onClick={() => onChange(o.key)} sx={{
            all: "unset", cursor: disabled ? "default" : "pointer", width: 34, height: 34, borderRadius: "8px", background: o.fill,
            boxShadow: value === o.key ? `0 0 0 2px #fff, 0 0 0 4px ${PINK}` : `inset 0 0 0 1px ${o.ring ?? "rgba(21,34,58,.14)"}`,
            transition: "box-shadow .15s", "&:focus-visible": { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${PINK}` },
          }} />
        </Tooltip>
      ))}
    </Box>
  );
}
