import assert from "node:assert/strict";
import { test } from "node:test";
import { S2S_FIRST_STAGE, S2S_PIPELINE, channelsFor, goalsFor, missingRequired, nextRoadmapId, prefill, ticketProperties } from "../src/lib/reporting/scrollToSaleRules";

const o = (...v: string[]) => v.map((x) => ({ value: x, label: x }));
const OPTIONS = {
  hs_ticket_priority: [{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }],
  mkt_business_goal: o("Acquisition", "Retention", "Reactivation", "Visibility & Demand"),
  mkt_channel: o("SEA", "HubSpot", "LinkedIn", "Website", "Newsletter", "SEO/GEO"),
  mkt_implementation_country: o("All", "CH", "DE", "IT", "FR"),
  mkt_roadmap_year: o("2026", "2027"),
};

test("the next roadmap id of the year: the highest MKT26 number plus one, SARCLA-NN ids ignored", () => {
  assert.equal(nextRoadmapId(["MKT26-06", "MKT26-46", "SARCLA-26", null, "MKT25-90"], 2026), "MKT26-47");
  assert.equal(nextRoadmapId([], 2027), "MKT27-01");
});

test("a ticket from a Reach tile filtered on Germany: SEO, visibility, DE, the year, the next id, me", () => {
  const v = prefill(
    { page: "reach", tab: "Search (SEO)", kpiId: "R05", title: "Organic clicks", summary: "30,216 Jan-Sep, -28% vs last year", filters: { country: ["de"] }, href: "/reporting/marketing-kpis/reach?country=DE" },
    { options: OPTIONS, ownerId: "1694460619", teamId: "155178625", year: 2026, takenRoadmapIds: ["MKT26-46"] },
  );
  assert.equal(v.subject, "R05 Organic clicks - 30,216 Jan-Sep, -28% vs last year");
  assert.equal(v.mkt_channel, "SEO/GEO");
  assert.equal(v.mkt_business_goal, "Visibility & Demand");
  assert.equal(v.mkt_implementation_country, "DE");
  assert.equal(v.mkt_roadmap_year, "2026");
  assert.equal(v.mkt_roadmap_id, "MKT26-47");
  assert.equal(v.hs_pipeline_stage, S2S_FIRST_STAGE);
  assert.equal(v.hs_ticket_priority, "MEDIUM");
  assert.equal(v.hubspot_owner_id, "1694460619");
  assert.equal(v.hubspot_team_id, "155178625");
  assert.match(v.content, /reach\?country=DE/);
  assert.equal(v.mkt_kpis, "R05 Organic clicks: 30,216 Jan-Sep, -28% vs last year");
});

test("nothing invented: a country the property lacks gives All, a page with no channel leaves it empty", () => {
  const v = prefill({ page: "efficiency", title: "Cost per order", filters: { country: ["PL"] } }, { options: OPTIONS, year: 2026, takenRoadmapIds: [] });
  assert.equal(v.mkt_implementation_country, "All");
  assert.equal(v.mkt_channel, "");
  assert.equal(v.mkt_business_goal, "");
  assert.equal(v.hubspot_owner_id, undefined);
  assert.deepEqual(channelsFor("reach", "Ads (SEA)"), ["SEA"]);
  assert.deepEqual(goalsFor("retain"), ["Retention", "Reactivation"]);
});

test("a create sends the pipeline and only the filled fields; the required ones are named when missing", () => {
  assert.deepEqual(ticketProperties({ subject: "x", mkt_channel: "SEA;Website", mkt_agency: "", foo: "bar" }), { hs_pipeline: S2S_PIPELINE, subject: "x", mkt_channel: "SEA;Website", hs_pipeline_stage: S2S_FIRST_STAGE });
  assert.deepEqual(missingRequired({ subject: "x", hs_pipeline_stage: "1", hs_ticket_priority: "LOW", hubspot_owner_id: "1", mkt_business_goal: "Acquisition", mkt_channel: "SEA" }), ["Implementation country"]);
});
