import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayCells, daysBetween, fixText, forecastTicketCount, isClosed, isWon, mapTicket, noteText, parseForecast,
  resolutionTally, resolutionText, scoreboard, teamFor, topReason, winRate, zurichDay,
  type ErosionTicket, type ForecastItem, type StageInfo,
} from "../src/lib/erosion/model";

const STAGES = new Map<string, StageInfo>([
  ["2338232556", { label: "New", pipeline: "ESO", closed: false }],
  ["900", { label: "Closed", pipeline: "ESO", closed: true }],
]);

function ticket(over: Partial<ErosionTicket>): ErosionTicket {
  return {
    id: "1", subject: "", created: "2026-09-01", closed: null, stage: "New", stageClosed: false, pipeline: "ESO",
    resolution: null, resolutionDetail: null, closingNote: null, team: "ESO", owner: "Jeremy Borey", priority: null,
    amount: 0, article: null, articleDescription: null, company: null, un: null, lastOrder: null, ...over,
  };
}

test("fixText repairs a double-encoded name and leaves everything else alone", () => {
  assert.equal(fixText("PrÃ¤zisions AG"), "Präzisions AG");
  // 'Ø' read as cp1252 is 'Ã' + U+02DC, which only cp1252 (not latin-1) maps back
  assert.equal(fixText("Ã˜-Ring"), "Ø-Ring");
  assert.equal(fixText("Müller AG"), "Müller AG");
  // a real 'Ã' that is not a broken sequence must survive untouched
  assert.equal(fixText("SÃO PAULO"), "SÃO PAULO");
  assert.equal(fixText(""), "");
});

test("noteText strips tags, collapses whitespace and cuts at 280", () => {
  assert.equal(noteText("<p>Customer  <b>bought</b>\n again</p>"), "Customer bought again");
  assert.equal(noteText(`<p>${"x".repeat(400)}</p>`).length, 280);
});

test("zurichDay takes the day in Zurich, not in UTC", () => {
  // 22:30 UTC on the 3rd is 00:30 on the 4th in Zurich (CEST)
  assert.equal(zurichDay("2026-10-03T22:30:00Z"), "2026-10-04");
  assert.equal(zurichDay("2026-10-03T21:30:00.000Z"), "2026-10-03");
  assert.equal(zurichDay("2026-10-04"), "2026-10-04");
  assert.equal(zurichDay(null), null);
  assert.equal(zurichDay("not a date"), null);
});

test("daysBetween counts whole days, across the October clock change too", () => {
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(daysBetween("2026-09-01", "2026-09-01"), 0);
});

test("teamFor: the roster decides, the pipeline only when the owner is on neither", () => {
  assert.equal(teamFor("29117550", "1726599377"), "ESO");   // Jeremy Borey sitting in the TSA pipeline
  assert.equal(teamFor("1229976026", "1726599376"), "TSA"); // Nancy Pielock sitting in the ESO pipeline
  assert.equal(teamFor("999", "1726599377"), "TSA");
  assert.equal(teamFor("999", "1726599376"), "ESO");
  assert.equal(teamFor("999", "123"), null);
  assert.equal(teamFor("", null), null);
});

test("mapTicket reads the portal's own resolution field and the live stage", () => {
  const t = mapTicket(
    {
      id: "42",
      properties: {
        subject: "EROSION | 2 articles | 1'234 EUR | PrÃ¤zisions AG",
        hs_pipeline: "1726599376", hs_pipeline_stage: "900", hubspot_owner_id: "29117550",
        createdate: "2026-09-01T06:00:00Z", closed_date: "2026-09-08T09:00:00Z",
        hs_resolution: "", ticket_resolution_eso: "No demand",
        more_information_about_the_ticket_resolution_eso: "bought elsewhere",
        erosion_amount_2025: "1234.5", erosion_company: "PrÃ¤zisions AG",
        erosion_article: "1120072140", erosion_customer_number: "100-123456",
      },
    },
    STAGES,
    new Map(),
  );
  assert.equal(t.stage, "Closed");
  assert.equal(t.stageClosed, true);
  assert.equal(t.closed, "2026-09-08");
  assert.equal(t.resolution, "No demand");
  assert.equal(t.resolutionDetail, "bought elsewhere");
  assert.equal(t.team, "ESO");
  assert.equal(t.owner, "Jeremy Borey");
  assert.equal(t.amount, 1234.5);
  assert.equal(t.company, "Präzisions AG");
  assert.equal(t.subject, "EROSION | 2 articles | 1'234 EUR | Präzisions AG");
  assert.equal(isClosed(t), true);
});

test("mapTicket names an off-roster owner from the owners list, else shows the id, else says so", () => {
  const props = (owner: string) => ({ id: "1", properties: { hubspot_owner_id: owner, hs_pipeline_stage: "2338232556", erosion_amount_2025: "x" } });
  assert.equal(mapTicket(props("555"), STAGES, new Map([["555", "Diana Fehr"]])).owner, "Diana Fehr");
  assert.equal(mapTicket(props("555"), STAGES, new Map()).owner, "555");
  assert.equal(mapTicket(props(""), STAGES, new Map()).owner, "(no owner)");
  // an unreadable amount is 0, never NaN
  assert.equal(mapTicket(props("555"), STAGES, new Map()).amount, 0);
  // an unknown stage id is shown as the id, and is not taken to be closed
  const odd = mapTicket({ id: "2", properties: { hs_pipeline_stage: "777" } }, STAGES, new Map());
  assert.equal(odd.stage, "777");
  assert.equal(odd.stageClosed, false);
});

test("resolutionText: a field beats a note, and a closed ticket with neither is flagged", () => {
  assert.deepEqual(resolutionText(ticket({ resolution: "No demand", resolutionDetail: "x", closed: "2026-09-02" })), { text: "No demand — x", missing: false });
  assert.deepEqual(resolutionText(ticket({ closingNote: "called, reorder in Nov", closed: "2026-09-02" })), { text: "called, reorder in Nov", missing: false });
  assert.deepEqual(resolutionText(ticket({ stageClosed: true })), { text: "Closed without a resolution", missing: true });
  assert.deepEqual(resolutionText(ticket({})), { text: "—", missing: false });
});

test("resolutionTally counts closed tickets only, largest first, with EUR and the win flag", () => {
  const tally = resolutionTally([
    ticket({ id: "a", closed: "2026-09-02", resolution: "No demand", amount: 10 }),
    ticket({ id: "b", closed: "2026-09-03", resolution: "No demand", amount: 5 }),
    ticket({ id: "c", closed: "2026-09-03" }),
    ticket({ id: "d", closed: "2026-09-04", closingNote: "n" }),
    ticket({ id: "e", closed: "2026-09-04", resolution: "Ordered", amount: 7 }),
    ticket({ id: "f", resolution: "Ordered" }),
  ]);
  assert.deepEqual(tally, [
    { label: "No demand", count: 2, eur: 15, recorded: true, won: false },
    { label: "No resolution", count: 1, eur: 0, recorded: false, won: false },
    { label: "Note only", count: 1, eur: 0, recorded: true, won: false },
    { label: "Ordered", count: 1, eur: 7, recorded: true, won: true },
  ]);
});

test("isWon: only the three order outcomes, and only once closed", () => {
  assert.equal(isWon(ticket({ closed: "2026-09-02", resolution: "Ordered" })), true);
  assert.equal(isWon(ticket({ closed: "2026-09-02", resolution: "One-shot order" })), true);
  assert.equal(isWon(ticket({ closed: "2026-09-02", resolution: "One-shot C2S order" })), true);
  // bought from Angst+Pfister, not APSOparts: not ours
  assert.equal(isWon(ticket({ closed: "2026-09-02", resolution: "Bought at AP" })), false);
  assert.equal(isWon(ticket({ closed: "2026-09-02", resolution: "No demand" })), false);
  // a resolution on a ticket that is still open is not yet a win
  assert.equal(isWon(ticket({ resolution: "Ordered" })), false);
});

test("scoreboard: team totals, wins, reasons, owner rows and days to close", () => {
  const b = scoreboard([
    ticket({ id: "a", team: "ESO", owner: "A", amount: 100, created: "2026-09-01", closed: "2026-09-05", resolution: "Ordered" }),
    ticket({ id: "b", team: "ESO", owner: "A", amount: 50 }),
    ticket({ id: "c", team: "TSA", owner: "B", amount: 30, stageClosed: true, resolution: "No demand" }),
    ticket({ id: "d", team: null, owner: "C", amount: 10 }),
  ]);
  assert.deepEqual(
    { ...b.teams.ESO },
    { n: 2, open: 1, closed: 1, won: 1, eur: 150, closedEur: 100, wonEur: 100, closeDays: [4], reasons: { Ordered: 1 } },
  );
  // closed by stage but with no closed date: counted closed, adds no duration
  assert.deepEqual(
    { ...b.teams.TSA },
    { n: 1, open: 0, closed: 1, won: 0, eur: 30, closedEur: 30, wonEur: 0, closeDays: [], reasons: { "No demand": 1 } },
  );
  // a ticket with no team is in its owner's row and in neither team
  assert.equal(b.owners.length, 3);
  assert.equal(b.owners.find((o) => o.owner === "C")?.team, null);
  assert.equal(winRate(b.teams.ESO), 1);
  assert.equal(winRate(b.owners.find((o) => o.owner === "C")!), null);
});

test("topReason: the most given outcome, ties broken alphabetically", () => {
  const b = scoreboard([
    ticket({ id: "a", owner: "A", closed: "2026-09-02", resolution: "No demand" }),
    ticket({ id: "b", owner: "A", closed: "2026-09-02", resolution: "Ordered" }),
    ticket({ id: "c", owner: "A", closed: "2026-09-02", resolution: "No demand" }),
    ticket({ id: "d", owner: "B", closed: "2026-09-02", resolution: "Price issue" }),
    ticket({ id: "e", owner: "B", closed: "2026-09-02", resolution: "MOQ issue" }),
    ticket({ id: "f", owner: "C" }),
  ]);
  const by = (o: string) => b.owners.find((r) => r.owner === o)!;
  assert.deepEqual(topReason(by("A")), { label: "No demand", count: 2 });
  assert.deepEqual(topReason(by("B")), { label: "MOQ issue", count: 1 });
  assert.equal(topReason(by("C")), null);
});

test("dayCells puts tickets on their day and merges one company's forecast entries on a day", () => {
  const items: ForecastItem[] = [
    { due: "2026-10-10", articles: ["1"], un: "100-1", company: "X", amount: 100, team: "ESO", owner: "A" },
    { due: "2026-10-10", articles: ["2", "3"], un: "100-1", company: "X", amount: 50, team: "ESO", owner: "A" },
    { due: "2026-10-10", articles: ["4"], un: "100-2", company: "Y", amount: 10, team: "TSA", owner: "B" },
  ];
  const cells = dayCells([ticket({ created: "2026-10-10" })], items);
  const c = cells.get("2026-10-10");
  assert.ok(c);
  assert.equal(c.created.length, 1);
  assert.equal(c.forecast.length, 2);
  assert.deepEqual(c.forecast[0].articles, ["1", "2", "3"]);
  assert.equal(c.forecast[0].amount, 150);
  assert.equal(c.forecastEur, 160);
  // the input is not mutated by the merge
  assert.deepEqual(items[0].articles, ["1"]);
  assert.equal(forecastTicketCount(items), 2);
});

test("parseForecast keeps good items, drops broken ones, and names the summary honestly", () => {
  const f = parseForecast({
    outlook: {
      generated: "2026-10-04", days: 88,
      items: [
        { due: "2026-10-12", article: "3 articles", articles: ["1", "2", "3"], un: "100-1", company: "PrÃ¤zisions AG", amount: 1500, team: "ESO", owner: "A" },
        { due: "2026-10-13", article: "9", un: "100-2", company: "Y", amount: "20", team: "-", owner: "B" },
        { due: "not a day", un: "100-3" },
        { due: "2026-10-14" },
        "junk",
      ],
    },
    summary: { watermark: "2026-08-21", last_run: "2026-10-04", tickets_created_total: 812, created_today: 3, merged_today: 1 },
  });
  assert.equal(f.horizonDays, 88);
  assert.equal(f.items.length, 2);
  assert.deepEqual(f.items[0].articles, ["1", "2", "3"]);
  assert.equal(f.items[0].company, "Präzisions AG");
  assert.deepEqual(f.items[1].articles, ["9"]);
  assert.equal(f.items[1].amount, 20);
  assert.equal(f.items[1].team, null);
  assert.equal(f.summary?.articlesTicketed, 812);
  assert.equal(f.summary?.skippedOwnerToday, null);
  // nothing at all is an empty forecast, not a crash
  assert.deepEqual(parseForecast(null), { generated: null, horizonDays: 0, items: [], summary: null });
});
