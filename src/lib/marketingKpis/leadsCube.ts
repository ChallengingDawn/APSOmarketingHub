// LEAD GENERATION - the rules, with no HubSpot in them (the read is leads.ts). SARCLA 18.10.2026:
// "I really want to understand the lead path from acquisition to purchase"; a lead is a NEW CONTACT
// ON A NEW COMPANY; every breakdown its own tab. The path, per new company:
//   acquired      its first new contact, by where that contact came from (SEA Google / Microsoft,
//                 SEO, AI assistants, direct, shop registration, email, chat, created by sales…)
//   came in by    how its first new contact was made: a shop registration, added by a person (sales,
//                 service), the chat, a website form, an import - SARCLA 18.10 "not even a task?": UC2
//                 only picks up registrations, so the people's own contacts never get its task
//   to sales      the company sent to ESO after it came in: a UC2 qualification TASK (until
//                 1 October 2026) or an ESO/TSA ticket (UC2 tickets since) - SARCLA 18.10: "are you
//                 also checking the tasks before as tickets?" (only tickets were counted at first)
//   qualified     the owner's qualification on the company: yes / no / not yet
//   new customer  its first order; "on its own" when no ESO/TSA ticket came before that order
//   orders        how many, and the revenue of the years shown
// Counted per company, so three new people at one company are one lead company (and three contacts).

export type LeadRow = {
  /** the month the company came in, "2026-09" */
  m: string;
  /** where its first new contact came from (CHANNELS) */
  c: string;
  /** how its first new contact was made (HOWS) */
  h: string;
  /** country, as HubSpot has it on the company */
  k: string;
  /** the company's owner (HubSpot owner id) */
  o: string;
  /** new contacts on it in the month it came in */
  n: number;
  /** qualified by the owner: 1 yes, 0 no, null not yet */
  q: 1 | 0 | null;
  /** the owner's answer as written ("Yes - registered by ESO", "No"…), when there is one */
  qv?: string;
  /** if not qualified: the disqualification reason given */
  dr?: string;
  /** if qualified and no order: the reason given */
  np?: string;
  /** sent to sales after it came in: a UC2 qualification task or an ESO/TSA ticket */
  s: boolean;
  /** how it reached sales first: the UC2 task (until 1 Oct 2026) or a ticket; null when it did not */
  via: "task" | "ticket" | null;
  /** its UC2 qualification task was done */
  td: boolean;
  /** the month of its first order, or null */
  f: string | null;
  /** bought before any UC2 task or ESO/TSA ticket - on its own */
  a: boolean;
  /** its orders, all time (a new company: since it came in) */
  orders: number;
  /** its revenue in EUR, the years read */
  rev: number;
};

export type LeadsData = {
  rows: LeadRow[];
  /** owner id -> name */
  owners: Record<string, string>;
  year: number;
  /** completed months of this year */
  monthsDone: number;
  /** new contacts that month on any company / with none, for the context line */
  contacts: Record<string, { all: number; onNew: number; noCompany: number }>;
  readAt: string;
  errors: Record<string, string>;
  /** what the read carries (LEADS_SHAPE): an older answer is shown while a new one is read */
  shape?: number;
};
/** 4: owners who left HubSpot by name; 5: no "shop registration" source; 6: the owners' answers and reasons (all 19.10) */
export const LEADS_SHAPE = 6;

/** The channels, in the order the page lists them. */
export const CHANNELS: { id: string; label: string; group: "paid" | "organic" | "direct" | "people" | "other" }[] = [
  { id: "sea-google", label: "SEA - Google Ads", group: "paid" },
  { id: "sea-microsoft", label: "SEA - Microsoft Ads", group: "paid" },
  { id: "seo", label: "SEO - organic search", group: "organic" },
  { id: "ai", label: "AI assistants", group: "organic" },
  { id: "direct", label: "Direct (typed in, bookmarks)", group: "direct" },
  { id: "email", label: "Email", group: "organic" },
  { id: "social", label: "Social media", group: "organic" },
  { id: "referral", label: "Other websites", group: "organic" },
  { id: "chat", label: "Chat", group: "people" },
  { id: "sales", label: "Created by people (sales, service)", group: "people" },
  { id: "import", label: "Imports and integrations", group: "people" },
  { id: "other", label: "Other / unknown", group: "other" },
];
export const channelLabel = (id: string) => CHANNELS.find((c) => c.id === id)?.label ?? id;

/** How the first contact was made, in the order the page lists them. */
export const HOWS: { id: string; label: string }[] = [
  { id: "shop", label: "Shop registration" },
  { id: "person", label: "Added by sales or service" },
  { id: "chat", label: "Chat and APSOassistant" },
  { id: "web", label: "Website form" },
  { id: "other", label: "Import or other" },
];
export const howLabel = (id: string) => HOWS.find((h) => h.id === id)?.label ?? id;

/** How a contact was made: HubSpot's record source (hs_object_source) and its first detail. */
export function howOf(source: string | null | undefined, detail: string | null | undefined): string {
  const s = (source ?? "").toUpperCase();
  const d = (detail ?? "").toLowerCase();
  if (/magento/.test(d)) return "shop";
  if (/apsoassistant/.test(d)) return "chat";
  switch (s) {
    case "CRM_UI": case "MOBILE_IOS": case "MOBILE_ANDROID": case "EXTENSION": case "BCC_TO_CRM": case "EMAIL_INTEGRATION": case "SALES": return "person";
    case "CONVERSATIONS": case "CONVERSATIONAL_ENRICHMENT": case "CHATSPOT": return "chat";
    case "FORM": return /visit/.test(d) ? "person" : "web";
    case "ANALYTICS": return "web";
    default: return "other";
  }
}

/** Where a contact came from: HubSpot's original source and its two details. */
export function channelOf(source: string | null | undefined, d1: string | null | undefined, d2: string | null | undefined): string {
  const s = (source ?? "").toUpperCase();
  const a = `${d1 ?? ""} ${d2 ?? ""}`.toLowerCase();
  switch (s) {
    case "PAID_SEARCH": return /bing|microsoft|msn/.test(a) ? "sea-microsoft" : "sea-google";
    case "ORGANIC_SEARCH": return "seo";
    case "AI_REFERRALS": return "ai";
    // a shop registration is a step on the way, not where they came from (SARCLA 19.10): the
    // registration page they landed on directly counts as direct, as any other direct visit
    case "DIRECT_TRAFFIC": return "direct";
    case "EMAIL_MARKETING": return "email";
    case "SOCIAL_MEDIA": case "PAID_SOCIAL": return "social";
    case "REFERRALS": return "referral";
    case "OFFLINE": {
      if (/conversation|chatspot|chat/.test(a)) return "chat";
      if (/import|integration|api|extension/.test(a)) return "import";
      return "sales";
    }
    case "OTHER_CAMPAIGNS": return "other";
    default: return "other";
  }
}

/** The owner's qualification as yes / no / not yet ("Yes - registered by ESO" is a yes). */
export function qualOf(v: string | null | undefined): 1 | 0 | null {
  const t = (v ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith("yes")) return 1;
  if (t.startsWith("no")) return 0;
  return null;
}

/** A month window of a year: "2026-01".."2026-09" for { start: 0, end: 8 }. */
export const ym = (year: number, m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;
export const inWin = (m: string, year: number, w: { start: number; end: number }) => m >= ym(year, w.start) && m <= ym(year, w.end);

export type LeadFilters = { channel?: string[]; country?: string[]; owner?: string[]; how?: string[] };
export function keep(r: LeadRow, f: LeadFilters): boolean {
  return (!f.channel?.length || f.channel.includes(r.c)) && (!f.country?.length || f.country.includes(r.k)) && (!f.owner?.length || f.owner.includes(r.o)) && (!f.how?.length || f.how.includes(r.h));
}

export type PathCounts = { companies: number; contacts: number; toSales: number; viaTask: number; viaTicket: number; qualified: number; notQualified: number; notYet: number; taskDoneNoAnswer: number; customers: number; onOwn: number; orders: number; rev: number };
export const emptyPath = (): PathCounts => ({ companies: 0, contacts: 0, toSales: 0, viaTask: 0, viaTicket: 0, qualified: 0, notQualified: 0, notYet: 0, taskDoneNoAnswer: 0, customers: 0, onOwn: 0, orders: 0, rev: 0 });

export function add(p: PathCounts, r: LeadRow): PathCounts {
  p.companies += 1; p.contacts += r.n;
  if (r.s) p.toSales += 1;
  if (r.via === "task") p.viaTask += 1; else if (r.via === "ticket") p.viaTicket += 1;
  if (r.q === 1) p.qualified += 1; else if (r.q === 0) p.notQualified += 1; else { p.notYet += 1; if (r.td) p.taskDoneNoAnswer += 1; }
  if (r.f) { p.customers += 1; if (r.a) p.onOwn += 1; p.orders += r.orders; p.rev += r.rev; }
  return p;
}

/** The path of the months chosen this year, and of the same months a year earlier. */
export function pathOf(d: LeadsData, w: { start: number; end: number }, f: LeadFilters): { cur: PathCounts; prev: PathCounts } {
  const cur = emptyPath(), prev = emptyPath();
  for (const r of d.rows) {
    if (!keep(r, f)) continue;
    if (inWin(r.m, d.year, w)) add(cur, r);
    else if (inWin(r.m, d.year - 1, w)) add(prev, r);
  }
  return { cur, prev };
}

/** The path broken down by a key (channel, country, owner, month of the year): this year and last. */
export function pathBy(d: LeadsData, w: { start: number; end: number }, f: LeadFilters, keyOf: (r: LeadRow) => string): Map<string, { cur: PathCounts; prev: PathCounts }> {
  const out = new Map<string, { cur: PathCounts; prev: PathCounts }>();
  for (const r of d.rows) {
    if (!keep(r, f)) continue;
    const isCur = inWin(r.m, d.year, w), isPrev = inWin(r.m, d.year - 1, w);
    if (!isCur && !isPrev) continue;
    const k = keyOf(r);
    const e = out.get(k) ?? { cur: emptyPath(), prev: emptyPath() };
    add(isCur ? e.cur : e.prev, r);
    out.set(k, e);
  }
  return out;
}

/* ── the flow diagram ─────────────────────────────────────────────────── */

export type FlowStep = "all" | "how" | "source" | "contact" | "qualification" | "outcome";
export type FlowNode = { id: string; step: FlowStep; label: string; tone: "source" | "sales" | "good" | "own" | "bad" | "none" };
export type Flow = { steps: FlowStep[]; nodes: FlowNode[]; links: { from: string; to: string; value: number }[]; totals: Record<string, number> };

/** Where a lead stands at each step - the node it passes through. */
function nodeOf(r: LeadRow, step: FlowStep, sources: Set<string>): FlowNode {
  switch (step) {
    case "all":
      return { id: "all", step, label: "New leads", tone: "source" };
    case "how":
      return { id: `how:${r.h}`, step, label: howLabel(r.h), tone: "source" };
    case "source": {
      const c = sources.has(r.c) ? r.c : "rest";
      return { id: `source:${c}`, step, label: c === "rest" ? "Other sources" : channelLabel(c), tone: "source" };
    }
    case "contact":
      // the UC2 task was replaced by the ticket and the outcome is the same - one way, not two
      // (SARCLA 19.10: "don't split them, just qualified or not qualified")
      return r.via ? { id: "contact:sales", step, label: "Sent to sales for qualification", tone: "sales" }
        : { id: "contact:none", step, label: "No sales contact", tone: "none" };
    case "qualification":
      return r.q === 1 ? { id: "q:yes", step, label: "Qualified", tone: "good" } : r.q === 0 ? { id: "q:no", step, label: "Not qualified", tone: "bad" } : { id: "q:open", step, label: "Not qualified yet", tone: "none" };
    case "outcome":
      // the ones who bought before any task or ticket apart (SARCLA 19.10: the diagram showed no new
      // customer without a sales touch - they were there, mixed in)
      return !r.f ? { id: "o:none", step, label: "No order yet", tone: "none" }
        : r.a ? { id: "o:own", step, label: "Bought on their own", tone: "own" }
          : { id: "o:sales", step, label: "Bought after a sales contact", tone: "good" };
  }
}

/**
 * The leads of the months chosen as a flow through the steps given (SARCLA 18.10: "a diagram where
 * they split the number") - the biggest sources by name, the rest together.
 */
export function flowOf(d: LeadsData, w: { start: number; end: number }, f: LeadFilters, steps: FlowStep[], topSources = 6): Flow {
  const rows = d.rows.filter((r) => keep(r, f) && inWin(r.m, d.year, w));
  const bySource = new Map<string, number>();
  for (const r of rows) bySource.set(r.c, (bySource.get(r.c) ?? 0) + 1);
  const sources = new Set([...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, topSources).map(([c]) => c));
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, { from: string; to: string; value: number }>();
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const path = steps.map((s) => nodeOf(r, s, sources));
    for (const n of path) { nodes.set(n.id, n); totals[n.id] = (totals[n.id] ?? 0) + 1; }
    for (let i = 0; i + 1 < path.length; i++) {
      const k = `${path[i].id}>${path[i + 1].id}`;
      const l = links.get(k) ?? { from: path[i].id, to: path[i + 1].id, value: 0 };
      l.value += 1;
      links.set(k, l);
    }
  }
  // top to bottom: the biggest source first and the rest last, then the good way before the others
  const rank = (n: FlowNode) => (n.step === "source" ? (n.id === "source:rest" ? 1e9 : -(totals[n.id] ?? 0)) : ORDER.indexOf(n.id));
  const out = [...nodes.values()].sort((a, b) => steps.indexOf(a.step) - steps.indexOf(b.step) || rank(a) - rank(b));
  return { steps, nodes: out, links: [...links.values()], totals };
}
const ORDER = ["all", ...HOWS.map((h) => `how:${h.id}`), "contact:sales", "contact:none", "q:yes", "q:no", "q:open", "o:sales", "o:own", "o:none"];

/** What became of a lead so far - one answer each, for the months chart. */
export type Outcome = "customer" | "qualified" | "notQualified" | "open";
export const outcomeOf = (r: LeadRow): Outcome => (r.f ? "customer" : r.q === 1 ? "qualified" : r.q === 0 ? "notQualified" : "open");

/* ── month by month, for the small graphs ─────────────────────────────── */

/** Several months' paths as one (the months of a window). */
export function sumPaths(ps: PathCounts[]): PathCounts {
  const out = emptyPath();
  for (const p of ps) for (const k of Object.keys(out) as (keyof PathCounts)[]) out[k] += p[k];
  return out;
}

/** The rows picked month by month, this year and last - one path per month (a tile's small graph). */
export function monthly(d: LeadsData, f: LeadFilters, pick: (r: LeadRow) => boolean = () => true): { cy: PathCounts[]; py: PathCounts[] } {
  const cy = Array.from({ length: 12 }, emptyPath), py = Array.from({ length: 12 }, emptyPath);
  for (const r of d.rows) {
    if (!keep(r, f) || !pick(r)) continue;
    const y = Number(r.m.slice(0, 4)), m = Number(r.m.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    if (y === d.year) add(cy[m], r);
    else if (y === d.year - 1) add(py[m], r);
  }
  return { cy, py };
}

/* ── what the owners answered (SARCLA 19.10: "we have multiple answers, not only qualified and not") ── */

export type Answers = {
  /** the owner's answer as written, and "Not answered yet" */
  answers: Map<string, number>;
  /** the disqualification reasons of the leads not qualified ("No reason given" when empty) */
  why: Map<string, number>;
  /** the reasons the qualified leads with no order give ("No reason given" when empty) */
  noOrder: Map<string, number>;
  leads: number;
};

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** The leads of the months chosen by the owner's answer, and the reasons behind a no and behind no order. */
export function answersOf(d: LeadsData, w: { start: number; end: number }, f: LeadFilters): Answers {
  const out: Answers = { answers: new Map(), why: new Map(), noOrder: new Map(), leads: 0 };
  for (const r of d.rows) {
    if (!keep(r, f) || !inWin(r.m, d.year, w)) continue;
    out.leads += 1;
    bump(out.answers, r.q == null ? "Not answered yet" : r.qv?.trim() || (r.q === 1 ? "Yes" : "No"));
    // a reason field can hold several reasons ("No product demand;Others"): each one counts
    const each = (v: string | undefined) => (v ?? "").split(";").map((x) => x.trim()).filter(Boolean);
    if (r.q === 0) { const w = each(r.dr); if (w.length) for (const x of w) bump(out.why, x); else bump(out.why, "No reason given"); }
    if (r.q === 1 && !r.f) { const w = each(r.np); if (w.length) for (const x of w) bump(out.noOrder, x); else bump(out.noOrder, "No reason given"); }
  }
  return out;
}
