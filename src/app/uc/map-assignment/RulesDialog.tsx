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
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type Zone } from "@/lib/mapAssign/rules";
import type { CompanyRow, MapData } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, PeoplePicker, Swatch, canon, countryList, countryName, emptyRule, hsCompany, newId, prefixProblem, saeTarget, splitPrefixes,
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
};
type Mode = "rules" | "kpi";
const hint = { fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 };
const head = { fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const row = { display: "grid", gap: 1.25, alignItems: "center", px: 1.25, py: 0.9, borderBottom: `1px solid ${HAIRLINE}` };
const numSx = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: { xs: "left", md: "right" } as const };

/* ── the SAE values (GET ?performis=1) ── */

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

function RulesTab({ cc, got, rules, d, setDraft, names, palette, admin, rev, m, mode, place }: {
  cc: string; got: Got; rules: AssignRules; d: MapData; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; rev: number;
  m: CountryMap; mode: Mode; place: Place | null;
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
  const layers = useLayers(cc);
  const joined = useMemo(() => (m.base && layers.data ? joinLayer(m.base, layers.data) : null), [m.base, layers.data]);
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
        <Typography sx={{ ...hint, flex: 1, minWidth: 220 }}>Each SAE goes to its person, as the workflow SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS.</Typography>
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
              const person = t.how === "table" || t.how === "redirect" ? t.owner : null;
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
                  {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0, pt: { md: 0.9 } }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={z.owner || null} names={names} palette={palette} over={over} empty="pick a person" /></Box>)}
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

  if (place) return <PlaceRules place={place} cc={cc} rules={rules} d={d} setDraft={setDraft} names={names} palette={palette} admin={admin} m={m} mode={mode} joined={joined} />;
  const na = kpi ? nowAfter(d, cc) : null;
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {na && (
        <Box sx={{ display: "grid", gap: 1, maxWidth: 640 }}>
          <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Owners in {c} - HubSpot now and with these rules</Typography>
          <OwnerTable now={na.now} after={na.after} names={names} palette={palette} />
        </Box>
      )}
      {rule1}
      {rule2}
    </Box>
  );
}

/* ── one place: its SAEs and its zip zones ── */

function PlaceRules({ place, cc, rules, d, setDraft, names, palette, admin, m, mode, joined }: {
  place: Place; cc: string; rules: AssignRules; d: MapData; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean;
  m: CountryMap; mode: Mode; joined: ReturnType<typeof joinLayer> | null;
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

  const r1 = kpi ? "minmax(150px, 1.2fr) 120px minmax(160px, 1fr)" : "minmax(150px, 1.1fr) 110px repeat(3, minmax(120px, 1fr)) minmax(200px, 1.2fr)";
  const r2 = kpi ? "minmax(140px, 1fr) minmax(160px, 1fr) 120px" : "minmax(140px, 1fr) repeat(3, minmax(120px, 1fr)) minmax(200px, 1.2fr) 110px";
  const zones = (rule?.zones ?? []).filter((z) => zonesHere.has(z.id));
  const restHere = zonesHere.get("") ?? 0;
  const defaultPerson = rule?.defaultOwner || rules.defaultOwner;
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {kpi && st && (
        <Box sx={{ display: "grid", gap: 1, maxWidth: 640 }}>
          <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Owners in {place.title} - HubSpot now and with these rules</Typography>
          <OwnerTable now={st.now ?? {}} after={st.decided ?? {}} names={names} palette={palette} />
        </Box>
      )}
      <Box sx={{ display: "grid", gap: 1 }}>
        <Typography component="h3" sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}><RuleTag n={1} />Performis SAE in {place.title}</Typography>
        {off ? <Typography sx={hint}>Rule 1 is off in {c}: rule 2 decides every company.</Typography>
          : !joined ? <Typography sx={hint}>The companies of {place.title} come with the engine&apos;s scans.</Typography> : (
          <Table cols={r1} heads={kpi ? ["SAE Performis", <Box key="c" sx={{ textAlign: "right" }}>Companies here</Box>, "After"] : ["SAE Performis", <Box key="c" sx={{ textAlign: "right" }}>Companies here</Box>, ...PROPS, `Override (all of ${c})`]}>
            {saes.map(([sae, n]) => {
              const t = saeTarget(rules, cc, sae);
              const person = t.how === "table" || t.how === "redirect" ? t.owner : null;
              const over = t.how === "redirect";
              const wf = tableOf(sae);
              return (
                <Box key={sae} sx={{ ...row, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: r1 }, bgcolor: over ? "rgba(98,80,214,.05)" : "transparent" }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sae}>{sae}</Typography>
                  <Typography sx={numSx}>{full(n)}</Typography>
                  {kpi ? <Who owner={person} names={names} palette={palette} over={over} empty="rule 2" /> : (
                    <>
                      {PROPS.map((pp) => <Box key={pp} sx={{ minWidth: 0 }}><Box component="span" sx={{ display: { md: "none" }, fontSize: "0.7rem", color: FAINT }}>{pp}: </Box><Who owner={person} names={names} palette={palette} over={over} empty="rule 2 (zip)" /></Box>)}
                      <OwnerPicker value={over ? t.owner ?? "" : ""} names={names} disabled={!admin} allowEmpty placeholder={wf ? `keep ${names.name(wf)}` : "pick someone"}
                        onChange={(o) => setRule((r) => withOverride(r, sae, o || null))} />
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
        {admin && !kpi && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>Swap all zip codes of {place.title} to</Typography>
            <OwnerPicker value={swap || null} names={names} onChange={(o) => setSwap(String(o ?? ""))} placeholder="pick a person" sx={{ minWidth: 240 }} />
            <Button variant="contained" size="small" disableElevation disabled={!swap} onClick={() => { place.give(swap); setSwap(""); }} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Swap</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── key accounts: one row per customer, tick off or add by search ── */

type Key = NonNullable<CountryRule["keyAccounts"]>[number];

/** GET ?companies=1: the customers behind ERP ids, or a search. */
function useCompanies(params: string | null): { rows: CompanyRow[]; loading: boolean; error: string | null } {
  const [got, setGot] = useState<{ key: string; rows: CompanyRow[]; error: string | null } | null>(null);
  useEffect(() => {
    if (!params) return;
    let live = true;
    fetch(`${API}?companies=1&${params}`).then(async (r) => {
      const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: CompanyRow[]; error?: string } | null;
      if (live) setGot({ key: params, rows: j?.ok && Array.isArray(j.data) ? j.data : [], error: j?.ok ? null : j?.error ?? `HTTP ${r.status}` });
    }).catch((e) => { if (live) setGot({ key: params, rows: [], error: String(e) }); });
    return () => { live = false; };
  }, [params]);
  if (!params) return { rows: [], loading: false, error: null };
  return got && got.key === params ? { rows: got.rows, loading: false, error: got.error } : { rows: got?.rows ?? [], loading: true, error: null };
}

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
  const known = useCompanies(ids.length ? `erp=${encodeURIComponent(ids.join(","))}` : null);
  const byErp = useMemo(() => new Map(known.rows.map((r) => [String(r.erpId), r])), [known.rows]);
  const [q, setQ] = useState("");
  const [qq, setQq] = useState("");
  useEffect(() => { const t = window.setTimeout(() => setQq(q.trim()), 300); return () => window.clearTimeout(t); }, [q]);
  const found = useCompanies(qq.length >= 2 ? `q=${encodeURIComponent(qq)}&country=${cc}` : null);
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

export function RulesDialog({ open, onClose, cc, setCc, d, rules, setDraft, names, palette, rev, m, n, dirty, busy, check, msg, onSave, onUndo, seededNow, onSeeded, place, onWholeCountry }: {
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
}) {
  const [tab, setTab] = useState<Tab>("rules");
  useEffect(() => { if (place) setTab("rules"); }, [place]);
  const [mode, setMode] = useState<Mode>("rules");
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
            {d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
            {place && (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.25, pr: 0.5, py: 0.25, borderRadius: "999px", bgcolor: "#e6edfd", color: "#2459d1" }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{place.title}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#5b74b8" }}>{place.sub}</Typography>
                {onWholeCountry && <IconButton size="small" onClick={onWholeCountry} aria-label="Show the whole country" sx={{ color: "#2459d1", p: 0.25 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            {tab !== "people" && <PillGroup<Mode> name="Rules or KPI" small value={mode} onChange={setMode} options={[{ key: "rules", label: "Rules" }, { key: "kpi", label: "KPI" }]} />}
            <IconButton onClick={onClose} aria-label="Close the rules"><CloseIcon /></IconButton>
          </Box>
          <PillGroup<Tab> name="Jobs" value={tab} onChange={setTab} options={[
            { key: "rules", label: place ? `Rules of ${place.title}` : `Rules of ${c}` },
            { key: "keys", label: "Key accounts", count: keys.length ? String(keys.length) : null },
            { key: "people", label: `Who works ${c}`, count: (rule?.people ?? []).length ? String(rule!.people!.length) : null },
          ]} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2 }}>
          {tab === "rules" && <RulesTab key={`${cc}-${rev}`} cc={cc} got={got} rules={rules} d={d} setDraft={setDraft} names={names} palette={palette} admin={admin} rev={rev} m={m} mode={mode} place={place ?? null} />}
          {tab === "keys" && <KeysTab key={`${cc}-${rev}`} cc={cc} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} mode={mode} />}
          {tab === "people" && (
            <Box sx={{ display: "grid", gap: 1.5, maxWidth: 720 }}>
              <Typography sx={hint}>The people who work {c}. An SAE whose person is not in this list is not used in {c} - rule 2 (the postcodes) decides. Empty = anyone.</Typography>
              <PeoplePicker key={`${cc}-${rev}`} value={rule?.people ?? []} names={names} disabled={!admin} placeholder="anyone - pick who works this country"
                onChange={(people) => setRule((r) => { const x: CountryRule = { ...r, people }; if (!people.length) delete x.people; return x; })} />
            </Box>
          )}
        </Box>
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {dirty ? <Chip tint="amber">Unsaved changes - the map shows them</Chip> : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{admin ? "Nothing to save" : "Read only - admins change the rules"}</Typography>}
          {check.errors.length > 0 && <Typography sx={{ fontSize: "0.8rem", color: RED }}>{check.errors[0]}{check.errors.length > 1 ? ` (+${check.errors.length - 1})` : ""}</Typography>}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: msg.ok ? "#1b7a55" : RED }}>{msg.text}</Typography>}
          <Box sx={{ flex: 1 }} />
          {admin && !seededNow && <Button size="small" onClick={onSeeded} disabled={busy} sx={{ textTransform: "none", color: MUTED }}>Back to the workflows&apos; rules</Button>}
          {busy && <CircularProgress size={14} />}
          {admin && <Button disabled={!dirty || busy} onClick={onUndo} sx={{ textTransform: "none" }}>Undo</Button>}
          <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
          {admin && <Button variant="contained" disableElevation startIcon={<SaveOutlinedIcon />} disabled={!dirty || busy || check.errors.length > 0} onClick={onSave}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>Save</Button>}
        </Box>
      </Box>
    </Dialog>
  );
}
