"use client";
// ESO DASHBOARD - SHOP BEHAVIOUR: logins and views of the reps' customers,
// how many of those who logged in bought, by customer category, and how often
// this year's buyers have ordered.

import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import RepeatIcon from "@mui/icons-material/Repeat";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { EsoPage, Gaps, MUTED, bodyCell, grid, headCell, n0, num, numHead, pct, perRep, ratio } from "../shared";

export default function ShopPage() {
  return (
    <EsoPage title="Shop behaviour" line="logins, views and orders">
      {({ rep, b, reps }) => {
        const s = rep.shop;
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<StorefrontIcon />} tint="blue" label="Companies that logged in" value={n0(s.loggedIn)} note={`Last year, whole: ${n0(s.loggedInPyFull)}`} />
              <KpiTile icon={<ShoppingCartCheckoutIcon />} tint="green" label="Logged in and bought" value={pct(ratio(s.loggedBought, s.loggedIn))} note={`${n0(s.loggedBought)} companies`} />
              <KpiTile icon={<StorefrontIcon />} tint="amber" label="Logged in, never viewed an article" value={n0(s.loggedNoView)} />
              <KpiTile icon={<RepeatIcon />} tint="purple" label="Buyers with 3+ orders ever" value={pct(ratio(s.orderHistory.more, s.orderHistory.one + s.orderHistory.two + s.orderHistory.more))} />
            </Box>
            <Box sx={grid(420)}>
              <GlassCard>
                <CardTitle icon={<StorefrontIcon />} tint="blue" title="Customers in the shop" note="This year to date; last year is the whole year - the Datatracker keeps one total per year" />
                <Table size="small">
                  <TableHead><TableRow><TableCell sx={headCell}></TableCell><TableCell sx={numHead}>This year</TableCell><TableCell sx={numHead}>Last year, whole</TableCell></TableRow></TableHead>
                  <TableBody>
                    {[["Companies that logged in", n0(s.loggedIn), n0(s.loggedInPyFull)], ["Logins", n0(s.logins), n0(s.loginsPyFull)], ["Views", n0(s.views), n0(s.viewsPyFull)]].map(([k, a, c]) => (
                      <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{a}</TableCell><TableCell sx={{ ...num, color: MUTED }}>{c}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </GlassCard>
              <GlassCard>
                <CardTitle icon={<RepeatIcon />} tint="purple" title="This year's buyers, by orders ever" note="One-shot, second order, or more" />
                <ChartFrame>
                  <ShareBar segments={[{ label: "One order (one-shot)", value: s.orderHistory.one }, { label: "Two orders", value: s.orderHistory.two }, { label: "Three or more", value: s.orderHistory.more }]} />
                </ChartFrame>
              </GlassCard>
            </Box>
            <Box sx={grid(420)}>
              <GlassCard>
                <CardTitle icon={<ShoppingCartCheckoutIcon />} tint="green" title="Conversion by customer category" note="Logged in this year, and of those, bought this year" />
                <ChartFrame><BarList rows={Object.entries(s.byCategory).map(([k, v]) => ({ label: k, value: v.loggedIn, secondary: `${pct(ratio(v.bought, v.loggedIn))} bought` })).sort((a, c) => (c.value ?? 0) - (a.value ?? 0))} /></ChartFrame>
              </GlassCard>
              <GlassCard>
                <CardTitle icon={<StorefrontIcon />} tint="blue" title="Per sales rep" note="Companies that logged in this year" />
                <ChartFrame><BarList rows={perRep(reps, (r) => r.shop.loggedIn, (r) => `${pct(ratio(r.shop.loggedBought, r.shop.loggedIn))} bought`)} /></ChartFrame>
              </GlassCard>
            </Box>
            <Gaps b={b} match={/Shop|carts|orders per customer/i} />
          </>
        );
      }}
    </EsoPage>
  );
}
