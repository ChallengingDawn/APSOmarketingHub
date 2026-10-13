import assert from "node:assert/strict";
import { test } from "node:test";
import { apiAddress, cadSnippet, headerSnippet, iframeOrigin, judge, scriptOrigin } from "../src/lib/threeD/places";

const RW = "https://commercehubbackend-production.up.railway.app";
// as found on www.apsoparts.com/de-CH/service/3d-cad-data, 13.10.2026
const PAGE = `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TG6ZQ6G" height="0"></iframe>
<script defer src="${RW}/pdp3d.js"></script>
<iframe src="${RW}/cad?v=anim2&amp;lang=de" style="width:100%;height:1050px;border:0;display:block" title="Download 3D Models" loading="lazy"></iframe>`;

test("the shop page's header script and catalogue frame are found, the GTM frame is not the catalogue", () => {
  assert.equal(scriptOrigin(PAGE), RW);
  assert.equal(iframeOrigin(PAGE), RW);
  assert.equal(iframeOrigin(`<iframe src="https://www.googletagmanager.com/ns.html?id=X"></iframe>`), null);
});

test("a place is green on the gateway's address, red on another, grey when nothing names it", () => {
  assert.equal(judge(RW, `${RW}/`), "ok");
  assert.equal(judge(RW, "https://gateway.apsoparts.com"), "old");
  assert.equal(judge(null, RW), "missing");
});

test("a served file's own address: written in, or taken from where it is served", () => {
  assert.deepEqual(apiAddress(`  var API = '${RW}';`), { origin: RW, follows: false });
  assert.deepEqual(apiAddress(`const API = '${RW}';`), { origin: RW, follows: false });
  assert.deepEqual(apiAddress(`var API = (document.currentScript && new URL(document.currentScript.src).origin) || '${RW}';`), { origin: null, follows: true });
  assert.deepEqual(apiAddress(`const API = location.origin;`), { origin: null, follows: true });
});

test("the snippets carry the new address and keep the live page's attributes", () => {
  const g = "https://gateway.apsoparts.com";
  assert.equal(headerSnippet(g), `<script defer src="${g}/pdp3d.js"></script>`);
  // one snippet for every store view: the catalogue takes the language from the shop page
  assert.match(cadSnippet(g), /src="https:\/\/gateway\.apsoparts\.com\/cad\?v=anim2"/);
  assert.doesNotMatch(cadSnippet(g), /lang=/);
  assert.match(cadSnippet(g), /height:1050px.*title="Download 3D Models"/);
  assert.equal(iframeOrigin(`<p>${cadSnippet(g)}</p>`), g);
});
