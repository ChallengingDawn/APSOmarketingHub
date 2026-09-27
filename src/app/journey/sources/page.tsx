"use client";

// WHERE THE DATA COMES FROM — the screen that stops this app being a mystery.
//
// Every number on the journey is read live from GA4, HubSpot or the shop. This
// screen names each source, says how current it is, and is honest about the
// measures nobody can supply yet.

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";

/** What fills the journey with numbers, and how current each source is. */
const LIVE_SOURCES: { area: string; source: string; what: string; freshness: string }[] = [
  { area: "Awareness", source: "GA4 (property 307036030)", what: "Sessions and users by channel, impressions of the brand in search", freshness: "Live, one day behind for finalised figures" },
  { area: "Awareness", source: "Google Ads via GA4", what: "Cost, clicks and return per linked Ads account", freshness: "Live, from the Ads-to-GA4 link" },
  { area: "Consideration", source: "GA4", what: "Homepage and product-page traffic, bounce, pages per session", freshness: "Live" },
  { area: "Validation", source: "HubSpot contacts", what: "Shop accounts created, and which of them ordered afterwards", freshness: "Live, recomputed twice a day" },
  { area: "Purchase", source: "HubSpot orders (404k records)", what: "Orders by company, and whether a company is new, active or reactivated", freshness: "Web orders within about a minute; ERP orders in batches" },
  { area: "Purchase", source: "GTM container GTM-TG6ZQ6G", what: "Which purchases reach Google Ads, and with which customer type", freshness: "Live" },
  { area: "Post-purchase", source: "HubSpot tickets", what: "Support contacts after an order", freshness: "Live" },
];

/** Measures the business asked for that nothing can answer yet. Better named than faked. */
const GAPS: { measure: string; why: string }[] = [
  { measure: "Per-person page history (which pages this contact read)", why: "Needs Marketing Hub Enterprise; the portal does not have it, so the events API refuses." },
  { measure: "Brand recognition, AI/LLM visibility", why: "Comes from Miriam's study and Aleksandra's competitor work, not from a system we can query." },
  { measure: "Stock availability at the moment a customer looked", why: "The shop reads stock from the ERP when the page renders and keeps no history of what was shown." },
  { measure: "Drop-off inside registration (started but not finished)", why: "The shop does not emit an event for an abandoned registration form." },
  { measure: "Reactivation attributed to a channel", why: "Needs the three bucket conversions in the Ads account; waiting on smec's labels." },
];

export default function JourneySourcesPage() {
  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Section>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.5 }}>The numbers: read live</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 2 }}>
          Nothing in this list is uploaded or typed. Each one is queried when the page loads, and the heavier counts are kept for
          twelve hours so the same figure does not cost the same work twice.
        </Typography>
        <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.8rem", verticalAlign: "top" } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: MUTED }}>Stage</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED }}>Source</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED }}>What it answers</TableCell>
              <TableCell sx={{ fontWeight: 600, color: MUTED }}>How current</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {LIVE_SOURCES.map((s, i) => (
              <TableRow key={i}>
                <TableCell sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap" }}>{s.area}</TableCell>
                <TableCell sx={{ color: INK }}>{s.source}</TableCell>
                <TableCell sx={{ color: MUTED }}>{s.what}</TableCell>
                <TableCell sx={{ color: MUTED }}>{s.freshness}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.5 }}>What nothing can answer yet</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 2 }}>
          The workbook asks for these. They are listed here rather than estimated, because a plausible number is worse than an
          admitted gap.
        </Typography>
        <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.8rem", verticalAlign: "top" } }}>
          <TableBody>
            {GAPS.map((g, i) => (
              <TableRow key={i}>
                <TableCell sx={{ color: INK, fontWeight: 600, width: "40%" }}>{g.measure}</TableCell>
                <TableCell sx={{ color: MUTED }}>{g.why}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </Box>
  );
}
