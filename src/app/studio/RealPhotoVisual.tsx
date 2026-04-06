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

// Per-theme image source. Can be either a full URL or an Unsplash photo ID.
const REAL_PHOTOS: Record<VisualTheme, string> = {
  "oring-fkm": "https://www.kinsoe.com/wp-content/uploads/2025/06/FKM-vs-FFKM-O-Rings-Comparison.webp",
  "oring-food": "https://www.fst.com/-/media/images/pr/2025/03/fst_epdm335dw_1000x666px.jpg",
  "oring-failure": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrpd1sBkHybrh25afp7Nuo-h918e8cxq5Vaw&s",
  "oring-guide": "1581094794329-c8112a89af12",
  "peek-aerospace": "https://www.piedmontplastics.com/img/asset/cGFnZV9idWlsZGVyL3BlZWstcGFydHMtcGllZG1vbnQucG5n/peek-parts-piedmont.png?w=1024&h=511.03396226415&fit=crop&q=85&s=fdd7e0e3761fb80c00ec63d0bb949e4c",
  "peek-pomc": "https://www.piedmontplastics.com/img/asset/cGFnZV9idWlsZGVyL3BlZWstcGFydHMtcGllZG1vbnQucG5n/peek-parts-piedmont.png?w=1024&h=511.03396226415&fit=crop&q=85&s=fdd7e0e3761fb80c00ec63d0bb949e4c",
  "pomc": "https://www.plastique-cauwet.com/wp-content/uploads/elementor/thumbs/POM-C.jpg-rcm67atj5lv168f7jjsubplb6tx4v9liqidhpz2256.webp",
  "pharma": "1576091160550-2173dba999ef",
  "newsletter-q2": "1586528116311-ad8dd3c8310d",
  "maintenance": "1581092335397-9583eb92d232",
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

function photoUrl(idOrUrl: string): string {
  if (idOrUrl.startsWith("http")) return idOrUrl;
  return `https://images.unsplash.com/photo-${idOrUrl}?w=800&q=80&auto=format&fit=crop`;
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
          PHOTO
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
