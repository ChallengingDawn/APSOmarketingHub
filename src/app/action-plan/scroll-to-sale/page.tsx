"use client";
// FROM SCROLL TO SALE, BESIDE THE ACTION PLAN (SARCLA 02.11.2026: "the idea of the new Scroll to Sale is to keep it on the
// action plan but to see 1-1 the pipeline, filtered per owner and so forth"): HubSpot's pipeline as a board - a column per
// stage in the pipeline's order, a card per ticket - each card saying where the ticket sits in the plan, or that it is
// not in it. The tickets not in the plan get a proposal - the ticket's own plan property, else the AI's pick among the
// Digital Growth actions and their categories - ticked and applied here ("proposal first, I tick"); placed, a ticket and
// its sub-action or action are kept in step. Admins only, as the plan (../layout.tsx). Rules: scrollToSaleBoard.ts.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RefreshIcon from "@mui/icons-material/Refresh";

import { HomeBar } from "@/app/HomeBar";
import { FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { Board, BoardTicket, Proposal, Target } from "@/lib/reporting/scrollToSaleBoard";
import { PRIORITY_COLOR, dmy, send, stageColor } from "../planUi";

type Pick = Proposal & { on: boolean };
const AMBER = { fg: "#a15c07", bg: "#fff3dc" };
const chip = (on: boolean, fg: string = TINT.blue.fg, bg: string = TINT.blue.bg) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.8rem",
  fontWeight: on ? 800 : 600, px: 1.1, py: 0.45, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const, display: "inline-flex", alignItems: "center", gap: 0.6,
});

/** A small ring: the part of a person's tickets that is open. */
function Ring({ part, of: total, color }: { part: number; of: number; color: string }) {
  const r = 7, c = 2 * Math.PI * r, f = total ? part / total : 0;
  return (
    <Box component="svg" viewBox="0 0 18 18" sx={{ width: 16, height: 16, flexShrink: 0 }} aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="#e6eaf1" strokeWidth="3" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 9 9)" />
    </Box>
  );
}

function Card({ t }: { t: BoardTicket }) {
  const prio = PRIORITY_COLOR[t.priority];
  const href = t.place ? (t.place.kind === "sub" ? `/action-plan?sub=${t.place.taskId}` : `/action-plan?item=${t.place.itemId}`) : null;
  return (
    <Box sx={{ display: "grid", gap: 0.6, p: 1.1, borderRadius: "6px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${t.place ? GREEN : AMBER.fg}`, minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start", minWidth: 0 }}>
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.84rem", fontWeight: 650, color: INK, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
          {t.subject || `Ticket ${t.id}`}
        </Typography>
        <IconButton size="small" component="a" href={t.url} target="_blank" rel="noreferrer" aria-label="Open in HubSpot" sx={{ mt: -0.5, mr: -0.5 }}><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton>
      </Box>
      <Typography noWrap title={[t.ownerName, t.roadmapId, t.golive ? `go-live ${dmy(t.golive)}` : ""].filter(Boolean).join(" · ")} sx={{ fontSize: "0.74rem", color: FAINT, minWidth: 0 }}>
        {[t.ownerName || "Nobody", t.roadmapId, t.golive ? `go-live ${dmy(t.golive)}` : ""].filter(Boolean).join(" · ")}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", minWidth: 0 }}>
        {prio && <Box sx={{ flexShrink: 0, px: 0.6, borderRadius: "3px", fontSize: "0.64rem", fontWeight: 800, lineHeight: "16px", bgcolor: prio.bg, color: prio.fg }}>{t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}</Box>}
        {t.place && href ? (
          <Typography component={Link} href={href} noWrap title={t.place.kind === "sub" ? `Sub-action of “${t.place.action}”` : "An action of the plan"}
            sx={{ minWidth: 0, fontSize: "0.74rem", fontWeight: 700, color: GREEN, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {t.place.kind === "sub" ? `Sub-action · ${t.place.action}` : `Action · ${t.place.title}`}
          </Typography>
        ) : (
          <Box sx={{ px: 0.6, borderRadius: "3px", fontSize: "0.66rem", fontWeight: 800, lineHeight: "17px", bgcolor: AMBER.bg, color: AMBER.fg }}>Not in the plan</Box>
        )}
      </Box>
    </Box>
  );
}

/** A place in the picker, under its heading. */
type PlaceOption = { value: string; label: string; detail: string; group: string };
const LEAVE_OUT: PlaceOption = { value: "none", label: "Leave it out of the plan", detail: "", group: "Or" };
const findPlace = createFilterOptions<PlaceOption>({ stringify: (o) => `${o.label} ${o.detail}` });

/**
 * A ticket's places, the likeliest first (SARCLA 03.11.2026: "learn how I organised and ease the way I pick"): the ones
 * learned from where the team put similar tickets, then the actions holding the most tickets, the other Digital Growth
 * actions, a new action in a category - all read from the plan and the board as they are now.
 */
function placesFor(p: Pick, targets: { actions: Target[]; categories: Target[] }): PlaceOption[] {
  const find = (as: "sub" | "action", id: number) => (as === "sub" ? targets.actions : targets.categories).find((x) => x.id === id);
  const label = (as: "sub" | "action", t: Target) => (as === "sub" ? `Sub-action of “${t.title}”` : `New action in “${t.title}”`);
  const held = (t: Target, what: string) => [t.path, t.tickets ? `${t.tickets} ${what}${t.tickets === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  const out: PlaceOption[] = [];
  for (const s of p.suggest ?? []) {
    const t = find(s.as, s.target);
    if (t) out.push({ value: `${s.as}:${t.id}`, label: label(s.as, t), detail: s.why, group: "Like the tickets you placed" });
  }
  const byUse = (a: Target, b: Target) => b.tickets - a.tickets || a.title.localeCompare(b.title);
  for (const a of targets.actions.filter((x) => x.tickets).sort(byUse)) out.push({ value: `sub:${a.id}`, label: label("sub", a), detail: held(a, "ticket"), group: "Where your tickets are" });
  for (const a of targets.actions.filter((x) => !x.tickets)) out.push({ value: `sub:${a.id}`, label: label("sub", a), detail: held(a, "ticket"), group: "Other Digital Growth actions" });
  for (const c of [...targets.categories].sort(byUse)) out.push({ value: `action:${c.id}`, label: label("action", c), detail: held(c, "action made from a ticket"), group: "A new action in a category" });
  out.push(LEAVE_OUT);
  return out;
}

/** The proposals for the tickets not in the plan, to tick and apply. */
function Placing({ tickets, onDone, onClose }: { tickets: BoardTicket[]; onDone: (said: string) => void; onClose: () => void }) {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [targets, setTargets] = useState<{ actions: Target[]; categories: Target[] }>({ actions: [], categories: [] });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  useEffect(() => {
    void (async () => {
      try {
        const j = await send("/api/action-plan/s2s", "POST", { action: "propose", ids: tickets.map((t) => t.id) });
        setTargets(j.targets as typeof targets);
        setPicks((j.proposals as Proposal[]).map((p) => ({ ...p, on: p.as !== "none" })));
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ticked = (picks ?? []).filter((p) => p.on && p.as !== "none" && p.target != null);
  const apply = async () => {
    setBusy(true); setErr(null);
    try {
      const j = await send("/api/action-plan/s2s", "POST", { action: "place", picks: ticked.map((p) => ({ ticketId: p.ticketId, as: p.as, target: p.target })) });
      onDone(`${j.placed} ticket${j.placed === 1 ? "" : "s"} placed in the plan${Number(j.skipped) ? ` · ${j.skipped} passed over (placed meanwhile)` : ""}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const value = (p: Pick) => (p.as === "none" || p.target == null ? "none" : `${p.as}:${p.target}`);
  const set = (id: string, v: string) => setPicks((ps) => ps!.map((p) => {
    if (p.ticketId !== id) return p;
    if (v === "none") return { ...p, as: "none", target: null, on: false };
    const [as, target] = v.split(":");
    return { ...p, as: as as "sub" | "action", target: Number(target), on: true, by: "none", why: "Changed here." };
  }));
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <AutoAwesomeIcon sx={{ fontSize: 20, color: "#6b46c1" }} />
        <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 750, color: INK }}>Where the {tickets.length} ticket{tickets.length === 1 ? "" : "s"} not in the plan would go</Typography>
        {picks && <Button size="small" onClick={() => setPicks((ps) => ps!.map((p) => ({ ...p, on: p.as !== "none" })))} sx={{ textTransform: "none", fontWeight: 650 }}>Tick all proposed</Button>}
        {picks && <Button size="small" onClick={() => setPicks((ps) => ps!.map((p) => ({ ...p, on: false })))} sx={{ textTransform: "none", fontWeight: 650 }}>Untick all</Button>}
        <Button size="small" onClick={onClose} sx={{ textTransform: "none", fontWeight: 650, color: MUTED }}>Close</Button>
      </Box>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
        Each ticket goes where its own plan property in HubSpot says, else where the AI reads it fits - shown where you placed the others - else beside the tickets most like it. The picker shows those places first, then the actions holding the most tickets; type to find any other. Change any place, untick what should stay out. Nothing is placed until you apply; placed, the ticket and its sub-action or action are kept in step.
      </Typography>
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      {!picks && !err && <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={18} /><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Reading the tickets and the plan - the AI takes a little while for many…</Typography></Box>}
      {picks && (
        <Box sx={{ display: "grid", gap: 0.5, maxHeight: "60vh", overflowY: "auto", pr: 0.5 }}>
          {picks.map((p) => {
            const t = byId.get(p.ticketId);
            if (!t) return null;
            return (
              <Box key={p.ticketId} sx={{ display: "grid", gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1.1fr) minmax(0, 1fr)" }, gap: 1, alignItems: "center", p: 0.75, borderRadius: "6px", bgcolor: p.on ? "#fff" : "transparent", border: `1px solid ${p.on ? HAIRLINE : "transparent"}` }}>
                <Checkbox size="small" checked={p.on} disabled={p.as === "none"} onChange={(e) => setPicks((ps) => ps!.map((x) => (x.ticketId === p.ticketId ? { ...x, on: e.target.checked } : x)))} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap title={t.subject} sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK }}>{t.subject || `Ticket ${t.id}`}</Typography>
                  <Typography noWrap title={p.why} sx={{ fontSize: "0.74rem", color: FAINT }}>{[t.open ? "open" : "closed", t.ownerName, p.why].filter(Boolean).join(" · ")}{p.by === "hubspot" ? " (HubSpot)" : p.by === "ai" ? " (AI)" : p.by === "learned" ? " (learned)" : ""}</Typography>
                </Box>
                {(() => {
                  const opts = placesFor(p, targets);
                  const v = value(p);
                  return (
                    <Autocomplete size="small" disableClearable autoHighlight options={opts} groupBy={(o) => o.group} getOptionLabel={(o) => o.label}
                      value={opts.find((o) => o.value === v) ?? LEAVE_OUT} isOptionEqualToValue={(a, b) => a.value === b.value && a.group === b.group}
                      filterOptions={findPlace} onChange={(_, o) => set(p.ticketId, o.value)}
                      renderOption={({ key, ...rest }, o) => (
                        <Box component="li" key={`${String(key)}|${o.group}`} {...rest} sx={{ display: "grid !important", gap: 0.1, py: "5px !important" }}>
                          <Typography sx={{ fontSize: "0.84rem", color: o.value === "none" ? FAINT : INK, lineHeight: 1.35 }}>{o.label}</Typography>
                          {o.detail && <Typography sx={{ fontSize: "0.72rem", color: FAINT, lineHeight: 1.3 }}>{o.detail}</Typography>}
                        </Box>
                      )}
                      renderInput={(params) => <TextField {...params} placeholder="Type to find an action or a category" />}
                      sx={{ gridColumn: { xs: "2", md: "auto" }, minWidth: 0, "& .MuiInputBase-root": { fontSize: "0.82rem", bgcolor: "#fff" } }} />
                  );
                })()}
              </Box>
            );
          })}
        </Box>
      )}
      {picks && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <Typography sx={{ flex: 1, fontSize: "0.82rem", color: FAINT }}>{ticked.length} ticked · {picks.filter((p) => p.as === "none").length} with no place proposed</Typography>
          <Button variant="contained" disableElevation disabled={busy || !ticked.length} onClick={() => void apply()} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
            {busy ? "Placing…" : `Place the ${ticked.length} ticked`}
          </Button>
        </Box>
      )}
    </GlassCard>
  );
}

export default function ScrollToSalePage() {
  const [data, setData] = useState<Board | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [loose, setLoose] = useState(false);
  const [q, setQ] = useState("");
  const [placing, setPlacing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const load = useCallback(async (fresh = false) => {
    try {
      const r = await fetch(`/api/action-plan/s2s${fresh ? "?fresh=1" : ""}`);
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `the hub answered ${r.status}`);
      setData(j as Board); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const all = data?.tickets ?? [];
  const people = useMemo(() => {
    const m = new Map<string, { name: string; n: number; open: number }>();
    for (const t of all) {
      const k = t.owner || "none";
      const x = m.get(k) ?? { name: t.ownerName || "Nobody", n: 0, open: 0 };
      x.n++; if (t.open) x.open++;
      m.set(k, x);
    }
    return [...m.entries()].map(([id, x]) => ({ id, ...x })).sort((a, b) => b.n - a.n);
  }, [all]);
  const shown = all.filter((t) => (state === "all" || t.open === (state === "open")) && (!loose || !t.place)
    && (!owners.length || owners.includes(t.owner || "none")) && (!q.trim() || `${t.subject} ${t.roadmapId}`.toLowerCase().includes(q.trim().toLowerCase())));
  const notIn = all.filter((t) => !t.place);
  const stages = (data?.stages ?? []).filter((s) => state === "all" || s.open === (state === "open"));
  const tile = (label: string, n: number, on: boolean, click: () => void, color = INK) => (
    <Box component="button" type="button" onClick={click} aria-pressed={on}
      sx={{ all: "unset", cursor: "pointer", display: "grid", gap: 0.25, px: 1.75, py: 1.25, borderRadius: "10px", bgcolor: on ? TINT.blue.bg : "#fff", border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, minWidth: 110 }}>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{n}</Typography>
      <Typography sx={{ fontSize: "0.78rem", fontWeight: 650, color: MUTED }}>{label}</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2 }}>
      <HomeBar on="From Scroll to Sale" plan />

      <GlassCard sx={{ display: "grid", gap: 1.75 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: FAINT }}>From Scroll to Sale</Typography>
            <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.35rem", md: "1.55rem" }, fontWeight: 650, letterSpacing: "-0.02em", color: INK, mt: 0.5, textWrap: "balance" }}>
              The pipeline ticket by ticket - and where each sits in the action plan
            </Typography>
          </Box>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load(true)} sx={{ textTransform: "none", fontWeight: 650 }}>Read HubSpot again</Button>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {tile("Tickets", all.length, state === "all" && !loose, () => { setState("all"); setLoose(false); })}
          {tile("Open", all.filter((t) => t.open).length, state === "open" && !loose, () => { setState("open"); setLoose(false); })}
          {tile("Closed", all.filter((t) => !t.open).length, state === "closed" && !loose, () => { setState("closed"); setLoose(false); })}
          {tile("In the plan", all.filter((t) => t.place).length, false, () => { setLoose(false); }, GREEN)}
          {tile("Not in the plan", notIn.length, loose, () => { setLoose(true); setState("all"); }, AMBER.fg)}
          <Box sx={{ flex: 1 }} />
          {notIn.length > 0 && (
            <Button variant="contained" disableElevation startIcon={<AutoAwesomeIcon />} onClick={() => setPlacing(true)} disabled={placing}
              sx={{ alignSelf: "center", textTransform: "none", fontWeight: 700, borderRadius: "8px", bgcolor: "#6b46c1", "&:hover": { bgcolor: "#5a3ab0" } }}>
              Place the {notIn.length} not in the plan
            </Button>
          )}
        </Box>
        {said && <Typography sx={{ fontSize: "0.86rem", color: GREEN, fontWeight: 650 }}>{said}</Typography>}
        {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>HubSpot could not be read: {err}</Typography>}
      </GlassCard>

      {placing && data && (
        <Placing tickets={notIn} onClose={() => setPlacing(false)} onDone={(s) => { setPlacing(false); setSaid(s); void load(true); }} />
      )}

      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <TextField size="small" placeholder="Search the tickets - name or roadmap ID" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 300, "& .MuiInputBase-root": { bgcolor: "#fff", fontSize: "0.86rem" } }} />
        {(["open", "closed", "all"] as const).map((s) => <Box key={s} component="button" type="button" aria-pressed={state === s} onClick={() => setState(s)} sx={chip(state === s)}>{s === "open" ? "Open" : s === "closed" ? "Closed" : "All"}</Box>)}
        <Box component="button" type="button" aria-pressed={loose} onClick={() => setLoose((v) => !v)} sx={chip(loose, AMBER.fg, AMBER.bg)}>Not in the plan</Box>
        <Box sx={{ width: 8 }} />
        {people.map((p) => {
          const on = owners.includes(p.id);
          return (
            <Box key={p.id} component="button" type="button" aria-pressed={on} title={`${p.open} open of ${p.n}`} onClick={() => setOwners((o) => (on ? o.filter((x) => x !== p.id) : [...o, p.id]))} sx={chip(on)}>
              <Ring part={p.open} of={p.n} color={on ? TINT.blue.fg : MUTED} />{p.name} · {p.n}
            </Box>
          );
        })}
        {(owners.length > 0 || loose || q) && <Button size="small" onClick={() => { setOwners([]); setLoose(false); setQ(""); }} sx={{ textTransform: "none", fontWeight: 650 }}>Clear</Button>}
      </Box>

      {!data && !err && <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: 2 }}><CircularProgress size={18} /><Typography sx={{ color: MUTED, fontSize: "0.9rem" }}>Reading the pipeline…</Typography></Box>}
      {data && (
        // a column per stage in the pipeline's order; wide, it scrolls sideways
        <Box sx={{ overflowX: "auto", pb: 1 }}>
          <Box sx={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(250px, 1fr)", gap: 1.25, alignItems: "start", minWidth: "fit-content" }}>
            {stages.map((s) => {
              const col = shown.filter((t) => t.stage === s.id);
              const c = stageColor(s.id);
              return (
                <Box key={s.id} sx={{ display: "grid", gap: 0.75, p: 1, borderRadius: "10px", bgcolor: "rgba(21,34,58,.035)", borderTop: `3px solid ${c.bar}`, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, px: 0.25 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 800, color: INK }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: FAINT }}>{col.length}</Typography>
                  </Box>
                  {col.map((t) => <Card key={t.id} t={t} />)}
                  {!col.length && <Typography sx={{ fontSize: "0.78rem", color: FAINT, px: 0.25, py: 1 }}>None</Typography>}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
