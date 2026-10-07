// GROUP 1 - COMPANY FACTS, moved from the Compass connector into the hub:
//   mandant_sweep     mandant from the customer key (was every 30 minutes; once a day here)
//   company_stats     first/last order, last shipment, order count, days between orders
//   contact_shipment  the contact's last shipment date, raise-only
// HubSpot only - no ERP file. Each runs as a PREVIEW (reads, reports what it would
// write, writes nothing) or LIVE. Rules in ./rules.ts, tested; this file is the I/O,
// ported from service/mandant_sweep.py, company_stats.py, contact_shipment.py.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { FACTS, ORDER_PIPELINE, companyFacts, factsDiff, latestShipment, monthsFrom, wantMandant, type Baseline, type OrderLite } from "./rules";

type Obj = { id: string; properties?: Record<string, string | null | undefined> };
type Page<T = Obj> = { results?: T[]; total?: number; paging?: { next?: { after?: string } } };
export type StepResult = Record<string, unknown> & { examples?: unknown[] };
type Beat = () => Promise<void>;

const utcToday = () => new Date().toISOString().slice(0, 10);
const search = (obj: string, body: object) => hubspotFetchJson<Page>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body });

/** Batch update, 100 at a time; a failing batch is counted, the rest still go. */
async function batchUpdate(obj: string, rows: { id: string; properties: Record<string, string> }[]): Promise<{ written: number; failed: number; errors: string[] }> {
  let written = 0, failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    try {
      await hubspotFetchJson({ path: `/crm/v3/objects/${obj}/batch/update`, method: "POST", body: { inputs: chunk } });
      written += chunk.length;
    } catch (e) {
      failed += chunk.length;
      if (errors.length < 3) errors.push((e as Error).message.slice(0, 160));
    }
  }
  return { written, failed, errors };
}

/* ── mandant from the customer key ─────────────────────────────────────── */

export async function mandantSweep(live: boolean, beat: Beat): Promise<StepResult> {
  const t0 = Date.now();
  const def = await hubspotFetchJson<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/companies/mandant" });
  const options = new Set((def.options ?? []).map((o) => o.value));
  const fixes: { id: string; name: string; un: string; was: string; now: string }[] = [];
  let seen = 0, skipped = 0, cursor = "0", pages = 0;
  for (;;) {
    // an id cursor instead of paging: HubSpot's search stops at 10,000 results
    const j = await search("companies", {
      limit: 100, properties: ["company_unique_number", "mandant", "name"],
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      filterGroups: [{ filters: [
        { propertyName: "company_unique_number", operator: "HAS_PROPERTY" },
        { propertyName: "hs_object_id", operator: "GT", value: cursor },
      ] }],
    });
    const res = j.results ?? [];
    if (!res.length) break;
    for (const c of res) {
      const p = c.properties ?? {};
      const un = (p.company_unique_number ?? "").trim();
      if (!/^\d+$/.test(un.split("-")[0])) continue; // not an ERP key: nothing to derive from
      const want = wantMandant(un, options);
      seen += 1;
      if (!want) { skipped += 1; continue; }
      if ((p.mandant ?? "") !== want) fixes.push({ id: c.id, name: p.name ?? "", un, was: p.mandant ?? "", now: want });
    }
    cursor = res[res.length - 1].id;
    if (++pages % 50 === 0) await beat();
  }
  const out: StepResult = {
    companies_with_a_key: seen, to_fix: fixes.length, missing: fixes.filter((f) => !f.was).length,
    contradicting: fixes.filter((f) => f.was).length, unknown_prefix: skipped, examples: fixes.slice(0, 10),
  };
  if (live && fixes.length) Object.assign(out, await batchUpdate("companies", fixes.map((f) => ({ id: f.id, properties: { mandant: f.now } }))));
  return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
}

/* ── order facts on the company ────────────────────────────────────────── */

const ORDER_PROPS = ["order_order_number", "order_order_date", "order_shipment_date", "hs_pipeline", "hs_pipeline_stage"];
const BASELINE = "order_history_before_2020";
const KV_STATS = "connectors:hub:company_stats";
const SEARCH_CAP = 9900;

/** Only what the facts need, as a 5-slot row - ~400,000 orders stay small in memory. */
type Row5 = [string | null, string | null, string | null, string | null, string | null];
const row5 = (p: Record<string, string | null | undefined>): Row5 => [
  p.order_order_number ?? null, p.order_order_date ?? null, p.order_shipment_date ?? null, p.hs_pipeline ?? null, p.hs_pipeline_stage ?? null,
];
const lite = (r: Row5): OrderLite => ({ order_order_number: r[0], order_order_date: r[1], order_shipment_date: r[2], hs_pipeline: r[3], hs_pipeline_stage: r[4] });

async function allOrdersByCompany(beat: Beat): Promise<Map<string, Row5[]>> {
  const byCo = new Map<string, Row5[]>();
  let after: string | undefined;
  let pages = 0;
  for (;;) {
    const qs = `limit=100&archived=false&associations=companies&properties=${ORDER_PROPS.join(",")}${after ? `&after=${after}` : ""}`;
    const j = await hubspotFetchJson<Page<Obj & { associations?: { companies?: { results?: { id: string }[] } } }>>({ path: `/crm/v3/objects/orders?${qs}` });
    for (const o of j.results ?? []) {
      const l = row5(o.properties ?? {});
      for (const a of o.associations?.companies?.results ?? []) {
        const k = String(a.id);
        const list = byCo.get(k);
        if (list) list.push(l); else byCo.set(k, [l]);
      }
    }
    after = j.paging?.next?.after;
    if (++pages % 100 === 0) await beat();
    if (!after) return byCo;
  }
}

async function changedOrders(sinceMs: number): Promise<string[] | null> {
  const ids: string[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await search("orders", {
      filterGroups: [{ filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: String(sinceMs) }] }],
      properties: ["order_order_number"], limit: 100, sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      ...(after ? { after } : {}),
    });
    if ((j.total ?? 0) > SEARCH_CAP) return null;
    ids.push(...(j.results ?? []).map((o) => o.id));
    after = j.paging?.next?.after;
    if (!after) return ids;
  }
}

/** v4 batch association read -> {from: [to]}, following each record's own paging. */
async function assoc(from: string, to: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  type Row = { from: { id: string }; to?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } };
  for (let i = 0; i < ids.length; i += 1000) {
    const j = await hubspotFetchJson<{ results?: Row[] }>({
      path: `/crm/v4/associations/${from}/${to}/batch/read`, method: "POST", body: { inputs: ids.slice(i, i + 1000).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) {
      const fid = String(r.from.id);
      const list = out.get(fid) ?? [];
      list.push(...(r.to ?? []).map((t) => String(t.toObjectId)));
      let next = r.paging?.next?.after;
      while (next) {
        const g = await hubspotFetchJson<{ results?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } }>({
          path: `/crm/v4/objects/${from}/${fid}/associations/${to}?limit=500&after=${next}`,
        });
        list.push(...(g.results ?? []).map((t) => String(t.toObjectId)));
        next = g.paging?.next?.after;
      }
      out.set(fid, list);
    }
  }
  return out;
}

async function batchRead(obj: string, ids: string[], props: string[]): Promise<Map<string, Record<string, string | null | undefined>>> {
  const out = new Map<string, Record<string, string | null | undefined>>();
  for (let i = 0; i < ids.length; i += 100) {
    const j = await hubspotFetchJson<{ results?: Obj[] }>({
      path: `/crm/v3/objects/${obj}/batch/read`, method: "POST", body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: props },
    });
    for (const o of j.results ?? []) out.set(o.id, o.properties ?? {});
  }
  return out;
}

export async function companyStats(live: boolean, beat: Beat, full = false): Promise<StepResult> {
  const started = Date.now();
  const state = (await kvGet<{ synced?: number; last_mode?: string }>(KV_STATS)) ?? {};
  let mode = "full";
  let byCo: Map<string, Row5[]>;
  let changed: string[] | null = null;
  if (!full && state.synced) {
    changed = await changedOrders(state.synced - 2 * 3_600_000);
    if (changed !== null) mode = `incremental (${changed.length} changed orders)`;
  }
  if (mode === "full") {
    byCo = await allOrdersByCompany(beat);
  } else {
    const companies = [...new Set([...(await assoc("orders", "companies", changed!)).values()].flat())].sort();
    const orderIds = await assoc("companies", "orders", companies);
    const props = await batchRead("orders", [...new Set([...orderIds.values()].flat())].sort(), ORDER_PROPS);
    byCo = new Map(companies.map((c) => [c, (orderIds.get(c) ?? []).filter((o) => props.has(o)).map((o) => row5(props.get(o)!))]));
  }
  await beat();
  const current = await batchRead("companies", [...byCo.keys()], [...FACTS, BASELINE]);
  const today = utcToday();
  const ups: { id: string; properties: Record<string, string> }[] = [];
  const examples: unknown[] = [];
  const byField: Record<string, number> = {};
  for (const [cid, orders] of byCo) {
    const cur = current.get(cid);
    if (!cur) continue; // archived or merged away
    let base: Baseline = null;
    try { base = JSON.parse(cur[BASELINE] || "null"); } catch { base = null; }
    const want = companyFacts(orders.map(lite), base, today);
    const diff = factsDiff(cur, want);
    if (Object.keys(diff).length) {
      ups.push({ id: cid, properties: diff });
      for (const k of Object.keys(diff)) byField[k] = (byField[k] ?? 0) + 1;
      if (examples.length < 10) examples.push({ company: cid, was: Object.fromEntries(Object.keys(diff).map((k) => [k, cur[k] ?? ""])), now: diff });
    }
  }
  const out: StepResult = { mode, companies: byCo.size, to_update: ups.length, by_field: byField, examples };
  if (live) {
    Object.assign(out, await batchUpdate("companies", ups));
    await kvSet(KV_STATS, { synced: started, last_mode: mode });
  }
  return { ...out, seconds: Math.round((Date.now() - started) / 1000) };
}

/* ── last shipment date on the contact ─────────────────────────────────── */

const KV_SHIP = "connectors:hub:contact_shipment";
const PROP = "last_shipment_date";
const FULL_FROM = "2021-01";
const OVERLAP_DAYS = 10;

export async function contactShipment(live: boolean, beat: Beat, full = false): Promise<StepResult> {
  const t0 = Date.now();
  // the property exists (the connector created it); the hub's app may not create properties
  await hubspotFetchJson({ path: `/crm/v3/properties/contacts/${PROP}` });
  const st = (await kvGet<{ watermark?: string }>(KV_SHIP)) ?? {};
  const startYm = full || !st.watermark
    ? FULL_FROM
    : new Date(Date.parse(`${st.watermark}T00:00:00Z`) - OVERLAP_DAYS * 86_400_000).toISOString().slice(0, 7);
  const shipped = new Map<string, string>();
  for (const [y, m] of monthsFrom(startYm, utcToday())) {
    const start = Date.UTC(y, m - 1, 1), end = m === 12 ? Date.UTC(y + 1, 0, 1) : Date.UTC(y, m, 1);
    let after: string | undefined;
    for (;;) {
      // a lost page would read as "never shipped" - hubspotFetchJson throws instead, and the run stops
      const j = await search("orders", {
        filterGroups: [{ filters: [
          { propertyName: "order_shipment_date", operator: "GTE", value: String(start) },
          { propertyName: "order_shipment_date", operator: "LT", value: String(end) },
        ] }],
        properties: ["order_shipment_date", "order_order_number"], limit: 100, ...(after ? { after } : {}),
      });
      if ((j.total ?? 0) > 10_000) throw new Error(`more than 10,000 shipments in ${y}-${String(m).padStart(2, "0")} - the search cannot read them all`);
      for (const o of j.results ?? []) {
        const d = (o.properties?.order_shipment_date ?? "").slice(0, 10);
        if (d) shipped.set(o.id, d);
      }
      after = j.paging?.next?.after;
      if (!after) break;
    }
    await beat();
  }
  const contactsOf = new Map<string, string[]>();
  const oids = [...shipped.keys()];
  type Row = { from?: { id?: string }; to?: { toObjectId?: string | number }[] };
  for (let i = 0; i < oids.length; i += 500) {
    const j = await hubspotFetchJson<{ results?: Row[] }>({
      path: "/crm/v4/associations/orders/contacts/batch/read", method: "POST", body: { inputs: oids.slice(i, i + 500).map((id) => ({ id })) },
    });
    for (const r of j.results ?? []) {
      const tos = (r.to ?? []).map((t) => t.toObjectId).filter((x) => x !== undefined && x !== null).map(String);
      if (r.from?.id && tos.length) contactsOf.set(String(r.from.id), tos);
    }
  }
  const { latest, noContact } = latestShipment(shipped, contactsOf);
  const have = await batchRead("contacts", [...latest.keys()], [PROP]);
  const todo = [...latest].filter(([cid, d]) => d > (have.get(cid)?.[PROP] ?? "").slice(0, 10));
  const out: StepResult = {
    from: startYm, orders_shipped: shipped.size, contacts: latest.size, already_current: latest.size - todo.length,
    to_update: todo.length, shipped_without_contact: noContact, examples: todo.slice(0, 10).map(([c, d]) => ({ contact: c, was: have.get(c)?.[PROP] ?? "", now: d })),
  };
  if (live) {
    Object.assign(out, await batchUpdate("contacts", todo.map(([id, d]) => ({ id, properties: { [PROP]: d } }))));
    if (latest.size) await kvSet(KV_SHIP, { watermark: [...latest.values()].reduce((a, b) => (b > a ? b : a)), last_run: utcToday() });
  }
  return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
}

export { ORDER_PIPELINE };
