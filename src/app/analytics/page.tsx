"use client";
import PageHeader from "@/app/PageHeader";

import { useState, useMemo } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentIcon from "@mui/icons-material/Assessment";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import LinearProgress from "@mui/material/LinearProgress";
import LanguageIcon from "@mui/icons-material/Language";
import DevicesIcon from "@mui/icons-material/Devices";
import LinkIcon from "@mui/icons-material/Link";
import SearchIcon from "@mui/icons-material/Search";
import { AreaChart, Area } from "recharts";
import { analyticsData, trafficChartData } from "@/lib/mockData";

// Type-safe access for fields we just added
type AnalyticsExt = typeof analyticsData & {
  topPages?: { url: string; sessions: number; bounce: number; avgTime: string; change: number }[];
  topKeywords?: { keyword: string; position: number; clicks: number; impressions: number; ctr: number }[];
  deviceSplit?: { device: string; percentage: number }[];
  topCountries?: { country: string; flag: string; sessions: number; percentage: number }[];
};
const analytics = analyticsData as AnalyticsExt;

/* ── helpers ── */

const fmt = new Intl.NumberFormat("en-US");

const CHANNEL_COLORS: Record<string, string> = {
  "Blog/SEO": "#274e64",
  LinkedIn: "#0077b5",
  Newsletter: "#f59e0b",
  Direct: "#8b5cf6",
};

const CHANNEL_CHIP_COLOR: Record<string, string> = {
  Blog: "#274e64",
  LinkedIn: "#0077b5",
  Newsletter: "#f59e0b",
};

const TIME_PERIODS = ["7 Days", "30 Days", "90 Days", "This Quarter"] as const;

/* ── KPI definitions ── */

interface KpiDef {
  label: string;
  value: string;
  change: number;
  suffix?: string;
  inverted?: boolean; // true means negative change is good
}

const kpis: KpiDef[] = [
  { label: "Total Sessions", value: "12,438", change: 8.4, suffix: "vs prev period" },
  { label: "Page Views", value: "34,217", change: 12.1, suffix: "vs prev period" },
  { label: "Avg Bounce Rate", value: "42.3%", change: -3.2, inverted: true, suffix: "vs prev period" },
  { label: "Content ROI Score", value: "78/100", change: 5.6, suffix: "quality index" },
  { label: "Avg Session Duration", value: "2m 48s", change: 6.9, suffix: "vs prev period" },
  { label: "Pages / Session", value: "2.75", change: 4.1, suffix: "engagement" },
  { label: "Goal Conversions", value: "184", change: 15.3, suffix: "samples + quotes" },
  { label: "Conversion Rate", value: "1.48%", change: 0.6, suffix: "of sessions" },
];

/* ── Pie chart custom label ── */

const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

/* ── Page component ── */

export default function AnalyticsPage() {
  const [activePeriod, setActivePeriod] =
    useState<(typeof TIME_PERIODS)[number]>("30 Days");

  const sortedContent = useMemo(
    () =>
      [...analyticsData.contentPerformance].sort(
        (a, b) => b.views - a.views
      ),
    []
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      <PageHeader
        title="Analytics & Reporting"
        subtitle="Content performance, ROI metrics & quality monitoring"
      />

      {/* ── Time Period Selector ── */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 4 }}>
        {TIME_PERIODS.map((period) => {
          const active = activePeriod === period;
          return (
            <Chip
              key={period}
              label={period}
              onClick={() => setActivePeriod(period)}
              sx={{
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.78rem",
                px: 0.5,
                bgcolor: active ? "#ed1b2f" : "#fff",
                color: active ? "#fff" : "#3c4043",
                border: active ? "1px solid #ed1b2f" : "1px solid #ececec",
                "&:hover": {
                  bgcolor: active ? "#d80901" : "#fdebed",
                  color: active ? "#fff" : "#ed1b2f",
                  borderColor: "#ed1b2f",
                },
              }}
            />
          );
        })}
      </Box>

      {/* ── KPI Cards ── */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {kpis.map((kpi) => {
          const isPositive = kpi.inverted ? kpi.change < 0 : kpi.change > 0;
          const isNeutral = kpi.change === 0;
          return (
            <Grid key={kpi.label} size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
              <Card sx={{ height: "100%", borderRadius: 4, border: "1px solid #ececec" }}>
                <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {kpi.label}
                    </Typography>
                    <Chip
                      label="SAMPLE"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        bgcolor: "#fdebed",
                        color: "#ed1b2f",
                        border: "none",
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: "1.5rem", fontWeight: 600, color: "#1f1f1f", lineHeight: 1.1, letterSpacing: "-0.02em", mb: 0.5 }}>
                    {kpi.value}
                  </Typography>
                  {!isNeutral && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.4,
                        color: isPositive ? "#1e8e3e" : "#ea4335",
                      }}
                    >
                      {isPositive ? (
                        <TrendingUpIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 14 }} />
                      )}
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "inherit" }}>
                        {kpi.change > 0 ? "+" : ""}
                        {kpi.change}%
                      </Typography>
                      <Typography sx={{ fontSize: "0.65rem", color: "#9aa0a6", ml: 0.4 }}>
                        {kpi.suffix}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Traffic Trend Chart ── */}
      <Card sx={{ mb: 4, borderRadius: 4, border: "1px solid #ececec" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
              <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                Traffic Trend
              </Typography>
            </Box>
            <Chip
              label="SAMPLE"
              size="small"
              sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: "#fdebed", color: "#ed1b2f", border: "none" }}
            />
          </Box>
          <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
            Weekly sessions and page views
          </Typography>
          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analyticsData.weeklyTraffic}
                margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="gradPV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0077b5" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0077b5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradSes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#274e64" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#274e64" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#5f6368" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#5f6368" }} axisLine={false} tickLine={false} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    fmt.format(Number(value)),
                    name === "sessions" ? "Sessions" : "Page Views",
                  ]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #ececec", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="#0077b5"
                  strokeWidth={2.5}
                  fill="url(#gradPV)"
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#274e64"
                  strokeWidth={2.5}
                  fill="url(#gradSes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>

      {/* ── Two-column row: Channel Breakdown + Quality Scores ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Channel Breakdown — Donut Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Channel Breakdown
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mb: 2 }}
              >
                Traffic distribution by channel
              </Typography>
              <Box sx={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.channelBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="percentage"
                      nameKey="channel"
                      label={renderPieLabel}
                      labelLine={false}
                    >
                      {analyticsData.channelBreakdown.map((entry) => (
                        <Cell
                          key={entry.channel}
                          fill={CHANNEL_COLORS[entry.channel] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [
                        `${value}%`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => (
                        <span style={{ color: "#050505", fontSize: 13 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quality Scores — Horizontal Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quality Scores
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mb: 2 }}
              >
                Content quality metrics vs targets
              </Typography>
              <Box sx={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analyticsData.qualityScores}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e6e8ea"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "#5e5e5e" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="metric"
                      tick={{ fontSize: 12, fill: "#5e5e5e" }}
                      width={120}
                    />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [
                        `${value}/100`,
                        name === "score" ? "Score" : "Target",
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="score"
                      name="Score"
                      fill="#274e64"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="target"
                      name="Target"
                      fill="#e6e8ea"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── SEMrush-style: Top Pages + Top Keywords ── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {/* Top Pages */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%", borderRadius: 4, border: "1px solid #ececec" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Top Landing Pages
                  </Typography>
                </Box>
                <Chip
                  label="SAMPLE"
                  size="small"
                  sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: "#fdebed", color: "#ed1b2f", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Best-performing URLs by sessions
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {(analytics.topPages ?? []).map((p, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 1.25,
                      borderBottom: i < (analytics.topPages?.length ?? 0) - 1 ? "1px solid #f1f3f4" : "none",
                    }}
                  >
                    <LinkIcon sx={{ fontSize: 14, color: "#274e64", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.url}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1.5, mt: 0.25 }}>
                        <Typography sx={{ fontSize: "0.65rem", color: "#5f6368" }}>
                          Bounce {p.bounce}%
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", color: "#5f6368" }}>
                          · {p.avgTime}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f1f1f", lineHeight: 1.1 }}>
                        {fmt.format(p.sessions)}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.25, mt: 0.25 }}>
                        {p.change >= 0 ? (
                          <TrendingUpIcon sx={{ fontSize: 11, color: "#1e8e3e" }} />
                        ) : (
                          <TrendingDownIcon sx={{ fontSize: 11, color: "#ea4335" }} />
                        )}
                        <Typography sx={{ fontSize: "0.62rem", fontWeight: 600, color: p.change >= 0 ? "#1e8e3e" : "#ea4335" }}>
                          {p.change >= 0 ? "+" : ""}{p.change}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Keywords (GSC-style) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: "100%", borderRadius: 4, border: "1px solid #ececec" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#ed1b2f" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Top Organic Keywords
                  </Typography>
                </Box>
                <Chip
                  label="SAMPLE"
                  size="small"
                  sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: "#fdebed", color: "#ed1b2f", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Keywords driving the most clicks
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {(analytics.topKeywords ?? []).map((k, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 1.25,
                      borderBottom: i < (analytics.topKeywords?.length ?? 0) - 1 ? "1px solid #f1f3f4" : "none",
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 14, color: "#ed1b2f", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {k.keyword}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1.5, mt: 0.25 }}>
                        <Typography sx={{ fontSize: "0.65rem", color: "#5f6368" }}>
                          {fmt.format(k.impressions)} impr.
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", color: "#5f6368" }}>
                          · CTR {k.ctr}%
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                      <Chip
                        label={`#${k.position}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          bgcolor: k.position <= 5 ? "#e6f4ea" : "#fef7e0",
                          color: k.position <= 5 ? "#1e8e3e" : "#b06000",
                          border: "none",
                          minWidth: 36,
                        }}
                      />
                      <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "#5f6368", mt: 0.25 }}>
                        {fmt.format(k.clicks)} clicks
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── SEMrush-style: Devices + Geographic ── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {/* Device split */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%", borderRadius: 4, border: "1px solid #ececec" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#9334e6" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Device Split
                  </Typography>
                </Box>
                <Chip
                  label="SAMPLE"
                  size="small"
                  sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: "#fdebed", color: "#ed1b2f", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", ml: 1.75, mb: 2.5 }}>
                Sessions by device category
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {(analytics.deviceSplit ?? []).map((d, i) => {
                  const colors = ["#274e64", "#ed1b2f", "#fbbc04"];
                  return (
                    <Box key={i}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <DevicesIcon sx={{ fontSize: 14, color: colors[i] }} />
                          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f" }}>
                            {d.device}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f1f1f" }}>
                          {d.percentage}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={d.percentage}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: "#f1f3f4",
                          "& .MuiLinearProgress-bar": { bgcolor: colors[i], borderRadius: 4 },
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Geographic */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%", borderRadius: 4, border: "1px solid #ececec" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#34a853" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Geographic Distribution
                  </Typography>
                </Box>
                <Chip
                  label="SAMPLE"
                  size="small"
                  sx={{ height: 18, fontSize: "0.55rem", fontWeight: 700, bgcolor: "#fdebed", color: "#ed1b2f", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Top countries by sessions
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {(analytics.topCountries ?? []).map((c, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ fontSize: "1.1rem", flexShrink: 0, width: 22 }}>{c.flag}</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f" }}>
                          {c.country}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1.25 }}>
                          <Typography sx={{ fontSize: "0.72rem", color: "#5f6368", fontWeight: 500 }}>
                            {fmt.format(c.sessions)}
                          </Typography>
                          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1f1f1f", minWidth: 32, textAlign: "right" }}>
                            {c.percentage}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={c.percentage * 2.5}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "#f1f3f4",
                          "& .MuiLinearProgress-bar": { bgcolor: "#34a853", borderRadius: 3 },
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Content Performance Table ── */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Content Performance
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Individual content metrics sorted by views
          </Typography>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Content Title</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell align="right">Views</TableCell>
                  <TableCell align="right">Clicks</TableCell>
                  <TableCell align="right">CTR</TableCell>
                  <TableCell align="right">Conversions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedContent.map((row) => {
                  const ctr =
                    row.views > 0
                      ? ((row.clicks / row.views) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <TableRow
                      key={row.title}
                      sx={{
                        "&:last-child td, &:last-child th": { border: 0 },
                      }}
                    >
                      <TableCell>
                        <Typography variant="subtitle2">
                          {row.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={row.channel}
                          size="small"
                          sx={{
                            bgcolor:
                              CHANNEL_CHIP_COLOR[row.channel] ?? "#94a3b8",
                            color: "#fff",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {fmt.format(row.views)}
                      </TableCell>
                      <TableCell align="right">
                        {fmt.format(row.clicks)}
                      </TableCell>
                      <TableCell align="right">{ctr}%</TableCell>
                      <TableCell align="right">{row.conversions}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Export Section ── */}
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AssessmentIcon />}
        >
          Generate Report
        </Button>
        <Button variant="outlined" color="primary" startIcon={<DownloadIcon />}>
          Download CSV
        </Button>
      </Box>
    </Box>
  );
}
