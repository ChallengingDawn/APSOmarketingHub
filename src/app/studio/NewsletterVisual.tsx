"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * NewsletterVisual — real email preview mockup.
 * Renders like an actual email client preview with real content.
 */

interface Props {
  subject?: string;
  preview?: string;
  height?: number | string;
}

export default function NewsletterVisual({
  subject = "APSOparts Newsletter",
  preview = "",
  height = 180,
}: Props) {
  // Derive a short preview line from the post text
  const previewLine = (preview || "Latest updates on sealings & plastics from APSOparts")
    .replace(/📬[\s\S]*?\n\n/, "")
    .replace(/Hi \{first_name\},?\n\n/, "")
    .replace(/\n+/g, " ")
    .replace(/[📬🔹🛩⚙️✅❌🚀📊🍽🍽️]/gu, "")
    .trim()
    .slice(0, 120);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        bgcolor: "#f6f8fa",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Email client toolbar */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderBottom: "1px solid #ececec",
          px: 1.5,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#ff5f57" }} />
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#febc2e" }} />
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#28c840" }} />
        <Typography sx={{ ml: 1.25, fontSize: "0.6rem", fontWeight: 500, color: "#5f6368" }}>
          Inbox — APSOparts
        </Typography>
      </Box>

      {/* Email content */}
      <Box sx={{ flex: 1, bgcolor: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* From/To header row */}
        <Box sx={{ px: 1.75, pt: 1.25, pb: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ color: "#fff", fontSize: "0.55rem", fontWeight: 900, letterSpacing: "0.05em" }}>
              AP
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1f1f1f", lineHeight: 1.2 }}>
              APSOparts{" "}
              <Box component="span" sx={{ color: "#5f6368", fontWeight: 400 }}>
                &lt;news@apsoparts.com&gt;
              </Box>
            </Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "#5f6368", lineHeight: 1.2 }}>
              to me · 9:42
            </Typography>
          </Box>
          {/* Tiny fake action icons */}
          <Box sx={{ display: "flex", gap: 0.4 }}>
            <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#dadce0" }} />
            <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#dadce0" }} />
            <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#dadce0" }} />
          </Box>
        </Box>

        {/* Subject line */}
        <Box sx={{ px: 1.75, pb: 0.5 }}>
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#1f1f1f",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {subject}
          </Typography>
        </Box>

        {/* APSO red bar separator (email brand hint) */}
        <Box sx={{ mx: 1.75, my: 0.25, height: 2, borderRadius: 1, background: "linear-gradient(90deg, #ed1b2f 0%, #274e64 100%)" }} />

        {/* Preview snippet */}
        <Box sx={{ px: 1.75, pt: 0.75, flex: 1, minHeight: 0 }}>
          <Typography
            sx={{
              fontSize: "0.68rem",
              color: "#3c4043",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {previewLine}…
          </Typography>
        </Box>

        {/* Footer bar with fake CTA */}
        <Box
          sx={{
            px: 1.75,
            py: 1,
            borderTop: "1px solid #f1f3f4",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontSize: "0.55rem", color: "#5f6368", fontWeight: 500 }}>
            apsoparts.com
          </Typography>
          <Box
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 0.75,
              bgcolor: "#ed1b2f",
            }}
          >
            <Typography sx={{ color: "#fff", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.05em" }}>
              READ MORE →
            </Typography>
          </Box>
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
          EMAIL
        </Typography>
      </Box>
    </Box>
  );
}
