"use client";
// THE VIDEO STUDIO'S SMALL PIECES (08.11.2026, Content v3; SARCLA: "button is not fit", "O-ring is not realistic on
// video", "the controls are really hard"): the shop's line icons, a line of the film with its word count and its red word
// shown red (never the raw *stars*, 09.11.2026), our real parts
// to pick (the shop's own product photos), a quiet heading. Every button here carries a short fixed text - a feature's
// long name is never put in a button, it sits on its card.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import { HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { wordCount } from "@/lib/content/studio/kinds/video/engine/text";
import type { IconKey } from "@/lib/content/studio/kinds/video/features";
import { ICON_PATHS } from "@/lib/content/studio/kinds/video/film/iconPaths";
import { PARTS, type PartKey } from "@/lib/content/studio/kinds/video/parts";

export const SEL = "#2459d1";

/** One of the shop's line icons, small. */
export function LineIcon({ name, size = 22, color = "#274e64" }: { name: IconKey; size?: number; color?: string }) {
  return (
    <Box component="svg" viewBox="0 0 24 24" sx={{ width: size, height: size, flexShrink: 0, display: "block" }} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

/** A quiet heading over a group of controls. */
export const Head = ({ children, mt = 2.25, right }: { children: React.ReactNode; mt?: number; right?: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt, mb: 1 }}>
    <Typography sx={{ flex: 1, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>{children}</Typography>
    {right}
  </Box>
);

/**
 * A line of the film: its words counted against what is read in under two seconds, and its key word shown RED while it
 * is typed (09.11.2026, the flow standard: "never raw ** marks in front of the person"). Kept in the document as
 * *word*, as before; here the person selects a word (or puts the cursor in it) and presses "Red" - once more, plain.
 */
export function WordField({ label, value, words, placeholder, onChange, onFocus, disabled, multiline, autoFocus, red = true }: {
  label: string; value: string; words: number; placeholder?: string; onChange: (v: string) => void; onFocus?: () => void; disabled?: boolean; multiline?: boolean; autoFocus?: boolean;
  /** the film shows a red word in this line (a kicker, a proof or a button never does) */
  red?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drawn = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  // the words drawn with their red word, only when they change from outside (typing keeps the cursor where it is)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === drawn.current) return;
    el.innerHTML = red ? redHtml(value) : escHtml(value.replace(/\*/g, "")).replace(/\n/g, "<br>");
    drawn.current = value;
  }, [value]);
  useEffect(() => { if (autoFocus && !disabled) ref.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const v = readRed(el, !!multiline).replace(/ /g, " ");
    drawn.current = v;
    onChange(v);
  };
  /** The selected words - or the word the cursor is in - red; pressed again on the red word, plain. One red word a line. */
  const toggleRed = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
    const text = el.textContent ?? "";
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    let a = pre.toString().length;
    let b = a + r.toString().length;
    if (a === b) { // the word around the cursor
      while (a > 0 && /\S/.test(text[a - 1])) a--;
      while (b < text.length && /\S/.test(text[b])) b++;
    }
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    const red = redRange(value);
    const plainText = value.replace(/\*([^*]+)\*/g, "$1");
    const next = a < b && !(red && red[0] === a && red[1] === b) ? `${plainText.slice(0, a)}*${plainText.slice(a, b)}*${plainText.slice(b)}` : plainText;
    drawn.current = null;
    onChange(next);
    el.focus();
  };
  const n = wordCount(value);
  const over = n > words;
  const empty = !value.trim();
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.4 }}>
        <Typography component="label" sx={{ flex: 1, fontSize: "0.74rem", fontWeight: 600, color: focused ? SEL : MUTED }}>{label}</Typography>
        {red && <Tooltip title="Select a word, then Red: it shows red in the film. Again: plain.">
          <span>
            <Box component="button" type="button" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={toggleRed} aria-label="Make the word red"
              sx={{ all: "unset", cursor: disabled ? "default" : "pointer", px: 0.75, py: 0.1, borderRadius: "4px", border: `1px solid ${HAIRLINE}`, fontSize: "0.7rem", fontWeight: 800, color: RED, bgcolor: "#fff", lineHeight: 1.5, opacity: focused ? 1 : 0.6, "&:hover": { borderColor: RED } }}>
              Red
            </Box>
          </span>
        </Tooltip>}
      </Box>
      <Box sx={{ position: "relative" }}>
        <Box ref={ref} role="textbox" aria-label={label} aria-multiline={multiline ? "true" : "false"} contentEditable={!disabled} suppressContentEditableWarning
          onInput={emit} onFocus={() => { setFocused(true); onFocus?.(); }} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && !multiline) e.preventDefault(); }}
          onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, multiline ? "\n" : " ")); }}
          sx={{
            minHeight: multiline ? 58 : 38, boxSizing: "border-box", px: 1.5, py: 0.9, fontSize: "0.9rem", lineHeight: 1.45, color: INK, bgcolor: disabled ? "#f6f7f9" : "#fff",
            borderRadius: "8px", border: `1px solid ${focused ? SEL : "rgba(21,34,58,.23)"}`, boxShadow: focused ? `inset 0 0 0 1px ${SEL}` : "none", outline: "none",
            whiteSpace: multiline ? "pre-wrap" : "nowrap", overflowX: "auto", overflowWrap: multiline ? "anywhere" : "normal", "&:hover": disabled || focused ? {} : { borderColor: "rgba(21,34,58,.6)" },
          }} />
        {empty && placeholder && <Typography aria-hidden sx={{ position: "absolute", left: 13, top: 8, fontSize: "0.9rem", color: "#a3acb7", pointerEvents: "none" }}>{placeholder.replace(/\*/g, "")}</Typography>}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.25, px: 0.5 }}>
        <Typography component="span" sx={{ fontSize: "0.72rem", color: over ? RED : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${n - words} word${n - words > 1 ? "s" : ""} too many` : `${n} / ${words} words`}</Typography>
      </Box>
    </Box>
  );
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The words as the field draws them: the *red* word in red, nothing else marked. */
export const redHtml = (v: string) => escHtml(v).replace(/\*([^*]+)\*/g, `<span data-red="1" style="color:${RED};font-weight:700">$1</span>`).replace(/\n/g, "<br>");
/** Where the red word sits in the plain words (no stars), or null. */
export function redRange(v: string): [number, number] | null {
  const m = /\*([^*]+)\*/.exec(v);
  return m ? [m.index, m.index + m[1].length] : null;
}
/** The field's words back as the document keeps them: the red word between stars. */
function readRed(el: HTMLElement, multiline: boolean): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) { out += n.textContent ?? ""; return; }
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName === "BR") { out += multiline ? "\n" : " "; return; }
    if (n.dataset.red) { const t = n.textContent ?? ""; out += t.trim() ? `*${t}*` : t; return; }
    out += readRed(n, multiline);
  });
  return out;
}

/** A squared tile that can be picked: a picture or an icon, a name, a tick when picked. */
export function Tile({ on, onClick, disabled, title, children, label, sub, badge, row }: {
  on: boolean; onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode; label: string; sub?: string; badge?: React.ReactNode;
  /** The picture on the left of the name, not over it. */
  row?: boolean;
}) {
  const body = (
    <Box component="button" type="button" disabled={disabled} aria-pressed={on} aria-label={label} onClick={onClick} sx={{
      all: "unset", boxSizing: "border-box", position: "relative", cursor: disabled ? "default" : "pointer", display: "flex", flexDirection: row ? "row" : "column", alignItems: row ? "center" : "stretch", minWidth: 0, width: "100%", minHeight: row ? 46 : undefined,
      borderRadius: "6px", overflow: "hidden", border: `1px solid ${on ? "rgba(36,89,209,.65)" : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.05)" : "#fff",
      boxShadow: on ? `0 0 0 1px ${SEL}` : "none", transition: "border-color .15s, box-shadow .15s", opacity: disabled && !on ? 0.5 : 1,
      "&:hover": disabled ? {} : { borderColor: on ? SEL : "#9fb3c0" }, "&:focus-visible": { outline: `2px solid ${SEL}`, outlineOffset: 1 },
    }}>
      {children}
      <Box sx={{ px: row ? 0 : 0.9, pl: row ? 0.9 : 0.9, pr: row ? 2.6 : 0.9, py: 0.6, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: 650, color: INK, lineHeight: 1.25, overflowWrap: "anywhere" }}>{label}</Typography>
        {sub && <Typography sx={{ fontSize: "0.68rem", color: MUTED, lineHeight: 1.3 }}>{sub}</Typography>}
      </Box>
      {(on || badge) && (
        <Box sx={{ position: "absolute", top: 5, right: 5, minWidth: 17, height: 17, px: 0.3, borderRadius: "3px", bgcolor: SEL, color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "grid", placeItems: "center" }}>
          {badge ?? <CheckIcon sx={{ fontSize: 13 }} />}
        </Box>
      )}
    </Box>
  );
  return title ? <Tooltip title={title} enterDelay={400}>{disabled ? <span style={{ display: "block", minWidth: 0 }}>{body}</span> : body}</Tooltip> : body;
}

/** Our real parts (the shop's own product photos, cut out) to pick from; `none` adds "No part". */
export function PartPicker({ value, onChange, disabled, none, columns = 4 }: { value: PartKey | null; onChange: (k: PartKey | null) => void; disabled?: boolean; none?: boolean; columns?: number }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 0.75 }}>
      {PARTS.map((p) => (
        <Tile key={p.key} on={value === p.key} disabled={disabled} onClick={() => onChange(p.key)} label={p.name} title={`${p.note} - the shop's own photo of it`}>
          <Box sx={{ height: 58, display: "grid", placeItems: "center", bgcolor: "#f4f6f8" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/video/${p.cut}`} alt="" style={{ height: 48, width: "auto", display: "block" }} />
          </Box>
        </Tile>
      ))}
      {none && (
        <Tile on={value === null} disabled={disabled} onClick={() => onChange(null)} label="No part">
          <Box sx={{ height: 58, display: "grid", placeItems: "center", bgcolor: "#f4f6f8", color: MUTED, fontSize: "0.72rem" }}>Words only</Box>
        </Tile>
      )}
    </Box>
  );
}
