"use client";

// SMART SEGMENTATION - Profit center's KPIs (SARCLA 02.11.2026: "profit center should also have KPIs"). How many companies
// hold each major profit centre and each split, as HubSpot has them now (held 3 hours): who ordered at all, from one
// centre, from two, from three or more; a click on a bar opens its companies in the reporting pages' window, the button
// beside a chart all of them. Reads /api/uc/segmentation/companies?mix=pc.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import LooksOneOutlinedIcon from "@mui/icons-material/LooksOneOutlined";
import LooksTwoOutlinedIcon from "@mui/icons-material/LooksTwoOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { TWO } from "@/app/reporting/eso-benchmark/Figures";
import { CompanyDialog } from "@/app/reporting/CompanyList";
import { KpiTile, MUTED, RED } from "@/app/uc/report/ui";
import { when } from "@/app/connectors/parts";
import { splitKind, type PcMix } from "@/lib/segmentation/companies";
import { hubSource } from "./lists";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
/** the profit centres' codes in words (memory: reference_apso_profit_centers) */
const CENTRE: Record<string, string> = { DT: "DT · sealing", KT: "KT · plastics", FT: "FT · hoses and fluid", ST: "ST · anti-vibration", AT: "AT · drive belts" };
const centre = (v: string) => (v ? CENTRE[v] ?? v : "Not worked out yet");
type Pick = { kind: "major" | "split"; value: string; label: string };

export function ProfitCentreKpis() {
  const r = useHeld<PcMix & { refreshing?: boolean }>("/api/uc/segmentation/companies?mix=pc", ["pc-mix"]).result;
  const [pick, setPick] = useState<Pick | null>(null);
  if (r === null) return <LoadingPanel label="Counting the companies per profit centre in HubSpot - only the very first time, then kept…" />;
  if (r.state !== "ok") return <Typography sx={{ color: RED, fontSize: "0.86rem" }}>{r.state === "error" ? r.error : "not configured"}</Typography>;
  const m = r.data;
  const kinds: Record<string, number> = {};
  for (const s of m.split) kinds[splitKind(s.value)] = (kinds[splitKind(s.value)] ?? 0) + s.n;
  const ordered = (kinds.one ?? 0) + (kinds.two ?? 0) + (kinds.more ?? 0);
  const majors = m.major.map((x) => ({ id: x.value, label: centre(x.value), n: x.n }));
  const splits = m.split.map((x) => ({ id: x.value, label: x.value || "Not worked out yet", n: x.n }));
  const choose = (kind: Pick["kind"], rows: { id: string; label: string }[]) => (l: string) => {
    const x = rows.find((y) => y.label === l);
    if (!x) return;
    setPick({ kind, value: x.id, label: l });
  };
  const all = hubSource({});
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ShoppingCartOutlinedIcon />} tint="blue" label="Ordered" value={full(ordered)}
          note={`${pct(ordered, m.total)} of the ${full(m.total)} companies have orders with a profit centre; ${full(kinds.none ?? 0)} never ordered${kinds.empty ? `, ${full(kinds.empty)} not worked out yet` : ""}.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LooksOneOutlinedIcon />} tint="green" label="Mostly one centre" value={full(kinds.one ?? 0)}
          note={`${pct(kinds.one ?? 0, ordered)} of those who ordered: over 80 % from one profit centre.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LooksTwoOutlinedIcon />} tint="amber" label="Two centres" value={full(kinds.two ?? 0)}
          note={`${pct(kinds.two ?? 0, ordered)} of those who ordered: a major centre, then one other.`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<HubOutlinedIcon />} tint="purple" label="Three or more" value={full(kinds.more ?? 0)}
          note={`${pct(kinds.more ?? 0, ordered)} of those who ordered: a major centre, then a mix - or no major at all.`} /></Grid>
      </Grid>
      <Box sx={TWO}>
        <DimChart title="Major profit centre, every company" rows={majors} cur={(x) => x.n} prev={() => 0} curLabel="Companies" prevLabel="" fmt={full} labelWidth={180} single
          curNote={(x) => ({ text: pct(x.n, m.total), color: MUTED })} selected={pick?.kind === "major" ? [pick.label] : undefined} onPick={choose("major", majors)}
          pickHint="A click on a bar lists its companies" companies={all} />
        <DimChart title="The split, every company" rows={splits} cur={(x) => x.n} prev={() => 0} curLabel="Companies" prevLabel="" fmt={full} labelWidth={230} single
          curNote={(x) => ({ text: pct(x.n, m.total), color: MUTED })} selected={pick?.kind === "split" ? [pick.label] : undefined} onPick={choose("split", splits)}
          pickHint="A click on a bar lists its companies" companies={all} />
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: -1 }}>
        As HubSpot has them, counted {when(m.at)}{r.data.refreshing ? " - being counted again now" : ""} - the split is taken from every order&apos;s revenue per profit centre, every night for the companies whose revenue moved.
      </Typography>
      {pick && <CompanyDialog source={hubSource(pick.kind === "major" ? { major: pick.value } : { split: pick.value })} title={pick.kind === "major" ? `Major profit centre: ${pick.label}` : `Split: ${pick.label}`} onClose={() => setPick(null)} />}
    </>
  );
}
