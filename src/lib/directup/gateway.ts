// DIRECTUP - the hub's page on the order tool (SARCLA, 13.10.2026: DirectUP moved off PricingHub to its own
// Railway service, "DirectUp Gateway" in the APSOAssistant project; "the rest goes to the marketing under
// Website > Microservices").
//
// The tool itself stays on Railway: the shop frames it, so it needs a public address, and the hub has none.
// The hub READS the gateway's admin API (status, usage, the tool's log, order lists, the installation
// snippets) and can change its settings. Key: DIRECTUP_ADMIN_KEY (same value as on the gateway; in
// C:\dev\secrets\directup_admin_key.txt). The address is one setting in the hub's database, like the 3D
// gateway's; until somebody sets it, it is the Railway address.

import { kvGet, kvSet } from "@/lib/db/init";

export const DEFAULT_GATEWAY = "https://directup-gateway-production.up.railway.app";
const KV = "directup:gateway";

export type GatewaySetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function gatewaySetting(): Promise<GatewaySetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: DEFAULT_GATEWAY, by: null, at: null, fromDefault: true };
}

/** https only, no path: the service's address, as the snippets put it in front of /landing/tools/directup. */
export async function setGateway(raw: string, by: string): Promise<GatewaySetting> {
  let origin = "";
  try { const u = new URL(raw.trim()); origin = u.origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error("Give the gateway's https address, e.g. https://directup-gateway-production.up.railway.app");
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

export function adminKey(): string | null {
  const v = (process.env.DIRECTUP_ADMIN_KEY || "").trim();
  return v ? v : null;
}

/** One call to the gateway's admin API. Throws with the gateway's own sentence when it refuses. */
export async function gateway<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const key = adminKey();
  if (!key) throw new Error("DIRECTUP_ADMIN_KEY is not set on the hub");
  const base = (await gatewaySetting()).url;
  const res = await fetch(`${base}/api/admin${path}`, {
    method: init.method ?? "GET",
    headers: { "x-admin-key": key, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(new Error(res.status === 403 ? "The gateway refused the hub's key (DIRECTUP_ADMIN_KEY differs)" : `The gateway answered ${res.status}: ${said}`), { status: res.status });
  }
  return body as T;
}

// what the gateway answers (directup-gateway/src/admin.ts)
export type Status = {
  version: string; url: string; uptimeS: number; jobs: number; lastJobAt: string | null;
  catalogue: { articles: number; crossrefs: number; syncedAt: string | null; error: string | null; running: boolean };
  bridges: { bridge: string | null; locale: string | null; n: number; last: string }[];
  settings: { batchSize: number };
  keys: { hubspot: boolean; claude: boolean; sync: boolean };
};
export type UsageDay = { day: string; lists: number; files: number; read_by_claude: number; lines: number; by_number: number; by_text: number; not_found: number; added: number };
export type Usage = { days: number; perDay: UsageDay[]; carts: { day: string; carts: number; cart_lines: number }[] };
/** `product`: the article's name from the gateway's catalogue copy, when the event names an article. */
export type LogEntry = { at: string; ev: string; data: unknown; product?: string | null };
export type Log = { entries: LogEntry[]; kinds: { ev: string; n: number }[] };
export type JobSummary = { id: string; createdAt: string; locale: string | null; filename: string | null; method: string | null;
  counts: { total: number; matched: number; review: number; unmatched: number; added: number; skipped: number } };
export type JobLine = { idx: number; ref: string; description: string; qty: number; unit?: string | null; status: string; state?: string;
  chosen: string | null; via?: string; reason?: string; source?: string; candidates: { articleNumber: string; description: string; via?: string; score?: number }[] };
export type JobDetail = JobSummary & { lines: JobLine[] };
export type Snippets = { head: string; footer: string; page: string; generatedAt: string; version: string; url: string };
