"use client";
import PageHeader from "@/app/PageHeader";

import { useState, useMemo } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Add from "@mui/icons-material/Add";
import FiberManualRecord from "@mui/icons-material/FiberManualRecord";
import EditIcon from "@mui/icons-material/Edit";
import LaunchIcon from "@mui/icons-material/Launch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Link from "next/link";
import { contentCalendarItems, contentProposals } from "@/lib/mockData";

type CalendarItem = (typeof contentCalendarItems)[number];

// ── Constants ──────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  Blog: "#274e64",
  LinkedIn: "#0077b5",
  Newsletter: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  idea: "#9e9e9e",
  brief: "#9c27b0",
  draft: "#f59e0b",
  in_review: "#2196f3",
  approved: "#4caf50",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  brief: "Brief",
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#9e9e9e",
};

const FILTERS = ["All", "Blog", "LinkedIn", "Newsletter"] as const;
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ────────────────────────────────────────────────

/** Build the 6-row grid of day numbers for April 2026 (starts on Wednesday). */
function buildAprilGrid(): (number | null)[][] {
  const firstDayOfWeek = 2; // April 1 2026 = Wednesday (0=Mon ... 6=Sun)
  const daysInMonth = 30;
  const cells: (number | null)[] = [];

  // Leading blanks
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Trailing blanks
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

// ── Component ──────────────────────────────────────────────

export default function ContentCalendarPage() {
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  const selectedProposal = useMemo(() => {
    if (!selectedItem?.proposalId) return null;
    return contentProposals.find((p) => p.id === selectedItem.proposalId) ?? null;
  }, [selectedItem]);

  const calendarGrid = useMemo(() => buildAprilGrid(), []);

  const filteredItems = useMemo(
    () =>
      activeFilter === "All"
        ? contentCalendarItems
        : contentCalendarItems.filter((it) => it.channel === activeFilter),
    [activeFilter],
  );

  /** Map day-of-month -> items for quick lookup */
  const itemsByDay = useMemo(() => {
    const map: Record<number, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      const day = parseInt(item.date.split("-")[2], 10);
      if (!map[day]) map[day] = [];
      map[day].push(item);
    });
    return map;
  }, [filteredItems]);

  const sortedUpcoming = useMemo(
    () => [...filteredItems].sort((a, b) => a.date.localeCompare(b.date)),
    [filteredItems],
  );

  // Stats
  const totalPlanned = contentCalendarItems.length;
  const draftCount = contentCalendarItems.filter((i) => i.status === "draft").length;
  const reviewCount = contentCalendarItems.filter((i) => i.status === "in_review").length;
  const approvedCount = contentCalendarItems.filter((i) => i.status === "approved").length;

  const TODAY = 4; // April 4 2026

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "calc(100vh - 48px)" }}>
      {/* ── Header ──────────────────────────────────────── */}
      <Box>
        <PageHeader
          title="Content Calendar"
          subtitle="Plan, schedule & manage content across all channels"
        />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              label={f}
              onClick={() => setActiveFilter(f)}
              variant={activeFilter === f ? "filled" : "outlined"}
              color={activeFilter === f ? "primary" : "default"}
              sx={{
                fontWeight: activeFilter === f ? 700 : 400,
                cursor: "pointer",
              }}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<Add />} size="small">
            Add Topic
          </Button>
        </Box>
      </Box>

      {/* ── Main body: calendar + side panel ─────────── */}
      <Box sx={{ display: "flex", gap: 2, flex: 1, minHeight: 0 }}>
        {/* ── Calendar Area ──────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Month navigation */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1,
            }}
          >
            <IconButton size="small">
              <ChevronLeft />
            </IconButton>
            <Typography variant="h6" fontWeight={600} sx={{ mx: 2 }}>
              April 2026
            </Typography>
            <IconButton size="small">
              <ChevronRight />
            </IconButton>
          </Box>

          {/* Day headers */}
          <Grid container columns={7} spacing={0.5} sx={{ mb: 0.5 }}>
            {DAY_HEADERS.map((d) => (
              <Grid key={d} size={1}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ textAlign: "center", display: "block", py: 0.5 }}
                >
                  {d}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar grid */}
          {calendarGrid.map((week, wi) => (
            <Grid container columns={7} spacing={0.5} key={wi} sx={{ mb: 0.5 }}>
              {week.map((day, di) => (
                <Grid key={di} size={1}>
                  <Paper
                    variant="outlined"
                    sx={{
                      minHeight: 90,
                      p: 0.75,
                      borderRadius: 2,
                      bgcolor: day === TODAY ? "rgba(39,78,100,0.07)" : day ? "#fff" : "transparent",
                      border: day === TODAY ? "2px solid #274e64" : day ? "1px solid #e0e0e0" : "none",
                      transition: "box-shadow 0.15s, transform 0.15s",
                      cursor: day ? "pointer" : "default",
                      "&:hover": day
                        ? {
                            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                            transform: "translateY(-1px)",
                          }
                        : {},
                    }}
                  >
                    {day !== null && (
                      <>
                        <Typography
                          variant="caption"
                          fontWeight={day === TODAY ? 800 : 600}
                          sx={{
                            color: day === TODAY ? "#274e64" : "text.primary",
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          {day}
                        </Typography>

                        {(itemsByDay[day] || []).map((item) => (
                          <Box
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.4,
                              mb: 0.4,
                              px: 0.6,
                              py: 0.25,
                              borderRadius: 1,
                              bgcolor: CHANNEL_COLORS[item.channel] + "18",
                              overflow: "hidden",
                              cursor: "pointer",
                              transition: "all 0.15s",
                              "&:hover": { bgcolor: CHANNEL_COLORS[item.channel] + "33" },
                            }}
                          >
                            <FiberManualRecord
                              sx={{
                                fontSize: 8,
                                color: STATUS_COLORS[item.status],
                                flexShrink: 0,
                              }}
                            />
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{
                                fontSize: "0.65rem",
                                lineHeight: 1.3,
                                fontWeight: 600,
                                color: CHANNEL_COLORS[item.channel],
                              }}
                            >
                              {item.title}
                            </Typography>
                          </Box>
                        ))}
                      </>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          ))}
        </Box>

        {/* ── Side Panel ─────────────────────────────── */}
        <Card
          variant="outlined"
          sx={{
            width: 350,
            flexShrink: 0,
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ flex: 1, overflow: "hidden", pb: 0, display: "flex", flexDirection: "column" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Upcoming Items
            </Typography>

            <Box sx={{ flex: 1, overflowY: "auto", maxHeight: 7 * 92, pr: 1 }}>
            {sortedUpcoming.map((item, idx) => {
              const dateObj = new Date(item.date + "T00:00:00");
              const dateLabel = dateObj.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });
              return (
                <Box
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1.5,
                    px: 0.75,
                    mx: -0.75,
                    py: 0.5,
                    transition: "background-color 0.15s",
                    "&:hover": { bgcolor: "#f8f9fa" },
                  }}
                >
                  {idx > 0 && <Divider sx={{ my: 1 }} />}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <FiberManualRecord
                      sx={{
                        fontSize: 10,
                        mt: 0.7,
                        color: PRIORITY_COLORS[item.priority],
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {item.title}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        {dateLabel}
                      </Typography>

                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        <Chip
                          label={item.channel}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            bgcolor: CHANNEL_COLORS[item.channel],
                            color: "#fff",
                          }}
                        />
                        <Chip
                          label={STATUS_LABELS[item.status]}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            bgcolor: STATUS_COLORS[item.status] + "22",
                            color: STATUS_COLORS[item.status],
                            border: `1px solid ${STATUS_COLORS[item.status]}44`,
                          }}
                        />
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                        <Avatar sx={{ width: 18, height: 18, fontSize: "0.6rem", bgcolor: "#274e64" }}>
                          {item.assignee.charAt(0)}
                        </Avatar>
                        <Typography variant="caption" color="text.secondary">
                          {item.assignee}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
            </Box>
          </CardContent>

          <Box sx={{ p: 2, pt: 1 }}>
            <Button variant="outlined" color="secondary" fullWidth startIcon={<Add />}>
              Inject Topic
            </Button>
          </Box>
        </Card>
      </Box>

      {/* ── Item Detail Modal ── */}
      <Dialog
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        {selectedItem && (() => {
          const dateObj = new Date(selectedItem.date + "T00:00:00");
          const dateLabel = dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const isIdea = !selectedProposal;
          return (
            <>
              <DialogTitle sx={{ pb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
                  <Chip
                    label={selectedItem.channel}
                    size="small"
                    sx={{ height: 22, fontSize: "0.65rem", fontWeight: 700, bgcolor: CHANNEL_COLORS[selectedItem.channel], color: "#fff" }}
                  />
                  <Chip
                    label={STATUS_LABELS[selectedItem.status]}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      bgcolor: STATUS_COLORS[selectedItem.status] + "22",
                      color: STATUS_COLORS[selectedItem.status],
                      border: `1px solid ${STATUS_COLORS[selectedItem.status]}44`,
                    }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: "0.72rem", color: "#5f6368", fontWeight: 600 }}>
                    {dateLabel}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: "1.2rem", fontWeight: 600, color: "#1f1f1f", lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                  {selectedItem.title}
                </Typography>
              </DialogTitle>
              <Divider />
              <DialogContent sx={{ pt: 2.5 }}>
                {isIdea ? (
                  <Box sx={{ textAlign: "center", py: 3 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        bgcolor: "#fef7e0",
                        color: "#fbbc04",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 1.5,
                      }}
                    >
                      <EditIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#1f1f1f", mb: 0.5 }}>
                      No draft yet
                    </Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: "#5f6368", mb: 2.5 }}>
                      This topic is still an idea. Generate it in Content Studio to start drafting.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75 }}>
                      Draft preview
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: "#fafbfc",
                        border: "1px solid #ececec",
                        borderRadius: 2,
                        p: 2,
                        maxHeight: 280,
                        overflowY: "auto",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.78rem", lineHeight: 1.6, color: "#3c4043", whiteSpace: "pre-line" }}>
                        {selectedProposal.text}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 2, alignItems: "center" }}>
                      <Avatar sx={{ width: 22, height: 22, fontSize: "0.65rem", bgcolor: "#274e64" }}>
                        {selectedItem.assignee.charAt(0)}
                      </Avatar>
                      <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", fontWeight: 500 }}>
                        Assigned to {selectedItem.assignee}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
                        Quality score: <strong>{selectedProposal.qualityScore}/100</strong>
                      </Typography>
                    </Box>
                  </>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 2.5, pt: 1.5, gap: 1 }}>
                <Button
                  onClick={() => setSelectedItem(null)}
                  sx={{ borderRadius: 999, textTransform: "none", fontWeight: 600, color: "#5f6368", "&:hover": { bgcolor: "#f1f3f4" } }}
                >
                  Close
                </Button>
                <Button
                  component={Link}
                  href="/studio"
                  variant="contained"
                  startIcon={isIdea ? <Add /> : <LaunchIcon />}
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    bgcolor: isIdea ? "#ed1b2f" : "#274e64",
                    boxShadow: "none",
                    "&:hover": { bgcolor: isIdea ? "#d80901" : "#1a3a4c", boxShadow: "none" },
                  }}
                >
                  {isIdea ? "Create in Content Studio" : "Open in Content Studio"}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* ── Bottom Stats Bar ─────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          py: 1.5,
          px: 2,
          borderRadius: 3,
        }}
      >
        {[
          { label: "Total Planned", value: totalPlanned, color: "#274e64" },
          { label: "Draft", value: draftCount, color: "#f59e0b" },
          { label: "In Review", value: reviewCount, color: "#2196f3" },
          { label: "Approved", value: approvedCount, color: "#4caf50" },
        ].map((stat) => (
          <Box key={stat.label} sx={{ textAlign: "center" }}>
            <Typography variant="h5" fontWeight={800} sx={{ color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
