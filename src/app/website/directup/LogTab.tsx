"use client";

// DirectUP > Activity: what happened on customers' shop pages, step by step, in words (SARCLA, 14.10.2026:
// "I don't understand the log ... should be more specific", "use pagination"). Each event the tool and the
// shop's bridge reported is a sentence with its figures (src/lib/directup/events.ts); routine steps are kept
// out of the first view, problems have their own; the raw data stays one click away for whoever debugs.

import { Fragment, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import DataObjectOutlinedIcon from "@mui/icons-material/DataObjectOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { AMBER, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED, type Tint } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import { describe, TOPICS, type Described, type Tone, type Topic } from "@/lib/directup/events";
import { isoDate, useReportingWindow } from "@/app/window/ReportingWindow";
import type { Log } from "@/lib/directup/gateway";
import { CURRENT_BRIDGE, when } from "./shared";

type ViewKey = "important" | "problems" | Topic | "all";
type Row = { i: number; at: string; ev: string; data: unknown; d: Described };

const TONE_ICON: Record<Tone, { icon: React.ReactNode; label: string }> = {
  ok: { icon: <CheckCircleOutlineIcon sx={{ fontSize: 18, color: GREEN }} />, label: "Went well" },
  info: { icon: <InfoOutlinedIcon sx={{ fontSize: 18, color: FAINT }} />, label: "For information" },
  warn: { icon: <WarningAmberIcon sx={{ fontSize: 18, color: AMBER }} />, label: "Worth a look" },
  bad: { icon: <ErrorOutlineIcon sx={{ fontSize: 18, color: RED }} />, label: "A problem" },
};
const TOPIC_TINT: Record<Topic, Tint> = { visit: "blue", cart: "green", prices: "purple", files: "amber", other: "slate" };

const day = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function LogTab() {
  const [n, setN] = useState(0);
  const held = useHeld<Log>(`/api/website/directup?part=log&n=${n}`, [n]);
  const [view, setView] = useState<ViewKey>("important");
  const [raw, setRaw] = useState<number | null>(null);
  const r = held.result;
  // the hub-wide period in the header, as on the UC reports
  const { window: win, label } = useReportingWindow();

  const read = useMemo(() => (r?.state === "ok" ? r.data.entries : []), [r]);
  const rows: Row[] = useMemo(
    () => read
      .map((e, i) => ({ i, at: e.at, ev: e.ev, data: e.data, d: describe(e.ev, e.data, CURRENT_BRIDGE, e.product ?? null) }))
      .filter((x) => { const day = isoDate(new Date(x.at)); return day >= win.from && day <= win.to; }),
    [read, win.from, win.to],
  );
  // the gateway hands the latest 1,000 steps: a period that starts before the oldest of them is not complete
  const cut = read.length >= 1000 && isoDate(new Date(read[read.length - 1].at)) > win.from;
  const pick = (k: ViewKey) => (x: Row) =>
    k === "all" ? true : k === "important" ? !x.d.routine : k === "problems" ? x.d.tone === "warn" || x.d.tone === "bad" : x.d.topic === k;
  const shown = useMemo(() => rows.filter(pick(view)), [rows, view]);
  const { slice, pager, setPage } = usePaged(shown, 25);
  useEffect(() => { setPage(0); setRaw(null); }, [view, win.from, win.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (r === null) return <LoadingPanel label="Reading what happened on the shop pages…" />;
  if (r.state !== "ok") return <UpstreamPanel source="DirectUp Gateway" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const used = (Object.keys(TOPICS) as Topic[]).filter((t) => rows.some((x) => x.d.topic === t));
  const options: { key: ViewKey; label: string; count: number }[] = [
    { key: "important", label: "Important", count: rows.filter(pick("important")).length },
    { key: "problems", label: "Problems", count: rows.filter(pick("problems")).length },
    ...used.map((t) => ({ key: t as ViewKey, label: TOPICS[t], count: rows.filter(pick(t)).length })),
    { key: "all", label: "Everything", count: rows.length },
  ];

  return (
    <>
      <GlassCard>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="blue" title="What happened on customers' shop pages"
          note={`Each step DirectUP and the shop's bridge reported, newest first: what was done, on which article, the figures, and whether it went well. Never who the customer is. ${label}: ${rows.length.toLocaleString("en-US")} steps${cut ? ` - only the latest 1,000 are kept, from ${when(read[read.length - 1].at).slice(0, 10)}` : ""}.`}
          right={
            <Tooltip title="Read again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Read the activity again">
                {held.stale ? <CircularProgress size={14} sx={{ color: MUTED }} /> : <RefreshIcon sx={{ fontSize: 18, color: MUTED }} />}
              </IconButton>
            </Tooltip>
          } />
        <Choice value={view} onChange={setView} options={options} />
        {view === "important" && (
          <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1.25 }}>
            Routine steps - quantities set to what the shop sells, own numbers loaded, the header&apos;s cart refreshed - are under Everything.
          </Typography>
        )}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: 1 }}>
        {slice.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED, px: { xs: 2, md: 2.75 }, py: 2 }}>Nothing here in {label.toLowerCase()}.</Typography>}
        {slice.map((x, k) => {
          const newDay = k === 0 || day(slice[k - 1].at) !== day(x.at);
          const t = TONE_ICON[x.d.tone];
          return (
            <Fragment key={x.i}>
              {newDay && (
                <Typography sx={{ px: { xs: 2, md: 2.75 }, pt: k === 0 ? 1 : 2, pb: 0.75, fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {day(x.at)}
                </Typography>
              )}
              <Box sx={{
                display: "grid", gridTemplateColumns: { xs: "22px minmax(0,1fr)", md: "64px 22px minmax(0,1fr) auto" }, columnGap: 1.25, rowGap: 0.5,
                alignItems: "start", px: { xs: 2, md: 2.75 }, py: 1.1, borderTop: `1px solid ${HAIRLINE}`,
              }}>
                <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8rem", color: MUTED, fontVariantNumeric: "tabular-nums", pt: "1px" }}>
                  {when(x.at, true).slice(11)}
                </Typography>
                <Tooltip title={t.label} arrow><Box sx={{ pt: "1px", lineHeight: 0 }}>{t.icon}</Box></Tooltip>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: x.d.tone === "bad" ? RED : INK }}>{x.d.title}</Typography>
                  {x.d.article && (
                    <Typography sx={{ fontSize: "0.82rem", color: INK, overflowWrap: "anywhere" }}>
                      <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{x.d.article.sku}</Box>
                      {x.d.article.name ? <Box component="span" sx={{ color: MUTED }}> · {x.d.article.name}</Box> : null}
                    </Typography>
                  )}
                  {x.d.detail && <Typography sx={{ fontSize: "0.8rem", color: MUTED, overflowWrap: "anywhere" }}>{x.d.detail}</Typography>}
                  <Typography sx={{ display: { xs: "block", md: "none" }, fontSize: "0.74rem", color: FAINT, mt: 0.25 }}>{when(x.at, true).slice(11)} · {TOPICS[x.d.topic]}</Typography>
                  {raw === x.i && (
                    <Box component="pre" sx={{ m: 0, mt: 0.75, p: 1, bgcolor: "#f6f8fa", border: `1px solid ${HAIRLINE}`, borderRadius: "10px", fontSize: "0.72rem", whiteSpace: "pre-wrap", wordBreak: "break-all", color: INK }}>
                      {x.ev}{"\n"}{JSON.stringify(x.data, null, 2)}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
                  <Chip tint={TOPIC_TINT[x.d.topic]}>{TOPICS[x.d.topic]}</Chip>
                  <Tooltip title={raw === x.i ? "Hide the raw data" : "Show the raw data"} arrow>
                    <IconButton size="small" onClick={() => setRaw(raw === x.i ? null : x.i)} aria-label="Raw data">
                      <DataObjectOutlinedIcon sx={{ fontSize: 16, color: raw === x.i ? INK : FAINT }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Fragment>
          );
        })}
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>{pager}</Box>
      </GlassCard>
    </>
  );
}
