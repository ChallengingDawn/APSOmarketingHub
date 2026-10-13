import assert from "node:assert/strict";
import { test } from "node:test";
import { pairTickets, type TicketRow } from "../src/lib/threeD/pair";

const sub = (at: string, email: string) => ({ at, name: "", email, company: "", articles: "" });
const tk = (id: string, at: string, channel = "Form"): TicketRow => ({ id, at, channel, stage: "Back Office › Resolved", closed: true });

test("a 3D form submission takes the form ticket its email raised within six hours", () => {
  const rows = [tk("t1", "2026-10-01T10:03:00Z"), tk("t2", "2026-10-01T18:00:00Z"), tk("t3", "2026-10-02T09:01:00Z", "Email")];
  const emailOf = new Map([["t1", "a@x.ch"], ["t2", "a@x.ch"], ["t3", "b@y.ch"]]);
  const out = pairTickets([sub("2026-10-01T10:00:00Z", "a@x.ch"), sub("2026-10-02T09:00:00Z", "b@y.ch")], rows, emailOf);
  assert.equal(out.find((s) => s.email === "a@x.ch")?.ticket?.id, "t1", "the ticket three minutes later");
  assert.equal(out.find((s) => s.email === "b@y.ch")?.ticket, null, "an email ticket is not a form's");
  assert.equal(out[0].at, "2026-10-02T09:00:00Z", "newest first");
});

test("two requests from one person take their own tickets, in order; a ticket eight hours later is not theirs", () => {
  const rows = [tk("t1", "2026-10-01T10:02:00Z"), tk("t2", "2026-10-01T11:05:00Z")];
  const emailOf = new Map([["t1", "a@x.ch"], ["t2", "a@x.ch"]]);
  const out = pairTickets([sub("2026-10-01T11:00:00Z", "a@x.ch"), sub("2026-10-01T10:00:00Z", "a@x.ch"), sub("2026-10-01T03:00:00Z", "a@x.ch")], rows, emailOf);
  assert.deepEqual(out.map((s) => s.ticket?.id ?? null), ["t2", "t1", null]);
});
