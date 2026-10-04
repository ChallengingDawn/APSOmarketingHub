"use client";
// THE FRONT PAGE — soft glass.
//
// A floating glass bar instead of a sidebar, five app cards that each list what
// is inside them, and resources underneath. The colour is a slow pastel mesh
// that drifts: the cards are glass, and glass over a flat grey just looks like
// a box with a faint border.
//
// Every link here goes to a route that exists, and the search looks through the
// real app list rather than pretending. Motion is held to a drift and a lift,
// and all of it stops under prefers-reduced-motion.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import StorefrontIcon from "@mui/icons-material/Storefront";
import PublicIcon from "@mui/icons-material/Public";
import CampaignIcon from "@mui/icons-material/Campaign";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import HubIcon from "@mui/icons-material/Hub";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HomeIcon from "@mui/icons-material/Home";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SensorsIcon from "@mui/icons-material/Sensors";
import AppsIcon from "@mui/icons-material/Apps";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import HubIconGlyph from "./HubIcon";
import QuickLinks from "./QuickLinks";
import MeshBackground, { MESH_BASE } from "./MeshBackground";
import { APPS, HUB_TOOLS, search as searchApps, type HubApp, type Hit } from "./hubApps";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

const APP_ICON: Record<HubApp["icon"], React.ReactNode> = {
  store: <StorefrontIcon />, globe: <PublicIcon />, campaign: <CampaignIcon />,
  trend: <TrendingUpIcon />, hub: <HubIcon />,
};

/** Real changes, on the dates they shipped. */
const NEWS = [
  { text: "Price checks, MOQ and availability in Datatracker", when: "4 Oct", dot: "#5b8def" },
  { text: "The hub became five apps with one front page", when: "4 Oct", dot: "#ef5fa0" },
  { text: "GEO readiness and the fix queue", when: "1 Oct", dot: "#2ec29a" },
  { text: "Erosion tickets merge per customer per month", when: "28 Sep", dot: "#9a7bf0" },
];

const glass = {
  bgcolor: "rgba(255,255,255,.60)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,.75)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 14px 36px rgba(31,45,78,.075)",
};

const focusRing = {
  "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 3, borderRadius: 10 },
};

/**
 * Entrance: a short rise, staggered across the row.
 *
 * No reduced-motion key of its own — it would be spread alongside one and
 * silently overwrite it. The page root turns every animation and transition
 * off in one rule instead.
 */
const rise = (i: number) => ({
  animation: `riseIn .5s cubic-bezier(.22,.8,.3,1) ${0.05 + i * 0.07}s both`,
});

export default function FrontPage() {
  const router = useRouter();
  const [initials, setInitials] = useState("");
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const boxRef = useRef<HTMLDivElement | null>(null);

  // The real signed-in person, not a placeholder. Nothing else on this page
  // depends on it, so a failure costs the initials and nothing more.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const name: string | undefined = j?.user?.full_name || j?.user?.username;
        if (!alive || !name) return;
        setInitials(name.trim().split(/\s+/).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase());
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const hits = useMemo<Hit[]>(() => searchApps(q), [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenSearch(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  // One row. Destinations and the two in-page anchors together — a second nav
  // strip underneath asked people to learn two menus on one screen, and put
  // Settings in the chrome twice. Account things live behind the avatar now.
  const NAV = [
    { name: "Home", href: "/", icon: <HomeIcon />, on: true },
    { name: "Applications", href: "#applications", icon: <AppsIcon />, on: false },
    { name: "Mission Control", href: "/mission-control", icon: <DashboardOutlinedIcon />, on: false },
    { name: "Live", href: "/live", icon: <SensorsIcon />, on: false },
    { name: "Resources", href: "#resources", icon: <MenuBookIcon />, on: false },
    { name: "Settings", href: "/settings", icon: <SettingsOutlinedIcon />, on: false },
  ];

  return (
    <Box sx={{
      minHeight: "100vh", position: "relative", overflowX: "hidden", bgcolor: MESH_BASE,
      // One rule for the whole page: somebody who asked their system for less
      // motion gets none, and no component has to remember to opt out.
      "@media (prefers-reduced-motion: reduce)": {
        "&, & *": {
          animationDuration: "0.01ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.01ms !important",
          scrollBehavior: "auto !important",
        },
      },
      "@keyframes riseIn": { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
    }}>
      <MeshBackground />

      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1480, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 } }}>

        {/* ---------------------------------------------------------------- bar */}
        <Box sx={{
          ...glass, borderRadius: "22px", px: { xs: 2, md: 2.5 }, py: 1.5, ...rise(0),
          display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2 }, flexWrap: "wrap",
        }}>
          <Box component={Link} href="/" sx={{ textDecoration: "none", display: "grid", lineHeight: 1, ...focusRing }}>
            {/* No gap: it is APSOhub, one word. A space made it read as two
                products sharing a header. */}
            <Box sx={{ display: "flex", alignItems: "baseline" }}>
              <Box component="span" sx={{
                fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: INK,
              }}>APSO</Box>
              <Box component="span" sx={{
                fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em",
                background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              }}>hub</Box>
            </Box>
            <Typography sx={{ fontSize: "0.68rem", color: FAINT, mt: 0.3 }}>apsoparts.com</Typography>
          </Box>

          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.4 }}>
            {NAV.map((n) => (
              <Box key={n.name} component={Link} href={n.href} sx={{
                display: "flex", alignItems: "center", gap: 0.8, px: 1.6, py: 1, borderRadius: "14px",
                textDecoration: "none", fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
                color: n.on ? ACCENT : MUTED,
                bgcolor: n.on ? "rgba(59,125,246,.13)" : "transparent",
                transition: "background-color .18s ease, color .18s ease",
                "& svg": { fontSize: 19 }, ...focusRing,
                "&:hover": { bgcolor: n.on ? "rgba(59,125,246,.18)" : "rgba(21,34,58,.05)", color: n.on ? ACCENT : INK },
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
              }}>{n.icon}{n.name}</Box>
            ))}
          </Box>

          <Box ref={boxRef} sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.5, position: "relative" }}>
            <Box sx={{
              display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1,
              width: { sm: 220, lg: 320 }, px: 1.75, py: 1, borderRadius: "14px",
              bgcolor: "rgba(255,255,255,.8)", border: "1px solid rgba(21,34,58,.08)",
              transition: "border-color .18s ease, box-shadow .18s ease",
              "&:focus-within": { borderColor: ACCENT, boxShadow: `0 0 0 3px rgba(59,125,246,.16)` },
            }}>
              <SearchIcon sx={{ fontSize: 18, color: FAINT }} />
              <Box
                component="input"
                value={q}
                placeholder="Search apps, tools or help…"
                aria-label="Search apps and tools"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQ(e.target.value); setOpenSearch(true); }}
                onFocus={() => setOpenSearch(true)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && hits[0]) router.push(hits[0].href);
                  if (e.key === "Escape") setOpenSearch(false);
                }}
                sx={{
                  flex: 1, minWidth: 0, border: 0, outline: 0, background: "none",
                  fontFamily: "inherit", fontSize: "0.86rem", color: INK,
                  "&::placeholder": { color: FAINT },
                }}
              />
            </Box>

            {openSearch && q.trim() && (
              <Box sx={{
                position: "absolute", top: "calc(100% + 10px)", right: 0, width: { xs: 280, sm: 340 },
                ...glass, bgcolor: "rgba(255,255,255,.94)", borderRadius: "16px", p: 1, zIndex: 20,
                maxHeight: 360, overflowY: "auto",
              }}>
                {hits.length === 0 && (
                  <Typography sx={{ fontSize: "0.84rem", color: MUTED, p: 1.5 }}>
                    Nothing here matches &ldquo;{q.trim()}&rdquo;.
                  </Typography>
                )}
                {hits.map((h) => (
                  <Box key={h.app + h.href + h.name} component={Link} href={h.href}
                    onClick={() => setOpenSearch(false)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.25, p: 1, borderRadius: "12px",
                      textDecoration: "none", ...focusRing,
                      "&:hover": { bgcolor: "rgba(59,125,246,.09)" },
                    }}>
                    <Box sx={{
                      width: 30, height: 30, borderRadius: "9px", flexShrink: 0, display: "grid", placeItems: "center",
                      bgcolor: h.tint, color: h.fg,
                    }}><HubIconGlyph name={h.icon} fontSize={16} /></Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: INK, lineHeight: 1.25 }}>{h.name}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: FAINT, lineHeight: 1.3 }}>{h.app}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Your account, not the Settings front page: a person clicking
                their own initials wants their own account. */}
            <Box component={Link} href="/settings/you" aria-label="Your account" title="Your account" sx={{
              width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center",
              background: "linear-gradient(140deg,#5b8def,#7c5cf0)", color: "#fff", textDecoration: "none",
              fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.02em", ...focusRing,
              transition: "transform .18s ease",
              "&:hover": { transform: "scale(1.06)" },
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}>
              {/* A dot told nobody anything. Until the name arrives this is a
                  face, which at least says whose button it is. */}
              {initials || <AccountCircleIcon sx={{ fontSize: 24 }} />}
            </Box>
          </Box>
        </Box>

        {/* No hero. The wordmark is in the bar, and a page whose job is to
            hand you five doors does not need a paragraph telling you so. The
            apps start at the top, where the eye already is. */}
        {/* --------------------------------------------------------- applications */}
        <Box id="applications" sx={{
          display: "grid", gap: { xs: 2, md: 2 }, alignItems: "stretch", mt: { xs: 2.5, md: 3 },
          gridTemplateColumns: {
            xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)",
          },
          "@media (min-width:1280px)": { gridTemplateColumns: "repeat(5, 1fr)" },
        }}>
          {APPS.map((a, i) => {
            const open = !!expanded[a.key];
            const shown = open ? a.subs : a.subs.slice(0, 3);
            return (
              <Box key={a.key} sx={{
                ...glass, borderRadius: "22px", p: { xs: 2, md: 2.1 },
                display: "flex", flexDirection: "column", gap: 1.5,
                background: `linear-gradient(170deg, ${a.wash}, rgba(255,255,255,.64) 58%)`,
                transition: "transform .22s cubic-bezier(.22,.8,.3,1), box-shadow .22s ease",
                "&:hover": { transform: "translateY(-4px)", boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 24px 52px rgba(31,45,78,.12)" },
                "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
                ...rise(i + 1),
              }}>
                <Box sx={{
                  width: 58, height: 58, borderRadius: "17px", display: "grid", placeItems: "center",
                  background: `linear-gradient(140deg, ${a.from}, ${a.to})`, color: "#fff",
                  boxShadow: `0 10px 22px ${a.wash}`, "& svg": { fontSize: 31 },
                }}>{APP_ICON[a.icon]}</Box>

                <Box>
                  <Box component={Link} href={a.href} sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.4, textDecoration: "none",
                    color: INK, ...focusRing,
                    "&:hover .chev": { transform: "translateX(4px)" },
                  }}>
                    <Typography component="span" sx={{
                      fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                      fontSize: "1.26rem", fontWeight: 600, letterSpacing: "-0.028em", lineHeight: 1.16,
                    }}>{a.name}</Typography>
                    <ChevronRightIcon className="chev" sx={{
                      fontSize: 21, color: a.to, transition: "transform .18s ease",
                      "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                    }} />
                  </Box>
                  <Typography sx={{ fontSize: "0.875rem", color: MUTED, mt: 0.6, lineHeight: 1.45 }}>{a.line}</Typography>
                </Box>

                <Box sx={{ display: "grid", gap: 1, mt: "auto" }}>
                  {shown.map((s) => (
                    <Box key={s.href + s.name} component={Link} href={s.href} sx={{
                      display: "flex", alignItems: "center", gap: 1.2, p: 1.05, borderRadius: "14px",
                      textDecoration: "none", bgcolor: "rgba(255,255,255,.72)",
                      border: "1px solid rgba(255,255,255,.85)", ...focusRing,
                      transition: "background-color .18s ease, transform .18s ease",
                      "&:hover": { bgcolor: "#fff", transform: "translateX(3px)" },
                      "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
                    }}>
                      <Box sx={{
                        width: 34, height: 34, borderRadius: "11px", flexShrink: 0, display: "grid", placeItems: "center",
                        bgcolor: s.tint, color: s.fg,
                      }}><HubIconGlyph name={s.icon} /></Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                          {s.name}
                        </Typography>
                        <Typography sx={{ fontSize: "0.735rem", color: FAINT, lineHeight: 1.3 }}>{s.note}</Typography>
                      </Box>
                      <ChevronRightIcon sx={{ fontSize: 17, color: FAINT, flexShrink: 0 }} />
                    </Box>
                  ))}

                  {a.subs.length > 3 && (
                    <Box
                      component="button"
                      onClick={() => setExpanded((e) => ({ ...e, [a.key]: !e[a.key] }))}
                      aria-expanded={open}
                      sx={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 0.4,
                        border: 0, background: "none", cursor: "pointer", p: 0.75, borderRadius: "10px",
                        fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600, color: a.to, ...focusRing,
                        "&:hover": { bgcolor: "rgba(255,255,255,.6)" },
                      }}
                    >
                      {open ? "Show less" : `View all ${a.subs.length}`}
                      <ExpandMoreIcon sx={{
                        fontSize: 17, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease",
                        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                      }} />
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* ------------------------------------------------------------ resources */}
        <Box id="resources" sx={{
          display: "grid", gap: 2, mt: 2,
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          "@media (min-width:1280px)": { gridTemplateColumns: "1.15fr 1fr 1fr" },
          ...rise(6),
        }}>
          <QuickLinks glass={glass} />

          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.25 } }}>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", mb: 1.75 }}>
              What&rsquo;s new
            </Typography>
            <Box sx={{ display: "grid", gap: 1.15 }}>
              {NEWS.map((n) => (
                <Box key={n.text} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: n.dot, mt: 0.65, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1, lineHeight: 1.4 }}>{n.text}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap", mt: 0.1 }}>{n.when}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box component={Link} href="/mission-control" sx={{
            ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 }, position: "relative", overflow: "hidden",
            textDecoration: "none", minHeight: 170, display: "flex", flexDirection: "column", justifyContent: "center",
            background: "linear-gradient(150deg, rgba(154,123,240,.18), rgba(91,141,239,.13) 58%, rgba(255,255,255,.72))",
            ...focusRing,
            transition: "transform .22s ease",
            "&:hover": { transform: "translateY(-3px)" },
            "&:hover .go": { transform: "translateX(4px)" },
            "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
          }}>
            {/* A quiet geometric range, in the page's own hues. */}
            <Box aria-hidden component="svg" viewBox="0 0 260 120" sx={{
              position: "absolute", right: -10, bottom: -6, width: 230, opacity: .85, pointerEvents: "none",
            }}>
              <defs>
                <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#c7b8fb" />
                </linearGradient>
                <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7aa7f5" /><stop offset="100%" stopColor="#b9d2fa" />
                </linearGradient>
              </defs>
              <path d="M60 120 L130 28 L200 120 Z" fill="url(#m1)" />
              <path d="M140 120 L196 52 L252 120 Z" fill="url(#m2)" opacity=".9" />
              <path d="M8 120 L62 60 L116 120 Z" fill="url(#m2)" opacity=".55" />
              <path d="M130 28 L146 48 L114 48 Z" fill="#ffffff" opacity=".75" />
              <path d="M130 28 L130 12" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M130 12 L148 17 L130 23 Z" fill="#ec4899" />
            </Box>

            <Typography sx={{
              position: "relative",
              fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
              fontSize: "1.32rem", fontWeight: 600, color: INK, letterSpacing: "-0.03em", lineHeight: 1.18,
            }}>
              Different tools.<br />
              <Box component="span" sx={{
                background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              }}>A bigger tomorrow.</Box>
            </Typography>
            <Typography sx={{ position: "relative", fontSize: "0.86rem", color: MUTED, mt: 1 }}>
              Data. Content. Customers. Growth.
            </Typography>
            <Box className="go" sx={{
              position: "absolute", right: 18, bottom: 18, width: 42, height: 42, borderRadius: "50%",
              display: "grid", placeItems: "center",
              background: "linear-gradient(140deg,#5b8def,#3461c9)", color: "#fff",
              boxShadow: "0 8px 20px rgba(52,97,201,.32)", transition: "transform .18s ease",
              "& svg": { fontSize: 22 },
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}><ChevronRightIcon /></Box>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}
