"use client";
// THE HOME SCREEN — a bento of five apps, and no navigation.
//
// A front door with nowhere to sprawl to cannot grow a thicket of links: the
// menu you get after one click is only the menu of the app you opened, and a
// sixth app is one more tile rather than one more branch.
//
// Every tile carries the app's real name, what it is for and what is inside it.
// The lead tile is bigger, not different — an abbreviated tile reads as a
// placeholder, and a placeholder on a front door looks unfinished.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
const FAINT = "#8b96a1";
const HAIRLINE = "#e6e8ec";
const RED = "#e2231a";

type App = {
  id: string; href: string; name: string; line: string; inside: string;
  icon: React.ReactNode; from: string; to: string;
};

const APPS: App[] = [
  {
    id: "dt", href: "/datatracker", name: "Datatracker",
    line: "What the shop saw, customer by customer, the day it happened.",
    inside: "Customers · Articles · MOQ · Availability",
    icon: <StorefrontIcon />, from: "#f2854f", to: "#9e4318",
  },
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
    // Lands on Erosion, not Price checks: /uc/price-checks still redirects into
    // the Datatracker tab, so the tile would drop you into Datatracker's menu and
    // the UC apps would never be seen.
    id: "uc", href: "/uc/erosion", name: "UC & HubSpot Apps",
    line: "The apps that write back into HubSpot — tickets, cards, syncs.",
    inside: "Erosion · Price checks · Web order sync",
    icon: <HubIcon />, from: "#f0b73c", to: "#9a6600",
  },
];

/** Not apps: the hub's own. After the divider, the way a dock does it. */
const HUB_TOOLS = [
  { id: "mc", href: "/mission-control", name: "Mission Control", icon: <DashboardIcon /> },
  { id: "live", href: "/live", name: "Live", icon: <SensorsIcon /> },
  { id: "gov", href: "/settings", name: "Governance", icon: <SecurityIcon /> },
];

const PINS_KEY = "apsohub:dock-pins";
const DEFAULT_PINS = ["dt", "web"];

export default function HomeScreen() {
  const [pins, setPins] = useState<string[]>(DEFAULT_PINS);

  // Which apps sit in the dock is a per-person convenience, so it lives in this
  // browser. It can come back empty — a private window, cleared site data — so
  // the defaults have to stand on their own.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PINS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length) {
          setPins(parsed.filter((id) => APPS.some((a) => a.id === id)));
        }
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


  /** One tile. `lead` only changes its size, never what it says. */
  const Tile = ({ a, lead }: { a: App; lead?: boolean }) => (
    <Box
      component={Link}
      href={a.href}
      sx={{
        textDecoration: "none",
        position: "relative", display: "flex", flexDirection: "column", minWidth: 0,
        borderRadius: 3, overflow: "hidden", cursor: "pointer", bgcolor: "#fff",
        border: `1px solid ${HAIRLINE}`,
        gridRow: lead ? { lg: "span 2" } : undefined,
        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 2px 4px rgba(26,58,76,.06), 0 16px 36px rgba(26,58,76,.12)",
          borderColor: "#d9dfe5",
        },
        "&:focus-visible": { outline: `2px solid ${a.to}`, outlineOffset: 2 },
      }}
    >
      {/* The colour area is composed, not left blank: a large ghost of the
          app's own mark bleeds out of the corner behind the icon. A tall tile
          then reads as a deliberate field rather than as an empty slab, which
          is exactly what the lead tile looked like when it only held one icon. */}
      <Box sx={{
        flex: lead ? 1 : "0 0 auto",
        minHeight: lead ? { xs: 132, lg: 196 } : { xs: 84, md: 90 },
        position: "relative", overflow: "hidden",
        display: "grid", placeItems: "center",
        background: `linear-gradient(140deg, ${a.from}, ${a.to})`, color: "#fff",
      }}>
        <Box aria-hidden sx={{
          position: "absolute", right: lead ? -44 : -26, bottom: lead ? -56 : -30,
          opacity: 0.16, lineHeight: 0,
          "& svg": { fontSize: lead ? { xs: 190, lg: 268 } : 128 },
        }}>{a.icon}</Box>
        <Box sx={{ position: "relative", lineHeight: 0, "& svg": { fontSize: lead ? { xs: 46, lg: 62 } : 34 } }}>
          {a.icon}
        </Box>
      </Box>

      {/* Pinning sits on the tile it pins; a preference buried in a settings
          screen is a preference nobody sets. */}
      <Tooltip title={pins.includes(a.id) ? "Remove from dock" : "Pin to dock"}>
        <Box
          component="button"
          aria-label={pins.includes(a.id) ? `Remove ${a.name} from the dock` : `Pin ${a.name} to the dock`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(a.id); }}
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

      {/* alignContent: start keeps name, line and contents as one block. They
          were being pushed apart by a box that stretched to the row height. */}
      <Box sx={{
        p: { xs: 1.9, md: 2.1 }, display: "grid", gap: 0.55, alignContent: "start", flex: "0 0 auto",
      }}>
        <Typography sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontSize: lead ? { xs: "1.2rem", lg: "1.38rem" } : "1.04rem",
          fontWeight: 600, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2,
        }}>{a.name}</Typography>
        <Typography sx={{ fontSize: lead ? "0.9rem" : "0.84rem", color: MUTED, lineHeight: 1.4 }}>
          {a.line}
        </Typography>
        <Typography sx={{ mt: 0.35, fontSize: "0.715rem", color: FAINT, lineHeight: 1.45 }}>
          {a.inside}
        </Typography>
      </Box>
    </Box>
  );

  const [lead, ...rest] = APPS;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", pb: { xs: 13, md: 14 } }}>
      <Box sx={{
        width: "100%", maxWidth: 1120, mx: "auto",
        px: { xs: 2.5, sm: 3, md: 4 }, pt: { xs: 3, md: 4 },
        display: "flex", flexDirection: "column", gap: { xs: 2.25, md: 2.75 },
      }}>
        {/* The wordmark, where a wordmark goes. The home screen does not need a
            headline telling you what you are looking at. */}
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
          <Box component="span" className="brand-display brand-apso" sx={{ fontSize: { xs: 30, md: 36 }, fontWeight: 700 }}>
            <span className="letter letter-a">A</span>
            <span className="letter letter-p">P</span>
            <span className="letter letter-s">S</span>
            <span className="letter letter-o">O</span>
          </Box>
          <Box component="span" className="brand-display" sx={{ fontSize: { xs: 30, md: 36 }, color: RED, fontWeight: 800 }}>
            hub
          </Box>
          <Typography sx={{ fontSize: "0.82rem", color: FAINT, ml: 0.5 }}>
            apsoparts.com
          </Typography>
        </Box>

        {/* Bento: one app leads at twice the height, the rest fit around it.
            Asymmetry fills a wide screen where an even grid leaves a hole. */}
        <Box sx={{
          display: "grid", gap: { xs: 1.75, md: 2 },
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "1.2fr 1fr 1fr" },
          gridTemplateRows: { lg: "auto auto" },
          alignItems: "stretch",
        }}>
          <Tile a={lead} lead />
          {rest.map((a) => <Tile key={a.id} a={a} />)}
        </Box>
      </Box>

      {/* The dock: what you actually open, then the hub's own after a divider. */}
      <Box sx={{
        position: "fixed", left: 0, right: 0,
        bottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
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
                component={Link} href={a.href} aria-label={a.name}
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
                component={Link} href={t.href} aria-label={t.name}
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
