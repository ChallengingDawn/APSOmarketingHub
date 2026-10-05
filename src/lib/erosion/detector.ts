// THE EROSION DETECTOR - the rules, ported line for line from the connector's
// service/erosion_load.py (compass-connector main, 04.10.2026), so the hub can
// raise the same tickets the connector raises today. Pure: no I/O, no clock, no
// HubSpot - the caller hands in the orders, the companies and "today", which is
// what makes the port testable against the Python, case by case.
//
// Rule: a company bought an article in PREV_YEAR (>= its threshold) and has NOT
// bought it in CUR_YEAR, and the ANNIVERSARY of the last PREV_YEAR invoice lapses
// -> a ticket, routed by the company owner's roster. Strictly forward-looking:
// nothing that lapsed on or before the WATERMARK ever tickets. One ticket per
// company per calendar month; later articles of that month are merged onto it.
//
// Where the Python reads a pickle (un -> company id) the hub searches HubSpot by
// company_unique_number - the same field the pickle was crawled from.

import { isInternalCompany } from "../datatracker/rules";
import { ESO_OWNERS, PIPE_STAGE, TSA_OWNERS } from "../datatracker/rosters";
import { fixText } from "./model";

export const PREV_YEAR = "2025";
export const CUR_YEAR = "2026";
/** The connector's first run (erosion_state.json). Nothing lapsing on or before it tickets. */
export const FIRST_RUN = "2026-08-21";
/**
 * The 01.10 rules (invoice-only, year from the INVOICE, open orders hold back) apply
 * from the day they were made. Counting from the invoice moved ~138 anniversaries of
 * 22.08-30.09 after the first-run date; SARCLA (04.10): "don't trigger these,
 * calculate correctly moving forward". Same constant as RULES_FROM in the connector.
 */
export const RULES_FROM = "2026-10-01";
/** Nothing lapsing on or before this tickets - the later of the two. */
export const WATERMARK = FIRST_RUN > RULES_FROM ? FIRST_RUN : RULES_FROM;
/** Per-owner floor, applied after routing and only when stricter: Luca Fantasia asked for 1000 EUR everywhere. */
export const OWNER_MIN_REV: Record<string, number> = { "1229999587": 1000 };

export function countryMinRev(un: string): number {
  return un.startsWith("100-") ? 1000 : 500;
}

/** Python's round(): half to EVEN. Math.round would put 0.5 and 2.5 a euro apart from the connector. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** f"{n:,}" with the comma swapped for an apostrophe - the subject and body style. */
export function swissInt(n: number): string {
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return n < 0 ? `-${s}` : s;
}

/** datetime.date.fromisoformat(d) + timedelta(days) */
export function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function lastDayOfMonthBefore(iso: string): string {
  return addDays(`${iso.slice(0, 7)}-01`, -1);
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/* ── order lines ──────────────────────────────────────────────────────── */

export type FixEntry = { n: string; t?: string };
export type FixMap = Record<string, FixEntry>;
export type Position = { article: string; text: string; rev: number };
export type OrderProps = Record<string, unknown>;
export type OrderRec = { id: string; props: OrderProps };

/** _positions(): the order's lines, Compass-internal ids repaired through the fixmap. */
export function positions(props: OrderProps, fixmap: FixMap): Position[] {
  let arr: unknown;
  try {
    arr = JSON.parse(s(props.order_positions_json) || "[]");
  } catch {
    arr = [];
  }
  if (!Array.isArray(arr)) return [];
  const out: Position[] = [];
  for (const raw of arr) {
    if (typeof raw !== "object" || raw === null) continue;
    const x = raw as Record<string, unknown>;
    let art = s(x.article || x.a || "").trim();
    if (!art) continue;
    let text = s(x.text || x.t || "").trim();
    const m = fixmap[art];
    if (m) {
      art = m.n;
      text = text || m.t || "";
    }
    const rev = Number(x.revenue || x.r || 0);
    out.push({ article: art, text, rev: Number.isFinite(rev) ? rev : 0 });
  }
  return out;
}

/* ── aggregation per (company, article) ───────────────────────────────── */

export type Agg = {
  revPrev: number;
  revCur: number;
  lastPrev: string;
  ordersPrev: Set<string>;
  cntPrev: number;
  text: string;
  oidsPrev: string[];
  openCur: boolean;
  lastInvPrev: string;
};

export const aggKey = (un: string, art: string) => `${un}\u0000${art}`;

/**
 * Only an INVOICED document counts as money (.000 is the order as placed, .001+
 * the invoiced deliveries - summing both doubled every amount until 01.10). An
 * un-invoiced current-year document means they are buying it right now.
 */
export function aggregate(orders: OrderRec[], fixmap: FixMap): { agg: Map<string, Agg>; noCust: number } {
  const agg = new Map<string, Agg>();
  let noCust = 0;
  for (const { id, props: p } of orders) {
    if (s(p.order_order_type) === "Credit note") continue;
    const mand = s(p.order_mandant).trim();
    const cust = s(p.order_customer_number).trim();
    if (!mand || !cust) {
      noCust += 1;
      continue;
    }
    const un = `${mand}-${cust}`;
    const date = s(p.order_order_date);
    const year = date.slice(0, 4);
    if (year !== PREV_YEAR && year !== CUR_YEAR) continue;
    const status = s(p.order_order_status).trim().toLowerCase();
    const invDate = s(p.order_invoice_date).slice(0, 10);
    const invoiced = status === "invoiced" || invDate.length > 0;
    for (const pos of positions(p, fixmap)) {
      const art = pos.article;
      if (!/^\d{10}$/.test(art)) continue;        // wrong-SKU exception set - excluded
      const k = aggKey(un, art);
      let a = agg.get(k);
      if (!a) {
        a = { revPrev: 0, revCur: 0, lastPrev: "", ordersPrev: new Set(), cntPrev: 0, text: "", oidsPrev: [], openCur: false, lastInvPrev: "" };
        agg.set(k, a);
      }
      if (!a.text && pos.text) a.text = pos.text;
      if (!invoiced) {
        if (year === CUR_YEAR) a.openCur = true;
        continue;
      }
      if (year === PREV_YEAR && invDate > a.lastInvPrev) a.lastInvPrev = invDate;
      if (year === PREV_YEAR) {
        a.revPrev += pos.rev;
        a.cntPrev += 1;
        const d = date.slice(0, 10);
        if (d > a.lastPrev) a.lastPrev = d;
        const on = s(p.order_order_number).trim();
        if (on) a.ordersPrev.add(on);
        if (a.oidsPrev.length < 5) a.oidsPrev.push(id);
      } else {
        a.revCur += pos.rev;
      }
    }
  }
  return { agg, noCust };
}

/** The year runs from the INVOICE (ordered 08.09, invoiced 20.10 must not fire in September). */
export function anniversary(a: Agg): string {
  return addDays(a.lastInvPrev || a.lastPrev, 365);
}

export const erosionKey = (un: string, art: string) => `${un}|${art}|${CUR_YEAR}`;

export type Candidate = { un: string; art: string; a: Agg; anniv: string; key: string };

export function selectCandidates(
  agg: Map<string, Agg>,
  opts: { horizon: string; watermark?: string; keys: Set<string> },
): { cands: Candidate[]; openOrders: number } {
  const wm = opts.watermark ?? WATERMARK;
  const cands: Candidate[] = [];
  let openOrders = 0;
  for (const [k, a] of agg) {
    const [un, art] = k.split("\u0000");
    if (a.revCur > 0.005 || !a.lastPrev) continue;
    if (a.revPrev < countryMinRev(un)) continue;
    const anniv = anniversary(a);
    if (!(wm < anniv && anniv <= opts.horizon)) continue;   // forward-only window
    if (a.openCur) {
      openOrders += 1;
      continue;
    }
    const key = erosionKey(un, art);
    if (opts.keys.has(key)) continue;
    cands.push({ un, art, a, anniv, key });
  }
  return { cands, openOrders };
}

/* ── routing and grouping ─────────────────────────────────────────────── */

export type Team = "ESO" | "TSA";
export type Company = { id: string; name: string; ownerId: string };
/** A candidate with its company and the owner that routes it (company owner, else the buyer contact's). */
export type Resolved = Candidate & { company: Company | null; owner: string };

export type Member = { art: string; a: Agg; anniv: string; key: string };
export type Group = { cid: string; owner: string; team: Team; mkey: string; un: string; name: string; members: Member[] };

export type RunReport = {
  skippedNoCompany: string[];
  skippedOwner: { un: string; article: string; owner: string }[];
  skippedThreshold: { un: string; article: string; owner: string; amount: number; min: number }[];
  /** APSOparts' / A+P's own companies - never ticketed (SARCLA 05.10). */
  skippedInternal?: string[];
};

export function teamOfOwner(owner: string): Team | null {
  return ESO_OWNERS[owner] ? "ESO" : TSA_OWNERS[owner] ? "TSA" : null;
}

const rosterName = (owner: string) => ESO_OWNERS[owner] ?? TSA_OWNERS[owner] ?? owner;

/**
 * PASS 1: route each candidate, group survivors per company AND calendar month,
 * then put back the articles this month's ticket already carries so the rebuilt
 * ticket describes the whole month.
 */
export function buildGroups(
  resolved: Resolved[],
  agg: Map<string, Agg>,
  month: Map<string, { tid: string; arts: string[] }>,
): { groups: Map<string, Group>; report: RunReport } {
  const groups = new Map<string, Group>();
  const report: RunReport = { skippedNoCompany: [], skippedOwner: [], skippedThreshold: [], skippedInternal: [] };
  for (const c of resolved) {
    if (!c.company) {
      report.skippedNoCompany.push(c.un);
      continue;
    }
    if (isInternalCompany(c.company.name)) {
      report.skippedInternal!.push(c.un);
      continue;
    }
    const team = teamOfOwner(c.owner);
    if (!team) {
      report.skippedOwner.push({ un: c.un, article: c.art, owner: c.owner || "(none)" });
      continue;
    }
    const omin = OWNER_MIN_REV[c.owner];
    if (omin && c.a.revPrev < omin) {
      report.skippedThreshold.push({ un: c.un, article: c.art, owner: rosterName(c.owner), amount: pyRound(c.a.revPrev), min: omin });
      continue;
    }
    const mkey = `${c.un}|${c.anniv.slice(0, 7)}`;
    let g = groups.get(mkey);
    if (!g) {
      g = {
        cid: c.company.id, owner: c.owner, team, mkey, un: c.un,
        name: fixText((c.company.name || c.un).trim()), members: [],
      };
      groups.set(mkey, g);
    }
    g.members.push({ art: c.art, a: c.a, anniv: c.anniv, key: c.key });
  }
  for (const [mkey, g] of groups) {
    const prior = month.get(mkey);
    if (!prior) continue;
    const have = new Set(g.members.map((m) => m.art));
    for (const art of prior.arts) {
      if (have.has(art)) continue;
      const a = agg.get(aggKey(g.un, art));
      if (!a || !a.lastPrev) continue;
      g.members.push({ art, a, anniv: anniversary(a), key: erosionKey(g.un, art) });
    }
  }
  return { groups, report };
}

/* ── the ticket ───────────────────────────────────────────────────────── */

export type TicketDraft = {
  mkey: string;
  props: Record<string, string | number>;
  title: string;
  total: number;
  arts: string[];
  keys: string[];
  due: string;
  team: Team;
  owner: string;
  un: string;
  name: string;
  cid: string;
  /** Up to five previous-year order ids, for the associations. */
  orderIds: string[];
};

/** PASS 2: one ticket per company and month, every lapsed article on it. `descs` = catalogue text per article. */
export function draftTicket(g: Group, descs: Record<string, string>): TicketDraft {
  const [pipe, stage] = [PIPE_STAGE[g.team].pipeline, PIPE_STAGE[g.team].stage];
  // Python's sorted() is stable, and so is Array.prototype.sort
  const members = [...g.members].sort((x, y) => y.a.revPrev - x.a.revPrev);
  const n = members.length;
  const total = pyRound(members.reduce((t, m) => t + m.a.revPrev, 0));
  const arts = members.map((m) => m.art);
  const desc = (art: string, m: Member) => (descs[art] ?? m.a.text ?? "").trim();
  const title = n === 1
    ? `EROSION | ${arts[0]} | ${swissInt(total)} EUR | ${g.name}`
    : `EROSION | ${n} articles | ${swissInt(total)} EUR | ${g.name}`;
  const onumsAll = [...new Set(members.flatMap((m) => [...m.a.ordersPrev]))].sort();
  const lastPrev = members.reduce((mx, m) => (m.a.lastPrev > mx ? m.a.lastPrev : mx), "");
  const cntPrev = members.reduce((t, m) => t + m.a.cntPrev, 0);
  const artLines = members.map((m) =>
    `Article:       ${m.art} - ${desc(m.art, m).slice(0, 90)}\n` +
    `${PREV_YEAR} revenue:  ${swissInt(pyRound(m.a.revPrev))} EUR (${m.a.cntPrev} order lines) - last order ${m.a.lastPrev}`);
  const body =
    "EROSION - Win-back\n\n" +
    (n === 1
      ? `The customer bought this article in ${PREV_YEAR} - not (yet) in ${CUR_YEAR}.\n\n`
      : `The customer bought these ${n} articles in ${PREV_YEAR} - not (yet) in ${CUR_YEAR}. One ticket, everything summed.\n\n`) +
    artLines.join("\n\n") + "\n\n" +
    (n > 1 ? `Total at risk: ${swissInt(total)} EUR\n` : "") +
    `Orders ${PREV_YEAR}:  ${onumsAll.join("; ").slice(0, 250)}\n` +
    `Company:       ${g.name} (${g.un})\n` +
    `Team:          ${g.team} (${rosterName(g.owner)})\n\n` +
    "Action: contact the customer, understand why the purchases stopped, offer follow-up or alternative.\n" +
    "Source: Erosion detector (automated, Compass order data)";
  const props: Record<string, string | number> = {
    subject: title,
    content: body,
    hs_pipeline: pipe,
    hs_pipeline_stage: stage,
    hubspot_owner_id: g.owner,
    tags: "erosion",
    erosion_key: members[0].key,
    erosion_amount_2025: total,
    erosion_article: arts.join(", ").slice(0, 250),
    erosion_article_description: n === 1 ? desc(arts[0], members[0]).slice(0, 200) : `${n} articles: ${arts.join(", ")}`.slice(0, 200),
    erosion_last_order_date: lastPrev,
    erosion_company: g.name.slice(0, 200),
    erosion_customer_number: g.un,
    erosion_order_numbers: onumsAll.join("; ").slice(0, 250),
    erosion_order_count: cntPrev,
    source_type: "AUTOMATION",
    hs_ticket_priority: total >= 5000 ? "HIGH" : total >= 1000 ? "MEDIUM" : "LOW",
  };
  const orderIds: string[] = [];
  for (const m of members) for (const oid of m.a.oidsPrev) if (!orderIds.includes(oid)) orderIds.push(oid);
  return {
    mkey: g.mkey, props, title, total, arts, keys: members.map((m) => m.key), due: members[0].anniv,
    team: g.team, owner: g.owner, un: g.un, name: g.name, cid: g.cid, orderIds: orderIds.slice(0, 5),
  };
}

/* ── the forecast ─────────────────────────────────────────────────────── */

export type OutlookItem = {
  due: string; un: string; month: string; company: string; amount: number;
  articles: string[]; article: string; team: string; owner: string;
};

/** The companies the forecast can name at all - same filters as buildOutlook, before any lookup. */
export function outlookCompanies(agg: Map<string, Agg>, today: string, keys: Set<string>): string[] {
  const lim = `${today.slice(0, 4)}-12-31`;
  const uns = new Set<string>();
  for (const [k, a] of agg) {
    const [un, art] = k.split("\u0000");
    if (a.revCur > 0.005 || !a.lastPrev || a.openCur || a.revPrev < countryMinRev(un)) continue;
    const anniv = anniversary(a);
    if (!(today < anniv && anniv <= lim) || keys.has(erosionKey(un, art))) continue;
    uns.add(un);
  }
  return [...uns];
}

/**
 * Upcoming anniversaries not yet ticketed, one entry per company and MONTH, under
 * the same rules as the creator (open order, invoice year, owner floor) - or the
 * calendar would promise tickets that are never raised. To the end of the year.
 */
export function buildOutlook(
  agg: Map<string, Agg>,
  opts: {
    today: string;
    keys: Set<string>;
    companyOf: (un: string) => { name: string; ownerId: string } | null;
    ownerName: (owner: string) => string | undefined;
  },
): { generated: string; days: number; items: OutlookItem[] } {
  const lim = `${opts.today.slice(0, 4)}-12-31`;
  const bucket = new Map<string, OutlookItem>();
  for (const [k, a] of agg) {
    const [un, art] = k.split("\u0000");
    if (a.revCur > 0.005 || !a.lastPrev) continue;
    if (a.openCur) continue;
    if (a.revPrev < countryMinRev(un)) continue;
    const anniv = anniversary(a);
    if (!(opts.today < anniv && anniv <= lim)) continue;
    if (opts.keys.has(erosionKey(un, art))) continue;
    const cp = opts.companyOf(un);
    const owner = (cp?.ownerId ?? "").trim();
    const team = teamOfOwner(owner);
    const omin = OWNER_MIN_REV[owner];
    if (omin && a.revPrev < omin) continue;
    const mk = `${un}|${anniv.slice(0, 7)}`;
    let b = bucket.get(mk);
    if (!b) {
      b = {
        due: anniv, un, month: anniv.slice(0, 7), company: (cp?.name || "") || un, amount: 0, articles: [], article: "",
        team: team ?? "-", owner: ESO_OWNERS[owner] ?? TSA_OWNERS[owner] ?? opts.ownerName(owner) ?? "(no owner)",
      };
      bucket.set(mk, b);
    }
    b.amount += pyRound(a.revPrev);
    b.articles.push(art);
    if (anniv < b.due) b.due = anniv;
  }
  const items = [...bucket.values()].map((b) => ({ ...b, article: b.articles.length === 1 ? b.articles[0] : `${b.articles.length} articles` }));
  items.sort((x, y) => (x.due < y.due ? -1 : x.due > y.due ? 1 : 0));
  const days = Math.round((Date.parse(`${lim}T00:00:00Z`) - Date.parse(`${opts.today}T00:00:00Z`)) / 86_400_000);
  return { generated: opts.today, days, items: items.slice(0, 2500) };
}

/* ── the memory, rebuilt from the tickets ─────────────────────────────── */

export type ExistingTicket = { id: string; un: string; articles: string[]; created: string };

/**
 * The connector keeps its dedup keys and its month map in a state file. The hub
 * rebuilds both from the erosion tickets themselves: every article on a ticket is
 * a key, and the ticket covers its company for the month of its articles'
 * anniversary. `extraKeys` carries the few keys the connector holds that are on
 * no live ticket (manual exclusions, deleted tickets) - imported once at the switch.
 */
export function memoryFromTickets(
  tickets: ExistingTicket[],
  agg: Map<string, Agg>,
  extraKeys: Iterable<string> = [],
): { keys: Set<string>; month: Map<string, { tid: string; arts: string[] }> } {
  const keys = new Set<string>(extraKeys);
  const month = new Map<string, { tid: string; arts: string[] }>();
  for (const t of tickets) {
    for (const art of t.articles) {
      keys.add(erosionKey(t.un, art));
      const a = agg.get(aggKey(t.un, art));
      // the month the ticket covers = the anniversary month of its articles, as the connector keys it
      const mk = `${t.un}|${(a && a.lastPrev ? anniversary(a) : t.created).slice(0, 7)}`;
      const cur = month.get(mk);
      if (!cur) month.set(mk, { tid: t.id, arts: [art] });
      else if (cur.tid === t.id && !cur.arts.includes(art)) cur.arts.push(art);
    }
  }
  return { keys, month };
}
