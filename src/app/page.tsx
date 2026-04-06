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
}

const kpiCards: KpiCardConfig[] = [
  { label: "Organic Traffic", key: "organicTraffic", icon: <TrendingUpIcon />, color: "#274e64", bgColor: "#e8f0f4" },
  { label: "Keywords Tracked", key: "keywordRankings", icon: <TrackChangesIcon />, color: "#ed1b2f", bgColor: "#fdebed" },
  { label: "Content in Pipeline", key: "contentPieces", icon: <AssignmentIcon />, color: "#34a853", bgColor: "#e6f4ea" },
  { label: "Avg. SERP Position", key: "avgPosition", icon: <BarChartIcon />, color: "#fbbc04", bgColor: "#fef7e0" },
  { label: "Click-Through Rate", key: "clickThroughRate", icon: <AdsClickIcon />, color: "#4285f4", bgColor: "#e8f0fe" },
  { label: "Planned Items", key: "pipelineItems", icon: <PendingActionsIcon />, color: "#9334e6", bgColor: "#f3e8fd" },
];

/* ── page ── */

export default function MissionControl() {
  const pipelineTotal = useMemo(
    () => contentPipelineData.reduce((sum, d) => sum + d.count, 0),
    []
  );

  return (
    <Box>
      {/* ── Hero Header ── */}
      <Box className="animate-fade-in-up" sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 4,
                  height: 32,
                  borderRadius: 4,
                  background: "linear-gradient(180deg, #ed1b2f 0%, #274e64 100%)",
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  color: "#1f1f1f",
                  letterSpacing: "-0.025em",
                  fontSize: { xs: "1.75rem", md: "2rem" },
                }}
              >
                Mission Control
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "#5f6368", ml: 2.5, fontSize: "0.95rem" }}>
              Real-time overview of your digital growth pipeline
            </Typography>
          </Box>
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
        </Box>
      </Box>

      {/* ── KPI Grid ── */}
      <Grid container spacing={2} className="stagger-children" sx={{ mb: 4 }}>
        {kpiCards.map((kpi) => {
          const data = kpiData[kpi.key];
          const hasData = data.value !== null;

          return (
            <Grid key={kpi.key} size={{ xs: 6, sm: 4, md: 2 }}>
              <Card
                className="hover-lift accent-top"
                sx={{
                  height: "100%",
                  border: "1px solid #ececec",
                  borderRadius: 4,
                  position: "relative",
                  cursor: "pointer",
                  bgcolor: "#ffffff",
                }}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  {/* Icon badge */}
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 3,
                      bgcolor: kpi.bgColor,
                      color: kpi.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                      "& .MuiSvgIcon-root": { fontSize: 22 },
                    }}
                  >
                    {kpi.icon}
                  </Box>

                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: "#5f6368",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      mb: 0.75,
                    }}
                  >
                    {kpi.label}
                  </Typography>

                  {hasData ? (
                    <Typography
                      sx={{
                        fontSize: "1.75rem",
                        fontWeight: 600,
                        color: "#1f1f1f",
                        lineHeight: 1.1,
                        letterSpacing: "-0.02em",
                        mb: 0.5,
                      }}
                    >
                      {data.value}
                    </Typography>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: "1.75rem",
                        fontWeight: 400,
                        color: "#dadce0",
                        lineHeight: 1.1,
                        mb: 0.5,
                      }}
                    >
                      —
                    </Typography>
                  )}

                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      color: "#5f6368",
                      lineHeight: 1.4,
                      fontWeight: 400,
                    }}
                  >
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
        className="animate-fade-in-up"
        sx={{
          mb: 4,
          borderRadius: 4,
          border: "none",
          background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 60%, #325f78 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative accent */}
        <Box
          sx={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(237,27,47,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -80,
            left: "30%",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <CardContent
          sx={{
            p: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 3,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 4,
                bgcolor: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <AutoAwesomeIcon sx={{ color: "#fff", fontSize: 28 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: "#fff",
                  mb: 0.5,
                  letterSpacing: "-0.01em",
                }}
              >
                Connect your data sources to unlock full analytics
              </Typography>
              <Typography sx={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.8)", maxWidth: 600 }}>
                Link GA4 and Google Search Console to see organic traffic, keyword rankings, CTR and SERP positions in real-time.
              </Typography>
            </Box>
          </Box>
          <Button
            component={Link}
            href="/settings"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: "#ed1b2f",
              color: "#fff",
              px: 3,
              py: 1.25,
              fontWeight: 600,
              fontSize: "0.875rem",
              "&:hover": { bgcolor: "#d80901" },
              whiteSpace: "nowrap",
            }}
          >
            Configure Integrations
          </Button>
        </CardContent>
      </Card>

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
                              className={item.status === "pending_review" || item.status === "action_needed" ? "animate-pulse-dot" : undefined}
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
