import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIM_FACTS, InvoicesSheet, baseOfNumber, dimFactsOf, factsFor, factsHash, invoiceFacts, lineFacts, packDim, unpackDim,
} from "../src/lib/connectors/steps/orderFactsRules";

const row = (o: Record<string, string>) => (c: string) => o[c] ?? "";

test("order facts: a dim_order row -> the properties, each value checked against its property", () => {
  const f = dimFactsOf(row({
    OrderYear: "2026", CustomerOrderNr: " PO 4711 ", YourReference: "Anna Muster / Einkauf", DeliveryNoteNr: "", IncoTerm: "Ex Works",
    PaymentTerm: "30 days net", OrderFixedDate: "02.01.2026 00:00:00", OrderSource: "eShop", SplitDelivery: "N",
    ShippingFromWarehouse: " A+P  LC Embrach", SalesDepartment: "OS", SalesTeamId: "129", SA: "APSO",
    DeliveryDateCustomer: "", DeliveryDateProp: "20.02.2030 00:00:00", Prepayment: "J",
  }))!;
  assert.deepEqual(f, {
    order_customer_order_nr: "PO 4711", order_your_reference: "Anna Muster / Einkauf", order_incoterm: "Ex Works", order_payment_term: "30 days net",
    order_order_fixed_date: "2026-01-02", order_order_source: "eShop", order_split_delivery: "N", order_shipping_warehouse: "A+P LC Embrach",
    order_sales_department: "OS", order_sales_team_id: "129", order_sales_agent_code: "APSO", order_advance_payment: "checked",
  }); // no delivery note, no customer date, and 20.02.2030 is the ERP's "no date"
  assert.equal(dimFactsOf(row({ OrderYear: "2019", IncoTerm: "Ex Works" })), null);
  assert.deepEqual(dimFactsOf(row({ OrderYear: "2025", OrderSource: "Telefon", Prepayment: "X" })), {}); // not the choice lists' options
  assert.deepEqual(unpackDim(packDim(f)), f);
  assert.equal(packDim(f).split("\u0001").length, DIM_FACTS.length);
});

test("order facts: the lines give each order its first confirmed date, special articles or not, and how far it is shipped", () => {
  const m = lineFacts([
    { order: "A26.1.000", firstDay: "2026-10-08", artType: "Standard", lineType: "Order", qty: 2, shipped: 2 },
    { order: "A26.1.001", firstDay: "2026-10-06", artType: "Special", lineType: "Order", qty: 1, shipped: 0 },
    { order: "A26.2.000", firstDay: "", artType: "Standard", lineType: "Order", qty: 3, shipped: 1 },
    { order: "A26.3.000", firstDay: "2030-02-20", artType: "Standard", lineType: "Order", qty: 1, shipped: 0 },
    { order: "A26.4.000", firstDay: "2026-10-01", artType: "Standard", lineType: "Order", qty: 5, shipped: 5 },
    { order: "A26.4.000", firstDay: "2026-10-01", artType: "Service", lineType: "CreditNote", qty: 1, shipped: 0 },
  ]);
  assert.deepEqual(m.get("A26.1"), { order_first_confirmed_delivery: "2026-10-06", order_has_special_articles: "true", order_shipment_status: "Partially shipped" });
  assert.deepEqual(m.get("A26.2"), { order_has_special_articles: "false", order_shipment_status: "Partially shipped" });
  assert.deepEqual(m.get("A26.3"), { order_has_special_articles: "false", order_shipment_status: "Open" });
  assert.deepEqual(m.get("A26.4"), { order_first_confirmed_delivery: "2026-10-01", order_has_special_articles: "false", order_shipment_status: "Fully shipped" }); // a credit note line does not count
  assert.equal(baseOfNumber("A26.661275.001"), "A26.661275");
});

test("order facts: the invoices sheet, and a delivery's invoice - the first one not cancelled, the count of all", () => {
  const s = new InvoicesSheet();
  s.feed(1, ["[Order]", "[InvoiceNumber]", "[InvoiceDate]", "[BookingDate]", "[InvoiceCanceled]", "[Currency]", "[CustomerClass]", "[CogsEUR]"]);
  s.feed(2, ["A26.1.001", 9002, new Date(Date.UTC(2026, 9, 7)), new Date(Date.UTC(2026, 9, 7)), "N", "CHF", "B", 12.346]);
  s.feed(3, ["A26.1.001", 9001, new Date(Date.UTC(2026, 9, 5)), new Date(Date.UTC(2026, 9, 6)), "J", "CHF", "B", 99]);
  s.feed(4, ["A26.1.001", 9002, new Date(Date.UTC(2026, 9, 7)), new Date(Date.UTC(2026, 9, 7)), "N", "CHF", "B", 12.346]); // the same invoice again
  s.feed(5, ["A26.2.001", 9003, 46297, null, "J", "EUR"]);
  s.feed(6, [null, null, null, null, null, null]);
  const rows = s.finish()!;
  assert.equal(rows.length, 4);
  const m = invoiceFacts(rows);
  assert.deepEqual(m.get("A26.1.001"), {
    order_invoice_number: "9002", order_invoice_count: "2", order_invoice_canceled: "N", order_invoiced_status: "invoiced",
    order_invoice_date: "2026-10-07", order_invoice_booking_date: "2026-10-07", order_invoice_currency: "CHF",
    order_customer_class: "B", order_cogs_eur: "12.35", // the cancelled invoice's cost left out
  });
  assert.deepEqual(m.get("A26.2.001"), {
    order_invoice_number: "9003", order_invoice_count: "1", order_invoice_canceled: "J", order_invoiced_status: "canceled",
    order_invoice_date: "2026-10-02", order_invoice_currency: "EUR",
  });
  const none = new InvoicesSheet();
  none.feed(1, ["Order", "Amount"]);
  assert.equal(none.finish(), null);
});

test("order facts: one order's facts from the three sources, and the hash that says what changed", () => {
  const byBase = new Map([["A26.1", { order_first_confirmed_delivery: "2026-10-06", order_has_special_articles: "true" }]]);
  const byOrder = new Map([["A26.1.001", { order_invoice_date: "2026-10-07" }]]);
  const f = factsFor("A26.1.001", { order_incoterm: "Ex Works" }, byBase, byOrder);
  assert.deepEqual(f, { order_incoterm: "Ex Works", order_first_confirmed_delivery: "2026-10-06", order_has_special_articles: "true", order_invoice_date: "2026-10-07" });
  assert.deepEqual(factsFor("A26.9.001", {}, byBase, byOrder), {});
  assert.equal(factsHash({ b: "2", a: "1" }), factsHash({ a: "1", b: "2" }));
  assert.notEqual(factsHash({ a: "1" }), factsHash({ a: "2" }));
});
