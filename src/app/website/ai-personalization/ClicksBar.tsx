"use client";

// APSOconvert > the CLICK MAP's bar over the Preview frame (../../../lib/convert/clicks.ts): is the shop counting on this
// page, how many clicks over the last 30 days, desktop or phone, the most clicked elements - and the switch to count here
// for 30 days. Until the shop's gateway runs the version that counts, it says so; it never shows a zero it did not count.
// COMPACT (SARCLA 13.11.2026: "preview on click is not clean and clear"): the elements drawn on the page with their share,
// and the clicked elements the page as drawn does not have in ONE line - no longer a list of forty.

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
import { HEAT_DRAW, heatLegend } from "@/lib/convert/heatDraw";
import { convertPost } from "./Flow";
import { SquareChoice } from "./SquareChoice";

export type ClickDev = "all" | "d" | "m";
export type ClicksData = {
  deployed: boolean; error: string | null; map: { id: string; until: string | null; by: string | null } | null;
  heat: Heat | null; from: string; to: string; canEdit: boolean;
};

/** The heat's colour, as the frame draws it: pale amber for a few clicks, deep orange for the most. */
export const heatColor = (v: number, a = 1) => {
  const t = Math.max(0, Math.min(1, v));
  return `rgba(${Math.round(250 - 30 * t)},${Math.round(190 - 160 * t)},${Math.round(40 - 10 * t)},${a})`;
};
const day = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d);
const ORANGE = "#b45309";

/** `drawn`: the elements the frame draws (src/lib/convert/heatDraw.ts heatPick); `missing`: the ones it did not find;
 *  `action`: the page's own button beside the clicks ("Find optimizations" - SARCLA 13.11.2026: "also here button find
 *  optimization"). */
export function ClicksBar({ data, error, loading, dev, onDev, env, path, focus, onFocus, missing = [], names = {}, drawn = [], action, onChanged }: {
  data: ClicksData | null; error: string | null; loading: boolean; dev: ClickDev; onDev: (d: ClickDev) => void;
  env: Env; path: string; focus?: string | null; onFocus?: (s: string) => void; missing?: string[]; names?: Record<string, string>; drawn?: string[]; action?: React.ReactNode; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const heat = data?.heat ?? null;
  const legend = heat ? heatLegend(heat.list, heat.total, missing, drawn) : null;
  const labelOf = (i: { s: string }) => {
    const it = heat?.list.find((x) => x.s === i.s);
    const label = it?.label ?? i.s;
    return names[i.s] ? `${label.split(" · ")[0]} · “${names[i.s]}”` : label;
  };
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
    status = <><b>Not counting yet.</b> The shop&apos;s gateway does not answer for the click map - nothing is counted, and nothing here is guessed.</>;
  } else if (data) {
    const counted = heat?.total ?? 0;
    status = (
      <span>
        <b>{counted ? `${full(counted)} click${counted === 1 ? "" : "s"} on this page` : "No click on this page"}</b>
        <Box component="span" sx={{ color: MUTED, fontSize: "0.78rem" }}>
          {" "}· {day(data.from)} - {day(data.to)} · {data.map?.id.startsWith("everywhere") ? "the shop counts on every page" : data.map ? `counting here${data.map.until ? ` until ${day(data.map.until)}` : ""}${data.map.by ? `, switched on by ${data.map.by}` : ""}` : "not counting here"}
        </Box>
      </span>
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
        {data?.deployed && data.canEdit && !data.map?.id.startsWith("everywhere") && (
          <Button size="small" variant={data.map ? "outlined" : "contained"} color="warning" disableElevation disabled={busy} onClick={() => void switchIt(!data.map)}
            sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>
            {busy ? "…" : data.map ? "Stop counting" : "Count clicks here for 30 days"}
          </Button>
        )}
        {action}
      </Box>
      {err && <Typography sx={{ fontSize: "0.78rem", color: RED, mt: 0.75 }}>{err}</Typography>}
      {legend && legend.shown.length > 0 && (
        <Box sx={{ mt: 1, display: "grid", gap: 0.25, columnGap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" } }}>
          {legend.shown.map((i) => (
            <Box key={i.s} title={`${full(i.n)} click${i.n === 1 ? "" : "s"} · ${labelOf(i)} - show it on the page`} component="button" type="button" onClick={() => onFocus?.(i.s)}
              sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, px: 0.5, py: 0.2, borderRadius: "4px",
                bgcolor: focus === i.s ? "rgba(197,34,31,.08)" : "transparent", outline: focus === i.s ? "1px solid rgba(197,34,31,.45)" : "none", "&:hover": { bgcolor: "rgba(180,83,9,.08)" } }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "2px", flex: "none", border: `1.5px solid ${heatColor(i.n / Math.max(1, heat!.max), 0.9)}`, bgcolor: heatColor(i.n / Math.max(1, heat!.max), 0.25) }} />
              <Typography sx={{ fontSize: "0.76rem", color: INK, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labelOf(i)}</Typography>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>{i.pct}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {heat && heat.list.length > 0 && (
        <Typography sx={{ mt: 0.75, fontSize: "0.7rem", color: MUTED, lineHeight: 1.45 }}>
          On the page: the most clicked elements ({HEAT_DRAW.top} at most, each with {Math.round(HEAT_DRAW.minShare * 100)}% of the clicks or more), each with its share - the count shows when the pointer rests on it.
          {legend && legend.gone.count > 0 && (
            <Box component="span" title={heat.list.filter((x) => missing.includes(x.s)).slice(0, 12).map((x) => `${x.label} · ${full(x.n)}`).join(", ")}>
              {" "}Not on the page as drawn: {legend.gone.count} element{legend.gone.count === 1 ? "" : "s"}, {legend.gone.pct} of the clicks (a menu that opens on a click, or a part changed since).
            </Box>
          )}
        </Typography>
      )}
    </Box>
  );
}
