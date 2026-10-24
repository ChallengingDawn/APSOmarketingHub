import assert from "node:assert/strict";
import { test } from "node:test";
import { headline, summarise } from "../src/lib/boSentiment/measure";
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
    ["Only our own words", 3],
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

test("the headline leads with how much was not a customer", () => {
  const s = summarise([
    row({ real: false, reasons: ["newsletter"] }),
    row({ real: true, answer: { tone: "negative", resolution: "neutral", source: "model" } }),
    row({ real: true, answer: { tone: "unknown", resolution: "unknown", source: "keywords" } }),
  ]);
  const h = headline(s);
  assert.match(h, /2 of 3 tickets were a customer talking/);
  assert.match(h, /1 were not \(33\.3%\)/);
  assert.match(h, /50% of them sound unhappy/);
  assert.match(h, /50% give nothing to go on/);
  assert.equal(headline(summarise([])), "Nothing looked at yet.");
});
