"use client";
// THE BANNER'S DESIGN (Content v7, 10.11.2026; SARCLA point 11: "improve a lot the banner page"). As in Canva or Figma, a
// banner starts from a finished design: each one drawn here with the banner's OWN words and picture (the parts not written
// yet as their hints), at the shop banner's real proportions - the Evolast slide's petrol, the O-ring guide's light photo,
// the Variety Series' red block, the Black Friday hero, a photo behind the words, the newsletter band. A click takes it for
// every place of the banner at once. Under it: the design's colours, the headline's colour, and - right away, in plain
// words - whatever could no longer be read (lib/content/studio/kinds/banner/looks.ts, the page studio's readability sums).

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { paletteOf, unreadable } from "@/lib/content/studio/kinds/banner/looks";
import { HEAD_COLORS, LOOK, LOOKS, THEMES, themeFor, type BannerDoc, type HeadColor, type LookKey, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { prefixFor, stillMarkup } from "@/lib/content/studio/kinds/banner/render";
import { PINK } from "../../parts";
import type { Set } from "./Editor";
import { staged } from "./Preview";
import { Scaled, Swatches } from "./ui";

const THEME_NAME: Partial<Record<string, string>> = { petrol: "Petrol", ink: "Deep ink", white: "White", grey: "Light grey", pale: "Pale petrol", sand: "Sand", clouds: "Soft clouds", red: "Red" };

/** One design, drawn with the banner's own words and picture at the place's proportions. */
export function LookThumb({ doc, look, k = "slider", width, pieceId }: { doc: BannerDoc; look: LookKey; k?: PresetKey; width: number; pieceId: number }) {
  const shown = useMemo(() => {
    const d: BannerDoc = { ...doc, look, theme: themeFor(look, look === doc.look ? doc.theme : LOOK[look].themes[0]), headColor: look === doc.look ? doc.headColor : "auto" };
    return stillMarkup(staged(d, k).doc, k, prefixFor(`${pieceId}${look}${k}`.slice(0, 12)));
  }, [doc, look, k, pieceId]);
  const w = k === "slider" ? 1920 : 1080;
  const h = k === "slider" ? 600 : 1080;
  return <Scaled css={shown.css} html={shown.html} w={w} h={h} scale={width / w} radius={4} shadow={false} />;
}

/** The designs to pick from: a grid of the banner itself in each. */
export function LookGrid({ doc, set, canEdit, pieceId, columns = 2, width = 150 }: { doc: BannerDoc; set: Set; canEdit: boolean; pieceId: number; columns?: number; width?: number }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1 }}>
      {LOOKS.map((l) => {
        const on = doc.look === l.key;
        return (
          <Tooltip key={l.key} title={`${l.note}${l.from ? ` - like ${l.from}` : ""}`} placement="top" enterDelay={400}>
            <Box component="button" type="button" disabled={!canEdit} aria-pressed={on} aria-label={l.name}
              onClick={() => canEdit && set((d) => ({ ...d, look: l.key, theme: themeFor(l.key, d.theme), headColor: d.look === l.key ? d.headColor : "auto" }))}
              sx={{
                all: "unset", cursor: canEdit ? "pointer" : "default", display: "block", minWidth: 0, borderRadius: "8px", p: 0.5, boxSizing: "border-box",
                outline: on ? `2px solid ${PINK}` : `1px solid ${HAIRLINE}`, outlineOffset: on ? 0 : -1, bgcolor: "#fff",
                "&:hover": { outline: `2px solid ${on ? PINK : "#9fb3c0"}` }, "&:focus-visible": { outline: `2px solid ${PINK}` },
              }}>
              <Box sx={{ overflow: "hidden", borderRadius: "4px", width: "100%" }}>
                <LookThumb doc={doc} look={l.key} width={width} pieceId={pieceId} />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, px: 0.25 }}>
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.74rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</Typography>
                {on && <CheckIcon sx={{ fontSize: 15, color: PINK }} />}
              </Box>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/** What could not be read, said plainly (nothing when it reads). */
export function ReadLines({ doc }: { doc: BannerDoc }) {
  const list = unreadable(doc);
  if (!list.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5, mt: 1 }}>
      {list.map((u) => (
        <Box key={u.part} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", fontSize: "0.78rem", color: INK, lineHeight: 1.4 }}>
          <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: "#c5221f", mt: "1px", flexShrink: 0 }} /><span>{u.text}</span>
        </Box>
      ))}
    </Box>
  );
}

/** The Design part's fields: the designs, the design's colours, the headline's colour, the guard. */
export default function DesignFields({ doc, set, canEdit, pieceId }: { doc: BannerDoc; set: Set; canEdit: boolean; pieceId: number }) {
  const look = LOOK[doc.look];
  const label = { fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: MUTED, mb: 0.6 };
  return (
    <Box>
      <LookGrid doc={doc} set={set} canEdit={canEdit} pieceId={pieceId} width={148} />
      {look.themes.length > 1 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={label}>Its colour</Typography>
          <Swatches value={doc.theme} disabled={!canEdit} onChange={(t) => set((d) => ({ ...d, theme: t }))}
            options={look.themes.map((t) => ({ key: t, label: THEME_NAME[t] ?? THEMES[t].name, fill: doc.look === "band" ? THEMES[t].bg : paletteOf(doc.look, t).ground }))} />
        </Box>
      )}
      <Box sx={{ mt: 1.5 }}>
        <Typography sx={label}>The headline&apos;s colour</Typography>
        <SquareChoice<HeadColor> value={doc.headColor} onChange={(c) => canEdit && set((d) => ({ ...d, headColor: c }))}
          options={HEAD_COLORS.map((c) => ({ key: c.key, label: c.label, disabled: !canEdit }))} />
      </Box>
      <ReadLines doc={doc} />
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.25, lineHeight: 1.45 }}>
        {look.note}{look.from ? ` - like ${look.from}` : ""}. The same design in every place of the banner.
      </Typography>
    </Box>
  );
}
