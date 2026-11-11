// APSOconvert > Send to Content: a new project or one to add to, and its ticket (SARCLA 10.11.2026: "upon sending to
// content allow to create a new project or to associate to current one + the ticket").
import assert from "node:assert/strict";
import { test } from "node:test";
import { ticketNumber } from "../src/lib/convert/handoff";

test("a ticket's number is read from the number or from its HubSpot address", () => {
  assert.equal(ticketNumber("41235567890"), "41235567890");
  assert.equal(ticketNumber(" #  41235567890 "), "41235567890");
  assert.equal(ticketNumber("https://app-eu1.hubspot.com/contacts/144032158/record/0-5/41235567890"), "41235567890");
  assert.equal(ticketNumber("abc 123"), "");
  assert.equal(ticketNumber(""), "");
});
