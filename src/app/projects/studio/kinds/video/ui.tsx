"use client";
// THE VIDEO STUDIO'S SMALL PIECES (08.11.2026, Content v3; SARCLA: "button is not fit", "O-ring is not realistic on
// video", "the controls are really hard"): the shop's line icons, a line of the film with its word count, our real parts
// to pick (the shop's own product photos), a quiet heading. Every button here carries a short fixed text - a feature's
// long name is never put in a button, it sits on its card.

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import { HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { wordCount } from "@/lib/content/studio/kinds/video/engine/text";
import type { IconKey } from "@/lib/content/studio/kinds/video/features";
import { ICON_PATHS } from "@/lib/content/studio/kinds/video/film/iconPaths";
import { PARTS, type PartKey } from "@/lib/content/studio/kinds/video/parts";
import { field } from "../../parts";

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

/** A line of the film: its words counted against what is read in under two seconds. */
export function WordField({ label, value, words, placeholder, onChange, onFocus, disabled, multiline, autoFocus }: {
  label: string; value: string; words: number; placeholder?: string; onChange: (v: string) => void; onFocus?: () => void; disabled?: boolean; multiline?: boolean; autoFocus?: boolean;
}) {
  const n = wordCount(value);
  const over = n > words;
  return (
    <TextField fullWidth size="small" label={label} value={value} placeholder={placeholder} disabled={disabled} multiline={multiline} minRows={multiline ? 2 : undefined} autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)} onFocus={onFocus}
      helperText={<Box component="span" sx={{ display: "flex", justifyContent: "flex-end" }}><span style={{ color: over ? RED : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${n - words} word${n - words > 1 ? "s" : ""} too many` : `${n} / ${words} words`}</span></Box>}
      sx={{ ...field, mb: 1, "& .MuiFormHelperText-root": { mx: 0.5, mt: 0.25 } }} />
  );
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
