"use client";

// MAP ASSIGNMENT - Performis: the copy of the Performis SAE to the company and its contacts (until now the HubSpot
// workflow "SARCLA | COMPANY/CONTACT OWNER COPY FROM PERFORMIS", 3836456157). SARCLA 19.10.2026: "a new tab Performis
// copy to company and contact so we can redirect if we want - break down by country and by SAE - we should see the
// properties it fills both on company and contact level", and "the SAE table should be a completely separate table".
//   - what the copy fills, on the company and on each contact
//   - by country: companies and contacts with an SAE, how many are off
//   - in one country, by SAE: the owner now, the person the rules give it, and a redirect for that country only
//     (CountryRule.saeOverride, saved with that country's rule)
//   - the SAE table itself (SAE -> person, every country the SAE decides), and the SAE values it does not know
// The breakdown is GET ?performis=1 (PerformisData); redirects and table edits are the draft rules, saved with Save.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { saeKey, type AssignRules, type OwnerId } from "@/lib/mapAssign/rules";
import type { MapData, PerformisData, SaeStat } from "@/lib/mapAssign/api";
import {
  API, OwnerPicker, Swatch, countryName, emptyRule, newId, saeTarget, withOverride,
  type Names, type Palette, type SaeTarget, type SetDraft,
} from "./shared";
const label = { fontSize: "0.7rem", fontWeight: 700, color: "#8b97ac", textTransform: "uppercase" as const, letterSpacing: "0.06em" };
const box = { border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.25 };
const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };

/* ── the breakdown, from the hub ── */

type Got = { state: "loading" } | { state: "ok"; data: PerformisData; stale: boolean } | { state: "missing" } | { state: "error"; error: string };

/** GET ?performis=1. A route that does not know it yet answers with the map data: "missing", never a wrong table. */
function usePerformis(n: number): Got {
  const url = `${API}?performis=1${n ? `&n=${n}` : ""}`;
  const held = useHeld<PerformisData>(url, [url]);
  const r = held.result;
  if (r === null) return { state: "loading" };
  if (r.state === "ok") {
    const x = r.data as Partial<PerformisData> | null;
    return x && Array.isArray(x.sae) ? { state: "ok", data: { at: x.at ?? null, sae: x.sae, props: x.props ?? FALLBACK_PROPS }, stale: held.stale } : { state: "missing" };
  }
  if (r.state === "error" && (r.status === 404 || r.status === 400)) return { state: "missing" };
  return { state: "error", error: r.state === "error" ? r.error : "not configured" };
}

/* ── what it fills ── */

const FALLBACK_PROPS: PerformisData["props"] = {
  company: ["hubspot_owner_id", "region_responsibility", "sae_performis"],
  contact: ["hubspot_owner_id", "region_responsibility", "sae_performis"],
};
const PROP_NOTE: Record<string, { name: string; company: string; contact: string }> = {
  hubspot_owner_id: { name: "Owner", company: "the person the rules give the SAE in the company's country", contact: "the company's owner" },
  region_responsibility: { name: "Region responsibility", company: "the same person as the owner", contact: "the company's" },
  sae_performis: { name: "SAE (Performis)", company: "the SAE as Performis has it - the ERP brings it every morning", contact: "the company's SAE" },
};

function FillsCard({ props }: { props: PerformisData["props"] }) {
  const side = (title: string, list: string[], k: "company" | "contact") => (
    <Box sx={{ ...box, height: "100%" }}>
      <Typography sx={{ ...label, mb: 1 }}>{title}</Typography>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {list.map((p) => (
          <Box key={p} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(150px, 190px) minmax(0, 1fr)" }, gap: { xs: 0.25, sm: 1 }, alignItems: "baseline" }}>
            <Typography component="code" sx={{ fontSize: "0.78rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: INK }}>{p}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{PROP_NOTE[p] ? `${PROP_NOTE[p].name}: ${PROP_NOTE[p][k]}` : ""}</Typography>
          </Box>
        ))}
        {!list.length && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Nothing.</Typography>}
      </Box>
    </Box>
  );
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<ContentCopyOutlinedIcon />} tint="green" title="What the Performis copy fills"
        note="Per company, from its SAE and country - and the same on each of its contacts; only what differs is written, and only in a live country" />
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6 }}>{side("On the company", props.company, "company")}</Grid>
        <Grid size={{ xs: 12, md: 6 }}>{side("On each contact", props.contact, "contact")}</Grid>
      </Grid>
    </GlassCard>
  );
}

/* ── by country ── */

type CountryRow = { cc: string; saes: number; companies: number; contacts: number; companiesOff: number; contactsOff: number; unmapped: number };

function byCountry(stats: SaeStat[], rules: AssignRules): CountryRow[] {
  const m = new Map<string, CountryRow>();
  for (const s of stats) {
    const cc = s.country || "??";
    const row = m.get(cc) ?? { cc, saes: 0, companies: 0, contacts: 0, companiesOff: 0, contactsOff: 0, unmapped: 0 };
    row.saes++; row.companies += s.companies; row.contacts += s.contacts; row.companiesOff += s.companiesOff; row.contactsOff += s.contactsOff;
    if (saeTarget(rules, cc, s.sae).how === "unmapped") row.unmapped += s.companies;
    m.set(cc, row);
  }
  return [...m.values()].sort((a, b) => b.companies - a.companies || a.cc.localeCompare(b.cc));
}

function CountriesCard({ rows, cc, onPick, d, rules }: { rows: CountryRow[]; cc: string | null; onPick: (cc: string) => void; d: MapData; rules: AssignRules }) {
  const { slice, pager } = usePaged(rows, 10);
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PublicOutlinedIcon />} tint="blue" title={`By country · ${rows.length}`}
        note="Companies with a Performis SAE, their contacts, and how many differ from what the rules decide - pick a country for its SAE values" />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={headCell}>Country</TableCell>
            {["SAE values", "Companies", "Contacts", "Companies off", "Contacts off", "Redirects"].map((h) => <TableCell key={h} sx={{ ...headCell, textAlign: "right" }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {slice.map((r) => {
              const on = r.cc === cc;
              const rule = rules.countries[r.cc];
              const redirects = Object.keys(rule?.saeOverride ?? {}).length;
              return (
                <TableRow key={r.cc} hover selected={on} onClick={() => onPick(r.cc)} sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(36,89,209,.06)" } }}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    <Box component="button" type="button" aria-pressed={on} onClick={(e) => { e.stopPropagation(); onPick(r.cc); }}
                      sx={{ all: "unset", cursor: "pointer", fontWeight: 700, color: on ? "#2459d1" : INK, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 } }}>
                      {countryName(r.cc)}
                    </Box>
                    <Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED, ml: 0.75 }}>{rule?.source === "map" ? "map decides" : "SAE decides"}</Typography>
                    {d.live[r.cc] && <Box component="span" sx={{ ml: 0.75 }}><Chip tint="pink">LIVE</Chip></Box>}
                  </TableCell>
                  <TableCell sx={num}>{full(r.saes)}</TableCell>
                  <TableCell sx={num}>{full(r.companies)}</TableCell>
                  <TableCell sx={num}>{full(r.contacts)}</TableCell>
                  <TableCell sx={{ ...num, fontWeight: r.companiesOff ? 700 : 400, color: r.companiesOff ? "#a96a12" : INK }}>{r.companiesOff ? full(r.companiesOff) : "—"}</TableCell>
                  <TableCell sx={{ ...num, color: r.contactsOff ? "#a96a12" : INK }}>{r.contactsOff ? full(r.contactsOff) : "—"}</TableCell>
                  <TableCell sx={num}>{redirects ? full(redirects) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No company has a Performis SAE yet - or the first scan has not run.</Typography>}
    </GlassCard>
  );
}

/* ── one country, by SAE ── */

function targetText(t: SaeTarget, cc: string, names: Names): string {
  const c = countryName(cc);
  if (t.how === "map") return `the map decides in ${c}`;
  if (t.how === "unmapped") return "not in the SAE table - the zones decide";
  if (t.how === "not-in-country") return `${names.name(t.owner)} does not work ${c} - the zones decide`;
  if (t.how === "redirect") return `redirected in ${c}`;
  return "the SAE table";
}

function OwnersNow({ list, names }: { list: SaeStat["ownerNow"]; names: Names }) {
  const sorted = [...list].sort((a, b) => b.companies - a.companies);
  const all = sorted.map((o) => `${o.owner ? names.name(o.owner) : "nobody"} ${full(o.companies)}`).join(" · ");
  return (
    <Tooltip title={sorted.length > 2 ? all : ""}>
      <Box sx={{ fontSize: "0.8rem", color: INK, minWidth: 0 }}>
        {sorted.slice(0, 2).map((o) => (
          <Box key={o.owner ?? "none"} sx={clip(200)}>{o.owner ? names.name(o.owner) : "nobody"} <span style={{ color: MUTED }}>{full(o.companies)}</span></Box>
        ))}
        {sorted.length > 2 && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>and {sorted.length - 2} more</Typography>}
        {!sorted.length && "—"}
      </Box>
    </Tooltip>
  );
}

type SaeFilter = "all" | "off" | "unmapped" | "redirected";

function SaeByCountryCard({ cc, stats, rules, saved, setDraft, names, palette, admin }: {
  cc: string; stats: SaeStat[]; rules: AssignRules; saved: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean;
}) {
  const c = countryName(cc);
  const rule = rules.countries[cc];
  const isMap = rule?.source === "map";
  const fallback = rule?.defaultOwner || rules.defaultOwner;
  const [filter, setFilter] = useState<SaeFilter>("all");
  const rows = useMemo(() => stats.map((s) => ({ s, t: saeTarget(rules, cc, s.sae), was: saeTarget(saved, cc, s.sae) }))
    .sort((a, b) => b.s.companies - a.s.companies || a.s.sae.localeCompare(b.s.sae)), [stats, rules, saved, cc]);
  const keep = (r: (typeof rows)[number], f: SaeFilter) => f === "all" || (f === "off" ? r.s.companiesOff + r.s.contactsOff > 0 : f === "unmapped" ? r.t.how === "unmapped" : r.t.how === "redirect");
  const count = (f: SaeFilter) => rows.filter((r) => keep(r, f)).length;
  const shown = rows.filter((r) => keep(r, filter));
  const { slice, pager } = usePaged(shown, 15);
  const redirect = (sae: string, owner: OwnerId | null) => setDraft((dr) => ({
    ...dr, countries: { ...dr.countries, [cc]: withOverride(dr.countries[cc] ?? emptyRule(cc), sae, owner) },
  }));
  const totals = rows.reduce((a, r) => ({ companies: a.companies + r.s.companies, contacts: a.contacts + r.s.contacts }), { companies: 0, contacts: 0 });
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<AltRouteOutlinedIcon />} tint="purple" title={`${c}: by SAE · ${rows.length}`}
        note={isMap
          ? `The map decides in ${c}: the SAE is shown, never copied. Switch the source to Performis SAE on Rules to use it`
          : `${full(totals.companies)} companies and ${full(totals.contacts)} contacts. Redirect an SAE here and only ${c} changes - the SAE table stays as it is`} />
      <Box sx={{ mb: 1.5 }}>
        <Choice<SaeFilter> value={filter} onChange={setFilter} options={[
          { key: "all", label: "All", count: rows.length },
          { key: "off", label: "Off", count: count("off") },
          { key: "unmapped", label: "Not in the table", count: count("unmapped") },
          { key: "redirected", label: `Redirected in ${c}`, count: count("redirected") },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>SAE</TableCell>
            <TableCell sx={{ ...headCell, textAlign: "right" }}>Companies</TableCell>
            <TableCell sx={{ ...headCell, textAlign: "right" }}>Contacts</TableCell>
            <TableCell sx={headCell}>Owner now</TableCell>
            <TableCell sx={headCell}>Goes to</TableCell>
            <TableCell sx={{ ...headCell, textAlign: "right" }}>Companies off</TableCell>
            <TableCell sx={{ ...headCell, textAlign: "right" }}>Contacts off</TableCell>
            <TableCell sx={headCell}>Redirect in {c}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {slice.map(({ s, t, was }) => {
              // as decide(): the SAE's person decides unless they do not work here (the zones then), or have left (the default)
              const decides = (t.how === "table" || t.how === "redirect") && !!t.owner;
              const left = decides && !names.active(t.owner!);
              const goes = decides ? (left ? fallback : t.owner) : null;
              const edited = t.owner !== was.owner || t.how !== was.how;
              const local = t.how === "redirect" ? t.owner : null;
              return (
                <TableRow key={s.sae} sx={{ verticalAlign: "top" }}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", color: INK, fontWeight: 600 }}>
                    <Box sx={clip(220)} title={s.sae}>{s.sae}</Box>
                  </TableCell>
                  <TableCell sx={num}>{full(s.companies)}</TableCell>
                  <TableCell sx={num}>{full(s.contacts)}</TableCell>
                  <TableCell sx={bodyCell}><OwnersNow list={s.ownerNow} names={names} /></TableCell>
                  <TableCell sx={{ ...bodyCell, minWidth: 190 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.84rem", color: INK, fontWeight: 600 }}>
                      {goes ? <><Swatch paint={palette(goes)} size={12} />{names.name(goes)}</> : <span style={{ color: MUTED, fontWeight: 400 }}>{isMap ? "by the map" : "by the zones"}</span>}
                      {edited && <Chip tint="amber">edited</Chip>}
                    </Box>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{left ? `${names.name(t.owner)} has left - the default` : targetText(t, cc, names)}</Typography>
                  </TableCell>
                  <TableCell sx={{ ...num, fontWeight: s.companiesOff ? 700 : 400, color: s.companiesOff ? "#a96a12" : INK }}>{s.companiesOff ? full(s.companiesOff) : "—"}</TableCell>
                  <TableCell sx={{ ...num, color: s.contactsOff ? "#a96a12" : INK }}>{s.contactsOff ? full(s.contactsOff) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, minWidth: 210 }}>
                    <OwnerPicker value={local ?? ""} names={names} disabled={!admin || isMap} allowEmpty placeholder="no redirect"
                      onChange={(o) => redirect(s.sae, o || null)} sx={{ minWidth: 190 }} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!shown.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{rows.length ? "Nothing with this filter." : `No company in ${c} has a Performis SAE.`}</Typography>}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.25 }}>
        Off = the owner, region responsibility or SAE differ from what the saved rules decide; counted again after Save and the next scan.
        {!admin && " Admins can redirect."}
      </Typography>
    </GlassCard>
  );
}

/* ── the SAE table ── */

type SaeRow = { id: string; k: string; owner: string };
type Unknown = { sae: string; companies: number; countries: string[] };

/** SAE values the table does not know, where the SAE decides: from the breakdown, else from the differences. */
function unknownSae(got: Got, d: MapData, rules: AssignRules, known: Set<string>): { list: Unknown[]; from: "breakdown" | "differences" } {
  const m = new Map<string, Unknown>();
  const add = (sae: string, cc: string, n: number) => {
    const k = saeKey(sae);
    if (!k || known.has(k)) return;
    const e = m.get(k);
    if (e) { e.companies += n; if (cc && !e.countries.includes(cc)) e.countries.push(cc); } else m.set(k, { sae: sae.trim(), companies: n, countries: cc ? [cc] : [] });
  };
  if (got.state === "ok") {
    for (const s of got.data.sae) if (saeTarget(rules, s.country, s.sae).how === "unmapped") add(s.sae, s.country, s.companies);
  } else {
    for (const c of d.changes) if (c.sae && c.decided.flags.includes("sae-unmapped")) add(c.sae, c.country ?? "", 1);
  }
  return { list: [...m.values()].sort((a, b) => b.companies - a.companies), from: got.state === "ok" ? "breakdown" : "differences" };
}

function SaeTableCard({ rules, setDraft, names, palette, d, admin, got }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; d: MapData; admin: boolean; got: Got }) {
  const [rows, setRows] = useState<SaeRow[]>(() => Object.entries(rules.sae).map(([k, owner]) => ({ id: newId("s"), k, owner: String(owner ?? "") })));
  const [q, setQ] = useState("");
  const push = (next: SaeRow[]) => {
    setRows(next);
    setDraft((dr) => ({ ...dr, sae: Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.owner])) }));
  };
  const keys = new Map<string, number>();
  rows.forEach((r, i) => { const k = saeKey(r.k); if (k && !keys.has(k)) keys.set(k, i); });
  const unknown = useMemo(() => unknownSae(got, d, rules, new Set(keys.keys())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [got, d, rules, rows]);
  const { slice: unknownSlice, pager: unknownPager } = usePaged(unknown.list, 12);
  const needle = q.trim().toLowerCase();
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.k.toLowerCase().includes(needle) || names.name(r.owner).toLowerCase().includes(needle));
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="purple" title={`The SAE table · ${rows.length}`}
        note="Performis SAE -> person, in every country the SAE decides (a country's redirects come first). Case, accents and word order do not count"
        right={<TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: "100%", sm: 220 } }} />} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: unknown.list.length ? 8 : 12 }}>
          <Box sx={{ display: "grid", gap: 0.75, maxHeight: 620, overflowY: "auto", pr: 0.5 }}>
            {shown.map(({ r, i }) => {
              const k = saeKey(r.k);
              const dup = k && keys.get(k) !== i ? keys.get(k)! : null;
              return (
                <Box key={r.id} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(180px, 1fr) auto" }, alignItems: "start" }}>
                  <TextField size="small" value={r.k} disabled={!admin} placeholder="SAE as Performis writes it" error={dup !== null || (!r.k.trim() && !!r.owner)}
                    helperText={dup !== null ? `same as "${rows[dup].k}"` : undefined} slotProps={{ htmlInput: { "aria-label": "SAE" } }}
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
        </Grid>
        {unknown.list.length > 0 && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box sx={{ ...box, bgcolor: "rgba(169,106,18,.05)", borderColor: "rgba(169,106,18,.25)" }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>SAE values the table does not know · {unknown.list.length}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1 }}>
                {unknown.from === "breakdown" ? "Where the SAE decides; these companies fall to the zones" : "Seen among the differences; these companies fall to the zones"}
              </Typography>
              <Box sx={{ display: "grid", gap: 0.5 }}>
                {unknownSlice.map((u) => (
                  <Box key={u.sae} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.82rem", color: INK, ...clip(260) }} title={u.sae}>{u.sae}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{full(u.companies)} compan{u.companies === 1 ? "y" : "ies"}{u.countries.length ? ` · ${u.countries.slice(0, 3).join(", ")}${u.countries.length > 3 ? ` +${u.countries.length - 3}` : ""}` : ""}</Typography>
                    </Box>
                    {admin && <Button size="small" sx={{ textTransform: "none", minWidth: 0 }} onClick={() => push([...rows, { id: newId("s"), k: u.sae, owner: "" }])}>Add</Button>}
                  </Box>
                ))}
              </Box>
              {unknownPager}
            </Box>
          </Grid>
        )}
      </Grid>
    </GlassCard>
  );
}

/* ── the view ── */

export function PerformisView({ d, rules, setDraft, cc, setCc, names, palette, rev, n }: {
  d: MapData; rules: AssignRules; setDraft: SetDraft; cc: string; setCc: (cc: string) => void; names: Names; palette: Palette; rev: number;
  /** the page's reload counter: Refresh reads the breakdown again too */
  n: number;
}) {
  const got = usePerformis(n);
  const stats = got.state === "ok" ? got.data.sae : [];
  const countries = useMemo(() => byCountry(stats, rules), [stats, rules]);
  const here = countries.some((c) => c.cc === cc) ? cc : countries[0]?.cc ?? null;
  const inHere = useMemo(() => stats.filter((s) => (s.country || "??") === here), [stats, here]);
  return (
    <>
      <FillsCard props={got.state === "ok" ? got.data.props : FALLBACK_PROPS} />
      {got.state === "loading" && <LoadingPanel key="performis-loading" label="Reading the SAE values per country…" />}
      {got.state === "missing" && <Info>The breakdown by country and SAE is not served yet - it appears once the hub answers it (GET ?performis=1). The SAE table below works already.</Info>}
      {got.state === "error" && <Typography sx={{ fontSize: "0.84rem", color: RED }}>The breakdown could not be read: {got.error}</Typography>}
      {got.state === "ok" && (
        <>
          {got.data.at && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: -1 }}>From the scan of {when(got.data.at)}{got.stale ? " - reading again…" : ""}</Typography>}
          <CountriesCard rows={countries} cc={here} onPick={setCc} d={d} rules={rules} />
          {here && <SaeByCountryCard key={`${here}-${rev}`} cc={here} stats={inHere} rules={rules} saved={d.rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} />}
        </>
      )}
      <SaeTableCard key={`sae-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} d={d} admin={d.admin} got={got} />
    </>
  );
}
