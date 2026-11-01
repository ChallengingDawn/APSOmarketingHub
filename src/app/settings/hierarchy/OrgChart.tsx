"use client";
// THE HIERARCHY AS A TREE, TOP DOWN (SARCLA 01.11.2026: "I want to see it as a hierarchy tree, collapsing parents, like a
// top-down diagram where you can change person and leader"). Each person a card under their manager, a branch folded
// away with its chevron; a card dragged onto another puts them under that person, onto the top zone at the top; a click
// opens the card - its unit, who it reports to, its people handed over to someone else, someone put under it. Who is
// under nobody and has nobody under them waits in "Not placed yet", to be dragged in.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { FAINT, HAIRLINE, INK, MUTED, TINT, glass, type Tint } from "@/app/uc/report/ui";
import { under, type Hierarchy } from "@/lib/hierarchy/rules";
import type { HierarchyPerson } from "@/lib/hierarchy/store";

type Placed = Record<string, { manager: string | null; unit: string | null }>;
export type Move = { ownerId: string; manager: string | null };

const INHERIT = "\u0000inherit", NONE = "\u0000none", PICK = "\u0000pick";
const LINE = "#c5cfdd";
const TONES: Tint[] = ["blue", "green", "purple", "amber", "pink", "slate"];
/** A unit's colour, the same wherever it shows: the known ones fixed, apart from each other; any other by its name. */
const KNOWN: Record<string, Tint> = { eso: "blue", tsa: "green", "back office": "pink", backoffice: "pink", italy: "amber", management: "purple" };
const toneOf = (unit: string | null): Tint => {
  if (!unit) return "slate";
  const k = unit.toLowerCase().replace(/\s+team$/, "").trim();
  return KNOWN[k] ?? KNOWN[Object.keys(KNOWN).find((x) => k.includes(x)) ?? ""] ?? TONES[[...unit].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
};

/** The classic top-down connectors: a line down from each card, across its people, down to each of them. */
const TREE = {
  m: 0, p: 0, display: "flex", justifyContent: "center",
  "& ul": { m: 0, p: 0, pt: "20px", position: "relative", display: "flex", justifyContent: "center" },
  "& li": { listStyle: "none", position: "relative", p: "20px 6px 0", display: "flex", flexDirection: "column", alignItems: "center" },
  "& li::before, & li::after": { content: '""', position: "absolute", top: 0, right: "50%", borderTop: `1.5px solid ${LINE}`, width: "50%", height: "20px" },
  "& li::after": { right: "auto", left: "50%", borderLeft: `1.5px solid ${LINE}` },
  "& li:only-child::before, & li:only-child::after": { display: "none" },
  "& li:only-child": { pt: 0 },
  "& li:first-of-type::before, & li:last-of-type::after": { border: "0 none" },
  "& li:last-of-type::before": { borderRight: `1.5px solid ${LINE}`, borderRadius: "0 8px 0 0" },
  "& li:first-of-type::after": { borderRadius: "8px 0 0 0" },
  "& ul ul::before, & > li > ul::before": { content: '""', position: "absolute", top: 0, left: "50%", borderLeft: `1.5px solid ${LINE}`, width: 0, height: "20px" },
} as const;

export function OrgChart({ people, placed, saved, seed, units, q, busy, onMove, onUnit }: {
  people: HierarchyPerson[]; placed: Placed; saved: Hierarchy; seed: Hierarchy; units: string[]; q: string; busy: boolean;
  onMove: (moves: Move[]) => Promise<void>;
  onUnit: (ownerId: string, unit: string | null | "inherit") => Promise<void>;
}) {
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const { kids, trees, tray } = useMemo(() => {
    const ids = new Set(people.map((p) => p.id));
    const kids = new Map<string, HierarchyPerson[]>();
    const roots: HierarchyPerson[] = [];
    for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
      const m = placed[p.id]?.manager;
      if (m && ids.has(m)) kids.set(m, [...(kids.get(m) ?? []), p]); else roots.push(p);
    }
    // the biggest trees first; who has nobody under them and is under nobody waits to be placed
    const size = (id: string): number => (kids.get(id) ?? []).reduce((a, k) => a + 1 + size(k.id), 0);
    const trees = roots.filter((r) => kids.has(r.id)).sort((a, b) => size(b.id) - size(a.id) || a.name.localeCompare(b.name));
    return { kids, trees, tray: roots.filter((r) => !kids.has(r.id)) };
  }, [people, placed]);

  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; el: HTMLElement } | null>(null);
  const needle = q.trim().toLowerCase();
  const hits = (p: HierarchyPerson) => !!needle && (p.name.toLowerCase().includes(needle) || (p.email ?? "").toLowerCase().includes(needle) || (placed[p.id]?.unit ?? "").toLowerCase().includes(needle));

  // a card may go under anyone but itself and those under it; NONE = to the top
  const canDrop = (target: string) => !!drag && drag !== target && (target === NONE || !under(placed, drag).includes(target));
  const dropOn = (target: string) => {
    const who = drag;
    setDrag(null); setOver(null);
    if (!who || !canDrop(target)) return;
    if ((placed[who]?.manager ?? null) === (target === NONE ? null : target)) return;
    void onMove([{ ownerId: who, manager: target === NONE ? null : target }]);
  };
  const dropZone = (target: string) => ({
    onDragOver: (e: React.DragEvent) => { if (canDrop(target)) { e.preventDefault(); setOver(target); } },
    onDragLeave: () => setOver((o) => (o === target ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); dropOn(target); },
  });

  const card = (p: HierarchyPerson, compact = false) => {
    const n = under(placed, p.id).length;
    const direct = kids.get(p.id)?.length ?? 0;
    const unit = placed[p.id]?.unit ?? null;
    const tone = TINT[toneOf(unit)];
    const isFolded = folded.has(p.id);
    return (
      <Box key={p.id} draggable={!busy}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; setDrag(p.id); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        {...dropZone(p.id)}
        onClick={(e) => setOpen({ id: p.id, el: e.currentTarget })}
        title="Drag onto someone to put them under that person - click to change"
        sx={{
          ...glass, bgcolor: "#fff", borderRadius: "12px", px: 1.25, py: compact ? 0.6 : 0.9, width: compact ? 200 : 188, cursor: busy ? "progress" : "grab",
          textAlign: "left", position: "relative", userSelect: "none",
          borderTop: `3px solid ${tone.fg}`,
          outline: over === p.id ? `2px solid ${TINT.blue.fg}` : hits(p) ? `2px solid ${TINT.amber.fg}` : "none",
          opacity: drag === p.id ? 0.4 : p.active ? 1 : 0.6,
          transition: "outline-color .1s ease",
        }}>
        <Typography noWrap sx={{ fontSize: "0.84rem", fontWeight: n ? 700 : 600, color: INK, pr: direct ? 3 : 0 }}>{p.name}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.72rem", fontWeight: 600, color: unit ? tone.fg : FAINT, bgcolor: unit ? tone.bg : "transparent", px: unit ? 0.75 : 0, borderRadius: "6px", maxWidth: 96, flexShrink: 1 }}>
            {unit ?? "no unit"}
          </Typography>
          {n > 0 && <Typography noWrap sx={{ fontSize: "0.7rem", color: MUTED, flexShrink: 0 }}>{n} under</Typography>}
          {!p.active && <Typography noWrap sx={{ fontSize: "0.7rem", color: FAINT }}>has left</Typography>}
        </Box>
        {direct > 0 && (
          <IconButton size="small" aria-label={isFolded ? `Open ${p.name}'s people` : `Fold ${p.name}'s people`}
            onClick={(e) => { e.stopPropagation(); setFolded((f) => { const x = new Set(f); if (x.has(p.id)) x.delete(p.id); else x.add(p.id); return x; }); }}
            sx={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, color: MUTED }}>
            {isFolded ? <ChevronRightIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>
    );
  };

  // a person and, unfolded, their people beneath: the leaves of a branch stacked as a column, so a wide team stays narrow
  const node = (p: HierarchyPerson): React.ReactNode => {
    const ch = kids.get(p.id) ?? [];
    const show = ch.length > 0 && !folded.has(p.id);
    const leaves = ch.every((c) => !kids.has(c.id));
    return (
      <li key={p.id}>
        {card(p)}
        {show && (leaves && ch.length > 3
          ? <ul><li><Box sx={{ display: "grid", gap: 0.75, p: 1, borderRadius: "14px", border: `1px dashed ${LINE}` }}>{ch.map((c) => card(c, true))}</Box></li></ul>
          : <ul>{ch.map(node)}</ul>)}
      </li>
    );
  };

  const all = (fold: boolean) => setFolded(fold ? new Set([...kids.keys()]) : new Set());
  const p = open ? byId.get(open.id) ?? null : null;
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
          Drag a card onto someone to put them under that person; click a card to change it.
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => all(false)} sx={{ textTransform: "none" }}>Open all</Button>
        <Button size="small" onClick={() => all(true)} sx={{ textTransform: "none" }}>Fold all</Button>
      </Box>

      {/* the top: drop a card here and they report to no one */}
      <Box {...dropZone(NONE)} sx={{ border: `1.5px dashed ${over === NONE ? TINT.blue.fg : LINE}`, borderRadius: "14px", p: 1, textAlign: "center", bgcolor: over === NONE ? TINT.blue.bg : "transparent" }}>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>Drop here to put someone at the top - reporting to no one</Typography>
      </Box>

      <Box sx={{ overflowX: "auto", pb: 1 }}>
        {trees.length === 0
          ? <Typography sx={{ fontSize: "0.86rem", color: MUTED, py: 3, textAlign: "center" }}>Nobody reports to anyone yet - drag people from &quot;Not placed yet&quot; onto their manager, or click a card and pick who they report to.</Typography>
          : (
            <Box sx={{ display: "flex", gap: 5, alignItems: "flex-start", width: "max-content", minWidth: "100%", justifyContent: "center", py: 1 }}>
              {trees.map((r) => <Box key={r.id} component="ul" sx={TREE}>{node(r)}</Box>)}
            </Box>
          )}
      </Box>

      {/* who is under nobody and has nobody under them */}
      <Box {...dropZone(NONE)} sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.5, display: "grid", gap: 1 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>
          Not placed yet <span style={{ color: MUTED, fontWeight: 500 }}>· {tray.length} - drag each onto their manager</span>
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {tray.filter((x) => !needle || hits(x)).map((x) => card(x, true))}
        </Box>
      </Box>

      <Popover open={!!open && !!p} anchorEl={open?.el} onClose={() => setOpen(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: "14px", p: 2, width: 320, display: "grid", gap: 1.25 } } }}>
        {p && <Editor p={p} placed={placed} saved={saved} seed={seed} units={units} people={people} kids={kids.get(p.id) ?? []} byId={byId} busy={busy}
          onMove={async (m) => { await onMove(m); }} onUnit={onUnit} />}
      </Popover>
    </Box>
  );
}

/** One card, opened: its unit, who it reports to, its people handed over, someone put under it. */
function Editor({ p, placed, saved, seed, units, people, kids, byId, busy, onMove, onUnit }: {
  p: HierarchyPerson; placed: Placed; saved: Hierarchy; seed: Hierarchy; units: string[]; people: HierarchyPerson[];
  kids: HierarchyPerson[]; byId: Map<string, HierarchyPerson>; busy: boolean;
  onMove: (m: Move[]) => Promise<void>; onUnit: (ownerId: string, unit: string | null | "inherit") => Promise<void>;
}) {
  const s = saved[p.id] ?? {};
  const below = new Set(under(placed, p.id));
  // those above them, at any height: not someone to put under them
  const above = new Set<string>();
  for (let m = placed[p.id]?.manager ?? null; m && !above.has(m); m = placed[m]?.manager ?? null) above.add(m);
  const active = people.filter((x) => x.active).sort((a, b) => a.name.localeCompare(b.name));
  const sel = { fontSize: "0.84rem", borderRadius: "10px", "& .MuiSelect-select": { py: 0.75 } };
  const label = (t: string) => <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t}</Typography>;
  const seedUnit = seed[p.id]?.unit ?? null, seedManager = seed[p.id]?.manager ?? null;
  return (
    <>
      <Box>
        <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: INK }}>{p.name}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{p.email ?? "no email"}{p.hsTeam ? ` · HubSpot team ${p.hsTeam}` : ""}{p.active ? "" : " · has left"}</Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {label("Unit")}
        <Select size="small" disabled={busy} value={s.unit === undefined ? INHERIT : s.unit === null ? NONE : s.unit} sx={sel}
          onChange={(e) => { const v = String(e.target.value); void onUnit(p.id, v === INHERIT ? "inherit" : v === NONE ? null : v); }}>
          <MenuItem value={INHERIT} sx={{ fontSize: "0.84rem" }}>As before ({seedUnit ?? "no unit"})</MenuItem>
          <MenuItem value={NONE} sx={{ fontSize: "0.84rem" }}>No unit</MenuItem>
          {[...new Set([...units, ...(s.unit ? [s.unit] : [])])].map((u) => <MenuItem key={u} value={u} sx={{ fontSize: "0.84rem" }}>{u}</MenuItem>)}
        </Select>
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {label("Reports to")}
        <Select size="small" disabled={busy} value={placed[p.id]?.manager ?? NONE} sx={sel} MenuProps={{ PaperProps: { sx: { maxHeight: 380 } } }}
          onChange={(e) => { const v = String(e.target.value); void onMove([{ ownerId: p.id, manager: v === NONE ? null : v }]); }}>
          <MenuItem value={NONE} sx={{ fontSize: "0.84rem" }}>No one - at the top</MenuItem>
          {active.filter((x) => x.id !== p.id && !below.has(x.id)).map((x) => <MenuItem key={x.id} value={x.id} sx={{ fontSize: "0.84rem" }}>{x.name}</MenuItem>)}
          {placed[p.id]?.manager && !active.some((x) => x.id === placed[p.id]?.manager) && <MenuItem value={placed[p.id]!.manager!} sx={{ fontSize: "0.84rem" }}>{byId.get(placed[p.id]!.manager!)?.name ?? placed[p.id]!.manager}</MenuItem>}
        </Select>
        {s.manager === undefined && seedManager && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>As before: {byId.get(seedManager)?.name ?? seedManager}, from Map assignment</Typography>}
      </Box>
      {kids.length > 0 && (
        <Box sx={{ display: "grid", gap: 0.5 }}>
          {label(`Hand their ${kids.length} ${kids.length === 1 ? "person" : "people"} to`)}
          <Select size="small" disabled={busy} value={PICK} sx={sel} MenuProps={{ PaperProps: { sx: { maxHeight: 380 } } }}
            onChange={(e) => { const v = String(e.target.value); if (v !== PICK) void onMove(kids.map((k) => ({ ownerId: k.id, manager: v === NONE ? null : v }))); }}>
            <MenuItem value={PICK} sx={{ fontSize: "0.84rem", color: FAINT }}>Pick their new leader…</MenuItem>
            <MenuItem value={NONE} sx={{ fontSize: "0.84rem" }}>No one - each at the top</MenuItem>
            {active.filter((x) => x.id !== p.id && !below.has(x.id)).map((x) => <MenuItem key={x.id} value={x.id} sx={{ fontSize: "0.84rem" }}>{x.name}</MenuItem>)}
          </Select>
        </Box>
      )}
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {label("Put someone under them")}
        <Select size="small" disabled={busy} value={PICK} sx={sel} MenuProps={{ PaperProps: { sx: { maxHeight: 380 } } }}
          onChange={(e) => { const v = String(e.target.value); if (v !== PICK) void onMove([{ ownerId: v, manager: p.id }]); }}>
          <MenuItem value={PICK} sx={{ fontSize: "0.84rem", color: FAINT }}>Pick a person…</MenuItem>
          {active.filter((x) => x.id !== p.id && !above.has(x.id) && placed[x.id]?.manager !== p.id).map((x) => <MenuItem key={x.id} value={x.id} sx={{ fontSize: "0.84rem" }}>{x.name}</MenuItem>)}
        </Select>
      </Box>
    </>
  );
}
