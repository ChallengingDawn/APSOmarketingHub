"use client";

// The chrome the Analytics sub-apps share — and, because they are the same
// shapes, the Live and Customers pages borrow them too: the rail, the section
// card, and the three honest data states. Nothing in this file computes a
// figure; it only frames what a report returned.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

/* ── the five siblings ─────────────────────────────────────────────────── */

export type AnalyticsRouteId = "overview" | "acquisition" | "audience" | "commercial";

export const ANALYTICS_NAV: { id: AnalyticsRouteId; href: string; label: string; purpose: string }[] = [
  { id: "overview", href: "/analytics", label: "Overview", purpose: "How the site is doing" },
  { id: "acquisition", href: "/analytics/acquisition", label: "Acquisition", purpose: "Where visitors come from" },
  { id: "audience", href: "/analytics/audience", label: "Audience", purpose: "Who they are" },
  { id: "commercial", href: "/analytics/new-customers", label: "New customers", purpose: "Who just arrived, and what they become" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/analytics") return pathname === "/analytics" || pathname === "/analytics/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SubNav() {
  const pathname = usePathname() ?? "/analytics";
  return (
    <Box
      component="nav"
      aria-label="Analytics sub-apps"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${ANALYTICS_NAV.length}, 1fr)` },
        gap: 0.75,
        p: 0.75,
        mb: { xs: 3, md: 4 },
        borderRadius: 2.5,
        bgcolor: SURFACE,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {ANALYTICS_NAV.map((entry) => {
        const active = isActive(pathname, entry.href);
        return (
          <Box
            key={entry.id}
            component={Link}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 0.2,
              px: 1.75,
              py: 1.1,
              borderRadius: 2,
              textDecoration: "none",
              bgcolor: active ? "#fff" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(26,29,33,0.06), 0 2px 8px rgba(26,29,33,0.06)" : "none",
              border: `1px solid ${active ? HAIRLINE : "transparent"}`,
              transition: "background-color 120ms, box-shadow 120ms",
              "&:hover": { bgcolor: active ? "#fff" : "rgba(255,255,255,0.7)" },
            }}
          >
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: active ? INK : MUTED, lineHeight: 1.3 }}>
              {entry.label}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.3 }}>{entry.purpose}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/* ── page furniture ────────────────────────────────────────────────────── */

export function SubAppHead({ title, purpose }: { title: string; purpose: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontFamily: DISPLAY, fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.02em", color: INK }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.35, maxWidth: 760 }}>{purpose}</Typography>
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
