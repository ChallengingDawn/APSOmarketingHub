// ADVANCED REPORTING, BY TEAM - the one list of what lives where.
//
// SARCLA, 11.10.2026: Advanced reporting gets main categories - Website,
// Marketing, Customer, ESO, TSA, Back-Office, OTD and Satisfaction Reports -
// and the existing reports move in (Website's report pages, SMEC targets, the
// KPIs and customer reports that sat under Customer Journey). The landing page,
// each category page and the sidebar all read THIS list, so they cannot drift.
//
// Pages keep their addresses: a move is a move in the menu, so every link and
// bookmark still works, and each page keeps the access rule it already had.

import type { IconKey } from "../../app/hubApps"; // relative: the unit tests compile this file
import { SHOWN_STAGES, stageName } from "../marketingKpis/stageNames";

export const STAGE_ICON: Record<string, IconKey> = {
  customers: "groups", reach: "ads", visit: "route", engage: "bolt", lead: "description",
  handover: "sync", uc: "loop", cart: "inventory", purchase: "tag", retain: "health", efficiency: "target",
};

export type Report = {
  name: string; href: string; note: string; icon: IconKey;
  /** Pages under this report, listed indented beneath it in the side panel. */
  children?: { name: string; href: string; icon?: IconKey; group?: string }[];
  /** The side panel's name for the report's own page when it has children ("In a nutshell"). */
  overview?: string;
  /** That page's address, when a click on the report opens one of its children instead. */
  overviewHref?: string;
};
export type ReportCategory = {
  slug: string;
  name: string;
  /** One line: what the category answers. */
  line: string;
  reports: Report[];
  /** What is coming, named - shown only while the category is empty. */
  next?: string;
};

// The order is SARCLA's (16.10.2026): Digital Growth - the former Marketing
// Reports, renamed - then ESO, TSA, Back-Office, Website, OTD and Satisfaction;
// Customer Reports, not named in that list, after them; Products Reports (added
// the same day) last.
export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    slug: "marketing", name: "Digital Growth Reports", line: "What marketing set out to do, and where it stands",
    reports: [
      // Every marketing KPI, each stage a page of its own - in the side panel as
      // the UC app lists its apps: under a heading, each with a glyph, the name
      // alone (SARCLA 12.10). A click on the report opens "Who are our
      // customers" (SARCLA 13.10: "this should be the initial page").
      {
        // SARCLA 17.10: "Marketing KPIs is Digital Growth KPIs" - the name only; the addresses stay
        name: "Digital Growth KPIs", href: "/reporting/marketing-kpis/customers", note: "Our customers, then every marketing KPI by stage", icon: "bar",
        overview: "BUC View", overviewHref: "/reporting/marketing-kpis",
        children: [
          ...SHOWN_STAGES.map((s) => ({ name: stageName(s.slug, s.name), href: `/reporting/marketing-kpis/${s.slug}`, icon: STAGE_ICON[s.slug] ?? ("bar" as IconKey) })),
          // "Views & inputs" becomes "Other reports" - Monthly inputs and SMEC targets (SARCLA 20.10.2026)
          { name: "Monthly inputs", href: "/reporting/marketing-kpis/inputs", icon: "edit", group: "Other reports" },
          { name: "SMEC targets", href: "/analytics/smec", icon: "target", group: "Other reports" },
          // the Use Cases Overview of UC & HubSpot Apps, the very page (SARCLA 21.10.2026: "bring the UC nutshell as it is on HubSpot apps,
          // exactly the same") - at its own address, so behind UC's grant: the side panel shows it to those who can open UC
          { name: "Use Cases Overview", href: "/uc/lifecycle", icon: "loop", group: "Other reports" },
        ],
      },
    ],
  },
  {
    // The Sales leader view leaves Digital Growth for a tile of its own (SARCLA 20.10.2026: "a full advanced
    // report with its own tile - will be changed later")
    slug: "sales-leader", name: "Sales Leader View", line: "The KPIs the sales leader follows",
    reports: [
      { name: "Sales leader view", href: "/reporting/sales-leader", note: "The KPIs tagged for the sales leader, stage by stage", icon: "verified" },
    ],
  },
  {
    slug: "eso", name: "ESO Reports", line: "The optimal ESO benchmark - per sales rep, this year against last",
    // The benchmark from SARCLA's CrystalESO deck (src/lib/reporting/esoBenchmark.ts), its pages in the deck's
    // order, Visits first (SARCLA 12.10); one read, one rep selection. Built as Digital Growth is (SARCLA 21.10.2026:
    // "the ESO reporting in the same structure as the digital growth"): one report, its BUC View first, the pages
    // beneath it under a heading.
    reports: [
      {
        name: "ESO KPIs", href: "/reporting/eso-benchmark/visits", note: "The optimal ESO benchmark, page by page", icon: "route",
        overview: "BUC View", overviewHref: "/reporting/eso-benchmark",
        children: [
          // revenue and order intake per month and per person, ESO | TSA | Total, the forecast on Total (SARCLA 24.10.2026: "first")
          // in SARCLA's order (31.10.2026: "reorganize sub apps - Figures, Visits, Registrations, Shop behaviour, New
          // customers, Customer development, Incoming tickets, System tickets"); the BUC View's panels follow it (pages.tsx)
          { name: "Figures", href: "/reporting/eso-benchmark/figures", icon: "bar" },
          { name: "Visits", href: "/reporting/eso-benchmark/visits", icon: "route" },
          { name: "Registrations", href: "/reporting/eso-benchmark/registrations", icon: "verified" },
          { name: "Shop behaviour", href: "/reporting/eso-benchmark/shop", icon: "inventory" },
          { name: "New customers", href: "/reporting/eso-benchmark/new-customers", icon: "target" },
          { name: "Customer development", href: "/reporting/eso-benchmark/customers", icon: "groups" },
          // the tickets as two apps (SARCLA 30.10.2026: "split in 2 apps - Incoming Ticket and System tickets")
          { name: "Incoming tickets", href: "/reporting/eso-benchmark/tickets", icon: "description" },
          { name: "System tickets", href: "/reporting/eso-benchmark/system-tickets", icon: "bolt" },
        ],
      },
    ],
  },
  {
    // ESO's sub-apps, each at its own address under /reporting/tsa-benchmark (so the side panel stays TSA's) and
    // opening on TSA (SARCLA 01.11.2026: "migrate to TSA now the customer development, but instead of default ESO,
    // default is TSA")
    slug: "tsa", name: "TSA Reports", line: "The TSA team's customers - per person, this year against last",
    // built as ESO's (SARCLA 01.11.2026: "move BUC view with the same principle to TSA reports and the figures also to
    // TSA with TSA default"): one report, its BUC View first, the pages beneath it under a heading
    reports: [
      {
        name: "TSA KPIs", href: "/reporting/tsa-benchmark/calls", note: "The TSA team, page by page, opening on TSA", icon: "chat",
        overview: "BUC View", overviewHref: "/reporting/tsa-benchmark",
        // in ESO's order (SARCLA 01.11.2026: "the order of apps on TSA is not the same as in ESO"), Calls where ESO has Visits
        children: [
          // revenue and order intake per month and per person, opening on TSA - first, as on ESO
          { name: "Figures", href: "/reporting/tsa-benchmark/figures", icon: "bar" },
          // where ESO has its Visits: TSA calls (SARCLA 01.11.2026: "build instead of visits on TSA a sub report for calls")
          { name: "Calls", href: "/reporting/tsa-benchmark/calls", icon: "chat" },
          // against the first qualified call, not the visit: TSA calls (SARCLA 01.11.2026: "measuring visits here it's not fair")
          { name: "Registrations", href: "/reporting/tsa-benchmark/registrations", icon: "verified" },
          // SARCLA 01.11.2026: "shop behaviour is finished - move it to TSA like the other one, keeping it default on TSA"
          { name: "Shop behaviour", href: "/reporting/tsa-benchmark/shop", icon: "inventory" },
          // SARCLA 01.11.2026: "transfer also this to TSA reports new customer"
          { name: "New customers", href: "/reporting/tsa-benchmark/new-customers", icon: "target" },
          { name: "Customer development", href: "/reporting/tsa-benchmark/customers", icon: "groups" },
          // SARCLA 01.11.2026: "move like the other the ticket also to TSA ... default TSA on TSA reports" - the TSA pipeline's
          { name: "Incoming tickets", href: "/reporting/tsa-benchmark/tickets", icon: "description" },
          { name: "System tickets", href: "/reporting/tsa-benchmark/system-tickets", icon: "bolt" },
        ],
      },
    ],
  },
  {
    slug: "back-office", name: "Back-Office Reports", line: "What the Back Office handles, and how fast",
    reports: [], next: "First report: tickets in and closed per week, by type and person.",
  },
  {
    slug: "website", name: "Website Reports", line: "How the site is found and used",
    reports: [
      { name: "Site overview", href: "/website/overview", note: "Visits, engagement and revenue", icon: "bar" },
      { name: "Acquisition", href: "/website/acquisition", note: "Where the visits come from", icon: "ads" },
      { name: "Audience", href: "/website/audience", note: "Who comes, and from where", icon: "groups" },
      { name: "Pages", href: "/website/pages", note: "Which pages carry the traffic", icon: "layers" },
    ],
  },
  {
    slug: "otd", name: "OTD Reports", line: "On-time delivery: promised against shipped",
    reports: [], next: "First report: share of order lines shipped on the promised date, by month.",
  },
  {
    slug: "satisfaction", name: "Satisfaction Reports", line: "What customers say about us",
    reports: [
      // every HubSpot survey answer - CSAT and NPS per country, language, locale and touchpoint (SARCLA 27.10.2026)
      { name: "Satisfaction KPIs", href: "/reporting/satisfaction", note: "Satisfied share per country, language, locale and touchpoint", icon: "verified" },
    ],
  },
  {
    slug: "customers", name: "Customer Reports", line: "Where customers arrive, where we lose them, what came of it",
    // Customer KPIs, the whole company on Who are our customers' cube (SARCLA 01.11.2026: "based on what we know, think about
    // what kind of dynamic KPI would be interesting here"): one report, its pages beneath it as ESO's - Customer base first,
    // the report's own page - and the four reports of before under "Other reports", as Digital Growth's, their addresses
    // and access rules unchanged
    reports: [
      {
        name: "Customer KPIs", href: "/reporting/customers/base", note: "Active, new, won back and lost; concentration, cross-selling, risk, retention", icon: "groups",
        overview: "Customer base", overviewHref: "/reporting/customers/base",
        children: [
          { name: "Revenue concentration", href: "/reporting/customers/concentration", icon: "bar" },
          { name: "Cross-selling", href: "/reporting/customers/cross-selling", icon: "layers" },
          { name: "Recency & risk", href: "/reporting/customers/recency", icon: "health" },
          { name: "Retention", href: "/reporting/customers/retention", icon: "loop" },
          { name: "KPIs", href: "/journey/kpis", icon: "bar", group: "Other reports" },
          { name: "New customers", href: "/analytics/new-customers", icon: "groups", group: "Other reports" },
          { name: "Buying companies", href: "/analytics/buyers", icon: "tag", group: "Other reports" },
          { name: "Contact requests", href: "/analytics/contact-requests", icon: "description", group: "Other reports" },
        ],
      },
    ],
  },
  {
    // SARCLA, 16.10.2026: Articles CY/LY moves here from UC & HubSpot Apps > Reports & data.
    // Its address and its access rule (the UC app's) stay as they were.
    slug: "products", name: "Products Reports", line: "Articles and products, this year against last",
    // one report and its pages, as ESO's (SARCLA 01.11.2026: "articles CY/LY is ok ... but we should have much more,
    // for example availability check on the shop where we didn't have stock - we should really create subtabs"; his
    // picks, "all by sub app": Availability, Price checks, Minimum order, Views against orders, Search)
    reports: [
      {
        name: "Product KPIs", href: "/uc/articles", note: "Every article, what customers looked for and did not get", icon: "bar",
        // Articles CY/LY first - the report's own page, as Customer KPIs' Customer base; its address unchanged (it came from
        // UC & HubSpot Apps)
        overview: "Articles CY/LY", overviewHref: "/uc/articles",
        children: [
          // what the shop saw a customer try and not get (shopSignals.ts)
          { name: "Availability", href: "/reporting/products/availability", icon: "inventory" },
          { name: "Price checks", href: "/reporting/products/price-checks", icon: "tag" },
          { name: "Minimum order", href: "/reporting/products/minimum-order", icon: "layers" },
          // what customers looked at and searched for
          { name: "Views against orders", href: "/reporting/products/views", icon: "route" },
          { name: "Search", href: "/reporting/products/search", icon: "search" },
        ],
      },
    ],
  },
];

export const categoryBySlug = (slug: string) => REPORT_CATEGORIES.find((c) => c.slug === slug) ?? null;

/**
 * Where a click on a category goes: straight into its first report the person may
 * open (SARCLA, 16.10.2026: "I should not enter this view, I should go directly to
 * In a nutshell") - the report's overview page when it has one. Only a category
 * with no report yet keeps its own page, which names what comes first.
 */
export function categoryEntry(c: ReportCategory, canOpen: (href: string) => boolean = () => true): string {
  const first = c.reports.find((r) => canOpen(r.href));
  return first ? first.overviewHref ?? first.href : `/reporting/${c.slug}`;
}
