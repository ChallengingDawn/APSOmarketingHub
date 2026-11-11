import { test } from "node:test";
import assert from "node:assert/strict";
import { CARD_MONTHS, YEARS_BACK, companyProps, dayOf, figuresOf, keyOf, todayEndOf } from "../hubspot/revenue-drop-card/revenueDropFigures";
import { companyOf, dropped, measureOf, monthsOfYears, windowOf } from "../src/lib/lifecycle/revenueDrop";

const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const next = (m: string) => { const y = Number(m.slice(0, 4)), n = Number(m.slice(5, 7)); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, "0")}`; };

/** Made-up company fields: revenue per profit center and order intake per month, from `from` to `to`. */
function company(spans: { from: string; to: string; rev: Record<string, number>; oi?: number }[], extra: Record<string, string> = {}) {
  const rev: Record<string, Record<string, Record<string, number>>> = {};
  const p: Record<string, string> = { name: "Example Seals GmbH", company_unique_number: "110-123456", major_profit_center: "DT", order_last_order_date: "2026-12-02", ...extra };
  for (const s of spans) for (let m = s.from; m <= s.to; m = next(m)) {
    const y = m.slice(0, 4), k = MON[Number(m.slice(5, 7)) - 1];
    (rev[y] ??= {})[k] = { ...s.rev };
    if (s.oi) p[`oi_${y}_${k}`] = String(s.oi);
  }
  for (const [y, b] of Object.entries(rev)) p[`rev_${y}_pc_monthly`] = JSON.stringify(b);
  return p;
}
const ticket = (key: string, last: number, prev: number) => ({
  revenue_drop_key: key, revenue_drop_last_12: String(last), revenue_drop_prev_12: String(prev), revenue_drop_window: "Nov 2025 - Oct 2026",
  revenue_drop_amount_at_risk: String(prev - last),
});

test("the card takes everything from HubSpot: the ticket's fields for then, the company's months for today", () => {
  const c = company([
    { from: "2024-11", to: "2025-10", rev: { dt: 3000, kt: 1000 }, oi: 1000 },
    { from: "2025-11", to: "2026-10", rev: { dt: 1000 }, oi: 500 },
    { from: "2026-11", to: "2027-01", rev: { dt: 2000, kt: 500 }, oi: 500 },
  ], { erp_rev_as_of: "2027-02-10" });
  const f = figuresOf(ticket("110-123456|2|2026-10", 18000, 60000), c, "2027-02-11")!;
  assert.deepEqual([f.company, f.un, f.major, f.lastOrder, f.asOf, f.step, f.atRisk], ["Example Seals GmbH", "110-123456", "DT", "2026-12-02", "2027-02-10", 2, 42000]);
  assert.deepEqual([f.ticket.last, f.ticket.prev, Math.round(f.ticket.change! * 100), f.ticket.window], [18000, 60000, -70, "Nov 2025 - Oct 2026"]);
  assert.deepEqual([f.today.end, f.today.window, f.today.last, f.today.prev, Math.round(f.today.change! * 100)], ["2027-01", "Feb 2026 - Jan 2027", 22500, 49500, -55]);
  assert.deepEqual([f.status, f.points], ["down", 15]);
  assert.deepEqual(f.since, { from: "2026-11", to: "2027-01", rev: 7500, oi: 1500, total: 9000 });
  assert.equal(f.months.length, CARD_MONTHS);
  assert.deepEqual([f.months[0].month, f.months[CARD_MONTHS - 1].value, f.months.find((m) => m.month === "2026-10")!.after], ["2025-02", 3000, false]);
  assert.deepEqual(f.pcs.map((x) => [x.code, x.before, x.last]), [["dt", 36000, 15000], ["kt", 12000, 1500]]);
  assert.match(f.pcs[0].label, /Sealing Technology \(DT\)/);
});

test("the card's today agrees with UC12's own rules on the same months", () => {
  const c = company([
    { from: "2023-01", to: "2025-06", rev: { ft: 900, st: 150 }, oi: 400 },
    { from: "2025-07", to: "2026-12", rev: { ft: 400 }, oi: 250 },
  ], { erp_rev_as_of: "2026-11-05", apso_customer: "APSOcore", sales_priority: "1-Prio 1 - Pot >25000€", country: "DE" });
  const f = figuresOf(ticket("110-123456|2|2026-06", 1, 2), c, "2026-11-06")!;
  const years = [2023, 2024, 2025, 2026];
  const hub = measureOf(companyOf("1", c, years), monthsOfYears(years), windowOf(f.today.end));
  assert.deepEqual([f.today.last, f.today.prev, f.today.change], [hub.last, hub.prev, hub.change]);
  assert.equal(f.status === "down", dropped(hub));
  assert.deepEqual(companyProps(2026).filter((x) => x.startsWith("rev_")), ["rev_2023_pc_monthly", "rev_2024_pc_monthly", "rev_2025_pc_monthly", "rev_2026_pc_monthly"]);
  assert.equal(YEARS_BACK, 3);
});

test("status, the window's end, and no card on other tickets", () => {
  const lost = figuresOf(ticket("100-1|1|2026-10", 0, 12000), company([{ from: "2024-11", to: "2025-10", rev: { kt: 1000 } }], { erp_rev_as_of: "2027-01-03" }), "2027-01-04")!;
  assert.deepEqual([lost.status, lost.since?.total, lost.pcs[0].change], ["lost", 0, -1]);
  const back = figuresOf(ticket("100-1|2|2026-10", 1, 2), company([{ from: "2024-01", to: "2026-12", rev: { ft: 1000 } }], { erp_rev_as_of: "2027-01-03" }), "2027-01-04")!;
  assert.equal(back.status, "back");
  const fresh = figuresOf(ticket("100-1|2|2026-10", 1, 2), company([{ from: "2024-01", to: "2026-12", rev: { ft: 1000 } }], { erp_rev_as_of: "2026-11-03" }), "2026-11-04")!;
  assert.equal(fresh.since, null);
  assert.equal(figuresOf({ revenue_drop_key: "110-1|1234567890|2026" }, {}, "2026-11-04"), null); // an erosion key
  assert.equal(figuresOf({}, {}, "2026-11-04"), null);
  assert.deepEqual(keyOf("id-55|1|2026-11"), { un: "id-55", step: 1, end: "2026-11" });
  assert.equal(todayEndOf("2026-11-10", "2026-12-01"), "2026-10");
  assert.equal(todayEndOf(null, "2026-01-15"), "2025-12");
  assert.equal(dayOf(String(Date.UTC(2026, 10, 10))), "2026-11-10");
  assert.equal(dayOf("2026-11-10T00:00:00Z"), "2026-11-10");
});
