"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArticleIcon from "@mui/icons-material/Article";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

/**
 * BlogVisual — mockup preview that looks like a blog post card.
 * Used in place of real photos for Blog-channel proposals.
 */

interface Props {
  title?: string;
  readingTime?: string;
  height?: number | string;
}

export default function BlogVisual({ title = "APSOparts Blog", readingTime = "8 min", height = 180 }: Props) {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hero area — abstract geometric pattern */}
      <Box
        sx={{
          flex: "0 0 60%",
          background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 50%, #325f78 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Abstract shapes */}
        <svg
          viewBox="0 0 400 120"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* Grid lines */}
          <g opacity="0.08" stroke="#fff" strokeWidth="1">
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 50} y1="0" x2={i * 50} y2="120" />
            ))}
            {Array.from({ length: 4 }).map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 30} x2="400" y2={i * 30} />
            ))}
          </g>
          {/* Accent circles */}
          <circle cx="60" cy="40" r="28" fill="none" stroke="#ed1b2f" strokeWidth="3" opacity="0.9" />
          <circle cx="60" cy="40" r="18" fill="none" stroke="#ed1b2f" strokeWidth="2" opacity="0.5" />
          <circle cx="60" cy="40" r="6" fill="#ed1b2f" opacity="0.7" />
          {/* Bar graph mock */}
          <g transform="translate(130 65)">
            <rect x="0" y="20" width="10" height="30" fill="#fff" opacity="0.9" rx="1" />
            <rect x="16" y="10" width="10" height="40" fill="#fff" opacity="0.8" rx="1" />
            <rect x="32" y="25" width="10" height="25" fill="#fff" opacity="0.7" rx="1" />
            <rect x="48" y="0" width="10" height="50" fill="#ed1b2f" opacity="0.95" rx="1" />
            <rect x="64" y="15" width="10" height="35" fill="#fff" opacity="0.6" rx="1" />
          </g>
          {/* Diagonal accent */}
          <path d="M 260 0 L 400 0 L 400 80 L 260 120 Z" fill="#fff" opacity="0.04" />
          <circle cx="340" cy="45" r="22" fill="none" stroke="#fff" strokeWidth="2" opacity="0.35" />
          <circle cx="340" cy="45" r="12" fill="#fff" opacity="0.18" />
        </svg>

        {/* Category tag overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            px: 1.25,
            py: 0.4,
            borderRadius: 1,
            bgcolor: "#ed1b2f",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <ArticleIcon sx={{ fontSize: 11, color: "#fff" }} />
          <Typography sx={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em" }}>
            APSOPARTS BLOG
          </Typography>
        </Box>
      </Box>

      {/* Bottom: title + metadata preview (like a blog card foot) */}
      <Box
        sx={{
          flex: 1,
          bgcolor: "#fff",
          px: 2,
          py: 1.25,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 0.5,
          borderBottom: "1px solid #ececec",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <AccessTimeIcon sx={{ fontSize: 11, color: "#5f6368" }} />
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 600, color: "#5f6368", letterSpacing: "0.03em" }}>
            {readingTime} READ
          </Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "#dadce0" }} />
          <Typography sx={{ fontSize: "0.6rem", fontWeight: 600, color: "#5f6368" }}>
            Technical
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#1f1f1f",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Typography>
      </Box>

      {/* Source badge */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          right: 10,
          px: 1.25,
          py: 0.4,
          borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#1f1f1f", letterSpacing: "0.05em" }}>
          BLOG PREVIEW
        </Typography>
      </Box>
    </Box>
  );
}
