// PAGE - THE A/B TEST'S STATE, AS THE STUDIO'S TOP BAR SAYS IT (Content v8, 10.11.2026). Pure: relative imports only
// (tests/studio-page-abstate.test.ts).
//
// SARCLA 10.11.2026 (point 6): "A/B testing should be on top header - if I click activate then I can set it on the last
// step". The page studio's bar carries a small "A/B test" control with the test's state:
//   Off       nothing planned - a click offers "Activate"
//   Planned   switched on here: its setup (which versions, the split, the goal, who) lives in the LAST STEP of the Build pane;
//             Website > A/B testing lists it under "Pages"
//   Running   a test of AI testing & personalization runs on this very page (its gateway took it - src/lib/convert/tests.ts)
// A click on a planned or running test opens the last step. A new page is not on the shop yet: it has no test to show.

import { AB_AUDIENCE_LABEL, AB_GOAL_LABEL, sideName, type PageDoc } from "./model";

export type AbState = "off" | "planned" | "running";
export const AB_STATE_LABEL: Record<AbState, string> = { off: "Off", planned: "Planned", running: "Running" };

/** A test of AI testing & personalization on the page: its id, name and whether it is paused. */
export type AbRunning = { id: string; name: string; paused: boolean } | null;

/** Does the page have an A/B test to show (a page of the shop, picked)? */
export const abApplies = (d: Pick<PageDoc, "source" | "path">): boolean => d.source !== "new" && !!d.path;

/** The test's state: running on the shop beats planned here; planned = switched on in the studio. */
export function abStateOf(d: Pick<PageDoc, "abTest">, running: AbRunning): AbState {
  if (running) return "running";
  return d.abTest.enabled ? "planned" : "off";
}

/** The bar's tooltip, one line: what runs against what, the share, what decides - or the test that runs. */
export function abLineOf(d: Pick<PageDoc, "abTest">, state: AbState, running: AbRunning): string {
  if (state === "running" && running) return `${running.paused ? "Paused" : "Running"} in AI testing & personalization: ${running.name}`;
  if (state === "off") return "No A/B test on this page";
  const ab = d.abTest;
  const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  return `${sideName(ab.b)} against ${low(sideName(ab.a))} · ${ab.split}% see ${low(sideName(ab.b))} · ${AB_GOAL_LABEL[ab.goal]} decides · ${AB_AUDIENCE_LABEL[ab.audience]}`;
}

/** "Activate": the test switched on as the studio plans one - the version open against the page as it is, its split,
 * goal and audience as they were (a test switched off and on again keeps them). On already: unchanged. */
export function activateAb<T extends Pick<PageDoc, "abTest" | "letter">>(d: T): T {
  if (d.abTest.enabled) return d;
  return { ...d, abTest: { ...d.abTest, enabled: true, a: "page", b: d.letter || "A" } };
}

/** The test of AI testing & personalization that runs on this page (its environment and address), if any. */
export function runningOn(tests: { id: string; name: string; status: string; env: string; pages: string[]; kind?: string }[], env: string, path: string): AbRunning {
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  const t = tests.find((x) => (x.status === "running" || x.status === "paused") && x.env === env && (x.kind ?? "test") === "test" && x.pages.some((p) => norm(p) === norm(path)));
  return t ? { id: t.id, name: t.name, paused: t.status === "paused" } : null;
}
