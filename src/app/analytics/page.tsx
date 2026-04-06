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

import { analyticsData, trafficChartData } from "@/lib/mockData";

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
  { label: "Total Sessions", value: "—", change: 0, suffix: "Awaiting GA4" },
  { label: "Page Views", value: "—", change: 0, suffix: "Awaiting GA4" },
  { label: "Avg Bounce Rate", value: "—", change: 0, inverted: true, suffix: "Awaiting GA4" },
  { label: "Content ROI Score", value: "—", change: 0, suffix: "Awaiting data" },
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
        {TIME_PERIODS.map((period) => (
          <Chip
            key={period}
            label={period}
            onClick={() => setActivePeriod(period)}
            color={activePeriod === period ? "primary" : "default"}
            variant={activePeriod === period ? "filled" : "outlined"}
            sx={{ cursor: "pointer" }}
          />
        ))}
      </Box>

      {/* ── KPI Cards ── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpis.map((kpi) => {
          const isPositive = kpi.inverted ? kpi.change < 0 : kpi.change > 0;
          const isNeutral = kpi.change === 0;
          return (
            <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "text.secondary", mb: 1 }}
                  >
                    {kpi.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1 }}>
                    {kpi.value}
                  </Typography>
                  {!isNeutral && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        color: isPositive ? "success.main" : "error.main",
                      }}
                    >
                      {isPositive ? (
                        <TrendingUpIcon fontSize="small" />
                      ) : (
                        <TrendingDownIcon fontSize="small" />
                      )}
                      <Typography variant="body2" sx={{ color: "inherit" }}>
                        {kpi.change > 0 ? "+" : ""}
                        {kpi.change}%
                        {kpi.inverted ? " (improvement)" : ""}
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
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Traffic Trend
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Weekly sessions and page views
          </Typography>
          <Box sx={{ width: "100%", height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={analyticsData.weeklyTraffic}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ea" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12, fill: "#5e5e5e" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#5e5e5e" }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    fmt.format(Number(value)),
                    name === "sessions" ? "Sessions" : "Page Views",
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#274e64"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#274e64" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="#0077b5"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#0077b5" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
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
