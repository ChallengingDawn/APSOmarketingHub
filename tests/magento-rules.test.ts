import assert from "node:assert/strict";
import { test } from "node:test";
import { ERP_OWNED_AFTER_LINK, erpLinked, mayNotCreate, orderSkus, provisionalProps, same, validate, writableProps, type MagentoOrder } from "../src/lib/connectors/magento/rules";
import { erpOwned, fieldNames } from "../src/lib/connectors/magento/fields";
import { provisionalProps as legacy } from "./fixtures/magentoLegacy";

const PIPE = { pipelineId: "3687945443", pipelineStage: "5093087452" };

// a small deterministic generator - the same orders on every run
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function pick<T>(r: () => number, xs: T[]): T { return xs[Math.floor(r() * xs.length)]; }

function order(r: () => number, i: number): MagentoOrder {
  const maybe = <T,>(v: T): T | undefined | null | "" => pick(r, [v, v, v, undefined, null, ""]) as T | undefined | null | "";
  const addr = () => ({
    company: maybe(pick(r, ["Lutz Pumpen GmbH", "Kraftwerke Hinterrhein AG", "Müller & Söhne"])),
    firstname: maybe(pick(r, ["Anna", "Jürg", "Marco"])), lastname: maybe(pick(r, ["Meier", "Rossi", "Huber"])),
    email: maybe("buyer@example.ch"), telephone: maybe("+41 44 000 00 00"),
    street: pick(r, [["Bahnhofstrasse 1", "Postfach"], "Dorfweg 3", undefined, []]),
    city: maybe("Zürich"), region: maybe("ZH"), postcode: maybe("8001"), country_id: maybe(pick(r, ["CH", "DE", "AT"])),
  });
  const nItems = pick(r, [0, 1, 2, 5, 85]);
  const items = Array.from({ length: nItems }, (_, k) => ({
    sku: pick(r, [`80${String(1000000 + k).slice(-8)}`, "8001228582", "", undefined]) as string | undefined,
    qty_ordered: pick(r, [1, 2.5, "3", null]),
    row_total: pick(r, [0, 12.5, "99.90", null]),
  }));
  const grand = pick(r, [0, 10, 250.5, "120.00"]);
  return {
    entity_id: 1000 + i,
    increment_id: pick(r, [20000063963 + i, `2000006${i}`, undefined, null]) as string | number | undefined,
    order_currency_code: pick(r, ["CHF", "EUR", "", undefined]),
    grand_total: grand, subtotal: maybe(100), tax_amount: maybe(8.1), shipping_amount: maybe(0), discount_amount: maybe(-5),
    coupon_code: maybe("WELCOME10"), weight: maybe(1.2), total_refunded: maybe(0),
    created_at: pick(r, ["2026-10-10 14:28:03", "2026-01-01 00:00:00", "", undefined, "not a date"]),
    updated_at: pick(r, ["2026-10-11 08:00:00", undefined]),
    status: maybe(pick(r, ["processing", "complete", "canceled", "transferred"])),
    payment: pick(r, [{ method: "datatranscw_creditcard" }, { method: "checkmo" }, undefined]),
    total_paid: pick(r, [0, grand, 5, undefined]),
    customer_firstname: maybe("Anna"), customer_lastname: maybe("Meier"), customer_email: maybe("anna.meier@example.ch"),
    billing_address: pick(r, [addr(), undefined]),
    extension_attributes: pick(r, [
      { shipping_assignments: [{ shipping: { address: addr() } }] },
      { shipping_assignments: [], erp_order_number: "A26.663280.000" },
      { erp_order_number: "  A26.663533.000 " },
      undefined,
    ]),
    total_qty_ordered: maybe(3), total_item_count: maybe(2),
    items,
  } as MagentoOrder;
}

test("the port maps 5,000 varied orders exactly as the old connector's own code", () => {
  const r = rng(20261011);
  let checked = 0;
  for (let i = 0; i < 5000; i++) {
    const o = order(r, i);
    assert.deepEqual(provisionalProps(o, PIPE), JSON.parse(JSON.stringify(legacy(o))), `order ${i}`);
    checked++;
  }
  assert.equal(checked, 5000);
});

test("validate and the article list match the old rules", () => {
  assert.equal(validate({}), "missing web order number");
  assert.equal(validate({ hs_external_order_id: "1" }), "missing order name");
  assert.equal(validate({ hs_external_order_id: "1", hs_order_name: "x" }), "missing currency");
  assert.equal(validate({ hs_external_order_id: "1", hs_order_name: "x", hs_currency_code: "CHF" }), null);
  assert.deepEqual(orderSkus({ items: [{ sku: "A" }, { sku: "A" }, { sku: "" }, { sku: "B" }] }), ["A", "B"]);
});

test("once the ERP linked an order, its ERP fields are never written again (the old connector's bug)", () => {
  const props = provisionalProps({
    increment_id: "20000063963", order_currency_code: "EUR", subtotal: 100, created_at: "2026-10-10 14:28:03",
    status: "complete", grand_total: 119, items: [{ sku: "8000123456", qty_ordered: 2, row_total: 100 }],
  }, PIPE);
  // a new order or one still provisional: everything goes
  assert.deepEqual(writableProps(props, null), props);
  assert.deepEqual(writableProps(props, { order_reconcile_state: "web_provisional" }), props);
  // linked by the A-number, or by the state: stage, date, revenue, mandant, quantity and lines stay the ERP's
  for (const linked of [{ order_order_number: "A26.663280.000" }, { order_reconcile_state: "erp_linked" }]) {
    assert.equal(erpLinked(linked), true);
    const w = writableProps(props, linked);
    for (const k of ERP_OWNED_AFTER_LINK) assert.equal(k in w, false, k);
    assert.equal(Object.keys(w).some((k) => k.startsWith("order_line_")), false);
    // the shop's own fields still go: status, totals, addresses, payment
    assert.equal(w.hs_external_order_status, "complete");
    assert.equal("hs_total_price" in w, false, "the ERP's net total stays");
    assert.equal(w.hs_subtotal_price, "100");
    assert.equal(w.hs_external_order_id, "20000063963");
  }
  assert.equal(erpLinked({ order_order_number: "web 123" }), false);
});

test("What it writes lists every property the sync can set, and nothing it does not", () => {
  const listed = new Set(fieldNames());
  const r = rng(11102026);
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) for (const k of Object.keys(provisionalProps(order(r, i), PIPE))) seen.add(k.replace(/^order_line_\d{2}_/, "order_line_NN_"));
  for (const k of seen) assert.ok(listed.has(k), `${k} is written but not on the page`);
  for (const k of listed) assert.ok(seen.has(k), `${k} is on the page but never written`);
  for (const k of ERP_OWNED_AFTER_LINK) assert.ok(erpOwned(k), `${k} should show as ERP-owned`);
  assert.ok(erpOwned("order_line_NN_article") && erpOwned("hs_total_price") && !erpOwned("hs_subtotal_price"));
});

test("an order HubSpot holds with the shop's latest change counts as written - epoch ms against HubSpot's datetime", () => {
  assert.ok(same("1791725969000", "2026-10-11T13:39:29Z"), "HubSpot drops the milliseconds of a whole second");
  assert.ok(same("1791725969000", "2026-10-11T13:39:29.000Z"));
  assert.ok(!same("1791725970000", "2026-10-11T13:39:29Z"), "a later change in the shop is not written yet");
  assert.ok(!same("1791725969000", null));
});

test("an order the ERP has is never created - only one still on the shop's side, placed lately", () => {
  const now = Date.parse("2026-10-11T16:00:00Z");
  const at = (iso: string) => String(Date.parse(iso));
  const order = (status: string, placed: string) => ({ hs_external_order_id: "20000067216", hs_external_order_status: status, hs_external_created_date: at(placed) });
  assert.equal(mayNotCreate(order("processing", "2026-10-11T15:59:00Z"), now), null, "a new order: created");
  assert.equal(mayNotCreate(order("pending", "2026-10-01T00:00:00Z"), now), null);
  assert.match(mayNotCreate(order("transferred", "2026-10-11T15:00:00Z"), now) ?? "", /left to the ERP/, "transferred: the ERP has it");
  assert.match(mayNotCreate(order("complete", "2026-10-09T00:00:00Z"), now) ?? "", /left to the ERP/);
  assert.match(mayNotCreate(order("canceled", "2026-10-11T15:00:00Z"), now) ?? "", /left to the ERP/);
  assert.match(mayNotCreate(order("processing", "2022-08-01T00:00:00Z"), now) ?? "", /more than 30 days/, "an old order changed in the shop: no twin");
  assert.match(mayNotCreate({ hs_external_order_id: "1" }, now) ?? "", /no status/);
});

test("a transferred order placed after the last ERP delivery is created - the ERP's files cannot hold it yet", () => {
  const now = Date.parse("2026-10-12T10:00:00Z");
  const erpSince = Date.parse("2026-10-10T13:09:00Z");
  const at = (iso: string) => String(Date.parse(iso));
  const order = (status: string, placed: string) => ({ hs_external_order_id: "10000156325", hs_external_order_status: status, hs_external_created_date: at(placed) });
  assert.equal(mayNotCreate(order("transferred", "2026-10-12T09:57:00Z"), now, erpSince), null, "placed after the delivery: created");
  assert.match(mayNotCreate(order("transferred", "2026-10-10T12:00:00Z"), now, erpSince) ?? "", /left to the ERP/, "placed before it: the ERP may have it");
  assert.match(mayNotCreate(order("transferred", "2026-10-12T09:57:00Z"), now) ?? "", /left to the ERP/, "no delivery on record: left to the ERP");
  assert.match(mayNotCreate(order("canceled", "2026-10-12T09:57:00Z"), now, erpSince) ?? "", /left to the ERP/, "only transferred, never a cancelled order");
  assert.match(mayNotCreate({ hs_external_order_id: "1", hs_external_order_status: "transferred" }, now, erpSince) ?? "", /left to the ERP/, "no placing date: left to the ERP");
});
