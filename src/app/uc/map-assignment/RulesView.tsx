"use client";

// MAP ASSIGNMENT - the rules of one country (who decides: Performis SAE or the postcode zones; the zones; the default
// person; key accounts) and the global SAE table. Every edit redraws the map beside it at once; nothing reaches the
// hub before Save (admins). Undo = back to what is saved; "Back to the seeded rules" = what the HubSpot workflows did.

import { useMemo, useState } from "react";
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
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED, AMBER } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type Zone } from "@/lib/mapAssign/rules";
import type { MapData } from "@/lib/mapAssign/api";
import { CountryPicker, MapPanel, sourceNote, useCountryMap } from "./MapPanel";
import {
  OwnerPicker, Swatch, countryList, countryName, newId, prefixProblem, splitIds, splitPrefixes,
  type Names, type Palette,
} from "./shared";

type SetDraft = (f: (r: AssignRules) => AssignRules) => void;
const label = { fontSize: "0.7rem", fontWeight: 700, color: "#8b97ac", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const box = { border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.25 };

function ZoneRow({ zone, i, names, palette, count, admin, onChange, onRemove }: {
  zone: Zone; i: number; names: Names; palette: Palette; count: number | null; admin: boolean; onChange: (z: Zone) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(zone.prefixes.join(", "));
  const bad = zone.prefixes.map(prefixProblem).filter((x): x is string => !!x);
  return (
    <Box sx={{ ...box, display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(170px, 210px) minmax(0, 1fr) minmax(110px, 150px) auto" }, alignItems: "start" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, width: 16, flexShrink: 0 }}>{i + 1}</Typography>
        <Swatch paint={palette(zone.owner)} size={14} />
        <OwnerPicker value={zone.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...zone, owner })} sx={{ flex: 1, minWidth: 0 }} />
      </Box>
      <TextField size="small" multiline maxRows={4} value={text} disabled={!admin} placeholder="30-38, 40-49, 869" error={bad.length > 0}
        helperText={bad.length ? bad.join("; ") : `${zone.prefixes.length} prefix${zone.prefixes.length === 1 ? "" : "es"}${count !== null ? ` · ${full(count)} postcodes on the map` : ""}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...zone, prefixes: splitPrefixes(e.target.value) }); }} />
      <TextField size="small" value={zone.label ?? ""} disabled={!admin} placeholder="label"
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
  // key accounts have no id: a removal re-reads every row's text
  const [kv, setKv] = useState(0);
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc]) } }));
  if (!rule) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="slate" title={`${c}: no rule yet`} note={`Companies go by the SAE table; without a known SAE to ${names.name(rules.defaultOwner)}`} />
        {admin && (
          <Button variant="outlined" size="small" startIcon={<AddIcon />} sx={{ textTransform: "none" }}
            onClick={() => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: { country: cc, source: "sae", zones: [], defaultOwner: null, keyAccounts: [] } } }))}>
            Add a rule for {c}
          </Button>
        )}
      </GlassCard>
    );
  }
  const keys = rule.keyAccounts ?? [];
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
              ? "The SAE table below decides; companies without an SAE (after their key accounts), or with one it does not know, fall to the zones."
              : "The zones decide; the Performis SAE is shown, never copied."}
          </Typography>
        </Box>
        <Box>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
            <Typography sx={label}>Postcode zones · {rule.zones.length}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Prefixes and ranges of one length; the longest match wins</Typography>
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            {rule.zones.map((z, i) => (
              <ZoneRow key={`${rev}-${z.id}`} zone={z} i={i} names={names} palette={palette} admin={admin} count={byZone ? byZone.get(z.id) ?? 0 : null}
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
          <OwnerPicker value={rule.defaultOwner ?? ""} names={names} disabled={!admin} allowEmpty placeholder={`empty = ${names.name(rules.defaultOwner)}`}
            onChange={(o) => setRule((r) => ({ ...r, defaultOwner: o || null }))} sx={{ maxWidth: 340 }} />
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>For a postcode in no zone{rule.source === "sae" ? " (and no known SAE)" : ""}. Empty: the global default, {names.name(rules.defaultOwner)}.</Typography>
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

type SaeRow = { id: string; k: string; owner: string };
function SaeCard({ rules, setDraft, names, palette, d, admin }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; d: MapData; admin: boolean }) {
  const [rows, setRows] = useState<SaeRow[]>(() => Object.entries(rules.sae).map(([k, owner]) => ({ id: newId("s"), k, owner: String(owner ?? "") })));
  const [q, setQ] = useState("");
  const push = (next: SaeRow[]) => {
    setRows(next);
    setDraft((dr) => ({ ...dr, sae: Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.owner])) }));
  };
  const keys = new Map<string, number>();
  rows.forEach((r, i) => { const k = saeKey(r.k); if (k && !keys.has(k)) keys.set(k, i); });
  const unmapped = useMemo(() => {
    const m = new Map<string, { sae: string; n: number }>();
    for (const c of d.changes) {
      if (!c.sae || !c.decided.flags.includes("sae-unmapped")) continue;
      const k = saeKey(c.sae);
      const e = m.get(k);
      if (e) e.n++; else m.set(k, { sae: c.sae.trim(), n: 1 });
    }
    return [...m].filter(([k]) => !keys.has(k)).map(([, v]) => v).sort((a, b) => b.n - a.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.changes, rows]);
  const needle = q.trim().toLowerCase();
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.k.toLowerCase().includes(needle) || names.name(r.owner).toLowerCase().includes(needle));
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="purple" title={`The SAE table · ${rows.length}`}
        note="Performis SAE -> person, for every country the SAE decides. Case, accents and word order do not count"
        right={<TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: "100%", sm: 220 } }} />} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: unmapped.length ? 8 : 12 }}>
          <Box sx={{ display: "grid", gap: 0.75, maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
            {shown.map(({ r, i }) => {
              const k = saeKey(r.k);
              const dup = k && keys.get(k) !== i ? keys.get(k)! : null;
              return (
                <Box key={r.id} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(180px, 1fr) auto" }, alignItems: "start" }}>
                  <TextField size="small" value={r.k} disabled={!admin} placeholder="SAE as Performis writes it" error={dup !== null || (!r.k.trim() && !!r.owner)}
                    helperText={dup !== null ? `same as "${rows[dup].k}"` : undefined}
                    onChange={(e) => push(rows.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)))} />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <Swatch paint={palette(r.owner)} size={14} />
                    <OwnerPicker value={r.owner} names={names} disabled={!admin} onChange={(owner) => push(rows.map((x) => (x.id === r.id ? { ...x, owner } : x)))} sx={{ flex: 1, minWidth: 0 }} />
                  </Box>
                  {admin ? <IconButton size="small" onClick={() => push(rows.filter((x) => x.id !== r.id))} aria-label={`Remove SAE ${r.k}`} sx={{ justifySelf: { xs: "end", sm: "auto" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
                </Box>
              );
            })}
            {!shown.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{rows.length ? "Nothing matches." : "The table is empty: SAE countries then go by their zones."}</Typography>}
          </Box>
          {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", mt: 1 }} onClick={() => push([...rows, { id: newId("s"), k: "", owner: "" }])}>Add an SAE</Button>}
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ ...label, mb: 0.75 }}>Nothing matches anywhere</Typography>
            <OwnerPicker value={rules.defaultOwner} names={names} disabled={!admin} onChange={(o) => o && setDraft((dr) => ({ ...dr, defaultOwner: o }))} sx={{ maxWidth: 340 }} />
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>The global default (today TSA Team) - grey on the map.</Typography>
          </Box>
        </Grid>
        {unmapped.length > 0 && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={{ ...box, bgcolor: "rgba(169,106,18,.05)", borderColor: "rgba(169,106,18,.25)" }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>SAE values the table does not know</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1 }}>Seen among the differences; these companies fall to the zones today</Typography>
              <Box sx={{ display: "grid", gap: 0.5, maxHeight: 420, overflowY: "auto" }}>
                {unmapped.map((u) => (
                  <Box key={u.sae} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontSize: "0.82rem", color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={u.sae}>{u.sae}</Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>{full(u.n)} compan{u.n === 1 ? "y" : "ies"}</Typography>
                    {admin && <Button size="small" sx={{ textTransform: "none", minWidth: 0 }} onClick={() => push([...rows, { id: newId("s"), k: u.sae, owner: "" }])}>Add</Button>}
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>
    </GlassCard>
  );
}

/** Save / undo / back to the seeded rules, and what stops a save. */
export function SaveBar({ d, dirty, seededNow, check, busy, msg, onSave, onUndo, onSeeded }: {
  d: MapData; dirty: boolean; seededNow: boolean; check: { errors: string[]; warnings: string[] }; busy: boolean; msg: { ok: boolean; text: string } | null;
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
      {check.warnings.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, display: "grid", gap: 0.25 }}>
          {check.warnings.slice(0, 6).map((e) => <Typography component="li" key={e} sx={{ fontSize: "0.78rem", color: AMBER }}>{e}</Typography>)}
          {check.warnings.length > 6 && <Typography component="li" sx={{ fontSize: "0.78rem", color: AMBER }}>and {check.warnings.length - 6} more</Typography>}
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
  return (
    <>
      <CountryPicker list={countryList(d, rules)} cc={cc} onPick={setCc} />
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 7 }}>
          <CountryRuleCard key={`${cc}-${rev}`} cc={cc} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} byZone={m.status === "ok" ? m.byZone : null} rev={rev} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }} sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.25 } }}>
            <CardTitle icon={<MapOutlinedIcon />} tint={note.tint} title={note.title} note={note.text} />
            <MapPanel m={m} cc={cc} rules={rules} d={d} names={names} palette={palette} compact />
          </GlassCard>
        </Grid>
      </Grid>
      <SaeCard key={`sae-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} d={d} admin={d.admin} />
    </>
  );
}
