"use client";

// MAP ASSIGNMENT - the SAE table, every country (SARCLA 20.10.2026: "SAE table all countries - put it on a completely
// separate tab"): the HubSpot workflow's table SAE -> person, used wherever rule 1 is on; a country's overrides (the Rules
// window) come first. Its own view on the page; edits are the page's draft, saved with the page's Save.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { saeKey, type AssignRules } from "@/lib/mapAssign/rules";
import type { MapData, PerformisData } from "@/lib/mapAssign/api";
import { API, OwnerPicker, Swatch, newId, takesOver, type Names, type Palette, type SetDraft } from "./shared";
import type { Owner } from "@/lib/mapAssign/api";
import TextFieldSelect from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { LEADS, isLead, leadTeam, type Lead } from "@/lib/mapAssign/leadsRules";

const hint = { fontSize: "0.8rem", color: MUTED, lineHeight: 1.5 };
const head = { fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const row = { display: "grid", gap: 1.25, alignItems: "center", px: 1.25, py: 0.9, borderBottom: `1px solid ${HAIRLINE}` };
const numSx = { fontSize: "0.84rem", color: INK, fontVariantNumeric: "tabular-nums", textAlign: { xs: "left", md: "right" } as const };

/* ── the SAE values (GET ?performis=1) ── */

export type Got = { state: "loading" } | { state: "ok"; data: PerformisData } | { state: "missing" } | { state: "error"; error: string };
export function usePerformis(n: number): Got {
  const url = `${API}?performis=1${n ? `&n=${n}` : ""}`;
  const held = useHeld<PerformisData>(url, [url]);
  const r = held.result;
  if (r === null) return { state: "loading" };
  if (r.state === "ok") { const x = r.data as Partial<PerformisData> | null; return x && Array.isArray(x.sae) ? { state: "ok", data: x as PerformisData } : { state: "missing" }; }
  if (r.state === "error" && (r.status === 404 || r.status === 400)) return { state: "missing" };
  return { state: "error", error: r.state === "error" ? r.error : "not configured" };
}

/* ── the line managers (SARCLA 25.10.2026: "a column line manager so we can pick a line manager for each ESO") ── */

/** owner id -> RABE | SARCLA | FALU, read once, saved on every pick - outside the page's draft and the rules */
function useLeads(): { leads: Record<string, Lead>; set: (owner: string, lead: Lead | null) => void; err: string | null } {
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/leads`).then((r) => r.json()).then((j) => { if (alive && j?.ok) setLeads(j.leads ?? {}); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const set = (owner: string, lead: Lead | null) => {
    setLeads((l) => { const n = { ...l }; if (lead) n[owner] = lead; else delete n[owner]; return n; });
    fetch(`${API}/leads`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: owner, lead }) })
      .then((r) => r.json()).then((j) => { if (j?.ok) { setLeads(j.leads ?? {}); setErr(null); } else setErr(j?.error ?? "not saved"); })
      .catch((e) => setErr(String(e?.message ?? e)));
  };
  return { leads, set, err };
}

/* ── the table ── */

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
  const lm = useLeads();
  const needle = q.trim().toLowerCase();
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.k.toLowerCase().includes(needle) || names.name(r.owner).toLowerCase().includes(needle));
  const cols = { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(220px, 1fr) 150px 100px 36px" };
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography sx={hint}>For <b>every country</b> where rule 1 is on: SAE → person. A country&apos;s overrides (Rules on the map) come first. Case, accents and word order do not count.</Typography>
      <TextField size="small" placeholder="find an SAE or person" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 320 }} />
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ ...row, display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
          <Typography sx={head}>SAE (as Performis writes it)</Typography>
          <Typography sx={head}>Person</Typography>
          <Typography sx={head} title="The ESO team each person is in - the ESO Figures' RABE / SARCLA / FALU TEAM. Saved as soon as it is picked">Line manager</Typography>
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
              <Box sx={{ display: "grid", gap: 0.25, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <Swatch paint={palette(r.owner)} size={13} />
                  <OwnerPicker value={r.owner} names={names} disabled={!admin} onChange={(owner) => push(rows.map((x) => (x.id === r.id ? { ...x, owner } : x)))} sx={{ flex: 1, minWidth: 0 }} />
                </Box>
                {r.owner && !names.active(r.owner) && (
                  <Typography sx={{ fontSize: "0.74rem", color: takesOver(rules, names, r.owner) !== r.owner ? "#1b7a55" : "#a96a12" }}>
                    {takesOver(rules, names, r.owner) !== r.owner ? `has left - ${names.name(takesOver(rules, names, r.owner))} takes over` : "has left - nobody takes over yet: the default person"}
                  </Typography>
                )}
              </Box>
              {/* one line manager per person: several SAE spellings of one person share it */}
              <TextFieldSelect select size="small" value={r.owner && lm.leads[r.owner] ? lm.leads[r.owner] : ""} disabled={!admin || !r.owner}
                onChange={(e) => lm.set(r.owner, isLead(e.target.value) ? e.target.value : null)}
                slotProps={{ htmlInput: { "aria-label": `Line manager of ${names.name(r.owner) || "this person"}` } }} sx={{ minWidth: 0 }}>
                <MenuItem value="">—</MenuItem>
                {LEADS.map((l) => <MenuItem key={l} value={l}>{leadTeam(l)}</MenuItem>)}
              </TextFieldSelect>
              <Typography sx={numSx}>{k && counts.has(k) ? full(counts.get(k)!) : "—"}</Typography>
              {admin ? <IconButton size="small" onClick={() => push(rows.filter((x) => x.id !== r.id))} aria-label={`Remove SAE ${r.k}`}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
            </Box>
          );
        })}
      </Box>
      {admin && <Button size="small" startIcon={<AddIcon />} sx={{ textTransform: "none", justifySelf: "start" }} onClick={() => push([...rows, { id: newId("s"), k: "", owner: "" }])}>Add an SAE</Button>}
      <Typography sx={hint}>Line manager: the ESO team each person is in (RABE, SARCLA or FALU TEAM) - the ESO Figures show each team on its own. Saved as soon as it is picked, apart from Save above.{lm.err ? ` Not saved: ${lm.err}` : ""}</Typography>
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

/** Who takes over from the people who have left (SARCLA 25.10.2026: "check all the workflow redirections - task, ticket
 *  and assignment - and put them"): prefilled from the HubSpot workflows that move their tickets and tasks; wherever the
 *  rules give a company to someone who has left (an SAE, a zone, a key account), it goes to their successor. */
function Successors({ rules, setDraft, names, palette, admin, owners }: { rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette; admin: boolean; owners: Owner[] }) {
  const succ = rules.successors ?? {};
  const left = owners.filter((o) => !o.active);
  // the people who have left that the rules still point to, and those already given a successor
  const pointed = new Set<string>([...Object.values(rules.sae).map(String), ...Object.values(rules.countries).flatMap((r) => [...r.zones.map((z) => String(z.owner)), ...(r.keyAccounts ?? []).map((k) => String(k.owner))])]);
  const ids = [...new Set([...Object.keys(succ), ...left.map((o) => String(o.id)).filter((id) => pointed.has(id))])];
  const set = (from: string, to: string | null) => setDraft((dr) => {
    const next = { ...(dr.successors ?? {}) };
    if (to) next[from] = to; else delete next[from];
    return { ...dr, successors: next };
  });
  const [adding, setAdding] = useState("");
  const cols = { xs: "minmax(0, 1fr)", md: "minmax(200px, 1fr) minmax(220px, 1.2fr) 36px" };
  return (
    <Box sx={{ display: "grid", gap: 1.25, mt: 3 }}>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>People who have left - who takes over</Typography>
      <Typography sx={hint}>Wherever the rules give a company to someone who has left - an SAE above, a zip-code zone, a key account - it goes to who takes over (otherwise to the default person). Their open tickets and tasks are not moved.</Typography>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ ...row, display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, bgcolor: "rgba(21,34,58,.03)", py: 0.75 }}>
          <Typography sx={head}>Has left</Typography>
          <Typography sx={head}>Takes over</Typography>
          <span />
        </Box>
        {ids.map((id) => (
          <Box key={id} sx={{ ...row, gridTemplateColumns: cols }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{names.name(id)}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Swatch paint={palette(succ[id] ?? "")} size={13} />
              <OwnerPicker value={succ[id] ?? null} names={names} disabled={!admin} allowEmpty placeholder="nobody - the default person" onChange={(o) => set(id, o || null)} sx={{ flex: 1, minWidth: 0 }} />
            </Box>
            {admin && succ[id] ? <IconButton size="small" onClick={() => set(id, null)} aria-label={`No successor for ${names.name(id)}`}><CloseIcon sx={{ fontSize: 16 }} /></IconButton> : <span />}
          </Box>
        ))}
        {!ids.length && <Typography sx={{ ...hint, p: 1.5 }}>No rule points to someone who has left.</Typography>}
      </Box>
      {admin && (
        <TextFieldSelect select size="small" value={adding} onChange={(e) => { const v = e.target.value; setAdding(""); if (v) set(v, rules.defaultOwner); }} label="Someone else who has left" sx={{ maxWidth: 320 }}>
          <MenuItem value="">pick a person</MenuItem>
          {left.filter((o) => !ids.includes(String(o.id))).sort((a, b) => a.name.localeCompare(b.name)).map((o) => <MenuItem key={o.id} value={String(o.id)}>{o.name}</MenuItem>)}
        </TextFieldSelect>
      )}
    </Box>
  );
}

export function SaeTableView({ d, rules, setDraft, names, palette, rev, n }: {
  d: MapData; rules: AssignRules; setDraft: SetDraft; names: Names; palette: Palette;
  /** the page's rules version (a save or an undo re-reads every field) and reload counter */
  rev: number; n: number;
}) {
  const got = usePerformis(n);
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<BadgeOutlinedIcon />} tint="purple" title={`SAE table · all countries · ${Object.keys(rules.sae).length}`}
        note="SAE -> person, wherever rule 1 is on. Save on the bar above keeps changes" />
      <TableTab key={`table-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} got={got} />
      <Successors key={`succ-${rev}`} rules={rules} setDraft={setDraft} names={names} palette={palette} admin={d.admin} owners={d.owners} />
    </GlassCard>
  );
}
