"use client";

/**
 * Shared visual vocabulary for the GEO cockpit.
 *
 * The cockpit is five ROUTED sub-apps, not five tabs, so the pieces here are
 * deliberately layout-level: the persistent sub-navigation rail, the page
 * intro (title → purpose → the one number that matters), the card, the
 * "Details" disclosure that keeps diagnostics out of the scanning path, and
 * the three honest "there is no data" states.
 *
 * Nothing here renders a number it was not given. When a source is missing the
 * card says which secret is missing and what the page would show once it is set
 * — never a blurred fake preview.
 */

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InboxIcon from "@mui/icons-material/Inbox";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GEO_BAND_LABELS,
  geoBand,
  SCORE_BAND_STRONG,
  SCORE_BAND_WEAK,
  SCORE_BAND_WORKABLE,
  type GeoBand,
  type GeoVerdict,
} from "@/lib/geo/audit";

export const C = {
  navy: "#274e64",
  red: "#ed1b2f",
  ink: "#1a1d21",
  muted: "#5b6470",
  hairline: "#e3e6ea",
  surface: "#f5f6f8",
  white: "#ffffff",
} as const;

export const VERDICT_COLOR: Record<GeoVerdict, string> = {
  pass: "#1e7e45",
  warn: "#c77700",
  fail: "#c5221f",
};

export const VERDICT_LABEL: Record<GeoVerdict, string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
};

export const BAND_COLOR: Record<GeoBand, string> = {
  strong: "#1e7e45",
  workable: "#2563a8",
  weak: "#c77700",
  poor: "#c5221f",
};

export const DISPLAY_FONT = "var(--font-outfit), 'Outfit', 'Inter', sans-serif";

/** Uppercase letter-spaced label that opens a block. */
export function SectionLabel({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Typography
      component="div"
      sx={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.muted,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

/** Hairline-bordered surface used for every panel in the cockpit. */
export function Panel({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${C.hairline}`,
        borderRadius: "2px",
        bgcolor: C.white,
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

/** A panel with real padding. The default surface for anything that reads. */
export function Card({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Panel sx={{ p: { xs: 2.5, md: 3 }, ...sx }}>{children}</Panel>;
}

/**
 * Wide content (tables, seven-column comparisons) scrolls inside its own box —
 * the page body must never scroll sideways.
 */
export function ScrollX({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box sx={{ minWidth }}>{children}</Box>
    </Box>
  );
}

/**
 * The cockpit runs edge to edge, but prose does not: a 200-character line is
 * unreadable however wide the screen.
 */
export function Measure({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Box sx={{ maxWidth: "78ch", ...sx }}>{children}</Box>;
}

export function ScoreBadge({
  score,
  size = "md",
  title,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  const band = geoBand(score);
  const dims = size === "lg" ? 76 : size === "md" ? 48 : 38;
  const font = size === "lg" ? 26 : size === "md" ? 17 : 14;
  return (
    <Tooltip title={title ?? `${GEO_BAND_LABELS[band]} — ${score}/100 GEO readiness`}>
      <Box
        sx={{
          width: dims,
          height: dims,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${BAND_COLOR[band]}`,
          borderLeft: `3px solid ${BAND_COLOR[band]}`,
          borderRadius: "2px",
          bgcolor: `${BAND_COLOR[band]}0f`,
        }}
      >
        <Typography
          sx={{ fontFamily: DISPLAY_FONT, fontSize: font, fontWeight: 600, lineHeight: 1, color: BAND_COLOR[band] }}
        >
          {score}
        </Typography>
        {size === "lg" && (
          <Typography sx={{ fontSize: 10, letterSpacing: "0.08em", color: BAND_COLOR[band], mt: 0.5 }}>
            / 100
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

export function VerdictChip({ verdict, label }: { verdict: GeoVerdict; label: string }) {
  const color = VERDICT_COLOR[verdict];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.375,
        border: `1px solid ${color}55`,
        borderRadius: "2px",
        bgcolor: `${color}10`,
        color,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
      {label}
    </Box>
  );
}

/** Horizontal stacked bar. Every segment is a real count with its own label. */
export function DistributionBar({
  segments,
  total,
}: {
  segments: { label: string; count: number; color: string }[];
  total: number;
}) {
  if (total <= 0) {
    return (
      <Typography sx={{ fontSize: 12.5, color: C.muted }}>
        Nothing to distribute yet — no pieces scored.
      </Typography>
    );
  }
  return (
    <Box>
      <Box sx={{ display: "flex", height: 12, borderRadius: "2px", overflow: "hidden", border: `1px solid ${C.hairline}` }}>
        {segments.map((s) => (
          <Tooltip key={s.label} title={`${s.label}: ${s.count} of ${total}`}>
            <Box sx={{ width: `${(s.count / total) * 100}%`, bgcolor: s.color, transition: "width .3s" }} />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1.5 }}>
        {segments.map((s) => (
          <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, bgcolor: s.color, borderRadius: "1px" }} />
            <Typography sx={{ fontSize: 12, color: C.muted }}>
              {s.label} <strong style={{ color: C.ink }}>{s.count}</strong>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** A number with its label underneath. The cockpit's atom of measurement. */
export function Stat({
  value,
  label,
  hint,
  color,
  size = "md",
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const font = size === "lg" ? 30 : size === "md" ? 22 : 17;
  const body = (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontFamily: DISPLAY_FONT,
          fontSize: font,
          fontWeight: 600,
          lineHeight: 1.05,
          color: color ?? C.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </Typography>
      <SectionLabel sx={{ fontSize: 10, mt: 0.75 }}>{label}</SectionLabel>
    </Box>
  );
  return hint ? <Tooltip title={hint}>{body}</Tooltip> : body;
}

/** A single proportion, drawn. Never rendered without the count behind it. */
export function MeterBar({
  value,
  max,
  color,
  height = 6,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <Box sx={{ height, bgcolor: C.surface, border: `1px solid ${C.hairline}`, borderRadius: "1px" }}>
      <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, transition: "width .3s" }} />
    </Box>
  );
}

/* ─────────────────────────── page-level structure ─────────────────────────── */

/**
 * Every sub-app opens the same way: its own title, its own one-line purpose,
 * and — when there is one — the single number the page is about. The hierarchy
 * is the whole point, so it is a component rather than a convention.
 */
export function PageIntro({
  title,
  purpose,
  right,
}: {
  title: string;
  purpose: string;
  right?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", md: "flex-end" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        mb: { xs: 3, md: 4 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontSize: { xs: 24, md: 28 },
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: C.ink,
            lineHeight: 1.15,
          }}
        >
          {title}
        </Typography>
        <Measure>
          <Typography sx={{ fontSize: 13.5, color: C.muted, mt: 1, lineHeight: 1.6 }}>{purpose}</Typography>
        </Measure>
      </Box>
      {right && <Box sx={{ flexShrink: 0 }}>{right}</Box>}
    </Box>
  );
}

/** The rule that opens a band within a sub-app. */
export function SectionHead({ title, right, sx }: { title: string; right?: ReactNode; sx?: object }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        gap: 1.5,
        flexWrap: "wrap",
        pb: 1.25,
        mb: 2,
        borderBottom: `1px solid ${C.hairline}`,
        ...sx,
      }}
    >
      <Box sx={{ width: 5, height: 5, bgcolor: C.red, transform: "rotate(45deg)", alignSelf: "center" }} />
      <SectionLabel>{title}</SectionLabel>
      {right && <Box sx={{ ml: "auto" }}>{right}</Box>}
    </Box>
  );
}

/**
 * Detail on demand.
 *
 * Per-check breakdowns and per-URL metrics are diagnostics, not scanning
 * material: twenty rows have to be readable in five seconds, which they are not
 * if each row spills its seven measured values into the list. They live behind
 * this, closed by default.
 */
export function Details({
  label = "Details",
  openLabel,
  children,
  align = "left",
}: {
  label?: string;
  openLabel?: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          endIcon={
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
            />
          }
          sx={{
            textTransform: "none",
            color: C.muted,
            fontWeight: 600,
            fontSize: 12.5,
            px: 0.75,
            minWidth: 0,
            "&:hover": { color: C.navy, bgcolor: "transparent" },
          }}
        >
          {open ? (openLabel ?? `Hide ${label.toLowerCase()}`) : label}
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pt: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** The one dominant action of a row or card. Everything else stays quiet. */
export function PrimaryAction({
  href,
  onClick,
  children,
  icon,
  disabled,
  type,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const sx = {
    bgcolor: C.navy,
    borderRadius: "2px",
    textTransform: "none",
    fontWeight: 600,
    fontSize: 13,
    px: 2.25,
    py: 0.875,
    whiteSpace: "nowrap",
    "&:hover": { bgcolor: "#1a3a4c" },
  } as const;
  if (href) {
    return (
      <Button component={Link} href={href} variant="contained" disableElevation startIcon={icon} sx={sx}>
        {children}
      </Button>
    );
  }
  return (
    <Button
      type={type ?? "button"}
      onClick={onClick}
      variant="contained"
      disableElevation
      disabled={disabled}
      startIcon={icon}
      sx={sx}
    >
      {children}
    </Button>
  );
}

/** A quiet secondary action: text, never a filled button. */
export function QuietAction({
  href,
  onClick,
  children,
  icon,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const sx = {
    textTransform: "none",
    color: C.navy,
    fontWeight: 600,
    fontSize: 12.5,
    px: 0.75,
    minWidth: 0,
    whiteSpace: "nowrap",
    "&:hover": { bgcolor: `${C.navy}0a` },
  } as const;
  return href ? (
    <Button component={Link} href={href} size="small" startIcon={icon} sx={sx}>
      {children}
    </Button>
  ) : (
    <Button size="small" onClick={onClick} startIcon={icon} sx={sx}>
      {children}
    </Button>
  );
}

/* ───────────────────────────── the honest states ──────────────────────────── */

function CenteredCard({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Panel sx={{ p: { xs: 3, md: 5 }, textAlign: "center" }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          mx: "auto",
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${C.hairline}`,
          borderRadius: "2px",
          bgcolor: C.surface,
          color: C.navy,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 500, color: C.ink, mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ maxWidth: 520, mx: "auto" }}>{children}</Box>
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Panel>
  );
}

/**
 * The one not-connected treatment: which source is missing, the exact secret
 * names, what appears once it is set, and the way to Integrations settings.
 */
export function NotConnectedCard({
  source,
  missing,
  unlocks,
  detail,
}: {
  source: string;
  missing: string[];
  unlocks: string;
  detail?: string | null;
}) {
  return (
    <CenteredCard
      icon={<LinkOffIcon fontSize="small" />}
      title={`${source} is not connected`}
      action={
        <Button
          component={Link}
          href="/settings"
          variant="outlined"
          size="small"
          startIcon={<SettingsIcon fontSize="small" />}
          sx={{
            borderColor: C.navy,
            color: C.navy,
            borderRadius: "2px",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { borderColor: C.navy, bgcolor: `${C.navy}0a` },
          }}
        >
          Open Integrations settings
        </Button>
      }
    >
      <Typography sx={{ fontSize: 13.5, color: C.muted, mb: 2 }}>{unlocks}</Typography>
      <SectionLabel sx={{ mb: 1 }}>Set on the server</SectionLabel>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
        {(missing.length ? missing : ["GOOGLE_SERVICE_ACCOUNT"]).map((name) => (
          <Box
            key={name}
            sx={{
              px: 1.25,
              py: 0.5,
              border: `1px solid ${C.hairline}`,
              borderRadius: "2px",
              bgcolor: C.surface,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: C.ink,
            }}
          >
            {name}
          </Box>
        ))}
      </Box>
      {detail && (
        <Typography sx={{ fontSize: 12, color: C.muted, mt: 2, fontStyle: "italic" }}>{detail}</Typography>
      )}
    </CenteredCard>
  );
}

/** Upstream reachable but failing — show exactly what it said. */
export function UpstreamErrorCard({
  source,
  error,
  status,
  onRetry,
}: {
  source: string;
  error: string;
  status?: number | null;
  onRetry?: () => void;
}) {
  return (
    <CenteredCard
      icon={<ErrorOutlineIcon fontSize="small" sx={{ color: C.red }} />}
      title={`${source} answered with an error`}
      action={
        onRetry ? (
          <Button
            onClick={onRetry}
            variant="outlined"
            size="small"
            sx={{
              borderColor: C.navy,
              color: C.navy,
              borderRadius: "2px",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Try again
          </Button>
        ) : undefined
      }
    >
      <Typography sx={{ fontSize: 13.5, color: C.muted }}>
        {error}
        {typeof status === "number" ? ` (HTTP ${status})` : ""}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 1.5 }}>
        Nothing is shown below because nothing was returned — no placeholder figures are substituted.
      </Typography>
    </CenteredCard>
  );
}

/** Connected, reachable, simply empty. */
export function EmptyStateCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <CenteredCard icon={<InboxIcon fontSize="small" />} title={title} action={action}>
      <Typography sx={{ fontSize: 13.5, color: C.muted }}>{body}</Typography>
    </CenteredCard>
  );
}

export function LoadingCard({ label }: { label: string }) {
  return (
    <Panel sx={{ p: 5, textAlign: "center" }}>
      <CircularProgress size={22} sx={{ color: C.navy }} />
      <Typography sx={{ fontSize: 13, color: C.muted, mt: 2 }}>{label}</Typography>
    </Panel>
  );
}

/* ───────────────────────── the persistent sub-app rail ────────────────────── */

export type GeoSubApp = {
  href: string;
  label: string;
  /** One line, shown as the rail entry's tooltip and on the sub-app's own page. */
  purpose: string;
  icon: ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  return href === "/geo" ? pathname === "/geo" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Horizontal segmented strip at the top of the content area. Five entries stay
 * legible because each is icon + one short word-pair with an optional figure;
 * below the strip's comfortable width it scrolls sideways inside itself rather
 * than wrapping into an illegible grid.
 */
export function GeoSubNav({ items }: { items: readonly (GeoSubApp & { stat?: ReactNode })[] }) {
  const pathname = usePathname() || "/geo";
  return (
    <Box
      component="nav"
      aria-label="GEO sub-apps"
      sx={{
        width: "100%",
        overflowX: "auto",
        border: `1px solid ${C.hairline}`,
        borderRadius: "2px",
        bgcolor: C.surface,
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-thumb": { bgcolor: C.hairline, borderRadius: 3 },
      }}
    >
      <Box sx={{ display: "flex", minWidth: 760 }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Tooltip key={item.href} title={item.purpose} enterDelay={600}>
              <Box
                component={Link}
                href={item.href}
                aria-current={active ? "page" : undefined}
                sx={{
                  flex: "1 1 0",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 2,
                  py: 1.75,
                  textDecoration: "none",
                  bgcolor: active ? C.white : "transparent",
                  borderRight: `1px solid ${C.hairline}`,
                  borderTop: `2px solid ${active ? C.red : "transparent"}`,
                  "&:last-of-type": { borderRight: "none" },
                  "&:hover": { bgcolor: active ? C.white : "#eceef1" },
                  transition: "background-color .15s",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: active ? C.navy : C.muted,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: DISPLAY_FONT,
                      fontSize: 13.5,
                      fontWeight: active ? 600 : 500,
                      color: active ? C.navy : C.ink,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: C.muted,
                      lineHeight: 1.3,
                      mt: 0.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.stat ?? " "}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

/* ─────────────────────────────── shared filters ───────────────────────────── */

export const BAND_ORDER: GeoBand[] = ["poor", "weak", "workable", "strong"];

export function bandRangeLabel(band: GeoBand): string {
  if (band === "strong") return `${SCORE_BAND_STRONG}+`;
  if (band === "workable") return `${SCORE_BAND_WORKABLE}–${SCORE_BAND_STRONG - 1}`;
  if (band === "weak") return `${SCORE_BAND_WEAK}–${SCORE_BAND_WORKABLE - 1}`;
  return `<${SCORE_BAND_WEAK}`;
}

/**
 * Channel and score-band filters. Bound to the state held by the GEO layout, so
 * a filter set in the Content audit is still set in the Fix queue — they are two
 * views of one portfolio rather than two datasets.
 */
export function GeoFilterBar({
  channel,
  band,
  channels,
  onChannel,
  onBand,
  left,
  right,
}: {
  channel: string;
  band: "all" | GeoBand;
  channels: readonly string[];
  onChannel: (v: string) => void;
  onBand: (v: "all" | GeoBand) => void;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        flexWrap: "wrap",
        alignItems: "center",
        px: { xs: 2, md: 2.5 },
        py: 2,
      }}
    >
      {left && <Box sx={{ mr: "auto", minWidth: 0 }}>{left}</Box>}
      {right}
      <TextField
        select
        size="small"
        label="Channel"
        value={channel}
        onChange={(e) => onChannel(e.target.value)}
        sx={{ minWidth: 170 }}
      >
        <MenuItem value="all">All channels</MenuItem>
        {channels.map((c) => (
          <MenuItem key={c} value={c}>
            {c}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Score band"
        value={band}
        onChange={(e) => onBand(e.target.value as "all" | GeoBand)}
        sx={{ minWidth: 195 }}
      >
        <MenuItem value="all">All bands</MenuItem>
        {BAND_ORDER.map((b) => (
          <MenuItem key={b} value={b}>
            {GEO_BAND_LABELS[b]} ({bandRangeLabel(b)})
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
