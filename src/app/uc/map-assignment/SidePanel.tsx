"use client";

// MAP ASSIGNMENT - the panel on the left of the map (SARCLA 20.10.2026: "when you click a region it opens like a popup
// but full length on the left, where we can check the stats and we can change the assignment - from what it comes,
// Performis to HubSpot, which it populates"; "only the map - options and KPIs appear in a side panel"). What it holds:
//   PlacePanel   a region, a postcode or a top customer: its figures, who has it now and by the rules, give it to
//                someone (the zones), where it comes from (the Performis SAE -> the person -> what HubSpot gets) and
//                a redirect of an SAE for this country, the biggest customers there
//   KpiPanel     the country: companies, what would change, shadow or live, and the legend of the layer on screen
//   SideShell    the frame: full height of the map, a title, a close button; a sheet over the map on a phone
// The country's options (who decides, people, SAE, zones) are OptionsPanel.tsx, in the same frame.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { compact as short, full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import type { AssignRules, CountryRule, OwnerId } from "@/lib/mapAssign/rules";
import type { MapData, PostcodeStat } from "@/lib/mapAssign/api";
import { OwnerPicker, Swatch, countryName, hsCompany, saeTarget, type Names, type Palette, type SaeTarget } from "./shared";
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

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ pt: 1.5, mt: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography sx={kicker}>{title}</Typography>
        {right}
      </Box>
      {children}
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

/** People with a count each, biggest first, and their share. */
function PeopleRows({ rows, names, palette, unit, max = 5 }: { rows: [string, number][]; names: Names; palette: Palette; unit?: string; max?: number }) {
  const total = rows.reduce((s, [, n]) => s + n, 0);
  if (!rows.length) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>None.</Typography>;
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      {rows.slice(0, max).map(([o, n]) => (
        <Box key={o || "nobody"} sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          {o ? <Swatch paint={palette(o)} /> : <Box sx={{ width: 12, height: 12, borderRadius: "3px", border: `1px dashed ${FAINT}`, flexShrink: 0 }} />}
          <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: o ? INK : MUTED, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o ? names.name(o) : "nobody"}</Typography>
          <Typography sx={num}>{full(n)}{unit ? ` ${unit}` : ""} · {Math.round((100 * n) / Math.max(1, total))}%</Typography>
        </Box>
      ))}
      {rows.length > max && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>and {rows.length - max} more</Typography>}
    </Box>
  );
}

export function GiveRow({ names, label, onGive, people }: { names: Names; label: string; onGive: (owner: string) => void; people?: string[] }) {
  const [who, setWho] = useState<string>("");
  const known = (people ?? []).map(String).filter((p) => names.active(p));
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{label}</Typography>
      {known.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {known.map((p) => (
            <Box key={p} component="button" type="button" onClick={() => setWho(p)} aria-pressed={who === p}
              sx={{ all: "unset", cursor: "pointer", px: 1, py: 0.35, borderRadius: "999px", fontSize: "0.76rem", fontWeight: 600, border: `1px solid ${who === p ? "#2459d1" : HAIRLINE}`, color: who === p ? "#2459d1" : MUTED, bgcolor: who === p ? "rgba(36,89,209,.08)" : "#fff", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
              {names.name(p)}
            </Box>
          ))}
        </Box>
      )}
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

/* ── where it comes from ── */

const PROPS_COMPANY = [["Owner", "hubspot_owner_id"], ["Region responsibility", "region_responsibility"]] as const;
const PROPS_CONTACT = [["Owner", "hubspot_owner_id"], ["Region responsibility", "region_responsibility"], ["SAE (Performis)", "sae_performis"]] as const;

function howText(t: SaeTarget, cc: string, names: Names): string {
  const c = countryName(cc);
  if (t.how === "map") return `the map decides in ${c} - the SAE is not used`;
  if (t.how === "unmapped") return "not in the SAE table - the zones decide";
  if (t.how === "not-in-country") return `${names.name(t.owner)} does not work ${c} - the zones decide`;
  if (t.how === "redirect") return `redirected in ${c}`;
  return "the SAE table";
}

function Source({ cc, rules, d, sae, names, palette, onRedirect }: {
  cc: string; rules: AssignRules; d: MapData; sae: [string, number][]; names: Names; palette: Palette;
  onRedirect?: (sae: string, owner: OwnerId | null) => void;
}) {
  const rule = rules.countries[cc];
  const isMap = rule?.source === "map";
  const [edit, setEdit] = useState<string | null>(null);
  const live = !!d.live[cc];
  return (
    <>
      <Typography sx={{ fontSize: "0.8rem", color: INK }}>
        {isMap ? <>In {countryName(cc)} <b>the map decides</b>: key accounts, then the postcode zones. The Performis SAE is shown, never copied.</>
          : <>In {countryName(cc)} <b>the Performis SAE decides</b> (the ERP brings it every morning). No SAE, or one the table does not know: the postcode zones.</>}
      </Typography>
      <Box sx={{ display: "grid", gap: 0.6 }}>
        {sae.slice(0, 8).map(([s, n]) => {
          const t = s ? saeTarget(rules, cc, s) : null;
          const goes = t && (t.how === "table" || t.how === "redirect") ? t.owner : null;
          const local = t?.how === "redirect" ? t.owner : null;
          return (
            <Box key={s || "none"} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", px: 1, py: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: s ? INK : MUTED, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s}>
                  {s ? `SAE "${s}"` : "no SAE"}
                </Typography>
                <Typography sx={num}>{full(n)}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.4, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>→</Typography>
                {goes ? <><Swatch paint={palette(goes)} size={11} /><Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{names.name(goes)}</Typography></>
                  : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{isMap || !s ? "the postcode zones" : "the zones"}</Typography>}
                {onRedirect && s && !isMap && (
                  <IconButton size="small" onClick={() => setEdit(edit === s ? null : s)} aria-label={`Redirect SAE ${s} in ${countryName(cc)}`} sx={{ ml: "auto", p: 0.25 }}>
                    <EditOutlinedIcon sx={{ fontSize: 15, color: MUTED }} />
                  </IconButton>
                )}
              </Box>
              {t && <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.2 }}>{howText(t, cc, names)}</Typography>}
              {edit === s && onRedirect && (
                <Box sx={{ mt: 0.75, display: "grid", gap: 0.4 }}>
                  <OwnerPicker value={local ?? ""} names={names} allowEmpty placeholder="no redirect - the SAE table" onChange={(o) => onRedirect(s, o || null)} />
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>Only {countryName(cc)} changes; the SAE table stays. Save keeps it.</Typography>
                </Box>
              )}
            </Box>
          );
        })}
        {sae.length > 8 && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>and {sae.length - 8} more SAE values - all of them on Options</Typography>}
        {!sae.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No company figures here yet.</Typography>}
      </Box>
      <Box sx={{ bgcolor: "rgba(36,89,209,.05)", border: "1px solid rgba(36,89,209,.15)", borderRadius: "10px", px: 1.25, py: 1, display: "grid", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: INK }}>Then HubSpot gets</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: INK }}>
          <b>On the company:</b> {PROPS_COMPANY.map(([n, p]) => <span key={p}>{n} <code style={{ fontSize: "0.7rem", color: MUTED }}>{p}</code></span>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])}
        </Typography>
        <Typography sx={{ fontSize: "0.76rem", color: INK }}>
          <b>On each of its contacts:</b> {PROPS_CONTACT.map(([n, p]) => <span key={p}>{n} <code style={{ fontSize: "0.7rem", color: MUTED }}>{p}</code></span>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])} - the company&apos;s
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
          {live ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
            {live ? "written by the hub every 15 minutes, only what differs" : `nothing is written yet - ${countryName(cc)} goes live on Live`}
          </Typography>
        </Box>
      </Box>
    </>
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
  const isSae = !rule || rule.source === "sae";
  const statTiles = (s: PostcodeStat | null) => !joined ? [] : [
    { label: "companies", value: full(s?.companies ?? 0) },
    { label: "bought this year", value: full(s?.customers ?? 0) },
    { label: "new this year", value: full(s?.newCustomers ?? 0) },
    { label: "revenue this year (EUR)", value: short(s?.revenue ?? 0) },
  ];
  const figures = (s: PostcodeStat | null) => {
    if (!joined) return <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>The company figures come with the engine&apos;s scans.</Typography>;
    const change = s?.change ?? 0;
    return (
      <>
        <Tiles items={statTiles(s)} />
        {s && (
          <>
            <Section title="Owner by the rules" right={change ? <Chip tint="amber">{full(change)} would change</Chip> : <Chip tint="green">all right</Chip>}>
              <PeopleRows rows={ranked(s.decided)} names={names} palette={palette} />
            </Section>
            <Section title="Owner in HubSpot now">
              <PeopleRows rows={ranked(s.now)} names={names} palette={palette} />
            </Section>
          </>
        )}
      </>
    );
  };
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
  const zoneNote = isSae
    ? "The zones decide only companies without an SAE (or with one the table does not know). To move the others, redirect their SAE below."
    : null;

  if (target.kind === "region") {
    const r = base.regions[target.region];
    const rt = m.tally.regions[target.region];
    const s = joined?.regions[target.region] ?? null;
    const group = r.group ? base.regions.filter((x) => x.group === r.group) : [];
    return (
      <SideShell label={`${r.name} on the map`} title={r.name} sub={[r.code, km2Text(r.km2), `${full(rt?.total ?? 0)} postcodes`].join(" · ")} onClose={onClose}>
        {figures(s)}
        <Section title="Postcode zones here">
          <PeopleRows rows={(rt?.owners ?? []).map(([o, n]) => [String(o), n] as [string, number])} names={names} palette={palette} unit="postcodes" />
          {canGive && (
            <>
              <GiveRow names={names} people={people} label={`Give all of ${r.name} to`} onGive={(o) => onGive({ kind: "regions", regions: [r.code] }, o, `All of ${r.name}`)} />
              {group.length > 1 && (
                <GiveRow names={names} people={people} label={`Or all of ${r.group} (${group.length} regions) to`}
                  onGive={(o) => onGive({ kind: "regions", regions: group.map((x) => x.code) }, o, `All of ${r.group}`)} />
              )}
              {zoneNote && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{zoneNote}</Typography>}
            </>
          )}
        </Section>
        <Section title="Where it comes from">
          <Source cc={cc} rules={rules} d={d} sae={ranked(s?.sae)} names={names} palette={palette} onRedirect={canGive ? onRedirect : undefined} />
        </Section>
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
    return (
      <SideShell label={`${p.zip} on the map`} title={`${p.zip}${p.place ? ` ${p.place}` : ""}`}
        sub={[region?.name, km2Text(pts.reduce((a, i) => a + base.points[i].km2, 0)), pts.length > 1 ? `with ${pts.slice(1, 6).map((i) => base.points[i].zip).join(", ")}${pts.length > 6 ? "…" : ""}` : null].filter(Boolean).join(" · ")}
        onClose={onClose}>
        {figures(s)}
        <Section title="Postcode zone">
          {dd && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Swatch paint={palette(String(dd.owner))} size={13} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{names.name(String(dd.owner))}</Typography>
            </Box>
          )}
          {dd && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Why: {why(dd, target.region)}</Typography>}
          {canGive && (
            <>
              <GiveRow names={names} people={people} label={pts.length > 1 ? `Give these ${pts.length} postcodes to` : `Give ${p.zip} to`}
                onGive={(o) => onGive({ kind: "postcodes", zips: pts.map((i) => base.points[i].zip) }, o, what)} />
              {region && (
                <Box component="button" type="button" onClick={() => onRegion(target.region)}
                  sx={{ all: "unset", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#2459d1", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
                  Or all of {region.name} →
                </Box>
              )}
              {zoneNote && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{zoneNote}</Typography>}
            </>
          )}
        </Section>
        <Section title="Where it comes from">
          <Source cc={cc} rules={rules} d={d} sae={ranked(s?.sae)} names={names} palette={palette} onRedirect={canGive ? onRedirect : undefined} />
        </Section>
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
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Its postcode zone is {names.name(String(dd.owner))}&apos;s ({why(dd, p.region)}); {isSae ? "its SAE or a key account may still decide otherwise" : "a key account may still decide otherwise"}.</Typography>
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

/* ── the country's KPIs and the legend ── */

const layerTitle: Record<LayerKey, string> = {
  owners: "Who has what", revenue: "Revenue this year", customers: "Customers this year", newCustomers: "New customers this year",
  priority: "Sales priority", gdp: "GDP per region", top: "Top customers",
};

export function KpiPanel({ cc, d, names, palette, layer, people, hl, setHl, base, joined, values, prio, m, rule, layersAt, revenueField, onTop, onClose }: {
  cc: string; d: MapData; names: Names; palette: Palette; layer: LayerKey;
  people: { owner: string; postcodes: number; km2: number; companies: number }[]; hl: string | null; setHl: (o: string | null) => void;
  base: MapBase; joined: Joined | null; values: { unit: "region" | "postcode"; thresholds: number[] } | null; prio: Priority; m: CountryMap;
  rule: CountryRule | undefined; layersAt: string | null; revenueField: string | null; onTop: (t: Joined["top"][number]) => void; onClose: () => void;
}) {
  const s = d.countries.find((c) => c.country === cc);
  const move = useMemo(() => d.moves.filter((x) => x.country === cc && x.from !== x.to).reduce((a, x) => a + x.companies, 0), [d.moves, cc]);
  const live = !!d.live[cc];
  return (
    <SideShell label={`${countryName(cc)} in figures`} title={countryName(cc)}
      sub={<>{rule?.source === "map" ? "the map decides" : "the Performis SAE decides"} · {live ? "LIVE" : "shadow"}{d.last ? ` · scan ${when(d.last.at)}` : ""}</>} onClose={onClose}>
      <Tiles items={[
        { label: "companies", value: full(s?.companies ?? 0) },
        { label: "would change owner", value: full(move), tone: move ? "amber" : undefined },
        { label: "owner or region to fix", value: full(s?.change ?? 0) },
        { label: "bought this year", value: joined ? full(joined.total.customers) : "—" },
      ]} />
      <Box sx={{ mt: 1.5 }}>
        <Legend layer={layer} people={people} names={names} palette={palette} hl={hl} setHl={setHl} m={m} base={base} joined={joined} values={values}
          prio={prio} cc={cc} rule={rule} layersAt={layersAt} revenueField={revenueField} onTop={onTop} />
      </Box>
    </SideShell>
  );
}

function Legend({ layer, people, names, palette, hl, setHl, m, base, joined, values, prio, cc, rule, layersAt, revenueField, onTop }: {
  layer: LayerKey; people: { owner: string; postcodes: number; km2: number; companies: number }[]; names: Names; palette: Palette;
  hl: string | null; setHl: (o: string | null) => void; m: CountryMap; base: MapBase; joined: Joined | null;
  values: { unit: "region" | "postcode"; thresholds: number[] } | null; prio: Priority; cc: string;
  rule: CountryRule | undefined; layersAt: string | null; revenueField: string | null; onTop: (t: Joined["top"][number]) => void;
}) {
  const head = (text: string, right?: React.ReactNode) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 0.5 }}>
      <Typography sx={kicker}>{text}</Typography>
      {right}
    </Box>
  );
  const asOf = layersAt ? ` As of the scan of ${new Date(layersAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : "";
  const unplaced = joined && joined.unplaced ? ` ${full(joined.unplaced)} companies are not on the map (no postcode the map knows).` : "";

  if (layer === "owners" || (layer === "top" && !joined)) {
    const tot = people.reduce((a, p) => ({ postcodes: a.postcodes + p.postcodes, km2: a.km2 + p.km2, companies: a.companies + p.companies }), { postcodes: 0, km2: 0, companies: 0 });
    const cols = "14px minmax(0, 1fr) 52px 62px 64px";
    const n = { ...num, fontSize: "0.78rem", textAlign: "right" as const };
    return (
      <Box sx={{ display: "grid", gap: 0.4 }}>
        {head(layerTitle.owners, hl ? <Box component="button" type="button" onClick={() => setHl(null)} sx={{ all: "unset", cursor: "pointer", fontSize: "0.74rem", color: "#2459d1", fontWeight: 600 }}>Show everyone</Box> : undefined)}
        <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.75 }}>
          <span />
          {["Person", "Postcodes", "Companies", "km²"].map((h, i) => <Typography key={h} sx={{ fontSize: "0.66rem", color: FAINT, fontWeight: 600, textAlign: i ? "right" : "left" }}>{h}</Typography>)}
        </Box>
        {people.map((p) => {
          const on = hl === p.owner;
          return (
            <Box key={p.owner} component="button" type="button" onClick={() => setHl(on ? null : p.owner)} aria-pressed={on}
              sx={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: cols, gap: 0.75, alignItems: "center", px: 0.75, py: 0.55, borderRadius: "10px",
                bgcolor: on ? "rgba(36,89,209,.08)" : "transparent", opacity: hl && !on ? 0.55 : 1, "&:hover": { bgcolor: "rgba(21,34,58,.04)" }, "&:focus-visible": { outline: "2px solid #2459d1" } }}>
              <Swatch paint={palette(p.owner)} size={13} />
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names.name(p.owner)}</Typography>
              <Typography sx={n}>{full(p.postcodes)}</Typography>
              <Typography sx={n}>{full(p.companies)}</Typography>
              <Typography sx={n}>{p.km2 > 0 && p.km2 < 10 ? p.km2.toFixed(1) : full(p.km2)}</Typography>
            </Box>
          );
        })}
        {people.length > 1 && (
          <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, px: 0.75, pt: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
            <span />
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: MUTED }}>{countryName(cc)}</Typography>
            <Typography sx={n}>{full(tot.postcodes)}</Typography>
            <Typography sx={n}>{full(tot.companies)}</Typography>
            <Typography sx={n}>{full(base.km2 ?? tot.km2)}</Typography>
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>
          Postcodes and km²: each person&apos;s postcode zones{m.moved !== null ? ", your edits included" : ""}. Companies: what each one gets by the saved rules{rule?.source === "sae" || !rule ? " (the SAE first, the zones for the rest)" : ""}. Click a person to pick out their land.
        </Typography>
      </Box>
    );
  }

  if (layer === "top" && joined) {
    return (
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {head(layerTitle.top)}
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
  const per = values?.unit === "postcode" ? "per postcode" : "per region";
  const total = joined ? (layer === "gdp" ? joined.gdp.reduce<number>((a, v) => a + (v ?? 0), 0) : statValue(joined.total, layer as ValueLayer, prio)) : null;
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      {head(layer === "gdp" ? layerTitle.gdp : `${layerTitle[layer]}${layer === "priority" ? ` ${prio}` : ""} · ${per}`)}
      {rows.map((r) => (
        <Box key={r.c} sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.75 }}>
          <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: r.c, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.8rem", color: INK, fontVariantNumeric: "tabular-nums" }}>{r.label}</Typography>
        </Box>
      ))}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.75 }}>
        <Box sx={{ width: 22, height: 12, borderRadius: "3px", bgcolor: LAND, border: `1px solid ${HAIRLINE}`, flexShrink: 0 }} />
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{layer === "gdp" ? "unknown" : "none"}</Typography>
      </Box>
      {total !== null && <Typography sx={{ fontSize: "0.82rem", color: INK, mt: 0.5, px: 0.75 }}>{countryName(cc)}: <b>{fmt(total)}</b></Typography>}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>
        {layer === "revenue" && revenueField ? `From ${revenueField}. ` : ""}Darker = more; five about equal groups.{layer !== "gdp" ? unplaced : ""}{asOf}
      </Typography>
    </Box>
  );
}
