import assert from "node:assert/strict";
import { test } from "node:test";
import { baseNumber, mergeOrderLines, personFromTitle, type OrderDoc } from "../src/lib/datatracker/orderLines";

const doc = (o: Partial<OrderDoc> & { id: string }): OrderDoc => ({
  number: null, web: null, date: "2026-10-05", eshop: true, title: null, contactId: null, email: null, lines: [], ...o,
});

test("personFromTitle reads the middle of 'A# | Person | Company' and nothing else", () => {
  assert.equal(personFromTitle("A1234567 | Marco Rossi | Rubix Spa"), "Marco Rossi");
  assert.equal(personFromTitle("A1234567 |  | Rubix Spa"), null);
  assert.equal(personFromTitle("Web order 1000012345"), null);
  assert.equal(personFromTitle(null), null);
  assert.equal(baseNumber("A1234567.001"), "A1234567");
});

test("an order placed and delivered counts ONCE, with its day, number and person", () => {
  const lines = mergeOrderLines([
    doc({ id: "1", number: "A1.000", title: "A1 | Marco Rossi | Rubix Spa",
      lines: [{ article: "1221415103", text: null, qty: 60, revenue: 370 }] }),
    doc({ id: "2", number: "A1.001", date: "2026-10-06", contactId: "77",
      lines: [{ article: "1221415103", text: "APSOvib insulating ring", qty: 60, revenue: 370 }] }),
  ]);
  assert.equal(lines.length, 1);
  const [l] = lines;
  assert.equal(l.qty, 60, "not 120 - the delivery is the same order");
  assert.equal(l.revenue, 370);
  assert.equal(l.orders, 1);
  assert.equal(l.description, "APSOvib insulating ring");
  assert.deepEqual(l.last, { id: "1", number: "A1", web: null, date: "2026-10-05", contactId: "77", person: "Marco Rossi" });
});

test("not all of it delivered yet: the order as placed is the larger figure and wins", () => {
  const [l] = mergeOrderLines([
    doc({ id: "1", number: "A2.000", lines: [{ article: "a", text: null, qty: 100, revenue: 500 }] }),
    doc({ id: "2", number: "A2.001", lines: [{ article: "a", text: null, qty: 40, revenue: 200 }] }),
  ]);
  assert.equal(l.qty, 100);
  assert.equal(l.revenue, 500);
});

test("two orders of one article: summed, counted twice, the latest one linked", () => {
  const [l] = mergeOrderLines([
    doc({ id: "1", number: "A3.000", date: "2026-10-01", lines: [{ article: "a", text: null, qty: 1, revenue: 10 }] }),
    doc({ id: "2", number: "A4.000", date: "2026-10-04", email: "buyer@example.com",
      lines: [{ article: "a", text: null, qty: 2, revenue: 20 }] }),
  ]);
  assert.equal(l.orders, 2);
  assert.equal(l.qty, 3);
  assert.equal(l.last?.number, "A4");
  assert.equal(l.last?.person, "buyer@example.com", "the e-mail stands in when no reference was given");
});
