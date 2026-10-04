"use client";
// THE LAUNCH PAD.
//
// The hub is not the marketing app any more; it is the front door to all of
// them. So the home page is a home SCREEN: you pick an app, you go into it, and
// the menu becomes that app's menu. Nothing else competes for attention here.
//
// One sign-in covers the lot. Which apps a person sees is a permission on their
// account, set in Governance — an app somebody cannot open is shown locked
// rather than hidden, so people learn what exists and can ask for it.

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PublicIcon from "@mui/icons-material/Public";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RouteIcon from "@mui/icons-material/Route";
import HubIcon from "@mui/icons-material/Hub";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SecurityIcon from "@mui/icons-material/Security";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SensorsIcon from "@mui/icons-material/Sensors";

const GUTTER = { xs: 2, sm: 2.5, md: 3, lg: 4 } as const;
const INK = "#1a1d21";
const MUTED = "#5f6b76";

/**
 * The five apps, in the order they are worked in rather than alphabetically.
 * `href` is the app's own front door; the sidebar scopes itself to whichever
 * app that path belongs to.
 */
const APPS = [
  {
    href: "/website/overview",
    name: "Website & Intelligence",
    line: "What the site does, who comes, and what they do once they are here.",
    inside: "Overview · Acquisition · Audience · Pages · Tracking health",
    icon: <PublicIcon />,
    colour: "#2d6fa8",
  },
  {
    href: "/create",
    name: "Marketing & Content",
    line: "Write it, keep it, and find it again. SEO and GEO live here too.",
    inside: "Create Studio · Library · Templates · SEO · GEO · Personality",
    icon: <AutoAwesomeIcon />,
    colour: "#c5221f",
  },
  {
    href: "/journey",
    name: "Customer Journey & KPIs",
    line: "Who is buying, who stopped, and what the numbers are doing about it.",
    inside: "The journey · Funnels · KPIs · Customers · Visitors · SMEC",
    icon: <RouteIcon />,
    colour: "#1baf7a",
  },
  {
    href: "/uc/price-checks",
    name: "UC & HubSpot Apps",
    line: "The apps that write back into HubSpot — tickets, cards, syncs.",
    inside: "Price checks · Web order sync",
    icon: <HubIcon />,
    colour: "#eda100",
  },
  {
    href: "/datatracker",
    name: "Datatracker",
    line: "What the shop saw, customer by customer, the day it happened.",
    inside: "Customers · Articles · MOQ · Availability",
    icon: <StorefrontIcon />,
    colour: "#eb6834",
  },
] as const;

/** Not apps: the hub's own, which is what one sign-in buys. */
const HUB = [
  { href: "/mission-control", name: "Mission Control", icon: <DashboardIcon />, line: "The week at a glance" },
  { href: "/live", name: "Live", icon: <SensorsIcon />, line: "Who is on the site right now" },
  { href: "/settings", name: "Governance", icon: <SecurityIcon />, line: "People, access, integrations, audit" },
] as const;

export default function LaunchPad() {
  const router = useRouter();

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, pt: { xs: 2, md: 4 }, pb: { xs: 3, md: 6 }, display: "grid", gap: 3 }}>
      <Box sx={{ maxWidth: "62ch" }}>
        <Typography component="h1" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontWeight: 600, color: INK, letterSpacing: "-0.035em",
          fontSize: { xs: "2rem", md: "2.6rem" }, lineHeight: 1.05,
        }}>APSOhub</Typography>
        <Typography sx={{ fontSize: "1rem", color: MUTED, mt: 0.75 }}>
          Five apps, one sign-in. Pick one and the menu becomes its menu.
        </Typography>
      </Box>

      {/* The springboard. Big targets, one per app, nothing else competing. */}
      <Box sx={{
        display: "grid", gap: 2,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
      }}>
        {APPS.map((a) => (
          <Box
            key={a.href}
            role="link"
            tabIndex={0}
            onClick={() => router.push(a.href)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(a.href); } }}
            sx={{
              display: "flex", flexDirection: "column", gap: 1.25,
              p: 2.5, borderRadius: 3, cursor: "pointer", bgcolor: "#fff",
              border: "1px solid #e6e8ec", minHeight: 184,
              transition: "transform .14s ease, box-shadow .14s ease, border-color .14s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 2px 4px rgba(26,58,76,.06), 0 14px 32px rgba(26,58,76,.10)",
                borderColor: "#d7dde3",
              },
              "&:focus-visible": { outline: `2px solid ${a.colour}`, outlineOffset: 2 },
            }}
          >
            {/* The icon carries the app's colour; everything else stays quiet,
                so the grid is recognisable by shape before it is read. */}
            <Box sx={{
              width: 48, height: 48, borderRadius: 2.6, bgcolor: a.colour, color: "#fff",
              display: "grid", placeItems: "center", flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,.16)", "& svg": { fontSize: 27 },
            }}>{a.icon}</Box>

            <Box sx={{ display: "grid", gap: 0.5 }}>
              <Typography sx={{
                fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2,
              }}>{a.name}</Typography>
              <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.45 }}>{a.line}</Typography>
            </Box>

            <Typography sx={{
              mt: "auto", fontSize: "0.72rem", color: "#8b96a1", lineHeight: 1.4,
            }}>{a.inside}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "grid", gap: 1.25, mt: 1 }}>
        <Typography sx={{
          fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "#8b96a1",
        }}>The hub itself</Typography>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
          {HUB.map((h) => (
            <Box
              key={h.href}
              role="link"
              tabIndex={0}
              onClick={() => router.push(h.href)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(h.href); } }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.5, p: 1.75, borderRadius: 2.4,
                cursor: "pointer", bgcolor: "#fff", border: "1px solid #e6e8ec",
                transition: "border-color .14s ease, background-color .14s ease",
                "&:hover": { bgcolor: "#fafbfc", borderColor: "#d7dde3" },
                "&:focus-visible": { outline: "2px solid #274e64", outlineOffset: 2 },
              }}
            >
              <Box sx={{
                width: 34, height: 34, borderRadius: 1.8, bgcolor: "#eef2f5", color: "#44525e",
                display: "grid", placeItems: "center", flexShrink: 0, "& svg": { fontSize: 19 },
              }}>{h.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>{h.name}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{h.line}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
