// A/B TEST: THE E-MAIL BEFORE THE CHAT - the figures, pure (SARCLA 27.10.2026: "the target is to measure if we lose
// customers by asking the e-mail from the start; if positive we make it mandatory - it improves our lead acquisition").
// The shop chat's gateway (chatab.ts) counts per country and variant: visitors who opened the chat, e-mails given,
// visitors who wrote at least one message, hand-overs. Two questions, each with a two-sided test of two proportions:
//   - do we lose chats?   chats / visitors, e-mail first against e-mail later;
//   - do we gain leads?   e-mails / visitors, the same;
// and a verdict in words. No imports: the tests load it as is.

export type Variant = "first" | "later";
export type AbRow = { country: string | null; variant: Variant; visitors: number; emails: number; emails_first: number; chats: number; chats_with_email: number; handovers: number };
export type Arm = { visitors: number; emails: number; chats: number; chatsWithEmail: number; handovers: number };
export type Rate = { first: number | null; later: number | null; diff: number | null; p: number | null };
export type Verdict = "too-early" | "mandatory" | "keep-later" | "no-difference";
export type Comparison = { country: string; first: Arm; later: Arm; chatRate: Rate; emailRate: Rate; verdict: Verdict };

/** visitors per variant before a verdict is given (fewer: "too early") */
export const MIN_VISITORS = 50;
const SIG = 0.05;

/** The standard normal's cumulative distribution (Abramowitz-Stegun 7.1.26, error < 1.5e-7). */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Two-sided p-value that two proportions differ (pooled z-test); null when either side has nobody or nothing varies. */
export function twoProportionP(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  const z = (x1 / n1 - x2 / n2) / se;
  return 2 * (1 - phi(Math.abs(z)));
}

const rate = (x: number, n: number) => (n > 0 ? x / n : null);
function rateOf(a: number, an: number, b: number, bn: number): Rate {
  const first = rate(a, an), later = rate(b, bn);
  return { first, later, diff: first !== null && later !== null ? first - later : null, p: twoProportionP(a, an, b, bn) };
}

/**
 * The verdict: too early under MIN_VISITORS per variant; "keep-later" when asking first clearly loses chats; "mandatory"
 * when it does not clearly lose chats and clearly brings more e-mails; else no clear difference yet.
 */
export function verdictOf(first: Arm, later: Arm, chat: Rate, email: Rate): Verdict {
  if (first.visitors < MIN_VISITORS || later.visitors < MIN_VISITORS) return "too-early";
  const losesChats = chat.p !== null && chat.p < SIG && (chat.diff ?? 0) < 0;
  if (losesChats) return "keep-later";
  const moreLeads = email.p !== null && email.p < SIG && (email.diff ?? 0) > 0;
  return moreLeads ? "mandatory" : "no-difference";
}

const empty = (): Arm => ({ visitors: 0, emails: 0, chats: 0, chatsWithEmail: 0, handovers: 0 });
function add(a: Arm, r: AbRow): Arm {
  return { visitors: a.visitors + r.visitors, emails: a.emails + r.emails, chats: a.chats + r.chats, chatsWithEmail: a.chatsWithEmail + r.chats_with_email, handovers: a.handovers + r.handovers };
}
function compareArms(country: string, first: Arm, later: Arm): Comparison {
  const chatRate = rateOf(first.chats, first.visitors, later.chats, later.visitors);
  const emailRate = rateOf(first.emails, first.visitors, later.emails, later.visitors);
  return { country, first, later, chatRate, emailRate, verdict: verdictOf(first, later, chatRate, emailRate) };
}

/** Per country (as the gateway counted it, "INT" for a page without a country), and "All" first. */
export function compare(rows: AbRow[]): Comparison[] {
  const by = new Map<string, { first: Arm; later: Arm }>();
  const all = { first: empty(), later: empty() };
  for (const r of rows) {
    const c = r.country || "INT";
    const e = by.get(c) ?? { first: empty(), later: empty() };
    e[r.variant] = add(e[r.variant], r);
    all[r.variant] = add(all[r.variant], r);
    by.set(c, e);
  }
  return [compareArms("All", all.first, all.later), ...[...by].sort((a, b) => a[0].localeCompare(b[0])).map(([c, e]) => compareArms(c, e.first, e.later))];
}
