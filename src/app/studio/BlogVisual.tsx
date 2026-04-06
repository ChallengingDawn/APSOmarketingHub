"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { VisualTheme } from "./ProposalVisual";

/**
 * BlogVisual — blog post card with REAL Unsplash hero photo.
 * Magazine-style layout: full-width hero image + title overlay + meta footer.
 */

interface Props {
  title?: string;
  excerpt?: string;
  readingTime?: string;
  category?: string;
  theme?: VisualTheme;
  height?: number | string;
}

const REAL_PHOTOS: Record<string, string> = {
  "oring-fkm": "https://www.kinsoe.com/wp-content/uploads/2025/06/FKM-vs-FFKM-O-Rings-Comparison.webp",
  "oring-food": "https://www.fst.com/-/media/images/pr/2025/03/fst_epdm335dw_1000x666px.jpg",
  "oring-failure": "https://www.globaloring.com/wp-content/uploads/2021/05/O-Ring-Failure-Rapid-Gas-Decompression-1-scaled.jpg",
  "oring-guide": "https://www.gtweed.com/wp-content/uploads/2023/01/fkm-ffkm-header2.webp",
  "peek-aerospace": "https://www.piedmontplastics.com/img/asset/cGFnZV9idWlsZGVyL3BlZWstcGFydHMtcGllZG1vbnQucG5n/peek-parts-piedmont.png?w=1024&h=511.03396226415&fit=crop&q=85&s=fdd7e0e3761fb80c00ec63d0bb949e4c",
  "peek-pomc": "https://polyfluoroltd.com/poly-admin/assets/uploads/events/images/0zPM1tqZxWcpsVYy.JPG",
  "pomc": "https://www.plastique-cauwet.com/wp-content/uploads/elementor/thumbs/POM-C.jpg-rcm67atj5lv168f7jjsubplb6tx4v9liqidhpz2256.webp",
  "pharma": "1576091160550-2173dba999ef",
  "newsletter-q2": "1586528116311-ad8dd3c8310d",
  "maintenance": "1581092335397-9583eb92d232",
};

function photoUrl(idOrUrl: string): string {
  if (idOrUrl.startsWith("http")) return idOrUrl;
  return `https://images.unsplash.com/photo-${idOrUrl}?w=900&q=80&auto=format&fit=crop`;
}

export default function BlogVisual({
  title = "APSOparts Blog",
  readingTime = "8 min read",
  category = "Technical",
  theme = "oring-guide",
  height = 180,
}: Props) {
  const [errored, setErrored] = useState(false);
  const photoId = REAL_PHOTOS[theme] ?? REAL_PHOTOS["oring-guide"];

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        bgcolor: "#1a3a4c",
        overflow: "hidden",
      }}
    >
      {/* Hero photo */}
      {!errored && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(photoId)}
          alt={title}
          loading="lazy"
          onError={() => setErrored(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      {/* Dark gradient overlay for legibility */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Top row: category + blog badge */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Box
          sx={{
            px: 1.1,
            py: 0.4,
            borderRadius: 0.75,
            bgcolor: "#ed1b2f",
          }}
        >
          <Typography
            sx={{
              color: "#fff",
              fontSize: "0.6rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {category}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1,
            py: 0.3,
            borderRadius: 0.75,
            bgcolor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.55rem",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.05em",
            }}
          >
            UNSPLASH
          </Typography>
        </Box>
      </Box>

      {/* Bottom: title + meta */}
      <Box
        sx={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 12,
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: "0.92rem",
            fontWeight: 600,
            color: "#fff",
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
            mb: 0.75,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
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
          <Typography sx={{ fontSize: "0.62rem", fontWeight: 600, color: "#fff" }}>
            APSOparts
          </Typography>
          <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.6)" }} />
          <Typography sx={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.85)" }}>
            {readingTime}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
