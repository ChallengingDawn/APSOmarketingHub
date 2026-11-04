import assert from "node:assert/strict";
import { test } from "node:test";
import { IN, inboundDetail } from "../src/lib/reporting/boInbound";
import { T, TOUTCOMES } from "../src/lib/reporting/ticketsRules";

// SARCLA 04.11.2026: "ESO & TSA tickets should be also improved with a little bit more details, win rate and so forth" -
// the incoming tickets of the ESO Reports' read, added up per month, channel and owner with the ESO Reports' own rules.

const o = (id: string) => TOUTCOMES.findIndex((x) => x.id === id);
/** a ticket row: nothing logged, no first contact, no resolution, no potential - then the columns given */
function row(cols: Partial<Record<keyof typeof T, number>>): number[] {
  const r: number[] = Array(22).fill(0);
  r[T.firstH] = -1; r[T.first] = -1; r[T.resolution] = -1; r[T.company] = -1; r[T.conf] = -1; r[T.stage] = -1;
  for (const [k, v] of Object.entries(cols)) r[T[k as keyof typeof T]] = v as number;
  return r;
}

test("the incoming tickets add up per pipeline and month: won of the decided, contacted in a day, closed with nothing logged", () => {
  const d = {
    year: 2026,
    labels: { channel: ["Website form", "Chat"], prio: [], category: [], country: [], resolution: [] },
    people: [{ id: "1", name: "Anna", team: "ESO" }, { id: "2", name: "Ben", team: "TSA" }],
    tickets: [
      // March 2026, the ESO: won after a reply within 5 working hours, valued EUR 1,000 high
      row({ month: 2, outcome: o("won"), firstH: 50, first: 0, emails: 1, value: 1000, conf: 0, resolution: 0 }),
      // lost on price, the first contact after 20 working hours - not within a day
      row({ month: 2, outcome: o("price"), firstH: 200, first: 2, calls: 1, channel: 1 }),
      // closed without a resolution and nothing logged at all
      row({ month: 2, outcome: o("nores") }),
      // the TSA's, still open
      row({ month: 2, outcome: o("open"), pipe: 1, person: 1 }),
      // a system ticket (a workflow's) is no incoming ticket
      row({ month: 2, outcome: o("won"), group: 1 }),
      // July of the year before
      row({ year: 1, month: 6, outcome: o("other"), notes: 1 }),
    ],
  };
  const x = inboundDetail(d);
  const m = x.eso.m["2026-03"];
  assert.equal(m[IN.n], 3);
  assert.equal(m[IN.won], 1);
  assert.equal(m[IN.resolved], 2, "won and lost are decided; closed without a resolution is not");
  assert.equal(m[IN.closed], 3);
  assert.equal(m[IN.lost], 1);
  assert.equal(m[IN.quiet], 1);
  assert.equal(m[IN.inDay], 1);
  assert.equal(m[IN.hoursS], 25);
  assert.equal(m[IN.hoursN], 2);
  assert.equal(m[IN.pot], 1000);
  assert.equal(m[IN.potWon], 1000);
  assert.equal(x.tsa.m["2026-03"][IN.n], 1);
  assert.equal(x.tsa.m["2026-03"][IN.closed], 0);
  assert.equal(x.eso.m["2025-07"][IN.n], 1);
  assert.equal(x.eso.m["2025-07"][IN.resolved], 1, "closed otherwise is decided, not won");
  // per channel and per owner, the same rows
  assert.equal(x.eso.ch["Website form"]["2026-03"][IN.n], 2);
  assert.equal(x.eso.ch["Chat"]["2026-03"][IN.lost], 1);
  assert.equal(x.eso.who["Anna"]["2026-03"][IN.n], 3);
  assert.equal(x.tsa.who["Ben"]["2026-03"][IN.n], 1);
});
