import assert from "node:assert/strict";
import { test } from "node:test";
import { flowOf, type GqsTask } from "../src/lib/reporting/boGqs";
import { inWin, monthsOf, openBy, openOf, prevOk, requestersOf, setsOf, slimTask, statOf, statsBy, nameOf, type EsoGqs } from "../src/lib/reporting/esoGqs";

// SARCLA 05.11.2026: "another tab on ESO and Sales leader on customer tickets - a new, really developed tab to show the
// results of GQS to the sales leader, and to be able to report it also on my reports"; "GQS to line manager on GQS win
// rate and so forth"; "open task show also by person".

const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 10) => Date.UTC(y, m, d, h);
const t = (x: Partial<GqsTask> & { id: string }): GqsTask => ({ c: at(2026, 2, 2), s: "open", ...x });
const G: EsoGqs = {
  at: "2026-11-05T05:00:00Z",
  people: { a: { name: "Adem", team: "ESO" }, b: { name: "Bea", team: "ESO" }, z: { name: "Zoe", team: "TSA" }, lm1: { name: "Rabe", team: "ESO" } },
  tasks: [
    t({ id: "1", rq: "a", lm: "lm1", c: at(2026, 2, 2), of: at(2026, 2, 12), s: "offer", res: "w", pot: 5000, ty: "DT - New Business", ap: "a" }),
    t({ id: "2", rq: "a", lm: "lm1", c: at(2026, 2, 20), of: at(2026, 3, 3), s: "offer", res: "l", pot: 3000, ap: "r", dec: "y" }),
    t({ id: "3", rq: "b", lm: "lm1", c: at(2026, 3, 1), of: at(2026, 3, 5), s: "offer", ap: "a" }),
    t({ id: "4", rq: "b", lm: "lm1", c: at(2026, 3, 9), s: "refused", rf: at(2026, 3, 10), res: "l", ap: "r", dec: "n" }),
    t({ id: "5", rq: "z", c: at(2026, 3, 15), s: "gqs", at: at(2026, 3, 16) }),
    t({ id: "6", rq: "a", c: at(2026, 9, 1), s: "cust", at: at(2026, 9, 2) }),
  ],
};

test("a moment in a window: the year, the months, the first and the last cut by days - the day in Zurich", () => {
  const win = { from: 2, to: 3, d0: 5, d1: 10 };
  assert.equal(inWin(at(2026, 2, 5), 2026, win), true);
  assert.equal(inWin(at(2026, 2, 4), 2026, win), false, "before the first day");
  assert.equal(inWin(at(2026, 3, 10), 2026, win), true);
  assert.equal(inWin(at(2026, 3, 11), 2026, win), false, "after the last day");
  assert.equal(inWin(at(2025, 2, 6), 2026, { ...win, year: 1 }), true, "last year's same days");
  assert.equal(inWin(Date.UTC(2026, 1, 28, 23, 30), 2026, { from: 2, to: 2 }), true, "23:30 UTC on 28 February is 1 March in Zurich");
  assert.equal(inWin(undefined, 2026, win), false);
  assert.equal(prevOk(2026, { from: 6, to: 9 }), true, "July 2025 on: GQS ran");
  assert.equal(prevOk(2026, { from: 0, to: 9 }), false, "January 2025: no GQS yet");
});

test("whose requests: ESO, TSA, a line manager's team, My Sales' people, everyone", () => {
  const byId = { a: "RABE", b: "FALU", z: "RABE" };
  assert.deepEqual([...requestersOf(G, "eso", null, byId, false)!].sort(), ["a", "b"]);
  assert.deepEqual([...requestersOf(G, "tsa", null, byId, false)!], ["z"]);
  assert.deepEqual([...requestersOf(G, "eso", "RABE", byId, false)!], ["a"], "a TSA person in the team is not ESO's");
  assert.equal(requestersOf(G, "total", null, byId, false), null);
  assert.deepEqual([...requestersOf(G, "eso", "my-sales", { b: "my-sales" }, true)!], ["b"]);
  assert.deepEqual([...requestersOf(G, "total", "my-sales", {}, true)!], [], "a scope with nobody shows nobody");
});

test("the period's requests and offers, their figures, by person and by line manager", () => {
  const win = { from: 2, to: 3 };
  const s = setsOf(G, 2026, win, new Set(["a", "b"]));
  assert.deepEqual(s.req.map((x) => x.id), ["1", "2", "3", "4"]);
  assert.deepEqual(s.off.map((x) => x.id), ["1", "2", "3"]);
  const st = statOf(s);
  assert.deepEqual([st.req, st.review, st.lmYes, st.lmNo, st.refused], [4, 2, 1, 1, 1]);
  assert.deepEqual([st.offers, st.won, st.lost, st.wait], [3, 1, 1, 1], "task 4's LOST is a refused request, no lost offer");
  assert.equal(st.rate, 0.5);
  assert.deepEqual([st.potWon, st.potOffered], [5000, 8000]);
  assert.equal(st.days, 10, "10, 14 and 4 days to the offer - the median");
  const byPerson = statsBy(G, s, (x) => nameOf(G, x.rq));
  assert.deepEqual([...byPerson.keys()], ["Adem", "Bea"]);
  assert.equal(byPerson.get("Adem")!.rate, 0.5);
  assert.equal(byPerson.get("Bea")!.rate, null, "no result yet");
  assert.equal(statsBy(G, s, (x) => nameOf(G, x.lm)).get("Rabe")!.offers, 3);
  assert.deepEqual(setsOf(G, 2026, win, null, ["Bea"]).req.map((x) => x.id), ["3", "4"], "the page's person filter");
  const m = monthsOf(s, win);
  assert.deepEqual(m, { req: [2, 2], offers: [1, 2], won: [1, 0], lost: [0, 1], wait: [0, 1] });
});

test("the open tasks whatever the period, by person and by stage; the diagram; the slim task", () => {
  const now = at(2026, 10, 5);
  const open = openOf(G, null, now);
  assert.deepEqual(open.map((o) => o.t.id), ["5", "6"], "the oldest first");
  const by = openBy(open, (o) => nameOf(G, o.t.rq));
  assert.deepEqual(by.map((r) => [r.label, r.n, r.old, r.most]), [["Adem", 1, 1, "cust"], ["Zoe", 1, 1, "gqs"]]);
  assert.equal(Math.round(by[0].days!), Math.round((now - at(2026, 9, 2)) / DAY));
  assert.deepEqual(openOf(G, new Set(["a"]), now).map((o) => o.t.id), ["6"]);
  const fl = flowOf(G.tasks.slice(0, 4));
  assert.deepEqual(fl.nodes.map((n) => n.id), ["req", "auto", "lmy", "lmn", "offer", "refused", "won", "lost", "nores"]);
  assert.equal(fl.links.find((l) => l.from === "req" && l.to === "auto")!.value, 2);
  assert.deepEqual(flowOf([]).nodes, [], "nothing asked: no diagram");
  const full = { ...G.tasks[0], d: { open: 3 }, why: "x", rule: "big" as const, mar: 0.3, sent: 1, apAt: 2, decAt: 3, resAt: 4 };
  assert.deepEqual(Object.keys(slimTask(full)).sort(), ["ap", "c", "id", "lm", "of", "pot", "res", "rq", "s", "ty"]);
});
