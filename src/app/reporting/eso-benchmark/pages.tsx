"use client";
// THE SEVEN ESO PAGES, in the deck's order (SARCLA 12.10: Visits first), each as Digital Growth draws a page
// (SARCLA 21.10.2026: "the ESO reporting in the same structure as the digital growth"): its figures top right,
// a tab per breakdown, the tab's charts side by side, then all its figures. Every chart is here by "<tab>:<chart>",
// so the page and the ESO BUC View draw the same one. The figures and their rules are those of the sub-apps they
// replace (12.10) - the same read, esoBenchmark.ts.

import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import EuroOutlinedIcon from "@mui/icons-material/EuroOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import RepeatIcon from "@mui/icons-material/Repeat";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import Box from "@mui/material/Box";

import { CATEGORY_BANDS, PRIO_BANDS, VISIT_KINDS } from "@/lib/reporting/esoRules";
import { Table } from "@/app/reporting/marketing-kpis/ExplorerKit";
import { GREEN, MUTED, RED } from "@/app/uc/report/ui";
import { days, hours, money, moneyShort, n0, pcLabel, pct, ratio, sumPairs, typeLabel, type Pair, type RepBenchmark } from "./shared";
import {
  Change, GroupChart, MonthChart, PairRows, RepChart, RepRows, StackedMonths, chg, monthsRec, ordered,
  type EsoCtx, type EsoPageDef,
} from "./EsoKit";

const P = (cy: number, py: number): Pair => ({ cy, py });
/** A rate as a pair of percentages, so its change reads in points. */
const rate = (a: Pair, b: Pair): Pair => P((ratio(a.cy, b.cy) ?? 0) * 100, (ratio(a.py, b.py) ?? 0) * 100);
const perCent = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : "—");
const pointsD = (p: Pair, goodWhenUp: boolean) => {
  const d = p.cy - p.py;
  return Number.isFinite(d) ? { text: `${d > 0 ? "↑" : d < 0 ? "↓" : "±"} ${Math.abs(d).toFixed(1)} pts`, color: Math.abs(d) < 0.05 ? MUTED : (d > 0) === goodWhenUp ? GREEN : RED } : null;
};
const cell = (p: Pair, fmt: (n: number) => string = n0, goodWhenUp = true) => [fmt(p.cy), <Box key="py" component="span" sx={{ color: MUTED }}>{fmt(p.py)}</Box>, <Change key="d" p={p} goodWhenUp={goodWhenUp} />];

/* ── 1 · visits ────────────────────────────────────────────────────────── */

const visitTotal = (r: RepBenchmark, months: number) => sumPairs(r.visits.months.slice(0, months));
/** Ø yearly potential of the companies visited, over the rep's completed visits */
const avgPot = (r: RepBenchmark): Pair => {
  const p = r.visits.potential;
  return P(p.companyN.cy ? p.companySum.cy / p.companyN.cy : 0, p.companyN.py ? p.companySum.py / p.companyN.py : 0);
};
const VISIT_NOTE = "Completed visit reports only (the stage \"Visit and Report complete\"), by meeting date - visits are recorded in HubSpot since 2026, so last year is empty.";

function RepMonths({ c }: { c: EsoCtx }) {
  const L = c.b.monthLabels.slice(0, c.months);
  return (
    <Table head={["Sales rep", ...L, c.cy, c.py, "Change"]} firstWidth="minmax(160px, 1.6fr)" widths={[...L.map(() => "minmax(40px, .55fr)"), "minmax(90px, 1fr)", "minmax(90px, 1fr)", "minmax(76px, .8fr)"]}
      minWidth={180 + L.length * 44 + 270}
      rows={[
        ...c.b.reps.map((r) => {
          const t = visitTotal(r, c.months);
          return { key: r.ownerId, on: c.sel.includes(r.ownerId), onPick: c.onRep ? () => c.onRep!(r.ownerId) : undefined, cells: [r.name, ...r.visits.months.slice(0, c.months).map((p) => (p.cy ? n0(p.cy) : "")), ...cell(t)] };
        }),
        { key: "total", strong: true, cells: [c.sel.length ? "The chosen reps" : "All of ESO", ...c.rep.visits.months.slice(0, c.months).map((p) => n0(p.cy)), ...cell(visitTotal(c.rep, c.months))] },
      ]} />
  );
}

/** A tab of visits by one breakdown kept month by month: the groups, then this year month by month. */
const visitsBy = (id: string, label: string, title: string, note: string, icon: React.ReactNode, tint: "purple" | "blue" | "slate", pick: (r: RepBenchmark) => Record<string, Pair[]>, keys: readonly string[]): EsoPageDef["tabs"][number] => ({
  id, label, icon, tint, title: () => title, note: () => note, charts: ["groups", "months"],
  table: {
    title: `All the figures, by ${label.toLowerCase()}`,
    draw: (c) => {
      const rec = monthsRec(pick(c.rep), c.months);
      return <PairRows c={c} head={label} rows={ordered(rec, keys).map((k) => ({ label: k, p: rec[k] }))} total={{ label: "All completed visits", p: visitTotal(c.rep, c.months) }} />;
    },
  },
});

export const VISITS: EsoPageDef = {
  slug: "visits", title: "Visits", line: "completed visit reports only", icon: <DirectionsCarOutlinedIcon />, tint: "green", gaps: /visit/i,
  figures: (c) => {
    const v = c.rep.visits, t = visitTotal(c.rep, c.months), pot = avgPot(c.rep);
    return [
      { label: "Completed visits", icon: <DirectionsCarOutlinedIcon />, tint: "green", value: n0(t.cy), d: chg(t), sub: t.py ? `${n0(t.py)} last year` : "none recorded last year" },
      { label: "Ø potential per visit", icon: <EuroOutlinedIcon />, tint: "purple", value: pot.cy ? money(pot.cy) : "—", d: chg(pot), sub: "the visited company's yearly potential" },
      { label: "Companies visited", icon: <ApartmentOutlinedIcon />, tint: "blue", value: n0(v.companies.cy), d: chg(v.companies), sub: `Ø revenue this year ${v.companies.cy ? money(v.revenueOfVisited.cy / v.companies.cy) : "—"}` },
      { label: "Visits to new customers", icon: <PersonAddAltOutlinedIcon />, tint: "amber", value: n0(v.newCustomers.visits.cy), sub: `${n0(v.newCustomers.companies.cy)} companies that had never ordered` },
    ];
  },
  tabs: [
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "green", title: () => "Visits per sales rep and month", note: () => VISIT_NOTE, charts: ["reps", "potential", "months"],
      table: { title: "All the figures, by sales rep and month", draw: (c) => <RepMonths c={c} /> } },
    visitsBy("prio", "Priority", "Visits by priority (potential)", "The visited company's priority: Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500", <FlagOutlinedIcon />, "purple", (r) => r.visits.byPrio, PRIO_BANDS),
    visitsBy("category", "Customer category", "Visits by customer category", "The visited company's APSO customer category - Other = APSOlost, APSOmicro, Growth Engine and not set", <CategoryOutlinedIcon />, "blue", (r) => r.visits.byCategory, CATEGORY_BANDS),
    visitsBy("kind", "Agreed or cold", "Agreed or cold", "The visit's type: agreed (scheduled), cold, or at an event", <HandshakeOutlinedIcon />, "slate", (r) => r.visits.byKind, VISIT_KINDS),
    { id: "new", label: "New customers", icon: <PersonAddAltOutlinedIcon />, tint: "amber", title: () => "Visits to new customers", note: () => "Companies that had never ordered when they were first visited this year - what came of the visit", charts: ["funnel", "way"],
      table: {
        title: "All the figures, the new customers visited",
        draw: (c) => {
          const nc = c.rep.visits.newCustomers;
          return <PairRows c={c} head="Companies" rows={[
            { label: "Visits to companies that had never ordered", p: nc.visits },
            { label: "Companies visited that had never ordered", p: nc.companies },
            { label: "Registered in the shop after the visit", p: nc.registeredAfter, note: pct(ratio(nc.registeredAfter.cy, nc.companies.cy)) + " of them" },
            { label: `Bought after the visit, by ${c.b.monthLabels[c.months - 1]}`, p: nc.boughtAfter, note: pct(ratio(nc.boughtAfter.cy, nc.companies.cy)) + " of them" },
            ...Object.entries(nc.byWay).sort((a, b) => b[1].cy - a[1].cy).map(([k, p]) => ({ label: `Registered: ${k.toLowerCase()}`, p })),
          ]} />;
        },
      },
      foot: () => "Whether the ESO registered a customer on their behalf is not recorded in HubSpot." },
  ],
  charts: {
    "reps:reps": { title: "Completed visits per sales rep", draw: (c) => <RepChart c={c} title="Completed visits per sales rep" value={(r) => visitTotal(r, c.months)} /> },
    "reps:potential": { title: "Ø potential per visit, per sales rep", draw: (c) => <RepChart c={c} title="Ø potential per visit, per sales rep" value={avgPot} fmt={money} /> },
    "reps:months": { title: "Visits month by month", draw: (c) => <MonthChart c={c} title="Visits month by month" note={`${c.sel.length ? "The chosen reps" : "All of ESO"} - completed visit reports, by meeting date`} pairs={c.rep.visits.months} /> },
    "prio:groups": { title: "Visits by priority", draw: (c) => <GroupChart c={c} title="Visits by priority" rec={monthsRec(c.rep.visits.byPrio, c.months)} order={ordered(monthsRec(c.rep.visits.byPrio, c.months), PRIO_BANDS)} /> },
    "prio:months": { title: "Visits by priority, month by month", draw: (c) => <StackedMonths c={c} title="Visits by priority, month by month" note="This year" rec={c.rep.visits.byPrio} keys={PRIO_BANDS} /> },
    "category:groups": { title: "Visits by customer category", draw: (c) => <GroupChart c={c} title="Visits by customer category" rec={monthsRec(c.rep.visits.byCategory, c.months)} order={ordered(monthsRec(c.rep.visits.byCategory, c.months), CATEGORY_BANDS)} /> },
    "category:months": { title: "Visits by customer category, month by month", draw: (c) => <StackedMonths c={c} title="Visits by customer category, month by month" note="This year" rec={c.rep.visits.byCategory} keys={CATEGORY_BANDS} /> },
    "kind:groups": { title: "Visits by type", draw: (c) => <GroupChart c={c} title="Visits by type" rec={monthsRec(c.rep.visits.byKind, c.months)} order={ordered(monthsRec(c.rep.visits.byKind, c.months), VISIT_KINDS)} /> },
    "kind:months": { title: "Visits by type, month by month", draw: (c) => <StackedMonths c={c} title="Visits by type, month by month" note="This year" rec={c.rep.visits.byKind} keys={VISIT_KINDS} /> },
    "new:funnel": {
      title: "From visit to order",
      draw: (c) => {
        const nc = c.rep.visits.newCustomers;
        const steps = ["Visited, had never ordered", "Registered in the shop after the visit", "Bought after the visit"];
        return <GroupChart c={c} title="From visit to order" single order={steps} rec={{ [steps[0]]: nc.companies, [steps[1]]: nc.registeredAfter, [steps[2]]: nc.boughtAfter }} />;
      },
    },
    "new:way": { title: "In what way did they register?", draw: (c) => <GroupChart c={c} title="In what way did they register?" rec={c.rep.visits.newCustomers.byWay} /> },
  },
};

/* ── 2 · customer development ──────────────────────────────────────────── */

const STATUS = ["Active", "New", "Reactivated", "Slowing", "Lost"] as const;
const statusRec = (r: RepBenchmark): Record<string, Pair> => ({ Active: r.customers.active, New: r.customers.new, Reactivated: r.customers.reactivated, Slowing: r.customers.slowing, Lost: r.customers.lost });
const churnOf = (r: RepBenchmark) => rate(r.customers.lost, r.customers.base);

export const CUSTOMERS: EsoPageDef = {
  slug: "customers", title: "Customer development", line: "existing customers, counted the same way in both years", icon: <GroupsOutlinedIcon />, tint: "green", gaps: /CURRENT owner/i,
  figures: (c) => {
    const k = c.rep.customers, churn = churnOf(c.rep);
    return [
      { label: "Active customers", icon: <GroupsOutlinedIcon />, tint: "green", value: n0(k.active.cy), d: chg(k.active), sub: `${n0(k.active.py)} last year` },
      { label: "Lost customers", icon: <TrendingDownOutlinedIcon />, tint: "pink", value: n0(k.lost.cy), d: chg(k.lost, false), sub: `${n0(k.lost.py)} last year` },
      { label: "Churn rate", icon: <TrendingDownOutlinedIcon />, tint: "amber", value: perCent(churn.cy), d: pointsD(churn, false), sub: `lost of those who bought the year before · last year ${perCent(churn.py)}` },
      { label: "Potential of lost customers", icon: <EuroOutlinedIcon />, tint: "purple", value: moneyShort(k.lostPotential.cy), d: chg(k.lostPotential, false), sub: `${moneyShort(k.lostPotential.py)} last year` },
    ];
  },
  tabs: [
    { id: "status", label: "Where they stand", icon: <GroupsOutlinedIcon />, tint: "green", title: () => "Where the customers stand", note: () => "Active = bought in the months compared; new = first order ever; reactivated = bought again after a whole year without; slowing = less than half of the year before; lost = bought the year before, nothing since", charts: ["status"],
      table: {
        title: "All the figures",
        draw: (c) => {
          const k = c.rep.customers;
          return <PairRows c={c} head="Customers" rows={[
            { label: "Active", note: "bought in the months compared", p: k.active },
            { label: "New", note: "first order ever in the months compared", p: k.new },
            { label: "Reactivated", note: "bought again after a whole year without", p: k.reactivated },
            { label: "Slowing", note: "bought less than half of the year before", p: k.slowing, goodWhenUp: false },
            { label: "Lost", note: "bought the year before, nothing since", p: k.lost, goodWhenUp: false },
            { label: "Churn rate", note: "lost of those who bought the year before", p: churnOf(c.rep), fmt: perCent, goodWhenUp: false, points: true },
            { label: "Potential of lost customers", p: k.lostPotential, fmt: money, goodWhenUp: false },
            { label: "Ø revenue per active customer", p: P(ratio(c.rep.revenue.ytd.cy, k.active.cy) ?? 0, ratio(c.rep.revenue.ytd.py, k.active.py) ?? 0), fmt: money },
          ]} />;
        },
      } },
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "green", title: () => "Customers per sales rep", note: () => "Active and lost customers of each rep's companies - click a bar or a row to choose reps", charts: ["active", "lost"],
      table: {
        title: "All the figures, by sales rep",
        draw: (c) => <RepRows c={c} head={["Active", "Last year", "Change", "New", "Reactivated", "Slowing", "Lost", "Churn rate"]}
          cells={(r) => [...cell(r.customers.active), n0(r.customers.new.cy), n0(r.customers.reactivated.cy), n0(r.customers.slowing.cy), n0(r.customers.lost.cy), perCent(churnOf(r).cy)]}
          total={[...cell(c.rep.customers.active), n0(c.rep.customers.new.cy), n0(c.rep.customers.reactivated.cy), n0(c.rep.customers.slowing.cy), n0(c.rep.customers.lost.cy), perCent(churnOf(c.rep).cy)]} />,
      } },
    { id: "category", label: "Customer category", icon: <CategoryOutlinedIcon />, tint: "blue", title: () => "Active customers by customer category", note: () => "The company's APSO customer category today", charts: ["category"],
      table: { title: "All the figures, by customer category", draw: (c) => { const rec = c.rep.customers.activeByCategory; return <PairRows c={c} head="Customer category" rows={ordered(rec, CATEGORY_BANDS).map((k) => ({ label: k, p: rec[k] }))} total={{ label: "All active customers", p: c.rep.customers.active }} />; } } },
  ],
  charts: {
    "status:status": { title: "Where the customers stand", draw: (c) => <GroupChart c={c} title="Where the customers stand" rec={statusRec(c.rep)} order={STATUS} /> },
    "reps:active": { title: "Active customers per sales rep", draw: (c) => <RepChart c={c} title="Active customers per sales rep" value={(r) => r.customers.active} /> },
    "reps:lost": { title: "Lost customers per sales rep", draw: (c) => <RepChart c={c} title="Lost customers per sales rep" value={(r) => r.customers.lost} /> },
    "category:category": { title: "Active customers by customer category", draw: (c) => <GroupChart c={c} title="Active customers by customer category" rec={c.rep.customers.activeByCategory} order={ordered(c.rep.customers.activeByCategory, CATEGORY_BANDS)} /> },
  },
};

/* ── 3 · new customers ─────────────────────────────────────────────────── */

const newAvg = (r: RepBenchmark) => P(ratio(r.newCustomers.revenue.cy, r.customers.new.cy) ?? 0, ratio(r.newCustomers.revenue.py, r.customers.new.py) ?? 0);
const newBy = (id: string, label: string, title: string, note: string, icon: React.ReactNode, tint: "purple" | "blue" | "amber", pick: (r: RepBenchmark) => Record<string, Pair>, name: (k: string) => string = (k) => k, first: readonly string[] = []): EsoPageDef["tabs"][number] => ({
  id, label, icon, tint, title: () => title, note: () => note, charts: ["groups"],
  table: { title: `All the figures, by ${label.toLowerCase()}`, draw: (c) => { const rec = pick(c.rep); return <PairRows c={c} head={label} rows={ordered(rec, first).map((k) => ({ label: name(k), p: rec[k] }))} total={{ label: "All new customers", p: c.rep.customers.new }} />; } },
});

export const NEW_CUSTOMERS: EsoPageDef = {
  slug: "new-customers", title: "New customers", line: "first order ever in the months compared", icon: <PersonAddAltOutlinedIcon />, tint: "blue",
  figures: (c) => {
    const n = c.rep.newCustomers, k = c.rep.customers.new, avg = newAvg(c.rep);
    return [
      { label: "New customers", icon: <PersonAddAltOutlinedIcon />, tint: "blue", value: n0(k.cy), d: chg(k), sub: `${n0(k.py)} last year` },
      { label: "Their revenue", icon: <EuroOutlinedIcon />, tint: "purple", value: moneyShort(n.revenue.cy), d: chg(n.revenue), sub: `${moneyShort(n.revenue.py)} last year` },
      { label: "Ø revenue per new customer", icon: <EuroOutlinedIcon />, tint: "green", value: money(avg.cy), d: chg(avg), sub: `${money(avg.py)} last year` },
      { label: "Visited before their first order", icon: <DirectionsCarOutlinedIcon />, tint: "amber", value: n0(n.visitedBefore), sub: "with a completed visit before they ordered" },
    ];
  },
  tabs: [
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "blue", title: () => "New customers per sales rep", note: () => "How many first orders each rep's companies placed, and what they bought for", charts: ["count", "revenue"],
      table: {
        title: "All the figures, by sales rep",
        draw: (c) => <RepRows c={c} head={["New customers", "Last year", "Change", "Their revenue", "Last year", "Change", "Ø per customer"]}
          cells={(r) => [...cell(r.customers.new), ...cell(r.newCustomers.revenue, money), money(newAvg(r).cy)]}
          total={[...cell(c.rep.customers.new), ...cell(c.rep.newCustomers.revenue, money), money(newAvg(c.rep).cy)]} />,
      } },
    newBy("type", "Customer type", "New customers by customer type", "OEM, MRO, C2S workshop… as HubSpot has the company", <CategoryOutlinedIcon />, "purple", (r) => r.newCustomers.byType, typeLabel),
    newBy("prio", "Priority", "New customers by priority (potential)", "Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500", <FlagOutlinedIcon />, "blue", (r) => r.newCustomers.byPrio, (k) => k, PRIO_BANDS),
    newBy("assortment", "Assortment", "New customers by assortment", "The profit centre they bought most from", <ShoppingBagOutlinedIcon />, "amber", (r) => r.newCustomers.byAssortment, pcLabel),
  ],
  charts: {
    "reps:count": { title: "New customers per sales rep", draw: (c) => <RepChart c={c} title="New customers per sales rep" value={(r) => r.customers.new} /> },
    "reps:revenue": { title: "Their revenue, per sales rep", draw: (c) => <RepChart c={c} title="Their revenue, per sales rep" value={(r) => r.newCustomers.revenue} fmt={moneyShort} /> },
    "type:groups": { title: "New customers by customer type", draw: (c) => <GroupChart c={c} title="New customers by customer type" rec={c.rep.newCustomers.byType} label={typeLabel} /> },
    "prio:groups": { title: "New customers by priority", draw: (c) => <GroupChart c={c} title="New customers by priority" rec={c.rep.newCustomers.byPrio} order={ordered(c.rep.newCustomers.byPrio, PRIO_BANDS)} /> },
    "assortment:groups": { title: "New customers by assortment", draw: (c) => <GroupChart c={c} title="New customers by assortment" rec={c.rep.newCustomers.byAssortment} label={pcLabel} /> },
  },
};

/* ── 4 · registrations ─────────────────────────────────────────────────── */

const FUNNEL = ["Shop accounts opened", "Companies registering", "Bought since"] as const;
const regBy = (id: string, label: string, title: string, note: string, icon: React.ReactNode, tint: "pink" | "purple" | "blue", pick: (r: RepBenchmark) => Record<string, Pair>, name: (k: string) => string = (k) => k, first: readonly string[] = []): EsoPageDef["tabs"][number] => ({
  id, label, icon, tint, title: () => title, note: () => note, charts: ["groups"],
  table: { title: `All the figures, by ${label.toLowerCase()}`, draw: (c) => { const rec = pick(c.rep); return <PairRows c={c} head={label} rows={ordered(rec, first).map((k) => ({ label: name(k), p: rec[k] }))} total={{ label: "All companies registering", p: c.rep.registrations.companies }} />; } },
});

export const REGISTRATIONS: EsoPageDef = {
  slug: "registrations", title: "Registrations", line: "shop accounts, by company", icon: <HowToRegOutlinedIcon />, tint: "pink", gaps: /regist/i,
  figures: (c) => {
    const g = c.rep.registrations;
    return [
      { label: "Companies registering", icon: <HowToRegOutlinedIcon />, tint: "pink", value: n0(g.companies.cy), d: chg(g.companies), sub: `${n0(g.companies.py)} last year` },
      { label: "Bought since", icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", value: pct(ratio(g.converted.cy, g.companies.cy)), sub: `${n0(g.converted.cy)} companies · last year ${pct(ratio(g.converted.py, g.companies.py))}` },
      { label: "Median days to the first order", icon: <TimerOutlinedIcon />, tint: "amber", value: days(g.daysToOrder.cy), sub: `last year ${days(g.daysToOrder.py)}` },
      { label: "Shop accounts opened", icon: <PersonAddAltOutlinedIcon />, tint: "blue", value: n0(g.contacts.cy), d: chg(g.contacts), sub: `${n0(g.contacts.py)} last year` },
    ];
  },
  tabs: [
    { id: "funnel", label: "What came of them", icon: <HowToRegOutlinedIcon />, tint: "pink", title: () => "Registrations and what came of them", note: () => "Shop accounts opened in the months compared at the reps' companies - last year's have had longer to buy", charts: ["funnel"],
      table: {
        title: "All the figures",
        draw: (c) => {
          const g = c.rep.registrations;
          return <PairRows c={c} head="Registrations" rows={[
            { label: "Shop accounts opened", p: g.contacts },
            { label: "Companies registering", p: g.companies },
            { label: "Of which bought since", p: g.converted },
            { label: "Conversion", note: "bought since, of the companies registering", p: rate(g.converted, g.companies), fmt: perCent, points: true },
            { label: "Median days to the first order", p: P(g.daysToOrder.cy ?? NaN, g.daysToOrder.py ?? NaN), fmt: (x) => days(x), goodWhenUp: false },
          ]} />;
        },
      } },
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "pink", title: () => "Registrations per sales rep", note: () => "Companies registering at each rep's book, and how many bought since", charts: ["companies", "bought"],
      table: {
        title: "All the figures, by sales rep",
        draw: (c) => <RepRows c={c} head={["Companies registering", "Last year", "Change", "Bought since", "Conversion", "Median days to order"]}
          cells={(r) => [...cell(r.registrations.companies), n0(r.registrations.converted.cy), pct(ratio(r.registrations.converted.cy, r.registrations.companies.cy)), days(r.registrations.daysToOrder.cy)]}
          total={[...cell(c.rep.registrations.companies), n0(c.rep.registrations.converted.cy), pct(ratio(c.rep.registrations.converted.cy, c.rep.registrations.companies.cy)), days(c.rep.registrations.daysToOrder.cy)]} />,
      } },
    regBy("way", "How they registered", "How they registered", "Before or after an ESO visit, as HubSpot records it on the company", <AltRouteIcon />, "purple", (r) => r.registrations.byWay),
    regBy("type", "Customer type", "Registrations by customer type", "OEM, MRO, C2S workshop… as HubSpot has the company", <CategoryOutlinedIcon />, "blue", (r) => r.registrations.byType, typeLabel),
    regBy("prio", "Priority", "Registrations by priority (potential)", "Prio 1 above €25,000 potential, Prio 2 €2,500-25,000, Prio 3 €500-2,500", <FlagOutlinedIcon />, "pink", (r) => r.registrations.byPrio, (k) => k, PRIO_BANDS),
  ],
  charts: {
    "funnel:funnel": { title: "Registrations and what came of them", draw: (c) => { const g = c.rep.registrations; return <GroupChart c={c} title="Registrations and what came of them" order={FUNNEL} rec={{ [FUNNEL[0]]: g.contacts, [FUNNEL[1]]: g.companies, [FUNNEL[2]]: g.converted }} />; } },
    "reps:companies": { title: "Companies registering, per sales rep", draw: (c) => <RepChart c={c} title="Companies registering, per sales rep" value={(r) => r.registrations.companies} /> },
    "reps:bought": { title: "Bought since, per sales rep", draw: (c) => <RepChart c={c} title="Bought since, per sales rep" value={(r) => r.registrations.converted} /> },
    "way:groups": { title: "How they registered", draw: (c) => <GroupChart c={c} title="How they registered" rec={c.rep.registrations.byWay} /> },
    "type:groups": { title: "Registrations by customer type", draw: (c) => <GroupChart c={c} title="Registrations by customer type" rec={c.rep.registrations.byType} label={typeLabel} /> },
    "prio:groups": { title: "Registrations by priority", draw: (c) => <GroupChart c={c} title="Registrations by priority" rec={c.rep.registrations.byPrio} order={ordered(c.rep.registrations.byPrio, PRIO_BANDS)} /> },
  },
};

/* ── 6 · tickets ───────────────────────────────────────────────────────── */

/** Last year's pipeline held a fraction of today's tickets: counts would only show it filling up - rates and speeds are compared. */
const comparable = (r: RepBenchmark) => r.tickets.created.py >= 0.3 * r.tickets.created.cy;
const success = (r: RepBenchmark) => rate(r.tickets.ordered, r.tickets.resolved);
const speed = (s: { cy: number | null; py: number | null }) => P(s.cy ?? NaN, s.py ?? NaN);
const openOf = (r: RepBenchmark) => Object.entries(r.tickets.openByStage).sort((a, b) => b[1].potential - a[1].potential);
const thin = (c: EsoCtx) => (comparable(c.rep) ? "" : ` · last year's pipeline held ${n0(c.rep.tickets.created.py)} tickets: counts are not compared`);

export const TICKETS: EsoPageDef = {
  slug: "tickets", title: "Tickets", line: "the ESO pipeline", icon: <ConfirmationNumberOutlinedIcon />, tint: "amber", gaps: /Tickets/i,
  figures: (c) => {
    const t = c.rep.tickets, open = openOf(c.rep);
    return [
      { label: "Tickets created", icon: <ConfirmationNumberOutlinedIcon />, tint: "amber", value: n0(t.created.cy), d: comparable(c.rep) ? chg(t.created) : null, sub: comparable(c.rep) ? `${n0(t.created.py)} last year` : `last year's pipeline held ${n0(t.created.py)}` },
      { label: "Ended in an order", icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", value: pct(ratio(t.ordered.cy, t.resolved.cy)), d: pointsD(success(c.rep), true), sub: `${n0(t.ordered.cy)} of ${n0(t.resolved.cy)} with a resolution` },
      { label: "Median to the first reply", icon: <TimerOutlinedIcon />, tint: "blue", value: hours(t.firstReplyH.cy), sub: `last year ${hours(t.firstReplyH.py)}` },
      { label: "Potential still open", icon: <EuroOutlinedIcon />, tint: "purple", value: moneyShort(open.reduce((s, [, v]) => s + v.potential, 0)), sub: `${n0(open.reduce((s, [, v]) => s + v.count, 0))} open tickets from this year` },
    ];
  },
  tabs: [
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "amber", title: () => "Tickets per sales rep", note: (c) => `The ESO pipeline's tickets of each rep, and how many ended in an order${thin(c)}`, charts: ["created", "ordered"],
      table: {
        title: "All the figures, by sales rep",
        draw: (c) => <RepRows c={c} head={["Created", "Closed", "Ordered", "Ended in an order", "Last year", "Median first reply"]}
          cells={(r) => [n0(r.tickets.created.cy), n0(r.tickets.closed.cy), n0(r.tickets.ordered.cy), perCent(success(r).cy), <Box key="py" component="span" sx={{ color: MUTED }}>{perCent(success(r).py)}</Box>, hours(r.tickets.firstReplyH.cy)]}
          total={[n0(c.rep.tickets.created.cy), n0(c.rep.tickets.closed.cy), n0(c.rep.tickets.ordered.cy), perCent(success(c.rep).cy), perCent(success(c.rep).py), hours(c.rep.tickets.firstReplyH.cy)]} />,
      } },
    { id: "speed", label: "Success & speed", icon: <TimerOutlinedIcon />, tint: "blue", title: () => "Success and speed", note: (c) => `Ordered = Ordered or a one-shot order · speeds are medians, left empty on fewer than 20 tickets${thin(c)}`, charts: ["counts"],
      table: {
        title: "All the figures",
        draw: (c) => {
          const t = c.rep.tickets, nc = !comparable(c.rep);
          return <PairRows c={c} head="Tickets" rows={[
            { label: "Created", p: t.created, noChange: nc },
            { label: "Closed", p: t.closed, noChange: nc },
            { label: "Ordered", p: t.ordered, noChange: nc },
            { label: "Ended in an order", note: "ordered, of those with a resolution", p: success(c.rep), fmt: perCent, points: true },
            { label: "Potential of the ordered tickets", p: t.orderedPotential, fmt: money, noChange: nc },
            { label: "Median to the first reply", p: speed(t.firstReplyH), fmt: (x) => hours(x), goodWhenUp: false },
            { label: "Median to work started / offer", p: speed(t.offerH), fmt: (x) => hours(x), goodWhenUp: false },
            { label: "Median to close", p: speed(t.closeD), fmt: (x) => days(x), goodWhenUp: false },
          ]} />;
        },
      } },
    { id: "source", label: "Source", icon: <AltRouteIcon />, tint: "purple", title: () => "Where the tickets come from", note: (c) => `The ticket's source${thin(c)}`, charts: ["source"],
      table: { title: "All the figures, by source", draw: (c) => { const rec = c.rep.tickets.bySource; return <PairRows c={c} head="Source" rows={ordered(rec, []).map((k) => ({ label: k, p: rec[k], noChange: !comparable(c.rep) }))} total={{ label: "All tickets", p: c.rep.tickets.created, noChange: !comparable(c.rep) }} />; } } },
    { id: "resolution", label: "Resolution", icon: <FactCheckOutlinedIcon />, tint: "green", title: () => "How the tickets end", note: (c) => `The resolution set when closed${thin(c)}`, charts: ["resolution"],
      table: { title: "All the figures, by resolution", draw: (c) => { const rec = c.rep.tickets.byResolution; return <PairRows c={c} head="Resolution" rows={ordered(rec, []).map((k) => ({ label: k, p: rec[k], noChange: !comparable(c.rep) }))} />; } } },
    { id: "open", label: "Still open", icon: <HourglassBottomOutlinedIcon />, tint: "slate", title: () => "Still open, by stage", note: () => "This year's tickets not closed yet - how many, and the potential they carry", charts: ["count", "potential"],
      table: {
        title: "All the figures, by stage",
        draw: (c) => {
          const open = openOf(c.rep);
          return (
            <Table head={["Stage", "Open tickets", "Potential"]} firstWidth="minmax(220px, 2fr)"
              rows={[...open.map(([k, v]) => ({ key: k, cells: [k, n0(v.count), money(v.potential)] })),
                { key: "total", strong: true, cells: ["All open", n0(open.reduce((s, [, v]) => s + v.count, 0)), money(open.reduce((s, [, v]) => s + v.potential, 0))] }]} />
          );
        },
      } },
  ],
  charts: {
    "reps:created": { title: "Tickets created, per sales rep", draw: (c) => <RepChart c={c} title="Tickets created, per sales rep" value={(r) => r.tickets.created} /> },
    "reps:ordered": { title: "Tickets ended in an order, per sales rep", draw: (c) => <RepChart c={c} title="Tickets ended in an order, per sales rep" value={(r) => r.tickets.ordered} /> },
    "speed:counts": { title: "Created, closed, ordered", draw: (c) => { const t = c.rep.tickets; return <GroupChart c={c} title="Created, closed, ordered" order={["Created", "Closed", "Ordered"]} rec={{ Created: t.created, Closed: t.closed, Ordered: t.ordered }} />; } },
    "source:source": { title: "Tickets by source", draw: (c) => <GroupChart c={c} title="Tickets by source" rec={c.rep.tickets.bySource} /> },
    "resolution:resolution": { title: "Tickets by resolution", draw: (c) => <GroupChart c={c} title="Tickets by resolution" rec={c.rep.tickets.byResolution} /> },
    "open:count": { title: "Open tickets, by stage", draw: (c) => <GroupChart c={c} title="Open tickets, by stage" single curLabel="Open now" rec={Object.fromEntries(openOf(c.rep).map(([k, v]) => [k, P(v.count, 0)]))} /> },
    "open:potential": { title: "Potential still open, by stage", draw: (c) => <GroupChart c={c} title="Potential still open, by stage" single curLabel="Open now" fmt={moneyShort} rec={Object.fromEntries(openOf(c.rep).map(([k, v]) => [k, P(v.potential, 0)]))} /> },
  },
};

/* ── 7 · shop behaviour ────────────────────────────────────────────────── */

const pyWhole = (c: EsoCtx) => `${c.b.window.py}, whole year`;
const HISTORY = ["One order (one-shot)", "Two orders", "Three or more"] as const;

export const SHOP: EsoPageDef = {
  slug: "shop", title: "Shop behaviour", line: "logins, views and orders of the reps' customers", icon: <StorefrontOutlinedIcon />, tint: "blue", gaps: /Shop|carts|orders per customer/i,
  figures: (c) => {
    const s = c.rep.shop, h = s.orderHistory;
    return [
      { label: "Companies that logged in", icon: <StorefrontOutlinedIcon />, tint: "blue", value: n0(s.loggedIn), sub: `last year, whole: ${n0(s.loggedInPyFull)}` },
      { label: "Logged in and bought", icon: <ShoppingCartCheckoutOutlinedIcon />, tint: "green", value: pct(ratio(s.loggedBought, s.loggedIn)), sub: `${n0(s.loggedBought)} companies` },
      { label: "Logged in, never viewed an article", icon: <TouchAppOutlinedIcon />, tint: "amber", value: n0(s.loggedNoView), sub: "companies this year" },
      { label: "Buyers with 3+ orders ever", icon: <RepeatIcon />, tint: "purple", value: pct(ratio(h.more, h.one + h.two + h.more)), sub: `${n0(h.more)} of ${n0(h.one + h.two + h.more)} buyers this year` },
    ];
  },
  tabs: [
    { id: "reps", label: "Sales reps", icon: <BadgeOutlinedIcon />, tint: "blue", title: () => "The shop, per sales rep", note: (c) => `Companies of each rep that logged in this year, against ${pyWhole(c)} - the Datatracker keeps one total per year`, charts: ["loggedin", "bought"],
      table: {
        title: "All the figures, by sales rep",
        draw: (c) => <RepRows c={c} head={["Logged in", "Last year, whole", "Bought", "Bought, of them", "Logins", "Views"]}
          cells={(r) => [n0(r.shop.loggedIn), <Box key="py" component="span" sx={{ color: MUTED }}>{n0(r.shop.loggedInPyFull)}</Box>, n0(r.shop.loggedBought), pct(ratio(r.shop.loggedBought, r.shop.loggedIn)), n0(r.shop.logins), n0(r.shop.views)]}
          total={[n0(c.rep.shop.loggedIn), n0(c.rep.shop.loggedInPyFull), n0(c.rep.shop.loggedBought), pct(ratio(c.rep.shop.loggedBought, c.rep.shop.loggedIn)), n0(c.rep.shop.logins), n0(c.rep.shop.views)]} />,
      } },
    { id: "category", label: "Customer category", icon: <CategoryOutlinedIcon />, tint: "green", title: () => "Logged in and bought, by customer category", note: () => "Companies that logged in this year, and of those, how many bought this year", charts: ["category"],
      table: {
        title: "All the figures, by customer category",
        draw: (c) => {
          const rec = c.rep.shop.byCategory;
          const keys = [...CATEGORY_BANDS.filter((k) => rec[k]), ...Object.keys(rec).filter((k) => !(CATEGORY_BANDS as readonly string[]).includes(k))];
          return <Table head={["Customer category", "Logged in", "Bought", "Bought, of them"]} firstWidth="minmax(200px, 2fr)"
            rows={keys.map((k) => ({ key: k, cells: [k, n0(rec[k].loggedIn), n0(rec[k].bought), pct(ratio(rec[k].bought, rec[k].loggedIn))] }))} />;
        },
      } },
    { id: "activity", label: "Logins & views", icon: <TouchAppOutlinedIcon />, tint: "amber", title: () => "Logins and views", note: (c) => `This year so far, against ${pyWhole(c)} - not compared: a part of a year against a whole one`, charts: ["activity"],
      table: {
        title: "All the figures",
        draw: (c) => {
          const s = c.rep.shop;
          return <PairRows c={{ ...c, py: pyWhole(c) }} head="The shop" rows={[
            { label: "Companies that logged in", p: P(s.loggedIn, s.loggedInPyFull), noChange: true },
            { label: "Logins", p: P(s.logins, s.loginsPyFull), noChange: true },
            { label: "Article views", p: P(s.views, s.viewsPyFull), noChange: true },
            { label: "Logged in, never viewed an article", p: P(s.loggedNoView, NaN), noChange: true },
          ]} />;
        },
      } },
    { id: "history", label: "Orders ever", icon: <RepeatIcon />, tint: "purple", title: () => "This year's buyers, by orders ever", note: () => "One-shot, a second order, or more - every order they have placed", charts: ["history"],
      table: {
        title: "All the figures",
        draw: (c) => {
          const h = c.rep.shop.orderHistory, all = h.one + h.two + h.more;
          return <Table head={["Orders ever", "Buyers", "Share"]} firstWidth="minmax(200px, 2fr)"
            rows={[[HISTORY[0], h.one], [HISTORY[1], h.two], [HISTORY[2], h.more]].map(([k, v]) => ({ key: String(k), cells: [String(k), n0(Number(v)), pct(ratio(Number(v), all))] }))} />;
        },
      } },
  ],
  charts: {
    "reps:loggedin": { title: "Companies that logged in, per sales rep", draw: (c) => <RepChart c={c} title="Companies that logged in, per sales rep" value={(r) => P(r.shop.loggedIn, r.shop.loggedInPyFull)} prevLabel={pyWhole(c)} /> },
    "reps:bought": { title: "Logged in and bought, per sales rep", draw: (c) => <RepChart c={c} title="Logged in and bought, per sales rep" value={(r) => P(r.shop.loggedBought, 0)} single /> },
    "category:category": { title: "Logged in and bought, by customer category", draw: (c) => { const rec = c.rep.shop.byCategory; return <GroupChart c={c} title="Logged in and bought, by customer category" curLabel="Logged in this year" prevLabel="Of them bought" order={[...CATEGORY_BANDS.filter((k) => rec[k]), ...Object.keys(rec).filter((k) => !(CATEGORY_BANDS as readonly string[]).includes(k))]} rec={Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, P(v.loggedIn, v.bought)]))} />; } },
    "activity:activity": { title: "Logins and views", draw: (c) => { const s = c.rep.shop; return <GroupChart c={c} title="Logins and views" prevLabel={pyWhole(c)} order={["Logins", "Article views"]} rec={{ Logins: P(s.logins, s.loginsPyFull), "Article views": P(s.views, s.viewsPyFull) }} />; } },
    "history:history": { title: "This year's buyers, by orders ever", draw: (c) => { const h = c.rep.shop.orderHistory; return <GroupChart c={c} title="This year's buyers, by orders ever" single curLabel="Buyers this year" order={HISTORY} rec={{ [HISTORY[0]]: P(h.one, 0), [HISTORY[1]]: P(h.two, 0), [HISTORY[2]]: P(h.more, 0) }} />; } },
  },
};

/** The pages in the deck's order - the side panel's and the BUC View's. */
// Revenue & order intake taken out (SARCLA 31.10.2026: "sub app take it out completely") - the Figures carry both
export const ESO_PAGES: EsoPageDef[] = [VISITS, CUSTOMERS, NEW_CUSTOMERS, REGISTRATIONS, TICKETS, SHOP];
export const esoPage = (slug: string) => ESO_PAGES.find((p) => p.slug === slug);
