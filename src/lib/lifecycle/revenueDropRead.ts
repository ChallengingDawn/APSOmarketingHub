// UC12 REVENUE DROP - the read (the rules are in revenueDrop.ts). Every company in APSOcore or APSOgrowth with Prio 1
// or Prio 2, with its revenue and order intake per month for this year and the three before (rev_<y>_pc_monthly, the
// ERP workbook's oi_<y>_<month> totals and oi_<y>_pc_monthly where those are empty), then today's run - step 1 lost
// business, step 2 revenue drop - and the 11 monthly runs before it replayed after a first run. The article-erosion
// tickets (erosion_key set) are read too: their customer number and month say which companies Article erosion has.
// What is kept is what the page shows: the companies today's run tickets and the counts per person - no monthly
// series. Read-only against HubSpot; kept 6 hours and read again in the background with the UC pages (scheduler.ts,
// LIFECYCLE_WARM=off stops it), the page showing the last read meanwhile.

import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { toDay } from "./rules";
import { people, searchAll } from "./read";
import {
  DROP_SHAPE, PRIO_VALUES, SEGMENTS, bigBefore, calendarOf, companyOf, erosionOf, floorOf, filledOf, historyEnds, inScope, loadedTo, monthsOfYears, propsFor,
  runs, verdictOf, windowOf, type ByStep, type DropCompany, type DropData, type Verdict,
} from "./revenueDrop";

const KEY = "lifecycle:uc12:drop:v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export function revenueDropState(): Promise<SlowState<DropData>> {
  return slowReport(KEY, (v: DropData) => ((v?.shape ?? 0) < DROP_SHAPE ? 0 : TTL_MS), buildDrop);
}

async function buildDrop(): Promise<DropData> {
  const today = toDay(Date.now()) as string;
  const y = Number(today.slice(0, 4));
  // three years before this one: a window still waiting on order intake, and the replayed runs a year before it, stay read
  const years = [y - 3, y - 2, y - 1, y];
  const months = monthsOfYears(years);

  reportProgress(KEY, "reading the companies in scope");
  const found = await searchAll("companies",
    [[{ propertyName: "apso_customer", operator: "IN", values: [...SEGMENTS] }, { propertyName: "sales_priority", operator: "IN", values: [...PRIO_VALUES] }]],
    propsFor(years), (n) => reportProgress(KEY, `reading the companies in scope · ${n.toLocaleString("en")}`));
  const companies: DropCompany[] = found.map((r) => companyOf(String(r.id), r.properties ?? {}, years)).filter(inScope);

  const filled = filledOf(companies, months.length);
  const revTo = loadedTo(months, { rev: filled.rev, oi: filled.rev }, today);
  const oiTo = loadedTo(months, { rev: filled.oi, oi: filled.oi }, today);
  const end = loadedTo(months, filled, today);

  reportProgress(KEY, "reading the article-erosion tickets");
  const eroTickets = await searchAll("tickets", [[{ propertyName: "erosion_key", operator: "HAS_PROPERTY" }]], ["erosion_customer_number", "createdate"],
    (n) => reportProgress(KEY, `reading the article-erosion tickets · ${n.toLocaleString("en")}`));
  const erosion = erosionOf(companies, eroTickets.map((t) => ({
    un: t.properties?.erosion_customer_number ?? null, created: toDay(t.properties?.createdate)?.slice(0, 7) ?? null,
  })));
  const erosionRead = { tickets: eroTickets.length, companies: Object.keys(erosion).length };

  reportProgress(KEY, "reading the owners' names");
  const names = await people();
  const owners: Record<string, string> = {};
  for (const c of companies) if (c.owner && names[`o:${c.owner}`]) owners[c.owner] = names[`o:${c.owner}`];

  const base = { shape: DROP_SHAPE, readAt: new Date().toISOString(), today, read: found.length, revTo, oiTo, end, owners, erosionRead };
  if (!end) return { ...base, funnel: { inScope: companies.length, bought: 0, big: 0, found: [0, 0], erosion: [0, 0], routed: [0, 0] }, rows: [], people: [], ends: [], perRun: [] };

  reportProgress(KEY, "working out today's run and the 11 before it");
  const w = windowOf(end);
  const now = runs(companies, months, [end], {}, erosion)[0];
  const history = runs(companies, months, historyEnds(months, end), {}, erosion);
  const byId = new Map(companies.map((c) => [c.id, c]));
  const measures = companies.map((c) => ({ m: verdictOf(c, months, w).m, floor: floorOf(c) }));
  const routed: ByStep = [0, 0];
  for (const v of now.tickets) if (v.step && v.team) routed[v.step - 1]++;
  const perStep = (vs: Verdict[]): ByStep => [vs.filter((v) => v.step === 1).length, vs.filter((v) => v.step === 2).length];
  return {
    ...base,
    funnel: {
      inScope: companies.length, bought: measures.filter((x) => x.m.prev > 0).length, big: measures.filter((x) => bigBefore(x.m, x.floor)).length,
      found: now.found, erosion: perStep(now.eroded), routed,
    },
    rows: now.tickets.map((v) => { const c = byId.get(v.id)!; return {
        ...v, step: v.step!, name: c.name, segment: c.segment, prio: c.prio, un: c.un, swiss: c.swiss, country: c.country,
        major: c.major, split: c.split, lastOrder: c.lastOrder,
      };
    }),
    people: calendarOf(companies, months, now, history),
    ends: history.slice(1).map((r) => r.end),
    perRun: history.slice(1).map((r) => ({ end: r.end, tickets: perStep(r.tickets) })),
  };
}
