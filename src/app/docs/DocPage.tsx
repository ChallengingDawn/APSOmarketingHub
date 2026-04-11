"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import SecurityIcon from "@mui/icons-material/Security";
import DescriptionIcon from "@mui/icons-material/Description";
import MarkdownView from "./MarkdownView";

interface Props {
  slug: "technical-roadmap" | "security-infrastructure";
  title: string;
  subtitle: string;
  accent: string;
  icon: "roadmap" | "security";
}

const FILE_BY_SLUG: Record<Props["slug"], string> = {
  "technical-roadmap": "TECHNICAL-ROADMAP.md",
  "security-infrastructure": "SECURITY-INFRASTRUCTURE.md",
};

export default function DocPage({ slug, title, subtitle, accent, icon }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/docs/${FILE_BY_SLUG[slug]}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Box sx={{ width: 4, height: 28, borderRadius: 4, bgcolor: accent }} />
          <Typography
            sx={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: "1.75rem",
              fontWeight: 600,
              color: "#1f1f1f",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </Typography>
          <Chip
            label="GDS"
            size="small"
            sx={{
              ml: 1,
              height: 20,
              fontSize: "0.6rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              bgcolor: accent,
              color: "#fff",
              border: "none",
            }}
          />
        </Box>
        <Typography sx={{ fontSize: "0.9rem", color: "#5f6368", ml: 2.5 }}>
          {subtitle}
        </Typography>
      </Box>

      {/* ── Document card ── */}
      <Card
        sx={{
          borderRadius: 4,
          border: "1px solid #ececec",
          borderTop: `3px solid ${accent}`,
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 3,
              pb: 2,
              borderBottom: "1px solid #f1f3f4",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: `${accent}22`,
                color: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icon === "security" ? <SecurityIcon /> : <DescriptionIcon />}
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "#5f6368",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Documentation for Group Data Security
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  color: "#3c4043",
                  fontFamily: "'SF Mono', Menlo, monospace",
                }}
              >
                docs/{FILE_BY_SLUG[slug]}
              </Typography>
            </Box>
          </Box>

          {content === null && !error && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} sx={{ color: accent }} />
            </Box>
          )}

          {error && (
            <Typography sx={{ color: "#ea4335", fontSize: "0.85rem" }}>
              Failed to load document: {error}
            </Typography>
          )}

          {content && <MarkdownView content={content} />}
        </CardContent>
      </Card>
    </Box>
  );
}
