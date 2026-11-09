// APSOconvert > Journeys > Visits - WHAT TO DO NEXT, read by the AI from the visits (./visits.ts) at a person's click,
// kept per customer and period (apsomh_convert_visit_reads) so it is paid for once and says who asked and when.
//
//   one customer   their visits step by step (contacts as letters, never names) and the pages they stopped at with the
//                  other customers' numbers there -> a headline, 2-4 next actions for Sales or Marketing, and up to 3
//                  shop pages to change (each one of the given pages, so "Find optimizations" opens it)
//   the period     every customer of the list (ids, segment, country - no names) and the pages where most stopped ->
//                  a headline, 3-5 findings with their pages, the customers to call first (ids from the list)
//
// Grounding: only the numbers given; no price, discount, stock, delivery time, certificate or promise is made up.

import { getPool, query } from "@/lib/db/client";
import { SHOP_FACTS, ask, type AiResult } from "./studio";
import { customerVisits, listVisitors } from "./visits";
import { REACH_LABEL, REACHES, stopWords, visitLine, zurichTime } from "./visitRules";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_convert_visit_reads (
  scope text NOT NULL,
  key text NOT NULL,
  win text NOT NULL,
  data jsonb NOT NULL,
  by_whom text,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key, win)
);`;
let ready: Promise<void> | null = null;
function ensure(): Promise<void> {
  ready ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

export type NextAction = { who: "Sales" | "Marketing"; action: string; why: string };
export type ShopFix = { path: string; why: string; try: string };
/** `letters`: which contact each letter the AI wrote stands for (the AI never sees a name - the page puts them back). */
export type CustomerReading = { headline: string; next: NextAction[]; shop: ShopFix[]; letters: Record<string, string>; visits: number; at: string; by: string | null };
export type Finding = { title: string; why: string; action: string; paths: string[] };
export type CallFirst = { id: string; why: string };
export type PeriodReading = { headline: string; findings: Finding[]; call: CallFirst[]; customers: number; at: string; by: string | null };

const win = (from: string, to: string) => `${from}..${to}`;

async function kept<T>(scope: "customer" | "period", key: string, from: string, to: string): Promise<T | null> {
  await ensure();
  const r = await query<{ data: T; by_whom: string | null; at: Date }>(
    `SELECT data, by_whom, at FROM apsomh_convert_visit_reads WHERE scope = $1 AND key = $2 AND win = $3`, [scope, key, win(from, to)]);
  const x = r.rows[0];
  return x ? { ...x.data, by: x.by_whom, at: new Date(x.at).toISOString() } : null;
}

async function keep(scope: "customer" | "period", key: string, from: string, to: string, data: unknown, by: string): Promise<void> {
  await query(
    `INSERT INTO apsomh_convert_visit_reads (scope, key, win, data, by_whom) VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (scope, key, win) DO UPDATE SET data = EXCLUDED.data, by_whom = EXCLUDED.by_whom, at = now()`,
    [scope, key, win(from, to), JSON.stringify(data), by],
  );
}

export const getCustomerReading = (id: string, from: string, to: string) => kept<CustomerReading>("customer", id, from, to);
export const getPeriodReading = (from: string, to: string) => kept<PeriodReading>("period", "", from, to);

const RULES = `Hard rules:
- Use ONLY the facts and numbers given here. NEVER invent prices, discounts, stock, delivery times, certificates,
  approvals (FDA, KTW, ...), test results, names or quotes, and promise the customer nothing.
- If an action needs a fact that is not given, say what to check ("check the stock of ...") instead of assuming it.
- Contacts are letters (A, B...) and customers are ids - keep them so; never guess who they are.
- Plain, concrete English, short sentences, no slogans, no exclamation marks.`;

/** What the shop's steps mean - read wrongly, "checked a price" became a request waiting for an answer. */
const MEANING = `What the steps mean:
- "Checked the price for N": the customer typed the quantity N on the shop and the shop showed the price AT ONCE. Nothing
  waits for an answer from Angst+Pfister - it is a customer who saw the price and did not buy (yet).
- "below the minimum of M": the quantity typed is under the article's minimum order. "not enough in stock": the stock
  does not cover the quantity typed. "Put N in the cart": in the shop's cart, not ordered. "Ordered N": bought.
- A page path is the product's page in ONE store view (de-CH when the customer's own is not known): it does not tell
  the customer's store view, language or country - only the CUSTOMER line does.`;

const s = (x: unknown, max: number) => String(x ?? "").trim().slice(0, max);

/* ── one customer ─────────────────────────────────────────────────────── */

const CUSTOMER_SCHEMA = {
  type: "object", additionalProperties: false, required: ["headline", "next", "shop"],
  properties: {
    headline: { type: "string", description: "What this customer's visits show, one plain sentence with the main number" },
    next: {
      type: "array", description: "2 to 4 next actions, the most useful first",
      items: {
        type: "object", additionalProperties: false, required: ["who", "action", "why"],
        properties: {
          who: { type: "string", enum: ["Sales", "Marketing"] },
          action: { type: "string", description: "What to do, concretely, under 16 words" },
          why: { type: "string", description: "The visits' facts behind it: the article, the quantity, the step, the date - one sentence" },
        },
      },
    },
    shop: {
      type: "array", description: "Up to 3 shop pages from the list where customers like this one get stuck",
      items: {
        type: "object", additionalProperties: false, required: ["path", "why", "try"],
        properties: {
          path: { type: "string", description: "The page's path exactly as in the list" },
          why: { type: "string", description: "What happens there, with the numbers - one sentence" },
          try: { type: "string", description: "What to try on that page - one sentence" },
        },
      },
    },
  },
};

export async function makeCustomerReading(id: string, from: string, to: string, by: string): Promise<AiResult<CustomerReading>> {
  await ensure();
  const d = await customerVisits(id, from, to);
  if (!d.visits.length) return { ok: false, error: "No visit of this customer in the period - nothing to read." };
  const letters = new Map<string, string>();
  const letter = (c: string | null) => {
    if (!c) return "?";
    if (!letters.has(c)) letters.set(c, String.fromCharCode(65 + Math.min(letters.size, 25)));
    return letters.get(c)!;
  };
  const visitLines = d.visits.slice(0, 25).map((v, i) => `${i + 1}. ${visitLine(v, letter).slice(0, 1400)}`);
  const contactLines = d.contacts.filter((c) => letters.has(c.id)).map((c) => `${letters.get(c.id)} = ${c.job ?? "no job title in HubSpot"}`);
  const pages = d.stops.filter((x) => x.path);
  const stopLines = pages.map((x) => `${x.path} | ${x.name.slice(0, 70)} | ${stopWords(x)}${x.others ? ` | in the period ${x.others.companies} compan${x.others.companies === 1 ? "y" : "ies"} opened this product, ${x.others.ordered} ordered it` : ""}`);
  const system = `You are the conversion analyst and sales assistant of a B2B web shop. You get ONE customer's visits on the shop in a
period, step by step - the pages, the articles opened, the quantity typed, where it stopped (below the minimum order, not
enough stock, priced and left, left in the cart, ordered) and the time on each step - and the shop pages where the
visits stopped short of an order, with how many other customers opened the same product and ordered it.
Write what the people who look after this customer should do next (Sales: a call, a quote, help with a minimum or a
quantity; Marketing: a mail or a page to send, a reminder) and which of the listed shop pages to improve for customers
like this one.

${SHOP_FACTS}

${MEANING}

${RULES}`;
  const user = `PERIOD: ${from} to ${to} (Swiss time)
CUSTOMER: segment ${d.company.segment ?? "unknown"} · priority ${d.company.priority ?? "unknown"} · country ${d.company.country ?? "unknown"} · store view ${d.store ?? "unknown"}
${d.logins !== null ? `Shop sign-ins in the period: ${d.logins}; article views counted by the shop: ${d.shopViews ?? 0}\n` : ""}CONTACTS: ${contactLines.join("; ") || "unknown"}
SOURCES: ${d.sources.pages.state === "ok" ? "every page from HubSpot" : "HubSpot's last page per person only - between the articles the pages are not known"}; the shop's record keeps each article's LAST minute of the day.

VISITS (newest first; "(last)" = the last step, its time is not known):
${visitLines.join("\n")}

SHOP PAGES WHERE THE VISITS STOPPED (path | name | what happened | other customers):
${stopLines.join("\n") || "none with a page on the shop"}`;
  const r = await ask<{ headline: string; next: NextAction[]; shop: ShopFix[] }>(system, user, CUSTOMER_SCHEMA, 6000);
  if (!r.ok) return r;
  const known = new Set(pages.map((x) => x.path!));
  const next = (r.data.next ?? []).filter((n) => (n.who === "Sales" || n.who === "Marketing") && s(n.action, 1)).slice(0, 4)
    .map((n) => ({ who: n.who, action: s(n.action, 200), why: s(n.why, 400) }));
  const shop = (r.data.shop ?? []).filter((x) => known.has(String(x.path))).slice(0, 3).map((x) => ({ path: String(x.path), why: s(x.why, 400), try: s(x.try, 300) }));
  if (!next.length && !shop.length) return { ok: false, error: "The AI's answer had nothing usable - ask again." };
  const reading: CustomerReading = { headline: s(r.data.headline, 300), next, shop, letters: Object.fromEntries([...letters].map(([c, l]) => [l, c])), visits: d.visits.length, at: new Date().toISOString(), by };
  await keep("customer", id, from, to, reading, by);
  return { ok: true, data: reading };
}

/* ── the period ───────────────────────────────────────────────────────── */

const PERIOD_SCHEMA = {
  type: "object", additionalProperties: false, required: ["headline", "findings", "call"],
  properties: {
    headline: { type: "string", description: "What the period's visits show, one plain sentence with the main number" },
    findings: {
      type: "array", description: "3 to 5 findings, the one that loses the most first",
      items: {
        type: "object", additionalProperties: false, required: ["title", "why", "action", "paths"],
        properties: {
          title: { type: "string", description: "The finding in under 9 words" },
          why: { type: "string", description: "The numbers that show it - one or two sentences" },
          action: { type: "string", description: "What to do about it, concretely - one sentence" },
          paths: { type: "array", items: { type: "string" }, description: "Pages from the list (exact paths) it is about - may be empty" },
        },
      },
    },
    call: {
      type: "array", description: "Up to 5 customers (ids from the list) Sales should contact first, the closest to an order first",
      items: {
        type: "object", additionalProperties: false, required: ["id", "why"],
        properties: { id: { type: "string" }, why: { type: "string", description: "Why now, from their visits - one sentence" } },
      },
    },
  },
};

export async function makePeriodReading(from: string, to: string, by: string): Promise<AiResult<PeriodReading>> {
  await ensure();
  const d = await listVisitors(from, to);
  if (!d.rows.length) return { ok: false, error: "No visit in the period - nothing to read." };
  // the customers closest to an order first, then the busiest
  const rank = (r: (typeof d.rows)[number]) => REACHES.indexOf(r.reach === "order" ? "product" : r.reach) * 100 + Math.min(99, r.visits);
  const picked = [...d.rows].sort((a, b) => rank(b) - rank(a)).slice(0, 60);
  const counts = REACHES.map((k) => `${REACH_LABEL[k]} ${d.rows.filter((r) => r.reach === k).length}`).join(" · ");
  const rowLines = picked.map((r) => [
    r.id, r.segment ?? "-", r.country ?? "-", r.store ?? "-", `visits ${r.visits}`, `articles ${r.articles}`, `reached: ${REACH_LABEL[r.reach]}`,
    `last ${r.lastAt ? zurichTime(r.lastAt) : "-"}`, r.stop ? `stopped most at ${r.stop.path ?? "?"} "${r.stop.name.slice(0, 50)}" (${r.stop.words})` : "",
  ].join(" | "));
  const pages = d.stops.filter((x) => x.path);
  const stopLines = pages.map((x) => `${x.path} | ${x.name.slice(0, 70)} | ${x.companies} customers | ${stopWords(x)}`);
  const system = `You are the conversion analyst of a B2B web shop. You get every customer seen on the shop in a period - how far
each got (opened products, checked a price, the cart without an order, ordered), how many visits and articles, and the page
each stopped at most - and the pages where the most customers stopped short of an order. Say what the visits show: the
patterns that cost orders, what to do about each, and which customers Sales should contact first.

${SHOP_FACTS}

${MEANING}

${RULES}`;
  const user = `PERIOD: ${from} to ${to} (Swiss time) - ${d.rows.length} customers seen: ${counts}
${d.sources.pages.state === "ok" ? "" : "Between the articles the pages are not known (HubSpot gives each person's last page only).\n"}
PAGES WHERE CUSTOMERS STOPPED (path | name | customers | what happened):
${stopLines.join("\n") || "none"}

CUSTOMERS (id | segment | country | store view | visits | articles | furthest | last visit | where they stopped most), closest to an order first:
${rowLines.join("\n")}`;
  const r = await ask<{ headline: string; findings: Finding[]; call: CallFirst[] }>(system, user, PERIOD_SCHEMA, 7000);
  if (!r.ok) return r;
  const knownPaths = new Set(pages.map((x) => x.path!));
  const knownIds = new Set(picked.map((x) => x.id));
  const findings = (r.data.findings ?? []).slice(0, 5).map((f) => ({
    title: s(f.title, 120), why: s(f.why, 500), action: s(f.action, 300), paths: [...new Set((f.paths ?? []).map(String).filter((p) => knownPaths.has(p)))].slice(0, 4),
  })).filter((f) => f.title);
  const call = (r.data.call ?? []).filter((c) => knownIds.has(String(c.id))).slice(0, 5).map((c) => ({ id: String(c.id), why: s(c.why, 300) }));
  if (!findings.length) return { ok: false, error: "The AI's answer had no finding - ask again." };
  const reading: PeriodReading = { headline: s(r.data.headline, 300), findings, call, customers: d.rows.length, at: new Date().toISOString(), by };
  await keep("period", "", from, to, reading, by);
  return { ok: true, data: reading };
}
