// THE CHAT ON THE SHOP - who sees our chat window (SARCLA 27.10.2026: "when the logic is working we put it live"):
//   off      nobody                     acc      the acceptance shop only (acc.apsoparts.com)
//   preview  a browser that opened the shop with ?apsochat=preview      live     every visitor of www.apsoparts.com
// The switch lives on the shop chat's gateway (directup_settings chat_web_mode, chatweb.ts); the hub reads and sets it
// through the gateway's admin API (DIRECTUP_ADMIN_KEY) and keeps who changed it when (kv chat:webmode:*). The client
// (directup/gateway.ts) puts /api/admin in front of every path, so the paths here start at /chat.

import { gateway } from "@/lib/directup/gateway";
import { kvGet, kvSet } from "@/lib/db/init";

export const WEB_MODES = ["off", "acc", "preview", "live"] as const;
export type WebMode = (typeof WEB_MODES)[number];
export type WebModeChange = { mode: WebMode; by: string; at: string };
export type WebModeState = {
  mode: WebMode | null;
  /** the gateway's counters since its last start */
  turns: number | null; escalated: number | null; failed: number | null; lastAt: string | null;
  changed: WebModeChange | null;
};
const KV = "chat:webmode";

export async function webMode(): Promise<WebModeState> {
  const s = await gateway<{ mode?: string; turns?: number; escalated?: number; failed?: number; lastAt?: string | null }>("/chat/web-status");
  const changed = (await kvGet<WebModeChange>(KV).catch(() => undefined)) ?? null;
  return {
    mode: (WEB_MODES as readonly string[]).includes(String(s.mode)) ? (s.mode as WebMode) : null,
    turns: s.turns ?? null, escalated: s.escalated ?? null, failed: s.failed ?? null, lastAt: s.lastAt ?? null, changed,
  };
}

/** Admins: switch who sees the chat; the change is kept with its author (the previous one under chat:webmode:log:*). */
export async function setWebMode(input: unknown, by: string): Promise<WebModeState> {
  const mode = String(input ?? "");
  if (!(WEB_MODES as readonly string[]).includes(mode)) throw new Error("Off, acceptance only, preview or live?");
  await gateway<{ ok: boolean; mode: string }>("/chat/web-mode", { method: "PUT", body: { mode } });
  const change: WebModeChange = { mode: mode as WebMode, by, at: new Date().toISOString() };
  await kvSet(`${KV}:log:${change.at}`, change);
  await kvSet(KV, change);
  return webMode();
}
