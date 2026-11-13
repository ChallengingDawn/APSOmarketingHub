// A/B TEST: THE E-MAIL IN THE CHAT - the figures, pure (SARCLA 27.10.2026: "the target is to measure if we lose
// customers by asking the e-mail from the start; if positive we make it mandatory - it improves our lead acquisition").
// Version 3 (13.11.2026): a third variant, "mid" - the summary of the conversation offered by e-mail after the AI's 2nd
// answer - and the absolute numbers ("how many e-mails do we get in absolute value in each case?").
//
// The shop chat's gateway (chatab.ts) counts per country and variant: visitors who opened the chat, e-mails given,
// visitors who wrote at least one message, both, hand-overs, and for "mid" the card shown and the summaries asked.
// Every rate is per visitor who OPENED the chat, with its 95% range (Wilson). Each challenger (first, mid) is compared
// with today's chat (later) by a two-sided test of two proportions:
//   - does it lose chats?   wrote / opened
//   - does it bring leads?  gave an e-mail / opened
// and a verdict in words. No imports: the tests load it as is.

export type Variant = "first" | "later" | "mid";
/** today's chat first (the baseline), then the challengers */
export const VARIANTS: Variant[] = ["later", "first", "mid"];
export const CHALLENGERS: Exclude<Variant, "later">[] = ["first", "mid"];
export const VARIANT_LABEL: Record<Variant, string> = { later: "E-mail later (today)", first: "E-mail first", mid: "Summary mid-chat" };
export const VARIANT_SHORT: Record<Variant, string> = { later: "Later", first: "First", mid: "Summary" };
export const VARIANT_HOW: Record<Variant, string> = {
  later: "today's chat: nothing asked at the start, the AI asks for the e-mail when it needs it",
  first: "a dark screen asks for the e-mail before anything can be written",
  mid: "nothing asked at the start; after the AI's 2nd answer a card offers the conversation's summary by e-mail",
};

export type AbRow = {
  country: string | null; variant: Variant; visitors: number; emails: number; emails_first: number; chats: number; chats_with_email: number; handovers: number;
  /** version 3 - absent on rows a gateway from before it counted */
  emails_mid?: number; emails_typed?: number; asked?: number; summaries?: number;
};
export type Arm = { visitors: number; chats: number; emails: number; chatsWithEmail: number; handovers: number; asked: number; summaries: number; emailsFirst: number; emailsMid: number; emailsTyped: number };
/** x of n, its rate and the 95% range around it */
export type Rate = { x: number; n: number; rate: number | null; lo: number | null; hi: number | null };
/** a challenger against today's chat: the difference in rate (challenger - later) and its p-value */
export type Test = { diff: number | null; p: number | null };
export type ArmFigures = { arm: Arm; wrote: Rate; email: Rate; lead: Rate; handover: Rate };
export type Verdict = "too-early" | "keep-later" | "go-first" | "go-mid" | "no-difference";
export type Comparison = {
  country: string;
  /** the variants that had visitors here, today's chat first */
  variants: Variant[];
  arms: Record<Variant, ArmFigures>;
  /** per challenger (only those with visitors), against "later" */
  tests: Partial<Record<"first" | "mid", { wrote: Test; email: Test }>>;
  verdict: Verdict;
};

/** visitors per variant before a verdict is given (fewer: "too early") */
export const MIN_VISITORS = 50;
/** a country's arm under this many visitors is shown, but greyed - too few to read */
export const FEW = 30;
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

/** x of n with its 95% Wilson range - honest at small n and near 0 or 100%, unlike rate ± 1.96·se. */
export function rateOf(x: number, n: number): Rate {
  if (n <= 0) return { x, n, rate: null, lo: null, hi: null };
  const z = 1.96, p = x / n, z2 = z * z;
  const mid = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { x, n, rate: p, lo: Math.max(0, mid - half), hi: Math.min(1, mid + half) };
}

function testOf(a: Rate, b: Rate): Test {
  return { diff: a.rate !== null && b.rate !== null ? a.rate - b.rate : null, p: twoProportionP(a.x, a.n, b.x, b.n) };
}

const clearly = (t: Test | undefined, sign: 1 | -1) => !!t && t.p !== null && t.p < SIG && (t.diff ?? 0) * sign > 0;

/**
 * The verdict, against today's chat: too early while a variant in the round has fewer than MIN_VISITORS; else the
 * challenger that does NOT clearly lose chats and clearly brings more e-mails (the one with more e-mails if both do);
 * else "keep-later" when a challenger clearly loses chats; else no clear difference yet.
 */
export function verdictOf(c: Pick<Comparison, "variants" | "arms" | "tests">): Verdict {
  if (c.variants.length < 2 || !c.variants.includes("later") || c.variants.some((v) => c.arms[v].arm.visitors < MIN_VISITORS)) return "too-early";
  const winners = CHALLENGERS.filter((v) => c.tests[v] && !clearly(c.tests[v]!.wrote, -1) && clearly(c.tests[v]!.email, 1))
    .sort((a, b) => (c.arms[b].email.rate ?? 0) - (c.arms[a].email.rate ?? 0));
  if (winners[0]) return winners[0] === "first" ? "go-first" : "go-mid";
  if (CHALLENGERS.some((v) => clearly(c.tests[v]?.wrote, -1))) return "keep-later";
  return "no-difference";
}

const empty = (): Arm => ({ visitors: 0, chats: 0, emails: 0, chatsWithEmail: 0, handovers: 0, asked: 0, summaries: 0, emailsFirst: 0, emailsMid: 0, emailsTyped: 0 });
function add(a: Arm, r: AbRow): Arm {
  return {
    visitors: a.visitors + r.visitors, chats: a.chats + r.chats, emails: a.emails + r.emails, chatsWithEmail: a.chatsWithEmail + r.chats_with_email,
    handovers: a.handovers + r.handovers, asked: a.asked + (r.asked ?? 0), summaries: a.summaries + (r.summaries ?? 0),
    emailsFirst: a.emailsFirst + r.emails_first, emailsMid: a.emailsMid + (r.emails_mid ?? 0), emailsTyped: a.emailsTyped + (r.emails_typed ?? 0),
  };
}
function figures(arm: Arm): ArmFigures {
  return { arm, wrote: rateOf(arm.chats, arm.visitors), email: rateOf(arm.emails, arm.visitors), lead: rateOf(arm.chatsWithEmail, arm.visitors), handover: rateOf(arm.handovers, arm.visitors) };
}
function compareArms(country: string, arms: Record<Variant, Arm>): Comparison {
  const f = { later: figures(arms.later), first: figures(arms.first), mid: figures(arms.mid) };
  const variants = VARIANTS.filter((v) => arms[v].visitors > 0);
  const tests: Comparison["tests"] = {};
  if (arms.later.visitors > 0) {
    for (const v of CHALLENGERS) if (arms[v].visitors > 0) tests[v] = { wrote: testOf(f[v].wrote, f.later.wrote), email: testOf(f[v].email, f.later.email) };
  }
  const c = { country, variants, arms: f, tests };
  return { ...c, verdict: verdictOf(c) };
}

const isVariant = (v: string): v is Variant => (VARIANTS as string[]).includes(v);

/** Per country (as the gateway counted it, "INT" for a page without a country), and "All" first. */
export function compare(rows: AbRow[]): Comparison[] {
  const blank = () => ({ later: empty(), first: empty(), mid: empty() });
  const by = new Map<string, Record<Variant, Arm>>();
  const all = blank();
  for (const r of rows) {
    if (!isVariant(r.variant)) continue;
    const c = r.country || "INT";
    const e = by.get(c) ?? blank();
    e[r.variant] = add(e[r.variant], r);
    all[r.variant] = add(all[r.variant], r);
    by.set(c, e);
  }
  return [compareArms("All", all), ...[...by].sort((a, b) => a[0].localeCompare(b[0])).map(([c, e]) => compareArms(c, e))];
}

/** The gateway's per-day counts, made cumulative per variant - the e-mails (and chats, visitors) collected so far. */
export type DayRow = { variant: string; day: string; visitors: number; chats: number; emails: number };
export type CumPoint = { day: string } & Partial<Record<`${Variant}_${"visitors" | "chats" | "emails"}`, number>>;
export function cumulative(days: DayRow[], variants: Variant[]): CumPoint[] {
  const sorted = [...new Set(days.map((d) => d.day))].sort();
  const run: Record<string, number> = {};
  return sorted.map((day) => {
    const p: CumPoint = { day };
    for (const v of variants) {
      for (const k of ["visitors", "chats", "emails"] as const) {
        const got = days.filter((d) => d.day === day && d.variant === v).reduce((s, d) => s + Number(d[k] || 0), 0);
        const key = `${v}_${k}` as const;
        run[key] = (run[key] ?? 0) + got;
        p[key] = run[key];
      }
    }
    return p;
  });
}
