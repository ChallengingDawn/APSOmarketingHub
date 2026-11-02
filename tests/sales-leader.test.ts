import assert from "node:assert/strict";
import { test } from "node:test";
import { groupCells, leaderTeams, myTeam, onTrack, personCell, personCells } from "../src/lib/reporting/salesLeaderRules";

// SARCLA 02.11.2026: "build the sales leader report - the table for overall and for its team on the targets first page";
// his pick: Overall a row per sales leader's team, each opening to its people, and the grand total.
const CEO = "1", BERND = "2", LUCA = "3", ROSE = "4", ADEM = "5", KATJA = "6", RAF = "7", AYLA = "8";
const people = [
  { id: CEO, name: "Alexandre" }, { id: BERND, name: "Bernd" }, { id: LUCA, name: "Luca" }, { id: ROSE, name: "Rose" },
  { id: ADEM, name: "Adem" }, { id: KATJA, name: "Katja" }, { id: RAF, name: "Raffaello" }, { id: AYLA, name: "Ayla" },
];
const placed = {
  [CEO]: { manager: null, unit: "Management", tags: ["buc" as const] },
  [BERND]: { manager: CEO, unit: "ESO", tags: ["leader" as const, "buc" as const] },
  [LUCA]: { manager: CEO, unit: "ESO", tags: ["leader" as const] },
  [ROSE]: { manager: CEO, unit: "Back Office", tags: ["buc" as const] },
  [ADEM]: { manager: BERND, unit: "ESO" }, [KATJA]: { manager: BERND, unit: "ESO" },
  [RAF]: { manager: LUCA, unit: "ESO" }, [AYLA]: { manager: ROSE, unit: "Back Office" },
};

test("the teams: everyone tagged Sales leader and everyone under them - not the CEO, not Back Office", () => {
  const teams = leaderTeams(people, placed);
  assert.deepEqual(teams.map((t) => [t.leader.name, t.people.map((p) => p.name), t.reports]), [
    ["Bernd", ["Bernd", "Adem", "Katja"], "eso"],
    ["Luca", ["Luca", "Raffaello"], "eso"],
  ]);
  // nobody tagged yet: those with people under them in ESO or TSA
  const untagged = Object.fromEntries(Object.entries(placed).map(([k, v]) => [k, { ...v, tags: [] }]));
  assert.deepEqual(leaderTeams(people, untagged).map((t) => t.leader.name), ["Bernd", "Luca"]);
});

test("my team: a leader's own; anyone else's leader's; the CEO's everyone under him; nobody's when in none", () => {
  assert.deepEqual(myTeam({ id: BERND, name: "Bernd" }, people, placed)?.people.map((p) => p.name), ["Bernd", "Adem", "Katja"]);
  assert.deepEqual(myTeam({ id: ADEM, name: "Adem" }, people, placed)?.leader.name, "Bernd");
  assert.equal(myTeam({ id: CEO, name: "Alexandre" }, people, placed)?.people.length, 8);
  assert.equal(myTeam(null, people, placed), null);
  assert.equal(myTeam({ id: "99", name: "Nobody" }, people, placed), null);
});

test("a person's cell as the VPP sheet reckons it; a team adds up only those with a target", () => {
  // half the year run: the first two quarters due in full (25.6 + 25 % of the year)
  const reach = { month: 5, share: 1 };
  const c = personCell("own", { py: 1_000_000, ytd: 600_000 }, { own: 10 }, reach);
  assert.equal(c.year, 1_100_000);
  assert.ok(Math.abs(c.due - 1_100_000 * 0.506) < 1e-6);
  assert.ok(Math.abs(onTrack(c)! - 600_000 / (1_100_000 * 0.506)) < 1e-9);
  // no target: the year to date, nothing due, not on track or off it
  const none = personCell("own", { py: 500_000, ytd: 200_000 }, {}, reach);
  assert.deepEqual(none, { ytd: 200_000, year: 0, due: 0, reached: 0, set: 0, of: 1 });
  assert.equal(onTrack(none), null);
  const reachBoth = { rev: reach, visits: reach };
  const team = groupCells([
    personCells({ own: { py: 1_000_000, ytd: 600_000 }, visits: { py: 0, ytd: 50 } }, { own: 10, visits: 100 }, reachBoth),
    personCells({ own: { py: 500_000, ytd: 200_000 } }, {}, reachBoth),
  ]);
  // everyone's year to date; the target, due and reached of the one with a target
  assert.equal(team.own.ytd, 800_000);
  assert.equal(team.own.reached, 600_000);
  assert.equal(team.own.year, 1_100_000);
  assert.deepEqual([team.own.set, team.own.of], [1, 2]);
  // visits by the sheet's own weights: 26.5 + 27.5 % due
  assert.ok(Math.abs(team.visits.due - 54) < 1e-9);
});
