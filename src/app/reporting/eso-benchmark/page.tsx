"use client";
// THE ESO BENCHMARK - SARCLA's CrystalESO deck, per ESO sales rep, this year
// against last. Sections follow the deck: revenue & order intake, customer
// development, new customers, registrations, tickets, visits, shop behaviour -
// and what the data cannot answer is said at the foot, not guessed at.
// Built by src/lib/reporting/esoBenchmark.ts; the first visit starts the read.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import EuroIcon from "@mui/icons-material/Euro";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TableChartIcon from "@mui/icons-material/TableChart";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";

import PageHeader from "@/app/PageHeader";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import type { EsoBenchmark, RepBenchmark, Speed } from "@/lib/reporting/esoBenchmark";
import type { Pair } from "@/lib/reporting/esoRules";

type State = { ok?: boolean; value?: EsoBenchmark; computing?: boolean; progress?: string; computedAt?: string; error?: string };

const n0 = (n: number) => Math.round(n).toLocaleString("en");
const money = (n: number) => `€${n0(n)}`;
const moneyShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `€${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `€${Math.round(n / 1e3).toLocaleString("en")}K`;
  return money(n);
};
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const ratio = (a: number, b: number) => (b ? a / b : null);
const change = (p: Pair) => (p.py ? (p.cy - p.py) / Math.abs(p.py) : null);
const hours = (h: number | null) => (h === null || !Number.isFinite(h) ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`);
const days = (d: number | null) => (d === null || !Number.isFinite(d) ? "—" : `${d.toFixed(1)} d`);
const PC: Record<string, string> = { dt: "DT · Seals", kt: "KT · Plastics", ft: "FT · Fluid", st: "ST · Silicone & rubber", at: "AT · Anti-vibration", unknown: "Not assigned", other: "Other" };
const pcLabel = (k: string) => PC[k] ?? k.toUpperCase();
const TYPE: Record<string, string> = {
  "Original Equipment Manufacture (OEM)": "OEM",
  "Turning & Miling Workshop (C2S)": "C2S workshop",
  "Maintenance, Repair, Operations (MRO)": "MRO",
};
const typeLabel = (k: string) => TYPE[k] ?? k;

/** Change from last year, with the direction in words and arrow; colour only agrees. */
function Delta({ p, goodWhenUp = true, points = false, minBase = 0 }: { p: Pair; goodWhenUp?: boolean; points?: boolean; minBase?: number }) {
  // Nothing measured on one side, or last year too small to compare against:
  // 3 tickets becoming 322 is not "+10,633%", it is no comparison.
  if (!Number.isFinite(p.cy) || !Number.isFinite(p.py) || Math.abs(p.py) < minBase) {
    return <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>—</Typography>;
  }
  if (points) {
    // A rate moves in points: 36.1% to 38.3% is +2.2 points, not "+6.2%".
    const d = p.cy - p.py, flat = Math.abs(d) < 0.05, good = goodWhenUp ? d > 0 : d < 0;
    return (
      <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, color: flat ? MUTED : good ? GREEN : RED, whiteSpace: "nowrap" }}>
        {flat ? "level" : `${d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)} pts`}
      </Typography>
    );
  }
  const r = change(p);
  if (r === null) return <Typography component="span" sx={{ fontSize: "0.8rem", color: FAINT }}>—</Typography>;
  const up = r > 0, flat = Math.abs(r) < 0.0005;
  const good = goodWhenUp ? up : !up;
  return (
    <Typography component="span" sx={{ fontSize: "0.8rem", fontWeight: 700, color: flat ? MUTED : good ? GREEN : RED, whiteSpace: "nowrap" }}>
      {flat ? "level" : `${up ? "↑" : "↓"} ${Math.abs(r * 100).toFixed(1)}%`}
    </Typography>
  );
}

const num = { ...bodyCell, textAlign: "right" as const, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const };
const numHead = { ...headCell, textAlign: "right" as const };

/** Rows of "this year | last year | change". */
function PairTable({ head, rows, minBase = 0 }: { head: string; minBase?: number; rows: { label: string; p: Pair; fmt?: (n: number) => string; goodWhenUp?: boolean; note?: string; points?: boolean; noChange?: boolean }[] }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead><TableRow>
          <TableCell sx={headCell}>{head}</TableCell>
          <TableCell sx={numHead}>This year</TableCell>
          <TableCell sx={numHead}>Last year</TableCell>
          <TableCell sx={numHead}>Change</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell sx={bodyCell}>
                <Typography sx={{ fontSize: "0.85rem", color: INK }}>{r.label}</Typography>
                {r.note && <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{r.note}</Typography>}
              </TableCell>
              <TableCell sx={num}>{(r.fmt ?? n0)(r.p.cy)}</TableCell>
              <TableCell sx={{ ...num, color: MUTED }}>{(r.fmt ?? n0)(r.p.py)}</TableCell>
              <TableCell sx={num}><Delta p={r.p} goodWhenUp={r.goodWhenUp} points={r.points} minBase={r.noChange ? Infinity : r.fmt ? 0 : minBase} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** A breakdown kept as {key: Pair}, largest first. */
function Breakdown({ head, rec, label = (k: string) => k, fmt, top = 8, minBase = 20 }: { head: string; rec: Record<string, Pair>; label?: (k: string) => string; fmt?: (n: number) => string; top?: number; minBase?: number }) {
  const all = Object.entries(rec).sort((a, b) => b[1].cy - a[1].cy || b[1].py - a[1].py);
  if (!all.length) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>{head}: none in either window.</Typography>;
  // The long tail folds into one line, so a breakdown never outgrows its card.
  const rest = all.slice(top);
  const rows = all.slice(0, top).map(([k, p]) => ({ label: label(k), p, fmt }));
  if (rest.length) rows.push({ label: `${rest.length} more`, p: rest.reduce((t, [, p]) => ({ cy: t.cy + p.cy, py: t.py + p.py }), { cy: 0, py: 0 }), fmt });
  return <PairTable head={head} rows={rows} minBase={minBase} />;
}

/** A breakdown of this year only. */
function Counts({ head, rec }: { head: string; rec: Record<string, number> }) {
  const rows = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!rows.length) return <Typography sx={{ fontSize: "0.82rem", color: FAINT }}>{head}: none this year.</Typography>;
  return (
    <Table size="small">
      <TableHead><TableRow><TableCell sx={headCell}>{head}</TableCell><TableCell sx={numHead}>Visits</TableCell><TableCell sx={numHead}>Share</TableCell></TableRow></TableHead>
      <TableBody>
        {rows.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell>
            <TableCell sx={num}>{n0(v)}</TableCell>
            <TableCell sx={{ ...num, color: MUTED }}>{pct(ratio(v, total))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const speedPair = (s: Speed): Pair => ({ cy: s.cy ?? NaN, py: s.py ?? NaN });
const grid = (min: number) => ({ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: `repeat(auto-fit, minmax(${min}px, 1fr))` } });

export default function EsoBenchmarkPage() {
  const [state, setState] = useState<State | null>(null);
  const [who, setWho] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => fetch("/api/reporting/eso-benchmark")
      .then((r) => r.json())
      .then((j: State) => {
        if (!alive) return;
        setState(j);
        if (j.computing) timer = setTimeout(load, 5000);
      })
      .catch((e) => { if (alive) setState({ error: String(e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  const b = state?.value;
  const rep: RepBenchmark | undefined = useMemo(() => (b ? (who === "all" ? b.team : b.reps.find((r) => r.ownerId === who) ?? b.team) : undefined), [b, who]);
  const last = b ? b.monthLabels[b.revenueMonths - 1] : "";
  const span = b ? `Jan–${last} ${b.window.year} against Jan–${last} ${b.window.py}` : "";
  const ticketsComparable = !!rep && rep.tickets.created.py >= 0.3 * rep.tickets.created.cy;

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 1400 }}>
      <PageHeader title="ESO benchmark" subtitle={b ? `Per ESO sales rep · ${span}` : "Per ESO sales rep, this year against last"} />

      {!b && (
        <GlassCard>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {!state?.error && <CircularProgress size={18} />}
            <Typography sx={{ fontSize: "0.9rem", color: state?.error ? RED : MUTED }}>
              {state?.error
                ? `The benchmark could not be read: ${state.error}`
                : `Reading HubSpot - this takes a few minutes the first time${state?.progress ? ` · ${state.progress}` : ""}.`}
            </Typography>
          </Box>
        </GlassCard>
      )}

      {b && rep && (
        <>
          {state?.computing && (
            <Typography sx={{ fontSize: "0.8rem", color: FAINT }}>Refreshing in the background{state.progress ? ` · ${state.progress}` : ""} - showing the last finished read.</Typography>
          )}

          {/* Who */}
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {[{ ownerId: "all", name: "All ESO" }, ...b.reps].map((r) => {
              const on = r.ownerId === who;
              return (
                <Box key={r.ownerId} component="button" onClick={() => setWho(r.ownerId)} sx={{
                  border: `1px solid ${on ? TINT.purple.fg : HAIRLINE}`, bgcolor: on ? TINT.purple.bg : "rgba(255,255,255,.7)",
                  color: on ? TINT.purple.fg : INK, borderRadius: "999px", px: 1.4, py: 0.55, cursor: "pointer",
                  fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 700 : 500,
                }}>{r.name}</Box>
              );
            })}
          </Box>

          {/* Headline */}
          <Box sx={grid(220)}>
            <KpiTile icon={<EuroIcon />} tint="purple" label={`Revenue Jan–${last}`} value={moneyShort(rep.revenue.ytd.cy)}
              delta={{ ratio: change(rep.revenue.ytd), versus: `${moneyShort(rep.revenue.ytd.py)} last year` }} />
            <KpiTile icon={<ShoppingBagIcon />} tint="blue" label={b.oiMonths ? `Order intake Jan–${b.monthLabels[b.oiMonths - 1]}` : "Order intake"}
              value={b.oiMonths ? moneyShort(rep.orderIntake.ytd.cy) : "—"}
              delta={b.oiMonths ? { ratio: change(rep.orderIntake.ytd), versus: `${moneyShort(rep.orderIntake.ytd.py)} last year` } : undefined} />
            <KpiTile icon={<GroupsIcon />} tint="green" label="Active customers" value={n0(rep.customers.active.cy)}
              delta={{ ratio: change(rep.customers.active), versus: `${n0(rep.customers.active.py)} last year` }} />
            <KpiTile icon={<ConfirmationNumberIcon />} tint="amber" label="Tickets ordered" value={pct(ratio(rep.tickets.ordered.cy, rep.tickets.resolved.cy))}
              note={`${n0(rep.tickets.ordered.cy)} of ${n0(rep.tickets.resolved.cy)} resolved tickets ended in an order (last year ${pct(ratio(rep.tickets.ordered.py, rep.tickets.resolved.py))})`} />
          </Box>

          {/* The benchmark across reps */}
          {who === "all" && (
            <GlassCard>
              <CardTitle icon={<TableChartIcon />} tint="purple" title="Per sales rep" note={`${span} · customers under their current owner · click a name to open it`} />
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow>
                    {["Sales rep", "Companies", "Revenue", "Change", "Active", "New", "Lost", "Tickets", "Ordered", "Visits", "Registered"].map((h, i) => (
                      <TableCell key={h} sx={{ ...(i ? numHead : headCell), px: 1 }}>{h}</TableCell>
                    ))}
                  </TableRow></TableHead>
                  <TableBody>
                    {b.reps.map((r) => (
                      <TableRow key={r.ownerId} hover onClick={() => setWho(r.ownerId)} sx={{ cursor: "pointer", "& td": { px: 1 } }}>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.85rem", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{r.name}</TableCell>
                        <TableCell sx={num}>{n0(r.companies)}</TableCell>
                        <TableCell sx={num}>
                          {money(r.revenue.ytd.cy)}
                          <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>{money(r.revenue.ytd.py)} last year</Typography>
                        </TableCell>
                        <TableCell sx={num}><Delta p={r.revenue.ytd} /></TableCell>
                        <TableCell sx={num}>{n0(r.customers.active.cy)}</TableCell>
                        <TableCell sx={num}>{n0(r.customers.new.cy)}</TableCell>
                        <TableCell sx={num}>{n0(r.customers.lost.cy)}</TableCell>
                        <TableCell sx={num}>{n0(r.tickets.created.cy)}</TableCell>
                        <TableCell sx={num}>{pct(ratio(r.tickets.ordered.cy, r.tickets.resolved.cy))}</TableCell>
                        <TableCell sx={num}>{n0(r.visits.total.cy)}</TableCell>
                        <TableCell sx={num}>{n0(r.registrations.companies.cy)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </GlassCard>
          )}

          {/* 1. Revenue & order intake */}
          <GlassCard>
            <CardTitle icon={<EuroIcon />} tint="purple" title="Revenue & order intake" note={`Month by month and by assortment · ${span}`} />
            <Box sx={grid(380)}>
              <PairTable head="Month" rows={rep.revenue.months.map((p, i) => ({ label: `Revenue · ${b.monthLabels[i]}`, p, fmt: money }))} />
              <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
                <Breakdown head="Assortment (revenue)" rec={rep.revenue.byPc} label={pcLabel} fmt={money} />
                {b.oiMonths > 0 && (
                  <PairTable head="Order intake" rows={rep.orderIntake.months.map((p, i) => ({ label: b.monthLabels[i], p, fmt: money }))} />
                )}
              </Box>
            </Box>
          </GlassCard>

          {/* 2. Customer development */}
          <GlassCard>
            <CardTitle icon={<GroupsIcon />} tint="green" title="Customer development" note="Existing customers, counted the same way in both years" />
            <Box sx={grid(380)}>
              <PairTable head="Customers" rows={[
                { label: "Active", note: "bought in the months compared", p: rep.customers.active },
                { label: "New", note: "first order ever in the months compared", p: rep.customers.new },
                { label: "Reactivated", note: "bought again after a whole year without", p: rep.customers.reactivated },
                { label: "Slowing", note: "bought less than half of the year before", p: rep.customers.slowing, goodWhenUp: false },
                { label: "Lost", note: "bought the year before, nothing since", p: rep.customers.lost, goodWhenUp: false },
                { label: "Churn rate %", note: "lost of those who bought the year before", p: { cy: (ratio(rep.customers.lost.cy, rep.customers.base.cy) ?? 0) * 100, py: (ratio(rep.customers.lost.py, rep.customers.base.py) ?? 0) * 100 }, points: true, fmt: (x) => `${x.toFixed(1)}%`, goodWhenUp: false },
                { label: "Potential of lost customers", p: rep.customers.lostPotential, fmt: money, goodWhenUp: false },
                { label: "Ø revenue per active customer", p: { cy: ratio(rep.revenue.ytd.cy, rep.customers.active.cy) ?? 0, py: ratio(rep.revenue.ytd.py, rep.customers.active.py) ?? 0 }, fmt: money },
              ]} />
              <Breakdown head="Active, by customer category" rec={rep.customers.activeByCategory} />
            </Box>
          </GlassCard>

          {/* 3. New customers */}
          <GlassCard>
            <CardTitle icon={<PersonAddAlt1Icon />} tint="blue" title="New customers" note={`First order ever in the months compared · ${n0(rep.newCustomers.visitedBefore)} of this year's were visited before their first order`} />
            <Box sx={grid(420)}>
              <PairTable head="New customers" rows={[
                { label: "Count", p: rep.customers.new },
                { label: "Revenue", p: rep.newCustomers.revenue, fmt: money },
                { label: "Ø revenue", p: { cy: ratio(rep.newCustomers.revenue.cy, rep.customers.new.cy) ?? 0, py: ratio(rep.newCustomers.revenue.py, rep.customers.new.py) ?? 0 }, fmt: money },
              ]} />
              <Breakdown head="Customer type" rec={rep.newCustomers.byType} label={typeLabel} />
              <Breakdown head="Potential (priority)" rec={rep.newCustomers.byPrio} />
              <Breakdown head="Assortment" rec={rep.newCustomers.byAssortment} label={pcLabel} />
            </Box>
          </GlassCard>

          {/* 4. Registrations */}
          <GlassCard>
            <CardTitle icon={<HowToRegIcon />} tint="pink" title="Registrations" note="Shop accounts opened, by company · last year's have had longer to convert" />
            <Box sx={grid(420)}>
              <PairTable head="Registrations" rows={[
                { label: "Shop accounts opened", p: rep.registrations.contacts },
                { label: "Companies registering", p: rep.registrations.companies },
                { label: "Of which bought since", p: rep.registrations.converted },
                { label: "Conversion %", p: { cy: (ratio(rep.registrations.converted.cy, rep.registrations.companies.cy) ?? 0) * 100, py: (ratio(rep.registrations.converted.py, rep.registrations.companies.py) ?? 0) * 100 }, points: true, fmt: (x) => `${x.toFixed(1)}%` },
                { label: "Median days to first order", p: speedPair(rep.registrations.daysToOrder), fmt: (x) => days(x), goodWhenUp: false },
              ]} />
              <Breakdown head="How they registered" rec={rep.registrations.byWay} />
              <Breakdown head="Customer type" rec={rep.registrations.byType} label={typeLabel} />
              <Breakdown head="Potential (priority)" rec={rep.registrations.byPrio} />
            </Box>
          </GlassCard>

          {/* 5. Tickets - while last year's pipeline held a fraction of today's
              tickets, counts would only show the pipeline filling up (75 orders
              becoming 1,524 is "+1,932%"), so only rates and speeds compare. */}
          <GlassCard>
            <CardTitle icon={<ConfirmationNumberIcon />} tint="amber" title="Tickets" note={ticketsComparable
              ? "The ESO pipeline, created in the months compared · ordered = Ordered or a one-shot order"
              : `The ESO pipeline, created in the months compared · ordered = Ordered or a one-shot order · last year the pipeline held ${n0(rep.tickets.created.py)} tickets against ${n0(rep.tickets.created.cy)} now, so only rates and speeds are compared`} />
            <Box sx={grid(340)}>
              <PairTable head="Tickets" rows={[
                { label: "Created", p: rep.tickets.created, noChange: !ticketsComparable },
                { label: "Closed", p: rep.tickets.closed, noChange: !ticketsComparable },
                { label: "Ordered", p: rep.tickets.ordered, noChange: !ticketsComparable },
                { label: "Success rate %", note: "ordered of those with a resolution", p: { cy: (ratio(rep.tickets.ordered.cy, rep.tickets.resolved.cy) ?? 0) * 100, py: (ratio(rep.tickets.ordered.py, rep.tickets.resolved.py) ?? 0) * 100 }, points: true, fmt: (x) => `${x.toFixed(1)}%` },
                { label: "Potential of ordered tickets", p: rep.tickets.orderedPotential, fmt: money, noChange: !ticketsComparable },
                { label: "Median to first reply", p: speedPair(rep.tickets.firstReplyH), fmt: (x) => hours(x), goodWhenUp: false },
                { label: "Median to work started / offer", p: speedPair(rep.tickets.offerH), fmt: (x) => hours(x), goodWhenUp: false },
                { label: "Median to close", p: speedPair(rep.tickets.closeD), fmt: (x) => days(x), goodWhenUp: false },
              ]} />
              <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
                <Breakdown head="Source" rec={rep.tickets.bySource} minBase={ticketsComparable ? 20 : Infinity} />
                <Breakdown head="Resolution" rec={rep.tickets.byResolution} minBase={ticketsComparable ? 20 : Infinity} />
              </Box>
              <Box>
                <Table size="small">
                  <TableHead><TableRow><TableCell sx={headCell}>Still open, by stage</TableCell><TableCell sx={numHead}>Tickets</TableCell><TableCell sx={numHead}>Potential</TableCell></TableRow></TableHead>
                  <TableBody>
                    {Object.entries(rep.tickets.openByStage).sort((a, c) => c[1].potential - a[1].potential).map(([k, v]) => (
                      <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{n0(v.count)}</TableCell><TableCell sx={num}>{money(v.potential)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </GlassCard>

          {/* 6. Visits */}
          <GlassCard>
            <CardTitle icon={<DirectionsCarIcon />} tint="green" title="Visits" note={`This year · ${n0(rep.visits.total.cy)} visits to ${n0(rep.visits.companies)} companies · typical (median) potential per visit ${rep.visits.potentialMedian === null ? "—" : money(rep.visits.potentialMedian)}`} />
            <Box sx={grid(260)}>
              <Box>
                <Table size="small">
                  <TableHead><TableRow><TableCell sx={headCell}>After the first visit</TableCell><TableCell sx={numHead}>Companies</TableCell><TableCell sx={numHead}>Share</TableCell></TableRow></TableHead>
                  <TableBody>
                    {[
                      ["First order ever after it", rep.visits.newAfter],
                      ["Ordered after it", rep.visits.boughtAfter],
                      ["Registered after the meeting", rep.visits.registeredAfter],
                    ].map(([k, v]) => (
                      <TableRow key={k as string}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{n0(v as number)}</TableCell><TableCell sx={{ ...num, color: MUTED }}>{pct(ratio(v as number, rep.visits.companies))}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>Ø revenue per visited company</TableCell><TableCell sx={num} colSpan={2}>{rep.visits.revenuePerCompany === null ? "—" : money(rep.visits.revenuePerCompany)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </Box>
              <Counts head="Type of visit" rec={rep.visits.byType} />
              <Counts head="Potential (priority)" rec={rep.visits.byPrio} />
              <Counts head="Customer category" rec={rep.visits.byCategory} />
              <Counts head="Month" rec={Object.fromEntries(rep.visits.months.map((v, i) => [b.monthLabels[i], v]).filter(([, v]) => (v as number) > 0))} />
            </Box>
          </GlassCard>

          {/* 7. Shop behaviour */}
          <GlassCard>
            <CardTitle icon={<StorefrontIcon />} tint="blue" title="Shop behaviour" note="Logins and views this year to date; last year is the whole year (the Datatracker keeps one total per year)" />
            <Box sx={grid(300)}>
              <Table size="small">
                <TableHead><TableRow><TableCell sx={headCell}>Customers in the shop</TableCell><TableCell sx={numHead}>This year</TableCell><TableCell sx={numHead}>Last year, whole</TableCell></TableRow></TableHead>
                <TableBody>
                  {[
                    ["Companies that logged in", n0(rep.shop.loggedIn), n0(rep.shop.loggedInPyFull)],
                    ["Logins", n0(rep.shop.logins), n0(rep.shop.loginsPyFull)],
                    ["Views", n0(rep.shop.views), n0(rep.shop.viewsPyFull)],
                    ["Logged in, never viewed an article", n0(rep.shop.loggedNoView), "—"],
                    ["Logged in and bought", n0(rep.shop.loggedBought), "—"],
                    ["Conversion (bought of logged in)", pct(ratio(rep.shop.loggedBought, rep.shop.loggedIn)), "—"],
                  ].map(([k, a, c]) => (
                    <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{a}</TableCell><TableCell sx={{ ...num, color: MUTED }}>{c}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table size="small">
                <TableHead><TableRow><TableCell sx={headCell}>Customer category</TableCell><TableCell sx={numHead}>Logged in</TableCell><TableCell sx={numHead}>Bought</TableCell><TableCell sx={numHead}>Conversion</TableCell></TableRow></TableHead>
                <TableBody>
                  {Object.entries(rep.shop.byCategory).sort((a, c) => c[1].loggedIn - a[1].loggedIn).map(([k, v]) => (
                    <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{n0(v.loggedIn)}</TableCell><TableCell sx={num}>{n0(v.bought)}</TableCell><TableCell sx={{ ...num, color: MUTED }}>{pct(ratio(v.bought, v.loggedIn))}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table size="small">
                <TableHead><TableRow><TableCell sx={headCell}>This year&apos;s buyers, by orders ever</TableCell><TableCell sx={numHead}>Companies</TableCell><TableCell sx={numHead}>Share</TableCell></TableRow></TableHead>
                <TableBody>
                  {([["One order (one-shot)", rep.shop.orderHistory.one], ["Two orders", rep.shop.orderHistory.two], ["Three or more", rep.shop.orderHistory.more]] as const).map(([k, v]) => (
                    <TableRow key={k}><TableCell sx={{ ...bodyCell, fontSize: "0.85rem" }}>{k}</TableCell><TableCell sx={num}>{n0(v)}</TableCell><TableCell sx={{ ...num, color: MUTED }}>{pct(ratio(v, rep.customers.active.cy))}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>

          {/* What the data cannot answer */}
          <GlassCard>
            <CardTitle icon={<InfoOutlinedIcon />} tint="slate" title="What this cannot show yet" note="Asked for in the deck, not in the data - named rather than guessed" />
            <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75 }}>
              {b.gaps.map((g) => <Typography component="li" key={g} sx={{ fontSize: "0.85rem", color: MUTED }}>{g}</Typography>)}
              <Typography component="li" sx={{ fontSize: "0.85rem", color: MUTED }}>
                Coverage: {n0(b.coverage.visitsRoster)} of {n0(b.coverage.visitsTotal)} visits in the window are owned by an ESO rep, {n0(b.coverage.visitsWithCompany)} are linked to a company;
                {" "}{n0(b.coverage.ticketsOffRoster.cy)} ESO tickets this year have an owner outside the ESO roster and are not counted.
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: FAINT, mt: 1.5 }}>
              Read {state?.computedAt ? new Date(state.computedAt).toLocaleString("en-GB") : new Date(b.generatedAt).toLocaleString("en-GB")} · refreshed every 12 hours on first visit.
            </Typography>
          </GlassCard>
        </>
      )}
    </Box>
  );
}
