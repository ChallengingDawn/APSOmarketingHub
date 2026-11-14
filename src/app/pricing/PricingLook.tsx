"use client";
// PRICING IN THE HUB'S LOOK (SARCLA 14.11.2026: "design is nothing alike the platform yet").
//
// The PricingHub's pages drew white boxes with grey hairline borders, square corners and red buttons - its own look, set
// inline on almost every card and table. Rather than touch each of them, this one wrapper gives everything inside Pricing
// the hub's: the frosted cards of the other apps (22 px corners, white glass, a soft shadow, no grey border), the table
// heads every report has (small, uppercase, quiet), rounder controls with no capital letters. `!important` because the
// pages set their borders inline; scoped to this wrapper, so nothing outside Pricing moves.

import Box from "@mui/material/Box";

const INK = "#15223a";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.08)";

export default function PricingLook({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      color: INK,
      "& .MuiCard-root": {
        borderRadius: "20px !important",
        border: "1px solid rgba(255,255,255,.85) !important",
        backgroundColor: "rgba(255,255,255,.80) !important",
        boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07) !important",
      },
      // a card's own table needs no frame of its own; a table on the page gets the card's
      "& .MuiCard-root .MuiTableContainer-root": { border: "0 !important", borderRadius: "0 !important" },
      "& .MuiTableContainer-root": {
        borderColor: `${HAIRLINE} !important`, borderRadius: "16px !important", backgroundColor: "rgba(255,255,255,.72)",
      },
      "& .MuiTableHead-root .MuiTableCell-root": {
        color: `${FAINT} !important`, fontSize: "0.68rem !important", fontWeight: "600 !important",
        textTransform: "uppercase", letterSpacing: "0.05em",
      },
      "& .MuiTableCell-root": { borderColor: `${HAIRLINE} !important` },
      "& .MuiTableBody-root .MuiTableRow-root:hover": { backgroundColor: "rgba(36,89,209,.035)" },
      "& .MuiButton-root": { textTransform: "none", borderRadius: "11px", fontWeight: 600, boxShadow: "none" },
      "& .MuiButton-contained:hover": { boxShadow: "0 6px 16px rgba(31,45,78,.14)" },
      "& .MuiChip-root": { borderRadius: "8px" },
      "& .MuiOutlinedInput-root": { borderRadius: "11px", backgroundColor: "rgba(255,255,255,.85)" },
      "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
      "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
    }}>
      {children}
    </Box>
  );
}
