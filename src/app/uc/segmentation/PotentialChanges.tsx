"use client";

// POTENTIAL CHANGES - the sales side of the yearly potential.
//
// A rep's number always wins: the engine never overwrites it, and the priority
// follows it within minutes, up or down. This tab measures that side - who
// changed potentials, by how much, and what it did to the priority - from the
// potential's own history in HubSpot. Our machines' writes are not edits.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import LowPriorityIcon from "@mui/icons-material/LowPriority";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { full } from "@/app/charts/format";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { CardTitle, GlassCard, GREEN, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, eur, headCell } from "@/app/uc/report/ui";
import { CompanyLink, dmy, pctText } from "@/app/uc/oneshot/parts";
import type { EditSource, PotentialEdit } from "@/lib/segmentation/engine";

type Doc = {
  scannedAt: string | null; scanned: number; setters: { person: number; machine: number; empty: number };
  updated: string; edits: PotentialEdit[]; people: Record<string, string>;
};

const SOURCE_LABEL: Record<EditSource, string> = {
  rep: "Typed in HubSpot", bulk: "Bulk edit", workflow: "Visit form (workflow)", import: "Import", merge: "Merge", other: "Other app",
};
const PRIO = (p: string) => (p === "4" ? "No prio" : `P${p}`);
const PER = 25;

function who(e: PotentialEdit, people: Record<string, string>) {
  if (e.userId) return people[e.userId] ?? `user ${e.userId}`;
  return SOURCE_LABEL[e.source];
}

/** Monday of the ISO week, as YYYY-MM-DD. */
function weekOf(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

export function PotentialChanges() {
  const held = useHeld<Doc>("/api/uc/segmentation/edits", []);
  const { window: win, label: periodLabel } = useReportingWindow();
  const [page, setPage] = useState(0);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const inPeriod = useMemo(() => (d?.edits ?? []).filter((e) => e.at.slice(0, 10) >= win.from && e.at.slice(0, 10) <= win.to), [d, win.from, win.to]);
  useEffect(() => setPage(0), [inPeriod]);

  const k = useMemo(() => {
    const companies = new Set(inPeriod.map((e) => e.companyId)).size;
    const raised = inPeriod.filter((e) => (e.value ?? 0) > (e.prev ?? 0));
    const lowered = inPeriod.filter((e) => (e.value ?? 0) < (e.prev ?? 0));
    const net = inPeriod.reduce((a, e) => a + ((e.value ?? 0) - (e.prev ?? 0)), 0);
    const up = inPeriod.filter((e) => e.prioAfter < e.prioBefore).length;
    const down = inPeriod.filter((e) => e.prioAfter > e.prioBefore).length;
    const bySource = (s: EditSource) => inPeriod.filter((e) => e.source === s).length;
    const sales = inPeriod.filter((e) => e.source === "rep" || e.source === "bulk" || e.source === "workflow");
    return {
      companies, raised: raised.length, lowered: lowered.length, net, up, down,
      sales: sales.length, salesCompanies: new Set(sales.map((e) => e.companyId)).size,
      rep: bySource("rep"), bulk: bySource("bulk"), form: bySource("workflow"),
      otherWays: inPeriod.length - sales.length,
    };
  }, [inPeriod]);

  const people = useMemo(() => {
    if (!d) return [];
    const m = new Map<string, { name: string; edits: number; companies: Set<string>; raised: number; lowered: number; net: number; up: number; down: number }>();
    for (const e of inPeriod) {
      const name = who(e, d.people);
      const b = m.get(name) ?? { name, edits: 0, companies: new Set<string>(), raised: 0, lowered: 0, net: 0, up: 0, down: 0 };
      b.edits += 1; b.companies.add(e.companyId);
      if ((e.value ?? 0) > (e.prev ?? 0)) b.raised += 1;
      if ((e.value ?? 0) < (e.prev ?? 0)) b.lowered += 1;
      b.net += (e.value ?? 0) - (e.prev ?? 0);
      if (e.prioAfter < e.prioBefore) b.up += 1;
      if (e.prioAfter > e.prioBefore) b.down += 1;
      m.set(name, b);
    }
    return [...m.values()].sort((a, b) => b.edits - a.edits);
  }, [inPeriod, d]);

  const weeks = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const e of inPeriod) {
      const w = weekOf(e.at);
      const b = m.get(w) ?? { rep: 0, bulk: 0, form: 0, other: 0 };
      const key = e.source === "rep" ? "rep" : e.source === "bulk" ? "bulk" : e.source === "workflow" ? "form" : "other";
      b[key] += 1;
      m.set(w, b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, v]) => ({ x, ...v }));
  }, [inPeriod]);

  if (r === null) return <LoadingPanel label="Reading the potential's history…" />;
  if (r.state !== "ok") return <UpstreamPanel source="Potential changes" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => location.reload()} />;
  if (!d) return null;
  if (!d.scannedAt) {
    return (
      <GlassCard>
        <CardTitle icon={<EditNoteOutlinedIcon />} title="Not measured yet"
          note="The first full scan of the potential's history runs with tonight's recalculation - or now, with its Preview on the Runs tab." />
      </GlassCard>
    );
  }

  const st = d.setters;
  const total = st.person + st.machine + st.empty;
  const rows = inPeriod.slice(page * PER, page * PER + PER);

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EditNoteOutlinedIcon />} label="Changed by sales" value={full(k.sales)}
            note={`${full(k.salesCompanies)} companies · visit form ${full(k.form)} · typed ${full(k.rep)} · bulk ${full(k.bulk)}${k.otherWays ? ` · ${full(k.otherWays)} more by merge / import` : ""}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SwapVertIcon />} tint={k.net >= 0 ? "green" : "pink"} label="Raised / lowered" value={`${full(k.raised)} / ${full(k.lowered)}`}
            note={`net ${k.net >= 0 ? "+" : "−"}${eur(Math.abs(k.net))} EUR of yearly potential`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<LowPriorityIcon />} tint="purple" label="Priority moved" value={`${full(k.up)} ↑ · ${full(k.down)} ↓`}
            note={`up ${full(k.up)} · down ${full(k.down)} - the bucket the new potential gives at today's revenue; the engine follows within minutes`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<VerifiedUserOutlinedIcon />} tint="amber" label="Set by sales today" value={full(st.person)}
            note={`${pctText(st.person, total)} of ${full(total)} companies carry a person's potential - never overwritten · machines ${full(st.machine)} · empty ${full(st.empty)}`} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.5 }}>
        Changes made {dmy(win.from)} to {dmy(win.to)}; &quot;Set by sales today&quot; is the whole portfolio, whatever the period.
      </Typography>

      <GlassCard>
        <CardTitle icon={<BarChartOutlinedIcon />} title="Edits per week" note={`${periodLabel} · by how the value got in`} />
        {weeks.length ? (
          <StackedColumns data={weeks} height={220} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`}
            parts={[{ key: "form", label: "Visit form (workflow)" }, { key: "rep", label: "Typed in HubSpot" }, { key: "bulk", label: "Bulk edit" }, { key: "other", label: "Merge / import / other" }]}
            format={(v) => full(v)} />
        ) : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No potential was changed by a person in this period.</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<PeopleOutlineIcon />} tint="purple" title="By person" note="Who changed potentials in the period, and what it did" />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                {["Person / source", "Edits", "Companies", "Raised", "Lowered", "Net EUR", "Priority up", "Priority down"].map((h, i) => (
                  <TableCell key={h} sx={headCell} align={i ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {people.map((p) => (
                <TableRow key={p.name} hover>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{p.name}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.edits)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.companies.size)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.raised)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.lowered)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, color: p.net >= 0 ? GREEN : RED }} align="right">{p.net >= 0 ? "+" : "−"}{eur(Math.abs(p.net))}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.up)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.down)}</TableCell>
                </TableRow>
              ))}
              {!people.length && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, color: MUTED }}>Nobody changed a potential in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ListAltIcon />} tint="slate" title="Every change" note="Newest first - the old and new potential, and the priority before and after" />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                {["When", "Company", "By", "Before EUR", "After EUR", "Priority", "How", ""].map((h, i) => (
                  <TableCell key={i} sx={headCell} align={i === 3 || i === 4 ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((e) => {
                const moved = e.prioAfter !== e.prioBefore;
                return (
                  <TableRow key={`${e.companyId}-${e.at}`} hover>
                    <TableCell sx={{ ...bodyCell, color: MUTED, whiteSpace: "nowrap" }}>{e.at.slice(0, 10)} {e.at.slice(11, 16)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, ...clip(260) }} title={e.name}>{e.name || e.companyId}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{who(e, d.people)}</TableCell>
                    <TableCell sx={{ ...bodyCell, color: MUTED, fontVariantNumeric: "tabular-nums" }} align="right">{e.prev === null ? "—" : eur(e.prev)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: (e.value ?? 0) >= (e.prev ?? 0) ? GREEN : RED }} align="right">{e.value === null ? "cleared" : eur(e.value)}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Chip size="small" label={moved ? `${PRIO(e.prioBefore)} → ${PRIO(e.prioAfter)}` : PRIO(e.prioAfter)}
                        sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: moved ? (e.prioAfter < e.prioBefore ? TINT.green.bg : TINT.pink.bg) : TINT.slate.bg, color: moved ? (e.prioAfter < e.prioBefore ? TINT.green.fg : TINT.pink.fg) : TINT.slate.fg }} />
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{SOURCE_LABEL[e.source]}</TableCell>
                    <TableCell sx={bodyCell} align="right"><CompanyLink id={e.companyId} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        <TablePagination component="div" count={inPeriod.length} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={PER} rowsPerPageOptions={[PER]} sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
      </GlassCard>

      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        From the potential&apos;s own history in HubSpot - a person&apos;s edit, a bulk edit, a form a workflow copied, an import or a merge; the engine&apos;s writes are not counted.
        Full scan {d.scannedAt.slice(0, 16).replace("T", " ")} UTC ({full(d.scanned)} companies, every night with the recalculation); new edits are added by the watcher within about two minutes.
      </Typography>
    </Box>
  );
}
