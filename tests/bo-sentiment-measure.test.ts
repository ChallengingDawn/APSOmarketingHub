import assert from "node:assert/strict";
import { test } from "node:test";
import { summarise } from "../src/lib/boSentiment/measure";
import type { Row } from "../src/lib/boSentiment/engine";

const row = (p: Partial<Row>): Row => ({
  ticketId: "1", subject: "s", stage: "2338266326", at: "2026-10-24T10:00:00.000Z",
  real: true, reasons: [],
  keywords: { tone: "unknown", toneConfidence: 0, resolution: "unknown", urgency: 0, lang: "en", hits: [] },
  answer: { tone: "unknown", resolution: "unknown", source: "none" },
  workflow: { tone: null, resolution: null },
  replay: { tone: "neutral", resolution: "neutral" },
  ...p,
});

test("a ticket that is not a customer is counted in the exclusions and nowhere else", () => {
  const s = summarise([
    row({ real: false, reasons: ["order_confirmation"], answer: { tone: "positive", resolution: "positive", source: "keywords" } }),
    row({ real: true, answer: { tone: "negative", resolution: "neutral", source: "model" } }),
  ]);
  assert.equal(s.looked, 2);
  assert.equal(s.excluded, 1);
  assert.equal(s.scored, 1);
  // the excluded ticket's "positive" must not appear in the tone figures
  assert.deepEqual(s.tone, { positive: 0, neutral: 0, negative: 1, unknown: 0 });
  assert.deepEqual(s.source, { keywords: 0, model: 1, none: 0 });
  assert.deepEqual(s.reasons, [{ reason: "order_confirmation", label: "Order confirmation", n: 1 }]);
});

test("the reasons are ordered by how often they happen, with the page's own words", () => {
  const s = summarise([
    row({ real: false, reasons: ["only_our_own_words"] }),
    row({ real: false, reasons: ["only_our_own_words"] }),
    row({ real: false, reasons: ["bulk_mail"] }),
    row({ real: false, reasons: ["erp_stale_warning", "only_our_own_words"] }),
  ]);
  assert.deepEqual(s.reasons.map((r) => [r.label, r.n]), [
    ["Mail from us or a robot (mixed)", 3],
    ["Bulk mail (unsubscribe footer)", 1],
    ["ERP stale-export warning", 1],
  ]);
});

test("the comparison with the workflow counts blanks apart from disagreements", () => {
  const s = summarise([
    row({ answer: { tone: "negative", resolution: "neutral", source: "model" }, workflow: { tone: "negative", resolution: "neutral" } }),
    row({ answer: { tone: "neutral", resolution: "unknown", source: "model" }, workflow: { tone: "negative", resolution: "neutral" } }),
    row({ answer: { tone: "unknown", resolution: "unknown", source: "keywords" }, workflow: { tone: null, resolution: null } }),
  ]);
  assert.equal(s.versusWorkflow.agree, 1);
  assert.equal(s.versusWorkflow.differ, 1);
  assert.equal(s.versusWorkflow.workflowBlank, 1);
  assert.deepEqual(s.versusWorkflow.moves, [
    { from: "negative", to: "negative", n: 1 },
    { from: "negative", to: "neutral", n: 1 },
  ]);
});

test("where the model overruled the keywords is listed, with its reason", () => {
  const s = summarise([
    row({
      ticketId: "77", subject: "Delivery date",
      keywords: { tone: "negative", toneConfidence: 0.5, resolution: "unknown", urgency: 6, lang: "en", hits: ["urgent(urgency)"] },
      ai: { tone: "neutral", resolution: "unknown", machine: false, why: "asks to bring delivery forward", model: "m", tokens: 1, at: "x" },
      answer: { tone: "neutral", resolution: "unknown", source: "model" },
    }),
    // the model agreeing is not interesting, so it is not listed
    row({
      keywords: { tone: "negative", toneConfidence: 0.9, resolution: "unknown", urgency: 0, lang: "en", hits: [] },
      ai: { tone: "negative", resolution: "unknown", machine: false, why: "complains", model: "m", tokens: 1, at: "x" },
      answer: { tone: "negative", resolution: "unknown", source: "model" },
    }),
  ]);
  assert.equal(s.modelChanged.length, 1);
  assert.deepEqual(s.modelChanged[0], { ticketId: "77", subject: "Delivery date", from: "negative", to: "neutral", why: "asks to bring delivery forward" });
  assert.equal(s.urgent, 1);
});

test("live writes and the writes that could not be made are both counted", () => {
  const s = summarise([
    row({ written: { tone: "negative" } }),
    row({ skipped: "nothing certain to write" }),
    row({ real: false, reasons: ["newsletter"], skipped: "not a real ticket" }),
  ]);
  assert.equal(s.written, 1);
  assert.equal(s.skipped, 2);
});

/* ─────────── what reaches HubSpot ─────────── */

import { NOT_VALID_VALUE, UNKNOWN_VALUE, WRITABLE, primaryReason, valuesFor } from "../src/lib/boSentiment/engine";

test("every answer the hub can reach is a value HubSpot now accepts", () => {
  // the two options SARCLA had added on 24.10.2026
  assert.equal(UNKNOWN_VALUE, "unknown");
  assert.equal(NOT_VALID_VALUE, "not_valid_email");
  // "unknown" is writable now, so no real ticket is ever left on a stale value
  assert.deepEqual(WRITABLE, ["positive", "neutral", "negative", "unknown"]);
});

test("a ticket that is not a customer is marked as such on both properties", () => {
  const v = valuesFor({ real: false, reasons: ["order_confirmation"], answer: { tone: "positive", resolution: "positive", source: "keywords" } });
  // its old "positive" came from a machine's words, so it must not survive
  assert.deepEqual(v, { tone: "not_valid_email", resolution: "not_valid_email", reason: "order_confirmation" });
});

test("a real ticket writes exactly what the hub concluded, 'unknown' included", () => {
  assert.deepEqual(valuesFor({ real: true, reasons: [], answer: { tone: "negative", resolution: "neutral", source: "model" } }),
    { tone: "negative", resolution: "neutral", reason: "" });
  assert.deepEqual(valuesFor({ real: true, reasons: [], answer: { tone: "unknown", resolution: "unknown", source: "none" } }),
    { tone: "unknown", resolution: "unknown", reason: "" });
});

test("one reason is written, and what the ticket IS beats how we noticed", () => {
  // A ticket can trip several rules. "ERP stale-export warning" tells somebody reading a report
  // what it is; "only our own words" tells them how the gate worked it out. The first wins.
  assert.equal(primaryReason(["only_our_own_words", "erp_stale_warning"]), "erp_stale_warning");
  assert.equal(primaryReason(["model_says_machine", "newsletter"]), "newsletter");
  assert.equal(primaryReason(["only_our_own_words"]), "only_our_own_words");
  assert.equal(primaryReason([]), "");
});

test("a ticket that IS a customer carries no reason, so a freed one loses its old excuse", () => {
  const v = valuesFor({ real: true, reasons: [], answer: { tone: "neutral", resolution: "unknown", source: "keywords" } });
  assert.equal(v.reason, "", "an empty value clears whatever the ticket carried before");
});
