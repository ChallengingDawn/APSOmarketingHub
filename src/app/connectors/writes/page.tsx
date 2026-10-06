"use client";

// WHAT IT WRITES - every HubSpot property and association the Compass connector
// touches, by object, with the step that writes it. Drawn from the step list,
// which was read from the connector's code - so a step cannot move to the hub
// without this page saying exactly what it takes with it.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { ASSOCIATIONS, ORDER_PIPELINE, ORDER_STAGES, writesByObject } from "@/lib/connectors/compass";
import { Chip, PHASE } from "../parts";

export default function WhatItWrites() {
  const all = useMemo(() => writesByObject(), []);
  const objects = useMemo(() => [...new Set(all.map((w) => w.object))], [all]);
  const [obj, setObj] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = all.filter((w) => (!obj || w.object === obj) && (!q || `${w.prop} ${w.step.name}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="What it writes" subtitle="Every HubSpot property and association the Compass connector touches - the list each step takes with it into the hub" />

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<TableChartOutlinedIcon />} title={`Properties (${rows.length})`}
            note="Read from the connector's code on 06.10.2026 - its own mapping list is out of date and is not used here" />
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
            <Box component="button" onClick={() => setObj(null)} sx={{ all: "unset", cursor: "pointer" }}><Chip tint={obj === null ? "blue" : "slate"}>All objects</Chip></Box>
            {objects.map((o) => (
              <Box key={o} component="button" onClick={() => setObj(o)} sx={{ all: "unset", cursor: "pointer" }}><Chip tint={obj === o ? "blue" : "slate"}>{o}</Chip></Box>
            ))}
            <TextField size="small" placeholder="Find a property" value={q} onChange={(e) => setQ(e.target.value)} sx={{ ml: { md: "auto" }, minWidth: 200 }} />
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>Object</TableCell><TableCell sx={headCell}>Property</TableCell><TableCell sx={headCell}>Written by</TableCell><TableCell sx={headCell}>Runs</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map((w, i) => (
                <TableRow key={`${w.object}-${w.prop}-${w.step.key}-${i}`} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap", color: MUTED }}>{w.object}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontFamily: "monospace", color: INK }}>{w.prop}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{w.step.name}</TableCell>
                  <TableCell sx={bodyCell}><Chip tint={PHASE[w.step.phase].tint}>{PHASE[w.step.phase].label}</Chip></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<LinkOutlinedIcon />} tint="purple" title="Associations" note="Every link between records the connector (or the engines already in the hub) creates - and two nothing keeps up any more" />
        <Box sx={{ display: "grid", gap: 0.6 }}>
          {ASSOCIATIONS.map((a) => (
            <Box key={`${a.from}-${a.to}-${a.type}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 280px minmax(0,1fr)" }, gap: 1.25, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, "&:first-of-type": { borderTop: "none" } }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{a.from} → {a.to}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, fontFamily: "monospace" }}>{a.type}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: a.by.startsWith("Only the old") ? "#a96a12" : MUTED }}>{a.by}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<ViewKanbanOutlinedIcon />} tint="amber" title={`Order stages - ${ORDER_PIPELINE.name} pipeline ${ORDER_PIPELINE.id}`} note="The stage the ERP status moves each order to" />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {ORDER_STAGES.map(([id, name]) => (
            <Box key={id} sx={{ px: 1.25, py: 0.6, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: INK }}>{name}</Typography>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, fontFamily: "monospace" }}>{id}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>
    </Box>
  );
}
