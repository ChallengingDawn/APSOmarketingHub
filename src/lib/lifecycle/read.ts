// READING HUBSPOT FOR THE LIFECYCLE REPORTS - read only.
//
// Every call is a GET, a /search or a /batch/read: nothing here writes. Search
// goes through the hub's own queue (hubspotFetchJson spaces /search calls to
// stay under HubSpot's ~4 a second); every call is tried again on a 429, a 5xx
// or a dropped connection, and when the tries run out the read FAILS - a scan
// cut short looks exactly like a business decline, so a partial total is never
// handed on (feedback: partial scan reads as data gap).

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";

export type Hist = { value?: string | null; timestamp?: string; sourceType?: string };
export type Rec = { id: string; properties?: Record<string, string | null>; propertiesWithHistory?: Record<string, Hist[]> };
export type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };

type Req = Parameters<typeof hubspotFetchJson>[0];

/** A read, tried again on a rate limit, a server error or a dropped connection. */
export async function read<T>(req: Req, tries = 6): Promise<T> {
  const path = req.path.split("?")[0];
  const readOnly = (req.method ?? "GET") === "GET" || /\/search$|\/batch\/read$/.test(path);
  if (!readOnly) throw new Error(`Lifecycle reports only read HubSpot (refused ${req.method} ${path}).`);
  for (let attempt = 1; ; attempt++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = e instanceof IntegrationError ? e.status : undefined;
      const again = st === undefined || st === null || st === 429 || st >= 500;
      if (!again || attempt >= tries) throw e;
      await new Promise((r) => setTimeout(r, Math.min(20_000, 1500 * 2 ** (attempt - 1))));
    }
  }
}

export const dayMs = (day: string) => String(Date.parse(`${day}T00:00:00Z`));

/**
 * Every record matching ANY of the filter groups, paged by id (HubSpot's own
 * paging stops at 10,000 results). Each page is 200 records.
 */
export async function searchAll(object: string, groups: Filter[][], properties: string[], onPage?: (n: number) => void): Promise<Rec[]> {
  const out: Rec[] = [];
  let lastId = "0";
  for (let page = 0; page < 5000; page++) {
    const r = await read<{ results?: Rec[] }>({
      path: `/crm/v3/objects/${object}/search`, method: "POST", useTicketsToken: object === "tickets",
      body: {
        limit: 200, properties,
        filterGroups: groups.map((g) => ({ filters: [...g, { propertyName: "hs_object_id", operator: "GT", value: lastId }] })),
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
      },
    });
    const rows = r.results ?? [];
    out.push(...rows);
    onPage?.(out.length);
    if (rows.length < 200) return out;
    lastId = rows[rows.length - 1].id;
  }
  throw new Error(`HubSpot search on ${object} did not finish within 1,000,000 records.`);
}

/** How many records match - one search call. */
export async function countOf(object: string, filters: Filter[]): Promise<number> {
  const r = await read<{ total?: number }>({
    path: `/crm/v3/objects/${object}/search`, method: "POST",
    body: { filterGroups: filters.length ? [{ filters }] : [], limit: 1, properties: ["hs_object_id"] },
  });
  if (typeof r.total !== "number") throw new Error(`HubSpot gave no total for a ${object} count.`);
  return r.total;
}

/** The newest record matching the filters, by a date property - "the latest task ever". */
export async function newest(object: string, filters: Filter[], dateProp: string): Promise<Rec | null> {
  const r = await read<{ results?: Rec[] }>({
    path: `/crm/v3/objects/${object}/search`, method: "POST",
    body: { filterGroups: [{ filters }], limit: 1, properties: [dateProp], sorts: [{ propertyName: dateProp, direction: "DESCENDING" }] },
  });
  return r.results?.[0] ?? null;
}

/** Run `fn` over the items, `width` at a time, in order of the results. */
async function pool<T, R>(items: T[], width: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/**
 * Records by id with their properties - and, when asked, the full history of a
 * few of them - handed over a call's worth at a time so a large read never sits
 * in memory whole. HubSpot takes 100 ids a call, 50 when history is asked for.
 * One call at a time: the token's rate limit is shared with the ERP chain and
 * the hub's other steps, and a report cached for 12 hours has no need to hurry.
 */
export async function batchEach(object: string, ids: string[], properties: string[], history: string[], each: (recs: Rec[]) => void, onProgress?: (n: number) => void): Promise<void> {
  const size = history.length ? 50 : 100;
  const chunks: string[][] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size));
  let done = 0;
  await pool(chunks, 1, async (chunk) => {
    const r = await read<{ results?: Rec[] }>({
      path: `/crm/v3/objects/${object}/batch/read`, method: "POST", useTicketsToken: object === "tickets",
      body: { inputs: chunk.map((id) => ({ id })), properties, ...(history.length ? { propertiesWithHistory: history } : {}) },
    });
    each(r.results ?? []);
    done += chunk.length;
    onProgress?.(done);
  });
}

/** The same, gathered into one list. */
export async function batchRead(object: string, ids: string[], properties: string[], history: string[] = [], onProgress?: (n: number) => void): Promise<Rec[]> {
  const out: Rec[] = [];
  await batchEach(object, ids, properties, history, (recs) => { out.push(...recs); }, onProgress);
  return out;
}

/** from-id -> to-ids, 1,000 ids a call (v4 associations). */
export async function associations(from: string, to: string, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 1000) {
    const r = await read<{ results?: { from?: { id?: string | number }; to?: { toObjectId?: string | number }[] }[] }>({
      path: `/crm/v4/associations/${from}/${to}/batch/read`, method: "POST",
      body: { inputs: unique.slice(i, i + 1000).map((id) => ({ id })) },
    });
    for (const row of r.results ?? []) {
      const f = row.from?.id;
      if (f === undefined || f === null) continue;
      const list = out.get(String(f)) ?? [];
      list.push(...(row.to ?? []).map((t) => String(t.toObjectId)));
      out.set(String(f), list);
    }
  }
  return out;
}

/** Ticket stages: id -> label, closed, and the pipeline they belong to. */
export async function ticketStages(): Promise<Map<string, { label: string; closed: boolean; pipeline: string; pipelineLabel: string }>> {
  const r = await read<{ results?: { id: string; label: string; stages?: { id: string; label: string; metadata?: { ticketState?: string } }[] }[] }>({
    path: "/crm/v3/pipelines/tickets", useTicketsToken: true,
  });
  const out = new Map<string, { label: string; closed: boolean; pipeline: string; pipelineLabel: string }>();
  for (const p of r.results ?? []) {
    for (const s of p.stages ?? []) out.set(s.id, { label: s.label, closed: s.metadata?.ticketState === "CLOSED", pipeline: p.id, pipelineLabel: p.label });
  }
  return out;
}

/* ── the email-statistics token (optional) ─────────────────────────────── */

/**
 * Opens and clicks per marketing email need a token with the marketing-email
 * scope, which the hub's app does not have (every token tried on 13.10.2026 got
 * a 403). If SARCLA creates one, HUBSPOT_EMAIL_STATS_TOKEN switches the
 * statistics on; without it the pages say so quietly and show sends only.
 */
export function emailStatsToken(): string | null {
  const t = process.env.HUBSPOT_EMAIL_STATS_TOKEN?.trim();
  return t ? t : null;
}

/** Sent, opened and clicked per email name, for the names asked about. */
export async function readEmailStats(wanted: Set<string>): Promise<Record<string, { sent: number; open: number; click: number }>> {
  const token = emailStatsToken();
  if (!token) throw new Error("HUBSPOT_EMAIL_STATS_TOKEN is not set.");
  const out: Record<string, { sent: number; open: number; click: number }> = {};
  let after: string | undefined;
  for (let page = 0; page < 200; page++) {
    const url = `https://api.hubapi.com/marketing/v3/emails?limit=100&includeStats=true${after ? `&after=${encodeURIComponent(after)}` : ""}`;
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    if (!res || !res.ok) throw new Error(`HubSpot email statistics: HTTP ${res?.status ?? "no response"}`);
    const j = (await res.json()) as {
      results?: { name?: string; stats?: { counters?: { sent?: number; open?: number; click?: number } } }[];
      paging?: { next?: { after?: string } };
    };
    for (const e of j.results ?? []) {
      if (!e.name || !wanted.has(e.name)) continue;
      const c = e.stats?.counters ?? {};
      out[e.name] = { sent: Number(c.sent) || 0, open: Number(c.open) || 0, click: Number(c.click) || 0 };
    }
    after = j.paging?.next?.after;
    if (!after) break;
  }
  return out;
}
