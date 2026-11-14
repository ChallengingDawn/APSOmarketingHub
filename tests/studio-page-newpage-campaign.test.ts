import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KEEPS_OWN_WORDS, accountLinks, campaignLibrary, campaignOf, campaignUser, cleanNewPageModules, newPageAddresses, newPageLibrary,
} from "../src/lib/content/studio/kinds/page/plan/newpage";
import { campaignFacts } from "../src/lib/content/campaignFacts";

// SARCLA 14.11.2026, building the Black Friday page from a prompt in the Page builder: "where are the black friday
// modules?" - a new page took no campaign module at all. A page whose to-do names the campaign now gets that campaign's
// own modules offered, placed by the AI; the voucher brings its own words in every language.

const BF = ["campaign-bf-poster", "campaign-bf-percent", "campaign-bf-quote", "campaign-bf-voucher"];

test("a page about Black Friday is offered the campaign's modules - any other page none", () => {
  assert.equal(campaignOf("Black Friday Campaign")?.name, "Black Friday");
  assert.equal(campaignOf("black-friday landing page for buyers")?.name, "Black Friday");
  assert.equal(campaignOf("O-Ringe für die Lebensmittelindustrie"), null);
  assert.deepEqual(campaignLibrary("Black Friday Campaign").map((m) => m.id).sort(), [...BF].sort());
  assert.deepEqual(campaignLibrary("O-rings for food plants"), []);
  // never in the general new-page library (a page that is not about the campaign)
  assert.ok(!newPageLibrary().some((m) => BF.includes(m.id)));
  const said = campaignUser("Black Friday", campaignLibrary("black friday"), "fr-CH");
  assert.match(said, /THIS IS A BLACK FRIDAY PAGE/);
  assert.match(said, /https:\/\/www\.apsoparts\.com\/fr-CH\/customer\/account\/create\//);
  for (const id of BF) assert.ok(said.includes(id), id);
  assert.equal(campaignUser("Black Friday", [], "de-CH"), "");
});

test("the AI's campaign modules kept: the voucher placed with its own words, the poster's buttons to the account pages", () => {
  const camp = campaignLibrary("Black Friday");
  const addr = newPageAddresses([], []);
  for (const a of accountLinks("de-CH")) { addr.links.push(a.url); addr.linkNames[a.url] = a.name; }
  const ctx = { ...addr, pageText: "Black Friday APSOparts Kunden", lang: "de", store: "de-CH", lib: [...newPageLibrary(), ...camp] };
  const raw = [
    { module: "campaign-bf-poster", at: "hero", how: "after", why: "The campaign's own poster", eyebrow: "", title: "Black Friday", text: "Ihr persönliches Angebot nach dem Login.", button: "Jetzt registrieren", link: "https://www.apsoparts.com/de-CH/customer/account/create/", items: [], fill: "none", category: "", count: 0 },
    { module: "campaign-bf-voucher", at: "intro", how: "after", why: "Each company's own code", eyebrow: "X", title: "Rabatt für alle", text: "Irgendwas", button: "Kaufen", link: "https://www.apsoparts.com/de-CH/x.html", items: [], fill: "none", category: "", count: 0 },
  ];
  const out = cleanNewPageModules(raw, ctx);
  assert.deepEqual(out.modules.map((m) => m.module), ["campaign-bf-poster", "campaign-bf-voucher"], out.problems.join("; "));
  const poster = out.modules[0];
  assert.equal(poster.link, "https://www.apsoparts.com/de-CH/customer/account/create/", "a register button goes to the store view's register page");
  assert.equal(poster.words.button, "Jetzt registrieren");
  const v = out.modules[1];
  assert.ok(KEEPS_OWN_WORDS.has(v.module));
  assert.deepEqual([v.words.eyebrow, v.words.title, v.words.text, v.words.button, v.link], ["", "", "", "", ""], "the voucher keeps the campaign's own words");
  // a page that is not about the campaign: the same answer leaves both out, and says why
  const plain = cleanNewPageModules(raw, { ...ctx, lib: undefined });
  assert.deepEqual(plain.modules, []);
  assert.ok(plain.problems.some((p) => /no campaign/.test(p)));
});

test("a project about Black Friday is told the campaign's facts - its dates from the voucher's data, never a discount", () => {
  const f = campaignFacts("Black Friday Campaign");
  assert.match(f, /from 16 November 2026 to 6 December 2026/, "the voucher's own dates, the last day included (Swiss time)");
  assert.match(f, /OWN voucher code, shown after login/);
  assert.match(f, /never names a discount figure/);
  assert.equal(campaignFacts("Cut-to-size for food lines"), "");
});
