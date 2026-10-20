"use client";
// THE HUB'S TOP BAR - the wordmark, the way round the hub, the search and your
// face. Moved out of the front page (SARCLA, 16.10.2026: Advanced reporting
// "should keep the header like it was a second home page"), so both pages draw
// the same bar from one place and cannot drift.
//
// It asks for what it needs itself - your access, your preferences, your name -
// so a page only has to place it. Every link it offers is one the person may
// open: the guards still refuse, but a door that slams is worse than no door.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import HomeIcon from "@mui/icons-material/Home";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SensorsIcon from "@mui/icons-material/Sensors";
import AppsIcon from "@mui/icons-material/Apps";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SearchIcon from "@mui/icons-material/Search";

import HubIconGlyph from "./HubIcon";
import { search as searchApps, type Hit } from "./hubApps";
import { useViewAs } from "./ViewAs";
import { AvatarFace } from "./AvatarFace";
import { Wordmark } from "./Wordmark";
import { adminOnlyPath, appForPath, type Role } from "@/lib/auth/access";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#3b7df6";

const glass = {
  // No backdrop blur. It put every tile on its own compositor layer and
  // Windows drops ClearType there, which is the "pixelized"/blurry text
  // SARCLA keeps seeing. The mesh behind is already blurred, so opacity
  // alone still reads as glass (SARCLA, 19.10.2026).
  bgcolor: "rgba(255,255,255,.82)",
  backdropFilter: "none",
  border: "1px solid rgba(255,255,255,.75)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 14px 36px rgba(31,45,78,.075)",
};

const focusRing = {
  "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 3, borderRadius: 10 },
};

/**
 * The bar. `on` names the nav item to light ("Home" on the front page); a page
 * that is not one of them lights none. The page root must define the `riseIn`
 * keyframes (both pages that use it do) and turn motion off under
 * prefers-reduced-motion.
 */
export function HomeBar({ on }: { on?: string }) {
  const router = useRouter();
  const { viewed, canOpen } = useViewAs();

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

  // Settings -> Preferences can hide the search; the face is theirs too.
  const [searchShown, setSearchShown] = useState(true);
  const [face, setFace] = useState<{ photo: string | null; iconId: string | null }>({ photo: null, iconId: null });
  useEffect(() => {
    fetch("/api/me/prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.ok) return;
        setSearchShown(!(j.prefs?.home?.hiddenPanels ?? []).includes("search"));
        setFace({ photo: j.prefs?.avatar ?? null, iconId: j.prefs?.avatarIcon ?? null });
      })
      .catch(() => {});
  }, []);

  // The real signed-in person, not a placeholder; a failure costs the initials.
  const [initials, setInitials] = useState("");
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

  const openFor = (key: string) => (viewed ? canOpen(key) : mine ? mine[key] : true);
  const role = viewed?.role ?? myRole;
  const mayOpen = (href: string) => {
    const path = href.split("?")[0];
    if (!path.startsWith("/")) return true; // the shop, HubSpot - not ours to gate
    if (adminOnlyPath(path) && role !== "admin") return false;
    const key = appForPath(path);
    return !key || openFor(key);
  };

  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
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

  // One row. A viewer's hub is one app: Home and Settings is the honest header
  // for them. The two anchors point at the front page, so they work from any
  // page that shows the bar.
  const reads = role === "viewer";
  const NAV = [
    { name: "Home", href: "/", icon: <HomeIcon />, show: true },
    { name: "Applications", href: "/#applications", icon: <AppsIcon />, show: !reads },
    { name: "Mission Control", href: "/mission-control", icon: <DashboardOutlinedIcon />, show: openFor("marketing") },
    { name: "Live", href: "/live", icon: <SensorsIcon />, show: openFor("website") },
    { name: "Resources", href: "/#resources", icon: <MenuBookIcon />, show: !reads },
    { name: "Settings", href: "/settings", icon: <SettingsOutlinedIcon />, show: true },
  ].filter((n) => n.show);

  return (
    <Box sx={{
      ...glass, borderRadius: "22px", px: { xs: 2, md: 2.5 }, py: 1.5,
      // backwards: once in, the bar lets go of the animation (a held one keeps it on its own layer)
      animation: "riseIn .5s cubic-bezier(.22,.8,.3,1) .05s backwards",
      display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2 }, flexWrap: "wrap",
      position: "relative", zIndex: 5,
    }}>
      <Box component={Link} href="/" sx={{ textDecoration: "none", display: "grid", lineHeight: 1, ...focusRing }}>
        <Wordmark size={26} />
      </Box>

      <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.4 }}>
        {NAV.map((n) => {
          const lit = n.name === on;
          return (
            <Box key={n.name} component={Link} href={n.href} sx={{
              display: "flex", alignItems: "center", gap: 0.8, px: 1.6, py: 1, borderRadius: "14px",
              textDecoration: "none", fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
              color: lit ? ACCENT : MUTED,
              bgcolor: lit ? "rgba(59,125,246,.13)" : "transparent",
              transition: "background-color .18s ease, color .18s ease",
              "& svg": { fontSize: 19 }, ...focusRing,
              "&:hover": { bgcolor: lit ? "rgba(59,125,246,.18)" : "rgba(21,34,58,.05)", color: lit ? ACCENT : INK },
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}>{n.icon}{n.name}</Box>
          );
        })}
      </Box>

      <Box ref={boxRef} sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.5, position: "relative" }}>
        <Box sx={{
          display: searchShown ? { xs: "none", sm: "flex" } : "none", alignItems: "center", gap: 1,
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

        {/* Your account, not the Settings front page: a person clicking their
            own initials wants their own account. */}
        <Box component={Link} href="/settings/you" aria-label="Your account" title="Your account" sx={{
          display: "grid", placeItems: "center", textDecoration: "none", borderRadius: "50%", ...focusRing,
          transition: "transform .18s ease",
          "&:hover": { transform: "scale(1.06)" },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          // The initials keep the purple circle they have always had; a photo or
          // an icon brings its own.
          "& > *": face.photo || face.iconId
            ? {}
            : { background: "linear-gradient(140deg,#5b8def,#7c5cf0)", color: "#fff" },
        }}>
          <AvatarFace size={38} photo={face.photo} iconId={face.iconId} initials={initials}
            fallback={<AccountCircleIcon sx={{ fontSize: 24 }} />} />
        </Box>
      </Box>
    </Box>
  );
}
