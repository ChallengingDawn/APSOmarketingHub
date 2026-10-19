"use client";
import { Fragment, Suspense, useEffect, useState } from "react";
import { SEO_NAV, type SeoRouteId } from "@/app/seo/nav";
import { REPORT_CATEGORIES } from "@/lib/reporting/categories";
import HubIconGlyph from "@/app/HubIcon";
import { toneOf } from "@/app/reporting/ui";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
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
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HubIcon from "@mui/icons-material/Hub";
import SensorsIcon from "@mui/icons-material/Sensors";
import HandshakeIcon from "@mui/icons-material/Handshake";
import GroupsIcon from "@mui/icons-material/Groups";
import RouteIcon from "@mui/icons-material/Route";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import BoltIcon from "@mui/icons-material/Bolt";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PhoneCallbackOutlinedIcon from "@mui/icons-material/PhoneCallbackOutlined";
import DonutSmallIcon from "@mui/icons-material/DonutSmall";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import BeachAccessOutlinedIcon from "@mui/icons-material/BeachAccessOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ArticleIcon from "@mui/icons-material/Article";
import PublicIcon from "@mui/icons-material/Public";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SecurityIcon from "@mui/icons-material/Security";
import BarChartIcon from "@mui/icons-material/BarChart";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneIcon from "@mui/icons-material/Tune";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ForwardToInboxIcon from "@mui/icons-material/ForwardToInbox";
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
import TimelineIcon from "@mui/icons-material/Timeline";
import WavingHandOutlinedIcon from "@mui/icons-material/WavingHandOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import LoyaltyOutlinedIcon from "@mui/icons-material/LoyaltyOutlined";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import TagIcon from "@mui/icons-material/Tag";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import TripOriginOutlinedIcon from "@mui/icons-material/TripOriginOutlined";
import AdjustOutlinedIcon from "@mui/icons-material/AdjustOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import AllInclusiveOutlinedIcon from "@mui/icons-material/AllInclusiveOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Link from "next/link";

import { adminOnlyPath, appForPath, type Role } from "@/lib/auth/access";
import { useViewAs } from "@/app/ViewAs";
import { Wordmark } from "@/app/Wordmark";
import { APPS } from "@/app/hubApps";

const DRAWER_WIDTH = 300;
const RED = "#ed1b2f";

interface NavSection {
  title: string;
  /** Where the app row at the top of the panel leads. Default: the first entry. */
  home?: string;
  /** The way out at the top of the panel. Default: back to all apps. */
  back?: { href: string; label: string };
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
/** One icon per SEO page, keyed by the nav id so the two cannot fall out of step. */
const SEO_ICON: Record<SeoRouteId, React.ReactNode> = {
  overview: <SpaceDashboardIcon fontSize="small" />,
  "work-queue": <PlaylistAddCheckIcon fontSize="small" />,
  performance: <QueryStatsIcon fontSize="small" />,
  "quick-wins": <BoltIcon fontSize="small" />,
  cannibalisation: <CallSplitIcon fontSize="small" />,
  decay: <TrendingDownIcon fontSize="small" />,
  impact: <FactCheckIcon fontSize="small" />,
};

const navSections: NavSection[] = [
  {
    // The launch pad and the things that belong to no single app.
    title: "Hub",
    icon: <DashboardIcon />,
    color: "#274e64",
    items: [
      { label: "Mission Control", href: "/mission-control", icon: <DashboardIcon fontSize="small" /> },
    ],
  },
  {
    title: "Website",
    icon: <PublicIcon />,
    color: "#2d6fa8",
    items: [
      { label: "Live", href: "/live", icon: <SensorsIcon fontSize="small" />, badge: "Live" },
      { label: "Tracking health", href: "/analytics/tracking", icon: <MonitorHeartIcon fontSize="small" /> },
      { label: "Cookie consent", href: "/analytics/consent", icon: <CookieIcon fontSize="small" /> },
      // A data check (are shop orders reaching HubSpot, against GA4), so it sits
      // with Tracking health rather than among the use cases.
      { label: "Web order sync", href: "/analytics/web-orders", icon: <SyncAltIcon fontSize="small" /> },
      // services the shop's orders trigger, run by the hub (SARCLA 13.10.2026: DoC moved here from UC)
      { group: "Microservices", label: "Search bar", href: "/website/search-bar", icon: <ManageSearchIcon fontSize="small" /> },
      { group: "Microservices", label: "Google Ads buckets", href: "/website/ads-buckets", icon: <CampaignOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "DirectCut", href: "/website/directcut", icon: <ContentCutOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "APSOassistant Chat", href: "/website/chat", icon: <ForumOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "DoC Declarations", href: "/website/doc", icon: <VerifiedOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "3D Files", href: "/website/3d", icon: <ViewInArOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "DirectUP", href: "/website/directup", icon: <UploadFileOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "O-Ring Expert", href: "/website/oring-expert", icon: <TripOriginOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "Shaft-seal expert", href: "/website/shaft-seal-expert", icon: <AdjustOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "Compatibility table", href: "/website/compatibility-table", icon: <ScienceOutlinedIcon fontSize="small" /> },
      { group: "Microservices", label: "Vulcanised O-rings", href: "/website/vulcanised-o-rings", icon: <AllInclusiveOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: "Marketing & Content",
    icon: <AutoAwesomeIcon />,
    color: RED,
    items: [
      // CONTENT COMES FIRST, in SARCLA's order: the brain before the studio that
      // reads it, then what has been written, then the shapes to start from.
      // Personality leads because nothing the studio produces is right until it
      // is.
      // Projects first: it is the door, and the studio is where you go FROM a
      // project rather than the place work begins.
      // Personality first: it is the brain every generator reads, and reading
      // it is what you do before making anything.
      { group: "Content", label: "Personality", href: "/personality", icon: <PsychologyIcon fontSize="small" />, badge: "Brain" },
      { group: "Content", label: "Projects", href: "/projects", icon: <FolderOpenIcon fontSize="small" /> },
      { group: "Content", label: "Templates", href: "/templates", icon: <DashboardCustomizeIcon fontSize="small" /> },
      // Create Studio and the Content Library are deliberately NOT here.
      // The studio is where you arrive after choosing what to make — a link
      // to it means an empty editor with nothing to edit, which is the state
      // this whole redesign exists to remove. The library is what a project
      // holds, so it is reached through the project that holds it.
      // Generated from SEO_NAV rather than typed out again. The two lists
      // used to be written separately and had drifted into disagreeing about
      // what the pages were even called.
      ...SEO_NAV.map((e) => ({
        group: "SEO" as const,
        label: e.label,
        href: e.href,
        icon: SEO_ICON[e.id],
      })),
      { group: "GEO", label: "GEO readiness", href: "/geo", icon: <FactCheckIcon fontSize="small" /> },
      { group: "GEO", label: "GEO content audit", href: "/geo/content", icon: <ArticleIcon fontSize="small" /> },
      { group: "GEO", label: "GEO live pages", href: "/geo/live", icon: <PublicIcon fontSize="small" /> },
      { group: "GEO", label: "GEO competitors", href: "/geo/competitors", icon: <CompareArrowsIcon fontSize="small" /> },
      { group: "GEO", label: "GEO fix queue", href: "/geo/fix-queue", icon: <BuildCircleIcon fontSize="small" /> },
      // HubSpot's AEO, read by the hub (SARCLA 17.10)
      { group: "AEO", label: "AI answers", href: "/aeo", icon: <SmartToyOutlinedIcon fontSize="small" /> },
      { group: "AEO", label: "Prompts and answers", href: "/aeo/prompts", icon: <QuestionAnswerOutlinedIcon fontSize="small" /> },
      { group: "AEO", label: "Recommendations", href: "/aeo/recommendations", icon: <TipsAndUpdatesOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: "Customer Journey",
    icon: <RouteIcon />,
    color: "#1baf7a",
    items: [
      { label: "The journey", href: "/journey", icon: <RouteIcon fontSize="small" /> },
      { label: "Lifecycle funnels", href: "/journey/funnels", icon: <FilterAltIcon fontSize="small" /> },
      { label: "Customers", href: "/customers", icon: <HandshakeIcon fontSize="small" /> },
      { label: "Visitors", href: "/customers/visitors", icon: <GroupsIcon fontSize="small" /> },
      { label: "Journeys", href: "/customers/journeys", icon: <RouteIcon fontSize="small" /> },
    ],
  },
  // Every report in the hub, by team (SARCLA, 11.10.2026), from
  // src/lib/reporting/categories.ts. Each category is a section of its own:
  // inside one, the panel shows only ITS reports, the way every app shows only
  // its own pages (SARCLA: "each advanced report should only show on side bar
  // their reports as the rest of applications"), and the way out leads back to
  // Advanced reporting. A category with no report yet is its heading alone.
  ...REPORT_CATEGORIES.map((c): NavSection => ({
    title: c.name,
    home: `/reporting/${c.slug}`,
    back: { href: "/reporting", label: "Advanced reporting" },
    icon: <HubIconGlyph name={toneOf(c.slug).icon} fontSize={22} />,
    color: toneOf(c.slug).fg,
    // Under a heading, like every app's pages (SARCLA 12.10: "should be a sub
    // app ... it should follow the normal pattern") - not a second app row.
    // A report with pages of its own (Marketing KPIs) lists them under its own
    // heading, each with a glyph, as the UC app lists its apps (SARCLA 12.10).
    items: c.reports.flatMap((r) => (r.children?.length
      ? [
          { group: r.name, label: r.overview ?? r.name, href: r.overviewHref ?? r.href, icon: <HubIconGlyph name={r.icon} fontSize={20} /> },
          ...r.children.map((ch) => ({ group: ch.group ?? r.name, label: ch.name, href: ch.href, icon: <HubIconGlyph name={ch.icon ?? r.icon} fontSize={20} /> })),
        ]
      : [{ group: "Reports", label: r.name, href: r.href, icon: <HubIconGlyph name={r.icon} fontSize={20} /> }])),
  })),
  {
    // Where the data comes from, and what each connection writes to HubSpot.
    // The title matches the tile in hubApps.ts exactly, which is how the panel
    // inherits the app's colour once you are inside it.
    title: "Connectors & Integration",
    home: "/connectors",
    icon: <SettingsInputComponentIcon />,
    color: "#13866a",
    items: [
      // One sub-section per connector; the Compass connector is the first, and
      // its overview sits inside it with its other pages (SARCLA, 07.10.2026)
      { group: "Compass connector", label: "Overview", href: "/connectors", icon: <MonitorHeartIcon fontSize="small" /> },
      { group: "Compass connector", label: "The chain", href: "/connectors/compass", icon: <SyncAltIcon fontSize="small" /> },
      { group: "Compass connector", label: "Files & runs", href: "/connectors/files", icon: <FolderOpenIcon fontSize="small" /> },
      { group: "Compass connector", label: "What it writes", href: "/connectors/writes", icon: <LayersIcon fontSize="small" /> },
      { group: "Compass connector", label: "Review queue", href: "/connectors/review", icon: <GroupsIcon fontSize="small" /> },
      // the shop's web orders into HubSpot - moved from APSOAssistant (SARCLA, 11.10.2026),
      // with the same pages as the Compass connector ("more views like the Compass")
      { group: "Magento connector", label: "Overview", href: "/connectors/magento", icon: <MonitorHeartIcon fontSize="small" /> },
      { group: "Magento connector", label: "Orders", href: "/connectors/magento/orders", icon: <ShoppingBagOutlinedIcon fontSize="small" /> },
      { group: "Magento connector", label: "Sweeps", href: "/connectors/magento/sweeps", icon: <SyncAltIcon fontSize="small" /> },
      { group: "Magento connector", label: "What it writes", href: "/connectors/magento/writes", icon: <LayersIcon fontSize="small" /> },
      { group: "Magento connector", label: "Review queue", href: "/connectors/magento/review", icon: <GroupsIcon fontSize="small" /> },
      // web orders get their A-number from the shop itself (magento_link, SARCLA 15.10.2026)
      { group: "Magento connector", label: "ERP numbers", href: "/connectors/magento/erp-numbers", icon: <TagIcon fontSize="small" /> },
    ],
  },
  {
    // Use cases (UCx - numbers to be assigned by SARCLA) and HubSpot apps. Most
    // still live in their own repos and migrate here over time; Erosion came from
    // the APSOAssistant micro apps. DoC, from there too, moved on to Website >
    // Microservices (SARCLA, 13.10). One-shot actions are campaigns with a start
    // and a fixed list (05.10, from the micro apps).
    title: "UC & HubSpot Apps",
    icon: <HubIcon />,
    color: "#eda100",
    items: [
      // the lifecycle use cases' reports - they run as HubSpot workflows; the hub only reads (SARCLA, 13.10.2026)
      { group: "Use cases", label: "Use Cases Overview", href: "/uc/lifecycle", icon: <TimelineIcon fontSize="small" /> },
      { group: "Use cases", label: "UC2 - Welcome", href: "/uc/lifecycle/welcome", icon: <WavingHandOutlinedIcon fontSize="small" /> },
      { group: "Use cases", label: "UC15 - Lost Leads", href: "/uc/lifecycle/lost-leads", icon: <PersonOffOutlinedIcon fontSize="small" /> },
      { group: "Use cases", label: "UC6 - Thank You", href: "/uc/lifecycle/thank-you", icon: <ThumbUpOffAltIcon fontSize="small" /> },
      { group: "Use cases", label: "UC9 - Second Purchase", href: "/uc/lifecycle/second-purchase", icon: <RepeatOneIcon fontSize="small" /> },
      { group: "Use cases", label: "UC10+11 - Repeat Purchase", href: "/uc/lifecycle/repeat-purchase", icon: <LoyaltyOutlinedIcon fontSize="small" /> },
      { group: "Use cases", label: "UC13 - Reactivation", href: "/uc/lifecycle/reactivation", icon: <AutorenewIcon fontSize="small" /> },
      { group: "Use cases", label: "UC4 - Abandoned Cart", href: "/uc/lifecycle/abandoned-cart", icon: <ShoppingCartOutlinedIcon fontSize="small" /> },
      { group: "Use cases", label: "UC12 - Revenue Drop", href: "/uc/lifecycle/revenue-drop", icon: <ShowChartIcon fontSize="small" /> },
      // new use cases, numbered after the lifecycle ones (SARCLA, 13.10.2026)
      { group: "Use cases", label: "UC16 - Erosion Article Level", href: "/uc/erosion", icon: <TrendingDownIcon fontSize="small" /> },
      { group: "Use cases", label: "UC17 - Price Check Tickets", href: "/uc/price-checks", icon: <PriceCheckIcon fontSize="small" /> },
      // came off the Compass connector's loop, where it never belonged (SARCLA, 10.10.2026)
      // who owns a company, per country, on a map - first of the HubSpot apps (SARCLA, 19.10.2026)
      { group: "HubSpot apps", label: "Map Assignment", href: "/uc/map-assignment", icon: <MapOutlinedIcon fontSize="small" /> },
      // the companies' sales priority (SARCLA, 16.10.2026)
      { group: "HubSpot apps", label: "Smart Segmentation", href: "/uc/segmentation", icon: <DonutSmallIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "Wrong Owners", href: "/uc/wrong-owners", icon: <ManageAccountsOutlinedIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "Holiday Redirection", href: "/uc/holiday-redirection", icon: <BeachAccessOutlinedIcon fontSize="small" /> },
      // Owner Redirection (12.10.2026) is the Redirections view of Map Assignment since 19.10.2026 - SARCLA: "part of
      // Map assignment, so it should be taken out as a sub-app"; /uc/owner-redirection sends there
      // the "Ticket associations" workflow of the Tickets app, run by the hub (SARCLA, 17.10.2026)
      { group: "HubSpot apps", label: "Ticket/Order/Article Associations", href: "/uc/ticket-associations", icon: <LinkOutlinedIcon fontSize="small" /> },
      // every morning a partner's article list with our stock, MOQ and status (SARCLA, 18.10.2026)
      { group: "HubSpot apps", label: "Stock to Partners", href: "/uc/partner-stock", icon: <Inventory2OutlinedIcon fontSize="small" /> },
      // the Smart Sub-Ticket card and 7 more, moved from "SARCLA - Smart Ticket Creator" (SARCLA, 18.10.2026)
      { group: "HubSpot apps", label: "Smart Sub-Tickets", href: "/uc/smart-tickets", icon: <AccountTreeOutlinedIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "Back Office Distribution", href: "/uc/bo-distribution", icon: <AssignmentIndOutlinedIcon fontSize="small" /> },
      { group: "HubSpot apps", label: "Duplicates & Merges", href: "/uc/ticket-duplicates", icon: <ContentCopyOutlinedIcon fontSize="small" /> },
      { group: "One-shot actions", label: "September Push", href: "/uc/sept-push", icon: <CampaignOutlinedIcon fontSize="small" /> },
      { group: "One-shot actions", label: "Marc CH Push", href: "/uc/marc-push", icon: <PhoneCallbackOutlinedIcon fontSize="small" /> },
      { group: "One-shot actions", label: "Nancy CH Push", href: "/uc/nancy-push", icon: <PhoneCallbackOutlinedIcon fontSize="small" /> },
      // Articles CY/LY moved to Advanced reporting > Products Reports (SARCLA, 16.10.2026)
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
      { group: "Personal", label: "Notifications", href: "/settings/notifications", icon: <MailOutlineIcon fontSize="small" /> },
      { group: "Personal", label: "Security", href: "/settings/security", icon: <ShieldOutlinedIcon fontSize="small" /> },
      { group: "Workspace", label: "People", href: "/settings/people", icon: <PeopleIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Roles & access", href: "/settings/roles", icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Integrations", href: "/settings/integrations", icon: <HubIcon fontSize="small" />, adminOnly: true },
      { group: "Workspace", label: "Mail", href: "/settings/mail", icon: <ForwardToInboxIcon fontSize="small" /> },
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

/**
 * The pale wash behind the row you are on, mixed from whichever colour the app
 * wears. Inside UC that is orange, inside Website green — the panel stops being
 * hub-blue the moment you are somewhere specific, so the colour tells you where
 * you are before you have read a word.
 *
 * `color-mix` does it in the browser, from the one hex each section already
 * carries, rather than a second hand-picked tint per app that would drift away
 * from the first.
 */
const wash = (hex: string) => `color-mix(in srgb, ${hex} 13%, #ffffff)`;
const INK = "#1f2633";
const MUTED = "#6b7385";
const ICON = "#4a5263";
const PANEL_GAP = 14;

type Item = NavSection["items"][number];

function Row({
  href, icon, label, active = false, badge, strong = false, anchor = false, tone,
}: {
  href: string; icon: React.ReactNode; label: string; active?: boolean; badge?: string; strong?: boolean; anchor?: boolean;
  /** The app's own colour while you are inside it; the hub blue everywhere else. */
  tone?: string;
}) {
  const accent = tone ?? ACCENT;
  const accentBg = tone ? wash(tone) : ACCENT_BG;
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
        color: active ? accent : INK,
        bgcolor: active ? accentBg : "transparent",
        transition: "background-color 0.15s ease, color 0.15s ease",
        "&:hover": { bgcolor: active ? accentBg : "rgba(15,23,42,0.045)" },
        "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 1 },
        "& .row-icon svg": { fontSize: 20, color: active ? accent : ICON, transition: "color 0.15s ease" },
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
          sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: active ? "#ffffff" : "#eef1f6", color: active ? accent : MUTED }}
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

  // An address that belongs to NOWHERE in the hub — a typo, a dead link, a raw
  // /api path pasted into the bar — gets no panel at all. Without this the
  // fallback below treats "unknown" as "show everything", so a 404 answers a
  // wrong URL with the entire app catalogue laid open. Matched on the first
  // segment only, so a real page deeper inside an app keeps its menu.
  const topSegment = (href: string) => href.split("?")[0].split("/")[1] ?? "";
  const knownTop = new Set(
    navSections
      .flatMap((s) => [...(s.home ? [s.home] : []), ...s.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])])])
      .map(topSegment)
      .filter(Boolean),
  );
  const nowhere = !!pathname && pathname !== "/" && !knownTop.has(topSegment(pathname));

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
  // While previewing somebody, the panel is theirs: same rule, their role and
  // their grants, so "view as" shows the hub they actually get rather than
  // yours with a banner on top.
  const { viewed, canOpen: canOpenAs } = useViewAs();
  const [acc, setAcc] = useState<{ role: Role; open: Record<string, boolean> } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok) setAcc({ role: j.role as Role, open: j.open as Record<string, boolean> }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const role = viewed?.role ?? acc?.role;
  const allowed = (item: Pick<Item, "href" | "adminOnly">) => {
    // The flag says so, or the path does. Two ways to spell the same rule, so a
    // governance page added later is covered without anyone remembering to.
    if ((item.adminOnly || adminOnlyPath(item.href)) && role !== "admin") return false;
    // The Datatracker's rows carry a tab in the query; the route map reads paths.
    const app = appForPath(item.href.split("?")[0]);
    if (!app) return true;
    if (viewed) return canOpenAs(app);
    return !acc || acc.open[app];
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

  // Inside an app, everything in the panel wears that app's colour — taken from
  // the TILE on the launch pad, not from this file's own `color`. Those two had
  // drifted apart: Marketing is pink on the front page and was green here,
  // Datatracker blue there and orange here. The tile is the one people see
  // first, so it wins, and the panel is recognisably the same app they clicked.
  const tone = scoped && activeSection
    ? APPS.find((a) => a.name === activeSection.title)?.to ?? activeSection.color
    : undefined;

  const renderItem = (item: Item) => {
    if (item.placeholder) return <SlotRow key={item.href} icon={item.icon} label={item.label} />;
    return (
      <Fragment key={item.href}>
        <Row href={item.href} icon={item.icon} label={item.label} badge={item.badge} active={item.href === activeHref} tone={tone} />
        {item.children?.map((c) => (
          <Box key={c.href} sx={{ pl: 3.5 }}>
            <Row href={c.href} icon={<Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: c.href === activeHref ? (tone ?? ACCENT) : "#c9ced6" }} />}
              label={c.label} active={c.href === activeHref} tone={tone} />
          </Box>
        ))}
      </Fragment>
    );
  };

  if (nowhere) return null;

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
              <Row href={activeSection!.back?.href ?? "/"} icon={<ChevronLeftIcon />} label={activeSection!.back?.label ?? "All apps"} />
              <Box sx={{ mt: 1.25, mb: 2.25 }}>
                {/* The app's own page only for those who may open it: Website's
                    reports sit under Advanced reporting, which is granted apart. */}
                <Row href={(activeSection!.home && allowed({ href: activeSection!.home }) ? activeSection!.home : visibleItems(activeSection!)[0]?.href) ?? activeSection!.items[0]?.href ?? "/"} icon={activeSection!.icon} label={activeSection!.title} active strong tone={tone} />
              </Box>
            </>
          ) : (
            // The same mark as the launch pad and the sign-in card. It used to be
            // a third version here: stretched, red, with the letters cycling
            // through colours on a nine-second loop.
            <Box component={Link} href="/" sx={{ display: "block", textDecoration: "none", px: 1.25, pb: 2.25 }}>
              <Wordmark size={26} subtitle={null} />
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
          <BuildStamp />
        </Box>
      </Box>
    </Drawer>
  );
}

/**
 * Which build is on screen.
 *
 * The commit is baked into the image at build time and served by
 * /api/health; it simply was not anywhere a person could see it. Without it,
 * "nothing changed" is an argument nobody can settle: the one deploying sees
 * digests and task definitions, the one using it sees a page that looks the
 * same, and neither has a fact the other can check.
 *
 * Deliberately quiet - it is a serial number, not information - and it fails
 * silent: a hub that cannot answer shows nothing rather than an error about
 * a version.
 */
function BuildStamp() {
  const [sha, setSha] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => { if (alive && j?.shortCommit && j.shortCommit !== "unknown") setSha(j.shortCommit); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!sha) return null;
  return (
    <Box
      title={"This page is running build " + sha + ". If a change is missing, check this against the one that was deployed."}
      sx={{ px: 1.25, pt: 0.75, fontSize: 10, color: "rgba(15,23,42,0.38)", fontFamily: "var(--font-mono), monospace", userSelect: "all" }}
    >
      build {sha}
    </Box>
  );
}

export { DRAWER_WIDTH };
