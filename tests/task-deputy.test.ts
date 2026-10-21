import assert from "node:assert/strict";
import { test } from "node:test";
import { EXACT_SUBJECTS, OPEN_STATUSES, PREFIX_SUBJECTS, subjectInScope } from "../src/lib/holiday/taskSweep";
import { deputyTarget, userState, type UserState } from "../src/lib/connectors/steps/ticketRules";

/** A user who is away right now, with an absence window around today. */
const away = (id: string, d1: string | null = null, d2: string | null = null): UserState => {
  const now = Date.now();
  return userState(id, {
    hubspot_owner_id: id, hs_email: `${id}@apsoparts.com`, hs_is_out_of_office: "true",
    ap_deputy_owner_id: d1, ap_deputy_2_owner_id: d2,
    hs_out_of_office_hours: JSON.stringify([{ startTimestamp: now - 86_400_000, endTimestamp: now + 86_400_000 }]),
  }, now);
};
const present = (id: string): UserState =>
  userState(id, { hubspot_owner_id: id, hs_email: `${id}@apsoparts.com`, hs_is_out_of_office: "false" }, Date.now());

test("the three subjects the workflow redirected, and nothing else", () => {
  for (const s of EXACT_SUBJECTS) assert.equal(subjectInScope(s), true, s);
  assert.equal(subjectInScope("New registrant"), true);
  // HubSpot appends a customer code, which is why this one is a prefix
  assert.equal(subjectInScope("New registrant KOLE"), true);
  assert.equal(subjectInScope("  New registrant ABCD  "), true); // trimmed

  for (const s of [
    "Contact Customer", "Call back", "", null, undefined,
    "Pending: Mark Company as Qualified", // not the exact subject
    "Re: New registrant KOLE",            // prefix, not "contains"
  ]) {
    assert.equal(subjectInScope(s as string), false, String(s));
  }
});

test("a finished task is nobody's problem", () => {
  assert.deepEqual(OPEN_STATUSES, ["NOT_STARTED", "WAITING", "IN_PROGRESS"]);
  assert.equal(OPEN_STATUSES.includes("COMPLETED"), false);
  assert.equal(OPEN_STATUSES.includes("DEFERRED"), false);
});

test("the chain is the ticket sweep's, so tasks and tickets cannot disagree", () => {
  const get = (m: Record<string, UserState>) => (id: string) => m[id];

  // owner in office: nothing moves
  assert.deepEqual(deputyTarget("A", get({ A: present("A") }), false), { to: null, reason: "" });

  // owner away, deputy 1 in office
  const d1 = deputyTarget("A", get({ A: away("A", "B"), B: present("B") }), false);
  assert.equal("to" in d1 && d1.to, "B");

  // deputy 1 also away, deputy 2 picks it up
  const d2 = deputyTarget("A", get({ A: away("A", "B", "C"), B: away("B"), C: present("C") }), false);
  assert.equal("to" in d2 && d2.to, "C");

  // everyone away, no fallback asked for: left alone, with a reason
  const none = deputyTarget("A", get({ A: away("A", "B"), B: away("B") }), false);
  assert.equal("to" in none && none.to, null);
  assert.match("to" in none ? none.reason : "", /no usable deputy/);

  // everyone away, TSA fallback on
  const tsa = deputyTarget("A", get({ A: away("A", "B"), B: away("B") }), true);
  assert.equal("to" in tsa && tsa.to, "1202569408");
});

test("a user the sweep has not read yet is asked for, not guessed", () => {
  const d = deputyTarget("A", () => undefined, false);
  assert.deepEqual(d, { need: "A" });
});

test("the out-of-office boolean alone is not a holiday - the window is", () => {
  // `userState.ooo` IS the bare boolean: the window is a separate field, and
  // requiring it is the CALLER's job. The ticket sweep does it in
  // deputyDecision; taskDeputySweep does it explicitly for the same reason.
  const noWindow = userState("A", {
    hubspot_owner_id: "A", hs_email: "a@apsoparts.com", hs_is_out_of_office: "true",
    ap_deputy_owner_id: "B", ap_deputy_2_owner_id: null, hs_out_of_office_hours: null,
  }, Date.now());
  assert.equal(noWindow.ooo, true);      // the boolean says away
  assert.equal(noWindow.window, null);   // nothing says WHEN
  // so the chain alone would hand it over - which is why the window is checked
  const d = deputyTarget("A", (id) => ({ A: noWindow, B: present("B") }[id]), false);
  assert.equal("to" in d && d.to, "B");
  // and with a real window it is a genuine absence
  assert.notEqual(away("A", "B").window, null);
});
