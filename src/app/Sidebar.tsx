"use client";
import { Fragment, Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import ListItemButton from "@mui/material/ListItemButton";
import Collapse from "@mui/material/Collapse";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AppsIcon from "@mui/icons-material/Apps";
import PriceCheckIcon from "@mui/icons-material/PriceCheck";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import InsightsIcon from "@mui/icons-material/Insights";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HubIcon from "@mui/icons-material/Hub";
import SensorsIcon from "@mui/icons-material/Sensors";
import HandshakeIcon from "@mui/icons-material/Handshake";
import GroupsIcon from "@mui/icons-material/Groups";
import RouteIcon from "@mui/icons-material/Route";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import BoltIcon from "@mui/icons-material/Bolt";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ArticleIcon from "@mui/icons-material/Article";
import PublicIcon from "@mui/icons-material/Public";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SecurityIcon from "@mui/icons-material/Security";
import BarChartIcon from "@mui/icons-material/BarChart";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneIcon from "@mui/icons-material/Tune";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import PeopleIcon from "@mui/icons-material/People";
import PsychologyIcon from "@mui/icons-material/Psychology";
import HistoryIcon from "@mui/icons-material/History";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LanguageIcon from "@mui/icons-material/Language";
import LayersIcon from "@mui/icons-material/Layers";
import AdsClickIcon from "@mui/icons-material/AdsClick";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import CookieIcon from "@mui/icons-material/Cookie";
import StorefrontIcon from "@mui/icons-material/Storefront";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ProductionQuantityLimitsIcon from "@mui/icons-material/ProductionQuantityLimits";
import RemoveShoppingCartOutlinedIcon from "@mui/icons-material/RemoveShoppingCartOutlined";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Link from "next/link";

import { appForPath, type Role } from "@/lib/auth/access";

const DRAWER_WIDTH = 300;
const RED = "#ed1b2f";

interface NavSection {
  title: string;
  /** Where the app row at the top of the panel leads. Default: the first entry. */
  home?: string;
  icon: React.ReactNode;
  color: string;
  items: {
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: string;
    /** Sub-apps listed indented beneath the entry. */
    children?: { label: string; href: string }[];
    /** A heading the entry sits under inside its app (e.g. "Use cases"). */
    group?: string;
    /** A slot that is named but not built yet: shown, never linked. */
    placeholder?: boolean;
    /** Hidden from anyone who is not an admin — the server refuses it anyway. */
    adminOnly?: boolean;
  }[];
}

/**
 * THE FIVE APPS.
 *
 * The hub stopped being the marketing app: it is the front door to all of them,
 * with one sign-in and access decided per app. These groups ARE those apps, so
 * the nav and the launch pad cannot describe the estate differently.
 *
 * Nothing moved on disk except Datatracker, which became an app of its own and
 * now answers at /datatracker; /website/datatracker redirects, because bookmarks
 * are not ours to break. Everything else keeps its route and changes only the
 * group it is listed under.
 *
 * Every href resolves to a page under src/app — checked against the route tree,
 * because a dead sidebar entry is worse than a missing one. Deliberately absent:
 * /studio and /calendar (they redirect to /create and /), and /knowledge-base
 * (retired; redirects to /personality, which is listed).
 *
 * Integrations appears exactly ONCE, under Governance beside Settings — it is
 * configuration, and a second entry elsewhere only made people wonder which was
 * the real one.
 */
const navSections: NavSection[] = [
  {
    // The launch pad and the things that belong to no single app.
    title: "Hub",
    icon: <DashboardIcon />,
    color: "#274e64",
    items: [
      { label: "Mission Control", href: "/mission-control", icon: <DashboardIcon fontSize="small" /> },
      { label: "Live", href: "/live", icon: <SensorsIcon fontSize="small" />, badge: "Live" },
    ],
  },
  {
    title: "Website & Intelligence",
    icon: <PublicIcon />,
    color: "#2d6fa8",
    items: [
      { label: "Site overview", href: "/website/overview", icon: <BarChartIcon fontSize="small" /> },
      { label: "Acquisition", href: "/website/acquisition", icon: <AdsClickIcon fontSize="small" /> },
      { label: "Audience", href: "/website/audience", icon: <GroupsIcon fontSize="small" /> },
      { label: "Pages", href: "/website/pages", icon: <LayersIcon fontSize="small" /> },
      { label: "Tracking health", href: "/analytics/tracking", icon: <MonitorHeartIcon fontSize="small" /> },
      { label: "Cookie consent", href: "/analytics/consent", icon: <CookieIcon fontSize="small" /> },
      // A data check (are shop orders reaching HubSpot, against GA4), so it sits
      // with Tracking health rather than among the use cases.
      { label: "Web order sync", href: "/analytics/web-orders", icon: <SyncAltIcon fontSize="small" /> },
    ],
  },
  {
    title: "Marketing & Content",
    icon: <AutoAwesomeIcon />,
    color: RED,
    items: [
      { label: "Create Studio", href: "/create", icon: <AutoAwesomeIcon fontSize="small" />, badge: "AI" },
      { label: "Content Library", href: "/library", icon: <MenuBookIcon fontSize="small" /> },
      { label: "Templates", href: "/templates", icon: <DashboardCustomizeIcon fontSize="small" /> },
      // The brain feeds every generator in this app, so it sits with them.
      { label: "Personality", href: "/personality", icon: <PsychologyIcon fontSize="small" />, badge: "Brain" },
      { label: "Logs", href: "/logs", icon: <HistoryIcon fontSize="small" /> },
      { label: "SEO performance", href: "/seo", icon: <QueryStatsIcon fontSize="small" /> },
      { label: "Quick wins", href: "/seo/quick-wins", icon: <BoltIcon fontSize="small" /> },
      { label: "Cannibalisation", href: "/seo/cannibalisation", icon: <CallSplitIcon fontSize="small" /> },
      { label: "Decay", href: "/seo/decay", icon: <TrendingDownIcon fontSize="small" /> },
      { label: "SEO work queue", href: "/seo/work-queue", icon: <PlaylistAddCheckIcon fontSize="small" /> },
      { label: "GEO readiness", href: "/geo", icon: <FactCheckIcon fontSize="small" /> },
      { label: "GEO content audit", href: "/geo/content", icon: <ArticleIcon fontSize="small" /> },
      { label: "GEO live pages", href: "/geo/live", icon: <PublicIcon fontSize="small" /> },
      { label: "GEO competitors", href: "/geo/competitors", icon: <CompareArrowsIcon fontSize="small" /> },
      { label: "GEO fix queue", href: "/geo/fix-queue", icon: <BuildCircleIcon fontSize="small" /> },
      { label: "SMEC targets", href: "/analytics/smec", icon: <TrackChangesIcon fontSize="small" /> },
    ],
  },
  {
    title: "Customer Journey & KPIs",
    icon: <RouteIcon />,
    color: "#1baf7a",
    items: [
      { label: "The journey", href: "/journey", icon: <RouteIcon fontSize="small" /> },
      { label: "Lifecycle funnels", href: "/journey/funnels", icon: <FilterAltIcon fontSize="small" /> },
      { label: "KPIs", href: "/journey/kpis", icon: <AccountTreeIcon fontSize="small" /> },
      { label: "Customers", href: "/customers", icon: <HandshakeIcon fontSize="small" /> },
      { label: "Visitors", href: "/customers/visitors", icon: <GroupsIcon fontSize="small" /> },
      { label: "Journeys", href: "/customers/journeys", icon: <RouteIcon fontSize="small" /> },
      { label: "New customers", href: "/analytics/new-customers", icon: <PersonAddAlt1Icon fontSize="small" /> },
      { label: "Buying companies", href: "/analytics/buyers", icon: <StorefrontIcon fontSize="small" /> },
      { label: "Contact requests", href: "/analytics/contact-requests", icon: <ContactMailIcon fontSize="small" /> },
    ],
  },
  {
    // Use cases (UCx - numbers to be assigned by SARCLA) and HubSpot apps. Most
    // still live in their own repos and migrate here over time; Erosion and DoC
    // came from the APSOAssistant micro apps. DoC is a HubSpot app, not a use
    // case (SARCLA, 04.10) - it took the place of the "tbd" slot.
    title: "UC & HubSpot Apps",
    icon: <HubIcon />,
    color: "#eda100",
    items: [
      { group: "Use cases", label: "UCX - Erosion Article Level", href: "/uc/erosion", icon: <TrendingDownIcon fontSize="small" /> },
      { group: "Use cases", label: "UCX - Price Check Tickets", href: "/uc/price-checks", icon: <PriceCheckIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "DoC Declarations", href: "/uc/doc", icon: <VerifiedOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: "Datatracker",
    icon: <StorefrontIcon />,
    color: "#eb6834",
    items: [
      // The Datatracker's own tabs, so they can be reached - and seen to be open -
      // from here. Each tab has its own address (?tab=), kept in step by the page.
      { label: "Customers", href: "/datatracker", icon: <GroupsIcon fontSize="small" /> },
      { label: "Articles", href: "/datatracker?tab=articles", icon: <Inventory2OutlinedIcon fontSize="small" /> },
      { label: "Price checks", href: "/datatracker?tab=price-checks", icon: <PriceCheckIcon fontSize="small" /> },
      { label: "MOQ", href: "/datatracker?tab=moq", icon: <ProductionQuantityLimitsIcon fontSize="small" /> },
      { label: "Availability", href: "/datatracker?tab=availability", icon: <RemoveShoppingCartOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    // Settings is an application now, with its own sections, so it is listed as
    // one. It is still not one of the five: it is the hub's own, which is the
    // point of a single sign-in.
    // Grouped as in SARCLA's Settings mockup. The app row at the top IS the
    // overview, so /settings is its home rather than a row of its own. Slots
    // whose pages are still being built are shown, never linked - flip
    // `placeholder` off when the page exists.
    title: "Settings",
    home: "/settings",
    icon: <SettingsIcon />,
    color: "#5b6470",
    items: [
      { group: "Personal", label: "My account", href: "/settings/you", icon: <PersonOutlineIcon fontSize="small" /> },
      { group: "Personal", label: "Preferences", href: "/settings/preferences", icon: <TuneIcon fontSize="small" /> },
      { group: "Personal", label: "Security", href: "/settings/security", icon: <ShieldOutlinedIcon fontSize="small" /> },
      { group: "Workspace", label: "People", href: "/settings/people", icon: <PeopleIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Roles & access", href: "/settings/roles", icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Integrations", href: "/settings/integrations", icon: <HubIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Audit log", href: "/settings/audit", icon: <SecurityIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Docs", href: "/docs", icon: <DescriptionIcon fontSize="small" /> },
    ],
  },
];

/* ── look ─────────────────────────────────────────────────────────────────
   A floating frosted panel, the way the front page is built: one soft accent
   for "you are here" (a light-blue pill), quiet rows everywhere else, small
   uppercase headings for groups. No coloured tiles, no red bars. */

const ACCENT = "#2459d1";
const ACCENT_BG = "#e4ecfd";
const INK = "#1f2633";
const MUTED = "#6b7385";
const ICON = "#4a5263";
const PANEL_GAP = 14;

type Item = NavSection["items"][number];

function Row({
  href, icon, label, active = false, badge, strong = false, anchor = false,
}: {
  href: string; icon: React.ReactNode; label: string; active?: boolean; badge?: string; strong?: boolean; anchor?: boolean;
}) {
  return (
    <ListItemButton
      component={(anchor ? "a" : Link) as React.ElementType}
      href={href}
      disableRipple
      aria-current={active ? "page" : undefined}
      sx={{
        borderRadius: "11px",
        px: 1.25,
        py: 0.95,
        mb: 0.35,
        minHeight: 42,
        gap: 1.4,
        color: active ? ACCENT : INK,
        bgcolor: active ? ACCENT_BG : "transparent",
        transition: "background-color 0.15s ease, color 0.15s ease",
        "&:hover": { bgcolor: active ? ACCENT_BG : "rgba(15,23,42,0.045)" },
        "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
        "& .row-icon svg": { fontSize: 20, color: active ? ACCENT : ICON, transition: "color 0.15s ease" },
      }}
    >
      <Box className="row-icon" sx={{ display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      <Typography
        sx={{
          flex: 1, minWidth: 0, fontSize: strong ? 15 : 14.25, fontWeight: active || strong ? 600 : 500,
          letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "inherit",
        }}
      >
        {label}
      </Typography>
      {badge && (
        <Chip
          label={badge}
          size="small"
          sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: active ? "#ffffff" : "#eef1f6", color: active ? ACCENT : MUTED }}
        />
      )}
    </ListItemButton>
  );
}

/** A named slot not built yet: shown so the structure reads, never a link. */
function SlotRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      aria-disabled="true"
      sx={{ display: "flex", alignItems: "center", gap: 1.4, px: 1.25, py: 0.95, minHeight: 42, color: "#a3a9b5", "& svg": { fontSize: 20, color: "#c3c8d1" } }}
    >
      <Box sx={{ display: "inline-flex", width: 22, justifyContent: "center" }}>{icon}</Box>
      <Typography sx={{ fontSize: 14.25, fontStyle: "italic" }}>{label}</Typography>
    </Box>
  );
}

function Heading({ name, collapsed, onToggle }: { name: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      sx={{
        display: "flex", alignItems: "center", px: 1.25, py: 0.5, mb: 0.5, borderRadius: "8px",
        cursor: "pointer", userSelect: "none", color: MUTED,
        "&:hover": { color: INK },
        "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
      }}
    >
      <Typography sx={{ flex: 1, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "inherit" }}>
        {name}
      </Typography>
      <KeyboardArrowDownIcon sx={{ fontSize: 18, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.2s ease" }} />
    </Box>
  );
}

/** Entries in the order listed, split wherever the group changes. Ungrouped entries form one unnamed block. */
function groupsOf(items: Item[]): { name: string | null; items: Item[] }[] {
  const out: { name: string | null; items: Item[] }[] = [];
  for (const item of items) {
    const name = item.group ?? null;
    const last = out[out.length - 1];
    if (last && last.name === name) last.items.push(item);
    else out.push({ name, items: [item] });
  }
  return out;
}

/**
 * Reports the query string. Kept in its own component behind a Suspense boundary
 * because useSearchParams would otherwise pull every page that renders the
 * sidebar out of static rendering. It also follows a page's own
 * history.replaceState (the Datatracker's tab clicks), which Next keeps in step.
 */
function SearchProbe({ onChange }: { onChange: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => onChange(search), [search, onChange]);
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const here = search ? `${pathname}?${search}` : pathname;

  // Only ONE item active: the longest href that is an exact or parent-prefix
  // match. Stops "/docs" collisions and "/" lighting up everywhere. An href that
  // carries a query (the Datatracker's tabs) must match the address exactly.
  const activeHref = (() => {
    const all = navSections.flatMap((s) => [
      ...(s.home ? [s.home] : []),
      ...s.items.filter((i) => !i.placeholder).flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]),
    ]);
    const matches = all.filter((h) =>
      h.includes("?") ? here === h : pathname === h || (h !== "/" && pathname?.startsWith(h + "/")),
    );
    return matches.sort((a, b) => b.length - a.length)[0] ?? "/";
  })();

  const activeSection = navSections.find((s) =>
    s.home === activeHref ||
    s.items.some((i) => i.href === activeHref || i.children?.some((c) => c.href === activeHref)),
  );

  // WHAT THIS PERSON MAY SEE.
  //
  // A viewer granted one app was still being offered all five here, and the
  // governance rows besides. The guard on each app's layout is what refuses
  // them; this stops the nav from advertising doors that will.
  //
  // While it is still loading: app rows are shown (a failed fetch should not
  // empty the panel — the guards still hold), governance rows are not (showing
  // them and taking them away is worse than a moment's delay).
  const [acc, setAcc] = useState<{ role: Role; open: Record<string, boolean> } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok) setAcc({ role: j.role as Role, open: j.open as Record<string, boolean> }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const allowed = (item: Item) => {
    if (item.adminOnly && acc?.role !== "admin") return false;
    // The Datatracker's rows carry a tab in the query; the route map reads paths.
    const app = appForPath(item.href.split("?")[0]);
    if (app && acc && !acc.open[app]) return false;
    return true;
  };
  const visibleItems = (s: NavSection) => s.items.filter(allowed);

  // Inside an app the panel is THAT app's: the way back to all apps, the app
  // itself, then its pages. Anywhere that belongs to no app, every app is listed
  // under its own heading, only the current one open.
  const scoped = pathname !== "/" && !!activeSection;
  const blocks = scoped
    ? groupsOf(visibleItems(activeSection!))
    : navSections
        .map((s) => ({ name: s.title as string | null, items: visibleItems(s) }))
        .filter((b) => b.items.length > 0);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (name: string) => collapsed[name] ?? (!scoped && name !== activeSection?.title);
  const toggle = (name: string) => setCollapsed((c) => ({ ...c, [name]: !isCollapsed(name) }));

  const renderItem = (item: Item) => {
    if (item.placeholder) return <SlotRow key={item.href} icon={item.icon} label={item.label} />;
    return (
      <Fragment key={item.href}>
        <Row href={item.href} icon={item.icon} label={item.label} badge={item.badge} active={item.href === activeHref} />
        {item.children?.map((c) => (
          <Box key={c.href} sx={{ pl: 3.5 }}>
            <Row href={c.href} icon={<Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: c.href === activeHref ? ACCENT : "#c9ced6" }} />}
              label={c.label} active={c.href === activeHref} />
          </Box>
        ))}
      </Fragment>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        alignSelf: "flex-start",
        position: "sticky",
        top: 0,
        height: "100vh",
        "& .MuiDrawer-paper": {
          position: "relative",
          boxSizing: "border-box",
          width: DRAWER_WIDTH - PANEL_GAP * 2,
          height: `calc(100vh - ${PANEL_GAP * 2}px)`,
          m: `${PANEL_GAP}px`,
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.9)",
          bgcolor: "rgba(255,255,255,0.84)",
          backdropFilter: "blur(18px) saturate(140%)",
          boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.07)",
          overflow: "hidden",
        },
      }}
    >
      <Suspense fallback={null}><SearchProbe onChange={setSearch} /></Suspense>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, pt: 2, pb: 1 }}>
          {scoped ? (
            <>
              {/* The way out. Without it entering an app is a trapdoor: the
                  panel is the app's, and nothing else says there are others. */}
              <Row href="/" icon={<ChevronLeftIcon />} label="All apps" />
              <Box sx={{ mt: 1.25, mb: 2.25 }}>
                <Row href={activeSection!.home ?? activeSection!.items[0]?.href ?? "/"} icon={activeSection!.icon} label={activeSection!.title} active strong />
              </Box>
            </>
          ) : (
            <Box component={Link} href="/" sx={{ display: "flex", alignItems: "baseline", textDecoration: "none", px: 1.25, pb: 2.25 }}>
              <Box component="span" className="brand-display brand-apso" sx={{ fontSize: 28, fontWeight: 700 }}>
                <span className="letter letter-a">A</span>
                <span className="letter letter-p">P</span>
                <span className="letter letter-s">S</span>
                <span className="letter letter-o">O</span>
              </Box>
              <Box component="span" className="brand-display" sx={{ fontSize: 28, color: RED, fontWeight: 800 }}>hub</Box>
            </Box>
          )}

          {blocks.map((b, i) => (
            <Box key={b.name ?? `block-${i}`} sx={{ mb: 2 }}>
              {b.name ? (
                <>
                  <Heading name={b.name} collapsed={isCollapsed(b.name)} onToggle={() => toggle(b.name!)} />
                  <Collapse in={!isCollapsed(b.name)} timeout={200}>
                    {b.items.map(renderItem)}
                  </Collapse>
                </>
              ) : (
                b.items.map(renderItem)
              )}
            </Box>
          ))}
        </Box>

        <Box sx={{ px: 1.5, py: 1.25, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
          <Row href="/api/auth/signout" icon={<LogoutIcon />} label="Sign out" anchor />
        </Box>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
