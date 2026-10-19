// THE APPS, AND EVERYTHING INSIDE THEM.
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
  /** A part of the app the entry belongs to (Connectors & Integration: one per connector). */
  group?: string;
  /** The label on a chip, when the name is spelled out for the search. */
  short?: string;
};

export type IconKey =
  | "groups" | "description" | "inventory" | "bar" | "layers" | "edit" | "photo"
  | "search" | "filter" | "tag" | "sync" | "route" | "health" | "ads" | "target"
  | "brain" | "template" | "globe" | "bolt" | "cookie" | "verified" | "upload" | "ring" | "shaft" | "science" | "loop" | "chat" | "tree" | "assign" | "copy" | "map";

export type HubApp = {
  key: string;
  href: string;
  name: string;
  line: string;
  /** Accent, used for the icon tile and the chevron. */
  from: string;
  to: string;
  wash: string;
  icon: "store" | "globe" | "campaign" | "trend" | "hub" | "chart" | "cable";
  subs: SubApp[];
  /** Reached from its own square under the tiles, not a tile of its own (Connectors - SARCLA, 07.10.2026). */
  square?: boolean;
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
    href: "/live",
    name: "Website",
    line: "Who is on the site now, and whether we measure it right. Its reports are in Advanced reporting.",
    from: "#2ec29a", to: "#13866a", wash: "rgba(46,194,154,.10)", icon: "globe",
    subs: [
      { name: "Live", note: "Who is on the site right now", href: "/live", icon: "bolt", ...BLUE },
      { name: "Tracking health", note: "Is the measurement sound", href: "/analytics/tracking", icon: "health", ...GREEN },
      { name: "Cookie consent", note: "What consent allows us to see", href: "/analytics/consent", icon: "cookie", ...TEAL },
      { name: "Web order sync", note: "Shop orders into HubSpot", href: "/analytics/web-orders", icon: "sync", ...PINK },
      // the shop's search bar, on its own Railway gateway; its dashboard moved here (SARCLA 16.10.2026), first of
      // the Microservices (SARCLA 17.10.2026)
      { group: "Microservices", name: "Search bar", note: "What customers search and find, the gaps, stock, brands, its views", href: "/website/search-bar", icon: "search", ...BLUE },
      // the Google Ads buyer buckets + live shop activity, their own service since 17.10.2026 (SARCLA: "a separate microservice")
      { group: "Microservices", name: "Google Ads buckets", note: "New, active or reactivated buyers for Google Ads; live shop activity", href: "/website/ads-buckets", icon: "ads", ...AMBER },
      // cut to size: the widget and its reservation ledger stay on Railway (the shop frames it, and the
      // middleware is the single reservation authority) - this page reads them (SARCLA 16.10.2026)
      { group: "Microservices", name: "DirectCut", note: "Cut to size: open work, the shelf, the machine feed", href: "/website/directcut", icon: "inventory", ...TEAL },
      // the shop chat: its dashboard moves here from the APSOAssistant dashboard, the chat itself unchanged (SARCLA 18.10.2026:
      // "start building under Website > Microservices just after DirectCut, without switching off the old one")
      { group: "Microservices", name: "APSOassistant Chat", note: "The shop chat and the search bar's AI: conversations, hand-overs to TSA and Back Office, the AI test bench", href: "/website/chat", icon: "chat", ...PURPLE },
      // services the shop's orders trigger, run by the hub (DoC moved here from UC, SARCLA 13.10.2026)
      { group: "Microservices", name: "DoC", note: "Declarations of Conformity, emailed", href: "/website/doc", icon: "verified", ...GREEN },
      { group: "Microservices", name: "3D files", note: "The 3D catalogue, its form and the tickets", href: "/website/3d", icon: "layers", ...BLUE },
      // the order tool the shop frames, on its own Railway gateway (SARCLA 13.10.2026)
      { group: "Microservices", name: "DirectUP", note: "Order files into the cart: usage, lists, log, installation", href: "/website/directup", icon: "upload", ...PINK },
      // the shop tools, each on its own gateway since 14.10.2026 (SARCLA: "one page per tool")
      { group: "Microservices", name: "O-Ring Expert", note: "O-rings by groove or size, in 3D: use and installation", href: "/website/oring-expert", icon: "ring", ...PURPLE },
      { group: "Microservices", name: "Shaft-seal expert", note: "Radial shaft seals by shaft, bore and width", href: "/website/shaft-seal-expert", icon: "shaft", ...AMBER },
      { group: "Microservices", name: "Compatibility table", note: "Which material resists which chemical", href: "/website/compatibility-table", icon: "science", ...TEAL },
      { group: "Microservices", name: "Vulcanised O-rings", note: "Any O-ring size from stocked cord", href: "/website/vulcanised-o-rings", icon: "loop", ...BLUE },
    ],
  },
  {
    key: "marketing",
    // Projects is the door. Work here starts as "we need a landing page for
    // DirectCut in Italian", not as an empty studio with a blinking cursor.
    href: "/projects",
    name: "Marketing & Content",
    line: "Create, manage and optimise our marketing content.",
    from: "#ef5fa0", to: "#c22c6e", wash: "rgba(239,95,160,.10)", icon: "campaign",
    subs: [
      // Content first, in the order somebody works in: the brain, the studio
      // that reads it, what came out, and the shapes to start from.
      { name: "Projects", note: "What we are working on, and every version of it", href: "/projects", icon: "template", ...PINK },
      { name: "Personality", note: "The brain every generator reads", href: "/personality", icon: "brain", ...PINK },
      { name: "Create Studio", note: "Design and create campaigns", href: "/create", icon: "edit", ...AMBER },
      { name: "Content Library", note: "Everything already written", href: "/library", icon: "photo", ...PURPLE },
      { name: "Templates", note: "Start from a known shape", href: "/templates", icon: "template", ...BLUE },
      { name: "SEO", note: "What to work on next, worth most first", href: "/seo", icon: "search", ...TEAL },
      { name: "Quick wins", note: "Pages one step from ranking", href: "/seo/quick-wins", icon: "bolt", ...AMBER },
      { name: "Did it work", note: "What happened after the work was done", href: "/seo/impact", icon: "health", ...GREEN },
      { name: "GEO readiness", note: "How AI search sees us", href: "/geo", icon: "globe", ...GREEN },
      // HubSpot's AEO prompts and every answer the assistants gave (SARCLA 17.10: "a complete sub-app after GEO")
      { name: "AI answers (AEO)", note: "What AI assistants say about us", href: "/aeo", icon: "brain", ...PURPLE },
    ],
  },
  {
    key: "journey",
    href: "/journey",
    name: "Customer Journey",
    line: "Understand the customer journey and drive performance.",
    from: "#9a7bf0", to: "#6a46c9", wash: "rgba(154,123,240,.10)", icon: "trend",
    subs: [
      { name: "Funnels", note: "Track conversion stages", href: "/journey/funnels", icon: "filter", ...PINK },
      { name: "Customers", note: "Journey insights and behaviour", href: "/customers", icon: "groups", ...GREEN },
      { name: "The journey", note: "The whole path, end to end", href: "/journey", icon: "route", ...PURPLE },
      { name: "Visitors", note: "Traffic beside the companies we know", href: "/customers/visitors", icon: "groups", ...TEAL },
    ],
  },
  {
    // Every report in the hub, by team (SARCLA, 11.10.2026) - the categories
    // come from src/lib/reporting/categories.ts, the one list.
    key: "reporting",
    href: "/reporting",
    name: "Advanced reporting",
    line: "Every report in the hub, by team.",
    from: "#4aa3df", to: "#1f6fa8", wash: "rgba(74,163,223,.10)", icon: "chart",
    subs: [
      { name: "Digital Growth Reports", note: "Targets and where they stand", href: "/reporting/marketing", icon: "target", ...AMBER },
      { name: "ESO Reports", note: "The ESO benchmark per sales rep", href: "/reporting/eso", icon: "bar", ...PURPLE },
      { name: "TSA Reports", note: "Tickets, calls, response times", href: "/reporting/tsa", icon: "route", ...TEAL },
      { name: "Back-Office Reports", note: "What comes in, how fast it goes", href: "/reporting/back-office", icon: "layers", ...PINK },
      { name: "Website Reports", note: "How the site is found and used", href: "/reporting/website", icon: "globe", ...BLUE },
      { name: "OTD Reports", note: "On-time delivery", href: "/reporting/otd", icon: "sync", ...BLUE },
      { name: "Satisfaction Reports", note: "What customers say", href: "/reporting/satisfaction", icon: "health", ...GREEN },
      { name: "Customer Reports", note: "KPIs, new and buying customers", href: "/reporting/customers", icon: "groups", ...GREEN },
      // Articles CY/LY, moved from UC & HubSpot Apps (SARCLA, 16.10.2026)
      { name: "Products Reports", note: "Articles, this year against last", href: "/reporting/products", icon: "inventory", ...TEAL },
    ],
  },
  {
    key: "uc",
    // The Use Cases Overview, the UC app's first page (SARCLA 15.10: "the first
    // page should be the overview"). Never price checks: /uc/price-checks
    // redirects into a Datatracker tab, so landing there drops people into
    // Datatracker's menu and the UC apps never show.
    href: "/uc/lifecycle",
    name: "UC & HubSpot Apps",
    line: "Communication, integration and sales tools.",
    from: "#f5a23c", to: "#c97a10", wash: "rgba(245,162,60,.10)", icon: "hub",
    subs: [
      // the lifecycle use cases, reported (they run as HubSpot workflows)
      { name: "Use Cases Overview", short: "Overview", note: "Every use case, and every company's lifecycle stage", href: "/uc/lifecycle", icon: "route", ...PURPLE },
      { name: "UC2 Welcome", note: "New registrants, qualified and their first order", href: "/uc/lifecycle/welcome", icon: "groups", ...BLUE },
      { name: "UC15 Lost Leads", note: "Lost leads pushed to a first purchase", href: "/uc/lifecycle/lost-leads", icon: "target", ...PINK },
      { name: "UC6 Thank You", note: "First purchasers and their ratings", href: "/uc/lifecycle/thank-you", icon: "verified", ...GREEN },
      { name: "UC9 Second Purchase", note: "New customers pushed to a second order", href: "/uc/lifecycle/second-purchase", icon: "sync", ...AMBER },
      { name: "UC10+11 Repeat Purchase", note: "Grow / Nurture to Loyalty / Retain", href: "/uc/lifecycle/repeat-purchase", icon: "layers", ...TEAL },
      { name: "UC13 Reactivation", note: "Churned customers, and who came back", href: "/uc/lifecycle/reactivation", icon: "route", ...PURPLE },
      { name: "UC4 Abandoned Cart", note: "Carts left in the shop, and the orders after", href: "/uc/lifecycle/abandoned-cart", icon: "tag", ...BLUE },
      { name: "UC12 Revenue Drop", note: "Revenue drops flagged to the owner", href: "/uc/lifecycle/revenue-drop", icon: "bar", ...AMBER },
      { name: "UC16 Erosion", note: "Lapsed reorders, raised and expected", href: "/uc/erosion", icon: "target", ...AMBER },
      { name: "UC17 Price checks", note: "Check customer pricing", href: "/uc/price-checks", icon: "tag", ...BLUE },
      // who owns a company, per country: Performis SAE or postcode zones on a map - first of the HubSpot apps (SARCLA 19.10.2026)
      { name: "Map assignment", note: "Who owns each company, per country: SAE or postcode zones on a map; contacts follow", href: "/uc/map-assignment", icon: "map", ...TEAL },
      { name: "Smart Segmentation", note: "Every company's sales priority", href: "/uc/segmentation", icon: "layers", ...GREEN },
      { name: "Wrong owners", note: "Tickets back to the team that owns them", href: "/uc/wrong-owners", icon: "groups", ...PINK },
      { name: "Holiday redirection", note: "Tickets of people away go to their deputy", href: "/uc/holiday-redirection", icon: "route", ...BLUE },
      { name: "Owner redirection", note: "Companies to the right owner, by country or person", href: "/uc/owner-redirection", icon: "groups", ...GREEN },
      { name: "Ticket/order/article associations", note: "Tickets linked to the orders and articles they name; order alerts", href: "/uc/ticket-associations", icon: "loop", ...BLUE },
      { name: "Stock to partners", note: "Every morning at 07:00 a partner's articles with our stock, MOQ and status", href: "/uc/partner-stock", icon: "inventory", ...GREEN },
      { name: "Back Office distribution", note: "Who gets each new Back Office and GQS ticket - shadow mode, side by side with the workflows", href: "/uc/bo-distribution", icon: "assign", ...TEAL },
      { name: "Duplicates & merges", note: "Back Office tickets about the same order - shadow mode, side by side with the DUPS workflow", href: "/uc/ticket-duplicates", icon: "copy", ...PURPLE },
      { name: "Smart sub-tickets", note: "Sub-tickets from a ticket, prefilled; GQS needs Margin % and Target price", href: "/uc/smart-tickets", icon: "tree", ...PURPLE },
      { name: "September Push", note: "One-shot: September order intake push", href: "/uc/sept-push", icon: "target", ...PINK },
      { name: "Marc CH Push", note: "One-shot: reactivation batch 1", href: "/uc/marc-push", icon: "route", ...PURPLE },
      { name: "Nancy CH Push", note: "One-shot: reactivation batch 2", href: "/uc/nancy-push", icon: "route", ...TEAL },
    ],
  },
  {
    key: "connectors",
    href: "/connectors",
    name: "Connectors & Integration",
    line: "Where the data comes from, and what each connection writes.",
    from: "#2fb3a5", to: "#13866a", wash: "rgba(47,179,165,.10)", icon: "cable",
    square: true,
    subs: [
      // one group per connector, the same five pages each (SARCLA, 11.10.2026)
      { group: "Compass connector", name: "Compass sync", short: "Overview", note: "Is the ERP's data flowing", href: "/connectors", icon: "health", ...TEAL },
      { group: "Compass connector", name: "The chain", note: "What the hub does with each ERP delivery", href: "/connectors/compass", icon: "sync", ...BLUE },
      { group: "Compass connector", name: "Files & runs", note: "What the ERP delivered", href: "/connectors/files", icon: "description", ...GREEN },
      { group: "Compass connector", name: "What the Compass sync writes", short: "What it writes", note: "Every property and association", href: "/connectors/writes", icon: "layers", ...PURPLE },
      { group: "Compass connector", name: "ERP review queue", short: "Review queue", note: "ERP customers with no company", href: "/connectors/review", icon: "groups", ...AMBER },
      { group: "Magento connector", name: "Shop orders", short: "Overview", note: "Are the shop's web orders flowing into HubSpot", href: "/connectors/magento", icon: "health", ...PINK },
      { group: "Magento connector", name: "Shop order list", short: "Orders", note: "Every web order the hub has read", href: "/connectors/magento/orders", icon: "tag", ...PINK },
      { group: "Magento connector", name: "Shop sweeps", short: "Sweeps", note: "The minute-by-minute look at the shop", href: "/connectors/magento/sweeps", icon: "sync", ...BLUE },
      { group: "Magento connector", name: "What the shop sync writes", short: "What it writes", note: "Every order property and link, and its shop field", href: "/connectors/magento/writes", icon: "layers", ...PURPLE },
      { group: "Magento connector", name: "Shop review queue", short: "Review queue", note: "Orders held back or missing their contact", href: "/connectors/magento/review", icon: "groups", ...AMBER },
      { group: "Magento connector", name: "Web orders' ERP numbers", short: "ERP numbers", note: "Each web order's A-number, asked of the shop", href: "/connectors/magento/erp-numbers", icon: "tag", ...AMBER },
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
