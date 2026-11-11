"use client";
// THE POST'S LANGUAGES AS TABS, OVER THE PAGE (cv17, 12.11.2026 - the newsletter's LangTabs and the social studio's
// Langs, with the blog's words). A squared tab per language (the post's own first, the one open filled, a small green
// square once its pages were found on the shop), "+ Language" translates the post open into a language it has not - every
// part along, its links in that language's store view, the pictures the same - and the open tab's x takes it out again
// (never the post's own language).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { btn } from "../../parts";

const DARK = "#15223a";

export function PostLangTabs({ langs, open, names, all, live, stores, busy, canAdd, onOpen, onAdd, onDrop }: {
  /** the languages the post has, its own first */
  langs: string[]; open: string; names: Record<string, string>;
  /** every language a post may be written in */
  all: string[];
  /** the languages whose pages were found on the shop */
  live: string[];
  /** each language's store view */
  stores: Record<string, string>;
  /** the language being made now */
  busy: string | null;
  /** may translate (the AI on, nothing else being written) */
  canAdd: boolean;
  onOpen: (l: string) => void; onAdd: (l: string) => void; onDrop?: (l: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const free = all.filter((l) => !langs.includes(l));
  const shown = busy && !langs.includes(busy) ? [...langs, busy] : langs;
  return (
    <Box sx={{ mb: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Language</Typography>
      <Box role="tablist" aria-label="The post's languages" sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.9)" }}>
        {shown.map((l, i) => {
          const on = l === open;
          const making = busy === l;
          const isLive = live.includes(l);
          const tip = making ? `Translating into ${names[l] ?? l}…`
            : `${names[l] ?? l}${i === 0 ? " - the post's own language" : ""}${stores[l] ? ` · ${stores[l]}` : ""}${isLive ? " · its pages are on the shop" : ""}`;
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
                {!making && isLive && <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: "1.5px", bgcolor: "#1b7a55" }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {onDrop && open !== langs[0] && langs.includes(open) && (
        <Tooltip title={`Take the ${names[open] ?? open} post out`}>
          <IconButton size="small" aria-label={`Take the ${names[open] ?? open} post out`} onClick={() => onDrop(open)} sx={{ p: 0.4, color: MUTED, "&:hover": { color: "#c5221f" } }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
        </Tooltip>
      )}
      {free.length > 0 && (
        <Button size="small" disabled={!canAdd || !!busy} startIcon={<AddIcon sx={{ fontSize: "15px !important" }} />} onClick={(e) => setMenu(e.currentTarget)} aria-haspopup="menu"
          sx={{ ...btn, minWidth: 0, px: 0.75, height: 26, fontSize: "0.76rem", color: "#2459d1", borderRadius: "5px", "& .MuiButton-startIcon": { mr: 0.4 } }}>Language</Button>
      )}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 260 } } }}>
        <Typography sx={{ px: 2, pt: 0.5, pb: 0.75, fontSize: "0.74rem", color: MUTED, lineHeight: 1.4, maxWidth: 290 }}>
          The {names[open] ?? open} post translated into a tab of its own - every part: the text, the questions, the pictures&apos; words, the author&apos;s role, the band to the shop; its links and products in its store view. The same pictures. This one stays.
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
