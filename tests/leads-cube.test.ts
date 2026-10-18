import assert from "node:assert/strict";
import { test } from "node:test";
import { channelOf, pathBy, pathOf, qualOf, type LeadRow, type LeadsData } from "../src/lib/marketingKpis/leadsCube";

test("where a lead came from: HubSpot's original source and its details", () => {
  assert.equal(channelOf("PAID_SEARCH", "brand (deutsch)", "Google"), "sea-google");
  assert.equal(channelOf("PAID_SEARCH", "bing", ""), "sea-microsoft");
  assert.equal(channelOf("ORGANIC_SEARCH", "Unknown keywords (SSL)", ""), "seo");
  assert.equal(channelOf("AI_REFERRALS", "chatgpt.com", ""), "ai");
  assert.equal(channelOf("DIRECT_TRAFFIC", "www.apsoparts.com/de-de/customer/account/create", ""), "shop");
  assert.equal(channelOf("DIRECT_TRAFFIC", "www.apsoparts.com/en-int", ""), "direct");
  assert.equal(channelOf("OFFLINE", "CONVERSATIONS", ""), "chat");
  assert.equal(channelOf("OFFLINE", "CHATSPOT", ""), "chat");
  assert.equal(channelOf("OFFLINE", "IMPORT", ""), "import");
  assert.equal(channelOf("OFFLINE", "CRM_UI", ""), "sales");
  assert.equal(channelOf(null, null, null), "other");
});

test("the owner's qualification: yes in any wording, no, or not yet", () => {
  assert.equal(qualOf("Yes"), 1);
  assert.equal(qualOf("Yes - registered by ESO"), 1);
  assert.equal(qualOf("Yes – registered with ESO-Support"), 1);
  assert.equal(qualOf("No"), 0);
  assert.equal(qualOf(""), null);
  assert.equal(qualOf(null), null);
});

const row = (p: Partial<LeadRow>): LeadRow => ({ m: "2026-03", c: "seo", k: "Switzerland", o: "1", n: 1, q: null, s: false, f: null, a: false, orders: 0, rev: 0, ...p });
const data = (rows: LeadRow[]): LeadsData => ({ rows, owners: {}, year: 2026, monthsDone: 9, contacts: {}, readAt: "", errors: {} });

test("the path of the months chosen, against the same months a year earlier", () => {
  const d = data([
    row({ m: "2026-02", n: 2, s: true, q: 1, f: "2026-03", orders: 3, rev: 1200 }),
    row({ m: "2026-05", c: "sea-google", f: "2026-05", a: true, orders: 1, rev: 90 }),
    row({ m: "2026-11" }), // after the window
    row({ m: "2025-04", q: 0 }),
    row({ m: "2025-12" }), // last year, outside the same months
  ]);
  const { cur, prev } = pathOf(d, { start: 0, end: 8 }, {});
  assert.deepEqual([cur.companies, cur.contacts, cur.toSales, cur.qualified, cur.notYet, cur.customers, cur.onOwn, cur.orders, cur.rev], [2, 3, 1, 1, 1, 2, 1, 4, 1290]);
  assert.deepEqual([prev.companies, prev.notQualified], [1, 1]);
  // filtered on a channel
  assert.equal(pathOf(d, { start: 0, end: 8 }, { channel: ["sea-google"] }).cur.companies, 1);
  // broken down by channel
  const by = pathBy(d, { start: 0, end: 8 }, {}, (r) => r.c);
  assert.equal(by.get("seo")?.cur.companies, 1);
  assert.equal(by.get("seo")?.prev.companies, 1);
  assert.equal(by.get("sea-google")?.cur.onOwn, 1);
});
