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
import SaveIcon from "@mui/icons-material/Save";

type LogEntry = {
  id: string;
  ts: string;
  type: "like" | "dislike";
  channel: string;
  headline?: string;
  body?: string;
  prompt?: string;
  correction?: string;
  filters?: Record<string, unknown>;
};

type LogsFile = {
  version: number;
  userDefaults: string;
  entries: LogEntry[];
};

export default function LogsClient({ initial }: { initial: LogsFile }) {
  const [file, setFile] = useState<LogsFile>(initial);
  const [defaults, setDefaults] = useState(initial.userDefaults);
  const [filter, setFilter] = useState<"all" | "like" | "dislike">("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

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

  const stats = useMemo(() => {
    const likes = file.entries.filter((e) => e.type === "like").length;
    const dislikes = file.entries.filter((e) => e.type === "dislike").length;
    return { likes, dislikes, total: file.entries.length };
  }, [file.entries]);

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
              bgcolor: "#274e64",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "#1a3a4c" },
            }}
          >
            {saving ? "Saving…" : "Save defaults"}
          </Button>
        </Box>
        <Typography sx={{ fontSize: 12, color: "#5f6368", mb: 1.5 }}>
          Plain text. Example: <em>"Always finish posts with a question. Avoid the word 'solution'.
          For blogs, aim for 600 words minimum."</em>
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
            <Stat value={stats.likes.toString()} label="Likes" color="#2e7d32" />
            <Stat value={stats.dislikes.toString()} label="Dislikes" color="#ed1b2f" />
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
              Likes
            </ToggleButton>
            <ToggleButton value="dislike" sx={{ textTransform: "none", fontSize: 12 }}>
              Dislikes
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
              No entries yet. Like or dislike a proposal on the Content Generation page to start
              teaching the bot.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {entries.map((e) => (
              <Box
                key={e.id}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${e.type === "like" ? "#c8e6c9" : "#ffcdd2"}`,
                  bgcolor: e.type === "like" ? "#f1f8f3" : "#fff5f5",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {e.type === "like" ? (
                    <ThumbUpIcon sx={{ fontSize: 16, color: "#2e7d32" }} />
                  ) : (
                    <ThumbDownIcon sx={{ fontSize: 16, color: "#ed1b2f" }} />
                  )}
                  <Chip
                    size="small"
                    label={e.channel}
                    sx={{ height: 20, fontSize: 10.5, bgcolor: "#fff", border: "1px solid #dde1e6" }}
                  />
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
              </Box>
            ))}
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
        minWidth: 52,
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