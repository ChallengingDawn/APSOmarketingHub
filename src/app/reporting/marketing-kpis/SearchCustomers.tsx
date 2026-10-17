"use client";
// CUSTOMERS FROM SEARCH (SARCLA 17.10: "it would be interesting to see new / reactivated /
// active customers for SEO and SEA") - on Reach. GA4 tells which channel each web order
// came in through; the hub matches the order number to the HubSpot order and its company
// (onlineShare.ts classifySearchCustomers, read with the online share in online.ts).

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";

import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import type { ChannelCounts, ChannelKey, OnlineCube } from "@/lib/marketingKpis/onlineShare";
import { MONTHS, useSlow } from "./data";

const int = (n: number) => Math.round(n).toLocaleString("en");
const ROWS: { key: ChannelKey; name: string; what: string }[] = [
  { key: "organic", name: "SEO", what: "organic search" },
  { key: "paid", name: "SEA", what: "paid search (Google Ads)" },
];
const COLS: { key: keyof ChannelCounts; name: string; tip: string }[] = [
  { key: "new", name: "New customers", tip: "Companies whose first order ever came in through this channel" },
  { key: "react", name: "Reactivated", tip: "Companies that ordered through this channel after 12 months or more without an order" },
  { key: "active", name: "Active customers", tip: "Companies with at least one order through this channel" },
];

export function SearchCustomersCard() {
  const onl = useSlow<OnlineCube>("/api/reporting/marketing-kpis/online", "online");
  const v = onl.value;
  const sc = v?.searchCustomers;
  const year = v?.years[0] ?? new Date().getUTCFullYear();
  const months = sc && sc.upTo > 0 ? `${MONTHS[0]}–${MONTHS[sc.upTo - 1]}` : "";
  return (
    <GlassCard sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <CardTitle icon={<GroupAddOutlinedIcon />} tint="green" title="Customers from search"
        note={sc ? `${months} ${year} against ${months} ${year - 1} · companies whose web orders came in through organic or paid search` : "New, reactivated and active companies from SEO and SEA"} />
      {!v ? (
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          {!onl.error && <CircularProgress size={16} />}
          <Typography sx={{ fontSize: "0.84rem", color: onl.error ? RED : MUTED }}>
            {onl.error ? `Could not read the orders: ${onl.error}` : `Reading the orders and GA4${onl.progress ? ` - ${onl.progress}` : ""}. About 7 minutes the first time.`}
          </Typography>
        </Box>
      ) : !sc ? (
        <Typography sx={{ fontSize: "0.84rem", color: v.searchCustomersError ? RED : MUTED }}>
          {v.searchCustomersError ? `GA4 could not be read: ${v.searchCustomersError}` : "Reading the orders again with GA4…"}
        </Typography>
      ) : sc.upTo === 0 ? (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>The first month of the year is not complete yet.</Typography>
      ) : (
        <>
          <Box sx={{ overflowX: "auto" }}>
            <Box role="table" aria-label="Customers from search" sx={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.2fr) repeat(3, minmax(130px, 1fr))", columnGap: 2, rowGap: 1, alignItems: "center", minWidth: 560 }}>
              <Box />
              {COLS.map((c) => <Typography key={c.key} title={c.tip} sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>{c.name}</Typography>)}
              {ROWS.map((r) => (
                <Box key={r.key} role="row" sx={{ display: "contents" }}>
                  <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: INK }}>{r.name}</Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.what}</Typography>
                  </Box>
                  {COLS.map((c) => {
                    const cur = sc.cy[r.key][c.key], prev = sc.py[r.key][c.key];
                    const ch = prev ? (cur - prev) / prev : null;
                    return (
                      <Box key={c.key} role="cell" sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1, textAlign: "right" }}>
                        <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{int(cur)}</Typography>
                        <Typography sx={{ fontSize: "0.74rem", color: FAINT, fontVariantNumeric: "tabular-nums" }}>
                          {year - 1}: {int(prev)}
                          {ch != null && <Box component="span" sx={{ ml: 0.75, fontWeight: 700, color: Math.abs(ch) < 0.0005 ? FAINT : ch > 0 ? GREEN : RED }}>{ch > 0 ? "+" : "−"}{Math.abs(ch * 100).toFixed(1)}%</Box>}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.76rem", color: FAINT, lineHeight: 1.5 }}>
            Only the web orders GA4 saw - visitors who accepted statistics cookies - so these are a floor: GA4 saw {int(sc.coverage.ga4)} of {int(sc.coverage.webOrders)} web orders this year
            {sc.coverage.webOrders ? ` (${((100 * sc.coverage.ga4) / sc.coverage.webOrders).toFixed(0)}%)` : ""}, and {int(sc.coverage.matched)} of them matched an order and its company.
            The channel is the one of the visit the order came in (GA4&apos;s last click). New = first order ever; reactivated = after 12 months or more without one.
          </Typography>
        </>
      )}
    </GlassCard>
  );
}
