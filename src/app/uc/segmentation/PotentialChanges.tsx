"use client";

// POTENTIAL CHANGES - the sales side of the yearly potential.
//
// A person's number always wins: the engine never overwrites it, and the priority
// follows it within minutes, up or down. This tab measures that side from the
// potential's own history in HubSpot - who changed it, by how much, and what it
// did to the priority. A workflow's write is a VISIT REPORT when a customer visit
// on the same company lands within two hours (its owner is the person); otherwise
// it is another workflow with no person on record. Mass updates (hundreds in a
// day from one source) are shown apart: they are not sales input.

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
import LayersClearOutlinedIcon from "@mui/icons-material/LayersClearOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { full } from "@/app/charts/format";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { CardTitle, GlassCard, GREEN, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, clip, eur, headCell, type Tint } from "@/app/uc/report/ui";
import { CompanyLink, dmy, pctText } from "@/app/uc/oneshot/parts";
import { editDelta, isAbsurd, type EditSource, type PotentialEdit } from "@/lib/segmentation/engine";

type Doc = {
  scannedAt: string | null; scanned: number; setters: { person: number; machine: number; empty: number };
  updated: string; edits: PotentialEdit[]; people: Record<string, string>; owners: Record<string, string>; visitsMatched: boolean;
};

const HOW: Record<EditSource, { label: string; tint: Tint }> = {
  visit: { label: "Visit report", tint: "blue" },
  rep: { label: "Typed in HubSpot", tint: "green" },
  bulk: { label: "Bulk edit", tint: "purple" },
  workflow: { label: "Other workflow", tint: "amber" },
  merge: { label: "Merge", tint: "slate" },
  import: { label: "Import", tint: "slate" },
  other: { label: "Other app", tint: "slate" },
};
const PRIO = (p: string) => (p === "4" ? "No prio" : `P${p}`);
const NOBODY = "No person on record";
const PER_ROWS = 25;
const PER_PEOPLE = 10;

/** The person behind a change - the user who typed or bulk-edited, or the visit's owner. */
function person(e: PotentialEdit, d: Doc): string | null {
  if ((e.source === "rep" || e.source === "bulk") && e.userId) return d.people[e.userId] ?? `user ${e.userId}`;
  if (e.source === "visit" && e.visitOwnerId) return d.owners[e.visitOwnerId] ?? `owner ${e.visitOwnerId}`;
  return null;
}

/** Monday of the ISO week, as YYYY-MM-DD. */
function weekOf(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
}

const signedEur = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(n))}`;

function HowChip({ s }: { s: EditSource }) {
  const t = TINT[HOW[s].tint];
  return <Chip size="small" label={HOW[s].label} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: t.bg, color: t.fg }} />;
}

export function PotentialChanges() {
  const held = useHeld<Doc>("/api/uc/segmentation/edits", []);
  const { window: win, label: periodLabel } = useReportingWindow();
  const [page, setPage] = useState(0);
  const [pPage, setPPage] = useState(0);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const all = useMemo(() => (d?.edits ?? []).filter((e) => e.at.slice(0, 10) >= win.from && e.at.slice(0, 10) <= win.to), [d, win.from, win.to]);
  const inPeriod = useMemo(() => all.filter((e) => !e.mass), [all]);
  useEffect(() => { setPage(0); setPPage(0); }, [inPeriod]);

  const k = useMemo(() => {
    const sales = inPeriod.filter((e) => e.source === "visit" || e.source === "rep" || e.source === "bulk" || e.source === "workflow");
    const by = (s: EditSource) => sales.filter((e) => e.source === s).length;
    return {
      sales: sales.length,
      companies: new Set(sales.map((e) => e.companyId)).size,
      visit: by("visit"), rep: by("rep"), bulk: by("bulk"), workflow: by("workflow"),
      withPerson: d ? sales.filter((e) => person(e, d)).length : 0,
      raised: sales.filter((e) => editDelta(e) > 0).length,
      lowered: sales.filter((e) => editDelta(e) < 0).length,
      net: sales.reduce((a, e) => a + editDelta(e), 0),
      absurd: sales.filter(isAbsurd).length,
      up: sales.filter((e) => e.prioAfter < e.prioBefore).length,
      down: sales.filter((e) => e.prioAfter > e.prioBefore).length,
    };
  }, [inPeriod, d]);

  const people = useMemo(() => {
    if (!d) return [];
    type Row = { name: string; edits: number; companies: Set<string>; raised: number; lowered: number; net: number; up: number; down: number; how: Partial<Record<EditSource, number>> };
    const m = new Map<string, Row>();
    for (const e of inPeriod) {
      const name = person(e, d) ?? NOBODY;
      const b = m.get(name) ?? { name, edits: 0, companies: new Set<string>(), raised: 0, lowered: 0, net: 0, up: 0, down: 0, how: {} };
      b.edits += 1; b.companies.add(e.companyId);
      const dl = editDelta(e);
      if (dl > 0) b.raised += 1;
      if (dl < 0) b.lowered += 1;
      b.net += dl;
      if (e.prioAfter < e.prioBefore) b.up += 1;
      if (e.prioAfter > e.prioBefore) b.down += 1;
      b.how[e.source] = (b.how[e.source] ?? 0) + 1;
      m.set(name, b);
    }
    // people first by how much they changed; the unattributed bucket last
    return [...m.values()].sort((a, b) => (a.name === NOBODY ? 1 : b.name === NOBODY ? -1 : b.edits - a.edits));
  }, [inPeriod, d]);

  const weeks = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const e of inPeriod) {
      const w = weekOf(e.at);
      const b = m.get(w) ?? { visit: 0, rep: 0, bulk: 0, workflow: 0, other: 0 };
      const key = e.source === "visit" || e.source === "rep" || e.source === "bulk" || e.source === "workflow" ? e.source : "other";
      b[key] += 1;
      m.set(w, b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, v]) => ({ x, ...v }));
  }, [inPeriod]);

  const massUpdates = useMemo(() => {
    if (!d) return [];
    const m = new Map<string, { day: string; source: EditSource; who: string | null; n: number; cleared: number; net: number }>();
    for (const e of all.filter((x) => x.mass)) {
      const key = `${e.at.slice(0, 10)}|${e.source}|${e.userId ?? ""}`;
      const b = m.get(key) ?? { day: e.at.slice(0, 10), source: e.source, who: person(e, d), n: 0, cleared: 0, net: 0 };
      b.n += 1;
      if (e.value === null || e.value === 0) b.cleared += 1;
      b.net += editDelta(e);
      m.set(key, b);
    }
    return [...m.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [all, d]);

  if (r === null) return <LoadingPanel label="Reading the potential's history and the customer visits…" />;
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
  const rows = inPeriod.slice(page * PER_ROWS, page * PER_ROWS + PER_ROWS);
  const peopleRows = people.slice(pPage * PER_PEOPLE, pPage * PER_PEOPLE + PER_PEOPLE);

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EditNoteOutlinedIcon />} label="Changed by sales" value={full(k.sales)}
            note={`${full(k.companies)} companies · visit reports ${full(k.visit)} · typed ${full(k.rep)} · bulk ${full(k.bulk)} · other workflows ${full(k.workflow)}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<SwapVertIcon />} tint={k.net >= 0 ? "green" : "pink"} label="Raised / lowered" value={`${full(k.raised)} / ${full(k.lowered)}`}
            note={`net ${signedEur(k.net)} EUR of yearly potential${k.absurd ? ` · ${full(k.absurd)} values over 1 M € left out` : ""}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<LowPriorityIcon />} tint="purple" label="Priority moved" value={`${full(k.up)} ↑ · ${full(k.down)} ↓`}
            note="the bucket the new potential gives at today's revenue; the engine follows within minutes" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<VerifiedUserOutlinedIcon />} tint="amber" label="Set by sales today" value={full(st.person)}
            note={`${pctText(st.person, total)} of ${full(total)} companies carry a person's potential - never overwritten · engine ${full(st.machine)} · empty ${full(st.empty)}`} />
        </Grid>
      </Grid>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.5 }}>
        Changes made {dmy(win.from)} to {dmy(win.to)}, mass updates left out{massUpdates.length ? ` (${full(massUpdates.reduce((a, m) => a + m.n, 0))} changes in ${massUpdates.length} - see below)` : ""};
        {" "}{full(k.withPerson)} of {full(k.sales)} have a person on record. &quot;Set by sales today&quot; is the whole portfolio, whatever the period.
        {!d.visitsMatched && " The customer visits could not be read, so visit reports show as other workflows."}
      </Typography>

      <GlassCard>
        <CardTitle icon={<BarChartOutlinedIcon />} title="Changes per week" note={`${periodLabel} · how each value got in · mass updates left out`} />
        {weeks.length ? (
          <StackedColumns data={weeks} height={240} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`}
            parts={[{ key: "visit", label: "Visit report" }, { key: "workflow", label: "Other workflow" }, { key: "rep", label: "Typed in HubSpot" }, { key: "bulk", label: "Bulk edit" }]}
            format={(v) => full(v)} />
        ) : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No potential was changed by sales in this period.</Typography>}
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<PeopleOutlineIcon />} tint="purple" title={`By person (${full(people.filter((p) => p.name !== NOBODY).length)})`}
            note="The visit's owner for a visit report, the user for a typed or bulk change - and what their changes did" />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                {["Person", "Changes", "Companies", "Raised", "Lowered", "Net EUR", "Priority ↑", "Priority ↓", "How"].map((h, i) => (
                  <TableCell key={h} sx={headCell} align={i && i < 8 ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {peopleRows.map((p) => (
                <TableRow key={p.name} hover>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, color: p.name === NOBODY ? MUTED : INK, whiteSpace: "nowrap", fontStyle: p.name === NOBODY ? "italic" : "normal" }}>{p.name}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.edits)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.companies.size)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.raised)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.lowered)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontWeight: 600, color: p.net >= 0 ? GREEN : RED, whiteSpace: "nowrap" }} align="right">{signedEur(p.net)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.up)}</TableCell>
                  <TableCell sx={bodyCell} align="right">{full(p.down)}</TableCell>
                  <TableCell sx={bodyCell}>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {(Object.entries(p.how) as [EditSource, number][]).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                        <Chip key={s} size="small" label={`${HOW[s].label} ${full(n)}`}
                          sx={{ height: 20, fontSize: "0.66rem", fontWeight: 600, bgcolor: TINT[HOW[s].tint].bg, color: TINT[HOW[s].tint].fg }} />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!people.length && <TableRow><TableCell colSpan={9} sx={{ ...bodyCell, color: MUTED }}>Nobody changed a potential in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
        <TablePagination component="div" count={people.length} page={pPage} onPageChange={(_, p) => setPPage(p)}
          rowsPerPage={PER_PEOPLE} rowsPerPageOptions={[PER_PEOPLE]} sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.75 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ListAltIcon />} tint="slate" title="Every change" note="Newest first - who, the old and new potential, and the priority before and after" />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 960 }}>
            <TableHead>
              <TableRow>
                {["When", "Company", "Who", "How", "Before EUR", "After EUR", "Priority", ""].map((h, i) => (
                  <TableCell key={i} sx={headCell} align={i === 4 || i === 5 ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((e) => {
                const moved = e.prioAfter !== e.prioBefore;
                const who = person(e, d);
                const dl = editDelta(e);
                return (
                  <TableRow key={`${e.companyId}-${e.at}`} hover>
                    <TableCell sx={{ ...bodyCell, color: MUTED, whiteSpace: "nowrap" }}>{dmy(e.at.slice(0, 10))} {e.at.slice(11, 16)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, color: INK, ...clip(240) }} title={e.name}>{e.name || e.companyId}</TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: who ? INK : MUTED }}>{who ?? "—"}</TableCell>
                    <TableCell sx={bodyCell}><HowChip s={e.source} /></TableCell>
                    <TableCell sx={{ ...bodyCell, color: MUTED, fontVariantNumeric: "tabular-nums" }} align="right">{e.prev === null ? "—" : eur(e.prev)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isAbsurd(e) ? MUTED : dl >= 0 ? GREEN : RED }} align="right"
                      title={isAbsurd(e) ? "over 1 M € - left out of every sum" : undefined}>
                      {e.value === null ? "cleared" : eur(e.value)}{isAbsurd(e) ? " *" : ""}
                    </TableCell>
                    <TableCell sx={bodyCell}>
                      <Chip size="small" label={moved ? `${PRIO(e.prioBefore)} → ${PRIO(e.prioAfter)}` : PRIO(e.prioAfter)}
                        sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: moved ? (e.prioAfter < e.prioBefore ? TINT.green.bg : TINT.pink.bg) : TINT.slate.bg, color: moved ? (e.prioAfter < e.prioBefore ? TINT.green.fg : TINT.pink.fg) : TINT.slate.fg }} />
                    </TableCell>
                    <TableCell sx={bodyCell} align="right"><CompanyLink id={e.companyId} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        <TablePagination component="div" count={inPeriod.length} page={page} onPageChange={(_, p) => setPage(p)}
          rowsPerPage={PER_ROWS} rowsPerPageOptions={[PER_ROWS]} sx={{ borderTop: `1px solid ${HAIRLINE}`, color: MUTED }} />
      </GlassCard>

      {massUpdates.length > 0 && (
        <GlassCard>
          <CardTitle icon={<LayersClearOutlinedIcon />} tint="amber" title="Mass updates - not sales input"
            note={`One source changing more than 200 potentials in a day. Left out of everything above. ${periodLabel}.`} />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  {["Day", "How", "Who", "Changes", "Cleared or set to 0", "Net EUR"].map((h, i) => (
                    <TableCell key={h} sx={headCell} align={i >= 3 ? "right" : "left"}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {massUpdates.map((m) => (
                  <TableRow key={`${m.day}-${m.source}-${m.who}`}>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{dmy(m.day)}</TableCell>
                    <TableCell sx={bodyCell}><HowChip s={m.source} /></TableCell>
                    <TableCell sx={{ ...bodyCell, color: m.who ? INK : MUTED }}>{m.who ?? "—"}</TableCell>
                    <TableCell sx={bodyCell} align="right">{full(m.n)}</TableCell>
                    <TableCell sx={bodyCell} align="right">{full(m.cleared)}</TableCell>
                    <TableCell sx={{ ...bodyCell, color: m.net >= 0 ? GREEN : RED }} align="right">{signedEur(m.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </GlassCard>
      )}

      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        From the potential&apos;s own history in HubSpot; the engine&apos;s own writes are not changes, and a value written again unchanged is not counted.
        A workflow&apos;s write within two hours of a customer visit on the same company counts as that visit&apos;s report. * values over 1 M € are typos or merge artefacts - shown, never summed.
        Full scan {d.scannedAt.slice(0, 16).replace("T", " ")} UTC ({full(d.scanned)} companies, every night with the recalculation); new changes are added by the watcher within about two minutes.
      </Typography>
    </Box>
  );
}
