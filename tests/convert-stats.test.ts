import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RULES, analyse, arm, compare, dailySeries, daysRunning, lgamma, probBBeatsA, segmentRows, seeded, verdictOf, visitorsNeeded, wilson,
} from "../src/lib/convert/stats";
import { ANY_AUDIENCE, allocationWords, audienceWords, shareWords, buildConfig, cleanPages, normAllocation, normAudience, normResults, sharedPages } from "../src/lib/convert/contract";
import { applyToCms, cmsTarget, cssBlock, description, jsSnippet } from "../src/lib/convert/ship";
import type { Change } from "../src/lib/convert/versions";

const near = (a: number, b: number, tol: number, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);

/* ── stats ─────────────────────────────────────────────────────────── */

test("wilson: the interval holds the rate, stays in 0..1, and is honest at zero", () => {
  const w = wilson(30, 1000);
  assert.equal(w.rate, 0.03);
  near(w.low!, 0.0211, 0.0005, "low");
  near(w.high!, 0.0425, 0.0005, "high");
  const z = wilson(0, 50);
  assert.equal(z.rate, 0);
  assert.equal(z.low, 0);
  assert.ok(z.high! > 0.05 && z.high! < 0.09);
  assert.equal(wilson(0, 0).rate, null);
});

test("lgamma matches known values", () => {
  near(lgamma(1), 0, 1e-12);
  near(lgamma(5), Math.log(24), 1e-10);
  near(lgamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-10);
  near(lgamma(1000), 5905.220423209181, 1e-7);
});

test("P(b best): exact - one half for equal counts, near one for a clear lead, symmetric", () => {
  near(probBBeatsA({ visitors: 1000, carts: 30 }, { visitors: 1000, carts: 30 }), 0.5, 0.02);
  assert.ok(probBBeatsA({ visitors: 2000, carts: 40 }, { visitors: 2000, carts: 90 }) > 0.999);
  const p = probBBeatsA({ visitors: 800, carts: 24 }, { visitors: 800, carts: 33 });
  const q = probBBeatsA({ visitors: 800, carts: 33 }, { visitors: 800, carts: 24 });
  near(p + q, 1, 1e-9, "p + q");
  // the swap for large counts gives the same answer
  const big = probBBeatsA({ visitors: 200_000, carts: 100 }, { visitors: 200_000, carts: 2600 });
  assert.ok(big > 0.999999);
});

test("P(b best) agrees with a brute-force simulation", () => {
  const a = { visitors: 500, carts: 20 }, b = { visitors: 500, carts: 28 };
  const exact = probBBeatsA(a, b);
  const c = compare(a, b, { draws: 100_000, seed: 7 });
  near(c.pBest!.b, exact, 1e-12, "compare uses the exact P");
  // the uplift interval from the draws holds the observed uplift
  assert.ok(c.uplift.low! < c.uplift.mid! && c.uplift.mid! < c.uplift.high!);
  near(c.uplift.mid!, 0.4, 1e-9);
});

test("compare is deterministic for a seed and gives the expected loss of each pick", () => {
  const a = { visitors: 1200, carts: 36 }, b = { visitors: 1180, carts: 47 };
  const x = compare(a, b), y = compare(a, b);
  assert.deepEqual(x, y);
  assert.ok(x.loss!.b < x.loss!.a, "picking the leader loses less");
  assert.ok(x.loss!.b >= 0 && x.loss!.a > 0);
  const r = seeded(1);
  const s = seeded(1);
  assert.equal(r(), s());
});

test("compare before both variants have a visitor: no P, no interval", () => {
  const c = compare({ visitors: 0, carts: 0 }, { visitors: 10, carts: 1 });
  assert.equal(c.pBest, null);
  assert.equal(c.uplift.mid, null);
  assert.equal(c.b.rate, 0.1);
});

test("arm: counts from strings, carts never above visitors", () => {
  assert.deepEqual(arm("120", "7"), { visitors: 120, carts: 7 });
  assert.deepEqual(arm(10, 30), { visitors: 10, carts: 10 });
  assert.deepEqual(arm(-3, null), { visitors: 0, carts: 0 });
});

test("visitors needed: the textbook number for 3% and +10%", () => {
  const n = visitorsNeeded(0.03, 0.1)!;
  // two-sided 5%, power 80%: ~53,000 per variant for 3.0% -> 3.3%
  assert.ok(n > 50_000 && n < 56_000, String(n));
  assert.ok(visitorsNeeded(0.03, 0.3)! < n / 5);
  assert.equal(visitorsNeeded(0, 0.1), null);
  assert.equal(visitorsNeeded(null, 0.1), null);
});

test("daysRunning counts whole days", () => {
  assert.equal(daysRunning("2026-11-01T10:00:00Z", "2026-11-08T09:59:00Z"), 6);
  assert.equal(daysRunning("2026-11-01T10:00:00Z", "2026-11-08T10:00:00Z"), 7);
  assert.equal(daysRunning(null, "2026-11-08T10:00:00Z"), 0);
});

test("verdict: the version wins only with P >= 95%, a small risk, 300+ visitors each, 20+ carts and 14+ days", () => {
  const a = { visitors: 1500, carts: 45 }, b = { visitors: 1500, carts: 75 };
  const c = compare(a, b);
  assert.ok(c.pBest!.b >= 0.99);
  assert.equal(verdictOf(c, 14, { mde: 0.3 }).key, "b-wins");
  const early = verdictOf(c, 7, { mde: 0.3 });
  assert.equal(early.key, "running");
  assert.match(early.why, /7 more days \(two full weeks/);
  // too few visitors
  const small = compare({ visitors: 250, carts: 5 }, { visitors: 250, carts: 20 });
  assert.ok(small.pBest!.b > 0.99);
  const v = verdictOf(small, 10);
  assert.equal(v.key, "running");
  assert.ok(v.more.a >= RULES.minVisitors - 250);
});

test("verdict: the original wins, and the harm stop needs 99% and 200 each - no wait for the days", () => {
  const c = compare({ visitors: 1500, carts: 75 }, { visitors: 1500, carts: 52 });
  assert.equal(verdictOf(c, 14).key, "a-wins");
  const harm = compare({ visitors: 220, carts: 30 }, { visitors: 220, carts: 8 });
  assert.ok(harm.pBest!.a >= 0.99);
  const v = verdictOf(harm, 1);
  assert.equal(v.key, "harm");
  assert.equal(v.text, "Stop: the version hurts");
  assert.ok(v.decided);
  // under 200 per variant: no harm stop yet
  const tooFew = compare({ visitors: 150, carts: 25 }, { visitors: 150, carts: 4 });
  assert.equal(verdictOf(tooFew, 1).key, "running");
});

test("verdict: no real difference once the test could have seen the smallest uplift", () => {
  const c = compare({ visitors: 60_000, carts: 1800 }, { visitors: 60_000, carts: 1812 });
  const v = verdictOf(c, 14, { mde: 0.1 });
  assert.equal(v.key, "no-difference");
  assert.equal(v.text, "No real difference");
  // the same rates with few visitors: keep it running, with what is missing
  const r = verdictOf(compare({ visitors: 400, carts: 12 }, { visitors: 400, carts: 12 }), 9, { mde: 0.1 });
  assert.equal(r.key, "running");
  assert.equal(r.text, "Keep it running");
  assert.ok(r.needed! > 40_000);
  assert.ok(r.moreDays! > 100);
});

test("verdict plans with the page's own rate before the test has one", () => {
  const c = compare({ visitors: 20, carts: 0 }, { visitors: 20, carts: 1 });
  const v = verdictOf(c, 1, { baseRate: 0.04, mde: 0.2 });
  assert.equal(v.needed, visitorsNeeded(0.04, 0.2));
});

test("daily series: every day from the first to the last, the rate so far, the version's share", () => {
  const d = dailySeries([
    { day: "2026-11-01", key: "a", visitors: 100, carts: 3 }, { day: "2026-11-01", key: "b", visitors: 100, carts: 5 },
    { day: "2026-11-03", key: "a", visitors: 50, carts: 2 }, { day: "2026-11-03", key: "b", visitors: 150, carts: 4 },
  ]);
  assert.deepEqual(d.map((x) => x.day), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(d[1].a, 0);
  assert.equal(d[1].shareB, null);
  near(d[2].rateA!, 5 / 150, 1e-12);
  near(d[2].rateB!, 9 / 250, 1e-12);
  near(d[2].shareB!, 0.75, 1e-12);
});

test("segments: uplift and P per value, small ones flagged, biggest first", () => {
  const rows = segmentRows({
    device: [
      { value: "desktop", key: "a", visitors: 900, carts: 30 }, { value: "desktop", key: "b", visitors: 880, carts: 44 },
      { value: "phone", key: "a", visitors: 60, carts: 1 }, { value: "phone", key: "b", visitors: 70, carts: 2 },
    ],
    login: [{ value: "customer", key: "a", visitors: 10, carts: 2 }],
  });
  const desk = rows.find((r) => r.dim === "device" && r.value === "desktop")!;
  assert.equal(rows[0].value, "desktop");
  assert.ok(desk.uplift! > 0.4);
  assert.ok(desk.pB! > 0.9);
  assert.equal(desk.few, false);
  assert.equal(rows.find((r) => r.value === "phone")!.few, true);
  const cust = rows.find((r) => r.value === "customer")!;
  assert.equal(cust.label, "Signed-in customer");
  assert.equal(cust.pB, null);
});

test("analyse puts it together", () => {
  const an = analyse({
    variants: [{ key: "a", visitors: 400, carts: 12 }, { key: "b", visitors: 410, carts: 20 }],
    daily: [{ day: "2026-11-02", key: "a", visitors: 400, carts: 12 }, { day: "2026-11-02", key: "b", visitors: 410, carts: 20 }],
    segments: null,
    since: "2026-11-02T08:00:00Z",
  }, "2026-11-08T12:00:00Z");
  assert.equal(an.days, 6);
  assert.equal(an.verdict.key, "running");
  assert.equal(an.daily.length, 1);
  assert.equal(an.comparison.a.visitors, 400);
});

/* ── the contract ──────────────────────────────────────────────────── */

test("audience and allocation: unknown values fall back, words read plainly", () => {
  const a = normAudience({ stores: ["de-CH", "bad", "fr-CH", "de-CH"], device: "phone", login: "customer", visitor: "x", source: "ads" });
  assert.deepEqual(a, { stores: ["de-CH", "fr-CH"], device: "phone", visitor: "any", login: "customer", source: "ads" });
  assert.equal(audienceWords(a), "Signed-in customers in de-CH and fr-CH, on a phone, from an ad");
  assert.equal(audienceWords(normAudience({ stores: ["it-CH"], login: "guest", visitor: "new" })), "Guests (not signed in) in it-CH, new to the shop");
  assert.equal(shareWords(normAllocation({ split: { b: 30 } })), "30% of the visitors");
  assert.equal(audienceWords(ANY_AUDIENCE), "Everyone");
  assert.deepEqual(normAllocation({ mode: "bandit", split: { b: 99 }, floor: 70 }), { mode: "bandit", split: { a: 5, b: 95 }, floor: 45 });
  assert.equal(allocationWords(normAllocation({})), "Half and half");
  assert.match(allocationWords(normAllocation({ mode: "bandit", floor: 10 })), /at least 10% each/);
});

test("pages: exact paths only, hosts and queries taken off", () => {
  assert.deepEqual(cleanPages(["https://acc.apsoparts.com/de-CH/x.html?y=1", "/de-CH/x.html", "/fr-CH/y.html#z", "bad", "//evil", 3]), ["/de-CH/x.html", "/fr-CH/y.html"]);
});

test("buildConfig: a = the page as it is, b = the version, unsafe changes refused; a personalisation is b for all", () => {
  const changes = [{ op: "css", css: ".a{color:red}" }, { op: "html", selector: ".x", html: "<img onerror=alert(1)>" }] as Change[];
  const t = { id: "12", v: 2, kind: "test" as const, status: "running" as const, name: "Delivery line", host: "acc.apsoparts.com" as const, pages: ["/de-CH/x.html"], allocation: normAllocation({ split: { b: 30 } }), audience: ANY_AUDIENCE };
  const { config, problems } = buildConfig(t, changes);
  assert.equal(config.variants[0].key, "a");
  assert.deepEqual(config.variants[0].changes, []);
  assert.equal(config.variants[1].changes.length, 1);
  assert.equal(problems.length, 1);
  assert.deepEqual(config.allocation.split, { a: 70, b: 30 });
  assert.equal(config.goal, "add_to_cart");
  assert.equal(config.id, "12");
  const p = buildConfig({ ...t, kind: "personalisation" }, changes).config;
  assert.deepEqual(p.allocation, { mode: "split", split: { a: 0, b: 100 }, floor: 0 });
});

test("results read defensively; shared pages only on the same host", () => {
  const r = normResults({ variants: [{ key: "b", visitors: "12", carts: "1", views: "15", applyMisses: null }, { key: "z", visitors: 3 }], segments: { device: [{ value: null, key: "b", visitors: "2", carts: 0 }] } }, "4", 1);
  assert.equal(r.variants[0].visitors, 12);
  assert.equal(r.variants[1].key, "a");
  assert.equal(r.segments.device[0].value, "");
  assert.deepEqual(r.daily, []);
  assert.equal(r.weights, null);
  assert.deepEqual(sharedPages({ host: "a", pages: ["/x", "/y"] }, { host: "a", pages: ["/y"] }), ["/y"]);
  assert.deepEqual(sharedPages({ host: "a", pages: ["/x"] }, { host: "b", pages: ["/x"] }), []);
});

/* ── ship ──────────────────────────────────────────────────────────── */

const VERSION: Change[] = [
  { op: "css", css: ".apx-delivery{font-weight:700}", note: "Bold delivery line" },
  { op: "insert", selector: "h1.page-title", where: "after", html: "<p class=\"apx-delivery\">Lieferung in 2 Tagen</p>", note: "Delivery under the title" },
  { op: "text", selector: ".action.tocart span", text: "In den Warenkorb", all: true },
  { op: "hide", selector: ".old-banner" },
];

test("dotSource code: a CSS block and an ES5 script that parses, without arrows, let/const or template strings", () => {
  const css = cssBlock(VERSION, { testId: "12", name: "Delivery line" });
  assert.match(css, /APSOconvert test #12/);
  assert.match(css, /\.apx-delivery\{font-weight:700\}/);
  const js = jsSnippet(VERSION, { testId: "12", name: "Delivery */ line", pages: ["/de-CH/x.html"] });
  assert.doesNotThrow(() => new Function(js));
  assert.ok(!/=>|\blet\s|\bconst\s|`/.test(js), "ES5 only");
  assert.ok(!js.includes("Delivery */ line"), "a name cannot end the comment");
  assert.ok(!js.includes("</"), "safe inside a <script>");
  assert.equal(jsSnippet([VERSION[0]], { testId: "1", name: "x", pages: [] }), "");
  const d = description(VERSION, {
    testId: "12", name: "Delivery line", env: "prod", host: "www.apsoparts.com", pages: ["/de-CH/x.html"], versionRev: 3,
    idea: { title: "Show delivery", why: "Buyers stop at the price", change: "A line under the title", expect: "More add-to-carts" },
    result: { rateA: 0.03, rateB: 0.038, uplift: 0.2667, pB: 0.97, visitors: 4000, days: 12 }, decidedBy: "Sara", decidedAt: "2026-11-20T10:00:00Z",
  });
  assert.match(d, /3\.8% of the visitors who saw the version/);
  assert.match(d, /\+26\.7%/);
  assert.match(d, /Decided by Sara on 20\.11\.2026/);
});

test("cmsTarget: CMS pages only", () => {
  assert.deepEqual(cmsTarget("/de-CH/ueber-uns"), { ok: true, store: "de-CH", identifier: "ueber-uns" });
  assert.equal(cmsTarget("/de-CH/12202510-apsovibr-maschinenfuss.html").ok, false);
  assert.equal(cmsTarget("/de-CH/dichtungstechnik.html").ok, false);
  assert.equal(cmsTarget("/de-CH/").ok, false);
  assert.equal(cmsTarget("/de-CH/checkout/cart").ok, false);
});

test("applyToCms: edits spliced in place, the rest kept byte for byte, wrappers of the shop page skipped", () => {
  const content = `<div data-content-type="row"><h1 class="page-title"><span>Über uns</span></h1>\n<p class='lead'>Seit 1920</p><img src="a.png"><div class="old-banner" style="color:red">Alt</div><button class="action tocart"><span>Kaufen</span></button><button class="action tocart"><span>Kaufen</span></button></div>`;
  const changes: Change[] = [
    ...VERSION,
    { op: "attr", selector: "#maincontent p.lead", name: "title", value: "1920 \"seit\"" },
    { op: "html", selector: ".nowhere", html: "<b>x</b>" },
  ];
  const r = applyToCms(content, changes, "test-12");
  assert.ok(r.content.startsWith(`<style data-apso-version="test-12">\n.apx-delivery{font-weight:700}\n</style>\n`));
  assert.ok(r.content.includes(`</h1><p class="apx-delivery">Lieferung in 2 Tagen</p>\n<p class='lead' title="1920 &quot;seit&quot;">Seit 1920</p>`));
  assert.equal((r.content.match(/<span>In den Warenkorb<\/span>/g) ?? []).length, 2);
  assert.ok(r.content.includes(`class="old-banner" style="color:red; display:none !important"`));
  assert.ok(r.content.includes(`<img src="a.png">`));
  assert.deepEqual(r.notPlaced.map((x) => x.i), [5]);
  assert.equal(r.placed.find((x) => x.i === 4)!.via, "p.lead");
  assert.equal(r.css, true);
  // a second write replaces the block, never doubles it
  const again = applyToCms(r.content, [VERSION[0]], "test-12");
  assert.equal((again.content.match(/data-apso-version/g) ?? []).length, 1);
});

test("verdict: 95% is not enough while the pick is still risky, or with too few add-to-carts", async () => {
  const { lossCap } = await import("../src/lib/convert/stats");
  assert.equal(lossCap(0.03), 0.0015);
  assert.equal(lossCap(0.01), 0.001);
  // few add-to-carts: 6 against 15 at 400 each is 95%+ but on 21 carts in all - and a wide risk
  const thin = compare({ visitors: 400, carts: 6 }, { visitors: 400, carts: 15 });
  assert.ok(thin.pBest!.b >= 0.95);
  const v = verdictOf(thin, 20);
  if (v.key === "running") assert.match(v.why, /smaller risk|more certainty/);
  // under 20 carts in all: never decided
  const tiny = compare({ visitors: 600, carts: 3 }, { visitors: 600, carts: 14 });
  assert.ok(tiny.pBest!.b >= 0.99);
  const t = verdictOf(tiny, 20);
  assert.equal(t.key, "running");
  assert.match(t.why, /3 more add-to-carts in all/);
});
