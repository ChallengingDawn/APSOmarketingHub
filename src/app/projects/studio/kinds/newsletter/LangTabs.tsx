"use client";
// THE NEWSLETTER'S LANGUAGES AS TABS, OVER THE E-MAIL (cv16, 11.11.2026). The Page builder keeps every language as a tab of
// its own (SARCLA 11.11.2026, screenshot 32: "the other two languages are impossible to access"); the newsletter is sent
// per language, one HubSpot draft each - so each language is its own e-mail here too: a squared tab per language (its own
// first, the one open filled, a small square for its HubSpot draft: green up to date, amber changed since), "+ Language"
// translates the open e-mail into a language it has not (every part along), and a language's own x takes it out again.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { draftRows } from "@/lib/content/studio/kinds/newsletter/langs";
import { Label, PINK, btn } from "../../parts";

const DARK = "#15223a";

export function LangTabs({ langs, open, names, all, doc, busy, canEdit, width, onOpen, onAdd, onDrop }: {
  /** the languages the newsletter has, its own first */
  langs: string[]; open: string; names: Record<string, string>;
  /** every language a newsletter may be written in */
  all: string[];
  doc: unknown;
  /** the language being made now */
  busy: string | null;
  /** may translate (the AI on, nothing else being written) */
  canEdit: boolean;
  width: number;
  onOpen: (l: string) => void; onAdd: (l: string) => void; onDrop?: (l: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const drafts = useMemo(() => new Map(draftRows(doc, null).map((r) => [r.lang, r.state])), [doc]);
  const free = all.filter((l) => !langs.includes(l));
  const shown = busy && !langs.includes(busy) ? [...langs, busy] : langs;
  return (
    <Box sx={{ width, maxWidth: "100%", mx: "auto", mb: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", boxSizing: "border-box" }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Language</Typography>
      <Box role="tablist" aria-label="The newsletter's languages" sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.9)" }}>
        {shown.map((l, i) => {
          const on = l === open;
          const making = busy === l;
          const st = drafts.get(l);
          const tip = making ? `Translating into ${names[l] ?? l}…` : `${names[l] ?? l}${i === 0 ? " - the newsletter's own language" : ""}${st === "same" ? " · its HubSpot draft is up to date" : st === "changed" ? " · changed since its HubSpot draft" : ""}`;
          return (
            <Tooltip key={l} title={tip}>
              <Box component="button" type="button" role="tab" aria-selected={on} disabled={making && !langs.includes(l)} onClick={() => onOpen(l)} sx={{
                all: "unset", cursor: "pointer", position: "relative", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.45,
                fontSize: "0.8rem", fontWeight: 800, letterSpacing: ".02em", borderLeft: i ? `1px solid ${HAIRLINE}` : "none",
                color: on ? "#fff" : INK, bgcolor: on ? DARK : making ? "#fbeef4" : "transparent", transition: "background-color .12s",
                "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: -2 },
              }}>
                {l}
                {making && <CircularProgress size={10} sx={{ color: "#c22c6e" }} />}
                {!making && st && st !== "none" && <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: "1.5px", bgcolor: st === "same" ? "#1b7a55" : "#d08a00" }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {onDrop && open !== langs[0] && langs.includes(open) && (
        <Tooltip title={`Take the ${names[open] ?? open} e-mail out`}>
          <IconButton size="small" aria-label={`Take the ${names[open] ?? open} e-mail out`} onClick={() => onDrop(open)} sx={{ p: 0.4, color: MUTED, "&:hover": { color: "#c5221f" } }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
        </Tooltip>
      )}
      {free.length > 0 && (
        <Button size="small" disabled={!canEdit || !!busy} startIcon={<AddIcon sx={{ fontSize: "15px !important" }} />} onClick={(e) => setMenu(e.currentTarget)} aria-haspopup="menu"
          sx={{ ...btn, minWidth: 0, px: 0.75, height: 26, fontSize: "0.76rem", color: "#2459d1", borderRadius: "5px", "& .MuiButton-startIcon": { mr: 0.4 } }}>Language</Button>
      )}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 260 } } }}>
        <Typography sx={{ px: 2, pt: 0.5, pb: 0.75, fontSize: "0.74rem", color: MUTED, lineHeight: 1.4, maxWidth: 280 }}>
          The {names[open] ?? open} e-mail translated - every part, the shop&apos;s facts and our footer in the new language, its own HubSpot draft. This one stays.
        </Typography>
        {free.map((l) => (
          <MenuItem key={l} onClick={() => { setMenu(null); onAdd(l); }} sx={{ fontSize: "0.86rem", gap: 1 }}>
            <Box component="span" sx={{ fontWeight: 800, width: 26 }}>{l}</Box>{names[l] ?? l}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

/** "Translate this e-mail into" in the assistant (the blog's squared row, with the newsletter's words): a language not
 * made yet becomes a tab of its own; one made (ticked) is made again from the e-mail open - the e-mail open stays. */
export function TranslateInto({ langs, made, open, names, busy, disabled, onPick }: {
  langs: readonly string[]; made: string[]; open: string; names: Record<string, string>; busy: string | null; disabled: boolean; onPick: (l: string) => void;
}) {
  return (
    <Box>
      <Label mt={0}>Translate this e-mail into</Label>
      <Box role="group" aria-label="Translate this e-mail" sx={{ display: "flex" }}>
        {langs.map((l, i) => {
          const now = l === open;
          const done = !now && made.includes(l);
          const tip = now ? `This is the ${names[l] ?? l} e-mail` : busy === l ? `Translating into ${names[l] ?? l}…` : done ? `The ${names[l] ?? l} e-mail is made - a click makes it again from this one` : `Make the ${names[l] ?? l} e-mail from this one`;
          return (
            <Tooltip key={l} title={tip}>
              <Box component="span" sx={{ flex: 1, minWidth: 0, ml: i ? "-1px" : 0, display: "flex" }}>
                <Box component="button" type="button" disabled={disabled || now || !!busy} onClick={() => onPick(l)} aria-label={tip} sx={{
                  all: "unset", boxSizing: "border-box", flex: 1, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 0.4,
                  border: `1px solid ${now ? DARK : HAIRLINE}`, bgcolor: now ? DARK : busy === l ? "#fbeef4" : "#fff", color: now ? "#fff" : INK,
                  fontSize: "0.8rem", fontWeight: 700, cursor: now || busy || disabled ? "default" : "pointer", opacity: disabled && !now ? 0.5 : 1, position: "relative", zIndex: now ? 1 : 0,
                  "&:hover": now || busy || disabled ? {} : { borderColor: PINK, color: PINK, zIndex: 2 }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1, zIndex: 3 },
                }}>
                  {l}
                  {done && busy !== l && <CheckIcon sx={{ fontSize: 13, color: "#1b7a55" }} />}
                  {busy === l && <CircularProgress size={11} sx={{ color: PINK }} />}
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
        {busy ? `Translating into ${names[busy] ?? busy} - every part, the shop's facts and our footer in it.` : `Each language is an e-mail of its own, a tab over the e-mail, with its own HubSpot draft - this ${names[open] ?? open} one stays as it is.`}
      </Typography>
    </Box>
  );
}
