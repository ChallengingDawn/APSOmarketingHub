import assert from "node:assert/strict";
import { test } from "node:test";
import { eventFrom, isDay, isHubPath } from "../src/lib/content/calendarEventRules";

// Other apps on the Content calendar (08.11.2026): AI testing & personalization puts its page tests there.

const base = { source: "convert" as const, key: "test:12:start", kind: "test-start" as const, day: "2026-11-20", title: "Page test #12 starts: Dichtungstechnik", href: "/website/ai-personalization/tests/12" };

test("a real day only - no timestamp, no 31 November", () => {
  assert.equal(isDay("2026-11-20"), true);
  assert.equal(isDay("2028-02-29"), true);
  assert.equal(isDay("2026-11-31"), false);
  assert.equal(isDay("2026-11-20T00:00:00Z"), false);
  assert.equal(isDay(20261120), false);
});

test("links stay inside the hub", () => {
  assert.equal(isHubPath("/website/ai-personalization/tests/12"), true);
  assert.equal(isHubPath("//evil.example/x"), false);
  assert.equal(isHubPath("https://example.com"), false);
  assert.equal(isHubPath("/x\"onmouseover=1"), false);
});

test("an entry is checked and trimmed; a test id and a project id kept only when sound", () => {
  const ok = eventFrom({ ...base, title: "  Page test #12   starts  ", testId: "12", projectId: 7, env: "prod", path: "/de-CH/dichtungstechnik.html" });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.event.title, "Page test #12 starts");
    assert.equal(ok.event.testId, "12");
    assert.equal(ok.event.projectId, 7);
    assert.equal(ok.event.env, "prod");
  }
  const odd = eventFrom({ ...base, testId: "12; DROP", projectId: -3, env: "dev" as never, path: "dichtung" });
  assert.ok(odd.ok);
  if (odd.ok) { assert.equal(odd.event.testId, null); assert.equal(odd.event.projectId, null); assert.equal(odd.event.env, null); assert.equal(odd.event.path, null); }
});

test("refused: unknown kind or source, no key, bad day, outside link, no title", () => {
  assert.equal(eventFrom({ ...base, kind: "launch" as never }).ok, false);
  assert.equal(eventFrom({ ...base, source: "seo" as never }).ok, false);
  assert.equal(eventFrom({ ...base, key: " " }).ok, false);
  assert.equal(eventFrom({ ...base, day: "20.11.2026" }).ok, false);
  assert.equal(eventFrom({ ...base, href: "https://example.com" }).ok, false);
  assert.equal(eventFrom({ ...base, title: "   " }).ok, false);
});
