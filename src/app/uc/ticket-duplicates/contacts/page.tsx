"use client";

// DUPLICATES & MERGES > Contacts (SARCLA 10.11.2026: "shop accounts should also get out of [Associations] and be rebuilt
// here - a new toggle on top - so we have only one place to change and create new associations"). The shop accounts
// whose HubSpot contact has no company, each with the companies its orders are booked on: pick, Link.

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { DupToggle } from "../DupToggle";
import { ShopAccountsTab } from "./ShopAccounts";

export default function ContactDuplicates() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Duplicates & merges"
        subtitle="Contacts: shop accounts whose contact has no company - linked to the company their orders are booked on, by a click" />
      <DupToggle on="contacts" />
      <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><ShopAccountsTab /></Box>
    </Box>
  );
}
