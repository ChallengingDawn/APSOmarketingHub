// WHAT LEAVES THE HUB FOR THE SANDBOX, FIELD BY FIELD (SARCLA 26.10.2026: "absolutely no real data"; customers "by
// their HubSpot number instead of the real name"; colleagues as Owner <id>; customer money figures by a hidden factor,
// but "all that serves workflow and UC logic should be real"). Pure - the coder (code.ts) applies it, the tests pin it.

import { createHmac } from "node:crypto";
import { targetOf, type Target } from "../sandbox/proxy";

// ---- which sandboxes ---------------------------------------------------------------------------------------------

/** SANDBOX_URLS: the sandbox copies the hub feeds and serves, comma separated - https only (plain http only on this
 *  machine), each as its Railway address plus the path it runs under (/sandbox/run/<name>, the same path on the hub). */
export function sandboxTargets(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => targetOf(s)?.base).filter((b): b is string => !!b))];
}

/** The same list, with each sandbox's name on the hub (/sandbox/run/<slug>) and where it runs. */
export function sandboxTargetList(raw: string | undefined): Target[] {
  const seen = new Set<string>();
  return (raw ?? "").split(",").map((s) => targetOf(s)).filter((t): t is Target => !!t && !seen.has(t.slug) && !!seen.add(t.slug));
}

// ---- money -------------------------------------------------------------------------------------------------------

/** A field whose name says it holds money (or a money-like figure such as a potential). */
const MONEY = /(revenue|amount|turnover|umsatz|price|margin|cost|subtotal|potential|net_sales|sales_value|_chf$|_eur$)/i;
/** ...unless the name says it is a count, a key, a band or a label. */
const NOT_MONEY = /(count|qty|quantity|_key$|bucket|source|confidence|_id$|currency|_label$|_status$)/i;

// The money the rule engines read - workflow and UC logic stays REAL, so a sandbox run decides as the hub does.
// Taken from the engines' code (src/lib/{boDistribution,ticketValue,segmentation,erosion,ticketDuplicates,
// companyDomain,mapAssign,lifecycle,datatracker,...}); tests/sandbox-feed.test.ts fails when an engine reads a money
// field that is on neither side, so the decision is made, not drifted into. The connector steps are NOT engines:
// they carry ERP figures into HubSpot, they decide nothing - their figures are the customer figures the factor hides.
export const LOGIC_FIELDS: ReadonlySet<string> = new Set([
  "art_price__m100__listed_price", "art_price__m110__listed_price", "customer_value_segmentation",
  "enquiry_sub_category___price_1", "enquiry_textbox___price", "erosion_amount_2025", "max_pot_or_turnover",
  "max_revenue_2015_2026", "max_revenue_bucket", "metric_value", "no_revenue", "order_total_net_revenue",
  "order_total_orders", "potential", "potential_created_sum", "potential_lost_sum", "potential_won_sum", "price",
  "price_check_articles", "price_check_key", "pricecheck", "revalue", "sales_potential_confidence",
  "sales_potential_estimate", "sales_potential_source", "sarcla_order_n_with_minus_margin_pm", "sarcla_pm_minusmargin",
  "target_price", "text_qty_price", "total", "uc15_revenue", "uc2_revenue", "uc9_revenue", "value",
  "yearly_customer_potential",
]);
const LOGIC_PATTERNS = [/^revenue_\d{4}$/i, /^order_potential_/i, /^margin__/i, /^art_price__/i, /^erosion_amount_\d{4}$/i];

export function isLogicField(name: string): boolean {
  const n = name.toLowerCase();
  return LOGIC_FIELDS.has(n) || LOGIC_PATTERNS.some((p) => p.test(n));
}

/** Money the factor hides: a money name, not a count or key, and not read by the logic. */
export function isHiddenMoney(name: string): boolean {
  return MONEY.test(name) && !NOT_MONEY.test(name) && !isLogicField(name);
}

/** One factor per hub, from its link key - never shown, never 1, the same on every round so pages agree. */
export function moneyFactor(linkKey: string): number {
  const u = createHmac("sha256", linkKey).update("sandbox money factor").digest().readUInt32BE(0);
  let f = 0.62 + (u % 760) / 1000;                       // 0.620 .. 1.379
  if (f >= 0.95 && f <= 1.05) f += 0.12;                 // never close enough to 1 to read through
  return Math.round(f * 10_000) / 10_000;
}

/** A figure times the factor, kept in its own form: a number stays a number, "1250.50" stays a 2-decimal string. */
export function scaleMoney(v: unknown, factor: number): unknown {
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = decimals(String(v));
    return round(v * factor, d);
  }
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) {
    const d = decimals(v.trim());
    return round(Number(v) * factor, d).toFixed(d);
  }
  return v;
}
const decimals = (s: string) => (s.includes(".") ? s.split(".")[1].length : 0);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

// ---- people, companies and their words -------------------------------------------------------------------------

export type FieldKind = "email" | "phone" | "address" | "domain" | "social" | "name" | "text" | "keep";

const EMAIL = /e-?mail/i;
const PHONE = /(phone|mobile|fax|telephone|^tel$|_tel$)/i;
const ADDRESS = /^(address\d?|address_?line_?\d?|street\d?|strasse|street_address|hs_.*address.*|.*_street)$/i;
const DOMAIN = /^(domain|website|hs_domain|hs_additional_domains|url|homepage|web_?site|company_?domain)$/i;
const SOCIAL = /(linkedin|twitter|facebook|instagram|xing|^ip$|_ip$|ip_address|^hs_ip)/i;
const NAME = /^(name|first_?name|last_?name|full_?name|display_?name|salutation|job_?title|user_?name|company|company_?name|customer_?name|contact_?name|owner_?name|person|buyer|recipient|sender|from_name|to_name|created_by_name|dealname)$/i;
/** A *name* field that names a thing of the hub's own (a stage, a team, a property), not a person or a customer. */
const THING_NAME = /(pipeline|stage|property|object|team|label|type|source|file|campaign|workflow|flow|list|app|product|article|group|category|role|step|job|table|column|step|schema|field|template|queue)/i;
const PERSONISH_NAME = /(name|person|buyer|recipient|sender)/i;
const TEXT = /(subject|content|description|body|note|comment|message|text|summary|feedback|transcript|question|answer|html|preview|reason|title|keywords|remark|bemerkung|anmerkung)/i;

/** What a field holds, by its name - the coder decides what to do with the value. */
export function fieldKind(name: string): FieldKind {
  if (EMAIL.test(name)) return "email";
  if (PHONE.test(name)) return "phone";
  if (ADDRESS.test(name)) return "address";
  if (DOMAIN.test(name)) return "domain";
  if (SOCIAL.test(name)) return "social";
  if (NAME.test(name)) return "name";
  if (PERSONISH_NAME.test(name) && !THING_NAME.test(name)) return "name";
  if (TEXT.test(name)) return "text";
  return "keep";
}

// Mail providers anyone uses: not a customer's own domain, kept so the domain rules (private/micro) still work.
export const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.ch", "live.com", "msn.com", "yahoo.com",
  "yahoo.de", "icloud.com", "me.com", "gmx.ch", "gmx.de", "gmx.net", "gmx.at", "web.de", "t-online.de", "bluewin.ch",
  "sunrise.ch", "hispeed.ch", "swissonline.ch", "proton.me", "protonmail.com", "orange.fr", "free.fr", "wanadoo.fr",
  "libero.it", "aol.com",
]);

/** A short, stable code for a real value - the same value gives the same code on every round, nothing else. */
export function codeOf(salt: string, value: string, len = 6): string {
  return createHmac("sha256", salt).update(value.trim().toLowerCase()).digest("hex").slice(0, len);
}

// Placeholder words of a realistic length for the layout; none of them can be a customer.
const LOREM = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod",
  "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis",
  "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat"];

/** Placeholder text about as long as the original (capped), the same for the same original. */
export function placeholderText(salt: string, original: string): string {
  const target = Math.max(4, Math.min(original.length, 600));
  let seed = parseInt(codeOf(salt, original, 8), 16);
  const words: string[] = [];
  let len = 0;
  while (len < target) {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    const w = LOREM[seed % LOREM.length];
    words.push(w);
    len += w.length + 1;
  }
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1, target);
}

// Words a real name may share with the coded output without being a leak: our own placeholders, legal forms,
// country words. A real name's other words of 6+ letters are checked on their own too ("Zimtstern" of "Zimtstern AG");
// shorter ones are too likely to meet a stage or an industry by chance and refuse a whole answer for nothing.
export const LEAK_STOPWORDS: ReadonlySet<string> = new Set([
  ...LOREM, "company", "contact", "owner", "example", "invalid", "person", "customer", "kunde", "firma", "gmbh",
  "group", "gruppe", "holding", "schweiz", "suisse", "svizzera", "switzerland", "deutschland", "germany", "france",
  "austria", "italia", "international", "services", "service", "technik", "technology", "technologies", "systems",
  "solutions", "industrie", "industries", "trading", "handel", "engineering", "products", "produkte", "zurich",
  "zuerich", "basel", "berne", "geneva", "geneve", "lausanne", "lucerne", "luzern", "winterthur", "sankt", "gallen",
]);

/** The strings a leak check looks for: the whole value, and its own longer words. */
export function leakNeedles(original: string): string[] {
  const v = original.trim().toLowerCase();
  if (v.length < 4 || /^\d+$/.test(v)) return [];
  const out = new Set<string>([v]);
  for (const w of v.split(/[^a-z0-9äöüéèàç]+/i)) if (w.length >= 6 && !LEAK_STOPWORDS.has(w) && !/^\d+$/.test(w)) out.add(w);
  return [...out];
}
