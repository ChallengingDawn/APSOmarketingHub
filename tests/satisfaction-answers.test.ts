import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AN, NO_COMPANY, NO_CONTACT, NOT_KNOWN, NOT_LINKED, READING, addDays, byMonth, daysBetween, companiesOf, csatAnswers, isoOf, dayOf, labelOf, lastYearOf, monthsOf, npsAnswers,
  packAnswers, presetsOf, rangeWords, rowsOf, scrub, statsBy, yearBack, type FeedbackRow,
} from "../src/lib/satisfaction/answers";
import { csat, nps } from "../src/lib/satisfaction/rules";

const row = (p: Partial<FeedbackRow> & { id: string; day: number }): FeedbackRow => ({
  survey_name: "DE_CSAT_Order_Success_2403", form_guid: null, value: 2, sentiment: null, response_group: null, country: null, contact_id: "c1",
  contact_country: null, submission_url: null, comment: null, company_id: "900", company_name: "Muster AG", ...p,
});
// two years of answers: an order on the Swiss German store view, a French chat answer without a contact, an NPS e-mail,
// one whose contact has no company, one not linked yet, a TSA call with a comment carrying an e-mail address
const rows: FeedbackRow[] = [
  row({ id: "1", day: 20250310, submission_url: "https://www.apsoparts.com/de-CH/checkout/onepage/success/" }),
  row({ id: "2", day: 20250312, survey_name: "FR_CSAT_Live_Chat_2501", value: 0, contact_id: null, company_id: null, company_name: null, country: "France", comment: "trop lent" }),
  row({ id: "3", day: 20260305, submission_url: "https://www.apsoparts.com/de-CH/checkout/onepage/success/" }),
  row({ id: "4", day: 20260306, survey_name: "DE_CSAT_Live_Chat_2501", value: 1, contact_id: "c2", company_id: "", company_name: null, contact_country: "Germany" }),
  row({ id: "5", day: 20260401, survey_name: "FR_GENERAL_NPS_2602", value: 9, response_group: "promoter", contact_id: "c3", company_id: "901", company_name: "Beispiel GmbH", country: "Switzerland" }),
  row({ id: "6", day: 20260402, survey_name: "FR_GENERAL_NPS_2602", value: 3, contact_id: "c4", company_id: null, company_name: null }),
  row({ id: "7", day: 20260410, survey_name: "DE_CSAT_TSA_CALL_LUNA_2512", value: 2, comment: "Super, schreibt mir an max@muster.ch" }),
  row({ id: "8", day: 20231231, survey_name: "DE_CSAT_Order_Success_2403" }),
];
const d = packAnswers(rows, { today: 20261101, first: 20240101, asked: null, touchpoints: null, generatedAt: "2026-11-01T08:00:00Z", run: null });

test("every answer placed once: touchpoint, country, language, locale, reading - the days before the read left out", () => {
  assert.equal(d.answers.length, 7);
  const a1 = d.answers[0];
  assert.equal(a1[AN.day], 20250310);
  assert.equal(labelOf(d, a1, "touchpoint"), "Order success (shop)");
  assert.equal(labelOf(d, a1, "country"), "Switzerland");
  assert.equal(labelOf(d, a1, "language"), "German");
  assert.equal(labelOf(d, a1, "locale"), "de-CH");
  assert.equal(READING[a1[AN.reading]], "happy");
  const chat = d.answers[1];
  assert.equal(labelOf(d, chat, "country"), "France");
  assert.equal(labelOf(d, chat, "locale"), "fr-FR");
  assert.equal(READING[chat[AN.reading]], "unhappy");
  // the NPS answers apart from the CSAT - never a CSAT feeling
  assert.equal(READING[d.answers[4][AN.reading]], "promoter");
  assert.equal(READING[d.answers[5][AN.reading]], "detractor");
  // no country anywhere: Not known, a breakdown value like any other
  assert.equal(labelOf(d, d.answers[5], "country"), NOT_KNOWN);
});

test("an answer's company is its contact's - none without a contact, none when the contact has none, not linked yet until the job read it", () => {
  assert.equal(d.answers[0][AN.company], 0);
  assert.equal(d.companyIds[0], "900");
  assert.equal(d.companyNames[0], "Muster AG");
  assert.equal(d.answers[1][AN.company], NO_CONTACT);
  assert.equal(d.answers[3][AN.company], NO_COMPANY);
  assert.equal(d.answers[4][AN.company], 1);
  assert.equal(d.answers[5][AN.company], NOT_LINKED);
  // the same company, one place
  assert.equal(d.answers[6][AN.company], 0);
  assert.equal(d.companyIds.length, 2);
});

test("comments kept apart, e-mail addresses and phone numbers hidden", () => {
  assert.equal(d.comments.length, 2);
  assert.equal(d.comments[d.answers[1][AN.comment]], "trop lent");
  assert.equal(d.comments[d.answers[6][AN.comment]], "Super, schreibt mir an [e-mail]");
  assert.equal(d.answers[0][AN.comment], -1);
  assert.equal(scrub("ruf an +41 44 123 45 67"), "ruf an [phone]");
});

test("the chat page's own view: its touchpoints only", () => {
  const chats = packAnswers(rows, { today: 20261101, first: 20240101, asked: 20260101, touchpoints: ["chat", "shopchat"], generatedAt: "", run: null });
  assert.equal(chats.answers.length, 2);
  assert.deepEqual(chats.labels.touchpoint, ["Live chat (chat v2)"]);
});

test("a period, its filters and the same days a year earlier", () => {
  const ytd = presetsOf(20261101)[0];
  assert.deepEqual(ytd.win, { a: 20260101, b: 20261101 });
  const r = rowsOf(d, ytd.win, {});
  assert.equal(r.length, 5);
  const t = statsBy(r).get("")!.tally;
  assert.equal(t.answers, 5);
  assert.equal(csatAnswers(t), 3);
  assert.equal(npsAnswers(t), 2);
  assert.equal(csat(t), 2 / 3);
  assert.equal(nps(t), 0);
  // a filter by label; a filter's own list leaves its own filter out
  assert.equal(rowsOf(d, ytd.win, { touchpoint: ["NPS e-mail"] }).length, 2);
  assert.equal(rowsOf(d, ytd.win, { touchpoint: ["NPS e-mail"] }, "touchpoint").length, 5);
  assert.equal(rowsOf(d, ytd.win, { country: ["Switzerland"], touchpoint: ["NPS e-mail"] }).length, 1);
  // the year earlier: reached back to 2025, never before the read's first day
  assert.deepEqual(lastYearOf(d, ytd.win), { a: 20250101, b: 20251101 });
  assert.equal(statsBy(rowsOf(d, lastYearOf(d, ytd.win)!, {})).get("")!.tally.answers, 2);
  assert.equal(lastYearOf(d, { a: 20240301, b: 20240331 }), null);
  const by = statsBy(r, (x) => labelOf(d, x, "touchpoint"));
  assert.equal(by.get("Order success (shop)")!.tally.happy, 1);
  assert.equal(by.get("TSA call")!.comments, 1);
});

test("the companies behind answers: the most answers first, the answers without one by why", () => {
  const c = companiesOf(d.answers);
  assert.deepEqual(c.companies.map((x) => [d.companyNames[x.ci], x.s.tally.answers, x.last]), [["Muster AG", 3, 20260410], ["Beispiel GmbH", 1, 20260401]]);
  // its touchpoints counted: two orders and a TSA call
  assert.deepEqual([...c.companies[0].touchpoints].map(([i, n]) => [d.labels.touchpoint[i], n]), [["Order success (shop)", 2], ["TSA call", 1]]);
  assert.equal(c.companies[0].s.comments, 1);
  assert.equal(c.noContact, 1);
  assert.equal(c.noCompany, 1);
  assert.equal(c.notLinked, 1);
});

test("the days: a year back (29 February to the 28th), months, presets", () => {
  assert.equal(yearBack(20260315), 20250315);
  assert.equal(yearBack(20280229), 20270228);
  assert.equal(addDays(20251231, 1), 20260101);
  assert.equal(daysBetween(20261002, 20261101), 31);
  assert.equal(daysBetween(20260101, 20261231), 365);
  assert.equal(isoOf(20260305), "2026-03-05");
  assert.equal(dayOf("2026-03-05"), 20260305);
  assert.deepEqual(monthsOf(20251115, 20260210), [202511, 202512, 202601, 202602]);
  assert.equal(rangeWords(20260303, 20260517), "3 Mar – 17 May 2026");
  assert.equal(rangeWords(20251102, 20261101), "2 Nov 2025 – 1 Nov 2026");
  const p = presetsOf(20261101);
  assert.deepEqual(p.find((x) => x.id === "mtd")!.win, { a: 20261101, b: 20261101 });
  assert.deepEqual(p.find((x) => x.id === "lm")!.win, { a: 20261001, b: 20261031 });
  assert.deepEqual(p.find((x) => x.id === "l12")!.win, { a: 20251102, b: 20261101 });
  assert.deepEqual(p.find((x) => x.id === "ly")!.win, { a: 20250101, b: 20251231 });
  assert.equal(p.find((x) => x.id === "q4")!.label, "Q4 2026 to date");
  assert.deepEqual(p.find((x) => x.id === "q4")!.win, { a: 20261001, b: 20261101 });
  assert.equal(p.find((x) => x.id === "q1")!.label, "Q1 2026");
  // January: last month is December of the year before; a quarter to come is greyed
  const jan = presetsOf(20270115);
  assert.deepEqual(jan.find((x) => x.id === "lm")!.win, { a: 20261201, b: 20261231 });
  assert.equal(jan.find((x) => x.id === "q2")!.disabled, true);
  assert.deepEqual([...byMonth(d.answers).keys()], ["202503", "202603", "202604"]);
});
