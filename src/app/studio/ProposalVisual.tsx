"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * ProposalVisual — themed SVG illustrations that match the content topic.
 * Generated locally, no external image dependencies, fully on-brand.
 */

export type VisualTheme =
  | "oring-fkm"        // FKM/FFKM o-rings (chemical resistance)
  | "oring-food"       // food-grade EPDM o-rings
  | "oring-failure"    // o-ring failure / maintenance
  | "oring-guide"      // o-ring material selection guide
  | "peek-aerospace"   // PEEK aerospace
  | "peek-pomc"        // PEEK vs POM-C comparison
  | "pomc"             // POM-C precision
  | "pharma"           // pharma sealing
  | "newsletter-q2"    // quarterly digest
  | "maintenance";     // predictive maintenance

interface VisualProps {
  theme: VisualTheme;
  mode?: "stock" | "ai";
  height?: number | string;
}

const THEME_META: Record<VisualTheme, { label: string; bg: string; accent: string; render: () => React.ReactNode }> = {
  "oring-fkm": {
    label: "O-RINGS · CHEMICAL",
    bg: "linear-gradient(135deg, #1a3a4c 0%, #274e64 100%)",
    accent: "#ed1b2f",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Multiple stacked o-rings (front view & cross-section) */}
        <circle cx="200" cy="200" r="120" fill="none" stroke="#ed1b2f" strokeWidth="20" opacity="0.95" />
        <circle cx="200" cy="200" r="80" fill="none" stroke="#ed1b2f" strokeWidth="16" opacity="0.5" />
        <circle cx="200" cy="200" r="40" fill="#ed1b2f" opacity="0.25" />
        {/* Cross-section ring */}
        <ellipse cx="450" cy="200" rx="90" ry="22" fill="none" stroke="#fff" strokeWidth="3" opacity="0.5" />
        <circle cx="540" cy="200" r="14" fill="#fff" opacity="0.85" />
        <circle cx="360" cy="200" r="14" fill="#fff" opacity="0.85" />
        {/* Decorative grid */}
        <g opacity="0.06" stroke="#fff" strokeWidth="1">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1="0" y1={i * 50} x2="600" y2={i * 50} />
          ))}
        </g>
      </svg>
    ),
  },
  "oring-food": {
    label: "FOOD-GRADE SEALING",
    bg: "linear-gradient(135deg, #1e8e3e 0%, #34a853 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Stacked food-grade rings */}
        <circle cx="300" cy="200" r="130" fill="none" stroke="#fff" strokeWidth="18" opacity="0.95" />
        <circle cx="300" cy="200" r="95" fill="none" stroke="#fff" strokeWidth="6" opacity="0.4" />
        <circle cx="300" cy="200" r="65" fill="none" stroke="#fff" strokeWidth="3" opacity="0.3" />
        {/* FDA badge */}
        <g transform="translate(440 60)">
          <circle cx="40" cy="40" r="40" fill="#fff" />
          <text x="40" y="48" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1e8e3e">FDA</text>
        </g>
        <g opacity="0.08" stroke="#fff" strokeWidth="1">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={i} x1={i * 75} y1="0" x2={i * 75} y2="400" />
          ))}
        </g>
      </svg>
    ),
  },
  "oring-failure": {
    label: "MAINTENANCE",
    bg: "linear-gradient(135deg, #c5221f 0%, #ed1b2f 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Cracked o-ring */}
        <circle cx="300" cy="200" r="120" fill="none" stroke="#fff" strokeWidth="22" opacity="0.95" />
        {/* Crack line */}
        <path d="M 195 145 L 215 165 L 200 185 L 220 205" stroke="#1f1f1f" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M 380 250 L 360 270 L 380 285" stroke="#1f1f1f" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* Warning triangle */}
        <g transform="translate(450 60)">
          <path d="M 40 5 L 75 65 L 5 65 Z" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
          <text x="40" y="55" textAnchor="middle" fontSize="32" fontWeight="900" fill="#ed1b2f">!</text>
        </g>
      </svg>
    ),
  },
  "oring-guide": {
    label: "MATERIAL GUIDE",
    bg: "linear-gradient(135deg, #274e64 0%, #325f78 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Three rings of different colors representing different materials */}
        <circle cx="160" cy="200" r="80" fill="none" stroke="#ed1b2f" strokeWidth="14" opacity="0.95" />
        <text x="160" y="320" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff">FKM</text>
        <circle cx="300" cy="200" r="80" fill="none" stroke="#fbbc04" strokeWidth="14" opacity="0.95" />
        <text x="300" y="320" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff">FFKM</text>
        <circle cx="440" cy="200" r="80" fill="none" stroke="#fff" strokeWidth="14" opacity="0.95" />
        <text x="440" y="320" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff">SILICONE</text>
      </svg>
    ),
  },
  "peek-aerospace": {
    label: "PEEK · AEROSPACE",
    bg: "linear-gradient(135deg, #1a3a4c 0%, #274e64 50%, #325f78 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Stylized aircraft */}
        <g transform="translate(0 60)">
          <path
            d="M 120 180 L 320 165 L 460 140 L 540 145 L 540 175 L 460 195 L 380 200 L 320 215 L 120 200 Z"
            fill="#fff"
            opacity="0.95"
          />
          <path d="M 180 180 L 240 100 L 270 100 L 230 180 Z" fill="#fff" opacity="0.85" />
          <path d="M 180 200 L 240 280 L 270 280 L 230 200 Z" fill="#fff" opacity="0.65" />
          <circle cx="500" cy="160" r="6" fill="#ed1b2f" />
        </g>
        {/* Hex pattern (PEEK molecular hint) */}
        <g opacity="0.1" fill="#fff">
          <path d="M 30 60 l 20 0 l 10 17 l -10 17 l -20 0 l -10 -17 z" />
          <path d="M 80 60 l 20 0 l 10 17 l -10 17 l -20 0 l -10 -17 z" />
          <path d="M 30 110 l 20 0 l 10 17 l -10 17 l -20 0 l -10 -17 z" />
        </g>
        <text x="300" y="370" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" letterSpacing="4">PEEK</text>
      </svg>
    ),
  },
  "peek-pomc": {
    label: "PEEK vs POM-C",
    bg: "linear-gradient(135deg, #274e64 0%, #1a3a4c 100%)",
    accent: "#ed1b2f",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* PEEK side */}
        <g transform="translate(80 100)">
          <rect x="0" y="0" width="180" height="200" rx="12" fill="#ed1b2f" opacity="0.85" />
          <text x="90" y="100" textAnchor="middle" fontSize="36" fontWeight="900" fill="#fff">PEEK</text>
          <text x="90" y="135" textAnchor="middle" fontSize="14" fontWeight="600" fill="#fff" opacity="0.85">+260°C</text>
        </g>
        {/* VS */}
        <text x="300" y="220" textAnchor="middle" fontSize="32" fontWeight="900" fill="#fff" opacity="0.6">vs</text>
        {/* POM-C side */}
        <g transform="translate(340 100)">
          <rect x="0" y="0" width="180" height="200" rx="12" fill="#fff" opacity="0.95" />
          <text x="90" y="100" textAnchor="middle" fontSize="34" fontWeight="900" fill="#274e64">POM-C</text>
          <text x="90" y="135" textAnchor="middle" fontSize="14" fontWeight="600" fill="#274e64" opacity="0.7">+100°C</text>
        </g>
      </svg>
    ),
  },
  "pomc": {
    label: "POM-C PRECISION",
    bg: "linear-gradient(135deg, #f9ab00 0%, #fbbc04 100%)",
    accent: "#1f1f1f",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Gear */}
        <g transform="translate(300 200)">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x1 = Math.cos(angle) * 110;
            const y1 = Math.sin(angle) * 110;
            const x2 = Math.cos(angle) * 145;
            const y2 = Math.sin(angle) * 145;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1f1f1f" strokeWidth="22" strokeLinecap="round" />;
          })}
          <circle r="105" fill="#1f1f1f" />
          <circle r="40" fill="#fbbc04" />
          <text y="12" textAnchor="middle" fontSize="32" fontWeight="900" fill="#1f1f1f">P</text>
        </g>
        <text x="300" y="370" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1f1f1f" letterSpacing="4">POM-C</text>
      </svg>
    ),
  },
  "pharma": {
    label: "PHARMA SEALING",
    bg: "linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Pill capsule */}
        <g transform="translate(180 130) rotate(20 120 70)">
          <rect x="0" y="20" width="240" height="100" rx="50" fill="#fff" />
          <rect x="0" y="20" width="120" height="100" rx="50" fill="#ed1b2f" />
          <line x1="120" y1="20" x2="120" y2="120" stroke="#1a73e8" strokeWidth="3" />
        </g>
        {/* USP badge */}
        <g transform="translate(70 60)">
          <circle cx="35" cy="35" r="35" fill="#fff" />
          <text x="35" y="42" textAnchor="middle" fontSize="16" fontWeight="900" fill="#1a73e8">USP</text>
          <text x="35" y="58" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1a73e8">CLASS VI</text>
        </g>
      </svg>
    ),
  },
  "newsletter-q2": {
    label: "Q2 UPDATE",
    bg: "linear-gradient(135deg, #ed1b2f 0%, #c5221f 100%)",
    accent: "#fff",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Rocket */}
        <g transform="translate(220 60)">
          <path d="M 80 0 C 110 30, 130 100, 130 180 L 30 180 C 30 100, 50 30, 80 0 Z" fill="#fff" />
          <circle cx="80" cy="80" r="20" fill="#ed1b2f" stroke="#fff" strokeWidth="4" />
          <path d="M 30 180 L 0 240 L 50 220 Z" fill="#fff" opacity="0.8" />
          <path d="M 130 180 L 160 240 L 110 220 Z" fill="#fff" opacity="0.8" />
          <path d="M 65 250 L 80 310 L 95 250 Z" fill="#fbbc04" />
          <path d="M 70 280 L 80 330 L 90 280 Z" fill="#fff" />
        </g>
        <g opacity="0.18" fill="#fff">
          <circle cx="80" cy="80" r="3" />
          <circle cx="120" cy="120" r="2" />
          <circle cx="500" cy="100" r="3" />
          <circle cx="540" cy="60" r="2" />
          <circle cx="450" cy="320" r="3" />
        </g>
      </svg>
    ),
  },
  "maintenance": {
    label: "MAINTENANCE",
    bg: "linear-gradient(135deg, #f9ab00 0%, #fbbc04 100%)",
    accent: "#1f1f1f",
    render: () => (
      <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        {/* Wrench */}
        <g transform="translate(150 100) rotate(-30 150 100)">
          <path
            d="M 60 30 a 35 35 0 1 0 30 60 L 240 180 a 18 18 0 0 0 26 -26 L 116 4 a 35 35 0 0 0 -56 26 Z"
            fill="#1f1f1f"
          />
        </g>
        <g transform="translate(420 270)">
          <circle r="50" fill="#1f1f1f" />
          <circle r="40" fill="none" stroke="#fbbc04" strokeWidth="4" />
          <line x1="0" y1="0" x2="0" y2="-30" stroke="#fbbc04" strokeWidth="5" strokeLinecap="round" />
          <line x1="0" y1="0" x2="22" y2="0" stroke="#fbbc04" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    ),
  },
};

export default function ProposalVisual({ theme, mode = "stock", height = "100%" }: VisualProps) {
  const meta = THEME_META[theme];

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        minHeight: 220,
        background: meta.bg,
        borderRadius: 3,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
        {meta.render()}
      </Box>

      {/* Source badge */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          left: 10,
          px: 1.25,
          py: 0.4,
          borderRadius: 1,
          bgcolor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>
          {mode === "ai" ? "AI GENERATED" : "FREE STOCK"}
        </Typography>
      </Box>

      {/* Theme label badge */}
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
          {meta.label}
        </Typography>
      </Box>
    </Box>
  );
}
