import assert from "node:assert/strict";
import { test } from "node:test";
import { offersOf, refusalsOf, stageTimes, sumOf, taskOf, winRate, GQS_STAGE } from "../src/lib/reporting/boGqs";
import { DEFAULT_LIMITS } from "../src/lib/gqsApprovals/rules";

// SARCLA 04.11.2026: "GQS is very very incomplete - this is a full pipeline, we should have the full scope" - each GQS
// task from its properties and its stage and STATUS OF GQS histories: the approval, the days in each stage, the offer or
// the refusal, the result.

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 2, 2, 8); // Monday 2 March 2026, 09:00 in Zurich
const at = (days: number) => new Date(T0 + days * DAY).toISOString();
const h = (...xs: [number, string][]) => xs.map(([d, value]) => ({ value, timestamp: at(d) }));

test("a request approved by its line manager, worked, offered twice and won", () => {
  const t = taskOf("1", {
    createdate: at(0), hs_pipeline_stage: GQS_STAGE.offer, status_of_gqs: "WON", gqs_type_of_request: "DT -  New Business",
    hubspot_owner_id: "70", back_office_ticket_requester: "80", price_tier_approver: "90", customer_number_customer_name: "  747603 Erwin Telle GmbH ",
    order_potential_: "25000", margin__: "35", liquidation_article: "false",
  },
  // the stages, in any order - a value repeated is the same visit
  h([6, GQS_STAGE.offer], [0, GQS_STAGE.sales], [0.5, GQS_STAGE.new], [1, GQS_STAGE.open], [1, GQS_STAGE.open], [3, GQS_STAGE.gqs], [8, GQS_STAGE.open], [5, GQS_STAGE.open], [9, GQS_STAGE.offer]),
  h([0.01, "Review by Line manager"], [0.02, "Approved by Line Manager"], [6, "Offer Sent to Sales"], [20, "WON"]), DEFAULT_LIMITS, T0 + 30 * DAY)!;
  assert.equal(t.ty, "DT - New Business", "HubSpot's two spaces tidied");
  assert.equal(t.cu, "747603 Erwin Telle GmbH");
  assert.equal(t.mar, 0.35, "a margin typed as a percentage read as one");
  assert.equal(t.ap, "r");
  assert.equal(t.dec, "y");
  assert.equal(Math.round(((t.decAt! - t.apAt!) / 3_600_000) * 100) / 100, 0.24, "the decision timed from the request reaching the line manager");
  assert.equal(t.res, "w");
  assert.equal(t.rule, "big", "sent to the line manager for its potential of 20,000 EUR or more");
  assert.equal(t.of, T0 + 5 * DAY + DAY, "the first offer");
  assert.equal(t.ofN, 2);
  assert.equal(t.sent, T0 + 3 * DAY, "sent on to GQS");
  // Open the GQS Task 1-3, 5-6 and 8-9: 4 days; Waiting on GQS 3-5
  assert.deepEqual(t.d, { sales: 0.5, new: 0.5, open: 4, gqs: 2 });
});

test("approved by itself, refused by GQS with a reason; a re-entry goes to the line manager", () => {
  const r = taskOf("2", { createdate: at(0), hs_pipeline_stage: GQS_STAGE.refused, status_of_gqs: "LOST", reason_of_decline_by_pm: "can't do 190mm PVC round bar" },
    h([0, GQS_STAGE.sales], [0.1, GQS_STAGE.new], [1, GQS_STAGE.open], [2, GQS_STAGE.refused]),
    h([0.01, "Automatically Approved"], [2, "Refused by GQS"], [3, "LOST"]), DEFAULT_LIMITS, T0 + 30 * DAY)!;
  assert.equal(r.ap, "a");
  assert.equal(r.by, "gqs");
  assert.equal(r.why, "can't do 190mm PVC round bar");
  assert.equal(r.rf, T0 + 2 * DAY);
  assert.equal(r.res, "l", "the sales ticket lost - but no offer, so no win rate");
  assert.equal(r.of, undefined);
  const again = taskOf("3", { createdate: at(0), hs_pipeline_stage: GQS_STAGE.open, reason_of_decline_by_pm: "." }, h([0, GQS_STAGE.open]),
    h([0.01, "Automatically Approved"], [4, "Review by Line manager"]), DEFAULT_LIMITS, T0 + 10 * DAY)!;
  assert.equal(again.ap, "r", "sent to the line manager after an approval of its own");
  assert.equal(again.dec, undefined);
  assert.equal(again.why, undefined, "a reason of one dot is none");
  assert.deepEqual(again.d, { open: 10 }, "the stage it is in counts to now");
});

test("the sums: where the requests stand, the offers and what came of them, the refusals, the stages", () => {
  const mk = (id: string, stage: string, status: string | null, stages: [number, string][], statuses: [number, string][], pot?: string) =>
    taskOf(id, { createdate: at(0), hs_pipeline_stage: stage, status_of_gqs: status, order_potential_: pot, customer_number_customer_name: id === "d" ? "A" : "B" }, h(...stages), h(...statuses), DEFAULT_LIMITS, T0 + 40 * DAY)!;
  const ts = [
    mk("a", GQS_STAGE.offer, "WON", [[0, GQS_STAGE.open], [4, GQS_STAGE.offer]], [[0, "Automatically Approved"], [30, "WON"]], "1000"),
    mk("b", GQS_STAGE.offer, "LOST", [[0, GQS_STAGE.open], [10, GQS_STAGE.offer]], [[0, "Automatically Approved"], [30, "LOST"]], "3000"),
    mk("c", GQS_STAGE.offer, "Offer Sent to Sales", [[0, GQS_STAGE.open], [2, GQS_STAGE.remind], [3, GQS_STAGE.offer]], [[0, "Review by Line manager"], [0.5, "Refused by Line Manager"]]),
    mk("d", GQS_STAGE.refused, "LOST", [[0, GQS_STAGE.open], [1, GQS_STAGE.refused]], [[1, "Refused by Back-Office"]]),
    mk("e", GQS_STAGE.cust, null, [[0, GQS_STAGE.open], [1, GQS_STAGE.cust]], []),
  ];
  const s = sumOf(ts);
  assert.deepEqual([s.n, s.auto, s.review, s.noAp, s.lmNo], [5, 2, 1, 2, 1]);
  assert.deepEqual([s.offer, s.refused, s.open], [3, 1, 1]);
  assert.deepEqual([s.won, s.lost], [1, 1], "the refused one's LOST is no lost offer");
  assert.deepEqual([s.pot, s.potN, s.potWon], [4000, 2, 1000]);
  assert.equal(s.reminded, 1);
  assert.equal(s.customers, 2);
  assert.equal(s.again, 1, "customer B asked four times");
  const o = offersOf(ts);
  assert.deepEqual([o.n, o.won, o.lost, o.pot, o.potWon], [3, 1, 1, 4000, 1000]);
  assert.deepEqual(o.days, [4, 10, 3]);
  assert.equal(winRate(o.won, o.lost), 0.5);
  assert.deepEqual(refusalsOf(ts), { n: 1, gqs: 0, bo: 1, lm: 0, none: 0 });
  const st = stageTimes(ts);
  assert.deepEqual(st.find((x) => x.stage === "open"), { stage: "open", n: 5, median: 2, mean: 3.6, now: 0 });
  assert.equal(st.find((x) => x.stage === "cust")?.now, 1);
});
