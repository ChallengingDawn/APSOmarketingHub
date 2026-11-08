import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteSummary, mayDelete, mayRestore, restoredStatus } from "../src/lib/content/deleteRules";

const owner = { username: "anna.test", role: "user" };
const editor = { username: "marc.test", role: "user" };
const leader = { username: "lea.test", role: "sales_leader" };
const admin = { username: "claudio", role: "admin" };
const project = { createdBy: "anna.test" };

test("the owner deletes their project; an admin deletes any", () => {
  assert.equal(mayDelete(project, owner), true);
  assert.equal(mayDelete(project, admin), true);
  assert.equal(mayDelete({ createdBy: null }, admin), true, "an admin even deletes one nobody owns");
});

test("an editor, a commenter or a sales leader of the project does not delete it", () => {
  assert.equal(mayDelete(project, editor), false);
  assert.equal(mayDelete(project, leader), false);
  assert.equal(mayDelete({ createdBy: null }, editor), false, "no owner is not 'everybody's'");
  assert.equal(mayDelete({ createdBy: "" }, { username: "", role: "user" }), false, "an empty name matches nobody");
});

test("only an admin brings a deleted project back", () => {
  assert.equal(mayRestore(admin), true);
  assert.equal(mayRestore(owner), false, "not even its owner");
  assert.equal(mayRestore(leader), false);
});

test("brought back, a project takes back the status it had", () => {
  assert.equal(restoredStatus("decided"), "decided");
  assert.equal(restoredStatus("archived"), "archived", "an archived project comes back archived, not open");
  assert.equal(restoredStatus("open"), "open");
  assert.equal(restoredStatus(null), "open");
  assert.equal(restoredStatus("deleted"), "open", "anything unknown is open");
});

test("the confirm says what goes and that HubSpot tickets stay", () => {
  const s = deleteSummary({ todos: 3, documents: 2, tickets: 2, versions: 4 });
  assert.deepEqual(s.goes, ["its 3 to-dos", "what was made in their 2 studios (pages, posts, mails, banners, films)"]);
  assert.match(s.stays[0], /^its 2 HubSpot tickets - not touched, they stay as they are in HubSpot$/);
  assert.equal(s.stays[1], "4 versions kept in the Content Library");
});

test("one of each reads as one, and nothing to keep still says HubSpot is not touched", () => {
  const one = deleteSummary({ todos: 1, documents: 1, tickets: 1, versions: 1 });
  assert.deepEqual(one.goes, ["its 1 to-do", "what was made in its studio (pages, posts, mails, banners, films)"]);
  assert.equal(one.stays[0], "its 1 HubSpot ticket - not touched, it stays as it is in HubSpot");
  const none = deleteSummary({ todos: 0, documents: 0, tickets: 0, versions: 0 });
  assert.deepEqual(none.goes, ["the project itself (it has no to-do)"]);
  assert.deepEqual(none.stays, ["HubSpot - no ticket is touched"]);
});
