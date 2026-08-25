"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { ChannelGlyph } from "./ContentThumb";
import {
  channelAccent,
  channelLabel,
  hexToRgba,
  shortDate,
  STATUS_THEME,
  type ContentStatus,
} from "./contentMeta";

export function ChannelChip({ channel }: { channel: string }) {
  const accent = channelAccent(channel);
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 22,
        px: 0.9,
        borderRadius: 1,
        bgcolor: hexToRgba(accent, 0.09),
        color: accent,
        border: `1px solid ${hexToRgba(accent, 0.22)}`,
        flexShrink: 0,
      }}
    >
      <ChannelGlyph channel={channel} size={13} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}>
        {channelLabel(channel)}
      </Typography>
    </Box>
  );
}

export function StatusChip({ status }: { status: ContentStatus }) {
  const theme = STATUS_THEME[status] ?? STATUS_THEME.archived;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 22,
        px: 0.9,
        borderRadius: 1,
        bgcolor: theme.bg,
        color: theme.fg,
        flexShrink: 0,
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: theme.fg }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}>
        {theme.label}
      </Typography>
    </Box>
  );
}

export function ScheduledChip({ iso }: { iso: string }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 22,
        px: 0.9,
        borderRadius: 1,
        // Sits on top of artwork that is usually dark navy, so a navy chip
        // disappears — near-black plus a hairline keeps it legible on anything.
        bgcolor: "rgba(8, 16, 22, 0.82)",
        border: "1px solid rgba(255,255,255,0.3)",
        backdropFilter: "blur(4px)",
        color: "#fff",
        flexShrink: 0,
      }}
    >
      <ScheduleIcon sx={{ fontSize: 13 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>Scheduled {shortDate(iso)}</Typography>
    </Box>
  );
}
