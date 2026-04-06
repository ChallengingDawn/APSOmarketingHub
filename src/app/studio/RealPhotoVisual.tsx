"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ProposalVisual, { type VisualTheme } from "./ProposalVisual";

/**
 * RealPhotoVisual — tries to load a real Unsplash photo for the theme.
 * If the photo fails to load, falls back to the SVG ProposalVisual.
 */

interface Props {
  theme: VisualTheme;
  height?: number | string;
}

// Curated Unsplash photo IDs matched to themes (industrial / engineering / lab)
const REAL_PHOTOS: Record<VisualTheme, string> = {
  "oring-fkm": "1581092580497-e0d23cbdf1dc",       // engineering precision
  "oring-food": "1556909114-f6e7ad7d3136",         // food processing
  "oring-failure": "1581092335397-9583eb92d232",   // tools / repair
  "oring-guide": "1581091226825-a6a2a5aee158",     // tech / engineering
  "peek-aerospace": "1540962351326-c1e7c0e2e1c4",  // aircraft engine
  "peek-pomc": "1518770660439-4636190af475",       // circuit / tech
  "pomc": "1565008447742-97f6f38c985c",            // factory / manufacturing
  "pharma": "1576091160550-2173dba999ef",          // laboratory
  "newsletter-q2": "1450101499163-c8848c66ca85",   // office / desk
  "maintenance": "1567789884554-0b844b597180",     // tools
};

const THEME_LABEL: Record<VisualTheme, string> = {
  "oring-fkm": "O-RINGS · CHEMICAL",
  "oring-food": "FOOD-GRADE SEALING",
  "oring-failure": "MAINTENANCE",
  "oring-guide": "MATERIAL GUIDE",
  "peek-aerospace": "PEEK · AEROSPACE",
  "peek-pomc": "PEEK vs POM-C",
  "pomc": "POM-C PRECISION",
  "pharma": "PHARMA SEALING",
  "newsletter-q2": "Q2 UPDATE",
  "maintenance": "MAINTENANCE",
};

function photoUrl(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
}

export default function RealPhotoVisual({ theme, height = 180 }: Props) {
  const [errored, setErrored] = useState(false);

  // Fall back to SVG visual if the photo failed
  if (errored) {
    return <ProposalVisual theme={theme} mode="stock" height={height} />;
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        minHeight: 160,
        bgcolor: "#f1f3f4",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(REAL_PHOTOS[theme])}
        alt={THEME_LABEL[theme]}
        loading="lazy"
        onError={() => setErrored(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />

      {/* Source badge */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: 10,
          px: 1.25,
          py: 0.4,
          borderRadius: 1,
          bgcolor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>
          UNSPLASH
        </Typography>
      </Box>

      {/* Theme label */}
      <Box
        sx={{
          position: "absolute",
          bottom: 10,
          right: 10,
          px: 1.25,
          py: 0.4,
          borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#1f1f1f", letterSpacing: "0.05em" }}>
          {THEME_LABEL[theme]}
        </Typography>
      </Box>
    </Box>
  );
}
