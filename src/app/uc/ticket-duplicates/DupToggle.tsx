"use client";

// DUPLICATES & MERGES - the main toggle on top of every page (SARCLA 10.11.2026: "company duplicates should go inside of
// duplicates and merges, a main toggle on top to toggle between tickets and companies"; then the shop accounts without a
// company moved in from Associations as Contacts; then "use full width on the header and per topic put the number of
// duplicates still to go through" and Performis as a topic of its own - "where is the logic on company from Performis?").
// One app at four addresses under /uc/ticket-duplicates, so the side panel's entry and its grant cover all four.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import DomainOutlinedIcon from "@mui/icons-material/DomainOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import DriveFileRenameOutlineOutlinedIcon from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import type { DupCounts } from "@/app/api/uc/ticket-duplicates/counts/route";

const SIDES = [
  { key: "tickets", href: "/uc/ticket-duplicates", label: "Tickets", note: "Back Office: the same request twice, the same order", left: "open", icon: <ConfirmationNumberOutlinedIcon /> },
  { key: "companies", href: "/uc/ticket-duplicates/companies", label: "Companies", note: "The same customer number, name and postcode, website; the country", left: "to decide", icon: <DomainOutlinedIcon /> },
  { key: "contacts", href: "/uc/ticket-duplicates/contacts", label: "Contacts", note: "Shop accounts without a company, linked by a click", left: "without a company", icon: <PersonOutlineOutlinedIcon /> },
  { key: "performis", href: "/uc/ticket-duplicates/performis", label: "Performis", note: "One company, several customer numbers: the new titles", left: "companies to rename", icon: <DriveFileRenameOutlineOutlinedIcon /> },
] as const;
export type Side = (typeof SIDES)[number]["key"];

/** What each topic still has to go through, for the toggle. */
const TITLE: Record<Side, string> = {
  tickets: "Back Office tickets flagged as a duplicate in the last 30 days and still open",
  companies: "Groups of companies waiting for a decision: the same customer number, and the possible duplicates",
  contacts: "Shop accounts whose contact still has no company",
  performis: "Companies with two customer numbers or more in one Mandant - each account gets its new title",
};

export function DupToggle({ on }: { on: Side }) {
  const held = useHeld<DupCounts>("/api/uc/ticket-duplicates/counts", []);
  const counts = held.result?.state === "ok" ? held.result.data : null;
  return (
    <Box role="tablist" aria-label="Tickets, companies, contacts or Performis" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 0.5, p: 0.5, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(21,34,58,.03)", width: "100%" }}>
      {SIDES.map((s) => {
        const active = s.key === on;
        const n = counts ? counts[s.key] : null;
        return (
          <Box key={s.key} component={Link} href={s.href} role="tab" aria-selected={active} title={TITLE[s.key]}
            sx={{ display: "flex", gap: 1.25, alignItems: "center", px: 1.75, py: 1.1, borderRadius: "10px", textDecoration: "none", color: INK, minWidth: 0,
              bgcolor: active ? "#fff" : "transparent", boxShadow: active ? "0 1px 3px rgba(21,34,58,.12)" : "none", border: active ? `1px solid ${HAIRLINE}` : "1px solid transparent",
              transition: "background-color .15s", "&:hover": { bgcolor: active ? "#fff" : "rgba(21,34,58,.05)" } }}>
            <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, width: 34, height: 34, borderRadius: "10px", bgcolor: active ? TINT.purple.bg : "rgba(21,34,58,.06)", color: active ? TINT.purple.fg : MUTED, "& svg": { fontSize: 20 } }}>{s.icon}</Box>
            <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: active ? INK : MUTED, lineHeight: 1.2 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{s.note}</Typography>
            </Box>
            {/* what is still to go through on this topic */}
            <Box sx={{ flexShrink: 0, textAlign: "right", pl: 0.5 }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 800, lineHeight: 1.1, color: n ? (active ? TINT.purple.fg : INK) : MUTED, fontVariantNumeric: "tabular-nums" }}>{n === null || n === undefined ? "…" : full(n)}</Typography>
              <Typography sx={{ fontSize: "0.68rem", color: MUTED, whiteSpace: "nowrap" }}>{s.left}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
