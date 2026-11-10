// THE A/B TESTS PLANNED IN THE PAGE BUILDER, AS WEBSITE > A/B TESTING LISTS THEM (Content v7, 10.11.2026). Pure: relative
// imports only - the server's read (./abPlannedRead.ts), the Website page and the tests share it.
//
// SARCLA 10.11.2026: "Should you update the A/B testing link?" - a test planned on a page in Content's Page builder (its
// A/B test row: which two run, the share, what decides) showed nowhere else. Website > A/B testing now lists them as
// "Pages": the page, its versions, the state, a link to the to-do; the Page builder's A/B row links there. Read-only on
// the Website side, and nothing runs live yet: the shop's gateway that would serve the versions is not deployed.

import { AB_AUDIENCE_LABEL, AB_GOAL_LABEL, lettersOf, mainView, pageDoc, sideName, viewName } from "./studio/kinds/page/model";

/** Where Website > A/B testing lists the pages planned in Content. */
export const AB_TESTING_HREF = "/website/ab-testing#pages";

const STATUS: Record<string, string> = { todo: "To do", writing: "Writing", review: "In review", changes: "Changes asked", approved: "Approved", live: "Live" };
const BASE: Record<string, string> = { prod: "https://www.apsoparts.com", acc: "https://acc.apsoparts.com" };

export type PlannedTest = {
  pieceId: number; projectId: number;
  /** the project's and the to-do's names */
  project: string; title: string;
  /** "/de-CH/privacy" - "" for a new page not on the shop yet */
  path: string; store: string; storeName: string; url: string | null; env: "prod" | "acc";
  /** every version the page has (A, B ...) and the two that run: "The page as it is" / "Version B" */
  versions: string[]; tested: string; against: string;
  /** "50% see version B · Add to cart decides · Every visitor" */
  plan: string;
  /** the to-do's own status ("In review") - and the test's: planned, not running (no gateway yet) */
  todo: string; state: "planned";
  owner: string | null; updatedAt: string;
  /** the to-do in Content */
  href: string;
};

export type PlannedRow = { pieceId: number; projectId: number; project: string | null; title: string | null; status: string | null; writer: string | null; language: string | null; updatedAt: string; doc: unknown };

/** One page to-do's planned test, or null when it has none switched on. */
export function plannedOf(r: PlannedRow): PlannedTest | null {
  const d = pageDoc(r.doc, r.language);
  const ab = d.abTest;
  if (!ab.enabled) return null;
  const store = mainView(d);
  const path = d.source === "new" ? "" : d.path;
  const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const env = d.env === "acc" ? "acc" : "prod";
  return {
    pieceId: r.pieceId, projectId: r.projectId, project: r.project ?? "", title: r.title ?? "",
    path, store, storeName: viewName(store), url: path ? `${BASE[env]}${path}` : null, env,
    versions: lettersOf(d), tested: sideName(ab.b), against: sideName(ab.a),
    plan: `${ab.split}% see ${low(sideName(ab.b))} · ${AB_GOAL_LABEL[ab.goal]} decides · ${AB_AUDIENCE_LABEL[ab.audience]}`,
    todo: STATUS[r.status ?? ""] ?? "To do", state: "planned",
    owner: r.writer, updatedAt: r.updatedAt,
    href: `/projects/${r.projectId}/pieces/${r.pieceId}`,
  };
}

/** The rows as the list shows them: planned tests only, the newest first. */
export function plannedList(rows: PlannedRow[]): PlannedTest[] {
  return rows.map(plannedOf).filter((x): x is PlannedTest => !!x).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
