"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import EmailIcon from "@mui/icons-material/Email";

/**
 * NewsletterVisual — mockup preview that looks like an email newsletter.
 * Used in place of real photos for Newsletter-channel proposals.
 */

interface Props {
  subject?: string;
  height?: number | string;
}

export default function NewsletterVisual({ subject = "APSOparts Newsletter", height = 180 }: Props) {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        bgcolor: "#f1f3f4",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* APSO branded header bar */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #1a3a4c 0%, #274e64 100%)",
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EmailIcon sx={{ color: "#fff", fontSize: 16 }} />
          <Typography sx={{ color: "#fff", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em" }}>
            APSOPARTS NEWSLETTER
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.4 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
        </Box>
        {/* Red accent underline */}
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #ed1b2f 0%, #ed1b2f 30%, transparent 100%)",
          }}
        />
      </Box>

      {/* Body mockup */}
      <Box
        sx={{
          flex: 1,
          bgcolor: "#fff",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {/* Subject preview */}
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#1f1f1f",
            letterSpacing: "-0.01em",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {subject}
        </Typography>

        {/* Fake text lines */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.25 }}>
          <Box sx={{ height: 5, borderRadius: 2, bgcolor: "#ececec", width: "100%" }} />
          <Box sx={{ height: 5, borderRadius: 2, bgcolor: "#ececec", width: "95%" }} />
          <Box sx={{ height: 5, borderRadius: 2, bgcolor: "#ececec", width: "88%" }} />
        </Box>

        {/* Divider + section */}
        <Box sx={{ mt: 0.5, pt: 0.75, borderTop: "1px dashed #ececec", display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box sx={{ height: 5, borderRadius: 2, bgcolor: "#e8f0f4", width: "60%" }} />
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#ececec", width: "100%" }} />
          <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#ececec", width: "80%" }} />
        </Box>

        {/* Fake CTA */}
        <Box
          sx={{
            mt: "auto",
            alignSelf: "flex-start",
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: "#ed1b2f",
          }}
        >
          <Typography sx={{ color: "#fff", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.03em" }}>
            READ MORE →
          </Typography>
        </Box>
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
          EMAIL PREVIEW
        </Typography>
      </Box>
    </Box>
  );
}
