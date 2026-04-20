"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";

export const RAIL_WIDTH = 360;

type Channel = "linkedin" | "newsletter" | "blog" | "product" | "seo" | "studio" | "freeform";

const CHANNEL_BY_PATH: Record<string, Channel> = {
  linkedin: "linkedin",
  newsletter: "newsletter",
  blog: "blog",
  seo: "seo",
  studio: "studio",
  calendar: "freeform",
  analytics: "freeform",
  "knowledge-base": "freeform",
  audit: "freeform",
  settings: "freeform",
};

function detectChannel(pathname: string): Channel {
  const first = pathname.replace(/^\//, "").split("/")[0] || "";
  return CHANNEL_BY_PATH[first] ?? "freeform";
}

export default function RightRail() {
  const pathname = usePathname() || "/";
  const channel = useMemo(() => detectChannel(pathname), [pathname]);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"claude" | "gemini">("claude");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);

  async function loadSuggestions() {
    setLoadingSug(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pathname, channel }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSug(false);
    }
  }

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function generate(overridePrompt?: string) {
    const p = (overridePrompt ?? prompt).trim();
    if (!p) return;
    setGenerating(true);
    setError(null);
    setOutput("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, prompt: p, model }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      } else {
        setOutput(data.content ?? "");
        setProvider(data.provider ?? null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // silent
    }
  }

  function downloadText() {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apso-${channel}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        borderLeft: "1px solid #ececec",
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: "1px solid #ececec" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: "#ed1b2f", fontSize: 20 }} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a3a4c" }}>
            Content Composer
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
          <Chip
            label={channel}
            size="small"
            sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600, height: 20, fontSize: 10 }}
          />
          <Chip
            label="Phase 1"
            size="small"
            sx={{ bgcolor: "#fafbfc", color: "#5f6368", height: 20, fontSize: 10, border: "1px solid #ececec" }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", px: 2.5, py: 2 }}>
        <ToggleButtonGroup
          value={model}
          exclusive
          size="small"
          onChange={(_, v) => v && setModel(v)}
          sx={{ mb: 1.5, width: "100%" }}
        >
          <ToggleButton value="claude" sx={{ flex: 1, textTransform: "none", fontSize: 12 }}>
            Claude
          </ToggleButton>
          <ToggleButton value="gemini" sx={{ flex: 1, textTransform: "none", fontSize: 12 }}>
            Gemini
          </ToggleButton>
        </ToggleButtonGroup>

        <TextField
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          size="small"
          placeholder="Generate from scratch — describe what you want…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => generate()}
          disabled={generating || !prompt.trim()}
          startIcon={<AutoAwesomeIcon />}
          sx={{
            bgcolor: "#ed1b2f",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { bgcolor: "#c91528" },
          }}
        >
          {generating ? "Generating…" : "Generate"}
        </Button>
        {generating && <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />}

        {error && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.25,
              borderRadius: 1,
              bgcolor: "#fdebed",
              border: "1px solid #ed1b2f",
            }}
          >
            <Typography sx={{ fontSize: 11, color: "#ed1b2f" }}>{error}</Typography>
          </Box>
        )}

        {output && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
              <Typography sx={{ fontSize: 11, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Output {provider ? `· ${provider}` : ""}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.25 }}>
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={copyOut}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download .txt">
                  <IconButton size="small" onClick={downloadText}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                maxHeight: 360,
                overflow: "auto",
                borderRadius: 1.5,
                bgcolor: "#fafbfc",
                whiteSpace: "pre-wrap",
                fontSize: 13,
                lineHeight: 1.55,
                color: "#1f1f1f",
              }}
            >
              {output}
            </Paper>
          </Box>
        )}
      </Box>

      <Divider />
      <Box sx={{ px: 2.5, py: 2, bgcolor: "#fafbfc" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography sx={{ fontSize: 11, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            AI Suggestions
          </Typography>
          <Tooltip title="Refresh suggestions">
            <IconButton size="small" onClick={loadSuggestions} disabled={loadingSug}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {loadingSug && suggestions.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: "#eceff1",
                  opacity: 0.5,
                }}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {suggestions.slice(0, 3).map((s, i) => (
              <Box
                key={i}
                onClick={() => {
                  setPrompt(s);
                  generate(s);
                }}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: "#ffffff",
                  border: "1px solid #ececec",
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "#3c4043",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    borderColor: "#ed1b2f",
                    bgcolor: "#fdebed",
                    color: "#1a3a4c",
                    transform: "translateX(-2px)",
                  },
                }}
              >
                {s}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}