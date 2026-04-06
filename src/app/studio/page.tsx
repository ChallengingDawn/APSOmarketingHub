"use client";

import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import EmailIcon from "@mui/icons-material/Email";
import ArticleIcon from "@mui/icons-material/Article";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ImageIcon from "@mui/icons-material/Image";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShieldIcon from "@mui/icons-material/Shield";
import PageHeader from "@/app/PageHeader";
import ProposalVisual from "./ProposalVisual";

import { contentProposals, type ContentChannel, type ContentProposal } from "@/lib/mockData";

/* ── Constants ── */

const CHANNELS: { id: ContentChannel; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "LinkedIn", label: "LinkedIn", icon: <LinkedInIcon />, color: "#0077b5" },
  { id: "Newsletter", label: "Newsletter", icon: <EmailIcon />, color: "#274e64" },
  { id: "Blog", label: "Blog", icon: <ArticleIcon />, color: "#ed1b2f" },
];

const WORKFLOW_STEPS = [
  { label: "Topic Selection", gate: false },
  { label: "Brief Approval", gate: true },
  { label: "Content Generation", gate: false },
  { label: "Content Review", gate: true },
  { label: "Publish", gate: false },
];

type ImageMode = "stock" | "ai" | "text";

interface ProposalState {
  status: "pending" | "approved" | "rejected" | "scheduled";
  imageMode: ImageMode;
  editing: boolean;
  draftText: string;
}

/* ── Page ── */

export default function ContentStudioPage() {
  const [activeChannel, setActiveChannel] = useState<ContentChannel>("LinkedIn");
  const [snack, setSnack] = useState<string | null>(null);

  // Initialize state map for all proposals
  const [states, setStates] = useState<Record<string, ProposalState>>(() => {
    const initial: Record<string, ProposalState> = {};
    contentProposals.forEach((p) => {
      initial[p.id] = {
        status: "pending",
        imageMode: "stock",
        editing: false,
        draftText: p.text,
      };
    });
    return initial;
  });

  const filteredProposals = useMemo(
    () => contentProposals.filter((p) => p.channel === activeChannel),
    [activeChannel]
  );

  const updateState = (id: string, patch: Partial<ProposalState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleApprove = (p: ContentProposal) => {
    updateState(p.id, { status: "approved" });
    setSnack(`Approved: ${p.title}`);
  };

  const handleReject = (p: ContentProposal) => {
    updateState(p.id, { status: "rejected" });
    setSnack(`Rejected: ${p.title}`);
  };

  const handleSchedule = (p: ContentProposal) => {
    updateState(p.id, { status: "scheduled" });
    setSnack(`Scheduled: ${p.title}`);
  };

  const toggleEdit = (p: ContentProposal) => {
    updateState(p.id, { editing: !states[p.id].editing });
  };

  const channelMeta = CHANNELS.find((c) => c.id === activeChannel)!;

  return (
    <Box>
      <PageHeader
        title="Content Studio"
        subtitle="AI-powered content generation with mandatory human approval gates"
        badge="AI"
      />

      {/* ── Channel Tabs ── */}
      <Box
        className="animate-fade-in-up"
        sx={{
          display: "flex",
          gap: 1,
          mb: 3,
          p: 0.75,
          bgcolor: "#fff",
          border: "1px solid #ececec",
          borderRadius: 999,
          width: "fit-content",
        }}
      >
        {CHANNELS.map((c) => {
          const active = c.id === activeChannel;
          return (
            <Button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              startIcon={c.icon}
              disableRipple
              sx={{
                px: 3,
                py: 1.25,
                borderRadius: 999,
                fontWeight: 600,
                fontSize: "0.875rem",
                bgcolor: active ? c.color : "transparent",
                color: active ? "#fff" : "#5f6368",
                "&:hover": {
                  bgcolor: active ? c.color : "#f1f3f4",
                  color: active ? "#fff" : "#1f1f1f",
                },
                transition: "all 0.25s ease",
              }}
            >
              {c.label}
              <Chip
                label="5"
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  bgcolor: active ? "rgba(255,255,255,0.25)" : "#f1f3f4",
                  color: active ? "#fff" : "#5f6368",
                }}
              />
            </Button>
          );
        })}
      </Box>

      {/* ── Proposals List ── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mb: 5 }} className="stagger-children">
        {filteredProposals.map((proposal) => {
          const state = states[proposal.id];
          const isApproved = state.status === "approved";
          const isRejected = state.status === "rejected";
          const isScheduled = state.status === "scheduled";

          const statusColor =
            isApproved ? "#34a853" :
            isRejected ? "#ea4335" :
            isScheduled ? "#4285f4" :
            "#fbbc04";
          const statusLabel =
            isApproved ? "Approved" :
            isRejected ? "Rejected" :
            isScheduled ? "Scheduled" :
            "Pending Review";

          return (
            <Card
              key={proposal.id}
              className="hover-lift"
              sx={{
                borderRadius: 4,
                border: `1px solid ${isApproved ? "#34a85333" : isRejected ? "#ea433533" : isScheduled ? "#4285f433" : "#ececec"}`,
                bgcolor: "#fff",
                opacity: isRejected ? 0.6 : 1,
                transition: "all 0.3s ease",
              }}
            >
              <CardContent sx={{ p: 0 }}>
                {/* Card header */}
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, p: 3, pb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        label={channelMeta.label}
                        icon={channelMeta.icon as React.ReactElement}
                        sx={{
                          bgcolor: `${channelMeta.color}14`,
                          color: channelMeta.color,
                          border: "none",
                          fontWeight: 600,
                          "& .MuiChip-icon": { color: channelMeta.color, fontSize: 14 },
                        }}
                      />
                      <Chip
                        size="small"
                        label={statusLabel}
                        sx={{
                          bgcolor: `${statusColor}14`,
                          color: statusColor,
                          border: "none",
                          fontWeight: 600,
                        }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
                        <AutoAwesomeIcon sx={{ fontSize: 14, color: "#fbbc04" }} />
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#1f1f1f" }}>
                          {proposal.qualityScore}
                          <Box component="span" sx={{ color: "#5f6368", fontWeight: 500 }}>/100</Box>
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        fontSize: "1.25rem",
                        fontWeight: 500,
                        color: "#1f1f1f",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.3,
                      }}
                    >
                      {proposal.title}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ borderColor: "#f1f3f4" }} />

                {/* Card body — compact horizontal layout: image left, content right */}
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={3}>
                    {/* Left: Single themed visual (matches the post topic) */}
                    {state.imageMode !== "text" && (
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box sx={{ position: "sticky", top: 0 }}>
                          <ProposalVisual
                            theme={proposal.theme}
                            mode={state.imageMode === "ai" ? "ai" : "stock"}
                          />
                        </Box>
                      </Grid>
                    )}

                    {/* Right: Text content */}
                    <Grid size={{ xs: 12, md: state.imageMode === "text" ? 12 : 8 }}>
                      {state.editing ? (
                        <TextField
                          multiline
                          fullWidth
                          minRows={5}
                          value={state.draftText}
                          onChange={(e) => updateState(proposal.id, { draftText: e.target.value })}
                          sx={{ mb: 2 }}
                        />
                      ) : (
                        <Typography
                          sx={{
                            fontSize: "0.9rem",
                            lineHeight: 1.65,
                            color: "#3c4043",
                            whiteSpace: "pre-line",
                            mb: 2,
                          }}
                        >
                          {state.draftText}
                        </Typography>
                      )}

                      {/* Visual mode toggle */}
                      <ToggleButtonGroup
                        value={state.imageMode}
                        exclusive
                        size="small"
                        onChange={(_, val: ImageMode | null) => val && updateState(proposal.id, { imageMode: val })}
                        sx={{
                          mb: 2,
                          "& .MuiToggleButton-root": {
                            textTransform: "none",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            px: 1.5,
                            py: 0.4,
                            color: "#5f6368",
                            border: "1px solid #ececec",
                            "&.Mui-selected": {
                              bgcolor: "#274e64",
                              color: "#fff",
                              borderColor: "#274e64",
                              "&:hover": { bgcolor: "#1a3a4c" },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="stock">
                          <ImageIcon sx={{ fontSize: 13, mr: 0.5 }} />
                          Free Stock
                        </ToggleButton>
                        <ToggleButton value="ai">
                          <AutoAwesomeIcon sx={{ fontSize: 13, mr: 0.5 }} />
                          AI Generated
                        </ToggleButton>
                        <ToggleButton value="text">
                          <TextFieldsIcon sx={{ fontSize: 13, mr: 0.5 }} />
                          Text Only
                        </ToggleButton>
                      </ToggleButtonGroup>

                      {/* Reasoning */}
                      <Box sx={{ p: 1.75, bgcolor: "#f8f9fa", borderRadius: 2, mb: 0 }}>
                        <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                          AI Reasoning
                        </Typography>
                        <Typography sx={{ fontSize: "0.78rem", color: "#3c4043", lineHeight: 1.5 }}>
                          {proposal.reasoning}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 2.5 }} />

                  {/* Actions */}
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <Button
                      variant="contained"
                      startIcon={<CheckIcon />}
                      onClick={() => handleApprove(proposal)}
                      disabled={isApproved || isRejected || isScheduled}
                      sx={{ bgcolor: "#34a853", "&:hover": { bgcolor: "#1e8e3e" } }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => toggleEdit(proposal)}
                      disabled={isRejected || isScheduled}
                    >
                      {state.editing ? "Done" : "Edit"}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ScheduleIcon />}
                      onClick={() => handleSchedule(proposal)}
                      disabled={!isApproved}
                      sx={{
                        borderColor: "#4285f4",
                        color: "#4285f4",
                        "&:hover": { borderColor: "#1a73e8", bgcolor: "#e8f0fe" },
                        "&.Mui-disabled": { borderColor: "#ececec" },
                      }}
                    >
                      Schedule
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Regenerate this proposal">
                      <IconButton
                        size="small"
                        sx={{ color: "#5f6368", "&:hover": { color: "#274e64" } }}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="text"
                      startIcon={<CloseIcon />}
                      onClick={() => handleReject(proposal)}
                      disabled={isRejected}
                      sx={{ color: "#ea4335", "&:hover": { bgcolor: "#fce8e6" } }}
                    >
                      Reject
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* ── Footer: Approval Workflow Stepper ── */}
      <Card
        className="animate-fade-in-up"
        sx={{
          mt: 4,
          borderRadius: 4,
          border: "1px solid #ececec",
          bgcolor: "#fafbfc",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
            <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: "#274e64" }} />
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#1f1f1f" }}>
              Approval Workflow
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", ml: 1 }}>
              Every piece of content passes through human-gated approval steps
            </Typography>
          </Box>
          <Stepper activeStep={2} alternativeLabel sx={{ mt: 2 }}>
            {WORKFLOW_STEPS.map((step) => (
              <Step key={step.label}>
                <StepLabel
                  optional={
                    step.gate ? (
                      <Chip
                        label="Human Gate"
                        size="small"
                        icon={<ShieldIcon sx={{ fontSize: 12 }} />}
                        sx={{
                          mt: 0.5,
                          height: 20,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          bgcolor: "#fef7e0",
                          color: "#f9ab00",
                          border: "none",
                          "& .MuiChip-icon": { color: "#f9ab00" },
                        }}
                      />
                    ) : null
                  }
                >
                  <Typography sx={{ fontSize: "0.8rem", fontWeight: 500, color: "#3c4043" }}>
                    {step.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
          <Alert
            severity="success"
            icon={<ShieldIcon fontSize="small" />}
            sx={{
              mt: 3,
              bgcolor: "#e6f4ea",
              border: "1px solid #34a85333",
              color: "#1e8e3e",
              fontSize: "0.8rem",
            }}
          >
            All content requires human approval before publication. Draft-only mode is enabled and enforced.
          </Alert>
        </CardContent>
      </Card>

      {/* ── Snackbar ── */}
      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
