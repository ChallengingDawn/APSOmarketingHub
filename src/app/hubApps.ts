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
  /** false = kept in the access tree (its grant holds) and reachable from the app's own pages, but not listed in the
   *  side panel - APSOconvert's Preview opens from a card (SARCLA 09.11.2026: "there is a lot of menu"). */
  menu?: false;
};

export type IconKey =
  | "groups" | "description" | "inventory" | "bar" | "layers" | "edit" | "photo"
  | "search" | "filter" | "tag" | "sync" | "route" | "health" | "ads" | "target"
  | "brain" | "template" | "globe" | "bolt" | "cookie" | "verified" | "upload" | "ring" | "shaft" | "science" | "loop" | "chat" | "tree" | "assign" | "copy" | "map"
  // the Back-Office Reports' pages, as their BUC View draws them (SARCLA 04.11.2026: "Team totals icon should be the same as in BUC View")
  | "category" | "assignment" | "shipping" | "block";

export type HubApp = {
  key: string;
  href: string;
  name: string;
  line: string;
  /** Accent, used for the icon tile and the chevron. */
  from: string;
  to: string;
  wash: string;
  icon: "store" | "globe" | "campaign" | "trend" | "hub" | "chart" | "cable" | "science";
  subs: SubApp[];
  /** Reached from its own square under the tiles, not a tile of its own (Connectors - SARCLA, 07.10.2026). */
  square?: boolean;
  /** What the launch pad's card lists when it is not the subs - Website: its sections, as Advanced reporting's are its categories. */
  cards?: SubApp[];
};

const BLUE = { tint: "#e6edfd", fg: "#3461c9" };
const GREEN = { tint: "#e7f6ee", fg: "#1b7a55" };
const PINK = { tint: "#fde8f1", fg: "#b63a76" };
const PURPLE = { tint: "#efe8fd", fg: "#6a46c9" };
const AMBER = { tint: "#fdf0e3", fg: "#a96a12" };
const TEAL = { tint: "#e3f5f1", fg: "#13866a" };

export type WebsiteSection = {
  slug: string;
  name: string;
  /** One line: what the section is for. */
  line: string;
  icon: IconKey;
  tint: string;
  fg: string;
  pages: Omit<SubApp, "group">[];
  /** Where the section's tile leads when not its first page - Content opens on its calendar (SARCLA 07.11.2026: "calendar should be the first app"). */
  entry?: string;
};

/**
 * WEBSITE, BY SECTION (SARCLA 03.11.2026: "on macro level website becomes a multiple app application like advanced
 * reports" - Health, Live, Microservices, Cookies & Legals, A/B testing, AI testing & personalization, Security; and
 * "black friday goes into campaigns"). The front page /website is a tile per section; inside one, the side panel lists
 * that section's pages alone and leads back to Website. The app's subs below are these pages, each under its section's
 * heading - what the access tree reads (src/lib/auth/tree.ts), so a page keeps its grant when it changes section.
 */
export const WEBSITE_SECTIONS: WebsiteSection[] = [
  {
    slug: "health", name: "Health", line: "Is the measurement sound", icon: "health", ...GREEN,
    // Web order sync is gone (SARCLA 03.11.2026: "not needed anymore - delete completely"): a count beside GA4, it moved nothing
    pages: [{ name: "Tracking health", note: "Is the measurement sound", href: "/analytics/tracking", icon: "health", ...GREEN }],
  },
  {
    slug: "live", name: "Live", line: "Who is on the site right now", icon: "bolt", ...BLUE,
    pages: [{ name: "Live", note: "Who is on the site right now", href: "/live", icon: "bolt", ...BLUE }],
  },
  {
    slug: "microservices", name: "Microservices", line: "The shop's tools and services, each on its own gateway", icon: "layers", ...PURPLE,
    pages: [
      // the shop's search bar, on its own Railway gateway; its dashboard moved here (SARCLA 16.10.2026), first of
      // the Microservices (SARCLA 17.10.2026)
      { name: "Search bar", note: "What customers search and find, the gaps, stock, brands, its views", href: "/website/search-bar", icon: "search", ...BLUE },
      // the Google Ads buyer buckets + live shop activity, their own service since 17.10.2026 (SARCLA: "a separate microservice")
      { name: "Google Ads buckets", note: "New, active or reactivated buyers for Google Ads; live shop activity", href: "/website/ads-buckets", icon: "ads", ...AMBER },
      // cut to size: the widget and its reservation ledger stay on Railway (the shop frames it, and the
      // middleware is the single reservation authority) - this page reads them (SARCLA 16.10.2026)
      { name: "DirectCut", note: "Cut to size: open work, the shelf, the machine feed", href: "/website/directcut", icon: "inventory", ...TEAL },
      // the shop chat: its dashboard moves here from the APSOAssistant dashboard, the chat itself unchanged (SARCLA 18.10.2026:
      // "start building under Website > Microservices just after DirectCut, without switching off the old one")
      { name: "APSOassistant Chat", note: "The shop chat and the search bar's AI: conversations, hand-overs to TSA and Back Office, the AI test bench", href: "/website/chat", icon: "chat", ...PURPLE },
      // services the shop's orders trigger, run by the hub (DoC moved here from UC, SARCLA 13.10.2026)
      { name: "DoC", note: "Declarations of Conformity, emailed", href: "/website/doc", icon: "verified", ...GREEN },
      { name: "3D files", note: "The 3D catalogue, its form and the tickets", href: "/website/3d", icon: "layers", ...BLUE },
      // the order tool the shop frames, on its own Railway gateway (SARCLA 13.10.2026)
      { name: "DirectUP", note: "Order files into the cart: usage, lists, log, installation", href: "/website/directup", icon: "upload", ...PINK },
      // the shop tools, each on its own gateway since 14.10.2026 (SARCLA: "one page per tool")
      { name: "O-Ring Expert", note: "O-rings by groove or size, in 3D: use and installation", href: "/website/oring-expert", icon: "ring", ...PURPLE },
      { name: "Shaft-seal expert", note: "Radial shaft seals by shaft, bore and width", href: "/website/shaft-seal-expert", icon: "shaft", ...AMBER },
      { name: "Compatibility table", note: "Which material resists which chemical", href: "/website/compatibility-table", icon: "science", ...TEAL },
      { name: "Vulcanised O-rings", note: "Any O-ring size from stocked cord", href: "/website/vulcanised-o-rings", icon: "loop", ...BLUE },
    ],
  },
  {
    slug: "cookies-legals", name: "Cookies & Legals", line: "What consent allows us to see", icon: "cookie", ...TEAL,
    pages: [{ name: "Cookie consent", note: "What consent allows us to see", href: "/analytics/consent", icon: "cookie", ...TEAL }],
  },
  {
    // a stand-alone app (SARCLA 08.11.2026: "you should be able to visually display journeys, analyse the main journeys;
    // this should be a stand-alone app") - "Visitor" keeps it apart from the Customer Journey app (/journey)
    slug: "journeys", name: "Visitor journeys", line: "How visitors move through the shop, and where they are lost", icon: "route", ...BLUE,
    pages: [
      { name: "Main journeys", note: "How visitors move: where they come in, the pages after, the cart and the order - or where they leave", href: "/website/journeys", icon: "route", ...PURPLE },
      { name: "Funnel", note: "The shop's steps for the visits and the signed-in customers, and where most are lost", href: "/website/journeys/funnel", icon: "filter", ...PINK },
      { name: "Page flow", note: "One page: where its visitors came from and where they went next", href: "/website/journeys/page", icon: "tree", ...TEAL },
    ],
  },
  {
    slug: "ab-testing", name: "A/B testing", line: "What we test on the site, and what it shows", icon: "science", ...PINK,
    // the first one: the shop chat's e-mail before the chat, as APSOassistant Chat > A/B test has it (SARCLA 03.11.2026:
    // "contains a copy of the first A/B test on the chat, and then more")
    pages: [
      { name: "Chat: e-mail first", note: "E-mail before the chat or during it: do we lose chats, do we gain e-mails", href: "/website/ab-testing", icon: "chat", ...PINK },
      // APSOconvert's tests of shop pages (SARCLA 07.11.2026: the approved idea goes to "the A/B testing app")
      { name: "Page tests", note: "A version of a shop page against the page as it is: the add-to-carts decide", href: "/website/ab-testing/pages", icon: "science", ...PINK },
    ],
  },
  {
    slug: "ai-personalization", name: "AI testing & personalization", line: "Find what stops buyers, test the fix, ship the winner", icon: "brain", ...PURPLE,
    // APSOconvert, modelled on Webyn (SARCLA 07.11.2026: "let's start building this ... under /website/ai-personalization"):
    // the shop's pages on production and ACC, then the problems on them down to the customer; the ideas, the page code,
    // the A/B test and the Magento pages follow (src/lib/convert). ONE app with ONE menu, in the order of the work, as Webyn
    // tells it (insight, recommendations, the version, the test, personalisation) - SARCLA 08.11.2026: "then it changes
    // to other menu, it's really not correct ... look at Webyn even menu speaking": the page tests and a page's flow are
    // also served inside this app (Tests, Journeys - the same pages as A/B testing's and Visitor journeys').
    pages: [
      // 09.11.2026 (SARCLA: "navigation is really confusing, there is a lot of menu, and the preview is not
      // straightforward"; "merge Insights and Problem pages"): four entries in the side panel - Tests with Always on and
      // Winners beneath it; Preview opens from an optimization's card; the others keep their address and their grant.
      { name: "Performance", note: "What the tests did, and the whole loop from the problem to the winner", href: "/website/ai-personalization", icon: "bar", ...PURPLE },
      { name: "Insights", note: "What the AI proposes to change, by type of content, and the pages losing buyers it reads", href: "/website/ai-personalization/insights", icon: "bolt", ...PURPLE },
      { name: "Journeys", note: "Where visitors come from and go next, the funnel, the click map and each customer's visits", href: "/website/ai-personalization/journeys", icon: "route", ...BLUE },
      { name: "Tests", note: "A version against the page as it is: the add-to-carts decide", href: "/website/ai-personalization/tests", icon: "science", ...PINK },
      { name: "Preview", note: "An optimization on its page, before and after, its versions; sent to Content from here", href: "/website/ai-personalization/preview", icon: "edit", ...PURPLE, menu: false },
      { name: "Problem pages", note: "Part of Insights since 09.11.2026", href: "/website/ai-personalization/problems", icon: "target", ...PINK, menu: false },
      { name: "Always on", note: "An audience always gets a version: signed-in customers, a store view, phones", href: "/website/ai-personalization/personalise", icon: "groups", ...GREEN, menu: false },
      { name: "Winners", note: "The versions that won their test - handed to Content to be published", href: "/website/ai-personalization/ship", icon: "shipping", ...TEAL, menu: false },
      { name: "Pages", note: "Every page of the shop, on production and on ACC", href: "/website/ai-personalization/pages", icon: "layers", ...BLUE, menu: false },
    ],
  },
  { slug: "security", name: "Security", line: "The site's security", icon: "verified", ...BLUE, pages: [] },
  {
    slug: "campaigns", name: "Campaigns", line: "Promotions on the shop", icon: "tag", ...AMBER,
    // the 2026 promotion: each company's own single-use code and rate, handed out by the Ads Gateway after login
    // (SARCLA 03.11.2026: "deploy on website subapp")
    pages: [{ name: "Black Friday", note: "Each company's own code and rate, 16.11-06.12.2026: who got one, who used it", href: "/website/black-friday", icon: "tag", ...AMBER }],
  },
];

export const websiteSectionBySlug = (slug: string) => WEBSITE_SECTIONS.find((s) => s.slug === slug) ?? null;

/**
 * UC & HUBSPOT APPS, BY SECTION (SARCLA 06.11.2026: "transform the HubSpot app into a website look-alike, where each main
 * topic is a main app and then drill down" - UC's, HubSpot Apps, One-shot actions). As Website: the front page /uc is a
 * tile per section; inside one, the side panel lists that section's pages alone and leads back to UC & HubSpot Apps.
 * The app's subs are these pages, each under its section's heading - what the access tree reads (src/lib/auth/tree.ts);
 * a grant is on a page's address, so every page kept its grant when the sections came.
 */
export const UC_SECTIONS: WebsiteSection[] = [
  {
    slug: "use-cases", name: "UC's", line: "The lifecycle use cases: who each one reached, and what came of it", icon: "route", ...PURPLE,
    // the lifecycle use cases, reported (they run as HubSpot workflows); UC16 and UC17 numbered after them (13.10.2026).
    // Never price checks first: /uc/price-checks redirects into a Datatracker tab.
    pages: [
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
    ],
  },
  {
    slug: "hubspot-apps", name: "HubSpot Apps", line: "The HubSpot workflows the hub runs: owners, tickets, distribution, certificates", icon: "assign", ...TEAL,
    // Map assignment first (19.10.2026); each "SARCLA | ..." workflow the hub took over, side by side before it switched
    pages: [
      { name: "Map assignment", note: "Who owns each company, per country: SAE or postcode zones on a map, owner redirections; contacts follow", href: "/uc/map-assignment", icon: "map", ...TEAL },
      { name: "Smart Segmentation", note: "Every company's sales priority", href: "/uc/segmentation", icon: "layers", ...GREEN },
      { name: "Wrong owners", note: "Tickets back to the team that owns them", href: "/uc/wrong-owners", icon: "groups", ...PINK },
      { name: "Holiday redirection", note: "Tickets of people away go to their deputy", href: "/uc/holiday-redirection", icon: "route", ...BLUE },
      { name: "Personas", note: "Each contact's persona from its job and its company - shadow first, side by side with the PERSONAS SET workflow", href: "/uc/personas", icon: "brain", ...PURPLE },
      { name: "Associations", note: "Tickets linked to the orders and articles they name, contacts to their company; order alerts", href: "/uc/ticket-associations", icon: "loop", ...BLUE },
      { name: "Stock to partners", note: "Every morning at 07:00 a partner's articles with our stock, MOQ and status", href: "/uc/partner-stock", icon: "inventory", ...GREEN },
      { name: "Smart sub-tickets", note: "Sub-tickets from a ticket, prefilled; GQS needs Margin % and Target price", href: "/uc/smart-tickets", icon: "tree", ...PURPLE },
      { name: "Back Office distribution", note: "Who gets each new Back Office and GQS ticket - shadow mode, side by side with the workflows", href: "/uc/bo-distribution", icon: "assign", ...TEAL },
      { name: "Duplicates & merges", note: "The same request twice, another ticket on the same order - flagged on the ticket, merged by a click", href: "/uc/ticket-duplicates", icon: "copy", ...PURPLE },
      { name: "Certificates", note: "The Back Office's certificate requests: AVOR, the Back Office, the conformity experts - reminders and hand-overs", href: "/uc/certificates", icon: "verified", ...GREEN },
      { name: "Ticket value", note: "Each ticket's sales potential - shadow mode, side by side with the TICKET VALUE CALCULATION workflow", href: "/uc/ticket-value", icon: "tag", ...AMBER },
    ],
  },
  {
    // the Railway translator brought into the hub (SARCLA 08.11.2026: "kill Railway and bring all to the hub"), a main app of
    // its own since 09.11.2026 (SARCLA: "this should come back on the level of UC's as a main app - more graphs as KPIs, much
    // more by tabs, and the sub apps on the side panel")
    slug: "apso-translator", name: "APSO Translator", line: "Customers' chats and e-mails in English for the agent, replies in their language", icon: "globe", ...BLUE,
    // each figure page its own entry (SARCLA 10.11.2026: "put the tabs over time, languages and so forth as mini apps on
    // the side bar") - they were tabs of one Overview
    pages: [
      { name: "Over time", note: "What was translated, day by day: customer messages and the agents' ! notes", href: "/uc/translator", icon: "bar", ...BLUE },
      { name: "Coverage", note: "Of the customer messages in another language, how many got their translation", href: "/uc/translator/coverage", icon: "verified", ...GREEN },
      { name: "Languages", note: "The languages customers write in, and the replies sent in theirs", href: "/uc/translator/languages", icon: "globe", ...BLUE },
      { name: "Inboxes & channels", note: "Where the translated messages came in: the HubSpot inbox, chat or e-mail", href: "/uc/translator/inboxes", icon: "layers", ...TEAL },
      { name: "Agents", note: "Who asked for a translation with !", href: "/uc/translator/agents", icon: "groups", ...PINK },
      { name: "When customers write", note: "The hour and the weekday of the messages translated", href: "/uc/translator/hours", icon: "route", ...AMBER },
      { name: "Speed & DeepL", note: "How long a message waited for its comment, and the characters sent to DeepL", href: "/uc/translator/speed", icon: "bolt", ...PURPLE },
      { name: "Conversations", note: "Every comment and reply it made, with the texts", href: "/uc/translator/conversations", icon: "chat", ...PURPLE },
      { name: "Settings & help", note: "Live or Preview, the inboxes it reads, replies with !, the agents' commands", href: "/uc/translator/settings", icon: "tag", ...AMBER },
    ],
  },
  {
    slug: "one-shot-actions", name: "One-shot actions", line: "Pushes with a start, an end and a fixed list of accounts", icon: "target", ...PINK,
    pages: [
      { name: "September Push", note: "One-shot: September order intake push", href: "/uc/sept-push", icon: "target", ...PINK },
      { name: "Marc CH Push", note: "One-shot: reactivation batch 1", href: "/uc/marc-push", icon: "route", ...PURPLE },
      { name: "Nancy CH Push", note: "One-shot: reactivation batch 2", href: "/uc/nancy-push", icon: "route", ...TEAL },
    ],
  },
];
export const ucSectionBySlug = (slug: string) => UC_SECTIONS.find((s) => s.slug === slug) ?? null;

/**
 * MARKETING & CONTENT, BY SECTION (SARCLA 07.11.2026: "let's start to split it like website or UC by main categories" -
 * Content, SEO, SEA, GEO, AEO and LLM Optimizer). As Website and UC & HubSpot Apps: the front page /marketing is a tile per
 * section; inside one, the side panel lists that section's pages alone and leads back to Marketing & Content (the
 * panel's rows are in Sidebar.tsx, MARKETING_NAV). The app's subs are these pages, each under its section's heading -
 * what the access tree reads (src/lib/auth/tree.ts); a grant is on a page's address, so every page kept its grant.
 * A section's pages here are exactly the app's subs before the split: listing more would give a page its own node, and
 * the grant it inherits from its heading could differ from the one it had through its parent's address.
 */
export const MARKETING_SECTIONS: WebsiteSection[] = [
  {
    slug: "content", name: "Content", line: "What we make, together: the calendar, the projects, who does what", icon: "edit", ...PINK,
    // the calendar first (SARCLA 07.11.2026: "calendar should be the first app"): a page of Projects, so the Projects grant
    entry: "/projects/calendar",
    pages: [
      // Projects first: it is the door, and the studio is where you go FROM a project
      { name: "Projects", note: "What we are working on, and every version of it", href: "/projects", icon: "template", ...PINK },
      { name: "Personality", note: "The brain every generator reads", href: "/personality", icon: "brain", ...PINK },
      { name: "Create Studio", note: "Design and create campaigns", href: "/create", icon: "edit", ...AMBER },
      { name: "Content Library", note: "Everything already written", href: "/library", icon: "photo", ...PURPLE },
      { name: "Templates", note: "Start from a known shape", href: "/templates", icon: "template", ...BLUE },
    ],
  },
  {
    slug: "seo", name: "SEO", line: "Google Search: where we rank, and what to work on next", icon: "search", ...TEAL,
    pages: [
      { name: "SEO", note: "What to work on next, worth most first", href: "/seo", icon: "search", ...TEAL },
      { name: "Quick wins", note: "Pages one step from ranking", href: "/seo/quick-wins", icon: "bolt", ...AMBER },
      { name: "Did it work", note: "What happened after the work was done", href: "/seo/impact", icon: "health", ...GREEN },
    ],
  },
  // paid search; empty until its first page (the Google Ads buyer buckets are a Website microservice and stay there)
  { slug: "sea", name: "SEA", line: "Paid search: our Google Ads campaigns", icon: "ads", ...AMBER, pages: [] },
  {
    slug: "geo", name: "GEO", line: "How AI search engines read our pages, and what to fix", icon: "globe", ...GREEN,
    pages: [{ name: "GEO readiness", note: "How AI search sees us", href: "/geo", icon: "globe", ...GREEN }],
  },
  {
    slug: "aeo", name: "AEO & LLM Optimizer", line: "What AI assistants answer about us, and how to be named more often", icon: "brain", ...PURPLE,
    // HubSpot's AEO prompts and every answer the assistants gave (SARCLA 17.10: "a complete sub-app after GEO")
    pages: [{ name: "AI answers (AEO)", note: "What AI assistants say about us", href: "/aeo", icon: "brain", ...PURPLE }],
  },
];
export const marketingSectionBySlug = (slug: string) => MARKETING_SECTIONS.find((s) => s.slug === slug) ?? null;

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
    href: "/website",
    name: "Website",
    line: "The site: who is on it, whether we measure it right, its tools, tests and campaigns. Its reports are in Advanced reporting.",
    from: "#2ec29a", to: "#13866a", wash: "rgba(46,194,154,.10)", icon: "globe",
    subs: WEBSITE_SECTIONS.flatMap((x) => x.pages.map((p) => ({ ...p, group: x.name }))),
    cards: WEBSITE_SECTIONS.map((x) => ({ name: x.name, note: x.line, href: `/website/${x.slug}`, icon: x.icon, tint: x.tint, fg: x.fg })),
  },
  {
    key: "marketing",
    // its front page: a tile per section (MARKETING_SECTIONS, 07.11.2026) - a page only this app owns
    href: "/marketing",
    name: "Marketing & Content",
    line: "Create, manage and optimise our marketing content.",
    from: "#ef5fa0", to: "#c22c6e", wash: "rgba(239,95,160,.10)", icon: "campaign",
    subs: MARKETING_SECTIONS.flatMap((x) => x.pages.map((p) => ({ ...p, group: x.name }))),
    cards: MARKETING_SECTIONS.map((x) => ({ name: x.name, note: x.line, href: `/marketing/${x.slug}`, icon: x.icon, tint: x.tint, fg: x.fg })),
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
      // its own tile (SARCLA 20.10.2026), renamed and at the bottom (01.11.2026); its team's targets first (02.11.2026)
      { name: "Sales Leader Reports", note: "Your team's targets and graphs", href: "/reporting/sales-leader", icon: "verified", ...PURPLE },
      // each salesperson's own (SARCLA 01.11.2026)
      { name: "My Sales Reports", note: "Your targets and figures", href: "/reporting/my-sales", icon: "target", ...AMBER },
    ],
  },
  {
    key: "uc",
    // its front page: a tile per section (UC_SECTIONS, 06.11.2026) - a page only this app owns, never one another
    // section lists (the Use Cases Overview is also in Digital Growth's "Other reports"; price checks redirect into
    // Datatracker): a tile that lands on a borrowed page hands its panel to the other app
    href: "/uc",
    name: "UC & HubSpot Apps",
    line: "Communication, integration and sales tools.",
    from: "#f5a23c", to: "#c97a10", wash: "rgba(245,162,60,.10)", icon: "hub",
    subs: UC_SECTIONS.flatMap((x) => x.pages.map((p) => ({ ...p, group: x.name }))),
    cards: UC_SECTIONS.map((x) => ({ name: x.name, note: x.line, href: `/uc/${x.slug}`, icon: x.icon, tint: x.tint, fg: x.fg })),
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
  { name: "Action plan", note: "Every action toward 30 M€ by 2031, on a Gantt", href: "/action-plan", icon: "target", ...BLUE },
  { name: "Live", note: "Who is on the site right now", href: "/live", icon: "bolt", ...GREEN },
  { name: "Settings", note: "Your account and the hub's", href: "/settings", icon: "filter", ...PURPLE },
  { name: "Integrations", note: "What is connected", href: "/settings/integrations", icon: "sync", ...AMBER },
  { name: "Your account", note: "Password, two-factor, your details", href: "/settings/you", icon: "groups", ...TEAL },
  { name: "People", note: "Who has an account", href: "/settings/people", icon: "groups", ...PINK },
  { name: "Hierarchy", note: "Who reports to whom, and in which unit", href: "/settings/hierarchy", icon: "groups", ...PURPLE },
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
