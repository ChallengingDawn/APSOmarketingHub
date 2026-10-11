// THE ESO BENCHMARK - SARCLA's CrystalESO deck, per ESO sales rep, this year
// against last (SARCLA, 11.10.2026: "everything the data allows").
//
// One read of HubSpot, a few minutes long, kept as aggregates only - figures
// per rep, no company, contact or ticket id - through slowReport, so the first
// visitor starts it, everyone after gets the answer, and a deployment mid-read
// hands it to the next task. What the data cannot answer is listed, not guessed.
//
//   companies      every company an ESO rep owns: revenue by month and profit
//                  centre (3 years), order intake by month, first/last order,
//                  priority, category, type, shop logins and views
//   registrations  shop accounts (contacts with an eyemagine id) created in
//                  either window, through their company's owner
//   tickets        the ESO pipeline, created in either window
//   visits         the customer-visit object, by the visit's owner
//
// Customers belong to their CURRENT owner in both years: the history of who
// owned a company when is not kept.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { ESO_OWNERS } from "@/lib/datatracker/rosters";
import {
  MONTHS, MONTH_LABEL, ORDERED_RESOLUTIONS, benchmarkWindow, bump, customerStatus, hoursBetween, inWindow, mainAssortment,
  median, monthTotal, monthsLoaded, pair, parsePcMonthly, prioOf, sturdyMedians, sumMonths, windowDates, type Pair, type Window,
  categoryBand, months12, prioBand, visitKind,
} from "./esoRules";

const KEY = "esoBenchmark:v2";
const TTL_MS = 12 * 60 * 60 * 1000;
const VISIT_OBJ = "2-139767037";
const ESO_PIPELINE = "1726599376";
const VISIT_PIPELINE = "2904105208";
/** "Visit and Report complete": the only visits that count (SARCLA 12.10). */
const VISIT_DONE = "3972587738";
/** The stage a ticket enters when work starts or an offer goes out. */
const OFFER_STAGE = "3865966812";

export type Speed = { cy: number | null; py: number | null };
export type RepBenchmark = {
  ownerId: string;
  name: string;
  /** companies this rep owns today */
  companies: number;
  revenue: { ytd: Pair; months: Pair[]; byPc: Record<string, Pair> };
  orderIntake: { ytd: Pair; months: Pair[] };
  customers: {
    active: Pair; new: Pair; reactivated: Pair; slowing: Pair; lost: Pair;
    /** bought in the year before - the base of the churn rate */
    base: Pair;
    lostPotential: Pair;
    activeByCategory: Record<string, Pair>;
  };
  newCustomers: {
    revenue: Pair; byType: Record<string, Pair>; byPrio: Record<string, Pair>; byAssortment: Record<string, Pair>;
    /** this year's new customers visited before their first order */
    visitedBefore: number;
  };
  registrations: {
    contacts: Pair; companies: Pair; converted: Pair; daysToOrder: Speed;
    byWay: Record<string, Pair>; byType: Record<string, Pair>; byPrio: Record<string, Pair>;
  };
  tickets: {
    created: Pair; closed: Pair; resolved: Pair; ordered: Pair; orderedPotential: Pair;
    firstReplyH: Speed; offerH: Speed; closeD: Speed;
    bySource: Record<string, Pair>; byResolution: Record<string, Pair>;
    openByStage: Record<string, { count: number; potential: number }>;
  };
  /** Completed visits only, by month (index 0 = January), this year against last. */
  visits: {
    months: Pair[];
    byPrio: Record<string, Pair[]>;
    byCategory: Record<string, Pair[]>;
    /** Agreed (scheduled), cold, event */
    byKind: Record<string, Pair[]>;
    /** Sums and counts, so an average holds for any selection of reps. */
    potential: { visitSum: Pair; visitN: Pair; companySum: Pair; companyN: Pair };
    companies: Pair;
    revenueOfVisited: Pair;
    /** Visits to companies that had never ordered by that day, and what came of them. */
    newCustomers: { visits: Pair; companies: Pair; registeredAfter: Pair; boughtAfter: Pair; byWay: Record<string, Pair> };
    /** This year's visits that do not count yet, by stage. */
    notCompleted: Record<string, number>;
  };
  /** Raw durations, rounded, so medians can be taken over any selection of reps. */
  lists: { firstReplyH: { cy: number[]; py: number[] }; offerH: { cy: number[]; py: number[] }; closeD: { cy: number[]; py: number[] }; regDays: { cy: number[]; py: number[] } };
  shop: {
    loggedIn: number; logins: number; views: number; loggedNoView: number; loggedBought: number;
    loggedInPyFull: number; loginsPyFull: number; viewsPyFull: number;
    byCategory: Record<string, { loggedIn: number; bought: number }>;
    orderHistory: { one: number; two: number; more: number };
  };
};

export type EsoBenchmark = {
  generatedAt: string;
  window: Window;
  /** completed months compared for revenue and customers */
  revenueMonths: number;
  /** months of order intake loaded per company */
  oiMonths: number;
  monthLabels: string[];
  team: RepBenchmark;
  reps: RepBenchmark[];
  coverage: { visitsTotal: number; visitsCompleted: number; visitsRoster: number; visitsWithCompany: number; ticketsOffRoster: Pair; registrationsElsewhere: Pair };
  gaps: string[];
};

export function esoBenchmark(): Promise<SlowState<EsoBenchmark>> {
  return slowReport(KEY, TTL_MS, build);
}

/* ── reading ───────────────────────────────────────────────────────────── */

type Row = { id: string; properties?: Record<string, string | null> };
type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };

async function searchAll(object: string, filters: Filter[], properties: string[], label: string, tickets = false): Promise<Row[]> {
  const out: Row[] = [];
  let lastId = "0";
  for (let page = 0; page < 2000; page++) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: `/crm/v3/objects/${object}/search`, method: "POST", useTicketsToken: tickets,
      body: {
        limit: 200, properties,
        filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: lastId }] }],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    out.push(...rows);
    reportProgress(KEY, `${label} · ${out.length.toLocaleString("en")}`);
    if (rows.length < 200) break;
    lastId = rows[rows.length - 1].id;
  }
  return out;
}

const num = (v: string | null | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ms = (d: string) => String(Date.parse(`${d}T00:00:00Z`));

/* ── accumulating ──────────────────────────────────────────────────────── */

type Lists = { firstReply: { cy: number[]; py: number[] }; offer: { cy: number[]; py: number[] }; close: { cy: number[]; py: number[] }; regDays: { cy: number[]; py: number[] }; potentials: number[] };

function emptyRep(ownerId: string, name: string, months: number): RepBenchmark {
  return {
    ownerId, name, companies: 0,
    revenue: { ytd: pair(), months: Array.from({ length: months }, pair), byPc: {} },
    orderIntake: { ytd: pair(), months: [] },
    customers: { active: pair(), new: pair(), reactivated: pair(), slowing: pair(), lost: pair(), base: pair(), lostPotential: pair(), activeByCategory: {} },
    newCustomers: { revenue: pair(), byType: {}, byPrio: {}, byAssortment: {}, visitedBefore: 0 },
    registrations: { contacts: pair(), companies: pair(), converted: pair(), daysToOrder: { cy: null, py: null }, byWay: {}, byType: {}, byPrio: {} },
    tickets: {
      created: pair(), closed: pair(), resolved: pair(), ordered: pair(), orderedPotential: pair(),
      firstReplyH: { cy: null, py: null }, offerH: { cy: null, py: null }, closeD: { cy: null, py: null },
      bySource: {}, byResolution: {}, openByStage: {},
    },
    visits: {
      months: months12(), byPrio: {}, byCategory: {}, byKind: {},
      potential: { visitSum: pair(), visitN: pair(), companySum: pair(), companyN: pair() },
      companies: pair(), revenueOfVisited: pair(),
      newCustomers: { visits: pair(), companies: pair(), registeredAfter: pair(), boughtAfter: pair(), byWay: {} },
      notCompleted: {},
    },
    lists: { firstReplyH: { cy: [], py: [] }, offerH: { cy: [], py: [] }, closeD: { cy: [], py: [] }, regDays: { cy: [], py: [] } },
    shop: { loggedIn: 0, logins: 0, views: 0, loggedNoView: 0, loggedBought: 0, loggedInPyFull: 0, loginsPyFull: 0, viewsPyFull: 0, byCategory: {}, orderHistory: { one: 0, two: 0, more: 0 } },
  };
}
const emptyLists = (): Lists => ({ firstReply: { cy: [], py: [] }, offer: { cy: [], py: [] }, close: { cy: [], py: [] }, regDays: { cy: [], py: [] }, potentials: [] });
const add = (r: Record<string, number>, k: string, n = 1) => { r[k] = (r[k] ?? 0) + n; };

type Co = {
  owner: string; prio: string; category: string; type: string; potential: number; regWay: string;
  firstOrder: string | null; lastOrder: string | null; totalOrders: number;
  revCy: number; byPcCy: Record<string, number>;
  /** last year, the same months */
  revPy: number;
};

/* ── the build ─────────────────────────────────────────────────────────── */

async function build(): Promise<EsoBenchmark> {
  const w0 = benchmarkWindow(new Date());
  const { year, py } = w0;
  const py2 = py - 1;
  const roster = Object.keys(ESO_OWNERS);
  const thisCalendarYear = new Date().getUTCFullYear();
  const loginsProp = (y: number) => (y === thisCalendarYear ? "n_of_logins_datatracker" : `n_of_logins_datatracker_${y}`);
  const viewsProp = (y: number) => (y === thisCalendarYear ? "n_of_views_datatracker" : `n_of_views_datatracker_${y}`);

  // 1. Companies the ESO reps own.
  const BASE = ["hubspot_owner_id", "order_first_order_date", "order_last_order_date", "order_total_orders", "sales_priority",
    "apso_customer", "customer_type", "yearly_customer_potential", "registration_details_eso__company"];
  const props = [
    ...BASE,
    `rev_${year}_pc_monthly`, `rev_${py}_pc_monthly`, `rev_${py2}_pc_monthly`,
    ...MONTHS.map((m) => `oi_${year}_${m}`), ...MONTHS.map((m) => `oi_${py}_${m}`),
    loginsProp(year), viewsProp(year), loginsProp(py), viewsProp(py),
  ];
  const companyRows = await searchAll("companies", [{ propertyName: "hubspot_owner_id", operator: "IN", values: roster }], props, "reading the ESO reps' companies");

  // How far revenue and order intake are loaded, from how many companies carry each month.
  const revFill = { cy: Array(12).fill(0), py: Array(12).fill(0) };
  const oiFill = { cy: Array(12).fill(0), py: Array(12).fill(0) };
  const parsed = companyRows.map((r) => {
    const p = r.properties ?? {};
    const cy = parsePcMonthly(p[`rev_${year}_pc_monthly`]);
    const pyB = parsePcMonthly(p[`rev_${py}_pc_monthly`]);
    const py2B = parsePcMonthly(p[`rev_${py2}_pc_monthly`]);
    const oiCy = MONTHS.map((m) => p[`oi_${year}_${m}`]);
    const oiPy = MONTHS.map((m) => p[`oi_${py}_${m}`]);
    for (let i = 0; i < 12; i++) {
      if (monthTotal(cy, i)) revFill.cy[i]++;
      if (monthTotal(pyB, i)) revFill.py[i]++;
      if (oiCy[i] != null && oiCy[i] !== "") oiFill.cy[i]++;
      if (oiPy[i] != null && oiPy[i] !== "") oiFill.py[i]++;
    }
    return { r, p, cy, pyB, py2B, oiCy, oiPy };
  });
  const revenueMonths = Math.max(1, monthsLoaded(revFill.cy, revFill.py, w0.months));
  const oiMonths = monthsLoaded(oiFill.cy, oiFill.py, w0.months);
  const w: Window = { ...w0, months: revenueMonths };

  const team = emptyRep("all", "All ESO", revenueMonths);
  const reps = new Map<string, RepBenchmark>(roster.map((id) => [id, emptyRep(id, ESO_OWNERS[id], revenueMonths)]));
  const lists = new Map<string, Lists>([["all", emptyLists()], ...roster.map((id) => [id, emptyLists()] as [string, Lists])]);
  const both = (owner: string | null | undefined): RepBenchmark[] => {
    const rep = owner ? reps.get(owner) : undefined;
    return rep ? [team, rep] : [team];
  };
  const listsOf = (owner: string | null | undefined): Lists[] => [lists.get("all")!, ...(owner && lists.has(owner) ? [lists.get(owner)!] : [])];
  for (const a of [team, ...reps.values()]) a.orderIntake.months = Array.from({ length: oiMonths }, pair);

  const companies = new Map<string, Co>();
  for (const { r, p, cy, pyB, py2B, oiCy, oiPy } of parsed) {
    const owner = p.hubspot_owner_id ?? "";
    const cySum = sumMonths(cy, w.months);
    const pySame = sumMonths(pyB, w.months);
    const pyFull = sumMonths(pyB, 12).total;
    const py2Same = sumMonths(py2B, w.months).total;
    const py2Full = sumMonths(py2B, 12).total;
    const co: Co = {
      owner, prio: prioOf(p.sales_priority), category: p.apso_customer || "Not set", type: p.customer_type || "Not set",
      potential: num(p.yearly_customer_potential), regWay: p.registration_details_eso__company || "",
      firstOrder: p.order_first_order_date ?? null, lastOrder: p.order_last_order_date ?? null, totalOrders: num(p.order_total_orders),
      revCy: cySum.total, byPcCy: cySum.byPc, revPy: pySame.total,
    };
    companies.set(r.id, co);
    const st = customerStatus({ cy: cySum.total, pySame: pySame.total, pyFull, py2Same, py2Full, firstOrder: co.firstOrder }, w);
    const loginsCy = num(p[loginsProp(year)]), viewsCy = num(p[viewsProp(year)]);
    const loginsPy = num(p[loginsProp(py)]), viewsPy = num(p[viewsProp(py)]);

    for (const a of both(owner)) {
      a.companies++;
      a.revenue.ytd.cy += cySum.total; a.revenue.ytd.py += pySame.total;
      for (let i = 0; i < w.months; i++) { a.revenue.months[i].cy += monthTotal(cy, i); a.revenue.months[i].py += monthTotal(pyB, i); }
      for (const [pc, n] of Object.entries(cySum.byPc)) bump(a.revenue.byPc, pc, "cy", n);
      for (const [pc, n] of Object.entries(pySame.byPc)) bump(a.revenue.byPc, pc, "py", n);
      for (let i = 0; i < oiMonths; i++) {
        const c = num(oiCy[i]), q = num(oiPy[i]);
        a.orderIntake.months[i].cy += c; a.orderIntake.months[i].py += q;
        a.orderIntake.ytd.cy += c; a.orderIntake.ytd.py += q;
      }
      const cu = a.customers;
      if (st.activeCy) { cu.active.cy++; bump(cu.activeByCategory, co.category, "cy"); }
      if (st.activePy) { cu.active.py++; bump(cu.activeByCategory, co.category, "py"); }
      if (st.newCy) cu.new.cy++;
      if (st.newPy) cu.new.py++;
      if (st.reactivatedCy) cu.reactivated.cy++;
      if (st.reactivatedPy) cu.reactivated.py++;
      if (st.slowingCy) cu.slowing.cy++;
      if (st.slowingPy) cu.slowing.py++;
      if (st.lostCy) { cu.lost.cy++; cu.lostPotential.cy += co.potential; }
      if (st.lostPy) { cu.lost.py++; cu.lostPotential.py += co.potential; }
      if (st.baseCy) cu.base.cy++;
      if (st.basePy) cu.base.py++;
      const nc = a.newCustomers;
      for (const [side, isNew, rev, byPc] of [["cy", st.newCy, cySum.total, cySum.byPc], ["py", st.newPy, pySame.total, pySame.byPc]] as const) {
        if (!isNew) continue;
        nc.revenue[side] += rev;
        bump(nc.byType, co.type, side); bump(nc.byPrio, co.prio, side);
        bump(nc.byAssortment, mainAssortment(byPc) ?? "none yet", side);
      }
      const sh = a.shop;
      if (loginsCy > 0) {
        sh.loggedIn++; sh.logins += loginsCy; sh.views += viewsCy;
        if (viewsCy <= 0) sh.loggedNoView++;
        if (st.activeCy) sh.loggedBought++;
        const b = (sh.byCategory[co.category] ??= { loggedIn: 0, bought: 0 });
        b.loggedIn++; if (st.activeCy) b.bought++;
      }
      if (loginsPy > 0) { sh.loggedInPyFull++; sh.loginsPyFull += loginsPy; sh.viewsPyFull += viewsPy; }
      if (st.activeCy) {
        if (co.totalOrders <= 1) sh.orderHistory.one++; else if (co.totalOrders === 2) sh.orderHistory.two++; else sh.orderHistory.more++;
      }
    }
  }

  // 2. Shop registrations, through the company they belong to.
  const cyWin = windowDates(year, w.months), pyWin = windowDates(py, w.months);
  const registrationsElsewhere = pair();
  const regFirst = new Map<string, string>(); // company -> earliest registration in either window
  const regSeen = { cy: new Map<string, Set<string>>(), py: new Map<string, Set<string>>() };
  for (const [side, win] of [["cy", cyWin], ["py", pyWin]] as const) {
    const rows = await searchAll("contacts", [
      { propertyName: "eyemagine_customer_id", operator: "HAS_PROPERTY" },
      { propertyName: "createdate", operator: "GTE", value: ms(win.from) },
      { propertyName: "createdate", operator: "LT", value: ms(win.to) },
    ], ["createdate", "associatedcompanyid"], `reading shop registrations ${side === "cy" ? year : py}`);
    for (const row of rows) {
      const p = row.properties ?? {};
      const cid = p.associatedcompanyid ?? "";
      const co = cid ? companies.get(cid) : undefined;
      if (!co) { registrationsElsewhere[side]++; continue; }
      const day = (p.createdate ?? "").slice(0, 10);
      if (!regFirst.has(cid) || day < regFirst.get(cid)!) regFirst.set(cid, day);
      for (const a of both(co.owner)) {
        a.registrations.contacts[side]++;
        const seen = (regSeen[side].get(a.ownerId) ?? regSeen[side].set(a.ownerId, new Set()).get(a.ownerId)!);
        if (seen.has(cid)) continue;
        seen.add(cid);
        const rg = a.registrations;
        rg.companies[side]++;
        bump(rg.byWay, co.regWay || "Not recorded", side);
        bump(rg.byType, co.type, side);
        bump(rg.byPrio, co.prio, side);
        const first = co.firstOrder?.slice(0, 10) ?? null;
        if (first && first >= day) {
          rg.converted[side]++;
          const d = hoursBetween(`${day}T00:00:00Z`, `${first}T00:00:00Z`);
          if (d !== null) lists.get(a.ownerId)!.regDays[side].push(d / 24);
        }
      }
    }
  }

  // 3. ESO tickets created in either window.
  const stages = await hubspotFetchJson<{ stages?: { id: string; label: string; metadata?: { ticketState?: string } }[] }>({
    path: `/crm/v3/pipelines/tickets/${ESO_PIPELINE}`, useTicketsToken: true,
  });
  const stageLabel = new Map((stages.stages ?? []).map((s) => [s.id, s.label]));
  const stageClosed = new Set((stages.stages ?? []).filter((s) => s.metadata?.ticketState === "CLOSED").map((s) => s.id));
  const ticketsOffRoster = pair();
  for (const [side, win] of [["cy", cyWin], ["py", pyWin]] as const) {
    const rows = await searchAll("tickets", [
      { propertyName: "hs_pipeline", operator: "EQ", value: ESO_PIPELINE },
      { propertyName: "createdate", operator: "GTE", value: ms(win.from) },
      { propertyName: "createdate", operator: "LT", value: ms(win.to) },
    ], ["hubspot_owner_id", "createdate", "closed_date", "hs_pipeline_stage", "ticket_resolution_eso", "source_type",
      "sales_potential_estimate", "first_agent_reply_date", `hs_v2_date_entered_${OFFER_STAGE}`], `reading ESO tickets ${side === "cy" ? year : py}`, true);
    for (const row of rows) {
      const p = row.properties ?? {};
      const owner = p.hubspot_owner_id ?? "";
      if (!reps.has(owner)) { ticketsOffRoster[side]++; continue; }
      const res = p.ticket_resolution_eso ?? "";
      const pot = num(p.sales_potential_estimate);
      const closed = !!p.closed_date || stageClosed.has(p.hs_pipeline_stage ?? "");
      const firstReply = hoursBetween(p.createdate, p.first_agent_reply_date);
      const offer = hoursBetween(p.createdate, p[`hs_v2_date_entered_${OFFER_STAGE}`]);
      const close = hoursBetween(p.createdate, p.closed_date);
      for (const a of both(owner)) {
        const t = a.tickets;
        t.created[side]++;
        if (closed) t.closed[side]++;
        if (res) { t.resolved[side]++; bump(t.byResolution, res, side); }
        if (ORDERED_RESOLUTIONS.has(res)) { t.ordered[side]++; t.orderedPotential[side] += pot; }
        bump(t.bySource, p.source_type || "Not recorded", side);
        if (side === "cy" && !closed) {
          const s = (t.openByStage[stageLabel.get(p.hs_pipeline_stage ?? "") ?? "Unknown stage"] ??= { count: 0, potential: 0 });
          s.count++; s.potential += pot;
        }
      }
      for (const l of listsOf(owner)) {
        if (firstReply !== null) l.firstReply[side].push(firstReply);
        if (offer !== null) l.offer[side].push(offer);
        if (close !== null) l.close[side].push(close / 24);
      }
    }
  }

  // 4. Customer visits, by the visit's owner. Only a visit whose report is in -
  // the pipeline's "Visit and Report complete" stage - counts (SARCLA 12.10);
  // this year's others are named by their stage, not counted.
  const visits: Row[] = [];
  let after: string | undefined;
  const vProps = ["hubspot_owner_id", "meeting_date_with_time", "type_of_visit", "annual_need_in__", "hs_pipeline_stage"];
  for (let page = 0; page < 500; page++) {
    const r = await hubspotFetchJson<{ results?: Row[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v3/objects/${VISIT_OBJ}?limit=100&properties=${vProps.join(",")}${after ? `&after=${after}` : ""}`, useTicketsToken: true,
    });
    visits.push(...(r.results ?? []));
    reportProgress(KEY, `reading customer visits · ${visits.length.toLocaleString("en")}`);
    after = r.paging?.next?.after;
    if (!after) break;
  }
  const visitStages = await hubspotFetchJson<{ stages?: { id: string; label: string }[] }>({
    path: `/crm/v3/pipelines/${VISIT_OBJ}/${VISIT_PIPELINE}`, useTicketsToken: true,
  }).catch(() => ({ stages: [] as { id: string; label: string }[] }));
  const visitStageLabel = new Map((visitStages.stages ?? []).map((s) => [s.id, s.label.trim()]));
  const inScope = visits.filter((v) => {
    const d = v.properties?.meeting_date_with_time ?? null;
    return inWindow(d, cyWin) || inWindow(d, pyWin);
  });
  const completed = inScope.filter((v) => v.properties?.hs_pipeline_stage === VISIT_DONE);
  const visitCompany = new Map<string, string>();
  for (let i = 0; i < completed.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: { from?: { id?: string }; to?: { toObjectId?: number | string }[] }[] }>({
      path: `/crm/v4/associations/${VISIT_OBJ}/companies/batch/read`, method: "POST", useTicketsToken: true,
      body: { inputs: completed.slice(i, i + 100).map((v) => ({ id: v.id })) },
    });
    for (const row of r.results ?? []) {
      const to = row.to?.[0]?.toObjectId;
      if (row.from?.id && to != null) visitCompany.set(String(row.from.id), String(to));
    }
    reportProgress(KEY, `linking visits to companies · ${Math.min(i + 100, completed.length).toLocaleString("en")}`);
  }
  // Visited companies an ESO rep does not own still need their facts.
  const missing = [...new Set(visitCompany.values())].filter((id) => !companies.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const r = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v3/objects/companies/batch/read", method: "POST",
      body: { inputs: missing.slice(i, i + 100).map((id) => ({ id })), properties: [...BASE, `rev_${year}_pc_monthly`, `rev_${py}_pc_monthly`] },
    });
    for (const row of r.results ?? []) {
      const p = row.properties ?? {};
      const cySum = sumMonths(parsePcMonthly(p[`rev_${year}_pc_monthly`]), w.months);
      companies.set(row.id, {
        owner: p.hubspot_owner_id ?? "", prio: prioOf(p.sales_priority), category: p.apso_customer || "Not set", type: p.customer_type || "Not set",
        potential: num(p.yearly_customer_potential), regWay: p.registration_details_eso__company || "",
        firstOrder: p.order_first_order_date ?? null, lastOrder: p.order_last_order_date ?? null, totalOrders: num(p.order_total_orders),
        revCy: cySum.total, byPcCy: cySum.byPc, revPy: sumMonths(parsePcMonthly(p[`rev_${py}_pc_monthly`]), w.months).total,
      });
    }
    reportProgress(KEY, `reading visited companies · ${Math.min(i + 100, missing.length).toLocaleString("en")}`);
  }
  let visitsRoster = 0;
  const firstVisit = new Map<string, Map<string, string>>(); // "rep|side" -> company -> first visit in that window
  for (const v of inScope) {
    const p = v.properties ?? {};
    const owner = p.hubspot_owner_id ?? "";
    if (!reps.has(owner)) continue;
    const when = p.meeting_date_with_time ?? "";
    const side: "cy" | "py" = inWindow(when, cyWin) ? "cy" : "py";
    if (p.hs_pipeline_stage !== VISIT_DONE) {
      if (side === "cy") for (const a of both(owner)) add(a.visits.notCompleted, visitStageLabel.get(p.hs_pipeline_stage ?? "") ?? "No stage");
      continue;
    }
    visitsRoster++;
    const m = Number(when.slice(5, 7)) - 1;
    const d = when.slice(0, 10);
    const cid = visitCompany.get(v.id);
    const co = cid ? companies.get(cid) : undefined;
    const prio = prioBand(co?.prio), cat = categoryBand(co?.category), kind = visitKind(p.type_of_visit);
    const need = num(p.annual_need_in__);
    const first = co?.firstOrder?.slice(0, 10) ?? null;
    for (const a of both(owner)) {
      const vv = a.visits;
      vv.months[m][side]++;
      (vv.byPrio[prio] ??= months12())[m][side]++;
      (vv.byCategory[cat] ??= months12())[m][side]++;
      (vv.byKind[kind] ??= months12())[m][side]++;
      if (need > 0) { vv.potential.visitSum[side] += need; vv.potential.visitN[side]++; }
      if (co && co.potential > 0) { vv.potential.companySum[side] += co.potential; vv.potential.companyN[side]++; }
      if (cid && co) {
        if (!first || first > d) vv.newCustomers.visits[side]++;
        const key = `${a.ownerId}|${side}`;
        const fm = firstVisit.get(key) ?? firstVisit.set(key, new Map()).get(key)!;
        if (!fm.has(cid) || d < fm.get(cid)!) fm.set(cid, d);
      }
    }
  }
  const WAY: Record<string, string> = {
    "Meeting before registration": "Registered after the visit",
    "Registered before meeting": "Registered on their own, before the visit",
  };
  for (const a of [team, ...reps.values()]) {
    for (const side of ["cy", "py"] as const) {
      const win = side === "cy" ? cyWin : pyWin;
      for (const [cid, d] of firstVisit.get(`${a.ownerId}|${side}`) ?? new Map<string, string>()) {
        const co = companies.get(cid)!;
        a.visits.companies[side]++;
        a.visits.revenueOfVisited[side] += side === "cy" ? co.revCy : co.revPy;
        const first = co.firstOrder?.slice(0, 10) ?? null;
        if (first && first <= d) continue; // already a customer when visited
        const nc = a.visits.newCustomers;
        nc.companies[side]++;
        bump(nc.byWay, WAY[co.regWay] ?? "Not registered", side);
        if (co.regWay === "Meeting before registration") nc.registeredAfter[side]++;
        if (first && first > d && first < win.to) nc.boughtAfter[side]++;
      }
    }
  }
  // This year's new customers who were visited before their first order.
  for (const [cid, co] of companies) {
    const first = co.firstOrder?.slice(0, 10) ?? null;
    if (!first || !inWindow(first, cyWin) || !reps.has(co.owner)) continue;
    for (const a of both(co.owner)) {
      const d = firstVisit.get(`${a.ownerId}|cy`)?.get(cid);
      if (d && d < first) a.newCustomers.visitedBefore++;
    }
  }

  // 5. Medians - a side measured on too few tickets says nothing, so it is left
  // empty rather than shown: the ESO pipeline took most tickets from late 2025,
  // and the offer stage only exists since 2026.
  for (const a of [team, ...reps.values()]) {
    const l = lists.get(a.ownerId)!;
    a.tickets.firstReplyH = sturdyMedians(l.firstReply);
    a.tickets.offerH = sturdyMedians(l.offer);
    a.tickets.closeD = sturdyMedians(l.close);
    a.registrations.daysToOrder = sturdyMedians(l.regDays);
    // The team's medians are above; a rep's raw durations go out too, so the
    // page can take a median over any selection of reps.
    if (a.ownerId !== "all") {
      const r1 = (xs: number[]) => xs.map((x) => Math.round(x * 10) / 10);
      const both2 = (x: { cy: number[]; py: number[] }) => ({ cy: r1(x.cy), py: r1(x.py) });
      a.lists = { firstReplyH: both2(l.firstReply), offerH: both2(l.offer), closeD: both2(l.close), regDays: both2(l.regDays) };
    }
  }

  const last = MONTH_LABEL[w.months - 1];
  const gaps = [
    `Visits count only when the report is complete (stage "Visit and Report complete"). HubSpot holds visits from 2026 on (${completed.filter((v) => inWindow(v.properties?.meeting_date_with_time, pyWin)).length} completed in last year's window), so last year is near empty.`,
    "How a customer registered: HubSpot records whether it was before or after the visit; whether the ESO registered them on their behalf is not recorded.",
    "Revenue against forecast: there is no forecast per sales rep, so it is not shown.",
    oiMonths < w.months
      ? `Order intake per company is loaded through ${oiMonths ? MONTH_LABEL[oiMonths - 1] : "no month yet"}; it is compared Jan-${oiMonths ? MONTH_LABEL[oiMonths - 1] : "-"} only, revenue Jan-${last}.`
      : `Order intake is compared Jan-${MONTH_LABEL[oiMonths - 1]}.`,
    `Tickets last year are thin: the ESO pipeline took most tickets from late 2025 (${team.tickets.created.py.toLocaleString("en")} created Jan-${last} ${py}, ${team.tickets.created.cy.toLocaleString("en")} this year), and the resolution field and the offer stage are 2026's - a speed measured on too few tickets is left empty.`,
    "Tickets by customer category and by use case: tickets are not linked to their company's category here yet.",
    "Why a registered customer did not buy: not recorded anywhere.",
    "Shopping carts per customer: not stored per company, so carts are not counted.",
    "Shop logins and views: the Datatracker keeps one total per year, so last year is shown whole beside this year to date - not like-for-like.",
    "Average orders per customer: orders per company per year are not stored; the shop section counts all-time orders of this year's buyers instead.",
    "Customers are counted under their CURRENT owner in both years; who owned a company last year is not kept.",
  ];

  const order = [...reps.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    generatedAt: new Date().toISOString(),
    window: w0, revenueMonths, oiMonths, monthLabels: MONTH_LABEL,
    team, reps: order,
    coverage: { visitsTotal: inScope.length, visitsCompleted: completed.length, visitsRoster, visitsWithCompany: completed.filter((v) => visitCompany.has(v.id)).length, ticketsOffRoster, registrationsElsewhere },
    gaps,
  };
}
