"use client";

// BACK OFFICE DISTRIBUTION - the Settings tab (SARCLA 19.10.2026: "settings should be more developed"). How the hub runs
// (shadow / off), LIVE MODE per pipeline (the hub writes the owner; the HubSpot workflow's safety net takes over if it
// does not), and the hub's own rules: who counts as available, which stages count as workload, a limit per person.
// The copy of the workflows never uses these - only the hub's answer, and the hub's writes once live.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import type { HubOptions } from "@/lib/boDistribution/engine";
import { STEP, type Data } from "./shared";

const STEPS = ["27", "42", "31", "23"];
const AVAIL: { key: HubOptions["availability"]; label: string; text: string }[] = [
  { key: "chat", label: "Chat dot (as the workflows)", text: "Available = the green dot of HubSpot chat. People who never open chat look away all day." },
  { key: "ooo", label: "Out of office", text: "Available unless HubSpot says the person is out of office - the same flag the Holiday redirection uses." },
  { key: "both", label: "Both", text: "Available only with the green dot AND not out of office." },
];

export function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [hub, setHub] = useState<HubOptions>(d.settings.hub);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const call = async (key: string, method: "PUT" | "POST", body: object) => {
    setBusy(key); setMsg(null);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved." : j.error ?? `HTTP ${r.status}`);
      onChanged();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const live = async (pipe: "bo" | "gqs", on: boolean) => {
    const name = pipe === "bo" ? "Back Office" : "GQS";
    if (on && !window.confirm(`Switch the hub LIVE for ${name}?\n\nFrom the next ticket the hub writes the owner, the stage and a note. Do this only once the HubSpot workflow has its safety net (wait 3 minutes - still Backoffice Team? - the old step).`)) return;
    await call(`live-${pipe}`, "PUT", { live: { [pipe]: on } });
  };
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const stages = (pipe: "bo" | "gqs") => {
    const chosen = pipe === "bo" ? hub.boStages : hub.gqsStages;
    const wf = pipe === "bo" ? d.defaults.hub.boStages : ["2338266316", "4704538856", "2964068584", "3279663337"];
    return (
      <Box sx={{ display: "grid", gap: 0.25 }}>
        {(pipe === "bo" ? d.stages.bo : d.stages.gqs).map((st) => (
          <FormControlLabel key={st.id} sx={{ m: 0 }} disabled={!d.admin}
            control={<Checkbox size="small" checked={chosen.includes(st.id)} onChange={() => setHub((h) => pipe === "bo" ? { ...h, boStages: toggle(h.boStages, st.id) } : { ...h, gqsStages: toggle(h.gqsStages, st.id) })} />}
            label={<Typography sx={{ fontSize: "0.8rem", color: INK }}>{st.label}{wf.includes(st.id) ? <span style={{ color: MUTED }}> · the workflow counts it</span> : null}</Typography>} />
        ))}
        {pipe === "gqs" && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>The workflow also counts a stage that no longer exists and misses &quot;Waiting on APSO&quot;; the hub counts &quot;Waiting on APSO&quot; instead.</Typography>}
      </Box>
    );
  };
  const box = { border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5 };
  const save = (key: string) => (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
      <Button size="small" variant="contained" disabled={!d.admin || busy !== null} onClick={() => void call(key, "PUT", { hub })} sx={{ textTransform: "none" }}>Save</Button>
      {busy === key && <CircularProgress size={14} />}
    </Box>
  );
  return (
    <>
      {msg && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{msg}</Typography>}
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<BoltOutlinedIcon />} tint="pink" title="Live mode - the hub writes the owner" note="Per pipeline. Off = shadow: the hub only compares. Switch back off at any time - the workflow's safety net takes over" />
        <Grid container spacing={2}>
          {(["gqs", "bo"] as const).map((pipe) => (
            <Grid key={pipe} size={{ xs: 12, md: 6 }}>
              <Box sx={{ ...box, borderColor: d.settings.live[pipe] ? RED : HAIRLINE }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography sx={{ fontWeight: 800, color: INK }}>{pipe === "gqs" ? "GQS - New for Back-Office" : "Back Office - New"}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {d.settings.live[pipe] ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
                    <Switch checked={d.settings.live[pipe]} disabled={!d.admin || busy !== null} onChange={(e) => void live(pipe, e.target.checked)} />
                  </Box>
                </Box>
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>
                  {pipe === "gqs"
                    ? "Writes owner, stage “Open the GQS Task” and a note. Tickets without contact or company stay with the workflow (it copies them from the linked ticket)."
                    : "Writes owner, stage Assigned, the company link and a note - for the steps ticked below. Task Status Report merges and the sales@ split stay with the workflow."}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={box}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>Back Office steps the hub takes over</Typography>
              {STEPS.map((st) => (
                <FormControlLabel key={st} sx={{ m: 0, display: "flex" }} disabled={!d.admin}
                  control={<Checkbox size="small" checked={hub.liveSteps.includes(st)} onChange={() => setHub((h) => ({ ...h, liveSteps: toggle(h.liveSteps, st) }))} />}
                  label={<Typography sx={{ fontSize: "0.8rem" }}>{STEP[st]}</Typography>} />
              ))}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ ...box, display: "grid", gap: 1.25 }}>
              <TextField size="small" type="number" label="Writes per hour, at most" value={hub.breaker} disabled={!d.admin} onChange={(e) => setHub({ ...hub, breaker: Number(e.target.value) })}
                helperText="A runaway stop: past it the hub writes nothing and the workflow's safety net assigns. Back Office gets about 15 tickets in its busiest hour." />
              <FormControlLabel sx={{ m: 0 }} disabled={!d.admin} control={<Switch size="small" checked={hub.note} onChange={(e) => setHub({ ...hub, note: e.target.checked })} />}
                label={<Typography sx={{ fontSize: "0.8rem" }}>A note on the ticket: who, how and why (&quot;Auto-assigned by APSOhub&quot;)</Typography>} />
            </Box>
          </Grid>
        </Grid>
        {save("steps")}
      </GlassCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<PersonSearchOutlinedIcon />} tint="green" title="Who counts as available" note="For the Sales Agent, the SA Sub and the least-busy step - the hub only" />
            <Box sx={{ display: "grid", gap: 1 }}>
              {AVAIL.map((a) => (
                <Box key={a.key} component="button" type="button" disabled={!d.admin} onClick={() => setHub({ ...hub, availability: a.key })}
                  sx={{ textAlign: "left", cursor: d.admin ? "pointer" : "default", ...box, bgcolor: hub.availability === a.key ? "rgba(27,122,85,.08)" : "transparent", borderColor: hub.availability === a.key ? "#1b7a55" : HAIRLINE }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{a.label}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{a.text}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, mt: 2 }}>When nobody is available</Typography>
            <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
              {([["wait", "Wait in the queue", "Never pass a ticket to someone who is away: it stays with Backoffice Team until someone is available. (Once live, the workflow's safety net still assigns it after 3 minutes - that branch would need the same rule.)"],
                 ["leastBusy", "Least busy of everyone (as the workflow)", "The person with the fewest open tickets gets it, away or not."]] as const).map(([k, l, t]) => (
                <Box key={k} component="button" type="button" disabled={!d.admin} onClick={() => setHub({ ...hub, whenNobody: k })}
                  sx={{ textAlign: "left", cursor: d.admin ? "pointer" : "default", ...box, bgcolor: hub.whenNobody === k ? "rgba(27,122,85,.08)" : "transparent", borderColor: hub.whenNobody === k ? "#1b7a55" : HAIRLINE }}>
                  <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{l}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t}</Typography>
                </Box>
              ))}
            </Box>
            {save("avail")}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<WorkOutlineOutlinedIcon />} tint="amber" title="What counts as workload" note="The least-busy step counts a person's open tickets in these stages - the hub only" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 700, mb: 0.5 }}>Back Office</Typography>{stages("bo")}</Grid>
              <Grid size={{ xs: 12, md: 6 }}><Typography sx={{ fontSize: "0.82rem", fontWeight: 700, mb: 0.5 }}>GQS</Typography>{stages("gqs")}</Grid>
            </Grid>
            <TextField size="small" type="number" label="Open tickets per person, at most" value={hub.cap ?? ""} disabled={!d.admin} sx={{ mt: 1.5, maxWidth: 300 }}
              onChange={(e) => setHub({ ...hub, cap: e.target.value ? Number(e.target.value) : null })} helperText="Empty = no limit (the workflows have none). Past it, the least-busy step passes the person over." />
            {save("load")}
          </GlassCard>
        </Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every minute; ${d.settings.mode === "off" ? "switched off" : "compares every new ticket"}`} />
        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Choice<"off" | "shadow"> value={d.settings.mode} onChange={(m) => d.admin && void call("mode", "PUT", { mode: m })} options={[{ key: "shadow", label: "On - compare every new ticket" }, { key: "off", label: "Off" }]} />
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Replay of the last 7 days: {d.backfill ? (d.backfill.done ? `done (started ${when(d.backfill.startedAt)})` : `running - up to ${when(new Date(d.backfill.cursor).toISOString())}`) : "starts with the next run"}</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="outlined" size="small" startIcon={<ReplayOutlinedIcon />} disabled={!d.admin || busy !== null} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Look now</Button>
            <Button variant="outlined" size="small" disabled={!d.admin || busy !== null} onClick={() => void call("replay", "POST", { action: "replay" })} sx={{ textTransform: "none" }}>Replay the last 7 days</Button>
            {(busy === "run" || busy === "replay") && <CircularProgress size={14} />}
          </Box>
          {d.settings.at && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>Last change {when(d.settings.at)} by {d.settings.by}</Typography>}
        </Box>
      </GlassCard>
    </>
  );
}
