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
import InfoIcon from "@mui/icons-material/Info";
import SettingsIcon from "@mui/icons-material/Settings";
import LinkIcon from "@mui/icons-material/Link";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import BarChartIcon from "@mui/icons-material/BarChart";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Link from "next/link";
import PageHeader from "./PageHeader";

import {
  kpiData,
  contentPipelineData,
  activityFeed,
} from "@/lib/mockData";

/* ── helpers ── */

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const statusColorMap: Record<string, string> = {
  positive: "#34a853",
  approved: "#34a853",
  published: "#274e64",
  pending_review: "#fbbc04",
  action_needed: "#ed1b2f",
  rejected: "#ea4335",
  info: "#4285f4",
};

const typeIconMap: Record<string, React.ReactNode> = {
  content: <ArticleIcon fontSize="small" />,
  seo: <SearchIcon fontSize="small" />,
  approval: <CheckCircleIcon fontSize="small" />,
  system: <SettingsIcon fontSize="small" />,
};

/* ── KPI configs ── */

interface KpiCardConfig {
  label: string;
  key: keyof typeof kpiData;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  href: string;
}

const kpiCards: KpiCardConfig[] = [
  { label: "Organic Traffic", key: "organicTraffic", icon: <TrendingUpIcon />, color: "#274e64", bgColor: "#e8f0f4", href: "/analytics" },
  { label: "Keywords Tracked", key: "keywordRankings", icon: <TrackChangesIcon />, color: "#ed1b2f", bgColor: "#fdebed", href: "/seo" },
  { label: "Content in Pipeline", key: "contentPieces", icon: <AssignmentIcon />, color: "#34a853", bgColor: "#e6f4ea", href: "/calendar" },
  { label: "Avg. SERP Position", key: "avgPosition", icon: <BarChartIcon />, color: "#fbbc04", bgColor: "#fef7e0", href: "/seo" },
  { label: "Click-Through Rate", key: "clickThroughRate", icon: <AdsClickIcon />, color: "#4285f4", bgColor: "#e8f0fe", href: "/analytics" },
  { label: "Planned Items", key: "pipelineItems", icon: <PendingActionsIcon />, color: "#9334e6", bgColor: "#f3e8fd", href: "/calendar" },
  { label: "Drafts Pending", key: "draftsPending", icon: <PendingActionsIcon />, color: "#ed1b2f", bgColor: "#fdebed", href: "/studio" },
  { label: "Knowledge Docs", key: "knowledgeDocs", icon: <ArticleIcon />, color: "#274e64", bgColor: "#e8f0f4", href: "/knowledge-base" },
];

/* ── page ── */

export default function MissionControl() {
  const pipelineTotal = useMemo(
    () => contentPipelineData.reduce((sum, d) => sum + d.count, 0),
    []
  );

  return (
    <Box>
      <PageHeader
        title="Mission Control"
        subtitle="Real-time overview of your digital growth pipeline"
        rightSlot={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2.5,
              py: 1.25,
              borderRadius: 999,
              bgcolor: "#fff",
              border: "1px solid #ececec",
            }}
          >
            <CalendarTodayIcon sx={{ fontSize: 16, color: "#5f6368" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#3c4043" }}>
              {today}
            </Typography>
          </Box>
        }
      />

      {/* ── KPI Grid (redesigned: horizontal, with sparkbar) ── */}
      <Grid container spacing={2} className="stagger-children" sx={{ mb: 3 }}>
        {kpiCards.map((kpi) => {
          const data = kpiData[kpi.key];
          const hasData = data.value !== null;
          // Mock sparkline bars per card (visual interest only)
          const bars = [40, 65, 50, 80, 55, 90, 70];

          return (
            <Grid key={kpi.key} size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
              <Card
                component={Link}
                href={kpi.href}
                className="hover-lift"
                sx={{
                  height: "100%",
                  border: "1px solid #ececec",
                  borderRadius: 4,
                  position: "relative",
                  cursor: "pointer",
                  bgcolor: "#ffffff",
                  textDecoration: "none",
                  display: "block",
                  overflow: "hidden",
                  borderTop: `3px solid ${kpi.color}`,
                }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.25 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        bgcolor: kpi.bgColor,
                        color: kpi.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        "& .MuiSvgIcon-root": { fontSize: 18 },
                      }}
                    >
                      {kpi.icon}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "0.62rem",
                        color: "#5f6368",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        lineHeight: 1.2,
                      }}
                    >
                      {kpi.label}
                    </Typography>
                  </Box>

                  {hasData ? (
                    <Typography
                      sx={{
                        fontSize: "1.85rem",
                        fontWeight: 700,
                        color: "#1f1f1f",
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                        mb: 0.75,
                      }}
                    >
                      {data.value}
                    </Typography>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: "1.85rem",
                        fontWeight: 400,
                        color: "#dadce0",
                        lineHeight: 1,
                        mb: 0.75,
                      }}
                    >
                      —
                    </Typography>
                  )}

                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: "#5f6368",
                      lineHeight: 1.3,
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    {data.period}
                  </Typography>

                  {/* Mini sparkbar (decorative) */}
                  <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.4, height: 18 }}>
                    {bars.map((h, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          height: `${hasData ? h : 20}%`,
                          bgcolor: hasData ? kpi.color : "#ececec",
                          opacity: hasData ? 0.35 + (i / bars.length) * 0.65 : 0.5,
                          borderRadius: 0.5,
                        }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── New row: Approval Queue + This Week's Schedule ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Approval Queue */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            className="animate-fade-in-up hover-lift"
            sx={{ height: "100%", border: "1px solid #ececec", borderRadius: 4 }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#fbbc04" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Approval Queue
                  </Typography>
                </Box>
                <Chip
                  label="9 pending"
                  size="small"
                  sx={{ height: 22, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#fef7e0", color: "#b06000", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Drafts waiting for human review
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  { ch: "LinkedIn", chColor: "#0077b5", title: "FKM vs FFKM: choosing your o-ring for chemical resistance", time: "8 min ago" },
                  { ch: "Newsletter", chColor: "#274e64", title: "Q2 2026 — New FFKM range, expanded PEEK catalog", time: "1h ago" },
                  { ch: "Blog", chColor: "#ed1b2f", title: "O-Ring Material Selection Guide: FKM, FFKM & Silicone", time: "3h ago" },
                  { ch: "LinkedIn", chColor: "#0077b5", title: "PEEK in aerospace: the high-performance plastic explained", time: "22 min ago" },
                ].map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: 2,
                      border: "1px solid #f1f3f4",
                      transition: "all 0.2s",
                      "&:hover": { bgcolor: "#fafbfc", borderColor: "#ececec" },
                    }}
                  >
                    <Box sx={{ width: 3, height: 28, borderRadius: 2, bgcolor: item.chColor, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                        <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: item.chColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {item.ch}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "#dadce0" }} />
                        <Typography sx={{ fontSize: "0.65rem", color: "#5f6368" }}>
                          {item.time}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      component={Link}
                      href="/studio"
                      size="small"
                      sx={{
                        minWidth: 0,
                        px: 1.25,
                        py: 0.4,
                        borderRadius: 1.5,
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        bgcolor: "#34a853",
                        color: "#fff",
                        textTransform: "none",
                        "&:hover": { bgcolor: "#1e8e3e" },
                      }}
                    >
                      Review
                    </Button>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #f1f3f4", textAlign: "center" }}>
                <Button
                  component={Link}
                  href="/studio"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#274e64", textTransform: "none", "&:hover": { bgcolor: "transparent", color: "#1a3a4c" } }}
                >
                  View all 9 drafts in Content Studio
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* This Week's Schedule */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            className="animate-fade-in-up hover-lift"
            sx={{ height: "100%", border: "1px solid #ececec", borderRadius: 4 }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#4285f4" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    This Week's Schedule
                  </Typography>
                </Box>
                <Chip
                  label="7 items"
                  size="small"
                  sx={{ height: 22, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#e8f0fe", color: "#1a73e8", border: "none" }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Upcoming content scheduled for publication
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  { day: "Tue", date: "07", channel: "Blog", chColor: "#ed1b2f", title: "O-Ring Material Selection Guide", status: "Draft" },
                  { day: "Wed", date: "08", channel: "LinkedIn", chColor: "#0077b5", title: "New PEEK Machined Components Range", status: "Approved" },
                  { day: "Fri", date: "10", channel: "Blog", chColor: "#ed1b2f", title: "POM-C Acetal — Applications & Tolerances", status: "Idea" },
                  { day: "Sat", date: "11", channel: "Newsletter", chColor: "#274e64", title: "O-Rings & Plastics Q2 Update", status: "In Review" },
                ].map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.25,
                      borderRadius: 2,
                      border: "1px solid #f1f3f4",
                      transition: "all 0.2s",
                      "&:hover": { bgcolor: "#fafbfc", borderColor: "#ececec" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 1.5,
                        bgcolor: "#f8f9fa",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid #ececec",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1 }}>
                        {item.day}
                      </Typography>
                      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f1f1f", lineHeight: 1.1 }}>
                        {item.date}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                        <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: item.chColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {item.channel}
                        </Typography>
                        <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "#dadce0" }} />
                        <Typography sx={{ fontSize: "0.62rem", color: "#5f6368", fontWeight: 500 }}>
                          {item.status}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #f1f3f4", textAlign: "center" }}>
                <Button
                  component={Link}
                  href="/calendar"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#274e64", textTransform: "none", "&:hover": { bgcolor: "transparent", color: "#1a3a4c" } }}
                >
                  Open full editorial calendar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Two-column: Pipeline + Activity Feed ── */}
      <Grid container spacing={2.5}>
        {/* Content Pipeline */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            className="animate-fade-in-up hover-lift"
            sx={{
              height: "100%",
              border: "1px solid #ececec",
              borderRadius: 4,
              animationDelay: "0.1s",
              animationFillMode: "both",
            }}
          >
            <CardContent sx={{ p: 3.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
                <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                  Content Pipeline
                </Typography>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", ml: 1.75, mb: 3 }}>
                {pipelineTotal} total items across all stages
              </Typography>

              {/* Pipeline stages */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                {contentPipelineData.map((stage, idx) => (
                  <Box
                    key={stage.status}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                      animationDelay: `${0.3 + idx * 0.08}s`,
                      opacity: 0,
                    }}
                  >
                    <Box sx={{ width: 70, display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: stage.color }} />
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#3c4043" }}>
                        {stage.status}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, height: 28, bgcolor: "#f8f9fa", borderRadius: 1.5, overflow: "hidden", position: "relative" }}>
                      <Box
                        sx={{
                          height: "100%",
                          width: `${(stage.count / pipelineTotal) * 100}%`,
                          bgcolor: stage.color,
                          borderRadius: 1.5,
                          minWidth: stage.count > 0 ? 28 : 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                          animation: "barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                          animationDelay: `${0.4 + idx * 0.08}s`,
                        }}
                      >
                        <Typography sx={{ color: "#fff", fontSize: "0.75rem", fontWeight: 700 }}>
                          {stage.count}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Bottom summary bar */}
              <Box sx={{ mt: 3, pt: 2.5, borderTop: "1px solid #f1f3f4" }}>
                <Box sx={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", bgcolor: "#f1f3f4" }}>
                  {contentPipelineData.map((item) => (
                    <Box
                      key={item.status}
                      sx={{
                        width: `${(item.count / pipelineTotal) * 100}%`,
                        bgcolor: item.color,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card
            className="animate-fade-in-up hover-lift"
            sx={{
              height: "100%",
              border: "1px solid #ececec",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              animationDelay: "0.2s",
              animationFillMode: "both",
            }}
          >
            <CardContent sx={{ p: 3.5, flex: 1, display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#ed1b2f" }} />
                  <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                    Activity Feed
                  </Typography>
                </Box>
                <Chip
                  label="Live"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    bgcolor: "#e6f4ea",
                    color: "#1e8e3e",
                    border: "none",
                    "& .MuiChip-label": { px: 1.25 },
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", ml: 1.75, mb: 2 }}>
                Latest updates across your content operations
              </Typography>

              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: 460,
                  pr: 1,
                  ml: -0.5,
                }}
              >
                {activityFeed.map((item, idx) => {
                  const statusColor = statusColorMap[item.status] || "#5f6368";
                  return (
                    <Box
                      key={item.id}
                      sx={{
                        animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                        animationDelay: `${0.3 + idx * 0.06}s`,
                        opacity: 0,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          gap: 2,
                          py: 1.75,
                          px: 1.5,
                          borderRadius: 2,
                          transition: "background-color 0.2s ease",
                          "&:hover": { bgcolor: "#f8f9fa" },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: `${statusColor}1a`,
                            color: statusColor,
                            flexShrink: 0,
                            mt: 0.25,
                            border: `1px solid ${statusColor}33`,
                          }}
                        >
                          {typeIconMap[item.type] || <InfoIcon fontSize="small" />}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.5, color: "#1f1f1f", fontWeight: 400 }}>
                            {item.message}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
                            <Box
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: statusColor,
                                flexShrink: 0,
                              }}
                              className={item.status === "pending_review" ? "animate-pulse-dot" : undefined}
                            />
                            <Typography sx={{ fontSize: "0.7rem", color: "#5f6368", fontWeight: 500 }}>
                              {item.time}
                            </Typography>
                            <Typography sx={{ fontSize: "0.7rem", color: "#dadce0" }}>·</Typography>
                            <Typography
                              sx={{
                                fontSize: "0.7rem",
                                fontWeight: 500,
                                color: statusColor,
                                textTransform: "capitalize",
                              }}
                            >
                              {item.status.replace(/_/g, " ")}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      {idx < activityFeed.length - 1 && <Divider sx={{ ml: 7, borderColor: "#f1f3f4" }} />}
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
