import assert from "node:assert/strict";
import { test } from "node:test";
import { S2S_FIELDS, S2S_FIRST_STAGE, S2S_PIPELINE, aiFillSchema, channelsFor, cleanAiFill, learnPlaces, missingRequired, nextRoadmapId, prefill, ticketProperties, wordsOf, type AiForm, type PlacedTicket } from "../src/lib/reporting/scrollToSaleRules";

const o = (...v: string[]) => v.map((x) => ({ value: x, label: x }));
const OPTIONS = {
  hs_ticket_priority: [{ value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }],
  mkt_channel: o("SEA", "HubSpot", "LinkedIn", "Website", "Newsletter", "SEO/GEO"),
  mkt_implementation_country: o("All", "CH", "DE", "IT", "FR"),
  mkt_roadmap_year: o("2026", "2027"),
};

test("the next roadmap id of the year: the highest MKT26 number plus one, SARCLA-NN ids ignored", () => {
  assert.equal(nextRoadmapId(["MKT26-06", "MKT26-46", "SARCLA-26", null, "MKT25-90"], 2026), "MKT26-47");
  assert.equal(nextRoadmapId([], 2027), "MKT27-01");
});

test("a ticket from a Reach tile filtered on Germany: SEO, visibility, DE, the year, the next id, me - named by its action", () => {
  const v = prefill(
    { page: "reach", tab: "Search (SEO)", kpiId: "R05", title: "Organic clicks", summary: "30,216 Jan-Sep, -28% vs last year", filters: { country: ["de"] }, href: "/reporting/marketing-kpis/reach?country=DE" },
    { options: OPTIONS, ownerId: "1694460619", year: 2026, takenRoadmapIds: ["MKT26-46"] },
  );
  // the action names the ticket: empty until the task says what will be done (SARCLA 18.10)
  assert.equal(v.subject, "");
  assert.equal(v.mkt_channel, "SEO/GEO");
  assert.equal(v.mkt_implementation_country, "DE");
  assert.equal(v.mkt_roadmap_year, "2026");
  assert.equal(v.mkt_roadmap_id, "MKT26-47");
  assert.equal(v.hs_pipeline_stage, S2S_FIRST_STAGE);
  assert.equal(v.hs_ticket_priority, "MEDIUM");
  assert.equal(v.hubspot_owner_id, "1694460619");
  assert.equal(v.hubspot_team_id, undefined); // no team on the form (SARCLA 18.10)
  assert.match(v.content, /reach\?country=DE/);
  assert.equal(v.mkt_kpis, "R05 Organic clicks: 30,216 Jan-Sep, -28% vs last year");
});

test("nothing invented: a country the property lacks gives All, a page with no channel leaves it empty", () => {
  const v = prefill({ page: "efficiency", title: "Cost per order", filters: { country: ["PL"] } }, { options: OPTIONS, year: 2026, takenRoadmapIds: [] });
  assert.equal(v.mkt_implementation_country, "All");
  assert.equal(v.mkt_channel, "");
  assert.equal(v.hubspot_owner_id, undefined);
  assert.deepEqual(channelsFor("reach", "Ads (SEA)"), ["SEA"]);
});

test("a create sends the pipeline, the filled fields and the shared users; the required ones are named when missing", () => {
  assert.equal(ticketProperties({ subject: "Fix the meta descriptions" }, { hs_shared_user_ids: "62822791;49905443" }).hs_shared_user_ids, "62822791;49905443");
  assert.equal(ticketProperties({ subject: "x", hubspot_team_id: "155178625" }).hubspot_team_id, undefined);
  assert.deepEqual(ticketProperties({ subject: "x", mkt_channel: "SEA;Website", mkt_agency: "", foo: "bar" }), { hs_pipeline: S2S_PIPELINE, subject: "x", mkt_channel: "SEA;Website", hs_pipeline_stage: S2S_FIRST_STAGE });
  assert.deepEqual(missingRequired({ subject: "x", hs_pipeline_stage: "1", hs_ticket_priority: "LOW", hubspot_owner_id: "1", mkt_channel: "SEA" }), ["Implementation country"]);
});

// SARCLA 01.11.2026: "create with AI should be a button where you describe to the AI and the AI helps fill out the form"
const AI_FORM: AiForm = {
  fields: [
    { name: "subject", label: "Action", kind: "text", required: true },
    { name: "hs_ticket_priority", label: "Priority", kind: "select", options: OPTIONS.hs_ticket_priority },
    { name: "mkt_channel", label: "Marketing channel", kind: "multi", options: OPTIONS.mkt_channel },
    { name: "hubspot_owner_id", label: "Owner", kind: "owner" },
    { name: "hs_pipeline_stage", label: "Status", kind: "stage" },
    { name: "mkt_golive_date", label: "Go-live date", kind: "date" },
    { name: "mkt_kpis", label: "KPIs", kind: "textarea" },
  ],
  owners: [{ value: "11", label: "Ann Example" }, { value: "12", label: "Ben Example" }],
  stages: [{ value: "s1", label: "Idea box" }],
};

test("Create with AI: the answer's schema offers only the form's choices; no ticket where the action takes none", () => {
  const s = aiFillSchema(AI_FORM, true) as { properties: Record<string, { enum?: string[]; properties?: Record<string, { enum?: string[]; items?: { enum: string[] } }> }>; required: string[] };
  assert.deepEqual(s.required, ["title", "note", "due", "owner", "shared", "ticket", "values"]);
  assert.deepEqual(s.properties.owner.enum, ["", "11", "12"]);
  assert.deepEqual(s.properties.ticket.enum, ["none", "new"]);
  const v = s.properties.values.properties!;
  assert.equal("subject" in v, false); // the title names the ticket
  assert.deepEqual(v.hs_ticket_priority.enum, ["", "LOW", "MEDIUM", "HIGH"]);
  assert.deepEqual(v.mkt_channel.items!.enum, OPTIONS.mkt_channel.map((x) => x.value));
  assert.deepEqual(v.hubspot_owner_id.enum, ["", "11", "12"]);
  assert.deepEqual((aiFillSchema(AI_FORM, false) as { properties: { ticket: { enum: string[] } } }).properties.ticket.enum, ["none"]);
});

test("Create with AI: what the AI proposes is kept only where the form allows it", () => {
  const f = cleanAiFill({
    title: "  Launch   the DE campaign ", note: "Ask the agency first", due: "2026-02-30", owner: "11", shared: ["12", "99", "11"], ticket: "new",
    values: { hs_ticket_priority: "SUPER", mkt_channel: ["SEA", "Fax", "SEA"], hubspot_owner_id: "12", hs_pipeline_stage: "s1", mkt_golive_date: "2026-12-01", mkt_kpis: "Clicks", subject: "x" },
  }, AI_FORM, true);
  assert.deepEqual(f, {
    title: "Launch the DE campaign", note: "Ask the agency first", due: "", owner: "11", shared: ["12"], ticket: true,
    values: { mkt_channel: "SEA", hubspot_owner_id: "12", hs_pipeline_stage: "s1", mkt_golive_date: "2026-12-01", mkt_kpis: "Clicks" },
  });
  // no ticket where the action takes none; nonsense in, nothing out
  assert.equal(cleanAiFill({ ticket: "new" }, AI_FORM, false).ticket, false);
  assert.deepEqual(cleanAiFill(null, AI_FORM, true), { title: "", note: "", due: "", owner: "", shared: [], ticket: false, values: {} });
});

test("scroll to sale: no report link on the ticket form - nor sent with a ticket (SARCLA 02.11.2026: take it out completely)", () => {
  assert.equal(S2S_FIELDS.some((f) => f.name === "mkt_report_link"), false);
  assert.equal("mkt_report_link" in ticketProperties({ subject: "Run it", mkt_report_link: "https://example.com/r", mkt_status_note: "Briefed" }), false);
  assert.equal(ticketProperties({ subject: "Run it", mkt_status_note: "Briefed" }).mkt_status_note, "Briefed");
});

test("scroll to sale: no business goal on the form, in the prefill or sent (SARCLA 02.11.2026: take it out completely)", () => {
  assert.equal(S2S_FIELDS.some((f) => f.name === "mkt_business_goal"), false);
  assert.equal("mkt_business_goal" in prefill({ page: "reach", title: "Organic clicks" }, { options: { ...OPTIONS, mkt_business_goal: o("Visibility & Demand") }, year: 2026, takenRoadmapIds: [] }), false);
  assert.equal("mkt_business_goal" in ticketProperties({ subject: "Run it", mkt_business_goal: "Acquisition" }), false);
});

test("Scroll to Sale: a ticket's place learned from where the team placed the others", () => {
  assert.deepEqual(wordsOf("Campaigns & Newsletters for the Café, AI"), ["campaign", "newsletter", "cafe"]);
  const placed: PlacedTicket[] = [
    { subject: "Blog for APSOparts", owner: "A", channel: "", as: "sub", target: 10 },
    { subject: "Blog content plan", owner: "A", channel: "", as: "sub", target: 10 },
    { subject: "Christmas Holidays Announcement Campaigns", owner: "B", channel: "Newsletter", as: "sub", target: 20 },
    { subject: "Chemical Compatibility Newsletter Campaign", owner: "D", channel: "Newsletter", as: "sub", target: 20 },
    { subject: "German feed for Google", owner: "C", channel: "SEA", as: "sub", target: 30 },
    { subject: "Create End of Year Gift - Special Customers", owner: "D", channel: "", as: "action", target: 40 },
  ];
  const blog = learnPlaces({ subject: "Blog post on O-ring materials", owner: "A", channel: "" }, placed);
  assert.equal(blog[0].target, 10);
  assert.equal(blog[0].as, "sub");
  assert.ok(blog[0].like.includes("Blog for APSOparts"));
  assert.equal(learnPlaces({ subject: "Easter newsletter campaign", owner: "", channel: "Newsletter" }, placed)[0].target, 20);
  assert.equal(learnPlaces({ subject: "French feed for Google Shopping", owner: "", channel: "" }, placed)[0].target, 30);
  // an action of its own in a category, learned the same way
  assert.deepEqual(learnPlaces({ subject: "Gift for special customers", owner: "", channel: "" }, placed).map((x) => [x.as, x.target]), [["action", 40]]);
  // nothing in common: nothing proposed - the owner or channel alone never place a ticket
  assert.deepEqual(learnPlaces({ subject: "Totally unrelated words", owner: "A", channel: "Newsletter" }, placed), []);
  assert.deepEqual(learnPlaces({ subject: "Blog", owner: "", channel: "" }, []), []);
});
