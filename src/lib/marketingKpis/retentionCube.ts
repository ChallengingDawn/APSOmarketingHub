// RETAIN & GROW - RETENTION, AS SARCLA'S RETENTION WORKBOOK (Desktop\Retention_breakdown.xlsx - "the erosion
// Excel"; SARCLA 20.10.2026: "2 · Retention Trend with other graphs - this applies to every tab; 3 · Cohorts &
// First-Order; 4 · Why They Leave, a diagram to see it; 5 · Tickets + 6 · Activities + 9 · Marketing Reach together
// to create a path; 7 · Personas - think in graph format, and vary"). The rules, with no HubSpot in them (the read
// is retention.ts), as the workbook's Method & Caveats:
//   active in a year   Performis revenue that year >= EUR 100 on the company (this year: its monthly figures)
//   churn Y -> Y+1     active in Y, not in Y+1 - for this year "not back yet" (a partial year)
//   new / won back     active in Y+1, not in Y: new when its first order ever (Compass) is that year, won back
//                      otherwise (no first-order year: new when it was never active in the years read)
//   cohort             the year of the first order ever (compass_first_order_year)
//   the base year      last year, against this year so far (January to March: the two complete years before)
//   orders             the base year's order documents of the customer, one order per base number; C2S = a
//                      cut-to-size order; specials = an order with special articles; web = from the eShop,
//                      offline = entered in the ERP (offer or by hand)
//   tickets            demand and problem in the base year (one of this year follows an order of this year), sales and
//                      erosion since its January (a sales touch, as the calls): demand = the categories Product Price / Product
//                      Information (mostly requests for quotation); problem = the Back Office, GQS and E-Commerce
//                      pipelines (delivery = a Delivery category); sales = ESO, TSA, Special Prices, Product
//                      Management; erosion = an erosion ticket
//   sales touch        a call, a meeting, a visit or a sales ticket since January of the base year
//   marketing reach    a contact of the company that is a marketing contact (HubSpot's marketable status)
// Tables are correlations; size confounds (the workbook's own caveat).

/** Active in a year: at least this much revenue. */
export const ACTIVE_MIN = 100;
/** 1: the first read (20.10.2026) */
export const RETENTION_SHAPE = 1;

/** A customer's base-year orders. */
export type Behaviour = { n: number; pcs: string[]; c2s: number; sp: number; web: number; erp: number; gm: number | null };
/** Its tickets: demand, problem, delivery in the base year; sales and erosion since its January. */
export type Talk = { dem: number; prob: number; del: number; sales: number; ero: number };
/** Its calls, meetings, visits and e-mails sent since January of the base year - and the owners who logged them. */
export type Acts = { calls: number; out: number; inb: number; mtg: number; vis: number; em: number; by: string[] };
/** Its contacts: how many, how many are marketing contacts, the persona most of them carry. */
export type Contacts = { n: number; mkt: number; per: string | null };

export type RCo = {
  /** the HubSpot company id */
  id: string;
  /** owner id, sales priority (raw), APSO segment, country, APIC */
  o: string; p: string; s: string; k: string; a: string;
  /** yearly potential, first order year (Compass) */
  pot: number | null; f: number | null;
  /** revenue each year of RetentionRaw.years, EUR */
  r: number[];
  b?: Behaviour; t?: Talk; x?: Acts; c?: Contacts;
};
export type OwnerInfo = { n: string; team: string; left: boolean };

export type RetentionRaw = {
  /** 2015 .. this year */
  years: number[];
  base: number; next: number;
  /** the day of the read, "2026-10-20" */
  asOf: string; readAt: string;
  owners: Record<string, OwnerInfo>;
  /** persona code -> its name */
  personas: Record<string, string>;
  /** each owner's calls, e-mails sent and meetings/visits since January of the base year, on any company */
  ownerActs: Record<string, { calls: number; em: number; mtg: number }>;
  cos: RCo[];
  counts: Record<string, number>;
  errors: Record<string, string>;
  shape?: number;
};

/** The base year and the one it is checked against: last year against this one, before April the two before. */
export function baseOf(today: string): { base: number; next: number } {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  return m <= 3 ? { base: y - 2, next: y - 1 } : { base: y - 1, next: y };
}

const ix = (d: RetentionRaw, y: number) => d.years.indexOf(y);
const on = (c: RCo, i: number) => i >= 0 && (c.r[i] ?? 0) >= ACTIVE_MIN;
const firstOn = (c: RCo) => c.r.findIndex((v) => v >= ACTIVE_MIN);
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
/** Is the year the next one checked against still running? */
export const isPartial = (d: RetentionRaw) => d.next === Number(d.asOf.slice(0, 4));

/* ── 1 · the trend ───────────────────────────────────────────────────────────── */

export type TrendRow = {
  year: number; next: number; active: number; retained: number; retention: number | null; churned: number; churnedRev: number;
  /** the next year's customers: kept, new, won back - and how many were active that year */
  newNext: number; winbacks: number; activeNext: number; partial: boolean;
};

/** Active in years[i], not in years[i-1]: new (its first order that year) or won back. */
function isNew(d: RetentionRaw, c: RCo, i: number): boolean {
  if (c.f != null) return c.f >= d.years[i];
  return firstOn(c) === i;
}

export function trendOf(d: RetentionRaw): TrendRow[] {
  const out: TrendRow[] = [];
  for (let i = 0; i + 1 < d.years.length && d.years[i] < d.next; i++) {
    let active = 0, retained = 0, churned = 0, churnedRev = 0, newNext = 0, winbacks = 0, activeNext = 0;
    for (const c of d.cos) {
      const a0 = on(c, i), a1 = on(c, i + 1);
      if (a1) activeNext++;
      if (a0) { active++; if (a1) retained++; else { churned++; churnedRev += c.r[i]; } }
      else if (a1) { if (isNew(d, c, i + 1)) newNext++; else winbacks++; }
    }
    out.push({ year: d.years[i], next: d.years[i + 1], active, retained, retention: active ? retained / active : null, churned, churnedRev, newNext, winbacks, activeNext, partial: d.years[i + 1] === d.next && isPartial(d) });
  }
  return out;
}

/* ── 2 · cohorts ─────────────────────────────────────────────────────────────── */

export type CohortRow = {
  cohort: number;
  /** customers whose first order ever was that year */
  size: number;
  /** the share of them active each year from the cohort's on (index 0 = the cohort year) */
  share: (number | null)[];
};
export type OnceRow = { cohort: number; size: number; once: number | null; gone2: number | null; still: number | null };
export type FirstSecondRow = { cohort: number; y1: number; y2: number; churn: number | null; rev1: number; rev2: number; revChurn: number | null; partial: boolean };

export function cohortsOf(d: RetentionRaw): { rows: CohortRow[]; once: OnceRow[]; firstSecond: FirstSecondRow[] } {
  const first = d.years[0], last = d.next;
  const by = new Map<number, RCo[]>();
  for (const c of d.cos) {
    if (c.f == null || c.f < first || c.f > last) continue;
    let xs = by.get(c.f);
    if (!xs) { xs = []; by.set(c.f, xs); }
    xs.push(c);
  }
  const rows: CohortRow[] = [], once: OnceRow[] = [], firstSecond: FirstSecondRow[] = [];
  for (let y = first; y <= last; y++) {
    const xs = by.get(y) ?? [];
    if (!xs.length) continue;
    const share: (number | null)[] = [];
    for (let z = y; z <= last; z++) share.push(xs.filter((c) => on(c, ix(d, z))).length / xs.length);
    rows.push({ cohort: y, size: xs.length, share });
    // of those that bought at least once: only once, gone within two years, still buying
    const ever = xs.filter((c) => c.r.some((v, i) => d.years[i] >= y && v >= ACTIVE_MIN));
    const yearsOn = (c: RCo) => c.r.filter((v, i) => d.years[i] >= y && v >= ACTIVE_MIN).length;
    const lastOn = (c: RCo) => { let l = -1; c.r.forEach((v, i) => { if (v >= ACTIVE_MIN) l = d.years[i]; }); return l; };
    if (y < last - (isPartial(d) ? 1 : 0)) {
      once.push({
        cohort: y, size: ever.length,
        once: ever.length ? ever.filter((c) => yearsOn(c) === 1).length / ever.length : null,
        gone2: y <= last - 2 && ever.length ? ever.filter((c) => lastOn(c) <= y + 1).length / ever.length : null,
        still: ever.length ? ever.filter((c) => on(c, ix(d, last)) || on(c, ix(d, last - 1))).length / ever.length : null,
      });
    }
    if (y < last) {
      const i1 = ix(d, y), i2 = ix(d, y + 1);
      const y1 = xs.filter((c) => on(c, i1)), y2 = xs.filter((c) => on(c, i2));
      const rev1 = sum(y1, (c) => c.r[i1]), rev2 = sum(xs, (c) => (on(c, i2) ? c.r[i2] : 0));
      firstSecond.push({ cohort: y, y1: y1.length, y2: y2.length, churn: y1.length ? 1 - y2.length / y1.length : null, rev1, rev2, revChurn: rev1 ? 1 - rev2 / rev1 : null, partial: y + 1 === d.next && isPartial(d) });
    }
  }
  return { rows, once, firstSecond };
}

/* ── the base year's customers, split ────────────────────────────────────────── */

export type GroupRow = { dim: string; group: string; cos: number; churned: number; churn: number | null; pts: number | null; rev: number; revLost: number };

function groupRow(dim: string, group: string, xs: RCo[], left: (c: RCo) => boolean, bi: number, avg: number): GroupRow {
  const lost = xs.filter(left);
  const churn = xs.length ? lost.length / xs.length : null;
  return { dim, group, cos: xs.length, churned: lost.length, churn, pts: churn == null ? null : (churn - avg) * 100, rev: sum(xs, (c) => c.r[bi]), revLost: sum(lost, (c) => c.r[bi]) };
}

/** The base year's active customers, and who is not back. */
function baseSet(d: RetentionRaw) {
  const bi = ix(d, d.base), ni = ix(d, d.next);
  const act = d.cos.filter((c) => on(c, bi));
  const left = (c: RCo) => !on(c, ni);
  const avg = act.length ? act.filter(left).length / act.length : 0;
  return { bi, act, left, avg };
}

export type Flow = { columns: string[]; nodes: { id: string; column: number; label: string; tone: "base" | "good" | "bad" | "mid" | "none" }[]; links: { from: string; to: string; value: number }[] };

/** A flow from the base year's customers through steps to back / not back - each customer one path. */
function flowOf(columns: string[], act: RCo[], steps: { id: (c: RCo) => string; nodes: { id: string; label: string; tone: Flow["nodes"][number]["tone"] }[] }[], left: (c: RCo) => boolean, d: RetentionRaw): Flow {
  const nodes: Flow["nodes"] = [{ id: "all", column: 0, label: `Active ${d.base}`, tone: "base" }];
  steps.forEach((s, k) => s.nodes.forEach((n) => nodes.push({ ...n, column: k + 1 })));
  const out = steps.length + 1;
  nodes.push({ id: "back", column: out, label: isPartial(d) ? `Back in ${d.next}` : `Bought in ${d.next}`, tone: "good" }, { id: "gone", column: out, label: isPartial(d) ? "Not back yet" : `Lost in ${d.next}`, tone: "bad" });
  const count = new Map<string, number>();
  for (const c of act) {
    const path = ["all", ...steps.map((s) => s.id(c)), left(c) ? "gone" : "back"];
    for (let k = 0; k + 1 < path.length; k++) { const key = `${path[k]}>${path[k + 1]}`; count.set(key, (count.get(key) ?? 0) + 1); }
  }
  const used = new Set<string>();
  const links = [...count.entries()].map(([k, value]) => { const [from, to] = k.split(">"); used.add(from); used.add(to); return { from, to, value }; });
  return { columns, nodes: nodes.filter((n) => used.has(n.id)), links };
}

/* ── 3 · why they leave ──────────────────────────────────────────────────────── */

const sizeBand = (v: number) => (v < 500 ? "< 500 EUR" : v < 2500 ? "500 - 2,500 EUR" : v < 25000 ? "2,500 - 25,000 EUR" : ">= 25,000 EUR");
const ordersBand = (c: RCo) => (!c.b ? "none" : c.b.n <= 1 ? "1" : c.b.n <= 5 ? "2-5" : "6+");

export function leaveOf(d: RetentionRaw): { avg: number; customers: number; rows: GroupRow[]; flow: Flow } {
  const { bi, act, left, avg } = baseSet(d);
  const G = (dim: string, group: string, test: (c: RCo) => boolean) => groupRow(dim, group, act.filter(test), left, bi, avg);
  const rows: GroupRow[] = [
    G("Orders", `1 order in ${d.base}`, (c) => ordersBand(c) === "1"),
    G("Orders", "2 - 5 orders", (c) => ordersBand(c) === "2-5"),
    G("Orders", "6+ orders", (c) => ordersBand(c) === "6+"),
    G("Size", "< 500 EUR", (c) => c.r[bi] < 500),
    G("Size", "500 - 2,500 EUR", (c) => c.r[bi] >= 500 && c.r[bi] < 2500),
    G("Size", "2,500 - 25,000 EUR", (c) => c.r[bi] >= 2500 && c.r[bi] < 25000),
    G("Size", ">= 25,000 EUR", (c) => c.r[bi] >= 25000),
    G("Product breadth", "buys from 1 profit centre only", (c) => (c.b?.pcs.length ?? 0) === 1),
    G("Product breadth", "buys from 2+ profit centres", (c) => (c.b?.pcs.length ?? 0) >= 2),
    G("Cut-to-size", "bought cut-to-size (C2S)", (c) => (c.b?.c2s ?? 0) > 0),
    G("Cut-to-size", "standard catalogue only", (c) => !!c.b && c.b.c2s === 0),
    G("Specials", "buys special articles", (c) => (c.b?.sp ?? 0) > 0),
    G("Channel", "web-only (all orders via the shop)", (c) => !!c.b && c.b.web > 0 && c.b.erp === 0),
    G("Channel", "offline only (ERP: offer or by hand)", (c) => !!c.b && c.b.erp > 0 && c.b.web === 0),
    G("Channel", "mixed (shop and ERP)", (c) => !!c.b && c.b.erp > 0 && c.b.web > 0),
    G("Margin", "average margin >= 50%", (c) => c.b?.gm != null && c.b.gm >= 50),
    G("Margin", "average margin < 25%", (c) => c.b?.gm != null && c.b.gm < 25),
  ].filter((r) => r.cos > 0);
  const flow = flowOf([`Active ${d.base}`, `Orders in ${d.base}`, "Product families", isPartial(d) ? `${d.next} so far` : String(d.next)], act, [
    { id: (c) => `o${ordersBand(c)}`, nodes: [{ id: "o1", label: "1 order", tone: "bad" }, { id: "o2-5", label: "2 - 5 orders", tone: "mid" }, { id: "o6+", label: "6+ orders", tone: "good" }, { id: "onone", label: "No order found", tone: "none" }] },
    { id: (c) => (!c.b ? "fnone" : c.b.pcs.length >= 2 ? "f2" : "f1"), nodes: [{ id: "f1", label: "One profit centre", tone: "bad" }, { id: "f2", label: "Two or more", tone: "good" }, { id: "fnone", label: "Not known", tone: "none" }] },
  ], left, d);
  return { avg, customers: act.length, rows, flow };
}

/* ── 4 · the path: sales touch, marketing reach, tickets ─────────────────────── */

const touched = (c: RCo) => !!c.x && c.x.calls + c.x.mtg + c.x.vis > 0 || (c.t?.sales ?? 0) > 0 || (c.t?.ero ?? 0) > 0;
const reachOf = (c: RCo) => ((c.c?.mkt ?? 0) > 0 ? "mkt" : (c.c?.n ?? 0) > 0 ? "nomkt" : "nocontact");
const talkOf = (c: RCo) => ((c.t?.dem ?? 0) > 0 ? "asked" : (c.t?.prob ?? 0) > 0 ? "problem" : "silent");

const TEAM_ORDER = ["ESO - field sales", "TSA - inside sales", "Back Office", "No team", "Former staff"];
const teamRank = (t: string) => { const i = TEAM_ORDER.indexOf(t); return i < 0 ? TEAM_ORDER.length : i; };

export type OwnerRow = {
  id: string; name: string; team: string; left: boolean;
  calls: number; em: number; mtg: number;
  /** the base year's active customers it owns, and those its activity reached */
  book: number; touched: number; touchedPct: number | null; touchedRev: number; churned: number; churn: number | null; churnedRev: number;
};

export function pathOf(d: RetentionRaw): { avg: number; customers: number; flow: Flow; rows: GroupRow[]; owners: OwnerRow[] } {
  const { bi, act, left, avg } = baseSet(d);
  const flow = flowOf([`Active ${d.base}`, "Sales touch", "Marketing reach", "Talked to us", isPartial(d) ? `${d.next} so far` : String(d.next)], act, [
    { id: (c) => (touched(c) ? "touch" : "untouched"), nodes: [{ id: "touch", label: "Called, met or visited", tone: "good" }, { id: "untouched", label: "No sales touch", tone: "bad" }] },
    { id: (c) => reachOf(c), nodes: [{ id: "mkt", label: "Marketing contact", tone: "good" }, { id: "nomkt", label: "Contacts, none marketing", tone: "mid" }, { id: "nocontact", label: "No contact person", tone: "bad" }] },
    { id: (c) => talkOf(c), nodes: [{ id: "asked", label: "Asked (quote, product)", tone: "good" }, { id: "problem", label: "Problem ticket", tone: "mid" }, { id: "silent", label: "Silent", tone: "bad" }] },
  ], left, d);
  const G = (dim: string, group: string, test: (c: RCo) => boolean) => groupRow(dim, group, act.filter(test), left, bi, avg);
  const rows: GroupRow[] = [
    G("Calls", "no call", (c) => (c.x?.calls ?? 0) === 0),
    G("Calls", "1 - 2 calls", (c) => (c.x?.calls ?? 0) >= 1 && (c.x?.calls ?? 0) <= 2),
    G("Calls", "3+ calls", (c) => (c.x?.calls ?? 0) >= 3),
    G("Call direction", "we called them", (c) => (c.x?.out ?? 0) > 0),
    G("Call direction", "they called us", (c) => (c.x?.inb ?? 0) > 0),
    G("Visits & meetings", "had a visit or a meeting", (c) => (c.x?.mtg ?? 0) + (c.x?.vis ?? 0) > 0),
    G("E-mails", "no e-mail sent to them", (c) => (c.x?.em ?? 0) === 0),
    G("E-mails", "e-mails sent to them", (c) => (c.x?.em ?? 0) > 0),
    G("Any sales touch", "touched (call, meeting, visit, sales ticket)", touched),
    G("Any sales touch", "untouched", (c) => !touched(c)),
    G("Demand tickets", "asked: a quote or product question", (c) => (c.t?.dem ?? 0) > 0),
    G("Demand tickets", "never asked", (c) => (c.t?.dem ?? 0) === 0),
    G("Problem tickets", "no problem ticket", (c) => (c.t?.prob ?? 0) === 0),
    G("Problem tickets", "1 problem ticket", (c) => (c.t?.prob ?? 0) === 1),
    G("Problem tickets", "2+ problem tickets", (c) => (c.t?.prob ?? 0) >= 2),
    G("Problem tickets", "a delivery problem", (c) => (c.t?.del ?? 0) > 0),
    G("Erosion outreach", "got an erosion ticket", (c) => (c.t?.ero ?? 0) > 0),
    G("Marketing reach", "has a marketing contact", (c) => reachOf(c) === "mkt"),
    G("Marketing reach", "contacts, none of them marketing", (c) => reachOf(c) === "nomkt"),
    G("Marketing reach", "no contact person at all", (c) => reachOf(c) === "nocontact"),
  ].filter((r) => r.cos > 0);
  // per owner: the book it owns, the customers its activity reached, and what became of them
  const book = new Map<string, number>(), reached = new Map<string, RCo[]>();
  for (const c of act) {
    if (c.o) book.set(c.o, (book.get(c.o) ?? 0) + 1);
    for (const o of c.x?.by ?? []) { let xs = reached.get(o); if (!xs) { xs = []; reached.set(o, xs); } xs.push(c); }
  }
  const ids = new Set([...reached.keys()]);
  const owners: OwnerRow[] = [...ids].map((id) => {
    const xs = reached.get(id) ?? [], lost = xs.filter(left), b = book.get(id) ?? 0, info = d.owners[id];
    const a = d.ownerActs[id] ?? { calls: 0, em: 0, mtg: 0 };
    return {
      id, name: info?.n ?? `Owner ${id}`, team: info?.left ? "Former staff" : info?.team || "No team", left: !!info?.left,
      calls: a.calls, em: a.em, mtg: a.mtg, book: b, touched: xs.length, touchedPct: b ? Math.min(1, xs.filter((c) => c.o === id).length / b) : null,
      touchedRev: sum(xs, (c) => c.r[bi]), churned: lost.length, churn: xs.length ? lost.length / xs.length : null, churnedRev: sum(lost, (c) => c.r[bi]),
    };
  }).filter((o) => o.touched >= 10).sort((x, y) => teamRank(x.team) - teamRank(y.team) || x.team.localeCompare(y.team) || (y.churn ?? 0) - (x.churn ?? 0));
  return { avg, customers: act.length, flow, rows, owners };
}

/* ── 5 · personas ────────────────────────────────────────────────────────────── */

const BUSINESS: Record<string, string> = { "1": "OEM manufacturers (1.x)", "2": "MRO / end users (2.x)", "3": "Resellers & partners (3.x)", "4": "Processing / toll manufacturing (4.x)", "5": "Engineering firms (5.x)" };
export const prioOf = (v: string) => { const x = (v ?? "").trim().charAt(0); return x === "1" || x === "2" || x === "3" ? `Prio ${x}` : x === "4" ? "No priority" : "Not set"; };
export const PRIOS = ["Prio 1", "Prio 2", "Prio 3", "No priority", "Not set"];

export function personasOf(d: RetentionRaw): { avg: number; customers: number; rows: GroupRow[]; matrix: { segment: string; cells: { prio: string; cos: number; churn: number | null }[]; cos: number }[] } {
  const { bi, act, left, avg } = baseSet(d);
  const rows: GroupRow[] = [];
  const split = (dim: string, key: (c: RCo) => string, top?: number, rest?: string) => {
    const by = new Map<string, RCo[]>();
    for (const c of act) { const k = key(c); let xs = by.get(k); if (!xs) { xs = []; by.set(k, xs); } xs.push(c); }
    let groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
    if (top && groups.length > top) {
      const others = groups.slice(top).flatMap(([, xs]) => xs);
      groups = [...groups.slice(0, top), [rest ?? "Other", others]];
    }
    for (const [k, xs] of groups) rows.push(groupRow(dim, k, xs, left, bi, avg));
  };
  split("Contact persona", (c) => (c.c?.per ? d.personas[c.c.per] ?? c.c.per : (c.c?.n ?? 0) > 0 ? "No persona on its contacts" : "No contact person"));
  split("Business type", (c) => BUSINESS[c.a.trim().charAt(0)] ?? "No APIC classification");
  split("Industry (APIC)", (c) => c.a.trim() || "No APIC classification", 10, "Other industries");
  split("Country", (c) => c.k || "Not set", 8, "Other countries");
  split("Segment", (c) => c.s || "No segment");
  split("Sales priority", (c) => prioOf(c.p));
  const segs = [...new Set(act.map((c) => c.s || "No segment"))];
  const matrix = segs.map((segment) => {
    const xs = act.filter((c) => (c.s || "No segment") === segment);
    return {
      segment, cos: xs.length,
      cells: PRIOS.map((prio) => { const ys = xs.filter((c) => prioOf(c.p) === prio); return { prio, cos: ys.length, churn: ys.length >= 25 ? ys.filter(left).length / ys.length : null }; }),
    };
  }).sort((a, b) => b.cos - a.cos);
  return { avg, customers: act.length, rows, matrix };
}

/* ── the page's figures, and all of it together ──────────────────────────────── */

export type RetentionView = {
  years: number[]; base: number; next: number; asOf: string; readAt: string; partial: boolean;
  figures: { active: number; back: number; gone: number; churn: number | null; goneRev: number; newNext: number; winbacks: number };
  trend: TrendRow[];
  cohorts: ReturnType<typeof cohortsOf>;
  leave: ReturnType<typeof leaveOf>;
  path: ReturnType<typeof pathOf>;
  personas: ReturnType<typeof personasOf>;
  counts: Record<string, number>; errors: Record<string, string>;
};

export function retentionView(d: RetentionRaw): RetentionView {
  const trend = trendOf(d);
  const t = trend.find((x) => x.year === d.base);
  return {
    years: d.years, base: d.base, next: d.next, asOf: d.asOf, readAt: d.readAt, partial: isPartial(d),
    figures: { active: t?.active ?? 0, back: t?.retained ?? 0, gone: t?.churned ?? 0, churn: t && t.active ? t.churned / t.active : null, goneRev: t?.churnedRev ?? 0, newNext: t?.newNext ?? 0, winbacks: t?.winbacks ?? 0 },
    trend, cohorts: cohortsOf(d), leave: leaveOf(d), path: pathOf(d), personas: personasOf(d), counts: d.counts, errors: d.errors,
  };
}
