import assert from "node:assert/strict";
import { test } from "node:test";
import { ACT, CATEGORY, DEFAULT_PEOPLE, H, D, HEAD, STAGE, WORKFLOW_OFF_AT, excludesCertificates, merge, owed, phaseOf, stepsOf, subjectOf, swiss, type Facts } from "../src/lib/certificates/rules";

const base = (x: Partial<Facts>): Facts => ({
  id: "1", stage: STAGE.certificates, actions: null, actionsAt: null, actionsBy: "CRM_UI", actionsBefore: null,
  certs: ["FDA"], other: null, mandant: "M100", order: "A26.674500", due: "2026-11-09", company: "KL Locher Mechanik AG",
  owner: "30050251", requester: "76134337", expert: null, category: CATEGORY, createdAt: Date.parse("2026-11-04T12:00:00Z"),
  mergedAt: null, startedAt: null, subject: "CERTIFICATES | FDA | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |", ...x,
});
const names = (f: Facts) => (stepsOf(f)?.steps ?? []).map((s) => s.name);
/** the Remind workflow's chain, after the 3-days step */
const CHAIN = ["boToday", "bo48", "bo96", "boWeek", "boRose"];

test("Swiss time, as the workflow's: 07:00 and 05:00 in winter and summer", () => {
  assert.equal(new Date(swiss("2026-11-06", 7)).toISOString(), "2026-11-06T06:00:00.000Z");
  assert.equal(new Date(swiss("2026-11-05", 5)).toISOString(), "2026-11-05T04:00:00.000Z");
  assert.equal(new Date(swiss("2026-07-10", 7)).toISOString(), "2026-07-10T05:00:00.000Z");
  assert.equal(new Date(swiss("2026-11-09", 7, 0, -3)).toISOString(), "2026-11-06T06:00:00.000Z");
});

test("the subject as the workflow wrote it", () => {
  assert.equal(subjectOf(HEAD.std, base({ certs: ["EC 1935/2004", "FDA"] })), "CERTIFICATES | FDA, EC 1935/2004 | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |");
  assert.equal(subjectOf(HEAD.bo3days, base({ certs: ["OTHERS"], other: "Reach & Rohs" })), "⚠️ 3 days for delivery - create the certificate | OTHERS Reach & Rohs | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |");
});

test("a new request: EC 1935/2004 goes to AVOR with the requester, the rest to the Back Office rotation", () => {
  const avor = base({ stage: STAGE.new, certs: ["FDA", "EC 1935/2004"], createdAt: WORKFLOW_OFF_AT + H });
  assert.deepEqual(names(avor), ["start-avor"]);
  const m = merge(avor, owed(avor, new Set(), WORKFLOW_OFF_AT + 2 * H), () => "X", DEFAULT_PEOPLE);
  assert.deepEqual(m.props, { hs_pipeline_stage: STAGE.certificates, subject: "CERTIFICATES | FDA, EC 1935/2004 | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |", hubspot_owner_id: "76134337", actions_for_certificates: ACT.avor });
  const bo = base({ stage: STAGE.new, createdAt: WORKFLOW_OFF_AT + H });
  assert.deepEqual(merge(bo, owed(bo, new Set(), WORKFLOW_OFF_AT + 2 * H), () => "1229976030", DEFAULT_PEOPLE).props.hubspot_owner_id, "1229976030");
  // created while the workflow ran: it was the workflow's
  assert.deepEqual(owed(base({ stage: STAGE.new }), new Set(), Date.now()), []);
  // not a Certificates request, or no certificate named: not started
  assert.equal(phaseOf(base({ stage: STAGE.new, category: "Others" })), null);
  assert.equal(phaseOf(base({ stage: STAGE.new, certs: [] })), null);
});

test("AVOR: 48 h, 96 h, over a week, then 15 days to Rose with the note - the article moves it on", () => {
  const a = WORKFLOW_OFF_AT + H;
  const f = base({ actions: ACT.avor, actionsAt: a, actionsBy: "INTEGRATION" });
  const st = stepsOf(f)!.steps;
  assert.deepEqual(st.map((s) => [s.name, (s.at - a) / H]), [["avor48", 48], ["avor96", 96], ["avorWeek", 144], ["avorRose", 144 + 15 * 24]]);
  const rose = merge(f, [st[3]], () => null, DEFAULT_PEOPLE);
  assert.deepEqual(rose, { props: { hubspot_owner_id: "31935670" }, note: true, mail: null });
  assert.equal(phaseOf(base({ actions: ACT.article, actionsAt: a + 50 * H }))!.phase, "backOffice");
});

test("Back Office: rotation on Article received, then 3 days before delivery at 07:00 - or at once if past; no date, nothing", () => {
  const b = Date.parse("2026-11-04T23:00:00Z");
  const f = base({ actions: ACT.article, actionsAt: b });
  const st = stepsOf(f)!.steps;
  assert.deepEqual(st.map((s) => s.name), ["bo-entry", "bo3days", ...CHAIN]);
  assert.equal(new Date(st[1].at).toISOString(), "2026-11-06T06:00:00.000Z");
  assert.deepEqual(merge(f, [st[1]], () => null, DEFAULT_PEOPLE).props, { subject: "⚠️ 3 days for delivery - create the certificate | FDA | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |", hs_pipeline_stage: STAGE.remind });
  assert.equal(stepsOf(base({ actions: ACT.article, actionsAt: b, due: "2026-11-01" }))!.steps[1].at, b);
  assert.deepEqual(names(base({ actions: ACT.article, actionsAt: b, due: null })), ["bo-entry"]);
  // started by the process, no action: only the timer
  assert.deepEqual(names(base({ startedAt: Date.parse("2026-10-28T14:14:00Z"), due: "2026-12-02" })), ["bo3days", ...CHAIN]);
});

test("the expert: rotation and owner; delivery day 05:00; late 48 h after; 96 h; a week; 15 days to Rose", () => {
  const c = Date.parse("2026-11-02T12:40:00Z");
  const f = base({ actions: ACT.expert, actionsAt: c, due: "2026-11-05" });
  const st = stepsOf(f)!.steps;
  assert.deepEqual(st.map((s) => [s.name, new Date(s.at).toISOString()]), [
    ["expert-entry", "2026-11-02T12:40:00.000Z"], ["today", "2026-11-05T04:00:00.000Z"], ["late", "2026-11-07T04:00:00.000Z"],
    ["late96", "2026-11-09T04:00:00.000Z"], ["lateWeek", "2026-11-11T04:00:00.000Z"], ["lateRose", "2026-11-26T04:00:00.000Z"],
  ]);
  assert.deepEqual(merge(f, [st[0]], () => "1207485931", DEFAULT_PEOPLE).props, { hs_pipeline_stage: STAGE.certificates, conformity_expert: "1207485931", hubspot_owner_id: "1207485931" });
  // the date already past when assigned: late at once
  const late = stepsOf(base({ actions: ACT.expert, actionsAt: c, due: "2026-10-30" }))!.steps;
  assert.deepEqual(late.map((s) => s.name), ["expert-entry", "late", "late96", "lateWeek", "lateRose"]);
  assert.equal(late[1].at, c);
  // the workflow's steps before it was switched off are not done again; the 05:00 of 05.11 is the hub's
  assert.deepEqual(owed(f, new Set(), Date.parse("2026-11-05T04:01:00Z")).map((s) => s.name), ["today"]);
  // done once
  const done = new Set(owed(f, new Set(), Date.parse("2026-11-05T04:01:00Z")).map((s) => s.key));
  assert.deepEqual(owed(f, done, Date.parse("2026-11-05T05:00:00Z")), []);
});

test("Sent out after the expert: plain subject, Resolved - not when it was never with an expert", () => {
  const s = WORKFLOW_OFF_AT + D;
  const f = base({ actions: ACT.sent, actionsAt: s, actionsBefore: ACT.expert, stage: STAGE.remind });
  assert.deepEqual(merge(f, owed(f, new Set(), s + 1), () => null, DEFAULT_PEOPLE).props, { subject: "CERTIFICATES | FDA | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |", hs_pipeline_stage: STAGE.resolved });
  assert.equal(phaseOf(base({ actions: ACT.sent, actionsAt: s, actionsBefore: ACT.article })), null);
  assert.equal(phaseOf(base({ actions: ACT.sent, actionsAt: s, actionsBefore: ACT.expert, stage: STAGE.resolved })), null);
});

test("merged: the action emptied, then the 3-days step; an action set after the merge wins", () => {
  const m = WORKFLOW_OFF_AT + H;
  const f = base({ mergedAt: m, actions: ACT.article, actionsAt: m, actionsBy: "MERGE_OBJECTS", due: "2026-11-24" });
  assert.deepEqual(names(f), ["merge-clear", "bo3days", ...CHAIN]);
  assert.deepEqual(merge(f, [stepsOf(f)!.steps[0]], () => null, DEFAULT_PEOPLE).props, { actions_for_certificates: "" });
  // emptied: still the merged phase, the same keys - nothing twice
  const after = base({ mergedAt: m, actions: null, actionsAt: m + 60_000, actionsBy: "INTEGRATION", due: "2026-11-24", startedAt: m - D });
  assert.equal(stepsOf(after)!.steps[1].key, stepsOf(f)!.steps[1].key);
  assert.equal(phaseOf(base({ mergedAt: m, actions: ACT.expert, actionsAt: m + D }))!.phase, "expert");
});

test("rotations: two steps of one look take two people", () => {
  const f = base({ actions: ACT.article, actionsAt: WORKFLOW_OFF_AT + H, due: "2026-11-01" });
  let n = 0;
  const people = ["a", "b"];
  const m = merge(f, owed(f, new Set(), WORKFLOW_OFF_AT + 2 * H), () => people[n++ % 2], DEFAULT_PEOPLE);
  assert.equal(m.props.hubspot_owner_id, "a");
  assert.equal(m.props.hs_pipeline_stage, STAGE.remind, "the late 3-days step wins the stage");
});

test("the Back Office's reminders: on the delivery date and after - the Remind workflow's until the switch-over, then the hub's with a mail", () => {
  const b = Date.parse("2026-11-04T23:00:00Z");
  const f = base({ actions: ACT.article, actionsAt: b, due: "2026-11-09" });
  const st = stepsOf(f)!.steps;
  assert.deepEqual(st.filter((s) => s.remind).map((s) => [s.name, new Date(s.at).toISOString()]), [
    ["boToday", "2026-11-09T06:00:00.000Z"], ["bo48", "2026-11-11T06:00:00.000Z"], ["bo96", "2026-11-13T06:00:00.000Z"],
    ["boWeek", "2026-11-15T06:00:00.000Z"], ["boRose", "2026-11-30T06:00:00.000Z"],
  ]);
  const at = Date.parse("2026-11-09T06:01:00Z");
  // the Remind workflow still takes certificate tickets: the hub sets the 3 days and the stage, that workflow mails
  assert.deepEqual(owed(f, new Set(), at).map((s) => s.name), ["bo-entry", "bo3days"]);
  assert.equal(merge(f, owed(f, new Set(), at), () => "1229976030", DEFAULT_PEOPLE).mail, null);
  // switched over on the 5th: the chain is the hub's, with the mail
  const off = Date.parse("2026-11-05T10:00:00Z");
  const done = new Set(st.slice(0, 2).map((s) => s.key));
  const today = owed(f, done, at, WORKFLOW_OFF_AT, off);
  assert.deepEqual(today.map((s) => s.name), ["boToday"]);
  assert.deepEqual(merge(f, today, () => null, DEFAULT_PEOPLE, off), {
    props: { subject: "⚠️ CERTIFICATE DUE TODAY | FDA | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |" }, note: false, mail: "boToday",
  });
  assert.equal(merge(f, [st[1]], () => null, DEFAULT_PEOPLE, off).mail, "bo3days");
  // switched over later: what fell due before was still that workflow's
  assert.deepEqual(owed(f, done, at, WORKFLOW_OFF_AT, Date.parse("2026-11-10T00:00:00Z")), []);
  // 15 days after the week: Rose, the note, the week's subject, the mail to her
  const rose = st.find((s) => s.name === "boRose")!;
  assert.deepEqual(merge(f, [rose], () => null, DEFAULT_PEOPLE, off), {
    props: { hubspot_owner_id: "31935670", subject: "⚠️ CERTIFICATE DUE DATE IS MORE THAN ONE WEEK | FDA | M100 | A26.674500 | 09.11.26 | KL Locher Mechanik AG |" }, note: true, mail: "boRose",
  });
});

test("the article comes after the delivery date: the reminders fall together, one subject, one mail - the latest", () => {
  const b = Date.parse("2026-11-04T23:00:00Z");
  const f = base({ actions: ACT.article, actionsAt: b, due: "2026-11-01" });
  const due = owed(f, new Set(), b + 60_000, WORKFLOW_OFF_AT, WORKFLOW_OFF_AT);
  assert.deepEqual(due.map((s) => s.name), ["bo-entry", "bo3days", "boToday", "bo48"]);
  const m = merge(f, due, () => "30050251", DEFAULT_PEOPLE, WORKFLOW_OFF_AT);
  assert.equal(m.mail, "bo48");
  assert.equal(m.props.subject, "⚠️ CERTIFICATE DUE DATE WAS 48 HOURS AGO | FDA | M100 | A26.674500 | 01.11.26 | KL Locher Mechanik AG |");
  assert.equal(m.props.hs_pipeline_stage, STAGE.remind);
});

test("the expert never gets the Back Office's reminders", () => {
  const f = base({ actions: ACT.expert, actionsAt: Date.parse("2026-11-02T12:40:00Z"), due: "2026-11-05" });
  const st = stepsOf(f)!.steps;
  assert.ok(st.every((s) => !s.remind && !s.acts.some((a) => a.kind === "mail")));
  assert.equal(merge(f, st, () => "1207485931", DEFAULT_PEOPLE, WORKFLOW_OFF_AT).mail, null);
});

test("the switch-over: \"Which certificate is unknown\" in every branch of the Remind workflow's trigger", () => {
  const stage = { property: "hs_pipeline_stage", operation: { operator: "IS_ANY_OF" } };
  const unknown = { property: "which_certificate__", operation: { operator: "IS_UNKNOWN" } };
  // as it is today: OR of one AND (pipeline, stage)
  assert.equal(excludesCertificates({ filterBranchType: "OR", filters: [], filterBranches: [{ filterBranchType: "AND", filters: [stage] }] }), false);
  assert.equal(excludesCertificates({ filterBranchType: "OR", filters: [], filterBranches: [{ filterBranchType: "AND", filters: [stage, unknown] }] }), true);
  // a second branch without it still lets them in
  assert.equal(excludesCertificates({ filterBranchType: "OR", filters: [], filterBranches: [{ filterBranchType: "AND", filters: [stage, unknown] }, { filterBranchType: "AND", filters: [stage] }] }), false);
  assert.equal(excludesCertificates({ filterBranchType: "OR", filters: [], filterBranches: [{ filterBranchType: "AND", filters: [stage, { property: "which_certificate__", operation: { operator: "IS_KNOWN" } }] }] }), false);
  assert.equal(excludesCertificates(undefined), false);
});
