// CHAT - the hub's page on the shop chat (SARCLA 18.10.2026: "start building under Website > Microservices just
// after DirectCut, without switching off the old one"). The chat itself does not change: customers type into
// HubSpot's chat widget, the chatflow hands each message to the orchestrator on Railway (APSOAssistant
// orchestrator/index.js POST /webhook), the AI answers in the same HubSpot thread, the ticket exists from the
// first message, TSA or Back Office take over in the CHAT inbox, and HubSpot's own survey closes the chat
// (EN_CSAT_Live_Chat_2501 - SARCLA: "a deal breaker", it stays HubSpot's).
//
// This page replaces the chat pages of the APSOAssistant dashboard (Mission Control, Analytics, Conversations,
// Test Sandbox, Escalation Debug) by reading the SAME orchestrator endpoints server to server - the dashboard
// stays up until this page has been watched for a while. Key: CHAT_ORCHESTRATOR_KEY = the orchestrator's
// INTERNAL_API_KEY, sent as x-api-key; it never reaches the browser (the old dashboard shipped it to every
// browser as NEXT_PUBLIC_API_KEY). It reaches the hub's task as a secret: a new task-definition revision built
// from the LATEST one, then a hand deploy (reference_apsomh_deploy). Until then the page says what is missing.

import { kvGet, kvSet } from "@/lib/db/init";
import type { Health, Unit } from "./shape";

// the shapes and the two helpers live in shape.ts, which the page's client components import
export * from "./shape";

export const DEFAULT_ORCHESTRATOR = "https://orchestrator-production-e32d.up.railway.app";
const KV = "chat:orchestrator";

export type OrchestratorSetting = { url: string; by: string | null; at: string | null; fromDefault: boolean };

export async function orchestratorSetting(): Promise<OrchestratorSetting> {
  const s = await kvGet<{ url: string; by: string; at: string }>(KV).catch(() => null);
  return s?.url ? { url: s.url, by: s.by, at: s.at, fromDefault: false } : { url: DEFAULT_ORCHESTRATOR, by: null, at: null, fromDefault: true };
}

/** https only, no path - the orchestrator's origin. */
export async function setOrchestrator(raw: string, by: string): Promise<OrchestratorSetting> {
  let origin = "";
  try { origin = new URL(raw.trim()).origin; } catch { /* below */ }
  if (!origin.startsWith("https://")) throw new Error(`Give the orchestrator's https address, e.g. ${DEFAULT_ORCHESTRATOR}`);
  const s = { url: origin, by, at: new Date().toISOString() };
  await kvSet(KV, s);
  return { ...s, fromDefault: false };
}

/** The key from the hub's environment, or null. */
export function orchestratorKey(): string | null {
  const v = (process.env.CHAT_ORCHESTRATOR_KEY || "").trim();
  return v ? v : null;
}

/** One call to the orchestrator (path from its root, e.g. "/dashboard/stats?days=7"). Throws with its own sentence. */
export async function orchestrator<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const key = orchestratorKey();
  if (!key) throw new Error("CHAT_ORCHESTRATOR_KEY is not set on the hub");
  const res = await fetch(`${(await orchestratorSetting()).url}${path}`, {
    method: init.method ?? "GET",
    headers: { "x-api-key": key, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 25_000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const said = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : text.slice(0, 160);
    throw Object.assign(new Error(res.status === 401 || res.status === 403
      ? "The orchestrator refused the hub's key (CHAT_ORCHESTRATOR_KEY differs from its INTERNAL_API_KEY)"
      : `The orchestrator answered ${res.status}: ${said}`), { status: res.status });
  }
  return body as T;
}

/** /health answers without the key: the quickest proof the orchestrator is up, and what it can reach. */
export async function orchestratorHealth(): Promise<Health | null> {
  try {
    const r = await fetch(`${(await orchestratorSetting()).url}/health`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    return (await r.json().catch(() => null)) as Health | null;   // 503 still carries the checks
  } catch { return null; }
}

/** The per-chat endpoint, or - on an orchestrator without it (404) - the per-message one, marked as such. */
export async function perChat<T extends { unit?: Unit }>(path: string, fallback: string): Promise<T> {
  try {
    return { ...(await orchestrator<T>(path)), unit: "chats" };
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err;
    return { ...(await orchestrator<T>(fallback)), unit: "messages" };
  }
}
