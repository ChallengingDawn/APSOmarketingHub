"use client";

// Chat > Setup: which orchestrator the hub reads, whether the hub holds its key, what it can reach - and, in
// words, how the chat runs - and the switch that decides who sees the chat window on the shop (off / acc / live).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SettingsEthernetOutlinedIcon from "@mui/icons-material/SettingsEthernetOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, INK, MUTED, Notice, type Tint } from "@/app/uc/report/ui";
import type { Health } from "@/lib/chat/shape";
import type { OrchestratorSetting } from "@/lib/chat/orchestrator";   // a type only: nothing of the server file reaches the browser
import { Loaded, pill, post, when } from "./shared";
import type { WebMode, WebModeState } from "@/lib/chat/webmode";   // types only

type Setup = { setting: OrchestratorSetting; health: Health | null; keySet: boolean; isAdmin: boolean };

const CHECKS: [keyof Health, string][] = [
  ["postgres", "Database"], ["redis", "Chat memory"], ["hubspot", "HubSpot"], ["claude", "AI model"], ["embedding", "Knowledge search"],
];

/* ── the chat on the shop: who sees it (webmode.ts) ─────────────────────────── */
// SARCLA 27.10.2026: "when the logic is working we put it live" - the switch is his, here; live asks once more.
type WebModeData = WebModeState & { isAdmin: boolean };
const MODES: { id: WebMode; label: string; note: string; tint: Tint }[] = [
  { id: "off", label: "Off", note: "Nobody sees the chat window.", tint: "slate" },
  { id: "acc", label: "Acceptance only", note: "Every visitor of acc.apsoparts.com - www.apsoparts.com sees nothing.", tint: "amber" },
  { id: "preview", label: "Preview", note: "Only a browser that opened the shop once with ?apsochat=preview.", tint: "blue" },
  { id: "live", label: "Live", note: "Every visitor of www.apsoparts.com.", tint: "green" },
];
function ShopSwitch() {
  return (
    <Loaded<WebModeData> url="/api/website/chat?part=web-mode" what="who sees the chat">
      {(d, reload) => <SwitchCard d={d} reload={reload} />}
    </Loaded>
  );
}
function SwitchCard({ d, reload }: { d: WebModeData; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<WebMode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cur = MODES.find((m) => m.id === d.mode) ?? null;
  const go = async (mode: WebMode) => {
    setBusy(true); setErr(null);
    const r = await post({ action: "web-mode-save", mode });
    setBusy(false); setAsk(null);
    if (!r.ok) setErr(r.error ?? "Not switched."); else reload();
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<StorefrontOutlinedIcon />} tint="green" title="The chat on the shop"
        note={cur ? `${cur.label}: ${cur.note}` : "The gateway did not say which mode it is in."} />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <Button key={m.id} size="small" variant={m.id === d.mode ? "contained" : "outlined"} disabled={!d.isAdmin || busy || m.id === d.mode}
            onClick={() => (m.id === "live" ? setAsk("live") : go(m.id))} sx={{ textTransform: "none", borderRadius: "9px" }}>
            {m.label}
          </Button>
        ))}
      </Box>
      {ask === "live" && (
        <Notice tone="warn">
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography sx={{ fontSize: "0.84rem", color: INK }}>Put the chat live for every visitor of www.apsoparts.com? HubSpot&apos;s own chat on www should be off.</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="contained" disabled={busy} onClick={() => go("live")} sx={{ textTransform: "none" }}>Yes, put it live</Button>
              <Button size="small" variant="text" disabled={busy} onClick={() => setAsk(null)} sx={{ textTransform: "none" }}>Cancel</Button>
            </Box>
          </Box>
        </Notice>
      )}
      {err && <Notice tone="bad">{err}</Notice>}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {d.turns !== null && <Chip tint="slate">{`${d.turns} messages since the gateway started`}</Chip>}
        {d.escalated !== null && <Chip tint="slate">{`${d.escalated} hand-overs`}</Chip>}
        {!!d.failed && <Chip tint="pink">{`${d.failed} failed`}</Chip>}
        {d.changed && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{`Switched to ${MODES.find((m) => m.id === d.changed!.mode)?.label ?? d.changed.mode} by ${d.changed.by}, ${when(d.changed.at)}`}</Typography>}
        {!d.isAdmin && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Only admins switch it.</Typography>}
      </Box>
    </GlassCard>
  );
}

export default function SetupTab() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
    <ShopSwitch />
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
              <CardTitle icon={<AccountTreeOutlinedIcon />} tint="purple" title="How the chat runs" />
              <Box component="ol" sx={{ m: 0, pl: 2.5, fontSize: "0.84rem", color: INK, display: "grid", gap: 0.6, lineHeight: 1.5 }}>
                <li>The customer writes in our chat window on the shop; every message is also in HubSpot&apos;s Help Desk, with its ticket.</li>
                <li>The orchestrator&apos;s AI answers. Order details only after the customer number matches the order.</li>
                <li>A person is needed: a sales topic goes to a TSA member who is available (else the TSA Team, &quot;we come back to you&quot;); any other topic to the Back Office - CHAT/C2S Issue, &quot;a colleague calls you within the hour&quot;, after the phone number is asked or confirmed.</li>
                <li>The customer is done (thanks, &quot;no&quot; to &quot;anything else?&quot;) or the team closes the chat: the window asks for its rating (the twin survey, Satisfaction tab).</li>
              </Box>
            </GlassCard>
          </Grid>
        </Grid>
      )}
    </Loaded>
    </Box>
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
