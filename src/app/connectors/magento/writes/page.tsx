"use client";

// SHOP ORDERS - WHAT IT WRITES. Every HubSpot Order property the shop-order sync writes,
// one block per area, with the shop's field it comes from and whether the Compass sync takes
// it over once the ERP has linked the order; then the links it makes, and the stage a new web
// order enters. Drawn from fields.ts, which a test holds to the sync's own rules.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { GlassCard, HAIRLINE, INK, MUTED, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { OBJECTS, ORDER_PIPELINE, ORDER_STAGES } from "@/lib/connectors/compass";
import { FIELD_GROUPS, LINKS, erpOwned, fieldNames } from "@/lib/connectors/magento/fields";
import { Chip, Choice } from "../../parts";

type TabId = "properties" | "links" | "stage";
const TAB_HASH: Record<TabId, string> = { properties: "#properties", links: "#links", stage: "#stage" };
const ENTERED = ORDER_STAGES.find(([id]) => id === "5093087452")?.[1] ?? "Entered";

/** HubSpot's own labels of the Order properties - empty until they arrive. */
function useOrderLabels(): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/connectors/labels").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.ok) setLabels(j.data?.[OBJECTS.order] ?? {}); }).catch(() => {});
  }, []);
  return labels;
}

function Properties() {
  const labels = useOrderLabels();
  const label = (name: string) => (name.includes("_NN_") ? `Line NN ${name.split("_NN_")[1]}` : labels[name] ?? "");
  const [area, setArea] = useState<string>("all");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const groups = FIELD_GROUPS
    .filter((g) => area === "all" || g.key === area)
    .map((g) => ({ ...g, fields: g.fields.filter((f) => !needle || `${f.name} ${label(f.name)} ${f.from}`.toLowerCase().includes(needle)) }))
    .filter((g) => g.fields.length);
  return (
    <>
      <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        <Choice value={area} onChange={setArea} options={[
          { key: "all", label: "All", count: fieldNames().length },
          ...FIELD_GROUPS.map((g) => ({ key: g.key, label: g.name, count: g.fields.length })),
        ]} />
        <TextField size="small" placeholder="Find a property" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ ml: { md: "auto" }, minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
      </Box>
      {!groups.length && <GlassCard><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No property matches.</Typography></GlassCard>}
      {groups.map((g) => (
        <GlassCard key={g.key} sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{g.name}</Typography>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{g.fields.length} propert{g.fields.length === 1 ? "y" : "ies"}</Typography>
          </Box>
          <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr) 190px", gap: 2, pb: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ ...headCell, p: 0, border: "none" }}>Property</Typography>
            <Typography sx={{ ...headCell, p: 0, border: "none" }}>From the shop</Typography>
            <Typography sx={{ ...headCell, p: 0, border: "none" }}>Once the ERP has it</Typography>
          </Box>
          {g.fields.map((f) => {
            const l = label(f.name);
            const owned = erpOwned(f.name);
            return (
              <Box key={f.name} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.2fr) 190px" }, gap: { xs: 0.5, md: 2 }, py: 1, borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" } }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{l || f.name}</Typography>
                  {l && <Typography sx={{ fontSize: "0.74rem", fontFamily: "monospace", color: MUTED, overflowWrap: "anywhere" }}>{f.name}</Typography>}
                </Box>
                <Typography sx={{ fontSize: "0.82rem", color: INK, minWidth: 0, overflowWrap: "anywhere" }}>{f.from}</Typography>
                <Box>{owned ? <Chip tint="amber">Compass sync takes over</Chip> : <Chip tint="green">The shop keeps it</Chip>}</Box>
              </Box>
            );
          })}
        </GlassCard>
      ))}
      <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
        A new HubSpot order is created only while the shop still has the order (pending, processing, payment review, on hold) and it was placed
        in the last 30 days; once the shop has transferred it, the ERP&apos;s orders are the record and the hub never makes a twin.
        An empty field in the shop is never written - it would wipe what the Compass sync set. &quot;Compass sync takes over&quot;: once the order carries its
        A-number, the shop sync no longer writes these; the ERP&apos;s values stand.
      </Typography>
    </>
  );
}

function Links() {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1 }}>The links between records the shop-order sync makes - and the one it leaves to the Compass sync.</Typography>
      {LINKS.map((a) => (
        <Box key={`${a.from}-${a.to}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "250px 180px minmax(0,1fr)" }, gap: { xs: 0.25, md: 1.5 }, py: 1, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{a.from} → {a.to}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontFamily: "monospace" }}>{a.type}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{a.how}</Typography>
        </Box>
      ))}
    </GlassCard>
  );
}

function Stage() {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.25 }}>
        A new web order enters the {ORDER_PIPELINE.name} order pipeline ({ORDER_PIPELINE.id}) at <b>{ENTERED}</b>. From there the Compass sync moves it by its ERP
        status, once the ERP has the order - the shop sync never moves a linked order back.
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(5, minmax(0,1fr))" }, gap: 1 }}>
        {ORDER_STAGES.map(([id, name]) => (
          <Box key={id} sx={{ px: 1.25, py: 0.8, borderRadius: "12px", border: `1px solid ${id === "5093087452" ? "#2459d1" : HAIRLINE}`, bgcolor: id === "5093087452" ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.75)" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{name}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontFamily: "monospace" }}>{id}{id === "5093087452" ? " · the shop's" : ""}</Typography>
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

export default function ShopOrdersWrites() {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "properties");
  const count = useMemo(() => fieldNames().length, []);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="What it writes" subtitle="Every HubSpot property and link the shop-order sync writes - one line each, with the shop's field behind it" />
      <Box>
        <ReportTabs name="shop-writes" tab={tab} onSelect={selectTab} tabs={[
          { id: "properties", label: "Properties", count: String(count) },
          { id: "links", label: "Associations", count: String(LINKS.length) },
          { id: "stage", label: "Order stage", count: "1" },
        ]} />
      </Box>
      {tab === "properties" && <Properties />}
      {tab === "links" && <Links />}
      {tab === "stage" && <Stage />}
    </Box>
  );
}
