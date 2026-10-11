"use client";

// SHOP ORDERS - REVIEW QUEUE. What the sync could not finish on its own: orders HubSpot
// refused or that miss a field (try again, or set aside), and orders still without their
// contact - linked by email as soon as the contact exists, given up after 24 hours (look again).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { LoadingPanel } from "@/app/analytics/Shell";
import { GlassCard, MUTED, Notice } from "@/app/uc/report/ui";
import { Choice } from "../../parts";
import { OrderTable, Pager, ShopPage, useOrders, type ShopCtx, type Status } from "../parts";

type Kind = "held" | "contacts";

const EMPTY: Record<Kind, string> = {
  held: "No order is held back.",
  contacts: "No order is waiting for its contact.",
};

function Review({ s, ctx }: { s: Status; ctx: ShopCtx }) {
  const [kind, setKind] = useState<Kind>("held");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [kind]);
  const { loading, data } = useOrders(kind, page, ctx.tick);
  return (
    <>
      <Choice value={kind} onChange={setKind} options={[
        { key: "held", label: "Held back", count: s.counts.error ?? 0 },
        { key: "contacts", label: "Waiting for a contact", count: (s.assoc.pending ?? 0) + (s.assoc.failed ?? 0) },
      ]} />
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        {kind === "held"
          ? "Orders HubSpot refused, or that miss the web order number, the name or the currency. Try again sends one back to the next sweep; set aside leaves it out of HubSpot."
          : "Written orders whose contact could not be found by the order's email - contacts are never created here. Tried every 30 minutes; after 24 hours the sync stops trying. Look again tries once more."}
      </Typography>
      <GlassCard sx={{ p: 0, pt: 1 }}>
        {loading ? <LoadingPanel label="Reading the orders…" />
          : !data ? <Box sx={{ p: 2 }}><Notice tone="warn">The orders could not be read.</Notice></Box>
            : !data.rows.length ? <Typography sx={{ fontSize: "0.86rem", color: MUTED, p: 2 }}>{EMPTY[kind]}{s.mode !== "active" ? " While the hub only reads, it writes nothing that could be held." : ""}</Typography>
              : <><OrderTable kind={kind} rows={data.rows} admin={s.admin} act={(id, action) => void ctx.post({ action, id })} /><Pager total={data.total} page={page} onPage={setPage} /></>}
      </GlassCard>
    </>
  );
}

export default function ShopOrdersReview() {
  return (
    <ShopPage title="Review queue" subtitle="The shop orders the sync could not finish on its own">
      {(s, ctx) => <Review s={s} ctx={ctx} />}
    </ShopPage>
  );
}
