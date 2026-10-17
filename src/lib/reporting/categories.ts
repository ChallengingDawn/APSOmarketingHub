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
import { STAGES } from "../marketingKpis/catalogue";

export const STAGE_ICON: Record<string, IconKey> = {
  customers: "groups", reach: "ads", visit: "route", engage: "bolt", lead: "description",
  handover: "sync", cart: "inventory", purchase: "tag", retain: "health", efficiency: "target",
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
        overview: "In a nutshell", overviewHref: "/reporting/marketing-kpis",
        children: [
          ...STAGES.map((s) => ({ name: s.name.replace(/\s*\(.*\)\s*$/, ""), href: `/reporting/marketing-kpis/${s.slug}`, icon: STAGE_ICON[s.slug] ?? ("bar" as IconKey) })),
          { name: "Sales leader view", href: "/reporting/marketing-kpis/sales-leader", icon: "verified", group: "Views & inputs" },
          { name: "Monthly inputs", href: "/reporting/marketing-kpis/inputs", icon: "edit", group: "Views & inputs" },
        ],
      },
      // SARCLA 17.10: "with this data can we now build on the advanced reporting" - the AEO answers the hub keeps
      { name: "AI visibility (AEO)", href: "/reporting/ai-visibility", note: "What ChatGPT, Gemini and Perplexity say about us", icon: "brain" },
      { name: "SMEC targets", href: "/analytics/smec", note: "Where the targets stand", icon: "target" },
    ],
  },
  {
    slug: "eso", name: "ESO Reports", line: "The optimal ESO benchmark - per sales rep, this year against last",
    // The benchmark from SARCLA's CrystalESO deck (src/lib/reporting/esoBenchmark.ts).
    // Sub-apps in the deck's order, Visits first (SARCLA 12.10); one read, one rep selection.
    reports: [
      { name: "Visits", href: "/reporting/eso-benchmark/visits", note: "Completed visits per rep and month", icon: "route" },
      { name: "Customer development", href: "/reporting/eso-benchmark/customers", note: "Active, new, reactivated, lost", icon: "groups" },
      { name: "New customers", href: "/reporting/eso-benchmark/new-customers", note: "First orders, by type and potential", icon: "target" },
      { name: "Registrations", href: "/reporting/eso-benchmark/registrations", note: "Shop accounts and what came of them", icon: "verified" },
      { name: "Revenue & order intake", href: "/reporting/eso-benchmark/revenue", note: "Per rep and month, to last year", icon: "bar" },
      { name: "Tickets", href: "/reporting/eso-benchmark/tickets", note: "Success, speed and open potential", icon: "description" },
      { name: "Shop behaviour", href: "/reporting/eso-benchmark/shop", note: "Logins, views and orders", icon: "inventory" },
    ],
  },
  {
    slug: "tsa", name: "TSA Reports", line: "The TSA team's tickets, calls and response times",
    reports: [], next: "First report: first-reply time against the Swiss SLA, per person.",
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
    reports: [], next: "First report: survey and feedback results once a source is chosen.",
  },
  {
    slug: "customers", name: "Customer Reports", line: "Where customers arrive, where we lose them, what came of it",
    reports: [
      { name: "KPIs", href: "/journey/kpis", note: "Conversion, losses and what is working", icon: "bar" },
      { name: "New customers", href: "/analytics/new-customers", note: "Who arrived this period", icon: "groups" },
      { name: "Buying companies", href: "/analytics/buyers", note: "Who bought, and how often", icon: "tag" },
      { name: "Contact requests", href: "/analytics/contact-requests", note: "Who asked to be contacted", icon: "description" },
    ],
  },
  {
    // SARCLA, 16.10.2026: Articles CY/LY moves here from UC & HubSpot Apps > Reports & data.
    // Its address and its access rule (the UC app's) stay as they were.
    slug: "products", name: "Products Reports", line: "Articles and products, this year against last",
    reports: [
      { name: "Articles CY/LY", href: "/uc/articles", note: "Every article, this year against last", icon: "bar" },
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
