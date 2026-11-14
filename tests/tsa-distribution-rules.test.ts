import assert from "node:assert/strict";
import { test } from "node:test";
import { FINANCE_LABEL, OUTBOUND_LABEL, STAGE, BO, TSA, arrival, decide, funnel, outcomeOf, pathOf, routes, wayIn, weekOf, type Ticket } from "../src/lib/tsaDistribution/rules";

const F = (o: Partial<Parameters<typeof decide>[0]>) => ({ stage: STAGE.new, before: [], subject: "Anfrage O-Ringe", sourceType: "EMAIL", outbound: false, ...o });

test("the workflow's trigger: New without a campaign word, or Customer replied never seen in TSA before", () => {
  assert.equal(routes(F({})), true);
  assert.equal(routes(F({ subject: "EROSION | Kunde" })), false);
  assert.equal(routes(F({ subject: "Survey results" })), false);
  assert.equal(routes(F({ stage: STAGE.customerReplied })), true);
  assert.equal(routes(F({ stage: STAGE.customerReplied, before: [STAGE.inProgress] })), false);
  assert.equal(routes(F({ stage: STAGE.waitingCustomer })), false);
});

test("the paths, with TSA NON QUALIFIED split", () => {
  assert.deepEqual(decide(F({})), { path: "helpline", subject: "HELPLINE | Anfrage O-Ringe |", owner: "1202569408", stage: STAGE.boRedirected });
  assert.equal(decide(F({ subject: "Lead Action: new request" })).path, "lead");
  const fin = decide(F({ subject: "2. Mahnung Rechnung 4711" }));
  assert.equal(fin.path, "finance");
  assert.equal(fin.resolution, FINANCE_LABEL);
  const out = decide(F({ sourceType: null, outbound: true }));
  assert.deepEqual([out.path, out.resolution, out.stage], ["outbound", OUTBOUND_LABEL, STAGE.closed]);
  assert.equal(decide(F({ sourceType: "FORM" })).path, "none");
});

test("what the workflow did, read from the subject", () => {
  assert.equal(pathOf("HELPLINE | x |"), "helpline");
  assert.equal(pathOf("AP LEAD | x |"), "lead");
  assert.equal(pathOf("TSA | MAIL FROM FINANCE | RESOLUTION : TSA NON QUALIFIED"), "finance");
  assert.equal(pathOf("TSA | MAIL TO CUSTOMER | RESOLUTION : TSA NON QUALIFIED"), "outbound");
  assert.equal(pathOf("Anfrage"), "none");
});

test("the funnel: way in, outcome, the old label split", () => {
  const T = (o: Partial<Ticket>): Ticket => ({ id: "1", created: "2026-11-10T10:00:00Z", subject: "", sourceType: null, outbound: false, objectSource: null, objectSourceDetail: null, pipeline: TSA, stage: STAGE.new, resolution: null, lead: false, ...o });
  const rows = [
    T({ subject: "HELPLINE | a |", pipeline: BO }),
    T({ subject: "TSA | MAIL TO CUSTOMER | RESOLUTION : TSA NON QUALIFIED", outbound: true, resolution: "TSA NON QUALIFIED", stage: STAGE.closed }),
    T({ subject: "TSA | MAIL FROM FINANCE | RESOLUTION : TSA NON QUALIFIED", sourceType: "EMAIL", resolution: "TSA NON QUALIFIED" }),
    T({ sourceType: "FORM", resolution: "Ordered", stage: STAGE.closed }),
    T({ objectSourceDetail: "SARCLA - Erosion tickets", stage: STAGE.waitingCustomer }),
  ];
  assert.deepEqual(rows.map(wayIn), ["Helpline e-mail", "Outbound - TSA call", "Finance reminder", "Web form", "Erosion"]);
  assert.deepEqual(rows.map(outcomeOf), ["Sent to the Back Office", "Not a request", "Not a request", "Ordered", "Open"]);
  const f = funnel(rows);
  assert.equal(f.total, 5);
  assert.deepEqual(f.nonQualified, { outbound: 1, finance: 1, other: 0 });
  assert.equal(weekOf("2026-11-12T10:00:00Z"), "2026-11-09");
  assert.equal(f.weeks.length, 1);
});

test("met where the routing takes it: a ticket from the Back Office that later reaches New", () => {
  const st = [{ value: "2338266325", timestamp: "2026-11-10T08:00:00Z" }, { value: STAGE.redirectedFromBo, timestamp: "2026-11-10T09:00:00Z" }, { value: STAGE.new, timestamp: "2026-11-10T10:00:00Z" }];
  const su = [{ value: "Anfrage", timestamp: "2026-11-10T08:00:00Z" }, { value: "Fwd: Anfrage", timestamp: "2026-11-10T09:30:00Z" }];
  const f = arrival(st, su, "EMAIL", false, { stage: STAGE.waitingCustomer, subject: "HELPLINE | Fwd: Anfrage |" });
  assert.deepEqual([f.stage, f.subject], [STAGE.new, "Fwd: Anfrage"]);
  assert.equal(decide(f).path, "helpline");
  // never in New: its first TSA stage, not routed
  const g = arrival([{ value: STAGE.waitingCustomer, timestamp: "2026-11-10T08:00:00Z" }], su, "EMAIL", false, { stage: STAGE.waitingCustomer, subject: "x" });
  assert.equal(decide(g).path, "none");
});
