// THE ONE SCRIPT A CHANGE MAY CARRY (13.11.2026). Pure: tests/studio-page-bf26-voucher.test.ts.
//
// A version, a change of the Page builder, a module: none carries a script (./versions.ts unsafeHtml) - the same changes
// drive the A/B tests every visitor of the shop sees. SARCLA 13.11.2026 asked for the Black Friday voucher as a module of
// the Page builder with its logic where it is (the Ads Gateway on Railway hands out each company's code). Its engine -
// the countdown, the carousel, asking the gateway after login - is one file of the hub, stored in the hub's own picture
// storage at Publish (never served from Railway: dev-eb's review - Railway was breached on 21.10). The ONE tag that loads
// it is let through, EXACTLY as written (its file's name is its content's hash: a changed engine is a new tag), nothing else.
// Note: in an A/B version the shop's runtime puts HTML in with innerHTML, where a script never runs - the voucher stays
// as a visitor sees it before login; it works on a page the Page builder published (Magento serves it as the page).

import { BF26_VOUCHER_TAG } from "../content/studio/kinds/page/modules/lib/bf26voucher.data";

/** The script tags a change may carry - each EXACTLY as written. */
export const TRUSTED_SCRIPT_TAGS: readonly string[] = [BF26_VOUCHER_TAG];

/** The HTML without the trusted tags (what is left is checked as always). */
export function withoutTrustedScripts(html: string): string {
  let out = html;
  for (const t of TRUSTED_SCRIPT_TAGS) out = out.split(t).join("");
  return out;
}
