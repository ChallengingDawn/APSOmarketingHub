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
import { type Data } from "./shared";

const AVAIL: { key: HubOptions["availability"]; label: string; text: string }[] = [
  { key: "chat", label: "Chat dot", text: "Available = the green dot of HubSpot chat. People who never open chat look away all day." },
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
  const live = async (pipe: "bo" | "gqs" | "strays", on: boolean) => {
    const name = pipe === "bo" ? "Back Office" : "GQS";
    const ask = pipe === "strays"
      ? `Give the tickets waiting for an owner one?\n\nEvery 5 minutes the hub writes the owner (only the owner, and a note) on open Back Office and GQS tickets with no owner, Backoffice Team or an owner who has left - at most 10 a look, within the writes-per-hour limit. ${d.strays ? `Right now: ${d.strays.total}.` : ""}`
      : `Switch the hub LIVE for ${name}?\n\nFrom the next ticket the hub writes the owner, the stage and a note. Its HubSpot workflow is already off, so nothing else is assigning these tickets.`;
    if (on && !window.confirm(ask)) return;
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
            label={<Typography sx={{ fontSize: "0.8rem", color: INK }}>{st.label}{wf.includes(st.id) ? <span style={{ color: MUTED }}> · counted before the hand-over too</span> : null}</Typography>} />
        ))}
        {pipe === "gqs" && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>The old routing counted a stage that no longer exists and missed &quot;Waiting on APSO&quot;; the hub counts &quot;Waiting on APSO&quot; instead.</Typography>}
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
        <CardTitle icon={<BoltOutlinedIcon />} tint="pink" title="Live mode - the hub writes the owner" note="Per pipeline. Off means nobody hands these tickets out - switch the pipeline's HubSpot workflow back on first" />
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
                {(() => {
                  // the HubSpot workflow this switch replaces - while it is on, the hub writes nothing (engine WORKFLOWS)
                  const wf = d.workflows?.[pipe];
                  const name = pipe === "gqs" ? "SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION" : "SARCLA | BACK OFFICE MAIN ROUTING";
                  return (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                      <Chip tint={wf === false ? "green" : wf === true ? "amber" : "slate"}>{wf === false ? "HubSpot workflow OFF" : wf === true ? "HubSpot workflow ON" : "workflow not read"}</Chip>
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
                        {wf === true
                          ? d.settings.live[pipe] ? `“${name}” still assigns, so the hub writes nothing yet - switch it off in HubSpot to hand over.` : `“${name}” assigns these tickets.`
                          : wf === false ? (d.settings.live[pipe] ? `“${name}” is off - the hub assigns.` : `“${name}” is off and the hub is not live: nobody assigns these tickets!`) : ""}
                      </Typography>
                    </Box>
                  );
                })()}
                <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>
                  {pipe === "gqs"
                    ? "Writes owner, stage “Open the GQS Task”, the GQS status and a note; a task without contact or company first gets them from its linked ticket. The old workflow's own code step was replaced by a 2-minute delay when GQS was handed over (its status and \u201cNEW GQS TASK\u201d notification stay)."
                    : "Writes everything the routing wrote: category, sub-categories, order number, priority, dispatch, the stage moves (Microsoft quarantine, chat parking, CAD, Anyseals) and the owner - with the Task Status Report merge into its GQS task, the sales@ split to ESO and the Anyseals stock file. A ticket a person already owns keeps its owner."}
                </Typography>
              </Box>
            </Grid>
          ))}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ ...box, borderColor: d.settings.live.strays ? RED : HAIRLINE }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontWeight: 800, color: INK }}>Waiting for an owner - Back Office and GQS{d.strays ? ` (${d.strays.total} now)` : ""}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {d.settings.live.strays ? <Chip tint="pink">LIVE</Chip> : <Chip tint="slate">shadow</Chip>}
                  <Switch checked={!!d.settings.live.strays} disabled={!d.admin || busy !== null} onChange={(e) => void live("strays", e.target.checked)} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>
                Open tickets with no owner, only Backoffice Team or an owner who has left, 15 minutes in their stage: the owner (never the stage) goes to the person
                who had it when on the lists and available, else the distribution&apos;s pick; nobody available = it waits. (ESO / TSA: the Wrong owners page.) Independent of the two switches above. The Overview lists them.
              </Typography>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={box}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>Both pipelines were handed over on 19.10.2026</Typography>
              <Typography component="ol" sx={{ fontSize: "0.8rem", color: INK, m: 0, pl: 2.25, display: "grid", gap: 0.4 }}>
                <li>Back Office and GQS are handed out from here. Their HubSpot workflows are switched off.</li>
                <li>The way back, if ever needed: switch the pipeline&apos;s workflow on again in HubSpot. The hub stops writing that pipeline at once, by itself, with no deploy - it checks before every write.</li>
                <li>Switching a pipeline off here WITHOUT switching its workflow back on leaves nobody handing those tickets out. They sit on Backoffice Team until a person picks them up.</li>
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ ...box, display: "grid", gap: 1.25 }}>
              <TextField size="small" type="number" label="Writes per hour, at most" value={hub.breaker} disabled={!d.admin} onChange={(e) => setHub({ ...hub, breaker: Number(e.target.value) })}
                helperText="A runaway stop: past it the hub writes nothing and the tickets wait on Backoffice Team until a person takes them. Back Office gets about 15 tickets in its busiest hour." />
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
              {([["wait", "Wait in the queue", "Never pass a ticket to someone who is away: it stays with Backoffice Team until someone is available, and a person has to notice it."],
                 ["leastBusy", "Least busy of everyone", "The person with the fewest open tickets gets it, away or not. This is what the old routing did."]] as const).map(([k, l, t]) => (
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
              onChange={(e) => setHub({ ...hub, cap: e.target.value ? Number(e.target.value) : null })} helperText="Empty = no limit, which is what the old routing had. Past it, the least-busy rule passes the person over." />
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
