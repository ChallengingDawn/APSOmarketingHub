"use client";

// BACK OFFICE DISTRIBUTION > Availability (SARCLA 12.11.2026: "let's start with DISPLAY AVAILABITY BO", then "create
// a new tab availability to put the logic inside"). The workflow "SARCLA | DISPLAY AVAILABITY BO" wrote each Back Office
// person's HubSpot status onto every open Back Office and GQS ticket, six properties, one per person; the hub does it
// now (src/lib/boAvailability). The tab: the six as the tickets show them, since when, the last changes, and how it
// runs (AvailabilitySettings - the engine card, never a bare admin line).

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Info, when } from "@/app/connectors/parts";
import { EngineCard } from "@/app/uc/ticket-duplicates/EngineCard";
import type { Change, PersonNow, RunInfo, Settings } from "@/lib/boAvailability/engine";

const API = "/api/uc/bo-availability";
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  at: string | null; people: PersonNow[]; tickets: number | null; toWrite: number | null; changes: Change[];
};

export function AvailabilityCard() {
  const held = useHeld<Data>(API, []);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const note = "Each person's HubSpot status, written as Available or Away on every open Back Office ticket (Assigned, Waiting on Customer, Waiting Internally, Customer/Internal replied, Remind Back Office) and GQS ticket (Waiting on GQS, Waiting on APSO, Remind Back-Office) - so a ticket shows who is there.";
  if (!d) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<PeopleAltOutlinedIcon />} tint="green" title="Available or Away on the tickets" note={note} />
        <Typography sx={{ fontSize: "0.84rem", color: r?.state === "error" ? RED : MUTED }}>{r === null ? "Reading…" : r.state === "error" ? r.error : "Not there yet - it fills in once the hub is deployed."}</Typography>
      </GlassCard>
    );
  }
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PeopleAltOutlinedIcon />} tint="green" title="Available or Away on the tickets" note={note} />
      {d.settings.mode === "live" && !d.writing && (
        <Box sx={{ mb: 1.5 }}><Info><b>Waiting:</b> the HubSpot workflow “SARCLA | DISPLAY AVAILABITY BO” is {d.workflowOn ? "still switched on" : "not readable"} - it writes the tickets, the hub writes nothing while it runs.</Info></Box>
      )}
      <Grid container spacing={1.5}>
        {(d.people.length ? d.people : []).map((p) => (
          <Grid key={p.owner} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: INK }}>{p.name}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{p.status ? (p.since ? `since ${when(p.since)}` : "") : "not found among the HubSpot users"}</Typography>
              </Box>
              {p.status ? <Chip tint={p.status === "Available" ? "green" : "amber"}>{p.status}</Chip> : <Chip tint="slate">unknown</Chip>}
            </Box>
          </Grid>
        ))}
      </Grid>
      {!d.people.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Read within minutes of the deploy.</Typography>}
      <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: 1.5 }}>
        {d.tickets !== null ? `${full(d.tickets)} open tickets carry it` : ""}{d.toWrite ? ` · ${full(d.toWrite)} still to bring up to date` : d.tickets !== null ? " · all up to date" : ""}{d.at ? ` · read ${when(d.at)}` : ""}
      </Typography>
      {d.changes.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, mb: 0.5 }}>Last changes</Typography>
          <Box sx={{ display: "grid", gap: 0.25 }}>
            {d.changes.slice(0, 8).map((c) => (
              <Typography key={`${c.owner}-${c.at}`} sx={{ fontSize: "0.78rem", color: MUTED }}>{when(c.at)} · {c.name}: {c.from ?? "—"} → <b style={{ color: INK }}>{c.to}</b></Typography>
            ))}
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}

/** BACK OFFICE DISTRIBUTION > Availability: how it runs. */
export function AvailabilitySettings() {
  const n = (v: unknown) => full(Number(v ?? 0));
  return (
    <EngineCard api={API} title="Available or Away on the tickets" tint="green" workflow="SARCLA | DISPLAY AVAILABITY BO" every="Every 2 minutes, every open Back Office and GQS ticket"
      look={{ title: "Read everyone's status", on: "Each Back Office person's HubSpot status is read, and every open Back Office and GQS ticket with its six values.", off: "Off: nothing is read." }}
      live={{ title: "Live - write the tickets", on: "A ticket whose values are not today's gets them - only what changed.", shadow: "Shadow: read and counted, no ticket written.",
        ask: "Switch Available or Away LIVE?\n\nEvery 2 minutes the hub writes each Back Office person's Available / Away onto the open Back Office and GQS tickets whose values are not today's." }}
      lastLine={(l) => `${n(l.tickets)} open tickets, ${n(l.toWrite)} to bring up to date, ${n(l.written)} written`} />
  );
}
