"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * BlogVisual — real blog post card preview.
 * Renders like a Medium/Substack-style blog card with featured hero + title + excerpt.
 */

interface Props {
  title?: string;
  excerpt?: string;
  readingTime?: string;
  category?: string;
  height?: number | string;
}

export default function BlogVisual({
  title = "APSOparts Blog",
  excerpt = "",
  readingTime = "8 min read",
  category = "Technical",
  height = 180,
}: Props) {
  const excerptClean = (excerpt || "")
    .replace(/📰[\s\S]*?\n\n/, "")
    .replace(/Reading time:[^\n]*\n/, "")
    .replace(/\n+/g, " ")
    .replace(/— [^—]+? —/g, "")
    .replace(/[📬🔹🛩⚙️✅❌🚀📊]/gu, "")
    .trim()
    .slice(0, 140);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        bgcolor: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left: featured image area */}
      <Box
        sx={{
          flex: "0 0 42%",
          position: "relative",
          background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 55%, #325f78 100%)",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 200 180"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* Grid texture */}
          <g opacity="0.08" stroke="#fff" strokeWidth="1">
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="180" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 36} x2="200" y2={i * 36} />
            ))}
          </g>
          {/* O-ring motif */}
          <circle cx="100" cy="90" r="52" fill="none" stroke="#ed1b2f" strokeWidth="8" opacity="0.95" />
          <circle cx="100" cy="90" r="34" fill="none" stroke="#fff" strokeWidth="2" opacity="0.4" />
          <circle cx="100" cy="90" r="18" fill="#ed1b2f" opacity="0.35" />
          {/* Corner accent */}
          <path d="M 0 150 L 50 130 L 0 110 Z" fill="#fff" opacity="0.05" />
        </svg>
        {/* Category pill */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            px: 1,
            py: 0.35,
            borderRadius: 0.75,
            bgcolor: "#ed1b2f",
          }}
        >
          <Typography sx={{ color: "#fff", fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {category}
          </Typography>
        </Box>
      </Box>

      {/* Right: article content */}
      <Box sx={{ flex: 1, p: 1.75, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Breadcrumb / site */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#ed1b2f" }} />
          <Typography sx={{ fontSize: "0.55rem", fontWeight: 700, color: "#5f6368", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            APSOPARTS · BLOG
          </Typography>
        </Box>

        {/* Title */}
        <Typography
          sx={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "#1f1f1f",
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
            mb: 0.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Typography>

        {/* Excerpt */}
        <Typography
          sx={{
            fontSize: "0.64rem",
            color: "#5f6368",
            lineHeight: 1.45,
            mb: "auto",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {excerptClean}…
        </Typography>

        {/* Footer meta */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.75, pt: 0.75, borderTop: "1px solid #f1f3f4" }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ed1b2f 0%, #274e64 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ color: "#fff", fontSize: "0.5rem", fontWeight: 800 }}>AP</Typography>
          </Box>
          <Typography sx={{ fontSize: "0.58rem", fontWeight: 600, color: "#3c4043" }}>
            APSOparts
          </Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "#dadce0" }} />
          <Typography sx={{ fontSize: "0.58rem", color: "#5f6368" }}>
            {readingTime}
          </Typography>
        </Box>
      </Box>

      {/* Source badge */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          px: 1,
          py: 0.3,
          borderRadius: 0.75,
          bgcolor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Typography sx={{ fontSize: "0.52rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>
          BLOG
        </Typography>
      </Box>
    </Box>
  );
}
