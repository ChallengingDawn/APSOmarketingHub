// CREATING THE PRICE-CHECK TICKETS.
//
// The rule lives in one place - `fetchShopSignals` and `rules.ts`, which the
// Price checks tab already shows you - and this turns what qualifies into a
// ticket. Two copies of a rule drift; the screen and the ticket must not be able
// to disagree about who gets called.
//
// No state file. This container is replaced on every deployment, so the two
// things a detector normally remembers come from elsewhere:
//
//   - whether a ticket already exists -> the ticket itself. `price_check_key`
//     is written on it and searched for before anything is created, so a rerun
//     is harmless and two instances racing cannot both win.
//   - how far back to look -> a short rolling window. A day that was missed is
//     picked up by the next run, and nothing ever reaches back to the start of
//     the activity data: nobody wants a call about a Tuesday three weeks ago.

import { hubspotFetchJson } from "./hubspot";
import { IntegrationError, hubspotToken, ticketsToken } from "./status";
import { fetchShopSignals, type PriceCheckRow } from "./shopSignals";
import { PIPE_STAGE, ownerName, teamOf } from "../datatracker/rosters";
import { MIN_ARTICLES, VALUE_FLOOR_ACTIVE } from "../datatracker/rules";

const PP_OBJ = "2-200042439";
/**
 * How far back a run will reach. Three days covers a weekend plus the working
 * day the rule waits anyway, so nothing is lost if a run is missed, and a first
 * run cannot empty the whole backlog onto the team at once.
 */
const LOOKBACK_DAYS = 3;
const TAG = "price_check";

export type TicketOutcome = {
  key: string;
  company: string | null;
  day: string;
  value: number;
  articles: string[];
  team: "ESO" | "TSA" | null;
  owner: string;
  /** created | exists | waiting | ordered | off-roster | no-price | under | excluded */
  outcome: string;
  ticketId?: string;
  error?: string;
};

export type RunReport = {
  dry: boolean;
  from: string;
  to: string;
  considered: number;
  created: number;
  rows: TicketOutcome[];
  /** Counted articles with no list price, across every candidate day. */
  articlesWithoutPrice: number;
  generatedAt: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The hub's own token writes these.
 *
 * A second private app is not needed - the one this app already uses just needs
 * crm.objects.tickets.write and crm.schemas.tickets.read (build #12, 04.10.2026).
 * That app is a CLI project, so a scope is a line in app-hsmeta.json plus an
 * `hs project upload`, not a checkbox in HubSpot's settings. TICKETS_TOKEN stays
 * as an override for the case where the two are deliberately kept apart.
 */
async function ticketsRequest<T>(path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
  const token = ticketsToken() ?? hubspotToken();
  if (!token) throw new IntegrationError("No HubSpot token is set, so no ticket can be created.");
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new IntegrationError(`HubSpot tickets: ${res.status} ${text.slice(0, 300)}`, res.status);
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * The `tags` dropdown must carry `price_check`.
 *
 * It is what keeps the ESO rename workflow off these tickets - that workflow
 * rewrites the subject to "Direct ESO request |  |" within seconds of birth and
 * excludes on this dropdown, which is present at creation and therefore
 * race-free. Without the option the tag does not stick and every ticket loses
 * its subject, so a run refuses rather than produce forty ruined tickets.
 */
async function tagOptionExists(): Promise<boolean> {
  const p = await ticketsRequest<{ options?: { value?: string }[] }>("/crm/v3/properties/tickets/tags", "GET");
  return (p.options ?? []).some((o) => o.value === TAG);
}

/** Which of these keys already have a ticket. Dedup without a state file. */
async function existingKeys(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    // Through the ticket token, not the generic reader: reading tickets needs
    // the same scope writing them does, so a missing scope should fail here -
    // before anything is created - rather than halfway through.
    const res = await ticketsRequest<{ results?: { properties?: Record<string, string | null> }[] }>(
      "/crm/v3/objects/tickets/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "price_check_key", operator: "IN", values: keys.slice(i, i + 100) }] }],
        properties: ["price_check_key"],
        limit: 100,
      });
    for (const r of res.results ?? []) {
      const k = r.properties?.price_check_key;
      if (k) found.add(k);
    }
  }
  return found;
}

/**
 * Did this company order anything since the price check?
 *
 * A WEB order folds back onto the activity line itself, so a bought article
 * never reaches the rule. This catches the order that never touched the shop -
 * phoned in, or e-mailed - which is exactly the case where nobody should be
 * called. `null` means the question could not be answered, and unknown is not
 * the same as no.
 */
async function orderedSince(companyId: string, day: string): Promise<boolean | null> {
  try {
    const ms = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
    const res = await hubspotFetchJson<{ results?: unknown[] }>({
      path: "/crm/v3/objects/orders/search",
      method: "POST",
      body: {
        filterGroups: [{ filters: [
          { propertyName: "order_order_date", operator: "GTE", value: String(ms) },
          { propertyName: "associations.company", operator: "EQ", value: companyId },
        ] }],
        properties: ["order_order_date"],
        limit: 1,
      },
    });
    return (res.results ?? []).length > 0;
  } catch {
    return null;
  }
}

function describe(r: PriceCheckRow): { lines: string[]; centres: string[]; unpriced: number; ids: string[] } {
  const lines: string[] = [];
  const centres = new Set<string>();
  const ids: string[] = [];
  let unpriced = 0;
  for (const a of r.articles) {
    if (!a.counted) continue;
    if (a.price == null) unpriced++;
    if (a.profitCentre) centres.add(a.profitCentre);
    const moq = (a.moq ?? "").trim();
    const moqTxt = /^y/i.test(moq) ? `MOQ ${a.moqMinimum ?? "?"}` : moq ? "no MOQ" : "MOQ unknown";
    lines.push(`${a.article} x ${a.qty ?? "?"} (${a.profitCentre} · ${a.salesUnit ?? "unit ?"} · ${moqTxt})`);
  }
  return { lines, centres: [...centres].sort(), unpriced, ids };
}

export async function runPriceCheckTickets(opts: { dry?: boolean; today?: string } = {}): Promise<RunReport> {
  const dry = opts.dry ?? true;
  const today = opts.today ?? iso(new Date());
  const from = iso(new Date(Date.parse(`${today}T00:00:00Z`) - LOOKBACK_DAYS * 86_400_000));

  if (!dry && !(await tagOptionExists())) {
    throw new IntegrationError(
      "The `tags` dropdown has no `price_check` option. The ESO rename workflow would wipe every subject, " +
      "so nothing was created. Add the option to the dropdown first.",
    );
  }

  const signals = await fetchShopSignals({ from, to: today, today });
  const candidates = signals.priceChecks;
  const rows: TicketOutcome[] = [];
  let created = 0;
  let articlesWithoutPrice = 0;

  // One search for every key, rather than one per candidate.
  const keyed = candidates.map((r) => ({ r, key: `${r.customerNumber || r.companyId}|${r.day}` }));
  const already = keyed.length ? await existingKeys(keyed.map((k) => k.key)) : new Set<string>();

  for (const { r, key } of keyed) {
    const team = teamOf(r.ownerId);
    const base = {
      key, company: r.companyName, day: r.day, value: Math.round(r.value),
      articles: r.articles.filter((a) => a.counted).map((a) => a.article),
      team, owner: ownerName(r.ownerId),
    };

    if (already.has(key)) { rows.push({ ...base, outcome: "exists" }); continue; }
    if (r.excluded) { rows.push({ ...base, outcome: `excluded · ${r.excluded}` }); continue; }
    if (!r.gateOpen) { rows.push({ ...base, outcome: `waiting until ${r.dueOn}` }); continue; }

    const { lines, centres, unpriced } = describe(r);
    articlesWithoutPrice += unpriced;
    if (r.counted === 0) { rows.push({ ...base, outcome: "no KT/DT article" }); continue; }
    if (VALUE_FLOOR_ACTIVE && r.value < 500) {
      // Nothing priced at all is not a customer below the bar, it is a customer
      // we cannot measure. The two look identical from outside and mean
      // opposite things.
      rows.push({ ...base, outcome: unpriced === r.counted ? "no list price" : "under €500" });
      continue;
    }
    // While the floor is paused (the ERP price unit is not in P&P), the rule is
    // three KT/DT articles - the same verdict shopSignals drew with priceCheckQualifies.
    if (!VALUE_FLOOR_ACTIVE && !r.qualifies) {
      rows.push({ ...base, outcome: `${r.counted} of ${MIN_ARTICLES} articles` });
      continue;
    }

    const ordered = await orderedSince(r.companyId, r.day);
    if (ordered !== false) { rows.push({ ...base, outcome: ordered ? "ordered since" : "order check failed" }); continue; }

    if (!team) { rows.push({ ...base, outcome: "owner off roster" }); continue; }
    if (dry) { rows.push({ ...base, outcome: "would create" }); continue; }

    const total = Math.round(r.value);
    const n = r.counted;
    // No money on the ticket while the price unit is unknown: list price x
    // quantity can be 100 or 1,000 times too high, and a sales potential written
    // from it would be reported on as if it were real.
    const subject = VALUE_FLOOR_ACTIVE
      ? `PRICE CHECK | ${n} article${n === 1 ? "" : "s"} | ${total.toLocaleString("de-CH")} EUR | ${r.companyName ?? ""}`
      : `PRICE CHECK | ${n} article${n === 1 ? "" : "s"} | ${r.companyName ?? ""}`;
    const content = [
      "PRICE CHECK - priced, not ordered",
      "",
      `On ${r.day} this customer asked the shop what these articles cost and did not put them in the basket. ` +
      `One working day has passed (${r.dueOn}) and no order has arrived.`,
      "",
      ...lines,
      "",
      VALUE_FLOOR_ACTIVE ? `Value at list price: ${total.toLocaleString("de-CH")} EUR` : "",
      r.skipped ? `Articles skipped (special, or not KT/DT): ${r.skipped}` : "",
      `Company:  ${r.companyName ?? ""} (${r.customerNumber ?? r.companyId})`,
      `Team:     ${team} (${ownerName(r.ownerId)})`,
      "",
      "Action: ask what the quote was for. A price checked and left is a question we can still answer - " +
      "on price, on quantity, or with an alternative.",
      "Source: Price-check detector (APSOmarketingHub, webshop quantity lookup)",
    ].filter(Boolean).join("\n");

    const { pipeline, stage } = PIPE_STAGE[team];
    const properties: Record<string, string | number> = {
      subject, content,
      hs_pipeline: pipeline, hs_pipeline_stage: stage,
      hubspot_owner_id: r.ownerId ?? "",
      tags: TAG,
      price_check_key: key,
      price_check_date: r.day,
      price_check_articles: lines.join("; ").slice(0, 1000),
      price_check_article_count: n,
      price_check_unpriced_articles: unpriced,
      price_check_profit_centers: centres.join(", "),
      price_check_verified_no_order_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      source_type: "AUTOMATION",
      ...(VALUE_FLOOR_ACTIVE
        ? {
            price_check_value: total,
            // The potential IS the priced value - a real number, not a tier.
            sales_potential_estimate: total,
            sales_potential_source: "direct_field",
            sales_potential_confidence: "high",
            hs_ticket_priority: total >= 5000 ? "HIGH" : total >= 1000 ? "MEDIUM" : "LOW",
          }
        : { hs_ticket_priority: n >= 5 ? "HIGH" : "MEDIUM" }),
    };

    try {
      const t = await ticketsRequest<{ id: string }>("/crm/v3/objects/tickets", "POST", { properties });
      created++;
      rows.push({ ...base, outcome: "created", ticketId: t.id });

      await ticketsRequest(`/crm/v4/objects/tickets/${t.id}/associations/default/companies/${r.companyId}`, "PUT").catch(() => {});
      // The contact who priced, not only the company. The gateway kept that id
      // on the activity line precisely so this costs no extra call.
      for (const c of r.contactIds.slice(0, 3)) {
        await ticketsRequest(`/crm/v4/objects/tickets/${t.id}/associations/default/contacts/${c}`, "PUT").catch(() => {});
      }
    } catch (err) {
      rows.push({ ...base, outcome: "failed", error: String((err as Error)?.message ?? err) });
    }
  }

  return {
    dry, from, to: today,
    considered: candidates.length,
    created,
    rows,
    articlesWithoutPrice,
    generatedAt: new Date().toISOString(),
  };
}

export { PP_OBJ };
