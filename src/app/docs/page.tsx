import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DescriptionIcon from "@mui/icons-material/Description";
import SecurityIcon from "@mui/icons-material/Security";

const HAIRLINE = "#e3e6ea";
const INK = "#1a1d21";
const MUTED = "#5b6470";

/**
 * Index for the two documents shipped in public/docs. Nav points here, so the
 * entry resolves instead of 404-ing on a bare /docs.
 */
const DOCS = [
  {
    href: "/docs/technical-roadmap",
    title: "Technical Roadmap",
    subtitle: "Phased deployment strategy, architecture, stack, integrations and risk matrix",
    file: "docs/TECHNICAL-ROADMAP.md",
    accent: "#274e64",
    security: false,
  },
  {
    href: "/docs/security-infrastructure",
    title: "Security Infrastructure",
    subtitle: "Hosting, data residency, authentication, secrets and access control",
    file: "docs/SECURITY-INFRASTRUCTURE.md",
    accent: "#ed1b2f",
    security: true,
  },
];

export default function DocsIndexPage() {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box sx={{ width: 4, height: 28, borderRadius: 4, bgcolor: "#274e64" }} />
          <Typography
            sx={{
              fontFamily: "var(--font-outfit), 'Outfit', 'Inter', sans-serif",
              fontSize: "1.75rem",
              fontWeight: 600,
              color: INK,
              letterSpacing: "-0.02em",
            }}
          >
            Docs
          </Typography>
        </Box>
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, ml: 2.5 }}>
          Documentation shipped with this build, rendered from the markdown files in the repository.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {DOCS.map((doc) => (
          <Box
            key={doc.href}
            component={Link}
            href={doc.href}
            sx={{
              display: "block",
              textDecoration: "none",
              border: `1px solid ${HAIRLINE}`,
              borderTop: `3px solid ${doc.accent}`,
              borderRadius: 2,
              bgcolor: "#fff",
              p: 3,
              transition: "box-shadow 0.15s ease, transform 0.15s ease",
              "&:hover": { boxShadow: "0 2px 10px rgba(0,0,0,0.08)", transform: "translateY(-1px)" },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: `${doc.accent}22`,
                color: doc.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
              }}
            >
              {doc.security ? <SecurityIcon /> : <DescriptionIcon />}
            </Box>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.5 }}>
              {doc.title}
            </Typography>
            <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 1.5, lineHeight: 1.55 }}>
              {doc.subtitle}
            </Typography>
            <Typography
              sx={{ fontSize: "0.75rem", color: MUTED, fontFamily: "'SF Mono', Menlo, monospace" }}
            >
              {doc.file}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
