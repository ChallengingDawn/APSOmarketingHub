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
import { EngineCard } from "../EngineCard";
import { full } from "@/app/charts/format";

type View = "shop" | "domain" | "names" | "settings";
const VIEWS: { key: View; label: string; subtitle: string }[] = [
  { key: "shop", label: "Shop accounts", subtitle: "Contacts: shop accounts whose contact has no company - linked by a click to the company their orders are booked on, their shop customer number names, or their e-mail domain" },
  { key: "domain", label: "By e-mail domain", subtitle: "Contacts: every contact without a company is linked to the company of its e-mail domain, when the rule finds exactly one" },
  { key: "names", label: "Name letters", subtitle: "Contacts: names with broken letters (MÃ¼ller for Müller) repaired - by the hub when the repair is sure, by a person otherwise" },
  { key: "settings", label: "Settings", subtitle: "Contacts: how the hub's two contact jobs run - By e-mail domain and Name letters" },
];
const TAB_HASH: Record<View, string> = { shop: "#shop-accounts", domain: "#domain", names: "#names", settings: "#settings" };
const n = (v: unknown) => full(Number(v ?? 0));

/** Contacts > Settings: the two engines' "How it runs", as Tickets and Companies have theirs. */
function ContactSettings() {
  return (
    <>
      <EngineCard api="/api/uc/contact-link" title="By e-mail domain" tint="purple" workflow="SARCLA | UNASSIGNED CONTACTS -> COMPANIES" every="Every 15 minutes, up to 250 contacts a run"
        look={{ title: "Look for contacts without a company", on: "Every contact without a company is matched with the companies of its e-mail domain and listed under By e-mail domain.", off: "Off: nothing is looked at." }}
        live={{ title: "Live - link by itself", on: "Each contact the rule is sure of is linked to its company, read again first.", shadow: "Shadow: listed under “It would link”, nothing linked.",
          ask: "Switch By e-mail domain LIVE?\n\nEvery 15 minutes the hub links up to 250 contacts without a company to the company of their e-mail domain (the only one on the domain, or the one of their country's Mandant). Each contact is read again first." }}
        lastLine={(l) => `${n(l.total)} without a company, ${n(l.toLink)} to link, ${n(l.written)} linked`} />
      <EngineCard api="/api/uc/contact-names" title="Name letters" tint="pink" workflow="SARCLA | CONTACT NAME | UTF-8 CORRECT BY CODE" every="Every 15 minutes, up to 500 names a run"
        look={{ title: "Read HubSpot's list of broken names", on: "The contacts on HubSpot's list 5943 are read and each name checked.", off: "Off: nothing is read." }}
        live={{ title: "Live - repair by itself", on: "A name the repair is sure of is written, read again first; the others wait for a person under Name letters.", shadow: "Shadow: the repairs are listed, nothing written.",
          ask: "Switch Name letters LIVE?\n\nEvery 15 minutes the hub writes the names it can repair for sure (MÃ¼ller -> Müller), each contact read again first." }}
        lastLine={(l) => `${n(l.listed)} on the list, ${n(l.sure)} sure, ${n(l.check)} for a person, ${n(l.written)} written`} />
    </>
  );
}

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
        {view === "settings" && <ContactSettings />}
      </Box>
    </Box>
  );
}
