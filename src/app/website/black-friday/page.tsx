"use client";

// BLACK FRIDAY 2026 - Website > Black Friday (SARCLA 03.11.2026: "deploy on website subapp"; 16.11-06.12.2026,
// new customers 20 % only when sure, Bronze 10 %, Silver / Gold / Platinum 5 %, every code used once). The shop's
// Black Friday page asks the Ads Gateway after login and gets its company's own code; this page works the controls
// there (on/off, dates, rate per group, Magento's generated codes per rate) and reads from HubSpot who holds a code
// and which web orders used one (src/lib/promo/blackFriday.ts). Same UC kit as the other Website pages.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GREEN, GlassCard, INK, KpiTile, MUTED, Notice, RED, bodyCell, eur, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { Chip } from "@/app/connectors/parts";
import { when } from "@/app/website/directup/shared";
import type { PromoEnv, PromoStatus } from "@/lib/promo/blackFriday";
import { GROUP_LABEL, GROUP_ORDER, NOT_SEEN, STATUS_LABEL, codesFromText, endAfter, lastDayOf, sourceLabel, wrongRate, zurichDay, zurichMidnight, type BfReport } from "@/lib/promo/report";

type Data = { status: PromoStatus; report: BfReport | null; reportError: string | null; testers: string[]; isAdmin: boolean };
type View = "overview" | "results" | "companies" | "codes" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", results: "#results", companies: "#companies", codes: "#codes", settings: "#settings" };
const pill = { borderRadius: "999px", textTransform: "none" as const, fontWeight: 600 };
const API = "/api/website/black-friday";
const CHUNK = 300;                                         // codes per call - the 8 KB request limit in front of the hub
const swiss = (iso: string) => new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;

async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, number> }> {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string; data?: Record<string, number> };
}

/** What the shop page was told, in words (the gateway's states). */
const ANSWERS: [string, string, string?][] = [
  ["ok", "A code handed out", GREEN],
  ["again", "The same code shown again"],
  ["pending", "Buyer not placed yet (new account or restart) - asked again"],
  ["soon", "Before the start"],
  ["ended", "After the end"],
  ["off", "Switched off"],
  ["sold_out", "No code left at that rate", RED],
  ["refused", "Refused (two different people, or not from the shop)"],
  ["none", "Group set to 0 %"],
  ["error", "HubSpot or the database did not answer", RED],
];

function PhaseLine({ s }: { s: PromoStatus }) {
  const dates = `${swiss(s.settings.start)} - ${lastDayOf(s.settings.end).split("-").reverse().join(".")}`;
  const text = s.phase === "off" ? `Switched off: the shop page shows the locked voucher and hands out no code (${dates}).`
    : s.phase === "soon" ? `Starts ${swiss(s.settings.start)}: until then the page shows the countdown and no code.`
    : s.phase === "live" ? `Live, ${dates}: signed-in customers get their company's code.`
    : `Ended (${dates}): no more codes are handed out.`;
  return s.phase === "off" ? <Notice tone="warn">{text}</Notice>
    : <Typography sx={{ fontSize: "0.86rem", color: s.phase === "live" ? GREEN : MUTED, fontWeight: 600 }}>{text}</Typography>;
}

function Overview({ d }: { d: Data }) {
  const s = d.status, r = d.report;
  const rates = [...new Set(Object.values(s.settings.discount).filter((x) => x > 0))].sort((a, b) => b - a);
  const stockOf = (rate: number) => s.stock?.find((x) => x.discount === rate) ?? null;
  const asked = Object.values(s.answers).reduce((x, y) => x + y, 0);
  return (
    <>
      <PhaseLine s={s} />
      {d.reportError && (
        <Notice tone="bad">
          {/bf26_/.test(d.reportError)
            ? "HubSpot has no Black Friday properties yet: create the company properties bf26_code (text), bf26_discount (number) and bf26_group (text) - the gateway writes each code there."
            : `HubSpot could not be read: ${d.reportError}`}
        </Notice>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LocalOfferOutlinedIcon />} tint="blue" label="Codes handed out" value={r ? full(r.totals.handedOut) : "-"} note="one per company" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Used on an order" value={r ? full(r.totals.used) : "-"} note={r ? `${full(r.totals.orders)} web orders` : ""} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="purple" label="Order value" value={r ? eur(r.totals.revenue) : "-"} note="order totals, each in its own currency" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="amber" label="Discount given" value={r ? eur(r.totals.discountGiven) : "-"} note="from the orders' discount" /></Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<LocalOfferOutlinedIcon />} tint="blue" title="By group" note="The group decides the rate: the price class in HubSpot, or New when the organisation never ordered" />
        <Table size="small">
          <TableHead><TableRow>
            {["Group", "Rate", "Handed out", "Used", "Orders", "Order value", "Discount given"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {(r?.groups ?? GROUP_ORDER.map((g) => ({ group: g, label: GROUP_LABEL[g], rate: s.settings.discount[g] ?? null, handedOut: 0, used: 0, orders: 0, revenue: 0, discountGiven: 0 }))).map((g) => (
              <TableRow key={g.group}>
                <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{g.label}</TableCell>
                {[`${s.settings.discount[g.group] ?? g.rate ?? 0} %`, full(g.handedOut), full(g.used), full(g.orders), eur(g.revenue), eur(g.discountGiven)].map((v, i) => (
                  <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%", display: "grid", gap: 1, alignContent: "start" }}>
            <CardTitle icon={<Inventory2OutlinedIcon />} tint="amber" title="Codes left per rate" note="Magento's generated codes, loaded on the Codes tab" />
            {s.stock_error && <Notice tone="bad">{s.stock_error}</Notice>}
            {rates.map((rate) => {
              const st = stockOf(rate);
              const low = !st || st.free < Math.max(20, st.loaded * 0.1);
              return (
                <Box key={rate} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600 }}>{rate} %</Typography>
                  <Typography sx={{ fontSize: "0.84rem", color: low ? RED : MUTED, fontVariantNumeric: "tabular-nums" }}>
                    {st ? `${full(st.free)} left of ${full(st.loaded)} · ${full(st.taken)} handed out` : "no codes loaded"}
                  </Typography>
                </Box>
              );
            })}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<ShoppingCartCheckoutOutlinedIcon />} tint="blue" title="What the shop page was told" note={`${full(asked)} asks since the gateway started ${when(s.since)}`} />
            <Table size="small"><TableBody>
              {ANSWERS.filter(([k]) => (s.answers[k] ?? 0) > 0 || ["ok", "again", "pending"].includes(k)).map(([k, label, colour]) => (
                <TableRow key={k}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED, pl: 0 }}>{label}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: colour ?? INK, textAlign: "right", pr: 0 }}>{full(s.answers[k] ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
            {s.last_error && <Notice tone="warn">Last error {when(s.last_error.at)}: {s.last_error.message}</Notice>}
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ display: "grid", gap: 1 }}>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="pink" title="Checks" note="A code used on another company's order, used twice, or a BLACKFRIDAY code the page never gave out - for Back Office before the order is confirmed" />
        {!r ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>Waiting for HubSpot.</Typography>
          : !r.checks.length ? <Typography sx={{ fontSize: "0.84rem", color: GREEN, fontWeight: 600 }}>Every code was used by the company it was given to.</Typography>
          : (
            <Table size="small">
              <TableHead><TableRow>{["Order", "Code", "Given to", "Problem", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {r.checks.map((c) => (
                  <TableRow key={`${c.orderId}-${c.code}`}>
                    <TableCell sx={bodyCell}>{c.name ?? c.orderId}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontFamily: "monospace" }}>{c.code}</TableCell>
                    <TableCell sx={bodyCell}>{c.holderId ? <a href={hsCompany(c.holderId)} target="_blank" rel="noreferrer">{c.holderName}</a> : c.holderName}</TableCell>
                    <TableCell sx={{ ...bodyCell, color: RED, fontWeight: 600 }}>
                      {c.reason === "other company" ? "used by another company" : c.reason === "used again" ? "used a second time" : "a BLACKFRIDAY code the page never gave out"}
                    </TableCell>
                    <TableCell sx={bodyCell}>{c.at ? when(c.at) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </GlassCard>
    </>
  );
}

/** The action's success: every web order that used a Black Friday code, by day, new customers against existing ones. */
function Results({ d }: { d: Data }) {
  if (!d.report) return <Notice tone="warn">{d.reportError ?? "Waiting for HubSpot."}</Notice>;
  const res = d.report.results;
  const n = res.split.new, e = res.split.existing;
  const all = n.orders + e.orders;
  const share = (x: number) => (all ? `${Math.round((x / all) * 100)} % of the orders` : "no orders yet");
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="blue" label="Orders with a code" value={full(all)} note={`${full(d.report.totals.used)} of ${full(d.report.totals.handedOut)} codes used`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LocalOfferOutlinedIcon />} tint="green" label="New customers won" value={full(res.newCompaniesWon)} note="never ordered before, ordered with their code" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="purple" label="Order value" value={eur(n.revenue + e.revenue)} note="order totals, each in its own currency" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SavingsOutlinedIcon />} tint="amber" label="Discount given" value={eur(n.discountGiven + e.discountGiven)} note="from the orders' discount" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<LocalOfferOutlinedIcon />} tint="green" title="New customers against existing ones" note="New = the code of an organisation with no order at all before it; existing = every price class" />
            <Table size="small">
              <TableHead><TableRow>{["", "Orders", "Share", "Order value", "Discount given"].map((h, i) => <TableCell key={h || "who"} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {([["New customers", n], ["Existing customers", e]] as const).map(([label, x]) => (
                  <TableRow key={label}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{label}</TableCell>
                    {[full(x.orders), share(x.orders), eur(x.revenue), eur(x.discountGiven)].map((v, i) => (
                      <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<ShoppingCartCheckoutOutlinedIcon />} tint="blue" title="By day" note="Swiss days" />
            {!res.byDay.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No order with a code yet.</Typography> : (
              <Table size="small">
                <TableHead><TableRow>{["Day", "Orders", "New", "Value"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {res.byDay.map((x) => (
                    <TableRow key={x.day}>
                      <TableCell sx={bodyCell}>{x.day.split("-").reverse().join(".")}</TableCell>
                      {[full(x.orders), full(x.newOrders), eur(x.revenue)].map((v, i) => <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<LocalOfferOutlinedIcon />} tint="purple" title="By customer status"
              note="The buyer when the code was given: never ordered, came back after over a year, or ordered within a year" />
            <Table size="small">
              <TableHead><TableRow>{["", "Orders", "Order value", "Discount given"].map((h, i) => <TableCell key={h || "who"} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {res.byStatus.filter((x) => x.status !== "existing" || x.orders > 0).map((x) => (
                  <TableRow key={x.status}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{x.label}</TableCell>
                    {[full(x.orders), eur(x.revenue), eur(x.discountGiven)].map((v, i) => (
                      <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" title="Sign-ups from this page"
              note={`${full(d.status.signups?.prod.total ?? 0)} accounts made through its Register now`} />
            {!(d.status.signups?.prod.by_day ?? []).length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>None yet.</Typography> : (
              <Table size="small"><TableBody>
                {(d.status.signups?.prod.by_day ?? []).map((x) => (
                  <TableRow key={x.day}>
                    <TableCell sx={bodyCell}>{x.day.split("-").reverse().join(".")}</TableCell>
                    <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.n)}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            )}
          </GlassCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TravelExploreOutlinedIcon />} tint="blue" title="Orders by source"
              note="The channel of the visit each order came in on (GA4, last click), found by the shop's order number" />
            {!res.bySource ? <Notice tone="warn">GA4 could not be read{res.sourcesError ? `: ${res.sourcesError}` : "."}</Notice>
              : !res.bySource.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No order with a code yet.</Typography> : (
              <Table size="small">
                <TableHead><TableRow>{["Source", "Orders", "New customers", "Order value", "Discount given"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {res.bySource.map((x) => (
                    <TableRow key={x.source}>
                      <TableCell sx={{ ...bodyCell, fontWeight: 600, color: x.source === NOT_SEEN ? MUTED : INK }}>{x.label}</TableCell>
                      {[full(x.orders), full(x.newOrders), eur(x.revenue), eur(x.discountGiven)].map((v, i) => (
                        <TableCell key={i} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <GlassCard sx={{ height: "100%" }}>
            <CardTitle icon={<TravelExploreOutlinedIcon />} tint="green" title="Visitors of the page by source"
              note={res.visitors ? `Visits that saw the Black Friday page, any language, ${res.visitors.from.split("-").reverse().join(".")} - ${res.visitors.to.split("-").reverse().join(".")}; only visitors who allowed statistics cookies` : "Visits that saw the Black Friday page"} />
            {!res.visitors ? <Notice tone="warn">GA4 could not be read{res.sourcesError ? `: ${res.sourcesError}` : "."}</Notice>
              : !res.visitors.bySource.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No visit yet.</Typography> : (
              <Table size="small">
                <TableHead><TableRow>{["Source", "Visits", "Share"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {res.visitors.bySource.map((x) => (
                    <TableRow key={x.source}>
                      <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK }}>{x.label}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.visits)}</TableCell>
                      <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{res.visitors!.visits ? `${Math.round((x.visits / res.visitors!.visits) * 100)} %` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="purple" title="The orders" note="Every web order Magento passed with a Black Friday code, newest first" />
        {!res.orders.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No order with a code yet.</Typography> : (
          <Table size="small">
            <TableHead><TableRow>{["When", "Order", "Company", "Group", "Source", "Code", "Value", "Discount"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i >= 6 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {res.orders.slice(0, 300).map((o) => (
                <TableRow key={`${o.orderId}-${o.code}`}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{o.at ? when(o.at) : "-"}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{o.name ?? o.orderId}</TableCell>
                  <TableCell sx={bodyCell}>{o.holderId ? <a href={hsCompany(o.holderId)} target="_blank" rel="noreferrer">{o.holderName}</a> : o.holderName}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: o.check ? RED : INK, fontWeight: o.check ? 600 : 400 }}>{o.check ? o.check : o.group ? GROUP_LABEL[o.group] ?? o.group : "-"}</TableCell>
                  <TableCell sx={{ ...bodyCell, color: o.source && o.source !== NOT_SEEN ? INK : FAINT }}>{!o.source ? "-" : o.source === NOT_SEEN ? "not seen by GA4" : sourceLabel(o.source)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontFamily: "monospace", whiteSpace: "nowrap" }}>{o.code}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.total != null ? eur(o.total) : "-"}</TableCell>
                  <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.discount != null ? eur(o.discount) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </>
  );
}

function Companies({ d }: { d: Data }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = d.report?.holders ?? [];
    return (t ? all.filter((h) => h.name.toLowerCase().includes(t) || h.code.toLowerCase().includes(t)) : all).slice(0, 300);
  }, [q, d.report]);
  if (!d.report) return <Notice tone="warn">{d.reportError ?? "Waiting for HubSpot."}</Notice>;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<LocalOfferOutlinedIcon />} tint="blue" title="Who holds a code" note={`${full(d.report.holders.length)} companies · the code is on the company in HubSpot (bf26_code)`}
        right={<TextField size="small" placeholder="Company or code" value={q} onChange={(e) => setQ(e.target.value)} />} />
      <Table size="small">
        <TableHead><TableRow>{["Company", "Group", "Rate", "Code", "Used"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((h) => (
            <TableRow key={h.code}>
              <TableCell sx={bodyCell}>{h.companyId ? <a href={hsCompany(h.companyId)} target="_blank" rel="noreferrer">{h.name}</a> : <span style={{ color: MUTED }}>{h.name}</span>}</TableCell>
              <TableCell sx={bodyCell}>{GROUP_LABEL[h.group] ?? h.group}</TableCell>
              <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{h.discount != null ? `${h.discount} %` : "-"}</TableCell>
              <TableCell sx={{ ...bodyCell, fontFamily: "monospace" }}>{h.code}</TableCell>
              <TableCell sx={bodyCell}>{h.uses.length ? h.uses.map((u) => `${u.name ?? u.orderId}${u.at ? ` (${when(u.at)})` : ""}`).join(", ") : <span style={{ color: FAINT }}>not yet</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {d.report.holders.length > rows.length && <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>First {rows.length} shown - search to narrow.</Typography>}
    </GlassCard>
  );
}

function LoadCodes({ rate, d, reload }: { rate: number; d: Data; reload: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = d.status.stock?.find((x) => x.discount === rate);
  const found = codesFromText(text);
  const load = async () => {
    if (!found.length) return;
    // BLACKFRIDAY10... belongs to the 10 % rule: never loaded under another rate
    const bad = wrongRate(found, rate, Object.values(d.status.settings.discount));
    if (bad.length) {
      setMsg({ ok: false, text: `${full(bad.length)} of these codes belong to another rate (e.g. ${bad[0]}) - load each file under its own rate.` });
      return;
    }
    if (!confirm(`Load ${full(found.length)} codes for ${rate} %? Use only codes Magento generated for the ${rate} % rule.`)) return;
    let added = 0, already = 0;
    setMsg(null);
    for (let i = 0; i < found.length; i += CHUNK) {
      setBusy(`${full(Math.min(i + CHUNK, found.length))} / ${full(found.length)}`);
      const r = await post({ action: "codes", discount: rate, codes: found.slice(i, i + CHUNK) });
      if (!r.ok) { setBusy(null); setMsg({ ok: false, text: `Stopped after ${full(added)} new codes: ${r.error ?? "did not work"}` }); reload(); return; }
      added += r.data?.added ?? 0; already += r.data?.already ?? 0;
    }
    setBusy(null); setText("");
    setMsg({ ok: true, text: `${full(added)} new codes loaded${already ? `, ${full(already)} were already there` : ""}.` });
    reload();
  };
  const readFile = (f: File | undefined) => { if (f) void f.text().then(setText); };
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<UploadFileOutlinedIcon />} tint="amber" title={`Codes for ${rate} %`}
        note={st ? `${full(st.free)} left of ${full(st.loaded)} loaded · ${full(st.taken)} handed out` : "None loaded yet"} />
      {d.isAdmin ? (
        <>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button component="label" size="small" variant="outlined" sx={pill}>
              Magento export (.csv)
              <input hidden type="file" accept=".csv,.txt" onChange={(e) => readFile(e.target.files?.[0])} />
            </Button>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>or paste the codes, one per line</Typography>
          </Box>
          <TextField multiline minRows={3} maxRows={8} size="small" value={text} onChange={(e) => setText(e.target.value)} placeholder="BF26-…" />
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="contained" sx={pill} disabled={!found.length || busy !== null} onClick={() => void load()}>
              {busy ? <><CircularProgress size={14} sx={{ mr: 1, color: "inherit" }} />{busy}</> : `Load ${full(found.length)} codes`}
            </Button>
            {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
          </Box>
        </>
      ) : <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Admins load codes.</Typography>}
    </GlassCard>
  );
}

function Codes({ d, reload }: { d: Data; reload: () => void }) {
  const rates = [...new Set(Object.values(d.status.settings.discount).filter((x) => x > 0))].sort((a, b) => b - a);
  return (
    <>
      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
        One Magento cart rule per rate - {rates.map((r) => `${r} %`).join(", ")} - each with auto-generated codes, Uses per Coupon 1, from {swiss(d.status.settings.start)}.
        Generate them in the rule, export the list, load it here. A code is never handed out at another rate than its own.
      </Typography>
      <Grid container spacing={2}>
        {rates.map((rate) => <Grid key={rate} size={{ xs: 12, md: 6, lg: 4 }}><LoadCodes rate={rate} d={d} reload={reload} /></Grid>)}
      </Grid>
    </>
  );
}

function Settings(props: { d: Data; env: PromoEnv; reload: () => void }) {
  // a gateway without the ACC shop would take ACC's settings as the live shop's: no form until it knows ACC
  if (props.env === "acc" && !props.d.status.acc) return <Notice tone="warn">The Ads Gateway does not know the ACC shop yet - it needs its next deploy.</Notice>;
  return <SettingsForm {...props} />;
}

function SettingsForm({ d, env, reload }: { d: Data; env: PromoEnv; reload: () => void }) {
  const s = env === "acc" && d.status.acc ? d.status.acc.settings : d.status.settings;
  const [on, setOn] = useState(s.on);
  const [from, setFrom] = useState(zurichDay(s.start));
  const [to, setTo] = useState(lastDayOf(s.end));
  const [rates, setRates] = useState<Record<string, string>>(Object.fromEntries(GROUP_ORDER.map((g) => [g, String(s.discount[g] ?? 0)])));
  const [testers, setTesters] = useState((d.testers ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    const where = env === "acc" ? "on the ACC shop" : "on the live shop";
    if (on !== s.on && !confirm(on ? `Switch it on ${where}? Signed-in customers then get their code between the start and the end.` : `Switch it off ${where}? The page then hands out no code; codes already given still work in Magento.`)) return;
    setBusy(true); setMsg(null);
    let body: Record<string, unknown>;
    try {
      body = { action: "settings", env, on, start: zurichMidnight(from), end: endAfter(to), discount: Object.fromEntries(Object.entries(rates).map(([g, v]) => [g, Number(v)])),
        ...(env === "prod" ? { testers: testers.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean) } : {}) };
    } catch (e) { setBusy(false); setMsg({ ok: false, text: String((e as Error).message) }); return; }
    const r = await post(body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const ro = !d.isAdmin;
  return (
    <GlassCard sx={{ display: "grid", gap: 1.75, maxWidth: 760 }}>
      <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title={env === "acc" ? "Settings - ACC shop" : "Settings - live shop"}
        note={s.set_at ? `Last saved ${when(s.set_at)}` : env === "acc" ? "Not saved yet - the ACC defaults below, switched on" : "Not saved yet - the defaults below, switched off"} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Switch checked={on} disabled={ro || busy} onChange={(e) => setOn(e.target.checked)} slotProps={{ input: { "aria-label": "Promotion on" } }} />
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: on ? GREEN : MUTED }}>{on ? "On" : "Off"}</Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField type="date" size="small" label="First day" value={from} disabled={ro} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" size="small" label="Last day" value={to} disabled={ro} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Typography sx={{ fontSize: "0.78rem", color: FAINT, alignSelf: "center" }}>Swiss time: from 00:00 on the first day to 24:00 on the last.</Typography>
      </Box>
      <Grid container spacing={1.5}>
        {GROUP_ORDER.map((g) => (
          <Grid key={g} size={{ xs: 6, sm: 4, md: 3 }}>
            <TextField size="small" type="number" label={GROUP_LABEL[g]} value={rates[g]} disabled={ro}
              onChange={(e) => setRates((x) => ({ ...x, [g]: e.target.value }))} slotProps={{ htmlInput: { min: 0, max: 50, step: 1 }, input: { endAdornment: <span style={{ color: MUTED }}>%</span> } }} />
          </Grid>
        ))}
      </Grid>
      {env === "prod" && (
        <TextField multiline minRows={2} maxRows={6} size="small" label="Test accounts (e-mail, one per line)" value={testers} disabled={ro}
          onChange={(e) => setTesters(e.target.value)} placeholder="name@company.ch"
          helperText="These shop accounts get their real code before the start, even while it is switched off - to try the page and the cart. Up to 20; nobody else sees a code before the first day." />
      )}
      {!ro && (
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
          <Button size="small" variant="contained" sx={pill} disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : "Save"}</Button>
          {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
        </Box>
      )}
    </GlassCard>
  );
}

/** The ACC shop (acc.apsoparts.com): any test account gets a TEST- code, kept on the gateway, never in HubSpot. */
function AccOverview({ d, reload }: { d: Data; reload: () => void }) {
  const acc = d.status.acc;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!acc) return <Notice tone="warn">The Ads Gateway does not know the ACC shop yet - it needs its next deploy.</Notice>;
  const rows = acc.handed_out ?? [];
  const testLeft = (d.status.stock ?? []).reduce((t, x) => t + (x.test_free ?? 0), 0);
  const signups = d.status.signups?.acc.total ?? 0;
  const reset = async () => {
    if (!confirm("Clear every ACC test hand-out? The same test accounts then get a code again, and the TEST codes go back in the pool. The live shop is not touched.")) return;
    setBusy(true); setMsg(null);
    const r = await post({ action: "acc-reset" });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Cleared ${full(r.data?.cleared ?? 0)} test hand-outs.` } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  const phaseText = acc.phase === "live" ? "Running: every signed-in account on acc.apsoparts.com gets its company's rate with a TEST code."
    : acc.phase === "off" ? "Switched off on ACC: the ACC page hands out no code." : acc.phase === "soon" ? `Starts on ACC ${swiss(acc.settings.start)}.` : "Ended on ACC.";
  return (
    <>
      <Typography sx={{ fontSize: "0.86rem", color: acc.phase === "live" ? GREEN : MUTED, fontWeight: 600 }}>{phaseText}</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<LocalOfferOutlinedIcon />} tint="blue" label="Test hand-outs on ACC" value={full(rows.length)} note="one per company, as on the live shop" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<Inventory2OutlinedIcon />} tint="amber" label="TEST codes left" value={full(testLeft)} note="ACC hands out TEST- codes only" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<ShoppingCartCheckoutOutlinedIcon />} tint="green" label="Sign-ups from the page" value={full(signups)} note="accounts made through Register now, on ACC" /></Grid>
      </Grid>
      <GlassCard sx={{ display: "grid", gap: 1.25 }}>
        <CardTitle icon={<FactCheckOutlinedIcon />} tint="purple" title="Who got what on ACC"
          note="Check each test account against what its set should get. Nothing here reaches HubSpot or the live shop."
          right={d.isAdmin ? <Button size="small" variant="outlined" sx={pill} disabled={busy} onClick={() => void reset()}>{busy ? <CircularProgress size={14} /> : "Clear the test hand-outs"}</Button> : undefined} />
        {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
        {!rows.length ? <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>No test hand-out yet - log in on the ACC Black Friday page with a test account.</Typography> : (
          <Table size="small">
            <TableHead><TableRow>{["When", "Company", "Group", "Customer", "Rate", "Code"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.code}>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{when(x.handed_at)}</TableCell>
                  <TableCell sx={bodyCell}>{x.company_name || (x.on_company ? "-" : "an account without a company")}</TableCell>
                  <TableCell sx={bodyCell}>{GROUP_LABEL[x.grp] ?? x.grp}</TableCell>
                  <TableCell sx={bodyCell}>{STATUS_LABEL[x.status]?.split(" (")[0] ?? x.status}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{x.discount} %</TableCell>
                  <TableCell sx={{ ...bodyCell, fontFamily: "monospace" }}>{x.code}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </>
  );
}

export default function BlackFridayPage() {
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  // which shop the page works on (SARCLA 03.11.2026: "a toggle ACC / production")
  const [env, setEnv] = useState<PromoEnv>("prod");
  const [n, setN] = useState(0);
  const [fresh, setFresh] = useState(false);
  const held = useHeld<Data>(`${API}?n=${n}${fresh ? "&fresh=1" : ""}`, [n]);
  const reload = (again = false) => { setFresh(again); setN((x) => x + 1); };
  const r = held.result;
  const d = r && r.state !== "not-configured" && r.state !== "error" ? r.data : null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Black Friday"
        subtitle="Each company's own code and rate on the shop's Black Friday page, 16 November - 6 December 2026: who got one, who used it"
        rightSlot={<Tooltip title="Read again from HubSpot"><IconButton size="small" onClick={() => reload(true)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>} />
      {d && (() => {
        const ph = env === "acc" ? d.status.acc?.phase ?? "off" : d.status.phase;
        return (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <ReportTabs<PromoEnv> name="black-friday-shop" tab={env} onSelect={(e) => { setEnv(e); if (e === "acc" && (view === "results" || view === "companies")) setView("overview"); }} tabs={[
              { id: "prod", label: "Production", count: null },
              { id: "acc", label: "ACC", count: null },
            ]} />
            <ReportTabs name="black-friday" tab={view} onSelect={setView} tabs={[
              { id: "overview", label: "Overview", count: null },
              ...(env === "prod" ? [
                { id: "results" as View, label: "Results", count: d.report ? full(d.report.results.orders.length) : null },
                { id: "companies" as View, label: "Companies", count: d.report ? full(d.report.holders.length) : null },
              ] : []),
              { id: "codes", label: "Codes", count: null },
              { id: "settings", label: "Settings", count: null },
            ]} />
            <Chip tint={ph === "live" ? "green" : ph === "off" ? "slate" : "amber"}>
              {`${env === "acc" ? "ACC" : "Live shop"}: ${ph === "live" ? "running" : ph === "off" ? "off" : ph === "soon" ? "not started" : "ended"}`}
            </Chip>
          </Box>
        );
      })()}
      {r === null ? <LoadingPanel label="Reading the Ads Gateway and HubSpot…" />
        : r.state === "not-configured" ? <NotConnectedPanel source="Ads Gateway" missing={r.missing} />
        : r.state === "error" ? <UpstreamPanel source="Ads Gateway" error={r.error} status={r.status} onRetry={() => reload()} />
        : view === "results" && env === "prod" ? <Results d={r.data} />
        : view === "companies" && env === "prod" ? <Companies d={r.data} />
        : view === "codes" ? <Codes d={r.data} reload={() => reload()} />
        : view === "settings" ? <Settings key={`${env}-${(env === "acc" ? r.data.status.acc?.settings.set_at : r.data.status.settings.set_at) ?? "default"}`} d={r.data} env={env} reload={() => reload()} />
        : env === "acc" ? <AccOverview d={r.data} reload={() => reload()} />
        : <Overview d={r.data} />}
    </Box>
  );
}
