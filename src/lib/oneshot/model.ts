// ONE-SHOT ACTIONS - a campaign with a start, a fixed list of customers and one
// ticket each, measured by what came back in orders. Moved here from the
// APSOAssistant micro apps (05.10.2026); the figures are computed the way the
// Compass connector computed them (service/sept_push.py, service/marc_push.py),
// so the hub and the old scoreboards agree on every customer.
//
// Pure: no HubSpot, no database. The server hands over the raw rows (targets,
// tickets, orders); every KPI on screen is worked out here for the period the
// viewer picked, clipped to the action's own days.

export type CampaignId = "sept" | "marc" | "nancy";
export type CampaignKind = "push" | "reactivation";

export type Campaign = {
  id: CampaignId;
  kind: CampaignKind;
  name: string;
  line: string;
  href: string;
  owner: string;
  pipeline: string;
  /** First day whose orders count. */
  start: string;
  /** Last day of the action, when it has one. */
  end: string | null;
  /** The ticket marker property (`<prefix>_key`) - reactivation only. */
  prefix?: string;
  /** Where the connector keeps the target list (read once, then held by the hub). */
  targetsPath: string;
};

export const CAMPAIGNS: Record<CampaignId, Campaign> = {
  sept: {
    id: "sept", kind: "push", name: "September Push", href: "/uc/sept-push",
    line: "Order intake push on the ESO CH book, 14 to 30 September 2026",
    owner: "ESO CH team", pipeline: "ESO", start: "2026-09-14", end: "2026-09-30",
    targetsPath: "/push/targets",
  },
  marc: {
    id: "marc", kind: "reactivation", name: "Marc CH Push", href: "/uc/marc-push",
    line: "Reactivation batch 1 - Swiss customers who stopped buying or dropped sharply",
    owner: "Marc Frech", pipeline: "TSA", start: "2026-09-22", end: null, prefix: "marc_push",
    targetsPath: "/marcpush/targets?campaign=marc",
  },
  nancy: {
    id: "nancy", kind: "reactivation", name: "Nancy CH Push", href: "/uc/nancy-push",
    line: "Reactivation batch 2 - Prio-2 customers never called in batch 1",
    owner: "Nancy Pielock", pipeline: "TSA", start: "2026-09-24", end: null, prefix: "nancy_push",
    targetsPath: "/marcpush/targets?campaign=nancy",
  },
};

export const isCampaign = (s: string): s is CampaignId => s in CAMPAIGNS;

/* ── dates ─────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoDay(ms(iso) + n * DAY);

/** Every day from a to b inclusive. */
export function daysFrom(a: string, b: string): string[] {
  const out: string[] = [];
  for (let t = ms(a); t <= ms(b); t += DAY) out.push(isoDay(t));
  return out;
}

/** Mon-Fri days from a to b inclusive. */
export function workingDays(a: string, b: string): number {
  let n = 0;
  for (let t = ms(a); t <= ms(b); t += DAY) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

/** The days a figure covers: the viewer's period, never before the action began or after it ended. */
export function clipWindow(c: Pick<Campaign, "start" | "end">, from: string, to: string, today: string) {
  const last = c.end && c.end < today ? c.end : today;
  const f = from > c.start ? from : c.start;
  const t = to < last ? to : last;
  return { from: f, to: t, empty: f > t, clipped: f !== from || t !== to };
}

/* ── reactivation (Marc / Nancy CH Push) ───────────────────────────────── */

export type Order = { no: string; date: string; rev: number; src: string | null };

export type ReTicket = {
  id: string;
  stage: string;
  closed: boolean;
  resolution: string | null;
  lastActivity: string | null;
  contacted: number;
};

export type ReTarget = { un: string; name: string; value: number; potential: number; reason: string; source: string };

export type ReCard = ReTarget & {
  ticket: ReTicket | null;
  /** The customer's company: last call, e-mail or meeting logged on it, and the last logged call. */
  companyId: string | null;
  lastContacted: string | null;
  lastCall: string | null;
  /** Orders placed from the action's start on (order type "Order"). */
  orders: Order[];
};

export type ReactivationData = {
  campaign: CampaignId;
  today: string;
  generated: string;
  targetsImported: string | null;
  ticketsFound: number;
  cards: ReCard[];
};

export type Group = "dormant" | "declining" | "defend";
export const GROUP_LABEL: Record<Group, string> = {
  dormant: "Stopped buying",
  declining: "Buying less",
  defend: "Defend the volume",
};

export function groupOf(reason: string): Group {
  return reason.startsWith("no order") ? "dormant" : reason.startsWith("down") ? "declining" : "defend";
}

/** The connector's "called": anything logged on the ticket itself. */
export const ticketCalled = (c: ReCard) => !!c.ticket && (!!c.ticket.lastActivity || c.ticket.contacted > 0);

/**
 * Contacted since the action began: activity on the ticket, OR a call, e-mail or
 * meeting logged on the customer's company - most calls are logged on the
 * contact, not the ticket, so the ticket alone saw 5 of Marc's 30 (05.10.2026).
 */
export function contacted(c: ReCard, start: string): boolean {
  return ticketCalled(c) || (!!c.lastContacted && c.lastContacted >= start);
}

/** The day of the latest contact we can see, from either signal. */
export function contactDay(c: ReCard, start: string): string | null {
  const days = [c.ticket?.lastActivity ?? null, c.lastContacted].filter((d): d is string => !!d && d >= start);
  return days.length ? days.sort().at(-1)! : null;
}

export type ReState = "won" | "contacted" | "closed" | "open";
export const STATE_LABEL: Record<ReState, string> = {
  won: "Ordered again",
  contacted: "Contacted, no order yet",
  closed: "Closed without an order",
  open: "Not contacted yet",
};

/** Ordered again: the orders since the start add up to more than nothing (as the connector). */
export const orderedAgain = (c: ReCard) => c.orders.reduce((a, o) => a + o.rev, 0) > 0;

export function stateOf(c: ReCard, start: string): ReState {
  if (orderedAgain(c)) return "won";
  if (contacted(c, start)) return "contacted";
  if (c.ticket?.closed) return "closed";
  return "open";
}

export type ReactivationSummary = {
  window: { from: string; to: string; empty: boolean; clipped: boolean };
  daysRunning: number;
  customers: number;
  tickets: number;
  valueInScope: number;
  potentialInScope: number;
  /** Since the start, whatever the period. */
  contacted: number;
  ticketCalled: number;
  calls: number;
  closed: number;
  stillToContact: number;
  valueNotContacted: number;
  /** In the period. */
  reactivated: number;
  reactivatedAfterContact: number;
  orders: number;
  wonBack: number;
  byGroup: { group: Group; customers: number; value: number; contacted: number; reactivated: number; wonBack: number }[];
  byState: { state: ReState; customers: number }[];
  byStage: { stage: string; customers: number }[];
  outcomes: { label: string; count: number }[];
  timeline: { date: string; revenue: number; orders: number; contacted: number; cumRevenue: number; cumContacted: number }[];
};

export function reactivationSummary(
  camp: Pick<Campaign, "start" | "end">, data: Pick<ReactivationData, "cards" | "today" | "ticketsFound">,
  from: string, to: string,
): ReactivationSummary {
  const { start } = camp;
  const w = clipWindow(camp, from, to, data.today);
  const inW = (d: string) => !w.empty && d >= w.from && d <= w.to;
  const cards = data.cards;

  let reactivated = 0, afterContact = 0, orders = 0, wonBack = 0;
  const groups = new Map<Group, ReactivationSummary["byGroup"][number]>();
  for (const c of cards) {
    const os = c.orders.filter((o) => inW(o.date));
    const rev = os.reduce((a, o) => a + o.rev, 0);
    const won = rev > 0;
    const touched = contacted(c, start);
    reactivated += won ? 1 : 0;
    afterContact += won && touched ? 1 : 0;
    orders += os.length;
    wonBack += rev;
    const g = groupOf(c.reason);
    const b = groups.get(g) ?? { group: g, customers: 0, value: 0, contacted: 0, reactivated: 0, wonBack: 0 };
    b.customers += 1;
    b.value += c.value || 0;
    b.contacted += touched ? 1 : 0;
    b.reactivated += won ? 1 : 0;
    b.wonBack += rev;
    groups.set(g, b);
  }

  const contactedCards = cards.filter((c) => contacted(c, start));
  const states = new Map<ReState, number>();
  for (const c of cards) states.set(stateOf(c, start), (states.get(stateOf(c, start)) ?? 0) + 1);
  const stages = new Map<string, number>();
  for (const c of cards) stages.set(c.ticket?.stage || "(no ticket)", (stages.get(c.ticket?.stage || "(no ticket)") ?? 0) + 1);
  const outcomes = new Map<string, number>();
  for (const c of cards) {
    if (!c.ticket?.closed) continue;
    const r = c.ticket.resolution?.trim() || "No resolution recorded";
    outcomes.set(r, (outcomes.get(r) ?? 0) + 1);
  }

  // day by day over the whole action: money back, and the day each customer was last contacted
  const last = camp.end && camp.end < data.today ? camp.end : data.today;
  const revDay = new Map<string, number>(), ordDay = new Map<string, number>(), conDay = new Map<string, number>();
  for (const c of cards) {
    for (const o of c.orders) {
      if (!o.date) continue;
      revDay.set(o.date, (revDay.get(o.date) ?? 0) + o.rev);
      ordDay.set(o.date, (ordDay.get(o.date) ?? 0) + 1);
    }
    const d = contactDay(c, start);
    if (d) conDay.set(d, (conDay.get(d) ?? 0) + 1);
  }
  let cr = 0, cc = 0;
  const timeline = start <= last ? daysFrom(start, last).map((date) => {
    cr += revDay.get(date) ?? 0;
    cc += conDay.get(date) ?? 0;
    return { date, revenue: revDay.get(date) ?? 0, orders: ordDay.get(date) ?? 0, contacted: conDay.get(date) ?? 0, cumRevenue: cr, cumContacted: cc };
  }) : [];

  return {
    window: w,
    daysRunning: Math.max(0, Math.round((ms(data.today) - ms(start)) / DAY)),
    customers: cards.length,
    tickets: data.ticketsFound,
    valueInScope: cards.reduce((a, c) => a + (c.value || 0), 0),
    potentialInScope: cards.reduce((a, c) => a + (c.potential || 0), 0),
    contacted: contactedCards.length,
    ticketCalled: cards.filter(ticketCalled).length,
    calls: cards.filter((c) => !!c.lastCall && c.lastCall >= start).length,
    closed: cards.filter((c) => c.ticket?.closed).length,
    stillToContact: cards.length - contactedCards.length,
    valueNotContacted: cards.filter((c) => !contacted(c, start)).reduce((a, c) => a + (c.value || 0), 0),
    reactivated, reactivatedAfterContact: afterContact, orders, wonBack,
    byGroup: [...groups.values()].sort((a, b) => b.value - a.value),
    byState: (["won", "contacted", "closed", "open"] as ReState[]).map((s) => ({ state: s, customers: states.get(s) ?? 0 })),
    byStage: [...stages.entries()].map(([stage, customers]) => ({ stage, customers })).sort((a, b) => b.customers - a.customers),
    outcomes: [...outcomes.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    timeline,
  };
}

/** Who to call next: not contacted yet, biggest value first. */
export function callNext(camp: Pick<Campaign, "start">, cards: ReCard[]): ReCard[] {
  return cards.filter((c) => !contacted(c, camp.start) && !c.ticket?.closed && !orderedAgain(c))
    .sort((a, b) => b.value - a.value);
}

/* ── September push ────────────────────────────────────────────────────── */

export type PushOrder = Order & { pc: string | null };

export type PushTicket = {
  id: string;
  stage: string;
  closed: boolean;
  resolution: string | null;
  resolutionDetail: string | null;
  lastActivity: string | null;
};

export type PushTarget = {
  id: string;
  un: string;
  name: string;
  rep: string;
  /** The call wave: "Week 1" / "Week 2" / "Week 3" / "E-mail" (field `tier` in the plan). */
  tier: string;
  prio: string;
  country: string | null;
  target: number;
  to_get: number;
  baseline: number;
  booked_before: number;
  reasons: string[];
  r25: number;
  r26: number;
  sep25: number;
  offer_amt: number;
  ero_amt: number;
  last_act: string;
  call_on?: string;
  erosion_ticket?: string | null;
};

export type PushMeta = {
  campaign: string;
  start: string;
  end: string;
  month_start: string;
  company_target: number;
  reps: string[];
};

export type PushCard = PushTarget & { ticket: PushTicket | null; orders: PushOrder[] };

export type PushData = {
  campaign: "sept";
  today: string;
  generated: string;
  targetsImported: string | null;
  meta: PushMeta;
  ticketsFound: number;
  /** Every order of the month, all customers, summed per day. */
  daily: { date: string; rev: number; orders: number }[];
  cards: PushCard[];
};

export type PushStatus = "done" | "partial" | "closed" | "open";
export const PUSH_STATUS_LABEL: Record<PushStatus, string> = {
  done: "Ask reached",
  partial: "Ordered, below the ask",
  closed: "Ticket closed, no order",
  open: "No order",
};

/** As the connector: the ask reached, some order, a closed ticket, or nothing. */
export function pushStatus(booked: number, toGet: number, ticket: PushTicket | null): PushStatus {
  if (booked >= toGet && toGet > 0) return "done";
  if (booked > 0) return "partial";
  return ticket?.closed ? "closed" : "open";
}

export type PushSummary = {
  window: { from: string; to: string; empty: boolean; clipped: boolean };
  monthEnd: string;
  monthOver: boolean;
  target: number;
  bookedMonth: number;
  bookedSinceStart: number;
  workingDaysDone: number;
  workingDaysTotal: number;
  perDay: number;
  projection: number;
  gap: number;
  neededPerDayLeft: number;
  /** In the period, on the target accounts. */
  bookedOnTargets: number;
  toGet: number;
  accountsOrdered: number;
  accountsDone: number;
  tickets: number;
  ticketsClosed: number;
  cards: (PushCard & { booked: number; pct: number | null; status: PushStatus })[];
  reps: { rep: string; targets: number; toGet: number; booked: number; pct: number; done: number; partial: number; ordered: number; tickets: number; ticketsClosed: number }[];
  waves: { wave: string; targets: number; toGet: number; booked: number; ordered: number }[];
  outcomes: { label: string; count: number }[];
};

export function pushSummary(data: Pick<PushData, "meta" | "cards" | "daily" | "today" | "ticketsFound">, from: string, to: string): PushSummary {
  const { meta } = data;
  const m0 = meta.month_start;
  const nextMonth = new Date(Date.UTC(+m0.slice(0, 4), +m0.slice(5, 7), 1));
  const monthEnd = isoDay(nextMonth.getTime() - DAY);
  const w = clipWindow({ start: meta.start, end: meta.end }, from, to, data.today);
  const inW = (d: string) => !w.empty && d >= w.from && d <= w.to;

  const cards = data.cards.map((c) => {
    const booked = c.orders.filter((o) => inW(o.date)).reduce((a, o) => a + o.rev, 0);
    return { ...c, booked, pct: c.to_get ? (100 * booked) / c.to_get : null, status: pushStatus(booked, c.to_get, c.ticket) };
  }).sort((a, b) => b.to_get - a.to_get);

  const bookedMonth = data.daily.reduce((a, d) => a + d.rev, 0);
  const bookedSinceStart = data.daily.filter((d) => d.date >= meta.start).reduce((a, d) => a + d.rev, 0);
  const lastDone = data.today < monthEnd ? data.today : monthEnd;
  const wdDone = workingDays(m0, lastDone);
  const wdTotal = workingDays(m0, monthEnd);
  const perDay = bookedMonth / Math.max(1, wdDone);
  const projection = perDay * wdTotal;

  const reps = meta.reps.map((rep) => {
    const mine = cards.filter((c) => c.rep === rep);
    const toGet = mine.reduce((a, c) => a + c.to_get, 0);
    const booked = mine.reduce((a, c) => a + c.booked, 0);
    return {
      rep, targets: mine.length, toGet, booked, pct: (100 * booked) / Math.max(1, toGet),
      done: mine.filter((c) => c.status === "done").length,
      partial: mine.filter((c) => c.status === "partial").length,
      ordered: mine.filter((c) => c.booked > 0).length,
      tickets: mine.filter((c) => c.ticket).length,
      ticketsClosed: mine.filter((c) => c.ticket?.closed).length,
    };
  });
  const waveOrder = (s: string) => (/^Week (\d+)/.exec(s)?.[1] ? +/^Week (\d+)/.exec(s)![1] : 99);
  const waveMap = new Map<string, PushSummary["waves"][number]>();
  for (const c of cards) {
    const k = c.tier || "-";
    const b = waveMap.get(k) ?? { wave: k, targets: 0, toGet: 0, booked: 0, ordered: 0 };
    b.targets += 1; b.toGet += c.to_get; b.booked += c.booked; b.ordered += c.booked > 0 ? 1 : 0;
    waveMap.set(k, b);
  }
  const outcomes = new Map<string, number>();
  for (const c of cards) {
    if (!c.ticket?.closed) continue;
    const r = c.ticket.resolution?.trim() || "No resolution recorded";
    outcomes.set(r, (outcomes.get(r) ?? 0) + 1);
  }

  return {
    window: w, monthEnd, monthOver: data.today > monthEnd,
    target: meta.company_target, bookedMonth, bookedSinceStart,
    workingDaysDone: wdDone, workingDaysTotal: wdTotal, perDay, projection,
    gap: meta.company_target - projection,
    neededPerDayLeft: (meta.company_target - bookedMonth) / Math.max(1, wdTotal - wdDone),
    bookedOnTargets: cards.reduce((a, c) => a + c.booked, 0),
    toGet: cards.reduce((a, c) => a + c.to_get, 0),
    accountsOrdered: cards.filter((c) => c.booked > 0).length,
    accountsDone: cards.filter((c) => c.status === "done").length,
    tickets: cards.filter((c) => c.ticket).length,
    ticketsClosed: cards.filter((c) => c.ticket?.closed).length,
    cards, reps,
    waves: [...waveMap.values()].sort((a, b) => waveOrder(a.wave) - waveOrder(b.wave) || a.wave.localeCompare(b.wave)),
    outcomes: [...outcomes.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

