"use client";
import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SaveIcon from "@mui/icons-material/Save";

type LogEntry = {
  id: string;
  ts: string;
  type: "like" | "dislike" | "comment";
  channel: string;
  headline?: string;
  body?: string;
  prompt?: string;
  correction?: string;
  note?: string;
  filters?: Record<string, unknown>;
};

type LogsFile = {
  version: number;
  userDefaults: string;
  entries: LogEntry[];
};

type Filter = "all" | "like" | "dislike" | "comment";

const LABEL: Record<LogEntry["type"], string> = {
  like: "Approved",
  dislike: "Disliked",
  comment: "Comment",
};

const ACCENT: Record<LogEntry["type"], { border: string; bg: string; fg: string; icon: React.ReactNode }> = {
  like: {
    border: "#c8e6c9",
    bg: "#f1f8f3",
    fg: "#2e7d32",
    icon: <ThumbUpIcon sx={{ fontSize: 16, color: "#2e7d32" }} />,
  },
  dislike: {
    border: "#ffcdd2",
    bg: "#fff5f5",
    fg: "#ed1b2f",
    icon: <ThumbDownIcon sx={{ fontSize: 16, color: "#ed1b2f" }} />,
  },
  comment: {
    border: "#bbdefb",
    bg: "#f5f9ff",
    fg: "#274e64",
    icon: <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: "#274e64" }} />,
  },
};

export default function LogsClient({ initial }: { initial: LogsFile }) {
  const [file, setFile] = useState<LogsFile>(initial);
  const [defaults, setDefaults] = useState(initial.userDefaults);
  const [filter, setFilter] = useState<Filter>("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const stats = useMemo(() => {
    const likes = file.entries.filter((e) => e.type === "like").length;
    const dislikes = file.entries.filter((e) => e.type === "dislike").length;
    const comments = file.entries.filter((e) => e.type === "comment").length;
    return { likes, dislikes, comments, total: file.entries.length };
  }, [file.entries]);

  const entries = useMemo(
    () => (filter === "all" ? file.entries : file.entries.filter((e) => e.type === filter)),
    [file.entries, filter]
  );

  async function saveDefaults() {
    setSaving(true);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setUserDefaults", text: defaults }),
      });
      const data = (await res.json()) as LogsFile;
      setFile(data);
      setToast({ open: true, msg: "Defaults saved", sev: "success" });
    } catch (err) {
      setToast({ open: true, msg: `Save failed: ${String(err)}`, sev: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid #dde1e6",
          p: 2.5,
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a3a4c", flex: 1 }}>
            Your defaults (merged into every generation)
          </Typography>
          <Button
            onClick={saveDefaults}
            disabled={saving}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: "#ed1b2f",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#c91528" },
            }}
          >
            {saving ? "Saving…" : "Save defaults"}
          </Button>
        </Box>
        <Typography sx={{ fontSize: 12, color: "#5f6368", mb: 1.5 }}>
          Plain text. Example: <em>&quot;Always finish posts with a question. Avoid the word
          &apos;solution&apos;. For blogs, aim for 600 words minimum.&quot;</em>
        </Typography>
        <TextField
          multiline
          minRows={4}
          fullWidth
          placeholder="Write your defaults here — what the bot should always do, or avoid."
          value={defaults}
          onChange={(e) => setDefaults(e.target.value)}
          size="small"
        />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid #dde1e6",
          p: 2.5,
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a3a4c", flex: 1, minWidth: 160 }}>
            Feedback log
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            <Stat value={stats.total.toString()} label="Total" />
            <Stat value={stats.likes.toString()} label="Approved" color="#2e7d32" />
            <Stat value={stats.dislikes.toString()} label="Disliked" color="#ed1b2f" />
            <Stat value={stats.comments.toString()} label="Comments" color="#274e64" />
          </Box>
          <ToggleButtonGroup
            value={filter}
            exclusive
            size="small"
            onChange={(_, v) => v && setFilter(v)}
          >
            <ToggleButton value="all" sx={{ textTransform: "none", fontSize: 12 }}>
              All
            </ToggleButton>
            <ToggleButton value="like" sx={{ textTransform: "none", fontSize: 12 }}>
              Approved
            </ToggleButton>
            <ToggleButton value="dislike" sx={{ textTransform: "none", fontSize: 12 }}>
              Disliked
            </ToggleButton>
            <ToggleButton value="comment" sx={{ textTransform: "none", fontSize: 12 }}>
              Comments
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {entries.length === 0 ? (
          <Box
            sx={{
              py: 6,
              textAlign: "center",
              border: "1.5px dashed #dde1e6",
              borderRadius: 2,
              bgcolor: "#fafbfc",
            }}
          >
            <Typography sx={{ fontSize: 13, color: "#5f6368" }}>
              No entries yet. Like, dislike, or comment on a proposal on the Content Generation
              page to start teaching the bot.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {entries.map((e) => {
              const accent = ACCENT[e.type];
              return (
                <Box
                  key={e.id}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: `1px solid ${accent.border}`,
                    bgcolor: accent.bg,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {accent.icon}
                    <Chip
                      label={LABEL[e.type]}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10.5,
                        fontWeight: 700,
                        bgcolor: "#fff",
                        color: accent.fg,
                        border: `1px solid ${accent.border}`,
                      }}
                    />
                    {e.channel && (
                      <Chip
                        size="small"
                        label={e.channel}
                        sx={{ height: 20, fontSize: 10.5, bgcolor: "#fff", border: "1px solid #dde1e6" }}
                      />
                    )}
                    <Typography sx={{ fontSize: 11, color: "#5f6368", flex: 1 }}>
                      {new Date(e.ts).toLocaleString()}
                    </Typography>
                  </Box>
                  {e.headline && (
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1a3a4c" }}>
                      {e.headline}
                    </Typography>
                  )}
                  {e.body && (
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        color: "#3c4043",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {e.body}
                    </Typography>
                  )}
                  {e.correction && (
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        bgcolor: "#fdebed",
                        border: "1px dashed #ed1b2f",
                      }}
                    >
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#ed1b2f", mb: 0.5 }}>
                        CORRECTION
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#3c4043" }}>{e.correction}</Typography>
                    </Box>
                  )}
                  {e.note && (
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        bgcolor: "#f5f9ff",
                        border: "1px dashed #274e64",
                      }}
                    >
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#274e64", mb: 0.5 }}>
                        NOTE
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#3c4043" }}>{e.note}</Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.sev} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: 1.5,
        bgcolor: "#fafbfc",
        border: "1px solid #dde1e6",
        textAlign: "center",
        minWidth: 60,
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: color ?? "#1a3a4c", lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography
        sx={{
          fontSize: 9.5,
          color: "#5f6368",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
