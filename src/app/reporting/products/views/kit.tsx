"use client";
// THE PRODUCTS REPORTS' SMALL PARTS - Views against orders and Search (SARCLA 01.11.2026). Drawn as Articles CY/LY draws them
// (src/app/uc/articles/Articles.tsx, rebuilt the same day like the ESO Figures): the figures top right, a choice as a row of
// buttons (Customer KPIs' "Amount at least"), a level's values to pick in the Filters window - copied, not new.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import { Badge, FAINT, GREEN, INK, MUTED, RED, TINT, glass, type Tint } from "@/app/uc/report/ui";

/* ── words and numbers, in full ────────────────────────────────────────── */

export const int = (n: number) => Math.round(n).toLocaleString("en");
export const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
export const changeOf = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);
export const signedPct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`);
export const signedInt = (n: number) => `${Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en")}`;
/** green up, red down - the other way round where fewer is better */
export const tone = (x: number | null, lower = false) => (x == null || Math.abs(x) < 0.0005 ? FAINT : (x > 0) !== lower ? GREEN : RED);
/** "+1.2 pts" - a share's change */
export const points = (a: number | null, b: number | null) => {
  if (a == null || b == null) return "—";
  const d = Math.round((a - b) * 1000) / 10;
  return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} pts`;
};
export const plural = (n: number, one: string, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "3 Aug 2026" */
export const dayWords = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** A figure with its change under it, right-aligned - as the Figures' tables. */
export const withChangeCell = (text: string, a: number, b: number, lower = false) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {text}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: b ? tone(changeOf(a, b), lower) : a > 0 ? GREEN : FAINT }}>{b ? signedPct(changeOf(a, b)) : a > 0 ? "new" : "—"}</Box>
  </Box>
);
/** A share with its change in points under it. */
export const rateCell = (a: number | null, b: number | null) => (
  <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.25 }}>
    {pct(a)}
    <Box component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, color: a != null && b != null ? tone(a - b) : FAINT }}>{a != null && b != null ? points(a, b) : "—"}</Box>
  </Box>
);

/* ── the figures top right (as Articles CY/LY's) ───────────────────────── */

export type Fig = { label: string; value: string; ch?: number | null; sub: string; icon: React.ReactNode; tint: Tint; lower?: boolean };
export function FigureCards({ items }: { items: Fig[] }) {
  return (
    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${Math.min(3, items.length)}, minmax(124px, 172px))`, xl: `repeat(${items.length}, minmax(124px, 172px))` }, flex: "0 1 auto" }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...glass, borderRadius: "16px", px: 1.5, py: 1.1, minWidth: 0, display: "grid", gap: 0.25, alignContent: "start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Badge icon={it.icon} tint={it.tint} size={22} />
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: MUTED, lineHeight: 1.25 }}>{it.label}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.6, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, lineHeight: 1.25, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{it.value}</Typography>
            {it.ch !== undefined && <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(it.ch ?? null, it.lower) }}>{signedPct(it.ch ?? null)}</Typography>}
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.3 }}>{it.sub}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ── a choice in the Filters window: a row of buttons ──────────────────── */

export function Choices<T extends string>({ items, on, onPick }: { items: { id: T; label: string; title?: string }[]; on: T; onPick: (id: T) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
      {items.map((x) => {
        const sel = x.id === on;
        return (
          <Box key={x.id} component="button" type="button" onClick={() => onPick(x.id)} aria-pressed={sel} title={x.title}
            sx={{ height: 30, px: 1.4, borderRadius: "9px", font: "inherit", fontSize: "0.8rem", fontWeight: 650, cursor: "pointer", bgcolor: sel ? TINT.blue.fg : "#fff", color: sel ? "#fff" : INK,
              border: `1px solid ${sel ? TINT.blue.fg : "rgba(21,34,58,.16)"}`, "&:hover": sel ? {} : { borderColor: TINT.blue.fg, color: TINT.blue.fg } }}>
            {x.label}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── a level's values to pick (as Articles CY/LY's Facet) ──────────────── */

/** The values to pick - the largest first, a search past eight; each with its figure and a small bar. */
export function Facet({ rows, chosen, tint, find, onPick, fmt = int, unit }: {
  rows: { key: string; label: string; v: number }[]; chosen: string[]; tint: Tint; find: string; onPick: (key: string) => void; fmt?: (n: number) => string; unit: string;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const sel = new Set(chosen);
  const found = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
  const LIMIT = 8, MOST = 100;
  const shown = all || q ? found.slice(0, MOST) : [...found.slice(0, LIMIT), ...found.slice(LIMIT).filter((r) => sel.has(r.key))];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  const t = TINT[tint];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {rows.length > LIMIT && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, mb: 0.5, height: 32, borderRadius: "9px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.14)" }}>
          <SearchIcon sx={{ fontSize: 16, color: MUTED }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${find}…`} inputProps={{ "aria-label": `Find ${find} to filter` }} sx={{ fontSize: "0.8rem", flex: 1 }} />
        </Box>
      )}
      {!rows.length && <Typography sx={{ fontSize: "0.78rem", color: FAINT, px: 1 }}>Nothing to pick under the other filters.</Typography>}
      {shown.map((r) => {
        const on = sel.has(r.key);
        return (
          <Box key={r.key} component="button" type="button" onClick={() => onPick(r.key)} aria-pressed={on} title={`${r.label} - ${fmt(r.v)} ${unit}`}
            sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) 56px 76px", alignItems: "center", gap: 0.75, px: 1, py: 0.5, border: 0, borderRadius: "8px", font: "inherit", textAlign: "left", cursor: "pointer", bgcolor: on ? t.bg : "transparent", "&:hover": { bgcolor: on ? t.bg : "rgba(21,34,58,.04)" } }}>
            {on ? <CheckIcon sx={{ fontSize: 16, color: t.fg }} /> : <span />}
            <Typography noWrap sx={{ fontSize: "0.82rem", fontWeight: on ? 700 : 500, color: INK }}>{r.label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(21,34,58,.06)", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${(Math.max(0, r.v) / max) * 100}%`, bgcolor: t.fg, opacity: 0.6 }} /></Box>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.v)}</Typography>
          </Box>
        );
      })}
      {(all || q) && found.length > MOST && <Typography sx={{ fontSize: "0.74rem", color: FAINT, px: 1 }}>The first {MOST} of {int(found.length)} - type more of the name to find the others.</Typography>}
      {!q && found.length > LIMIT && <Button size="small" onClick={() => setAll((x) => !x)} sx={{ textTransform: "none", fontWeight: 600, justifySelf: "start" }}>{all ? `Show the first ${LIMIT}` : `Show all ${int(found.length)}`}</Button>}
    </Box>
  );
}

/** A cell that may run long: one line, the rest on hover. */
export const textCell = (v: string, faint = false) => <Typography noWrap title={v} sx={{ fontSize: "0.82rem", color: faint ? FAINT : INK }}>{v}</Typography>;
