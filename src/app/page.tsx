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
import Button from "@mui/material/Button";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArticleIcon from "@mui/icons-material/Article";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import SettingsIcon from "@mui/icons-material/Settings";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import LinkIcon from "@mui/icons-material/Link";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import BarChartIcon from "@mui/icons-material/BarChart";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import Link from "next/link";

import {
  kpiData,
  contentPipelineData,
  activityFeed,
} from "@/lib/mockData";

/* ── helpers ── */

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const statusColorMap: Record<string, string> = {
  positive: "#10b981",
  approved: "#10b981",
  published: "#274e64",
  pending_review: "#f59e0b",
  action_needed: "#ed1b2f",
  rejected: "#ef4444",
  info: "#3b82f6",
};

const typeIconMap: Record<string, React.ReactNode> = {
  content: <ArticleIcon fontSize="small" />,
  seo: <SearchIcon fontSize="small" />,
  approval: <CheckCircleIcon fontSize="small" />,
  system: <SettingsIcon fontSize="small" />,
};

/* ── KPI card configs ── */

interface KpiCardConfig {
  label: string;
  key: keyof typeof kpiData;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const kpiCards: KpiCardConfig[] = [
  { label: "Organic Traffic", key: "organicTraffic", icon: <TrendingUpIcon />, color: "#274e64", bgColor: "#e8f0f4" },
  { label: "Keywords Tracked", key: "keywordRankings", icon: <TrackChangesIcon />, color: "#8b5cf6", bgColor: "#f3f0ff" },
  { label: "Content in Pipeline", key: "contentPieces", icon: <AssignmentIcon />, color: "#10b981", bgColor: "#ecfdf5" },
  { label: "Avg. SERP Position", key: "avgPosition", icon: <BarChartIcon />, color: "#f59e0b", bgColor: "#fffbeb" },
  { label: "Click-Through Rate", key: "clickThroughRate", icon: <AdsClickIcon />, color: "#3b82f6", bgColor: "#eff6ff" },
  { label: "Planned Items", key: "pipelineItems", icon: <PendingActionsIcon />, color: "#ed1b2f", bgColor: "#fef2f2" },
];

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
        {kpiCards.map((kpi) => {
          const data = kpiData[kpi.key];
          const hasData = data.value !== null;

          return (
            <Grid key={kpi.key} size={{ xs: 6, sm: 4, md: 2 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderColor: "#e5e7eb",
                  position: "relative",
                  overflow: "visible",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                  "&:hover": {
                    borderColor: kpi.color,
                    boxShadow: `0 4px 16px ${kpi.color}15`,
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  {/* Icon badge */}
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      bgcolor: kpi.bgColor,
                      color: kpi.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 1.5,
                      "& .MuiSvgIcon-root": { fontSize: 20 },
                    }}
                  >
                    {kpi.icon}
                  </Box>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={500}
                    sx={{ textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}
                  >
                    {kpi.label}
                  </Typography>

                  {hasData ? (
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, mb: 0.5, color: "#050505", lineHeight: 1.1 }}>
                      {data.value}
                    </Typography>
                  ) : (
                    <Box sx={{ mt: 0.5, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600, fontSize: "1.1rem" }}>
                        —
                      </Typography>
                    </Box>
                  )}

                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.65rem", lineHeight: 1.3 }}>
                    {data.period}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Connect Data Banner ── */}
      <Card
        variant="outlined"
        className="animate-fade-in-up"
        sx={{ mb: 4, borderColor: "#274e64", bgcolor: "#f8fafb" }}
      >
        <CardContent sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 3,
                bgcolor: "#e8f0f4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <VisibilityIcon sx={{ color: "#274e64", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#050505" }}>
                Connect your data sources to unlock full analytics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Link GA4 and Google Search Console to see organic traffic, keyword rankings, CTR and SERP positions in real-time.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            component={Link}
            href="/settings"
            sx={{ bgcolor: "#274e64", "&:hover": { bgcolor: "#325f78" }, whiteSpace: "nowrap" }}
          >
            Configure Integrations
          </Button>
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

              {/* Visual pipeline stages */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
                {contentPipelineData.map((stage) => (
                  <Box key={stage.status} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography variant="caption" sx={{ width: 65, fontWeight: 600, color: "text.secondary", fontSize: "0.7rem" }}>
                      {stage.status}
                    </Typography>
                    <Box sx={{ flex: 1, height: 24, bgcolor: "#f3f4f6", borderRadius: 1.5, overflow: "hidden", position: "relative" }}>
                      <Box
                        sx={{
                          height: "100%",
                          width: `${(stage.count / pipelineTotal) * 100}%`,
                          bgcolor: stage.color,
                          borderRadius: 1.5,
                          transition: "width 0.6s ease",
                          minWidth: stage.count > 0 ? 24 : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Typography sx={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700 }}>
                          {stage.count}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Horizontal stacked bar */}
              <Box sx={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
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
                Latest updates across your content operations
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: 420,
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
