"use client";

// DUPLICATES & MERGES > Contacts (SARCLA 10.11.2026: "shop accounts should also get out of [Associations] and be rebuilt
// here - a new toggle on top - so we have only one place to change and create new associations"). Three views:
// - Shop accounts: the shop accounts whose HubSpot contact has no company, each with the companies its orders are booked
//   on: pick, Link (ShopAccounts.tsx);
// - By e-mail domain: every contact without a company linked to its domain's company by the hub - the workflow "SARCLA |
//   UNASSIGNED CONTACTS -> COMPANIES" brought in (DomainLinks.tsx, the same evening);
// - Name letters: broken letters in names repaired - the workflow "SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE"
//   brought in ("this is a small tab on contact duplicate", NameLetters.tsx).
// The view is in the address (#shop-accounts, #domain, #names), so a link opens it. The views sit in the tab strip of
// Tickets and Companies (ReportTabs) - SARCLA 11.11.2026: "these tags are different from the other apps".

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { DupToggle } from "../DupToggle";
import { ShopAccountsTab } from "./ShopAccounts";
import { DomainLinks } from "./DomainLinks";
import { NameLetters } from "./NameLetters";

type View = "shop" | "domain" | "names";
const VIEWS: { key: View; label: string; subtitle: string }[] = [
  { key: "shop", label: "Shop accounts", subtitle: "Contacts: shop accounts whose contact has no company - linked by a click to the company their orders are booked on, their shop customer number names, or their e-mail domain" },
  { key: "domain", label: "By e-mail domain", subtitle: "Contacts: every contact without a company is linked to the company of its e-mail domain, when the rule finds exactly one" },
  { key: "names", label: "Name letters", subtitle: "Contacts: names with broken letters (MÃ¼ller for Müller) repaired - by the hub when the repair is sure, by a person otherwise" },
];
const TAB_HASH: Record<View, string> = { shop: "#shop-accounts", domain: "#domain", names: "#names" };

export default function ContactDuplicates() {
  const [view, setView] = useHashTab<View>(TAB_HASH, "shop");
  const cur = VIEWS.find((v) => v.key === view)!;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Duplicates & merges" subtitle={cur.subtitle} />
      <DupToggle on="contacts" />
      <Box>
        <ReportTabs name="contactdup" tab={view} onSelect={setView} tabs={VIEWS.map((v) => ({ id: v.key, label: v.label, count: null }))} />
      </Box>
      <Box id={`contactdup-panel-${view}`} role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        {view === "shop" && <ShopAccountsTab />}
        {view === "domain" && <DomainLinks />}
        {view === "names" && <NameLetters />}
      </Box>
    </Box>
  );
}
