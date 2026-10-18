// LEAD GENERATION - the rules, with no HubSpot in them (the read is leads.ts). SARCLA 18.10.2026:
// "I really want to understand the lead path from acquisition to purchase"; a lead is a NEW CONTACT
// ON A NEW COMPANY; every breakdown its own tab. The path, per new company:
//   acquired      its first new contact, by where that contact came from (SEA Google / Microsoft,
//                 SEO, AI assistants, direct, shop registration, email, chat, created by sales…)
//   to sales      an ESO or TSA ticket on the company after it came in
//   qualified     the owner's qualification on the company: yes / no / not yet
//   new customer  its first order; "on its own" when no ESO/TSA ticket came before that order
//   orders        how many, and the revenue of the years shown
// Counted per company, so three new people at one company are one lead company (and three contacts).

export type LeadRow = {
  /** the month the company came in, "2026-09" */
  m: string;
  /** where its first new contact came from (CHANNELS) */
  c: string;
  /** country, as HubSpot has it on the company */
  k: string;
  /** the company's owner (HubSpot owner id) */
  o: string;
  /** new contacts on it in the month it came in */
  n: number;
  /** qualified by the owner: 1 yes, 0 no, null not yet */
  q: 1 | 0 | null;
  /** an ESO or TSA ticket after it came in */
  s: boolean;
  /** the month of its first order, or null */
  f: string | null;
  /** bought before any ESO/TSA ticket - on its own */
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
};

/** The channels, in the order the page lists them. */
export const CHANNELS: { id: string; label: string; group: "paid" | "organic" | "direct" | "people" | "other" }[] = [
  { id: "sea-google", label: "SEA - Google Ads", group: "paid" },
  { id: "sea-microsoft", label: "SEA - Microsoft Ads", group: "paid" },
  { id: "seo", label: "SEO - organic search", group: "organic" },
  { id: "ai", label: "AI assistants", group: "organic" },
  { id: "shop", label: "Shop registration", group: "direct" },
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

/** Where a contact came from: HubSpot's original source and its two details. */
export function channelOf(source: string | null | undefined, d1: string | null | undefined, d2: string | null | undefined): string {
  const s = (source ?? "").toUpperCase();
  const a = `${d1 ?? ""} ${d2 ?? ""}`.toLowerCase();
  switch (s) {
    case "PAID_SEARCH": return /bing|microsoft|msn/.test(a) ? "sea-microsoft" : "sea-google";
    case "ORGANIC_SEARCH": return "seo";
    case "AI_REFERRALS": return "ai";
    case "DIRECT_TRAFFIC": return /customer\/account\/create|\/register/.test(a) ? "shop" : "direct";
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

export type LeadFilters = { channel?: string[]; country?: string[]; owner?: string[] };
export function keep(r: LeadRow, f: LeadFilters): boolean {
  return (!f.channel?.length || f.channel.includes(r.c)) && (!f.country?.length || f.country.includes(r.k)) && (!f.owner?.length || f.owner.includes(r.o));
}

export type PathCounts = { companies: number; contacts: number; toSales: number; qualified: number; notQualified: number; notYet: number; customers: number; onOwn: number; orders: number; rev: number };
export const emptyPath = (): PathCounts => ({ companies: 0, contacts: 0, toSales: 0, qualified: 0, notQualified: 0, notYet: 0, customers: 0, onOwn: 0, orders: 0, rev: 0 });

export function add(p: PathCounts, r: LeadRow): PathCounts {
  p.companies += 1; p.contacts += r.n;
  if (r.s) p.toSales += 1;
  if (r.q === 1) p.qualified += 1; else if (r.q === 0) p.notQualified += 1; else p.notYet += 1;
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
