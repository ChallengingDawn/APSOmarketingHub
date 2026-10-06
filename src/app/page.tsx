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
import InsightsIcon from "@mui/icons-material/Insights";
import HubIcon from "@mui/icons-material/Hub";
import CableIcon from "@mui/icons-material/Cable";
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
import ConnectorsPanel from "./ConnectorsPanel";
import MeshBackground, { MESH_BASE } from "./MeshBackground";
import { APPS, HUB_TOOLS, search as searchApps, type HubApp, type Hit } from "./hubApps";
import { useViewAs } from "./ViewAs";
import { AvatarFace } from "./AvatarFace";
import { Wordmark } from "./Wordmark";
import { adminOnlyPath, appForPath, type Role } from "@/lib/auth/access";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

const APP_ICON: Record<HubApp["icon"], React.ReactNode> = {
  store: <StorefrontIcon />, globe: <PublicIcon />, campaign: <CampaignIcon />,
  trend: <TrendingUpIcon />, hub: <HubIcon />, chart: <InsightsIcon />, cable: <CableIcon />,
};

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
  // While previewing somebody, the wall shows what THEY would get: the apps
  // they can open, and the rest locked rather than hidden, so you can see both
  // what they have and what they are missing.
  const { viewed, canOpen } = useViewAs();
  // Your OWN access, so the wall is honest before you click. The guard on each
  // app's layout is what actually refuses; this only saves the trip.
  const [mine, setMine] = useState<Record<string, boolean> | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  useEffect(() => {
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setMine(j.open as Record<string, boolean>);
        setMyRole(j.role as Role);
      })
      .catch(() => {});
  }, []);
  // Their home screen, as set in Settings -> Preferences: which panels they want
  // and what order the apps go in. Absent means the default, which is all of it.
  const [home, setHome] = useState<{ hiddenPanels: string[]; appOrder: string[] }>({ hiddenPanels: [], appOrder: [] });
  useEffect(() => {
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setHome({
          hiddenPanels: j.prefs?.home?.hiddenPanels ?? [],
          appOrder: j.prefs?.home?.appOrder ?? [],
        });
        setFace({ photo: j.prefs?.avatar ?? null, iconId: j.prefs?.avatarIcon ?? null });
      })
      .catch(() => {});
  }, []);
  const panel = (id: string) => !home.hiddenPanels.includes(id);
  const [face, setFace] = useState<{ photo: string | null; iconId: string | null }>({ photo: null, iconId: null });

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

  // HIDDEN, not greyed. SARCLA: somebody with no access should see no apps —
  // a wall of doors that all turn you away is a worse answer than an empty hall
  // and a sentence saying who to ask. While previewing, this shows what THEY
  // would see, which is the point of previewing.
  const openFor = (key: string) => (viewed ? canOpen(key) : mine ? mine[key] : true);
  // Declared here, not beside the header: everything below reads it, and a
  // const used above its own line is a blank page, not a type error.
  const role = viewed?.role ?? myRole;
  // No count of what is missing. Telling somebody there are four apps they
  // cannot have is a locked door described in words — SARCLA: take it out.
  const allowedApps = APPS.filter((a) => openFor(a.key));
  // Their order first, then anything that has appeared since — a new app turns
  // up at the end rather than disappearing because it is not in a saved list.
  const visibleApps = [
    ...home.appOrder.map((k) => allowedApps.find((a) => a.key === k)).filter(Boolean),
    ...allowedApps.filter((a) => !home.appOrder.includes(a.key)),
  ] as typeof allowedApps;

  /**
   * One rule for every link this page draws: the header, the search, the quick
   * links. Nothing is offered that the person would be turned away from — the
   * guards still refuse, but being offered a door that slams is worse than not
   * seeing the door.
   */
  const mayOpen = (href: string) => {
    const path = href.split("?")[0];
    if (!path.startsWith("/")) return true; // the shop, HubSpot — not ours to gate
    if (adminOnlyPath(path) && role !== "admin") return false;
    const key = appForPath(path);
    return !key || openFor(key);
  };

  // One or two apps should not stretch across the window; three or more share it.
  const wide = visibleApps.length < 3 ? "minmax(0, 340px)" : "minmax(0, 1fr)";

  const hits = useMemo<Hit[]>(
    () => searchApps(q).filter((h) => mayOpen(h.href)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, mine, viewed, role],
  );

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
  // A viewer was offered the whole strip — Applications, Mission Control, Live,
  // Resources — when their hub is one app. Home and Settings is the honest
  // header for them; everything else earns its place or is not drawn.
  const reads = role === "viewer";
  const NAV = [
    { name: "Home", href: "/", icon: <HomeIcon />, on: true, show: true },
    { name: "Applications", href: "#applications", icon: <AppsIcon />, on: false, show: !reads },
    { name: "Mission Control", href: "/mission-control", icon: <DashboardOutlinedIcon />, on: false, show: openFor("marketing") },
    { name: "Live", href: "/live", icon: <SensorsIcon />, on: false, show: openFor("website") },
    { name: "Resources", href: "#resources", icon: <MenuBookIcon />, on: false, show: !reads },
    { name: "Settings", href: "/settings", icon: <SettingsOutlinedIcon />, on: false, show: true },
  ].filter((n) => n.show);

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
            <Wordmark size={26} />
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
              display: panel("search") ? { xs: "none", sm: "flex" } : "none", alignItems: "center", gap: 1,
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
              display: "grid", placeItems: "center", textDecoration: "none", borderRadius: "50%", ...focusRing,
              transition: "transform .18s ease",
              "&:hover": { transform: "scale(1.06)" },
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
              // The initials keep the purple circle they have always had; a photo
              // or an icon brings its own.
              "& > *": face.photo || face.iconId
                ? {}
                : { background: "linear-gradient(140deg,#5b8def,#7c5cf0)", color: "#fff" },
            }}>
              {/* A dot told nobody anything. Until the name arrives this is a
                  face, which at least says whose button it is. */}
              <AvatarFace size={38} photo={face.photo} iconId={face.iconId} initials={initials}
                fallback={<AccountCircleIcon sx={{ fontSize: 24 }} />} />
            </Box>
          </Box>
        </Box>

        {/* No hero. The wordmark is in the bar, and a page whose job is to
            hand you five doors does not need a paragraph telling you so. The
            apps start at the top, where the eye already is. */}
        {/* --------------------------------------------------------- applications */}
        {/* As many columns as there are apps, never more. The count was fixed at
            five, so somebody with one app got a tile a fifth of the width and a
            row of white space beside it — and six apps wrapped one onto a line
            of its own. Below three the tiles stop stretching and take a sensible
            width instead, because a single card spanning the window is not a
            launch pad, it is a billboard. */}
        <Box id="applications" sx={{
          display: "grid", gap: { xs: 2, md: 2 }, alignItems: "stretch", mt: { xs: 2.5, md: 3 },
          justifyContent: "start",
          gridTemplateColumns: {
            xs: "1fr",
            sm: `repeat(${Math.min(visibleApps.length, 2)}, ${wide})`,
            md: `repeat(${Math.min(visibleApps.length, 3)}, ${wide})`,
          },
          // Up to six apps share one row. Past six, two even rows (seven = 4 + 3)
          // rather than a full row and one card left alone under it; a very wide
          // screen takes all seven in one.
          "@media (min-width:1280px)": {
            gridTemplateColumns: `repeat(${visibleApps.length <= 6 ? visibleApps.length : Math.ceil(visibleApps.length / 2)}, ${wide})`,
          },
          "@media (min-width:1800px)": {
            gridTemplateColumns: `repeat(${Math.min(visibleApps.length, 7)}, ${wide})`,
          },
        }}>
          {visibleApps.map((a, i) => {
            const open = !!expanded[a.key];
            const shown = open ? a.subs : a.subs.slice(0, 3);
            return (
              <Box key={a.key} sx={{
                ...glass, borderRadius: "22px", p: { xs: 2, md: 2.1 },
                display: "flex", flexDirection: "column", gap: 1.5,
                background: `linear-gradient(170deg, ${a.wash}, rgba(255,255,255,.64) 58%)`,
                position: "relative",
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

                  {/* An app can be empty on purpose. Saying so beats a card
                      that trails off into white space. */}
                  {a.subs.length === 0 && (
                    <Typography sx={{ fontSize: "0.82rem", color: FAINT, lineHeight: 1.5, py: 0.5 }}>
                      Nothing in it yet — open it to see what it is for.
                    </Typography>
                  )}

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

        {visibleApps.length === 0 && (
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 3, md: 4 }, textAlign: "center" }}>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              {viewed ? `${viewed.name} has no apps yet` : "You do not have any apps yet"}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.75, maxWidth: "46ch", mx: "auto" }}>
              {viewed
                ? "Give them one on Settings → People and it appears here."
                : "An admin gives each person the apps they need. Ask whoever set up your account, and they will appear here."}
            </Typography>
          </Box>
        )}

        {/* ------------------------------------------------------------ resources */}
        <Box id="resources" sx={{
          display: "grid", gap: 2, mt: 2,
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          "@media (min-width:1280px)": { gridTemplateColumns: "1.15fr 1fr 1fr" },
          ...rise(6),
        }}>
          {panel("quickLinks") && <QuickLinks glass={glass} mayOpen={mayOpen} />}

          {panel("connectors") && openFor("connectors") && <ConnectorsPanel glass={glass} />}

          {openFor("marketing") && panel("missionControl") && (
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

            {/* It said "Different tools. A bigger tomorrow." — a slogan where a
                description should be. The thing it names is not built, so the
                card says what it is meant to become and admits it is not that
                yet. A promise drawn as a finished feature is the worst of the
                three options. */}
            <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 0.6, mb: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#a96a12" }} />
              <Typography sx={{
                fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#a96a12",
              }}>Not built yet</Typography>
            </Box>
            <Typography sx={{
              position: "relative",
              fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
              fontSize: "1.32rem", fontWeight: 600, color: INK, letterSpacing: "-0.03em", lineHeight: 1.18,
            }}>
              <Box component="span" sx={{
                background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                display: "inline-block", paddingRight: "6px", marginRight: "-4px",
              }}>Mission Control</Box>
            </Typography>
            <Typography sx={{ position: "relative", fontSize: "0.86rem", color: MUTED, mt: 0.75, maxWidth: "34ch", lineHeight: 1.45 }}>
              One screen for the whole hub: what each app is doing, what is waiting on a person, and what
              changed overnight. Today it shows the content calendar and nothing else.
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
          )}
        </Box>

      </Box>
    </Box>
  );
}
