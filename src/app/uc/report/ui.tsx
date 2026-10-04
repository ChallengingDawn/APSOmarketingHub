"use client";

// THE USE-CASE REPORT LOOK - one set of pieces for every UC app (Erosion first,
// Price checks and the rest after), in the hub's soft-glass style: frosted cards
// with a 22px radius, a tinted icon badge beside each card's title, quiet type,
// one blue accent. Same tokens as Settings, so the two read as one product.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { full } from "@/app/charts/format";
import { isClosed, type ErosionTicket, type Team } from "@/lib/erosion/model";

export const INK = "#15223a";
export const MUTED = "#5d6b85";
export const FAINT = "#8b97ac";
export const HAIRLINE = "rgba(21,34,58,.10)";
export const ACCENT = "#2459d1";
export const GREEN = "#1b7a55";
export const AMBER = "#a96a12";
export const RED = "#c5221f";
export const TRACK = "#edf0f5";
export const OPEN_FILL = "#f3dcb8";

/** Badge tints, as on Settings: background + glyph. */
export const TINT = {
  blue: { bg: "#e6edfd", fg: "#2459d1" },
  green: { bg: "#e7f6ee", fg: "#1b7a55" },
  purple: { bg: "#efe8fd", fg: "#6a46c9" },
  amber: { bg: "#fdf0e3", fg: "#a96a12" },
  pink: { bg: "#fde8f1", fg: "#b63a76" },
  slate: { bg: "#e9eef5", fg: "#4a5a70" },
} as const;
export type Tint = keyof typeof TINT;

export const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
} as const;

const PORTAL = "26492587";
export const hsTicket = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`;
export const eur = (n: number) => full(Math.round(n));
export const headCell = { color: FAINT, fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const, borderColor: HAIRLINE };
export const bodyCell = { borderColor: HAIRLINE };
export const clip = (max: number) => ({ maxWidth: max, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" });

export function GlassCard({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.75 }, minWidth: 0, ...sx }}>{children}</Box>;
}

export function Badge({ icon, tint = "blue", size = 36 }: { icon: React.ReactNode; tint?: Tint; size?: number }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: "11px", display: "grid", placeItems: "center", flexShrink: 0,
      bgcolor: TINT[tint].bg, color: TINT[tint].fg, "& svg": { fontSize: size * 0.56 },
    }}>{icon}</Box>
  );
}

/** A card's title: tinted badge, title, one line saying what it answers, controls on the right. */
export function CardTitle({ icon, tint = "blue", title, note, right }: {
  icon: React.ReactNode; tint?: Tint; title: string; note?: string; right?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2.25, flexWrap: "wrap" }}>
      <Badge icon={icon} tint={tint} />
      <Box sx={{ minWidth: 180, flex: 1 }}>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>{title}</Typography>
        {note && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{note}</Typography>}
      </Box>
      {right}
    </Box>
  );
}

/** A headline number: badge, label, the figure, one note under it. */
export function KpiTile({ icon, tint = "blue", label, value, note }: {
  icon: React.ReactNode; tint?: Tint; label: string; value: string; note?: string;
}) {
  const reported = value !== "—";
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, height: "100%", display: "flex", flexDirection: "column", gap: 1.1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Badge icon={icon} tint={tint} size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED }}>{label}</Typography>
      </Box>
      <Typography sx={{
        fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums",
        color: reported ? INK : FAINT,
      }}>{value}</Typography>
      {note && <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>{note}</Typography>}
    </Box>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
      {children}
    </Typography>
  );
}

/** Status reads in words and an icon, never in colour alone. */
export function StageChip({ t }: { t: ErosionTicket }) {
  const closed = isClosed(t);
  const fresh = !closed && /new/i.test(t.stage);
  const c = closed ? TINT.green : fresh ? TINT.blue : TINT.amber;
  return (
    <Chip
      size="small"
      icon={closed ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
      label={t.stage || "—"}
      sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600, bgcolor: c.bg, color: c.fg, "& .MuiChip-icon": { fontSize: 14, color: "inherit", ml: 0.6 } }}
    />
  );
}

export function TeamChip({ team }: { team: Team | null }) {
  const c = team === "ESO" ? TINT.blue : team === "TSA" ? TINT.amber : TINT.slate;
  return <Chip size="small" label={team ?? "—"} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: c.bg, color: c.fg }} />;
}

export function HsLink({ id }: { id: string }) {
  return (
    <Tooltip title="Open in HubSpot">
      <IconButton size="small" href={hsTicket(id)} target="_blank" rel="noreferrer" aria-label="Open in HubSpot">
        <OpenInNewIcon sx={{ fontSize: 15, color: ACCENT }} />
      </IconButton>
    </Tooltip>
  );
}

export function Notice({ tone, children }: { tone: "bad" | "warn"; children: React.ReactNode }) {
  const c = tone === "bad" ? RED : AMBER;
  return (
    <Box sx={{ ...glass, display: "flex", gap: 1, alignItems: "flex-start", p: 1.5, mb: 2, borderRadius: "16px", borderLeft: `3px solid ${c}` }}>
      <WarningAmberIcon sx={{ fontSize: 18, color: c, mt: "1px" }} />
      <Typography sx={{ fontSize: "0.84rem", color: INK }}>{children}</Typography>
    </Box>
  );
}

/** Won share of the closed tickets: green won, sand the rest. */
export function WinBar({ won, closed, height = 10 }: { won: number; closed: number; height?: number }) {
  const pct = closed ? (won / closed) * 100 : 0;
  return (
    <Box sx={{ height, borderRadius: 99, overflow: "hidden", display: "flex", bgcolor: TRACK }} title={`${won} won of ${closed} closed`}>
      {won > 0 && <Box sx={{ width: `${pct}%`, bgcolor: "#22a06b" }} />}
      {closed - won > 0 && <Box sx={{ flex: 1, bgcolor: OPEN_FILL }} />}
    </Box>
  );
}
