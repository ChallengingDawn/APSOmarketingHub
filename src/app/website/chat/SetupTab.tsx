"use client";

// Chat > Setup: which orchestrator the hub reads, whether the hub holds its key, what it can reach - and, in
// words, how the chat runs today, so nobody mistakes this page for the chat itself.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SettingsEthernetOutlinedIcon from "@mui/icons-material/SettingsEthernetOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, INK, MUTED, Notice } from "@/app/uc/report/ui";
import type { Health } from "@/lib/chat/shape";
import type { OrchestratorSetting } from "@/lib/chat/orchestrator";   // a type only: nothing of the server file reaches the browser
import type { LogCopyRun } from "@/lib/chat/logCopy";                  // a type only, likewise
import { Loaded, pill, post, when } from "./shared";

type LogCopy = { last: LogCopyRun | null; held: number; heldMaxId: number };
type Setup = { setting: OrchestratorSetting; health: Health | null; keySet: boolean; isAdmin: boolean; logCopy: LogCopy | null };

const CHECKS: [keyof Health, string][] = [
  ["postgres", "Database"], ["redis", "Chat memory"], ["hubspot", "HubSpot"], ["claude", "AI model"], ["embedding", "Knowledge search"],
];

export default function SetupTab() {
  return (
    <Loaded<Setup> url="/api/website/chat?part=setup" what="the setup">
      {(s, reload) => (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard sx={{ height: "100%", display: "grid", gap: 1.25, alignContent: "start" }}>
              <CardTitle icon={<SettingsEthernetOutlinedIcon />} tint="slate" title="The orchestrator"
                note="The service on Railway that answers every chat message. The hub reads it server to server; its key never reaches a browser." />
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                <Chip tint={s.keySet ? "green" : "pink"}>{s.keySet ? "Hub key set" : "Hub key missing (CHAT_ORCHESTRATOR_KEY)"}</Chip>
                <Chip tint={s.health ? (s.health.status === "healthy" ? "green" : "amber") : "pink"}>{s.health ? s.health.status : "not answering"}</Chip>
                {CHECKS.map(([k, name]) => <Chip key={k} tint={s.health?.[k] === "ok" ? "green" : "pink"}>{name}</Chip>)}
              </Box>
              <Address s={s} reload={reload} />
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard sx={{ height: "100%", display: "grid", gap: 1, alignContent: "start" }}>
              <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="How the chat runs today" />
              <Box component="ol" sx={{ m: 0, pl: 2.5, fontSize: "0.84rem", color: INK, display: "grid", gap: 0.6, lineHeight: 1.5 }}>
                <li>The customer writes in HubSpot's chat on the shop.</li>
                <li>HubSpot's chatflow hands each message to the orchestrator; the AI's answer appears in the same chat.</li>
                <li>The ticket exists from the first message.</li>
                <li>When the AI hands over, the ticket moves to TSA or Back Office and the team answers in HubSpot's CHAT inbox.</li>
                <li>HubSpot's own survey (EN_CSAT_Live_Chat_2501) closes the chat.</li>
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                This page only reads. The old APSOAssistant dashboard stays up until this page has been watched for a while.
              </Typography>
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <LogCopyCard c={s.logCopy} isAdmin={s.isAdmin} reload={reload} />
          </Grid>
        </Grid>
      )}
    </Loaded>
  );
}

/* The chat log on AWS (SARCLA 24.10.2026: "a db on AWS ... we should not lose any data"): the orchestrator's own
   count beside the hub's, so "nothing is missing" is something the page shows, not something it claims. */
function LogCopyCard({ c, isAdmin, reload }: { c: LogCopy | null; isAdmin: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const last = c?.last ?? null;
  const n = (v: number) => v.toLocaleString("de-CH");
  const state = !c ? { tint: "pink" as const, text: "Not readable" }
    : !last ? { tint: "slate" as const, text: "First copy not run yet" }
    : !last.ok ? { tint: "pink" as const, text: "Last copy failed" }
    : last.complete ? { tint: "green" as const, text: "Complete" }
    : { tint: "amber" as const, text: `Copying - ${n(Math.max(0, last.source - last.held))} rows still to come` };
  const copy = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "log-copy" });
    setBusy(false);
    setMsg(r.ok ? null : (r.error ?? "Did not work."));
    reload();
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25, alignContent: "start" }}>
      <CardTitle icon={<StorageOutlinedIcon />} tint="green" title="The chat log on AWS"
        note="Every message's record - language, topic, hand-over, ticket and the AI's own trace, no message text - copied from the orchestrator's database on Railway into the hub's, every 5 minutes. The conversations themselves are in HubSpot." />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={state.tint}>{state.text}</Chip>
        {last && <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>last run {when(last.at)}{last.copied ? `, ${n(last.copied)} copied` : ""}</Typography>}
      </Box>
      {c && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>Held on AWS: <b>{n(c.held)}</b> rows{c.heldMaxId ? `, up to #${c.heldMaxId}` : ""}</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>Orchestrator on Railway: <b>{last?.ok ? n(last.source) : "?"}</b> rows{last?.ok && last.sourceMaxId ? `, up to #${last.sourceMaxId}` : ""}</Typography>
        </Box>
      )}
      {last && !last.ok && last.error && <Notice tone="bad">{last.error}</Notice>}
      {msg && <Notice tone="bad">{msg}</Notice>}
      {isAdmin && (
        <Box>
          <Button variant="outlined" sx={pill} disabled={busy} onClick={() => void copy()}>{busy ? "Copying…" : "Copy now"}</Button>
        </Box>
      )}
    </GlassCard>
  );
}

function Address({ s, reload }: { s: Setup; reload: () => void }) {
  const [url, setUrl] = useState(s.setting.url);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await post({ action: "orchestrator", url });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        Address: {s.setting.fromDefault ? "the Railway address (default)" : `set by ${s.setting.by ?? "?"}, ${when(s.setting.at)}`}
      </Typography>
      {s.isAdmin ? (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} slotProps={{ htmlInput: { "aria-label": "Orchestrator address" } }} />
          <Button variant="outlined" sx={pill} disabled={busy || url.trim() === s.setting.url} onClick={() => void save()}>Save</Button>
        </Box>
      ) : <Typography sx={{ fontSize: "0.84rem", color: INK }}>{s.setting.url}</Typography>}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: "#1b7a55" }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </Box>
  );
}
