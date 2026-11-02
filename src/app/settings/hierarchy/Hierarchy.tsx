"use client";
// SETTINGS > HIERARCHY - who reports to whom, and in which unit, for every HubSpot owner (SARCLA 01.11.2026: "bring another
// sub-app to Settings to define the hierarchy - keep the existing; Back Office is under Rose, Italy is Luca as sales
// leader, also reporting directly to Alexandre, the CEO"). Drawn as a tree, top down (./OrgChart.tsx), or as a list with
// each row's unit and manager set in place. What is not set keeps what the hub knew before (the rosters, HubSpot's teams, Map assignment's line managers).

import { Fragment, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { ReportTabs } from "@/app/uc/report/Tabs";
import { OrgChart, TagPicks, type Move } from "./OrgChart";
import { TAGS, effective, under, type Hierarchy, type Tag } from "@/lib/hierarchy/rules";
import type { HierarchyPerson } from "@/lib/hierarchy/store";

type Data = { ok?: boolean; error?: string; people: HierarchyPerson[]; saved: Hierarchy; seed: Hierarchy; units: string[] };
const INHERIT = "\u0000inherit", NONE = "\u0000none";

export default function HierarchyPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState("");
  // the tree, top down (SARCLA 01.11.2026: "I want to see it as a hierarchy tree ... like a top-down diagram"), or the list
  const [view, setView] = useState<"tree" | "list">("tree");
  useEffect(() => {
    fetch("/api/settings/hierarchy").then((r) => r.json())
      .then((j: Data) => { if (j.ok) setD(j); else setError(j.error ?? "The hierarchy could not be read."); })
      .catch((e) => setError(String((e as Error)?.message ?? e)));
  }, []);

  const placed = useMemo(() => (d ? effective(d.saved, d.seed) : {}), [d]);
  const byId = useMemo(() => new Map((d?.people ?? []).map((p) => [p.id, p])), [d]);
  const shown = (p: HierarchyPerson) => p.active || inactive || !!d?.saved[p.id];
  // the tree: people at the top (no manager, or one not shown), each followed by those under them
  const rows = useMemo(() => {
    if (!d) return [];
    const people = d.people.filter(shown).sort((a, b) => a.name.localeCompare(b.name));
    const ids = new Set(people.map((p) => p.id));
    const kids = new Map<string, HierarchyPerson[]>();
    const roots: HierarchyPerson[] = [];
    for (const p of people) {
      const m = placed[p.id]?.manager;
      if (m && ids.has(m)) kids.set(m, [...(kids.get(m) ?? []), p]); else roots.push(p);
    }
    const out: { p: HierarchyPerson; depth: number }[] = [];
    const walk = (p: HierarchyPerson, depth: number) => { out.push({ p, depth }); for (const k of kids.get(p.id) ?? []) walk(k, depth + 1); };
    // the people with someone under them first, then everyone else
    roots.sort((a, b) => Number(kids.has(b.id)) - Number(kids.has(a.id)) || a.name.localeCompare(b.name)).forEach((p) => walk(p, 0));
    const needle = q.trim().toLowerCase();
    return needle ? out.filter((r) => r.p.name.toLowerCase().includes(needle) || (r.p.email ?? "").toLowerCase().includes(needle) || (placed[r.p.id]?.unit ?? "").toLowerCase().includes(needle)
      || (placed[r.p.id]?.tags ?? []).some((t) => TAGS.find((x) => x.id === t)!.label.toLowerCase().includes(needle))) : out;
  }, [d, placed, q, inactive]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = useMemo(() => [...new Set([...(d?.units ?? []), ...Object.values(placed).map((x) => x.unit).filter((x): x is string => !!x)])], [d, placed]);
  const managers = useMemo(() => (d?.people ?? []).filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)), [d]);

  const put = async (body: Record<string, unknown>, key: string) => {
    setBusy(key); setError(null);
    try {
      const r = await fetch("/api/settings/hierarchy", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setError(j.error ?? "Not saved."); return; }
      setD((x) => (x ? { ...x, ...(j.saved ? { saved: j.saved } : {}), ...(j.units ? { units: j.units } : {}) } : x));
    } finally { setBusy(null); }
  };

  const move = (moves: Move[]) => put({ moves }, "moves");
  const setUnit = (ownerId: string, unit: string | null | "inherit") => put({ ownerId, unit }, `${ownerId}:unit`);
  // Sales leader, BUC member: tags only (SARCLA 02.11.2026)
  const setTags = (ownerId: string, tags: Tag[]) => put({ ownerId, tags }, `${ownerId}:tags`);

  if (!d) {
    return (
      <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 } }}>
        <GlassCard><Typography sx={{ fontSize: "0.88rem", color: error ? RED : MUTED }}>{error ?? "Reading HubSpot's owners…"}</Typography></GlassCard>
      </Box>
    );
  }
  const seedWords = (id: string, field: "manager" | "unit") => {
    const v = d.seed[id]?.[field];
    if (!v) return field === "manager" ? "no one" : "no unit";
    return field === "manager" ? byId.get(v)?.name ?? `owner ${v}` : v;
  };
  const sel = { fontSize: "0.82rem", borderRadius: "10px", bgcolor: "#fff", "& .MuiSelect-select": { py: 0.6 } };
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2 }}>
      <GlassCard sx={{ display: "grid", gap: 1.75 }}>
        <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="Hierarchy"
          note="Who reports to whom, and in which unit - every HubSpot owner. My Sales Reports reads it: My team is everyone under a person, All ESO or All TSA their unit's. What is not set here keeps what the hub knew before - the rosters and HubSpot's teams for the unit, Map assignment's line managers for the manager." />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "10px", px: 1.25, bgcolor: "#fff", minWidth: 260 }}>
            <SearchIcon sx={{ fontSize: 18, color: FAINT }} />
            <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="A name, an email or a unit" sx={{ fontSize: "0.86rem", flex: 1, py: 0.5 }} />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Switch size="small" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
            <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>People who have left too</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600 }}>Units</Typography>
            {(d.units ?? []).map((u) => (
              <Chip key={u} size="small" label={u} onDelete={() => void put({ units: d.units.filter((x) => x !== u) }, "units")} sx={{ fontSize: "0.76rem" }} />
            ))}
            <InputBase value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="New unit"
              onKeyDown={(e) => { if (e.key === "Enter" && newUnit.trim()) { void put({ units: [...d.units, newUnit] }, "units"); setNewUnit(""); } }}
              sx={{ fontSize: "0.8rem", border: `1px solid ${HAIRLINE}`, borderRadius: "8px", px: 1, width: 110, bgcolor: "#fff" }} />
          </Box>
        </Box>
        {error && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{error}</Typography>}
        <Box sx={{ justifySelf: "start" }}>
          <ReportTabs name="hierarchy-view" tab={view} onSelect={setView} tabs={[{ id: "tree", label: "Tree", count: null }, { id: "list", label: "List", count: null }]} />
        </Box>
        {view === "tree" && (
          <OrgChart people={d.people.filter(shown)} placed={placed} saved={d.saved} seed={d.seed} units={units} q={q} busy={busy !== null}
            onMove={move} onUnit={setUnit} onTags={setTags} />
        )}
        {view === "list" && <>
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 190px 240px 230px", columnGap: 1.5, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", py: 0.75 }}>Person</Typography>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Unit</Typography>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reports to</Typography>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tags</Typography>
          {rows.map(({ p, depth }) => {
            const s = d.saved[p.id] ?? {};
            const pl = placed[p.id] ?? { manager: null, unit: null };
            const below = new Set(under(placed, p.id));
            const n = below.size;
            return (
              <Fragment key={p.id}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, pl: depth * 2.5, py: 0.6, borderTop: `1px solid ${HAIRLINE}`, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: "0.86rem", fontWeight: n ? 700 : 500, color: p.active ? INK : FAINT }}>{depth > 0 ? "└ " : ""}{p.name}</Typography>
                  {n > 0 && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{n} under them</Typography>}
                  {!p.active && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>has left</Typography>}
                </Box>
                <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 0.4 }}>
                  <Select size="small" fullWidth disabled={busy === `${p.id}:unit`} value={s.unit === undefined ? INHERIT : s.unit === null ? NONE : s.unit}
                    onChange={(e) => { const v = String(e.target.value); void put({ ownerId: p.id, unit: v === INHERIT ? "inherit" : v === NONE ? null : v }, `${p.id}:unit`); }}
                    renderValue={(v) => (v === INHERIT ? <span style={{ color: pl.unit ? INK : FAINT }}>{pl.unit ?? "No unit"} <span style={{ color: FAINT }}>· as before</span></span> : v === NONE ? "No unit" : String(v))} sx={sel}>
                    <MenuItem value={INHERIT} sx={{ fontSize: "0.84rem" }}>As before ({seedWords(p.id, "unit")})</MenuItem>
                    <MenuItem value={NONE} sx={{ fontSize: "0.84rem" }}>No unit</MenuItem>
                    {units.map((u) => <MenuItem key={u} value={u} sx={{ fontSize: "0.84rem" }}>{u}</MenuItem>)}
                  </Select>
                </Box>
                <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 0.4 }}>
                  <Select size="small" fullWidth disabled={busy === `${p.id}:manager`} value={s.manager === undefined ? INHERIT : s.manager === null ? NONE : s.manager}
                    onChange={(e) => { const v = String(e.target.value); void put({ ownerId: p.id, manager: v === INHERIT ? "inherit" : v === NONE ? null : v }, `${p.id}:manager`); }}
                    renderValue={(v) => (v === INHERIT ? <span style={{ color: pl.manager ? INK : FAINT }}>{pl.manager ? byId.get(pl.manager)?.name ?? pl.manager : "No one - at the top"} <span style={{ color: FAINT }}>· as before</span></span> : v === NONE ? "No one - at the top" : byId.get(String(v))?.name ?? String(v))} sx={sel}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}>
                    <MenuItem value={INHERIT} sx={{ fontSize: "0.84rem" }}>As before ({seedWords(p.id, "manager")})</MenuItem>
                    <MenuItem value={NONE} sx={{ fontSize: "0.84rem" }}>No one - at the top</MenuItem>
                    {managers.filter((m) => m.id !== p.id && !below.has(m.id)).map((m) => <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.84rem" }}>{m.name}</MenuItem>)}
                    {/* a manager who has left, still set: shown so the value stands */}
                    {s.manager && !managers.some((m) => m.id === s.manager) && <MenuItem value={s.manager} sx={{ fontSize: "0.84rem" }}>{byId.get(s.manager)?.name ?? s.manager}</MenuItem>}
                  </Select>
                </Box>
                <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 0.4, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
                  <TagPicks tags={s.tags ?? []} busy={busy === `${p.id}:tags`} onChange={(t) => void setTags(p.id, t)} />
                </Box>
              </Fragment>
            );
          })}
        </Box>
        {rows.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nobody matches.</Typography>}
        </>}
        <Box><Button size="small" onClick={() => { setQ(""); setInactive(false); }} sx={{ textTransform: "none", display: q || inactive ? "inline-flex" : "none" }}>Clear</Button></Box>
      </GlassCard>
    </Box>
  );
}
