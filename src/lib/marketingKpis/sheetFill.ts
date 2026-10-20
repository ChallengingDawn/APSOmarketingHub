// WHAT THE HUB PROPOSES FOR DASHBOARD 2026'S TYPED ROWS - pure (the reads are in live.ts). SARCLA 20.10.2026:
// "this should be fully filled" - the four rows still typed by hand:
//   K02 cart abandonment       GA4: sessions with an add to cart that had no begin check-out / sessions with an add to cart
//   K03 check-out abandonment  GA4: sessions with a begin check-out that had no purchase / sessions with a begin check-out
//                              (he chose: from Google Analytics, compared with his typed months before they replace them)
//   X01 SEA cost               Google Ads' cost (GA4's Ads link, in francs) + Microsoft Ads' cost (its script's sheet)
//   P05 SEA revenue            the ad platforms' own conversion value - Google Ads' and Microsoft Ads' scripts write it
//                              into the sheet (he chose: "Ads platforms' own value"; GA4 sees only the visitors who
//                              accepted statistics cookies, far below what he types)
// All money in francs, as the sheet has it.

import { rateFor, type ChfPerEur } from "./fxRates";

export type Monthly = { months: (number | null)[]; py: (number | null)[] };
export const emptyMonthly = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });

/** The month's side and index for this year and last, or null. */
export function slotOf(month: string, year: number): { side: "months" | "py"; i: number } | null {
  const y = Number(month.slice(0, 4)), i = Number(month.slice(5, 7)) - 1;
  if (!(i >= 0 && i < 12)) return null;
  return y === year ? { side: "months", i } : y === year - 1 ? { side: "py", i } : null;
}

/** An amount in francs: as it is when it is francs, euros at the month's rate, nothing for another currency. */
export function toChf(amount: number, currency: string | null | undefined, month: string, fx: ChfPerEur): number | null {
  const c = (currency ?? "CHF").slice(0, 3).toUpperCase();
  if (c === "CHF") return amount;
  if (c === "EUR") { const r = rateFor(fx, month); return r ? amount * r : null; }
  return null;
}

/**
 * The two abandonment rates per month from GA4's sessions per step ("202609", event, sessions): of the
 * sessions that put something in the cart, those that never began the check-out; of those that began it,
 * those that never bought. A month without the earlier step has no rate.
 */
export function funnelRates(rows: { ym: string; event: string; sessions: number }[], year: number): { K02G: Monthly; K03G: Monthly } {
  const per = new Map<string, { cart: number; checkout: number; purchase: number }>();
  for (const r of rows) {
    const m = /^\d{6}$/.test(r.ym) ? `${r.ym.slice(0, 4)}-${r.ym.slice(4, 6)}` : r.ym.slice(0, 7);
    const e = per.get(m) ?? { cart: 0, checkout: 0, purchase: 0 };
    if (r.event === "add_to_cart") e.cart += r.sessions;
    else if (r.event === "begin_checkout") e.checkout += r.sessions;
    else if (r.event === "purchase") e.purchase += r.sessions;
    per.set(m, e);
  }
  const out = { K02G: emptyMonthly(), K03G: emptyMonthly() };
  for (const [m, e] of per) {
    const at = slotOf(m, year);
    if (!at) continue;
    if (e.cart > 0) out.K02G[at.side][at.i] = Math.max(0, (e.cart - e.checkout) / e.cart);
    if (e.checkout > 0) out.K03G[at.side][at.i] = Math.max(0, (e.checkout - e.purchase) / e.checkout);
  }
  return out;
}

/**
 * Google and Microsoft added up per month - only a month that has both, so a missing half never passes for the
 * whole (until a script is set up the row stays empty rather than showing Google alone).
 */
export function bothPlatforms(google: Record<string, number>, microsoft: Record<string, number>, year: number): Monthly {
  const out = emptyMonthly();
  for (const [m, g] of Object.entries(google)) {
    const ms = microsoft[m];
    const at = slotOf(m, year);
    if (!at || ms == null) continue;
    out[at.side][at.i] = g + ms;
  }
  return out;
}
