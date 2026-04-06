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
import Snackbar from "@mui/material/Snackbar";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Collapse from "@mui/material/Collapse";
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
import ShieldIcon from "@mui/icons-material/Shield";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PageHeader from "@/app/PageHeader";
import RealPhotoVisual from "./RealPhotoVisual";
import NewsletterVisual from "./NewsletterVisual";
import BlogVisual from "./BlogVisual";
import AutorenewIcon from "@mui/icons-material/Autorenew";

import { contentProposals, type ContentChannel, type ContentProposal } from "@/lib/mockData";

/* ── Channel definitions ── */

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
type ProposalStatus = "pending" | "approved" | "rejected" | "scheduled";

interface ProposalState {
  status: ProposalStatus;
  imageMode: ImageMode;
  editing: boolean;
  draftText: string;
  scheduledDate: string | null;
  reasoningOpen: boolean;
}

/* ── Helper: action button shared style ── */

const ACTION_BTN_SX = {
  flex: 1,
  borderRadius: 2,
  textTransform: "none" as const,
  fontWeight: 600,
  fontSize: "0.75rem",
  py: 0.85,
  px: 1,
  minHeight: 36,
  border: "1px solid",
  boxShadow: "none",
  "&:hover": { boxShadow: "none" },
};

/* ── Default schedule date helper ── */

function defaultDate(offsetDays: number = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/* ── Page ── */

export default function ContentStudioPage() {
  const [activeChannel, setActiveChannel] = useState<ContentChannel>("LinkedIn");
  const [snack, setSnack] = useState<string | null>(null);
  const [scheduleDialogId, setScheduleDialogId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>(defaultDate(1));
  const [scheduleTime, setScheduleTime] = useState<string>("09:00");
  const [regenerateDialogId, setRegenerateDialogId] = useState<string | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState<string>("");

  // Per-proposal state
  const [states, setStates] = useState<Record<string, ProposalState>>(() => {
    const initial: Record<string, ProposalState> = {};
    contentProposals.forEach((p) => {
      initial[p.id] = {
        status: "pending",
        imageMode: "stock",
        editing: false,
        draftText: p.text,
        scheduledDate: null,
        reasoningOpen: false,
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

  const handleReject = (p: ContentProposal) => {
    updateState(p.id, { status: "rejected" });
    setSnack(`Rejected: ${p.title}`);
  };

  const toggleEdit = (p: ContentProposal) => {
    updateState(p.id, { editing: !states[p.id].editing });
  };

  const openSchedule = (id: string) => {
    setScheduleDate(defaultDate(1));
    setScheduleTime("09:00");
    setScheduleDialogId(id);
  };

  const confirmSchedule = () => {
    if (!scheduleDialogId) return;
    const proposal = contentProposals.find((p) => p.id === scheduleDialogId);
    const dt = `${scheduleDate} ${scheduleTime}`;
    updateState(scheduleDialogId, { status: "scheduled", scheduledDate: dt });
    setSnack(`Scheduled for ${dt}: ${proposal?.title ?? ""}`);
    setScheduleDialogId(null);
  };

  const openRegenerate = (id: string) => {
    setRegeneratePrompt("");
    setRegenerateDialogId(id);
  };

  const confirmRegenerate = () => {
    if (!regenerateDialogId) return;
    const proposal = contentProposals.find((p) => p.id === regenerateDialogId);
    // Mock regeneration: prepend the user prompt as a marker
    const prefix = regeneratePrompt.trim()
      ? `[Regenerated based on: "${regeneratePrompt.trim()}"]\n\n`
      : "[Regenerated]\n\n";
    updateState(regenerateDialogId, { draftText: prefix + (proposal?.text ?? "") });
    setSnack(`Regenerating: ${proposal?.title ?? ""}`);
    setRegenerateDialogId(null);
  };

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

      {/* ── Proposals Grid: 3 per row ── */}
      <Grid container spacing={2.5} className="stagger-children" sx={{ mb: 5 }}>
        {filteredProposals.map((proposal) => {
          const state = states[proposal.id];
          const channelMeta = CHANNELS.find((c) => c.id === proposal.channel)!;
          const isApproved = state.status === "approved";
          const isRejected = state.status === "rejected";
          const isScheduled = state.status === "scheduled";

          const statusColor =
            isScheduled ? "#4285f4" :
            isRejected ? "#ea4335" :
            isApproved ? "#34a853" :
            "#fbbc04";
          const statusLabel =
            isScheduled ? "Scheduled" :
            isRejected ? "Rejected" :
            isApproved ? "Approved" :
            "Pending Review";

          return (
            <Grid key={proposal.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card
                className="hover-lift"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 4,
                  border: `1px solid ${
                    isRejected ? "#ea433533" :
                    isScheduled ? "#4285f433" :
                    isApproved ? "#34a85333" :
                    "#ececec"
                  }`,
                  opacity: isRejected ? 0.55 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                {/* ── Visual (channel-specific) ── */}
                {state.imageMode === "stock" && proposal.channel === "LinkedIn" && (
                  <RealPhotoVisual theme={proposal.theme} height={180} />
                )}
                {state.imageMode === "stock" && proposal.channel === "Newsletter" && (
                  <NewsletterVisual subject={proposal.title} preview={state.draftText} height={180} />
                )}
                {state.imageMode === "stock" && proposal.channel === "Blog" && (
                  <BlogVisual
                    title={proposal.title}
                    excerpt={state.draftText}
                    readingTime="8 min read"
                    height={180}
                  />
                )}
                {state.imageMode === "ai" && (
                  <Box
                    sx={{
                      height: 180,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#fafbfc",
                      borderBottom: "1px solid #ececec",
                      gap: 0.75,
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        bgcolor: "#fdebed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AutoAwesomeIcon sx={{ color: "#ed1b2f", fontSize: 22 }} />
                    </Box>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#1f1f1f" }}>
                      AI image
                    </Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: "#5f6368" }}>
                      Coming soon
                    </Typography>
                  </Box>
                )}
                {state.imageMode === "text" && (
                  <Box
                    sx={{
                      height: 60,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#f8f9fa",
                      borderBottom: "1px solid #ececec",
                      gap: 1,
                    }}
                  >
                    <TextFieldsIcon sx={{ fontSize: 18, color: "#5f6368" }} />
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5f6368" }}>
                      Text-only post
                    </Typography>
                  </Box>
                )}

                <CardContent sx={{ p: 2.25, flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* ── Status row ── */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1, flexWrap: "wrap" }}>
                    <Chip
                      size="small"
                      label={channelMeta.label}
                      icon={channelMeta.icon as React.ReactElement}
                      sx={{
                        height: 22,
                        bgcolor: `${channelMeta.color}14`,
                        color: channelMeta.color,
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.65rem",
                        "& .MuiChip-icon": { color: channelMeta.color, fontSize: 13 },
                      }}
                    />
                    <Chip
                      size="small"
                      label={statusLabel}
                      sx={{
                        height: 22,
                        bgcolor: `${statusColor}14`,
                        color: statusColor,
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.65rem",
                      }}
                    />
                    <Box sx={{ flex: 1 }} />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 13, color: "#fbbc04" }} />
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1f1f1f" }}>
                        {proposal.qualityScore}
                        <Box component="span" sx={{ color: "#5f6368", fontWeight: 500 }}>/100</Box>
                      </Typography>
                    </Box>
                  </Box>

                  {/* ── Title ── */}
                  <Typography
                    sx={{
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      fontSize: "1rem",
                      fontWeight: 500,
                      color: "#1f1f1f",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                      mb: 1.25,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {proposal.title}
                  </Typography>

                  {/* ── Text content (scrollable to show full text) ── */}
                  {state.editing ? (
                    <TextField
                      multiline
                      fullWidth
                      minRows={6}
                      maxRows={14}
                      value={state.draftText}
                      onChange={(e) => updateState(proposal.id, { draftText: e.target.value })}
                      sx={{ mb: 1.5, "& .MuiInputBase-input": { fontSize: "0.78rem", lineHeight: 1.55 } }}
                    />
                  ) : (
                    <Box
                      sx={{
                        mb: 1.5,
                        maxHeight: 260,
                        overflowY: "auto",
                        pr: 0.75,
                        position: "relative",
                        // Fade bottom indicator for scrollable content
                        "&::after": {
                          content: '""',
                          position: "sticky",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          display: "block",
                          height: 16,
                          marginTop: "-16px",
                          background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)",
                          pointerEvents: "none",
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.78rem",
                          lineHeight: 1.6,
                          color: "#3c4043",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {state.draftText}
                      </Typography>
                    </Box>
                  )}

                  {/* ── Scheduled date display ── */}
                  {isScheduled && state.scheduledDate && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1.25,
                        py: 0.75,
                        mb: 1.25,
                        borderRadius: 1.5,
                        bgcolor: "#e8f0fe",
                        border: "1px solid #4285f433",
                      }}
                    >
                      <ScheduleIcon sx={{ fontSize: 14, color: "#4285f4" }} />
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#1a73e8" }}>
                        Scheduled · {state.scheduledDate}
                      </Typography>
                    </Box>
                  )}

                  {/* ── Image mode toggle ── */}
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
                        py: 0.5,
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

                  {/* ── Reasoning collapse ── */}
                  <Box sx={{ mb: 1.5 }}>
                    <Box
                      onClick={() => updateState(proposal.id, { reasoningOpen: !state.reasoningOpen })}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        py: 0.5,
                        userSelect: "none",
                        "&:hover": { color: "#274e64" },
                        color: "#5f6368",
                      }}
                    >
                      <LightbulbIcon sx={{ fontSize: 13, color: "#fbbc04" }} />
                      <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        AI Reasoning
                      </Typography>
                      <ExpandMoreIcon
                        sx={{
                          fontSize: 14,
                          ml: "auto",
                          transition: "transform 0.2s",
                          transform: state.reasoningOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </Box>
                    <Collapse in={state.reasoningOpen}>
                      <Box sx={{ p: 1.25, bgcolor: "#f8f9fa", borderRadius: 1.5, mt: 0.5 }}>
                        <Typography sx={{ fontSize: "0.7rem", color: "#3c4043", lineHeight: 1.5 }}>
                          {proposal.reasoning}
                        </Typography>
                      </Box>
                    </Collapse>
                  </Box>

                  {/* ── Unified action buttons (2 rows, 4 actions) ── */}
                  <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {/* Row 1: secondary actions */}
                    <Box sx={{ display: "flex", gap: 0.75 }}>
                      <Button
                        onClick={() => handleReject(proposal)}
                        disabled={isRejected || isScheduled}
                        startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          ...ACTION_BTN_SX,
                          bgcolor: "#fff",
                          borderColor: "#ea433533",
                          color: "#ea4335",
                          "&:hover": {
                            bgcolor: "#fce8e6",
                            borderColor: "#ea4335",
                            boxShadow: "none",
                          },
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => toggleEdit(proposal)}
                        disabled={isRejected || isScheduled}
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          ...ACTION_BTN_SX,
                          bgcolor: "#fff",
                          borderColor: "#ececec",
                          color: "#3c4043",
                          "&:hover": {
                            bgcolor: "#f1f3f4",
                            borderColor: "#dadce0",
                            boxShadow: "none",
                          },
                        }}
                      >
                        {state.editing ? "Done" : "Edit"}
                      </Button>
                      <Button
                        onClick={() => openRegenerate(proposal.id)}
                        disabled={isRejected || isScheduled}
                        startIcon={<AutorenewIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          ...ACTION_BTN_SX,
                          bgcolor: "#fff",
                          borderColor: "#274e6433",
                          color: "#274e64",
                          "&:hover": {
                            bgcolor: "#e8f0f4",
                            borderColor: "#274e64",
                            boxShadow: "none",
                          },
                        }}
                      >
                        Regenerate
                      </Button>
                    </Box>
                    {/* Row 2: primary approval */}
                    <Button
                      onClick={() => openSchedule(proposal.id)}
                      disabled={isRejected || isScheduled}
                      startIcon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        ...ACTION_BTN_SX,
                        flex: "unset",
                        width: "100%",
                        bgcolor: "#34a853",
                        borderColor: "#34a853",
                        color: "#fff",
                        "&:hover": {
                          bgcolor: "#1e8e3e",
                          borderColor: "#1e8e3e",
                          boxShadow: "none",
                        },
                        "&.Mui-disabled": {
                          bgcolor: "#f1f3f4",
                          borderColor: "#ececec",
                          color: "#9aa0a6",
                        },
                      }}
                    >
                      Approve & Schedule
                    </Button>
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
        open={!!scheduleDialogId}
        onClose={() => setScheduleDialogId(null)}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 380 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: "#e8f0fe",
                color: "#4285f4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ScheduleIcon />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: "#1f1f1f",
                  letterSpacing: "-0.01em",
                }}
              >
                Approve & Schedule
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                Pick a date and time to publish
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {scheduleDialogId && (
            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                Post
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#1f1f1f",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {contentProposals.find((p) => p.id === scheduleDialogId)?.title}
              </Typography>
            </Box>
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
              sx={{ width: 130 }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 0.75, mt: 2, flexWrap: "wrap" }}>
            {[
              { label: "Tomorrow", days: 1 },
              { label: "In 3 days", days: 3 },
              { label: "Next week", days: 7 },
              { label: "In 2 weeks", days: 14 },
            ].map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                size="small"
                onClick={() => setScheduleDate(defaultDate(preset.days))}
                sx={{
                  cursor: "pointer",
                  bgcolor: "#f1f3f4",
                  color: "#3c4043",
                  fontWeight: 500,
                  "&:hover": { bgcolor: "#e8f0fe", color: "#1a73e8" },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1.5, gap: 1 }}>
          <Button
            onClick={() => setScheduleDialogId(null)}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              color: "#5f6368",
              "&:hover": { bgcolor: "#f1f3f4" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSchedule}
            variant="contained"
            startIcon={<CheckIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#34a853",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1e8e3e", boxShadow: "none" },
            }}
          >
            Approve & Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Regenerate Dialog ── */}
      <Dialog
        open={!!regenerateDialogId}
        onClose={() => setRegenerateDialogId(null)}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 440 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: "#e8f0f4",
                color: "#274e64",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AutorenewIcon />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  fontSize: "1.15rem",
                  fontWeight: 500,
                  color: "#1f1f1f",
                  letterSpacing: "-0.01em",
                }}
              >
                Regenerate Content
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                Describe what you'd like to change
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {regenerateDialogId && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
                Post
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: "#1f1f1f",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {contentProposals.find((p) => p.id === regenerateDialogId)?.title}
              </Typography>
            </Box>
          )}
          <TextField
            autoFocus
            multiline
            minRows={4}
            fullWidth
            placeholder="e.g. Make it shorter and more casual. Add a statistic about downtime costs. Target procurement buyers instead of engineers."
            value={regeneratePrompt}
            onChange={(e) => setRegeneratePrompt(e.target.value)}
            sx={{
              "& .MuiInputBase-input": { fontSize: "0.85rem", lineHeight: 1.5 },
            }}
          />
          <Box sx={{ display: "flex", gap: 0.75, mt: 2, flexWrap: "wrap" }}>
            {[
              "Make it shorter",
              "More technical",
              "Add a statistic",
              "Stronger CTA",
              "Different hook",
            ].map((preset) => (
              <Chip
                key={preset}
                label={preset}
                size="small"
                onClick={() =>
                  setRegeneratePrompt((prev) => (prev ? `${prev}. ${preset}` : preset))
                }
                sx={{
                  cursor: "pointer",
                  bgcolor: "#f1f3f4",
                  color: "#3c4043",
                  fontWeight: 500,
                  "&:hover": { bgcolor: "#e8f0f4", color: "#274e64" },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1.5, gap: 1 }}>
          <Button
            onClick={() => setRegenerateDialogId(null)}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              color: "#5f6368",
              "&:hover": { bgcolor: "#f1f3f4" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmRegenerate}
            variant="contained"
            startIcon={<AutorenewIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "#274e64",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1a3a4c", boxShadow: "none" },
            }}
          >
            Regenerate
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
