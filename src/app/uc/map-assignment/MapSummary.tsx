"use client";

// MAP ASSIGNMENT - the summary over the map, bottom left (SARCLA 06.11.2026: "ajouter la valeur à chaque fois en
// résumé - si tu as TSA et ESO, quel est le revenue ou quel est le potentiel"). For the layer on screen, the country's
// figure, then ESO and TSA, then each person under their team - by the person the rules give each company (the
// engine's LayerData.load, every company of the country, with or without a postcode). Owners and Top customers show
// companies, revenue and potential side by side; a value layer shows its own figure and each one's share.
// A click on a person picks out their land on the map (as the chips it replaces did).

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { compact as short, full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { teamOf } from "@/lib/datatracker/rosters";
import type { OwnerLoad } from "@/lib/mapAssign/api";
import { Swatch, countryName, type Names, type Palette } from "./shared";
import type { LayerKey, Priority } from "./mapModel";
import { gdpText } from "./SidePanel";

type Col = { head: string; of: (l: OwnerLoad) => number; fmt: (n: number) => string };
type Team = "ESO" | "TSA" | "other";
const TEAMS: { key: Team; label: string }[] = [
  { key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" }, { key: "other", label: "Not on the ESO / TSA lists" },
];
const OPEN_KEY = "apsomh:map-assignment:summary";

const pot = (l: OwnerLoad) => Number(l.potential) || 0;
function colsOf(layer: LayerKey, prio: Priority): Col[] {
  const companies: Col = { head: "Companies", of: (l) => l.after, fmt: full };
  const revenue: Col = { head: "Revenue", of: (l) => l.revenue, fmt: short };
  const potential: Col = { head: "Potential", of: pot, fmt: short };
  if (layer === "owners" || layer === "top") return [companies, revenue, potential];
  if (layer === "revenue") return [revenue];
  if (layer === "potential") return [potential];
  if (layer === "customers") return [{ head: "Customers", of: (l) => l.customers, fmt: full }];
  if (layer === "newCustomers") return [{ head: "New customers", of: (l) => l.newCustomers, fmt: full }];
  if (layer === "priority") return [{ head: `${prio} companies`, of: (l) => Number(l.priority?.[prio]) || 0, fmt: full }];
  return [];
}
const title: Record<LayerKey, string> = {
  owners: "Companies, revenue and potential", top: "Companies, revenue and potential", revenue: "Revenue this year", potential: "Yearly customer potential",
  customers: "Customers this year", newCustomers: "New customers this year", priority: "Sales priority", gdp: "GDP",
};

export function MapSummary({ cc, place, note, layer, prio, load, onMap = [], gdp, names, palette, hl, setHl, maxHeight, narrow }: {
  cc: string; layer: LayerKey; prio: Priority;
  /** the name in the title, the GDP line and the note - else the country's (Europe: "Europe · ESO") */
  place?: string;
  /** the line at the end, instead of "every company of {country}" */
  note?: string;
  /** the engine's figures per person (null = not read yet, or an older hub) */
  load: OwnerLoad[] | null;
  /** the people holding postcodes on the map: listed on Owners / Top customers even without a company, so every colour
   *  on the map is named */
  onMap?: string[];
  /** the country's GDP (sum of its regions), for the GDP layer */
  gdp: number | null;
  names: Names; palette: Palette;
  hl: string | null; setHl: (o: string | null) => void;
  maxHeight: number;
  /** a phone: starts folded */
  narrow: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { const v = window.localStorage.getItem(OPEN_KEY); setOpen(v === null ? !narrow : v === "1"); } catch { setOpen(!narrow); }
  }, [narrow]);
  const flip = () => setOpen((o) => { try { window.localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* no storage */ } return !o; });

  const cols = useMemo(() => colsOf(layer, prio), [layer, prio]);
  const one = cols.length === 1;
  const pick = layer === "owners" || layer === "top";
  const groups = useMemo(() => {
    const rows = (load ?? []).filter((l) => l.after > 0 || cols.some((c) => c.of(l) > 0));
    if (pick) {
      const have = new Set(rows.map((l) => String(l.owner)));
      for (const o of onMap) if (o && !have.has(o)) rows.push({ owner: o, now: 0, after: 0, customers: 0, newCustomers: 0, revenue: 0, contacts: 0, tickets: 0, sales: 0 });
    }
    return TEAMS.map((t) => {
      const people = rows.filter((l) => (teamOf(String(l.owner)) ?? "other") === t.key)
        .sort((a, b) => (cols[0] ? cols[0].of(b) - cols[0].of(a) : 0) || b.after - a.after || names.name(a.owner).localeCompare(names.name(b.owner)));
      return { ...t, people, sums: cols.map((c) => people.reduce((s, l) => s + c.of(l), 0)) };
    }).filter((g) => g.people.length);
  }, [load, cols, names, pick, onMap]);
  const totals = cols.map((_, i) => groups.reduce((s, g) => s + g.sums[i], 0));
  const share = (v: number) => (totals[0] > 0 ? `${Math.round((100 * v) / totals[0])}%` : "");

  const grid = { display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${cols.map(() => (one ? "76px" : "70px")).join(" ")}${one ? " 40px" : ""}`, columnGap: 1, alignItems: "center" };
  const numSx = { fontSize: "0.76rem", textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
  const noPotential = (layer === "potential" || pick) && !!load?.length && load.every((l) => l.potential === undefined || !pot(l));

  return (
    <Box sx={{
      bgcolor: "rgba(255,255,255,.96)", border: `1px solid ${HAIRLINE}`, borderRadius: "14px", boxShadow: "0 2px 10px rgba(31,45,78,.08)",
      width: { xs: "100%", sm: one ? 300 : 360 }, maxWidth: "100%", display: "flex", flexDirection: "column", maxHeight, overflow: "hidden",
    }}>
      <Box component="button" type="button" onClick={flip} aria-expanded={open}
        sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.75, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>{place ?? countryName(cc)} · {title[layer]}</Typography>
          {!open && cols.length > 0 && load && (
            <Typography sx={{ fontSize: "0.78rem", color: INK, fontVariantNumeric: "tabular-nums" }}>
              {groups.map((g) => `${g.key === "other" ? "Other" : g.label} ${cols[0].fmt(g.sums[0])}`).join(" · ")}
            </Typography>
          )}
        </Box>
        <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Box>
      {open && (
        <Box sx={{ overflowY: "auto", px: 1.25, pb: 1 }}>
          {layer === "gdp" ? (
            <Typography sx={{ fontSize: "0.8rem", color: INK }}>
              {place ?? countryName(cc)}: <b>{gdpText(gdp)}</b>
              <Box component="span" sx={{ display: "block", fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>GDP is known per region, not per person.</Box>
            </Typography>
          ) : !load ? (
            <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>The figures per person come with the engine&apos;s next read.</Typography>
          ) : (
            <>
              <Box sx={{ ...grid, pb: 0.4, borderBottom: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.7rem", color: FAINT }}>&nbsp;</Typography>
                {cols.map((c) => <Typography key={c.head} sx={{ ...numSx, fontSize: "0.7rem", color: FAINT }}>{c.head}</Typography>)}
                {one && <Typography sx={{ ...numSx, fontSize: "0.7rem", color: FAINT }}>share</Typography>}
              </Box>
              <Box sx={{ ...grid, py: 0.5 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK }}>Total</Typography>
                {totals.map((v, i) => <Typography key={i} sx={{ ...numSx, fontSize: "0.8rem", fontWeight: 700, color: INK }}>{cols[i].fmt(v)}</Typography>)}
                {one && <span />}
              </Box>
              {groups.map((g) => (
                <Box key={g.key} sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 0.4, pb: 0.2 }}>
                  <Box sx={{ ...grid, py: 0.2 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK }}>{g.label}</Typography>
                    {g.sums.map((v, i) => <Typography key={i} sx={{ ...numSx, fontWeight: 700, color: INK }}>{cols[i].fmt(v)}</Typography>)}
                    {one && <Typography sx={{ ...numSx, color: MUTED }}>{share(g.sums[0])}</Typography>}
                  </Box>
                  {g.people.map((l) => {
                    const o = String(l.owner);
                    const on = hl === o;
                    return (
                      <Box key={o} component={pick ? "button" : "div"} type={pick ? "button" : undefined} onClick={pick ? () => setHl(on ? null : o) : undefined} aria-pressed={pick ? on : undefined}
                        sx={{ all: pick ? "unset" : undefined, ...grid, boxSizing: "border-box", width: "100%", py: 0.25, pl: 1, borderRadius: "6px",
                          cursor: pick ? "pointer" : "default", opacity: hl && !on ? 0.5 : 1, bgcolor: on ? "rgba(36,89,209,.08)" : "transparent",
                          "&:hover": pick ? { bgcolor: "rgba(21,34,58,.05)" } : undefined, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                          <Swatch paint={palette(o)} size={10} />
                          <Typography noWrap sx={{ fontSize: "0.76rem", fontWeight: 600, color: INK }}>{names.name(o)}</Typography>
                        </Box>
                        {cols.map((c) => <Typography key={c.head} sx={{ ...numSx, color: INK }}>{c.fmt(c.of(l))}</Typography>)}
                        {one && <Typography sx={{ ...numSx, color: MUTED }}>{share(cols[0].of(l))}</Typography>}
                      </Box>
                    );
                  })}
                </Box>
              ))}
              <Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.6, lineHeight: 1.4 }}>
                {note ?? `Per person the rules give each company - every company of ${countryName(cc)}, with or without a postcode.`}
                {noPotential ? " No potential read yet: the engine's next full read of the companies brings it." : ""}
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
