"use client";

// Search bar > Stock jobs: what keeps the bar's stock and shop lists fresh - the nightly stock check
// (Performis via the shop, written to the gateway and HubSpot), the refresh after shop orders, the night reading
// of the shop's pages, and the stock asked when a customer clicks "Calculate price". Read-only for now: the
// on/off switches move here last (SARCLA 16.10.2026).

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, usePaged } from "@/app/connectors/parts";
import type { Health, OrderWatch, StockCalls, SweepRun, SweepStatus } from "@/lib/searchbar/gateway";
import { Empty, Loaded, Num, when } from "./shared";

type Jobs = { sweep: SweepStatus; runs: SweepRun[]; orders: OrderWatch; calls: StockCalls; health: Health | null };

const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`);

function Sweep({ s, runs }: { s: SweepStatus; runs: SweepRun[] }) {
  const n = s.nightly;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<NightsStayOutlinedIcon />} tint="blue" title="Nightly stock check"
          note={`Every article's stock from Performis (through the shop), written to the bar and to HubSpot · ${n.window}, ${n.concurrent} at a time`} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
          <Chip tint={n.on ? "green" : "slate"}>{n.on ? "On every night" : "Switched off"}</Chip>
          <Chip tint={n.hubspot ? "green" : "slate"}>{n.hubspot ? "Writes HubSpot too" : "Bar only"}</Chip>
          {s.running && <Chip tint="amber">Running now · {full(s.remaining ?? 0)} left{s.eta_min != null ? ` · about ${s.eta_min} min` : ""}</Chip>}
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead><TableRow>{["Started", "How", "Articles", "Stock found", "In stock", "Sent to HubSpot", "Errors", "Took"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {runs.length === 0 && <TableRow><TableCell colSpan={8} sx={bodyCell}><Empty>No run recorded.</Empty></TableCell></TableRow>}
            {runs.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(r.started_at)}</TableCell>
                <TableCell sx={bodyCell}><Chip tint={r.trigger === "nightly" ? "blue" : "slate"}>{r.trigger}</Chip></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><Num>{full(r.processed)} / {full(r.target)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><Num>{full(r.applied_rows)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><Num>{full(r.with_qty)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><Num>{r.hubspot ? full(r.hs_pushed ?? 0) : "–"}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: r.errors ? RED : undefined }}><Num>{full(r.errors)}</Num></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{r.finished_at ? dur(r.elapsed_sec) : <Chip tint="amber">{r.status}</Chip>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </GlassCard>
  );
}

function Calls({ c }: { c: StockCalls }) {
  const { slice, pager } = usePaged(c.calls ?? [], 10);
  return (
    <GlassCard sx={{ height: "100%", p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<CalculateOutlinedIcon />} tint="amber" title={`"Calculate price" stock calls`} note={`${full(c.total)} in all · each asks Performis for one article's stock and keeps it`} />
      </Box>
      <Table size="small">
        <TableHead><TableRow>{["When", "Articles", "Language"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {slice.length === 0 && <TableRow><TableCell colSpan={3} sx={bodyCell}><Empty>No call yet.</Empty></TableCell></TableRow>}
          {slice.map((x) => (
            <TableRow key={x.id} hover>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(x.called_at)}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", ...clip(260) }} title={x.skus.join(", ")}>{x.skus.join(", ")}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{x.locale}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pager}
    </GlassCard>
  );
}

export default function JobsTab() {
  return (
    <Loaded<Jobs> url="/api/website/search-bar?part=jobs" what="the stock jobs">
      {(d) => {
        const o = d.orders, pub = d.health?.published, mv = pub?.page_moves;
        const lr = (mv?.last_round ?? null) as Record<string, number | string | null> | null;
        return (
          <>
            <Sweep s={d.sweep} runs={d.runs} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <GlassCard sx={{ height: "100%" }}>
                  <CardTitle icon={<ShoppingCartOutlinedIcon />} tint="green" title="Refresh after shop orders" note="Every new web order: the stock of its articles is read again, in the bar and in HubSpot" />
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.25 }}>
                    <Chip tint={o.on ? "green" : "slate"}>{o.on ? "On" : "Off"}</Chip>
                    <Chip tint="slate">Orders read from {o.source === "hubspot" ? "HubSpot (the hub's Magento connector)" : o.source}</Chip>
                  </Box>
                  <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                    {o.last ? `Last: ${when(o.last.at)} - ${full(o.last.orders)} ${o.last.orders === 1 ? "order" : "orders"}, ${full(o.last.skus)} articles refreshed, ${full(o.last.hs)} sent to HubSpot.` : "No order handled since the gateway started."}
                  </Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <GlassCard sx={{ height: "100%" }}>
                  <CardTitle icon={<ArticleOutlinedIcon />} tint="purple" title="The shop's pages" note={`Which articles each product page lists · read ${mv?.window ?? "at night"}`} />
                  {!pub ? <Empty>The gateway did not answer its health check.</Empty> : (
                    <Box sx={{ display: "grid", gap: 0.5 }}>
                      <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{full(pub.count)} product pages, list refreshed {when(pub.synced_at)}{pub.stale ? " - overdue" : ""}.</Typography>
                      {mv && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{full(mv.articles_listed)} articles listed on them; {full(mv.merged_pages)} pages the shop merged into others.</Typography>}
                      {lr && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Last reading: {when(String(lr.at ?? ""))} - {full(Number(lr.read ?? 0))} pages read, {full(Number(lr.failed ?? 0))} failed{lr.stopped ? ` (${lr.stopped})` : ""}.</Typography>}
                      {mv?.running && <Chip tint="amber">Reading the pages now</Chip>}
                      <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.5 }}>An article is on the shop when a page lists it. Pages are read at night only, each once a week.</Typography>
                    </Box>
                  )}
                </GlassCard>
              </Grid>
            </Grid>
            <Calls c={d.calls} />
          </>
        );
      }}
    </Loaded>
  );
}
