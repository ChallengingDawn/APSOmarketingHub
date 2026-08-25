"use client";

/**
 * SHELL — the chrome every SEO sub-app shares.
 *
 * The five sub-apps are siblings with their own URLs. The rail below is a
 * persistent segmented strip: it lives in the layout, so it never remounts, and
 * it reads the active entry from the pathname rather than from a tab state.
 *
 * Everything here is layout and hierarchy only. No component in this file
 * computes, estimates or displays a number the analyses did not produce.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import CloudDone from "@mui/icons-material/CloudDone";
import ExpandMore from "@mui/icons-material/ExpandMore";

import { useSeoData, type WindowDays } from "./SeoData";
import {
  DISPLAY,
  HAIRLINE,
  INK,
  MUTED,
  NAVY,
  NUMERIC,
  NotConnected,
  PROSE_MAX,
  SURFACE,
  SectionLabel,
  UpstreamError,
} from "./ui";

/* ── the five siblings ─────────────────────────────────────────────────── */

export type SeoRouteId = "performance" | "quick-wins" | "cannibalisation" | "decay" | "work-queue";

export const SEO_NAV: { id: SeoRouteId; href: string; label: string }[] = [
  { id: "performance", href: "/seo", label: "Performance" },
  { id: "quick-wins", href: "/seo/quick-wins", label: "Quick wins" },
  { id: "cannibalisation", href: "/seo/cannibalisation", label: "Cannibalisation" },
  { id: "decay", href: "/seo/decay", label: "Decay" },
  { id: "work-queue", href: "/seo/work-queue", label: "Work queue" },
];

/**
 * A count next to an entry means "this many findings are waiting there". `null`
 * means the number is not known yet or the analysis behind it could not run —
 * shown as nothing rather than as a zero, because a zero would be a claim.
 */
export type NavCounts = Partial<Record<SeoRouteId, number | null>>;

function isActive(pathname: string, href: string): boolean {
  if (href === "/seo") return pathname === "/seo" || pathname === "/seo/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SubNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname() ?? "/seo";

  return (
    <Box
      component="nav"
      aria-label="SEO sub-apps"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        p: 0.75,
        mb: { xs: 3, md: 4 },
        borderRadius: 2.5,
        bgcolor: SURFACE,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {SEO_NAV.map((entry) => {
        const active = isActive(pathname, entry.href);
        const count = counts[entry.id];
        return (
          <Box
            key={entry.id}
            component={Link}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.9,
              px: { xs: 1.5, md: 2 },
              py: 1.05,
              borderRadius: 2,
              textDecoration: "none",
              whiteSpace: "nowrap",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: active ? "#fff" : MUTED,
              bgcolor: active ? NAVY : "transparent",
              boxShadow: active ? "0 1px 3px rgba(26,29,33,0.18)" : "none",
              transition: "background-color 120ms, color 120ms",
              "&:hover": {
                bgcolor: active ? NAVY : "rgba(255,255,255,0.85)",
                color: active ? "#fff" : INK,
              },
            }}
          >
            {entry.label}
            {typeof count === "number" && (
              <Box
                component="span"
                sx={{
                  px: 0.7,
                  py: 0.05,
                  borderRadius: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  bgcolor: active ? "rgba(255,255,255,0.2)" : "#fff",
                  color: active ? "#fff" : MUTED,
                  border: `1px solid ${active ? "rgba(255,255,255,0.3)" : HAIRLINE}`,
                  ...NUMERIC,
                }}
              >
                {count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/* ── window switch + connected property ────────────────────────────────── */

export function WindowSwitch({
  windowDays,
  onChange,
  loading,
  siteUrl,
}: {
  windowDays: WindowDays;
  onChange: (days: WindowDays) => void;
  loading: boolean;
  siteUrl: string | null;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {loading && <CircularProgress size={15} sx={{ color: MUTED }} />}
      {siteUrl !== null && (
        <Tooltip title={`Connected property: ${siteUrl}`} placement="left">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.6,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 1.5,
              bgcolor: "#fff",
              maxWidth: 280,
            }}
          >
            <CloudDone sx={{ fontSize: 15, color: NAVY }} />
            <Typography
              sx={{
                fontSize: 11.5,
                fontWeight: 600,
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {siteUrl.length > 0 ? siteUrl : "Search Console"}
            </Typography>
          </Box>
        </Tooltip>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={windowDays}
        onChange={(_, v: WindowDays | null) => {
          if (v !== null) onChange(v);
        }}
        sx={{
          bgcolor: "#fff",
          "& .MuiToggleButton-root": {
            textTransform: "none",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: MUTED,
            borderColor: HAIRLINE,
            px: 1.75,
            py: 0.6,
          },
          "& .Mui-selected": { bgcolor: `${NAVY} !important`, color: "#fff !important" },
        }}
      >
        <ToggleButton value={28}>28 days</ToggleButton>
        <ToggleButton value={90}>90 days</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

/* ── sub-app heading ───────────────────────────────────────────────────── */

/** Every sub-app opens the same way: its own name, then one line of purpose. */
export function SubAppHead({ title, purpose }: { title: string; purpose: string }) {
  return (
    <Box sx={{ mb: { xs: 3, md: 3.5 } }}>
      <Typography
        component="h2"
        sx={{
          fontFamily: DISPLAY,
          fontSize: { xs: "1.4rem", md: "1.55rem" },
          fontWeight: 600,
          color: INK,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: "0.95rem", color: MUTED, lineHeight: 1.6, maxWidth: PROSE_MAX }}>
        {purpose}
      </Typography>
    </Box>
  );
}

/* ── the one number that matters ───────────────────────────────────────── */

export type SupportStat = { label: string; value: string; hint?: string };

/**
 * The headline of a sub-app: one figure, large, with the supporting figures
 * demoted underneath it. `value` is always a string the caller formatted from a
 * real analysis output — this component never derives anything.
 */
export function HeroStat({
  label,
  value,
  note,
  tone = INK,
  supporting = [],
}: {
  label: string;
  value: string;
  note: ReactNode;
  tone?: string;
  supporting?: SupportStat[];
}) {
  return (
    <Box
      sx={{
        mb: { xs: 3, md: 4 },
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 2.5,
        bgcolor: "#fff",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 } }}>
        <SectionLabel>{label}</SectionLabel>
        <Typography
          sx={{
            mt: 1.25,
            fontFamily: DISPLAY,
            fontSize: { xs: "2.6rem", md: "3.1rem" },
            fontWeight: 600,
            color: tone,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            ...NUMERIC,
          }}
        >
          {value}
        </Typography>
        <Typography
          component="div"
          sx={{ mt: 1.25, fontSize: "0.875rem", color: MUTED, lineHeight: 1.65, maxWidth: PROSE_MAX }}
        >
          {note}
        </Typography>
      </Box>

      {supporting.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: `repeat(${Math.min(supporting.length, 4)}, minmax(0, 1fr))`,
            },
            borderTop: `1px solid ${HAIRLINE}`,
            bgcolor: SURFACE,
          }}
        >
          {supporting.map((stat) => (
            <Box
              key={stat.label}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 2,
                minWidth: 0,
                borderRight: `1px solid ${HAIRLINE}`,
                "&:last-of-type": { borderRight: "none" },
              }}
            >
              {stat.hint ? (
                <Tooltip title={stat.hint} placement="top-start">
                  <Box component="span" sx={{ display: "inline-block", cursor: "help" }}>
                    <SectionLabel>{stat.label}</SectionLabel>
                  </Box>
                </Tooltip>
              ) : (
                <SectionLabel>{stat.label}</SectionLabel>
              )}
              <Typography
                sx={{
                  mt: 0.6,
                  fontFamily: DISPLAY,
                  fontSize: "1.35rem",
                  fontWeight: 600,
                  color: INK,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  ...NUMERIC,
                }}
              >
                {stat.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ── detail on demand ──────────────────────────────────────────────────── */

/**
 * Collapses a block of documentation or diagnostics behind one line. Used for
 * the methodology bands: the formula must stay available and verbatim, but it
 * must not be the first thing competing with the data for attention.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 2, md: 2.5 },
          py: 1.75,
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          bgcolor: open ? SURFACE : "#fff",
          "&:hover": { bgcolor: SURFACE },
        }}
      >
        <SectionLabel>{summary}</SectionLabel>
        <ExpandMore
          sx={{
            fontSize: 19,
            color: MUTED,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms",
          }}
        />
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}

/* ── shared state gate ─────────────────────────────────────────────────── */

/**
 * The frame every sub-app renders inside. It prints the sub-app's own title and
 * purpose, then hands over to the shared not-connected / upstream-error / ready
 * handling so all five behave identically without repeating themselves.
 */
export function SubAppFrame({
  title,
  purpose,
  willShow,
  children,
}: {
  title: string;
  purpose: string;
  /** What this specific sub-app will show once Search Console is connected. */
  willShow: string;
  children: ReactNode;
}) {
  const { state, retry } = useSeoData();

  return (
    <Box>
      <SubAppHead title={title} purpose={purpose} />

      {state.status === "not-configured" && (
        <NotConnected
          source="Google Search Console"
          missing={state.missing}
          detail={state.detail}
          willShow={willShow}
        />
      )}

      {state.status === "error" && (
        <UpstreamError error={state.error} status={state.httpStatus} onRetry={retry} />
      )}

      {(state.status === "loading" || state.status === "ready") && children}
    </Box>
  );
}

/** A one-line banner for a degraded-but-contained failure. */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        mb: { xs: 3, md: 3.5 },
        px: 2.5,
        py: 2,
        border: `1px solid ${HAIRLINE}`,
        borderLeft: "3px solid #ed1b2f",
        borderRadius: 2,
        bgcolor: SURFACE,
      }}
    >
      <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.65, maxWidth: PROSE_MAX }}>
        {children}
      </Typography>
    </Box>
  );
}
