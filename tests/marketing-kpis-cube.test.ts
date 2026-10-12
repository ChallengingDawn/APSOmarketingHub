import assert from "node:assert/strict";
import { test } from "node:test";
import { DIMS, addCompany, breakdown, potentialBand, shareOfWallet, totals, usablePotential, type Cube, type Dim } from "../src/lib/marketingKpis/cube";

// A small portfolio, built the way customers.ts builds the real one.
function cubeOf(companies: { dims: Record<Dim, string>; bought?: boolean; boughtPy?: boolean; rev?: number; revPy?: number; potential?: number | null }[]): Cube {
  const labels = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as Record<Dim, string[]>;
  const acc = new Map<string, number[]>();
  for (const c of companies) {
    const dims = Object.fromEntries(DIMS.map((d) => {
      let i = labels[d].indexOf(c.dims[d]);
      if (i < 0) i = labels[d].push(c.dims[d]) - 1;
      return [d, i];
    })) as Record<Dim, number>;
    addCompany(acc, dims, { bought: !!c.bought, boughtPy: !!c.boughtPy, rev: c.rev ?? 0, revPy: c.revPy ?? 0, potential: c.potential ?? null });
  }
  return { generatedAt: "", year: 2026, revenueMonths: 9, labels, cells: [...acc.values()] };
}
const co = (prio: string, segment: string, country: string, owner: string, extra: Partial<{ bought: boolean; boughtPy: boolean; rev: number; revPy: number; potential: number | null }> = {}) => ({
  dims: { prio, segment, potential: potentialBand(extra.potential ?? null), country, owner, type: "OEM", mandant: "M100" },
  ...extra,
});
const cube = cubeOf([
  co("Prio 1", "APSOcore", "Switzerland", "Anna", { bought: true, boughtPy: true, rev: 60_000, revPy: 50_000, potential: 120_000 }),
  co("Prio 1", "APSOgrowth", "Germany", "Ben", { bought: true, rev: 30_000, revPy: 40_000, potential: 40_000 }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { bought: true, boughtPy: true, rev: 3_000, revPy: 2_000, potential: 5_000 }),
  co("Prio 3", "APSOprospect", "Germany", "Ben", { potential: 800 }),
  co("No priority", "APSOprospect", "Switzerland", "No owner", { potential: 5_000_000 }),
  co("Prio 2", "APSOcore", "Switzerland", "Anna", { bought: true, rev: 1_000, potential: 3_000 }),
]);

test("totals add every company once", () => {
  const a = totals(cube, {});
  assert.equal(a.n, 6);
  assert.equal(a.bought, 4);
  assert.equal(a.boughtPy, 2);
  assert.equal(a.rev, 94_000);
  assert.equal(a.revPy, 92_000);
  // the 5 M€ potential is a typing slip: left out of share of wallet
  assert.equal(a.pot, 120_000 + 40_000 + 5_000 + 800 + 3_000);
});

test("a click filters every other breakdown, and its own dimension still shows all its values", () => {
  const f = { prio: "Prio 1" };
  assert.deepEqual(breakdown(cube, "country", f).map((r) => [r.label, r.n]), [["Germany", 1], ["Switzerland", 1]]);
  assert.deepEqual(breakdown(cube, "prio", f).map((r) => r.label), ["Prio 1", "Prio 2", "Prio 3", "No priority"]);
  assert.equal(totals(cube, { prio: "Prio 2", country: "Switzerland" }).n, 2);
  assert.equal(totals(cube, { owner: "Anna", segment: "APSOcore" }).rev, 64_000);
  assert.equal(totals(cube, { country: "Nowhere" }).n, 0);
});

test("priority and potential keep their own order; the rest go by size or by revenue", () => {
  assert.deepEqual(breakdown(cube, "potential", {}).map((r) => r.label), ["€100K and more", "€25K – 100K", "€2.5K – 25K", "€500 – 2.5K"]);
  assert.deepEqual(breakdown(cube, "segment", {}).map((r) => r.label), ["APSOcore", "APSOprospect", "APSOgrowth"]);
  assert.deepEqual(breakdown(cube, "segment", {}, "rev").map((r) => r.label), ["APSOcore", "APSOgrowth", "APSOprospect"]);
});

test("potential bands follow the sales-priority thresholds", () => {
  assert.equal(potentialBand(null), "Not set");
  assert.equal(potentialBand(0), "Under €500");
  assert.equal(potentialBand(499), "Under €500");
  assert.equal(potentialBand(500), "€500 – 2.5K");
  assert.equal(potentialBand(2_500), "€2.5K – 25K");
  assert.equal(potentialBand(25_000), "€25K – 100K");
  assert.equal(potentialBand(100_000), "€100K and more");
  assert.equal(usablePotential(1_000_001), false);
  assert.equal(usablePotential(0), false);
});

test("share of wallet: revenue in the loaded months against the potential for those months", () => {
  const a = totals(cube, { prio: "Prio 1" });
  // (60k + 30k) / ((120k + 40k) * 9/12)
  assert.equal(Math.round(shareOfWallet(a, 9)! * 1000) / 1000, 0.75);
  assert.equal(shareOfWallet(totals(cube, { country: "Nowhere" }), 9), null);
  assert.equal(shareOfWallet(a, 0), null);
});
