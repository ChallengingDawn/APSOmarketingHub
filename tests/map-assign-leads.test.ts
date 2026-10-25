import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanLeads, isLead, leadsByName, leadTeam } from "../src/lib/mapAssign/leadsRules";

test("the ESO line managers: only RABE, SARCLA or FALU, keyed by owner id; by the names the reports carry", () => {
  assert.equal(isLead("RABE"), true);
  assert.equal(isLead("rabe"), false);
  assert.deepEqual(cleanLeads({ "37053854": "RABE", "1229976033": "SARCLA", "x": "FALU", "77": "NOBODY", "88": null }), { "37053854": "RABE", "1229976033": "SARCLA" });
  assert.deepEqual(cleanLeads(null), {});
  const names = new Map([["37053854", "Jan Kalt"], ["1229976033", "Claudio Saraiva"]]);
  assert.deepEqual(leadsByName({ "37053854": "RABE", "999": "FALU" }, names), { "Jan Kalt": "RABE" });
  assert.equal(leadTeam("FALU"), "FALU TEAM");
});
