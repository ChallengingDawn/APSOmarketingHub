// APSOconvert > Ship to Magento: WHICH STORE VIEW A CMS PAGE'S UPDATE GOES THROUGH. Pure (tests/convert-blocks.test.ts).
//
// 3b, 11.11.2026, from the Page builder's first production writes: production refuses PUT /rest/all/V1/cmsPage/<id>
// with a 403 whose body is the shop's home page (its firewall), while PUT /rest/<store view code>/V1/cmsPage/<id> goes
// through; ACC takes both. So an update goes through the page's own store view - when it has exactly one. A page set
// for "All Store Views" (0) or for several is never written through one of them (Magento could give it that store
// alone): it stays on "all", and on production that write is refused rather than narrowing the page.

import { STORE_VIEWS } from "../content/studio/kinds/page/storeViews";

export function updateStore(storeIds: unknown): string {
  const ids = (Array.isArray(storeIds) ? storeIds : [storeIds]).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0);
  if (ids.length !== 1 || ids[0] === 0) return "all";
  return STORE_VIEWS.find((v) => v.id === ids[0])?.code ?? "all";
}
