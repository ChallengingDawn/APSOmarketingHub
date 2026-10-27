import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_VISITORS, compare, twoProportionP, type AbRow } from "../src/lib/chat/abStats";

const row = (country: string, variant: "first" | "later", visitors: number, chats: number, emails: number): AbRow =>
  ({ country, variant, visitors, chats, emails, emails_first: variant === "first" ? emails : 0, chats_with_email: Math.min(chats, emails), handovers: 0 });

test("two proportions: equal rates are no difference, far apart ones are", () => {
  assert.ok((twoProportionP(50, 100, 50, 100) ?? 0) > 0.99);
  assert.ok((twoProportionP(30, 100, 60, 100) ?? 1) < 0.001);
  assert.equal(twoProportionP(1, 0, 1, 10), null);
});

test("too early under the minimum of visitors per variant", () => {
  const [all] = compare([row("CH", "first", MIN_VISITORS - 1, 20, 40), row("CH", "later", 200, 100, 30)]);
  assert.equal(all.verdict, "too-early");
});

test("asking first clearly loses chats: keep asking later", () => {
  const [all] = compare([row("CH", "first", 400, 120, 300), row("CH", "later", 400, 240, 80)]);
  assert.equal(all.verdict, "keep-later");
  assert.ok((all.chatRate.diff ?? 0) < 0);
});

test("asking first keeps the chats and brings more e-mails: make it mandatory", () => {
  const [all] = compare([row("CH", "first", 400, 236, 300), row("CH", "later", 400, 240, 80)]);
  assert.equal(all.verdict, "mandatory");
});

test("per country, with All first; a page without a country counts as INT", () => {
  const out = compare([row("DE", "first", 10, 5, 8), row("CH", "later", 10, 6, 2), { ...row("x", "first", 3, 1, 1), country: null }]);
  assert.deepEqual(out.map((c) => c.country), ["All", "CH", "DE", "INT"]);
  assert.equal(out[0].first.visitors, 13);
  assert.equal(out[0].later.visitors, 10);
});
