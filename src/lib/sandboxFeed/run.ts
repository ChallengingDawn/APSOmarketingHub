// RUNNING A SANDBOX'S READ ON THE HUB - exactly the read a sandbox page (or a CLI ask) could not answer, and only if it
// is a read: HubSpot GETs, searches and batch reads on a short list of paths, with the hub's token; database SELECTs in
// a READ ONLY transaction with a time limit, never on logins, keys or the system catalogue. The answer is coded by
// code.ts before it goes anywhere.

import { NEVER_FROM_HUB, isHubspotRead, isSqlRead } from "../sandbox/canon";
import type { HsRequest, SqlRequest } from "../sandbox/store";
import { getPool } from "../db/client";
import { hubspotFetchJson, searchBackoff, searchTurn } from "../integrations/hubspot";
import { hubspotToken } from "../integrations/status";

const HUBSPOT_PATHS = [
  /^\/crm\/v[34]\/objects\//, /^\/crm\/v[34]\/associations\//, /^\/crm\/v3\/properties\//, /^\/crm\/v3\/pipelines\//,
  /^\/crm\/v3\/owners/, /^\/crm\/v3\/schemas/, /^\/crm\/v3\/lists/, /^\/settings\/v3\/users/, /^\/automation\/v4\/flows/,
  /^\/account-info\/v3\/details/, /^\/conversations\/v3\/conversations\/threads/,
];
export const MAX_ROWS = 5_000;
// the catalogue, settings and anything that reaches outside the database
const SYSTEM = /\b(pg_[a-z_]+|information_schema|current_setting|set_config|dblink[a-z_]*|lo_import|lo_export|inet_server_\w+|version\s*\()/;

/** Why the hub will not run this HubSpot call for a sandbox; null = it will. */
export function hubspotRefusal(req: HsRequest): string | null {
  if (!isHubspotRead(req.method, req.url)) return "only reads are run for the sandbox";
  const path = req.url.split("?")[0];
  if (!HUBSPOT_PATHS.some((p) => p.test(path))) return `HubSpot ${path.split("/").slice(0, 4).join("/")} is not served to the sandbox`;
  return null;
}

/** Why the hub will not run this database read for a sandbox; null = it will. */
export function sqlRefusal(req: SqlRequest): string | null {
  const t = req.text.toLowerCase();
  if (!isSqlRead(req.text)) return "only reads are run for the sandbox";
  if (NEVER_FROM_HUB.some((n) => t.includes(n))) return "logins and keys never leave the hub";
  if (SYSTEM.test(t)) return "system tables and functions never leave the hub";
  if (req.text.replace(/'[^']*'/g, "''").replace(/;\s*$/, "").includes(";")) return "one statement at a time";
  return null;
}

/** The HubSpot call, with the hub's token and the hub-wide search pace. Status and body as HubSpot gave them. */
export async function runHubspotRead(req: HsRequest): Promise<{ status: number; body: unknown }> {
  const token = hubspotToken();
  if (!token) throw new Error("HUBSPOT_TOKEN is not set");
  const search = req.url.includes("/search");
  for (let attempt = 1; ; attempt++) {
    if (search) await searchTurn();
    const res = await fetch(`https://api.hubapi.com${req.url}`, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, ...(req.body ? { "Content-Type": "application/json" } : {}) },
      body: req.body === null || req.body === undefined ? undefined : typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const text = await res.text();
    if (res.status === 429 && attempt < 3) {
      const wait = (Number(res.headers.get("retry-after")) || 1.1 * attempt) * 1000;
      if (!(search && (await searchBackoff(wait)))) await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : {}; } catch { body = null; }
    return { status: res.status, body };
  }
}

/** The database read, read-only and time-limited; at most MAX_ROWS rows go on. */
export async function runSqlRead(req: SqlRequest): Promise<{ rows: unknown[]; cut: boolean }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const r = await client.query(req.text, req.params as never[]);
    return { rows: r.rows.slice(0, MAX_ROWS), cut: r.rows.length > MAX_ROWS };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

// HubSpot's type per property, per object type, held 6 hours: an enumeration or a number stays, free text is coded.
const types = new Map<string, { until: number; map: Map<string, string> }>();

export async function propertyTypes(objectType: string): Promise<Map<string, string>> {
  const held = types.get(objectType);
  if (held && Date.now() < held.until) return held.map;
  const res = await hubspotFetchJson<{ results?: { name?: string; type?: string; fieldType?: string }[] }>({
    path: `/crm/v3/properties/${encodeURIComponent(objectType)}`, signal: AbortSignal.timeout(15_000),
  }).catch(() => ({ results: [] }));
  const map = new Map<string, string>();
  for (const p of res.results ?? []) {
    if (!p.name) continue;
    map.set(p.name, p.fieldType === "phonenumber" ? "phone_number" : p.type === "string" ? "string" : (p.type ?? "string"));
  }
  types.set(objectType, { until: Date.now() + (map.size ? 6 * 3_600_000 : 10 * 60_000), map });
  return map;
}
