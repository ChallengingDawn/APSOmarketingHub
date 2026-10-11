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

export type Report = { name: string; href: string; note: string };
export type ReportCategory = {
  slug: string;
  name: string;
  /** One line: what the category answers. */
  line: string;
  reports: Report[];
  /** What is coming, named - shown only while the category is empty. */
  next?: string;
};

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    slug: "website", name: "Website Reports", line: "How the site is found and used",
    reports: [
      { name: "Site overview", href: "/website/overview", note: "Visits, engagement and revenue" },
      { name: "Acquisition", href: "/website/acquisition", note: "Where the visits come from" },
      { name: "Audience", href: "/website/audience", note: "Who comes, and from where" },
      { name: "Pages", href: "/website/pages", note: "Which pages carry the traffic" },
    ],
  },
  {
    slug: "marketing", name: "Marketing Reports", line: "What marketing set out to do, and where it stands",
    reports: [
      { name: "SMEC targets", href: "/analytics/smec", note: "Where the targets stand" },
    ],
  },
  {
    slug: "customers", name: "Customer Reports", line: "Where customers arrive, where we lose them, what came of it",
    reports: [
      { name: "KPIs", href: "/journey/kpis", note: "Conversion, losses and what is working" },
      { name: "New customers", href: "/analytics/new-customers", note: "Who arrived this period" },
      { name: "Buying companies", href: "/analytics/buyers", note: "Who bought, and how often" },
      { name: "Contact requests", href: "/analytics/contact-requests", note: "Who asked to be contacted" },
    ],
  },
  {
    slug: "eso", name: "ESO Reports", line: "The optimal ESO benchmark - per sales rep, this year against last",
    // The benchmark from SARCLA's CrystalESO deck is being built; it is listed
    // here the day its first section has real numbers, never as an empty page.
    reports: [], next: "Being built: the ESO benchmark per sales rep - revenue & order intake, customer development, tickets, visits and shop behaviour, this year against last.",
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
    slug: "otd", name: "OTD Reports", line: "On-time delivery: promised against shipped",
    reports: [], next: "First report: share of order lines shipped on the promised date, by month.",
  },
  {
    slug: "satisfaction", name: "Satisfaction Reports", line: "What customers say about us",
    reports: [], next: "First report: survey and feedback results once a source is chosen.",
  },
];

export const categoryBySlug = (slug: string) => REPORT_CATEGORIES.find((c) => c.slug === slug) ?? null;
