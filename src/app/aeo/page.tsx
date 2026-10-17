"use client";
// AI ANSWERS (AEO) - OVERVIEW: how often the AI assistants (ChatGPT, Gemini, Perplexity) name APSO when asked
// the prompts set up in HubSpot's AEO, against competitors, and how often they cite our
// pages - the last 30 days against the 30 before, per assistant, and month by month.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED } from "@/app/uc/report/ui";
import { assistantName, assistantsIn, byMonth, citeRate, mentionRate, shareOfVoice, sumsBetween, type Sums } from "@/lib/aeo/model";
import { AeoHeader, AeoWaiting, Note, int, pct, useAeo } from "./AeoUi";

const COLOR: Record<string, string> = { CHATGPT: "#10a37f", GEMINI: "#4285f4", PERPLEXITY: "#20808d", CLAUDE: "#d97757" };
const iso = (d: Date) => d.toISOString();
const points = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

export default function AeoOverview() {
  const { value: d, computing, progress, error } = useAeo();
  const now = useMemo(() => new Date(), []);
  const w = useMemo(() => {
    if (!d) return null;
    const to = iso(now), from = iso(new Date(now.getTime() - 30 * 86_400_000)), before = iso(new Date(now.getTime() - 60 * 86_400_000));
    return { cur: sumsBetween(d.runs, from, to), prev: sumsBetween(d.runs, before, from) };
  }, [d, now]);
  const months = useMemo(() => {
    if (!d) return [];
    const m = byMonth(d.runs);
    return Object.keys(m).sort().slice(-12).map((k) => ({
      month: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      ...Object.fromEntries(assistantsIn(d.runs).map((a) => [assistantName(a), m[k].by[a] ? Math.round((mentionRate(m[k].by[a]) ?? 0) * 1000) / 10 : null])),
    }));
  }, [d]);

  if (!d || !w) return (<><AeoHeader title="AI answers (AEO)" data={null} /><AeoWaiting computing={computing} progress={progress} error={error} /></>);
  const c = w.cur.all, p = w.prev.all;
  const change = (a: number | null, b: number | null) => {
    const x = points(a, b);
    return x == null ? "no 30 days before to compare" : `${x > 0 ? "↑" : x < 0 ? "↓" : "±"} ${Math.abs(x * 100).toFixed(1)} pts against the 30 days before (${pct(b)})`;
  };
  const used = assistantsIn(d.runs);
  return (
    <>
      <AeoHeader title="AI answers (AEO)" data={d} />
      {computing && <Typography sx={{ fontSize: "0.8rem", color: FAINT, mt: -1 }}>Reading HubSpot&apos;s AEO again{progress ? ` - ${progress}` : ""}; these figures stand until it is done.</Typography>}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CampaignOutlinedIcon />} tint="green" label="Answers naming APSO, last 30 days" value={pct(mentionRate(c))} note={change(mentionRate(c), mentionRate(p))} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<InsightsOutlinedIcon />} tint="purple" label="Share of voice against competitors" value={pct(shareOfVoice(c))} note={`APSO named ${int(c.owned)} times, competitors ${int(c.competitor)} · ${change(shareOfVoice(c), shareOfVoice(p))}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LinkOutlinedIcon />} tint="blue" label="Answers citing our pages" value={pct(citeRate(c))} note={`apsoparts.com or angst-pfister.com among the sources · ${change(citeRate(c), citeRate(p))}`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ForumOutlinedIcon />} tint="amber" label="Answers read, last 30 days" value={int(c.answers)} note={`${int(p.answers)} the 30 days before · ${int(d.prompts.length)} prompts`} /></Grid>
      </Grid>

      <GlassCard sx={{ display: "grid", gap: 1.5 }}>
        <CardTitle icon={<SmartToyOutlinedIcon />} tint="purple" title="By assistant, last 30 days" note="How each AI answers the same prompts" />
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) repeat(4, minmax(120px, 1fr))", columnGap: 2, rowGap: 1, minWidth: 640, alignItems: "baseline" }}>
            {["Assistant", "Answers", "Naming APSO", "Share of voice", "Citing our pages"].map((h, i) => (
              <Typography key={h} sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i ? "right" : "left" }}>{h}</Typography>
            ))}
            {used.map((a) => {
              const s: Sums | undefined = w.cur.by[a], sp: Sums | undefined = w.prev.by[a];
              const cell = (v: string, prev?: string) => (
                <Box sx={{ textAlign: "right", borderTop: `1px solid ${HAIRLINE}`, pt: 0.75 }}>
                  <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{v}</Typography>
                  {prev != null && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>before: {prev}</Typography>}
                </Box>
              );
              return (
                <Box key={a} sx={{ display: "contents" }}>
                  <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLOR[a] ?? MUTED }} />
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{assistantName(a)}</Typography>
                  </Box>
                  {cell(int(s?.answers ?? 0), int(sp?.answers ?? 0))}
                  {cell(pct(s ? mentionRate(s) : null), pct(sp ? mentionRate(sp) : null))}
                  {cell(pct(s ? shareOfVoice(s) : null), pct(sp ? shareOfVoice(sp) : null))}
                  {cell(pct(s ? citeRate(s) : null), pct(sp ? citeRate(sp) : null))}
                </Box>
              );
            })}
          </Box>
        </Box>
      </GlassCard>

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<InsightsOutlinedIcon />} tint="green" title="Answers naming APSO, month by month" note="The share of each assistant's answers that named APSO" />
        {months.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e6e8ec" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} tickLine={false} axisLine={false} width={44} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(1)}%`, String(n)]} contentStyle={{ fontSize: "0.8rem", borderRadius: 10 }} />
              <Legend verticalAlign="top" align="left" height={24} iconType="circle" wrapperStyle={{ fontSize: "0.78rem" }} />
              {used.map((a) => <Bar key={a} dataKey={assistantName(a)} fill={COLOR[a] ?? MUTED} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        ) : <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>No answers yet.</Typography>}
      </GlassCard>

      <Note>
        From HubSpot&apos;s AEO (beta): the prompts set up there, asked to each assistant again and again. Every answer is kept in the hub, so the months build up beyond what HubSpot keeps.
        Share of voice = APSO&apos;s mentions against all mentions, competitors included. Citing our pages counts answers whose sources include apsoparts.com or angst-pfister.com
        {d.pendingDetails ? ` - the sources of ${int(d.pendingDetails)} older answers are still being read` : ""}.
        {c.answers === 0 && <Box component="span" sx={{ color: RED }}> No answers in the last 30 days - check the prompts run in HubSpot&apos;s AEO.</Box>}
      </Note>
    </>
  );
}
