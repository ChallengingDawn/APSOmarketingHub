"use client";

// Shared by the Shop orders pages (the Magento connector, in the hub since 11.10.2026): the
// sync's status, the frame every page sits in (re-read every 30 seconds, as the sweeps run
// every minute), the admin's actions, and the table of staged orders.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { HAIRLINE, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Info, when } from "../parts";
import type { Mode, Run, StageRow } from "@/lib/connectors/magento/sync";

export type Status = {
  mode: Mode; configured: boolean; counts: Record<string, number>; assoc: Record<string, number>;
  runs: Run[]; writtenToday: number; placedToday: number; admin: boolean;
};

export const MODE: Record<Mode, { chip: string; tint: "green" | "purple" | "slate"; text: string }> = {
  active: { chip: "Active", tint: "green", text: "The hub writes the shop's orders into HubSpot every minute." },
  stage: { chip: "Reads only", tint: "purple", text: "The hub reads the shop's orders every minute but writes nothing - the old connector still writes. The side-by-side test compares the two." },
  off: { chip: "Off", tint: "slate", text: "Switched off - no order is read or written." },
};

/** A run's mode in a word - a read back is the admin's one-off look into the past, not a sweep. */
export const RUN_MODE: Record<string, string> = { active: "Writing", stage: "Reads only", readback: "Read back", off: "Off" };

export const SYNC: Record<string, { label: string; tint: "green" | "amber" | "pink" | "slate" | "purple" }> = {
  pending: { label: "To write", tint: "purple" },
  ok: { label: "Written", tint: "green" },
  error: { label: "Held", tint: "pink" },
  cancelled: { label: "Set aside", tint: "slate" },
};

/** An ISO time as epoch seconds, for when()/ago(). */
export const ts = (v: string | null | undefined) => (v ? Math.floor(Date.parse(v) / 1000) : null);

export type ShopCtx = { tick: number; refresh: () => void; post: (body: object) => Promise<void> };

/** The page frame: header with a refresh, the sync's status read every 30 seconds, and a line for what an action did. */
export function ShopPage({ title, subtitle, children }: {
  title: string; subtitle: string; children: (s: Status, ctx: ShopCtx) => React.ReactNode;
}) {
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const url = `/api/connectors/magento?n=${tick}`;
  const held = useHeld<Status>(url, [url]);
  const r = held.result;
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    const t = setTimeout(refresh, 30_000);
    return () => clearTimeout(t);
  }, [tick, refresh]);
  const post = useCallback(async (body: object) => {
    setNote(null);
    const j = await fetch("/api/connectors/magento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((x) => x.json()).catch(() => null);
    setNote(j?.data?.note ?? j?.error ?? "Could not do that.");
    setTimeout(refresh, 800);
  }, [refresh]);

  const header = (
    <PageHeader title={title} subtitle={subtitle} rightSlot={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
        <Tooltip title="Read again">
          <IconButton size="small" onClick={refresh} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
        </Tooltip>
      </Box>
    } />
  );
  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the shop-order sync…" />;
  else if (r.state === "ok") {
    body = (
      <>
        {!r.data.configured && <Notice tone="bad">The shop&apos;s login (MAGENTO_*) is not set in the hub - nothing can be read.</Notice>}
        {note && <Info>{note}</Info>}
        {children(r.data, { tick, refresh, post })}
      </>
    );
  } else body = <UpstreamPanel source="Shop orders" error={r.state === "error" ? r.error : "Not available"} status={r.state === "error" ? r.status : null} onRetry={refresh} />;
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      {header}
      {body}
    </Box>
  );
}

/** A pager under a server-paged table, 25 a page. */
export function Pager({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  if (total <= 25) return null;
  return (
    <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => onPage(p)} rowsPerPage={25} rowsPerPageOptions={[25]}
      labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`} sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
  );
}

const hubspotOrder = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-123/${id}`;

/** The staged orders - the whole list, the held ones (try again / set aside) or those waiting for their contact (look again). */
export function OrderTable({ kind, rows, admin, act }: {
  kind: "orders" | "held" | "contacts"; rows: StageRow[]; admin: boolean; act: (id: string, action: string) => void;
}) {
  const cell = { ...bodyCell, fontSize: "0.82rem" };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 820 }}>
        <TableHead><TableRow>
          <TableCell sx={headCell}>Web order</TableCell>
          <TableCell sx={headCell}>Customer</TableCell>
          <TableCell sx={headCell} align="right">Total</TableCell>
          <TableCell sx={headCell} align="right">Articles</TableCell>
          <TableCell sx={headCell}>Placed</TableCell>
          <TableCell sx={headCell}>In the shop</TableCell>
          <TableCell sx={headCell}>{kind === "contacts" ? "Contact" : "In HubSpot"}</TableCell>
          <TableCell sx={headCell}>Last seen</TableCell>
          {admin && kind !== "orders" && <TableCell sx={headCell} />}
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r) => {
            const s = SYNC[r.sync_status] ?? { label: r.sync_status, tint: "slate" as const };
            const placed = r.placed && /^\d+$/.test(r.placed) ? Math.floor(Number(r.placed) / 1000) : null;
            return (
              <TableRow key={r.entity_id} hover sx={{ verticalAlign: "top" }}>
                <TableCell sx={{ ...cell, fontFamily: "monospace" }}>
                  {r.hs_order_id
                    ? <a href={hubspotOrder(r.hs_order_id)} target="_blank" rel="noreferrer" style={{ color: "#2459d1", textDecoration: "none" }}>{r.increment_id ?? r.entity_id}</a>
                    : r.increment_id ?? r.entity_id}
                </TableCell>
                <TableCell sx={cell}>{r.customer_name ?? "—"}</TableCell>
                <TableCell sx={{ ...cell, whiteSpace: "nowrap" }} align="right">{r.grand_total !== null ? `${r.currency ?? ""} ${full(Number(r.grand_total))}` : "—"}</TableCell>
                <TableCell sx={cell} align="right">{r.lines}</TableCell>
                <TableCell sx={{ ...cell, color: MUTED, whiteSpace: "nowrap" }}>{placed ? when(placed) : "—"}</TableCell>
                <TableCell sx={{ ...cell, fontSize: "0.8rem", color: MUTED }}>{r.magento_status ?? "—"}</TableCell>
                <TableCell sx={{ ...cell, fontSize: "0.8rem" }}>
                  {kind === "contacts"
                    ? <><Chip tint={r.assoc_status === "failed" ? "pink" : "amber"}>{r.assoc_status === "failed" ? "No contact after 24 h" : `Waiting · try ${r.assoc_retries}`}</Chip>{r.error_msg && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.25 }}>{r.error_msg}</Typography>}</>
                    : <><Chip tint={s.tint}>{s.label}</Chip>{r.error_msg && r.sync_status === "error" && <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", mt: 0.25 }}>{r.error_msg}</Typography>}</>}
                </TableCell>
                <TableCell sx={{ ...cell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(ts(r.last_seen))}</TableCell>
                {admin && kind === "held" && (
                  <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => act(r.entity_id, "retry")}>Try again</Button>
                    <Button size="small" color="inherit" onClick={() => { if (confirm("Set this order aside? It is not written to HubSpot.")) act(r.entity_id, "cancel"); }}>Set aside</Button>
                  </TableCell>
                )}
                {admin && kind === "contacts" && (
                  <TableCell sx={{ ...cell, whiteSpace: "nowrap" }}><Button size="small" onClick={() => act(r.entity_id, "relink")}>Look again</Button></TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

/** One page of staged orders from the server, with its pager. */
export function useOrders(kind: "orders" | "held" | "contacts", page: number, tick: number, opts: { state?: string; q?: string } = {}) {
  const qs = new URLSearchParams({ view: kind, page: String(page), n: String(tick) });
  if (opts.state) qs.set("state", opts.state);
  if (opts.q) qs.set("q", opts.q);
  const url = `/api/connectors/magento?${qs}`;
  const held = useHeld<{ rows: StageRow[]; total: number }>(url, [url]);
  return { loading: held.result === null, data: held.result?.state === "ok" ? held.result.data : null };
}
