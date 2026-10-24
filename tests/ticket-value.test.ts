import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleQuantities, branchOf, decide, decideHub, findArticles, findFirstPrice, findFirstQty, isUnqualified, kpiEvents, lastEditorIsHuman, parseUnitQty, pickUnitPrice,
  priceArticles, priceCheckArticles, scoreTicket, toNum, unwrapUrl, type Api, type Better, type Resp,
} from "../src/lib/ticketValue/rules";
import { averageOf, enrolsOnStage, finalOf, firstOrderValue, measure, pathOf, pickPipe, pricesOf, sameValue, sumPeriod, zurichDay, zurichMidnight, type DayBucket, type Values } from "../src/lib/ticketValue/model";

/** A fake HubSpot: answers by path; every call is recorded. */
function fake(routes: Record<string, unknown>, calls: string[] = []): Api {
  const answer = (path: string): Resp => {
    calls.push(path);
    for (const [k, v] of Object.entries(routes)) if (path.startsWith(k)) return { status: 200, json: v };
    return { status: 404, json: {} };
  };
  return { get: async (p) => answer(p), post: async (p, b) => answer(`${p} ${JSON.stringify(b)}`), put: async (p) => { calls.push(`PUT ${p}`); return { status: 200, json: {} }; } };
}
const none = { results: [] };

test("the Python's to_num: thousands and decimal commas, junk is 0", () => {
  assert.equal(toNum("1.234,5"), 1234.5);
  assert.equal(toNum("12,5"), 12.5);
  assert.equal(toNum(" 1 500 "), 1500);
  assert.equal(toNum("0.0"), 0);
  assert.equal(toNum("abc"), 0);
  assert.equal(toNum(null), 0);
  assert.equal(toNum("0x10"), 0); // Python's float() refuses hex
});

test("quantity needs a word, price needs per piece; the first regex that matches wins", () => {
  assert.equal(findFirstQty("we need 250 pcs of 12x2"), 250);
  assert.equal(findFirstQty("Menge: 40"), 40);
  assert.equal(findFirstQty("50x2 O-ring, 8032 Zürich"), null); // no dimensions, no postcodes
  assert.equal(findFirstQty("1200 Stück"), 1200);
  assert.equal(findFirstQty("5 ud. de"), 5);
  assert.equal(findFirstPrice("zu 0,85 EUR/Stück"), 0.85);
  assert.equal(findFirstPrice("unit price: 12.50"), 12.5);
  assert.equal(findFirstPrice("12 EUR"), null);
});

test("articles from shop links and bare 10 digits, not glued to letters or hyphens", () => {
  const t = unwrapUrl("see https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.apsoparts.com%2Fde-CH%2F1010123456-o-ring.html&data=x and 1140401819, DT-1140401820");
  assert.deepEqual(findArticles(t), ["1010123456", "1140401819"]);
});

test("sales unit and the scale price per mandant", () => {
  assert.equal(parseUnitQty("100 Pcs"), 100);
  assert.equal(parseUnitQty("Pcs"), 1);
  assert.equal(parseUnitQty("1.000 Pcs"), 1); // as the Python reads it
  const p = { scale_quantity_1: "1", scale_price_1: "10", scale_quantity_2: "100", scale_price_2: "8", art_price__m100__listed_price: "12", scale_quantity_1__m110: "1", scale_price_1__m110: "11" };
  assert.equal(pickUnitPrice(p, 150, "M100"), 8);
  assert.equal(pickUnitPrice(p, 50, "M100"), 10);
  assert.equal(pickUnitPrice(p, 50, "M110"), 11);
  assert.equal(pickUnitPrice({ art_price__m100__listed_price: "12" }, 5, "M100"), 12);
});

test("the branches: erosion before September push before price check before new customers", () => {
  assert.equal(branchOf({ erosion_key: "x", sept_push_target: "5" }), "erosion");
  assert.equal(branchOf({ sept_push_target: "5" }), "sept");
  assert.equal(branchOf({ price_check_key: "k", hs_tag_ids: "43412670" }), "pricecheck");
  assert.equal(branchOf({ hs_tag_ids: "1;43412983" }), "newcustomer");
  assert.equal(branchOf({ subject: "x" }), "score");
  assert.equal(isUnqualified({ subject: "NPS survey reply" }), true);
  assert.equal(isUnqualified({ hs_tag_ids: "38228151" }), true);
});

test("tiers in order: the ticket's own field, then its GQS child, then the company", async () => {
  const direct = await scoreTicket(fake({}), "1", { order_potential_: "1500" });
  assert.deepEqual([direct.value, direct.source, direct.confidence], [1500, "direct_field", "high"]);
  const cart = await scoreTicket(fake({}), "1", { subject: "Abandoned cart 1.234,50 €" });
  assert.deepEqual([cart.value, cart.source], [1234.5, "direct_field"]);
  const gqs = await scoreTicket(fake({
    "/crm/v4/objects/tickets/1/associations/tickets": { results: [{ toObjectId: 7 }, { toObjectId: 8 }] },
    "/crm/v3/objects/tickets/batch/read": { results: [{ id: "7", properties: { hs_pipeline: "1726599376", order_potential_: "99" } }, { id: "8", properties: { hs_pipeline: "1726786775", order_potential_: "4200" } }] },
  }), "1", { subject: "x" });
  assert.deepEqual([gqs.value, gqs.source], [4200, "child_gqs"]);
  const base = await scoreTicket(fake({
    "/crm/v4/objects/tickets/1/associations/tickets": none,
    "/crm/v4/objects/tickets/1/associations/companies": { results: [{ toObjectId: 55 }] },
    "/crm/v3/objects/companies/55": { properties: { mandant: "", yearly_customer_potential: "44471", tickets_count_last_12m: "16" } },
  }), "1", { subject: "hello" });
  assert.equal(base.source, "company_baseline");
  assert.equal(Math.round(base.value * 100) / 100, 277.94);
  const no = await scoreTicket(fake({ "/crm/v4/objects/tickets/1/associations": none }), "1", { subject: "hello" });
  assert.deepEqual([no.value, no.source, no.confidence], [0, "unknown", "low"]);
});

test("the company through the contact is linked (recorded, not sent in the shadow); internal domains never searched", async () => {
  const calls: string[] = [];
  const s = await scoreTicket(fake({
    "/crm/v4/objects/tickets/1/associations/tickets": none,
    "/crm/v4/objects/tickets/1/associations/companies": none,
    "/crm/v4/objects/tickets/1/associations/contacts": { results: [{ toObjectId: 3 }] },
    "/crm/v4/objects/contacts/3/associations/companies": { results: [{ toObjectId: 66 }] },
    "/crm/v3/objects/companies/66": { properties: { yearly_customer_potential: "1200" } },
  }, calls), "1", { subject: "hello" });
  assert.equal(s.source, "company_baseline");
  assert.equal(s.value, 10); // 1200 * 0.1 / 12 without a ticket count
  assert.equal(s.linked, "66");
  assert.ok(calls.includes("PUT /crm/v4/objects/tickets/1/associations/default/companies/66"));
  const calls2: string[] = [];
  await scoreTicket(fake({
    "/crm/v4/objects/tickets/1/associations/tickets": none, "/crm/v4/objects/tickets/1/associations/companies": none,
    "/crm/v4/objects/tickets/1/associations/contacts": { results: [{ toObjectId: 3 }] }, "/crm/v4/objects/contacts/3/associations/companies": none,
    "/crm/v3/objects/contacts/3": { properties: { email: "x@apsoparts.com" } },
  }, calls2), "1", { subject: "hello" });
  assert.ok(!calls2.some((c) => c.includes("/companies/search")));
});

test("article x quantity through Products & Pricing, per sales unit, with the per-piece bounds", async () => {
  const s = await scoreTicket(fake({
    "/crm/v4/objects/tickets/1/associations/tickets": none,
    "/crm/v4/objects/tickets/1/associations/companies": { results: [{ toObjectId: 55 }] },
    "/crm/v3/objects/companies/55": { properties: { mandant: "M100", yearly_customer_potential: "0" } },
    "/crm/v3/objects/2-200042439/search": { results: [{ properties: { sales_unit: "100 Pcs", art_price__m100__listed_price: "25" } }] },
  }), "1", { subject: "Anfrage", content: "Artikel 1010123456, 500 Stück bitte" });
  assert.equal(s.source, "product_lookup");
  assert.equal(s.value, 125); // 500 / 100 x 25
});

test("main(): a person's value is kept, unqualified stays, unchanged writes nothing", async () => {
  const api = fake({ "/crm/v4/objects/tickets/1/associations": none });
  const human = await decide(api, "1", { hs_pipeline: "1726599376", sales_potential_source: "company_baseline", sales_potential_estimate: "50" }, true, "2026-10-20");
  assert.deepEqual(human.patch, { sales_potential_source: "manual_override", sales_potential_confidence: "high" });
  const kept = await decide(api, "1", { hs_pipeline: "1726599376", sales_potential_source: "manual_override" }, true, "2026-10-20");
  assert.equal(kept.patch, null);
  const unq = await decide(api, "1", { hs_pipeline: "1726599376", sales_potential_source: "unqualified" }, false, "2026-10-20");
  assert.equal(unq.action, "respect_unqualified");
  const same = await decide(api, "1", { hs_pipeline: "1726599376", sales_potential_source: "unknown", sales_potential_estimate: "0.0" }, false, "2026-10-20");
  assert.equal(same.patch, null);
  assert.equal(same.action, "unchanged(unknown)");
  const fresh = await decide(api, "1", { hs_pipeline: "1726599376", order_potential_: "300" }, false, "2026-10-20");
  assert.deepEqual(fresh.patch, { sales_potential_source: "direct_field", sales_potential_confidence: "high", sales_potential_estimate: 300 });
  const other = await decide(api, "1", { hs_pipeline: "999" }, false, "2026-10-20");
  assert.equal(other.action, "not_tracked_pipeline");
  const ero = await decide(api, "1", { erosion_key: "k", erosion_amount_2025: "3388" }, false, "2026-10-20");
  assert.deepEqual(ero.patch, { sales_potential_confidence: "high", sales_potential_source: "direct_field", sales_potential_estimate: 3388 });
});

test("a person last = the history's newest entry from the UI or a user", () => {
  assert.equal(lastEditorIsHuman([{ sourceType: "CRM_UI" }]), true);
  assert.equal(lastEditorIsHuman([{ sourceType: "INTEGRATION", sourceId: "30109717" }, { sourceType: "CRM_UI" }]), false);
  assert.equal(lastEditorIsHuman([{ sourceType: "AUTOMATION_PLATFORM", sourceId: "userId:123" }]), true);
  assert.equal(lastEditorIsHuman([]), false);
});

test("the KPI rows: created today, closed today, open marker, typed-by-a-person marker", () => {
  const k = kpiEvents("9", { createdate: "2026-10-20T08:00:00Z", sales_potential_estimate: "40", sales_potential_source: "company_baseline", hs_pipeline_stage: "2338232556" }, "ESO", "2026-10-20");
  assert.deepEqual(k.upsert, ["sales_funnel|created|tid9", "sales_funnel|pot_created|tid9", "sales_funnel|live|tid9"]);
  assert.deepEqual(k.archive, ["sales_funnel|mo|tid9"]);
  const c = kpiEvents("9", { createdate: "2026-10-01T08:00:00Z", closed_date: "2026-10-20T09:00:00Z", sales_potential_estimate: "40", sales_potential_source: "manual_override", hs_pipeline_stage: "2510335189" }, "GQS", "2026-10-20");
  assert.deepEqual(c.upsert, ["sales_funnel|closed|tid9", "sales_funnel|pot_lost|tid9", "sales_funnel|mo|tid9"]);
  assert.deepEqual(c.archive, ["sales_funnel|live|tid9"]);
});

test("the comparison: the same within a cent, '0.0' is 0, no value is not 0", () => {
  const v = (e: string | null, s: string | null, c: string | null): Values => ({ sales_potential_estimate: e, sales_potential_source: s, sales_potential_confidence: c });
  assert.equal(sameValue(v("9.07", "company_baseline", "low"), v("9.066", "company_baseline", "low")), true);
  assert.equal(sameValue(v("0", "unknown", "low"), v("0.0", "unknown", "low")), true);
  assert.equal(sameValue(v(null, null, null), v("0", "unknown", "low")), false);
  assert.equal(sameValue(v("0.02", "company_baseline", "low"), v("9.07", "company_baseline", "low")), false);
  assert.deepEqual(finalOf(v(null, null, null), { sales_potential_estimate: 5, sales_potential_source: "direct_field" }), v("5", "direct_field", null));
});

test("a stage entry is taken again when the value is unknown, written since yesterday, or older than 10 days", () => {
  const at = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(zurichMidnight(at), Date.parse("2026-10-19T22:00:00Z")); // summer time
  assert.equal(zurichMidnight(Date.parse("2026-12-20T12:00:00Z")), Date.parse("2026-12-19T23:00:00Z"));
  assert.equal(enrolsOnStage(null, null, at), true);
  assert.equal(enrolsOnStage("5", "2026-10-19T08:00:00Z", at), true); // yesterday
  assert.equal(enrolsOnStage("5", "2026-10-15T08:00:00Z", at), false); // 5 days ago
  assert.equal(enrolsOnStage("5", "2026-10-01T08:00:00Z", at), true); // older than 10 days
});

test("the figures leave out pending and late rows, and count where they differ", () => {
  const v = (e: string | null, s: string | null): Values => ({ sales_potential_estimate: e, sales_potential_source: s, sales_potential_confidence: "low" });
  const row = (verdict: "agree" | "differ" | "missed" | "pending", wf: Values, hub: Values, late?: boolean) => ({ verdict, pipeline: "ESO", trigger: "created" as const, enrols: true, late, hub: { branch: "score", final: hub }, workflow: { wrote: verdict !== "missed", final: wf } });
  const m = measure([
    row("agree", v("5", "company_baseline"), v("5", "company_baseline")),
    row("differ", v("0.0", "unknown"), v("7", "company_baseline")),
    row("missed", v(null, null), v("4", "company_baseline")),
    row("pending", v(null, null), v("4", "company_baseline")),
    row("agree", v("1", "unknown"), v("1", "unknown"), true),
  ]);
  assert.deepEqual([m.checked, m.agree, m.differ, m.missed, m.pending, m.late], [3, 1, 1, 1, 1, 1]);
  assert.equal(m.pairs[0].n, 1);
  assert.equal(Math.round((m.agreeShare ?? 0) * 100), 33);
});

// ---------------- the hub's own rules ----------------

const prices: Record<string, number> = { "1120036838": 1.8, "1120075420": 0.5, "1010123456": 0.25 };
const better = (firstOrder: number | null = 420): Better => ({ price: (a) => prices[a] ?? null, firstOrder });

test("each article takes the quantity on its own line; Stk, x and Menge count; one article may take a quantity elsewhere", () => {
  assert.deepEqual(articleQuantities("1120036838 x 100\n1120075420 - 30 Stk\nMenge: 5 für 1010123456"), [
    { article: "1120036838", qty: 100 }, { article: "1120075420", qty: 30 }, { article: "1010123456", qty: 5 },
  ]);
  assert.deepEqual(articleQuantities("50 x 1120036838"), [{ article: "1120036838", qty: 50 }]);
  assert.deepEqual(articleQuantities("Artikel 1120036838\nwir brauchen 250 Stk."), [{ article: "1120036838", qty: 250 }]);
  assert.deepEqual(articleQuantities("1120036838 and 1120075420\n250 Stk"), []); // two articles, the quantity on neither line
});

test("a price check's articles, priced at what each sells for; never-sold articles left out and said", () => {
  const items = priceCheckArticles("1120036838 x 100 (DT · Stk · no MOQ); 1120075420 x 30 (DT · Stk · no MOQ); 1999999999 x 7 (KT · Stk)");
  assert.deepEqual(items.map((x) => [x.article, x.qty]), [["1120036838", 100], ["1120075420", 30], ["1999999999", 7]]);
  const r = priceArticles(items, better().price);
  assert.equal(Math.round(r.value * 100) / 100, 195); // 100 x 1.80 + 30 x 0.50
  assert.deepEqual([r.priced, r.unpriced], [2, 1]);
  assert.match(r.why, /1 never sold/);
});

test("the hub's rules: ESO/TSA only; automated tickets take their automation's value; a person's value is kept", async () => {
  const api = fake({ "/crm/v4/objects/tickets/1/associations": none });
  const ESO = { hs_pipeline: "1726599376" }, BO = { hs_pipeline: "1726786777" };
  const pc = { ...ESO, price_check_key: "100-701173|2026-10-19", price_check_articles: "1120036838 x 100 (DT); 1120075420 x 30 (DT)" };
  assert.equal((await decide(api, "1", pc, false, "2026-10-20")).patch, null); // the copy: left as it is
  const h = await decideHub(api, "1", pc, false, "2026-10-20", better());
  assert.deepEqual([h.rule, h.patch], ["pricecheck", { sales_potential_estimate: 195, sales_potential_source: "product_lookup", sales_potential_confidence: "high" }]);
  const reg = { ...ESO, subject: "New Registrant | Mectron | Qualification needed", hs_tag_ids: "43412670" };
  assert.deepEqual((await decideHub(api, "1", reg, false, "2026-10-20", better(420))).patch, { sales_potential_estimate: 420, sales_potential_source: "company_baseline", sales_potential_confidence: "low" });
  const lost = { ...ESO, subject: "Lost Lead | Push for First Purchase | Agilent Technologies", sales_potential_estimate: "166.67", sales_potential_source: "company_baseline", sales_potential_confidence: "low" };
  const l = await decideHub(api, "1", lost, false, "2026-10-20", better(420));
  assert.deepEqual([l.rule, l.patch?.sales_potential_estimate], ["lostlead", 420]);
  const ero = { ...ESO, erosion_key: "k", erosion_amount_2025: "3388", sales_potential_estimate: "3388", sales_potential_source: "direct_field", sales_potential_confidence: "high" };
  const e = await decideHub(api, "1", ero, false, "2026-10-20", better());
  assert.deepEqual([e.rule, e.patch], ["erosion", null]); // already right: nothing written
  const bo = await decideHub(api, "1", { ...BO, order_potential_: "500" }, false, "2026-10-20", better());
  assert.deepEqual([bo.rule, bo.patch], ["not-eso-tsa", null]);
  // Back Office keeps its ticket rows in the KPI object, without a value (SARCLA 21.10: "keep counting them, no value")
  assert.ok(bo.kpi?.rows?.some((r) => r.name === "sales_funnel|live|tid1" && r.props.metric_value === 1 && r.props.dimension_pipeline === "BO"));
  const typed = await decideHub(api, "1", { ...ero, sales_potential_estimate: "5000" }, true, "2026-10-20", better());
  assert.deepEqual([typed.rule, typed.patch], ["manual", { sales_potential_source: "manual_override", sales_potential_confidence: "high" }]);
});

test("a second-purchase push takes the customer's own first order", async () => {
  const api = fake({
    "/crm/v4/objects/tickets/1/associations/companies": { results: [{ toObjectId: 55, associationTypes: [{ label: "Primary" }] }] },
    "/crm/v3/objects/companies/55": { properties: { order_first_order_date: "2026-06-24" } },
    "/crm/v3/objects/orders/search": { results: [{ properties: { hs_order_name: "A26.622888.001 | x", order_total_net_revenue: "117.52", order_order_status: "invoiced" } }] },
  });
  const d = await decideHub(api, "1", { hs_pipeline: "1726599377", subject: "Push for Second Purchase | META SARL" }, false, "2026-10-20", better());
  assert.deepEqual([d.rule, d.patch], ["secondpurchase", { sales_potential_estimate: 117.52, sales_potential_source: "company_baseline", sales_potential_confidence: "medium" }]);
});

test("a customer's request goes down the path: its rule is named, a cart in the subject is the cart", async () => {
  const api = fake({ "/crm/v4/objects/tickets/1/associations": none });
  const cart = await decideHub(api, "1", { hs_pipeline: "1726599376", subject: "Abandoned Cart 2.247,20 €EUR | JB TEC sas" }, false, "2026-10-20", better());
  assert.deepEqual([cart.rule, cart.patch?.sales_potential_estimate, cart.patch?.sales_potential_confidence], ["cart", 2247.2, "high"]);
  const none0 = await decideHub(api, "1", { hs_pipeline: "1726599376", subject: "Frage" }, false, "2026-10-20", better());
  assert.deepEqual([none0.rule, none0.patch?.sales_potential_source], ["unknown", "unknown"]);
});

test("products at the price they sell for, every article added up - not the list price per 100", async () => {
  const routes = {
    "/crm/v4/objects/tickets/1/associations/tickets": none,
    "/crm/v4/objects/tickets/1/associations/companies": { results: [{ toObjectId: 55 }] },
    "/crm/v3/objects/companies/55": { properties: { mandant: "M100", yearly_customer_potential: "0" } },
    "/crm/v3/objects/2-200042439/search": { results: [{ properties: { sales_unit: "Stk", art_price__m100__listed_price: "180" } }] },
  };
  const p = { subject: "Anfrage", content: "1120036838: 100 Stück\n1120075420: 30 Stück" };
  const copy = await scoreTicket(fake(routes), "1", p);
  assert.equal(copy.value, 18000); // the copy: 100 x the list price per 100 (180)
  const hub = await scoreTicket(fake(routes), "1", p, better());
  assert.deepEqual([Math.round(hub.value), hub.source, hub.confidence], [195, "product_lookup", "medium"]);
});

test("the hub takes the primary company, the copy the first listed", async () => {
  const routes = {
    "/crm/v4/objects/tickets/1/associations/tickets": none,
    "/crm/v4/objects/tickets/1/associations/companies": { results: [{ toObjectId: 13582135237, associationTypes: [{ typeId: 339 }] }, { toObjectId: 399126815948, associationTypes: [{ label: "Primary", typeId: 339 }] }] },
    "/crm/v3/objects/companies/13582135237": { properties: { yearly_customer_potential: "272", tickets_count_last_12m: "3" } },
    "/crm/v3/objects/companies/399126815948": { properties: { yearly_customer_potential: "1200", tickets_count_last_12m: "10" } },
  };
  assert.equal((await scoreTicket(fake(routes), "1", { subject: "x" })).company?.id, "13582135237");
  const hub = await scoreTicket(fake(routes), "1", { subject: "x" }, better());
  assert.deepEqual([hub.company?.id, hub.value], ["399126815948", 12]);
});

test("the average first order: an order number once (.000 or its deliveries), credit notes out", () => {
  assert.equal(firstOrderValue([
    { name: "A26.622888.000 | x", net: 120, status: "entered" }, { name: "A26.622888.001 | x", net: 117.52, status: "invoiced" },
    { name: "A26.700000.001 | x", net: 30, status: "invoiced" }, { name: "A26.700000.002 | x", net: 20, status: "invoiced" },
    { name: "A26.700001.001 | x", net: 99, status: "credit_note" },
  ]), 170);
  assert.equal(firstOrderValue([]), null);
  assert.deepEqual(averageOf([100, null, 300, 0, 200]), { avg: 200, median: 200, n: 3 });
  const m = pricesOf([{ article: "a", revenueCy: 180, revenueLy: 0, qtyCy: 100, qtyLy: 0 }, { article: "b", revenueCy: 0, revenueLy: 0, qtyCy: 5, qtyLy: 0 }]);
  assert.deepEqual([...m], [["a", 1.8]]);
});

test("the figures count the tickets the hub's own rules change", () => {
  const v = (e: string | null, s: string | null): Values => ({ sales_potential_estimate: e, sales_potential_source: s, sales_potential_confidence: "low" });
  const m = measure([
    { verdict: "agree" as const, pipeline: "ESO", trigger: "created" as const, enrols: true, hub: { branch: "pricecheck", final: v(null, null), better: { final: v("195", "product_lookup"), rule: "pricecheck" } }, workflow: { wrote: false, final: v(null, null) } },
    { verdict: "agree" as const, pipeline: "ESO", trigger: "created" as const, enrols: true, hub: { branch: "score", final: v("5", "company_baseline"), better: { final: v("5", "company_baseline"), rule: "company" } }, workflow: { wrote: true, final: v("5", "company_baseline") } },
  ]);
  assert.deepEqual([m.improved, m.improvedBy[0].branch, Math.round(m.valueBetter)], [1, "pricecheck", 200]);
  assert.deepEqual(m.byConfidence.map((x) => [x.confidence, x.n]).sort(), [["low", 2]]);
});

test("the KPI rows in full, as the workflow wrote them", () => {
  const k = kpiEvents("9", { createdate: "2026-10-20T08:00:00Z", sales_potential_estimate: "40", sales_potential_source: "company_baseline", sales_potential_confidence: "low", hs_pipeline_stage: "2338232556", hubspot_owner_id: "77" }, "ESO", "2026-10-20");
  const created = k.rows.find((r) => r.name === "sales_funnel|created|tid9")!;
  assert.deepEqual(created.props, { kpi_category: "sales_funnel", dimension_pipeline: "ESO", dimension_source: "company_baseline", dimension_confidence: "low", dimension_owner_id: "77", metric_name: "tickets_created_count", metric_value: 1, snapshot_date: "2026-10-20", name: "sales_funnel|created|tid9" });
  assert.equal(k.rows.find((r) => r.name === "sales_funnel|live|tid9")!.props.metric_value, 40);
  assert.equal(k.rows.find((r) => r.name === "sales_funnel|pot_created|tid9")!.props.metric_name, "potential_created_sum");
});

test("the figures: live tickets count as written, tickets from before the path was recorded are left out", () => {
  const v = (e: string | null, s: string | null, c = "low"): Values => ({ sales_potential_estimate: e, sales_potential_source: s, sales_potential_confidence: c });
  const base = { pipeline: "ESO", trigger: "created" as const, enrols: true, workflow: { wrote: false, final: v(null, null) } };
  const m = measure([
    { ...base, verdict: "live" as const, hub: { branch: "score", final: v(null, null), better: { final: v("100", "company_baseline"), rule: "company" } }, written: { changed: true } },
    { ...base, verdict: "live" as const, hub: { branch: "score", final: v("5", "direct_field", "high"), better: { final: v("5", "direct_field", "high"), rule: "direct" } }, written: { changed: false } },
    { ...base, verdict: "agree" as const, hub: { branch: "score", final: v("7", "unknown"), better: { final: v("7", "unknown") } } },
    { ...base, pipeline: "BO", verdict: "agree" as const, hub: { branch: "score", final: v("9", "company_baseline"), better: { final: v("9", "company_baseline"), rule: "not-eso-tsa" } } },
  ]);
  assert.deepEqual([m.live, m.written, m.earlier, m.valued, m.valueBetter, m.checked], [2, 1, 1, 2, 105, 2]);
  assert.deepEqual(m.byConfidence.map((x) => [x.confidence, x.n]).sort(), [["high", 1], ["low", 1]]);
});

test("a ticket's path, read from what is on it", () => {
  const t = (src: string | null, extra: Record<string, string> = {}, conf = "high") => pathOf({ sales_potential_source: src, sales_potential_confidence: conf, subject: "", ...extra });
  assert.equal(t(null), "none");
  assert.equal(t("manual_override"), "manual");
  assert.equal(t("unqualified"), "unqualified");
  assert.equal(t("direct_field", { erosion_key: "E1" }), "erosion");
  assert.equal(t("direct_field", { price_check_key: "P1" }), "pricecheck");
  assert.equal(t("direct_field", { subject: "Abandoned cart - 420 EUR" }), "cart");
  assert.equal(t("direct_field", { sept_push_target: "5000" }), "push");
  assert.equal(t("direct_field"), "direct");
  assert.equal(t("company_baseline", { hs_tag_ids: "1;43412670" }, "low"), "registrant");
  assert.equal(t("company_baseline", { subject: "Lost Lead - Muster AG" }, "low"), "lostlead");
  assert.equal(t("company_baseline", { subject: "Push for Second Purchase - Muster AG" }, "medium"), "secondpurchase");
  assert.equal(t("company_baseline", {}, "low"), "company");
  assert.equal(t("child_gqs"), "gqs");
  assert.equal(t("text_qty_price", {}, "medium"), "textqty");
  assert.equal(t("product_lookup", {}, "medium"), "product");
  assert.equal(t("unknown", {}, "low"), "unknown");
});

test("the days' figures: the days chosen, each pipeline, both added", () => {
  const b: DayBucket[] = [
    ["2026-09-30", "ESO", "direct", "high", 2, 100],
    ["2026-10-01", "ESO", "company", "low", 3, 30],
    ["2026-10-01", "TSA", "direct", "high", 1, 50],
    ["2026-10-24", "TSA", "none", "(none)", 4, 0],
  ];
  const oct = sumPeriod(b, "2026-10-01", "2026-10-24");
  assert.deepEqual(oct.ESO.total, { n: 3, value: 30 });
  assert.deepEqual(oct.TSA.byConf["(none)"], { n: 4, value: 0 });
  const both = pickPipe(oct, "both");
  assert.deepEqual(both.total, { n: 8, value: 80 });
  assert.deepEqual(both.byPath.direct, { n: 1, value: 50 });
  assert.deepEqual(pickPipe(sumPeriod(b, "2026-09-30", "2026-09-30"), "both").byPath, { direct: { n: 2, value: 100 } });
  assert.deepEqual(pickPipe(oct, "TSA").total, { n: 5, value: 50 });
});

test("the days' figures skip what is not a day's bucket (the months of an older answer)", () => {
  const old = [{ m: 9, pipe: "ESO", path: "direct", conf: "high", n: 2, value: 100 }] as unknown as DayBucket[];
  assert.deepEqual(pickPipe(sumPeriod(old, "2026-01-01", "2026-12-31"), "both").total, { n: 0, value: 0 });
});

test("a ticket's day is its day in Zurich", () => {
  assert.equal(zurichDay(Date.parse("2026-10-23T22:30:00Z")), "2026-10-24"); // 00:30 in Zurich (summer time)
  assert.equal(zurichDay(Date.parse("2026-12-31T23:30:00Z")), "2027-01-01"); // 00:30 in Zurich (winter time)
  assert.equal(zurichDay(Date.parse("2026-10-24T21:59:00Z")), "2026-10-24");
});
