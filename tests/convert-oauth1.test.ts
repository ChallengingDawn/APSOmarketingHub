import assert from "node:assert/strict";
import { test } from "node:test";
import { enc, isCreds, oauthHeader } from "../src/lib/convert/oauth1";

// fake values; the expected signatures were made independently (Python, the same signing ACC accepted on 08.11.2026)
const C = { consumer_key: "ck0123456789abcdef0123456789abcd", consumer_secret: "cs0123456789abcdef0123456789abcd", access_token: "at0123456789abcdef0123456789abcd", access_token_secret: "ts0123456789abcdef0123456789abcd" };
const sig = (h: string) => decodeURIComponent(/oauth_signature="([^"]+)"/.exec(h)![1]);

test("oauthHeader: Magento's OAuth 1.0 signature, query parameters included, body not", () => {
  const opts = { now: 1794100000, nonce: "abcdef0123456789abcdef0123456789" };
  const get = oauthHeader("GET", "https://acc.apsoparts.com/rest/all/V1/cmsPage/search?searchCriteria%5BpageSize%5D=1&searchCriteria%5BcurrentPage%5D=1", C, opts);
  assert.equal(sig(get), "gTx/1cymfMHlK0yiHW/tsIwGBQ40fdGnqSmtzK7WjD0=");
  assert.match(get, /^OAuth oauth_consumer_key="ck0123456789abcdef0123456789abcd", oauth_token="at0123/);
  assert.match(get, /oauth_signature_method="HMAC-SHA256"/);
  assert.equal(sig(oauthHeader("PUT", "https://acc.apsoparts.com/rest/all/V1/cmsPage/12", C, opts)), "wUtB+WiyWF1mo4QXVeBH5MXvpp78g1o/GXmQYPa3sM0=");
  assert.notEqual(sig(oauthHeader("GET", "https://acc.apsoparts.com/rest/all/V1/cmsPage/12", C)), sig(oauthHeader("GET", "https://acc.apsoparts.com/rest/all/V1/cmsPage/12", C)), "a fresh nonce each time");
});

test("enc and isCreds", () => {
  assert.equal(enc("a b!*'()~"), "a%20b%21%2A%27%28%29~");
  assert.ok(isCreds(C));
  assert.ok(!isCreds({ ...C, access_token_secret: "" }));
  assert.ok(!isCreds("x"));
});
