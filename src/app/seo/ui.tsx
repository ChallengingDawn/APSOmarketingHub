"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import LinkOff from "@mui/icons-material/LinkOff";
import ErrorOutline from "@mui/icons-material/ErrorOutline";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";

/* ── design tokens ─────────────────────────────────────────────────────── */

export const NAVY = "#274e64";
export const RED = "#ed1b2f";
export const INK = "#1a1d21";
export const MUTED = "#5b6470";
export const HAIRLINE = "#e3e6ea";
export const SURFACE = "#f5f6f8";

export const DISPLAY = "var(--font-outfit), var(--font-inter), sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
export const NUMERIC = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum" 1',
} as const;

/**
 * Horizontal gutter for the cockpit shell. The page itself is deliberately
 * uncapped — this is a data surface and the horizontal room is the point — so
 * the gutter is the only thing standing between a table and the viewport edge.
 */
export const GUTTER = { xs: 2, sm: 2.5, md: 3, lg: 4 } as const;

/** Prose stays readable even though the page around it is full-bleed. */
export const PROSE_MAX = 1080;

/* ── formatting ────────────────────────────────────────────────────────── */

export function fmtInt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** GSC returns ctr as a 0–1 fraction. */
export function fmtCtr(ctr: number | null): string {
  if (ctr === null || !Number.isFinite(ctr)) return "—";
  return `${(ctr * 100).toFixed(2)}%`;
}

export function fmtPosition(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "—";
  return p.toFixed(1);
}

export function fmtSigned(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  return r > 0 ? `+${r.toLocaleString("en-US")}` : r.toLocaleString("en-US");
}

export function fmtPct(n: number | null, digits = 0): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Trims a URL to its path so page tables stay readable. */
export function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
}

/* ── primitives ────────────────────────────────────────────────────────── */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </Typography>
  );
}

export function HairlineCard({ children, sx }: { children: ReactNode; sx?: object }) {
  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2,
        bgcolor: "#fff",
        overflow: "hidden",
        ...sx,
      }}
    >
      {children}
    </Card>
  );
}

/** Short plain-language "what to do with this view" line under a view title. */
export function Explainer({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        sx={{ fontFamily: DISPLAY, fontSize: "1.3rem", fontWeight: 600, color: INK, letterSpacing: "-0.025em" }}
      >
        {title}
      </Typography>
      <Typography sx={{ mt: 0.6, fontSize: "0.875rem", color: MUTED, lineHeight: 1.65, maxWidth: PROSE_MAX }}>
        {children}
      </Typography>
    </Box>
  );
}

/**
 * The "here is exactly how this number is computed" band. One primitive rather
 * than four hand-rolled copies, so the formula, the prose and the caveat always
 * look the same. It carries no outer border of its own — every caller nests it
 * inside a Disclosure, which owns the separating hairline.
 */
export function Methodology({
  label,
  formula,
  children,
  caveat,
}: {
  label: string;
  formula?: ReactNode;
  children: ReactNode;
  caveat?: ReactNode;
}) {
  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 0.5, pb: { xs: 2.5, md: 3 }, bgcolor: SURFACE }}>
      <SectionLabel>{label}</SectionLabel>
      {formula !== undefined && (
        <Typography component="div" sx={{ mt: 1, fontFamily: MONO, fontSize: 13, color: INK, lineHeight: 1.7 }}>
          {formula}
        </Typography>
      )}
      <Typography
        component="div"
        sx={{ mt: 1.25, fontSize: "0.82rem", color: MUTED, lineHeight: 1.65, maxWidth: PROSE_MAX }}
      >
        {children}
      </Typography>
      {caveat !== undefined && (
        <Typography component="div" sx={{ mt: 1.25, fontSize: "0.8rem", color: RED, lineHeight: 1.6, maxWidth: PROSE_MAX }}>
          {caveat}
        </Typography>
      )}
    </Box>
  );
}

/** Standard left-hand heading for a table toolbar: label over a live caption. */
export function TableHeading({ label, caption }: { label: string; caption: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <SectionLabel>{label}</SectionLabel>
      <Typography component="div" sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.25 }}>
        {caption}
      </Typography>
    </Box>
  );
}

/** Small uppercase tag used for provenance and classification badges. */
export function Tag({ label, color = MUTED, bg = SURFACE }: { label: string; color?: string; bg?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.8,
        py: 0.2,
        borderRadius: 0.75,
        border: `1px solid ${HAIRLINE}`,
        bgcolor: bg,
        color,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

/** Footnote naming where the numbers above came from. Every view ends with one. */
export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
      <Typography component="div" sx={{ fontSize: "0.75rem", color: MUTED, lineHeight: 1.6, maxWidth: PROSE_MAX }}>
        {children}
      </Typography>
    </Box>
  );
}

/* ── the three explicit states ─────────────────────────────────────────── */

const ENV_EXPLAIN: Record<string, string> = {
  GOOGLE_SERVICE_ACCOUNT:
    "Service-account JSON (raw or base64) with the Search Console read scope. The service account's client_email must also be added as a user on the property.",
  GA4_PROPERTY_ID: "Numeric GA4 property id.",
  GSC_SITE_URL: 'Search Console property string — "sc-domain:example.com" or the exact url-prefix.',
  HUBSPOT_TOKEN: "HubSpot private-app token.",
};

/**
 * The identical not-connected treatment used by every surface: which source is
 * missing, the exact secret name, what appears once connected, and a way in.
 * Never a blurred fake preview.
 */
export function NotConnected({
  source,
  missing,
  detail,
  willShow,
}: {
  source: string;
  missing: string[];
  detail?: string;
  willShow: string;
}) {
  const names = missing.length > 0 ? missing : ["GOOGLE_SERVICE_ACCOUNT", "GSC_SITE_URL"];
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, md: 7 } }}>
      <HairlineCard sx={{ maxWidth: 620, width: "100%" }}>
        <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center" }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2,
              mx: "auto",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: SURFACE,
              color: NAVY,
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <LinkOff sx={{ fontSize: 22 }} />
          </Box>

          <SectionLabel>Not connected</SectionLabel>
          <Typography
            sx={{ mt: 1, fontFamily: DISPLAY, fontSize: "1.3rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}
          >
            {source} is not connected
          </Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem", color: MUTED, lineHeight: 1.65 }}>
            {willShow}
          </Typography>

          <Box sx={{ mt: 2.5, textAlign: "left", border: `1px solid ${HAIRLINE}`, borderRadius: 1.5, overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: SURFACE, borderBottom: `1px solid ${HAIRLINE}` }}>
              <SectionLabel>Required environment {names.length > 1 ? "variables" : "variable"}</SectionLabel>
            </Box>
            {names.map((name) => (
              <Box key={name} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" } }}>
                <Typography
                  component="code"
                  sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, fontWeight: 700, color: NAVY }}
                >
                  {name}
                </Typography>
                <Typography sx={{ mt: 0.4, fontSize: "0.8rem", color: MUTED, lineHeight: 1.55 }}>
                  {ENV_EXPLAIN[name] ?? "Required by this integration."}
                </Typography>
              </Box>
            ))}
          </Box>

          {detail && (
            <Typography sx={{ mt: 1.75, fontSize: "0.8rem", color: RED, lineHeight: 1.55 }}>{detail}</Typography>
          )}

          <Button
            component={Link}
            href="/settings"
            variant="contained"
            disableElevation
            sx={{
              mt: 3,
              bgcolor: NAVY,
              textTransform: "none",
              fontWeight: 600,
              px: 2.5,
              "&:hover": { bgcolor: "#1d3c4e" },
            }}
          >
            Open Integrations settings
          </Button>
        </Box>
      </HairlineCard>
    </Box>
  );
}

export function UpstreamError({ error, status, onRetry }: { error: string; status: number | null; onRetry: () => void }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, md: 7 } }}>
      <HairlineCard sx={{ maxWidth: 620, width: "100%" }}>
        <Box sx={{ p: { xs: 3, md: 4 }, textAlign: "center" }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2,
              mx: "auto",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#fdebed",
              color: RED,
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <ErrorOutline sx={{ fontSize: 22 }} />
          </Box>
          <SectionLabel>Search Console call failed</SectionLabel>
          <Typography
            sx={{ mt: 1, fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}
          >
            Credentials are configured, but the request did not succeed
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              px: 2,
              py: 1.5,
              bgcolor: SURFACE,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 1.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12.5,
              color: INK,
              textAlign: "left",
              lineHeight: 1.6,
              wordBreak: "break-word",
            }}
          >
            {status !== null ? `HTTP ${status} — ` : ""}
            {error}
          </Typography>
          <Typography sx={{ mt: 1.75, fontSize: "0.82rem", color: MUTED, lineHeight: 1.6 }}>
            A 403 usually means the service account is not added as a user on the property. A 404 usually means{" "}
            <Box component="code" sx={{ fontFamily: "ui-monospace, monospace", color: NAVY }}>
              GSC_SITE_URL
            </Box>{" "}
            does not match a verified property exactly.
          </Typography>
          <Button
            onClick={onRetry}
            variant="outlined"
            sx={{ mt: 3, borderColor: HAIRLINE, color: INK, textTransform: "none", fontWeight: 600, px: 2.5 }}
          >
            Retry
          </Button>
        </Box>
      </HairlineCard>
    </Box>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ px: 3, py: 6, textAlign: "center" }}>
      <InboxOutlined sx={{ fontSize: 30, color: "#aab2bd" }} />
      <Typography sx={{ mt: 1.25, fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 600, color: INK }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: "0.84rem", color: MUTED, maxWidth: 620, mx: "auto", lineHeight: 1.6 }}>
        {body}
      </Typography>
    </Box>
  );
}

/**
 * An empty result that is genuinely good news rather than a missing source.
 * Distinct from EmptyState on purpose: "the analyses found nothing to fix" and
 * "we could not read the data" must never look the same.
 */
export function AllClear({
  title,
  children,
  label = "All clear",
}: {
  title: string;
  children: ReactNode;
  /** Overline above the title. Says what kind of nothing this is. */
  label?: string;
}) {
  return (
    <Box sx={{ px: 3, py: { xs: 5, md: 7 }, textAlign: "center" }}>
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: 2,
          mx: "auto",
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#eaf0f4",
          color: NAVY,
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        <TaskAlt sx={{ fontSize: 22 }} />
      </Box>
      <SectionLabel>{label}</SectionLabel>
      <Typography
        sx={{ mt: 1, fontFamily: DISPLAY, fontSize: "1.2rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}
      >
        {title}
      </Typography>
      <Typography
        component="div"
        sx={{ mt: 1, fontSize: "0.86rem", color: MUTED, maxWidth: 680, mx: "auto", lineHeight: 1.7 }}
      >
        {children}
      </Typography>
    </Box>
  );
}
