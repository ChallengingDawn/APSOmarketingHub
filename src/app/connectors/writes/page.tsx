"use client";

// WHAT IT WRITES - every HubSpot property and association the Compass sync
// touches: one row per property, with every step that writes it. Three tabs: properties (filter by object,
// search, 15 a page), associations, order stages. Drawn from the step list,
// which was read from the connector's code; the labels are HubSpot's own.

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
import { ASSOCIATIONS, OBJECTS, ORDER_PIPELINE, ORDER_STAGES, PROP_LABEL, writesByProperty } from "@/lib/connectors/compass";
import { Choice } from "../parts";

type TabId = "properties" | "associations" | "stages";
const TAB_HASH: Record<TabId, string> = { properties: "#properties", associations: "#associations", stages: "#stages" };
const short = (o: string) => o.replace(/ \(.*\)$/, "");

/** HubSpot's own labels, by object and internal name - empty until they arrive. */
function useLabels(): Record<string, Record<string, string>> {
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    fetch("/api/connectors/labels").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.ok) setLabels(j.data); }).catch(() => {});
  }, []);
  return labels;
}

function Properties() {
  const all = useMemo(() => writesByProperty(), []);
  const labels = useLabels();
  const label = (object: string, name: string) => PROP_LABEL[name] ?? labels[object]?.[name] ?? "";
  const objects = useMemo(() => [...new Set(all.map((w) => w.object))], [all]);
  const [obj, setObj] = useState<string>("all");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = all.filter((w) => (obj === "all" || w.object === obj)
    && (!needle || `${w.name} ${label(w.object, w.name)} ${w.by.map((b) => b.step.name).join(" ")}`.toLowerCase().includes(needle)));
  const shown = objects.filter((o) => rows.some((w) => w.object === o));
  return (
    <>
      <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        <Choice value={obj} onChange={setObj} options={[
          { key: "all", label: "All", count: all.length },
          ...objects.map((o) => ({ key: o, label: short(o), count: all.filter((w) => w.object === o).length })),
        ]} />
        <TextField size="small" placeholder="Find a property or step" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ ml: { md: "auto" }, minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
      </Box>
      {!shown.length && <GlassCard><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No property matches.</Typography></GlassCard>}
      {shown.map((o) => {
        const mine = rows.filter((w) => w.object === o);
        return (
          <GlassCard key={o} sx={{ p: { xs: 2, md: 2.5 } }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{short(o)}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{mine.length} {o === OBJECTS.kpi ? "series" : `propert${mine.length === 1 ? "y" : "ies"}`}</Typography>
            </Box>
            <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 2, pb: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ ...headCell, p: 0, border: "none" }}>{o === OBJECTS.kpi ? "Series" : "Property"}</Typography>
              <Typography sx={{ ...headCell, p: 0, border: "none" }}>Written by</Typography>
            </Box>
            {mine.map((w) => {
              const l = label(w.object, w.name);
              return (
                <Box key={w.name} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 0.5, md: 2 }, py: 1, borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: "none" } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{l || w.name}</Typography>
                    {l && <Typography sx={{ fontSize: "0.74rem", fontFamily: "monospace", color: MUTED, overflowWrap: "anywhere" }}>{w.name}</Typography>}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    {w.by.map(({ step, note }) => (
                      <Typography key={step.key} sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.6 }}>
                        {step.name}{note ? <Box component="span" sx={{ color: MUTED, fontSize: "0.76rem" }}> · {note}</Box> : null}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </GlassCard>
        );
      })}
    </>
  );
}

function Associations() {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1 }}>Every kind of link between records the Compass sync creates - and two that nothing keeps up any more.</Typography>
      {ASSOCIATIONS.map((a) => (
        <Box key={`${a.from}-${a.to}-${a.type}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "250px 260px minmax(0,1fr)" }, gap: { xs: 0.25, md: 1.5 }, py: 1, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK }}>{a.from} → {a.to}</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontFamily: "monospace" }}>{a.type}</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: a.by.startsWith("Only the old") ? "#a96a12" : MUTED }}>{a.by}</Typography>
        </Box>
      ))}
    </GlassCard>
  );
}

function Stages() {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1.25 }}>The {ORDER_PIPELINE.name} order pipeline ({ORDER_PIPELINE.id}): the stage each order's ERP status moves it to.</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(5, minmax(0,1fr))" }, gap: 1 }}>
        {ORDER_STAGES.map(([id, name]) => (
          <Box key={id} sx={{ px: 1.25, py: 0.8, borderRadius: "12px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK }}>{name}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontFamily: "monospace" }}>{id}</Typography>
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

export default function WhatItWrites() {
  const [tab, selectTab] = useHashTab<TabId>(TAB_HASH, "properties");
  const count = useMemo(() => writesByProperty().length, []);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="What it writes" subtitle="Every HubSpot property and link the Compass sync writes - one line each, with the steps that write it" />
      <Box>
        <ReportTabs name="writes" tab={tab} onSelect={selectTab} tabs={[
          { id: "properties", label: "Properties", count: String(count) },
          { id: "associations", label: "Associations", count: String(ASSOCIATIONS.length) },
          { id: "stages", label: "Order stages", count: String(ORDER_STAGES.length) },
        ]} />
      </Box>
      {tab === "properties" && <Properties />}
      {tab === "associations" && <Associations />}
      {tab === "stages" && <Stages />}
    </Box>
  );
}
