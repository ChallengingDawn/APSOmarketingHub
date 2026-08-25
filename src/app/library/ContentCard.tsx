"use client";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import ContentThumb from "./ContentThumb";
import { ChannelChip, ScheduledChip, StatusChip } from "./LibraryChips";
import { displayTitle, excerpt, relativeDate, type ContentItem } from "./contentMeta";

const clamp = (lines: number) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
});

interface ContentCardProps {
  item: ContentItem;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onOpen: (item: ContentItem) => void;
}

export default function ContentCard({ item, selected, onToggleSelect, onOpen }: ContentCardProps) {
  const title = displayTitle(item);
  const preview = excerpt(item);

  return (
    <Paper
      elevation={0}
      onClick={() => onOpen(item)}
      sx={{
        cursor: "pointer",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: selected ? "#274e64" : "#e3e6ea",
        boxShadow: selected ? "0 0 0 1px #274e64" : "none",
        display: "flex",
        flexDirection: "column",
        transition: "transform .16s ease, box-shadow .16s ease, border-color .16s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: selected
            ? "0 0 0 1px #274e64, 0 10px 24px rgba(26,29,33,.10)"
            : "0 10px 24px rgba(26,29,33,.10)",
          borderColor: selected ? "#274e64" : "#cfd5dc",
        },
        "&:hover .card-select": { opacity: 1 },
      }}
    >
      <Box sx={{ position: "relative", aspectRatio: "16 / 10", bgcolor: "#f5f6f8" }}>
        <ContentThumb channel={item.channel} imageUrl={item.imageUrl} alt={title} />

        <Box
          className="card-select"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          sx={{
            position: "absolute",
            top: 6,
            left: 6,
            opacity: selected ? 1 : 0,
            transition: "opacity .14s ease",
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,.92)",
            boxShadow: "0 1px 4px rgba(26,29,33,.18)",
            lineHeight: 0,
          }}
        >
          <Checkbox
            checked={selected}
            size="small"
            inputProps={{ "aria-label": `Select ${title}` }}
            sx={{ p: 0.4, color: "#5b6470", "&.Mui-checked": { color: "#274e64" } }}
          />
        </Box>

        {item.scheduledFor && (
          <Box sx={{ position: "absolute", left: 8, bottom: 8 }}>
            <ScheduledChip iso={item.scheduledFor} />
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.75, pb: 1.25, display: "flex", flexDirection: "column", flex: 1, gap: 0.75 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
            fontWeight: 600,
            fontSize: 14.5,
            lineHeight: 1.35,
            color: "#1a1d21",
            letterSpacing: "-0.01em",
            minHeight: 39,
            ...clamp(2),
          }}
        >
          {title}
        </Typography>

        <Typography sx={{ fontSize: 12.5, lineHeight: 1.55, color: "#5b6470", flex: 1, ...clamp(2) }}>
          {preview || "No body text."}
        </Typography>

        <Box
          sx={{
            mt: 0.75,
            pt: 1.25,
            borderTop: "1px solid #eef0f3",
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <ChannelChip channel={item.channel} />
          <StatusChip status={item.status} />
          <Typography sx={{ ml: "auto", fontSize: 11.5, color: "#8a929c", whiteSpace: "nowrap" }}>
            {relativeDate(item.createdAt)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
