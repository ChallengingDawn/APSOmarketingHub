"use client";
// AI ANSWERS (AEO) - what the three pages share: the read (useAeo), the header that says
// where the figures come from and since when the hub keeps them, and the small parts.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import PageHeader from "@/app/PageHeader";
import { FAINT, GlassCard, MUTED, RED } from "@/app/uc/report/ui";
import { HAIRLINE as SEO_HAIRLINE, INK as SEO_INK, MUTED as SEO_MUTED, NAVY, SURFACE } from "@/app/seo/ui";
import { useSlow } from "@/app/reporting/marketing-kpis/data";
import { namesIn, type AeoData } from "@/lib/aeo/model";

export const useAeo = () => useSlow<AeoData>("/api/aeo", "aeo");

export const int = (n: number) => Math.round(n).toLocaleString("en");
export const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const PAGES = [
  { href: "/aeo", label: "Overview" },
  { href: "/aeo/prompts", label: "Prompts and answers" },
  { href: "/aeo/recommendations", label: "Recommendations" },
];

/** The title, where it comes from, and the three pages. */
export function AeoHeader({ title, data }: { title: string; data: AeoData | null }) {
  const path = usePathname();
  const sub = data
    ? `What ${namesIn(data.runs)} answer to the ${int(data.prompts.length)} prompts in HubSpot's AEO · ${int(data.runs.length)} answers kept in the hub${data.since ? ` since ${day(data.since)}` : ""} · read ${day(data.generatedAt)}`
    : "What the AI assistants answer to the prompts in HubSpot's AEO";
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <PageHeader title={title} subtitle={sub} />
      {/* the same strip the SEO sub-apps use (seo/Shell.tsx SubNav) - SARCLA 17.10: "tabs are different than in SEO" */}
      <Box component="nav" aria-label="AEO pages" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, p: 0.75, borderRadius: 2.5, bgcolor: SURFACE, border: `1px solid ${SEO_HAIRLINE}` }}>
        {PAGES.map((p) => {
          const on = path === p.href;
          return (
            <Box key={p.href} component={Link} href={p.href} aria-current={on ? "page" : undefined} sx={{
              display: "flex", alignItems: "center", px: { xs: 1.5, md: 2 }, py: 1.05, borderRadius: 2, textDecoration: "none", whiteSpace: "nowrap",
              fontSize: "0.875rem", fontWeight: 600, color: on ? "#fff" : SEO_MUTED, bgcolor: on ? NAVY : "transparent",
              boxShadow: on ? "0 1px 3px rgba(26,29,33,0.18)" : "none", transition: "background-color 120ms, color 120ms",
              "&:hover": { bgcolor: on ? NAVY : "rgba(255,255,255,0.85)", color: on ? "#fff" : SEO_INK },
            }}>{p.label}</Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** While the first read runs, or why it could not. */
export function AeoWaiting({ computing, progress, error: lastError }: { computing: boolean; progress?: string; error?: string }) {
  // while the hub reads again, an earlier failure is not the answer (17.10: the refusal from before the app was re-authorised stayed up)
  const error = computing ? undefined : lastError;
  const scope = error && /scope|403|MISSING_SCOPES/i.test(error);
  return (
    <GlassCard>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {!error && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: error ? RED : MUTED }}>
          {error
            ? scope ? "HubSpot refused the AEO read: the hub's HubSpot app needs the marketing.aeo.read permission." : `Could not read HubSpot's AEO: ${error}`
            : computing ? `Reading HubSpot's AEO${progress ? ` - ${progress}` : ""}. A few minutes the first time.` : "Loading…"}
        </Typography>
      </Box>
    </GlassCard>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>{children}</Typography>;
}
