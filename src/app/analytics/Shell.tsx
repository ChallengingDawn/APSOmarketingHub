"use client";

// The chrome the Analytics sub-apps share — and, because they are the same
// shapes, the Live and Customers pages borrow them too: the section
// card and the three honest data states. Nothing in this file computes a
// figure; it only frames what a report returned.

import type { ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { Held } from "./AnalyticsData";
import type { IntegrationResult } from "./integrationApi";

export const NAVY = "#274e64";
export const INK = "#1a1d21";
export const MUTED = "#5b6470";
export const HAIRLINE = "#e6e8ec";
export const SURFACE = "#f5f6f8";
export const GUTTER = { xs: 2, sm: 2.5, md: 3, lg: 4 } as const;
export const DISPLAY = "var(--font-outfit), var(--font-inter), sans-serif";

/* ── page furniture ────────────────────────────────────────────────────── */

/**
 * The sub-app's own heading. Where the layout header already names the sub-app
 * (the Website and Intelligence areas), pass only the purpose line.
 */
export function SubAppHead({ title, purpose }: { title?: string; purpose: string }) {
  if (!title && !purpose) return null;
  return (
    <Box sx={{ mb: 3 }}>
      {title && (
        <Typography sx={{ fontFamily: DISPLAY, fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.02em", color: INK }}>
          {title}
        </Typography>
      )}
      {purpose && <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: title ? 0.35 : 0, maxWidth: 760 }}>{purpose}</Typography>}
    </Box>
  );
}

export function Section({ children, sx }: { children: ReactNode; sx?: Record<string, unknown> }) {
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2.4,
        bgcolor: "#fff",
        p: { xs: 2.25, md: 2.75 },
        minWidth: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 3 }}>{children}</Typography>;
}

/* ── the three honest states ───────────────────────────────────────────── */

export function NotConnectedPanel({ source, missing }: { source: string; missing: string[] }) {
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2.4,
        bgcolor: "#fff",
        p: { xs: 3, md: 4 },
        maxWidth: 640,
        mx: "auto",
        textAlign: "center",
      }}
    >
      <LinkOffIcon sx={{ fontSize: 30, color: MUTED, mb: 1 }} />
      <Typography sx={{ fontFamily: DISPLAY, fontSize: "1.1rem", fontWeight: 600, color: INK }}>
        {source} is not connected
      </Typography>
      <Typography sx={{ fontSize: "0.88rem", color: MUTED, mt: 1, mb: 2 }}>
        {missing.length
          ? `The container has no ${missing.join(", ")}. Nothing on this page is shown until the source answers — there are no sample figures.`
          : "Nothing on this page is shown until the source answers — there are no sample figures."}
      </Typography>
      <Button component={Link} href="/settings/integrations" variant="contained" size="small">
        Open Integrations
      </Button>
    </Box>
  );
}

export function UpstreamPanel({
  source,
  error,
  status,
  onRetry,
}: {
  source: string;
  error: string;
  status: number | null;
  onRetry: () => void;
}) {
  return (
    <Box
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderLeft: "3px solid #c5221f",
        borderRadius: 2.4,
        bgcolor: "#fff",
        p: { xs: 2.5, md: 3 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <ErrorOutlineIcon sx={{ fontSize: 18, color: "#c5221f" }} />
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>
          {source} did not answer{status ? ` (HTTP ${status})` : ""}
        </Typography>
      </Box>
      <Typography
        sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.78rem", color: INK, whiteSpace: "pre-wrap" }}
      >
        {error}
      </Typography>
      <Button onClick={onRetry} size="small" variant="outlined" sx={{ mt: 1.5 }}>
        Try again
      </Button>
    </Box>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  // Held back 200ms and faded in: a fast answer never flashes a spinner, and
  // a slow one appears calmly instead of whirling into place.
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 6,
        minHeight: 150,
        justifyContent: "center",
        opacity: 0,
        animation: "gateFadeIn 260ms ease 200ms forwards",
        "@keyframes gateFadeIn": { to: { opacity: 1 } },
      }}
    >
      <CircularProgress size={18} thickness={4.5} disableShrink sx={{ color: NAVY }} />
      <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>{label}</Typography>
    </Box>
  );
}

/**
 * Renders a held result through its three states, and hands the data to the
 * children only when it exists. `stale` is passed on so charts can dim.
 */
export function Gate<T>({
  held,
  source,
  loadingLabel,
  onRetry,
  children,
}: {
  held: Held<T>;
  source: string;
  loadingLabel: string;
  onRetry: () => void;
  children: (data: T, stale: boolean) => ReactNode;
}) {
  const r: IntegrationResult<T> | null = held.result;
  if (r === null) return <LoadingPanel label={loadingLabel} />;
  if (r.state === "not-configured") return <NotConnectedPanel source={source} missing={r.missing} />;
  if (r.state === "error") return <UpstreamPanel source={source} error={r.error} status={r.status} onRetry={onRetry} />;
  return <>{children(r.data, held.stale)}</>;
}
