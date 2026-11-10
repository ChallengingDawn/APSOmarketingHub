import assert from "node:assert/strict";
import { test } from "node:test";
import { validateChanges } from "../src/lib/convert/versions";
import { newModule, normalizeModule, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { CATEGORIES, MODULES, gapOf, moduleDef } from "../src/lib/content/studio/kinds/page/modules/registry";
import { MODULE_MAX, renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { ICONS } from "../src/lib/content/studio/kinds/page/modules/kit";
import { LIBRARY2, SAMPLES2 } from "../src/lib/content/studio/kinds/page/modules/library2";
import { link, pathFor, prose } from "../src/lib/content/studio/kinds/page/modules/library2/kit";
import { parseFacts } from "../src/lib/content/studio/kinds/page/modules/library2/facts";

// Content v7 (SARCLA 10.11.2026, point 1): "create more than 100 modules subdivided by categories, really high end". The
// library's part 2 - Content & stories, Technical & comparison, Tools & services, Help & FAQ, Calls to action & sign-ups,
// Industries & applications, References & brands, Media. Each module: ONE element, every rule under its own class, the
// shop's container, no script, at most 20 KB, never a price; with the shop's real data it stands as it is, and empty it
// shows a visible placeholder (never nothing).

const OURS = ["stories", "technical", "tools", "help", "cta", "industries", "references", "media"];

/** every selector of a stylesheet (inside @media too) */
function selectors(css: string): string[] {
  const out: string[] = [];
  const body = css.replace(/@media[^{]+\{/g, "").replace(/@supports[^{]+\{/g, "").replace(/@keyframes[^{]+\{([^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  for (const m of body.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    let depth = 0, cur = "";
    for (const ch of m[1]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out.filter((x) => !/^(from|to|\d+%)$/.test(x));
}

/** A module as the gallery shows it: its de-CH defaults (the shop's own words) and the sample a fill would bring. */
function sample(id: string, store = "de-CH"): ModuleRef {
  const m = newModule(id, store, "msample");
  return normalizeModule({ type: id, settings: { ...m.settings, ...(SAMPLES2[id]?.(store) ?? {}) } })!;
}

function checkOne(html: string, where: string, cls: string) {
  assert.match(html, new RegExp(`^<div class="${cls}" data-apx-module="[a-z0-9-]+"><style>`), `${where}: one root with its style first`);
  assert.ok(html.endsWith("</div>"), where);
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)![1];
  for (const sel of selectors(css)) assert.ok(sel.startsWith(`.${cls}`), `${where}: "${sel}" is not under the module's class`);
  assert.match(css, /max-width:1170px/, `${where}: the shop's container`);
  assert.match(css, /@media \(max-width:900px\)/, `${where}: a phone rule`);
  assert.doesNotMatch(html, /<script|<iframe|\son[a-z]+=|javascript:/i, `${where}: no script, no frame`);
  const v = validateChanges([{ op: "insert", selector: "#maincontent .column.main", where: "prepend", html }]);
  assert.deepEqual(v.problems, [], `${where}: ${v.problems.join("; ")}`);
  assert.ok(html.length <= MODULE_MAX, `${where}: ${html.length} bytes - over 20 KB`);
  const body = html.replace(/<style>[\s\S]*?<\/style>/, "");
  assert.doesNotMatch(body.replace(/href="[^"]*"|src="[^"]*"/g, ""), /CHF|EUR\b|€|\d+\s*%/, `${where}: never a price or a discount`);
  assert.doesNotMatch(body, /chemours/i, `${where}: never Chemours`);
  for (const m of body.matchAll(/href="([^"]*)"/g)) assert.match(m[1], /^(\/[a-z]{2}-[A-Z]{2,3}\/|\/media\/downloads\/|https:\/\/campaigns\.apsoparts\.com\/hubfs\/|#)/, `${where}: a link off the shop: ${m[1]}`);
  for (const m of body.matchAll(/src="([^"]*)"/g)) assert.match(m[1], /^(https:\/\/(www|acc)\.apsoparts\.com\/media\/|\/api\/content\/picture\/)/, `${where}: a picture off the shop: ${m[1]}`);
}

test("part 2 holds ~55 modules in its eight categories, each in the registry", () => {
  assert.ok(LIBRARY2.length >= 50, `${LIBRARY2.length} modules`);
  for (const c of OURS) assert.ok(CATEGORIES.some((x) => x.id === c), c);
  for (const d of LIBRARY2) {
    assert.ok(OURS.includes(d.category), `${d.id}: ${d.category} is not one of part 2's categories`);
    assert.equal(moduleDef(d.id), d, `${d.id}: in the registry`);
    assert.ok(d.name && d.note && d.fields.length, `${d.id}: named, described, with fields`);
  }
  for (const c of OURS) assert.ok(LIBRARY2.filter((d) => d.category === c).length >= 6, `${c}: at least six modules`);
  assert.ok(MODULES.filter((d) => OURS.includes(d.category)).length >= LIBRARY2.length);
});

test("every module of part 2, with the shop's real data, in every look: one element, its own class, no script, under 20 KB, never a price", () => {
  let looks = 0;
  for (const d of LIBRARY2) {
    const m = sample(d.id);
    assert.equal(gapOf(m), "", `${d.id}: with the shop's data it stands as it is`);
    for (const l of d.layouts) {
      const html = renderModule({ ...m, settings: { ...m.settings, layout: l.key } });
      checkOne(html, `${d.id}/${l.key}`, "apx-msample");
      assert.doesNotMatch(html, /class="am-ph/, `${d.id}/${l.key}: filled, no placeholder left`);
      looks++;
    }
  }
  assert.ok(looks >= 100, `${looks} looks`);
});

test("empty, a module shows a visible placeholder - never nothing; and says what it still needs", () => {
  for (const d of LIBRARY2) {
    const empty = normalizeModule({ type: d.id, settings: { id: "mempty", store: "fr-CH" } })!;
    for (const l of d.layouts) {
      const html = renderModule({ ...empty, settings: { ...empty.settings, layout: l.key } });
      checkOne(html, `${d.id}/${l.key} empty`, "apx-mempty");
      assert.match(html, /class="am-ph[ "]|<form /, `${d.id}/${l.key}: empty, it shows a placeholder`);
    }
    // a new one in a store view the shop has no German words for: its links and pictures, a gap when words are missing
    const fr = newModule(d.id, "fr-CH", "mfresh");
    const html = renderModule(fr);
    assert.ok(html.replace(/<style>[\s\S]*?<\/style>/, "").length > 60, `${d.id}: a new fr-CH one draws something`);
    for (const m of html.matchAll(/href="([^"]*)"/g)) assert.doesNotMatch(m[1], /\/de-CH\//, `${d.id}: a fr-CH module links to fr-CH, not ${m[1]}`);
  }
});

test("the defaults survive being stored: no word cut, every icon known, every link and picture kept", () => {
  for (const d of LIBRARY2) {
    for (const store of ["de-CH", "de-DE", "fr-CH"]) {
      const raw = newModule(d.id, store, "mkeep");
      const back = normalizeModule(JSON.parse(JSON.stringify(raw)))!;
      const s = raw.settings, b = back.settings;
      assert.equal(b.title, s.title, `${d.id}/${store}: title`);
      assert.equal(b.text, s.text, `${d.id}/${store}: text`);
      assert.equal(b.link.url, s.link.url, `${d.id}/${store}: link`);
      assert.deepEqual(b.points.map((p) => [p.title, p.text, p.icon, p.url ?? "", p.img ?? ""]), s.points.map((p) => [p.title, p.text, p.icon, p.url ?? "", p.img ?? ""]), `${d.id}/${store}: points`);
      assert.deepEqual(b.faq, s.faq, `${d.id}/${store}: pairs`);
      assert.deepEqual(b.table, s.table, `${d.id}/${store}: table`);
      for (const p of s.points) assert.ok(ICONS.includes(p.icon), `${d.id}: icon ${p.icon} unknown to the kit`);
      if (store === "de-DE") for (const u of [s.link.url, ...s.points.map((p) => p.url ?? "")].filter(Boolean)) assert.doesNotMatch(u, /\/de-CH\//, `${d.id}: de-DE keeps de-CH in ${u}`);
    }
  }
});

test("a Swiss EUR store view keeps its visitors there; links never leave the shop", () => {
  const m = newModule("tool-tiles", "de-CH/eur", "meur");
  const html = renderModule(m);
  assert.match(html, /href="\/de-CH\/eur\/service\/directcut-configurator"/);
  assert.equal(link("javascript:alert(1)"), "#");
  assert.equal(link("https://evil.example.com/x"), "#");
  assert.equal(link("https://campaigns.apsoparts.com/hubfs/APSOparts_Sales_Brochure_DE.pdf"), "https://campaigns.apsoparts.com/hubfs/APSOparts_Sales_Brochure_DE.pdf");
  assert.equal(pathFor("fr-CH", "/de-CH/support/faqs"), "/fr-CH/support/faqs");
  assert.match(prose("Kurz.\n\n- NBR: Öle\n- FKM: Hitze"), /<ul class="am-li"><li><b>NBR:<\/b> Öle<\/li>/);
});

test("the search box searches the shop itself (GET q), no new backend", () => {
  const html = renderModule(newModule("help-search", "de-CH", "msearch"));
  assert.match(html, /<form class="am-sr-f" action="\/de-CH\/catalogsearch\/result\/" method="get"/);
  assert.match(html, /<input type="search" name="q"/);
});

test("a product page's facts: its line, its technical summary without approvals, its downloads - never a price", () => {
  const html = `<div class="page-title-wrapper product"><h1 class="page-title"><span class="base">HITEC&reg; O-Ring DW EPDM 70.503-00</span></h1> <div class="product attribute page-title__sub-title"> <div class="value" >Zuverlässige EPDM-Dichtung für Wasser, Dampf.</div></div></div>
<table class="data table additional-attributes" id="product-attribute-specs-table"><caption>Weitere Informationen</caption><tbody>
<tr class="show-more-container"><th>Werkstoff</th><td ><div class="show-more-content">EPDM</div><div class="show-more-button">Mehr anzeigen</div></td></tr>
<tr class="show-more-container"><th>Härte</th><td ><div class="show-more-content">70 &plusmn;5 Shore A</div></td></tr>
<tr class="show-more-container"><th>Einsatztemperaturbereich</th><td ><div class="show-more-content">von -57 bis +150 °C</div></td></tr>
<tr class="show-more-container"><th>Konformität/Zulassung</th><td ><div class="show-more-content">3-A Sanitary Standard,<br>ACS,<br>FDA</div></td></tr>
<tr class="show-more-container"><th>UNSPSC Code</th><td ><div class="show-more-content">UNSPSC-31410000</div></td></tr>
</tbody></table><span class="price">CHF 1.20</span>
<ul><li data-asset-id="73458"><a href="https&#x3A;&#x2F;&#x2F;www.apsoparts.com&#x2F;media&#x2F;downloads&#x2F;asset&#x2F;&#x2F;std.lang.all&#x2F;c_&#x2F;dw&#x2F;EPDM_70_503-00_HITEC_DW.pdf" title="Download">A+P Technical Data Sheet EPDM 70.503-00</a></li>
<li data-asset-id="13143"><a href="https&#x3A;&#x2F;&#x2F;www.apsoparts.com&#x2F;media&#x2F;downloads&#x2F;asset&#x2F;&#x2F;std.lang.all&#x2F;s_&#x2F;de&#x2F;APSOseal&#x20;O-Rings_DE.pdf">Broschüre APSOseal&reg; O-Ringe</a></li>
<li data-asset-id="1"><a href="https://evil.example.com/x.pdf">Elsewhere</a></li></ul>`;
  const f = parseFacts(html);
  assert.equal(f.summary, "Zuverlässige EPDM-Dichtung für Wasser, Dampf.");
  assert.deepEqual(f.table[0], ["Merkmal", "Wert"]);
  assert.deepEqual(f.table.slice(1).map((r) => r[0]), ["Werkstoff", "Härte", "Einsatztemperaturbereich"]);
  assert.equal(f.table[3][1], "von -57 bis +150 °C");
  assert.doesNotMatch(JSON.stringify(f), /FDA|Konformit|UNSPSC|CHF/);
  assert.deepEqual(f.downloads.map((d) => d.name), ["A+P Technical Data Sheet EPDM 70.503-00", "Broschüre APSOseal® O-Ringe"]);
  assert.equal(f.downloads[1].url, "https://www.apsoparts.com/media/downloads/asset//std.lang.all/s_/de/APSOseal%20O-Rings_DE.pdf");
  // the facts drawn as the technical summary
  const m = newModule("tech-specs", "de-CH", "mfacts");
  m.settings.table = f.table;
  const out = renderModule(normalizeModule(m)!);
  assert.match(out, /<th scope="row">Härte<\/th><td>70 ±5 Shore A<\/td>/);
});
