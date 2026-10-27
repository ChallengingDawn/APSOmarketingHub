import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STEERING, STEERING_TOPICS, cleanSteering, routeFor, todayRoute, topicSlug } from "../src/lib/chat/steeringRules";

const S = DEFAULT_STEERING;

test("the tabs are HubSpot's six real Enquiry Categories - no Others", () => {
  assert.deepEqual([...STEERING_TOPICS], ["Product Information", "Product Price", "Delivery", "Website Issue", "Invoicing & Accounting", "Order Cancellation"]);
  assert.deepEqual(Object.keys(S.topics).sort(), [...STEERING_TOPICS].sort());
  assert.equal(topicSlug("Invoicing & Accounting"), "invoicing-and-accounting");
});

test("SARCLA's mapping (27.10.2026): sales to TSA, the rest to the Back Office, sub-categories first", () => {
  assert.equal(routeFor(S, "Product Information", "Technical question on a product"), "tsa");
  assert.equal(routeFor(S, "Product Information", "3D Model request"), "bo");
  assert.equal(routeFor(S, "Product Information", "Conformities / Certificates", "Certificates on order"), "bo");
  // level 2 wins over level 1: a technical question on conformities is sales
  assert.equal(routeFor(S, "Product Information", "Conformities / Certificates", "Technical question on conformities"), "tsa");
  assert.equal(routeFor(S, "Product Price", "Request for quotation"), "tsa");
  assert.equal(routeFor(S, "Product Price", "Wrong price on my order"), "bo");
  assert.equal(routeFor(S, "Product Price", "Price is not visible", "Can't use C2S or QuickOrder"), "bo");
  assert.equal(routeFor(S, "Delivery", "Existing Order"), "bo");
  assert.equal(routeFor(S, "Delivery", "Pre Order"), "tsa");
  assert.equal(routeFor(S, "Delivery", null, "I have not yet placed an order"), "tsa");
  assert.equal(routeFor(S, "Website Issue", "Login Issue"), "bo");
  assert.equal(routeFor(S, "Website Issue", "Other Issue"), "ecom");
  assert.equal(routeFor(S, "Invoicing & Accounting", "Invoice not received"), "bo");
  assert.equal(routeFor(S, "Order Cancellation"), "bo");
  assert.equal(S.orderNumberToBo, true);
});

test("no topic = the AI keeps it: no request, Others, an unknown value", () => {
  assert.equal(routeFor(S, "No request"), null);
  assert.equal(routeFor(S, "Others"), null);
  assert.equal(routeFor(S, null), null);
});

test("today's route as the chat logs it", () => {
  assert.equal(todayRoute("back_office"), "bo");
  assert.equal(todayRoute("finance"), "bo");
  assert.equal(todayRoute("sales"), "tsa");
  assert.equal(todayRoute(null), "tsa");
});

const OPTIONS = Object.fromEntries(STEERING_TOPICS.map((t) => [t, { sub1: ["Pre Order", "Existing Order", "3D Model request", "Login Issue", "Other Issue", "Wrong price on my order", "Conformities / Certificates"], sub2: ["Technical question on conformities", "Can't use C2S or QuickOrder", "I have not yet placed an order"] }]));

test("a save is checked against HubSpot's options and keeps the live switches", () => {
  const prev = { ...S, live: { Delivery: true } };
  const next = cleanSteering({ orderNumberToBo: false, topics: { Delivery: { route: "tsa", subs: [{ level: 1, value: "Existing Order", route: "bo" }, { level: 1, value: "Existing Order", route: "tsa" }] } } }, OPTIONS, prev);
  assert.equal(next.version, prev.version + 1);
  assert.equal(next.orderNumberToBo, false);
  assert.equal(next.topics.Delivery.route, "tsa");
  assert.deepEqual(next.topics.Delivery.subs, [{ level: 1, value: "Existing Order", route: "bo" }]);   // no rule twice
  assert.deepEqual(next.topics["Product Price"], prev.topics["Product Price"]);                       // a topic not sent stays
  assert.deepEqual(next.live, { Delivery: true });                                                     // never switched live from here
  assert.throws(() => cleanSteering({ topics: { Delivery: { route: "tsa", subs: [{ level: 1, value: "Not in HubSpot", route: "bo" }] } } }, OPTIONS, prev), /not one of its sub-categories/);
  assert.throws(() => cleanSteering({ topics: { Delivery: { route: "others", subs: [] } } }, OPTIONS, prev), /pick TSA, Back Office or E-Commerce/);
});
