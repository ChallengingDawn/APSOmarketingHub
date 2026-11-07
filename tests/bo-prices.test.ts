import { test } from "node:test";
import assert from "node:assert/strict";
import { addDelivery, baseOf, comparePrices, dayOf, figOf, handRows, handShare, ownPriceCustomers, priceChanged, shopOrderOf, type ErpOrder } from "../src/lib/reporting/boPrices";

test("order numbers and days", () => {
  assert.deepEqual(baseOf("A26.648373.000 | Ana | Acme AG"), ["A26.648373", "000"]);
  assert.deepEqual(baseOf("A26.648373.002"), ["A26.648373", "002"]);
  assert.equal(baseOf("Magento order (10000156325) - to be overwritten"), null);
  assert.equal(dayOf("2026-03-04"), "2026-03-04");
  assert.equal(dayOf(String(Date.UTC(2026, 2, 4))), "2026-03-04");
  assert.equal(dayOf(""), "");
});

test("a price per piece changed: 0.5 % or 5 cents, on the pieces invoiced", () => {
  assert.equal(priceChanged({ q: 1000, r: 186.7 }, { q: 1000, r: 186.7 }), false);
  assert.equal(priceChanged({ q: 1000, r: 186.7 }, { q: 333, r: 62.17 }), false); // a part delivery, rounded
  assert.equal(priceChanged({ q: 10, r: 97.4 }, { q: 10, r: 90 }), true);
  assert.equal(priceChanged({ q: 1, r: 4 }, { q: 1, r: 4.04 }), false); // 4 cents
  assert.equal(priceChanged({ q: 1, r: 400 }, { q: 1, r: 403 }), true); // 0.75 %
});

const shop = (n: string, day: string, lines: [string, number, number][], extra: Record<string, string> = {}, company = "Acme AG") => {
  const p: Record<string, string> = { hs_external_order_id: "10000" + n.slice(-3), hs_order_name: `${n}.000 | Ana | ${company}`, order_order_date: day, hs_currency_code: "CHF", ...extra };
  lines.forEach(([a, q, r], i) => { const k = `order_line_${String(i + 1).padStart(2, "0")}_`; p[k + "article"] = a; p[k + "qty"] = String(q); p[k + "revenue"] = String(r); });
  return p;
};
const delivery = (n: string, sfx: string, pos: [string, number, number][], mandant = "100") =>
  ({ hs_order_name: `${n}.${sfx} | Ana | Acme AG`, order_mandant: mandant, order_positions_json: JSON.stringify(pos.map(([a, q, r]) => ({ a, q, r, gm: null, pc: "KT", t: "" }))) });

test("what is a web order, and the deliveries folded by article", () => {
  assert.equal(shopOrderOf(delivery("A26.1", "001", [["x", 1, 1]])), null);
  assert.equal(shopOrderOf({ ...shop("A26.2", "2026-03-04", [["x", 1, 1]]), hs_external_order_id: "" }), null);
  const s = shopOrderOf(shop("A26.3", "2026-03-04", [["x", 2, 10], ["y", 1, 0]]))!;
  assert.equal(s.base, "A26.3"); assert.equal(s.mandant, "100"); assert.equal(s.company, "Acme AG"); assert.equal(s.lines.size, 2); assert.equal(s.coupon, false);
  assert.equal(shopOrderOf(shop("A26.4", "2026-03-04", [["x", 1, 1]], { hs_order_discount: "-12.5" }))!.coupon, true);
  const erp = new Map<string, ErpOrder>();
  addDelivery(erp, delivery("A26.3", "001", [["x", 1, 5]]));
  addDelivery(erp, delivery("A26.3", "002", [["x", 1, 5], ["fee", 1, 30]]));
  assert.deepEqual(erp.get("A26.3")!.lines.get("x"), { q: 2, r: 10 });
  assert.equal(erp.get("A26.3")!.company, "Acme AG");
});

test("by hand, the customer's own price, coupons and the biggest changes", () => {
  const shops = [
    shop("A26.10", "2026-03-02", [["a", 10, 100], ["b", 1, 0]]),                       // a unchanged, b priced from 0 -> hand
    shop("A26.11", "2026-03-09", [["a", 10, 100]]),                                     // a 20 % lower -> hand
    shop("A26.12", "2026-03-10", [["a", 10, 100]]),                                     // untouched
    shop("A26.13", "2026-04-01", [["a", 5, 50], ["gone", 1, 9]], { hs_currency_code: "EUR" }), // higher, a line the ERP lacks
    shop("A26.14", "2026-04-02", [["a", 1, 10]], { hs_discount_codes: "BF26-X" }),      // a coupon: left out
    shop("A26.15", "2026-04-03", [["a", 1, 10]]),                                       // no deliveries yet
    shop("A26.20", "2026-03-11", [["a", 10, 100], ["c", 2, 50]], {}, "Own AG"),         // 6 % lower on every line, twice -> own price
    shop("A26.21", "2026-04-11", [["a", 10, 100]], {}, "Own AG"),
    shop("A26.30", "2026-03-12", [["a", 10, 100]], {}, "Once AG"),                      // 6 % lower once -> hand
    shop("A26.31", "2026-03-13", [["p", 5, 211]]),                                      // 5 packs in the shop, 20 pieces in the ERP: not compared
  ].map((p) => shopOrderOf(p)!);
  const erp = new Map<string, ErpOrder>();
  addDelivery(erp, delivery("A26.10", "001", [["a", 10, 100], ["b", 1, 25]]));
  addDelivery(erp, delivery("A26.11", "001", [["a", 10, 80]]));
  addDelivery(erp, delivery("A26.12", "001", [["a", 10, 100], ["fee", 1, 30]]));
  addDelivery(erp, delivery("A26.13", "001", [["a", 5, 60]], "110"));
  addDelivery(erp, delivery("A26.14", "001", [["a", 1, 8]]));
  addDelivery(erp, delivery("A26.20", "001", [["a", 10, 94], ["c", 2, 47]]));
  addDelivery(erp, delivery("A26.21", "001", [["a", 10, 94]]));
  addDelivery(erp, delivery("A26.30", "001", [["a", 10, 94]]));
  addDelivery(erp, delivery("A26.31", "001", [["p", 20, 211.05]]));
  const months = comparePrices(shops, erp);
  const mar = months["100"]["2026-03"];
  assert.equal(mar.o, 5); assert.equal(mar.l, 7); assert.equal(mar.qd, 1); assert.equal(mar.hl, 2); assert.equal(mar.ho, 2); assert.equal(mar.z, 1); assert.equal(mar.dn, 1); assert.equal(mar.extra, 1);
  assert.deepEqual(mar.band, { "Own AG": [2, 1, 1], "Once AG": [1, 1, 1] });
  assert.equal(months["100"]["2026-04"].cpn, 1);
  assert.equal(months["110"]["2026-04"].miss, 1);
  const k = { v: 1, at: "", months };
  const own = ownPriceCustomers(k);
  assert.deepEqual([...own], ["Own AG"]);
  const f = figOf([mar, months["100"]["2026-04"]], own);
  // March: A26.10, A26.11 and Once AG by hand; Own AG's two orders its own price; April: Own AG again
  assert.deepEqual({ o: f.o, handO: f.handO, ownO: f.ownO, handL: f.handL, ownL: f.ownL, cpn: f.cpn, qd: f.qd }, { o: 6, handO: 3, ownO: 2, handL: 3, ownL: 3, cpn: 1, qd: 1 });
  assert.equal(handShare(f), 3 / 6);
  assert.deepEqual(handRows([mar], own).map((r) => r[0]), ["A26.10", "A26.11", "A26.30"]); // 25, 20, 6 off; Own AG left out
});
