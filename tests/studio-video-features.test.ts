import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FEATURES, FEATURE, ICONS, confirmedBy, featuresBrief, numberAllowed } from "../src/lib/content/studio/kinds/video/features";
import { ICON_PATHS } from "../src/lib/content/studio/kinds/video/film/iconPaths";
import { countable, group } from "../src/lib/content/studio/kinds/video/film/figure";
import { KIND_INFO, SCENE_KINDS, cleanVideo, emptyVideo, featureScene, validate, videoText } from "../src/lib/content/studio/kinds/video/model";
import { cleanStoryboard, pickedFeatures, storyboardUser, STORYBOARD_SCHEMA } from "../src/lib/content/studio/kinds/video/ai";
import { SHOP_PHOTOS } from "../src/lib/content/studio/kinds/banner/brand";

// A film around APSOparts' own features (SARCLA 08.11.2026: "you should be able to select a feature or key winning point
// of APSO") - never an invented one.

const ctx = { projectTitle: "Q4 film", brief: { goal: "", audience: "Buyers", message: "", keywords: [] }, piece: { id: 3, title: "Our film", language: "EN" } };

test("every feature has its claim, its proof, an icon drawn in the film and scene kinds of the library", () => {
  assert.ok(FEATURES.length >= 10);
  for (const f of FEATURES) {
    assert.ok(f.name && f.claim && f.proof, `${f.key} has words`);
    assert.ok(ICON_PATHS[f.icon], `${f.key}'s icon is drawn`);
    assert.ok(f.scenes.length && f.scenes.every((k) => (SCENE_KINDS as readonly string[]).includes(k)), `${f.key}'s scenes are ours`);
    assert.ok(f.facts.length, `${f.key} has facts`);
    assert.ok(!/chemours/i.test(JSON.stringify(f)), "never Chemours");
    assert.ok(!/\d+\s?%/.test(JSON.stringify(f)), "never a percentage");
  }
  for (const k of ICONS) assert.ok(ICON_PATHS[k], `${k} drawn`);
  for (const k of ["no-surcharge", "directcut", "realtime", "quickorder", "delivery"] as const) assert.ok(FEATURE[k], `${k} is offered`);
});

test("the brand brain as shipped names every feature it is the source of", () => {
  const brain = readFileSync("src/data/brain.json", "utf8");
  const ok = confirmedBy(brain);
  for (const f of FEATURES) assert.ok(ok.includes(f.key), `${f.key} confirmed by the brain`);
  assert.ok(!confirmedBy("{}").includes("directcut"), "a brain without DirectCUT does not confirm it");
  assert.ok(confirmedBy("{}").includes("oring-expert"), "a feature from the shop's page alone stays");
});

test("a figure on screen is one the feature states - in any writing of it", () => {
  assert.ok(numberAllowed("48/72h", ["delivery"]));
  assert.ok(numberAllowed("100'000+", ["range"]));
  assert.ok(numberAllowed("17.000", ["customers"]));
  assert.equal(numberAllowed("24h", ["delivery"]), false);
  assert.equal(numberAllowed("48/72h", ["directcut"]), false);
  assert.equal(numberAllowed("50,000+", ["range"]), false);
  assert.ok(numberAllowed("DirectCUT", []), "no figure, nothing to check");
  assert.deepEqual(countable("100,000+"), { pre: "", value: 100000, sep: ",", post: "+" });
  assert.equal(countable("48/72h"), null);
  assert.equal(countable("1:1"), null);
  assert.equal(group(100000, "'"), "100'000");
});

test("a feature as a scene: its own claim and proof, its icon; it plays clean and the script names it", () => {
  for (const f of FEATURES) {
    for (const k of f.scenes) {
      const s = featureScene(f.key, k, `s-${f.key}-${k}`);
      const d = cleanVideo({ ...emptyVideo(), features: [f.key], scenes: [s], endCard: { line: "One click away", cta: "apsoparts.com", bars: 2 } });
      assert.equal(d.scenes[0].feature, f.key);
      if (KIND_INFO[k].icon) assert.equal(d.scenes[0].icon, f.icon);
      assert.deepEqual(validate(d).filter((x) => x.level === "stop"), [], `${f.key} as ${k}`);
    }
  }
  const d = cleanVideo({ ...emptyVideo(), features: ["delivery"], scenes: [featureScene("delivery", "number", "n1")] });
  assert.equal(d.scenes[0].copy.line1, "48/72h");
  assert.match(videoText(d), /feature: 48\/72h delivery across Europe/);
  // a figure typed that the feature does not state is pointed out
  const wrong = cleanVideo({ ...d, scenes: [{ ...d.scenes[0], copy: { ...d.scenes[0].copy, line1: "24h" } }] });
  assert.ok(validate(wrong).some((x) => /not a figure/.test(x.text)));
  // features kept: known ones, once, at most six
  assert.deepEqual(cleanVideo({ features: ["delivery", "nope", "delivery", "range"] }).features, ["delivery", "range"]);
});

test("the AI makes the film around the picked features only, with their facts; an invented figure is dropped", () => {
  const doc = { ...emptyVideo(), features: ["directcut", "delivery"] };
  assert.deepEqual(pickedFeatures(doc), ["directcut", "delivery"]);
  assert.deepEqual(pickedFeatures(doc, { features: ["range", "zzz"] }), ["range"]);
  const q = storyboardUser(ctx, doc, {});
  assert.match(q, /DirectCUT cut-to-size/);
  assert.match(q, /figures you may show: 48\/72h/);
  assert.ok(JSON.stringify(STORYBOARD_SCHEMA).includes("no-surcharge"), "the schema knows the features");
  const answer = {
    scenes: [
      { kind: "claim", bars: 2, kicker: "", line1: "Plastics, *your* size", line2: "", line3: "", sub: "", shape: "none", feature: "", icon: "" },
      { kind: "feature", bars: 2, kicker: "DirectCUT", line1: "Cut to *your* size", line2: "", line3: "", sub: "Configure it online", shape: "none", feature: "directcut", icon: "directcut" },
      { kind: "number", bars: 2, kicker: "", line1: "48/72h", line2: "delivery across *Europe*", line3: "", sub: "", shape: "none", feature: "delivery", icon: "truck" },
      { kind: "number", bars: 2, kicker: "", line1: "24h", line2: "to your door", line3: "", sub: "", shape: "none", feature: "delivery", icon: "truck" },
      { kind: "feature", bars: 2, kicker: "Support", line1: "People who answer", line2: "", line3: "", sub: "", shape: "none", feature: "support", icon: "chat" },
    ],
    endLine: "Engineering solutions. *One click away.*", cta: "apsoparts.com", note: "Two features.",
  };
  const r = cleanStoryboard(answer, doc, ctx, {});
  assert.deepEqual(r.doc.features, ["directcut", "delivery"]);
  assert.equal(r.doc.scenes.length, 4, "the invented 24h is dropped");
  assert.ok(r.dropped.some((x) => /24h/.test(x)));
  const cut = r.doc.scenes.find((s) => s.feature === "directcut")!;
  assert.equal(cut.icon, "directcut");
  assert.equal(cut.image, SHOP_PHOTOS.find((p) => p.key === "plastics")!.url, "the feature's own shop photo");
  assert.equal(r.doc.scenes[3].feature, undefined, "a feature not picked is not tied to the scene");
  assert.equal(r.doc.scenes[0].feature, undefined);
});

test("the brief for the model lists each picked feature's claim, proof and facts - nothing else", () => {
  const b = featuresBrief(["no-surcharge", "quickorder"]);
  assert.match(b, /1\. No surcharge for small orders/);
  assert.match(b, /2\. Quickorder/);
  assert.match(b, /figures you may show: none - say it without a number/);
  assert.match(b, /A thirty-line reorder becomes a two-minute review/);
});
