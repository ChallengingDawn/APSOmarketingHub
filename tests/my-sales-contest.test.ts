import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTEST, NOT_ESO, NO_TEAM, actionDay, addAction, beforeOrder, byPerson, byTeam, companyProps, headline, intakeOf, noActions, nothingYet, onlyActionMissing, orderBound, standingOf, started,
  type ContestCompany, type ContestData,
} from "../src/lib/reporting/contestRules";

// Diana Fehr 06.11.2026: a contest of order intake from customers with "no revenue orders or order intake before 5th of
// october", only those with "a recorded sales action on HubSpot - can be a call, an email, a customer visit".

test("a company is read with its first order and every month Compass has, 2015 to this year", () => {
  const p = companyProps(2026);
  assert.ok(p.includes("order_first_order_date") && p.includes("first_order_date_fehdia") && p.includes("compass_first_order_year"));
  assert.ok(p.includes("oi_2015_jan") && p.includes("oi_2026_dec") && p.includes("rev_2015_pc_monthly") && p.includes("rev_2026_pc_monthly"));
  assert.ok(!p.includes("oi_2027_jan"));
});

test("a new customer: Compass's first order on or after 5 October, nothing before it", () => {
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-05", oi_2026_oct: "120.5" }), { day: "2026-10-05", from: "compass" });
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-04" }), { out: "First order before 5 October" });
  // Compass decides: an earlier shop date does not take the company out
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-12", first_order_date_fehdia: "2021-10-22" }), { day: "2026-10-12", from: "compass" });
});

test("any Compass order intake or revenue before October, in any year, or an older first order year, takes a company out", () => {
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-20", oi_2026_sep: "40" }), { out: "Order intake before October" });
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-20", oi_2016_mar: "-12" }), { out: "Order intake before October" });
  assert.deepEqual(standingOf({ order_first_order_date: "2026-10-20", rev_2019_pc_monthly: '{"may": {"dt": 80.0}}' }), { out: "Revenue before October" });
  assert.deepEqual(standingOf({ order_first_order_date: "2026-11-01", compass_first_order_year: "2011.0" }), { out: "First order year before 2026" });
  // October's own revenue and order intake are the contest's
  assert.ok("day" in standingOf({ order_first_order_date: "2026-10-12", oi_2026_oct: "2.6", rev_2026_pc_monthly: '{"oct": {"dt": 2.6}}', oi_2026_sep: "0" }));
});

test("with no Compass day: the shop's first order, else a company created after the start - never a guess", () => {
  assert.deepEqual(standingOf({ first_order_date_fehdia: "2026-10-09", oi_2026_oct: "78" }), { day: "2026-10-09", from: "shop" });
  assert.deepEqual(standingOf({ first_order_date_fehdia: "2026-10-02", oi_2026_oct: "124" }), { out: "First order before 5 October" });
  assert.deepEqual(standingOf({ createdate: "2026-11-03T08:12:00Z", oi_2026_nov: "736" }), { day: null, from: "created" });
  // created before the 5th, no day: its October may hold the 1st to the 4th
  assert.deepEqual(standingOf({ createdate: "2026-09-30T10:00:00Z", oi_2026_oct: "71" }), { out: "Day of the first order not known" });
});

test("the order intake of the contest's months, from the company's monthly figures", () => {
  assert.deepEqual(intakeOf({ oi_2026_oct: "100.5", oi_2026_nov: "-20", oi_2026_dec: null }), [100.5, -20, 0]);
});

// Diana Fehr 06.11.2026: "the activity need to be logged by the ESO not backoffice for example"; "cold visits also count and
// generally hubspot meetings count"
const eso = (owner: string) => owner === "11";
const ownerOf = (email: string) => ({ "ann.example@apso.example": "11", "bob.example@apso.example": "22" } as Record<string, string>)[email] ?? null;
test("a sales action, logged by someone in ESO: a call, an e-mail sent, a meeting held, a completed visit - up to the contest's end", () => {
  assert.equal(actionDay("call", { hubspot_owner_id: "11", hs_timestamp: "2026-07-14T09:00:00Z" }, eso), "2026-07-14");
  assert.equal(actionDay("call", { hs_timestamp: "2026-10-14T09:00:00Z" }, eso), null);
  assert.equal(actionDay("email", { hubspot_owner_id: "11", hs_email_direction: "EMAIL", hs_email_from_email: "Ann.Example@apso.example", hs_timestamp: "2026-10-01T09:00:00Z" }, eso, CONTEST.end, ownerOf), "2026-10-01");
  assert.equal(actionDay("email", { hubspot_owner_id: "11", hs_email_direction: "INCOMING_EMAIL", hs_email_from_email: "ann.example@apso.example", hs_timestamp: "2026-10-01T09:00:00Z" }, eso, CONTEST.end, ownerOf), null);
  assert.equal(actionDay("email", { hs_email_direction: "EMAIL", hs_timestamp: "2026-10-01T09:00:00Z" }, eso), null);
  assert.equal(actionDay("visit", { hubspot_owner_id: "11", hs_pipeline_stage: "3972587738", meeting_date_with_time: "2026-10-20T13:00:00Z" }, eso), "2026-10-20");
  assert.equal(actionDay("visit", { hubspot_owner_id: "11", hs_pipeline_stage: "3968539843", meeting_date_with_time: "2026-10-20T13:00:00Z" }, eso), null);
  assert.equal(actionDay("call", { hubspot_owner_id: "11", hs_timestamp: "2027-01-04T09:00:00Z" }, eso), null);
  // a HubSpot meeting of any type, unless cancelled, missed or moved - and not one still to come
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_activity_type: "Cold Visit", hs_meeting_outcome: "COMPLETED", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), "2026-10-08");
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_meeting_outcome: "SCHEDULED", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), "2026-10-08");
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), "2026-10-08");
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_meeting_outcome: "CANCELED", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), null);
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_meeting_outcome: "NO_SHOW", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), null);
  assert.equal(actionDay("meeting", { hubspot_owner_id: "11", hs_meeting_outcome: "SCHEDULED", hs_timestamp: "2026-11-20T10:00:00Z" }, eso, "2026-11-06"), null);
  assert.equal(actionDay("meeting", { hubspot_owner_id: "22", hs_meeting_outcome: "COMPLETED", hs_timestamp: "2026-10-08T10:00:00Z" }, eso), null);
  // Back Office, TSA, anyone outside ESO: not a sales action of the contest
  assert.equal(actionDay("call", { hubspot_owner_id: "22", hs_timestamp: "2026-10-14T09:00:00Z" }, eso), null);
  assert.equal(actionDay("email", { hubspot_owner_id: "22", hs_email_direction: "EMAIL", hs_timestamp: "2026-10-01T09:00:00Z" }, eso), null);
  assert.equal(actionDay("visit", { hubspot_owner_id: "22", hs_pipeline_stage: "3972587738", meeting_date_with_time: "2026-10-20T13:00:00Z" }, eso), null);
  const a = noActions();
  addAction(a, "call", "2026-09-01"); addAction(a, "email", "2026-10-12"); addAction(a, "meeting", "2026-10-02"); addAction(a, "visit", "2026-10-03");
  assert.deepEqual(a, { calls: 1, emails: 1, meetings: 1, visits: 1, last: "2026-10-12" });
});

// Diana Fehr 09.11.2026: "the sales actions ... needs to be before OI date (order date) not after"
// 09.11.2026: "same day works too, if it was before the actual order" - the order dates carry no time
test("a sales action counts up to the company's first order - its own day too, never after", () => {
  const bound = orderBound({ day: "2026-10-20", intake: [100, 0, 0] });
  assert.equal(bound, "2026-10-20");
  assert.equal(beforeOrder("2026-10-19", bound), true);
  assert.equal(beforeOrder("2026-07-02", bound), true);
  assert.equal(beforeOrder("2026-10-20", bound), true);
  assert.equal(beforeOrder("2026-10-21", bound), false);
  // no first order date: before the month its order intake starts; no order at all: every sales action
  assert.equal(orderBound({ day: null, intake: [0, 736, 0] }), "2026-11-01");
  assert.equal(orderBound({ day: null, intake: [0, 0, 0] }), null);
  assert.equal(beforeOrder("2026-11-05", null), true);
});

test("October counts from the 5th, December from the 1st", () => {
  assert.equal(started("2026-10-04", 0), false);
  assert.equal(started("2026-10-05", 0), true);
  assert.equal(started("2026-11-06", 1), true);
  assert.equal(started("2026-11-06", 2), false);
  assert.equal(CONTEST.start, "2026-10-05");
});

const co = (id: string, person: number, intake: number[], acted: boolean): ContestCompany => {
  const actions = noActions();
  if (acted) addAction(actions, "call", "2026-10-10");
  return { id, name: `Company ${id}`, person, day: "2026-10-10", from: "compass", intake, actions };
};
const data: ContestData = {
  generatedAt: "2026-11-06T08:00:00.000Z", today: "2026-11-06",
  people: [
    { name: "Ann Example", ownerId: "1", team: "SARCLA TEAM", eso: true },
    { name: "Ben Example", ownerId: "2", team: "FALU TEAM", eso: true },
    { name: "Cy Example", ownerId: "3", team: NO_TEAM, eso: true },
    { name: "TSA Team", ownerId: null, team: NO_TEAM, eso: false },
  ],
  teams: ["RABE TEAM", "SARCLA TEAM", "FALU TEAM"],
  companies: [
    co("10", 0, [100, 50, 0], true),
    co("11", 0, [30, 0, 0], true),
    co("12", 0, [999, 0, 0], false), // no sales action: not in the contest
    co("13", 1, [0, 200, 0], true),
    co("14", 2, [10, 0, 0], true),
    co("15", 3, [40, 0, 0], true),
    co("16", 1, [0, 0, 0], true), // a sales action, no order intake yet
  ],
  left: { "Revenue before October": 2 }, read: 9,
};

test("by ESO: only customers with a sales action, each person's customers that brought order intake", () => {
  const lines = byPerson(data);
  const ann = lines.find((l) => l.label === "Ann Example")!;
  assert.deepEqual([ann.customers, ann.intake, ann.total, ann.team], [2, [130, 50, 0], 180, "SARCLA TEAM"]);
  assert.equal(lines.find((l) => l.label === "Ben Example")!.customers, 1);
  assert.equal(lines.find((l) => l.label === "TSA Team")!.team, NOT_ESO);
});

test("by team: every line manager's team (none left out for an empty one), then no team, then not ESO", () => {
  const t = byTeam(data);
  assert.deepEqual(t.map((l) => [l.label, l.total, l.customers]), [
    ["RABE TEAM", 0, 0], ["SARCLA TEAM", 180, 2], ["FALU TEAM", 200, 1], [NO_TEAM, 10, 1], [NOT_ESO, 40, 1],
  ]);
});

test("outside the contest: those that order and miss only a sales action, those that miss both", () => {
  const out = [co("20", 0, [80, 0, 0], false), co("21", 0, [0, 0, 0], false), co("22", 0, [0, -5, 0], false), co("23", 0, [80, 0, 0], true)];
  assert.deepEqual(out.filter(onlyActionMissing).map((c) => c.id), ["20"]);
  assert.deepEqual(out.filter(nothingYet).map((c) => c.id), ["21", "22"]);
});

test("the figures on top as a funnel, the order intake adding up to the boards'", () => {
  const h = headline(data);
  assert.deepEqual(h, { fresh: 7, counted: 6, bringing: 5, esos: 3, intake: 430 });
  assert.equal(byTeam(data).reduce((a, l) => a + l.total, 0), h.intake);
});

// Diana Fehr 09.11.2026: "exclude all automated emails - only actual emails by esos count"
test("an e-mail counts only when someone in ESO sent it from their own address - not from a shared mailbox, whoever owns it", () => {
  const sent = (from: string | undefined, owner = "11") => actionDay("email", { hubspot_owner_id: owner, hs_email_direction: "EMAIL", hs_email_from_email: from, hs_timestamp: "2026-10-01T09:00:00Z" }, eso, CONTEST.end, ownerOf);
  assert.equal(sent("ann.example@apso.example"), "2026-10-01");
  // the sender decides: an ESO person's e-mail on a record a colleague owns counts, a colleague's on an ESO record does not
  assert.equal(sent("ann.example@apso.example", "22"), "2026-10-01");
  assert.equal(sent("bob.example@apso.example"), null);
  assert.equal(sent("support@apso.example"), null);
  assert.equal(sent("helpline@apso.example"), null);
  assert.equal(sent("info@news.apso.example"), null);
  assert.equal(sent(undefined), null);
});
