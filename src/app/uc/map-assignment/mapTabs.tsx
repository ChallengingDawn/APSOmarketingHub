"use client";

// MAP ASSIGNMENT - the map's pill groups in the look of the page's view switcher (ReportTabs, src/app/uc/report/
// Tabs.tsx - SARCLA 19.10.2026: "these tab background and style should be the top one"): the countries above the map
// and the layer switch inside it. Arrow keys move between the pills.

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { full } from "@/app/charts/format";
import { INK, MUTED, glass } from "@/app/uc/report/ui";

const ON = "#2459d1";
const ON_BG = "#e6edfd";

/** The group: the top bar's glass pill row. */
const groupSx = (small: boolean) => ({
  ...glass, display: "inline-flex", flexWrap: "wrap", gap: 0.5, p: small ? 0.45 : 0.6, borderRadius: small ? "14px" : "16px",
  boxShadow: "0 1px 2px rgba(31,45,78,.04)", maxWidth: "100%",
});
/** One pill: the top bar's tab. */
const pillSx = (on: boolean, small: boolean, disabled = false) => ({
  display: "flex", alignItems: "center", gap: 0.85, px: small ? 1.25 : 1.75, py: small ? 0.6 : 0.9, borderRadius: small ? "10px" : "12px",
  cursor: disabled ? "default" : "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const,
  fontSize: small ? "0.8rem" : "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
  color: on ? ON : disabled ? "rgba(93,107,133,.45)" : MUTED,
  bgcolor: on ? ON_BG : "transparent",
  transition: "background-color .12s, color .12s",
  "&:hover": disabled ? {} : { color: on ? ON : INK, bgcolor: on ? ON_BG : "rgba(255,255,255,0.75)" },
  "&:focus-visible": { outline: `2px solid ${ON}`, outlineOffset: 1 },
});
const countSx = (on: boolean) => ({
  fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, px: 0.75, py: 0.4, borderRadius: "7px",
  bgcolor: on ? "#ffffff" : "rgba(21,34,58,.06)", color: on ? ON : MUTED,
});

export type PillDef<K extends string> = { key: K; label: string; count?: string | null; disabled?: boolean; hint?: string };

/** A pill group in the top bar's look; `small` for one inside a card. */
export function PillGroup<K extends string>({ name, value, onChange, options, small = false }: {
  name: string; value: K; onChange: (k: K) => void; options: PillDef<K>[]; small?: boolean;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const move = (from: number, step: number) => {
    for (let n = 1; n <= options.length; n++) {
      const i = (from + step * n + options.length * n) % options.length;
      if (!options[i].disabled) { onChange(options[i].key); refs.current[i]?.focus(); return; }
    }
  };
  return (
    <Box role="tablist" aria-label={name} sx={groupSx(small)}>
      {options.map((o, i) => {
        const on = o.key === value;
        const pill = (
          <Box key={o.key} ref={(el: HTMLDivElement | null) => { refs.current[i] = el; }} role="tab" aria-selected={on} aria-disabled={o.disabled || undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => { if (!o.disabled) onChange(o.key); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(i, 1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); move(i, -1); }
              if ((e.key === "Enter" || e.key === " ") && !o.disabled) { e.preventDefault(); onChange(o.key); }
            }}
            sx={pillSx(on, small, o.disabled)}>
            {o.label}
            {o.count !== undefined && o.count !== null && <Typography component="span" sx={countSx(on)}>{o.count}</Typography>}
          </Box>
        );
        return o.hint ? <Tooltip key={o.key} title={o.hint}>{pill}</Tooltip> : pill;
      })}
    </Box>
  );
}

/** The countries: the biggest nine as tabs, the others behind "more" (the one picked from there shows as a tab). */
export function CountryTabs({ list, cc, onPick, label }: {
  list: { cc: string; companies: number }[]; cc: string; onPick: (cc: string) => void; label: (cc: string) => string;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const top = list.slice(0, 9);
  const rest = list.slice(9);
  const shown = rest.some((r) => r.cc === cc) ? [...top, rest.find((r) => r.cc === cc)!] : top;
  const others = rest.filter((r) => r.cc !== cc);
  const options: PillDef<string>[] = shown.map((c) => ({ key: c.cc, label: label(c.cc), count: full(c.companies) }));
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", minWidth: 0 }}>
      <PillGroup name="Countries" value={cc} onChange={onPick} options={options} />
      {others.length > 0 && (
        <>
          <Box component="button" type="button" onClick={(e: React.MouseEvent<HTMLElement>) => setMenu(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!menu}
            sx={{ all: "unset", ...groupSx(false), p: 0.6 }}>
            <Box sx={{ ...pillSx(false, false), pr: 1.1 }}>{`${others.length} more`}<ExpandMoreIcon sx={{ fontSize: 18, ml: -0.5 }} /></Box>
          </Box>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { maxHeight: 360, borderRadius: "12px" } } }}>
            {others.map((c) => (
              <MenuItem key={c.cc} onClick={() => { setMenu(null); onPick(c.cc); }} sx={{ fontSize: "0.85rem", gap: 1.5, justifyContent: "space-between" }}>
                <span>{label(c.cc)}</span><Typography component="span" sx={{ fontSize: "0.75rem", color: MUTED }}>{full(c.companies)}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}

/** The country as one button over the map (SARCLA 20.10.2026: "only the map"): a click lists every country, biggest first. */
export function CountryMenu({ list, cc, onPick, label }: {
  list: { cc: string; companies: number }[]; cc: string; onPick: (cc: string) => void; label: (cc: string) => string;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const here = list.find((c) => c.cc === cc);
  return (
    <>
      <Box component="button" type="button" onClick={(e: React.MouseEvent<HTMLElement>) => setMenu(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!menu}
        aria-label={`Country: ${label(cc)} - change`}
        sx={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.85, px: 1.5, py: 0.75, borderRadius: "12px",
          bgcolor: "rgba(255,255,255,.96)", border: "1px solid rgba(21,34,58,.1)", boxShadow: "0 2px 10px rgba(31,45,78,.08)",
          fontSize: "0.95rem", fontWeight: 700, color: INK, letterSpacing: "-0.01em", "&:hover": { bgcolor: "#fff" }, "&:focus-visible": { outline: `2px solid ${ON}`, outlineOffset: 1 },
        }}>
        {label(cc)}
        {here && <Typography component="span" sx={countSx(false)}>{full(here.companies)}</Typography>}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, ml: -0.25 }} />
      </Box>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { maxHeight: 420, borderRadius: "12px", minWidth: 220 } } }}>
        {list.map((c) => (
          <MenuItem key={c.cc} selected={c.cc === cc} onClick={() => { setMenu(null); onPick(c.cc); }} sx={{ fontSize: "0.86rem", gap: 1.5, justifyContent: "space-between" }}>
            <span>{label(c.cc)}</span><Typography component="span" sx={{ fontSize: "0.75rem", color: MUTED }}>{full(c.companies)}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
