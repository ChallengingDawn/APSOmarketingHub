// The Sealing Business Review pages, in the order the side panel lists them: the pilot's own views first, in its
// order and under its names (Overview, Customers, Articles, Materials & compounds, Approval information - SARCLA
// 11.11.2026: "we should find his structure"), then the hub's own page (Business units). One entry per page: its slug
// (the shared client component switches on it), its name as shown, and its route. Keep the paths: the side panel
// links to them.

export type SealingSlug = "overview" | "units" | "customers" | "articles" | "materials" | "approvals";

export const SEALING_PAGES: { slug: SealingSlug; name: string; href: string }[] = [
  { slug: "overview", name: "Overview", href: "/ap/reporting/sealing" },
  { slug: "customers", name: "Customers", href: "/ap/reporting/sealing/customers" },
  { slug: "articles", name: "Articles", href: "/ap/reporting/sealing/articles" },
  { slug: "materials", name: "Materials & compounds", href: "/ap/reporting/sealing/materials" },
  { slug: "approvals", name: "Approval information", href: "/ap/reporting/sealing/approvals" },
  { slug: "units", name: "Business units", href: "/ap/reporting/sealing/units" },
];
