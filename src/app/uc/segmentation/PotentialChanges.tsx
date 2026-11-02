"use client";

// POTENTIAL CHANGES - the sales side of the yearly potential.
//
// A person's number always wins: the engine never overwrites it, and the priority
// follows it within minutes, up or down. This tab measures that side from the
// potential's own history in HubSpot - who changed it, by how much, and what it
// did to the priority. A workflow's write is a VISIT REPORT when a customer visit
// on the same company lands within two hours (its owner is the person); otherwise
// it is another workflow with no person on record. Mass updates (hundreds in a
// day from one source) are shown apart: they are not sales input. The tables and the companies window are the reporting
// pages' (SARCLA 02.11.2026: "you don't have the button on the modal and the design changes from page to page").

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import LowPriorityIcon from "@mui/icons-material/LowPriority";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { full } from "@/app/charts/format";
import { useReportingWindow } from "@/app/window/ReportingWindow";
import { CardTitle, GlassCard, GREEN, KpiTile, MUTED, RED, TINT, eur, type Tint } from "@/app/uc/report/ui";
import { dmy, pctText } from "@/app/uc/oneshot/parts";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { ChartBox } from "@/app/reporting/eso-benchmark/Figures";
import { CompanyDialog, type CompanySource } from "@/app/reporting/CompanyList";
import { ListCard } from "./lists";
import { editDelta, isAbsurd, type EditSource, type PotentialEdit } from "@/lib/segmentation/engine";

type Doc = {
  scannedAt: string | null; scanned: number; setters: { person: number; machine: number; empty: number };
  updated: string; edits: PotentialEdit[]; people: Record<string, string>; owners: Record<string, string>; visitsMatched: boolean;
};

const HOW: Record<EditSource, { label: string; tint: Tint }> = {
  visit: { label: "Visit workflow", tint: "blue" },
  rep: { label: "Typed in HubSpot", tint: "green" },
  bulk: { label: "Bulk edit", tint: "purple" },
  workflow: { label: "Visit workflow", tint: "blue" },
  merge: { label: "Merge", tint: "slate" },
  import: { label: "Import", tint: "slate" },
  other: { label: "Other app", tint: "slate" },
};
const PRIO = (p: string) => (p === "4" ? "No prio" : `P${p}`);
const NOBODY = "No person on record";
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

/** The "how" counts by what the page calls them - the two visit-workflow kinds are one. */
function byLabel(how: Partial<Record<EditSource, number>>): [string, number, Tint][] {
  const m = new Map<string, [number, Tint]>();
  for (const [s, n] of Object.entries(how) as [EditSource, number][]) {
    const cur = m.get(HOW[s].label);
    m.set(HOW[s].label, [(cur?.[0] ?? 0) + n, HOW[s].tint]);
  }
  return [...m.entries()].map(([l, [n, t]]) => [l, n, t] as [string, number, Tint]).sort((a, b) => b[1] - a[1]);
}

const signedEur = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(n))}`;

function HowChip({ s }: { s: EditSource }) {
  const t = TINT[HOW[s].tint];
  return <Chip size="small" label={HOW[s].label} sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, bgcolor: t.bg, color: t.fg }} />;
}

/** Changes of the potential as the companies window lists them - the company first, its name to HubSpot. */
function editsSource(rows: PotentialEdit[], d: Doc, key: string, note: string): CompanySource {
  return {
    key, note, head: ["When", "Who", "How", "Before EUR", "After EUR", "Priority"], left: [2, 3, 6],
    rows: () => rows.map((e) => {
      const moved = e.prioAfter !== e.prioBefore, who = person(e, d), dl = editDelta(e);
      return {
        id: e.companyId, name: e.name || e.companyId,
        cells: [
          `${dmy(e.at.slice(0, 10))} ${e.at.slice(11, 16)}`, who ?? "—", <HowChip key="h" s={e.source} />, e.prev === null ? "—" : eur(e.prev),
          <Box key="v" component="span" title={isAbsurd(e) ? "over 1 M € - left out of every sum" : undefined} sx={{ fontWeight: 700, color: isAbsurd(e) ? MUTED : dl >= 0 ? GREEN : RED }}>{e.value === null ? "cleared" : eur(e.value)}{isAbsurd(e) ? " *" : ""}</Box>,
          <Chip key="p" size="small" label={moved ? `${PRIO(e.prioBefore)} → ${PRIO(e.prioAfter)}` : PRIO(e.prioAfter)}
            sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: moved ? (e.prioAfter < e.prioBefore ? TINT.green.bg : TINT.pink.bg) : TINT.slate.bg, color: moved ? (e.prioAfter < e.prioBefore ? TINT.green.fg : TINT.pink.fg) : TINT.slate.fg }} />,
        ],
        values: [e.at, who, HOW[e.source].label, e.prev, e.value, `${e.prioBefore}${e.prioAfter}`],
      };
    }),
  };
}

export function PotentialChanges() {
  const held = useHeld<Doc>("/api/uc/segmentation/edits", []);
  const { window: win, label: periodLabel } = useReportingWindow();
  const [pick, setPick] = useState<{ key: string; label: string; rows: PotentialEdit[] } | null>(null);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  const all = useMemo(() => (d?.edits ?? []).filter((e) => e.at.slice(0, 10) >= win.from && e.at.slice(0, 10) <= win.to), [d, win.from, win.to]);
  const inPeriod = useMemo(() => all.filter((e) => !e.mass), [all]);

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
    type Row = { name: string; edits: number; companies: Set<string>; raised: number; lowered: number; net: number; up: number; down: number; how: Partial<Record<EditSource, number>>; list: PotentialEdit[] };
    const m = new Map<string, Row>();
    for (const e of inPeriod) {
      const name = person(e, d) ?? NOBODY;
      const b = m.get(name) ?? { name, edits: 0, companies: new Set<string>(), raised: 0, lowered: 0, net: 0, up: 0, down: 0, how: {}, list: [] };
      b.edits += 1; b.companies.add(e.companyId); b.list.push(e);
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
      const b = m.get(w) ?? { visit: 0, rep: 0, bulk: 0, other: 0 };
      const key = e.source === "visit" || e.source === "workflow" ? "visit" : e.source === "rep" || e.source === "bulk" ? e.source : "other";
      b[key] += 1;
      m.set(w, b);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, v]) => ({ x, ...v }));
  }, [inPeriod]);

  const massUpdates = useMemo(() => {
    if (!d) return [];
    const m = new Map<string, { key: string; day: string; source: EditSource; who: string | null; n: number; cleared: number; net: number; edits: PotentialEdit[] }>();
    for (const e of all.filter((x) => x.mass)) {
      const key = `${e.at.slice(0, 10)}|${e.source}|${e.userId ?? ""}`;
      const b = m.get(key) ?? { key, day: e.at.slice(0, 10), source: e.source, who: person(e, d), n: 0, cleared: 0, net: 0, edits: [] };
      b.n += 1; b.edits.push(e);
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
  const changes = editsSource(inPeriod, d, `edits|${win.from}|${win.to}|${inPeriod.length}`, `${periodLabel}, newest first - mass updates left out`);

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiTile icon={<EditNoteOutlinedIcon />} label="Changed by sales" value={full(k.sales)}
            note={`${full(k.companies)} companies · visit workflow ${full(k.visit + k.workflow)} · typed ${full(k.rep)} · bulk ${full(k.bulk)}`} />
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

      <ChartBox title="Changes per week" hint={`${periodLabel} · how each value got in · mass updates left out`} companies={inPeriod.length ? changes : null}>
        {weeks.length ? (
          <StackedColumns data={weeks} height={240} xFormat={(x) => `${x.slice(8, 10)}.${x.slice(5, 7)}`}
            parts={[{ key: "visit", label: "Visit workflow" }, { key: "rep", label: "Typed in HubSpot" }, { key: "bulk", label: "Bulk edit" }]}
            format={(v) => full(v)} />
        ) : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No potential was changed by sales in this period.</Typography>}
      </ChartBox>

      <ChartBox title={`By person (${full(people.filter((p) => p.name !== NOBODY).length)})`}
        hint="The visit's owner for a change through the visit workflow (when the visit is on record), the user for a typed or bulk change · a click on a person lists the companies"
        companies={inPeriod.length ? changes : null}>
        {people.length ? (
          <Table head={["Person", "Changes", "Companies", "Raised", "Lowered", "Net EUR", "Priority ↑", "Priority ↓", "How"]} left={[8]} pageSize={PER_PEOPLE} minWidth={980}
            firstWidth="minmax(180px, 1.4fr)" widths={[...Array(7).fill("minmax(84px, 0.7fr)"), "minmax(200px, 1.6fr)"]}
            rows={people.map((p) => ({
              key: p.name, on: pick?.key === `person|${p.name}`, onPick: () => setPick({ key: `person|${p.name}`, label: `Changed by ${p.name}`, rows: p.list }),
              cells: [
                <Box key="n" component="span" sx={{ color: p.name === NOBODY ? MUTED : undefined, fontStyle: p.name === NOBODY ? "italic" : "normal" }}>{p.name}</Box>,
                full(p.edits), full(p.companies.size), full(p.raised), full(p.lowered),
                <Box key="net" component="span" sx={{ fontWeight: 700, color: p.net >= 0 ? GREEN : RED }}>{signedEur(p.net)}</Box>,
                full(p.up), full(p.down),
                <Box key="how" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {byLabel(p.how).map(([label, n, tint]) => (
                    <Chip key={label} size="small" label={`${label} ${full(n)}`} sx={{ height: 20, fontSize: "0.66rem", fontWeight: 600, bgcolor: TINT[tint].bg, color: TINT[tint].fg }} />
                  ))}
                </Box>,
              ],
            }))} />
        ) : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nobody changed a potential in this period.</Typography>}
      </ChartBox>

      {inPeriod.length > 0 && <ListCard title="Every change" hint="Newest first - who, the old and new potential, and the priority before and after · a click on a column orders by it" source={changes} />}

      {massUpdates.length > 0 && (
        <ChartBox title="Mass updates - not sales input" hint={`One source changing more than 200 potentials in a day. Left out of everything above. ${periodLabel} · a click on a row lists its companies`}>
          <Table head={["Day", "How", "Who", "Changes", "Cleared or set to 0", "Net EUR"]} left={[1, 2]} firstWidth="minmax(110px, 0.8fr)" minWidth={680}
            rows={massUpdates.map((m) => ({
              key: m.key, on: pick?.key === `mass|${m.key}`, onPick: () => setPick({ key: `mass|${m.key}`, label: `Mass update ${dmy(m.day)}${m.who ? `, ${m.who}` : ""}`, rows: m.edits }),
              cells: [dmy(m.day), <HowChip key="h" s={m.source} />, m.who ?? "—", full(m.n), full(m.cleared),
                <Box key="net" component="span" sx={{ color: m.net >= 0 ? GREEN : RED }}>{signedEur(m.net)}</Box>],
            }))} />
        </ChartBox>
      )}

      {pick && <CompanyDialog source={editsSource(pick.rows, d, pick.key, `${periodLabel}, newest first`)} title={pick.label} onClose={() => setPick(null)} />}

      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        From the potential&apos;s own history in HubSpot; the engine&apos;s own writes are not changes, and a value written again unchanged is not counted.
        The visit workflow&apos;s person is the owner of the customer visit on the same company within two hours; without such a visit on record no person is shown. * values over 1 M € are typos or merge artefacts - shown, never summed.
        Full scan {d.scannedAt.slice(0, 16).replace("T", " ")} UTC ({full(d.scanned)} companies, every night with the recalculation); new changes are added by the watcher within about two minutes.
      </Typography>
    </Box>
  );
}
