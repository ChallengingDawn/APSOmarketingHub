"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import TrendingUp from "@mui/icons-material/TrendingUp";
import TrendingDown from "@mui/icons-material/TrendingDown";
import Warning from "@mui/icons-material/Warning";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Info from "@mui/icons-material/Info";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { seoKeywords } from "@/lib/mockData";

/* ── helpers ── */

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function positionChip(position: number) {
  if (position === 0)
    return <Chip label="Not ranking" size="small" sx={{ bgcolor: "#e0e0e0", color: "#616161", fontWeight: 600 }} />;
  if (position < 10)
    return (
      <Chip
        label={position}
        size="small"
        sx={{ bgcolor: "#d1fae5", color: "#065f46", fontWeight: 700, minWidth: 40 }}
      />
    );
  if (position <= 20)
    return (
      <Chip
        label={position}
        size="small"
        sx={{ bgcolor: "#fef3c7", color: "#92400e", fontWeight: 700, minWidth: 40 }}
      />
    );
  return (
    <Chip
      label={position}
      size="small"
      sx={{ bgcolor: "#fee2e2", color: "#991b1b", fontWeight: 700, minWidth: 40 }}
    />
  );
}

function difficultyColor(d: number): "success" | "warning" | "error" {
  if (d < 40) return "success";
  if (d <= 60) return "warning";
  return "error";
}

const sourceStyles: Record<string, { bg: string; color: string }> = {
  "GSC Quick Win": { bg: "#dbeafe", color: "#1e40af" },
  "Content Gap": { bg: "#ffedd5", color: "#9a3412" },
  Competitor: { bg: "#fee2e2", color: "#991b1b" },
  Editorial: { bg: "#ede9fe", color: "#5b21b6" },
};

/* ── summary card data ── */

const quickWins = seoKeywords.filter((k) => k.position >= 5 && k.position <= 20);
const contentGaps = seoKeywords.filter((k) => k.position === 0);
const cannibAlerts = seoKeywords.filter((k) => k.cannibalization);

const summaryCards = [
  { label: "Total Keywords Tracked", value: "1,247", sub: "Across all GSC properties", icon: <CheckCircle />, color: "#274e64" },
  { label: "Quick Win Opportunities", value: String(quickWins.length), sub: "Keywords position 5\u201320", icon: <TrendingUp />, color: "#10b981" },
  { label: "Content Gaps", value: String(contentGaps.length), sub: "Competitor keywords we don\u2019t rank for", icon: <Info />, color: "#f59e0b" },
  { label: "Cannibalization Alerts", value: String(cannibAlerts.length), sub: "Pages competing for same keyword", icon: <Warning />, color: "#ef4444" },
];

/* ── component ── */

export default function SEOCommandCenter() {
  const quickWinChart = useMemo(() => {
    const scored = seoKeywords
      .filter((k) => k.position > 0 && k.position <= 20)
      .map((k) => ({
        keyword: k.keyword,
        score: Math.round((k.volume * (20 - k.position)) / Math.max(k.difficulty, 1)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return scored;
  }, []);

  return (
    <>
      {/* ── Header ── */}
      <Typography variant="h5" gutterBottom>
        SEO Command Center
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Keyword intelligence, content gaps &amp; ranking opportunities
      </Typography>

      {/* ── Summary Cards ── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {summaryCards.map((c) => (
          <Grid key={c.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: c.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  {c.icon}
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ lineHeight: 1.1, mb: 0.25 }}>
                    {c.value}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
                    {c.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.sub}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Keyword Table ── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="subtitle1" gutterBottom>
            Keyword Intelligence Table
          </Typography>
        </CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Keyword</TableCell>
                <TableCell align="right">Volume</TableCell>
                <TableCell align="center">Position</TableCell>
                <TableCell align="center">Change</TableCell>
                <TableCell align="right">CPC</TableCell>
                <TableCell sx={{ minWidth: 130 }}>Difficulty</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="center">Cannibal.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {seoKeywords.map((row) => {
                const ss = sourceStyles[row.source] ?? sourceStyles["Editorial"];
                return (
                  <TableRow key={row.keyword} hover>
                    {/* Keyword */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {row.keyword}
                      </Typography>
                      {row.url && (
                        <Typography variant="caption" color="text.secondary">
                          {row.url}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Volume */}
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: "text.primary" }}>
                        {formatNumber(row.volume)}
                      </Typography>
                    </TableCell>

                    {/* Position */}
                    <TableCell align="center">{positionChip(row.position)}</TableCell>

                    {/* Change */}
                    <TableCell align="center">
                      {row.change === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          &mdash;
                        </Typography>
                      ) : (
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
                          {row.change < 0 ? (
                            <TrendingUp sx={{ fontSize: 16, color: "success.main" }} />
                          ) : (
                            <TrendingDown sx={{ fontSize: 16, color: "error.main" }} />
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: row.change < 0 ? "success.main" : "error.main",
                            }}
                          >
                            {row.change < 0 ? `+${Math.abs(row.change)}` : `-${row.change}`}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>

                    {/* CPC */}
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: "text.primary" }}>
                        ${row.cpc.toFixed(2)}
                      </Typography>
                    </TableCell>

                    {/* Difficulty */}
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={row.difficulty}
                          color={difficultyColor(row.difficulty)}
                          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 24, textAlign: "right" }}>
                          {row.difficulty}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Source */}
                    <TableCell>
                      <Chip
                        label={row.source}
                        size="small"
                        sx={{ bgcolor: ss.bg, color: ss.color, fontWeight: 600 }}
                      />
                    </TableCell>

                    {/* Cannibalization */}
                    <TableCell align="center">
                      {row.cannibalization ? (
                        <Tooltip title="Cannibalization detected — multiple pages competing for this keyword">
                          <Warning sx={{ fontSize: 20, color: "warning.main" }} />
                        </Tooltip>
                      ) : (
                        <CheckCircle sx={{ fontSize: 18, color: "#c8c8c8" }} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Bottom row: Reasoning + Chart ── */}
      <Grid container spacing={2.5}>
        {/* Reasoning Panel */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Info sx={{ color: "primary.main", fontSize: 22 }} />
                <Typography variant="subtitle1">Content Brief Reasoning</Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: "#f8fafc",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", mb: 1.5 }}>
                  Keyword selected:{" "}
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
                    &ldquo;hydraulic seals supplier&rdquo;
                  </Typography>
                </Typography>

                {[
                  { label: "Position", text: "11 (within quick-win range 5\u201320)" },
                  { label: "Search volume", text: "2,400/mo" },
                  { label: "Competition score", text: "42/100 (medium)" },
                  { label: "Cannibalization", text: "No cannibalization detected" },
                  { label: "Strategic fit", text: "Aligns with Q2 product focus" },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: "flex", gap: 1, mb: 0.75 }}>
                    <CheckCircle sx={{ fontSize: 16, color: "success.main", mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2">
                      <strong>{item.label}:</strong> {item.text}
                    </Typography>
                  </Box>
                ))}

                <Box
                  sx={{
                    mt: 2,
                    pt: 1.5,
                    borderTop: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Reasoning generated by SEO pipeline &middot; Last run: Apr 4, 2026 08:00 UTC
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Wins Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Top Quick-Win Opportunities
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                Score = volume &times; (20 &minus; position) / difficulty
              </Typography>

              <Box sx={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={quickWinChart} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="keyword"
                      width={180}
                      tick={{ fontSize: 12 }}
                    />
                    <RechartsTooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [value, "Opportunity Score"]}
                      contentStyle={{ borderRadius: 8, fontSize: 13 }}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={28}>
                      {quickWinChart.map((_, i) => (
                        <Cell
                          key={i}
                          fill={["#274e64", "#325f78", "#3b82f6", "#10b981", "#60a5fa"][i % 5]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
