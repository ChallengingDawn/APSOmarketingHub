"use client";

// WHAT IT WRITES - every HubSpot property and association the Compass connector
// touches, with the step that writes it. Three tabs, one list each: properties
// (filter by object, search, 15 a page), associations, order stages. Drawn from
// the step list, which was read from the connector's code.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { GlassCard, HAIRLINE, INK, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { ASSOCIATIONS, ORDER_PIPELINE, ORDER_STAGES, writesByObject } from "@/lib/connectors/compass";
import { Chip, Choice, PHASE, usePaged } from "../parts";

type TabId = "properties" | "associations" | "stages";
const TAB_HASH: Record<TabId, string> = { properties: "#properties", associations: "#associations", stages: "#stages" };
const short = (o: string) => o.replace(/ \(.*\)$/, "");

function Properties() {
  const all = useMemo(() => writesByObject(), []);
  const objects = useMemo(() => [...new Set(all.map((w) => w.object))], [all]);
  const [obj, setObj] = useState<string>("all");
  const [q, setQ] = useState("");
  const rows = all.filter((w) => (obj === "all" || w.object === obj) && (!q || `${w.prop} ${w.step.name}`.toLowerCase().includes(q.toLowerCase())));
  const { slice, pager, setPage } = usePaged(rows, 15);
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        <Choice value={obj} onChange={(k) => { setObj(k); setPage(0); }} options={[
          { key: "all", label: "All", count: all.length },
          ...objects.map((o) => ({ key: o, label: short(o), count: all.filter((w) => w.object === o).length })),
        ]} />
        <TextField size="small" placeholder="Find a property" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
          sx={{ ml: { md: "auto" }, minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 640 }}>
          <TableHead><TableRow>
            <TableCell sx={headCell}>Property</TableCell><TableCell sx={headCell}>Object</TableCell><TableCell sx={headCell}>Written by</TableCell><TableCell sx={headCell}>Runs</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {slice.map((w, i) => (
              <TableRow key={`${w.object}-${w.prop}-${w.step.key}-${i}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace", color: INK }}>{w.prop}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{short(w.object)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{w.step.name}</TableCell>
                <TableCell sx={bodyCell}><Chip tint={PHASE[w.step.phase].tint}>{PHASE[w.step.phase].label}</Chip></TableCell>
              </TableRow>
            ))}
            {!slice.length && (
              <TableRow><TableCell colSpan={4} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem", py: 3, textAlign: "center" }}>No property matches.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </GlassCard>
  );
}

function Associations() {
  return (
    <GlassCard>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mb: 1 }}>Every kind of link between records the connector creates - and two that nothing keeps up any more.</Typography>
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
  const count = useMemo(() => writesByObject().length, []);
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="What it writes" subtitle="Every HubSpot property and association the Compass connector touches" />
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
