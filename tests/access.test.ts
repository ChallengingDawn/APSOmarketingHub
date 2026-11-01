import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectiveLevel, canOpen, canWrite, ceiling, mfaRequired, levelsFor, asRole, roleDefault,
  maySelfRegister, SELF_SIGNUP_ROLE, STARTER_GRANTS, appForPath, adminOnlyPath,
} from "../src/lib/auth/access";

// The two halves must stay apart: the role caps, the grant chooses.
test("an admin needs no grant", () => {
  assert.equal(effectiveLevel("admin", undefined), "write");
  assert.equal(effectiveLevel("admin", "none"), "write");
  assert.equal(canOpen("admin", undefined), true);
});

test("no grant means no access, for a user", () => {
  assert.equal(effectiveLevel("user", undefined), "none");
  assert.equal(canOpen("user", undefined), false);
  // An account created by mistake can see nothing until somebody grants it.
  assert.equal(effectiveLevel("user", "none"), "none");
});

test("a user's grant is honoured up to write - the viewer and the editor of before are both users (SARCLA 01.11.2026)", () => {
  assert.equal(effectiveLevel("user", "read"), "read");
  assert.equal(effectiveLevel("user", "write"), "write");
  assert.equal(canWrite("user", "read"), false);
  assert.equal(asRole("viewer"), "user");
  assert.equal(asRole("user"), "user");
  assert.equal(asRole("sales_leader"), "sales_leader");
  assert.equal(asRole(undefined), "user");
});

test("a sales leader views every app without a grant, loses what is taken, and edits only where given", () => {
  assert.equal(effectiveLevel("sales_leader", undefined), "read");
  assert.equal(effectiveLevel("sales_leader", "none"), "none");
  assert.equal(effectiveLevel("sales_leader", "write"), "write");
  assert.equal(roleDefault("sales_leader"), "read");
  assert.equal(roleDefault("user"), "none");
});

test("ceiling is the role's own limit", () => {
  assert.equal(ceiling("admin"), "write");
  assert.equal(ceiling("user"), "write");
  assert.equal(ceiling("sales_leader"), "read");
});

test("anyone who can change something carries a second factor, and a sales leader", () => {
  assert.equal(mfaRequired("admin"), true);
  assert.equal(mfaRequired("sales_leader"), true);
  // a user who only views may go without; one given Edit somewhere may not
  assert.equal(mfaRequired("user"), false);
  assert.equal(mfaRequired("user", false, true), true);
  // Unless an admin asked for it on that person.
  assert.equal(mfaRequired("user", true), true);
});

test("what each role is offered on an app or a sub-app", () => {
  assert.deepEqual(levelsFor("user", "uc").map((l) => l.value), ["none", "read", "write"]);
  // a sales leader: No access or View anywhere, Edit on Advanced reporting only (SARCLA 01.11.2026)
  assert.deepEqual(levelsFor("sales_leader", "reporting").map((l) => l.value), ["none", "read", "write"]);
  assert.deepEqual(levelsFor("sales_leader", "uc").map((l) => l.value), ["none", "read"]);
  assert.deepEqual(levelsFor("admin", "reporting"), []);
});

// SARCLA, 04.10.2026: these two domains may self-register, nobody else.
test("only the two company domains may self-register", () => {
  assert.equal(maySelfRegister("someone@apsoparts.com"), true);
  assert.equal(maySelfRegister("Someone@ANGST-PFISTER.COM"), true);
  assert.equal(maySelfRegister("someone@gmail.com"), false);
  // Not a suffix match: a lookalike domain must not slip through.
  assert.equal(maySelfRegister("someone@notapsoparts.com"), false);
  assert.equal(maySelfRegister("someone@apsoparts.com.evil.net"), false);
  assert.equal(maySelfRegister("not-an-address"), false);
  // It has to BE an address. Reading the domain off the last "@" on its own let
  // each of these make an account at one of our domains.
  assert.equal(maySelfRegister("someone@evil.com@apsoparts.com"), false);
  assert.equal(maySelfRegister("@apsoparts.com"), false);
  assert.equal(maySelfRegister("two words@apsoparts.com"), false);
  // A subdomain is somebody else's namespace, not ours.
  assert.equal(maySelfRegister("someone@mail.apsoparts.com"), false);
  // And the ordinary shapes still pass.
  assert.equal(maySelfRegister("first.last@apsoparts.com"), true);
  assert.equal(maySelfRegister("  first.last@angst-pfister.com  "), true);
});

test("a self-registered account starts as a user with nothing granted beyond the Datatracker", () => {
  assert.equal(SELF_SIGNUP_ROLE, "user");
  assert.equal(effectiveLevel(SELF_SIGNUP_ROLE, undefined), "none");
  assert.deepEqual(STARTER_GRANTS, { datatracker: "read" });
});

// A sub-page that belongs to no app is exactly how somebody walks around the
// guard, so every route under an app has to resolve to it.
test("appForPath puts every app route under its own app", () => {
  assert.equal(appForPath("/datatracker"), "datatracker");
  assert.equal(appForPath("/datatracker/anything"), "datatracker");
  assert.equal(appForPath("/website/overview"), "website");
  assert.equal(appForPath("/live"), "website");
  assert.equal(appForPath("/seo/quick-wins"), "marketing");
  assert.equal(appForPath("/geo/fix-queue"), "marketing");
  assert.equal(appForPath("/journey/funnels"), "journey");
  assert.equal(appForPath("/customers/visitors"), "journey");
  assert.equal(appForPath("/uc/price-checks"), "uc");
  assert.equal(appForPath("/uc/erosion"), "uc");
  // Advanced reporting holds one page so far, and that page is its own.
  assert.equal(appForPath("/reporting"), "reporting");
  assert.equal(appForPath("/connectors"), "connectors");
  assert.equal(appForPath("/connectors/compass"), "connectors");
  assert.equal(appForPath("/connectors/writes"), "connectors");
});

test("analytics splits by subject, longest prefix winning", () => {
  // Website questions
  assert.equal(appForPath("/analytics/tracking"), "website");
  assert.equal(appForPath("/analytics/consent"), "website");
  assert.equal(appForPath("/analytics/web-orders"), "website");
  // Journey questions
  assert.equal(appForPath("/analytics/smec"), "journey");
  assert.equal(appForPath("/analytics/buyers"), "journey");
  // Anything else under analytics falls to journey rather than to nothing
  assert.equal(appForPath("/analytics/something-new"), "journey");
});

// Named after the hub, but it draws the content calendar: it is the Marketing
// app's page, and a viewer with only the Datatracker must not be offered it.
test("mission control belongs to the app whose data it shows", () => {
  assert.equal(appForPath("/mission-control"), "marketing");
});

test("the hub's own pages belong to no app", () => {
  assert.equal(appForPath("/"), null);
  assert.equal(appForPath("/settings"), null);
  assert.equal(appForPath("/settings/people"), null);
  // A near-miss must not match: /website-ish is not /website
  assert.equal(appForPath("/websites"), null);
});

// A new account that can open nothing is an account that does nothing, so there
// is one app everybody starts with — and exactly one.
test("a new account starts on the Datatracker and nothing else", () => {
  assert.equal(STARTER_GRANTS.datatracker, "read");
  assert.deepEqual(Object.keys(STARTER_GRANTS), ["datatracker"]);
  // And the starting role can actually use it: a viewer reads.
  assert.equal(effectiveLevel(SELF_SIGNUP_ROLE, STARTER_GRANTS.datatracker), "read");
  assert.equal(canOpen(SELF_SIGNUP_ROLE, STARTER_GRANTS.website), false);
});

// Governance pages belong to no app, so the grants cannot speak for them. They
// were being offered in quick links and in search to people the page refuses.
test("the governance pages are an admin's, app or no app", () => {
  assert.equal(adminOnlyPath("/settings/people"), true);
  assert.equal(adminOnlyPath("/settings/integrations"), true);
  assert.equal(adminOnlyPath("/settings/audit"), true);
  assert.equal(adminOnlyPath("/audit"), true);
  assert.equal(adminOnlyPath("/settings/roles"), true);
  // Everybody's own corner of Settings is not one of them.
  assert.equal(adminOnlyPath("/settings"), false);
  assert.equal(adminOnlyPath("/settings/you"), false);
  assert.equal(adminOnlyPath("/settings/security"), false);
  assert.equal(adminOnlyPath("/docs"), false);
  // the action plan, an application of its own for admins only (SARCLA 01.11.2026)
  assert.equal(adminOnlyPath("/action-plan"), true);
  assert.equal(adminOnlyPath("/action-plan?item=12"), true);
  assert.equal(adminOnlyPath("/action-planner"), false);
  // A near-miss must not match.
  assert.equal(adminOnlyPath("/settings/people-ish"), false);
});
