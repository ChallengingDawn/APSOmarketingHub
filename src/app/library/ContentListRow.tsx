"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import ContentThumb from "./ContentThumb";
import { ChannelChip, ScheduledChip, StatusChip } from "./LibraryChips";
import { displayTitle, excerpt, relativeDate, type ContentItem } from "./contentMeta";

interface ContentListRowProps {
  item: ContentItem;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onOpen: (item: ContentItem) => void;
}

export default function ContentListRow({
  item,
  selected,
  onToggleSelect,
  onOpen,
}: ContentListRowProps) {
  const title = displayTitle(item);

  return (
    <Box
      onClick={() => onOpen(item)}
      sx={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderBottom: "1px solid #eef0f3",
        bgcolor: selected ? "#f3f7f9" : "transparent",
        transition: "background-color .12s ease",
        "&:hover": { bgcolor: selected ? "#eaf1f5" : "#fafbfc" },
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Checkbox
        checked={selected}
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(item.id);
        }}
        inputProps={{ "aria-label": `Select ${title}` }}
        sx={{ p: 0.5, color: "#c3c9d0", "&.Mui-checked": { color: "#274e64" } }}
      />

      <Box
        sx={{
          width: 64,
          height: 40,
          flexShrink: 0,
          borderRadius: 1,
          overflow: "hidden",
          border: "1px solid #e3e6ea",
          bgcolor: "#f5f6f8",
        }}
      >
        <ContentThumb channel={item.channel} imageUrl={item.imageUrl} alt={title} compact />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          sx={{
            fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
            fontWeight: 600,
            fontSize: 13.5,
            color: "#1a1d21",
          }}
        >
          {title}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12, color: "#8a929c", mt: 0.15 }}>
          {excerpt(item, 140) || "No body text."}
        </Typography>
      </Box>

      {item.scheduledFor && (
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <ScheduledChip iso={item.scheduledFor} />
        </Box>
      )}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <ChannelChip channel={item.channel} />
      </Box>
      <StatusChip status={item.status} />
      <Typography
        sx={{
          width: 84,
          textAlign: "right",
          fontSize: 11.5,
          color: "#8a929c",
          whiteSpace: "nowrap",
          display: { xs: "none", sm: "block" },
        }}
      >
        {relativeDate(item.createdAt)}
      </Typography>
    </Box>
  );
}
