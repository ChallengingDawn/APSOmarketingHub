// APSOconvert > AN OPTIMIZATION'S TEST, IN ONE WORD (13.11.2026 - the loop as one product: "Sent to project" was the last
// thing Insights and the Preview ever said; the test made from it - by the hub, or by Content's Page builder for its
// to-do - and its result never came back). Pure: tests/convert-blocks.test.ts.

export type TestBrief = {
  id: string; status: "draft" | "running" | "paused" | "stopped" | "shipped"; winner: "a" | "b" | "none" | null; updatedAt: string;
};
export type TestState = { key: "planned" | "testing" | "paused" | "won" | "kept" | "flat" | "ended" | "published"; label: string; tint: "slate" | "blue" | "amber" | "green" | "pink" | "purple" };

export function testState(t: Pick<TestBrief, "status" | "winner">): TestState {
  if (t.status === "draft") return { key: "planned", label: "Test planned", tint: "slate" };
  if (t.status === "running") return { key: "testing", label: "Testing", tint: "blue" };
  if (t.status === "paused") return { key: "paused", label: "Test paused", tint: "amber" };
  if (t.status === "shipped") return { key: "published", label: "Won · published", tint: "green" };
  if (t.winner === "b") return { key: "won", label: "Won · to publish", tint: "green" };
  if (t.winner === "a") return { key: "kept", label: "Lost · the page kept", tint: "pink" };
  if (t.winner === "none") return { key: "flat", label: "No difference", tint: "slate" };
  return { key: "ended", label: "Test ended · not decided", tint: "amber" };
}

/** The test that speaks for an optimization: a live one first (running, paused), else the latest. */
export function leadTest<T extends TestBrief>(tests: T[]): T | null {
  const live = tests.filter((t) => t.status === "running" || t.status === "paused");
  const pool = live.length ? live : tests;
  return [...pool].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
