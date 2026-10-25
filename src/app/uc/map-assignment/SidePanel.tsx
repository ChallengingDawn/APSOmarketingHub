"use client";

// MAP ASSIGNMENT - the panel on the left of the map (SARCLA 20.10.2026: "when you click a region it opens like a popup
// but full length on the left, where we can check the stats and we can change the assignment - from what it comes,
// Performis to HubSpot, which it populates"; "only the map - options and KPIs appear in a side panel"). Round 2, same
// day: "this menu is too confusing", "you should be able to see [everyone, no 'and 4 more']", and the model in two
// rules - "Rule 1 SAE Performis populates the properties as the workflow SARCLA | COMPANY/CONTACT OWNER COPY FROM
// PERFORMIS; I want to overrule rule 1 and give to another user. Zip codes are rule 2 - a fallback for companies and
// contacts the ERP has not sent yet - and this should be swappable. Starting point is always rule 1." So:
//   PlacePanel   a region, a postcode or a top customer: the figures; ONE table of every person, companies now ->
//                after the rules; how many each rule decides; Rule 1 here (each SAE -> person, overrule it); Rule 2
//                here (the postcode zones, swap them); what HubSpot gets; the biggest customers
//   KpiPanel     the country: the same table now -> after, the split by rule, the postcode land (rule 2) per person
//   SideShell    the frame: full height of the map, a title, a close button; a sheet over the map on a phone
// The country's rules (rule 1 overrules, rule 2 zones, people, key accounts) are OptionsPanel.tsx, in the same frame.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { compact as short, full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type OwnerId } from "@/lib/mapAssign/rules";
import type { MapData, PostcodeStat } from "@/lib/mapAssign/api";
import { OwnerPicker, Swatch, countryName, hsCompany, saeTarget, type Names, type Palette } from "./shared";
import { LAND } from "./mapDraw";
import { ranked, statValue, type Decided, type Joined, type LayerKey, type MapBase, type Priority, type ValueLayer } from "./mapModel";
import type { MapChange } from "./mapEdit";
import type { CountryMap } from "./MapPanel";

/* ── shared bits ── */

export type Target =
  | { kind: "cell"; cell: number; point: number; region: number; X: number; Y: number }
  | { kind: "region"; region: number; X: number; Y: number }
  | { kind: "marker"; i: number; X: number; Y: number };

/** Sequential blue, light to dark (dataviz reference ramp, steps 150 250 350 500 650). */
const RAMP = ["#b7d3f6", "#86b6ef", "#5598e7", "#256abf", "#104281"];
export const rampOf = (classes: number) => (classes >= RAMP.length ? RAMP : RAMP.filter((_, i) => i % Math.ceil(RAMP.length / classes) === 0 || i === RAMP.length - 1).slice(-classes));

export const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "owners", label: "Owners" }, { key: "revenue", label: "Revenue" }, { key: "customers", label: "Customers" },
  { key: "newCustomers", label: "New customers" }, { key: "priority", label: "Priority" }, { key: "gdp", label: "GDP" }, { key: "top", label: "Top customers" },
];

/** GDP as the engine gives it, in million EUR: "830 m EUR", "1.2 bn EUR". */
export const gdpText = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "unknown"
  : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)} bn EUR` : `${full(v)} m EUR`);
export const km2Text = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v > 0 && v < 10 ? `${v.toFixed(1)} km²` : `${full(v)} km²`);

const kicker = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const num = { fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
const RULE1 = "#6250d6", RULE2 = "#2a78d6";

function Section({ title, right, children }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ pt: 1.5, mt: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography component="div" sx={kicker}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** "Rule 1" / "Rule 2" as a small coloured tag. */
export function RuleTag({ n }: { n: 1 | 2 }) {
  return (
    <Box component="span" sx={{ display: "inline-block", px: 0.6, py: 0.1, mr: 0.75, borderRadius: "6px", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.04em", color: "#fff", bgcolor: n === 1 ? RULE1 : RULE2, verticalAlign: "1px" }}>
      RULE {n}
    </Box>
  );
}

function Tiles({ items }: { items: { label: string; value: string; tone?: "amber" }[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75, mt: 1.25 }}>
      {items.map((t) => (
        <Box key={t.label} sx={{ border: `1px solid ${t.tone ? "rgba(169,106,18,.3)" : HAIRLINE}`, bgcolor: t.tone ? "rgba(169,106,18,.06)" : "rgba(255,255,255,.7)", borderRadius: "12px", px: 1.25, py: 0.9 }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: t.tone ? "#8a560c" : INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{t.value}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{t.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Every person, companies now and after the rules, and the difference - one table, nobody left out. */
export function OwnerTable({ now, after, names, palette }: { now: Record<string, number>; after: Record<string, number>; names: Names; palette: Palette }) {
  const people = [...new Set([...Object.keys(now), ...Object.keys(after)])].filter((o) => (now[o] ?? 0) || (after[o] ?? 0))
    .sort((a, b) => (after[b] ?? 0) - (after[a] ?? 0) || (now[b] ?? 0) - (now[a] ?? 0) || names.name(a).localeCompare(names.name(b)));
  const cols = "14px minmax(0, 1fr) 58px 58px 54px";
  const n = { ...num, textAlign: "right" as const };
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, x) => a + x, 0);
  if (!people.length) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No company here.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.15 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.5, pb: 0.25 }}>
        <span />
        {["Person", "Now", "After", "±"].map((h, i) => <Typography key={h} sx={{ fontSize: "0.66rem", color: FAINT, fontWeight: 700, textAlign: i ? "right" : "left" }}>{h}</Typography>)}
      </Box>
      {people.map((o) => {
        const a = now[o] ?? 0, b = after[o] ?? 0, dd = b - a;
        return (
          <Box key={o || "nobody"} sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, alignItems: "center", px: 0.5, py: 0.4, borderRadius: "8px", "&:hover": { bgcolor: "rgba(21,34,58,.03)" } }}>
            {o ? <Swatch paint={palette(o)} /> : <Box sx={{ width: 12, height: 12, borderRadius: "3px", border: `1px dashed ${FAINT}` }} />}
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: o ? INK : MUTED, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o ? names.name(o) : "nobody"}</Typography>
            <Typography sx={n}>{full(a)}</Typography>
            <Typography sx={{ ...n, color: INK, fontWeight: 600 }}>{full(b)}</Typography>
            <Typography sx={{ ...n, fontWeight: dd ? 700 : 400, color: dd > 0 ? "#1b7a55" : dd < 0 ? "#b4232c" : FAINT }}>{dd > 0 ? `+${full(dd)}` : dd < 0 ? `−${full(-dd)}` : "—"}</Typography>
          </Box>
        );
      })}
      <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.5, pt: 0.5, mt: 0.25, borderTop: `1px solid ${HAIRLINE}` }}>
        <span />
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>Total</Typography>
        <Typography sx={n}>{full(sum(now))}</Typography>
        <Typography sx={n}>{full(sum(after))}</Typography>
        <span />
      </Box>
      <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>Now = owner in HubSpot today. After = by the saved rules.</Typography>
    </Box>
  );
}

/** How many companies each rule decides: rule 1 (SAE), rule 2 (postcode), and the exceptions. */
export function RuleSplit({ via }: { via: Record<string, number> | undefined }) {
  const v = via ?? {};
  const r1 = v.sae ?? 0, r2 = (v.zone ?? 0) + (v.default ?? 0), key = v.key ?? 0, red = v.redirection ?? 0;
  const total = r1 + r2 + key + red;
  if (!total) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Counted at the next scan.</Typography>;
  const pct = (x: number) => `${Math.round((100 * x) / total)}%`;
  const rows: [React.ReactNode, number, string][] = [
    [<><RuleTag n={1} />Performis SAE</>, r1, RULE1],
    [<><RuleTag n={2} />postcode - no SAE yet</>, r2, RULE2],
    ...(key ? [["key accounts", key, "#eda100"] as [React.ReactNode, number, string]] : []),
    ...(red ? [["kept by an Owner redirection rule", red, "#e87ba4"] as [React.ReactNode, number, string]] : []),
  ];
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Box sx={{ display: "flex", height: 8, borderRadius: "4px", overflow: "hidden", bgcolor: "rgba(21,34,58,.06)" }}>
        {rows.map(([, x, c], i) => <Box key={i} sx={{ width: pct(x), bgcolor: c }} />)}
      </Box>
      {rows.map(([label, x], i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography component="div" sx={{ fontSize: "0.8rem", color: INK, flex: 1 }}>{label}</Typography>
          <Typography sx={num}>{full(x)} · {pct(x)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Pick a person and give: one line (the chip cloud of v3 was "too confusing"). */
export function GiveRow({ names, label, onGive, people }: { names: Names; label: string; onGive: (owner: string) => void; people?: string[] }) {
  const [who, setWho] = useState<string>("");
  void people;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{label}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        <OwnerPicker value={who || null} onChange={(v) => setWho(String(v ?? ""))} names={names} placeholder="pick a person" sx={{ flex: 1, minWidth: 0 }} />
        <Button variant="contained" size="small" disabled={!who} onClick={() => onGive(who)} disableElevation sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", flexShrink: 0 }}>Give</Button>
      </Box>
    </Box>
  );
}

/** The frame: the full height of the map, on its left; a sheet over all of it on a phone. */
export function SideShell({ title, sub, onClose, children, label }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; label: string }) {
  return (
    <Box role="dialog" aria-label={label} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      sx={{
        position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 6, width: { xs: "100%", sm: 400 }, maxWidth: "100%",
        bgcolor: "rgba(255,255,255,.98)", borderRight: `1px solid ${HAIRLINE}`, boxShadow: "8px 0 30px rgba(31,45,78,.12)",
        display: "flex", flexDirection: "column", minHeight: 0,
      }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 2, pt: 1.75, pb: 1.25, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h2" sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>{title}</Typography>
          {sub && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>{sub}</Typography>}
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close the panel" sx={{ mt: -0.25, mr: -0.75 }}><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 2.5 }}>{children}</Box>
    </Box>
  );
}

/* ── rule 1 here: each SAE -> its person, overrule it ── */

function Rule1Here({ cc, rules, sae, names, palette, onRedirect }: {
  cc: string; rules: AssignRules; sae: [string, number][]; names: Names; palette: Palette;
  onRedirect?: (sae: string, owner: OwnerId | null) => void;
}) {
  const rule = rules.countries[cc];
  const off = rule?.source === "map";
  const values = sae.filter(([s]) => s);
  const none = sae.find(([s]) => !s)?.[1] ?? 0;
  if (off) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Rule 1 is off in {countryName(cc)}: the postcodes decide every company here. Switch it on in Rules.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      {values.map(([s, n]) => {
        const t = saeTarget(rules, cc, s);
        const tk = Object.keys(rules.sae).find((k) => saeKey(k) === saeKey(s));
        const table = tk !== undefined ? rules.sae[tk] : null;
        const goes = t.how === "table" || t.how === "redirect" ? t.owner : null;
        const falls = t.how === "unmapped" ? "no person for this SAE - rule 2 decides" : t.how === "not-in-country" ? `${names.name(t.owner)} does not work ${countryName(cc)} - rule 2 decides` : null;
        return (
          <Box key={s} sx={{ border: `1px solid ${t.how === "redirect" ? "rgba(98,80,214,.35)" : HAIRLINE}`, bgcolor: t.how === "redirect" ? "rgba(98,80,214,.05)" : "transparent", borderRadius: "10px", px: 1, py: 0.75, display: "grid", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s}>SAE &quot;{s}&quot;</Typography>
              <Typography sx={num}>{full(n)} {n === 1 ? "company" : "companies"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>→</Typography>
              {goes ? <Swatch paint={palette(goes)} size={11} /> : null}
              {onRedirect ? (
                <OwnerPicker value={t.how === "redirect" ? t.owner ?? "" : ""} names={names} allowEmpty
                  placeholder={table ? `${names.name(table)} (the SAE table)` : "nobody - rule 2"} onChange={(o) => onRedirect(s, o || null)} sx={{ flex: 1, minWidth: 0 }} />
              ) : (
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: goes ? INK : MUTED }}>{goes ? names.name(goes) : "rule 2"}</Typography>
              )}
            </Box>
            {t.how === "redirect" && <Typography sx={{ fontSize: "0.72rem", color: RULE1, fontWeight: 600 }}>Overruled in {countryName(cc)}: {names.name(t.owner)} instead of {table ? names.name(table) : "the workflow"}</Typography>}
            {falls && <Typography sx={{ fontSize: "0.72rem", color: "#a96a12" }}>{falls}</Typography>}
          </Box>
        );
      })}
      {none > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{full(none)} {none === 1 ? "company has" : "companies have"} no SAE yet - rule 2 below.</Typography>}
      {!sae.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>The company figures come with the engine&apos;s scans.</Typography>}
      {onRedirect && values.length > 0 && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>Pick a person to overrule an SAE in {countryName(cc)} only. Save keeps it.</Typography>}
    </Box>
  );
}

function HubSpotGets({ cc, d }: { cc: string; d: MapData }) {
  const live = !!d.live[cc];
  return (
    <Box sx={{ bgcolor: "rgba(36,89,209,.05)", border: "1px solid rgba(36,89,209,.15)", borderRadius: "10px", px: 1.25, py: 1, display: "grid", gap: 0.4 }}>
      <Typography sx={{ fontSize: "0.78rem", color: INK }}>
        The person goes to the company&apos;s <b>owner</b> and <b>region responsibility</b>, and to each contact&apos;s <b>owner</b>, <b>region responsibility</b> and <b>SAE</b>.
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {live ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{live ? "written by the hub every 15 minutes, only what differs" : `nothing is written yet - ${countryName(cc)} goes live on Live`}</Typography>
      </Box>
    </Box>
  );
}

/* ── a place on the map ── */

export function PlacePanel({ target, base, m, joined, names, palette, cc, rules, d, canGive, people, why, onGive, onRegion, onFly, decided, onRedirect, onClose }: {
  target: Target; base: MapBase; m: CountryMap; joined: Joined | null; names: Names; palette: Palette; cc: string; rules: AssignRules; d: MapData;
  canGive: boolean; people?: string[];
  why: (p: Decided | undefined, region: number) => string;
  onGive: (change: MapChange, owner: string, what: string) => void; onRegion: (region: number) => void; onFly: (point: number) => void;
  decided: (point: number) => Decided | undefined;
  onRedirect?: (sae: string, owner: OwnerId | null) => void;
  onClose: () => void;
}) {
  const rule: CountryRule | undefined = rules.countries[cc];
  const rule1Off = rule?.source === "map";
  const body = (s: PostcodeStat | null, zones: React.ReactNode, place: string) => {
    if (!joined) return <>{zones}<Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1.5 }}>The company figures come with the engine&apos;s scans.</Typography></>;
    const change = s?.change ?? 0;
    return (
      <>
        <Tiles items={[
          { label: "companies", value: full(s?.companies ?? 0) },
          { label: "bought this year", value: full(s?.customers ?? 0) },
          { label: "new this year", value: full(s?.newCustomers ?? 0) },
          { label: "revenue this year (EUR)", value: short(s?.revenue ?? 0) },
        ]} />
        <Section title={`Owners in ${place}`} right={change ? <Chip tint="amber">{full(change)} to change</Chip> : <Chip tint="green">all right</Chip>}>
          <OwnerTable now={s?.now ?? {}} after={s?.decided ?? {}} names={names} palette={palette} />
        </Section>
        <Section title="Which rule decides">
          <RuleSplit via={s?.via} />
        </Section>
        <Section title={<><RuleTag n={1} />Performis SAE here</>}>
          <Rule1Here cc={cc} rules={rules} sae={ranked(s?.sae)} names={names} palette={palette} onRedirect={canGive ? onRedirect : undefined} />
        </Section>
        {zones}
        <Section title="What HubSpot gets">
          <HubSpotGets cc={cc} d={d} />
        </Section>
      </>
    );
  };
  const rule2Note = rule1Off ? "Rule 1 is off here: the postcodes decide every company." : "Only for companies without an SAE yet (new ones the ERP has not sent). Once the ERP sends an SAE, rule 1 takes over.";
  const tops = (region: number | null, point: number | null) => {
    if (!joined) return null;
    const list = joined.top.filter((t) => (point !== null ? base.points[t.point].cell === base.points[point].cell : base.points[t.point].region === region)).slice(0, 5);
    if (!list.length) return null;
    return (
      <Section title="Biggest customers here">
        {list.map((t) => (
          <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            {t.owner ? <Swatch paint={palette(t.owner)} size={11} /> : <Box sx={{ width: 11 }} />}
            <Box component="a" href={hsCompany(t.id)} target="_blank" rel="noreferrer"
              sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { color: "#2459d1" } }}>
              {t.name}
            </Box>
            <Typography sx={num}>{short(t.revenue)}</Typography>
          </Box>
        ))}
      </Section>
    );
  };
  const zoneRows = (rows: [string, number][]) => (
    <Box sx={{ display: "grid", gap: 0.35 }}>
      {rows.map(([o, n]) => (
        <Box key={o} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Swatch paint={palette(o)} />
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, flex: 1 }}>{names.name(o)}</Typography>
          <Typography sx={num}>{full(n)} postcode{n === 1 ? "" : "s"}</Typography>
        </Box>
      ))}
    </Box>
  );

  if (target.kind === "region") {
    const r = base.regions[target.region];
    const rt = m.tally.regions[target.region];
    const s = joined?.regions[target.region] ?? null;
    const group = r.group ? base.regions.filter((x) => x.group === r.group) : [];
    const zones = (
      <Section title={<><RuleTag n={2} />Postcode zones here</>}>
        {zoneRows((rt?.owners ?? []).map(([o, n]) => [String(o), n] as [string, number]))}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{rule2Note}</Typography>
        {canGive && (
          <>
            <GiveRow names={names} people={people} label={`Swap all of ${r.name} to`} onGive={(o) => onGive({ kind: "regions", regions: [r.code] }, o, `All of ${r.name}`)} />
            {group.length > 1 && (
              <GiveRow names={names} people={people} label={`Or all of ${r.group} (${group.length} regions) to`}
                onGive={(o) => onGive({ kind: "regions", regions: group.map((x) => x.code) }, o, `All of ${r.group}`)} />
            )}
          </>
        )}
      </Section>
    );
    return (
      <SideShell label={`${r.name} on the map`} title={r.name} sub={[r.code, km2Text(r.km2), `${full(rt?.total ?? 0)} postcodes`].join(" · ")} onClose={onClose}>
        {body(s, zones, r.name)}
        {tops(target.region, null)}
      </SideShell>
    );
  }

  if (target.kind === "cell") {
    const pts = base.cells[target.cell];
    const p = base.points[pts[0]];
    const dd = decided(pts[0]);
    const region = target.region >= 0 ? base.regions[target.region] : null;
    const s = joined?.cells[target.cell] ?? null;
    const what = pts.length > 1 ? `${p.zip} and ${pts.length - 1} more` : `${p.zip}${p.place ? ` ${p.place}` : ""}`;
    const zones = (
      <Section title={<><RuleTag n={2} />Postcode zone</>}>
        {dd && zoneRows([[String(dd.owner), pts.length]])}
        {dd && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Why: {why(dd, target.region)}. {rule2Note}</Typography>}
        {canGive && (
          <>
            <GiveRow names={names} people={people} label={pts.length > 1 ? `Swap these ${pts.length} postcodes to` : `Swap ${p.zip} to`}
              onGive={(o) => onGive({ kind: "postcodes", zips: pts.map((i) => base.points[i].zip) }, o, what)} />
            {region && (
              <Box component="button" type="button" onClick={() => onRegion(target.region)}
                sx={{ all: "unset", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#2459d1", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
                Or all of {region.name} →
              </Box>
            )}
          </>
        )}
      </Section>
    );
    return (
      <SideShell label={`${p.zip} on the map`} title={`${p.zip}${p.place ? ` ${p.place}` : ""}`}
        sub={[region?.name, km2Text(pts.reduce((a, i) => a + base.points[i].km2, 0)), pts.length > 1 ? `with ${pts.slice(1, 6).map((i) => base.points[i].zip).join(", ")}${pts.length > 6 ? "…" : ""}` : null].filter(Boolean).join(" · ")}
        onClose={onClose}>
        {body(s, zones, p.zip)}
        {tops(null, pts[0])}
      </SideShell>
    );
  }

  const c = joined?.top[target.i];
  if (!c) return null;
  const p = base.points[c.point];
  const dd = decided(c.point);
  return (
    <SideShell label={`${c.name} on the map`} title={c.name} sub={`${p.zip}${p.place ? ` ${p.place}` : ""} · revenue this year ${short(c.revenue)}`} onClose={onClose}>
      <Section title="Owner in HubSpot now">
        {c.owner ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Swatch paint={palette(c.owner)} size={13} /><Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{names.name(c.owner)}</Typography></Box>
        ) : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>nobody</Typography>}
        {dd && String(dd.owner) !== String(c.owner ?? "") && (
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Its postcode zone (rule 2) is {names.name(String(dd.owner))}&apos;s ({why(dd, p.region)}){rule1Off ? "" : "; its SAE (rule 1) decides first"}.</Typography>
        )}
      </Section>
      <Box sx={{ display: "flex", gap: 1.5, mt: 1.5 }}>
        <Box component="a" href={hsCompany(c.id)} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.82rem", fontWeight: 600, color: "#2459d1", textDecoration: "none" }}>
          HubSpot <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Box>
        <Box component="button" type="button" onClick={() => onFly(c.point)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#2459d1" }}>Zoom to it</Box>
      </Box>
    </SideShell>
  );
}

/* ── the country's KPIs ── */

const layerTitle: Record<LayerKey, string> = {
  owners: "Postcode land", revenue: "Revenue this year", customers: "Customers this year", newCustomers: "New customers this year",
  priority: "Sales priority", gdp: "GDP per region", top: "Top customers",
};

/** The country now and after: after = the rules' decision per person; now = after, less what comes, plus what goes. */
export function nowAfter(d: MapData, cc: string): { now: Record<string, number>; after: Record<string, number> } {
  const after: Record<string, number> = {};
  for (const b of d.countries.find((c) => c.country === cc)?.byOwner ?? []) after[String(b.owner)] = (after[String(b.owner)] ?? 0) + b.companies;
  const now: Record<string, number> = { ...after };
  for (const mv of d.moves) {
    if (mv.country !== cc || String(mv.from ?? "") === String(mv.to)) continue;
    now[String(mv.to)] = (now[String(mv.to)] ?? 0) - mv.companies;
    const f = String(mv.from ?? "");
    now[f] = (now[f] ?? 0) + mv.companies;
  }
  for (const k of Object.keys(now)) if (now[k] <= 0) delete now[k];
  return { now, after };
}

export function KpiPanel({ cc, d, names, palette, layer, people, hl, setHl, base, joined, values, prio, m, rule, layersAt, revenueField, onTop, onClose }: {
  cc: string; d: MapData; names: Names; palette: Palette; layer: LayerKey;
  people: { owner: string; postcodes: number; km2: number; companies: number }[]; hl: string | null; setHl: (o: string | null) => void;
  base: MapBase; joined: Joined | null; values: { unit: "region" | "postcode"; thresholds: number[] } | null; prio: Priority; m: CountryMap;
  rule: CountryRule | undefined; layersAt: string | null; revenueField: string | null; onTop: (t: Joined["top"][number]) => void; onClose: () => void;
}) {
  const s = d.countries.find((c) => c.country === cc);
  const na = useMemo(() => nowAfter(d, cc), [d, cc]);
  const move = useMemo(() => d.moves.filter((x) => x.country === cc && String(x.from ?? "") !== String(x.to)).reduce((a, x) => a + x.companies, 0), [d.moves, cc]);
  const live = !!d.live[cc];
  return (
    <SideShell label={`${countryName(cc)} in figures`} title={countryName(cc)}
      sub={<>{rule?.source === "map" ? "rule 1 off - the postcodes decide" : "rule 1 SAE, then rule 2 postcode"} · {live ? "LIVE" : "shadow"}{d.last ? ` · scan ${when(d.last.at)}` : ""}</>} onClose={onClose}>
      <Tiles items={[
        { label: "companies", value: full(s?.companies ?? 0) },
        { label: "would change owner", value: full(move), tone: move ? "amber" : undefined },
      ]} />
      <Section title="Owners - companies now and after the rules">
        <OwnerTable now={na.now} after={na.after} names={names} palette={palette} />
      </Section>
      <Section title="Which rule decides">
        <RuleSplit via={s?.byVia} />
      </Section>
      <Section title={layer === "owners" || layer === "top" ? <><RuleTag n={2} />Postcode land per person</> : layerTitle[layer]}>
        <Legend layer={layer} people={people} names={names} palette={palette} hl={hl} setHl={setHl} m={m} base={base} joined={joined} values={values}
          prio={prio} cc={cc} rule={rule} layersAt={layersAt} revenueField={revenueField} onTop={onTop} />
      </Section>
    </SideShell>
  );
}

function Legend({ layer, people, names, palette, hl, setHl, m, base, joined, values, prio, cc, layersAt, revenueField, onTop }: {
  layer: LayerKey; people: { owner: string; postcodes: number; km2: number; companies: number }[]; names: Names; palette: Palette;
  hl: string | null; setHl: (o: string | null) => void; m: CountryMap; base: MapBase; joined: Joined | null;
  values: { unit: "region" | "postcode"; thresholds: number[] } | null; prio: Priority; cc: string;
  rule: CountryRule | undefined; layersAt: string | null; revenueField: string | null; onTop: (t: Joined["top"][number]) => void;
}) {
  const asOf = layersAt ? ` As of the scan of ${new Date(layersAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : "";
  const unplaced = joined && joined.unplaced ? ` ${full(joined.unplaced)} companies are not on the map (no postcode the map knows).` : "";

  if (layer === "owners" || (layer === "top" && !joined)) {
    // the land of rule 2: postcodes and km² - the companies are in the table above
    const land = people.filter((p) => p.postcodes > 0);
    const tot = land.reduce((a, p) => ({ postcodes: a.postcodes + p.postcodes, km2: a.km2 + p.km2 }), { postcodes: 0, km2: 0 });
    const cols = "14px minmax(0, 1fr) 70px 70px";
    const n = { ...num, textAlign: "right" as const };
    return (
      <Box sx={{ display: "grid", gap: 0.15 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.5, pb: 0.25 }}>
          <span />
          {["Person", "Postcodes", "km²"].map((h, i) => <Typography key={h} sx={{ fontSize: "0.66rem", color: FAINT, fontWeight: 700, textAlign: i ? "right" : "left" }}>{h}</Typography>)}
        </Box>
        {land.map((p) => {
          const on = hl === p.owner;
          return (
            <Box key={p.owner} component="button" type="button" onClick={() => setHl(on ? null : p.owner)} aria-pressed={on}
              sx={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: cols, gap: 0.75, alignItems: "center", px: 0.5, py: 0.45, borderRadius: "8px",
                bgcolor: on ? "rgba(36,89,209,.08)" : "transparent", opacity: hl && !on ? 0.55 : 1, "&:hover": { bgcolor: "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
              <Swatch paint={palette(p.owner)} size={12} />
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names.name(p.owner)}</Typography>
              <Typography sx={n}>{full(p.postcodes)}</Typography>
              <Typography sx={n}>{p.km2 > 0 && p.km2 < 10 ? p.km2.toFixed(1) : full(p.km2)}</Typography>
            </Box>
          );
        })}
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.5, pt: 0.5, mt: 0.25, borderTop: `1px solid ${HAIRLINE}` }}>
          <span />
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>{countryName(cc)}</Typography>
          <Typography sx={n}>{full(tot.postcodes)}</Typography>
          <Typography sx={n}>{full(base.km2 ?? tot.km2)}</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>
          Who holds which postcodes{m.moved !== null ? " (your edits included)" : ""} - only used for companies without an SAE. Click a person to pick out their land on the map.
        </Typography>
      </Box>
    );
  }

  if (layer === "top" && joined) {
    return (
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {joined.top.slice(0, 15).map((t, i) => {
          const p = base.points[t.point];
          return (
            <Box key={`${t.id}-${i}`} component="button" type="button" onClick={() => onTop(t)}
              sx={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", gap: 1, alignItems: "center", px: 0.75, py: 0.5, borderRadius: "10px", "&:hover": { bgcolor: "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
              <Typography sx={{ fontSize: "0.74rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.zip}{p.place ? ` ${p.place}` : ""} · {t.owner ? names.name(t.owner) : "no owner"}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{short(t.revenue)}</Typography>
            </Box>
          );
        })}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>The biggest customers by revenue this year, a dot each (bigger = more). Owner = HubSpot today.{unplaced}{asOf}</Typography>
      </Box>
    );
  }

  const t = values?.thresholds ?? [];
  const ramp = rampOf(t.length + 1);
  const fmt = (v: number) => (layer === "gdp" ? gdpText(v) : layer === "revenue" ? short(v) : full(v));
  const rows = ramp.map((c, i) => {
    const lo = i === 0 ? null : t[i - 1], hi = i < t.length ? t[i] : null;
    const label = lo === null && hi === null ? "more than 0" : lo === null ? `under ${fmt(hi!)}` : hi === null ? `${fmt(lo)} or more` : `${fmt(lo)} to under ${fmt(hi)}`;
    return { c, label };
  });
  const total = joined ? (layer === "gdp" ? joined.gdp.reduce<number>((a, v) => a + (v ?? 0), 0) : statValue(joined.total, layer as ValueLayer, prio)) : null;
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      {rows.map((r) => (
        <Box key={r.c} sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
          <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: r.c, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.label}</Typography>
        </Box>
      ))}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
        <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: LAND, border: `1px solid ${HAIRLINE}`, flexShrink: 0 }} />
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{layer === "gdp" ? "unknown" : "none"}</Typography>
      </Box>
      {total !== null && <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.5, px: 0.5 }}>{countryName(cc)}: <b>{fmt(total)}</b>{layer === "priority" ? ` ${prio}` : ""}</Typography>}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>
        {values?.unit === "postcode" ? "Per postcode" : "Per region"}; darker = more.{layer === "revenue" && revenueField ? ` From ${revenueField}.` : ""}{layer !== "gdp" ? unplaced : ""}{asOf}
      </Typography>
    </Box>
  );
}
