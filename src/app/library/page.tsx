"use client";
import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PublishIcon from "@mui/icons-material/Publish";
import ArchiveIcon from "@mui/icons-material/Archive";
import RefreshIcon from "@mui/icons-material/Refresh";
import BrushIcon from "@mui/icons-material/Brush";
import Link from "next/link";

type ContentItem = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  status: "draft" | "approved" | "published" | "archived";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#fff4e0", fg: "#c77700" },
  approved: { bg: "#e5f3ea", fg: "#1e7e45" },
  published: { bg: "#e3edf7", fg: "#2563a8" },
  archived: { bg: "#f0f1f3", fg: "#5b6470" },
};

const CHANNELS = ["all", "linkedin", "newsletter", "blog", "ad", "product", "seo"];
const STATUSES = ["all", "draft", "approved", "published", "archived"];

export default function LibraryPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [viewing, setViewing] = useState<ContentItem | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (channel !== "all") params.set("channel", channel);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/content?${params}`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [channel, status]);

  useEffect(() => {
    load();
  }, [load]);

  const setItemStatus = async (id: number, next: string) => {
    const res = await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const { item } = await res.json();
      setItems((cur) => cur.map((i) => (i.id === id ? item : i)));
      if (viewing?.id === id) setViewing(item);
    }
  };

  const copyBody = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1a1d21" }}>
            Content Library
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#5b6470", mt: 0.5 }}>
            Every generation lands here as a draft — review, approve, publish.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} size="small">
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {CHANNELS.map((c) => (
            <Chip
              key={c}
              label={c === "all" ? "All channels" : c}
              size="small"
              onClick={() => setChannel(c)}
              sx={{
                fontWeight: 600,
                bgcolor: channel === c ? "#274e64" : "#f0f1f3",
                color: channel === c ? "#fff" : "#3c4043",
                "&:hover": { bgcolor: channel === c ? "#1a3a4c" : "#e6e8ec" },
              }}
            />
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={s === "all" ? "All statuses" : s}
              size="small"
              onClick={() => setStatus(s)}
              sx={{
                fontWeight: 600,
                bgcolor: status === s ? "#ed1b2f" : "#f0f1f3",
                color: status === s ? "#fff" : "#3c4043",
                "&:hover": { bgcolor: status === s ? "#d81528" : "#e6e8ec" },
              }}
            />
          ))}
        </Box>
      </Box>

      <Card sx={{ overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: 14, color: "#5b6470" }}>
              Nothing here yet — generate content and it will appear as drafts.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.archived;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ maxWidth: 420 }}>
                      <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, color: "#1a1d21" }}>
                        {item.title || item.body.slice(0, 80)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.channel} size="small" sx={{ fontWeight: 600, bgcolor: "#f0f1f3" }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={item.status} size="small" sx={{ fontWeight: 700, bgcolor: sc.bg, color: sc.fg }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: "#5b6470", whiteSpace: "nowrap" }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: "#5b6470" }}>{item.createdBy ?? "—"}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => setViewing(item)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy body">
                        <IconButton size="small" onClick={() => copyBody(item.body)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {item.status === "draft" && (
                        <Tooltip title="Approve">
                          <IconButton size="small" onClick={() => setItemStatus(item.id, "approved")} sx={{ color: "#1e7e45" }}>
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {item.status === "approved" && (
                        <Tooltip title="Mark published">
                          <IconButton size="small" onClick={() => setItemStatus(item.id, "published")} sx={{ color: "#2563a8" }}>
                            <PublishIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {item.status !== "archived" && (
                        <Tooltip title="Archive">
                          <IconButton size="small" onClick={() => setItemStatus(item.id, "archived")} sx={{ color: "#5b6470" }}>
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* View dialog */}
      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        {viewing && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              <Typography component="span" sx={{ fontWeight: 700, fontSize: 17 }}>
                {viewing.title || `${viewing.channel} content #${viewing.id}`}
              </Typography>
              <Box sx={{ mt: 0.75, display: "flex", gap: 0.75 }}>
                <Chip label={viewing.channel} size="small" sx={{ fontWeight: 600 }} />
                <Chip
                  label={viewing.status}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: STATUS_COLORS[viewing.status]?.bg,
                    color: STATUS_COLORS[viewing.status]?.fg,
                  }}
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {viewing.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewing.imageUrl}
                  alt=""
                  style={{ maxWidth: "100%", borderRadius: 6, marginBottom: 12 }}
                />
              )}
              <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.65, color: "#1a1d21" }}>
                {viewing.body}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 1.5 }}>
              <Button component={Link} href={`/editor?item=${viewing.id}`} startIcon={<BrushIcon />} sx={{ color: "#ed1b2f", fontWeight: 700 }}>
                Open in editor
              </Button>
              <Button startIcon={<ContentCopyIcon />} onClick={() => copyBody(viewing.body)}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              {viewing.status === "draft" && (
                <Button startIcon={<CheckCircleIcon />} color="success" variant="contained" onClick={() => setItemStatus(viewing.id, "approved")}>
                  Approve
                </Button>
              )}
              {viewing.status === "approved" && (
                <Button startIcon={<PublishIcon />} variant="contained" onClick={() => setItemStatus(viewing.id, "published")}>
                  Mark published
                </Button>
              )}
              <Button onClick={() => setViewing(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
