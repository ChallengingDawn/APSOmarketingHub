"use client";

// SHOP ORDERS - the Magento connector, in the hub (moved from APSOAssistant, 11.10.2026).
// The shop's web orders reach HubSpot every minute: what the sync does now (reads only,
// writing, off), the last sweeps, the orders it holds back and why, the contacts it is
// still waiting for, and - while it only reads - the side-by-side test against what the
// old connector wrote. Admins switch it and retry or set aside a held order.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, ago, when } from "../parts";
import type { Comparison, Mode, StageRow } from "@/lib/connectors/magento/sync";

type Run = { id: string; started_at: string; finished_at: string | null; mode: string; orders_found: number; orders_written: number; errors: number; ok: boolean; error: string | null; skus: string | null };
type Status = { mode: Mode; configured: boolean; counts: Record<string, number>; assoc: Record<string, number>; runs: Run[]; writtenToday: number; admin: boolean };
type View = "orders" | "held" | "contacts" | "sweeps";

const MODE: Record<Mode, { chip: string; tint: "green" | "purple" | "slate"; text: string }> = {
  active: { chip: "Active", tint: "green", text: "The hub writes the shop's orders into HubSpot every minute." },
  stage: { chip: "Reads only", tint: "purple", text: "The hub reads the shop's orders every minute but writes nothing - the old connector still writes. The side-by-side test below compares the two." },
  off: { chip: "Off", tint: "slate", text: "Switched off - no order is read or written." },
};

const SYNC: Record<string, { label: string; tint: "green" | "amber" | "pink" | "slate" | "purple" }> = {
  pending: { label: "To write", tint: "purple" },
  ok: { label: "Written", tint: "green" },
  error: { label: "Held", tint: "pink" },
  cancelled: { label: "Set aside", tint: "slate" },
};

const ts = (v: string | null) => (v ? Math.floor(Date.parse(v) / 1000) : null);

function Rows({ view, admin, act, tick }: { view: Exclude<View, "sweeps">; admin: boolean; act: (id: string, action: string) => void; tick: number }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [view]);
  const url = `/api/connectors/magento?view=${view}&page=${page}&n=${tick}`;
  const held = useHeld<{ rows: StageRow[]; total: number }>(url, [url]);
  const d = held.result?.state === "ok" ? held.result.data : null;
  if (held.result === null) return <LoadingPanel label="Reading the orders…" />;
  if (!d) return <Notice tone="warn">The orders could not be read.</Notice>;
  if (!d.rows.length) {
    return <Typography sx={{ fontSize: "0.86rem", color: MUTED, p: 2 }}>
      {view === "held" ? "No order is held back." : view === "contacts" ? "No order is waiting for its contact." : "No order staged yet - the first sweep runs a minute after the hub starts."}
    </Typography>;
  }
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>Web order</TableCell>
            <TableCell sx={headCell}>Customer</TableCell>
            <TableCell sx={headCell} align="right">Total</TableCell>
            <TableCell sx={headCell}>In the shop</TableCell>
            <TableCell sx={headCell}>{view === "contacts" ? "Contact" : "In HubSpot"}</TableCell>
            <TableCell sx={headCell}>Seen</TableCell>
            {admin && view !== "orders" && <TableCell sx={headCell} />}
          </TableRow></TableHead>
          <TableBody>
            {d.rows.map((r) => {
              const s = SYNC[r.sync_status] ?? { label: r.sync_status, tint: "slate" as const };
              return (
                <TableRow key={r.entity_id} hover sx={{ verticalAlign: "top" }}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontFamily: "monospace" }}>
                    {r.hs_order_id
                      ? <a href={`https://app-eu1.hubspot.com/contacts/26492587/record/0-123/${r.hs_order_id}`} target="_blank" rel="noreferrer" style={{ color: "#2459d1", textDecoration: "none" }}>{r.increment_id ?? r.entity_id}</a>
                      : r.increment_id ?? r.entity_id}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.customer_name ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }} align="right">{r.grand_total !== null ? `${r.currency ?? ""} ${full(Number(r.grand_total))}` : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{r.magento_status ?? "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>
                    {view === "contacts"
                      ? <><Chip tint={r.assoc_status === "failed" ? "pink" : "amber"}>{r.assoc_status === "failed" ? "Gave up after 24 h" : `Waiting · try ${r.assoc_retries}`}</Chip>{r.error_msg && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>{r.error_msg}</Typography>}</>
                      : <><Chip tint={s.tint}>{s.label}</Chip>{r.error_msg && r.sync_status === "error" && <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", mt: 0.25 }}>{r.error_msg}</Typography>}</>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(ts(r.last_seen))}</TableCell>
                  {admin && view === "held" && (
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                      <Button size="small" onClick={() => act(r.entity_id, "retry")}>Try again</Button>
                      <Button size="small" color="inherit" onClick={() => { if (confirm("Set this order aside? It is not written to HubSpot.")) act(r.entity_id, "cancel"); }}>Set aside</Button>
                    </TableCell>
                  )}
                  {admin && view === "contacts" && (
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Button size="small" onClick={() => act(r.entity_id, "relink")}>Look again</Button></TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {d.total > 25 && (
        <TablePagination component="div" count={d.total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
      )}
    </>
  );
}

function Sweeps({ runs }: { runs: Run[] }) {
  if (!runs.length) return <Typography sx={{ fontSize: "0.86rem", color: MUTED, p: 2 }}>No sweep yet.</Typography>;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead><TableRow>
          <TableCell sx={headCell}>When</TableCell><TableCell sx={headCell}>Mode</TableCell>
          <TableCell sx={headCell} align="right">Changed in the shop</TableCell><TableCell sx={headCell} align="right">Written</TableCell>
          <TableCell sx={headCell} align="right">Failed</TableCell><TableCell sx={headCell}>Result</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{when(ts(r.started_at))}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{MODE[r.mode as Mode]?.chip ?? r.mode}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{r.orders_found}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{r.orders_written}</TableCell>
              <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }} align="right">{r.errors}</TableCell>
              <TableCell sx={bodyCell}>{r.ok ? <Chip tint="green">OK</Chip> : <Chip tint="pink">{(r.error ?? "failed").slice(0, 70)}</Chip>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function SideBySide() {
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
      <CardTitle icon={<CloudUploadOutlinedIcon />} tint="purple" title="Side-by-side test"
        note="The newest 200 orders the hub read, against what the old connector wrote into HubSpot - field by field"
        right={<Button size="small" variant="outlined" disabled={busy} onClick={run}>{busy ? "Comparing…" : "Compare now"}</Button>} />
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

function Board({ s, refresh, tick }: { s: Status; refresh: () => void; tick: number }) {
  const [view, setView] = useState<View>("orders");
  const [note, setNote] = useState<string | null>(null);
  const post = useCallback(async (body: object) => {
    setNote(null);
    const j = await fetch("/api/connectors/magento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => r.json()).catch(() => null);
    setNote(j?.data?.note ?? j?.error ?? "Could not do that.");
    setTimeout(refresh, 800);
  }, [refresh]);
  const last = s.runs[0];
  const m = MODE[s.mode];
  return (
    <>
      {!s.configured && <Notice tone="bad">The shop's login (MAGENTO_*) is not set in the hub - nothing can be read.</Notice>}
      {note && <Info>{note}</Info>}
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

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ScheduleOutlinedIcon />} tint={last && !last.ok ? "pink" : "blue"} label="Last sweep"
            value={last ? ago(ts(last.started_at)) : "—"} note={last ? (last.ok ? `${last.orders_found} changed in the shop` : (last.error ?? "failed").slice(0, 60)) : "the first one runs a minute after boot"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<CloudUploadOutlinedIcon />} tint="green" label="Written today" value={full(s.writtenToday)} note={s.mode === "active" ? "orders into HubSpot" : "the hub writes nothing yet"} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<PauseCircleOutlineIcon />} tint={s.counts.error ? "pink" : "green"} label="Held back" value={full(s.counts.error ?? 0)} note="orders HubSpot refused or that miss a field" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<ContactMailOutlinedIcon />} tint={s.assoc.pending ? "amber" : "green"} label="Waiting for a contact" value={full(s.assoc.pending ?? 0)}
            note={s.assoc.failed ? `${s.assoc.failed} gave up after 24 h` : "linked by email once the contact exists"} />
        </Grid>
      </Grid>

      {s.mode === "stage" && <SideBySide />}

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5 }}>
          <Choice value={view} onChange={setView} options={[
            { key: "orders", label: "Orders", count: Object.values(s.counts).reduce((a, n) => a + n, 0) },
            { key: "held", label: "Held back", count: s.counts.error ?? 0 },
            { key: "contacts", label: "Waiting for a contact", count: (s.assoc.pending ?? 0) + (s.assoc.failed ?? 0) },
            { key: "sweeps", label: "Sweeps" },
          ]} />
        </Box>
        {view === "sweeps" ? <Sweeps runs={s.runs} /> : <Rows view={view} admin={s.admin} act={(id, action) => void post({ action, id })} tick={tick} />}
      </GlassCard>

      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        What it writes: each web order as a HubSpot order, found by its web order number - amounts, addresses, payment, the shop&apos;s status
        and up to 80 lines - and its contact (by email, never created) and articles. Once the ERP has linked the order to its A-number, the
        Compass sync owns its stage, date, net revenue, mandant and lines; the shop sync no longer writes them. The company comes from the Compass sync.
      </Typography>
    </>
  );
}

export default function ShopOrders() {
  const [tick, setTick] = useState(0);
  const url = `/api/connectors/magento?n=${tick}`;
  const held = useHeld<Status>(url, [url]);
  const r = held.result;
  // the page follows the sweeps: read again every 30 seconds
  useEffect(() => {
    const t = setTimeout(() => setTick((n) => n + 1), 30_000);
    return () => clearTimeout(t);
  }, [tick]);
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the shop-order sync…" />;
  else if (r.state === "error") body = <UpstreamPanel source="Shop orders" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Shop orders" error="Not available" status={null} onRetry={() => setTick((n) => n + 1)} />;
  else body = <Board s={r.data} refresh={() => setTick((n) => n + 1)} tick={tick} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Shop orders" subtitle="The shop's web orders into HubSpot, every minute - the Magento connector" />
      {body}
    </Box>
  );
}
