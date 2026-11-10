"use client";

// A customer's page views as the shop recorded them - the pointer, the scroll, the clicks - found by its contacts'
// HubSpot visitor cookie, and the recording's switch (off until a person with the write access of Visits switches it on).
// SARCLA 10.11.2026: "we see the screen which is good but don't see the mouse and behaviour on the shop".

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import MouseOutlinedIcon from "@mui/icons-material/MouseOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { convertPost } from "@/app/website/ai-personalization/Flow";
import type { ReplayRow, ReplaySwitch } from "@/lib/convert/replays";
import { ReplayPlayer } from "./Replay";

type Data = { switch: ReplaySwitch | null; contacts: number; rows: (ReplayRow & { contact: string | null })[]; error: string | null; canSwitch: boolean };

const when = (iso: string) => new Date(iso).toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dur = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`);
function pageName(path: string): string {
  if (/^\/[a-z]{2}-[A-Z]{2}\/?$/.test(path)) return `Home page · ${path.slice(1, 6)}`;
  const last = path.replace(/\.html$/, "").split("/").filter(Boolean).pop() ?? path;
  const words = last.replace(/^\d{8}-/, "").replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

export function Recorded({ company, from, to }: { company: string; from: string; to: string }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/visits/replay?company=${company}&from=${from}&to=${to}&n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const flip = async (on: boolean) => {
    if (on && !window.confirm("Record on the shop where visitors move the pointer, scroll and click?\n\nOnly visitors who accept statistics cookies; never a text, a key typed or a form's value. Kept 30 days.\nYour privacy and cookie texts should name it, as they do for Hotjar or Clarity.")) return;
    setBusy(true); setErr(null);
    const res = await convertPost("/api/website/ai-personalization/visits/replay", { on });
    setBusy(false);
    if (!res.ok) setErr(res.error); else setTick((n) => n + 1);
  };

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Asking the shop's gateway for this customer's recorded page views…" />;
  else if (r.state !== "ok") body = <Notice tone="warn">{r.state === "error" ? r.error : "The recordings could not be read."}</Notice>;
  else if (d && !d.switch) body = <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The shop&apos;s gateway does not record yet - it does once its new version is deployed.</Typography>;
  else if (d) {
    const sw = d.switch!;
    const chosen = d.rows.find((x) => x.pv === open) ?? null;
    body = (
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tint={sw.on ? "green" : "slate"}>{sw.on ? "Recording on the shop" : "Not recording"}</Chip>
          {sw.by && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{sw.on ? "switched on" : "switched off"} by {sw.by}{sw.at ? ` · ${when(sw.at)}` : ""}</Typography>}
          <Box sx={{ flex: 1 }} />
          {d.canSwitch && (
            <Button size="small" variant={sw.on ? "outlined" : "contained"} disableElevation disabled={busy} onClick={() => void flip(!sw.on)}
              startIcon={busy ? <CircularProgress size={13} /> : <MouseOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700 }}>
              {sw.on ? "Stop recording" : "Record the pointer and scroll"}
            </Button>
          )}
        </Box>
        {err && <Notice tone="bad">{err}</Notice>}
        {d.error && <Notice tone="warn">{d.error}</Notice>}
        {!d.error && d.contacts === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None of this customer&apos;s contacts has HubSpot&apos;s visitor cookie yet - their page views can&apos;t be told apart from anyone else&apos;s.</Typography>}
        {d.contacts > 0 && d.rows.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No page view of theirs recorded in this period{sw.on ? "" : " - the recording is off"}.</Typography>}
        {d.rows.length > 0 && (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {d.rows.slice(0, 40).map((x) => (
              <Box key={x.pv} component="button" type="button" onClick={() => setOpen((o) => (o === x.pv ? null : x.pv))} sx={{
                all: "unset", cursor: "pointer", display: "flex", gap: 1, alignItems: "center", px: 1.25, py: 0.75, borderRadius: "8px",
                border: `1px solid ${open === x.pv ? "#2459d1" : HAIRLINE}`, bgcolor: open === x.pv ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.8)",
              }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", minWidth: 96 }}>{when(x.started_at)}</Typography>
                <Typography sx={{ fontSize: "0.84rem", color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={x.path}>{pageName(x.path)}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>{dur(x.ms)} · {x.dev === "m" ? "phone" : "desktop"}{x.contact ? ` · ${x.contact}` : ""}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {chosen && <ReplayPlayer key={chosen.pv} row={chosen} />}
      </Box>
    );
  }

  return (
    <GlassCard>
      <CardTitle icon={<MouseOutlinedIcon />} tint="blue" title="Recorded on the shop - the pointer, the scroll, the clicks"
        note="Each page view played on the page: how far they scrolled, where the pointer went, what they clicked" />
      <Box sx={{ mt: 1.5 }}>{body}</Box>
    </GlassCard>
  );
}
