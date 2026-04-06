"use client";
import PageHeader from "@/app/PageHeader";

import { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Cancel from "@mui/icons-material/Cancel";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Edit from "@mui/icons-material/Edit";
import Shield from "@mui/icons-material/Shield";
import Schedule from "@mui/icons-material/Schedule";
import ThumbUp from "@mui/icons-material/ThumbUp";
import ThumbDown from "@mui/icons-material/ThumbDown";
import Lightbulb from "@mui/icons-material/Lightbulb";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

import { studioContentBriefs } from "@/lib/mockData";

const workflowSteps = [
  { label: "Topic Selection", gate: false },
  { label: "Brief Approval", gate: true },
  { label: "Content Generation", gate: false },
  { label: "Content Review", gate: true },
  { label: "Publish", gate: false },
];

const statusColor: Record<string, "warning" | "success" | "info"> = {
  pending_approval: "warning",
  approved: "success",
  generating: "info",
};

const statusLabel: Record<string, string> = {
  pending_approval: "Pending Approval",
  approved: "Approved",
  generating: "Generating",
};

export default function ContentStudioPage() {
  const [selectedBrief, setSelectedBrief] = useState<string>(
    studioContentBriefs[0]?.id ?? ""
  );
  const [expandedReasoning, setExpandedReasoning] = useState<
    Record<string, boolean>
  >({ "brief-1": true });

  const toggleReasoning = (id: string) =>
    setExpandedReasoning((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <PageHeader
        title="Content Studio"
        subtitle="AI-powered content generation with mandatory human approval gates"
        badge="AI"
      />

      {/* ── Approval Workflow Stepper ────────────────────────── */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`,
        }}
      >
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 1 }}
        >
          Approval Workflow
        </Typography>
        <Stepper activeStep={2} alternativeLabel>
          {workflowSteps.map((step) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="caption" fontWeight={600}>
                  {step.label}
                </Typography>
                {step.gate && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      mt: 0.5,
                    }}
                  >
                    <Chip
                      icon={<Shield sx={{ fontSize: 12 }} />}
                      label="Human Gate"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                    />
                  </Box>
                )}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>

      {/* ── Main Layout: Briefs + Preview ───────────────────── */}
      <Grid container spacing={3}>
        {/* ── Content Briefs Panel ──────────────────────────── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Content Briefs
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {studioContentBriefs.map((brief) => {
              const isSelected = brief.id === selectedBrief;
              const isGenerating = brief.status === "generating";

              return (
                <Card
                  key={brief.id}
                  variant="outlined"
                  sx={{
                    cursor: "pointer",
                    borderColor: isSelected ? "primary.main" : "divider",
                    borderWidth: isSelected ? 2 : 1,
                    boxShadow: isSelected ? 4 : 0,
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "primary.light" },
                  }}
                  onClick={() => setSelectedBrief(brief.id)}
                >
                  <CardContent sx={{ pb: "16px !important" }}>
                    {/* Title row */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={700}>
                        {brief.title}
                      </Typography>

                      {/* Score badge */}
                      <Box
                        sx={{
                          position: "relative",
                          display: "inline-flex",
                          flexShrink: 0,
                        }}
                      >
                        <CircularProgress
                          variant="determinate"
                          value={brief.score}
                          size={48}
                          thickness={4}
                          color={
                            brief.score >= 85
                              ? "success"
                              : brief.score >= 70
                                ? "warning"
                                : "error"
                          }
                        />
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            lineHeight={1}
                          >
                            {brief.score}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Chips row */}
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1,
                        mb: 1.5,
                      }}
                    >
                      <Chip
                        label={brief.keyword}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        label={statusLabel[brief.status]}
                        size="small"
                        color={statusColor[brief.status]}
                        sx={{
                          fontWeight: 700,
                          ...(isGenerating && {
                            animation: "pulse 1.5s ease-in-out infinite",
                            "@keyframes pulse": {
                              "0%, 100%": { opacity: 1 },
                              "50%": { opacity: 0.5 },
                            },
                          }),
                        }}
                      />
                      <Chip
                        label={brief.channel}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                      <Chip
                        label={`${brief.wordCount.toLocaleString()} words`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    {/* AI Reasoning (expandable) */}
                    <Box
                      sx={{
                        mb: 1.5,
                        backgroundColor: "action.hover",
                        borderRadius: 1,
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 1.5,
                          py: 0.75,
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReasoning(brief.id);
                        }}
                      >
                        <Lightbulb
                          sx={{ fontSize: 16, color: "warning.main" }}
                        />
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          color="text.secondary"
                        >
                          AI Reasoning
                        </Typography>
                        <Box sx={{ ml: "auto" }}>
                          <IconButton size="small" sx={{ p: 0 }}>
                            {expandedReasoning[brief.id] ? (
                              <ExpandLess sx={{ fontSize: 18 }} />
                            ) : (
                              <ExpandMore sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </Box>
                      </Box>
                      <Collapse in={expandedReasoning[brief.id]}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ px: 1.5, pb: 1.5, lineHeight: 1.6 }}
                        >
                          {brief.reasoning}
                        </Typography>
                      </Collapse>
                    </Box>

                    {/* Generating progress bar */}
                    {isGenerating && (
                      <LinearProgress
                        sx={{ mb: 1.5, borderRadius: 1, height: 6 }}
                      />
                    )}

                    {/* Action buttons */}
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                      }}
                    >
                      {brief.status === "pending_approval" && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<ThumbUp sx={{ fontSize: 16 }} />}
                          >
                            Approve Topic
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<ThumbDown sx={{ fontSize: 16 }} />}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {brief.status === "approved" && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}
                        >
                          Generate Content
                        </Button>
                      )}
                      {brief.status === "generating" && (
                        <Button
                          size="small"
                          variant="contained"
                          disabled
                          startIcon={
                            <CircularProgress size={14} color="inherit" />
                          }
                        >
                          Generating...
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Grid>

        {/* ── Content Preview Panel ─────────────────────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Content Preview
          </Typography>

          <Card
            variant="outlined"
            sx={{
              position: "sticky",
              top: 24,
              borderColor: "primary.light",
            }}
          >
            <CardContent>
              {/* Article header */}
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                O-Ring Material Selection for High-Temperature Applications
              </Typography>
              <Chip
                label="Draft Preview"
                size="small"
                color="info"
                variant="outlined"
                sx={{ mb: 2, fontWeight: 600 }}
              />

              <Divider sx={{ mb: 2 }} />

              {/* Article body */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5, lineHeight: 1.7 }}
              >
                Selecting the right o-ring material for high-temperature
                environments is critical to ensuring seal integrity and
                preventing costly equipment failures. Applications in
                automotive, aerospace, and industrial processing regularly
                expose seals to sustained temperatures above 200 &#176;C, where
                standard elastomers lose their mechanical properties.
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5, lineHeight: 1.7 }}
              >
                Fluoroelastomers (FKM) remain the most popular choice for
                continuous service up to 200 &#176;C, offering excellent
                chemical resistance alongside thermal stability. For even more
                demanding conditions, perfluoroelastomers (FFKM) extend the
                operating window to 320 &#176;C while maintaining near-universal
                chemical compatibility.
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5, lineHeight: 1.7 }}
              >
                When evaluating materials, engineers should consider compression
                set resistance, thermal aging behaviour, and media
                compatibility. APSOparts&apos; sealing specialists can
                provide application-specific recommendations based on your exact
                pressure, temperature, and media requirements.
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, lineHeight: 1.7 }}
              >
                Our high-temperature sealing portfolio includes compounds
                tailored for static and dynamic applications. Contact our
                engineering team to discuss your requirements or request sample
                materials for your own testing protocol.
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {/* Brand tone indicator */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 2,
                }}
              >
                <Typography variant="caption" fontWeight={700}>
                  Brand Tone:
                </Typography>
                <Chip
                  label="Professional / Technical"
                  size="small"
                  color="success"
                  icon={<CheckCircle sx={{ fontSize: 14 }} />}
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              {/* Quality checks */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.75,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1,
                  backgroundColor: "action.hover",
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ mb: 0.25 }}
                >
                  Quality Checks
                </Typography>
                {[
                  "Readability",
                  "Brand Tone",
                  "Technical Accuracy",
                  "SEO Optimized",
                ].map((check) => (
                  <Box
                    key={check}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                    }}
                  >
                    <CheckCircle
                      sx={{ fontSize: 16, color: "success.main" }}
                    />
                    <Typography variant="body2">{check}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Action buttons */}
              <Box
                sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Edit sx={{ fontSize: 16 }} />}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<Cancel sx={{ fontSize: 16 }} />}
                >
                  Request Changes
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<Schedule sx={{ fontSize: 16 }} />}
                >
                  Approve &amp; Schedule
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Bottom Bar ──────────────────────────────────────── */}
      <Alert
        severity="info"
        icon={<Shield />}
        sx={{
          mt: 3,
          fontWeight: 600,
          borderRadius: 2,
          "& .MuiAlert-message": { width: "100%" },
        }}
      >
        All content requires human approval before publication. Draft-only mode
        is enabled.
      </Alert>
    </>
  );
}
