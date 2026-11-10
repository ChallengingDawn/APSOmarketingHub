import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE, strayStage } from "../src/lib/boDistribution/rules";

/*
 * Ticket 448924014805 (09.11.2026): a customer's mail to support@apsoparts.com, also addressed to an angst-pfister.com
 * team. "SARCLA | Back Office Waiting on external team" read that To and set Waiting Internally a minute later, so the
 * routing (which takes tickets in New) never took it; the "waiting for an owner" sweep gave it Claudia and left the
 * stage. SARCLA 10.11.2026: "the ticket got assigned but on waiting internally - in this case it should go to assign".
 */

test("a Back Office ticket given its owner in Waiting Internally goes to Assigned", () => {
  assert.equal(strayStage("bo", "2726922455"), STAGE.assigned);
  assert.equal(STAGE.assigned, "2338266326");
});

test("every other stage keeps its stage - the owner only, as before", () => {
  for (const s of ["2473210048", "2728031473", "2338266327", "3640065212", STAGE.cutToSizeIssue, null]) assert.equal(strayStage("bo", s), null);
  // GQS has its own step (New for Back-Office -> Waiting on APSO), ESO / TSA are the company owner's
  for (const p of ["gqs", "eso", "tsa"]) assert.equal(strayStage(p, "2726922455"), null);
});
