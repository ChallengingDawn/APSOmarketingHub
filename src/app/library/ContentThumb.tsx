"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { channelAccent, hexToRgba } from "./contentMeta";

export function ChannelGlyph({ channel, size }: { channel: string; size: number }) {
  const sx = { fontSize: size };
  switch (channel.toLowerCase()) {
    case "linkedin":
    case "social":
      return <LinkedInIcon sx={sx} />;
    case "newsletter":
    case "email":
      return <MailOutlineIcon sx={sx} />;
    case "blog":
      return <ArticleOutlinedIcon sx={sx} />;
    case "ad":
    case "ads":
      return <CampaignOutlinedIcon sx={sx} />;
    case "product":
      return <Inventory2OutlinedIcon sx={sx} />;
    case "seo":
      return <TravelExploreOutlinedIcon sx={sx} />;
    default:
      return <AutoAwesomeOutlinedIcon sx={sx} />;
  }
}

interface ContentThumbProps {
  channel: string;
  imageUrl: string | null;
  alt: string;
  /** 16:10 cover for cards; `compact` is the 64x40 list thumbnail. */
  compact?: boolean;
  /** Detail preview: let the image keep its own aspect ratio instead of cropping. */
  natural?: boolean;
}

/**
 * Renders the real image when one exists, otherwise a channel-tinted placeholder.
 * Never substitutes stock imagery — an item with no visual must look like one.
 */
export default function ContentThumb({
  channel,
  imageUrl,
  alt,
  compact = false,
  natural = false,
}: ContentThumbProps) {
  const accent = channelAccent(channel);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        style={
          natural
            ? { width: "100%", height: "auto", display: "block" }
            : { width: "100%", height: "100%", objectFit: "cover", display: "block" }
        }
      />
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 0 : 0.75,
        color: hexToRgba(accent, 0.7),
        background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 45%, #f5f6f8 100%)`,
        backgroundColor: "#f5f6f8",
      }}
    >
      <ChannelGlyph channel={channel} size={compact ? 16 : 26} />
      {!compact && (
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: hexToRgba(accent, 0.75),
          }}
        >
          No visual
        </Typography>
      )}
    </Box>
  );
}
