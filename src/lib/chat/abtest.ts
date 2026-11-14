// A/B TEST of the e-mail in the chat - the hub's side: the setting and the figures live on the shop chat's gateway
// (DirectUp Gateway, chatab.ts); the hub reads and changes them through the gateway's admin API (DIRECTUP_ADMIN_KEY)
// and works out the comparison (abStats.ts). The client (directup/gateway.ts) puts /api/admin in front of every path,
// so the paths here start at /chat. Version 3 (13.11.2026): three variants with a share each, earlier rounds readable,
// the e-mails per day, and the summaries the hub sends (summaryMail.ts).

import { gateway } from "@/lib/directup/gateway";
import { compare, cumulative, VARIANTS, type AbRow, type Comparison, type CumPoint, type DayRow, type Variant } from "./abStats";

export const AB_COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "NL", "PL", "INT"] as const;
export type Shares = Record<Variant, number>;
export type AbSetting = { on: boolean; countries: string[]; split: number; shares?: Shares; v: number; by: string | null; at: string | null };
export type Round = { v: number; visitors: number; variants: string[]; first_at: string | null; last_at: string | null };
export type Summaries = { waiting: number; sent: number; failed: number; skipped: number };
export type AbData = {
  setting: AbSetting & { shares: Shares };
  /** the round shown (the current one unless asked) */
  v: number; rounds: Round[];
  rows: AbRow[]; comparisons: Comparison[]; cum: CumPoint[]; summaries: Summaries;
  firstAt: string | null; lastAt: string | null;
};

const sharesOf = (s: AbSetting): Shares => s.shares ?? { first: s.split, later: 100 - s.split, mid: 0 };
const num = (x: unknown) => Number(x ?? 0) || 0;

export async function abData(round?: number | null): Promise<AbData> {
  const setting = await gateway<AbSetting>("/chat/ab");
  const v = round && round > 0 ? round : setting.v;
  const [r, rounds] = await Promise.all([
    gateway<{ v: number; rows: (AbRow & { first_at: string | null; last_at: string | null })[]; days?: DayRow[]; summaries?: Summaries }>(`/chat/ab-results?v=${v}`),
    // a gateway from before version 3 has no list of rounds: the current one alone
    gateway<{ current: number; rounds: Round[] }>("/chat/ab-rounds").catch(() => ({ current: setting.v, rounds: [] as Round[] })),
  ]);
  const rows: AbRow[] = r.rows.map((x) => ({
    ...x, visitors: num(x.visitors), emails: num(x.emails), emails_first: num(x.emails_first), chats: num(x.chats), chats_with_email: num(x.chats_with_email),
    handovers: num(x.handovers), emails_mid: num(x.emails_mid), emails_typed: num(x.emails_typed), asked: num(x.asked), summaries: num(x.summaries),
  }));
  const comparisons = compare(rows);
  const firsts = r.rows.map((x) => x.first_at).filter((x): x is string => !!x).sort();
  const lasts = r.rows.map((x) => x.last_at).filter((x): x is string => !!x).sort();
  // the gateway lists a round once it has a visitor: the current one is always in the list, from the moment it was
  // started (SARCLA 14.11.2026 - round 4 without a visitor hid the rounds, "don't have navigation here")
  const shares = sharesOf(setting);
  const current: Round = { v: setting.v, visitors: 0, variants: VARIANTS.filter((x) => shares[x] > 0), first_at: setting.at, last_at: null };
  const list = rounds.rounds.length
    ? (rounds.rounds.some((x) => Number(x.v) === setting.v) ? rounds.rounds : [current, ...rounds.rounds])
    : [{ ...current, visitors: comparisons[0].variants.reduce((s, x) => s + comparisons[0].arms[x].arm.visitors, 0), first_at: firsts[0] ?? setting.at, last_at: lasts.at(-1) ?? null }];
  return {
    setting: { ...setting, shares: sharesOf(setting) }, v: r.v, rounds: list.map((x) => ({ ...x, v: num(x.v), visitors: num(x.visitors) })),
    rows, comparisons, cum: cumulative(r.days ?? [], VARIANTS.filter((x) => comparisons[0].variants.includes(x))),
    summaries: r.summaries ?? { waiting: 0, sent: 0, failed: 0, skipped: 0 },
    firstAt: firsts[0] ?? null, lastAt: lasts.at(-1) ?? null,
  };
}

/** Admins: switch the test, its countries and each variant's share; restart = count again from zero (a new round). */
export async function saveAb(input: unknown, by: string): Promise<AbSetting> {
  const b = (input ?? {}) as Record<string, unknown>;
  const countries = Array.isArray(b.countries) ? b.countries.map(String).filter((c) => (AB_COUNTRIES as readonly string[]).includes(c)) : [];
  if (typeof b.on !== "boolean") throw new Error("On or off?");
  let shares: Shares;
  if (b.shares && typeof b.shares === "object") {
    const s = b.shares as Record<string, unknown>;
    shares = { first: Math.round(num(s.first)), later: Math.round(num(s.later)), mid: Math.round(num(s.mid)) };
  } else {
    const split = Math.round(Number(b.split));
    if (!Number.isFinite(split)) throw new Error("Give each variant's share.");
    shares = { first: split, later: 100 - split, mid: 0 };
  }
  if (Object.values(shares).some((x) => x < 0 || x > 100) || shares.first + shares.later + shares.mid !== 100) throw new Error("The three shares go from 0 to 100 % and add up to 100 %.");
  if (b.on && !countries.length) throw new Error("Pick at least one country for the test.");
  return gateway<AbSetting>("/chat/ab", { method: "PUT", body: { on: b.on, countries, shares, split: shares.first, restart: b.restart === true, by } });
}
