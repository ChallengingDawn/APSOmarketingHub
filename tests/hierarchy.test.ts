import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanHierarchy, effective, reportsOfUnit, seedUnit, under, wouldLoop } from "../src/lib/hierarchy/rules";
import { SCOPE_LEAD, scopeOf, scopedPeople, viewsOf } from "../src/lib/reporting/mySalesScope";

// SARCLA 01.11.2026: "bring another sub-app to Settings to define the hierarchy - keep the existing; Back Office is under
// Rose, Italy is Luca as sales leader, also reporting directly to Alexandre, the CEO".
const CEO = "1", LUCA = "2", ROSE = "3", ADEM = "4", BO = "5", IT = "6";

test("what is set here wins; what is not keeps what the hub knew before", () => {
  const seed = { [ADEM]: { unit: "ESO", manager: LUCA }, [BO]: { unit: "Back Office" } };
  const saved = cleanHierarchy({ [ADEM]: { manager: null }, [BO]: { manager: ROSE }, abc: { unit: "x" }, [IT]: { manager: IT } });
  // an owner id only; nobody their own manager
  assert.deepEqual(saved, { [ADEM]: { manager: null }, [BO]: { manager: ROSE } });
  const h = effective(saved, seed);
  assert.deepEqual(h[ADEM], { manager: null, unit: "ESO" });
  assert.deepEqual(h[BO], { manager: ROSE, unit: "Back Office" });
});

test("everyone under a person, at any depth - and no loop can be made", () => {
  const h = { [LUCA]: { manager: CEO }, [ROSE]: { manager: CEO }, [IT]: { manager: LUCA }, [ADEM]: { manager: IT }, [BO]: { manager: ROSE }, [CEO]: { manager: null } };
  assert.deepEqual(under(h, LUCA).sort(), [ADEM, IT].sort());
  assert.deepEqual(under(h, CEO).sort(), [ADEM, BO, IT, LUCA, ROSE].sort());
  assert.deepEqual(under(h, ADEM), []);
  // the CEO under Adem would close a loop; Adem under Rose would not
  assert.equal(wouldLoop(h, CEO, ADEM), true);
  assert.equal(wouldLoop(h, LUCA, LUCA), true);
  assert.equal(wouldLoop(h, ADEM, ROSE), false);
});

test("a unit's reports, and the unit known before: the rosters, else HubSpot's team", () => {
  assert.equal(reportsOfUnit("ESO"), "eso");
  assert.equal(reportsOfUnit("TSA"), "tsa");
  assert.equal(reportsOfUnit("Back Office"), null);
  assert.equal(seedUnit("ESO", "Back Office"), "ESO");
  assert.equal(seedUnit(null, "APSOparts TSA"), "TSA");
  assert.equal(seedUnit(null, "Back Office  CH"), "Back Office CH");
  assert.equal(seedUnit(null, null), null);
});

test("the switch: Adem sees his own, his team, all ESO and all; a TSA person all TSA (SARCLA 01.11.2026)", () => {
  const adem = { me: { id: ADEM, name: "Adem" }, subject: { id: ADEM, name: "Adem" }, reports: "eso" as const, team: [] };
  assert.deepEqual(viewsOf(adem).map((v) => v.label), ["Mine", "My team", "All ESO", "All (ESO + TSA)"]);
  const tsa = { ...adem, reports: "tsa" as const };
  assert.deepEqual(viewsOf(tsa).map((v) => v.label), ["Mine", "My team", "All TSA", "All (ESO + TSA)"]);
  // a team not set up yet shows nobody, never the person alone
  assert.deepEqual(scopeOf(adem, "team").leads.byId, {});
  const luca = { me: { id: LUCA, name: "Luca" }, subject: { id: LUCA, name: "Luca" }, reports: "eso" as const, team: [{ id: LUCA, name: "Luca" }, { id: IT, name: "Ita" }] };
  assert.deepEqual(viewsOf(luca).map((v) => v.id), ["me", "team", "unit", "all"]);
  // Back Office: no unit's reports - their own, their team, all
  assert.deepEqual(viewsOf({ ...luca, reports: null }).map((v) => v.id), ["me", "team", "all"]);

  // whose figures: Adem alone, by owner id and by name; the team; the unit; all
  const mine = scopeOf(adem, "me");
  assert.equal(mine.lead, SCOPE_LEAD);
  assert.deepEqual(mine.leads.byId, { [ADEM]: SCOPE_LEAD });
  assert.deepEqual(mine.leads.byName, { Adem: SCOPE_LEAD });
  assert.deepEqual(Object.keys(scopeOf(luca, "team").leads.byId).sort(), [IT, LUCA].sort());
  assert.deepEqual(scopeOf(tsa, "unit"), { team: "tsa", lead: null, leads: { byName: {}, byId: {}, teams: [] } });
  assert.equal(scopeOf(adem, "all").team, "total");
  // a read's people: only the scope's
  assert.deepEqual([...scopedPeople([{ id: ADEM }, { id: ROSE }, { id: ADEM }], mine.leads.byId, "id")], [0, 2]);
});
