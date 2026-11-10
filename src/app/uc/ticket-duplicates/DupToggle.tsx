"use client";

// DUPLICATES & MERGES - the main toggle on top of both pages (SARCLA 10.11.2026: "company duplicates should go inside of
// duplicates and merges, a main toggle on top to toggle between tickets and companies"). Two addresses, one app: the
// companies live under /uc/ticket-duplicates/companies, so the side panel's entry and its grant cover both.

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import DomainOutlinedIcon from "@mui/icons-material/DomainOutlined";
import { HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";

const SIDES = [
  { key: "tickets", href: "/uc/ticket-duplicates", label: "Tickets", note: "Back Office: the same request twice, the same order", icon: <ConfirmationNumberOutlinedIcon /> },
  { key: "companies", href: "/uc/ticket-duplicates/companies", label: "Companies", note: "The same customer number, name and postcode, website", icon: <DomainOutlinedIcon /> },
] as const;

export function DupToggle({ on }: { on: "tickets" | "companies" }) {
  return (
    <Box role="tablist" aria-label="Tickets or companies" sx={{ display: "inline-grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5, p: 0.5, borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(21,34,58,.03)", width: { xs: "100%", md: "auto" }, minWidth: { md: 620 } }}>
      {SIDES.map((s) => {
        const active = s.key === on;
        return (
          <Box key={s.key} component={Link} href={s.href} role="tab" aria-selected={active}
            sx={{ display: "flex", gap: 1.25, alignItems: "center", px: 1.75, py: 1.1, borderRadius: "10px", textDecoration: "none", color: INK,
              bgcolor: active ? "#fff" : "transparent", boxShadow: active ? "0 1px 3px rgba(21,34,58,.12)" : "none", border: active ? `1px solid ${HAIRLINE}` : "1px solid transparent",
              transition: "background-color .15s", "&:hover": { bgcolor: active ? "#fff" : "rgba(21,34,58,.05)" } }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "10px", bgcolor: active ? TINT.purple.bg : "rgba(21,34,58,.06)", color: active ? TINT.purple.fg : MUTED, "& svg": { fontSize: 20 } }}>{s.icon}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: active ? INK : MUTED, lineHeight: 1.2 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.3 }}>{s.note}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
