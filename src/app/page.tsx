"use client";
// THE HOME SCREEN.
//
// A wall of apps and a dock, and no navigation whatsoever. That is deliberate:
// a front door with nowhere to sprawl to cannot grow a thicket of links, and
// the menu you get after one click is only the menu of the app you opened.
// Adding a sixth app is one more cover, not one more branch.
//
// One sign-in covers all of it. Which apps a person sees will be a permission
// on their account, set in Governance.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PublicIcon from "@mui/icons-material/Public";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RouteIcon from "@mui/icons-material/Route";
import HubIcon from "@mui/icons-material/Hub";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SecurityIcon from "@mui/icons-material/Security";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SensorsIcon from "@mui/icons-material/Sensors";

const INK = "#1a1d21";
const MUTED = "#5f6b76";
const HAIRLINE = "#e6e8ec";

type App = {
  id: string;
  href: string;
  name: string;
  line: string;
  inside: string;
  icon: React.ReactNode;
  from: string;
  to: string;
};

/** The five apps, in the order they are worked in rather than alphabetically. */
const APPS: App[] = [
  {
    id: "web", href: "/website/overview", name: "Website & Intelligence",
    line: "What the site does, who comes, and what they do once they are here.",
    inside: "Overview · Acquisition · Audience · Pages · Tracking health",
    icon: <PublicIcon />, from: "#3d86c4", to: "#1d4f7c",
  },
  {
    id: "mkt", href: "/create", name: "Marketing & Content",
    line: "Write it, keep it, find it again. SEO and GEO live here too.",
    inside: "Create Studio · Library · Templates · SEO · GEO · Personality",
    icon: <AutoAwesomeIcon />, from: "#e05552", to: "#92201e",
  },
  {
    id: "journey", href: "/journey", name: "Customer Journey & KPIs",
    line: "Who is buying, who stopped, and what the numbers say about it.",
    inside: "The journey · Funnels · KPIs · Customers · Visitors · SMEC",
    icon: <RouteIcon />, from: "#2fc896", to: "#0e7152",
  },
  {
    id: "uc", href: "/uc/price-checks", name: "UC & HubSpot Apps",
    line: "The apps that write back into HubSpot — tickets, cards, syncs.",
    inside: "Price checks · Erosion · Web order sync",
    icon: <HubIcon />, from: "#f0b73c", to: "#9a6600",
  },
  {
    id: "dt", href: "/datatracker", name: "Datatracker",
    line: "What the shop saw, customer by customer, the day it happened.",
    inside: "Customers · Articles · MOQ · Availability",
    icon: <StorefrontIcon />, from: "#f2854f", to: "#9e4318",
  },
];

/** Not apps: the hub's own. They sit after the divider, the way a dock does. */
const HUB_TOOLS = [
  { id: "mc", href: "/mission-control", name: "Mission Control", icon: <DashboardIcon /> },
  { id: "live", href: "/live", name: "Live", icon: <SensorsIcon /> },
  { id: "gov", href: "/settings", name: "Governance", icon: <SecurityIcon /> },
];

const PINS_KEY = "apsohub:dock-pins";
const DEFAULT_PINS = ["dt", "web"];

export default function HomeScreen() {
  const router = useRouter();
  const [pins, setPins] = useState<string[]>(DEFAULT_PINS);

  // Which apps sit in the dock is a per-person convenience, so it lives in this
  // browser rather than in the database. It can come back empty — a private
  // window, cleared site data — so the defaults have to stand on their own.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length) setPins(parsed.filter((id) => APPS.some((a) => a.id === id)));
      }
    } catch { /* defaults are fine */ }
  }, []);

  const togglePin = useCallback((id: string) => {
    setPins((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try { localStorage.setItem(PINS_KEY, JSON.stringify(next)); } catch { /* not worth failing over */ }
      return next;
    });
  }, []);

  const go = (href: string) => () => router.push(href);
  const keyGo = (href: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); }
  };

  return (
    <Box sx={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      // room for the dock, which floats over the foot of the screen
      pb: { xs: 13, md: 14 },
    }}>
      <Box sx={{
        width: "100%", maxWidth: 1180, mx: "auto",
        px: { xs: 2.5, sm: 3, md: 4 }, pt: { xs: 4, md: 7 },
        display: "grid", gap: { xs: 3, md: 4 },
      }}>
        <Box>
          <Typography component="h1" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontWeight: 600, color: INK, letterSpacing: "-0.035em",
            fontSize: { xs: "2.1rem", md: "2.9rem" }, lineHeight: 1.03,
          }}>APSOhub</Typography>
          <Typography sx={{ fontSize: "1.02rem", color: MUTED, mt: 0.75, maxWidth: "58ch" }}>
            Five apps, one sign-in. Open one and the menu becomes its menu.
          </Typography>
        </Box>

        {/* The wall. Each app is a cover, not an icon floating on a background —
            recognisable by its colour band before the name is read. */}
        <Box sx={{
          display: "grid", gap: { xs: 2, md: 2.5 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
        }}>
          {APPS.map((a) => (
            <Box
              key={a.id}
              role="link"
              tabIndex={0}
              onClick={go(a.href)}
              onKeyDown={keyGo(a.href)}
              sx={{
                position: "relative", display: "flex", flexDirection: "column",
                borderRadius: 3, overflow: "hidden", cursor: "pointer", bgcolor: "#fff",
                border: `1px solid ${HAIRLINE}`,
                transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: "0 2px 4px rgba(26,58,76,.06), 0 16px 36px rgba(26,58,76,.12)",
                  borderColor: "#d9dfe5",
                },
                "&:focus-visible": { outline: `2px solid ${a.to}`, outlineOffset: 2 },
              }}
            >
              <Box sx={{
                height: { xs: 92, md: 104 }, display: "grid", placeItems: "center",
                background: `linear-gradient(140deg, ${a.from}, ${a.to})`, color: "#fff",
                "& svg": { fontSize: 40 },
              }}>
                {a.icon}
              </Box>

              {/* Pinning is the dock's only input, so it sits on the cover it
                  pins rather than in a settings screen nobody opens. */}
              <Tooltip title={pins.includes(a.id) ? "Remove from dock" : "Pin to dock"}>
                <Box
                  component="button"
                  aria-label={pins.includes(a.id) ? `Remove ${a.name} from the dock` : `Pin ${a.name} to the dock`}
                  onClick={(e) => { e.stopPropagation(); togglePin(a.id); }}
                  sx={{
                    position: "absolute", top: 10, right: 10, width: 26, height: 26,
                    borderRadius: "50%", border: 0, cursor: "pointer", display: "grid", placeItems: "center",
                    bgcolor: pins.includes(a.id) ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.22)",
                    color: pins.includes(a.id) ? a.to : "#fff",
                    fontSize: 14, lineHeight: 1, transition: "background-color .14s ease",
                    "&:hover": { bgcolor: "rgba(255,255,255,.95)", color: a.to },
                  }}
                >
                  {pins.includes(a.id) ? "●" : "○"}
                </Box>
              </Tooltip>

              <Box sx={{ p: { xs: 2, md: 2.25 }, display: "grid", gap: 0.6, flex: 1 }}>
                <Typography sx={{
                  fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                  fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2,
                }}>{a.name}</Typography>
                <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.45 }}>{a.line}</Typography>
                <Typography sx={{ mt: "auto", pt: 0.75, fontSize: "0.72rem", color: "#8b96a1", lineHeight: 1.4 }}>
                  {a.inside}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* The dock: what you actually open, and the hub's own after a divider.
          Two tiers without a second screen. */}
      <Box sx={{
        position: "fixed", left: 0, right: 0,
        bottom: `calc(14px + env(safe-area-inset-bottom, 0px))`,
        display: "flex", justifyContent: "center", px: 2, pointerEvents: "none", zIndex: 10,
      }}>
        <Box sx={{
          pointerEvents: "auto", display: "flex", alignItems: "center", gap: 1,
          px: 1.25, py: 1, borderRadius: 4,
          bgcolor: "rgba(255,255,255,.86)", backdropFilter: "blur(14px)",
          border: `1px solid ${HAIRLINE}`,
          boxShadow: "0 2px 6px rgba(26,58,76,.07), 0 18px 44px rgba(26,58,76,.16)",
          maxWidth: "100%", overflowX: "auto",
        }}>
          {APPS.filter((a) => pins.includes(a.id)).map((a) => (
            <Tooltip key={a.id} title={a.name}>
              <Box
                role="link" tabIndex={0} aria-label={a.name}
                onClick={go(a.href)} onKeyDown={keyGo(a.href)}
                sx={{
                  width: 42, height: 42, borderRadius: 2.6, display: "grid", placeItems: "center",
                  cursor: "pointer", color: "#fff", flexShrink: 0,
                  background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
                  "& svg": { fontSize: 22 },
                  transition: "transform .14s ease",
                  "&:hover": { transform: "translateY(-3px)" },
                  "&:focus-visible": { outline: `2px solid ${a.to}`, outlineOffset: 2 },
                }}
              >{a.icon}</Box>
            </Tooltip>
          ))}

          {pins.length > 0 && (
            <Box sx={{ width: "1px", alignSelf: "stretch", my: 0.5, bgcolor: HAIRLINE, flexShrink: 0 }} />
          )}

          {HUB_TOOLS.map((t) => (
            <Tooltip key={t.id} title={t.name}>
              <Box
                role="link" tabIndex={0} aria-label={t.name}
                onClick={go(t.href)} onKeyDown={keyGo(t.href)}
                sx={{
                  width: 42, height: 42, borderRadius: 2.6, display: "grid", placeItems: "center",
                  cursor: "pointer", color: "#44525e", bgcolor: "#eef2f5", flexShrink: 0,
                  "& svg": { fontSize: 21 },
                  transition: "transform .14s ease, background-color .14s ease",
                  "&:hover": { transform: "translateY(-3px)", bgcolor: "#e4eaef" },
                  "&:focus-visible": { outline: "2px solid #274e64", outlineOffset: 2 },
                }}
              >{t.icon}</Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
