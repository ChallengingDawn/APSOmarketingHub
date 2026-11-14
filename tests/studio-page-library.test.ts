import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateChanges } from "../src/lib/convert/versions";
import { withoutTrustedScripts } from "../src/lib/convert/trustedScripts";
import { newModule, normalizeModule, type Card, type ModuleRef } from "../src/lib/content/studio/kinds/page/modules/model";
import { CATEGORIES, MODULES, countFor, gapOf, libraryByCategory, moduleDef, searchModules, thumbOf } from "../src/lib/content/studio/kinds/page/modules/registry";
import { MODULE_MAX, fitModule, renderModule, renderSkeleton } from "../src/lib/content/studio/kinds/page/modules/render";
import type { ModuleDef } from "../src/lib/content/studio/kinds/page/modules/types";

// Content v7 (SARCLA 10.11.2026, point 1): "create more than 100 modules subdivided by categories, really high end". Every
// module of the library - whoever wrote it - is checked the same way: ONE element, every rule under its own class, no
// script, a phone rule, light enough for one element of a version (20 KB), never a price or a discount; and a module that
// still lacks what it needs draws as its skeleton (point 6: "added a module didn't appear").

const B = "https://www.apsoparts.com";
const IMG = `${B}/media/catalog/product/cache/e65cbd4f894347b40651eab73facc10f/std.lang.all/01/01/11400101.jpg`;
const product = (n: number): Card => ({
  kind: "product", name: `HITEC® O-Ring NBR 70.10-0${n} Hochleistungsdichtung für hohe Temperaturen`,
  url: `${B}/de-CH/1140010${n % 10}-hitecr-o-ring-dw-epdm-70-503-00-nachfolge-von-hitecr-o-ring-epdm-70-10-02.html`, img: IMG, meta: "702 Artikel", number: `1140010${n % 10}`, children: [],
});
const category = (n: number, kids: Card[]): Card => ({
  kind: "category", name: `Profile, Rundschnüre und Bänder ${n}`, url: `${B}/de-CH/dichtungstechnik/kategorie-${n}.html`,
  img: `${B}/media/catalog/category/std.lang.all/43/98/resize/540-null/31439${n}.jpg`, meta: "31 Produkte", number: "", children: kids,
});

/** A module filled as a fill fills it (its count), with long names and every word field. */
function brim(d: ModuleDef): ModuleRef {
  const m = newModule(d.id, "de-CH", "mtest");
  const s = m.settings;
  s.eyebrow = "Sortiment"; s.title = "Dichtungstechnik für die Lebensmittelindustrie"; s.text = "Eine Zeile darunter, die sagt, was es hier gibt - ruhig und klar.";
  s.link = { label: "Alle anzeigen", url: `${B}/de-CH/dichtungstechnik.html` };
  s.link2 = { label: "Schnellbestellung", url: `${B}/de-CH/quickorder/` };
  if (d.takes === "products") s.items = Array.from({ length: countFor(d, s) }, (_, i) => product(i + 1));
  if (d.takes === "categories") s.items = Array.from({ length: countFor(d, s) }, (_, i) => category(i + 1, [1, 2, 3, 4].map(product)));
  s.feature = category(9, []);
  if (!s.points.length) s.points = [1, 2, 3, 4].map((i) => ({ title: `${i * 1000} Artikel`, text: "ab Lager lieferbar", icon: "box" }));
  s.faq = [{ q: "Gibt es Zuschläge?", a: "Nein.\n\n- Keine Zuschläge\n- Echtzeit-Preise" }];
  s.table = [["Werkstoff", "Temperatur", "Härte"], ["NBR", "-30 bis +100 °C", "70 Shore A"]];
  return normalizeModule(m)!;
}

/** every selector of a stylesheet (inside @media too) */
function selectors(css: string): string[] {
  const out: string[] = [];
  const body = css.replace(/@media[^{]+\{/g, "").replace(/@supports[^{]+\{/g, "");
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

test("the library: ids unique, every category known, categories in order with names", () => {
  const ids = MODULES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const d of MODULES) assert.ok(CATEGORIES.some((c) => c.id === d.category), `${d.id}: ${d.category}`);
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
  assert.ok(libraryByCategory().every((x) => x.modules.length > 0));
  assert.equal(moduleDef("finder")?.category, "navigation");
  assert.equal(moduleDef("nope"), null);
  assert.ok(searchModules("bento").some((d) => d.id === "bento"));
});

test("every module of the library is ONE element, every rule under its own class, no script, a phone rule, at most 20 KB filled", () => {
  for (const d of MODULES) {
    const fit = fitModule(brim(d));
    const m = fit.m;
    assert.ok(m.settings.items.length >= d.min, `${d.id}: ${fit.dropped} items dropped to fit 20 KB - fewer than it needs`);
    assert.ok(fit.dropped <= 1, `${d.id}: ${fit.dropped} items dropped to fit 20 KB - too heavy`);
    for (const layout of d.layouts.length ? d.layouts.map((l) => l.key) : [""]) {
      const mm = { ...m, settings: { ...m.settings, layout } };
      const html = renderModule(mm);
      const where = `${d.id}/${layout}`;
      assert.match(html, /^<div class="apx-mtest" data-apx-module="[a-z0-9-]+"><style>/, `${where}: one root with its style first`);
      assert.ok(html.endsWith("</div>"), where);
      const css = /<style>([\s\S]*?)<\/style>/.exec(html)![1];
      for (const sel of selectors(css)) assert.ok(sel.startsWith(".apx-mtest"), `${where}: "${sel}" is not under the module's class`);
      // the ONE trusted tag (13.11.2026: the Black Friday voucher's engine from the hub's own storage) - nothing else
      assert.doesNotMatch(withoutTrustedScripts(html), /<script|\son[a-z]+=|javascript:/i, `${where}: no script`);
      assert.match(css, /@media \(max-width:\s?900px\)|@media \(max-width:\s?[5-8]\d\dpx\)/, `${where}: a phone rule`);
      const v = validateChanges([{ op: "insert", selector: "#maincontent .column.main", where: "prepend", html }]);
      assert.deepEqual(v.problems, [], `${where}: ${v.problems.join("; ")}`);
      assert.ok(html.length <= MODULE_MAX, `${where}: ${html.length} bytes - over a version's 20 KB per element`);
      // (the voucher's small print names the order value the codes apply to - "100 bis 3000 CHF/EUR", the campaign's legal
      // line, not a price: that one paragraph alone is left out of this check)
      assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<p class="apbf-small">[^<]*<\/p>/, ""), /CHF|EUR\b|€|\d+\s*%/, `${where}: never a price or a discount`);
      assert.equal(gapOf(mm), "", `${where}: filled, it is ready`);
    }
  }
});

test("every module says what it still needs when it is new, and then draws as its skeleton - never nothing", () => {
  for (const d of MODULES) {
    const m = newModule(d.id, "de-CH", "mnew");
    const gap = gapOf(m);
    if (d.takes !== "none" || d.needs.includes("text") || d.needs.includes("picture")) assert.notEqual(gap, "", `${d.id}: a new one is not ready`);
    const sk = renderSkeleton(m, { busy: null });
    assert.match(sk, /^<div class="apx-mnew" data-apx-module="[a-z0-9-]+" data-apx-wait="1"><style>/, d.id);
    assert.match(sk, /class="am-gw" role="status"/, `${d.id}: the reason in words`);
    assert.ok(countFor(d, m.settings) >= 0);
  }
});

test("every module has its picture in the gallery", () => {
  const missing = MODULES.filter((d) => !existsSync(join(process.cwd(), "public", thumbOf(d.id))));
  assert.deepEqual(missing.map((d) => d.id), []);
});
