import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TEAMS, applyTeams, cleanLeads, cleanTeams, leadsByName, newTeamId } from "../src/lib/mapAssign/leadsRules";

test("the ESO line managers: only people in a team that exists, keyed by owner id; by the names the reports carry", () => {
  assert.deepEqual(cleanLeads({ "37053854": "RABE", "1229976033": "SARCLA", "x": "FALU", "77": "NOBODY", "88": null }), { "37053854": "RABE", "1229976033": "SARCLA" });
  assert.deepEqual(cleanLeads(null), {});
  assert.deepEqual(cleanLeads({ "1": "RABE", "2": "BENELUX" }, [{ id: "BENELUX", name: "Benelux" }]), { "2": "BENELUX" });
  const names = new Map([["37053854", "Jan Kalt"], ["1229976033", "Claudio Saraiva"]]);
  assert.deepEqual(leadsByName({ "37053854": "RABE", "999": "FALU" }, names), { "Jan Kalt": "RABE" });
});

test("the teams: the first three until changed; renamed teams keep their id; added ones get one; no two names alike", () => {
  assert.deepEqual(cleanTeams(undefined), DEFAULT_TEAMS);
  assert.deepEqual(cleanTeams([{ id: "RABE", name: "  Rabe   Team " }, { id: "RABE", name: "Again" }, { id: "bad id", name: "X" }, { id: "FALU", name: "rabe team" }]), [{ id: "RABE", name: "Rabe Team" }]);
  assert.equal(newTeamId("Bénélux team", []), "BENELUX-TEAM");
  assert.equal(newTeamId("Benelux team", ["BENELUX-TEAM"]), "BENELUX-TEAM-2");
  const now = DEFAULT_TEAMS;
  const r = applyTeams([{ id: "RABE", name: "Team North" }, { name: "Benelux" }, { id: "FALU", name: "FALU TEAM" }], now);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.teams, [{ id: "RABE", name: "Team North" }, { id: "BENELUX", name: "Benelux" }, { id: "FALU", name: "FALU TEAM" }]);
  assert.match(applyTeams([{ id: "RABE", name: "" }], now).error ?? "", /needs a name/);
  assert.match(applyTeams([{ name: "A" }, { name: "a" }], now).error ?? "", /two teams/);
  // an id the store does not know is a new team, not a way to make up ids
  assert.deepEqual(applyTeams([{ id: "MADEUP", name: "Made up" }], now).teams, [{ id: "MADE-UP", name: "Made up" }]);
  // a deleted team's people lose it
  assert.deepEqual(cleanLeads({ "1": "SARCLA", "2": "RABE" }, r.teams), { "2": "RABE" });
});
