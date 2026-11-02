import assert from "node:assert/strict";
import { test } from "node:test";
import { countryName, firstSegment, firstValue, moveOf, newFigures, newList, previousWindow, setByOf, sourceLabel, sourceOf, type NewCo, type NewDoc } from "../src/lib/segmentation/newCompanies";

test("the first segment is the HubSpot workflow's, word for word", () => {
  assert.equal(firstSegment({ domain: "gmail.com", numberofemployees: "250" }).segment, "APSOmicro");
  // the workflow's endsWith: a sub-domain of a free mail domain is one too
  assert.equal(firstSegment({ domain: "mail.bluewin.ch" }).segment, "APSOmicro");
  // ... but not a domain that only ends in the same letters
  assert.equal(firstSegment({ domain: "notgmail.com" }).segment, "APSOprospect");
  assert.equal(firstSegment({ domain: " GMX.CH " }).segment, "APSOmicro");
  assert.deepEqual(firstSegment({ domain: "acme.ch", numberofemployees: "5" }), { segment: "APSOmicro", why: "5 employees" });
  assert.equal(firstSegment({ domain: "acme.ch", numberofemployees: "6" }).segment, "APSOprospect");
  // no size known (0 or empty) is not micro
  assert.equal(firstSegment({ domain: "acme.ch", numberofemployees: "0" }).segment, "APSOprospect");
  assert.deepEqual(firstSegment({}), { segment: "APSOprospect", why: "a new company" });
});

test("who gave the first segment: the workflow's app, the hub's, a person, an import, anything else", () => {
  const hub = new Set(["50521064"]);
  const e = (sourceType: string, sourceId?: string) => ({ value: "APSOprospect", timestamp: "2026-11-01T10:00:00Z", sourceType, sourceId });
  assert.equal(setByOf(e("INTEGRATION", "26291976"), hub), "workflow");
  assert.equal(setByOf(e("INTEGRATION", "50521064"), hub), "hub");
  assert.equal(setByOf(e("INTEGRATION", "36826356"), hub), "scripts");
  assert.equal(setByOf(e("INTEGRATION", "41691680"), hub), "other");
  assert.equal(setByOf(e("DATASET", "105132819"), hub), "dataset");
  assert.equal(setByOf(e("CRM_UI", "userId:1"), hub), "person");
  assert.equal(setByOf(e("CRM_UI_BULK_ACTION"), hub), "person");
  assert.equal(setByOf(e("IMPORT"), hub), "import");
  assert.equal(setByOf(e("AUTOMATION_PLATFORM", "enrollmentId:1"), hub), "flow");
  assert.equal(setByOf(undefined, hub), "none");
  // the first value with a value, whatever order HubSpot gives the history in
  assert.equal(firstValue([
    { value: "APSOcore", timestamp: "2026-11-02T00:00:00Z" }, { value: "", timestamp: "2026-10-01T00:00:00Z" }, { value: "APSOprospect", timestamp: "2026-10-01T00:20:00Z" },
  ])?.value, "APSOprospect");
  assert.equal(firstValue([]), undefined);
});

test("where a company came from", () => {
  assert.deepEqual(sourceOf({ hs_object_source: "CRM_UI", hs_object_source_id: "userId:29117550" }), { src: "person", by: "29117550" });
  assert.deepEqual(sourceOf({ hs_object_source: "AUTOMATION_PLATFORM", hs_object_source_detail_1: "Associations | Contact - Companies" }), { src: "wf:Associations | Contact - Companies" });
  assert.deepEqual(sourceOf({ hs_object_source: "FORM", hs_object_source_detail_1: "3D Files Form" }), { src: "form:3D Files Form" });
  assert.deepEqual(sourceOf({ hs_object_source: "CHATSPOT" }), { src: "chatspot" });
  assert.deepEqual(sourceOf({}), { src: "unknown" });
  assert.equal(sourceLabel("person", "29117550", { "29117550": "Jan Kalt" }), "Jan Kalt");
  assert.equal(sourceLabel("person", "1", {}), "User 1");
  assert.equal(sourceLabel("wf:Associations | Contact - Companies", undefined, {}), "Workflow: Associations | Contact - Companies");
  // HubSpot holds "CH" beside "Switzerland"
  assert.deepEqual(["CH", "de", "GB", "Switzerland", "", "XX"].map(countryName), ["Switzerland", "Germany", "United Kingdom", "Switzerland", "No country", "XX"]);
});

const co = (id: string, d: string, more: Partial<NewCo> = {}): NewCo => ({
  id, n: `Company ${id}`, d, t: `${d}T08:00:00`, k: "Switzerland", src: "wf:Associations | Contact - Companies",
  f: "APSOprospect", fb: "workflow", fm: 20, s: "APSOprospect", p: "3", r: 0, o: "1", c: 1, dom: true, ...more,
});
const doc = (rows: NewCo[]): NewDoc => ({ at: "2026-11-02T08:00:00Z", since: "2024-11-01", rows, owners: { "1": "Jan Kalt" }, users: {}, hubApps: [] });

test("a period's figures: the new companies, what became of them, against the days before", () => {
  const d = doc([
    co("1", "2026-10-05"),
    co("2", "2026-10-20", { s: "APSOcore", r: 1200, p: "2" }),
    co("3", "2026-10-31", { f: "APSOmicro", s: "APSOmicro", fm: 500, src: "person", by: "7" }),
    co("4", "2026-10-31", { f: "", fb: "none", fm: null, s: "" }),
    co("5", "2026-09-15"),
    co("6", "2026-11-01"),
  ]);
  const f = newFigures(d, "2026-10-01", "2026-10-31");
  assert.equal(f.now.n, 4);
  assert.equal(f.before.n, 1);
  assert.equal(f.before.from, "2026-08-31");
  assert.deepEqual(f.now.seg, { APSOprospect: 1, APSOcore: 1, APSOmicro: 1, "No APSO segment": 1 });
  assert.deepEqual(f.now.who, { workflow: 3, none: 1 });
  assert.equal(f.now.fast, 2);
  assert.equal(f.now.changed, 1);
  assert.deepEqual([f.now.bought, f.now.revenue], [1, 1200]);
  assert.deepEqual(f.now.src, { "wf:Associations | Contact - Companies": 3, "person:7": 1 });
  assert.equal(f.now.moves["APSOprospect → APSOcore"], 1);
  assert.equal(f.now.moves["APSOprospect, as it came"], 1);
  assert.equal(f.byDay, true);
  assert.deepEqual(f.buckets.map((b) => [b.x, b.n]), [["2026-10-05", 1], ["2026-10-20", 1], ["2026-10-31", 2]]);
  // a year: month by month
  const y = newFigures(d, "2025-11-02", "2026-11-01");
  assert.equal(y.byDay, false);
  assert.deepEqual(y.buckets.map((b) => [b.x, b.n]), [["2026-09", 1], ["2026-10", 4], ["2026-11", 1]]);
  assert.deepEqual(previousWindow("2025-11-02", "2026-11-01"), { from: "2024-11-02", to: "2025-11-01" });
  assert.equal(moveOf({ f: "", s: "" }), "No APSO segment, as it came");
});

test("the companies behind a pick, newest first", () => {
  const d = doc([co("1", "2026-10-05"), co("2", "2026-10-20", { s: "APSOcore", r: 5 }), co("3", "2026-10-31", { src: "person", by: "7" }), co("4", "2026-09-01")]);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", {}).rows.map((x) => x.id), ["3", "2", "1"]);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", { move: "APSOprospect → APSOcore" }).rows.map((x) => x.id), ["2"]);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", { src: "person:7" }).rows.map((x) => x.id), ["3"]);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", { bought: true }).rows.map((x) => x.id), ["2"]);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", { bucket: "2026-10" }).total, 3);
  assert.deepEqual(newList(d, "2026-10-01", "2026-10-31", { q: "company 1" }).rows.map((x) => x.id), ["1"]);
  assert.equal(newList(d, "2026-10-01", "2026-10-31", {}, 2).total, 3);
});
