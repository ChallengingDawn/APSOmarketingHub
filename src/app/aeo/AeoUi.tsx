"use client";
// AI ANSWERS (AEO) - what the three pages share: the read (useAeo), the header that says
// where the figures come from and since when the hub keeps them, and the small parts.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import PageHeader from "@/app/PageHeader";
import { FAINT, GlassCard, INK, MUTED, RED } from "@/app/uc/report/ui";
import { useSlow } from "@/app/reporting/marketing-kpis/data";
import type { AeoData } from "@/lib/aeo/model";

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
    ? `What ChatGPT, Gemini and Claude answer to the ${int(data.prompts.length)} prompts in HubSpot's AEO · ${int(data.runs.length)} answers kept in the hub${data.since ? ` since ${day(data.since)}` : ""} · read ${day(data.generatedAt)}`
    : "What ChatGPT, Gemini and Claude answer to the prompts in HubSpot's AEO";
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <PageHeader title={title} subtitle={sub} />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        {PAGES.map((p) => {
          const on = path === p.href;
          return (
            <Box key={p.href} component={Link} href={p.href} sx={{
              px: 1.75, py: 0.8, borderRadius: "12px", fontSize: "0.86rem", fontWeight: 600, textDecoration: "none",
              color: on ? "#2459d1" : MUTED, bgcolor: on ? "#e6edfd" : "rgba(255,255,255,.7)", border: "1px solid rgba(21,34,58,.08)",
              "&:hover": { color: on ? "#2459d1" : INK },
            }}>{p.label}</Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** While the first read runs, or why it could not. */
export function AeoWaiting({ computing, progress, error }: { computing: boolean; progress?: string; error?: string }) {
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
