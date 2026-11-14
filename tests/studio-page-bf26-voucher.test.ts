import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateChanges } from "../src/lib/convert/versions";
import { TRUSTED_SCRIPT_TAGS, withoutTrustedScripts } from "../src/lib/convert/trustedScripts";
import { newModule, normalizeModule } from "../src/lib/content/studio/kinds/page/modules/model";
import { renderModule } from "../src/lib/content/studio/kinds/page/modules/render";
import { BF26_VOUCHER_ENGINE, BF26_VOUCHER_TAG } from "../src/lib/content/studio/kinds/page/modules/lib/bf26voucher.data";
import { campaignFileOf, campaignPicturesIn, withMediaAddresses } from "../src/lib/content/studio/kinds/page/media";

// SARCLA 13.11.2026: "can we bring [the voucher] as a module with the railway logic?" - "if it works perfectly yes". The
// voucher module carries ONE script tag - its engine, a file of the hub stored in the hub's own picture storage - and the
// hub lets exactly that tag through, nothing else (dev-eb's review: never a script from Railway, never a look-alike).

const insert = (html: string) => validateChanges([{ op: "insert", selector: "#maincontent .column.main", where: "prepend", html }]);
const voucher = (store: string) => renderModule(normalizeModule({ type: "campaign-bf-voucher", settings: newModule("campaign-bf-voucher", store, "mv").settings })!);

test("the one trusted tag passes; any other script, or the same file written another way, is refused", () => {
  assert.deepEqual(TRUSTED_SCRIPT_TAGS, [BF26_VOUCHER_TAG]);
  assert.match(BF26_VOUCHER_TAG, /^<script src="\/content\/campaign\/bf26\/bf26-voucher-[0-9a-f]{12}\.js" defer><\/script>$/);
  assert.deepEqual(insert(`<div>x</div>${BF26_VOUCHER_TAG}`).problems, []);
  for (const bad of [
    `<script>alert(1)</script>`,
    BF26_VOUCHER_TAG.replace(" defer", ""),
    BF26_VOUCHER_TAG.replace("/content/", "https://ads-gateway-production.up.railway.app/content/"),
    BF26_VOUCHER_TAG.replace(/[0-9a-f]{12}/, "000000000000"),
    BF26_VOUCHER_TAG.replace("<script ", "<script onload=\"x()\" "),
    `${BF26_VOUCHER_TAG}<script>x</script>`,
  ]) assert.notDeepEqual(insert(`<div>x</div>${bad}`).problems, [], bad);
  assert.equal(withoutTrustedScripts(`a${BF26_VOUCHER_TAG}b`), "ab");
});

test("the engine is a file of the hub named after its content (a changed engine is a new file, a new tag)", () => {
  const file = join(process.cwd(), "public", BF26_VOUCHER_ENGINE);
  assert.ok(existsSync(file), `${file} is missing`);
  const body = readFileSync(file);
  const sha = createHash("sha256").update(body).digest("hex").slice(0, 12);
  assert.ok(BF26_VOUCHER_ENGINE.endsWith(`bf26-voucher-${sha}.js`), "the file's name is its content's hash");
  const js = body.toString("utf8");
  assert.match(js, /if \(!\/\(\^\|\\\.\)apsoparts\\\.com\$\/\.test\(location\.hostname\)\) return;/, "it runs on apsoparts.com only");
  assert.match(js, /ads-gateway-production\.up\.railway\.app\/api\/promo\/offer/, "it asks the gateway on Railway, as the pasted block does");
  // its search address is a Magento one in the texts ({{store url}}): the engine makes it the store view's own as it starts
  assert.match(js, /if \(\/\\{\\{\/\.test\(TXT\.search \|\| ""\)\) TXT\.search = "\/" \+ \(location\.pathname/, "the search address made from the page's own store view");
});

test("the voucher module: its store view's language, its engine once, one H2 - never an H1 - and Publish stores the engine", () => {
  const de = voucher("de-CH");
  assert.equal(de.split(BF26_VOUCHER_TAG).length - 1, 1, "the engine's tag once");
  assert.match(de, /id="apbf" data-lang="de"/);
  assert.match(de, /Ihr <em>persönliches<\/em> Black-Friday-Angebot/);
  assert.doesNotMatch(de, /<h1\b/i);
  assert.match(voucher("fr-FR"), /data-lang="fr"[\s\S]*Votre offre Black Friday <em>personnelle<\/em>/);
  // its buttons go to the store view's own account pages, written from the page's own host (the kit's links: ACC too)
  assert.match(voucher("en-INT"), /data-lang="en"[\s\S]*href="\/en-INT\/customer\/account\/create\/"[\s\S]*id="apbf-login" href="\/en-INT\/customer\/account\/login\/"/);
  assert.deepEqual(insert(de).problems, []);
  // Publish: the engine and the % photo go to the hub's picture storage, the page names them there
  const files = campaignPicturesIn(de);
  assert.ok(files.includes(BF26_VOUCHER_ENGINE) && files.some((u) => u.endsWith("/percent-art.webp")));
  const base = "https://dss0ijjcuug27.cloudfront.net";
  const map = new Map(files.map((u) => [u, { file: campaignFileOf(u), url: u, address: `${base}/content/${campaignFileOf(u)}` }]));
  const out = withMediaAddresses(de, map, "https://www.apsoparts.com");
  assert.ok(out.includes(`<script src="${base}${BF26_VOUCHER_ENGINE}" defer></script>`));
  // a second Publish of an already-addressed page changes nothing (never the address inside the address)
  assert.equal(withMediaAddresses(out, map, "https://www.apsoparts.com"), out);
});
