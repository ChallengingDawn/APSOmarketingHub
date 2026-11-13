"use client";

// BACK OFFICE DISTRIBUTION > Availability > Absences (SARCLA 13.11.2026: "allow also to see the absences and to record
// absences for colleagues"). Each Back Office person (and the six of Available or Away) with their absences, now and
// coming, read from their HubSpot out-of-office hours; an absence added or taken away here is written there, where
// HubSpot, the holiday redirection and the Back Office distribution read it. Reads /api/uc/bo-availability/absences.
// A click shows its result at once (the API answers with the person's absences as they are now).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";
import type { AbsencePerson, LogRow } from "@/lib/holiday/absenceEdit";
import type { AbsenceWindow } from "@/lib/holiday/absenceRules";

const API = "/api/uc/bo-availability/absences";
type Data = { people: AbsencePerson[]; log: LogRow[]; canEdit: boolean };

const dm = (day: string) => { const [y, m, d] = day.split("-"); return `${d}.${m}.${y}`; };
const span = (w: { from: string; to: string }) => (w.from === w.to ? dm(w.from) : `${dm(w.from)} – ${dm(w.to)}`);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });

async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: { ownerId: string; windows: AbsenceWindow[] } }> {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string; data?: { ownerId: string; windows: AbsenceWindow[] } };
}

/** One person: away now or in, their coming absences, and (for those who may) add / take away. */
function PersonRow({ p, windows, canEdit, onWindows }: { p: AbsencePerson; windows: AbsenceWindow[]; canEdit: boolean; onWindows: (w: AbsenceWindow[]) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const now = Date.now();
  const holding = windows.find((w) => w.start <= now && now <= w.end);
  const act = async (what: string, body: unknown) => {
    setBusy(what); setErr(null);
    try {
      const j = await post(body);
      if (j.ok && j.data) { onWindows(j.data.windows); if (what === "add") { setOpen(false); setTitle(""); } }
      else setErr(j.error ?? "Not saved");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 1.25, display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px 1fr auto" }, gap: 1.25, alignItems: "start" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
        <Box sx={{ mt: 0.25 }}>
          {holding ? <Chip tint="amber">away until {dm(holding.to)}</Chip> : p.away ? <Chip tint="amber">out of office</Chip> : <Chip tint="green">in</Chip>}
        </Box>
        {!p.userObjectId && <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 0.25 }}>no HubSpot user record</Typography>}
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
        {windows.length ? windows.map((w) => (
          <Box key={w.id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, border: `1px solid ${HAIRLINE}`, borderRadius: "10px", pl: 1, pr: canEdit ? 0.25 : 1, py: 0.25, bgcolor: w === holding ? "rgba(196,122,0,.08)" : "rgba(255,255,255,.7)" }}>
            <Typography component="span" sx={{ fontSize: "0.8rem", color: INK, fontWeight: 600 }}>{span(w)}</Typography>
            {w.title && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {w.title}</Typography>}
            {canEdit && (
              <Tooltip title="Take this absence away">
                <span>
                  <IconButton size="small" disabled={!!busy} aria-label={`Take away the absence ${span(w)} of ${p.name}`}
                    onClick={() => { if (window.confirm(`Take away ${p.name}'s absence ${span(w)}${w.title ? ` (${w.title})` : ""}?\n\nIt is taken out of their HubSpot out-of-office.`)) void act(`rm-${w.id}`, { action: "remove", ownerId: p.ownerId, id: w.id }); }}>
                    {busy === `rm-${w.id}` ? <CircularProgress size={12} /> : <CloseIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>No absence coming</Typography>}
        {open && (
          <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void act("add", { action: "add", ownerId: p.ownerId, from, to, title }); }}
            sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", width: "100%", mt: 0.5 }}>
            <TextField size="small" type="date" label="First day" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
            <TextField size="small" type="date" label="Last day" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
            <TextField size="small" label="What (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vacation, sick, training…" sx={{ width: 220 }} />
            <Button type="submit" size="small" variant="contained" disableElevation disabled={!!busy || !from || !to} sx={{ textTransform: "none" }}>
              {busy === "add" ? <CircularProgress size={14} color="inherit" /> : "Save"}
            </Button>
            <Button size="small" variant="text" onClick={() => { setOpen(false); setErr(null); }} sx={{ textTransform: "none" }}>Cancel</Button>
          </Box>
        )}
        {err && <Typography sx={{ fontSize: "0.76rem", color: RED, width: "100%" }}>{err}</Typography>}
      </Box>
      {canEdit && p.userObjectId && !open && (
        <Button size="small" variant="outlined" onClick={() => setOpen(true)} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Add absence</Button>
      )}
    </Box>
  );
}

export function AbsencesCard() {
  const held = useHeld<Data>(API, []);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [mine, setMine] = useState<Record<string, AbsenceWindow[]>>({});
  const note = "Each person's absences as HubSpot keeps them (their out-of-office) - the holiday redirection and the Back Office distribution read the same. An absence added here is written there, with who entered it.";
  if (!d) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<EventBusyOutlinedIcon />} tint="amber" title="Absences" note={note} />
        <Typography sx={{ fontSize: "0.84rem", color: r?.state === "error" ? RED : MUTED }}>{r === null ? "Reading the absences…" : r.state === "error" ? r.error : "Not there yet - it fills in once the hub is deployed."}</Typography>
      </GlassCard>
    );
  }
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<EventBusyOutlinedIcon />} tint="amber" title="Absences" note={note} />
      {!d.canEdit && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mb: 1 }}>Recording an absence needs write access to UC's.</Typography>}
      <Box>
        {d.people.map((p) => (
          <PersonRow key={p.ownerId} p={p} windows={mine[p.ownerId] ?? p.windows} canEdit={d.canEdit} onWindows={(w) => setMine((s) => ({ ...s, [p.ownerId]: w }))} />
        ))}
      </Box>
      {!d.people.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nobody of the Back Office found in HubSpot.</Typography>}
      {d.log.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, mb: 0.5 }}>Entered here</Typography>
          <Box sx={{ display: "grid", gap: 0.25 }}>
            {d.log.slice(0, 8).map((l) => (
              <Typography key={`${l.at}-${l.ownerId}`} sx={{ fontSize: "0.78rem", color: MUTED }}>{when(l.at)} · {l.by} {l.action === "add" ? "added" : "took away"} {l.name}: {span(l)}{l.title ? ` · ${l.title}` : ""}</Typography>
            ))}
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}
