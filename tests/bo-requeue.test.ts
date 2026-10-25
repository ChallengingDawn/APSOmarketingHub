import assert from "node:assert/strict";
import { test } from "node:test";
import { requeuedByHand } from "../src/lib/boDistribution/rules";

/*
 * "Backoffice Team" is a name nobody watches, not a user (SARCLA, 25.10.2026: "back office team
 * nobody sees it's not a real user"). A person who moves a ticket there by hand is putting it
 * back in the pot, so handing it straight back to them is the one answer that cannot be what they
 * meant. An integration that clears the owner is the opposite case: nobody chose anything.
 */

const BACKOFFICE_TEAM = "76164822";
const TSA_TEAM = "1202569408";
const A_PERSON = "37413486";

test("a person moving a ticket onto the queue is asking for it to be redistributed", () => {
  assert.equal(requeuedByHand({ value: BACKOFFICE_TEAM, sourceType: "CRM_UI" }), true);
  assert.equal(requeuedByHand({ value: TSA_TEAM, sourceType: "CRM_UI" }), true, "any queue user, not just Back Office");
});

test("an integration clearing the owner is not somebody asking for anything", () => {
  // this is the stray case the sweep already handled: give it back to whoever had it
  assert.equal(requeuedByHand({ value: BACKOFFICE_TEAM, sourceType: "INTEGRATION" }), false);
  assert.equal(requeuedByHand({ value: BACKOFFICE_TEAM, sourceType: "AUTOMATION_PLATFORM" }), false);
  assert.equal(requeuedByHand({ value: BACKOFFICE_TEAM, sourceType: null }), false);
});

test("a ticket a person gave to a REAL colleague is left alone", () => {
  // only a move onto a queue counts - handing it to a named person is a decision to respect
  assert.equal(requeuedByHand({ value: A_PERSON, sourceType: "CRM_UI" }), false);
});

test("no history, no owner, nothing to judge", () => {
  assert.equal(requeuedByHand(undefined), false);
  assert.equal(requeuedByHand({ value: null, sourceType: "CRM_UI" }), false);
  assert.equal(requeuedByHand({ value: "", sourceType: "CRM_UI" }), false);
});
