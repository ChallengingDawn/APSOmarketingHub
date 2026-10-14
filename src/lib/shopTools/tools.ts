// THE SHOP TOOLS - O-Ring Expert, shaft-seal expert, compatibility table, vulcanised O-rings - each on its own
// Railway gateway since 14.10.2026 (SARCLA: "a gateway service for each one", "one page per tool" in the hub under
// Website > Microservices). Moved from PricingHub unchanged; the shop frames /landing/tools/<page> from the
// gateway, and the gateway's admin API (the DirectUp Gateway's key) tells the hub how much it is used.

export type ShopToolKey = "oring" | "shaftseal" | "compat" | "vulcan";

export type ShopTool = {
  key: ShopToolKey;
  name: string;
  /** what it is, in one line, for the page header */
  what: string;
  /** /landing/tools/<page> on the gateway */
  page: string;
  /** the hub page */
  href: string;
  /** the Railway address, until somebody sets another in Settings */
  gateway: string;
  /** the CMS page on the shop it is meant for, when known (URL key after /<locale>/) */
  shopPath: string | null;
  /** what the gateway counts besides page opens */
  counts: { search?: string; detail?: string };
  /** the page reports what visitors search and click (GET /api/admin/events on its gateway) */
  events?: boolean;
};

export const SHOP_TOOLS: Record<ShopToolKey, ShopTool> = {
  oring: {
    key: "oring", name: "O-Ring Expert", page: "oring", href: "/website/oring-expert",
    what: "Find the O-ring for a groove, or by its size and material - with the ring in 3D",
    gateway: "https://o-ring-gateway-production.up.railway.app", shopPath: "service/oring-expert",
    counts: { search: "Searches", detail: "Rings opened or compared" },
  },
  shaftseal: {
    key: "shaftseal", name: "Shaft-seal expert", page: "shaftseal", href: "/website/shaft-seal-expert",
    what: "Radial shaft seals from the shaft, the bore and the width",
    gateway: "https://shaft-seal-gateway-production.up.railway.app", shopPath: null,
    counts: { search: "Searches" },
  },
  compat: {
    key: "compat", name: "Compatibility table", page: "compat", href: "/website/compatibility-table",
    what: "Which sealing material resists which chemical",
    gateway: "https://compat-gateway-production.up.railway.app", shopPath: null,
    counts: {}, events: true,
  },
  vulcan: {
    key: "vulcan", name: "Vulcanised O-rings", page: "vulcan", href: "/website/vulcanised-o-rings",
    what: "Any O-ring size, vulcanised from the round cord we stock",
    gateway: "https://vulcan-gateway-production.up.railway.app", shopPath: "vulcanised-o-rings",
    counts: {},
  },
};

export const isShopTool = (k: string): k is ShopToolKey => k in SHOP_TOOLS;

// what the gateway's admin API answers (shop-tools-gateway/src/admin.ts)
export type ToolStatus = { tool: ShopToolKey; name: string; version: string; url: string; uptimeS: number; data: { articles: number; built: string | null } | null };
export type ToolUsageRow = { day: string; kind: "page" | "search" | "detail"; shop: string; locale: string; n: number };
export type ToolUsage = { days: number; rows: ToolUsageRow[] };
export type ToolSnippet = { page: string; url: string; version: string; generatedAt: string };
/** What the page reported: search / nohit (a term, lower case), chemical / pin (a chemical), product ("<no> <name>"),
 *  material (a material code) - per day, label and shop. */
export type ToolEvents = { days: number; kinds: string[]; rows: { day: string; kind: string; label: string; shop: string; n: number }[] };
