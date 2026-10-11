"use client";

// SHOP ORDERS - OVERVIEW. The Magento connector, in the hub (moved from APSOAssistant,
// 11.10.2026), laid out like the Compass sync's overview (SARCLA: "more views like the
// Compass"): what the sync does now (reads only, writing, off) and the switch, four answers
// at a glance, the side-by-side test while it only reads, and four pictures - the web orders
// reaching HubSpot each day (is it flowing?), where the orders stand in the shop, the last
// 24 hours of sweeps, and what needs a look. Detail lives on the other Shop orders pages.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { ChartFrame } from "@/app/charts/ChartFrame";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, ago, when } from "../parts";
import { MODE, ShopPage, ts, type ShopCtx, type Status } from "./parts";
import type { Comparison, Overview as OverviewData } from "@/lib/connectors/magento/sync";

type Flow = { days: { day: string; orders: number }[]; at: string | null; counting: boolean; error: string | null };

/** "2026-10-10" -> "10.10" */
const dd = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
/** An hour as "14h", local time. */
const hh = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, "0")}h`;

function ModeBar({ s, post }: { s: Status; post: ShopCtx["post"] }) {
  const m = MODE[s.mode];
  return (
    <GlassCard>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
        <Chip tint={m.tint}>{m.chip}</Chip>
        <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 240 }}>{m.text}</Typography>
        {s.admin && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {s.mode !== "active" && <Button size="small" variant="contained" disableElevation
              onClick={() => { if (confirm("Let the hub write the shop's orders into HubSpot? Only after the old connector in APSOAssistant is switched off - otherwise both write.")) void post({ action: "mode", mode: "active" }); }}>Write (Active)</Button>}
            {s.mode !== "stage" && <Button size="small" variant="outlined" onClick={() => void post({ action: "mode", mode: "stage" })}>Read only</Button>}
            {s.mode !== "off" && <Button size="small" variant="outlined" color="warning" onClick={() => { if (confirm("Switch the shop-order sync off? No order is read or written.")) void post({ action: "mode", mode: "off" }); }}>Off</Button>}
          </Box>
        )}
      </Box>
    </GlassCard>
  );
}

function SideBySide({ admin, post }: { admin: boolean; post: ShopCtx["post"] }) {
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState<Comparison | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null);
    const j = await fetch("/api/connectors/magento?view=compare").then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (j?.ok) setC(j.data); else setErr(j?.error ?? "The comparison could not be made.");
  };
  const fields = c ? Object.entries(c.fields).sort((a, b) => b[1] - a[1]) : [];
  return (
    <GlassCard>
      <CardTitle icon={<CompareArrowsIcon />} tint="purple" title="Side-by-side test"
        note="Every order the hub has read (up to 1,500), against what the old connector wrote into HubSpot - field by field. Read back 7 days first for a full week: it takes a few minutes, and the Sweeps page shows it when done."
        right={
          <Box sx={{ display: "flex", gap: 1 }}>
            {admin && <Button size="small" onClick={() => void post({ action: "readback" })}>Read back 7 days</Button>}
            <Button size="small" variant="outlined" disabled={busy} onClick={run}>{busy ? "Comparing…" : "Compare now"}</Button>
          </Box>
        } />
      {err && <Typography sx={{ fontSize: "0.82rem", color: "#c5221f" }}>{err}</Typography>}
      {c && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography sx={{ fontSize: "0.88rem", color: INK }}>
            <b>{c.identical}</b> of {c.checked} orders identical · <b>{c.differing}</b> with a difference · {c.notInHubSpot} not in HubSpot yet
          </Typography>
          {fields.length > 0 && (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Fields that differ: {fields.map(([k, n]) => `${k} (${n})`).join(", ")}</Typography>
          )}
          {c.examples.length > 0 && (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead><TableRow>
                  <TableCell sx={headCell}>Web order</TableCell><TableCell sx={headCell}>Field</TableCell>
                  <TableCell sx={headCell}>The hub would write</TableCell><TableCell sx={headCell}>HubSpot has</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {c.examples.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace" }}>{e.order}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace" }}>{e.field}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{e.hub}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{e.hubspot ?? "(empty)"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      )}
    </GlassCard>
  );
}

function Charts({ s, tick }: { s: Status; tick: number }) {
  const url = `/api/connectors/magento?view=overview&n=${tick}`;
  const held = useHeld<OverviewData & { flow: Flow }>(url, [url]);
  const d = held.result?.state === "ok" ? held.result.data : null;
  const flow = d?.flow.days ?? [];
  const shop = (d?.shop ?? []).map((r) => ({ label: r.status, value: r.n }));
  const read = shop.reduce((a, r) => a + r.value, 0);
  const hours = d?.hours ?? [];
  const changed = hours.reduce((a, h) => a + h.found, 0);
  const written = hours.reduce((a, h) => a + h.written, 0);
  const failed = hours.reduce((a, h) => a + h.failed, 0);
  const look = (d?.look ?? []).map((l) => ({ label: `${l.kind === "held" ? "Held" : "Contact"}: ${l.why}`, value: l.n, href: "/connectors/magento/review" }));
  const loading = held.result === null ? "Reading…" : null;

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="Web orders reaching HubSpot, per day"
              caption={`The last 30 days, counted in HubSpot: orders created that day that carry a web order number - whoever wrote them (the old connector until the switch, then the hub). Weekends are quieter.${d?.flow.at ? ` Counted ${when(d.flow.at)}.` : ""}`}
              stale={!!d?.flow.counting && flow.length > 0}
              empty={loading ?? (!flow.length ? (d?.flow.error ? `Could not count: ${d.flow.error}` : "Counting in HubSpot…") : null)}
              table={{ columns: ["Day", "Web orders"], rows: flow.map((x) => [dd(x.day), x.orders]), numeric: [1] }}
            >
              <StackedColumns data={flow.map((x) => ({ x: x.day, orders: x.orders }))} parts={[{ key: "orders", label: "Web orders" }]}
                height={220} format={(n) => full(n)} xFormat={dd} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="Where the orders stand in the shop"
              caption={read ? `The ${full(read)} orders the hub read in the last 30 days, by their status in the shop.` : undefined}
              empty={loading ?? (!shop.length ? "No order read yet." : null)}
              table={{ columns: ["Status in the shop", "Orders"], rows: shop.map((r) => [r.label, r.value]), numeric: [1] }}
            >
              <BarList rows={shop} format={(n) => full(n)} labelWidth={130} />
            </ChartFrame>
          </GlassCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="The last 24 hours, hour by hour"
              caption={`Orders the shop changed - placed, paid, transferred, shipped - as the minute sweeps found them: ${full(changed)} in 24 hours${s.mode === "active" ? `, ${full(written)} written to HubSpot` : ""}. ${failed ? `${failed} sweep${failed === 1 ? "" : "s"} failed.` : "No sweep failed."}`}
              empty={loading ?? (!hours.length ? "No sweep yet." : null)}
              table={{ columns: ["Hour", "Changed in the shop", "Written", "Failed sweeps"], rows: hours.map((h) => [hh(h.hour), h.found, h.written, h.failed]), numeric: [1, 2, 3] }}
            >
              <StackedColumns data={hours.map((h) => ({ x: h.hour, found: h.found }))} parts={[{ key: "found", label: "Changed in the shop" }]}
                height={220} format={(n) => full(n)} xFormat={hh} />
            </ChartFrame>
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <GlassCard sx={{ height: "100%" }}>
            <ChartFrame
              title="Needs a look"
              caption={look.length ? "Orders HubSpot refused or that miss a field, and orders still without their contact. Click one for the review queue." : undefined}
              empty={loading ?? (!look.length ? (s.mode === "active" ? "Nothing needs a look." : "Nothing - while the hub only reads, it writes nothing that could be held.") : null)}
              table={{ columns: ["What", "Orders"], rows: look.map((r) => [r.label, r.value]), numeric: [1] }}
            >
              <BarList rows={look} format={(n) => full(n)} labelWidth={220} />
            </ChartFrame>
          </GlassCard>
        </Grid>
      </Grid>
    </>
  );
}

function Overview({ s, ctx }: { s: Status; ctx: ShopCtx }) {
  const last = s.runs[0];
  return (
    <>
      <ModeBar s={s} post={ctx.post} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ScheduleOutlinedIcon />} tint={last && !last.ok ? "pink" : "blue"} label="Last sweep"
            value={last ? ago(ts(last.started_at)) : "—"} note={last ? (last.ok ? `${last.orders_found} changed in the shop · every minute` : (last.error ?? "failed").slice(0, 60)) : "the first one runs a minute after boot"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ShoppingBagOutlinedIcon />} tint="green" label="Orders today" value={full(s.placedToday)}
            note={s.mode === "active" ? `placed in the shop · ${full(s.writtenToday)} written by the hub` : "placed in the shop · the hub writes nothing yet"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<PauseCircleOutlineIcon />} tint={s.counts.error ? "pink" : "green"} label="Held back" value={full(s.counts.error ?? 0)} note="orders HubSpot refused or that miss a field" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ContactMailOutlinedIcon />} tint={s.assoc.pending || s.assoc.failed ? "amber" : "green"} label="Waiting for a contact" value={full((s.assoc.pending ?? 0) + (s.assoc.failed ?? 0))}
            note={s.assoc.failed ? `${s.assoc.failed} without one after 24 h` : "linked by email once the contact exists"} />
        </Grid>
      </Grid>
      {s.mode === "stage" && <SideBySide admin={s.admin} post={ctx.post} />}
      <Charts s={s} tick={ctx.tick} />
    </>
  );
}

export default function ShopOrdersOverview() {
  return (
    <ShopPage title="Shop orders" subtitle="Whether the shop's web orders are flowing into HubSpot - the Magento connector">
      {(s, ctx) => <Overview s={s} ctx={ctx} />}
    </ShopPage>
  );
}
