// OTD Reports' pages - one list for the menu (./categories.ts), the API's guard and the pages themselves.

export type OtdSlug = "overview" | "suppliers" | "products" | "orders" | "lead" | "compare";
export const OTD_PAGES: { slug: OtdSlug; name: string; href: string; title: string; icon: "bar" | "assign" | "inventory" | "category" | "route" | "verified" }[] = [
  { slug: "overview", name: "Overview", href: "/reporting/otd", title: "OTD - on-time delivery", icon: "bar" },
  { slug: "suppliers", name: "Suppliers", href: "/reporting/otd/suppliers", title: "OTD per supplier", icon: "assign" },
  { slug: "products", name: "Products", href: "/reporting/otd/products", title: "OTD per product", icon: "inventory" },
  { slug: "orders", name: "Orders & date changes", href: "/reporting/otd/orders", title: "What makes an order late", icon: "category" },
  { slug: "lead", name: "Lead & transport time", href: "/reporting/otd/lead", title: "Lead time and transport time", icon: "route" },
  { slug: "compare", name: "File vs hub", href: "/reporting/otd/compare", title: "How OTD is counted", icon: "verified" },
];
