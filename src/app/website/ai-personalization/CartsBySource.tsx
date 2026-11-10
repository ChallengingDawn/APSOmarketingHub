"use client";

// The add-to-carts the shop's gateway counted, by where they were made - the search bar, the chat, the pages' own
// buttons (SARCLA 10.11.2026: "count also the search bar interaction since maybe they don't go to the product any more
// and put in the cart via the search or the chat"). Shown on Journeys > Click map and on Main journeys.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { CartsFrom } from "@/lib/convert/clicks";

const day = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** The add-to-carts the shop counted, by where - the search bar, the chat, the pages' own buttons. */
export function CartsBySource({ carts, compact }: { carts: CartsFrom | null | undefined; compact?: boolean }) {
  if (carts === undefined) return <LoadingPanel label="Reading the add-to-carts from the shop's gateway…" />;
  if (carts === null) return <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>The shop&apos;s gateway does not say where the add-to-carts were made yet.</Typography>;
  const all = carts.search + carts.chat + carts.page;
  const cells = [
    { k: "Search bar", v: carts.search, note: "put in the cart from the search's results" },
    { k: "Chat", v: carts.chat, note: "from a link the chat gave" },
    { k: "The pages' buttons", v: carts.page, note: "the product page's or a list's own button" },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(3, minmax(0,1fr))" } }}>
        {cells.map((c) => (
          <Box key={c.k} sx={{ p: compact ? 1.1 : 1.5, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>{c.k}</Typography>
            <Typography sx={{ fontSize: compact ? "1.2rem" : "1.5rem", fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
              {full(c.v)}<Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED, fontWeight: 600, ml: 0.75 }}>{all ? `${Math.round((c.v / all) * 100)}%` : ""}</Typography>
            </Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{c.note}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
        Counted by the shop itself, {day(carts.from)} - {day(carts.to)}, visitors with statistics consent; it counts where since 10.11.2026.
      </Typography>
    </Box>
  );
}
