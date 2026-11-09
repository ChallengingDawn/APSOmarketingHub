"use client";

// APSOconvert > the CLICK MAP's bar over the Preview frame (../../../lib/convert/clicks.ts): is the shop counting on this
// page, how many clicks over the last 30 days, desktop or phone, the most clicked elements - and the switch to count here
// for 30 days. Until the shop's gateway runs the version that counts, it says so; it never shows a zero it did not count.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import { full } from "@/app/charts/format";
import { INK, MUTED, RED } from "@/app/uc/report/ui";
import type { Env } from "@/lib/convert/model";
import type { Heat } from "@/lib/convert/clickRules";
import { convertPost } from "./Flow";
import { SquareChoice } from "./SquareChoice";

export type ClickDev = "all" | "d" | "m";
export type ClicksData = {
  deployed: boolean; error: string | null; map: { id: string; until: string | null; by: string | null } | null;
  heat: Heat | null; from: string; to: string; canEdit: boolean;
};

/** The heat's colour, as the frame draws it: pale amber for a few clicks, deep red for the most. */
export const heatColor = (v: number, a = 1) => {
  const t = Math.max(0, Math.min(1, v));
  return `rgba(${Math.round(250 - 30 * t)},${Math.round(190 - 160 * t)},${Math.round(40 - 10 * t)},${a})`;
};
const day = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d);
const ORANGE = "#b45309";

export function HeatLegend() {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: "0.7rem", color: MUTED }}>
      fewer
      <Box sx={{ width: 70, height: 8, borderRadius: "2px", background: `linear-gradient(90deg, ${heatColor(0, 0.5)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
      more clicks
    </Box>
  );
}

export function ClicksBar({ data, error, loading, dev, onDev, env, path, onChanged }: {
  data: ClicksData | null; error: string | null; loading: boolean; dev: ClickDev; onDev: (d: ClickDev) => void;
  env: Env; path: string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const heat = data?.heat ?? null;
  const switchIt = async (on: boolean) => {
    if (on && !window.confirm(`Count clicks on ${path} (${env === "acc" ? "ACC" : "the live shop"}) for 30 days?\n\nOnly visitors who accept statistics cookies are counted: which element and where inside it - no person, no text typed.`)) return;
    setBusy(true); setErr(null);
    const r = await convertPost("/api/website/ai-personalization/clicks", { env, path, on });
    setBusy(false);
    if (!r.ok) setErr(r.error); else onChanged();
  };

  let status: React.ReactNode;
  if (!data && (loading || !error)) {
    status = <><CircularProgress size={13} sx={{ mr: 1 }} />Reading the clicks from the shop&apos;s gateway…</>;
  } else if (error || (data && !data.deployed && data.error)) {
    status = <Box component="span" sx={{ color: RED }}>The clicks could not be read: {error ?? data?.error}</Box>;
  } else if (data && !data.deployed) {
    status = <><b>Not counting yet.</b> The shop counts clicks once its gateway runs the new version (SARCLA deploys it). Nothing is counted before that, and nothing here is guessed.</>;
  } else if (data) {
    const counted = heat?.total ?? 0;
    status = (
      <>
        <b>{data.map ? `Counting on this page${data.map.until ? ` until ${day(data.map.until)}` : ""}` : "Not counting on this page"}</b>
        {" · "}{counted ? `${full(counted)} click${counted === 1 ? "" : "s"}` : "no click"} from {day(data.from)} to {day(data.to)}
        {data.map?.by ? ` · switched on by ${data.map.by}` : ""}
      </>
    );
  }

  return (
    <Box sx={{ mb: 1.5, p: 1.25, borderRadius: "10px", border: "1px solid rgba(180,83,9,.32)", bgcolor: "rgba(250,190,40,.07)" }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <TouchAppOutlinedIcon sx={{ fontSize: 18, color: ORANGE }} />
        <Typography component="div" sx={{ fontSize: "0.82rem", color: INK, flex: "1 1 340px", minWidth: 0, display: "flex", alignItems: "center", flexWrap: "wrap" }}>{status}</Typography>
        {data?.deployed && heat && (heat.desktop > 0 || heat.phone > 0) && (
          <SquareChoice<ClickDev> label="On" value={dev} onChange={onDev}
            options={[{ key: "all", label: "Both", count: heat.desktop + heat.phone }, { key: "d", label: "Desktop", count: heat.desktop }, { key: "m", label: "Phone", count: heat.phone }]} />
        )}
        {data?.deployed && data.canEdit && (
          <Button size="small" variant={data.map ? "outlined" : "contained"} color="warning" disableElevation disabled={busy} onClick={() => void switchIt(!data.map)}
            sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>
            {busy ? "…" : data.map ? "Stop counting" : "Count clicks here for 30 days"}
          </Button>
        )}
      </Box>
      {err && <Typography sx={{ fontSize: "0.78rem", color: RED, mt: 0.75 }}>{err}</Typography>}
      {heat && heat.list.length > 0 && (
        <Box sx={{ mt: 1, display: "grid", gap: 0.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" } }}>
          {heat.list.slice(0, 6).map((i) => (
            <Box key={i.s} title={i.s} sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "2px", flex: "none", bgcolor: heatColor(i.n / Math.max(1, heat.max)) }} />
              <Typography sx={{ fontSize: "0.78rem", color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{full(i.n)} · {Math.round((i.n / Math.max(1, heat.total)) * 100)}%</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ mt: 0.75, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>Drawn on the page as it is - the clicks were made there.</Typography>
        {heat && heat.list.length > 0 && <HeatLegend />}
      </Box>
    </Box>
  );
}
