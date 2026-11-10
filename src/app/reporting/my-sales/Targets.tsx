"use client";
// MY SALES REPORTS > TARGETS (SARCLA 01.11.2026: "introduce the file VPP ESO 2026 BORJER - these are the sales targets;
// don't put the target, allow the sales to set its own target percentage; understand the file, how it's calculated, then
// display"; "filter by My Target | My Team Targets | All ESO - on the last two don't show the target but rather the
// contribution"). His picks: targets only (no pay, no bonus), set by the person themselves or an admin, as the sheet
// has them (a growth on last year for three revenues, an amount, a number of visits); the switch from the hierarchy
// (./shared.tsx); the team views as one table. The rules: src/lib/reporting/mySalesRules.ts; the figures: src/lib/reporting/mySalesFigures.ts.
// 10.11.2026 (Bernd Rausmann's feedback, relayed by SARCLA): the ERP's order book under each quarter, in place of the weighting
// and the max (src/lib/reporting/orderBookRules.ts); the table fitted to the window; the year's target typed as an amount.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { FAINT, GREEN, HAIRLINE, INK, MUTED, RED, TINT, glass } from "@/app/uc/report/ui";
import { THIS } from "@/app/reporting/marketing-kpis/DimChart";
import { useCustomersCube } from "@/app/reporting/marketing-kpis/Customers";
import { ChartBox, FullTable, H1, Waiting, membersOf, tooOld, type Col } from "@/app/reporting/eso-benchmark/Figures";
import { useVisits } from "@/app/reporting/eso-benchmark/Visits";
import { SCOPE_LEAD, scopedPeople } from "@/app/reporting/scope";
import { MONTH_NAMES } from "@/lib/marketingKpis/cube";
import {
  MAX_SHARE, TARGETS, amountOf, checkAmount, checkTarget, impliedGrowth, quarterTargets, weightsOf, yearTargetOf, type PersonTargets, type TargetDef, type TargetId,
} from "@/lib/reporting/mySalesRules";
import { bookQuarters, sumBooks, type BookBySae, type BookKey } from "@/lib/reporting/orderBookRules";
import {
  cubeReach, dueToDate, revenueByPerson, revenueMeasures, visitsByPerson, visitsMeasure, visitsReach, type Measured, type PersonFig, type Reach,
} from "@/lib/reporting/mySalesFigures";
import { Note, shell, useMySalesFrame, viewsOf, type MySales } from "./shared";

const eur = (n: number) => `${n < 0 ? "−" : ""}€${Math.round(Math.abs(n)).toLocaleString("en")}`;
const int = (n: number) => Math.round(n).toLocaleString("en");
const pct = (x: number | null) => (x == null || !Number.isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const fmtOf = (id: TargetId) => (id === "visits" ? int : eur);
export const QS = ["Q1", "Q2", "Q3", "Q4"];

export function TargetsPage() {
  const { st, view, bar, scope, setTargets } = useMySalesFrame({ pick: true });
  const { cube, computing, progress, error } = useCustomersCube();
  const visits = useVisits();
  const ready = cube && !tooOld(cube) ? cube : null;
  const d = visits.d;
  const subject = st?.subject ?? null;
  const viewName = viewsOf(st).find((v) => v.id === view)?.label ?? "";
  const whose = view === "me" ? subject?.name ?? "You" : view === "all" ? "All - ESO and TSA" : viewName;

  // the people of the switch: their SAE names in the cube, their places in the visits read (../scope.tsx)
  const labels = useMemo(() => {
    if (!ready || !scope) return [];
    if (scope.lead === SCOPE_LEAD) return Object.keys(scope.leads.byName);
    return scope.team === "total" ? ready.labels.sae : membersOf(ready, scope.team, null, null) ?? [];
  }, [ready, scope]);
  const people = useMemo(() => {
    if (!d || !scope) return new Set<number>();
    if (scope.lead === SCOPE_LEAD) return scopedPeople(d.people, scope.leads.byId, "id");
    const word = scope.team === "eso" ? "ESO" : scope.team === "tsa" ? "TSA" : null;
    return new Set(d.people.flatMap((p, i) => (!word || p.team === word ? [i] : [])));
  }, [d, scope]);

  const head = (
    <Box sx={{ minWidth: 0, display: "grid", gap: 0.9 }}>
      <Typography component="h1" sx={H1}>Targets</Typography>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.45 }}>
        {view === "me"
          ? <><b style={{ color: INK }}>{subject?.name ?? "You"}</b> · the {st?.year ?? ""} targets, set by the person, measured on the ESO reports&apos; figures</>
          : <><b style={{ color: INK }}>{whose}</b> · each person&apos;s figure and share of the year to date - no one&apos;s target shown</>}
      </Typography>
    </Box>
  );

  if (!st || !ready || !d) {
    return (
      <Box sx={shell}>
        {head}
        {bar}
        {st?.error ? <Note title="Your targets could not be read">{st.error}</Note>
          : <Waiting computing={computing || visits.computing || (!!cube && tooOld(cube))} progress={progress ?? visits.progress} error={error ?? visits.error} />}
      </Box>
    );
  }
  return (
    <Box sx={shell}>
      {head}
      {bar}
      {view === "me"
        ? <Mine st={st} cubeReady={ready} labels={labels} people={people} d={d} onSaved={setTargets} />
        : <Contribution scopeName={whose} cubeReady={ready} labels={labels} people={people} d={d} year={st.year} />}
    </Box>
  );
}

/* ── My targets: one table, a row per target and the quarters across, each target set in its row (SARCLA 01.11.2026,
   on the cards: "still not the good format" - "show them as horizontal table"). 10.11.2026: fitted to the window - last
   year under the year's target, no "max" in the cells (Bernd Rausmann: "nobody's supposed to stop there"); the year's
   target typed as an amount in place of the growth ("change the value of the target itself"); under each quarter running
   or to come, the ERP's order book and its share of the quarter's target, where the weighting and the max were ── */

/** Who may change the targets shown, and what to do with what the server keeps. */
type Edit = { owner: string; onSaved: (t: PersonTargets) => void };

function Mine({ st, cubeReady, labels, people, d, onSaved }: {
  st: MySales; cubeReady: NonNullable<ReturnType<typeof useCustomersCube>["cube"]>; labels: string[]; people: Set<number>;
  d: NonNullable<ReturnType<typeof useVisits>["d"]>; onSaved: (t: PersonTargets) => void;
}) {
  const m = useMemo(() => ({ ...revenueMeasures(cubeReady, labels), visits: visitsMeasure(d, people) }), [cubeReady, labels, d, people]);
  const reach = useMemo(() => ({ rev: cubeReach(cubeReady), visits: visitsReach(d) }), [cubeReady, d]);
  const ob = useOrderBook();
  // the order book of the person's customers: their SAE names, as the revenue is measured
  const book = useMemo(() => (ob ? sumBooks(labels.map((l) => ob.sae[l])) : null), [ob, labels]);
  if (!st.subject) {
    return (
      <Note title="No figures of your own here">
        Your email is not a HubSpot owner&apos;s, so the reports cannot tell which customers are yours. All still shows - and an admin can check the email on your HubSpot user.
      </Note>
    );
  }
  if (!st.targets) return <Note title="The targets are not given to you">Ask an admin for Targets in Settings, People.</Note>;
  const set = st.targets;
  const runQ = Math.floor(reach.rev.month / 3);
  const rows = TARGETS.map((t) => rowOf(t, m[t.id], set, t.id === "visits" ? reach.visits : reach.rev,
    t.id === "visits" || !book ? null : bookQuarters(book[t.id as BookKey], st.year, runQ)));
  const edit: Edit | null = st.canEdit ? { owner: st.subject.id, onSaved } : null;
  const day = ob ? dayWords(ob.day) : null;
  return (
    <>
      <ChartBox title={`${st.subject.name}'s targets, ${st.year}`}
        hint={`${st.canEdit ? "Type each target in its row - a growth on last year or the year's amount itself, an amount for the new customers, a number of visits - and, under it, how it falls on the quarters. " : ""}As the VPP sheet reckons it: each quarter's part is the year's target times its period weighting - 100 % the target, 120 % the most it counts; the year to date against what is due by now${day ? `. Under each quarter running or to come, the order book - ordered, not invoiced yet, due in it (overdue in the running one) - and its share of the quarter's target: the ERP's order book of ${day}` : ""}`}>
        <TargetsTable rows={rows} year={st.year} edit={edit} day={day} />
      </ChartBox>
      <TargetRings rows={rows} year={st.year} />
    </>
  );
}

/** The ERP's order book by person (/api/reporting/my-sales/order-book) - null until read, and while the morning workbook carries none. */
export function useOrderBook(): BookBySae | null {
  const [ob, setOb] = useState<BookBySae | null>(null);
  useEffect(() => {
    let live = true, tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      fetch("/api/reporting/my-sales/order-book").then((r) => r.json()).then((j) => {
        if (!live) return;
        if (j?.ok && j.sae) setOb(j as BookBySae);
        // the customers' list is still being read beside the cube: once more in a while
        else if (j?.pending && ++tries < 4) timer = setTimeout(read, 20_000);
      }).catch(() => { /* no order book: the cells show none */ });
    };
    read();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, []);
  return ob;
}
export const dayWords = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A target's row: what was measured, what was set (a growth, or the year's amount typed in its place), its year's target,
 *  its quarters by its weights (w, fractions; own: not the sheet's), and its order book by quarter. */
export type Row = {
  label: string; id: TargetId; m: Measured; set: number | undefined; amount: number | undefined; year: number | null; quarters: number[] | null;
  due: number | null; reach: Reach; w: number[]; own: boolean; book: { q: number[]; later: number } | null;
};
function rowOf(t: TargetDef, m: Measured, set: PersonTargets, reach: Reach, book: Row["book"]): Row {
  const w = weightsOf(set, t.id);
  const year = yearTargetOf(set, t.id, m.py);
  const quarters = year != null ? quarterTargets(t.id, year, w) : null;
  // the short name, so the table fits beside its quarters - the rings carry the same
  return { label: SHORT[t.id], id: t.id, m, set: set[t.id], amount: amountOf(set, t.id), year, quarters, due: quarters ? dueToDate(quarters, reach) : null, reach, w, own: !!set.weights?.[t.id], book };
}
const reachedTone = (a: number, t: number | null) => (t == null || t <= 0 ? FAINT : a >= t ? GREEN : RED);
const targetDefOf = (id: TargetId) => TARGETS.find((t) => t.id === id)!;

/* the table: its own columns in fractions of the width, so it fits the window instead of running off it (SARCLA 10.11.2026:
   "fit better the windows") - the look of the reports' other tables */
export const TH = { fontSize: "0.74rem", fontWeight: 700, color: MUTED, borderColor: HAIRLINE, lineHeight: 1.3, py: 1.25, px: 0.75, verticalAlign: "bottom", textAlign: "right" } as const;
export const TD = { fontSize: "0.86rem", color: INK, borderColor: HAIRLINE, fontVariantNumeric: "tabular-nums", lineHeight: 1.3, py: 1, px: 0.75, verticalAlign: "top", textAlign: "right" } as const;
export const STACK = { display: "inline-grid", justifyItems: "end", gap: 0.25, maxWidth: "100%" } as const;
export const SMALL = { fontSize: "0.72rem", lineHeight: 1.35 } as const;

function TargetsTable({ rows, year, edit, day }: { rows: Row[]; year: number; edit: Edit | null; day: string | null }) {
  return (
    <Box sx={{ overflowX: "auto", borderRadius: "14px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.75)" }}>
      <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 820 }} aria-label="Targets">
        <colgroup>
          <col style={{ width: "11%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "13%" }} />
          {QS.map((q) => <col key={q} style={{ width: "12.5%" }} />)}
          <col style={{ width: "12%" }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...TH, textAlign: "left", pl: 1.5 }}>Target</TableCell>
            <TableCell sx={TH} title="A growth on last year in %, an amount, a number of visits - as the VPP sheet has them">Target set</TableCell>
            <TableCell sx={TH} title="100 % - the target; 120 % - the most it counts, as the VPP sheet's Max">Target {year}</TableCell>
            {QS.map((q) => <TableCell key={q} sx={TH}>{q}</TableCell>)}
            <TableCell sx={TH}>Year to date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell sx={{ ...TD, textAlign: "left", fontWeight: 600, pl: 1.5 }}>{r.label}</TableCell>
              <TableCell sx={TD}>
                <Box component="span" sx={{ ...STACK, gap: 0.4 }}>
                  <SetField def={targetDefOf(r.id)} row={r} edit={edit} />
                  <WeightsField row={r} canEdit={!!edit} owner={edit?.owner ?? ""} onSaved={edit?.onSaved ?? (() => {})} />
                </Box>
              </TableCell>
              <TableCell sx={TD}>{yearCell(r, edit)}</TableCell>
              {QS.map((q, k) => <TableCell key={q} sx={TD}>{quarterCell(r, k, day)}</TableCell>)}
              <TableCell sx={TD}>
                <Box component="span" sx={STACK}>
                  <b>{fmtOf(r.id)(r.m.ytd)}</b>
                  {r.id !== "visits" && <span style={{ ...SMALL, color: MUTED }}>{fmtOf(r.id)(r.m.ytdPy)} a year earlier</span>}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** The year's target - typed as an amount for a growth target - and last year's figure under it (it was a column of its own). */
function yearCell(r: Row, edit: Edit | null) {
  const f = fmtOf(r.id);
  const growth = targetDefOf(r.id).kind === "growth";
  return (
    <Box component="span" sx={{ ...STACK, gap: 0.4 }} title={r.year != null ? `120 %, the most it counts (the VPP sheet's Max): ${f(r.year * MAX_SHARE)}` : undefined}>
      {growth && edit ? <AmountField row={r} edit={edit} />
        : r.year == null ? <span style={{ color: FAINT }}>—</span> : <b>{f(r.year)}</b>}
      {growth && r.amount != null && <span style={{ ...SMALL, color: TINT.purple.fg, fontWeight: 700 }}>set as an amount</span>}
      <span style={{ ...SMALL, color: MUTED }}>{r.id === "visits" ? `${int(r.m.py)} meetings` : f(r.m.py)} last year</span>
    </Box>
  );
}

/**
 * A quarter: what it reached against its part of the target; to come, its part. Under it, in the running quarter and those
 * to come, the order book due in it and its share of the quarter's target (Bernd Rausmann, 10.11.2026: "show the relevant
 * order book and the % of order book against the target") - none in a quarter closed, nothing can land there any more.
 */
export const quarterCell = (r: Row, k: number, day: string | null) => {
  const f = fmtOf(r.id);
  const runQ = Math.floor(r.reach.month / 3);
  const t = r.quarters?.[k] ?? null;
  const ob = r.book && k >= runQ && r.book.q[k] > 0 ? r.book.q[k] : null;
  const book = ob != null && (
    <span style={{ ...SMALL, color: TINT.blue.fg }}
      title={`Ordered, not invoiced yet, due in ${QS[k]}${k === runQ ? " - what is overdue or has no date counted here" : ""}: ${f(ob)}${t ? `, ${pct(ob / t)} of the quarter's target ${f(t)}; with what is invoiced${k === runQ ? " so far" : ""}, ${pct((r.m.q[k] + ob) / t)}` : ""}${day ? ` (the ERP's order book of ${day})` : ""}`}>
      Order book {f(ob)}{t ? ` · ${pct(ob / t)}` : ""}
    </span>
  );
  if (k > runQ) {
    return (
      <Box component="span" sx={STACK}>
        <span style={{ color: FAINT }}>{t != null ? `${f(t)} to come` : "—"}</span>
        {book}
      </Box>
    );
  }
  return (
    <Box component="span" sx={STACK}>
      <b>{f(r.m.q[k])}</b>
      {t != null
        ? <span style={{ ...SMALL, color: reachedTone(r.m.q[k], k === runQ ? t * Math.min(1, (r.reach.month - k * 3 + r.reach.share) / 3) : t) }}>{pct(r.m.q[k] / t)} of {f(t)}{k === runQ ? " · running" : ""}</span>
        : r.id !== "visits" && <span style={{ ...SMALL, color: MUTED }}>{f(r.m.qPy[k])} a year earlier</span>}
      {book}
    </Box>
  );
};

/** How a target falls on the quarters: the sheet's weights, or the person's own - set in a small window (SARCLA 01.11.2026). */
function WeightsField({ row, canEdit, owner, onSaved }: { row: Row; canEdit: boolean; owner: string; onSaved: (t: PersonTargets) => void }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [vals, setVals] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const words = row.w.map((x) => (x * 100).toFixed(1).replace(/\.0$/, "")).join(" / ");
  const label = <>Quarters {words} %{row.own ? <b style={{ color: TINT.purple.fg }}> · own</b> : null}</>;
  if (!canEdit) return <span style={{ fontSize: "0.7rem", color: FAINT }}>{label}</span>;
  const save = async (weights: number[] | null) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/reporting/my-sales", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner, target: row.id, weights }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErr(j.error ?? "Not saved."); return; }
      onSaved(j.targets); setEl(null);
    } finally { setBusy(false); }
  };
  const sum = vals.reduce((a, v) => a + (Number(v.replace(",", ".")) || 0), 0);
  return (
    <>
      <Box component="button" type="button" onClick={(e) => { e.stopPropagation(); setVals(row.w.map((x) => String(Math.round(x * 1000) / 10))); setErr(null); setEl(e.currentTarget); }}
        sx={{ border: 0, background: "none", p: 0, cursor: "pointer", fontSize: "0.7rem", color: MUTED, textDecoration: "underline dotted", font: "inherit", fontFamily: "inherit" }}>
        <span style={{ fontSize: "0.7rem" }}>{label}</span>
      </Box>
      <Popover open={!!el} anchorEl={el} onClose={() => setEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: "14px", p: 2, width: 300, display: "grid", gap: 1.25 } } }}>
        <Box>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>{row.label}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>How the year&apos;s target falls on the quarters - the VPP sheet&apos;s period weighting. Together 100 %.</Typography>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1 }}>
          {QS.map((q, k) => (
            <Box key={q} sx={{ display: "grid", gap: 0.25 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: FAINT }}>{q}</Typography>
              <Box sx={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(21,34,58,.16)", borderRadius: "8px", px: 0.75 }}>
                <InputBase value={vals[k] ?? ""} disabled={busy} inputProps={{ inputMode: "decimal", "aria-label": `${row.label}: ${q} %` }}
                  onChange={(e) => setVals((v) => v.map((x, i) => (i === k ? e.target.value : x)))} sx={{ fontSize: "0.84rem", fontWeight: 700, "& input": { textAlign: "right", py: 0.4 } }} />
                <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>%</Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: "0.76rem", color: Math.abs(sum - 100) > 0.5 ? RED : MUTED }}>Together {Math.round(sum * 10) / 10} %</Typography>
        {err && <Typography sx={{ fontSize: "0.76rem", color: RED }}>{err}</Typography>}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          {row.own && <Button size="small" disabled={busy} onClick={() => void save(null)} sx={{ textTransform: "none", mr: "auto" }}>Back to the sheet&apos;s</Button>}
          <Button size="small" variant="contained" disableElevation disabled={busy} onClick={() => void save(vals.map((v) => Number(v.replace(",", "."))))} sx={{ textTransform: "none", borderRadius: "10px" }}>Save</Button>
        </Box>
      </Popover>
    </>
  );
}

/**
 * A ring per target (SARCLA 01.11.2026: "after this we should see pie graphs for the targets"): how far the year to date
 * has come of the year's target - the ring full at 100 %, going on in green to 120 %, the most it counts - and a tick
 * where it should stand by now. No target set: an empty ring.
 */
function TargetRings({ rows, year }: { rows: Row[]; year: number }) {
  return (
    <Box sx={{ ...glass, borderRadius: "18px", p: 2, display: "grid", gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>Where each target stands, {year}</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The year to date against the year&apos;s target - the ring full at 100 %, green on to 120 %; the tick is where it should be by now</Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" } }}>
        {rows.map((r) => <Ring key={r.id} r={r} />)}
      </Box>
    </Box>
  );
}
function Ring({ r }: { r: Row }) {
  const R = 46, C = 2 * Math.PI * R;
  const share = r.year ? r.m.ytd / r.year : null;
  const due = r.year && r.due != null ? r.due / r.year : null;
  const base = share == null ? 0 : Math.min(1, share);
  const over = share == null ? 0 : Math.max(0, Math.min(MAX_SHARE, share) - 1) / (MAX_SHARE - 1);
  const tone = share == null ? FAINT : due != null && r.m.ytd >= (r.due ?? 0) ? GREEN : RED;
  const arc = (from: number, len: number, color: string, w: number, rr = R) => (
    <circle cx="60" cy="60" r={rr} fill="none" stroke={color} strokeWidth={w} strokeLinecap="butt"
      strokeDasharray={`${len * 2 * Math.PI * rr} ${2 * Math.PI * rr}`} strokeDashoffset={-from * 2 * Math.PI * rr} transform="rotate(-90 60 60)" />
  );
  return (
    <Box sx={{ display: "grid", justifyItems: "center", gap: 0.5, textAlign: "center", minWidth: 0 }}>
      <Box component="svg" viewBox="0 0 120 120" sx={{ width: 120, height: 120 }} role="img" aria-label={`${r.label}: ${share == null ? "no target" : pct(share)} of the year`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e9eef5" strokeWidth="12" />
        {base > 0 && arc(0, base, THIS, 12)}
        {over > 0 && arc(0, over, GREEN, 5, R + 9)}
        {due != null && due > 0 && due < 1 && (
          <line x1="60" y1={60 - R - 8} x2="60" y2={60 - R + 8} stroke={INK} strokeWidth="2" transform={`rotate(${due * 360} 60 60)`} />
        )}
        <text x="60" y="58" textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: share == null ? FAINT : INK }}>{share == null ? "—" : `${Math.round(share * 100)}%`}</text>
        <text x="60" y="76" textAnchor="middle" style={{ fontSize: 10, fill: MUTED }}>{share == null ? "no target" : "of the year"}</text>
      </Box>
      <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, lineHeight: 1.25 }}>{SHORT[r.id]}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 }}>
        {fmtOf(r.id)(r.m.ytd)}{r.year != null ? <> of {fmtOf(r.id)(r.year)}</> : null}
        {r.due != null && <><br /><span style={{ color: tone, fontWeight: 700 }}>{pct(r.m.ytd / r.due)}</span> of the {fmtOf(r.id)(r.due)} due by now</>}
      </Typography>
    </Box>
  );
}

/** A change of a target, kept by the server - its targets as now kept, or why not. */
async function putTarget(body: Record<string, unknown>): Promise<{ ok: true; targets: PersonTargets } | { ok: false; error: string }> {
  const r = await fetch("/api/reporting/my-sales", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok ? { ok: true, targets: j.targets } : { ok: false, error: j.error ?? "Not saved." };
}

/** A number typed in its cell, saved when the field is left (Enter too; Escape puts it back). save: an error, or null. */
function NumberField({ value, unit, width, label, faint, title, check, save }: {
  value: string; unit: string; width: number; label: string; faint?: boolean; title?: string;
  check: (text: string) => { ok: true; value: number | null } | { ok: false; error: string };
  save: (v: number | null) => Promise<string | null>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = async () => {
    if (text == null) return;
    const c = check(text.trim());
    if (!c.ok) { setErr(c.error); return; }
    setBusy(true);
    try {
      const e = await save(c.value);
      if (e) setErr(e); else { setText(null); setErr(null); }
    } finally { setBusy(false); }
  };
  return (
    <Box component="span" title={err ?? title} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, maxWidth: "100%", border: `1px solid ${err ? RED : "rgba(21,34,58,.16)"}`, borderRadius: "10px", px: 1, bgcolor: "#fff" }}>
      <InputBase value={text ?? value} disabled={busy} placeholder="set it" inputProps={{ inputMode: "decimal", "aria-label": label }}
        onChange={(e) => { setText(e.target.value); setErr(null); }} onBlur={() => { void done(); }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setText(null); setErr(null); } }}
        sx={{ width, maxWidth: "100%", fontSize: "0.84rem", fontWeight: 700, color: faint && text == null ? FAINT : INK, "& input": { textAlign: "right", py: 0.4 } }} />
      <Typography component="span" sx={{ fontSize: "0.78rem", color: MUTED }}>{unit}</Typography>
    </Box>
  );
}

/** A target, typed in its row: a growth in %, an amount, a number. A growth target whose year's amount was typed shows the
 *  growth that amount makes, faint - typing a growth uses it again. */
function SetField({ def, row, edit }: { def: TargetDef; row: Row; edit: Edit | null }) {
  const unit = def.kind === "growth" ? "%" : def.kind === "eur" ? "€" : "visits";
  const implied = def.kind === "growth" && row.amount != null ? impliedGrowth(row.amount, row.m.py) : null;
  const value = def.kind === "growth" && row.amount != null ? (implied == null ? "" : String(implied))
    : row.set == null ? "" : def.kind === "growth" ? String(row.set) : row.set.toLocaleString("en");
  if (!edit) {
    return <span style={{ color: !value ? FAINT : implied != null ? MUTED : INK, fontWeight: 700 }}>{!value ? "not set" : `${def.kind === "growth" && Number(value) > 0 ? "+" : ""}${value} ${unit}`}</span>;
  }
  return (
    <NumberField value={value} unit={unit} width={def.kind === "growth" ? 58 : 80} label={`${def.name}: target`} faint={implied != null}
      title={implied != null ? "The growth the amount set under the year's target makes - type a growth to use it instead" : undefined}
      check={(t) => checkTarget(def.id, t === "" ? null : t)}
      save={async (v) => {
        if (row.amount == null && v === (row.set ?? null)) return null;
        const r = await putTarget({ owner: edit.owner, target: def.id, value: v });
        if (!r.ok) return r.error;
        edit.onSaved(r.targets);
        return null;
      }} />
  );
}

/** A growth target's year's amount, typed in place of the growth (SARCLA 10.11.2026: "allow also to change the value of the
 *  target itself") - emptied, the growth counts again. */
function AmountField({ row, edit }: { row: Row; edit: Edit }) {
  const worked = row.year == null ? null : Math.round(row.year);
  return (
    <NumberField value={worked == null ? "" : worked.toLocaleString("en")} unit="€" width={84} label={`${row.label}: the year's target`}
      title={row.amount != null ? "Set as an amount - empty it to use the growth again" : worked != null ? "Worked out from the growth - type an amount to set the target itself" : "Type the year's target, or a growth beside it"}
      check={(t) => checkAmount(t === "" ? null : t)}
      save={async (v) => {
        // nothing set as an amount yet: emptied, or the very amount the growth makes - nothing to keep
        if (row.amount == null && (v == null || v === worked)) return null;
        if (v === (row.amount ?? null)) return null;
        const r = await putTarget({ owner: edit.owner, target: row.id, amount: v });
        if (!r.ok) return r.error;
        edit.onSaved(r.targets);
        return null;
      }} />
  );
}

/* ── My team | All ESO / TSA | All: each person's figure and share, no targets - one table (SARCLA 01.11.2026: "show
   them as horizontal table") ── */

function Contribution({ scopeName, cubeReady, labels, people, d, year }: {
  scopeName: string; cubeReady: NonNullable<ReturnType<typeof useCustomersCube>["cube"]>; labels: string[]; people: Set<number>;
  d: NonNullable<ReturnType<typeof useVisits>["d"]>; year: number;
}) {
  const by = useMemo(() => ({ ...revenueByPerson(cubeReady, labels), visits: visitsByPerson(d, people) }), [cubeReady, labels, d, people]);
  type P = { label: string } & Record<TargetId, number> & { prev: Record<TargetId, number> };
  const names = [...new Set(TARGETS.flatMap((t) => by[t.id].map((r) => r.label)))];
  const value = (id: TargetId, name: string) => by[id].find((r: PersonFig) => r.label === name);
  const rows: P[] = names.map((n) => {
    const row = { label: n, prev: {} as Record<TargetId, number> } as P;
    for (const t of TARGETS) { const v = value(t.id, n); row[t.id] = v?.cur ?? 0; row.prev[t.id] = v?.prev ?? 0; }
    return row;
  });
  const totals = Object.fromEntries(TARGETS.map((t) => [t.id, by[t.id].reduce((a, r) => a + r.cur, 0)])) as Record<TargetId, number>;
  const totalsPy = Object.fromEntries(TARGETS.map((t) => [t.id, by[t.id].reduce((a, r) => a + r.prev, 0)])) as Record<TargetId, number>;
  const change = (cur: number, prev: number) => (prev ? (cur - prev) / Math.abs(prev) : null);
  const cols: Col<P>[] = TARGETS.map((t) => ({
    key: t.id, head: SHORT[t.id], tip: t.name, sort: (r: P) => r[t.id],
    cell: (r: P) => {
      const ch = t.id === "visits" ? null : change(r[t.id], r.prev[t.id]);
      return (
        <Box component="span" sx={{ display: "inline-grid", justifyItems: "end", lineHeight: 1.3 }}>
          <b>{fmtOf(t.id)(r[t.id])}</b>
          <span style={{ fontSize: "0.72rem", color: MUTED }}>
            {pct(totals[t.id] ? r[t.id] / totals[t.id] : null)} of all{ch != null ? <> · <span style={{ color: ch >= 0 ? GREEN : RED }}>{ch >= 0 ? "+" : "−"}{Math.abs(ch * 100).toFixed(1)}%</span></> : null}
          </span>
        </Box>
      );
    },
  }));
  if (!rows.length) return <Note title={`No figures for ${scopeName} yet`} />;
  return (
    <ChartBox title={`${year} to date, by person - ${scopeName}`}
      hint={`Each person's figure year to date; under it their share of ${scopeName}'s, and the change against the same days of ${year - 1} - no one's target`}>
      <FullTable<P> first="Person" rows={rows} cols={cols} initial="own" find={rows.length > 12 ? "a person" : undefined}
        total={{ label: `${scopeName} in all`, ...totals, prev: totalsPy }} />
    </ChartBox>
  );
}
export const SHORT: Record<TargetId, string> = { own: "Own area", dt: "Sealing (DT)", kt: "Plastics (KT)", new: "New customers", visits: "Visits" };
