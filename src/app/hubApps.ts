// THE FIVE APPS, AND EVERYTHING INSIDE THEM.
//
// One list, read by the front page's cards, its search and its "View all".
// The sidebar groups the same routes; this is the front page's view of them,
// written out so the card, the search result and the expansion cannot disagree
// about what an app contains.
//
// Every href here resolves to a page under src/app. A front door offering
// something that is not there is worse than one offering less.

export type SubApp = {
  name: string;
  note: string;
  href: string;
  /** Which of the shared glyphs to draw. */
  icon: IconKey;
  tint: string;
  fg: string;
};

export type IconKey =
  | "groups" | "description" | "inventory" | "bar" | "layers" | "edit" | "photo"
  | "search" | "filter" | "tag" | "sync" | "route" | "health" | "ads" | "target"
  | "brain" | "template" | "globe" | "bolt" | "cookie" | "verified";

export type HubApp = {
  key: string;
  href: string;
  name: string;
  line: string;
  /** Accent, used for the icon tile and the chevron. */
  from: string;
  to: string;
  wash: string;
  icon: "store" | "globe" | "campaign" | "trend" | "hub";
  subs: SubApp[];
};

const BLUE = { tint: "#e6edfd", fg: "#3461c9" };
const GREEN = { tint: "#e7f6ee", fg: "#1b7a55" };
const PINK = { tint: "#fde8f1", fg: "#b63a76" };
const PURPLE = { tint: "#efe8fd", fg: "#6a46c9" };
const AMBER = { tint: "#fdf0e3", fg: "#a96a12" };
const TEAL = { tint: "#e3f5f1", fg: "#13866a" };

export const APPS: HubApp[] = [
  {
    key: "datatracker",
    href: "/datatracker",
    name: "Datatracker",
    line: "Live data, customer insight and stock information.",
    from: "#5b8def", to: "#3461c9", wash: "rgba(91,141,239,.10)", icon: "store",
    subs: [
      { name: "Customers", note: "Search and view customer data", href: "/datatracker", icon: "groups", ...BLUE },
      { name: "Articles", note: "Product and part information", href: "/datatracker#articles", icon: "description", ...GREEN },
      { name: "Availability", note: "Stock levels and supply", href: "/datatracker#availability", icon: "inventory", ...AMBER },
      { name: "MOQ", note: "Minimum order quantities that stalled a sale", href: "/datatracker#moq", icon: "tag", ...PURPLE },
      { name: "Price checks", note: "Priced, not ordered", href: "/uc/price-checks", icon: "tag", ...PINK },
    ],
  },
  {
    key: "website",
    href: "/website/overview",
    name: "Website & Intelligence",
    line: "Monitor performance and understand your audience.",
    from: "#2ec29a", to: "#13866a", wash: "rgba(46,194,154,.10)", icon: "globe",
    subs: [
      { name: "Overview", note: "Key website metrics", href: "/website/overview", icon: "bar", ...BLUE },
      { name: "Audience", note: "Visitor insights and segments", href: "/website/audience", icon: "groups", ...PINK },
      { name: "Pages", note: "Manage and analyse content", href: "/website/pages", icon: "layers", ...PURPLE },
      { name: "Acquisition", note: "Where the visits come from", href: "/website/acquisition", icon: "ads", ...AMBER },
      { name: "Tracking health", note: "Is the measurement sound", href: "/analytics/tracking", icon: "health", ...GREEN },
      { name: "Cookie consent", note: "What consent allows us to see", href: "/analytics/consent", icon: "cookie", ...TEAL },
      { name: "Live", note: "Who is on the site right now", href: "/live", icon: "bolt", ...BLUE },
      { name: "Web order sync", note: "Shop orders into HubSpot", href: "/analytics/web-orders", icon: "sync", ...PINK },
    ],
  },
  {
    key: "marketing",
    href: "/create",
    name: "Marketing & Content",
    line: "Create, manage and optimise our marketing content.",
    from: "#ef5fa0", to: "#c22c6e", wash: "rgba(239,95,160,.10)", icon: "campaign",
    subs: [
      { name: "Create Studio", note: "Design and create campaigns", href: "/create", icon: "edit", ...AMBER },
      { name: "Library", note: "Everything already written", href: "/library", icon: "photo", ...PURPLE },
      { name: "SEO", note: "Optimise and track performance", href: "/seo", icon: "search", ...TEAL },
      { name: "Templates", note: "Start from a known shape", href: "/templates", icon: "template", ...BLUE },
      { name: "Personality", note: "The brain every generator reads", href: "/personality", icon: "brain", ...PINK },
      { name: "GEO readiness", note: "How AI search sees us", href: "/geo", icon: "globe", ...GREEN },
      { name: "Quick wins", note: "Pages one step from ranking", href: "/seo/quick-wins", icon: "bolt", ...AMBER },
      { name: "Logs", note: "What the generators did", href: "/logs", icon: "description", ...PURPLE },
    ],
  },
  {
    key: "journey",
    href: "/journey",
    name: "Customer Journey & KPIs",
    line: "Understand the customer journey and drive performance.",
    from: "#9a7bf0", to: "#6a46c9", wash: "rgba(154,123,240,.10)", icon: "trend",
    subs: [
      { name: "Funnels", note: "Track conversion stages", href: "/journey/funnels", icon: "filter", ...PINK },
      { name: "KPIs", note: "Measure what matters", href: "/journey/kpis", icon: "bar", ...BLUE },
      { name: "Customers", note: "Journey insights and behaviour", href: "/customers", icon: "groups", ...GREEN },
      { name: "The journey", note: "The whole path, end to end", href: "/journey", icon: "route", ...PURPLE },
      { name: "Visitors", note: "Traffic beside the companies we know", href: "/customers/visitors", icon: "groups", ...TEAL },
      { name: "SMEC targets", note: "Where the targets stand", href: "/analytics/smec", icon: "target", ...AMBER },
      { name: "New customers", note: "Who arrived this period", href: "/analytics/new-customers", icon: "groups", ...PINK },
    ],
  },
  {
    key: "uc",
    // Erosion, not price checks: /uc/price-checks redirects into a Datatracker
    // tab, so landing there drops people into Datatracker's menu and the UC
    // apps never show. The tile has to open the UC app itself.
    href: "/uc/erosion",
    name: "UC & HubSpot Apps",
    line: "Communication, integration and sales tools.",
    from: "#f5a23c", to: "#c97a10", wash: "rgba(245,162,60,.10)", icon: "hub",
    subs: [
      { name: "Erosion", note: "Lapsed reorders, raised and expected", href: "/uc/erosion", icon: "target", ...AMBER },
      { name: "Price checks", note: "Check customer pricing", href: "/uc/price-checks", icon: "tag", ...BLUE },
      { name: "DoC", note: "Declarations of Conformity, emailed", href: "/uc/doc", icon: "verified", ...GREEN },
      { name: "September Push", note: "One-shot: September order intake push", href: "/uc/sept-push", icon: "target", ...PINK },
      { name: "Marc CH Push", note: "One-shot: reactivation batch 1", href: "/uc/marc-push", icon: "route", ...PURPLE },
      { name: "Nancy CH Push", note: "One-shot: reactivation batch 2", href: "/uc/nancy-push", icon: "route", ...TEAL },
      { name: "Articles CY/LY", note: "Every article, this year against last", href: "/uc/articles", icon: "bar", ...BLUE },
      { name: "Smart Segmentation", note: "Every company's sales priority", href: "/uc/segmentation", icon: "layers", ...GREEN },
    ],
  },
];

/** The hub's own. Not apps, but they have to be findable. */
export const HUB_TOOLS: SubApp[] = [
  { name: "Mission Control", note: "The week at a glance", href: "/mission-control", icon: "bar", ...BLUE },
  { name: "Live", note: "Who is on the site right now", href: "/live", icon: "bolt", ...GREEN },
  { name: "Settings", note: "Your account and the hub's", href: "/settings", icon: "filter", ...PURPLE },
  { name: "Integrations", note: "What is connected", href: "/settings/integrations", icon: "sync", ...AMBER },
  { name: "Your account", note: "Password, two-factor, your details", href: "/settings/you", icon: "groups", ...TEAL },
  { name: "People", note: "Who has an account", href: "/settings/people", icon: "groups", ...PINK },
  { name: "Audit", note: "Who did what", href: "/settings/audit", icon: "description", ...PINK },
  { name: "Docs", note: "How this works", href: "/docs", icon: "description", ...TEAL },
];

export type Hit = { name: string; note: string; href: string; app: string; icon: IconKey; tint: string; fg: string };

/** Everything searchable, flattened once. */
export const ALL: Hit[] = [
  ...APPS.flatMap((a) => [
    { name: a.name, note: a.line, href: a.href, app: a.name, icon: "layers" as IconKey, tint: a.wash, fg: a.to },
    ...a.subs.map((s) => ({ ...s, app: a.name })),
  ]),
  ...HUB_TOOLS.map((t) => ({ ...t, app: "The hub" })),
];

/** Name first, then the description — a title match is what people meant. */
export function search(q: string): Hit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const byName = ALL.filter((h) => h.name.toLowerCase().includes(needle));
  const byNote = ALL.filter((h) => !byName.includes(h) && (h.note.toLowerCase().includes(needle) || h.app.toLowerCase().includes(needle)));
  return [...byName, ...byNote].slice(0, 8);
}
