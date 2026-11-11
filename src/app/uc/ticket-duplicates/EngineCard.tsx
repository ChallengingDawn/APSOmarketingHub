"use client";

// "How it runs" of a hub engine that took over a HubSpot workflow - in the look of Duplicates & merges > Companies >
// Settings (the SwitchRow boxes), never a bare row of text buttons (SARCLA 11.11.2026, on the "Admin: Pause · Run now"
// line: "this admin settings panel, it's a joke"). Used by Contacts > Settings (By e-mail domain, Name letters),
// Companies > Settings (Country) and APSOMaps. Reads its engine's own API (GET: settings, last, workflowOn, writing,
// admin); an admin switches it (PUT {mode}) and looks again (POST {action: "run"}). Everyone sees how it stands.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, RED, type Tint } from "@/app/uc/report/ui";
import { Chip, when } from "@/app/connectors/parts";

type Mode = "off" | "shadow" | "live";
export type EngineLast = { at: string; error?: string } & Record<string, unknown>;
type EngineData = { settings: { mode: Mode; liveFrom?: string | null; by?: string; at?: string }; last: EngineLast | null; workflowOn: boolean | null; writing: boolean; admin: boolean };

const BOX = { border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%", boxSizing: "border-box" } as const;
function SwitchRow({ title, text, checked, disabled, onChange, chips }: { title: string; text: React.ReactNode; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; chips?: React.ReactNode }) {
  return (
    <Box sx={{ ...BOX, borderColor: checked ? "rgba(36,89,209,.35)" : HAIRLINE }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>{title}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          {chips}
          <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { "aria-label": title } }} />
        </Box>
      </Box>
      <Typography component="div" sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.45 }}>{text}</Typography>
    </Box>
  );
}

export function EngineCard({ api, title, tint = "blue", workflow, every, look, live, lastLine }: {
  /** The engine's API, e.g. /api/uc/company-country. */
  api: string;
  /** What the engine does, e.g. "Country". */
  title: string;
  tint?: Tint;
  /** The HubSpot workflow it replaced, as named there. */
  workflow: string;
  /** How often, e.g. "Every 15 minutes, 1,000 companies a run". */
  every: string;
  look: { title: string; on: string; off: string };
  live: { title: string; on: string; shadow: string; ask: string };
  /** The last run in a few words. */
  lastLine?: (last: EngineLast) => string;
}) {
  const [n, setN] = useState(0);
  const url = `${api}${n ? `?n=${n}` : ""}`;
  const held = useHeld<EngineData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (method: "PUT" | "POST", body: unknown, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(api, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string };
      setMsg(j.ok ? (method === "POST" ? "Looking now - the figures are new within a minute." : "Saved - the next run uses it.") : j.error ?? `HTTP ${res.status}`);
      setN((x) => x + 1);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  if (!d) {
    return (
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint={tint} title={`How it runs · ${title}`} />
        <Typography sx={{ fontSize: "0.84rem", color: r?.state === "error" ? RED : MUTED }}>{r === null ? "Reading…" : r.state === "error" ? r.error : "Not there yet - it fills in once the hub is deployed."}</Typography>
      </GlassCard>
    );
  }
  const mode = d.settings.mode;
  const wfOff = d.workflowOn === false;
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 }, borderColor: d.writing ? "rgba(196,30,58,.35)" : undefined }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint={tint} title={`How it runs · ${title}`} note={`${every}. ${d.admin ? "You switch it here." : "Admins switch it; everyone sees how it stands."}`} />
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: wfOff ? 6 : 4 }}>
          <SwitchRow title={look.title} checked={mode !== "off"} disabled={!d.admin || busy} onChange={(v) => void send("PUT", { mode: v ? "shadow" : "off" }, v ? undefined : `${look.title}: switch off?\n\nNothing is looked at until it is switched on again.`)}
            chips={mode === "off" ? <Chip tint="slate">off</Chip> : undefined} text={mode === "off" ? look.off : look.on} />
        </Grid>
        <Grid size={{ xs: 12, md: wfOff ? 6 : 4 }}>
          <SwitchRow title={live.title} checked={mode === "live"} disabled={!d.admin || busy || mode === "off"} onChange={(v) => void send("PUT", { mode: v ? "live" : "shadow" }, v ? live.ask : undefined)}
            chips={d.writing ? <Chip tint="pink">LIVE</Chip> : mode === "live" ? <Chip tint="amber">waiting</Chip> : <Chip tint="slate">shadow</Chip>}
            text={mode !== "live" ? live.shadow : d.writing ? live.on : `Chosen - it starts once the workflow is off. ${live.on}`} />
        </Grid>
        {!wfOff && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...BOX, borderColor: "rgba(196,122,0,.45)" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 800, color: INK }}>The workflow</Typography>
                {d.workflowOn === null ? <Chip tint="slate">not readable</Chip> : <Chip tint="amber">ON</Chip>}
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25, lineHeight: 1.45 }}>
                “{workflow}” still runs in HubSpot - the hub writes nothing while it does. Switch it off there: the hub then takes over, and this box goes away.
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", mt: 1.5, flexWrap: "wrap" }}>
        {d.admin && <Button variant="outlined" size="small" disabled={busy || mode === "off"} onClick={() => void send("POST", { action: "run" })} sx={{ textTransform: "none" }}>Look again now</Button>}
        {busy && <CircularProgress size={14} />}
        {d.last && (
          <Typography sx={{ fontSize: "0.78rem", color: d.last.error ? RED : FAINT }}>
            Last look {when(d.last.at)}{lastLine ? ` - ${lastLine(d.last)}` : ""}{d.last.error ? ` · ${d.last.error}` : ""}
          </Typography>
        )}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>{msg}</Typography>}
    </GlassCard>
  );
}
