"use client";

import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
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
  const [scheduleTarget, setScheduleTarget] = useState<ContentProposal | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("09:00");

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

  const openSchedule = (p: ContentProposal) => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    setScheduleDate(today.toISOString().slice(0, 10));
    setScheduleTime("09:00");
    setScheduleTarget(p);
  };

  const confirmSchedule = () => {
    if (!scheduleTarget) return;
    updateState(scheduleTarget.id, { status: "scheduled" });
    setSnack(`Scheduled: ${scheduleTarget.title} — ${scheduleDate} ${scheduleTime}`);
    setScheduleTarget(null);
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

      {/* ── Proposals Grid (3 per row) ── */}
      <Grid container spacing={2.5} sx={{ mb: 5 }} className="stagger-children">
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

          // Unified action button base style — every action looks identical in shape & size,
          // only the accent color differs so users can distinguish intent at a glance.
          const actionBtnSx = (color: string) => ({
            flex: 1,
            minWidth: 0,
            textTransform: "none" as const,
            fontWeight: 600,
            fontSize: "0.72rem",
            py: 0.6,
            px: 1,
            borderRadius: 1.5,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: `${color}55`,
            color,
            bgcolor: `${color}0d`,
            boxShadow: "none",
            "&:hover": { bgcolor: `${color}1f`, borderColor: color, boxShadow: "none" },
            "&.Mui-disabled": { borderColor: "#ececec", color: "#bdbdbd", bgcolor: "#fafafa" },
            "& .MuiButton-startIcon": { mr: 0.5 },
            "& .MuiButton-startIcon > *:first-of-type": { fontSize: 15 },
          });

          return (
            <Grid key={proposal.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card
              className="hover-lift"
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 4,
                border: `1px solid ${isApproved ? "#34a85333" : isRejected ? "#ea433533" : isScheduled ? "#4285f433" : "#ececec"}`,
                bgcolor: "#fff",
                opacity: isRejected ? 0.6 : 1,
                transition: "all 0.3s ease",
              }}
            >
              <CardContent sx={{ p: 0, flex: 1, display: "flex", flexDirection: "column", "&:last-child": { pb: 0 } }}>
                {/* Visual */}
                {state.imageMode !== "text" && (
                  <Box sx={{ p: 2, pb: 0 }}>
                    <ProposalVisual
                      theme={proposal.theme}
                      mode={state.imageMode === "ai" ? "ai" : "stock"}
                    />
                  </Box>
                )}

                {/* Header: chips + score */}
                <Box sx={{ px: 2.25, pt: 2, pb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1, flexWrap: "wrap" }}>
                    <Chip
                      size="small"
                      label={channelMeta.label}
                      icon={channelMeta.icon as React.ReactElement}
                      sx={{
                        height: 22,
                        fontSize: "0.68rem",
                        bgcolor: `${channelMeta.color}14`,
                        color: channelMeta.color,
                        border: "none",
                        fontWeight: 600,
                        "& .MuiChip-icon": { color: channelMeta.color, fontSize: 13 },
                      }}
                    />
                    <Chip
                      size="small"
                      label={statusLabel}
                      sx={{
                        height: 22,
                        fontSize: "0.68rem",
                        bgcolor: `${statusColor}14`,
                        color: statusColor,
                        border: "none",
                        fontWeight: 600,
                      }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, ml: "auto" }}>
                      <AutoAwesomeIcon sx={{ fontSize: 13, color: "#fbbc04" }} />
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1f1f1f" }}>
                        {proposal.qualityScore}
                        <Box component="span" sx={{ color: "#5f6368", fontWeight: 500 }}>/100</Box>
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "#1f1f1f",
                      letterSpacing: "-0.015em",
                      lineHeight: 1.3,
                    }}
                  >
                    {proposal.title}
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: "#f1f3f4" }} />

                {/* Body */}
                <Box sx={{ px: 2.25, py: 1.75, flex: 1, display: "flex", flexDirection: "column" }}>
                  {state.editing ? (
                    <TextField
                      multiline
                      fullWidth
                      minRows={5}
                      value={state.draftText}
                      onChange={(e) => updateState(proposal.id, { draftText: e.target.value })}
                      sx={{ mb: 1.5 }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        fontSize: "0.8rem",
                        lineHeight: 1.55,
                        color: "#3c4043",
                        whiteSpace: "pre-line",
                        mb: 1.5,
                        flex: 1,
                        display: "-webkit-box",
                        WebkitLineClamp: 7,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
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
                    fullWidth
                    onChange={(_, val: ImageMode | null) => val && updateState(proposal.id, { imageMode: val })}
                    sx={{
                      mb: 1.25,
                      "& .MuiToggleButton-root": {
                        textTransform: "none",
                        fontSize: "0.65rem",
                        fontWeight: 500,
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
                      <ImageIcon sx={{ fontSize: 12, mr: 0.4 }} />
                      Stock
                    </ToggleButton>
                    <ToggleButton value="ai">
                      <AutoAwesomeIcon sx={{ fontSize: 12, mr: 0.4 }} />
                      AI
                    </ToggleButton>
                    <ToggleButton value="text">
                      <TextFieldsIcon sx={{ fontSize: 12, mr: 0.4 }} />
                      Text
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {/* Reasoning */}
                  <Box sx={{ p: 1.25, bgcolor: "#f8f9fa", borderRadius: 1.5, mb: 1.5 }}>
                    <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.4 }}>
                      AI Reasoning
                    </Typography>
                    <Typography sx={{ fontSize: "0.72rem", color: "#3c4043", lineHeight: 1.45 }}>
                      {proposal.reasoning}
                    </Typography>
                  </Box>

                  {/* Unified action bar — every button shares the exact same shape & size */}
                  <Box sx={{ display: "flex", gap: 0.75, mt: "auto" }}>
                    <Tooltip title="Approve">
                      <span style={{ flex: 1, display: "flex" }}>
                        <Button
                          variant="outlined"
                          startIcon={<CheckIcon />}
                          onClick={() => handleApprove(proposal)}
                          disabled={isApproved || isRejected || isScheduled}
                          sx={actionBtnSx("#34a853")}
                        >
                          Approve
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={state.editing ? "Finish editing" : "Edit text"}>
                      <span style={{ flex: 1, display: "flex" }}>
                        <Button
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => toggleEdit(proposal)}
                          disabled={isRejected || isScheduled}
                          sx={actionBtnSx("#5f6368")}
                        >
                          {state.editing ? "Done" : "Edit"}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={isApproved ? "Pick a publication date" : "Approve first to schedule"}>
                      <span style={{ flex: 1, display: "flex" }}>
                        <Button
                          variant="outlined"
                          startIcon={<ScheduleIcon />}
                          onClick={() => openSchedule(proposal)}
                          disabled={!isApproved}
                          sx={actionBtnSx("#4285f4")}
                        >
                          Schedule
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, mt: 0.75 }}>
                    <Tooltip title="Regenerate this proposal">
                      <span style={{ flex: 1, display: "flex" }}>
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          sx={actionBtnSx("#9334e6")}
                        >
                          Regenerate
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Reject">
                      <span style={{ flex: 1, display: "flex" }}>
                        <Button
                          variant="outlined"
                          startIcon={<CloseIcon />}
                          onClick={() => handleReject(proposal)}
                          disabled={isRejected}
                          sx={actionBtnSx("#ea4335")}
                        >
                          Reject
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            </Grid>
          );
        })}
      </Grid>

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

      {/* ── Schedule Dialog ── */}
      <Dialog
        open={!!scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontWeight: 600, pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ScheduleIcon sx={{ color: "#4285f4" }} />
            Schedule publication
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {scheduleTarget && (
            <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", mb: 2 }}>
              {scheduleTarget.title}
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              type="date"
              label="Date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="time"
              label="Time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: 130 }}
            />
          </Box>
          <Typography sx={{ fontSize: "0.7rem", color: "#9aa0a6", mt: 1.5 }}>
            Publication will be queued in draft-only mode for human verification before going live.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setScheduleTarget(null)}
            sx={{ textTransform: "none", color: "#5f6368" }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSchedule}
            variant="contained"
            disabled={!scheduleDate}
            startIcon={<ScheduleIcon />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#4285f4",
              "&:hover": { bgcolor: "#1a73e8" },
            }}
          >
            Confirm schedule
          </Button>
        </DialogActions>
      </Dialog>

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
