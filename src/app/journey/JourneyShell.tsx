"use client";

// The Customer Journey application.
//
// It is its own app, not a tab of Analytics: it answers one question end to
// end — where buyers come in, how far they get, and where we lose them — and
// its tabs are screens of that question. None of them leaves the app; the
// sidebar is the way to another application.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED, SURFACE } from "@/app/analytics/Shell";

export const JOURNEY_NAV = [
  { id: "board", href: "/journey", label: "The journey", purpose: "Five stages, fifteen steps, as the business defines them" },
  { id: "funnels", href: "/journey/funnels", label: "Funnels", purpose: "Where companies move between lifecycle stages, and where they stop" },
  { id: "sources", href: "/journey/sources", label: "Where the data comes from", purpose: "Workbook rows, live sources, and what is still missing" },
  { id: "import", href: "/journey/import", label: "Import the workbook", purpose: "Upload Alexandre's file, see what changes, then apply it" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/journey") return pathname === "/journey" || pathname === "/journey/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function JourneySubNav() {
  const pathname = usePathname() ?? "/journey";
  return (
    <Box
      component="nav"
      aria-label="Customer journey screens"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
        gap: 0.75,
        p: 0.75,
        mb: { xs: 3, md: 4 },
        borderRadius: 2.5,
        bgcolor: SURFACE,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {JOURNEY_NAV.map((entry) => {
        const active = isActive(pathname, entry.href);
        return (
          <Box
            key={entry.id}
            component={Link}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            sx={{
              display: "block",
              px: 1.5,
              py: 1.1,
              borderRadius: 2,
              textDecoration: "none",
              bgcolor: active ? "#fff" : "transparent",
              border: `1px solid ${active ? HAIRLINE : "transparent"}`,
              boxShadow: active ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
              "&:hover": { bgcolor: active ? "#fff" : "rgba(16,24,40,0.03)" },
            }}
          >
            <Typography sx={{ fontSize: "0.86rem", fontWeight: active ? 700 : 600, color: active ? INK : MUTED }}>
              {entry.label}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.25 }}>{entry.purpose}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
