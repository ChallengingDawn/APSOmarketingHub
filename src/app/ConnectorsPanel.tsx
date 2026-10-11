"use client";

// CONNECTORS & INTEGRATION's square on the front page - the app's way in, in
// place of a tile (SARCLA, 07.10.2026: "take the connector from the main menu
// and bring it to the square"). One part per connector - the Compass sync (the
// ERP's files) and, since 11.10.2026, the Magento connector (the shop's web
// orders) - each with whether it is flowing and its five pages. Only drawn for
// someone who may open the app.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CableIcon from "@mui/icons-material/Cable";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { chainVerdict, lastDelivery, type Snapshot } from "@/lib/connectors/snapshot";
import type { HubChain } from "@/lib/connectors/chainStatus";
import { APPS, type SubApp } from "./hubApps";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const DOT = { good: "#2ec29a", warn: "#f0a63c", bad: "#e5484d", unknown: "#b9c0c9" } as const;
const APP = APPS.find((a) => a.key === "connectors");

function ago(t: number | null | undefined): string {
  if (!t) return "";
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** The shop-order sync's status, as much as the square needs (GET /api/connectors/magento). */
type Shop = { mode: "off" | "stage" | "active"; runs: { started_at: string; ok: boolean; error: string | null }[]; placedToday: number; writtenToday: number; counts: Record<string, number>; assoc: Record<string, number> };

const secs = (iso: string | null | undefined) => (iso ? Math.floor(Date.parse(iso) / 1000) : null);

/** One connector: its name, its lines, its pages as chips. */
function Part({ title, subs, children }: { title: string; subs: SubApp[]; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 0.9 }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, letterSpacing: ".08em", textTransform: "uppercase" }}>{title}</Typography>
      <Box sx={{ display: "grid", gap: 0.75 }}>{children}</Box>
      <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap" }}>
        {subs.map((x) => (
          <Box key={x.href} component={Link} href={x.href} title={x.note} sx={{
            px: 1.1, py: 0.4, borderRadius: "999px", fontSize: "0.76rem", fontWeight: 600, textDecoration: "none",
            color: APP?.to ?? "#13866a", bgcolor: "rgba(255,255,255,.8)", border: "1px solid rgba(19,134,106,.18)",
            "&:hover": { bgcolor: "#fff" },
          }}>
            {x.short ?? x.name}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Line({ dot, text, when }: { dot: string; text: string; when?: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, lineHeight: 1.35 }}>{text}</Typography>
      {when ? <Typography sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap" }}>{when}</Typography> : null}
    </Box>
  );
}

export default function ConnectorsPanel({ glass }: { glass: object }) {
  const [s, setS] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  // the hub's own last run, once it reads the ERP's files (the connector's until then)
  const [hub, setHub] = useState<{ pulls: boolean; chain: HubChain | null } | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopFailed, setShopFailed] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/connectors", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.ok ? setS(j.data as Snapshot) : setFailed(true)))
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    fetch("/api/connectors/steps", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setHub({ pulls: j.data.connectorPulls === false, chain: j.data.chain ?? null }); })
      .catch(() => {});
    fetch("/api/connectors/magento", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.ok ? setShop(j.data as Shop) : setShopFailed(true)))
      .catch(() => { if (!ctrl.signal.aborted) setShopFailed(true); });
    return () => ctrl.abort();
  }, []);
  const c = hub?.pulls ? hub.chain : null;
  const cFailed = c ? c.steps.filter((x) => !x.ok).length : 0;
  const v = c
    ? { tone: (c.status === "failed" || cFailed ? "bad" : c.status === "running" ? "warn" : "good") as keyof typeof DOT, label: c.status === "running" ? "running" : c.status === "failed" ? "failed" : cFailed ? `done, ${cFailed} failed` : "done", at: c.ts || null }
    : s ? chainVerdict(s) : null;
  const d = c ? { at: c.ts || null, files: c.pulled } : s ? lastDelivery(s) : null;
  const subs = APP?.subs ?? [];
  const compassSubs = subs.filter((x) => x.group === "Compass connector");
  const shopSubs = subs.filter((x) => x.group === "Magento connector");
  const sweep = shop?.runs?.[0] ?? null;
  const waiting = (shop?.counts.error ?? 0) + (shop?.assoc.pending ?? 0) + (shop?.assoc.failed ?? 0);
  return (
    <Box sx={{
      ...glass, borderRadius: "22px", p: { xs: 2, md: 2.25 }, display: "flex", flexDirection: "column", gap: 1.5,
      background: `linear-gradient(160deg, ${APP?.wash ?? "rgba(47,179,165,.10)"}, rgba(255,255,255,.7) 60%)`,
    }}>
      <Box component={Link} href="/connectors" sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", "&:hover .go": { transform: "translateX(3px)" } }}>
        <Box sx={{ width: 38, height: 38, borderRadius: "11px", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0,
          background: `linear-gradient(135deg, ${APP?.from ?? "#2fb3a5"}, ${APP?.to ?? "#13866a"})` }}>
          <CableIcon sx={{ fontSize: 21 }} />
        </Box>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em", flex: 1 }}>Connectors &amp; Integration</Typography>
        <ChevronRightIcon className="go" sx={{ color: APP?.to ?? "#13866a", transition: "transform .2s" }} />
      </Box>

      <Part title="Compass connector · the ERP's files" subs={compassSubs}>
        {!v && !failed && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading the Compass sync…</Typography>}
        {!v && failed && <Line dot={DOT.unknown} text="The Compass sync could not be read" />}
        {v && <Line dot={DOT[v.tone]} text={`Compass sync: ${v.label.toLowerCase()}`} when={ago(v.at)} />}
        {d && <Line dot={d.at ? DOT.good : DOT.unknown} text={d.at ? `${d.files} ERP files in the last delivery` : "No ERP files received yet"} when={ago(d.at)} />}
        {s?.review && s.review.pending > 0 && <Line dot={DOT.warn} text={`${s.review.pending} ERP customers wait for a company`} />}
      </Part>

      <Box sx={{ borderTop: "1px solid rgba(19,134,106,.14)" }} />

      <Part title="Magento connector · the shop's web orders" subs={shopSubs}>
        {!shop && !shopFailed && <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading the shop-order sync…</Typography>}
        {!shop && shopFailed && <Line dot={DOT.unknown} text="The shop-order sync could not be read" />}
        {shop && (
          <Line
            dot={shop.mode === "off" ? DOT.unknown : sweep && !sweep.ok ? DOT.bad : DOT.good}
            text={shop.mode === "active" ? "Shop orders: the hub writes them" : shop.mode === "stage" ? "Shop orders: the hub reads only" : "Shop orders: switched off"}
            when={sweep ? ago(secs(sweep.started_at)) : undefined} />
        )}
        {shop && <Line dot={DOT.good} text={`${shop.placedToday} placed in the shop today${shop.mode === "active" ? `, ${shop.writtenToday} written by the hub` : ""}`} />}
        {shop && waiting > 0 && <Line dot={DOT.warn} text={`${waiting} order${waiting === 1 ? "" : "s"} in the review queue`} />}
      </Part>
    </Box>
  );
}
