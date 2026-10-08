import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BO, BO_REMIND, CUSTOMER_REPLIED, ESO, ESO_REDIR, MAIDA, NEW, PREFIX, TSA, TSA_OWNER, TSA_REDIR, absorbArticles, addOwners,
  articleCandidates, articleSearchValues, articlesFromCache, assocPlan, companyKey, createdMsIso, createdUtcMs, deputyDecision,
  deputyNote, deputyTarget, hasArticleType, hasDefaultType, isSystemSubject, isoDay, mentionsC2S, offerHit, oooWindow, orderRefs,
  positionArticles, pyCmp, pySlice, pyStrip, pyZfill, rememberMissing, stageIndex, userState, verdict, wantedOrderNumbers,
  wrongOwnerAction, wrongOwnerSearch, type FoundOrder, type OwnerInfo, type UserState,
} from "../src/lib/connectors/steps/ticketRules";

// Expected values below come from the Compass connector's Python (08.10.2026).

test("python strings: strip, slice and sort by code point, zfill keeps the sign", () => {
  assert.equal(pyStrip("\x1c a \x85"), "a"); // Python's whitespace includes \x1c and \x85
  assert.equal(pyStrip("﻿a"), "﻿a"); // ...but not the BOM, which JavaScript's trim() would eat
  assert.equal(pySlice("ab\u{1F600}cd", 3), "ab\u{1F600}");
  assert.deepEqual(["\u{1F600}", "￿", "a"].sort(pyCmp), ["a", "￿", "\u{1F600}"]);
  assert.equal(pyZfill("-12", 5), "-0012");
  assert.equal(pyZfill("123456789", 10), "0123456789");
});

/* ── wrong owners ── */

const who = new Map<string, OwnerInfo>([
  ["1", { name: "Anna Muster", primary: "Backoffice Team" }],
  ["2", { name: "Peter Keller", primary: "ESO" }],
  ["3", { name: "Lea Frei", primary: "TSA" }],
  ["4", { name: "Claudio Saraiva", primary: "TSA" }], // ROLE_OVERRIDE: ESO
  ["5", { name: "Marc Frech", primary: "ESO" }], // MULTI_ROLE: ESO + TSA
  ["6", { name: "Monika Zihlmann", primary: "ESO" }], // Management
  ["7", { name: "Tim Roth", primary: null }],
]);

test("wrong owners: the verdict per pipeline and role", () => {
  assert.deepEqual(verdict(ESO, "1", who), { pipe: BO, stage: BO_REMIND, owner: MAIDA, reason: "Anna Muster is Back Office; the ticket was open in the ESO pipeline" });
  assert.deepEqual(verdict(BO, "2", who), { pipe: ESO, stage: ESO_REDIR, owner: "2", reason: "Peter Keller is ESO; the ticket was open in the Back Office pipeline" });
  assert.deepEqual(verdict(ESO, "3", who)?.stage, TSA_REDIR);
  assert.equal(verdict(ESO, "4", who), null); // the override says ESO, the stale team says TSA
  assert.equal(verdict(TSA, "4", who)?.pipe, ESO);
  assert.equal(verdict(TSA, "5", who), null); // two roles
  assert.equal(verdict(BO, "5", who)?.pipe, ESO);
  assert.equal(verdict(BO, "6", who), null); // management is left alone
  assert.equal(verdict(BO, "7", who), null); // no team
  assert.equal(verdict(BO, "99", who), null); // deactivated / unknown
  assert.equal(verdict(BO, null, who), null);
});

const stages = stageIndex([
  { id: BO, stages: [{ id: BO_REMIND, label: "Remind", metadata: { ticketState: "OPEN" } }, { id: "b9", label: "Closed", metadata: { ticketState: "closed" } }] },
  { id: ESO, stages: [{ id: ESO_REDIR, label: "Redirected", metadata: {} }, { id: "e9", label: "Closed", metadata: { ticketState: "CLOSED" } }] },
  { id: TSA, stages: [{ id: TSA_REDIR, label: "Redirected", metadata: { ticketState: "OPEN" } }] },
]);
const NOW = "2026-10-08T10:00:00Z";

test("wrong owners: flag - moved to the owner's pipeline, renamed, the original kept", () => {
  const a = wrongOwnerAction({ subject: "Anfrage", hs_pipeline: BO, hs_pipeline_stage: BO_REMIND, hubspot_owner_id: "2" }, stages, who, NOW);
  assert.equal(a.kind, "flag");
  if (a.kind !== "flag") return;
  assert.deepEqual(a.props, {
    subject: PREFIX + "Anfrage", hs_pipeline: ESO, hs_pipeline_stage: ESO_REDIR, hubspot_owner_id: "2", wrong_owner_original_subject: "Anfrage",
    wrong_owner_flagged_at: NOW, wrong_owner_reason: "Peter Keller is ESO; the ticket was open in the Back Office pipeline", wrong_owner_owner_at_flag: "2",
  });
  const long = wrongOwnerAction({ subject: "\u{1F600}".repeat(600), hs_pipeline: BO, hs_pipeline_stage: BO_REMIND, hubspot_owner_id: "2" }, stages, who, NOW);
  assert.equal(long.kind === "flag" && [...long.props.subject].length, 500); // 500 characters, not UTF-16 units
});

test("wrong owners: campaigns, closed stages and other pipelines are left alone", () => {
  const t = (subject: string, stage = BO_REMIND, pipe = BO) => wrongOwnerAction({ subject, hs_pipeline: pipe, hs_pipeline_stage: stage, hubspot_owner_id: "2" }, stages, who, NOW).kind;
  assert.equal(t("MARC CH PUSH - call"), "campaign");
  assert.equal(t("HELPLİNE call"), "campaign"); // Python's re.I folds the Turkish I
  assert.equal(t("lost  lead"), "flag"); // two spaces: not the campaign
  assert.equal(t("Anfrage", "b9"), "none");
  assert.equal(t("Anfrage", "x", "999"), "none");
  assert.equal(t("Anfrage", "unknown-stage"), "flag"); // a stage it does not know is not closed
});

test("wrong owners: the title comes back once a human took it over or it closed - not before", () => {
  const flagged = { subject: PREFIX + "Anfrage", hs_pipeline: ESO, hs_pipeline_stage: ESO_REDIR, wrong_owner_flagged_at: "2026-10-01T00:00:00Z", wrong_owner_owner_at_flag: "2", wrong_owner_original_subject: "" };
  assert.equal(wrongOwnerAction({ ...flagged, hubspot_owner_id: "2" }, stages, who, NOW).kind, "none");
  const back = wrongOwnerAction({ ...flagged, hubspot_owner_id: "3" }, stages, who, NOW);
  assert.ok(back.kind === "restore" && back.why === "taken over" && back.props.subject === "Anfrage" && back.props.wrong_owner_flagged_at === "");
  const closed = wrongOwnerAction({ ...flagged, hubspot_owner_id: "2", hs_pipeline_stage: "e9", wrong_owner_original_subject: "Orig" }, stages, who, NOW);
  assert.ok(closed.kind === "restore" && closed.why === "closed" && closed.props.subject === "Orig");
});

test("wrong owners: the search reads open-or-flagged tickets, by id", () => {
  const s = wrongOwnerSearch(ESO, stages, "100", true) as { filterGroups: { filters: { propertyName: string; operator: string; values?: string[] }[] }[] };
  assert.equal(s.filterGroups.length, 2);
  assert.deepEqual(s.filterGroups[0].filters[2], { propertyName: "hs_pipeline_stage", operator: "NOT_IN", values: ["b9", "e9"] });
  assert.equal(s.filterGroups[1].filters[2].operator, "HAS_PROPERTY");
  assert.equal((wrongOwnerSearch(ESO, stages, "0", false) as { filterGroups: unknown[] }).filterGroups.length, 1);
});

test("wrong owners: name and primary team as the connector reads /owners", () => {
  const m = addOwners(new Map(), [
    { id: 1, firstName: " Diana", lastName: "Fehr ", teams: [{ name: "TSA" }, { name: "", primary: true }] },
    { id: 2, firstName: null, lastName: "Solo", teams: [{ name: "ESO", primary: false }, { name: "TSA", primary: 1 }] },
    { id: 3, firstName: "No", lastName: "Team", teams: null },
  ]);
  assert.deepEqual(m.get("1"), { name: "Diana Fehr", primary: "TSA" }); // an unnamed primary falls back to the first team
  assert.deepEqual(m.get("2"), { name: "Solo", primary: "TSA" });
  assert.deepEqual(m.get("3"), { name: "No Team", primary: null });
});

/* ── deputy ── */

const T0 = Date.UTC(2026, 9, 8, 12);
const DAY = 86_400_000;

test("deputy: the absence window holding now - the last one, a broken entry stops the scan", () => {
  const w = (s: unknown, e: unknown) => ({ startTimestamp: s, endTimestamp: e });
  assert.deepEqual(oooWindow(JSON.stringify([w(T0 - DAY, T0 + DAY)]), T0), [T0 - DAY, T0 + DAY]);
  assert.deepEqual(oooWindow(JSON.stringify([w(T0 - DAY, T0 + DAY), w(T0 - 2 * DAY, T0 + 2 * DAY)]), T0), [T0 - 2 * DAY, T0 + 2 * DAY]);
  assert.deepEqual(oooWindow(JSON.stringify([w(T0 - DAY, T0 + DAY), w("x", T0), w(T0 - 3 * DAY, T0 + DAY)]), T0), [T0 - DAY, T0 + DAY]);
  assert.equal(oooWindow(JSON.stringify([{ endTimestamp: T0 + DAY }]), T0), null); // no start: KeyError
  assert.equal(oooWindow(JSON.stringify([w(T0 - 9 * DAY, T0 - 8 * DAY)]), T0), null);
  for (const bad of ["", null, "null", "{}", "[{", '"abc"']) assert.equal(oooWindow(bad, T0), null);
});

const users = new Map<string, UserState>([
  ["10", userState("10", { hs_is_out_of_office: "true", ap_deputy_owner_id: "11", ap_deputy_2_owner_id: "12", hs_email: "a@x.ch", hs_out_of_office_hours: JSON.stringify([{ startTimestamp: T0 - DAY, endTimestamp: T0 + DAY }]) }, T0)],
  ["11", userState("11", { hs_is_out_of_office: "TRUE" }, T0)],
  ["12", userState("12", { hs_is_out_of_office: "false" }, T0)],
  ["20", userState("20", { hs_is_out_of_office: "true", ap_deputy_owner_id: "11" }, T0)],
  ["30", userState("30", { hs_is_out_of_office: "true", ap_deputy_owner_id: "12" }, T0)], // away, no window
]);
const get = (id: string) => users.get(id);

test("deputy: owner away -> deputy 1 -> deputy 2 -> (option) TSA; asks for the users it needs", () => {
  assert.deepEqual(deputyTarget("10", get, false), { to: "12", reason: "a@x.ch away -> D2" });
  assert.deepEqual(deputyTarget("20", get, false), { to: null, reason: "20 away, no usable deputy" });
  assert.deepEqual(deputyTarget("20", get, true), { to: TSA_OWNER, reason: "20 away -> TSA (no usable deputy)" });
  assert.deepEqual(deputyTarget("12", get, true), { to: null, reason: "" });
  assert.deepEqual(deputyTarget("40", get, false), { need: "40" });
  assert.deepEqual(deputyTarget("40", (id) => (id === "40" ? userState("40", { hs_is_out_of_office: "true", ap_deputy_owner_id: "41" }, T0) : undefined), false), { need: "41" });
});

test("deputy: customer tickets that arrived during the absence move; a reply goes back to New", () => {
  const iso = (ms: number) => new Date(ms).toISOString();
  const d = (p: Record<string, string | null>) => deputyDecision(p, get, false);
  assert.deepEqual(d({ hubspot_owner_id: "10", subject: "Anfrage", createdate: iso(T0 - 3_600_000), hs_pipeline_stage: CUSTOMER_REPLIED }), {
    kind: "move", to: "12", reason: "a@x.ch away -> D2", props: { hubspot_owner_id: "12", hs_pipeline_stage: NEW },
  });
  assert.deepEqual(d({ hubspot_owner_id: "10", subject: "Anfrage", createdate: iso(T0 - 2 * DAY), hs_pipeline_stage: NEW }), { kind: "before_window" });
  assert.deepEqual(d({ hubspot_owner_id: "10", subject: "  EROSION | 4711", createdate: iso(T0) }), { kind: "system" });
  assert.equal(isSystemSubject("erosion | lower"), false);
  // a createdate Python cannot read does not stop the move
  assert.equal((d({ hubspot_owner_id: "10", subject: "x", createdate: "yesterday", hs_pipeline_stage: NEW }) as { kind: string }).kind, "move");
  assert.deepEqual(d({ hubspot_owner_id: "", subject: "x" }), { kind: "none" });
});

test("deputy: DELIBERATE - away without an absence window is skipped, not every ticket moved", () => {
  assert.deepEqual(deputyDecision({ hubspot_owner_id: "30", subject: "Anfrage", createdate: "2020-01-01T00:00:00Z" }, get, false), { kind: "no_window" });
});

test("deputy: createdate through strptime, the note as HTML", () => {
  assert.equal(createdUtcMs("2026-10-08T12:34:56.789Z"), Date.UTC(2026, 9, 8, 12, 34, 56));
  assert.equal(createdUtcMs("2026-02-30T00:00:00Z"), null);
  assert.equal(createdUtcMs("0026-01-01T00:00:00"), -61346678400000); // year 26, not 1926 (Python's value)
  assert.equal(createdUtcMs(null), null);
  assert.equal(deputyNote("1", "2", "a away -> D1"), "DEPUTY REASSIGNMENT (connector sweep)<br><br>Original owner: 1 (out of office)<br>New owner: 2<br>a away -&gt; D1<br><br>-- SARCLA deputy sweep");
});

/* ── ticket associations ── */

test("assoc: order numbers - sorted, a delivery suffix only when it ends the number, Unicode word edges", () => {
  const s = "Auftrag A26.123456.001 und A26.123456, G25.654321.0012 ÄA24.111111 xA24.222222 A23.333333_ A22.444444.002";
  assert.deepEqual(orderRefs(s), [["A22.444444", ".002"], ["A26.123456", null], ["A26.123456", ".001"], ["G25.654321", null]]);
  assert.deepEqual(wantedOrderNumbers([["A26.123456", null], ["A26.123456", ".001"]]), ["A26.123456.000", "A26.123456.001", "A26.123456.002"]);
  assert.equal(orderRefs(Array.from({ length: 9 }, (_, i) => `A26.12345${i}`).join(" ")).length, 6);
});

test("assoc: 10-digit article candidates and the cut-to-size mention", () => {
  const s = "Art 1234567890, Nr.0123456789 12345678901 Art9999999999 ²1111111111 2222222222́ ３３３３３３３３３３";
  assert.deepEqual([...articleCandidates(s)].sort(pyCmp), ["0123456789", "1234567890", "2222222222", "３".repeat(10)]);
  const c2s: [string, boolean][] = [["cut\rto size", true], ["zuſchnitt", true], ["coupe\x1csur mesure", true], ["coupe﻿sur mesure", false],
    ["XC2S", false], ["c2s-Auftrag", true], ["ZUSCHNİTT", true], ["cut\nto size", false]];
  for (const [t, want] of c2s) assert.equal(mentionsC2S(t), want, JSON.stringify(t));
});

test("assoc: an order's articles - first 20 positions, a or article, NaN read like Python, a bad line drops all", () => {
  assert.deepEqual(positionArticles(JSON.stringify([{ a: " 1 " }, { a: "", article: "2" }, { a: 0, article: "3" }, { a: 4 }, { q: 1 }])), ["1", "2", "3", "4"]);
  assert.deepEqual(positionArticles('[{"a": "5", "r": NaN, "gm": Infinity}]'), ["5"]);
  assert.deepEqual(positionArticles(JSON.stringify(["x", { a: "1" }])), []);
  assert.deepEqual(positionArticles(JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ a: String(i) })))).length, 20);
  for (const bad of ['{"a": "1"}', "[{", '"abc"', null, "null"]) assert.deepEqual(positionArticles(bad), []);
});

test("assoc: P&P validation - padded and unpadded forms answer each other, misses remembered", () => {
  const cache = new Map<string, string | null>([["7777777777", "pp7"], ["8888888888", null]]);
  const { out, missing } = articlesFromCache(["123456789", "7777777777", "8888888888", "5555555555"], cache);
  assert.deepEqual([...out], [["7777777777", "pp7"]]);
  assert.deepEqual(articleSearchValues(missing), ["123456789", "0123456789", "5555555555"]);
  absorbArticles(missing, [{ id: "pp1", properties: { article_number: " 0123456789 " } }], cache, out);
  rememberMissing(missing, cache);
  assert.equal(out.get("123456789"), "pp1");
  assert.equal(cache.get("5555555555"), null);
});

test("assoc: what is written - empty fields only, the first 4 + 3 orders, the first 5 articles", () => {
  const o = (id: string): FoundOrder => ({ id, c2s: false, customer: "", mandant: "", arts: [] });
  const orders = new Map(["A26.000005.000", "A26.000001.000", "A26.000004.000", "A26.000003.000", "A26.000002.000"].map((n, i) => [n, o(`o${i}`)]));
  const arts = new Map(Array.from({ length: 7 }, (_, i) => [`100000000${i}`, `pp${i % 6}`]));
  const plan = assocPlan({ order_number: " ", articles_on_the_ticket: "x", c2s_ticket: "false" }, orders, arts,
    [["o9", "A26.9", true], ["o1", "A26.000001.000", false], ["o8", "A26.8", true], ["o7", "A26.7", true]], true);
  assert.deepEqual(plan.props, { order_number: "A26.000001.000", c2s_ticket: "true" });
  assert.deepEqual(plan.filled, ["order_number"]);
  assert.deepEqual(plan.orderIds, ["o1", "o4", "o3", "o2", "o9", "o8"]);
  assert.deepEqual(plan.ppIds, ["pp0", "pp1", "pp2", "pp3", "pp4"]);
  const long = assocPlan({}, new Map(), new Map(Array.from({ length: 30 }, (_, i) => [String(1_000_000_000 + i), "p"])), [], false);
  assert.equal(long.props.articles_on_the_ticket.length, 250);
});

test("assoc: the offer match - the article as is or zero-padded, converted from the ticket's day", () => {
  const o = (pos: unknown, date: string | null) => ({ id: "1", properties: { order_order_number: "A26.1.000", order_order_date: date, order_positions_json: JSON.stringify(pos), cuttosize_order: "true" } });
  assert.deepEqual(offerHit(o([{ a: "0123456789" }], "2026-10-08"), "123456789", "2026-10-08"), { id: "1", number: "A26.1.000", converted: true, c2s: true });
  assert.equal(offerHit(o([{ article: "", a: "123456789" }], "2026-10-07"), "123456789", "2026-10-08")?.converted, false);
  assert.equal(offerHit(o([{ a: "1" }], null), "2", "2026-10-08"), null);
  assert.equal(offerHit(o([{ a: 123456789 }], null), "123456789", "2026-10-08"), null); // Python raises here
  assert.deepEqual(companyKey(" 110-815906 "), ["110", "815906"]);
  assert.deepEqual(companyKey("120-77-1"), ["120", "77-1"]);
  assert.equal(companyKey("ABC"), null);
});

test("assoc: dates as Python reads them", () => {
  assert.equal(createdMsIso("2026-10-08T12:34:56.789Z"), 1791462896789);
  assert.equal(createdMsIso("2026-10-08T12:34:56.789+02:00"), 1791455696789);
  assert.equal(createdMsIso(""), 0);
  assert.throws(() => createdMsIso("yesterday"));
  assert.equal(isoDay("2026-10-08T00:00:00Z"), "2026-10-08");
  assert.equal(isoDay("20261008"), "2026-10-08");
  assert.equal(isoDay("2026-W41-3"), "2026-10-07");
  assert.equal(isoDay("2020W531"), "2020-12-28");
  assert.equal(isoDay("2026-1008"), null);
  assert.equal(isoDay("garbage"), null);
});

test("assoc: an existing link counts only with the right type", () => {
  assert.ok(hasDefaultType([{ category: "HUBSPOT_DEFINED", typeId: 1 }]));
  assert.ok(!hasDefaultType([{ category: "USER_DEFINED", typeId: 77 }]));
  assert.ok(hasArticleType([{ category: "USER_DEFINED", typeId: 152 }, { category: "USER_DEFINED", typeId: 154 }]));
  assert.ok(!hasArticleType([{ category: "USER_DEFINED", typeId: 152 }])); // the erosion label is not "Referenced article"
});
