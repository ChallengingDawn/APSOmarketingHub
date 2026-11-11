import assert from "node:assert/strict";
import { test } from "node:test";
import { answerSaid, htmlTitleOf, isHtmlAnswer } from "../src/lib/convert/magentoSaid";
import { pageRows, readableError, retryViews, type PubVersion } from "../src/lib/content/studio/kinds/page/publishView";
import { pageIn, type MagentoRequest } from "../src/lib/convert/cmsPage";

// Content v14b (SARCLA 11.11.2026, 15:35): production's "Update all" said "Magento answered 403: <!doctype html>…" for en-INT,
// it-CH, nl-NL and pl-PL while de-CH and fr-CH were created (#958, #973) - "when Magento's answer is HTML, show its <title>
// and the HTTP status, plus 'Try again' for just the failed pages (not all)".

const FORBIDDEN = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>body{font-family:sans-serif;margin:0;padding:40px;background:#f6f6f6}h1{font-size:22px}</style>\n<title>403 Forbidden &amp; blocked</title>\n</head><body><h1>Request blocked</h1></body></html>`;

test("an HTML answer is said by its title, never by its first characters", () => {
  assert.equal(isHtmlAnswer(FORBIDDEN), true);
  assert.equal(isHtmlAnswer('{"message":"x"}'), false);
  assert.equal(htmlTitleOf(FORBIDDEN), "403 Forbidden & blocked");
  assert.equal(answerSaid(FORBIDDEN), 'an HTML page titled "403 Forbidden & blocked" instead of Magento\'s API answer');
  assert.equal(answerSaid("<html><body>no title</body></html>"), "an HTML page without a title instead of Magento's API answer");
  assert.equal(answerSaid("Service Unavailable"), "Service Unavailable");
  assert.equal(answerSaid("x".repeat(300)).length, 160);
});

test("Magento's API refused with an HTML page: the error says its status and its title (the write itself unchanged)", async () => {
  const m: MagentoRequest = async () => ({ status: 403, text: FORBIDDEN });
  await assert.rejects(pageIn(m, "kalrez-6221-6230-discontinued", 26), /Magento answered 403: an HTML page titled "403 Forbidden & blocked" instead of Magento's API answer/);
  const json: MagentoRequest = async () => ({ status: 400, text: JSON.stringify({ message: "URL key for specified store already exists." }) });
  await assert.rejects(pageIn(json, "x", 26), /Magento answered 400: URL key for specified store already exists\./);
});

test("a result line: an older message with the page's first characters says it was an HTML page, with its status", () => {
  const old = readableError("Magento answered 403: <!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-sc");
  assert.equal(old.status, 403);
  assert.equal(old.html, true);
  assert.equal(old.text, "Magento answered 403: an HTML page instead of Magento's API answer (its title was cut off)");
  const full = readableError(`Magento answered 403: ${FORBIDDEN}`);
  assert.equal(full.text, 'Magento answered 403: an HTML page titled "403 Forbidden & blocked" instead of Magento\'s API answer');
  const now = readableError('Magento answered 403: an HTML page titled "Forbidden" instead of Magento\'s API answer');
  assert.deepEqual(now, { text: 'Magento answered 403: an HTML page titled "Forbidden" instead of Magento\'s API answer', status: 403, html: true });
  assert.deepEqual(readableError("Magento answered 500: Could not save the page"), { text: "Magento answered 500: Could not save the page", status: 500, html: false });
  assert.equal(readableError(undefined).text, "Not written.");
});

test("Try again: the failed pages only - by version, a store view of a page of the shop by its version, once each", () => {
  const views: PubVersion[] = ["en-INT", "de-CH", "fr-CH", "it-CH", "nl-NL", "pl-PL"].map((view) => ({ view, cms: true, stores: [{ view }] }));
  views[0] = { view: "en-INT", cms: true, stores: [{ view: "en-INT" }, { view: "en-CH" }, { view: "en-CH/eur" }] };
  const rows = pageRows(views, []);
  // his production run: four refused, two created
  const results = [
    { view: "en-INT", ok: false, error: "Magento answered 403: <!doctype html>" },
    { view: "de-CH", ok: true }, { view: "fr-CH", ok: true },
    { view: "it-CH", ok: false }, { view: "nl-NL", ok: false }, { view: "pl-PL", ok: false },
  ];
  assert.deepEqual(retryViews(results, rows), ["en-INT", "it-CH", "nl-NL", "pl-PL"]);
  // a page of the shop: results per store view - two of English's failing make one English again
  assert.deepEqual(retryViews([{ view: "en-CH", ok: false }, { view: "en-CH/eur", ok: false }, { view: "en-INT", ok: true }], rows), ["en-INT"]);
  // a refusal of the whole call (no view) and an unknown view are not pages to write again
  assert.deepEqual(retryViews([{ view: "", ok: false }, { view: "xx-XX", ok: false }], rows), []);
  assert.deepEqual(retryViews(results.filter((r) => r.ok), rows), []);
});
