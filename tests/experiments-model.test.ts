import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_ARM, clashes, daysOf, fromChatRound, fromWebynPage, iceScore, needsDecision, readArms, type Arm, type Experiment } from "../src/lib/experiments/model";

const arm = (key: string, control: boolean, visitors: number, conversions: number): Arm => ({ key, name: key, control, visitors, conversions });
const exp = (over: Partial<Experiment>): Experiment => ({
  key: "manual-1", source: "manual", category: "page", service: null, host: "www.apsoparts.com", surface: "/de-ch/x.html", name: "x", hypothesis: "", metric: "",
  status: "running", startedAt: "2026-11-01T00:00:00Z", endedAt: null, arms: [], secondary: null, verdict: null, link: null, changes: [],
  decision: null, learning: "", owner: null, ice: null, notes: "", reported: "", decidedBy: null, decidedAt: null,
  createdBy: null, createdAt: "2026-11-01T00:00:00Z", updatedBy: null, updatedAt: "2026-11-01T00:00:00Z", syncedAt: null, ...over,
});

test("a clear winner, a clear loser, no difference, too early", () => {
  assert.equal(readArms([arm("a", true, 1000, 50), arm("b", false, 1000, 90)]).outcome, "won");
  assert.equal(readArms([arm("a", true, 1000, 90), arm("b", false, 1000, 50)]).outcome, "lost");
  assert.equal(readArms([arm("a", true, 1000, 50), arm("b", false, 1000, 52)]).outcome, "flat");
  assert.equal(readArms([arm("a", true, MIN_ARM - 1, 5), arm("b", false, 500, 60)]).outcome, "too-early");
  assert.equal(readArms([]).outcome, "no-data");
  const r = readArms([arm("a", true, 1000, 50), arm("b", false, 1000, 90)]);
  assert.ok(Math.abs((r.best!.lift ?? 0) - 0.8) < 1e-9, "+80% against 5%");
});

test("three versions: the best one is read, a clearly worse one alone means lost", () => {
  const r = readArms([arm("later", true, 300, 60), arm("first", false, 300, 160), arm("mid", false, 300, 130)]);
  assert.equal(r.best!.key, "first");
  assert.equal(r.outcome, "won");
  assert.equal(readArms([arm("a", true, 500, 100), arm("b", false, 500, 101), arm("c", false, 500, 40)]).outcome, "lost");
});

test("needs a decision: ended or clearly read while running, and nobody decided", () => {
  assert.equal(needsDecision(exp({ status: "ended" })), true);
  assert.equal(needsDecision(exp({ status: "ended", decision: "ship" })), false);
  assert.equal(needsDecision(exp({ status: "running", arms: [arm("a", true, 1000, 50), arm("b", false, 1000, 90)] })), true);
  assert.equal(needsDecision(exp({ status: "running", arms: [arm("a", true, 50, 5), arm("b", false, 50, 9)] })), false);
});

test("clashes: two running tests on one page, or on one service", () => {
  const list = [
    exp({ key: "convert-1", surface: "/p.html" }), exp({ key: "webyn-9", source: "webyn", surface: "/p.html" }),
    exp({ key: "convert-2", surface: "/q.html" }), exp({ key: "convert-3", surface: "/q.html", status: "ended" }),
    exp({ key: "chat-3", category: "microservice", service: "chat", surface: "Shop chat" }),
  ];
  assert.deepEqual(clashes(list), [{ place: "www.apsoparts.com/p.html", keys: ["convert-1", "webyn-9"] }]);
});

test("the chat's round 2 as a test: three arms in order, e-mails the metric, the wrote rate beside it", () => {
  const e = fromChatRound({ v: 2, current: false, on: true, firstAt: "2026-10-27T18:00:00Z", lastAt: "2026-11-13T18:00:00Z", verdict: "Shop chat: keep",
    arms: [{ variant: "first", visitors: 136, chats: 66, emails: 71 }, { variant: "later", visitors: 124, chats: 92, emails: 25 }] });
  assert.equal(e.key, "chat-2");
  assert.equal(e.status, "ended");
  assert.equal(e.endedAt, "2026-11-13T18:00:00Z");
  assert.deepEqual(e.arms.map((a) => [a.key, a.control, a.conversions]), [["later", true, 25], ["first", false, 71]]);
  assert.deepEqual(e.secondary!.arms.map((a) => a.conversions), [92, 66]);
  assert.equal(readArms(e.arms).outcome, "won");
  assert.equal(readArms(e.secondary!.arms).outcome, "lost");                 // e-mails won, chats lost: the trade-off shows
});

test("a Webyn page: a test once its test group is seen, ended after 3 quiet days", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const base = { page: "p1", first_at: "2026-11-10T00:00:00Z", last_at: "2026-11-19T00:00:00Z", paths: [{ host: "www.apsoparts.com", path: "/de-ch/x.html", visitors: 90 }] };
  assert.equal(fromWebynPage({ ...base, groups: { t: { visitors: 0, carted: 0 }, o: { visitors: 40, carted: 2 } }, params: [] }, now), null);
  const w = fromWebynPage({ ...base, groups: { t: { visitors: 50, carted: 6 }, o: { visitors: 40, carted: 2 } },
    params: [{ id: "1", version: "9", name: "Hero title", type: "None" }, { id: "2", version: null, name: "Logged-in banner", type: "Login" }] }, now)!;
  assert.equal(w.key, "webyn-p1");
  assert.equal(w.status, "running");
  assert.equal(w.name, "Webyn: Hero title");
  assert.equal(w.surface, "/de-ch/x.html");
  assert.equal(fromWebynPage({ ...base, last_at: "2026-11-15T00:00:00Z", groups: { t: { visitors: 5, carted: 0 }, o: { visitors: 5, carted: 0 } }, params: [] }, now)!.status, "ended");
});

test("days and the score of an idea", () => {
  assert.equal(daysOf({ startedAt: "2026-11-01T00:00:00Z", endedAt: "2026-11-11T00:00:00Z" }), 10);
  assert.equal(daysOf({ startedAt: null, endedAt: null }), null);
  assert.equal(iceScore({ impact: 8, confidence: 5, ease: 6 }), 6.3);
  assert.equal(iceScore(null), null);
});
