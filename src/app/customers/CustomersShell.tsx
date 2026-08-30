"use client";

// The rail the three Customers sub-apps share. Same pattern as Analytics:
// real routes, a persistent strip, the active one obvious.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED, SURFACE } from "@/app/analytics/Shell";

export const CUSTOMERS_NAV = [
  { id: "overview", href: "/customers", label: "Overview", purpose: "Who was on the site, segmented" },
  { id: "visitors", href: "/customers/visitors", label: "Visitors", purpose: "Traffic beside known companies" },
  { id: "journeys", href: "/customers/journeys", label: "Journeys", purpose: "What customers actually browsed" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/customers") return pathname === "/customers" || pathname === "/customers/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomersSubNav() {
  const pathname = usePathname() ?? "/customers";
  return (
    <Box
      component="nav"
      aria-label="Customers sub-apps"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        gap: 0.75,
        p: 0.75,
        mb: { xs: 3, md: 4 },
        borderRadius: 2.5,
        bgcolor: SURFACE,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {CUSTOMERS_NAV.map((entry) => {
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
