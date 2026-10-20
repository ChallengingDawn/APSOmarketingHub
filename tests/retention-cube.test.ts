import assert from "node:assert/strict";
import { test } from "node:test";
import { baseOf, cohortsOf, leaveOf, pathOf, personasOf, retentionView, trendOf, type RCo, type RetentionRaw } from "../src/lib/marketingKpis/retentionCube";

// years 2022-2026 (index 0-4); base 2025 against 2026 so far
const co = (id: string, r: number[], more: Partial<RCo> = {}): RCo => ({ id, o: "11", p: "2-Prio 2", s: "APSOcore", k: "Switzerland", a: "1.1.8 Packaging", pot: null, f: null, r, ...more });
const raw = (cos: RCo[]): RetentionRaw => ({
  years: [2022, 2023, 2024, 2025, 2026], base: 2025, next: 2026, asOf: "2026-10-20", readAt: "", cos, counts: {}, errors: {},
  owners: { "11": { n: "Anna", team: "ESO - field sales", left: false }, "22": { n: "Ben", team: "TSA - inside sales", left: false } },
  personas: { persona_3: "Online-first purchaser" }, ownerActs: { "11": { calls: 5, em: 2, mtg: 1 } },
});

test("the base year: last year against this one - before April, the two complete years before", () => {
  assert.deepEqual(baseOf("2026-10-20"), { base: 2025, next: 2026 });
  assert.deepEqual(baseOf("2026-03-31"), { base: 2024, next: 2025 });
  assert.deepEqual(baseOf("2026-04-01"), { base: 2025, next: 2026 });
});

test("the trend: kept, lost, new (first order that year), won back - active = EUR 100 or more", () => {
  const d = raw([
    co("a", [500, 500, 500, 500, 500]),                // kept every year
    co("b", [500, 0, 0, 300, 0]),                      // 2025 won back, 2026 not back
    co("c", [0, 0, 0, 0, 200], { f: 2026 }),           // new in 2026
    co("d", [0, 0, 0, 80, 150], { f: 2025 }),          // 2025: under 100, not active; 2026: active, first order 2025 -> won back
    co("e", [0, 0, 400, 0, 0], { f: 2024 }),           // new 2024, lost 2025
  ]);
  const t = trendOf(d);
  assert.deepEqual(t.map((x) => x.year), [2022, 2023, 2024, 2025]);
  const y25 = t.find((x) => x.year === 2025)!;
  assert.deepEqual([y25.active, y25.retained, y25.churned, y25.churnedRev, y25.newNext, y25.winbacks, y25.activeNext, y25.partial], [2, 1, 1, 300, 1, 1, 3, true]);
  const y24 = t.find((x) => x.year === 2024)!;
  assert.deepEqual([y24.active, y24.churned, y24.newNext, y24.winbacks], [2, 1, 0, 1]);   // e lost; b won back in 2025
  const y23 = t.find((x) => x.year === 2023)!;
  assert.deepEqual([y23.active, y23.newNext], [1, 1]);   // e new in 2024 (its first order)
  const v = retentionView(d);
  assert.deepEqual([v.figures.active, v.figures.gone, v.partial], [2, 1, true]);
});

test("cohorts: the share of each first-order year active each year, bought one year only, year one to year two", () => {
  const d = raw([
    co("a", [0, 300, 300, 300, 300], { f: 2023 }),
    co("b", [0, 200, 0, 0, 0], { f: 2023 }),
    co("c", [0, 50, 400, 0, 0], { f: 2023 }),         // first order under 100
    co("d", [0, 0, 0, 900, 0], { f: 2025 }),
  ]);
  const c = cohortsOf(d);
  const r23 = c.rows.find((x) => x.cohort === 2023)!;
  assert.equal(r23.size, 3);
  assert.deepEqual(r23.share.map((x) => Math.round((x ?? 0) * 100)), [67, 67, 33, 33]);
  const o23 = c.once.find((x) => x.cohort === 2023)!;
  assert.deepEqual([o23.size, Math.round(o23.once! * 100), Math.round(o23.gone2! * 100), Math.round(o23.still! * 100)], [3, 67, 67, 33]);
  assert.equal(c.once.some((x) => x.cohort === 2025), false);   // 2026 still running: no full year after it
  const fs23 = c.firstSecond.find((x) => x.cohort === 2023)!;
  assert.deepEqual([fs23.y1, fs23.y2, fs23.rev1, fs23.rev2], [2, 2, 500, 700]);
  assert.equal(c.firstSecond.find((x) => x.cohort === 2025)!.partial, true);
});

test("why they leave: each lever against the average, and the flow through orders and profit centres", () => {
  const d = raw([
    co("a", [0, 0, 0, 300, 0], { b: { n: 1, pcs: ["DT"], c2s: 0, sp: 0, web: 1, erp: 0, gm: 60 } }),
    co("b", [0, 0, 0, 3000, 2000], { b: { n: 7, pcs: ["DT", "KT"], c2s: 1, sp: 1, web: 4, erp: 3, gm: 40 } }),
    co("c", [0, 0, 0, 800, 500], { b: { n: 3, pcs: ["FT"], c2s: 0, sp: 0, web: 3, erp: 0, gm: 20 } }),
    co("d", [0, 0, 0, 200, 0]),                                                   // no order found
  ]);
  const l = leaveOf(d);
  assert.equal(l.customers, 4);
  assert.equal(l.avg, 0.5);
  const g = (group: string) => l.rows.find((r) => r.group === group)!;
  assert.deepEqual([g("1 order in 2025").cos, g("1 order in 2025").churn, g("1 order in 2025").pts], [1, 1, 50]);
  assert.deepEqual([g("6+ orders").churn, g("6+ orders").pts], [0, -50]);
  assert.equal(g("< 500 EUR").cos, 2);
  assert.equal(g("mixed (shop and ERP)").cos, 1);
  assert.equal(g("web-only (all orders via the shop)").cos, 2);
  // the flow: every customer one path; the outcome adds up
  const into = (id: string) => l.flow.links.filter((x) => x.to === id).reduce((a, x) => a + x.value, 0);
  assert.deepEqual([into("back"), into("gone"), into("onone"), into("f2")], [2, 2, 1, 1]);
});

test("the path: sales touch, marketing reach, talked to us - and the owners' book reached", () => {
  const d = raw([
    co("a", [0, 0, 0, 500, 500], { o: "11", x: { calls: 2, out: 2, inb: 0, mtg: 0, vis: 0, em: 1, by: ["11"] }, c: { n: 2, mkt: 1, per: "persona_3" }, t: { dem: 1, prob: 0, del: 0, sales: 0, ero: 0 } }),
    co("b", [0, 0, 0, 500, 0], { o: "11", c: { n: 1, mkt: 0, per: null }, t: { dem: 0, prob: 2, del: 1, sales: 0, ero: 0 } }),
    co("c", [0, 0, 0, 500, 0], { o: "22", t: { dem: 0, prob: 0, del: 0, sales: 1, ero: 0 } }),
  ]);
  const p = pathOf(d);
  const into = (id: string) => p.flow.links.filter((x) => x.to === id).reduce((a, x) => a + x.value, 0);
  assert.deepEqual([into("touch"), into("untouched"), into("mkt"), into("nomkt"), into("nocontact"), into("asked"), into("problem"), into("silent")], [2, 1, 1, 1, 1, 1, 1, 1]);
  const g = (group: string) => p.rows.find((r) => r.group === group)!;
  assert.equal(g("touched (call, meeting, visit, sales ticket)").cos, 2);   // a call, and a sales ticket
  assert.equal(g("2+ problem tickets").churn, 1);
  // an owner reaching fewer than 10 customers is left out
  assert.deepEqual(p.owners, []);
  const many = raw(Array.from({ length: 12 }, (_, i) => co(`x${i}`, [0, 0, 0, 500, i < 3 ? 0 : 500], { o: i < 8 ? "11" : "22", x: { calls: 1, out: 1, inb: 0, mtg: 0, vis: 0, em: 0, by: ["11"] } })));
  const o = pathOf(many).owners;
  assert.deepEqual(o.map((x) => [x.name, x.team, x.book, x.touched, x.touchedPct, x.churned, x.calls]), [["Anna", "ESO - field sales", 8, 12, 1, 3, 5]]);
});

test("personas: by persona, business type, country, segment, priority - and segment against priority", () => {
  const d = raw([
    co("a", [0, 0, 0, 500, 0], { c: { n: 1, mkt: 1, per: "persona_3" }, a: "3.3 Reseller", s: "APSOgrowth", p: "1-Prio 1" }),
    co("b", [0, 0, 0, 500, 500], { a: "", k: "Germany" }),
  ]);
  const ps = personasOf(d);
  const g = (dim: string, group: string) => ps.rows.find((r) => r.dim === dim && r.group === group);
  assert.equal(g("Contact persona", "Online-first purchaser")!.churn, 1);
  assert.equal(g("Contact persona", "No contact person")!.cos, 1);
  assert.equal(g("Business type", "Resellers & partners (3.x)")!.cos, 1);
  assert.equal(g("Business type", "No APIC classification")!.cos, 1);
  assert.equal(g("Sales priority", "Prio 1")!.cos, 1);
  assert.deepEqual(ps.matrix.map((m) => m.segment).sort(), ["APSOcore", "APSOgrowth"]);
});
