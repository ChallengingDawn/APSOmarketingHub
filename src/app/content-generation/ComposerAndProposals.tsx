"use client";
import { useState } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Avatar from "@mui/material/Avatar";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ImageIcon from "@mui/icons-material/Image";
import EditIcon from "@mui/icons-material/EditOutlined";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import RepeatIcon from "@mui/icons-material/Repeat";
import SendIcon from "@mui/icons-material/SendOutlined";
import PublicIcon from "@mui/icons-material/Public";

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
};

export default function ComposerAndProposals({
  strapline,
  storyline,
}: {
  strapline: string;
  storyline: string;
}) {
  const [composer, setComposer] = useState("");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composerLoading, setComposerLoading] = useState(false);

  async function composeFromScratch() {
    if (!composer.trim()) return;
    setComposerLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "linkedin", prompt: composer, model: "claude" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      } else {
        setComposer(data.content ?? composer);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setComposerLoading(false);
    }
  }

  async function propose() {
    setGenerating(true);
    setError(null);
    setProposals([]);
    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "linkedin", topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Proposal generation failed");
      } else {
        setProposals(data.proposals ?? []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copyProposal(p: Proposal) {
    try {
      await navigator.clipboard.writeText(`${p.headline}\n\n${p.body}`);
    } catch {
      // silent
    }
  }

  function downloadImage(p: Proposal, index: number) {
    const a = document.createElement("a");
    a.href = p.imageUrl;
    a.download = `apso-linkedin-${index + 1}.png`;
    a.click();
  }

  function sendToComposer(p: Proposal) {
    setComposer(`${p.headline}\n\n${p.body}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid #dde1e6",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, pt: 2.5, pb: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: "#ed1b2f",
              width: 48,
              height: 48,
              fontWeight: 800,
              fontSize: 20,
            }}
          >
            A
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a3a4c" }}>
              APSOparts
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>Marketing</Typography>
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>·</Typography>
              <PublicIcon sx={{ fontSize: 12, color: "#5f6368" }} />
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>Public draft</Typography>
            </Box>
          </Box>
          <Chip
            label="Brain-informed"
            size="small"
            icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
            sx={{
              bgcolor: "#fdebed",
              color: "#ed1b2f",
              fontWeight: 600,
              height: 24,
              "& .MuiChip-icon": { color: "#ed1b2f" },
            }}
          />
        </Box>
        <Divider />
        <Box sx={{ px: 2.5, py: 2 }}>
          <TextField
            multiline
            minRows={5}
            maxRows={14}
            fullWidth
            placeholder={`What do you want to post about? (e.g. "FFKM demand is up 6× — let customers know we stock it")\n\nPersonality context: "${strapline}" · "${storyline}"`}
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            variant="standard"
            slotProps={{
              input: {
                disableUnderline: true,
                sx: { fontSize: 15, lineHeight: 1.55, color: "#1f1f1f" },
              },
            }}
          />
          {composerLoading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
        </Box>
        <Divider />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2.5,
            py: 1.25,
            bgcolor: "#fafbfc",
          }}
        >
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <ActionIcon icon={<ThumbUpOffAltIcon fontSize="small" />} label="Like" />
            <ActionIcon icon={<ChatBubbleOutlineIcon fontSize="small" />} label="Comment" />
            <ActionIcon icon={<RepeatIcon fontSize="small" />} label="Repost" />
            <ActionIcon icon={<SendIcon fontSize="small" />} label="Send" />
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              onClick={composeFromScratch}
              disabled={composerLoading || !composer.trim()}
              startIcon={<AutoAwesomeIcon />}
              sx={{
                textTransform: "none",
                color: "#274e64",
                fontWeight: 600,
                "&:hover": { bgcolor: "#e8f0f4" },
              }}
            >
              Enhance with AI
            </Button>
            <Button
              onClick={() => navigator.clipboard.writeText(composer)}
              disabled={!composer.trim()}
              startIcon={<ContentCopyIcon />}
              sx={{ textTransform: "none", color: "#3c4043" }}
            >
              Copy
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: "1px solid #dde1e6",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <AutoAwesomeIcon sx={{ color: "#ed1b2f" }} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a3a4c", flex: 1 }}>
            3 AI proposals (text + image)
          </Typography>
          <TextField
            size="small"
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            sx={{ width: 260 }}
          />
          <Button
            variant="contained"
            onClick={propose}
            disabled={generating}
            startIcon={<AutoAwesomeIcon />}
            sx={{
              bgcolor: "#ed1b2f",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#c91528" },
            }}
          >
            {generating ? "Generating…" : "Propose 3"}
          </Button>
        </Box>
        {generating && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {error && (
          <Box
            sx={{
              p: 1.25,
              borderRadius: 1,
              bgcolor: "#fdebed",
              border: "1px solid #ed1b2f",
              mb: 2,
            }}
          >
            <Typography sx={{ fontSize: 12, color: "#ed1b2f" }}>{error}</Typography>
          </Box>
        )}

        {proposals.length === 0 && !generating && (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
              border: "1.5px dashed #dde1e6",
              borderRadius: 2,
              bgcolor: "#fafbfc",
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 32, color: "#b0b6be", mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: "#5f6368" }}>
              Click <strong>Propose 3</strong> to generate three LinkedIn drafts with matching
              images — all grounded in the Personality brain.
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          {proposals.map((p, i) => (
            <Paper
              key={i}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                bgcolor: "#ffffff",
                borderColor: "#dde1e6",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
                },
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  bgcolor: "#eceff1",
                }}
              >
                <Image
                  src={p.imageUrl}
                  alt={p.headline}
                  fill
                  sizes="(min-width: 900px) 280px, 90vw"
                  style={{ objectFit: "cover" }}
                  unoptimized={p.imageUrl.startsWith("data:")}
                />
                <Chip
                  label={p.imageSource === "gemini" ? "Gemini" : "Mood library"}
                  size="small"
                  icon={<ImageIcon sx={{ fontSize: 12 }} />}
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    bgcolor: "rgba(15,20,26,0.78)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    height: 22,
                    "& .MuiChip-icon": { color: "#fff" },
                  }}
                />
              </Box>
              <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a3a4c", lineHeight: 1.3 }}>
                  {p.headline}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 13,
                    color: "#3c4043",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    flex: 1,
                  }}
                >
                  {p.body}
                </Typography>
                {p.imagePrompt && (
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: "#5f6368",
                      fontStyle: "italic",
                      mt: 0.5,
                      borderTop: "1px dashed #ececec",
                      pt: 1,
                    }}
                  >
                    Image brief: {p.imagePrompt}
                  </Typography>
                )}
              </Box>
              <Divider />
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, bgcolor: "#fafbfc" }}>
                <Tooltip title="Send to composer">
                  <IconButton size="small" onClick={() => sendToComposer(p)} sx={{ color: "#274e64" }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy text">
                  <IconButton size="small" onClick={() => copyProposal(p)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download image">
                  <IconButton size="small" onClick={() => downloadImage(p, i)}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Chip
                  label={`#${i + 1}`}
                  size="small"
                  sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 700, height: 20 }}
                />
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

function ActionIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        color: "#5f6368",
        cursor: "default",
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{label}</Typography>
    </Box>
  );
}