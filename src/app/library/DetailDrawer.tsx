"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import BrushIcon from "@mui/icons-material/Brush";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PublishIcon from "@mui/icons-material/Publish";
import ArchiveIcon from "@mui/icons-material/Archive";
import UndoIcon from "@mui/icons-material/Undo";
import Link from "next/link";
import MarkdownPreview from "@/app/create/MarkdownPreview";
import ContentThumb from "./ContentThumb";
import { ChannelChip, ScheduledChip, StatusChip } from "./LibraryChips";
import {
  displayTitle,
  fullDate,
  imageExtension,
  type ContentItem,
  type ContentStatus,
} from "./contentMeta";

const LABEL_SX = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "#5b6470",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.85, borderBottom: "1px solid #eef0f3" }}>
      <Typography sx={{ ...LABEL_SX, width: 96, flexShrink: 0, pt: 0.15 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: "#1a1d21", wordBreak: "break-word" }}>{value}</Typography>
    </Box>
  );
}

interface DetailDrawerProps {
  item: ContentItem | null;
  onClose: () => void;
  onStatus: (id: number, next: ContentStatus) => void;
  busy: boolean;
}

export default function DetailDrawer({ item, onClose, onStatus, busy }: DetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={Boolean(item)}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 560 }, borderLeft: "1px solid #e3e6ea" } }}
    >
      {item && (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderBottom: "1px solid #e3e6ea",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ ...LABEL_SX, mb: 0.5 }}>Piece #{item.id}</Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                  fontWeight: 600,
                  fontSize: 19,
                  lineHeight: 1.25,
                  letterSpacing: "-0.02em",
                  color: "#1a1d21",
                }}
              >
                {displayTitle(item)}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                <ChannelChip channel={item.channel} />
                <StatusChip status={item.status} />
                {item.scheduledFor && <ScheduledChip iso={item.scheduledFor} />}
              </Box>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close details">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.25 }}>
            <Box
              sx={{
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid #e3e6ea",
                bgcolor: "#f5f6f8",
                aspectRatio: item.imageUrl ? "auto" : "16 / 9",
                mb: 2.5,
              }}
            >
              <ContentThumb
                channel={item.channel}
                imageUrl={item.imageUrl}
                alt={displayTitle(item)}
                natural
              />
            </Box>

            <Typography sx={{ ...LABEL_SX, mb: 1 }}>Content</Typography>
            <Box
              sx={{
                border: "1px solid #e3e6ea",
                borderRadius: 2,
                p: 2,
                bgcolor: "#fff",
                mb: 2.5,
              }}
            >
              <MarkdownPreview text={item.body} />
            </Box>

            <Typography sx={{ ...LABEL_SX, mb: 0.5 }}>Details</Typography>
            <Box>
              <MetaRow label="Channel" value={item.channel} />
              <MetaRow label="Status" value={item.status} />
              <MetaRow label="Created by" value={item.createdBy ?? "—"} />
              <MetaRow label="Created" value={fullDate(item.createdAt)} />
              <MetaRow label="Updated" value={fullDate(item.updatedAt)} />
              {item.scheduledFor && <MetaRow label="Scheduled" value={fullDate(item.scheduledFor)} />}
              <MetaRow label="Visual" value={item.imageUrl ? "Image attached" : "No visual"} />
            </Box>

            <Typography sx={{ ...LABEL_SX, mt: 2.5, mb: 1 }}>Actions</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={() => copy(item.body)}
                sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#274e64" }}
              >
                {copied ? "Copied" : "Copy text"}
              </Button>
              {item.imageUrl && (
                <Button
                  size="small"
                  variant="outlined"
                  component="a"
                  href={item.imageUrl}
                  download={`apso-content-${item.id}.${imageExtension(item.imageUrl)}`}
                  startIcon={<DownloadIcon />}
                  sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#274e64" }}
                >
                  Download image
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href="/create"
                startIcon={<AutoAwesomeIcon />}
                sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#274e64" }}
              >
                Open in Studio
              </Button>
              <Button
                size="small"
                variant="outlined"
                component={Link}
                href={`/editor?item=${item.id}`}
                startIcon={<BrushIcon />}
                sx={{ textTransform: "none", fontWeight: 600, borderColor: "#e3e6ea", color: "#ed1b2f" }}
              >
                Edit design
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderTop: "1px solid #e3e6ea",
              bgcolor: "#fafbfc",
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            {item.status === "draft" && (
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={busy}
                startIcon={<CheckCircleIcon />}
                onClick={() => onStatus(item.id, "approved")}
                sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#1e7e45", "&:hover": { bgcolor: "#186636" } }}
              >
                Approve
              </Button>
            )}
            {(item.status === "approved" || item.status === "draft") && (
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={busy}
                startIcon={<PublishIcon />}
                onClick={() => onStatus(item.id, "published")}
                sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#274e64", "&:hover": { bgcolor: "#1a3a4c" } }}
              >
                Mark published
              </Button>
            )}
            {item.status === "archived" ? (
              <Button
                size="small"
                disabled={busy}
                startIcon={<UndoIcon />}
                onClick={() => onStatus(item.id, "draft")}
                sx={{ textTransform: "none", fontWeight: 600, color: "#5b6470" }}
              >
                Restore to draft
              </Button>
            ) : (
              <Tooltip title="Move out of the active pipeline">
                <Button
                  size="small"
                  disabled={busy}
                  startIcon={<ArchiveIcon />}
                  onClick={() => onStatus(item.id, "archived")}
                  sx={{ textTransform: "none", fontWeight: 600, color: "#5b6470" }}
                >
                  Archive
                </Button>
              </Tooltip>
            )}
            <Button
              size="small"
              onClick={onClose}
              sx={{ ml: "auto", textTransform: "none", fontWeight: 600, color: "#5b6470" }}
            >
              Close
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
