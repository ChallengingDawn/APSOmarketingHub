// APSOconvert > PERFORMANCE - what the page tests did, all together, the way Webyn's Performances page opens (SARCLA
// 08.11.2026, with it on screen: "performance KPIs on the app"): how many were launched, won, are running; the
// add-to-cart rate with the versions against the pages as they are, the add-to-carts the versions added, the uplift,
// and the weekly curve of both. Counted from the tests' own daily figures (the shop's gateway, statistics consent only);
// the tests count add-to-carts, not revenue. Pure, so it is tested.

import type { TestStatus } from "./contract";

export type PerfTest = {
  id: string; kind: "test" | "personalisation"; status: TestStatus; winner: "a" | "b" | "none" | null;
  daily: { day: string; key: "a" | "b"; visitors: number; carts: number }[];
};
export type PerfWeek = { week: string; rateA: number | null; rateB: number | null; visitorsA: number; visitorsB: number };
export type Performance = {
  launched: number; winning: number; inProgress: number; drafts: number;
  visitors: { a: number; b: number }; carts: { a: number; b: number };
  rateA: number | null; rateB: number | null; uplift: number | null;
  /** the add-to-carts the versions brought beyond what their visitors would have done on the pages as they are */
  extra: number | null;
  weeks: PerfWeek[];
};

/** The Monday of a day's week, as YYYY-MM-DD. */
export function weekOf(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

const rate = (carts: number, visitors: number) => (visitors > 0 ? carts / visitors : null);

export function performanceOf(tests: PerfTest[]): Performance {
  const own = tests.filter((t) => t.kind === "test");
  const live = own.filter((t) => t.status !== "draft");
  const visitors = { a: 0, b: 0 };
  const carts = { a: 0, b: 0 };
  const byWeek = new Map<string, { va: number; vb: number; ca: number; cb: number }>();
  for (const t of live) {
    for (const d of t.daily) {
      if (!d.day) continue;
      const k = d.key === "b" ? "b" : "a";
      visitors[k] += d.visitors;
      carts[k] += d.carts;
      const w = weekOf(d.day);
      const x = byWeek.get(w) ?? { va: 0, vb: 0, ca: 0, cb: 0 };
      if (k === "a") { x.va += d.visitors; x.ca += d.carts; } else { x.vb += d.visitors; x.cb += d.carts; }
      byWeek.set(w, x);
    }
  }
  const rateA = rate(carts.a, visitors.a);
  const rateB = rate(carts.b, visitors.b);
  return {
    launched: live.length,
    winning: own.filter((t) => t.winner === "b").length,
    inProgress: own.filter((t) => t.status === "running" || t.status === "paused").length,
    drafts: own.filter((t) => t.status === "draft").length,
    visitors, carts, rateA, rateB,
    uplift: rateA && rateB !== null ? rateB / rateA - 1 : null,
    extra: rateA !== null && visitors.b > 0 ? Math.round(carts.b - visitors.b * rateA) : null,
    weeks: [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, x]) => ({ week, rateA: rate(x.ca, x.va), rateB: rate(x.cb, x.vb), visitorsA: x.va, visitorsB: x.vb })),
  };
}
