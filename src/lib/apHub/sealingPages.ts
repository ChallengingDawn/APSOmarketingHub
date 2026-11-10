// The Sealing Business Review pages, in the order the side panel lists them.
// One entry per page: its slug (the shared client component switches on it),
// its name as shown, and its route. Keep the paths: the side panel links to them.

export type SealingSlug = "overview" | "units" | "customers" | "articles" | "materials" | "approvals";

export const SEALING_PAGES: { slug: SealingSlug; name: string; href: string }[] = [
  { slug: "overview", name: "Overview", href: "/ap/reporting/sealing" },
  { slug: "units", name: "Business units", href: "/ap/reporting/sealing/units" },
  { slug: "customers", name: "Customers", href: "/ap/reporting/sealing/customers" },
  { slug: "articles", name: "Articles", href: "/ap/reporting/sealing/articles" },
  { slug: "materials", name: "Materials", href: "/ap/reporting/sealing/materials" },
  { slug: "approvals", name: "Approvals", href: "/ap/reporting/sealing/approvals" },
];
