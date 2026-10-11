"use client";
// ESO DASHBOARD - VISITS, the first sub-app (SARCLA 12.10, from the deck):
//   total per sales rep and month, to last year
//   per sales rep and month per priority (potential), to last year
//     Ø potential per visit per sales rep
//   per sales rep and month per customer category, to last year
//   how many with new customers - registered after visiting? in what way?
//     bought in the period?
//   agreed or cold
// Only visits whose report is complete count: the custom object's stage
// "Visit and Report complete".

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import EuroIcon from "@mui/icons-material/Euro";
import ApartmentIcon from "@mui/icons-material/Apartment";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";

import { ChartFrame } from "@/app/charts/ChartFrame";
import { GroupedColumns } from "@/app/charts/GroupedColumns";
import { StackedColumns } from "@/app/charts/StackedColumns";
import { BarList } from "@/app/charts/BarList";
import { ShareBar } from "@/app/charts/ShareBar";
import { SEQUENTIAL } from "@/app/charts/palette";
import { CardTitle, GlassCard, KpiTile } from "@/app/uc/report/ui";
import { CATEGORY_BANDS, PRIO_BANDS, VISIT_KINDS } from "@/lib/reporting/esoRules";
import { EsoPage, FAINT, HAIRLINE, INK, MUTED, change, grid, money, n0, pct, ratio, sumPairs, type Pair, type RepBenchmark } from "../shared";

const totals = (rec: Record<string, Pair[]>, keys: readonly string[]) => keys.map((k) => ({ k, p: sumPairs(rec[k] ?? []) }));

/** One stacked chart per breakdown: this year by month, last year in the table twin. */
function Stacked({ title, caption, rec, keys, months, labels }: {
  title: string; caption: string; rec: Record<string, Pair[]>; keys: readonly string[]; months: number; labels: string[];
}) {
  const data = labels.slice(0, months).map((x, i) => ({ x, ...Object.fromEntries(keys.map((k) => [k, rec[k]?.[i]?.cy ?? 0])) }));
  const t = totals(rec, keys);
  return (
    <ChartFrame title={title} caption={caption} table={{
      columns: ["", "This year", "Last year", "Change"],
      rows: t.map(({ k, p }) => [k, p.cy, p.py, p.py ? `${(((p.cy - p.py) / p.py) * 100).toFixed(1)}%` : "—"]),
      numeric: [1, 2],
    }}>
      <StackedColumns data={data} parts={keys.map((k) => ({ key: k, label: k }))} height={250} />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
        {t.map(({ k, p }) => (
          <Typography key={k} sx={{ fontSize: "0.78rem", color: MUTED }}>
            <b style={{ color: INK }}>{k}</b> {n0(p.cy)} <span style={{ color: FAINT }}>· last year {n0(p.py)}</span>
          </Typography>
        ))}
      </Box>
    </ChartFrame>
  );
}

/** Sales reps × months, each cell shaded by how many visits it holds. */
function RepMonthGrid({ reps, months, labels }: { reps: RepBenchmark[]; months: number; labels: string[] }) {
  const rows = reps.map((r) => ({ r, total: sumPairs(r.visits.months.slice(0, months)) })).sort((a, b) => b.total.cy - a.total.cy);
  const max = Math.max(1, ...rows.flatMap(({ r }) => r.visits.months.slice(0, months).map((p) => p.cy)));
  const shade = (v: number) => (v <= 0 ? "transparent" : SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((v / max) * (SEQUENTIAL.length - 1)))]);
  const cols = `minmax(150px, 1.6fr) repeat(${months}, minmax(38px, 1fr)) 70px 70px 64px`;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: 150 + months * 40 + 210, display: "grid", gridTemplateColumns: cols, gap: "3px", alignItems: "center", fontSize: "0.78rem" }}>
        <Box sx={{ color: FAINT, fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase" }}>Sales rep</Box>
        {labels.slice(0, months).map((m) => <Box key={m} sx={{ color: FAINT, fontWeight: 600, fontSize: "0.68rem", textAlign: "center" }}>{m}</Box>)}
        {["This year", "Last year", "Change"].map((h) => <Box key={h} sx={{ color: FAINT, fontWeight: 600, fontSize: "0.68rem", textAlign: "right" }}>{h}</Box>)}
        {rows.map(({ r, total }) => {
          const c = change(total);
          return [
            <Box key={`${r.ownerId}-n`} sx={{ color: INK, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", py: 0.5 }}>{r.name}</Box>,
            ...r.visits.months.slice(0, months).map((p, i) => (
              <Box key={`${r.ownerId}-${i}`} title={`${r.name} · ${labels[i]}: ${p.cy} visits (last year ${p.py})`} sx={{
                textAlign: "center", py: 0.6, borderRadius: "6px", bgcolor: shade(p.cy),
                color: p.cy / max > 0.55 ? "#fff" : INK, fontVariantNumeric: "tabular-nums", border: p.cy ? "none" : `1px dashed ${HAIRLINE}`,
              }}>{p.cy || ""}</Box>
            )),
            <Box key={`${r.ownerId}-t`} sx={{ textAlign: "right", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{n0(total.cy)}</Box>,
            <Box key={`${r.ownerId}-p`} sx={{ textAlign: "right", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{n0(total.py)}</Box>,
            <Box key={`${r.ownerId}-c`} sx={{ textAlign: "right", color: FAINT }}>{c === null ? "—" : `${c > 0 ? "↑" : "↓"} ${Math.abs(c * 100).toFixed(0)}%`}</Box>,
          ];
        })}
      </Box>
    </Box>
  );
}

export default function VisitsPage() {
  return (
    <EsoPage title="Visits" line="completed visit reports only">
      {({ rep, b, reps }) => {
        const v = rep.visits;
        const months = b.revenueMonths;
        const L = b.monthLabels;
        const total = sumPairs(v.months.slice(0, months));
        const avgPot = (s: number, n: number) => (n ? s / n : null);
        const potCy = avgPot(v.potential.companySum.cy, v.potential.companyN.cy);
        const potPy = avgPot(v.potential.companySum.py, v.potential.companyN.py);
        const nc = v.newCustomers;
        const noPy = total.py === 0;
        return (
          <>
            <Box sx={grid(220)}>
              <KpiTile icon={<DirectionsCarIcon />} tint="green" label="Completed visits" value={n0(total.cy)}
                delta={noPy ? undefined : { ratio: change(total), versus: `${n0(total.py)} last year` }}
                note={noPy ? "No completed visits in HubSpot last year - the visit object starts in 2026." : undefined} />
              <KpiTile icon={<EuroIcon />} tint="purple" label="Ø potential per visit" value={potCy === null ? "—" : money(potCy)}
                note="The visited company's yearly potential - the one that sets its priority."
                delta={potPy === null ? undefined : { ratio: potCy === null ? null : (potCy - potPy) / potPy, versus: `${money(potPy)} last year` }} />
              <KpiTile icon={<ApartmentIcon />} tint="blue" label="Companies visited" value={n0(v.companies.cy)}
                note={`Ø revenue this year per visited company ${v.companies.cy ? money(v.revenueOfVisited.cy / v.companies.cy) : "—"}`} />
              <KpiTile icon={<PersonAddAlt1Icon />} tint="amber" label="Visits to new customers" value={n0(nc.visits.cy)}
                note={`${n0(nc.companies.cy)} companies that had never ordered when visited`} />
            </Box>

            <GlassCard>
              <CardTitle icon={<DirectionsCarIcon />} tint="green" title="Total per sales rep and month, to last year" note="Completed visit reports, by meeting date" />
              <Box sx={{ display: "grid", gap: 2.5 }}>
                <ChartFrame caption={reps.length === 1 ? reps[0].name : `${reps.length} sales reps together`} table={{
                  columns: ["Month", "This year", "Last year"],
                  rows: L.slice(0, months).map((x, i) => [x, v.months[i].cy, v.months[i].py]), numeric: [1, 2],
                }}>
                  <GroupedColumns data={L.slice(0, months).map((x, i) => ({ x, current: v.months[i].cy, prior: v.months[i].py }))}
                    currentLabel={String(b.window.year)} priorLabel={String(b.window.py)} />
                </ChartFrame>
                <RepMonthGrid reps={reps} months={months} labels={L} />
              </Box>
            </GlassCard>

            <GlassCard>
              <CardTitle icon={<EuroIcon />} tint="purple" title="Per sales rep and month, per priority (potential), to last year" note="Priority of the visited company: Prio 1 > €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500" />
              <Box sx={grid(420)}>
                <Stacked title="Visits by priority" caption="This year, by month" rec={v.byPrio} keys={PRIO_BANDS} months={months} labels={L} />
                <ChartFrame title="Ø potential per visit, per sales rep" caption="The visited company's yearly potential, averaged over the rep's completed visits">
                  <BarList format={(x) => (x === null ? "—" : money(x))} rows={reps
                    .map((r) => ({ label: r.name, value: r.visits.potential.companyN.cy ? r.visits.potential.companySum.cy / r.visits.potential.companyN.cy : null, secondary: `${n0(r.visits.potential.companyN.cy)} visits` }))
                    .filter((r) => r.value !== null)
                    .sort((a, c) => (c.value ?? 0) - (a.value ?? 0))}
                    emptyMessage="No visits with a known potential for these reps." />
                </ChartFrame>
              </Box>
            </GlassCard>

            <GlassCard>
              <CardTitle icon={<ApartmentIcon />} tint="blue" title="Per sales rep and month, per customer category, to last year" note="APSO customer category of the visited company" />
              <Stacked title="Visits by customer category" caption="This year, by month · Other = APSOlost, APSOmicro, Growth Engine and not set" rec={v.byCategory} keys={CATEGORY_BANDS} months={months} labels={L} />
            </GlassCard>

            <GlassCard>
              <CardTitle icon={<PersonAddAlt1Icon />} tint="amber" title="Visits to new customers" note="Companies that had never ordered when they were first visited this year - what came of the visit" />
              <Box sx={grid(380)}>
                <ChartFrame title="From visit to order" caption="Companies, this year">
                  <BarList rows={[
                    { label: "Visited, had never ordered", value: nc.companies.cy, secondary: `${n0(nc.visits.cy)} visits` },
                    { label: "Registered in the shop after the visit", value: nc.registeredAfter.cy, secondary: pct(ratio(nc.registeredAfter.cy, nc.companies.cy)) },
                    { label: `Bought after the visit, by ${L[months - 1]}`, value: nc.boughtAfter.cy, secondary: pct(ratio(nc.boughtAfter.cy, nc.companies.cy)) },
                  ]} />
                </ChartFrame>
                <ChartFrame title="In what way did they register?" caption="Before or after the visit, as HubSpot records it on the company">
                  <ShareBar segments={Object.entries(nc.byWay).map(([label, p]) => ({ label, value: p.cy }))} />
                  <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
                    {Object.entries(nc.byWay).sort((a, c) => c[1].cy - a[1].cy).map(([k, p]) => (
                      <Typography key={k} sx={{ fontSize: "0.8rem", color: MUTED }}><b style={{ color: INK }}>{n0(p.cy)}</b> {k.toLowerCase()}</Typography>
                    ))}
                    <Typography sx={{ fontSize: "0.74rem", color: FAINT, mt: 0.5 }}>Whether the ESO registered a customer on their behalf is not recorded in HubSpot.</Typography>
                  </Box>
                </ChartFrame>
              </Box>
            </GlassCard>

            <GlassCard>
              <CardTitle icon={<DirectionsCarIcon />} tint="slate" title="Agreed or cold" note="The visit's type: agreed (scheduled), cold, or at an event" />
              <Box sx={grid(420)}>
                <Stacked title="Visits by type" caption="This year, by month" rec={v.byKind} keys={VISIT_KINDS.filter((k) => v.byKind[k])} months={months} labels={L} />
                <ChartFrame title="Share this year">
                  <ShareBar segments={VISIT_KINDS.map((k) => ({ label: k, value: sumPairs(v.byKind[k] ?? []).cy }))} />
                </ChartFrame>
              </Box>
            </GlassCard>

            {Object.keys(v.notCompleted).length > 0 && (
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                Not counted this year: {Object.entries(v.notCompleted).map(([k, n]) => `${n0(n)} ${k.toLowerCase()}`).join(" · ")} - a visit counts once its report is complete.
              </Typography>
            )}
          </>
        );
      }}
    </EsoPage>
  );
}
