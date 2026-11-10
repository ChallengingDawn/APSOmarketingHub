// APSOconvert > a version must not break the shop (SARCLA 10.11.2026: "generation continues to be absolute shit" - a
// version moved the filters with CSS and the articles table fell apart).
import assert from "node:assert/strict";
import { test } from "node:test";
import { cssRules, ownOnly, riskOf, riskOfChange, safePart, SAFETY_RULES } from "../src/lib/convert/safety";
import type { Change } from "../src/lib/convert/versions";

test("ownOnly: the version's own blocks only", () => {
  assert.ok(ownOnly(".apx-note"));
  assert.ok(ownOnly("div.apx-sketch b"));
  assert.ok(ownOnly(".product-info-main .apx-badge:hover"));
  assert.ok(!ownOnly(".apx-box .price"), "a shop part inside our block is still the shop's");
  assert.ok(!ownOnly("#layered-filter-block"));
  assert.ok(!ownOnly(".apx-a, .filter-options"));
});

test("the screenshot's case: moving the filters with CSS is refused", () => {
  const moved: Change = { op: "css", css: "#layered-filter-block{display:flex;flex-direction:column;order:-1}\n.filter-options-item{position:absolute;top:0}" };
  const r = riskOfChange(moved);
  assert.ok(r.some((x) => x.includes("display: flex")));
  assert.ok(r.some((x) => x.includes("order")));
  assert.ok(r.some((x) => x.includes("position")));
});

test("emphasis, opening a folded part and our own layout pass", () => {
  const ok: Change = { op: "css", css: ".filter-options-content{display:block;max-height:none}\n.page-title{color:#c00;font-weight:700}\n.apx-box{display:flex;gap:8px;width:100%}\n@media (max-width:640px){.apx-box{flex-direction:column}}" };
  assert.deepEqual(riskOfChange(ok), []);
  assert.deepEqual(riskOfChange({ op: "text", selector: ".page-title span", text: "Platten" }), []);
  assert.deepEqual(riskOfChange({ op: "insert", selector: "#layered-filter-block", where: "before", html: "<div class=\"apx-sketch\"><b>Proposed</b>Thickness, length, width first</div>" }), []);
});

test("hiding or rewriting a part the shop's scripts draw is refused", () => {
  assert.equal(riskOfChange({ op: "hide", selector: ".products-grid" }).length, 1);
  assert.equal(riskOfChange({ op: "replace", selector: "table.data-grid", html: "<table></table>" }).length, 1);
  assert.equal(riskOfChange({ op: "html", selector: ".minicart-wrapper", html: "x" }).length, 1);
  assert.deepEqual(riskOfChange({ op: "hide", selector: ".apx-old-note" }), []);
});

test("safePart: the risky rules cut out of the stylesheet as written, @media kept, risky changes dropped", () => {
  const list: Change[] = [
    { op: "css", css: ".apx-b{padding:8px}\n#layered-filter-block{order:-1}\n@media (max-width:640px){.apx-b{padding:4px}}" },
    { op: "hide", selector: "#layered-filter-block" },
    { op: "text", selector: "h1", text: "Platten" },
  ];
  const s = safePart(list);
  assert.equal(s.changes.length, 2);
  const css = (s.changes[0] as { css: string }).css;
  assert.ok(css.includes(".apx-b{padding:8px}"));
  assert.ok(css.includes("@media (max-width:640px){.apx-b{padding:4px}}"));
  assert.ok(!css.includes("layered"));
  assert.equal(s.dropped.length, 2);
  assert.equal(riskOf(list).length, 2);
});

test("cssRules reads the rules inside @media too; the AI is told the rules and the sketch", () => {
  assert.deepEqual(cssRules("@media (max-width:1px){.a{x:1}} .b{y:2;z:3 !important}").map((r) => r.selector), [".a", ".b"]);
  assert.match(SAFETY_RULES, /NEVER move, re-order, re-size/);
  assert.match(SAFETY_RULES, /apx-sketch/);
});

test("qualityOf: a placeholder, two sketches or words not in English send the version back once (SARCLA 10.11.2026)", async () => {
  const { qualityOf } = await import("../src/lib/convert/safety");
  assert.deepEqual(qualityOf([{ op: "insert", selector: "table.data-grid tbody tr", where: "after", html: "<tr class=\"apx-example\"><td colspan=\"8\">Only 120 in stock now. Need more? <a href=\"#\">Ask for this quantity</a></td></tr>" }]), []);
  const bad = qualityOf([
    { op: "insert", selector: "#maincontent", where: "prepend", html: "<div class=\"apx-box\"><b>Quantità superiore allo stock</b><span class=\"apx-text\">[Testo da Content: spiegare]</span><div class=\"apx-sketch\"><b>Proposed</b>x</div></div>" },
    { op: "insert", selector: "h1", where: "after", html: "<div class=\"apx-sketch\"><b>Proposed</b>y</div>" },
  ]);
  assert.ok(bad.some((p) => p.includes("placeholder")));
  assert.ok(bad.some((p) => p.includes("2 sketches")));
  assert.ok(bad.some((p) => p.includes("not in English")));
});
