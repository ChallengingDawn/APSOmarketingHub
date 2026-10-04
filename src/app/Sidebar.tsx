"use client";
import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
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
import WorkspacesIcon from "@mui/icons-material/Workspaces";
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
import ContactMailIcon from "@mui/icons-material/ContactMail";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Link from "next/link";

const DRAWER_WIDTH = 300;
const RED = "#ed1b2f";

interface NavSection {
  title: string;
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
    // came from the APSOAssistant micro apps.
    title: "UC & HubSpot Apps",
    icon: <HubIcon />,
    color: "#eda100",
    items: [
      { group: "Use cases", label: "UCX - Erosion Article Level", href: "/uc/erosion", icon: <TrendingDownIcon fontSize="small" /> },
      { group: "Use cases", label: "UCX - Price Check Tickets", href: "/uc/price-checks", icon: <PriceCheckIcon fontSize="small" /> },
      { group: "Use cases", label: "UCX - DoC Declarations", href: "/uc/doc", icon: <VerifiedOutlinedIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "tbd", href: "#hubspot-apps-tbd", icon: <HubIcon fontSize="small" />, placeholder: true },
    ],
  },
  {
    title: "Datatracker",
    icon: <StorefrontIcon />,
    color: "#eb6834",
    items: [
      { label: "Customers & articles", href: "/datatracker", icon: <StorefrontIcon fontSize="small" /> },
    ],
  },
  {
    // Not an app: the hub's own governance. One sign-in, and who may open which
    // app is a permission set here rather than inside each app.
    title: "Governance",
    icon: <SecurityIcon />,
    color: "#5b6470",
    items: [
      { label: "Settings", href: "/settings", icon: <SettingsIcon fontSize="small" /> },
      { label: "Integrations", href: "/settings/integrations", icon: <HubIcon fontSize="small" /> },
      { label: "Audit", href: "/audit", icon: <SecurityIcon fontSize="small" /> },
      { label: "Admin · Users", href: "/admin", icon: <PeopleIcon fontSize="small" /> },
      { label: "Docs", href: "/docs", icon: <DescriptionIcon fontSize="small" /> },
    ],
  },
];

/** The rows a grouped app is shown as: one per group, in the order first listed. */
const GROUP_META: Record<string, { icon: React.ReactNode; color: string }> = {
  "Use cases": { icon: <WorkspacesIcon />, color: "#eda100" },
  "HubSpot apps": { icon: <HubIcon />, color: "#c97a10" },
};

function groupSections(s: NavSection): NavSection[] {
  const names = [...new Set(s.items.map((i) => i.group ?? s.title))];
  return names.map((name) => ({
    title: name,
    icon: GROUP_META[name]?.icon ?? s.icon,
    color: GROUP_META[name]?.color ?? s.color,
    // the row now carries the group's name, so the entries drop the small heading
    items: s.items.filter((i) => (i.group ?? s.title) === name).map((i) => ({ ...i, group: undefined })),
  }));
}

export default function Sidebar() {
  const pathname = usePathname();

  // Only ONE item active: the longest href that is an exact or parent-prefix
  // match. Stops "/docs" collisions and "/" lighting up everywhere.
  const activeHref = (() => {
    const all = navSections.flatMap((s) => s.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]));
    const matches = all.filter(
      (h) => pathname === h || (h !== "/" && pathname?.startsWith(h + "/")),
    );
    return matches.sort((a, b) => b.length - a.length)[0] ?? "/";
  })();

  const activeSectionTitle = navSections.find((s) =>
    s.items.some((i) => i.href === activeHref || i.children?.some((c) => c.href === activeHref)),
  )?.title;

  // Collapsible sections — accordion, only one open; the active section
  // starts open and re-opens on navigation.
  // On the launch pad every app is listed; inside one, ONLY that one is - the
  // point of a home screen is that entering an app narrows the world to it.
  // Governance is never scoped away, because it is the hub's own and a person
  // locked out of an app still has to be able to reach their account.
  const onLaunchPad = pathname === "/";
  const activeSection = navSections.find((x) => x.title === activeSectionTitle);
  const scoped = !onLaunchPad && !!activeSection && activeSection.title !== "Governance";
  // An app whose entries carry groups (UC: Use cases / HubSpot apps) shows each
  // group as its own big collapsible row, the way the categories always looked.
  const grouped = scoped && activeSection!.items.some((i) => i.group);
  const sections = !scoped ? navSections : grouped ? groupSections(activeSection!) : [activeSection!];
  const activeGroup = grouped ? (activeSection!.items.find((i) => i.href === activeHref)?.group ?? null) : null;
  const openKey = grouped ? activeGroup : (activeSectionTitle ?? null);

  const [open, setOpen] = useState<string | null>(openKey);
  useEffect(() => {
    if (openKey) setOpen(openKey);
  }, [openKey]);
  const toggle = (t: string) => setOpen((cur) => (cur === t ? null : t));

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          bgcolor: "#ffffff",
          borderRight: "1px solid #e6e8ec",
          position: "relative",
          overflow: "hidden",
        },
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          px: 3.25,
          pt: 3.5,
          pb: 2.75,
          position: "relative",
          zIndex: 2,
          bgcolor: "#ffffff",
          borderBottom: "1px solid #e6e8ec",
        }}
      >
        {/* Inside an app the header names THAT app - the menu below is its menu,
            so "APSOhub" up here only said where you are not. On the launch pad
            (and in Governance, which is the hub's own) it stays APSOhub. */}
        {scoped && activeSection ? (
          <Box component={Link} href="/" sx={{ display: "flex", alignItems: "center", gap: 1.5, textDecoration: "none" }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: 2.2, bgcolor: activeSection.color, color: "#fff", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,0.14)", "& svg": { fontSize: 23 },
              }}
            >
              {activeSection.icon}
            </Box>
            <Typography className="brand-display" sx={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15, color: "#1d1d1f", letterSpacing: "-0.015em" }}>
              {activeSection.title}
            </Typography>
          </Box>
        ) : (
        <Box
          component={Link}
          href="/"
          sx={{ display: "flex", alignItems: "baseline", textDecoration: "none" }}
        >
          <Box component="span" className="brand-display brand-apso" sx={{ fontSize: 34, fontWeight: 700 }}>
            <span className="letter letter-a">A</span>
            <span className="letter letter-p">P</span>
            <span className="letter letter-s">S</span>
            <span className="letter letter-o">O</span>
          </Box>
          <Box component="span" className="brand-display" sx={{ fontSize: 34, color: RED, fontWeight: 800 }}>
            hub
          </Box>
        </Box>
        )}
        <Typography
          sx={{
            fontSize: 12,
            color: "#5f6368",
            fontWeight: 500,
            mt: 1,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {scoped ? "APSOhub · apsoparts.com" : "apsoparts.com"}
        </Typography>
      </Box>

      {/* The way out of an app. Without it, entering one is a trapdoor: the
          sidebar is the app's, and nothing on screen says there are others. */}
      {scoped && (
        <Box
          component={Link}
          href="/"
          sx={{
            display: "flex", alignItems: "center", gap: 1.4, px: 3.25, py: 1.25,
            textDecoration: "none", color: "#5f6368", borderBottom: "0.5px solid #ececef",
            "&:hover": { bgcolor: "#f3f4f6", color: "#1d1d1f" },
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 19 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>All apps</Typography>
        </Box>
      )}

      {/* Navigation Sections — collapsible, iOS Settings rows */}
      <Box sx={{ flex: 1, overflow: "auto", py: 0, position: "relative", zIndex: 1 }}>
        {sections.map((section) => {
          const isOpen = (scoped && !grouped) || open === section.title;
          return (
            <Box key={section.title} sx={{ borderBottom: "0.5px solid #ececef" }}>
              {/* Category row - on the launch pad, and for each group of a grouped app.
                  Inside an ungrouped app the header already names it. */}
              {(!scoped || grouped) && (
              <Box
                onClick={() => toggle(section.title)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.6,
                  px: 3.25,
                  py: 1.35,
                  cursor: "pointer",
                  userSelect: "none",
                  bgcolor: isOpen ? "#f3f4f6" : "transparent",
                  transition: "background-color 0.16s ease",
                  "&:hover": { bgcolor: "#f3f4f6" },
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    bgcolor: section.color,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.14)",
                    "& svg": { fontSize: 21 },
                  }}
                >
                  {section.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                      color: "#1d1d1f",
                    }}
                  >
                    {section.title}
                  </Typography>
                </Box>
                <KeyboardArrowRightIcon
                  sx={{
                    fontSize: 22,
                    flexShrink: 0,
                    color: "#c7c7cc",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.22s ease",
                  }}
                />
              </Box>
              )}

              {/* Items */}
              <Collapse in={isOpen} timeout={240} unmountOnExit>
                <List dense disablePadding sx={{ px: 2, py: 0.75 }}>
                  {section.items.map((item, idx) => {
                    const active = item.href === activeHref;
                    const heading = item.group && item.group !== section.items[idx - 1]?.group ? item.group : null;
                    return (
                      <Fragment key={item.href}>
                      {heading && (
                        <Typography
                          sx={{
                            px: 2.25, pt: idx === 0 ? 0.75 : 2, pb: 0.75, fontSize: 11, fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a919b",
                          }}
                        >
                          {heading}
                        </Typography>
                      )}
                      {item.placeholder ? (
                        <Box
                          aria-disabled="true"
                          sx={{ display: "flex", alignItems: "center", px: 2.25, py: 1, minHeight: 46, mb: 0.4, color: "#a3a9b2", "& svg": { color: "#c3c8cf" } }}
                        >
                          <Box component="span" sx={{ display: "inline-flex", minWidth: 36 }}>{item.icon}</Box>
                          <Typography sx={{ fontSize: 14.5, fontStyle: "italic" }}>{item.label}</Typography>
                        </Box>
                      ) : (
                      <ListItemButton
                        component={Link}
                        href={item.href}
                        disableRipple
                        sx={{
                          borderRadius: 1.25,
                          mb: 0.4,
                          py: 1,
                          px: 2.25,
                          minHeight: 46,
                          position: "relative",
                          bgcolor: active ? RED : "transparent",
                          color: active ? "#ffffff" : "#363c44",
                          boxShadow: active ? "0 1px 2px rgba(237,27,47,0.25), 0 4px 12px rgba(237,27,47,0.18)" : "none",
                          transition: "background-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease",
                          "&:hover": {
                            bgcolor: active ? "#d81528" : "#f1f3f5",
                          },
                          "& .MuiListItemIcon-root": {
                            color: active ? "#ffffff" : "#5b6470",
                            minWidth: 36,
                            transition: "color 0.18s ease",
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Box
                            component="span"
                            className={active ? "nav-icon-active" : undefined}
                            sx={{ display: "inline-flex", alignItems: "center" }}
                          >
                            {item.icon}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: 14.5,
                                fontWeight: active ? 600 : 500,
                                color: active ? "#ffffff" : "#3c4043",
                                letterSpacing: "-0.005em",
                              },
                            },
                          }}
                        />
                        {item.badge && (
                          <Chip
                            label={item.badge}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 10.5,
                              fontWeight: 700,
                              bgcolor: active ? "#ffffff" : RED,
                              color: active ? RED : "#fff",
                              ml: 0.5,
                            }}
                          />
                        )}
                      </ListItemButton>
                      )}
                      {item.children?.map((child) => {
                        const childActive = child.href === activeHref;
                        return (
                          <ListItemButton
                            key={child.href}
                            component={Link}
                            href={child.href}
                            disableRipple
                            sx={{
                              borderRadius: 1.25,
                              mb: 0.2,
                              py: 0.5,
                              pl: 7,
                              pr: 2.25,
                              minHeight: 32,
                              bgcolor: childActive ? "rgba(237,27,47,0.08)" : "transparent",
                              "&:hover": { bgcolor: childActive ? "rgba(237,27,47,0.12)" : "#f1f3f5" },
                            }}
                          >
                            <Box
                              sx={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                bgcolor: childActive ? RED : "#c9ced6",
                                mr: 1.5,
                                flexShrink: 0,
                              }}
                            />
                            <ListItemText
                              primary={child.label}
                              slotProps={{
                                primary: {
                                  sx: {
                                    fontSize: 13,
                                    fontWeight: childActive ? 600 : 500,
                                    color: childActive ? RED : "#5b6470",
                                    letterSpacing: "-0.005em",
                                  },
                                },
                              }}
                            />
                          </ListItemButton>
                        );
                      })}
                      </Fragment>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Bottom Status + Sign out */}
      <Box sx={{ px: 2.5, py: 2.25, borderTop: "1px solid #e6e8ec", position: "relative", zIndex: 1, bgcolor: "#ffffff" }}>
        <Box sx={{ mb: 1.5, px: 1.75, py: 1.35, borderRadius: 1.25, bgcolor: "#f5f6f8", border: "1px solid #e6e8ec" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
            <Box
              sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#1e7e45", boxShadow: "0 0 0 3px rgba(30,126,69,0.15)" }}
              className="animate-pulse-dot"
            />
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#1a1d21" }}>
              System Active
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
            Content engine online
          </Typography>
        </Box>
        <ListItemButton
          component="a"
          href="/api/auth/signout"
          disableRipple
          sx={{
            borderRadius: 1.25,
            py: 1,
            px: 2.25,
            minHeight: 46,
            color: "#363c44",
            borderLeft: "3px solid transparent",
            "&:hover": {
              bgcolor: "#fdebed",
              color: RED,
              borderLeftColor: RED,
              "& .MuiListItemIcon-root": { color: RED },
            },
            "& .MuiListItemIcon-root": { minWidth: 36, color: "#5b6470" },
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            slotProps={{
              primary: {
                sx: { fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.005em" },
              },
            }}
          />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
