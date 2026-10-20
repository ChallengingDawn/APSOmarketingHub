"use client";

// MAP ASSIGNMENT - the country's options, in the panel on the left of the map (SARCLA 20.10.2026: "the first
// assignment menu should be much simpler - the MAP tab should almost do everything - Performis menu is too complex, we
// should merge in one simpler map"). The old Rules and Performis tabs in one narrow column:
//   what decides here (the Performis SAE or the postcode zones), the people of the country
//   the SAE values of the country -> who they go to, a redirect for this country only (CountryRule.saeOverride)
//   the postcode zones, the default person, key accounts
//   more: the SAE table for every country, the rule itself, the seeded rules
// Every edit is the page's draft: the map recolours at once, nothing reaches the hub before Save.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { FAINT, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type CountryRule, type OwnerId, type Zone } from "@/lib/mapAssign/rules";
import type { MapData, PerformisData } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, PeoplePicker, Swatch, canon, countryName, emptyRule, newId, prefixProblem, saeTarget, splitIds, splitPrefixes, splitRegions,
  useCountryGeo, withOverride, type Names, type Palette, type SetDraft,
} from "./shared";
import { SideShell } from "./SidePanel";

const kicker = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const hint = { fontSize: "0.74rem", color: MUTED };
const card = { border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1, display: "grid", gap: 0.75 };

function Part({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Box sx={{ pt: 1.5, mt: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography sx={kicker}>{title}</Typography>{right}
      </Box>
      {children}
    </Box>
  );
}

function Fold({ title, count, children, open: start = false }: { title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(start);
  return (
    <Box sx={{ pt: 1.25, mt: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
      <Box component="button" type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.5, width: "100%", "&:focus-visible": { outline: "2px solid #2459d1" } }}>
        <Typography sx={{ ...kicker, flex: 1 }}>{title}{count !== undefined ? ` · ${count}` : ""}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Box>
      <Collapse in={open} unmountOnExit><Box sx={{ display: "grid", gap: 0.75, mt: 0.75 }}>{children}</Box></Collapse>
    </Box>
  );
}

/* ── the SAE values of a country (GET ?performis=1) ── */

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

function SaeList({ cc, got, rules, setDraft, names, palette, admin }: {
  cc: string; got: Got; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean;
}) {
  const rule = rules.countries[cc];
  const isMap = rule?.source === "map";
  const fallback = rule?.defaultOwner || rules.defaultOwner;
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const rows = useMemo(() => (got.state === "ok" ? got.data.sae.filter((s) => (s.country || "??") === cc && s.sae) : [])
    .sort((a, b) => b.companies - a.companies), [got, cc]);
  if (got.state === "loading") return <Typography sx={hint}>Reading the SAE values of {countryName(cc)}…</Typography>;
  if (got.state === "error") return <Typography sx={{ ...hint, color: RED }}>Not readable: {got.error}</Typography>;
  if (!rows.length) return <Typography sx={hint}>No company in {countryName(cc)} has a Performis SAE.</Typography>;
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((s) => !needle || s.sae.toLowerCase().includes(needle));
  const redirect = (sae: string, owner: OwnerId | null) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: withOverride(dr.countries[cc] ?? emptyRule(cc), sae, owner) } }));
  return (
    <>
      {rows.length > 8 && <TextField size="small" placeholder="find an SAE" value={q} onChange={(e) => setQ(e.target.value)} />}
      {(more || needle ? shown : shown.slice(0, 8)).map((s) => {
        const t = saeTarget(rules, cc, s.sae);
        const decides = (t.how === "table" || t.how === "redirect") && !!t.owner;
        const left = decides && !names.active(t.owner!);
        const goes = decides ? (left ? fallback : t.owner) : null;
        return (
          <Box key={s.sae} sx={card}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.sae}>{s.sae}</Typography>
              <Typography sx={{ ...hint, whiteSpace: "nowrap" }}>{full(s.companies)} co · {full(s.contacts)} ct</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              {goes ? <Swatch paint={palette(goes)} size={12} /> : <Box sx={{ width: 12 }} />}
              <OwnerPicker value={t.how === "redirect" ? t.owner ?? "" : ""} names={names} disabled={!admin || isMap} allowEmpty
                placeholder={goes ? `${names.name(goes)} (the SAE table)` : isMap ? "the map decides" : "the zones decide"}
                onChange={(o) => redirect(s.sae, o || null)} sx={{ flex: 1, minWidth: 0 }} />
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: t.how === "unmapped" || t.how === "not-in-country" || left ? "#a96a12" : FAINT }}>
              {left ? `${names.name(t.owner)} has left - ${names.name(fallback)}`
                : t.how === "redirect" ? `redirected in ${countryName(cc)}`
                : t.how === "unmapped" ? "not in the SAE table - the zones decide"
                : t.how === "not-in-country" ? `${names.name(t.owner)} does not work ${countryName(cc)} - the zones decide`
                : t.how === "map" ? "not used: the map decides here" : "from the SAE table"}
              {s.companiesOff ? ` · ${full(s.companiesOff)} to change` : ""}
            </Typography>
          </Box>
        );
      })}
      {!needle && rows.length > 8 && (
        <Button size="small" onClick={() => setMore(!more)} sx={{ textTransform: "none", justifySelf: "start" }}>{more ? "Fewer" : `All ${rows.length} SAE values`}</Button>
      )}
      {!isMap && <Typography sx={hint}>Pick a person to redirect an SAE in {countryName(cc)} only - the SAE table stays as it is.</Typography>}
    </>
  );
}

/* ── zones and key accounts, one column ── */

const shortRegions = (regions: string[] | undefined, cc: string) => (regions ?? []).map((r) => (r.startsWith(`${cc}-`) ? r.slice(cc.length + 1) : r)).join(", ");

function ZoneCard({ zone, cc, names, palette, count, admin, regionNames, onChange, onRemove }: {
  zone: Zone; cc: string; names: Names; palette: Palette; count: number | null; admin: boolean;
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
    <Box sx={card}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
        <Swatch paint={palette(zone.owner)} size={13} />
        <OwnerPicker value={zone.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...zone, owner })} sx={{ flex: 1, minWidth: 0 }} />
        {admin && <IconButton size="small" onClick={onRemove} aria-label="Remove the zone"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
      </Box>
      <TextField size="small" multiline maxRows={4} value={text} disabled={!admin} placeholder="postcodes: 30-38, 40-49, 869" error={bad.length > 0}
        aria-label="Postcodes of the zone"
        helperText={bad.length ? bad.join("; ") : `${zone.prefixes.length} prefix${zone.prefixes.length === 1 ? "" : "es"}${count !== null ? ` · ${full(count)} postcodes on the map` : ""}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...zone, prefixes: splitPrefixes(e.target.value) }); }} />
      <TextField size="small" multiline maxRows={3} value={rtext} disabled={!admin} placeholder="whole regions, e.g. BE, VS" error={unknown.length > 0}
        aria-label="Regions of the zone"
        helperText={unknown.length ? `${unknown.join(", ")}: not a region of ${countryName(cc)}` : known.length ? known.slice(0, 4).join(", ") + (known.length > 4 ? ` +${known.length - 4}` : "") : undefined}
        onChange={(e) => {
          setRtext(e.target.value);
          const next = splitRegions(e.target.value, cc);
          const z: Zone = { ...zone, regions: next };
          if (!next.length) delete z.regions;
          onChange(z);
        }} />
    </Box>
  );
}

type Key = NonNullable<CountryRule["keyAccounts"]>[number];
function KeyCard({ k, names, palette, admin, source, onChange, onRemove }: {
  k: Key; names: Names; palette: Palette; admin: boolean; source: "sae" | "map"; onChange: (k: Key) => void; onRemove: () => void;
}) {
  const [text, setText] = useState(k.erpIds.join(", "));
  return (
    <Box sx={card}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
        <Swatch paint={palette(k.owner)} size={13} />
        <OwnerPicker value={k.owner} names={names} disabled={!admin} onChange={(owner) => onChange({ ...k, owner })} sx={{ flex: 1, minWidth: 0 }} />
        {admin && <IconButton size="small" onClick={onRemove} aria-label="Remove the key accounts"><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
      </Box>
      <TextField size="small" multiline minRows={1} maxRows={6} value={text} disabled={!admin} placeholder="ERP customer ids, e.g. 100234, 100871"
        helperText={`${full(k.erpIds.length)} ERP id${k.erpIds.length === 1 ? "" : "s"} - ${source === "map" ? "before the zones" : "only when the company has no SAE"}`}
        onChange={(e) => { setText(e.target.value); onChange({ ...k, erpIds: splitIds(e.target.value) }); }} />
    </Box>
  );
}

/* ── the SAE table, every country ── */

type SaeRow = { id: string; k: string; owner: string };
function SaeTable({ rules, setDraft, names, palette, admin }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean }) {
  const [rows, setRows] = useState<SaeRow[]>(() => Object.entries(rules.sae).map(([k, owner]) => ({ id: newId("s"), k, owner: String(owner ?? "") })));
  const [q, setQ] = useState("");
  const push = (next: SaeRow[]) => {
    setRows(next);
    setDraft((dr) => ({ ...dr, sae: Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.owner])) }));
  };
  const keys = new Map<string, number>();
  rows.forEach((r, i) => { const k = saeKey(r.k); if (k && !keys.has(k)) keys.set(k, i); });
  const needle = q.trim().toLowerCase();
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.k.toLowerCase().includes(needle) || names.name(r.owner).toLowerCase().includes(needle));
  return (
    <>
      <Typography sx={hint}>Performis SAE → person, in every country the SAE decides (a country&apos;s redirects come first). Case, accents and word order do not count.</Typography>
      <TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map(({ r, i }) => {
        const k = saeKey(r.k);
        const dup = k && keys.get(k) !== i ? keys.get(k)! : null;
        return (
          <Box key={r.id} sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <TextField size="small" value={r.k} disabled={!admin} placeholder="SAE as Performis writes it" error={dup !== null || (!r.k.trim() && !!r.owner)}
                helperText={dup !== null ? `same as "${rows[dup].k}"` : undefined} slotProps={{ htmlInput: { "aria-label": "SAE" } }} sx={{ flex: 1 }}
                onChange={(e) => push(rows.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)))} />
              {admin && <IconButton size="small" onClick={() => push(rows.filter((x) => x.id !== r.id))} aria-label={`Remove SAE ${r.k}`}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Swatch paint={palette(r.owner)} size={13} />
              <OwnerPicker value={r.owner} names={names} disabled={!admin} onChange={(owner) => push(rows.map((x) => (x.id === r.id ? { ...x, owner } : x)))} sx={{ flex: 1, minWidth: 0 }} />
            </Box>
          </Box>
        );
      })}
      {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }} onClick={() => push([...rows, { id: newId("s"), k: "", owner: "" }])}>Add an SAE</Button>}
    </>
  );
}

/* ── the panel ── */

export function OptionsPanel({ cc, d, rules, setDraft, names, palette, rev, byZone, n, seededNow, onSeeded, onClose }: {
  cc: string; d: MapData; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette;
  /** the page's rules version: a save or an undo re-reads every field */
  rev: number;
  byZone: Map<string, number> | null;
  /** the page's reload counter */
  n: number;
  seededNow: boolean; onSeeded: () => void; onClose: () => void;
}) {
  const rule = rules.countries[cc];
  const c = countryName(cc);
  const admin = d.admin;
  const team = names.name(rules.defaultOwner);
  const geo = useCountryGeo(cc);
  const regionNames = useMemo(() => (geo?.shapes ? new Map(geo.shapes.regions.map((r) => [r.code, r.name])) : null), [geo]);
  const got = usePerformis(n);
  const [kv, setKv] = useState(0);
  const setRule = (f: (r: CountryRule) => CountryRule) => setDraft((dr) => ({ ...dr, countries: { ...dr.countries, [cc]: f(dr.countries[cc] ?? emptyRule(cc)) } }));
  const keys = rule?.keyAccounts ?? [];
  return (
    <SideShell label={`Options of ${c}`} title={`${c}: options`} sub={admin ? "Changes show on the map at once - Save keeps them" : "Read only - admins change the options"} onClose={onClose}>
      <Box sx={{ display: "grid", gap: 0.75, mt: 1.5 }}>
        <Typography sx={kicker}>Who decides</Typography>
        <Choice<"sae" | "map"> value={rule?.source ?? "sae"} onChange={(source) => admin && setRule((r) => ({ ...r, source }))} options={[
          { key: "sae", label: "Performis SAE" },
          { key: "map", label: "Postcode zones" },
        ]} />
        <Typography sx={hint}>
          {rule?.source === "map"
            ? "Key accounts first, then the postcode zones. The SAE is shown, never copied."
            : "Each company's SAE goes to its person. No SAE, or one nobody has: key accounts, then the postcode zones."}
        </Typography>
      </Box>
      <Part title={`People in ${c} · ${(rule?.people ?? []).length || "anyone"}`}>
        <PeoplePicker value={rule?.people ?? []} names={names} disabled={!admin} placeholder="anyone - pick who works this country"
          onChange={(people) => setRule((r) => { const x: CountryRule = { ...r, people }; if (!people.length) delete x.people; return x; })} />
        <Typography sx={hint}>An SAE that points to someone outside this list is not used here - the zones decide.</Typography>
      </Part>
      <Part title="Performis SAE → person">
        <SaeList key={`${cc}-${rev}`} cc={cc} got={got} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} />
      </Part>
      <Part title={`Postcode zones · ${rule?.zones.length ?? 0}`} right={<Typography sx={{ ...hint, fontSize: "0.7rem" }}>or click the map</Typography>}>
        {(rule?.zones ?? []).map((z) => (
          <ZoneCard key={`${rev}-${z.id}`} zone={z} cc={cc} names={names} palette={palette} admin={admin} regionNames={regionNames}
            count={byZone ? byZone.get(z.id) ?? 0 : null}
            onChange={(nz) => setRule((r) => ({ ...r, zones: r.zones.map((x) => (x.id === z.id ? nz : x)) }))}
            onRemove={() => setRule((r) => ({ ...r, zones: r.zones.filter((x) => x.id !== z.id) }))} />
        ))}
        {!rule?.zones.length && <Typography sx={hint}>No zones: every postcode goes to the default person.</Typography>}
        {admin && (
          <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
            onClick={() => setRule((r) => ({ ...r, zones: [...r.zones, { id: newId("z"), owner: "", prefixes: [] }] }))}>Add a zone</Button>
        )}
      </Part>
      <Part title="Postcodes in no zone go to">
        <OwnerPicker value={rule?.defaultOwner ?? ""} names={names} disabled={!admin} allowEmpty placeholder={`${team} (everywhere)`}
          onChange={(o) => setRule((r) => ({ ...r, defaultOwner: o || null }))} />
      </Part>
      <Fold title="Key accounts" count={keys.length}>
        {keys.map((k, i) => (
          <KeyCard key={`${rev}-${kv}-${i}`} k={k} names={names} palette={palette} admin={admin} source={rule?.source ?? "sae"}
            onChange={(nk) => setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).map((x, j) => (j === i ? nk : x)) }))}
            onRemove={() => { setKv((x) => x + 1); setRule((r) => ({ ...r, keyAccounts: (r.keyAccounts ?? []).filter((_, j) => j !== i) })); }} />
        ))}
        {!keys.length && <Typography sx={hint}>ERP customers that go to one person whatever the postcode{rule?.source !== "map" ? " (when they have no SAE)" : ""}.</Typography>}
        {admin && (
          <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }}
            onClick={() => setRule((r) => ({ ...r, keyAccounts: [...(r.keyAccounts ?? []), { owner: "", erpIds: [] }] }))}>Add key accounts</Button>
        )}
      </Fold>
      <Fold title="The SAE table, every country" count={Object.keys(rules.sae).length}>
        <SaeTable key={`sae-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={admin} />
      </Fold>
      <Fold title="More">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Swatch paint={palette(rules.defaultOwner)} size={13} />
          <Typography sx={{ fontSize: "0.82rem", color: INK, flex: 1 }}>Everywhere else: <b>{team}</b></Typography>
        </Box>
        <OwnerPicker value={rules.defaultOwner} names={names} disabled={!admin} onChange={(o) => o && setDraft((dr) => ({ ...dr, defaultOwner: o }))} />
        {admin && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
            {rule
              ? <Button size="small" sx={{ textTransform: "none", color: MUTED }} onClick={() => setDraft((dr) => { const countries = { ...dr.countries }; delete countries[cc]; return { ...dr, countries }; })}>Remove the rule of {c}</Button>
              : <Chip tint="slate">{c} has no rule of its own yet - any change here makes one</Chip>}
            <Button size="small" disabled={seededNow} onClick={onSeeded} sx={{ textTransform: "none" }}>Back to the seeded rules (all countries)</Button>
          </Box>
        )}
      </Fold>
    </SideShell>
  );
}
