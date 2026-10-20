"use client";

// MAP ASSIGNMENT - the rules, in a big window (SARCLA 20.10.2026: "menus are still really complicated - open a big popup
// with tabs to separate the jobs, and in order to steer"). One tab per job, in the order the engine decides:
//   1 · Performis SAE     rule 1: each SAE of the country -> the workflow's person; overrule it for this country
//                         (CountryRule.saeOverride); rule 1 on or off for the country
//   2 · Postcodes         rule 2, the fallback for companies without an SAE yet: the zones (swap the person, the
//                         postcodes, whole regions), and where a postcode in no zone goes
//   Key accounts          ERP customers that go to one person whatever the rules say
//   Who works {country}   an SAE whose person is not in this list is not used there - rule 2 decides
//   SAE table             the workflow's table, every country: SAE -> person
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
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type OwnerId, type Zone } from "@/lib/mapAssign/rules";
import type { MapData, PerformisData, SaeStat } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, PeoplePicker, Swatch, canon, countryList, countryName, emptyRule, newId, prefixProblem, saeTarget, splitIds, splitPrefixes,
  splitRegions, useCountryGeo, withOverride, type Names, type Palette, type SetDraft,
} from "./shared";
import { CountryMenu, PillGroup } from "./mapTabs";
import { RuleTag } from "./SidePanel";

type Tab = "sae" | "zones" | "keys" | "people" | "table";
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

/* ── 1 · Performis SAE ── */

function SaeTab({ cc, got, rules, setDraft, names, palette, admin }: {
  cc: string; got: Got; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean;
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const off = rule?.source === "map";
  const fallback = rule?.defaultOwner || rules.defaultOwner;
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "overruled" | "rule2">("all");
  const all = useMemo(() => (got.state === "ok" ? got.data.sae.filter((s) => (s.country || "??") === cc && s.sae) : []).sort((a, b) => b.companies - a.companies), [got, cc]);
  const noSae = got.state === "ok" ? got.data.sae.find((s) => (s.country || "??") === cc && !s.sae) : undefined;
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const redirect = (sae: string, owner: OwnerId | null) => setRule((r) => withOverride(r, sae, owner));
  const tableOf = (s: string) => { const k = Object.keys(rules.sae).find((x) => saeKey(x) === saeKey(s)); return k !== undefined ? String(rules.sae[k]) : null; };
  const kind = (s: SaeStat) => { const t = saeTarget(rules, cc, s.sae); return t.how === "redirect" ? "overruled" : t.how === "unmapped" || t.how === "not-in-country" ? "rule2" : "table"; };
  const needle = q.trim().toLowerCase();
  const rows = all.filter((s) => (only === "all" || kind(s) === only) && (!needle || s.sae.toLowerCase().includes(needle) || names.name(tableOf(s.sae) ?? "").toLowerCase().includes(needle)));
  const { slice, pager } = usePaged(rows, 15);
  const cols = { xs: "minmax(0, 1fr)", md: "minmax(160px, 1.2fr) 90px 90px minmax(150px, 1fr) minmax(220px, 1.3fr)" };
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={hint}>
        <RuleTag n={1} />As the workflow <b>SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS</b>: each company&apos;s SAE goes to its person - the company&apos;s owner and region responsibility, and each contact&apos;s owner, region responsibility and SAE. <b>Overrule</b> an SAE to give its companies in {c} to someone else.
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>Rule 1 in {c}</Typography>
        <Choice<"sae" | "map"> value={rule?.source ?? "sae"} onChange={(source) => admin && setRule((r) => ({ ...r, source }))} options={[
          { key: "sae", label: "On - the SAE first" },
          { key: "map", label: "Off - postcodes only" },
        ]} />
      </Box>
      {off ? <Typography sx={{ ...hint, color: "#a96a12" }}>Rule 1 is off in {c}: the postcodes (tab 2) decide every company.</Typography> : (
        <>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Choice<"all" | "overruled" | "rule2"> value={only} onChange={setOnly} options={[
              { key: "all", label: "All", count: all.length },
              { key: "overruled", label: "Overruled", count: all.filter((s) => kind(s) === "overruled").length },
              { key: "rule2", label: "Fall to rule 2", count: all.filter((s) => kind(s) === "rule2").length },
            ]} />
            <Box sx={{ flex: 1 }} />
            <TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: "100%", sm: 240 } }} />
          </Box>
          {got.state === "loading" && <Box sx={{ display: "flex", gap: 1, alignItems: "center", color: MUTED }}><CircularProgress size={14} /><Typography sx={hint}>Reading the SAE values of {c}…</Typography></Box>}
          {got.state === "error" && <Typography sx={{ ...hint, color: RED }}>Not readable: {got.error}</Typography>}
          {got.state === "ok" && (
            <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
              <Box sx={{ ...row, gridTemplateColumns: cols, display: { xs: "none", md: "grid" }, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
                <Typography sx={head}>SAE (Performis)</Typography>
                <Typography sx={{ ...head, textAlign: "right" }}>Companies</Typography>
                <Typography sx={{ ...head, textAlign: "right" }}>Contacts</Typography>
                <Typography sx={head}>The workflow gives</Typography>
                <Typography sx={head}>Overrule in {c}</Typography>
              </Box>
              {slice.map((s) => {
                const t = saeTarget(rules, cc, s.sae);
                const table = tableOf(s.sae);
                const left = !!t.owner && (t.how === "table" || t.how === "redirect") && !names.active(t.owner);
                const note = t.how === "redirect" ? `overruled: ${names.name(t.owner)} instead of ${table ? names.name(table) : "nobody"}`
                  : t.how === "unmapped" ? "nobody - rule 2 decides" : t.how === "not-in-country" ? `${names.name(t.owner)} does not work ${c} - rule 2 decides`
                  : left ? `${names.name(t.owner)} has left - ${names.name(fallback)}` : null;
                return (
                  <Box key={s.sae} sx={{ ...row, gridTemplateColumns: cols, bgcolor: t.how === "redirect" ? "rgba(98,80,214,.05)" : "transparent" }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.sae}>{s.sae}</Typography>
                      {note && <Typography sx={{ fontSize: "0.74rem", color: t.how === "redirect" ? "#6250d6" : "#a96a12", fontWeight: t.how === "redirect" ? 600 : 400 }}>{note}</Typography>}
                    </Box>
                    <Typography sx={numSx}>{full(s.companies)}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> companies · {full(s.contacts)} contacts</Box></Typography>
                    <Typography sx={{ ...numSx, display: { xs: "none", md: "block" } }}>{full(s.contacts)}</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      {table ? <><Swatch paint={palette(table)} size={12} /><Typography sx={{ fontSize: "0.84rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names.name(table)}</Typography></>
                        : <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>nobody</Typography>}
                    </Box>
                    <OwnerPicker value={t.how === "redirect" ? t.owner ?? "" : ""} names={names} disabled={!admin} allowEmpty placeholder="keep the workflow's person"
                      onChange={(o) => redirect(s.sae, o || null)} />
                  </Box>
                );
              })}
              {!rows.length && <Typography sx={{ ...hint, p: 1.5 }}>{all.length ? "Nothing with this filter." : `No company in ${c} has a Performis SAE.`}</Typography>}
            </Box>
          )}
          {pager}
          {noSae && <Typography sx={hint}>{full(noSae.companies)} companies in {c} have no SAE yet - the postcodes (tab 2) decide them until the ERP sends one.</Typography>}
        </>
      )}
    </Box>
  );
}

/* ── 2 · Postcodes ── */

const shortRegions = (regions: string[] | undefined, cc: string) => (regions ?? []).map((r) => (r.startsWith(`${cc}-`) ? r.slice(cc.length + 1) : r)).join(", ");

function ZoneRow({ zone, i, cc, names, palette, count, admin, regionNames, onChange, onRemove }: {
  zone: Zone; i: number; cc: string; names: Names; palette: Palette; count: number | null; admin: boolean;
  regionNames: Map<string, string> | null; onChange: (z: Zone) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(zone.prefixes.join(", "));
  const [rtext, setRtext] = useState(shortRegions(zone.regions, cc));
  // a click on the map shows here; what is being typed stays as typed
  useEffect(() => {
    if (canon(splitPrefixes(text)) !== canon(zone.prefixes)) setText(zone.prefixes.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.prefixes]);
  useEffect(() => {
    if (canon(splitRegions(rtext, cc)) !== canon(zone.regions ?? [])) setRtext(shortRegions(zone.regions, cc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.regions, cc]);
  const bad = zone.prefixes.map(prefixProblem).filter((x): x is string => !!x);
  const regions = zone.regions ?? [];
  const unknown = regionNames ? regions.filter((r) => !regionNames.has(r)) : [];
  const known = regionNames ? regions.filter((r) => regionNames.has(r)).map((r) => regionNames.get(r)!) : [];
  return (
    <Box sx={{ ...row, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "28px minmax(200px, 1fr) minmax(0, 1.4fr) minmax(0, 1fr) 80px 36px" } }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, pt: 1, display: { xs: "none", md: "block" } }}>{i + 1}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
        <Swatch paint={palette(zone.owner)} size={13} />
        <OwnerPicker value={zone.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...zone, owner })} sx={{ flex: 1, minWidth: 0 }} />
      </Box>
      <TextField size="small" multiline maxRows={4} value={text} disabled={!admin} placeholder="postcodes: 30-38, 40-49, 869" error={bad.length > 0}
        aria-label={`Zone ${i + 1} postcodes`} helperText={bad.length ? bad.join("; ") : undefined}
        onChange={(e) => { setText(e.target.value); onChange({ ...zone, prefixes: splitPrefixes(e.target.value) }); }} />
      <TextField size="small" multiline maxRows={3} value={rtext} disabled={!admin} placeholder="or whole regions: BE, VS" error={unknown.length > 0}
        aria-label={`Zone ${i + 1} regions`}
        helperText={unknown.length ? `${unknown.join(", ")}: not a region of ${countryName(cc)}` : known.length ? known.slice(0, 3).join(", ") + (known.length > 3 ? ` +${known.length - 3}` : "") : undefined}
        onChange={(e) => {
          setRtext(e.target.value);
          const next = splitRegions(e.target.value, cc);
          const z: Zone = { ...zone, regions: next };
          if (!next.length) delete z.regions;
          onChange(z);
        }} />
      <Typography sx={{ ...numSx, pt: { md: 1 } }}>{count !== null ? `${full(count)}` : "—"}<Box component="span" sx={{ display: { md: "none" }, color: MUTED }}> postcodes on the map</Box></Typography>
      {admin ? <IconButton size="small" onClick={onRemove} aria-label={`Remove zone ${i + 1}`} sx={{ justifySelf: { xs: "end", md: "center" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
    </Box>
  );
}

function ZonesTab({ cc, rules, setDraft, names, palette, admin, rev, byZone }: {
  cc: string; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; rev: number; byZone: Map<string, number> | null;
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const geo = useCountryGeo(cc);
  const regionNames = useMemo(() => (geo?.shapes ? new Map(geo.shapes.regions.map((r) => [r.code, r.name])) : null), [geo]);
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const zones = rule?.zones ?? [];
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={hint}>
        <RuleTag n={2} />The fallback for companies <b>without an SAE yet</b> - new companies and contacts the ERP has not sent. {rule?.source === "map" ? `Rule 1 is off in ${c}: these zones decide every company.` : "Once the ERP sends an SAE, rule 1 takes over."} <b>Swap</b> a zone by picking another person; or click a region or postcode on the map.
      </Typography>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ ...row, display: { xs: "none", md: "grid" }, gridTemplateColumns: "28px minmax(200px, 1fr) minmax(0, 1.4fr) minmax(0, 1fr) 80px 36px", bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
          <span />
          <Typography sx={head}>Person</Typography>
          <Typography sx={head}>Postcodes (prefixes, ranges)</Typography>
          <Typography sx={head}>Or whole regions</Typography>
          <Typography sx={{ ...head, textAlign: "right" }}>On map</Typography>
          <span />
        </Box>
        {zones.map((z, i) => (
          <ZoneRow key={`${rev}-${z.id}`} zone={z} i={i} cc={cc} names={names} palette={palette} admin={admin} regionNames={regionNames}
            count={byZone ? byZone.get(z.id) ?? 0 : null}
            onChange={(nz) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? nz : x)) }))}
            onRemove={() => setRule((r) => ({ ...r, zones: r.zones.filter((x) => x.id !== z.id) }))} />
        ))}
        {!zones.length && <Typography sx={{ ...hint, p: 1.5 }}>No zones: every postcode goes to the person below.</Typography>}
      </Box>
      {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
        onClick={() => setRule((r) => ({ ...r, zones: [...r.zones, { id: newId("z"), owner: "", prefixes: [] }] }))}>Add a zone</Button>}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>A postcode in no zone goes to</Typography>
        <OwnerPicker value={rule?.defaultOwner ?? ""} names={names} disabled={!admin} allowEmpty placeholder={`${names.name(rules.defaultOwner)} (everywhere)`}
          onChange={(o) => setRule((r) => ({ ...r, defaultOwner: o || null }))} sx={{ minWidth: 260 }} />
      </Box>
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

export function RulesDialog({ open, onClose, cc, setCc, d, rules, setDraft, names, palette, rev, byZone, n, dirty, busy, check, msg, onSave, onUndo, seededNow, onSeeded }: {
  open: boolean; onClose: () => void; cc: string; setCc: (cc: string) => void;
  d: MapData; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette;
  /** the page's rules version: a save or an undo re-reads every field */
  rev: number; byZone: Map<string, number> | null;
  /** the page's reload counter */
  n: number;
  dirty: boolean; busy: boolean; check: { errors: string[] }; msg: { ok: boolean; text: string } | null; onSave: () => void; onUndo: () => void;
  /** the rules as first read from the HubSpot workflows, every country */
  seededNow: boolean; onSeeded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("sae");
  const got = usePerformis(n);
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const admin = d.admin;
  const [kv, setKv] = useState(0);
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const keys = rule?.keyAccounts ?? [];
  const overruled = Object.keys(rule?.saeOverride ?? {}).length;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" aria-label={`Rules of ${c}`}
      slotProps={{ paper: { sx: { borderRadius: { xs: 0, sm: "18px" }, height: { xs: "100%", sm: "88vh" }, maxHeight: { xs: "100%", sm: "88vh" }, m: { xs: 0, sm: 2 }, width: { xs: "100%", sm: undefined } } } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}`, display: "grid", gap: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Typography component="h2" sx={{ fontSize: "1.2rem", fontWeight: 700, color: INK }}>Rules</Typography>
            <CountryMenu list={countryList(d, rules)} cc={cc} onPick={setCc} label={countryName} />
            {d.live[cc] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={onClose} aria-label="Close the rules"><CloseIcon /></IconButton>
          </Box>
          <PillGroup<Tab> name="Rules" value={tab} onChange={setTab} options={[
            { key: "sae", label: "1 · Performis SAE", count: overruled ? `${overruled} overruled` : null },
            { key: "zones", label: "2 · Postcodes", count: String(rule?.zones.length ?? 0) },
            { key: "keys", label: "Key accounts", count: keys.length ? String(keys.length) : null },
            { key: "people", label: `Who works ${c}`, count: (rule?.people ?? []).length ? String(rule!.people!.length) : null },
            { key: "table", label: "SAE table · all countries", count: String(Object.keys(rules.sae).length) },
          ]} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, md: 3 }, py: 2 }}>
          {tab === "sae" && <SaeTab key={`${cc}-${rev}`} cc={cc} got={got} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} />}
          {tab === "zones" && <ZonesTab key={`${cc}-${rev}`} cc={cc} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} rev={rev} byZone={byZone} />}
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
