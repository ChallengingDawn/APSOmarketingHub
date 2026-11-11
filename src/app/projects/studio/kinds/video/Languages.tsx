"use client";
// THE FILM'S LANGUAGES, A TAB EACH (cv16, 11.11.2026). SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the
// Page builder] to the other content types' generators, and improve them". In the Page builder every language version is
// a tab of its own and a translation takes EVERY part along (page/modules/translate.ts). Here the same for the film: its
// own language first, then each version (the same scenes, pictures and timing - their own words on screen). "+ Language"
// translates every line at once; in a version's tab the words typed are that language's, the film plays in it, and its
// last step exports it as a file of its own. A version made from words that changed since says so.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";

import { AMBER, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { LANGUAGES, languageLabel } from "@/lib/content/languages";
import { PINK, btn } from "../../parts";
import { Writing } from "./map";

export function LanguageTabs({ langs, view, onView, onAdd, disabled, busy }: {
  /** the film's languages, its own first */
  langs: string[]; view: string; onView: (code: string) => void;
  onAdd: (code: string) => void; disabled: boolean;
  /** the language being translated, if one is, and since when */
  busy: { code: string; since: number } | null;
}) {
  const [at, setAt] = useState<HTMLElement | null>(null);
  const free = LANGUAGES.filter((l) => !langs.includes(l.code));
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      <SquareChoice<string> value={view} onChange={onView} options={langs.map((c, i) => ({ key: c, label: i === 0 ? `${c} · own` : c }))} />
      <Button size="small" disabled={disabled || !!busy || !free.length || langs.length >= 8} onClick={(e) => setAt(e.currentTarget)} startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
        sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Language</Button>
      <Menu anchorEl={at} open={!!at} onClose={() => setAt(null)} slotProps={{ paper: { sx: { width: 240, borderRadius: "10px" } } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>Translate every line into</Typography>
        {free.map((l) => (
          <MenuItem key={l.code} onClick={() => { setAt(null); onAdd(l.code); }} sx={{ fontSize: "0.86rem" }}>
            <Box component="span" sx={{ fontWeight: 700, width: 30 }}>{l.code}</Box>{l.label}
          </MenuItem>
        ))}
      </Menu>
      {busy && <Writing label={`Translating into ${languageLabel(busy.code)}`} since={busy.since} />}
    </Box>
  );
}

/** Under the tabs, in a version's tab: how complete it is, Translate again, Take it out. */
export function LanguageBar({ code, missing, stale, disabled, busy, onTranslate, onDrop }: {
  code: string; missing: number; stale: boolean; disabled: boolean; busy: boolean; onTranslate: () => void; onDrop: () => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 1.25, py: 0.6, borderRadius: "8px", bgcolor: "rgba(36,89,209,.06)", border: "1px solid rgba(36,89,209,.18)" }}>
      <TranslateRoundedIcon sx={{ fontSize: 16, color: "#2459d1" }} />
      <Typography sx={{ flex: 1, minWidth: 160, fontSize: "0.78rem", color: "#15223a" }}>
        <b>{languageLabel(code)}</b> - the same scenes and pictures, its own words.{" "}
        {missing > 0 && <Box component="span" sx={{ color: AMBER, fontWeight: 600 }}>{missing} line{missing === 1 ? "" : "s"} still in the film&apos;s own language. </Box>}
        {stale && <Box component="span" sx={{ color: AMBER, fontWeight: 600 }}>The film&apos;s own words changed since it was translated. </Box>}
      </Typography>
      <Button size="small" disabled={disabled || busy} onClick={onTranslate} sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Translate again</Button>
      <Button size="small" disabled={disabled || busy} onClick={onDrop} sx={{ ...btn, color: MUTED, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Take {code} out</Button>
    </Box>
  );
}
