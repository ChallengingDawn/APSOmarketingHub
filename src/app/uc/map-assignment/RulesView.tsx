"use client";

// MAP ASSIGNMENT - the rules of one country: who decides (Performis SAE or the postcode zones), the people who work
// the country, the zones (postcode prefixes and whole regions), the default person, key accounts - and the default
// for everything no rule places (TSA Team). Every edit redraws the map beside it at once; nothing reaches the hub
// before Save (admins). Undo = back to what is saved; "Back to the seeded rules" = what the HubSpot workflows did.
// The SAE table and the SAE redirects per country live on the Performis view.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import type { AssignRules, CountryRule, Zone } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import { CountryPicker, MapPanel, sourceNote, useCountryMap } from "./MapPanel";
import {
  OwnerPicker, PeoplePicker, Swatch, assignInto, canon, countryList, countryName, emptyRule, newId, prefixProblem, splitIds, splitPrefixes,
  splitRegions, useCountryGeo, type Names, type Palette, type SetDraft,
} from "./shared";
const label = { fontSize: "0.7rem", fontWeight: 700, color: "#8b97ac", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const box = { border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.25 };
const hint = { fontSize: "0.74rem", color: MUTED, mt: 0.5 };

/** Region codes as typed and shown: without the country part ("BE" for CH-BE in Switzerland). */
const shortRegions = (regions: string[] | undefined, cc: string) => (regions ?? []).map((r) => (r.startsWith(`${cc}-`) ? r.slice(cc.length + 1) : r)).join(", ");

function ZoneRow({ zone, i, cc, names, palette, count, admin, regionNames, onChange, onRemove }: {
  zone: Zone; i: number; cc: string; names: Names; palette: Palette; count: number | null; admin: boolean;
  regionNames: Map<string, string> | null; onChange: (z: Zone) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(zone.prefixes.join(", "));
  const [rtext, setRtext] = useState(shortRegions(zone.regions, cc));
  // an edit from elsewhere (a click on the map) shows here; what is being typed stays as typed
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
  const example = regionNames && regionNames.size ? [...regionNames.keys()].slice(0, 2).map((r) => r.replace(`${cc}-`, "")).join(", ") : null;
  const regionHelp = unknown.length
    ? `${unknown.join(", ")}: not a region of ${countryName(cc)}`
    : known.length ? `${known.slice(0, 4).join(", ")}${known.length > 4 ? ` +${known.length - 4}` : ""}` : `whole regions${example ? `, e.g. ${example}` : " (region codes)"}`;
  return (
    <Box sx={{ ...box, display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(170px, 210px) minmax(0, 1.2fr) minmax(0, 1fr) minmax(100px, 140px) auto" }, alignItems: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, width: 16, flexShrink: 0 }}>{i + 1}</Typography>
        <Swatch paint={palette(zone.owner)} size={14} />
        <OwnerPicker value={zone.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...zone, owner })} sx={{ flex: 1, minWidth: 0 }} />
      </Box>
      <TextField size="small" multiline maxRows={4} value={text} disabled={!admin} placeholder="postcodes: 30-38, 40-49, 869" error={bad.length > 0}
        aria-label={`Zone ${i + 1} postcodes`}
        helperText={bad.length ? bad.join("; ") : `${zone.prefixes.length} prefix${zone.prefixes.length === 1 ? "" : "es"}${count !== null ? ` · ${full(count)} postcodes on the map` : ""}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...zone, prefixes: splitPrefixes(e.target.value) }); }} />
      <TextField size="small" multiline maxRows={4} value={rtext} disabled={!admin} placeholder="regions" error={unknown.length > 0}
        aria-label={`Zone ${i + 1} regions`} helperText={regionHelp}
        onChange={(e) => {
          setRtext(e.target.value);
          const next = splitRegions(e.target.value, cc);
          const z: Zone = { ...zone, regions: next };
          if (!next.length) delete z.regions;
          onChange(z);
        }} />
      <TextField size="small" value={zone.label ?? ""} disabled={!admin} placeholder="label" aria-label={`Zone ${i + 1} label`}
        onChange={(e) => onChange({ ...zone, label: e.target.value || undefined })} />
      {admin ? (
        <Tooltip title="Remove the zone"><IconButton size="small" onClick={onRemove} aria-label={`Remove zone ${i + 1}`} sx={{ justifySelf: { xs: "end", md: "auto" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
      ) : <span />}
    </Box>
  );
}

type Key = NonNullable<CountryRule["keyAccounts"]>[number];
function KeyRow({ k, i, names, palette, admin, source, onChange, onRemove }: {
  k: Key; i: number; names: Names; palette: Palette; admin: boolean; source: "sae" | "map"; onChange: (k: Key) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(k.erpIds.join(", "));
  return (
    <Box sx={{ ...box, display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(170px, 210px) minmax(110px, 150px) minmax(0, 1fr) auto" }, alignItems: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, width: 16, flexShrink: 0 }}>{i + 1}</Typography>
        <Swatch paint={palette(k.owner)} size={14} />
        <OwnerPicker value={k.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...k, owner })} sx={{ flex: 1, minWidth: 0 }} />
      </Box>
      <TextField size="small" value={k.label ?? ""} disabled={!admin} placeholder="label" onChange={(e) => onChange({ ...k, label: e.target.value || undefined })} />
      <TextField size="small" multiline minRows={1} maxRows={6} value={text} disabled={!admin} placeholder="ERP customer ids, e.g. 100234, 100871"
        helperText={`${full(k.erpIds.length)} ERP id${k.erpIds.length === 1 ? "" : "s"} - ${source === "map" ? "before the zones" : "only when the company has no SAE"}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...k, erpIds: splitIds(e.target.value) }); }} />
      {admin ? <Tooltip title="Remove"><IconButton size="small" onClick={onRemove} aria-label={`Remove key accounts ${i + 1}`} sx={{ justifySelf: { xs: "end", md: "auto" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip> : <span />}
    </Box>
  );
}

function CountryRuleCard({ cc, rules, setDraft, names, palette, admin, byZone, rev }: {
  cc: string; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; byZone: Map<string, number> | null; rev: number;
}) {
  const rule = rules.countries[cc];
  const c = countryName(cc);
  const team = names.name(rules.defaultOwner);
  const geo = useCountryGeo(cc);
  const regionNames = useMemo(() => (geo?.shapes ? new Map(geo.shapes.regions.map((r) => [r.code, r.name])) : null), [geo]);
  // key accounts have no id: a removal re-reads every row's text
  const [kv, setKv] = useState(0);
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc]) } }));
  if (!rule) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="slate" title={`${c}: no rule yet`} note={`Companies go by the SAE table; without a known SAE to ${team}`} />
        {admin && (
          <Button variant="outlined" size="small" startIcon={<AddIcon />} sx={{ textTransform: "none" }}
            onClick={() => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: emptyRule(cc) } }))}>
            Add a rule for {c}
          </Button>
        )}
      </GlassCard>
    );
  }
  const keys = rule.keyAccounts ?? [];
  const redirects = Object.entries(rule.saeOverride ?? {});
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title={`${c}: who decides`}
        note={rule.source === "map" ? "Key accounts first, then the postcode zones, then the default person" : "The SAE first; a company without one: key accounts, then the zones, then the default person"}
        right={admin ? (
          <Button size="small" sx={{ textTransform: "none", color: MUTED }} onClick={() => setDraft((dr) => { const countries = { ...dr.countries }; delete countries[cc]; return { ...dr, countries }; })}>
            Remove the rule
          </Button>
        ) : undefined} />
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box>
          <Typography sx={{ ...label, mb: 0.75 }}>Source</Typography>
          <Choice<"sae" | "map"> value={rule.source} onChange={(source) => admin && setRule((r) => ({ ...r, source }))} options={[
            { key: "sae", label: "Performis SAE" },
            { key: "map", label: "Map (postcode zones)" },
          ]} />
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.75 }}>
            {rule.source === "sae"
              ? "The SAE table (on Performis) decides; companies without an SAE (after their key accounts), or with one it does not know, fall to the zones."
              : "The zones decide; the Performis SAE is shown, never copied."}
          </Typography>
          {rule.source === "sae" && redirects.length > 0 && (
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>
              Redirected in {c}: {redirects.slice(0, 3).map(([k, o]) => `${k} → ${names.name(o)}`).join(" · ")}{redirects.length > 3 ? ` and ${redirects.length - 3} more` : ""}
              {" - "}<Box component="a" href="#performis" sx={{ color: "#2459d1", textDecoration: "none" }}>change on Performis</Box>
            </Typography>
          )}
        </Box>
        <Box>
          <Typography sx={{ ...label, mb: 0.75 }}>People in {c} · {(rule.people ?? []).length || "anyone"}</Typography>
          <PeoplePicker value={rule.people ?? []} names={names} disabled={!admin} placeholder="anyone - pick the people who work this country"
            onChange={(people) => setRule((r) => { const n: CountryRule = { ...r, people }; if (!people.length) delete n.people; return n; })} />
          <Typography sx={hint}>
            The people who work {c}. An SAE that points to someone else is not used here - the zones decide. Empty: anyone.
          </Typography>
        </Box>
        <Box>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
            <Typography sx={label}>Zones · {rule.zones.length}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Postcode prefixes and ranges of one length, or whole regions; the longest prefix wins, a prefix beats a region</Typography>
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            {rule.zones.map((z, i) => (
              <ZoneRow key={`${rev}-${z.id}`} zone={z} i={i} cc={cc} names={names} palette={palette} admin={admin} regionNames={regionNames}
                count={byZone ? byZone.get(z.id) ?? 0 : null}
                onChange={(nz) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? nz : x)) }))}
                onRemove={() => setRule((r) => ({ ...r, zones: r.zones.filter((x) => x.id !== z.id) }))} />
            ))}
            {!rule.zones.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No zones: every postcode goes to the default person.</Typography>}
          </Box>
          {admin && (
            <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", mt: 1 }}
              onClick={() => setRule((r) => ({ ...r, zones: [...r.zones, { id: newId("z"), owner: "", prefixes: [] }] }))}>Add a zone</Button>
          )}
        </Box>
        <Box>
          <Typography sx={{ ...label, mb: 0.75 }}>Default person in {c}</Typography>
          <OwnerPicker value={rule.defaultOwner ?? ""} names={names} disabled={!admin} allowEmpty placeholder={`empty = ${team}`}
            onChange={(o) => setRule((r) => ({ ...r, defaultOwner: o || null }))} sx={{ maxWidth: 340 }} />
          <Typography sx={hint}>For a postcode in no zone{rule.source === "sae" ? " (and no known SAE)" : ""}. Empty: {team}.</Typography>
        </Box>
        <Box>
          <Typography sx={{ ...label, mb: 0.75 }}>Key accounts · {keys.length}</Typography>
          <Box sx={{ display: "grid", gap: 1 }}>
            {keys.map((k, i) => (
              <KeyRow key={`${rev}-${kv}-${i}`} k={k} i={i} names={names} palette={palette} admin={admin} source={rule.source}
                onChange={(nk) => setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).map((x, j) => (j === i ? nk : x)) }))}
                onRemove={() => { setKv((x) => x + 1); setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).filter((_, j) => j !== i) })); }} />
            ))}
            {!keys.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>None: ERP customers that go to one person whatever the postcode{rule.source === "sae" ? " (when they have no SAE)" : ""}.</Typography>}
          </Box>
          {admin && (
            <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", mt: 1 }}
              onClick={() => setRule((r) => ({ ...r, keyAccounts: [...(r.keyAccounts ?? []), { owner: "", erpIds: [] }] }))}>Add key accounts</Button>
          )}
        </Box>
      </Box>
    </GlassCard>
  );
}

/** The default everywhere: TSA Team, a team like the people - where a company goes when no rule places it. */
function DefaultCard({ rules, setDraft, names, palette, admin }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean }) {
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.25 } }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="slate" title={`Default: ${names.name(rules.defaultOwner)}`}
        note="Where a company goes when no rule places it - in every country without a default person of its own" />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, maxWidth: 380 }}>
        <Swatch paint={palette(rules.defaultOwner)} size={14} />
        <OwnerPicker value={rules.defaultOwner} names={names} disabled={!admin} onChange={(o) => o && setDraft((dr) => ({ ...dr, defaultOwner: o }))} sx={{ flex: 1 }} />
      </Box>
    </GlassCard>
  );
}

/** Save / undo / back to the seeded rules, and what stops a save. */
export function SaveBar({ d, dirty, seededNow, check, busy, msg, onSave, onUndo, onSeeded }: {
  d: MapData; dirty: boolean; seededNow: boolean; check: { errors: string[] }; busy: boolean; msg: { ok: boolean; text: string } | null;
  onSave: () => void; onUndo: () => void; onSeeded: () => void;
}) {
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.25 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        {dirty ? <Chip tint="amber">Unsaved changes - the map shows them</Chip> : <Chip tint="green">Saved</Chip>}
        {seededNow && <Chip tint="slate">as seeded from the HubSpot workflows</Chip>}
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, flex: 1, minWidth: 160 }}>
          {d.at ? `Last saved ${when(d.at)}${d.by ? ` by ${d.by}` : ""}` : "Never saved: these are the seeded rules"}{!d.admin ? " · read only - admins change the rules" : ""}
        </Typography>
        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            {busy && <CircularProgress size={14} />}
            <Button size="small" disabled={!dirty || busy} onClick={onUndo} sx={{ textTransform: "none" }}>Undo changes</Button>
            <Button size="small" disabled={seededNow || busy} onClick={onSeeded} sx={{ textTransform: "none" }}>Back to the seeded rules</Button>
            <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={!dirty || busy || check.errors.length > 0} onClick={onSave} sx={{ textTransform: "none" }}>Save</Button>
          </Box>
        )}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.8rem", color: msg.ok ? "#1b7a55" : RED, mt: 1 }}>{msg.text}</Typography>}
      {check.errors.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, display: "grid", gap: 0.25 }}>
          {check.errors.slice(0, 8).map((e) => <Typography component="li" key={e} sx={{ fontSize: "0.8rem", color: RED }}>{e}</Typography>)}
          {check.errors.length > 8 && <Typography component="li" sx={{ fontSize: "0.8rem", color: RED }}>and {check.errors.length - 8} more</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

export function RulesView({ d, rules, setDraft, cc, setCc, names, palette, rev, dirty }: {
  d: MapData; rules: AssignRules; setDraft: SetDraft; cc: string; setCc: (cc: string) => void; names: Names; palette: Palette; rev: number; dirty: boolean;
}) {
  const m = useCountryMap(cc, rules, d.rules, dirty);
  const note = sourceNote(cc, rules, names);
  const onAssign = useMemo(() => assignInto(setDraft), [setDraft]);
  return (
    <>
      <CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} />
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 7 }} sx={{ display: "grid", gap: 2.5 }}>
          <CountryRuleCard key={`${cc}-${rev}`} cc={cc} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} byZone={m.status === "ok" ? m.byZone : null} rev={rev} />
          <DefaultCard rules={rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }} sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.25 } }}>
            <CardTitle icon={<MapOutlinedIcon />} tint={note.tint} title={note.title} note={note.text} />
            <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} compact onAssign={onAssign} />
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}
