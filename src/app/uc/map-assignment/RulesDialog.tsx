"use client";

// MAP ASSIGNMENT - the rules, in a big window. SARCLA 20.10.2026: "menus are still really complicated - open a big popup
// with tabs to separate the jobs, and in order to steer"; then "still too confusing: I want to see per country rule 1 -
// columns SAE Performis -> Region responsibility -> Company owner -> Contact owner -> Override, inline owner per column;
// the override column replaces the person of an SAE for that country (redirection); then the same per zip code as rule
// 2, with the list of zip codes at the end (also selectable on the map) - new contacts often go through the zip one;
// problems and stuff should not be on this first window; a toggle KPI shows what we see today. Build this one, then the
// other tabs." So:
//   Rules       rule 1 (each SAE of the country: the three properties it fills, the person, an override) and rule 2
//               (each postcode zone the same way, its postcodes at the end; and where a postcode in no zone goes);
//               the KPI toggle turns the same rows into figures: companies, contacts, owner now -> after
//   Key accounts, Who works {country}, SAE table (every country) - the other jobs, one tab each
// Every edit is the page's draft (the map behind recolours at once); Save here or on the page's bar keeps it.
// 24.10.2026 (SARCLA): "a Sandbox / Live toggle ... always the comparing KPIs, to measure the result with one ESO less, the
// km², the money, everything" - in the sandbox the KPI view shows each figure with its difference to live; "the split of
// PRIO and APSOcustomer" - a table of each person's companies by sales priority and APSO customer, live and sandbox.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type Zone } from "@/lib/mapAssign/rules";
import type { CompanyRow, LayerData, MapData, OwnerLoad, TicketLoad } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, PeoplePicker, Swatch, canon, countryList, countryName, emptyRule, hsCompany, newId, placeOverride, prefixProblem, saeTarget, saeTargetAt, splitPrefixes, takesOver, withPlaceOverride,
  splitRegions, withOverride, type Names, type Palette, type SetDraft,
} from "./shared";
import { CountryMenu, PillGroup } from "./mapTabs";
import { OwnerTable, RuleTag, km2Text, nowAfter } from "./SidePanel";
import { useLayers, type CountryMap } from "./MapPanel";
import { joinLayer } from "./mapModel";
import { usePerformis, type Got } from "./SaeTableView";

type Tab = "rules" | "keys" | "people";

/** A place clicked on the map (SARCLA 20.10.2026: "when you click it should default to rules"): the Rules window shows only
 *  it - its SAEs and its zip zones - and can swap all of its zip codes to someone (the map's own give). */
export type Place = {
  kind: "region" | "cell"; index: number; title: string; sub: string;
  /** give all of the place's zip codes to this person (rule 2) - the map's give, in the draft */
  give: (owner: string) => void;
  /** give some zip codes to this person (one zip code of the place: SARCLA "cannot change an individual zip code") */
  giveZips: (zips: string[], owner: string, what: string) => void;
};
export type Mode = "rules" | "kpi";
/** The sandbox against live (SARCLA 24.10.2026): the sandbox's version (its layers) and the live rules on the map. */
export type Compare = { sandbox: string | null; live: { m: CountryMap; rules: AssignRules } };
const hint = { fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 };
const head = { fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const row = { display: "grid", gap: 1.25, alignItems: "center", px: 1.25, py: 0.9, borderBottom: `1px solid ${HAIRLINE}` };
const numSx = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: { xs: "left", md: "right" } as const };

/* ── the SAE values (GET ?performis=1) ── */

/* ── the switch, the workload, the place's shape ── */

/** Rules or KPI - big enough to see (SARCLA 20.10.2026: "the toggle is still not visible enough"). */
function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const btn = (m: Mode, label: string, icon: React.ReactNode, color: string) => {
    const on = mode === m;
    return (
      <Box component="button" type="button" onClick={() => setMode(m)} aria-pressed={on}
        sx={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, px: 2, py: 0.9, fontSize: "0.92rem", fontWeight: 700,
          color: on ? "#fff" : color, bgcolor: on ? color : "transparent", transition: "background-color .12s",
          "&:hover": { bgcolor: on ? color : "rgba(21,34,58,.05)" }, "&:focus-visible": { outline: `2px solid ${color}`, outlineOffset: -2 },
        }}>
        {icon}{label}
      </Box>
    );
  };
  return (
    <Box role="group" aria-label="Rules or KPI" sx={{ display: "inline-flex", border: "1px solid rgba(21,34,58,.16)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 4px rgba(31,45,78,.08)" }}>
      {btn("rules", "Rules", <TuneOutlinedIcon sx={{ fontSize: 19 }} />, "#2459d1")}
      {btn("kpi", "KPI", <InsightsOutlinedIcon sx={{ fontSize: 19 }} />, "#6250d6")}
    </Box>
  );
}

/** Each person's share of the regions' GDP: a region's GDP split by its postcodes per person. */
function gdpByOwner(m: CountryMap, joined: ReturnType<typeof joinLayer> | null): Map<string, number> {
  const gdp = new Map<string, number>();
  if (joined) m.tally.regions.forEach((rt, i) => {
    const g = joined.gdp[i];
    if (g === null || g === undefined || !rt.total) return;
    for (const [o, n] of rt.owners) gdp.set(String(o), (gdp.get(String(o)) ?? 0) + (g * n) / rt.total);
  });
  return gdp;
}

/** The sandbox against live, under a figure: "+12" / "−3" (nothing when the same). Neutral colours - more for one person
 *  is less for another. */
function Delta({ now, was, fmt = (v) => full(Math.round(v)) }: { now: number; was: number | null | undefined; fmt?: (v: number) => string }) {
  const d = now - (was ?? 0);
  if (!Number.isFinite(d) || Math.abs(d) < 0.5) return null;
  return <Typography component="span" sx={{ display: "block", fontSize: "0.7rem", fontWeight: 700, lineHeight: 1.2, color: d > 0 ? "#5b45c9" : "#a96a12" }}>{d > 0 ? "+" : "−"}{fmt(Math.abs(d))}</Typography>;
}

/** Live's figures, for the sandbox's KPIs to compare with. */
type Vs = { load: OwnerLoad[]; m: CountryMap; joined: ReturnType<typeof joinLayer> | null } | null;

/** The sales workload per person: companies now -> after, customers and revenue this year, contacts, tickets, and the
 *  land rule 2 gives them (zip codes, km², the GDP of their part of each region). `vs`: the sandbox - each figure with
 *  its difference to live. */
function WorkloadTable({ c, load, tickets, m, joined, names, palette, vs, rules }: {
  c: string; load: OwnerLoad[]; tickets: TicketLoad | null; m: CountryMap; joined: ReturnType<typeof joinLayer> | null; names: Names; palette: Palette; vs?: Vs;
  rules: AssignRules;
}) {
  const land = m.tally.byOwner;
  // the companies here whose Performis SAE names each person (the SAE table) - listed even when the rules give them none,
  // so a wrong SAE shows (SARCLA 25.10.2026: "or SAE - if the SAE is wrong they should still be listed")
  const named = new Map<string, number>();
  for (const [sae, n] of Object.entries(joined?.total.sae ?? {})) {
    if (!sae || !n) continue;
    const k = saeKey(sae);
    const hit = Object.entries(rules.sae).find(([x]) => saeKey(x) === k);
    if (hit) named.set(String(hit[1]), (named.get(String(hit[1])) ?? 0) + n);
  }
  const gdp = gdpByOwner(m, joined);
  const vsLand = vs ? vs.m.tally.byOwner : null;
  const vsGdp = vs ? gdpByOwner(vs.m, vs.joined) : null;
  const vsBy = new Map((vs?.load ?? []).map((l) => [String(l.owner), l]));
  const people = [...new Set([...load.map((l) => String(l.owner)), ...[...land.keys()].filter(Boolean).map(String), ...named.keys(), ...(vs ? [...vsBy.keys(), ...[...vsLand!.keys()].filter(Boolean).map(String)] : [])])];
  const byOwner = new Map(load.map((l) => [String(l.owner), l]));
  // someone with no company and no zip code in this country by these rules (and none in the sandbox's other side) is left
  // out (SARCLA 25.10.2026: "what am I doing in Italy if I have no companies or contacts")
  const rows = people.map((o) => ({ o, l: byOwner.get(o), t: tickets?.byOwner[o], z: land.get(o), v: vsBy.get(o), vz: vsLand?.get(o) }))
    .filter((r) => (r.l?.after ?? 0) > 0 || (r.z?.postcodes ?? 0) > 0 || (r.v?.after ?? 0) > 0 || (r.vz?.postcodes ?? 0) > 0 || (named.get(r.o) ?? 0) > 0)
    .sort((a, b) => (b.l?.after ?? 0) - (a.l?.after ?? 0) || (b.z?.postcodes ?? 0) - (a.z?.postcodes ?? 0) || (b.v?.after ?? 0) - (a.v?.after ?? 0));
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  // "Sales open" per country: the open ESO + TSA tickets on the companies these rules give each person here (an older hub:
  // the person's open tickets in every country)
  const perCountry = load.some((l) => l.salesOpen !== undefined);
  const cols = "minmax(170px, 1.4fr) 90px 90px 90px 90px 110px 90px 90px 90px 90px 80px 90px 100px";
  const num = (v: number | null | undefined, opts?: { money?: boolean; km?: boolean; gdp?: boolean }) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    if (opts?.gdp) return v >= 1000 ? `${(v / 1000).toFixed(1)} bn` : `${full(Math.round(v))} m`;
    if (opts?.km) return km2Text(v).replace(" km²", "");
    return full(Math.round(v));
  };
  const cell = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right" as const, whiteSpace: "nowrap" as const };
  const group = (label: string, span: number, color: string) => (
    <Box sx={{ gridColumn: `span ${span}`, borderBottom: `2px solid ${color}`, pb: 0.25, textAlign: "center" }}><Typography sx={{ ...head, color }}>{label}</Typography></Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Sales workload in {c}{vs ? " - the sandbox, and how it differs from live" : ""}</Typography>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflowX: "auto" }}>
        <Box sx={{ minWidth: 1180 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 1.25, px: 1.25, pt: 1, bgcolor: "rgba(21,34,58,.03)" }}>
            <span />
            {group("Customers", 5, "#1b7a55")}
            <Box sx={{ gridColumn: "span 1" }} />
            {group("Tickets - last 90 days", 3, "#a96a12")}
            {group("Land - rule 2", 3, "#6250d6")}
          </Box>
          <Box sx={{ ...row, gridTemplateColumns: cols, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
            {["Person", "Companies", "Named by Performis", "Bought this year", "New this year", "Revenue EUR", "Contacts", "All", "Sales", "Sales open", "Zip codes", "km²", "GDP EUR"].map((h, i) => (
              <Typography key={h} sx={{ ...head, textAlign: i ? "right" : "left" }}>{h}</Typography>
            ))}
          </Box>
          {rows.map(({ o, l, t, z, v, vz }) => {
            // a figure, and in the sandbox its difference to live under it
            const fig = (now: number | null | undefined, was: number | null | undefined, opts?: { money?: boolean; km?: boolean; gdp?: boolean }, bold?: boolean) => (
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ ...cell, fontWeight: bold ? 700 : 400 }}>{num(now, opts)}</Typography>
                {vs && <Delta now={now ?? 0} was={was} fmt={(x) => num(x, opts)} />}
              </Box>
            );
            return (
              <Box key={o} sx={{ ...row, gridTemplateColumns: cols, py: 0.65 }}>
                <Who owner={o} names={names} palette={palette} />
                {fig(l?.after ?? (vs ? 0 : null), v?.after, undefined, true)}
                <Typography sx={{ ...cell, color: (named.get(o) ?? 0) !== (l?.after ?? 0) ? "#a96a12" : MUTED }} title="companies here whose Performis SAE names this person">{named.has(o) ? num(named.get(o)) : "—"}</Typography>
                {fig(l?.customers ?? (vs ? 0 : null), v?.customers)}
                {fig(l?.newCustomers ?? (vs ? 0 : null), v?.newCustomers)}
                {fig(l?.revenue ?? (vs ? 0 : null), v?.revenue)}
                {fig(l?.contacts ?? (vs ? 0 : null), v?.contacts)}
                {fig(l?.tickets ?? (vs ? 0 : null), v?.tickets)}
                {fig(l?.sales ?? (vs ? 0 : null), v?.sales, undefined, !!l?.sales)}
                {perCountry ? fig(l?.salesOpen ?? (vs ? 0 : null), v?.salesOpen) : <Typography sx={cell}>{tickets ? num(t?.open ?? 0) : "…"}</Typography>}
                {fig(z?.postcodes ?? (vs ? 0 : null), vz?.postcodes)}
                {fig(z?.km2 ?? (vs ? 0 : null), vz?.km2, { km: true })}
                {gdp.has(o) || vsGdp?.has(o) ? fig(gdp.get(o) ?? 0, vsGdp?.get(o), { gdp: true }) : <Typography sx={cell}>—</Typography>}
              </Box>
            );
          })}
          <Box sx={{ ...row, gridTemplateColumns: cols, py: 0.65, borderBottom: "none", bgcolor: "rgba(21,34,58,.02)" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED }}>{c}</Typography>
            <Typography sx={{ ...cell, fontWeight: 700 }}>{num(sum((r) => r.l?.after ?? 0))}</Typography>
            <Typography sx={{ ...cell, color: MUTED }}>{num(sum((r) => named.get(r.o) ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.customers ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.newCustomers ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.revenue ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.contacts ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.tickets ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.l?.sales ?? 0))}</Typography>
            {perCountry ? <Typography sx={cell}>{num(sum((r) => r.l?.salesOpen ?? 0))}</Typography> : <span />}
            <Typography sx={cell}>{num(sum((r) => r.z?.postcodes ?? 0))}</Typography>
            <Typography sx={cell}>{num(sum((r) => r.z?.km2 ?? 0), { km: true })}</Typography>
            <Typography sx={cell}>{gdp.size ? num([...gdp.values()].reduce((a, v) => a + v, 0), { gdp: true }) : "—"}</Typography>
          </Box>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>
        {vs ? "Under each figure: the sandbox minus live. " : ""}Each person&apos;s companies by these rules: how many bought this year, how many are new this year (first order), their revenue this year and contacts; the tickets of the last 90 days on these companies - every pipeline, and the sales ones (ESO + TSA); sales open = the open ESO + TSA tickets on these companies{perCountry ? ` in ${c}` : ", every country"}{tickets ? ` (counted ${new Date(tickets.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})` : " - counted within the hour"}. Named by Performis: the companies here whose Performis SAE names the person (amber when the rules give another number). Someone with no company, no zip code and no SAE here is not listed. Land: the zip codes rule 2 gives each person, their km² and their share of each region&apos;s GDP.
      </Typography>
    </Box>
  );
}

/** sales_priority as the KPIs name it (priorityKey: P1..P4, "" = none). */
const PRIO_COLS: [string, string][] = [["P1", "Prio 1"], ["P2", "Prio 2"], ["P3", "Prio 3"], ["P4", "No prio"], ["", "none"]];
const CATEGORY_ORDER = ["APSOcore", "APSOgrowth", "APSOprospect", "APSOmicro", "APSOlost", "Growth Engine Customer", ""];
const categoryLabel = (k: string) => (k === "" ? "none" : k === "Growth Engine Customer" ? "Growth Engine" : k);

/** Each person's companies by sales priority and by APSO customer (SARCLA 24.10.2026: "on the KPI map put also the split
 *  per country of PRIO and APSOcustomer"); in the sandbox each with its difference to live. */
function SplitTable({ c, load, names, palette, vs }: { c: string; load: OwnerLoad[]; names: Names; palette: Palette; vs?: Vs }) {
  const vsBy = new Map((vs?.load ?? []).map((l) => [String(l.owner), l]));
  const people = [...new Set([...load.map((l) => String(l.owner)), ...vsBy.keys()])];
  const byOwner = new Map(load.map((l) => [String(l.owner), l]));
  const rows = people.map((o) => ({ o, l: byOwner.get(o), v: vsBy.get(o) })).filter((r) => (r.l?.after ?? 0) + (r.v?.after ?? 0) > 0)
    .sort((a, b) => (b.l?.after ?? 0) - (a.l?.after ?? 0));
  const seen = new Set<string>();
  for (const l of [...load, ...(vs?.load ?? [])]) for (const k of Object.keys(l.category ?? {})) seen.add(k);
  const cats = [...CATEGORY_ORDER.filter((k) => seen.has(k) || k === ""), ...[...seen].filter((k) => !CATEGORY_ORDER.includes(k)).sort()];
  const known = load.some((l) => Object.keys(l.category ?? {}).some((k) => k));
  if (!load.some((l) => l.priority)) return null; // an older hub
  const cols = `minmax(170px, 1.4fr) repeat(${PRIO_COLS.length + cats.length}, minmax(76px, 1fr))`;
  const cell = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right" as const, whiteSpace: "nowrap" as const };
  const fig = (now: number, was: number | undefined) => (
    <Box sx={{ textAlign: "right" }}>
      <Typography sx={{ ...cell, color: now ? INK : FAINT }}>{now ? full(now) : "—"}</Typography>
      {vs && <Delta now={now} was={was ?? 0} />}
    </Box>
  );
  const total = (f: (l: OwnerLoad) => number) => load.reduce((a, l) => a + f(l), 0);
  const group = (label: string, span: number, color: string) => (
    <Box sx={{ gridColumn: `span ${span}`, borderBottom: `2px solid ${color}`, pb: 0.25, textAlign: "center" }}><Typography sx={{ ...head, color }}>{label}</Typography></Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Companies by sales priority and APSO customer in {c}</Typography>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflowX: "auto" }}>
        <Box sx={{ minWidth: 170 + 80 * (PRIO_COLS.length + cats.length) }}>
          <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 1.25, px: 1.25, pt: 1, bgcolor: "rgba(21,34,58,.03)" }}>
            <span />
            {group("Sales priority", PRIO_COLS.length, "#2459d1")}
            {group("APSO customer", cats.length, "#1b7a55")}
          </Box>
          <Box sx={{ ...row, gridTemplateColumns: cols, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
            <Typography sx={head}>Person</Typography>
            {PRIO_COLS.map(([k, label]) => <Typography key={`p${k}`} sx={{ ...head, textAlign: "right" }}>{label}</Typography>)}
            {cats.map((k) => <Typography key={`c${k}`} sx={{ ...head, textAlign: "right" }}>{categoryLabel(k)}</Typography>)}
          </Box>
          {rows.map(({ o, l, v }) => (
            <Box key={o} sx={{ ...row, gridTemplateColumns: cols, py: 0.65 }}>
              <Who owner={o} names={names} palette={palette} />
              {PRIO_COLS.map(([k]) => <Box key={`p${k}`}>{fig(l?.priority?.[k] ?? 0, v?.priority?.[k])}</Box>)}
              {cats.map((k) => <Box key={`c${k}`}>{fig(l?.category?.[k] ?? 0, v?.category?.[k])}</Box>)}
            </Box>
          ))}
          <Box sx={{ ...row, gridTemplateColumns: cols, py: 0.65, borderBottom: "none", bgcolor: "rgba(21,34,58,.02)" }}>
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: MUTED }}>{c}</Typography>
            {PRIO_COLS.map(([k]) => <Typography key={`p${k}`} sx={{ ...cell, fontWeight: 700 }}>{full(total((l) => l.priority?.[k] ?? 0))}</Typography>)}
            {cats.map((k) => <Typography key={`c${k}`} sx={{ ...cell, fontWeight: 700 }}>{full(total((l) => l.category?.[k] ?? 0))}</Typography>)}
          </Box>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>
        Each person&apos;s companies by these rules, by their HubSpot Sales Priority and APSO CUSTOMER.{known ? "" : " APSO customer is read with the next full read of every company - empty until then."}
      </Typography>
    </Box>
  );
}

/** Where the GDP comes from, at the end of the KPIs (SARCLA 24.10.2026: "put also the source of GDP at the end"). */
function GdpSource({ c, src }: { c: string; src: LayerData["gdpSource"] | undefined }) {
  const shares = src?.regionalYear ? ` in ${src.regionalYear}` : "";
  const year = src?.year ? ` ${src.year}` : "";
  return (
    <Typography sx={{ fontSize: "0.72rem", color: FAINT, borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}>
      GDP source: Eurostat. Each region gets its share of {c}&apos;s GDP{shares}, from &quot;Gross domestic product (GDP) at current market prices by NUTS 3 region&quot; (nama_10r_3gdp).
      That share is applied to {c}&apos;s GDP{year} from &quot;GDP and main components&quot; (nama_10_gdp), at current prices in EUR. A person&apos;s GDP is each region&apos;s GDP split by their share of its zip codes.
    </Typography>
  );
}

/** The place in the window's background, faint (SARCLA 20.10.2026: "a transparent background of the modal becomes the
 *  region selected - zip code, country or region"). */
function PlaceShape({ m, place }: { m: CountryMap; place: Place | null }) {
  const base = m.base;
  if (!base) return null;
  let d: string | null = null;
  let box: [number, number, number, number] | null = null;
  if (!place) { d = base.outline; box = base.box; }
  else if (place.kind === "region") { const r = base.regions[place.index]; d = r?.d ?? null; box = r?.box ?? null; }
  else if (base.voronoi) {
    d = base.voronoi.renderCell(place.index) || null;
    const b = place.index * 4;
    box = [base.cellBox[b], base.cellBox[b + 1], base.cellBox[b + 2], base.cellBox[b + 3]];
  }
  if (!d || !box || !box.every(Number.isFinite)) return null;
  const pad = Math.max(box[2] - box[0], box[3] - box[1]) * 0.04;
  return (
    <Box component="svg" aria-hidden viewBox={`${box[0] - pad} ${box[1] - pad} ${box[2] - box[0] + 2 * pad} ${box[3] - box[1] + 2 * pad}`} preserveAspectRatio="xMidYMid meet"
      sx={{ position: "absolute", right: "3%", bottom: "4%", width: "46%", height: "80%", pointerEvents: "none", zIndex: 0, opacity: 0.09 }}>
      <path d={d} fill="#2459d1" stroke="#2459d1" strokeWidth={pad / 4} vectorEffect="non-scaling-stroke" />
    </Box>
  );
}

/* ── the rules: rule 1 and rule 2, one table each ── */

/** A person in a cell: the colour and the name; "over" = an override decided it. */
function Who({ owner, names, palette, over, empty }: { owner: string | null; names: Names; palette: Palette; over?: boolean; empty?: string }) {
  if (!owner) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>{empty ?? "—"}</Typography>;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Swatch paint={palette(owner)} size={12} />
      <Typography sx={{ fontSize: "0.84rem", fontWeight: over ? 700 : 500, color: over ? "#5b45c9" : INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.name(owner)}</Typography>
    </Box>
  );
}

function Table({ cols, heads, children }: { cols: string; heads: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
      <Box sx={{ ...row, gridTemplateColumns: cols, display: { xs: "none", md: "grid" }, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
        {heads.map((h, i) => <Typography key={i} component="div" sx={head}>{h}</Typography>)}
      </Box>
      {children}
    </Box>
  );
}

const PROPS = ["Region responsibility", "Company owner", "Contact owner"];

/** Postcodes and regions of a zone, as typed; a click on the map shows here, what is being typed stays as typed. */
function ZoneCodes({ zone, cc, admin, onChange }: { zone: Zone; cc: string; admin: boolean; onChange: (z: Zone) => void }) {
  const [text, setText] = useState(zone.prefixes.join(", "));
  const [rtext, setRtext] = useState(shortRegions(zone.regions, cc));
  useEffect(() => {
    if (canon(splitPrefixes(text)) !== canon(zone.prefixes)) setText(zone.prefixes.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.prefixes]);
  useEffect(() => {
    if (canon(splitRegions(rtext, cc)) !== canon(zone.regions ?? [])) setRtext(shortRegions(zone.regions, cc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.regions, cc]);
  const bad = zone.prefixes.map(prefixProblem).filter((x): x is string => !!x);
  return (
    <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
      <TextField size="small" multiline maxRows={3} value={text} disabled={!admin} placeholder="zip codes: 30-38, 40-49" error={bad.length > 0}
        helperText={bad.length ? bad.join("; ") : undefined} aria-label="Zip codes of the zone"
        onChange={(e) => { setText(e.target.value); onChange({ ...zone, prefixes: splitPrefixes(e.target.value) }); }} />
      {(admin || (zone.regions ?? []).length > 0) && (
        <TextField size="small" value={rtext} disabled={!admin} placeholder="or whole regions: BE, VS" aria-label="Regions of the zone"
          onChange={(e) => {
            setRtext(e.target.value);
            const next = splitRegions(e.target.value, cc);
            const z: Zone = { ...zone, regions: next };
            if (!next.length) delete z.regions;
            onChange(z);
          }} />
      )}
    </Box>
  );
}

const shortRegions = (regions: string[] | undefined, cc: string) => (regions ?? []).map((r) => (r.startsWith(`${cc}-`) ? r.slice(cc.length + 1) : r)).join(", ");

function RulesTab({ cc, got, rules, d, setDraft, names, palette, admin, rev, m, mode, place, compare }: {
  cc: string; got: Got; rules: AssignRules; d: MapData; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; rev: number;
  m: CountryMap; mode: Mode; place: Place | null; compare?: Compare | null;
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const seeded = d.seeded.countries[cc];
  const off = rule?.source === "map";
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const tableOf = (sae: string) => { const k = Object.keys(rules.sae).find((x) => saeKey(x) === saeKey(sae)); return k !== undefined ? String(rules.sae[k]) : null; };
  const saes = useMemo(() => (got.state === "ok" ? got.data.sae.filter((x) => (x.country || "??") === cc && x.sae) : []).sort((a, b) => b.companies - a.companies), [got, cc]);
  const kpi = mode === "kpi";

  // rule 2 figures per zone (KPI): postcodes and km² from the map, companies the postcodes decide from the scan
  const layers = useLayers(cc, compare ? compare.sandbox : null);
  const joined = useMemo(() => (m.base && layers.data ? joinLayer(m.base, layers.data) : null), [m.base, layers.data]);
  // the sandbox: live's figures beside it
  const liveLayers = useLayers(cc);
  const liveJoined = useMemo(() => (compare && m.base && liveLayers.data ? joinLayer(m.base, liveLayers.data) : null), [compare, m.base, liveLayers.data]);
  const vs: Vs = compare && liveLayers.data ? { load: liveLayers.data.load ?? [], m: compare.live.m, joined: liveJoined } : null;
  const zoneFig = useMemo(() => {
    const out = new Map<string, { postcodes: number; km2: number; companies: number }>();
    const base = m.base;
    if (!base) return out;
    const at = (id: string) => out.get(id) ?? (out.set(id, { postcodes: 0, km2: 0, companies: 0 }), out.get(id)!);
    base.points.forEach((pt, i) => { const f = at(m.picks[i]?.zoneId ?? ""); f.postcodes++; f.km2 += pt.km2; });
    if (joined) base.cells.forEach((pts, ci) => {
      const v = joined.cells[ci]?.via;
      if (v) at(m.picks[pts[0]]?.zoneId ?? "").companies += (v.zone ?? 0) + (v.default ?? 0);
    });
    return out;
  }, [m, joined]);

  /* rule 1 */
  const r1Rules = "minmax(150px, 1.1fr) repeat(3, minmax(130px, 1fr)) minmax(210px, 1.2fr)";
  const r1Kpi = "minmax(150px, 1.1fr) 100px 100px minmax(170px, 1.3fr) minmax(140px, 1fr) 100px";
  const rule1 = (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}><RuleTag n={1} />Performis SAE</Typography>
        <Typography sx={{ ...hint, flex: 1, minWidth: 220 }}>Each SAE goes to its person - when the ERP load writes a new SAE, the hub gives the company that person.</Typography>
        <Choice<"sae" | "map"> value={rule?.source ?? "sae"} onChange={(source) => admin && setRule((r) => ({ ...r, source }))} options={[
          { key: "sae", label: "On" }, { key: "map", label: "Off" },
        ]} />
      </Box>
      {off ? <Typography sx={hint}>Rule 1 is off in {c}: rule 2 decides every company.</Typography>
        : got.state === "loading" ? <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={14} /><Typography sx={hint}>Reading the SAE values of {c}…</Typography></Box>
        : got.state === "error" ? <Typography sx={{ ...hint, color: RED }}>Not readable: {got.error}</Typography>
        : (
          <Table cols={kpi ? r1Kpi : r1Rules} heads={kpi
            ? ["SAE Performis", <Box key="c" sx={{ textAlign: "right" }}>Companies</Box>, <Box key="k" sx={{ textAlign: "right" }}>Contacts</Box>, "Owner in HubSpot now", "After", <Box key="m" sx={{ textAlign: "right" }}>To change</Box>]
            : ["SAE Performis", ...PROPS, "Override"]}>
            {saes.map((x) => {
              const t = saeTarget(rules, cc, x.sae);
              // someone who has left: who takes over (SARCLA 25.10.2026: "the rules should be filled")
              const person = takesOver(rules, names, t.how === "table" || t.how === "redirect" ? t.owner : null);
              const over = t.how === "redirect";
              const wf = tableOf(x.sae);
              return (
                <Box key={x.sae} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: kpi ? r1Kpi : r1Rules }, bgcolor: over ? "rgba(98,80,214,.05)" : "transparent" }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.sae}>{x.sae}</Typography>
                  {kpi ? (
                    <>
                      <Typography sx={numSx}>{full(x.companies)}</Typography>
                      <Typography sx={numSx}>{full(x.contacts)}</Typography>
                      <Box sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
                        {[...x.ownerNow].sort((a, b) => b.companies - a.companies).slice(0, 3).map((o) => (
                          <Box key={o.owner ?? "none"} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}><Who owner={o.owner} names={names} palette={palette} empty="nobody" /></Box>
                            <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{full(o.companies)}</Typography>
                          </Box>
                        ))}
                      </Box>
                      <Who owner={person} names={names} palette={palette} over={over} empty="rule 2" />
                      <Typography sx={{ ...numSx, fontWeight: x.companiesOff ? 700 : 400, color: x.companiesOff ? "#8a560c" : FAINT }}>{x.companiesOff ? full(x.companiesOff) : "—"}</Typography>
                    </>
                  ) : (
                    <>
                      {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={person} names={names} palette={palette} over={over} empty="rule 2 (zip)" /></Box>)}
                      <OwnerPicker value={over ? t.owner ?? "" : ""} names={names} disabled={!admin} allowEmpty placeholder={wf ? `keep ${names.name(wf)}` : "pick someone"}
                        onChange={(o) => setRule((r) => withOverride(r, x.sae, o || null))} />
                    </>
                  )}
                </Box>
              );
            })}
            {!saes.length && <Typography sx={{ ...hint, p: 1.5 }}>No company in {c} has a Performis SAE.</Typography>}
          </Table>
        )}
    </Box>
  );

  /* rule 2 */
  const zones = rule?.zones ?? [];
  const r2Rules = "minmax(120px, 0.8fr) repeat(3, minmax(130px, 1fr)) minmax(190px, 1fr) minmax(220px, 1.5fr) 36px";
  const r2Kpi = "minmax(120px, 0.8fr) minmax(150px, 1fr) 100px 110px 120px minmax(160px, 1.4fr)";
  const seededOwner = (id: string) => seeded?.zones.find((z) => z.id === id)?.owner ?? null;
  const countryDefault = rule?.defaultOwner || null;
  const defaultPerson = countryDefault || rules.defaultOwner;
  const rule2 = (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}><RuleTag n={2} />Zip codes</Typography>
        <Typography sx={{ ...hint, flex: 1, minWidth: 220 }}>{off ? `Every company in ${c}.` : "Companies and new contacts without an SAE yet - until the ERP sends one."} Change a zone here or click it on the map.</Typography>
      </Box>
      <Table cols={kpi ? r2Kpi : r2Rules} heads={kpi
        ? ["Zone", "Person", <Box key="p" sx={{ textAlign: "right" }}>Zip codes</Box>, <Box key="k" sx={{ textAlign: "right" }}>km²</Box>, <Box key="c" sx={{ textAlign: "right" }}>Companies</Box>, "Zip codes"]
        : ["Zone", ...PROPS, "Override", "Zip codes", ""]}>
        {zones.map((z, i) => {
          const was = seededOwner(z.id);
          const over = !!was && z.owner !== was;
          const f = zoneFig.get(z.id);
          return (
            <Box key={`${rev}-${z.id}`} sx={{ ...row, alignItems: kpi ? "center" : "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: kpi ? r2Kpi : r2Rules }, bgcolor: over ? "rgba(98,80,214,.05)" : "transparent" }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, pt: kpi ? 0 : 0.75 }}>{z.label || `Zone ${i + 1}`}</Typography>
              {kpi ? (
                <>
                  <Who owner={z.owner || null} names={names} palette={palette} over={over} />
                  <Typography sx={numSx}>{f ? full(f.postcodes) : "—"}</Typography>
                  <Typography sx={numSx}>{f ? km2Text(f.km2) : "—"}</Typography>
                  <Typography sx={numSx}>{f && layers.data ? full(f.companies) : "—"}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={z.prefixes.join(", ")}>{[z.prefixes.join(", "), shortRegions(z.regions, cc)].filter(Boolean).join(" · ") || "—"}</Typography>
                </>
              ) : (
                <>
                  {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0, pt: { md: 0.9 } }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={takesOver(rules, names, z.owner || null)} names={names} palette={palette} over={over} empty="pick a person" /></Box>)}
                  <OwnerPicker value={was ? (over ? z.owner : "") : z.owner} names={names} disabled={!admin} allowEmpty={!!was}
                    placeholder={was ? `keep ${names.name(was)}` : "pick a person"}
                    onChange={(o) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? { ...x, owner: String(o || was || x.owner) } : x)) }))} />
                  <ZoneCodes zone={z} cc={cc} admin={admin} onChange={(nz) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? nz : x)) }))} />
                  {admin ? <IconButton size="small" onClick={() => setRule((r) => ({ ...r, zones: r.zones.filter((x) => x.id !== z.id) }))} aria-label={`Remove zone ${i + 1}`} sx={{ mt: 0.5 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
                </>
              )}
            </Box>
          );
        })}
        {/* the rest of the country */}
        {(() => {
          const was = seeded?.defaultOwner || null;
          const over = (countryDefault || null) !== (was || null);
          const f = zoneFig.get("");
          return (
            <Box sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: kpi ? r2Kpi : r2Rules }, bgcolor: "rgba(21,34,58,.02)" }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED }}>Every other zip code</Typography>
              {kpi ? (
                <>
                  <Who owner={defaultPerson} names={names} palette={palette} over={over} />
                  <Typography sx={numSx}>{f ? full(f.postcodes) : "—"}</Typography>
                  <Typography sx={numSx}>{f ? km2Text(f.km2) : "—"}</Typography>
                  <Typography sx={numSx}>{f && layers.data ? full(f.companies) : "—"}</Typography>
                  <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>in no zone</Typography>
                </>
              ) : (
                <>
                  {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={defaultPerson} names={names} palette={palette} over={over} /></Box>)}
                  <OwnerPicker value={over ? countryDefault ?? "" : ""} names={names} disabled={!admin} allowEmpty
                    placeholder={`keep ${names.name(was || rules.defaultOwner)}`}
                    onChange={(o) => setRule((r) => ({ ...r, defaultOwner: o || was || null }))} />
                  <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>in no zone</Typography>
                  <span />
                </>
              )}
            </Box>
          );
        })()}
      </Table>
      {admin && !kpi && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
        onClick={() => setRule((r) => ({ ...r, zones: [...r.zones, { id: newId("z"), owner: "", prefixes: [] }] }))}>Add a zone</Button>}
    </Box>
  );

  if (place) return <PlaceRules place={place} cc={cc} rules={rules} d={d} setDraft={setDraft} names={names} palette={palette} admin={admin} m={m} mode={mode} joined={joined} liveJoined={compare ? liveJoined : null} gdpSource={layers.data?.gdpSource} />;
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {kpi && <WorkloadTable c={c} load={layers.data?.load ?? []} tickets={layers.data?.tickets ?? null} m={m} joined={joined} names={names} palette={palette} vs={vs} rules={rules} />}
      {kpi && <SplitTable c={c} load={layers.data?.load ?? []} names={names} palette={palette} vs={vs} />}
      {rule1}
      {rule2}
      {kpi && <GdpSource c={c} src={layers.data?.gdpSource} />}
    </Box>
  );
}

/** A place in figures (SARCLA 21.10.2026: "not now / after - insightful KPIs: GDP, revenue, orders incoming, new
 *  customers, number of tickets, number of sales tickets"): the totals, then per person the rules give the companies. */
function PlaceKpi({ place, st, gdp, km2, names, palette, vsSt }: {
  place: Place; st: NonNullable<ReturnType<typeof joinLayer>["regions"][number]>; gdp: number | null; km2: number | null; names: Names; palette: Palette;
  /** the sandbox: the same place as live decides it */
  vsSt?: ReturnType<typeof joinLayer>["regions"][number] | null;
}) {
  const tiles: [string, string][] = [
    ["companies", full(st.companies)], ["bought this year", full(st.customers)], ["new customers this year", full(st.newCustomers)],
    ["revenue this year (EUR)", full(Math.round(st.revenue))], ["tickets, last 90 days", full(st.tickets ?? 0)], ["sales tickets, last 90 days", full(st.sales ?? 0)],
    ...(gdp !== null && gdp !== undefined ? [["GDP (EUR)", gdp >= 1000 ? `${(gdp / 1000).toFixed(1)} bn` : `${full(Math.round(gdp))} m`] as [string, string]] : []),
    ...(km2 ? [["km²", km2Text(km2).replace(" km²", "")] as [string, string]] : []),
  ];
  const vsBy = vsSt?.byOwner ?? null;
  const zero = { companies: 0, customers: 0, newCustomers: 0, revenue: 0, tickets: 0, sales: 0 };
  const people = [...new Set([...Object.keys(st.byOwner ?? {}), ...Object.keys(vsBy ?? {})])]
    .map((o) => [o, st.byOwner?.[o] ?? zero] as const).sort((a, b) => b[1].companies - a[1].companies);
  const fig = (o: string, k: keyof typeof zero, bold?: boolean) => (
    <Box sx={{ textAlign: "right" }}>
      <Typography sx={{ ...cell, fontWeight: bold ? 700 : 400 }}>{full(Math.round((st.byOwner?.[o] ?? zero)[k]))}</Typography>
      {vsBy && <Delta now={(st.byOwner?.[o] ?? zero)[k]} was={vsBy[o]?.[k] ?? 0} />}
    </Box>
  );
  const cols = "minmax(170px, 1.4fr) 100px 110px 110px 120px 100px 100px";
  const cell = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: "right" as const };
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{place.title} in figures{vsBy ? " - per person, the sandbox minus live under each figure" : ""}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
        {tiles.map(([label, value]) => (
          <Box key={label} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", px: 1.5, py: 1, bgcolor: "rgba(255,255,255,.7)" }}>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{label}</Typography>
          </Box>
        ))}
      </Box>
      {(Object.keys(st.priority ?? {}).length > 0 || Object.keys(st.category ?? {}).length > 0) && (
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          {PRIO_COLS.filter(([k]) => k).map(([k, label]) => `${label} ${full(st.priority?.[k] ?? 0)}`).join(" · ")}
          {Object.keys(st.category ?? {}).length ? ` - ${CATEGORY_ORDER.filter((k) => k && st.category?.[k]).map((k) => `${categoryLabel(k)} ${full(st.category![k])}`).join(" · ")}` : ""}
        </Typography>
      )}
      {people.length > 0 && (
        <Table cols={cols} heads={["Person (by the rules)", ...["Companies", "Bought this year", "New this year", "Revenue EUR", "Tickets 90 d", "Sales 90 d"].map((h) => <Box key={h} sx={{ textAlign: "right" }}>{h}</Box>)]}>
          {people.map(([o, x]) => (
            <Box key={o} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: cols }, py: 0.6 }}>
              <Who owner={o} names={names} palette={palette} />
              {fig(o, "companies", true)}
              {fig(o, "customers")}
              {fig(o, "newCustomers")}
              {fig(o, "revenue")}
              {fig(o, "tickets")}
              {fig(o, "sales", !!x.sales)}
            </Box>
          ))}
        </Table>
      )}
    </Box>
  );
}
const placeKm2 = (m: CountryMap, place: Place): number | null => {
  const base = m.base;
  if (!base) return null;
  if (place.kind === "region") return base.regions[place.index]?.km2 ?? null;
  return (base.cells[place.index] ?? []).reduce((a, i) => a + base.points[i].km2, 0) || null;
};

/* ── one place: its SAEs and its zip zones ── */

function PlaceRules({ place, cc, rules, d, setDraft, names, palette, admin, m, mode, joined, liveJoined, gdpSource }: {
  place: Place; cc: string; rules: AssignRules; d: MapData; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean;
  m: CountryMap; mode: Mode; joined: ReturnType<typeof joinLayer> | null;
  /** the sandbox: the same figures as live decides them */
  liveJoined?: ReturnType<typeof joinLayer> | null;
  gdpSource?: LayerData["gdpSource"];
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const seeded = d.seeded.countries[cc];
  const off = rule?.source === "map";
  const kpi = mode === "kpi";
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const tableOf = (sae: string) => { const k = Object.keys(rules.sae).find((x) => saeKey(x) === saeKey(sae)); return k !== undefined ? String(rules.sae[k]) : null; };
  const st = joined ? (place.kind === "region" ? joined.regions[place.index] : joined.cells[place.index]) : null;
  const saes = Object.entries(st?.sae ?? {}).filter(([k, n]) => k && n > 0).sort((a, b) => b[1] - a[1]);
  const noSae = st?.sae?.[""] ?? 0;
  const zonesHere = useMemo(() => {
    const out = new Map<string, number>();
    const base = m.base;
    if (!base) return out;
    const pts = place.kind === "region" ? base.points.flatMap((pt, i) => (pt.region === place.index ? [i] : [])) : base.cells[place.index] ?? [];
    for (const i of pts) { const z = m.picks[i]?.zoneId ?? ""; out.set(z, (out.get(z) ?? 0) + 1); }
    return out;
  }, [m, place]);
  const [swap, setSwap] = useState("");
  // where this place's own SAE overrides live: the region's code, or the zip codes of the cell
  const scope = useMemo(() => {
    const base = m.base;
    if (!base) return {};
    if (place.kind === "region") return { region: base.regions[place.index]?.code };
    const pts = base.cells[place.index] ?? [];
    const ri = pts.length ? base.points[pts[0]].region : -1;
    return { zips: pts.map((i) => base.points[i].zip), ...(ri >= 0 ? { inRegion: base.regions[ri]?.code } : {}) };
  }, [m.base, place]);

  const r1 = kpi ? "minmax(150px, 1.2fr) 120px minmax(160px, 1fr)" : "minmax(150px, 1.1fr) 110px repeat(3, minmax(120px, 1fr)) minmax(200px, 1.2fr)";
  const r2 = kpi ? "minmax(140px, 1fr) minmax(160px, 1fr) 120px" : "minmax(140px, 1fr) repeat(3, minmax(120px, 1fr)) minmax(200px, 1.2fr) 110px";
  const zones = (rule?.zones ?? []).filter((z) => zonesHere.has(z.id));
  const restHere = zonesHere.get("") ?? 0;
  const defaultPerson = rule?.defaultOwner || rules.defaultOwner;
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {kpi && st && <PlaceKpi place={place} st={st} gdp={place.kind === "region" && joined ? joined.gdp[place.index] : null} km2={placeKm2(m, place)} names={names} palette={palette}
        vsSt={liveJoined ? (place.kind === "region" ? liveJoined.regions[place.index] : liveJoined.cells[place.index]) ?? null : null} />}
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}><RuleTag n={1} />Performis SAE in {place.title}</Typography>
        {off ? <Typography sx={hint}>Rule 1 is off in {c}: rule 2 decides every company.</Typography>
          : !joined ? <Typography sx={hint}>The companies of {place.title} come with the engine&apos;s scans.</Typography> : (
          <Table cols={r1} heads={kpi ? ["SAE Performis", <Box key="c" sx={{ textAlign: "right" }}>Companies here</Box>, "After"] : ["SAE Performis", <Box key="c" sx={{ textAlign: "right" }}>Companies here</Box>, ...PROPS, `Override in ${place.title}`]}>
            {saes.map(([sae, n]) => {
              // the override of this place first (SARCLA 25.10.2026: country, region and zip-code levels), then the country's
              const t = saeTargetAt(rules, cc, sae, scope);
              const person = takesOver(rules, names, t.how === "table" || t.how === "redirect" ? t.owner : null);
              const over = t.how === "redirect";
              const wf = tableOf(sae);
              const countryOver = saeTarget(rules, cc, sae);
              return (
                <Box key={sae} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: r1 }, bgcolor: over ? "rgba(98,80,214,.05)" : "transparent" }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sae}>{sae}</Typography>
                  <Typography sx={numSx}>{full(n)}</Typography>
                  {kpi ? <Who owner={person} names={names} palette={palette} over={over} empty="rule 2" /> : (
                    <>
                      {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={person} names={names} palette={palette} over={over} empty="rule 2 (zip)" /></Box>)}
                      <Box sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
                        <OwnerPicker value={placeOverride(rule, scope, sae) ?? ""} names={names} disabled={!admin} allowEmpty
                          placeholder={countryOver.how === "redirect" ? `keep ${names.name(countryOver.owner)} (all of ${c})` : wf ? `keep ${names.name(wf)}` : "pick someone"}
                          onChange={(o) => setRule((r) => withPlaceOverride(r, scope, sae, o || null))} />
                        {countryOver.how === "redirect" && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>all of {c}: {names.name(countryOver.owner)}</Typography>}
                      </Box>
                    </>
                  )}
                </Box>
              );
            })}
            {!saes.length && <Typography sx={{ ...hint, p: 1.5 }}>No company with an SAE in {place.title}.</Typography>}
          </Table>
        )}
      </Box>
      <Box sx={{ display: "grid", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
          <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}><RuleTag n={2} />Zip codes in {place.title}</Typography>
          {joined && <Typography sx={hint}>{full(noSae)} {noSae === 1 ? "company has" : "companies have"} no SAE yet here.</Typography>}
        </Box>
        <Table cols={r2} heads={kpi ? ["Zone", "Person", <Box key="z" sx={{ textAlign: "right" }}>Zip codes here</Box>] : ["Zone", ...PROPS, "Override (whole zone)", <Box key="z" sx={{ textAlign: "right" }}>Zip codes here</Box>]}>
          {zones.map((z, i) => {
            const was = seeded?.zones.find((x) => x.id === z.id)?.owner ?? null;
            const over = !!was && z.owner !== was;
            return (
              <Box key={z.id} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: r2 }, bgcolor: over ? "rgba(98,80,214,.05)" : "transparent" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{z.label || `Zone ${i + 1}`}</Typography>
                {kpi ? <Who owner={z.owner || null} names={names} palette={palette} over={over} /> : (
                  <>
                    {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={z.owner || null} names={names} palette={palette} over={over} empty="pick a person" /></Box>)}
                    <OwnerPicker value={was ? (over ? z.owner : "") : z.owner} names={names} disabled={!admin} allowEmpty={!!was} placeholder={was ? `keep ${names.name(was)}` : "pick a person"}
                      onChange={(o) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? { ...x, owner: String(o || was || x.owner) } : x)) }))} />
                  </>
                )}
                <Typography sx={numSx}>{full(zonesHere.get(z.id) ?? 0)}</Typography>
              </Box>
            );
          })}
          {restHere > 0 && (
            <Box sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: r2 }, bgcolor: "rgba(21,34,58,.02)" }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED }}>In no zone</Typography>
              {kpi ? <Who owner={defaultPerson} names={names} palette={palette} /> : (
                <>
                  {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Who owner={defaultPerson} names={names} palette={palette} /></Box>)}
                  <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>the country&apos;s default - see Rules of {c}</Typography>
                </>
              )}
              <Typography sx={numSx}>{full(restHere)}</Typography>
            </Box>
          )}
        </Table>
        {!kpi && <ZipList place={place} m={m} joined={joined} names={names} palette={palette} admin={admin} />}
        {admin && !kpi && place.kind === "region" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>Swap all zip codes of {place.title} to</Typography>
            <OwnerPicker value={swap || null} names={names} onChange={(o) => setSwap(String(o ?? ""))} placeholder="pick a person" sx={{ minWidth: 240 }} />
            <Button variant="contained" size="small" disableElevation disabled={!swap} onClick={() => { place.give(swap); setSwap(""); }} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Swap</Button>
          </Box>
        )}
      </Box>
      {kpi && <GdpSource c={c} src={gdpSource} />}
    </Box>
  );
}

/** The zip codes of a place, one row each, with an override (SARCLA 20.10.2026: "cannot change an individual zip code,
 *  this should also be possible"). */
function ZipList({ place, m, joined, names, palette, admin }: {
  place: Place; m: CountryMap; joined: ReturnType<typeof joinLayer> | null; names: Names; palette: Palette; admin: boolean;
}) {
  const base = m.base;
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    if (!base) return [];
    const cells = place.kind === "cell" ? [place.index] : [...new Set(base.points.flatMap((pt) => (pt.region === place.index ? [pt.cell] : [])))];
    return cells.map((ci) => {
      const pts = base.cells[ci];
      const p0 = base.points[pts[0]];
      return { ci, zips: pts.map((i) => base.points[i].zip), place: p0.place, owner: String(m.picks[pts[0]]?.owner ?? ""), companies: joined?.cells[ci]?.companies ?? 0 };
    }).sort((a, b) => a.zips[0].localeCompare(b.zips[0]));
  }, [base, place, m.picks, joined]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => !needle || r.zips.some((z) => z.toLowerCase().startsWith(needle)) || (r.place ?? "").toLowerCase().includes(needle));
  const { slice, pager } = usePaged(shown, 12);
  if (!rows.length) return null;
  const cols = "minmax(110px, 0.8fr) minmax(150px, 1.2fr) minmax(150px, 1fr) 100px minmax(200px, 1.2fr)";
  return (
    <Box sx={{ display: "grid", gap: 0.75, mt: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{place.kind === "cell" ? "This zip code" : `Each zip code of ${place.title} · ${full(rows.length)}`}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 12 && <TextField size="small" placeholder="find a zip code or place" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 220 }} />}
      </Box>
      <Table cols={cols} heads={["Zip code", "Place", "Person (rule 2)", <Box key="c" sx={{ textAlign: "right" }}>Companies</Box>, "Override"]}>
        {slice.map((r) => (
          <Box key={r.ci} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: cols }, py: 0.6 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{r.zips[0]}{r.zips.length > 1 ? ` +${r.zips.length - 1}` : ""}</Typography>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.place ?? ""}</Typography>
            <Who owner={r.owner || null} names={names} palette={palette} />
            <Typography sx={numSx}>{joined ? full(r.companies) : "—"}</Typography>
            <OwnerPicker value={null} names={names} disabled={!admin} placeholder="give to someone else"
              onChange={(o) => o && place.giveZips(r.zips, String(o), r.zips.length > 1 ? `${r.zips[0]} and ${r.zips.length - 1} more` : `${r.zips[0]}${r.place ? ` ${r.place}` : ""}`)} />
          </Box>
        ))}
      </Table>
      {pager}
    </Box>
  );
}

/* ── key accounts: one row per customer, tick off or add by search ── */

type Key = NonNullable<CountryRule["keyAccounts"]>[number];

/** GET ?companies=1: the customers behind ERP ids, or a search. Several requests at most 100 ids each - the hub's
 *  firewall refuses a query string past 2 KB with a bare 403 (20.10.2026: 265 ids = 2.4 KB, every row read "not in
 *  HubSpot"). */
function useCompanies(params: string[] | null): { rows: CompanyRow[]; loading: boolean; error: string | null } {
  const key = params ? params.join("|") : null;
  const [got, setGot] = useState<{ key: string; rows: CompanyRow[]; error: string | null } | null>(null);
  useEffect(() => {
    if (!params || !key) return;
    let live = true;
    Promise.all(params.map(async (q) => {
      const r = await fetch(`${API}?companies=1&${q}`);
      const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: CompanyRow[]; error?: string } | null;
      if (!j?.ok || !Array.isArray(j.data)) throw new Error(j?.error ?? `HTTP ${r.status}`);
      return j.data;
    })).then((parts) => { if (live) setGot({ key, rows: parts.flat(), error: null }); })
      .catch((e) => { if (live) setGot({ key, rows: [], error: String((e as Error)?.message ?? e) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { rows: [], loading: false, error: null };
  return got && got.key === key ? { rows: got.rows, loading: false, error: got.error } : { rows: got?.rows ?? [], loading: true, error: null };
}
const erpParams = (ids: string[]) => {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(`erp=${encodeURIComponent(ids.slice(i, i + 100).join(","))}`);
  return out;
};

function KeysTab({ cc, rules, setDraft, names, palette, admin, mode }: {
  cc: string; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; mode: Mode;
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const keys: Key[] = rule?.keyAccounts ?? [];
  const setKeys = (f: (k: Key[]) => Key[]) => setDraft((dr) => {
    const r = dr.countries[cc] ?? emptyRule(cc);
    return { ...dr, countries: { ...dr.countries, [cc]: { ...r, keyAccounts: f(r.keyAccounts ?? []) } } };
  });
  // ticked off in this window: kept on screen (unticked) so a tick puts them back
  const [off, setOff] = useState<{ erp: string; group: number }[]>([]);
  const ids = useMemo(() => [...new Set([...keys.flatMap((k) => k.erpIds), ...off.map((o) => o.erp)])].sort(), [keys, off]);
  const known = useCompanies(ids.length ? erpParams(ids) : null);
  const byErp = useMemo(() => new Map(known.rows.map((r) => [String(r.erpId), r])), [known.rows]);
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  useEffect(() => { const t = window.setTimeout(() => setQq(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  const found = useCompanies(qq.length >= 2 ? [`q=${encodeURIComponent(qq)}&country=${cc}`] : null);
  const [to, setTo] = useState(0);
  const kpi = mode === "kpi";
  const needle = qq.toLowerCase();
  const matches = (erp: string) => { if (!needle) return true; const r = byErp.get(erp); return erp.toLowerCase().includes(needle) || !!r?.name.toLowerCase().includes(needle); };

  const tick = (erp: string, group: number, on: boolean) => {
    if (on) { setOff((x) => x.filter((o) => o.erp !== erp)); setKeys((ks) => ks.map((k, i) => (i === group && !k.erpIds.includes(erp) ? { ...k, erpIds: [...k.erpIds, erp] } : k))); }
    else { setOff((x) => [...x.filter((o) => o.erp !== erp), { erp, group }]); setKeys((ks) => ks.map((k, i) => (i === group ? { ...k, erpIds: k.erpIds.filter((x) => x !== erp) } : k))); }
  };
  const add = (erp: string) => {
    if (!keys.length) { setKeys(() => [{ owner: "", erpIds: [erp] }]); return; }
    const g = Math.min(to, keys.length - 1);
    if (keys.some((k) => k.erpIds.includes(erp))) return;
    setOff((x) => x.filter((o) => o.erp !== erp));
    setKeys((ks) => ks.map((k, i) => (i === g ? { ...k, erpIds: [...k.erpIds, erp] } : k)));
  };

  const cols = kpi ? "minmax(220px, 1.6fr) 100px minmax(150px, 1fr) minmax(150px, 1fr) 110px" : "40px minmax(220px, 1.6fr) 100px minmax(120px, 0.8fr) minmax(150px, 1fr)";
  const rowOf = (erp: string, group: number, on: boolean) => {
    const r = byErp.get(erp);
    return (
      <Box key={`${group}-${erp}`} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: cols }, opacity: on ? 1 : 0.55 }}>
        {!kpi && <Checkbox size="small" checked={on} disabled={!admin} onChange={(e) => tick(erp, group, e.target.checked)} inputProps={{ "aria-label": `Key account ${r?.name ?? erp}` }} sx={{ p: 0.5, justifySelf: "start" }} />}
        <Box sx={{ minWidth: 0 }}>
          {r ? (
            <Box component="a" href={hsCompany(r.id)} target="_blank" rel="noreferrer"
              sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, textDecoration: on ? "none" : "line-through", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { color: "#2459d1" } }}>{r.name}</Box>
          ) : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{known.loading ? "…" : "not in HubSpot"}</Typography>}
        </Box>
        <Typography sx={{ fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{erp}</Typography>
        {kpi ? (
          <>
            <Who owner={r?.ownerNow ?? null} names={names} palette={palette} empty="—" />
            <Who owner={r?.decided ?? null} names={names} palette={palette} empty="—" />
            <Typography sx={numSx}>{r?.revenue !== null && r?.revenue !== undefined ? full(Math.round(r.revenue)) : "—"}</Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r ? [r.country, r.zip].filter(Boolean).join(" ") : ""}</Typography>
            <Who owner={r?.ownerNow ?? null} names={names} palette={palette} empty="—" />
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography sx={hint}>Customers that go to one person whatever the zip code{rule?.source !== "map" ? " - when they have no SAE (rule 1 first)" : ""}. Untick to take one off; search to add one.</Typography>
      {admin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find or add a customer in ${c}: name or ERP id`} sx={{ flex: 1, minWidth: 260, maxWidth: 520 }} />
          {keys.length > 1 && (
            <TextField select size="small" value={Math.min(to, keys.length - 1)} onChange={(e) => setTo(Number(e.target.value))} label="Add to" sx={{ minWidth: 220 }}>
              {keys.map((k, i) => <MenuItem key={i} value={i}>{k.owner ? names.name(k.owner) : "nobody yet"}{k.label ? ` - ${k.label}` : ""}</MenuItem>)}
            </TextField>
          )}
        </Box>
      )}
      {qq.length >= 2 && (
        <Box sx={{ border: "1px solid rgba(36,89,209,.25)", bgcolor: "rgba(36,89,209,.03)", borderRadius: "12px", p: 1, display: "grid", gap: 0.25 }}>
          <Typography sx={{ ...head, px: 0.5 }}>Customers in {c} matching &quot;{qq}&quot;{found.loading ? " …" : ""}</Typography>
          {found.error && <Typography sx={{ ...hint, color: RED, px: 0.5 }}>{found.error}</Typography>}
          {found.rows.slice(0, 10).map((r) => {
            const inList = !!r.erpId && keys.some((k) => k.erpIds.includes(String(r.erpId)));
            return (
              <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, py: 0.4 }}>
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Typography>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{r.erpId ?? "no ERP id"} · {[r.country, r.zip].filter(Boolean).join(" ")}</Typography>
                <Button size="small" disabled={!r.erpId || inList} onClick={() => r.erpId && add(String(r.erpId))} sx={{ textTransform: "none", minWidth: 70 }}>{inList ? "in the list" : "Add"}</Button>
              </Box>
            );
          })}
          {!found.loading && !found.rows.length && <Typography sx={{ ...hint, px: 0.5 }}>No customer found.</Typography>}
        </Box>
      )}
      {keys.map((k, gi) => {
        const rowsOn = k.erpIds.filter(matches);
        const rowsOff = off.filter((o) => o.group === gi && matches(o.erp)).map((o) => o.erp);
        const revenue = k.erpIds.reduce((a, e) => a + (byErp.get(e)?.revenue ?? 0), 0);
        return (
          <Box key={gi} sx={{ display: "grid", gap: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Swatch paint={palette(k.owner)} size={13} />
              <OwnerPicker value={k.owner} names={names} disabled={!admin} onChange={(owner) => setKeys((ks) => ks.map((x, i) => (i === gi ? { ...x, owner } : x)))} sx={{ minWidth: 220 }} />
              <TextField size="small" value={k.label ?? ""} disabled={!admin} placeholder="label" onChange={(e) => setKeys((ks) => ks.map((x, i) => (i === gi ? { ...x, label: e.target.value || undefined } : x)))} sx={{ minWidth: 240 }} />
              <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{full(k.erpIds.length)} customers{kpi && revenue ? ` · ${full(Math.round(revenue))} EUR this year` : ""}</Typography>
              <Box sx={{ flex: 1 }} />
              {admin && <Button size="small" onClick={() => setKeys((ks) => ks.filter((_, i) => i !== gi))} sx={{ textTransform: "none", color: MUTED }}>Remove the list</Button>}
            </Box>
            <Table cols={cols} heads={kpi ? ["Customer", "ERP id", "Owner in HubSpot now", "After", <Box key="r" sx={{ textAlign: "right" }}>Revenue this year</Box>] : ["", "Customer", "ERP id", "Where", "Owner in HubSpot now"]}>
              <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
                {rowsOn.map((e) => rowOf(e, gi, true))}
                {rowsOff.map((e) => rowOf(e, gi, false))}
                {!rowsOn.length && !rowsOff.length && <Typography sx={{ ...hint, p: 1.5 }}>{needle ? `None of these ${full(k.erpIds.length)} customers matches "${qq}" - add one from the search results above.` : "No customer yet - search above to add one."}</Typography>}
              </Box>
            </Table>
          </Box>
        );
      })}
      {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
        onClick={() => setKeys((ks) => [...ks, { owner: "", erpIds: [] }])}>New key account list</Button>}
      {known.error && <Typography sx={{ ...hint, color: RED }}>The customers could not be read: {known.error}</Typography>}
    </Box>
  );
}

/* ── the window ── */

export function RulesDialog({ open, onClose, cc, setCc, d, rules, setDraft, names, palette, rev, m, n, dirty, busy, check, msg, onSave, onUndo, seededNow, onSeeded, place, onWholeCountry, mode, setMode, compare = null }: {
  open: boolean; onClose: () => void; cc: string; setCc: (cc: string) => void;
  d: MapData; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette;
  /** the page's rules version: a save or an undo re-reads every field */
  rev: number;
  /** the country on the map (its postcodes, decided by the rules on screen) */
  m: CountryMap;
  /** the page's reload counter */
  n: number;
  dirty: boolean; busy: boolean; check: { errors: string[] }; msg: { ok: boolean; text: string } | null; onSave: () => void; onUndo: () => void;
  /** the rules as first read from the HubSpot workflows, every country */
  seededNow: boolean; onSeeded: () => void;
  /** a place clicked on the map: the window shows only it; onWholeCountry drops it */
  place?: Place | null; onWholeCountry?: () => void;
  /** Rules or KPI - the page's, so the map's KPIs button opens the window on KPI */
  mode: Mode; setMode: (m: Mode) => void;
  /** the sandbox (SARCLA 24.10.2026): its KPIs against live; changes save themselves in the sandbox */
  compare?: Compare | null;
}) {
  const [tab, setTab] = useState<Tab>("rules");
  useEffect(() => { if (place) setTab("rules"); }, [place]);
  useEffect(() => { if (open && mode === "kpi" && tab === "people") setTab("rules"); }, [open, mode, tab]);
  const got = usePerformis(n);
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const admin = d.admin;
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const keys = rule?.keyAccounts ?? [];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" aria-label={`Rules of ${c}`}
      slotProps={{ paper: { sx: { borderRadius: { xs: 0, sm: "18px" }, height: { xs: "100%", sm: "88vh" }, maxHeight: { xs: "100%", sm: "88vh" }, m: { xs: 0, sm: 2 }, width: { xs: "100%", sm: undefined } } } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Typography component="h2" sx={{ fontSize: "1.2rem", fontWeight: 700, color: INK }}>Rules</Typography>
            <CountryMenu list={countryList(d, rules)} cc={cc} onPick={setCc} label={countryName} />
            {compare ? <Chip tint="amber">SANDBOX</Chip> : d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
            {place && (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.25, pr: 0.5, py: 0.25, borderRadius: "999px", bgcolor: "#e6edfd", color: "#2459d1" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{place.title}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#5b74b8" }}>{place.sub}</Typography>
                {onWholeCountry && <IconButton size="small" onClick={onWholeCountry} aria-label="Show the whole country" sx={{ color: "#2459d1", p: 0.25 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            {tab !== "people" && <ModeSwitch mode={mode} setMode={setMode} />}
            <IconButton onClick={onClose} aria-label="Close the rules"><CloseIcon /></IconButton>
          </Box>
          <PillGroup<Tab> name="Jobs" value={tab} onChange={setTab} options={[
            { key: "rules", label: place ? `Rules of ${place.title}` : `Rules of ${c}` },
            { key: "keys", label: "Key accounts", count: keys.length ? String(keys.length) : null },
            { key: "people", label: `Who works ${c}`, count: (rule?.people ?? []).length ? String(rule!.people!.length) : null },
          ]} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2, position: "relative" }}>
          {tab === "rules" && <PlaceShape m={m} place={place ?? null} />}
          <Box sx={{ position: "relative", zIndex: 1 }}>
          {tab === "rules" && <RulesTab key={`${cc}-${rev}`} cc={cc} got={got} rules={rules} d={d} setDraft={setDraft} names={names} palette={palette} admin={admin} rev={rev} m={m} mode={mode} place={place ?? null} compare={compare} />}
          {tab === "keys" && <KeysTab key={`${cc}-${rev}`} cc={cc} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} mode={mode} />}
          {tab === "people" && (
            <Box sx={{ display: "grid", gap: 1.5, maxWidth: 720 }}>
              <Typography sx={hint}>The people who work {c}. An SAE whose person is not in this list is not used in {c} - rule 2 (the postcodes) decides. Empty = anyone.</Typography>
              <PeoplePicker key={`${cc}-${rev}`} value={rule?.people ?? []} names={names} disabled={!admin} placeholder="anyone - pick who works this country"
                onChange={(people) => setRule((r) => { const x: CountryRule = { ...r, people }; if (!people.length) delete x.people; return x; })} />
            </Box>
          )}
          </Box>
        </Box>
        {compare ? (
          <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#fbf7ee", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.8rem", color: "#7a5410" }}>Sandbox - changes save themselves here and never touch HubSpot or the live rules. An admin brings them to live from the page.</Typography>
            {check.errors.length > 0 && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{check.errors[0]}{check.errors.length > 1 ? ` (+${check.errors.length - 1})` : ""}</Typography>}
            {msg && <Typography sx={{ fontSize: "0.8rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
            <Box sx={{ flex: 1 }} />
            {(busy || dirty) && <CircularProgress size={14} />}
            <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
          </Box>
        ) : (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {dirty ? <Chip tint="amber">Unsaved changes - the map shows them</Chip> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{admin ? "Nothing to save" : "Read only - admins change the rules"}</Typography>}
          {check.errors.length > 0 && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{check.errors[0]}{check.errors.length > 1 ? ` (+${check.errors.length - 1})` : ""}</Typography>}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
          <Box sx={{ flex: 1 }} />
          {admin && !seededNow && <Button size="small" onClick={onSeeded} disabled={busy} sx={{ textTransform: "none", color: MUTED }}>Back to the first rules</Button>}
          {busy && <CircularProgress size={14} />}
          {admin && <Button disabled={!dirty || busy} onClick={onUndo} sx={{ textTransform: "none" }}>Undo</Button>}
          <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
          {admin && <Button variant="contained" disableElevation startIcon={<SaveOutlinedIcon />} disabled={!dirty || busy || check.errors.length > 0} onClick={onSave}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Save</Button>}
        </Box>
        )}
      </Box>
    </Dialog>
  );
}
