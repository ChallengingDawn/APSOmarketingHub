"use client";

// SHOP ORDERS - ORDERS. Every web order the hub has read (the last 30 days, and every order
// changed since), newest first: where it stands in the shop and in HubSpot. Filter by the
// HubSpot side, find one by its web order number, customer or email.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { LoadingPanel } from "@/app/analytics/Shell";
import { GlassCard, MUTED, Notice } from "@/app/uc/report/ui";
import { Choice } from "../../parts";
import { OrderTable, Pager, SYNC, ShopPage, useOrders, type ShopCtx, type Status } from "../parts";

type State = "all" | "pending" | "ok" | "error" | "cancelled";

function Orders({ s, ctx }: { s: Status; ctx: ShopCtx }) {
  const [state, setState] = useState<State>("all");
  const [typed, setTyped] = useState("");
  const [find, setFind] = useState("");
  const [page, setPage] = useState(0);
  // the search goes out once typing stops
  useEffect(() => {
    const t = setTimeout(() => setFind(typed.trim()), 350);
    return () => clearTimeout(t);
  }, [typed]);
  useEffect(() => setPage(0), [state, find]);
  const { loading, data } = useOrders("orders", page, ctx.tick, { state: state === "all" ? undefined : state, q: find || undefined });
  const all = Object.values(s.counts).reduce((a, n) => a + n, 0);
  return (
    <>
      <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        <Choice value={state} onChange={setState} options={[
          { key: "all", label: "All", count: all },
          ...(["pending", "ok", "error", "cancelled"] as const).map((k) => ({ key: k, label: SYNC[k].label, count: s.counts[k] ?? 0 })),
        ]} />
        <TextField size="small" placeholder="Web order, customer or email" value={typed} onChange={(e) => setTyped(e.target.value)}
          sx={{ ml: { md: "auto" }, minWidth: 240 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
      </Box>
      <GlassCard sx={{ p: 0, pt: 1 }}>
        {loading ? <LoadingPanel label="Reading the orders…" />
          : !data ? <Box sx={{ p: 2 }}><Notice tone="warn">The orders could not be read.</Notice></Box>
            : !data.rows.length ? <Typography sx={{ fontSize: "0.86rem", color: MUTED, p: 2 }}>{find || state !== "all" ? "No order matches." : "No order read yet - the first sweep runs a minute after the hub starts."}</Typography>
              : <><OrderTable kind="orders" rows={data.rows} admin={s.admin} act={(id, action) => void ctx.post({ action, id })} /><Pager total={data.total} page={page} onPage={setPage} /></>}
      </GlassCard>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        &quot;To write&quot; while the hub only reads means: the hub would write it - the old connector still does. A link on the web order opens it in HubSpot,
        once the hub has written it itself.
      </Typography>
    </>
  );
}

export default function ShopOrdersList() {
  return (
    <ShopPage title="Orders" subtitle="Every web order the hub has read - where it stands in the shop and in HubSpot">
      {(s, ctx) => <Orders s={s} ctx={ctx} />}
    </ShopPage>
  );
}
