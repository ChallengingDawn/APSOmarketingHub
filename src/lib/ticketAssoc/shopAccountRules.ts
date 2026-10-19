// SHOP ACCOUNTS WITHOUT A COMPANY - the pure part (the read and the link are in shopAccounts.ts).
// A contact with a shop customer id and no company in HubSpot: its logins, views and orders count
// for no company, so no report sees it as a known customer (SARCLA 18.10: "companies that are not
// company that we can fix"; fixed in Ticket/order/article associations > Contacts without a
// company - "build it inside the existing app, a separate contact tab ... straightforward").

/** Free e-mail providers: such an address names no company. */
export const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|gmx|web|bluewin|icloud|me|mac|aol|libero|t-online|freenet|orange|free|wanadoo|sunrise|hispeed|proton|protonmail|pm|mail|email|yandex|wp|o2|onet|interia|op|alice|tiscali|virgilio|laposte|sfr|msn|ziggo|kpnmail|home|posteo|seznam|tutanota|zoho|gmx-topmail|vodafone|arcor|telenet|skynet|fastwebnet|inwind|tin|aruba|pec|bigpond)\./i;
/** A+P's own people: their test accounts are not customers to fix. */
export const INTERNAL = /(^|\.)(apsoparts|angst-pfister|angstpfister)\.[a-z.]+$/i;

export type Candidate = {
  id: string; name: string; country: string;
  /** how many of the contact's orders are booked on this company (the ERP's customer) - the strongest sign */
  orders?: number;
};

export type UnlinkedRow = {
  /** the HubSpot contact */
  id: string;
  /** the company name the person typed in the shop */
  company: string;
  domain: string;
  country: string;
  created: string;
  /** "match" a company to link (their orders' or their e-mail domain's); "business" no company yet; "free" a free e-mail address */
  kind: "match" | "business" | "free";
  /** the companies to offer: their orders' first, then the e-mail domain's, the likeliest first */
  candidates: Candidate[];
  /** the likeliest candidate, and how many more companies share the domain */
  match: { id: string; name: string; more: number } | null;
  /** the contact's orders are all booked on ONE company - linked in one go with "Link all" */
  byOrder: boolean;
};
export type Unlinked = {
  /** every shop account without a company, A+P's own staff left out */
  total: number;
  internal: number;
  matched: number;
  /** of them, whose orders are booked on a company */
  withOrders: number;
  business: number;
  free: number;
  createdThisYear: number;
  seenThisYear: number;
  /** the accounts to fix: a matching company first, then the newest */
  rows: UnlinkedRow[];
};

export const kindOf = (domain: string, hasCompany: boolean): UnlinkedRow["kind"] =>
  hasCompany ? "match" : !domain || FREE_MAIL.test(domain) ? "free" : "business";

/** A company name's words, without legal forms and punctuation: "CIR Comptoir Industriel Régional SAS" -> cir comptoir industriel regional. */
export function nameWords(name: string): string[] {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter((w) => w && !/^(ag|gmbh|sa|sas|sarl|srl|spa|s|p|a|kg|co|ltd|limited|inc|bv|nv|sp|z|o|oo|llc|plc|und|and|et|the|de|der|die|la|le|cie)$/.test(w));
}

/**
 * The companies on a domain in the order to offer them: the one whose name shares most words with
 * the company the person typed first (CERN has 8 companies on cern.ch); ties keep HubSpot's order.
 */
export function rankCandidates(typed: string, list: Candidate[]): Candidate[] {
  const t = new Set(nameWords(typed));
  if (!t.size) return list;
  const score = (c: Candidate) => { const w = nameWords(c.name); return w.length ? w.filter((x) => t.has(x)).length / Math.max(w.length, t.size) : 0; };
  return list.map((c, i) => ({ c, i, s: score(c) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c);
}

/**
 * The companies to offer: the ones the contact's orders are booked on first (most orders first -
 * SARCLA 19.10: "if they have an order we can also link easily"), then those on its e-mail domain,
 * each once.
 */
export function withOrderCompanies(fromOrders: Candidate[], fromDomain: Candidate[]): Candidate[] {
  const byOrders = [...fromOrders].sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0));
  const seen = new Set(byOrders.map((c) => c.id));
  return [...byOrders, ...fromDomain.filter((c) => !seen.has(c.id))];
}
