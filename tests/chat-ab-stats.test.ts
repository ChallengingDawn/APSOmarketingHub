import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_VISITORS, compare, cumulative, rateOf, twoProportionP, type AbRow, type Variant } from "../src/lib/chat/abStats";
import { langOf, shopLinks, summaryMail } from "../src/lib/chat/summaryText";

const row = (country: string, variant: Variant, visitors: number, chats: number, emails: number, extra: Partial<AbRow> = {}): AbRow =>
  ({ country, variant, visitors, chats, emails, emails_first: variant === "first" ? emails : 0, chats_with_email: Math.min(chats, emails), handovers: 0, ...extra });

test("two proportions: equal rates are no difference, far apart ones are", () => {
  assert.ok((twoProportionP(50, 100, 50, 100) ?? 0) > 0.99);
  assert.ok((twoProportionP(30, 100, 60, 100) ?? 1) < 0.001);
  assert.equal(twoProportionP(1, 0, 1, 10), null);
});

test("the 95% range: around the rate, inside 0-100%, honest for one visitor", () => {
  const r = rateOf(25, 123);
  assert.ok(r.lo! < r.rate! && r.rate! < r.hi!);
  assert.ok(r.lo! > 0.13 && r.hi! < 0.29);                      // 20.3% of 123: about 14-28%
  const one = rateOf(1, 1);                                      // AT's "100%" from one visitor
  assert.equal(one.rate, 1);
  assert.ok(one.lo! < 0.25, "one visitor cannot say much");
  assert.equal(rateOf(0, 0).rate, null);
});

test("too early under the minimum of visitors per variant", () => {
  const [all] = compare([row("CH", "first", MIN_VISITORS - 1, 20, 40), row("CH", "later", 200, 100, 30)]);
  assert.equal(all.verdict, "too-early");
});

test("round 2's shape: asking first clearly loses chats - keep asking later", () => {
  // 135 first (65 wrote, 71 e-mails) against 123 later (92 wrote, 25 e-mails), as on 13.11.2026
  const [all] = compare([row("CH", "first", 135, 65, 71), row("CH", "later", 123, 92, 25)]);
  assert.equal(all.verdict, "keep-later");
  assert.deepEqual(all.variants, ["later", "first"]);
  assert.ok((all.tests.first!.wrote.diff ?? 0) < 0);
  assert.ok((all.tests.first!.email.diff ?? 0) > 0);
  assert.equal(all.arms.first.arm.emails, 71);
  assert.equal(all.tests.mid, undefined);
});

test("asking first keeps the chats and brings more e-mails: ask first", () => {
  const [all] = compare([row("CH", "first", 400, 236, 300), row("CH", "later", 400, 240, 80)]);
  assert.equal(all.verdict, "go-first");
});

test("three variants: the summary keeps the chats and brings e-mails while first loses chats - offer the summary", () => {
  const [all] = compare([
    row("DE", "later", 300, 225, 60), row("DE", "first", 300, 150, 160),
    row("DE", "mid", 300, 222, 130, { asked: 200, emails_mid: 110, emails_typed: 20, summaries: 110 }),
  ]);
  assert.deepEqual(all.variants, ["later", "first", "mid"]);
  assert.equal(all.verdict, "go-mid");
  assert.equal(all.arms.mid.arm.emailsMid, 110);
  assert.equal(all.arms.mid.arm.asked, 200);
});

test("both challengers win: the one with more e-mails", () => {
  const [all] = compare([row("CH", "later", 300, 200, 50), row("CH", "first", 300, 198, 200), row("CH", "mid", 300, 201, 120)]);
  assert.equal(all.verdict, "go-first");
});

test("per country, with All first; a page without a country counts as INT; unknown variants are ignored", () => {
  const out = compare([row("DE", "first", 10, 5, 8), row("CH", "later", 10, 6, 2), { ...row("x", "first", 3, 1, 1), country: null },
    { ...row("CH", "later", 5, 5, 5), variant: "other" as Variant }]);
  assert.deepEqual(out.map((c) => c.country), ["All", "CH", "DE", "INT"]);
  assert.equal(out[0].arms.first.arm.visitors, 13);
  assert.equal(out[0].arms.later.arm.visitors, 10);
});

test("the running total per variant, day by day", () => {
  const cum = cumulative([
    { variant: "later", day: "2026-11-13", visitors: 3, chats: 2, emails: 1 },
    { variant: "mid", day: "2026-11-13", visitors: 4, chats: 3, emails: 2 },
    { variant: "later", day: "2026-11-14", visitors: 1, chats: 1, emails: 2 },
  ], ["later", "mid"]);
  assert.deepEqual(cum.map((p) => p.day), ["2026-11-13", "2026-11-14"]);
  assert.equal(cum[1].later_emails, 3);
  assert.equal(cum[1].mid_emails, 2);                             // nothing new that day: the total stays
});

test("the summary mail: the visitor's language, the points escaped, the shop's links only", () => {
  const links = shopLinks([
    { who: "customer", name: null, text: "see https://example.com/x" },
    { who: "ai", name: null, text: "Here: https://www.apsoparts.com/de-ch/o-ring-nbr-70-shore.html. And https://evil.com/a" },
    { who: "agent", name: "Anna", text: "again https://www.apsoparts.com/de-ch/o-ring-nbr-70-shore.html" },
  ]);
  assert.deepEqual(links, [{ url: "https://www.apsoparts.com/de-ch/o-ring-nbr-70-shore.html", label: "O ring nbr 70 shore" }]);
  const m = summaryMail("de", { points: ["Sie suchten einen O-Ring <NBR>"], next: "" }, links);
  assert.match(m.subject, /Zusammenfassung/);
  assert.match(m.html, /O-Ring &lt;NBR&gt;/);
  assert.doesNotMatch(m.html, /Wie es weitergeht/);               // no "next" given: no heading
  assert.match(m.text, /apsoparts\.com\/de-ch\/o-ring/);
  assert.equal(langOf("xx"), "en");
});
