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
import type { MapData, PerformisData } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, PeoplePicker, Swatch, canon, countryList, countryName, emptyRule, newId, prefixProblem, saeTarget, splitIds, splitPrefixes,
  splitRegions, withOverride, type Names, type Palette, type SetDraft,
} from "./shared";
import { CountryMenu, PillGroup } from "./mapTabs";
import { OwnerTable, RuleTag, km2Text, nowAfter } from "./SidePanel";
import { useLayers, type CountryMap } from "./MapPanel";
import { joinLayer } from "./mapModel";

type Tab = "rules" | "keys" | "people" | "table";
type Mode = "rules" | "kpi";
const hint = { fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 };
const head = { fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const row = { display: "grid", gap: 1.25, alignItems: "center", px: 1.25, py: 0.9, borderBottom: `1px solid ${HAIRLINE}` };
const numSx = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: { xs: "left", md: "right" } as const };

/* ── the SAE values (GET ?performis=1) ── */

type Got = { state: "loading" } | { state: "ok"; data: PerformisData } | { state: "missing" } | { state: "error"; error: string };
function usePerformis(n: number): Got {
  const url = `${API}?performis=1${n ? `&n=${n}` : ""}`;
  const held = useHeld<PerformisData>(url, [url]);
  const r = held.result;
  if (r === null) return { state: "loading" };
  if (r.state === "ok") { const x = r.data as Partial<PerformisData> | null; return x && Array.isArray(x.sae) ? { state: "ok", data: x as PerformisData } : { state: "missing" }; }
  if (r.state === "error" && (r.status === 404 || r.status === 400)) return { state: "missing" };
  return { state: "error", error: r.state === "error" ? r.error : "not configured" };
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

function RulesTab({ cc, got, rules, d, setDraft, names, palette, admin, rev, m, mode }: {
  cc: string; got: Got; rules: AssignRules; d: MapData; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; rev: number;
  m: CountryMap; mode: Mode;
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
  const zoneFig = useMemo(() => {
    const out = new Map<string, { postcodes: number; km2: number; companies: number }>();
    const base = m.base;
    if (!base) return out;
    const joined = layers.data ? joinLayer(base, layers.data) : null;
    const at = (id: string) => out.get(id) ?? (out.set(id, { postcodes: 0, km2: 0, companies: 0 }), out.get(id)!);
    base.points.forEach((pt, i) => { const f = at(m.picks[i]?.zoneId ?? ""); f.postcodes++; f.km2 += pt.km2; });
    if (joined) base.cells.forEach((pts, ci) => {
      const v = joined.cells[ci]?.via;
      if (v) at(m.picks[pts[0]]?.zoneId ?? "").companies += (v.zone ?? 0) + (v.default ?? 0);
    });
    return out;
  }, [m, layers.data]);

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

/* ── key accounts, people, the SAE table ── */

type Key = NonNullable<CountryRule["keyAccounts"]>[number];
function KeyRow({ k, names, palette, admin, source, onChange, onRemove }: {
  k: Key; names: Names; palette: Palette; admin: boolean; source: "sae" | "map"; onChange: (k: Key) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(k.erpIds.join(", "));
  return (
    <Box sx={{ ...row, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(200px, 1fr) minmax(120px, 0.6fr) minmax(0, 1.6fr) 36px" } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
        <Swatch paint={palette(k.owner)} size={13} />
        <OwnerPicker value={k.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...k, owner })} sx={{ flex: 1, minWidth: 0 }} />
      </Box>
      <TextField size="small" value={k.label ?? ""} disabled={!admin} placeholder="label" onChange={(e) => onChange({ ...k, label: e.target.value || undefined })} />
      <TextField size="small" multiline minRows={1} maxRows={6} value={text} disabled={!admin} placeholder="ERP customer ids, e.g. 100234, 100871"
        helperText={`${full(k.erpIds.length)} ERP id${k.erpIds.length === 1 ? "" : "s"} - ${source === "map" ? "before the postcodes" : "only when the company has no SAE"}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...k, erpIds: splitIds(e.target.value) }); }} />
      {admin ? <IconButton size="small" onClick={onRemove} aria-label="Remove the key accounts"><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
    </Box>
  );
}

type SaeRow = { id: string; k: string; owner: string };
function TableTab({ rules, setDraft, names, palette, admin, got }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; got: Got }) {
  const [rows, setRows] = useState<SaeRow[]>(() => Object.entries(rules.sae).map(([k, owner]) => ({ id: newId("s"), k, owner: String(owner ?? "") })));
  const [q, setQ] = useState("");
  const push = (next: SaeRow[]) => {
    setRows(next);
    setDraft((dr) => ({ ...dr, sae: Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.owner])) }));
  };
  // companies per SAE, every country
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (got.state === "ok") for (const s of got.data.sae) if (s.sae) m.set(saeKey(s.sae), (m.get(saeKey(s.sae)) ?? 0) + s.companies);
    return m;
  }, [got]);
  const keys = new Map<string, number>();
  rows.forEach((r, i) => { const k = saeKey(r.k); if (k && !keys.has(k)) keys.set(k, i); });
  const unknown = [...counts].filter(([k]) => !keys.has(k)).sort((a, b) => b[1] - a[1]);
  const spelled = new Map<string, string>();
  if (got.state === "ok") for (const s of got.data.sae) if (s.sae && !spelled.has(saeKey(s.sae))) spelled.set(saeKey(s.sae), s.sae);
  const needle = q.trim().toLowerCase();
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.k.toLowerCase().includes(needle) || names.name(r.owner).toLowerCase().includes(needle));
  const cols = { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(220px, 1fr) 100px 36px" };
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={hint}>The workflow&apos;s table, for <b>every country</b> where rule 1 is on: SAE → person. A country&apos;s overrules (tab 1) come first. Case, accents and word order do not count.</Typography>
      <TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 320 }} />
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ ...row, display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
          <Typography sx={head}>SAE (as Performis writes it)</Typography>
          <Typography sx={head}>Person</Typography>
          <Typography sx={{ ...head, textAlign: "right" }}>Companies</Typography>
          <span />
        </Box>
        {shown.map(({ r, i }) => {
          const k = saeKey(r.k);
          const dup = k && keys.get(k) !== i ? keys.get(k)! : null;
          return (
            <Box key={r.id} sx={{ ...row, gridTemplateColumns: cols }}>
              <TextField size="small" value={r.k} disabled={!admin} placeholder="SAE" error={dup !== null || (!r.k.trim() && !!r.owner)}
                helperText={dup !== null ? `same as "${rows[dup].k}"` : undefined} slotProps={{ htmlInput: { "aria-label": "SAE" } }}
                onChange={(e) => push(rows.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)))} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Swatch paint={palette(r.owner)} size={13} />
                <OwnerPicker value={r.owner} names={names} disabled={!admin} onChange={(owner) => push(rows.map((x) => (x.id === r.id ? { ...x, owner } : x)))} sx={{ flex: 1, minWidth: 0 }} />
              </Box>
              <Typography sx={numSx}>{k && counts.has(k) ? full(counts.get(k)!) : "—"}</Typography>
              {admin ? <IconButton size="small" onClick={() => push(rows.filter((x) => x.id !== r.id))} aria-label={`Remove SAE ${r.k}`}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
            </Box>
          );
        })}
      </Box>
      {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }} onClick={() => push([...rows, { id: newId("s"), k: "", owner: "" }])}>Add an SAE</Button>}
      {unknown.length > 0 && (
        <Box sx={{ border: "1px solid rgba(169,106,18,.25)", bgcolor: "rgba(169,106,18,.05)", borderRadius: "12px", p: 1.5, display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>SAE values with nobody · {unknown.length}</Typography>
          <Typography sx={hint}>Their companies fall to rule 2 (the postcodes). Add one to give it a person.</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {unknown.slice(0, 40).map(([k, n]) => (
              <Box key={k} component={admin ? "button" : "span"} type={admin ? "button" : undefined}
                onClick={admin ? () => push([...rows, { id: newId("s"), k: spelled.get(k) ?? k, owner: "" }]) : undefined}
                sx={{ all: "unset", cursor: admin ? "pointer" : "default", px: 1, py: 0.4, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", fontSize: "0.78rem", color: INK, "&:hover": admin ? { borderColor: "#2459d1" } : {} }}>
                {spelled.get(k) ?? k} <span style={{ color: MUTED }}>{full(n)}</span>{admin ? " +" : ""}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/* ── the window ── */

export function RulesDialog({ open, onClose, cc, setCc, d, rules, setDraft, names, palette, rev, m, n, dirty, busy, check, msg, onSave, onUndo, seededNow, onSeeded }: {
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
}) {
  const [tab, setTab] = useState<Tab>("rules");
  const [mode, setMode] = useState<Mode>("rules");
  const got = usePerformis(n);
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const admin = d.admin;
  const [kv, setKv] = useState(0);
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
            <Box sx={{ flex: 1 }} />
            {tab === "rules" && <PillGroup<Mode> name="Rules or KPI" small value={mode} onChange={setMode} options={[{ key: "rules", label: "Rules" }, { key: "kpi", label: "KPI" }]} />}
            <IconButton onClick={onClose} aria-label="Close the rules"><CloseIcon /></IconButton>
          </Box>
          <PillGroup<Tab> name="Jobs" value={tab} onChange={setTab} options={[
            { key: "rules", label: `Rules of ${c}` },
            { key: "keys", label: "Key accounts", count: keys.length ? String(keys.length) : null },
            { key: "people", label: `Who works ${c}`, count: (rule?.people ?? []).length ? String(rule!.people!.length) : null },
            { key: "table", label: "SAE table · all countries", count: String(Object.keys(rules.sae).length) },
          ]} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2 }}>
          {tab === "rules" && <RulesTab key={`${cc}-${rev}`} cc={cc} got={got} rules={rules} d={d} setDraft={setDraft} names={names} palette={palette} admin={admin} rev={rev} m={m} mode={mode} />}
          {tab === "keys" && (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Typography sx={hint}>ERP customers that go to one person whatever the postcode{rule?.source !== "map" ? " - only when the company has no SAE (rule 1 first)" : ""}.</Typography>
              <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
                {keys.map((k, i) => (
                  <KeyRow key={`${cc}-${rev}-${kv}-${i}`} k={k} names={names} palette={palette} admin={admin} source={rule?.source ?? "sae"}
                    onChange={(nk) => setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).map((x, j) => (j === i ? nk : x)) }))}
                    onRemove={() => { setKv((x) => x + 1); setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).filter((_, j) => j !== i) })); }} />
                ))}
                {!keys.length && <Typography sx={{ ...hint, p: 1.5 }}>No key accounts in {c}.</Typography>}
              </Box>
              {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
                onClick={() => setRule((r) => ({ ...r, keyAccounts: [...(r.keyAccounts ?? []), { owner: "", erpIds: [] }] }))}>Add key accounts</Button>}
            </Box>
          )}
          {tab === "people" && (
            <Box sx={{ display: "grid", gap: 1.5, maxWidth: 720 }}>
              <Typography sx={hint}>The people who work {c}. An SAE whose person is not in this list is not used in {c} - rule 2 (the postcodes) decides. Empty = anyone.</Typography>
              <PeoplePicker key={`${cc}-${rev}`} value={rule?.people ?? []} names={names} disabled={!admin} placeholder="anyone - pick who works this country"
                onChange={(people) => setRule((r) => { const x: CountryRule = { ...r, people }; if (!people.length) delete x.people; return x; })} />
            </Box>
          )}
          {tab === "table" && <TableTab key={`table-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} got={got} />}
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
