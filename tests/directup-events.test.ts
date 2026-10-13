import assert from "node:assert/strict";
import { test } from "node:test";
import { describe } from "../src/lib/directup/events";

// The activity log is read by people, not by the code: every event says what happened, with its figures.
const CUR = "v9-tools";

test("a visit names the store view, the sign-in and the bridge; an older bridge is noted, not a problem", () => {
  const ok = describe("hello", { bridge: "v9-tools", locale: "fr-CH", loggedIn: true }, CUR);
  assert.equal(ok.title, "DirectUP opened on fr-CH");
  assert.match(ok.detail, /Customer signed in · shop bridge v9-tools$/);
  assert.equal(ok.tone, "info");
  // the page says it once, per store view, at the top - on every visit it buried the real problems
  const old = describe("hello", { bridge: "v8-tools", locale: "en-DE", loggedIn: false }, CUR);
  assert.equal(old.tone, "info");
  assert.equal(old.detail, "Not signed in (yet) · shop bridge v8-tools (older)");
});

test("the cart's steps read as a story, with the figures", () => {
  assert.equal(describe("bridge:add", { lines: 47, pieces: 1599 }, CUR).title, "Sending 47 lines to the cart");
  assert.equal(describe("bridge:add", { lines: 47, pieces: 1599 }, CUR).detail, "1,599 pieces in all");
  assert.equal(describe("bridge:cart-before", { count: 1, section: true }, CUR).title, "Cart before: 1 line");
  const after = describe("bridge:cart-after", { grew: true, added: 47, count: 47, failed: 0, messages: [] }, CUR);
  assert.equal(after.title, "47 lines added to the cart");
  assert.equal(after.tone, "ok");
  const refused = describe("bridge:cart-after", { added: 3, failed: 2, count: 3, messages: ["Article 123 is not available"] }, CUR);
  assert.equal(refused.tone, "warn");
  assert.equal(refused.detail, "The shop said: Article 123 is not available");
  assert.equal(describe("bridge:cart-after", { added: 0, failed: 5, messages: [] }, CUR).tone, "bad");
});

test("one click: how many went in, in how many requests, and why it stopped", () => {
  const all = describe("cart", { lines: 208, requests: 3, added: 205, failed: 0, login: false }, CUR);
  assert.equal(all.title, "Add to cart: 208 lines");
  assert.equal(all.detail, "205 went in · 3 not sent · in 3 requests to the shop");
  assert.equal(all.tone, "ok");
  const login = describe("cart", { lines: 160, requests: 2, added: 80, failed: 0, login: true }, CUR);
  assert.equal(login.tone, "warn");
  assert.match(login.detail, /stopped: the shop asked for a sign-in/);
});

test("the shop's request answers: a sign-in, a too-long request and an error are problems", () => {
  assert.equal(describe("bridge:share", { status: 200, landed: "/fr-CH/checkout/cart/", login: false }, CUR).routine, true);
  assert.equal(describe("bridge:share", { status: 200, login: true }, CUR).tone, "bad");
  assert.match(describe("bridge:share", { status: 414 }, CUR).title, /too long/);
  assert.equal(describe("bridge:share", { status: 500 }, CUR).title, "The shop answered with an error (HTTP 500)");
});

test("quantities say why they changed", () => {
  assert.match(describe("qty:erp", { to: 200, kind: "up" }, CUR).detail, /minimum or a pack size/);
  assert.match(describe("qty:erp", { to: 5, kind: "disc" }, CUR).detail, /phased out/);
  assert.match(describe("qty:erp", { to: 5, kind: "down" }, CUR).detail, /no more than that/);
  assert.equal(describe("qty:erp", { to: 5, kind: "up" }, CUR).routine, true);
});

test("price problems name the article", () => {
  assert.equal(describe("erp:late", { sku: "1140072513" }, CUR).title, "No answer from the shop's ERP for 1140072513");
  assert.equal(describe("session:lost", { run: 3 }, CUR).tone, "bad");
  assert.match(describe("session:lost", { run: 3 }, CUR).detail, /^3 articles in a row/);
});

test("files say what kind and how big", () => {
  assert.equal(describe("bridge:drop", { type: "application/pdf", size: 2_500_000 }, CUR).title, "A PDF was dropped on the shop page");
  assert.equal(describe("bridge:drop", { type: "application/pdf", size: 2_500_000 }, CUR).detail, "2.4 MB");
  assert.equal(describe("upload:fail", { status: 413, error: "too large", file: true, ms: 1800 }, CUR).detail, "HTTP 413: too large · after 1.8 s");
  assert.equal(describe("export", { lines: 208 }, CUR).detail, "208 lines");
});

test("an event nobody described still shows, as itself", () => {
  const x = describe("something:new", { a: 1 }, CUR);
  assert.equal(x.title, "something:new");
  assert.equal(x.detail, '{"a":1}');
  assert.equal(describe("hello", null, CUR).title, "DirectUP opened on an unknown store view");
});
