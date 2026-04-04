"use client";

import { useMemo } from "react";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArticleIcon from "@mui/icons-material/Article";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import SettingsIcon from "@mui/icons-material/Settings";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import PublishIcon from "@mui/icons-material/Publish";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  kpiData,
  trafficChartData,
  contentPipelineData,
  activityFeed,
} from "@/lib/mockData";

/* ── helpers ── */

const fmt = new Intl.NumberFormat("en-US");
const fmtDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

interface KpiDef {
  label: string;
  key: keyof typeof kpiData;
  format: (v: number) => string;
  suffix?: string;
  /** When true, a negative change is good (e.g. avg position going down) */
  invertColor?: boolean;
}

const kpis: KpiDef[] = [
  { label: "Organic Traffic", key: "organicTraffic", format: (v) => fmt.format(v) },
  { label: "Keyword Rankings", key: "keywordRankings", format: (v) => fmt.format(v) },
  { label: "Content Output", key: "contentPieces", format: (v) => String(v) },
  { label: "Avg Position", key: "avgPosition", format: (v) => fmtDecimal.format(v), invertColor: true },
  { label: "CTR", key: "clickThroughRate", format: (v) => `${fmtDecimal.format(v)}%`, suffix: "%" },
  { label: "Pipeline Items", key: "pipelineItems", format: (v) => String(v) },
];

const statusColorMap: Record<string, string> = {
  positive: "#10b981",
  approved: "#10b981",
  published: "#274e64",
  pending_review: "#f59e0b",
  action_needed: "#ed1b2f",
  rejected: "#ef4444",
  info: "#3b82f6",
};

const statusIconMap: Record<string, React.ReactNode> = {
  positive: <TrendingUpIcon fontSize="small" />,
  approved: <CheckCircleIcon fontSize="small" />,
  published: <PublishIcon fontSize="small" />,
  pending_review: <ArticleIcon fontSize="small" />,
  action_needed: <ErrorIcon fontSize="small" />,
  rejected: <HighlightOffIcon fontSize="small" />,
  info: <InfoIcon fontSize="small" />,
};

const typeIconMap: Record<string, React.ReactNode> = {
  content: <ArticleIcon fontSize="small" />,
  seo: <SearchIcon fontSize="small" />,
  approval: <CheckCircleIcon fontSize="small" />,
  system: <SettingsIcon fontSize="small" />,
};

/* ── custom recharts tooltip ── */

function TrafficTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 1.5,
        px: 2,
        py: 1.5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
        {label}
      </Typography>
      {payload.map((entry) => (
        <Typography key={entry.name} variant="caption" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: entry.color, flexShrink: 0 }} />
          {entry.name}: {fmt.format(entry.value)}
        </Typography>
      ))}
    </Box>
  );
}

/* ── page ── */

export default function MissionControl() {
  const pipelineTotal = useMemo(
    () => contentPipelineData.reduce((sum, d) => sum + d.count, 0),
    []
  );

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ color: "#050505", letterSpacing: "-0.02em" }}>
              Mission Control
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Real-time overview of your digital growth pipeline
            </Typography>
          </Box>
          <Chip
            icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
            label={today}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 500, borderColor: "#d1d5db", color: "text.secondary" }}
          />
        </Box>
      </Box>

      {/* ── KPI Row ── */}
      <Grid container spacing={2.5} className="stagger-children" sx={{ mb: 4 }}>
        {kpis.map((kpi) => {
          const data = kpiData[kpi.key];
          const change = data.change;
          const isPositive = kpi.invertColor ? change < 0 : change > 0;
          const isNeutral = change === 0;
          const chipColor = isNeutral ? "#6b7280" : isPositive ? "#10b981" : "#ef4444";
          const chipBg = isNeutral ? "#f3f4f6" : isPositive ? "#ecfdf5" : "#fef2f2";

          return (
            <Grid key={kpi.key} size={{ xs: 6, sm: 4, md: 2 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderColor: "#e5e7eb",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                  "&:hover": {
                    borderColor: "#274e64",
                    boxShadow: "0 4px 16px rgba(39,78,100,0.08)",
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
                    {kpi.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ mt: 0.75, mb: 1, color: "#050505", lineHeight: 1.1 }}>
                    {kpi.format(data.value)}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {!isNeutral && (
                      <Chip
                        icon={isPositive ? <TrendingUpIcon sx={{ fontSize: 14, color: `${chipColor} !important` }} /> : <TrendingDownIcon sx={{ fontSize: 14, color: `${chipColor} !important` }} />}
                        label={`${change > 0 ? "+" : ""}${fmtDecimal.format(change)}${kpi.key === "clickThroughRate" ? "%" : "%"}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          bgcolor: chipBg,
                          color: chipColor,
                          border: "none",
                          "& .MuiChip-icon": { ml: 0.5 },
                        }}
                      />
                    )}
                    {isNeutral && (
                      <Chip
                        label="--"
                        size="small"
                        sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600, bgcolor: chipBg, color: chipColor, border: "none" }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, fontSize: "0.65rem" }}>
                    {data.period}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Traffic Trend Chart ── */}
      <Card
        variant="outlined"
        className="animate-fade-in-up"
        sx={{ mb: 4, borderColor: "#e5e7eb" }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, color: "#050505" }}>
            Traffic Trend
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
            Organic, paid, and direct sessions over the last 6 months
          </Typography>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={trafficChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="gradOrganic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#274e64" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#274e64" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ed1b2f" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ed1b2f" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradDirect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<TrafficTooltip />} />
              <Area type="monotone" dataKey="organic" name="Organic" stroke="#274e64" strokeWidth={2.5} fill="url(#gradOrganic)" dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "#fff", stroke: "#274e64" }} />
              <Area type="monotone" dataKey="paid" name="Paid" stroke="#ed1b2f" strokeWidth={2} fill="url(#gradPaid)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#ed1b2f" }} />
              <Area type="monotone" dataKey="direct" name="Direct" stroke="#3b82f6" strokeWidth={2} fill="url(#gradDirect)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: "#3b82f6" }} />
            </AreaChart>
          </ResponsiveContainer>
          {/* Legend */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 3, mt: 1 }}>
            {[
              { label: "Organic", color: "#274e64" },
              { label: "Paid", color: "#ed1b2f" },
              { label: "Direct", color: "#3b82f6" },
            ].map((item) => (
              <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: item.color }} />
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* ── Two-column: Pipeline + Activity Feed ── */}
      <Grid container spacing={3}>
        {/* Content Pipeline */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            variant="outlined"
            className="animate-fade-in-up"
            sx={{ height: "100%", borderColor: "#e5e7eb" }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, color: "#050505" }}>
                Content Pipeline
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
                {pipelineTotal} total items across all stages
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={contentPipelineData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      dataKey="count"
                      nameKey="status"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {contentPipelineData.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [`${value} items`, name]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => (
                        <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 500 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              {/* Horizontal stacked bar */}
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }}>
                  {contentPipelineData.map((item) => (
                    <Box
                      key={item.status}
                      sx={{
                        width: `${(item.count / pipelineTotal) * 100}%`,
                        bgcolor: item.color,
                        transition: "width 0.5s ease",
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                  {contentPipelineData.map((item) => (
                    <Box key={item.status} sx={{ textAlign: "center" }}>
                      <Typography variant="caption" fontWeight={700} sx={{ color: item.color, fontSize: "0.75rem" }}>
                        {item.count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.6rem" }}>
                        {item.status}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            variant="outlined"
            className="animate-fade-in-up"
            sx={{ height: "100%", borderColor: "#e5e7eb", display: "flex", flexDirection: "column" }}
          >
            <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5, color: "#050505" }}>
                Activity Feed
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                Latest updates across your marketing operations
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: 380,
                  pr: 0.5,
                }}
              >
                {activityFeed.map((item, idx) => {
                  const statusColor = statusColorMap[item.status] || "#6b7280";
                  return (
                    <Box key={item.id}>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 2,
                          py: 1.75,
                          px: 2,
                          borderLeft: `3px solid ${statusColor}`,
                          borderRadius: "0 8px 8px 0",
                          transition: "background-color 0.15s",
                          "&:hover": { bgcolor: "#f9fafb" },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: `${statusColor}14`,
                            color: statusColor,
                            flexShrink: 0,
                            mt: 0.25,
                          }}
                        >
                          {typeIconMap[item.type] || <InfoIcon fontSize="small" />}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ lineHeight: 1.5, color: "#1f2937", fontWeight: 400 }}>
                            {item.message}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: statusColor,
                                flexShrink: 0,
                              }}
                              className={item.status === "pending_review" || item.status === "action_needed" ? "animate-pulse-dot" : undefined}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                              {item.time}
                            </Typography>
                            <Chip
                              label={item.status.replace(/_/g, " ")}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                bgcolor: `${statusColor}14`,
                                color: statusColor,
                                border: "none",
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                      {idx < activityFeed.length - 1 && <Divider sx={{ ml: 7 }} />}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
