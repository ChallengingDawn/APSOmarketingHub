import assert from "node:assert/strict";
import { test } from "node:test";
import { inlineHtml, wordsHtml } from "../src/lib/content/studio/kinds/page/newpage";
import { leftoversIn } from "../src/lib/content/studio/kinds/page/model";

// Content v8 (SARCLA 10.11.2026, point 2: the text editor popup - "bold / italic / list / link where the block allows"):
// the marks the popup writes into a new page's words, drawn the same in the preview and in Magento.

test("bold, italic and a link to a page of the shop", () => {
  assert.equal(inlineHtml("Ab **Stückzahl 1** bestellt"), "Ab <strong>Stückzahl 1</strong> bestellt");
  assert.equal(inlineHtml("ganz *einfach* so"), "ganz <em>einfach</em> so");
  assert.equal(inlineHtml("Zu den [O-Ringen](/de-CH/o-ringe.html)."), 'Zu den <a href="/de-CH/o-ringe.html">O-Ringen</a>.');
  assert.equal(inlineHtml("[Shop](https://www.apsoparts.com/de-CH/)"), '<a href="https://www.apsoparts.com/de-CH/">Shop</a>');
});

test("anything else stays as typed: another site, a lone star, a multiplication", () => {
  assert.equal(inlineHtml("[Hier](https://evil.example/x)"), "[Hier](https://evil.example/x)");
  assert.equal(inlineHtml("2 * 3 = 6"), "2 * 3 = 6");
  assert.equal(inlineHtml("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(inlineHtml('[a"b](/x" onclick="y)'), '[a&quot;b](/x&quot; onclick=&quot;y)');
});

test("a list keeps its marks; a link's words are no placeholder", () => {
  assert.equal(wordsHtml("- **EPDM** für Dampf\n- FKM"), "<ul><li><strong>EPDM</strong> für Dampf</li><li>FKM</li></ul>");
  assert.deepEqual(leftoversIn("Hier [Jetzt filtern](/de-CH/x) und weiter"), []);
  assert.deepEqual(leftoversIn("[Intro paragraph in German]"), ["[Intro paragraph in German]"]);
});
