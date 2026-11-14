// WHAT THE HUB KNOWS OF A CAMPAIGN THE PERSON NAMES - pure, for the project's AI proposal (./start.ts) and the tests.
// Its dates come from the Page builder's voucher module data (written by black-friday-2026/tools/gen_bf_page.py), so the
// brief and the shop's page never disagree.
import { BF26_VOUCHER_END, BF26_VOUCHER_START } from "./studio/kinds/page/modules/lib/bf26voucher.data";

/** A campaign the person names brings what the hub knows of it (14.11.2026: a Black Friday project got the brand's everyday
 * line "no countdown, no badges" as its key message and its own name as its goal) - its dates from the voucher's own data
 * (the Page builder's module), its offer, what the material never says. */
export function campaignFacts(words: string): string {
  if (!/black[\s-]?friday/i.test(words)) return "";
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
  // the end is the first moment it is over: its last day is the day before
  return `THE CAMPAIGN NAMED - Black Friday 2026, as the shop runs it: from ${day(Date.parse(BF26_VOUCHER_START))} to ${day(Date.parse(BF26_VOUCHER_END) - 1)}. The offer is each company's OWN voucher code, shown after login on the shop's Black Friday page (registered business customers; a new customer registers first). The material never names a discount figure, a "%" or a price - it speaks of "your company's personal Black Friday offer". The Page builder has the campaign's own modules (the poster, the % made of parts, a customer quote, the voucher).`;
}
