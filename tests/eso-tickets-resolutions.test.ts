import assert from "node:assert/strict";
import { test } from "node:test";
import { OUTCOMES } from "../src/lib/marketingKpis/handoverCube";
import { CHANNEL_ORDER, MAIL, effortOf, flowOf, kindOf, resolutionsOf, rowsOf, startLabels, statsBy, type TicketsData } from "../src/lib/reporting/ticketsRules";

// SARCLA 31.10.2026 on the live Tickets pages: e-mail and the Back Office redirects as one channel, the breakdown by
// resolutions (overall, by channel, per owner), what was logged, the months.
const O = (id: string) => OUTCOMES.findIndex((o) => o.id === id);
const ch = (l: string) => CHANNEL_ORDER.indexOf(l);

test("tickets: an e-mail and a Back Office redirect are one channel", () => {
  assert.equal((kindOf({ subject: "BO | Email | Anfrage 1234" }, {}) as { channel: string }).channel, MAIL);
  assert.equal((kindOf({ subject: "Re: Anfrage", sourceType: "EMAIL", objectSource: "CONVERSATIONS" }, {}) as { channel: string }).channel, MAIL);
  assert.ok(CHANNEL_ORDER.includes(MAIL) && !CHANNEL_ORDER.includes("E-mail") && !CHANNEL_ORDER.includes("Redirected from Back Office"));
});

test("tickets: how much was logged, in buckets", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 30].map(effortOf), [0, 1, 2, 2, 3, 3, 4, 4]);
});

// person, year, month, day, group, channel, prio, category, country, outcome, firstH x10, first, emails, calls, meetings, notes, resolution
const d: TicketsData = {
  generatedAt: "2026-10-31T08:00:00Z", year: 2026, today: "2026-10-31",
  people: [{ id: "1", name: "Ana", team: "ESO" }, { id: "2", name: "Ben", team: "ESO" }],
  labels: { ...startLabels(), category: ["APSOcore"], country: ["Switzerland"], resolution: ["Ordered", "Can't supply the item", "Only looking for info", "Price issue"] },
  tickets: [
    [0, 0, 8, 1, 0, ch(MAIL), 0, 0, 0, O("won"), 30, 0, 1, 0, 0, 0, 0],
    [0, 0, 8, 2, 0, ch(MAIL), 0, 0, 0, O("won"), 30, 0, 2, 1, 0, 1, 0],
    [0, 0, 8, 3, 0, ch(MAIL), 0, 0, 0, O("supply"), 40, 1, 1, 0, 0, 0, 1],
    [1, 0, 9, 4, 0, ch("Website form"), 0, 0, 0, O("info"), -1, -1, 0, 0, 0, 0, 2],
    [1, 0, 9, 5, 0, ch("Website form"), 0, 0, 0, O("nores"), -1, -1, 0, 0, 0, 0, -1],
    [1, 0, 9, 6, 0, ch("Website form"), 0, 0, 0, O("open"), -1, -1, 0, 0, 0, 0, -1],
    [0, 0, 9, 7, 0, ch("Website form"), 0, 0, 0, O("price"), 10, 2, 0, 3, 0, 4, 3],
  ],
  texts: { "2": "Profile we don't have", "3": "Only wanted a datasheet" },
  coverage: { read: 7, kept: 7, withCompany: 7, left: {} },
};
const win = { from: 0, to: 11 };

test("tickets: the resolutions of the closed - the most used first, each with its standing; no resolution apart, the open out", () => {
  const s = statsBy(rowsOf(d, "incoming", win, {}, null), win).get("")!;
  const r = resolutionsOf(d, s);
  assert.deepEqual(r.map((x) => [x.label, x.n, x.group]), [
    ["Ordered", 2, "won"], ["Can't supply the item", 1, "lost"], ["No resolution set", 1, "nores"], ["Only looking for info", 1, "lost"], ["Price issue", 1, "lost"],
  ]);
  assert.equal(s.closed, 6);
  // by channel and by person, the same counting
  const byCh = statsBy(rowsOf(d, "incoming", win, {}, null), win, (x) => (x[5] === ch(MAIL) ? "mail" : "form"));
  assert.deepEqual(resolutionsOf(d, byCh.get("mail")!).map((x) => x.n), [2, 1]);
  assert.equal(byCh.get("form")!.open, 1);
});

test("tickets: what was logged - buckets with their win rates, closed without any activity", () => {
  const s = statsBy(rowsOf(d, "incoming", win, {}, null), win).get("")!;
  // logged: 1, 4, 1, 0, 0, 0 (open), 7
  assert.deepEqual(s.effort, [3, 2, 0, 1, 1]);
  assert.deepEqual(s.effortResolved, [1, 2, 0, 1, 1]);
  assert.deepEqual(s.effortWon, [0, 1, 0, 1, 0]);
  // the form tickets closed with nothing on them: info and no resolution - the open one does not count
  assert.equal(s.quiet, 2);
});

test("tickets: each month by what became of it, and its first contacts' hours", () => {
  const s = statsBy(rowsOf(d, "incoming", win, {}, null), win).get("")!;
  assert.deepEqual([s.monthsWon[8], s.monthsLost[8], s.monthsLost[9], s.monthsNores[9], s.monthsOpen[9]], [2, 1, 2, 1, 1]);
  assert.deepEqual(s.monthsHours[8], [3, 3, 4]);
  assert.deepEqual(s.monthsHours[9], [1]);
});

test("tickets: the path ends on the resolution - the named ones, the rest together by their standing", () => {
  const fl = flowOf(d, rowsOf(d, "incoming", win, {}, null));
  assert.deepEqual(fl.columns, ["Came from", "First contact", "Outcome", "Resolution"]);
  const link = (a: string, b: string) => fl.links.find((l) => l.from === a && l.to === b)?.value ?? 0;
  assert.equal(link(`c:${ch(MAIL)}`, "s:0"), 3);
  assert.equal(link("o:won", "r:0"), 2);
  assert.equal(link("o:lost", "r:1"), 1);
  // a ticket closed without a resolution and an open one end at their outcome
  assert.ok(!fl.links.some((l) => l.from === "o:nores" || l.from === "o:open"));
  assert.equal(fl.nodes.find((n) => n.id === "r:0")!.tone, "good");
  assert.equal(fl.nodes.find((n) => n.id === "r:1")!.tone, "bad");
});
