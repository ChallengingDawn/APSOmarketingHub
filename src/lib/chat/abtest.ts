// A/B TEST of the e-mail before the chat - the hub's side: the setting and the figures live on the shop chat's gateway
// (DirectUp Gateway, chatab.ts); the hub reads and changes them through the gateway's admin API (DIRECTUP_ADMIN_KEY)
// and works out the comparison (abStats.ts).

import { gateway } from "@/lib/directup/gateway";
import { compare, type AbRow, type Comparison } from "./abStats";

export const AB_COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"] as const;
export type AbSetting = { on: boolean; countries: string[]; split: number; v: number; by: string | null; at: string | null };
export type AbData = { setting: AbSetting; v: number; rows: AbRow[]; comparisons: Comparison[]; firstAt: string | null; lastAt: string | null };

export async function abData(): Promise<AbData> {
  const setting = await gateway<AbSetting>("/api/admin/chat/ab");
  const r = await gateway<{ v: number; rows: (AbRow & { first_at: string | null; last_at: string | null })[] }>(`/api/admin/chat/ab-results?v=${setting.v}`);
  const rows = r.rows.map((x) => ({ ...x, visitors: Number(x.visitors), emails: Number(x.emails), emails_first: Number(x.emails_first), chats: Number(x.chats), chats_with_email: Number(x.chats_with_email), handovers: Number(x.handovers) }));
  const firsts = r.rows.map((x) => x.first_at).filter((x): x is string => !!x).sort();
  const lasts = r.rows.map((x) => x.last_at).filter((x): x is string => !!x).sort();
  return { setting, v: r.v, rows, comparisons: compare(rows), firstAt: firsts[0] ?? null, lastAt: lasts.at(-1) ?? null };
}

/** Admins: switch the test, its countries and the share asked first; restart = count again from zero (a new version). */
export async function saveAb(input: unknown, by: string): Promise<AbSetting> {
  const b = (input ?? {}) as Record<string, unknown>;
  const countries = Array.isArray(b.countries) ? b.countries.map(String).filter((c) => (AB_COUNTRIES as readonly string[]).includes(c)) : [];
  const split = Math.round(Number(b.split));
  if (typeof b.on !== "boolean") throw new Error("On or off?");
  if (!Number.isFinite(split) || split < 0 || split > 100) throw new Error("The share asked first goes from 0 to 100 %.");
  if (b.on && !countries.length) throw new Error("Pick at least one country for the test.");
  return gateway<AbSetting>("/api/admin/chat/ab", { method: "PUT", body: { on: b.on, countries, split, restart: b.restart === true, by } });
}
