"use client";

/**
 * Shared visual vocabulary for the GEO cockpit: brand tokens, the section
 * label, the score badge, the verdict chip, the paragraph-distribution bar and
 * the three honest "there is no data" states.
 *
 * Nothing here renders a number it was not given. When a source is missing the
 * card says which secret is missing and what the page would show once it is set
 * — never a blurred fake preview.
 */

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InboxIcon from "@mui/icons-material/Inbox";
import SettingsIcon from "@mui/icons-material/Settings";
import Link from "next/link";
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

/** Uppercase 11.5px letter-spaced label that opens every section. */
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

export function Hairline({ sx }: { sx?: object }) {
  return <Box sx={{ height: "1px", bgcolor: C.hairline, ...sx }} />;
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

export function VerdictChip({
  verdict,
  label,
  onClick,
}: {
  verdict: GeoVerdict;
  label: string;
  onClick?: () => void;
}) {
  const color = VERDICT_COLOR[verdict];
  return (
    <Box
      component={onClick ? "button" : "span"}
      onClick={onClick}
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
        font: "inherit",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
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
      <Box sx={{ display: "flex", height: 10, borderRadius: "2px", overflow: "hidden", border: `1px solid ${C.hairline}` }}>
        {segments.map((s) => (
          <Tooltip key={s.label} title={`${s.label}: ${s.count} of ${total}`}>
            <Box sx={{ width: `${(s.count / total) * 100}%`, bgcolor: s.color, transition: "width .3s" }} />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1 }}>
        {segments.map((s) => (
          <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 0.625 }}>
            <Box sx={{ width: 8, height: 8, bgcolor: s.color, borderRadius: "1px" }} />
            <Typography sx={{ fontSize: 11.5, color: C.muted }}>
              {s.label} <strong style={{ color: C.ink }}>{s.count}</strong>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

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
 * The one not-connected treatment, used identically on every surface: which
 * source is missing, the exact secret names, what appears once it is set, and
 * the way to the Integrations settings.
 */
export function NotConnectedCard({
  source,
  missing,
  unlocks,
  detail,
}: {
  /** Human name of the source, e.g. "Google Search Console". */
  source: string;
  /** Exact env/secret names the server reported as missing. */
  missing: string[];
  /** One line: what this panel will show once the source is connected. */
  unlocks: string;
  /** Optional server-supplied diagnostic (e.g. malformed service account). */
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

/* ───────────────────────── full-bleed layout primitives ───────────────────── */

/**
 * The cockpit runs edge to edge, but prose does not: a 200-character line is
 * unreadable however wide the screen. Anything sentence-shaped is wrapped in
 * this so it stops at a comfortable measure while the data around it spreads.
 */
export function Measure({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Box sx={{ maxWidth: "78ch", ...sx }}>{children}</Box>;
}

/**
 * The rule that opens a band of the page. Carries the sub-app's name on the
 * left so the section always states which half of the cockpit it belongs to,
 * and an optional control on the right.
 */
export function SectionRule({
  eyebrow,
  title,
  right,
  sx,
}: {
  /** Which sub-app this band belongs to, e.g. "Audit". */
  eyebrow: string;
  title: string;
  right?: ReactNode;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        gap: 1.5,
        flexWrap: "wrap",
        pb: 1,
        mb: 1.5,
        borderBottom: `1px solid ${C.hairline}`,
        ...sx,
      }}
    >
      <SectionLabel sx={{ color: C.navy }}>{eyebrow}</SectionLabel>
      <Box sx={{ width: 5, height: 5, bgcolor: C.red, transform: "rotate(45deg)", alignSelf: "center" }} />
      <SectionLabel>{title}</SectionLabel>
      {right && <Box sx={{ ml: "auto" }}>{right}</Box>}
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
      <SectionLabel sx={{ fontSize: 10, mt: 0.625 }}>{label}</SectionLabel>
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

/* ──────────────────────────── the sub-app switch ──────────────────────────── */

export type SubAppOption<K extends string> = {
  key: K;
  /** "01", "02" — the switch reads as a two-step workflow, not two tabs. */
  ordinal: string;
  title: string;
  /** One line: what this half is for. */
  role: string;
  /** Live figure describing the half's current contents, or null while loading. */
  stat: ReactNode;
  icon: ReactNode;
};

/**
 * The primary switch between the cockpit's two sub-apps.
 *
 * Deliberately not a tab strip: each half is a different job, so each gets a
 * full card stating its role and its current numbers. The selected card is the
 * only one on white with a navy rail, and the page repeats its name in every
 * section rule beneath — there is no way to be unsure which half is open.
 */
export function SubAppSwitch<K extends string>({
  value,
  onChange,
  options,
}: {
  value: K;
  onChange: (key: K) => void;
  options: readonly SubAppOption<K>[];
}) {
  return (
    <Box
      role="tablist"
      aria-label="GEO cockpit sub-apps"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: `repeat(${options.length}, 1fr)` },
        gap: { xs: 1, md: 1.5 },
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Box
            key={o.key}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(o.key);
              }
            }}
            sx={{
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.75,
              px: { xs: 1.75, md: 2.5 },
              py: { xs: 1.75, md: 2 },
              bgcolor: active ? C.white : "transparent",
              border: `1px solid ${active ? C.navy : C.hairline}`,
              borderLeft: `3px solid ${active ? C.red : C.hairline}`,
              borderRadius: "2px",
              transition: "background-color .15s, border-color .15s",
              "&:hover": { borderColor: active ? C.navy : C.muted, bgcolor: C.white },
              "&:focus-visible": { outline: `2px solid ${C.navy}`, outlineOffset: 2 },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${active ? C.navy : C.hairline}`,
                borderRadius: "2px",
                bgcolor: active ? `${C.navy}0d` : C.white,
                color: active ? C.navy : C.muted,
              }}
            >
              {o.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography
                  sx={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: active ? C.red : C.muted,
                  }}
                >
                  {o.ordinal}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 17,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                    color: active ? C.navy : C.ink,
                    lineHeight: 1.1,
                  }}
                >
                  {o.title}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: C.muted, mt: 0.5, lineHeight: 1.45 }}>
                {o.role}
              </Typography>
              <Box sx={{ mt: 1, fontSize: 12, color: active ? C.ink : C.muted, fontWeight: 600 }}>
                {o.stat}
              </Box>
            </Box>
          </Box>
        );
      })}
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
 * Channel and score-band filters. One instance per half, both bound to the same
 * state in the page — filtering in AUDIT carries into IMPROVE, because they are
 * two views of one portfolio rather than two datasets.
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
        px: { xs: 1.5, md: 2 },
        py: 1.5,
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
        sx={{ minWidth: 160 }}
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
        sx={{ minWidth: 190 }}
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
