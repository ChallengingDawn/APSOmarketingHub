"use client";
// THE FRONT PAGE — soft glass.
//
// A top bar instead of a sidebar, five app cards that each list what is inside
// them, and resources underneath. Everything on this page links to a route that
// exists: a front door offering something that is not there is worse than one
// offering less.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import StorefrontIcon from "@mui/icons-material/Storefront";
import PublicIcon from "@mui/icons-material/Public";
import CampaignIcon from "@mui/icons-material/Campaign";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import HubIcon from "@mui/icons-material/Hub";

import GroupsIcon from "@mui/icons-material/Groups";
import DescriptionIcon from "@mui/icons-material/Description";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import BarChartIcon from "@mui/icons-material/BarChart";
import LayersIcon from "@mui/icons-material/Layers";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import SearchIcon from "@mui/icons-material/Search";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import HomeIcon from "@mui/icons-material/Home";
import AppsIcon from "@mui/icons-material/Apps";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import SensorsIcon from "@mui/icons-material/Sensors";
import DashboardIcon from "@mui/icons-material/Dashboard";
import BoltIcon from "@mui/icons-material/Bolt";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";

type Sub = { name: string; note: string; href: string; icon: React.ReactNode; tint: string; fg: string };
type App = {
  href: string; name: string; line: string; icon: React.ReactNode;
  from: string; to: string; wash: string; subs: Sub[];
};

const APPS: App[] = [
  {
    href: "/datatracker", name: "Datatracker",
    line: "Live data, customer insight and stock information.",
    icon: <StorefrontIcon />, from: "#5b8def", to: "#3461c9", wash: "rgba(91,141,239,.10)",
    subs: [
      { name: "Customers", note: "Search and view customer activity", href: "/datatracker", icon: <GroupsIcon />, tint: "#e6edfd", fg: "#3461c9" },
      { name: "Articles", note: "Product and part information", href: "/datatracker#articles", icon: <DescriptionIcon />, tint: "#e7f6ee", fg: "#1b7a55" },
      { name: "Availability", note: "Stock levels and what we could not fill", href: "/datatracker#availability", icon: <Inventory2Icon />, tint: "#fdf0e3", fg: "#a96a12" },
    ],
  },
  {
    href: "/website/overview", name: "Website & Intelligence",
    line: "Monitor performance and understand the audience.",
    icon: <PublicIcon />, from: "#2ec29a", to: "#13866a", wash: "rgba(46,194,154,.10)",
    subs: [
      { name: "Overview", note: "Key website metrics", href: "/website/overview", icon: <BarChartIcon />, tint: "#e6edfd", fg: "#3461c9" },
      { name: "Audience", note: "Visitor insight and segments", href: "/website/audience", icon: <GroupsIcon />, tint: "#fde8f1", fg: "#b63a76" },
      { name: "Pages", note: "Manage and analyse content", href: "/website/pages", icon: <LayersIcon />, tint: "#efe8fd", fg: "#6a46c9" },
    ],
  },
  {
    href: "/create", name: "Marketing & Content",
    line: "Create, manage and optimise our marketing content.",
    icon: <CampaignIcon />, from: "#ef5fa0", to: "#c22c6e", wash: "rgba(239,95,160,.10)",
    subs: [
      { name: "Create Studio", note: "Draft and generate campaigns", href: "/create", icon: <EditNoteIcon />, tint: "#fdf0e3", fg: "#a96a12" },
      { name: "Library", note: "Everything already written", href: "/library", icon: <PhotoLibraryIcon />, tint: "#efe8fd", fg: "#6a46c9" },
      { name: "SEO", note: "Optimise and track performance", href: "/seo", icon: <SearchIcon />, tint: "#e3f5f1", fg: "#13866a" },
    ],
  },
  {
    href: "/journey", name: "Customer Journey & KPIs",
    line: "Understand the customer journey and drive performance.",
    icon: <TrendingUpIcon />, from: "#9a7bf0", to: "#6a46c9", wash: "rgba(154,123,240,.10)",
    subs: [
      { name: "Funnels", note: "Track conversion stages", href: "/journey/funnels", icon: <FilterAltIcon />, tint: "#fde8f1", fg: "#b63a76" },
      { name: "KPIs", note: "Measure what matters", href: "/journey/kpis", icon: <BarChartIcon />, tint: "#e6edfd", fg: "#3461c9" },
      { name: "Customers", note: "Journey insight and behaviour", href: "/customers", icon: <GroupsIcon />, tint: "#e7f6ee", fg: "#1b7a55" },
    ],
  },
  {
    // Lands on Erosion, not Price checks: /uc/price-checks still redirects into
    // the Datatracker tab, so the tile would drop you into Datatracker's menu and
    // the UC apps would never be seen.
    href: "/uc/erosion", name: "UC & HubSpot Apps",
    line: "The apps that write back into HubSpot.",
    icon: <HubIcon />, from: "#f5a23c", to: "#c97a10", wash: "rgba(245,162,60,.10)",
    subs: [
      { name: "Erosion", note: "Lapsed reorders, raised and expected", href: "/uc/erosion", icon: <TrendingDownIcon />, tint: "#efe8fd", fg: "#6a46c9" },
      { name: "Price checks", note: "Priced, not ordered — and called", href: "/uc/price-checks", icon: <LocalOfferIcon />, tint: "#e6edfd", fg: "#3461c9" },
      { name: "Web order sync", note: "Shop orders into HubSpot", href: "/analytics/web-orders", icon: <SyncAltIcon />, tint: "#fde8e8", fg: "#b63a3a" },
    ],
  },
];

/** Only routes and sites that exist. A dead tile on a front door is a bug. */
const RESOURCES = [
  { name: "APSOparts", note: "The shop", href: "https://www.apsoparts.com", icon: <OpenInNewIcon />, tint: "#efe8fd", fg: "#6a46c9", external: true },
  { name: "HubSpot", note: "The portal", href: "https://app-eu1.hubspot.com/contacts/26492587", icon: <OpenInNewIcon />, tint: "#fde8f1", fg: "#b63a76", external: true },
  { name: "Docs", note: "How this works", href: "/docs", icon: <MenuBookIcon />, tint: "#e7f6ee", fg: "#1b7a55", external: false },
  { name: "Integrations", note: "What is connected", href: "/settings/integrations", icon: <SettingsIcon />, tint: "#fdf0e3", fg: "#a96a12", external: false },
  { name: "Audit", note: "Who did what", href: "/audit", icon: <SecurityIcon />, tint: "#e6edfd", fg: "#3461c9", external: false },
];

/** Real changes, with the dates they shipped. */
const NEWS = [
  { text: "Erosion moved in from APSOAssistant, with its forecast", when: "4 Oct", dot: "#f5a23c" },
  { text: "Price checks, MOQ and availability in Datatracker", when: "4 Oct", dot: "#5b8def" },
  { text: "The hub became five apps with one front page", when: "4 Oct", dot: "#ef5fa0" },
  { text: "GEO readiness and the fix queue", when: "1 Oct", dot: "#2ec29a" },];

const NAV = [
  { name: "Home", href: "/", icon: <HomeIcon />, on: true },
  { name: "Applications", href: "#applications", icon: <AppsIcon />, on: false },
  { name: "Resources", href: "#resources", icon: <MenuBookIcon />, on: false },
];

const glass = {
  bgcolor: "rgba(255,255,255,.62)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.72)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

export default function FrontPage() {
  return (
    <Box sx={{
      minHeight: "100vh", position: "relative", overflowX: "hidden",
      // A soft field rather than flat grey: these cards are glass, and glass
      // over nothing just looks like a box with a faint border.
      background:
        "radial-gradient(110% 80% at 8% 0%, #efe6fb 0%, transparent 55%)," +
        "radial-gradient(90% 70% at 92% 6%, #ffe8ef 0%, transparent 52%)," +
        "radial-gradient(90% 80% at 70% 100%, #e3f4fb 0%, transparent 55%)," +
        "radial-gradient(70% 60% at 20% 95%, #e8f7ee 0%, transparent 55%), #f6f7fb",
    }}>
      <Box sx={{ maxWidth: 1360, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 } }}>

        {/* ---------------------------------------------------------------- bar */}
        <Box sx={{
          ...glass, borderRadius: 4, px: { xs: 2, md: 2.5 }, py: 1.5,
          display: "flex", alignItems: "center", gap: { xs: 1.5, md: 3 }, flexWrap: "wrap",
        }}>
          <Box component={Link} href="/" sx={{ textDecoration: "none", display: "grid", lineHeight: 1 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.9 }}>
              <Box component="span" className="brand-display brand-apso" sx={{ fontSize: 27, fontWeight: 800 }}>
                <span className="letter letter-a">A</span><span className="letter letter-p">P</span>
                <span className="letter letter-s">S</span><span className="letter letter-o">O</span>
              </Box>
              <Box component="span" className="brand-display" sx={{ fontSize: 27, fontWeight: 700, color: "#5b8def" }}>hub</Box>
            </Box>
            <Typography sx={{ fontSize: "0.68rem", color: FAINT, letterSpacing: "0.02em", mt: 0.25 }}>
              apsoparts.com
            </Typography>
          </Box>

          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
            {NAV.map((n) => (
              <Box key={n.name} component={Link} href={n.href} sx={{
                display: "flex", alignItems: "center", gap: 0.85, px: 1.75, py: 1, borderRadius: 2.5,
                textDecoration: "none", fontSize: "0.9rem", fontWeight: 600, letterSpacing: "-0.01em",
                color: n.on ? "#2f5fd0" : MUTED,
                bgcolor: n.on ? "rgba(91,141,239,.14)" : "transparent",
                "& svg": { fontSize: 19 },
                "&:hover": { bgcolor: n.on ? "rgba(91,141,239,.18)" : "rgba(21,34,58,.05)", color: n.on ? "#2f5fd0" : INK },
              }}>{n.icon}{n.name}</Box>
            ))}
          </Box>

          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{
              display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1,
              width: { sm: 200, lg: 280 }, px: 1.75, py: 1, borderRadius: 2.5,
              bgcolor: "rgba(255,255,255,.75)", border: "1px solid rgba(21,34,58,.07)",
              color: FAINT, fontSize: "0.86rem",
            }}>
              <SearchIcon sx={{ fontSize: 18 }} />
              {/* A field needs somewhere to send the query. Until there is one,
                  this says so rather than pretending to be a search box. */}
              Search is not wired yet
            </Box>
            <NotificationsNoneIcon sx={{ fontSize: 22, color: MUTED }} />
            <Box sx={{
              width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
              background: "linear-gradient(140deg,#5b8def,#3461c9)", color: "#fff",
              fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.02em",
            }}>CS</Box>
          </Box>
        </Box>

        {/* --------------------------------------------------------------- hero */}
        <Box sx={{
          display: "flex", alignItems: "flex-start", gap: 3, flexWrap: "wrap",
          px: { xs: 0.5, md: 1.5 }, pt: { xs: 4, md: 6 }, pb: { xs: 3, md: 4.5 },
        }}>
          <Box sx={{ flex: "1 1 420px", minWidth: 0 }}>
            <Typography sx={{
              fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: FAINT, mb: 1,
            }}>Welcome to</Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}>
              <Box component="span" className="brand-display brand-apso" sx={{ fontSize: { xs: 46, md: 64 }, fontWeight: 800 }}>
                <span className="letter letter-a">A</span><span className="letter letter-p">P</span>
                <span className="letter letter-s">S</span><span className="letter letter-o">O</span>
              </Box>
              <Box component="span" className="brand-display" sx={{ fontSize: { xs: 46, md: 64 }, fontWeight: 700, color: "#5b8def" }}>hub</Box>
            </Box>
            <Typography sx={{ fontSize: { xs: "1.05rem", md: "1.22rem" }, color: MUTED, mt: 1 }}>
              Your apps, tools and resources in one place.
            </Typography>
          </Box>

          <Box sx={{ ...glass, borderRadius: 3.5, p: 2, display: "flex", gap: 1.75, alignItems: "flex-start", flex: "0 1 380px" }}>
            <Box sx={{
              width: 42, height: 42, borderRadius: 2.4, flexShrink: 0, display: "grid", placeItems: "center",
              bgcolor: "rgba(245,162,60,.16)", color: "#c97a10", "& svg": { fontSize: 23 },
            }}><BoltIcon /></Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>
                Same people. Smarter tools.
              </Typography>
              <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 0.25 }}>
                Everything you need to do your best work.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* --------------------------------------------------------- applications */}
        <Box id="applications" sx={{
          display: "grid", gap: { xs: 2, md: 2.25 },
          gridTemplateColumns: {
            xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)", xl: "repeat(5, 1fr)",
          },
          alignItems: "stretch",
        }}>
          {APPS.map((a) => (
            <Box key={a.href} sx={{
              ...glass, borderRadius: 4, p: { xs: 2, md: 2.25 },
              display: "flex", flexDirection: "column", gap: 1.5,
              background: `linear-gradient(170deg, ${a.wash}, rgba(255,255,255,.66) 55%)`,
            }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: 3, display: "grid", placeItems: "center",
                background: `linear-gradient(140deg, ${a.from}, ${a.to})`, color: "#fff",
                boxShadow: `0 8px 18px ${a.wash}`, "& svg": { fontSize: 30 },
              }}>{a.icon}</Box>

              <Box>
                <Box component={Link} href={a.href} sx={{
                  display: "inline-flex", alignItems: "center", gap: 0.5, textDecoration: "none",
                  color: INK, "&:hover .chev": { transform: "translateX(3px)" },
                }}>
                  <Typography component="span" sx={{
                    fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
                    fontSize: "1.24rem", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.18,
                  }}>{a.name}</Typography>
                  <ChevronRightIcon className="chev" sx={{ fontSize: 20, color: a.to, transition: "transform .14s ease" }} />
                </Box>
                <Typography sx={{ fontSize: "0.88rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>{a.line}</Typography>
              </Box>

              <Box sx={{ display: "grid", gap: 1, mt: "auto" }}>
                {a.subs.map((s) => (
                  <Box key={s.href + s.name} component={Link} href={s.href} sx={{
                    display: "flex", alignItems: "center", gap: 1.25, p: 1.1, borderRadius: 2.5,
                    textDecoration: "none", bgcolor: "rgba(255,255,255,.7)",
                    border: "1px solid rgba(255,255,255,.8)",
                    transition: "background-color .14s ease, transform .14s ease",
                    "&:hover": { bgcolor: "#fff", transform: "translateX(2px)" },
                  }}>
                    <Box sx={{
                      width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center",
                      bgcolor: s.tint, color: s.fg, "& svg": { fontSize: 18 },
                    }}>{s.icon}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, letterSpacing: "-0.01em", lineHeight: 1.25 }}>
                        {s.name}
                      </Typography>
                      <Typography sx={{ fontSize: "0.74rem", color: FAINT, lineHeight: 1.3 }}>{s.note}</Typography>
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 17, color: FAINT, flexShrink: 0 }} />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* ------------------------------------------------------------ resources */}
        <Box id="resources" sx={{
          display: "grid", gap: { xs: 2, md: 2.25 }, mt: { xs: 2, md: 2.25 },
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr", xl: "1.15fr 1fr 1fr" },
        }}>
          <Box sx={{ ...glass, borderRadius: 4, p: { xs: 2, md: 2.25 } }}>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", mb: 1.5 }}>
              Resources
            </Typography>
            <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
              {RESOURCES.map((r) => (
                <Box key={r.name}
                  component={r.external ? "a" : Link}
                  href={r.href}
                  {...(r.external ? { target: "_blank", rel: "noopener" } : {})}
                  sx={{
                    width: 96, p: 1.5, borderRadius: 3, textDecoration: "none", textAlign: "center",
                    bgcolor: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.8)",
                    display: "grid", justifyItems: "center", gap: 0.75,
                    transition: "transform .14s ease, background-color .14s ease",
                    "&:hover": { transform: "translateY(-2px)", bgcolor: "#fff" },
                  }}>
                  <Box sx={{
                    width: 38, height: 38, borderRadius: 2.4, display: "grid", placeItems: "center",
                    bgcolor: r.tint, color: r.fg, "& svg": { fontSize: 20 },
                  }}>{r.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: INK, lineHeight: 1.2 }}>{r.name}</Typography>
                    <Typography sx={{ fontSize: "0.68rem", color: FAINT, lineHeight: 1.25 }}>{r.note}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ ...glass, borderRadius: 4, p: { xs: 2, md: 2.25 } }}>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", mb: 1.5 }}>
              What&rsquo;s new
            </Typography>
            <Box sx={{ display: "grid", gap: 1.1 }}>
              {NEWS.map((n) => (
                <Box key={n.text} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: n.dot, mt: 0.7, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1, lineHeight: 1.4 }}>{n.text}</Typography>
                  <Typography sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap", mt: 0.1 }}>{n.when}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{
            ...glass, borderRadius: 4, p: { xs: 2, md: 2.5 }, position: "relative", overflow: "hidden",
            background: "linear-gradient(150deg, rgba(154,123,240,.16), rgba(91,141,239,.12) 60%, rgba(255,255,255,.7))",
            display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 150,
          }}>
            <Typography sx={{
              fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
              fontSize: "1.3rem", fontWeight: 600, color: INK, letterSpacing: "-0.03em", lineHeight: 1.18,
            }}>
              Different tools.<br />
              <Box component="span" sx={{ color: "#5b8def" }}>A bigger tomorrow.</Box>
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 1 }}>
              Data. Content. Customers. Growth.
            </Typography>
            <Box component={Link} href="/mission-control" aria-label="Mission Control" sx={{
              position: "absolute", right: 18, bottom: 18, width: 42, height: 42, borderRadius: "50%",
              display: "grid", placeItems: "center", textDecoration: "none",
              background: "linear-gradient(140deg,#5b8def,#3461c9)", color: "#fff",
              boxShadow: "0 8px 20px rgba(52,97,201,.3)",
              transition: "transform .14s ease",
              "&:hover": { transform: "translateX(3px)" },
              "& svg": { fontSize: 22 },
            }}><ChevronRightIcon /></Box>
          </Box>
        </Box>

        {/* The hub's own: not apps, but they have to be reachable from here. */}
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap", py: { xs: 3, md: 4 } }}>
          {[
            { name: "Mission Control", href: "/mission-control", icon: <DashboardIcon /> },
            { name: "Live", href: "/live", icon: <SensorsIcon /> },
            { name: "Settings", href: "/settings", icon: <SettingsIcon /> },
          ].map((t) => (
            <Box key={t.href} component={Link} href={t.href} sx={{
              display: "flex", alignItems: "center", gap: 0.85, px: 1.75, py: 0.9, borderRadius: 2.5,
              textDecoration: "none", fontSize: "0.86rem", fontWeight: 600, color: MUTED,
              bgcolor: "rgba(255,255,255,.55)", border: "1px solid rgba(255,255,255,.7)",
              "& svg": { fontSize: 18 },
              "&:hover": { color: INK, bgcolor: "#fff" },
            }}>{t.icon}{t.name}</Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
