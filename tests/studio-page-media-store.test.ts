import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_SHA256, canonicalPath, sha256Hex, signS3, uriEncode } from "../src/lib/aws/s3sign";
import {
  CACHE_CONTROL, CONTENT_MEDIA, ONLY_FROM_THE_HUB, contentAddress, contentFileOf, contentKey, contentMediaBase, contentMediaState, contentTypeOf, slugOf,
} from "../src/lib/content/studio/kinds/page/contentMedia";
import { SHOP_MEDIA, hubPicturesIn, mediaFileOf, pictureAltsIn, pictureWordsOf, shownAt, withMediaAddresses, type MediaFile } from "../src/lib/content/studio/kinds/page/media";
import { emptyFields, type Fields } from "../src/lib/content/studio/kinds/page/fields";
import { pageHtml, renderNewPage } from "../src/lib/content/studio/kinds/page/newpage";

// SARCLA 11.11.2026: "I can't copy-paste each new picture to Magento". Magento's REST API cannot upload media, so the
// hub keeps a new page's own pictures itself: an S3 bucket served by CloudFront. The page names each one at
// <base>/content/<readable-name>-<id>.<ext>; Publish stores the ones not stored yet (a HEAD, then a PUT signed with SigV4).

const BASE = "https://dss0ijjcuug27.cloudfront.net";
const ACC = "https://acc.apsoparts.com";

test("a picture's file: readable from its words, its own number last, its type's extension - the same every time", () => {
  assert.equal(contentFileOf(448, "image/jpeg", "Kalrez® 6221 and 6230 discontinued – evolast® O-ring"), "kalrez-6221-and-6230-discontinued-evolast-o-ring-448.jpg");
  // stable: the same picture with the same words is the same file (stored once)
  assert.equal(contentFileOf(448, "image/jpeg", "Kalrez® 6221 and 6230 discontinued – evolast® O-ring"), contentFileOf(448, "image/jpeg", "Kalrez® 6221 and 6230 discontinued – evolast® O-ring"));
  // unique per picture: the same words, two pictures, two files
  assert.notEqual(contentFileOf(448, "image/jpeg", "Black FFKM O-rings"), contentFileOf(449, "image/jpeg", "Black FFKM O-rings"));
  // a number in the words never makes two pictures meet: the picture's number is always the last part
  assert.notEqual(contentFileOf(48, "image/jpeg", "seal 4"), contentFileOf(448, "image/jpeg", "seal"));
  assert.equal(contentFileOf(48, "image/jpeg", "seal 4"), "seal-4-48.jpg");
  // the extension is the picture's type's
  assert.equal(contentFileOf(7, "image/png", "Logo"), "logo-7.png");
  assert.equal(contentFileOf(7, "image/webp", "Logo"), "logo-7.webp");
  assert.equal(contentFileOf(7, null, "Logo"), "logo-7.jpg");
  // no words: "picture"; accents and umlauts plain; at most 60 characters of words, cut at a dash
  assert.equal(contentFileOf(12, "image/jpeg", ""), "picture-12.jpg");
  assert.equal(contentFileOf(12, "image/jpeg", "  Dichtungen für die Lebensmittelindustrie – Übersicht  "), "dichtungen-fur-die-lebensmittelindustrie-ubersicht-12.jpg");
  assert.equal(slugOf("Straße & Größe"), "strasse-grosse");
  const long = contentFileOf(9, "image/jpeg", "A very long alternative text that goes on and on about O-rings, seals, gaskets and the many materials they are made of");
  const stem = long.replace(/-9\.jpg$/, "");
  assert.ok(stem.length <= 60, `at most 60: ${stem.length}`);
  assert.match(stem, /^[a-z0-9]+(-[a-z0-9]+)*$/, "lower case and dashes, no dash at an end");
  assert.equal(stem, "a-very-long-alternative-text-that-goes-on-and-on-about-o");
  // its key and its public address; the type it is stored with
  assert.equal(contentKey("logo-7.png"), "content/logo-7.png");
  assert.equal(contentAddress(`${BASE}/`, "logo-7.png"), `${BASE}/content/logo-7.png`);
  assert.equal(contentTypeOf("a-1.jpg"), "image/jpeg");
  assert.equal(contentTypeOf("a-1.png"), "image/png");
  assert.equal(contentTypeOf("a-1.webp"), "image/webp");
  assert.equal(CACHE_CONTROL, "public, max-age=31536000, immutable");
  assert.equal(CONTENT_MEDIA.bucket, "apsoparts-content-media-905418292914");
  assert.equal(CONTENT_MEDIA.region, "eu-central-1");
  assert.equal(CONTENT_MEDIA.prefix, "content/");
});

test("on or off: a base and the task's credentials; an override from the environment; a laptop stays off and says why", () => {
  const creds = { AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: "/v2/credentials/abc" };
  // shipped on: the CloudFront domain is the constant
  assert.equal(CONTENT_MEDIA.base, BASE);
  assert.deepEqual(contentMediaState(creds), { on: true, base: BASE });
  // CONTENT_MEDIA_BASE overrides it (a slash at its end dropped); "off" switches it off without a release
  assert.equal(contentMediaBase({ CONTENT_MEDIA_BASE: "https://media.apsoparts.com/" }), "https://media.apsoparts.com");
  assert.deepEqual(contentMediaState({ ...creds, CONTENT_MEDIA_BASE: "off" }), { on: false, why: null });
  // not an https origin: off
  assert.equal(contentMediaBase({ CONTENT_MEDIA_BASE: "http://media.apsoparts.com" }), "");
  assert.equal(contentMediaBase({ CONTENT_MEDIA_BASE: "https://media.apsoparts.com/x" }), "");
  // a laptop (no task credentials): off, said plainly
  assert.deepEqual(contentMediaState({}), { on: false, why: ONLY_FROM_THE_HUB });
  assert.equal(ONLY_FROM_THE_HUB, "Pictures can only be stored from the hub itself.");
});

// AWS's examples, "Authenticating Requests: Using the Authorization Header (AWS Signature Version 4)", Amazon S3 API
// reference - the example credentials, 24 May 2013, examplebucket in us-east-1.
const AWS_EXAMPLE = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };
const NOW = new Date("2013-05-24T00:00:00Z");
const HOST = "examplebucket.s3.amazonaws.com";

test("SigV4: AWS's GET Object example - the canonical request, the string to sign and the signature", () => {
  const g = signS3({ method: "GET", host: HOST, path: "/test.txt", headers: { Range: "bytes=0-9" }, payloadHash: EMPTY_SHA256, region: "us-east-1", now: NOW }, AWS_EXAMPLE);
  assert.equal(g.canonicalRequest, [
    "GET", "/test.txt", "",
    "host:examplebucket.s3.amazonaws.com", "range:bytes=0-9", `x-amz-content-sha256:${EMPTY_SHA256}`, "x-amz-date:20130524T000000Z", "",
    "host;range;x-amz-content-sha256;x-amz-date", EMPTY_SHA256,
  ].join("\n"));
  assert.equal(g.stringToSign, "AWS4-HMAC-SHA256\n20130524T000000Z\n20130524/us-east-1/s3/aws4_request\n7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972");
  assert.equal(g.signature, "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  assert.equal(g.headers.authorization, "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  assert.equal(sha256Hex(""), EMPTY_SHA256);
});

test("SigV4: AWS's PUT Object example (a $ in the key, the payload's own hash) and its two bucket GETs (a query)", () => {
  const body = "Welcome to Amazon S3.";
  assert.equal(sha256Hex(body), "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072");
  const p = signS3({
    method: "PUT", host: HOST, path: "/test$file.text", payloadHash: sha256Hex(body), region: "us-east-1", now: NOW,
    headers: { Date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
  }, AWS_EXAMPLE);
  assert.match(p.canonicalRequest, /^PUT\n\/test%24file\.text\n\n/);
  assert.equal(p.stringToSign.split("\n")[3], "9e0e90d9c76de8fa5b200d8c849cd5b8dc7a3be3951ddb7f6a76b4158342019d");
  assert.equal(p.signature, "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
  const life = signS3({ method: "GET", host: HOST, path: "/", query: { lifecycle: "" }, payloadHash: EMPTY_SHA256, region: "us-east-1", now: NOW }, AWS_EXAMPLE);
  assert.equal(life.signature, "fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543");
  const list = signS3({ method: "GET", host: HOST, path: "/", query: { prefix: "J", "max-keys": "2" }, payloadHash: EMPTY_SHA256, region: "us-east-1", now: NOW }, AWS_EXAMPLE);
  assert.equal(list.signature, "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7");
  // the task's session token is sent and signed
  const t = signS3({ method: "HEAD", host: HOST, path: "/content/a-1.jpg", payloadHash: EMPTY_SHA256, region: "eu-central-1", now: NOW }, { ...AWS_EXAMPLE, sessionToken: "TOKEN" });
  assert.equal(t.headers["x-amz-security-token"], "TOKEN");
  assert.match(t.headers.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,/);
  assert.match(t.headers.authorization, /Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/eu-central-1\/s3\/aws4_request/);
  assert.equal(canonicalPath("/content/a b+c.jpg"), "/content/a%20b%2Bc.jpg");
  assert.equal(uriEncode("a!'()*~._-"), "a%21%27%28%29%2A~._-");
});

/** A page with the hub's picture in its hero and in a tile, and the shop's own photos. */
function page(): string {
  const f: Fields = { ...emptyFields() };
  f.hero = { ...f.hero, title: "Kalrez® 6221 and 6230 discontinued", picture: { url: "/api/content/picture/199-abcd1234", alt: "Black FFKM O-rings", idea: "" } };
  return pageHtml(renderNewPage(f, { store: "en-INT" }))
    + `<img src="{{media url='wysiwyg/1_ORings.jpg'}}" alt="O-rings"><img src="https://www.apsoparts.com/media/catalog/product/x.jpg" alt="Shop photo">`
    + `<img alt="Evolast &amp; PB794" src="/api/content/picture/7-wxyz9876"><i style="background:url(/api/content/picture/8-bg12bg12)"></i>`;
}

test("the page's words name its pictures: the alt text in the HTML, else the document's alt, idea or tile name", () => {
  const html = page();
  const alts = pictureAltsIn(html);
  assert.equal(alts.get("/api/content/picture/199-abcd1234"), "Black FFKM O-rings");
  assert.equal(alts.get("/api/content/picture/7-wxyz9876"), "Evolast & PB794", "alt before src, entities read");
  assert.equal(alts.has("/api/content/picture/8-bg12bg12"), false, "a CSS background has no alt");
  const words = pictureWordsOf({
    hero: { picture: { url: "/api/content/picture/199-abcd1234", alt: "", idea: "O-rings on a steel plate" } },
    modules: [{ module: { settings: { items: [{ name: "FFKM O-ring evolast® PB794", img: "/api/content/picture/8-bg12bg12" }] } } }],
  });
  assert.equal(words.get("/api/content/picture/199-abcd1234"), "O-rings on a steel plate", "no alt: the idea");
  assert.equal(words.get("/api/content/picture/8-bg12bg12"), "FFKM O-ring evolast® PB794", "a tile: its name");
});

test("the HTML rewrite: the hub's pictures at the storage's address, the shop's photos untouched, off = as before", () => {
  const html = page();
  const alts = pictureAltsIn(html);
  const on = new Map<string, MediaFile>(hubPicturesIn(html).map((p) => {
    const file = contentFileOf(p.id, "image/jpeg", alts.get(p.url) ?? "");
    return [p.url, { file, url: p.url, address: contentAddress(BASE, file) }];
  }));
  const out = withMediaAddresses(html, on, ACC);
  assert.match(out, /src="https:\/\/dss0ijjcuug27\.cloudfront\.net\/content\/black-ffkm-o-rings-199\.jpg"/);
  assert.match(out, /src="https:\/\/dss0ijjcuug27\.cloudfront\.net\/content\/evolast-pb794-7\.jpg"/);
  assert.match(out, /url\(https:\/\/dss0ijjcuug27\.cloudfront\.net\/content\/picture-8\.jpg\)/);
  assert.doesNotMatch(out, /\/api\/content\/picture\//, "no hub address left");
  assert.doesNotMatch(out, /wysiwyg\/content/, "nothing in Magento's media");
  // the same for ACC and production: the storage's address does not depend on the target
  assert.equal(withMediaAddresses(html, on, "https://www.apsoparts.com"), out);
  // the shop's own photos stay the shop's: a media directive on www, a www address as it was
  assert.match(out, new RegExp(`src="${SHOP_MEDIA.replace(/[./]/g, "\\$&")}wysiwyg/1_ORings\\.jpg"`));
  assert.match(out, /src="https:\/\/www\.apsoparts\.com\/media\/catalog\/product\/x\.jpg"/);
  // off: no address - each hub picture its file in the target's media, exactly as before
  const off = new Map<string, MediaFile>(hubPicturesIn(html).map((p) => [p.url, { file: mediaFileOf(p.id, "image/jpeg"), url: p.url }]));
  const before = withMediaAddresses(html, off, ACC);
  assert.match(before, /src="https:\/\/acc\.apsoparts\.com\/media\/wysiwyg\/content\/apx-199\.jpg"/);
  assert.match(before, /url\(https:\/\/acc\.apsoparts\.com\/media\/wysiwyg\/content\/apx-8\.jpg\)/);
  assert.doesNotMatch(before, /cloudfront/);
  assert.equal(shownAt({ file: "apx-1.jpg", url: "/api/content/picture/1-abcd" }, ACC), `${ACC}/media/wysiwyg/content/apx-1.jpg`);
  assert.equal(shownAt({ file: "a-1.jpg", url: "/api/content/picture/1-abcd", address: `${BASE}/content/a-1.jpg` }, ACC), `${BASE}/content/a-1.jpg`);
});
