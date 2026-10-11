import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkLocale, homepageUrl, parseAlternates, selfReferences, verdictOf,
} from "../src/lib/seo/hreflang";

/** The set every apsoparts.com homepage actually publishes, trimmed to four. */
const REAL_SET = `
<link rel="alternate" href="https://www.apsoparts.com/de-CH/" hreflang="de-CH"/>
<link rel="alternate" href="https://www.apsoparts.com/it-IT/" hreflang="it-IT"/>
<link rel="alternate" href="https://www.apsoparts.com/fr-FR/" hreflang="fr-FR"/>
<link rel="alternate" href="https://www.apsoparts.com/en-INT/" hreflang="x-default"/>
`;

test("parseAlternates reads hreflang and href whatever order they come in", () => {
  const html = `
    <link rel="alternate" hreflang="de-CH" href="https://x/de-CH/">
    <link href="https://x/it-IT/" rel="alternate" hreflang="it-IT">
    <link rel="canonical" href="https://x/de-CH/">
    <link rel="alternate" href="https://x/no-lang/">
  `;
  const out = parseAlternates(html);
  assert.equal(out.length, 2, "canonical is not an alternate, and one without hreflang is unusable");
  assert.deepEqual(out.map((a) => a.hreflang), ["de-CH", "it-IT"]);
});

test("a page named in its own set is clustered", () => {
  assert.equal(
    selfReferences("https://www.apsoparts.com/it-IT/", parseAlternates(REAL_SET)),
    true,
  );
});

test("de-INT publishes the same set and is NOT in it — the live fault", () => {
  assert.equal(
    selfReferences("https://www.apsoparts.com/de-INT/", parseAlternates(REAL_SET)),
    false,
  );
});

test("x-default alone does not cluster a page", () => {
  // en-INT appears, but only as the fallback. That tells Google what to serve
  // when nothing matches; it does not say this page is the English variant.
  assert.equal(
    selfReferences("https://www.apsoparts.com/en-INT/", parseAlternates(REAL_SET)),
    false,
  );
});

test("a trailing slash or a capital is not a different page", () => {
  const alts = [{ hreflang: "de-CH", href: "https://www.apsoparts.com/de-CH" }];
  assert.equal(selfReferences("https://www.apsoparts.com/de-ch/", alts), true);
});

test("unreadable is not the same as unclustered", () => {
  const c = checkLocale("de-AT", homepageUrl("https://www.apsoparts.com", "de-AT"), null, "HTTP 503");
  assert.equal(c.selfReferenced, null);

  const v = verdictOf([c]);
  assert.equal(v.orphans.length, 0, "a page we could not read must not be reported as a fault");
  assert.equal(v.unreadable.length, 1);
  assert.equal(v.okCount, 0);
});

test("the verdict counts the live shape: German and English float free", () => {
  const origin = "https://www.apsoparts.com";
  const checks = ["de-CH", "it-IT", "fr-FR", "de-DE", "de-AT", "de-INT", "en-INT"].map((loc) =>
    checkLocale(loc, homepageUrl(origin, loc), REAL_SET, null),
  );
  const v = verdictOf(checks);

  assert.equal(v.okCount, 3, "de-CH, it-IT and fr-FR are each named in the set");
  assert.deepEqual(
    v.orphans.map((o) => o.locale),
    ["de-DE", "de-AT", "de-INT", "en-INT"],
  );
});

test("homepageUrl does not double the slash", () => {
  assert.equal(homepageUrl("https://www.apsoparts.com/", "it-IT"), "https://www.apsoparts.com/it-IT/");
});
