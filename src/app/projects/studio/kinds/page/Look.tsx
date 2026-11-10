"use client";
// A TEXT'S AND A BUTTON'S LOOK, IN THE POPUPS (Content v10, SARCLA 10.11.2026 points 2 and 3: "when I click element I should
// have option to change text color, custom color, some kind of editing", "also on button settings better, also color").
//
//   ColorStrip     the shop's palette (red, petrol, ink, grey, white), "Standard", and a colour of its own: the browser's
//                  picker or a code typed (#274e64). A colour that cannot be read on its ground is FLAGGED - its swatch
//                  marked, and picking it asks first ("Use it anyway") - never put on the page silently.
//   TextLookRow    colour · size (S M L XL) · alignment, one row under the words' marks
//   ButtonLookBox  a button: style (filled / outline / link), colour, size, the arrow, a new tab
// What they change is kept by the caller: a new page's field in its looks, a page of the shop's element as its look change,
// a module's words or button in its settings (lib .../style.ts, .../modules/looks.ts).

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  BUTTON_SIZES, BUTTON_STYLES, PALETTE, SIZES, buttonCheck, colorLabel, hexOfColor, normHex, readCheck,
  type ButtonLook, type ReadCheck, type TextLook,
} from "@/lib/content/studio/kinds/page/style";
import { PINK } from "../../parts";
import { Choice } from "./ui";

const AMBER = "#a96a12";
const BLUE = "#2459d1";

/** A small squared caption above a control. */
const Cap = ({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) => (
  <Typography component="div" sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, mb: 0.45, mt }}>{children}</Typography>
);

/* ── the colours ──────────────────────────────────────────────────────── */

/** One squared swatch (a palette colour, "Standard", or the picker). */
function Swatch({ hex, on, label, warn, onClick, children }: { hex: string | null; on: boolean; label: string; warn?: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <Tooltip title={warn ? `${label} - ${warn}` : label}>
      <Box component={onClick ? "button" : "span"} type={onClick ? "button" : undefined} onClick={onClick} aria-label={label} aria-pressed={on}
        sx={{
          all: "unset", position: "relative", cursor: "pointer", width: 26, height: 26, boxSizing: "border-box", borderRadius: "5px", flexShrink: 0,
          bgcolor: hex ?? "#fff", border: `1px solid ${hex && hex !== "#ffffff" ? "rgba(0,0,0,.12)" : "#cfd6dd"}`,
          boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${BLUE}` : "none", transition: "box-shadow .12s, transform .12s",
          "&:hover": { transform: "translateY(-1px)" }, "&:focus-visible": { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${BLUE}` },
          ...(hex === null ? { background: "linear-gradient(135deg,#fff 45%,#d9dee3 45%,#d9dee3 55%,#fff 55%)" } : {}),
        }}>
        {children}
        {warn && <Box component="span" sx={{ position: "absolute", right: -4, top: -4, width: 11, height: 11, borderRadius: "50%", bgcolor: AMBER, border: "2px solid #fff" }} />}
      </Box>
    </Tooltip>
  );
}

/**
 * The palette, "Standard", a colour of its own. `check` says if a colour reads on the element's ground: one that does not
 * is marked, and picking it asks first.
 */
export function ColorStrip({ value, onPick, check, standardLabel = "Standard", allowStandard = true }: {
  /** a palette key, "#rrggbb", or undefined (standard) */
  value: string | undefined;
  onPick: (color: string | undefined, flagged: ReadCheck | null) => void;
  check: (hex: string) => ReadCheck;
  standardLabel?: string;
  allowStandard?: boolean;
}) {
  const cur = hexOfColor(value);
  const own = !!value && value.startsWith("#") && !PALETTE.some((p) => p.hex === cur);
  const [code, setCode] = useState(own ? value! : "");
  const [pending, setPending] = useState<{ color: string; check: ReadCheck } | null>(null);
  useEffect(() => { if (value && value.startsWith("#")) setCode(value); }, [value]);
  const picker = useRef<HTMLInputElement | null>(null);
  const live = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (live.current) clearTimeout(live.current); }, []);

  const pick = (color: string | undefined) => {
    if (!color) { setPending(null); onPick(undefined, null); return; }
    const hex = hexOfColor(color);
    if (!hex) return;
    const c = check(hex);
    if (!c.ok) { setPending({ color, check: c }); return; }
    setPending(null);
    if (!color.startsWith("#")) setCode("");
    onPick(color, null);
  };
  const typed = normHex(code);
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, flexWrap: "wrap" }}>
        {allowStandard && <Swatch hex={null} on={!value} label={standardLabel} onClick={() => pick(undefined)} />}
        {PALETTE.map((p) => {
          const c = check(p.hex);
          return <Swatch key={p.key} hex={p.hex} on={!!value && cur === p.hex} label={p.label} warn={c.ok ? undefined : "hard to read here"} onClick={() => pick(p.key)} />;
        })}
        <Box sx={{ width: "1px", height: 20, bgcolor: HAIRLINE, mx: 0.25 }} />
        <Swatch hex={own ? cur : null} on={own} label="A colour of its own" onClick={() => picker.current?.click()}>
          {!own && <Box component="span" sx={{ position: "absolute", inset: 3, borderRadius: "3px", background: "conic-gradient(#d80901,#f5b400,#1e9e5a,#1f7ae0,#8a3fd1,#d80901)" }} />}
        </Swatch>
        <input ref={picker} type="color" value={typed ?? cur ?? "#274e64"} aria-label="Pick a colour" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          onChange={(e) => { const v = e.target.value.toLowerCase(); setCode(v); if (live.current) clearTimeout(live.current); live.current = setTimeout(() => pick(v), 220); }} />
        <Box sx={{ display: "flex", alignItems: "center", border: `1px solid ${typed || !code ? HAIRLINE : "#e3a29b"}`, borderRadius: "6px", height: 28, pl: 0.75, pr: 0.25, bgcolor: "#fff", width: 112 }}>
          <InputBase value={code} placeholder="#274e64" onChange={(e) => setCode(e.target.value.slice(0, 7))} inputProps={{ "aria-label": "Colour code", spellCheck: false }}
            onKeyDown={(e) => { if (e.key === "Enter" && typed) { e.preventDefault(); pick(typed); } }}
            sx={{ flex: 1, fontSize: "0.78rem", fontFamily: "ui-monospace, Consolas, monospace", "& input": { p: 0 } }} />
          <Button size="small" disabled={!typed} onClick={() => typed && pick(typed)} sx={{ minWidth: 0, px: 0.6, py: 0, fontSize: "0.72rem", fontWeight: 700, color: PINK, textTransform: "none" }}>Use</Button>
        </Box>
      </Box>
      {pending && (
        <Box role="alert" sx={{ mt: 1, p: 1, borderRadius: "7px", bgcolor: "#fdf6ea", border: "1px solid #ecd2a6", display: "flex", gap: 0.9, alignItems: "flex-start" }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 18, color: AMBER, mt: 0.1 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.4, fontWeight: 600 }}>Hard to read - not put on the page yet</Typography>
            <Typography sx={{ fontSize: "0.76rem", color: "#5f4a24", lineHeight: 1.4 }}>{pending.check.why}</Typography>
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.75 }}>
              <Button size="small" onClick={() => { const p = pending; setPending(null); onPick(p.color, p.check); }} sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 700, color: AMBER, px: 1, py: 0.2, border: "1px solid #e2c48f", borderRadius: "6px", bgcolor: "#fff" }}>Use it anyway</Button>
              <Button size="small" onClick={() => setPending(null)} sx={{ textTransform: "none", fontSize: "0.76rem", fontWeight: 600, color: INK, px: 1, py: 0.2 }}>Keep {value ? colorLabel(value).toLowerCase() : "the standard"}</Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** A colour applied although it reads badly: said under the controls while it stays. */
export function ReadWarn({ check }: { check: ReadCheck | null }) {
  if (!check || check.ok) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.6, alignItems: "flex-start", mt: 0.75 }}>
      <WarningAmberRoundedIcon sx={{ fontSize: 15, color: AMBER, mt: 0.15 }} />
      <Typography sx={{ fontSize: "0.74rem", color: AMBER, lineHeight: 1.4 }}>{check.why}</Typography>
    </Box>
  );
}

/* ── a text: colour, size, alignment ──────────────────────────────────── */

const segBtn = (on: boolean) => ({
  all: "unset", cursor: "pointer", minWidth: 26, height: 26, px: 0.5, boxSizing: "border-box", display: "inline-grid", placeItems: "center",
  fontSize: "0.74rem", fontWeight: 700, color: on ? "#fff" : INK, bgcolor: on ? BLUE : "transparent", transition: "background-color .12s",
  "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)", color: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
} as const);

/** A squared row of small segments (S M L XL, the alignments). */
function Seg<K extends string>({ value, options, onChange, label }: { value: K | undefined; options: { key: K; label: React.ReactNode; tip: string }[]; onChange: (k: K) => void; label: string }) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
      {options.map((o, i) => (
        <Tooltip key={o.key} title={o.tip}>
          <Box component="button" type="button" role="radio" aria-checked={value === o.key} aria-label={o.tip} onClick={() => onChange(o.key)} sx={{ ...segBtn(value === o.key), borderLeft: i ? `1px solid ${HAIRLINE}` : "none" }}>{o.label}</Box>
        </Tooltip>
      ))}
    </Box>
  );
}

/**
 * Under a text's words: its colour (the strip opens under it), its size, its alignment. `grounds`: what it stands on
 * ([] = a picture or not known); `large`: a heading (3:1 is enough).
 */
export function TextLookRow({ value, onChange, grounds, large, sizes = true, align = true }: {
  value: TextLook; onChange: (next: TextLook, label: string) => void; grounds: string[]; large: boolean; sizes?: boolean; align?: boolean;
}) {
  const [colors, setColors] = useState(false);
  const check = (hex: string) => readCheck(hex, grounds, large);
  const cur = hexOfColor(value.color);
  const applied = cur ? check(cur) : null;
  const ALIGN = [
    { key: "left" as const, label: <FormatAlignLeftIcon sx={{ fontSize: 16 }} />, tip: "Left" },
    { key: "center" as const, label: <FormatAlignCenterIcon sx={{ fontSize: 16 }} />, tip: "Centred" },
    { key: "right" as const, label: <FormatAlignRightIcon sx={{ fontSize: 16 }} />, tip: "Right" },
  ];
  return (
    <Box sx={{ mt: 1.1, pt: 1.1, borderTop: `1px dashed ${HAIRLINE}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Tooltip title="Its colour">
          <Box component="button" type="button" onClick={() => setColors((x) => !x)} aria-expanded={colors} sx={{
            all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, height: 28, px: 0.9, borderRadius: "6px",
            border: `1px solid ${colors ? BLUE : HAIRLINE}`, bgcolor: "#fff", fontSize: "0.78rem", fontWeight: 650, color: INK, "&:hover": { borderColor: BLUE },
          }}>
            <Box component="span" sx={{ width: 15, height: 15, borderRadius: "4px", bgcolor: cur ?? "transparent", border: `1px solid ${cur && cur !== "#ffffff" ? "rgba(0,0,0,.15)" : "#cfd6dd"}`,
              ...(cur ? {} : { background: "linear-gradient(135deg,#fff 42%,#d9dee3 42%,#d9dee3 58%,#fff 58%)" }) }} />
            {value.color ? colorLabel(value.color) : "Colour"}
            {applied && !applied.ok && <WarningAmberRoundedIcon sx={{ fontSize: 14, color: AMBER }} />}
          </Box>
        </Tooltip>
        {sizes && <Seg label="Size" value={value.size ?? "m"} options={SIZES.map((s) => ({ key: s.key, label: s.label, tip: { s: "Small", m: "Normal", l: "Large", xl: "Extra large" }[s.key] }))}
          onChange={(k) => onChange({ ...value, size: k === "m" ? undefined : k }, "Changed the size")} />}
        {align && <Seg label="Alignment" value={value.align ?? "left"} options={ALIGN} onChange={(k) => onChange({ ...value, align: k === "left" ? undefined : k }, "Changed the alignment")} />}
      </Box>
      {colors && (
        <Box sx={{ mt: 1, p: 1, borderRadius: "8px", bgcolor: "#f7f8fa" }}>
          <ColorStrip value={value.color} check={check} onPick={(c) => onChange({ ...value, color: c }, c ? `Coloured it ${colorLabel(c).toLowerCase()}` : "Put its colour back")} />
        </Box>
      )}
      {!colors && <ReadWarn check={applied} />}
    </Box>
  );
}

/* ── a button ─────────────────────────────────────────────────────────── */

/** A button's look: style, colour, size, the arrow, a new tab. `fallback`: its colour while none is chosen. */
export function ButtonLookBox({ value, onChange, grounds, fallback, arrowDefault = true }: {
  value: ButtonLook; onChange: (next: ButtonLook, label: string) => void; grounds: string[]; fallback: string;
  /** its arrow while not set (a new page's button has one; a module's as the module draws it) */
  arrowDefault?: boolean;
}) {
  const style = value.style ?? "filled";
  const check = (hex: string) => buttonCheck({ ...value, color: hex }, fallback, grounds);
  const applied = value.color ? check(hexOfColor(value.color) ?? "") : null;
  const arrow = value.arrow ?? arrowDefault;
  return (
    <Box sx={{ display: "grid", gap: 1.1 }}>
      <Box>
        <Cap>Style</Cap>
        <Choice value={style} onChange={(k) => onChange({ ...value, style: k }, `Made the button ${k === "link" ? "a link" : k}`)} options={BUTTON_STYLES} />
      </Box>
      <Box>
        <Cap>{style === "filled" ? "Its colour" : "Its line and words"}</Cap>
        <ColorStrip value={value.color} standardLabel={`Standard (${colorLabel(fallback).toLowerCase()})`} check={check}
          onPick={(c) => onChange({ ...value, color: c }, c ? `Coloured the button ${colorLabel(c).toLowerCase()}` : "Put the button's colour back")} />
        <ReadWarn check={applied} />
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {style !== "link" && (
          <Box>
            <Cap>Size</Cap>
            <Choice value={value.size ?? "m"} onChange={(k) => onChange({ ...value, size: k === "m" ? undefined : k }, "Changed the button's size")} options={BUTTON_SIZES} />
          </Box>
        )}
        <Box>
          <Cap>Arrow</Cap>
          <Choice value={arrow ? "on" : "off"} onChange={(k) => onChange({ ...value, arrow: k === "on" ? (arrowDefault ? undefined : true) : false }, k === "on" ? "Gave the button its arrow" : "Took the button's arrow off")}
            options={[{ key: "on", label: "On" }, { key: "off", label: "Off" }]} />
        </Box>
        <Box>
          <Cap>Opens</Cap>
          <Choice value={value.tab ? "tab" : "same"} onChange={(k) => onChange({ ...value, tab: k === "tab" || undefined }, k === "tab" ? "The button opens a new tab" : "The button opens in the same tab")}
            options={[{ key: "same", label: "Same tab" }, { key: "tab", label: "New tab" }]} />
        </Box>
      </Box>
    </Box>
  );
}

/** A compact icon toggle for the words' marks row (B / I / U), lit when on. */
export function MarkBtn({ on, tip, onClick, children }: { on: boolean; tip: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip title={tip}>
      <IconButton size="small" onClick={onClick} aria-label={tip} aria-pressed={on}
        sx={{ p: 0.45, borderRadius: "6px", color: on ? "#fff" : INK, bgcolor: on ? BLUE : "transparent", "&:hover": { bgcolor: on ? BLUE : "rgba(21,34,58,.06)" } }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}
