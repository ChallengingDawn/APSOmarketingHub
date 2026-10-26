// HOW THE SANDBOX RECOGNISES A READ IT HAS ALREADY BEEN GIVEN - the same rules on both sides: the sandbox writes down a
// HubSpot call or a database read it could not answer (a "miss"), the hub runs exactly that read and sends the coded
// answer back under the same key, and the sandbox replays it to the page's own, unchanged code.
//
// Times count by the DAY: "since 30 days ago" asked at 09:00 and at 16:00 is the same read, so the page does not miss
// every time it opens; the next day it misses once and Bring data fetches the day's answer. Two different periods
// (this month vs last month) stay two different reads, so period pickers still work. Pure - client-safe and tested.

const DAY_MS_MIN = 946_684_800_000;   // 2000-01-01: anything below is a count or an id, not a time
const DAY_MS_MAX = 4_102_444_800_000; // 2100-01-01
const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function day(ms: number): string {
  return `<day ${new Date(ms).toISOString().slice(0, 10)}>`;
}

/** A value with its times cut to the day and its object keys sorted, so equal reads give equal keys. */
export function canonical(v: unknown): unknown {
  if (v instanceof Date) return day(v.getTime());
  if (typeof v === "number") return Number.isInteger(v) && v >= DAY_MS_MIN && v < DAY_MS_MAX ? day(v) : v;
  if (typeof v === "string") {
    if (/^\d{13}$/.test(v)) { const n = Number(v); if (n >= DAY_MS_MIN && n < DAY_MS_MAX) return day(n); }
    if (ISO.test(v)) { const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v); if (!Number.isNaN(t)) return day(t); }
    return v;
  }
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canonical(o[k])]));
  }
  return v;
}

function bodyOf(body: unknown): unknown {
  if (typeof body !== "string" || !body) return body ?? null;
  try { return JSON.parse(body); } catch { return body; }
}

/** The key of a HubSpot call: method, path, sorted query and the body, times by the day. */
export function hubspotKey(method: string, url: string, body?: unknown): string {
  const u = new URL(url, "https://api.hubapi.com");
  const q = [...u.searchParams.entries()].sort(([a, x], [b, y]) => (a === b ? x.localeCompare(y) : a.localeCompare(b)));
  return JSON.stringify(["hs", method.toUpperCase(), u.pathname, canonical(q), canonical(bodyOf(body))]);
}

/** HubSpot calls that only read: every GET, and the POSTs that search or read in batches. Anything else writes. */
export function isHubspotRead(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET") return true;
  if (m !== "POST") return false;
  const path = new URL(url, "https://api.hubapi.com").pathname;
  return /\/search$/.test(path) || /\/batch\/read$/.test(path);
}

/** The key of a database read: the statement with its spacing collapsed, and its parameters, times by the day. */
export function sqlKey(text: string, params?: unknown[]): string {
  return JSON.stringify(["sql", text.replace(/\s+/g, " ").trim(), canonical(params ?? [])]);
}

/** A statement that only reads: SELECT, or WITH ... SELECT with no write anywhere inside. */
export function isSqlRead(text: string): boolean {
  const t = text.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().toLowerCase();
  if (!/^(select|with)\b/.test(t)) return false;
  return !/\b(insert|update|delete|merge|truncate|create|alter|drop|grant|copy|call|do)\b/.test(t.replace(/'[^']*'/g, "''"))
    && !/\bfor\s+(update|share|no\s+key\s+update|key\s+share)\b/.test(t);
}

// The hub's tables a sandbox read may never reach, whatever its code asks: logins, sessions, grants and the key store
// (Google sign-in, connector keys). The hub refuses these before running anything; the sandbox keeps its own.
export const NEVER_FROM_HUB = ["apsomh_users", "apsomh_sessions", "apsomh_user_app_access", "apsomh_kv"] as const;

/** The tables a read names after FROM / JOIN (schema dropped, quotes dropped, lower case). */
export function tablesIn(text: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:from|join)\s+((?:"[^"]+"|[a-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][\w$]*))?)/gi;
  for (const m of text.matchAll(re)) {
    const last = m[1].split(".").pop()!.trim().replace(/^"|"$/g, "").toLowerCase();
    out.add(last);
  }
  return [...out];
}
