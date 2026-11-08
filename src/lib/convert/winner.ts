// APSOconvert > A TEST'S WINNER, PUBLISHED FROM CONTENT (SARCLA 08.11.2026: "Ship should not come from here; content
// publish should go to Content, where we should be able to visualise, even slightly edit with AI recommendations").
// APSOconvert finds, proposes, builds and tests; a winner is handed to Content Studio as a project (./handoff.ts, the
// marker carries the test) and Content's page studio shows it laid over the page, lets a person adjust it with the AI,
// and publishes it from there through these two functions (agreed with the Content studios session, 08.11.2026):
//   winnerFor(testId)          what Content shows: the tested change list, its version, the test's figures
//   publishFromContent({...})  the way out, picked by the page as Ship did: a CMS page into Magento (when the hub has
//                              its keys and every change finds its place in the page's content), else on for everyone
//                              through the shop's gateway, else the code for dotSource as a package
// A list changed after the test is kept as a new revision of the version marked "edited in Content", so the record
// says the page went out as it was not tested. The gate (the person's write access on Ship, Content's review) is
// Content's to check before it calls; ConvertError messages are shown as they are.

import { query } from "@/lib/db/client";
import { cmsKeys, cmsPlan, cmsWrite } from "./cms";
import { cmsTarget, cssBlock, description, jsSnippet, type ShipInfo } from "./ship";
import { versionById } from "./studio";
import { ConvertError, baseRateOf, gatewayState, ideaOf, markHanded, resultsOf, shipToEveryone, shippedAs, testById, type Test } from "./tests";
import { validateChanges, type Change } from "./versions";
import { calendarPublished } from "./calendar";

export type WinnerResult = { rateA: number | null; rateB: number | null; uplift: number | null; pB: number | null; visitors: number; days: number };
export type Winner = {
  testId: string; versionId: string | null; rev: number; summary: string; changes: Change[];
  result: WinnerResult | null; decidedBy: string | null; decidedAt: string | null;
  shipped: { id: string; status: string } | null;
  env: Test["env"]; path: string; pages: string[]; name: string;
};
export type Published = {
  ok: true; way: "everyone" | "cms" | "dotsource"; id?: string; edited: boolean;
  package?: { css: string; js: string; description: string };
};

async function testedChanges(testId: string): Promise<Change[]> {
  const r = await query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_tests WHERE id = $1`, [testId]);
  return r.rows[0]?.changes ?? [];
}

async function wonTest(testId: string): Promise<Test> {
  const t = await testById(testId);
  if (!t || t.kind !== "test") throw new ConvertError("No such test.", 404);
  if (t.winner !== "b") throw new ConvertError("This test has no winning version yet - it is decided in APSOconvert first.");
  return t;
}

async function resultOf(t: Test): Promise<WinnerResult | null> {
  const results = await resultsOf(t, { baseRate: await baseRateOf(t).catch(() => null) }).catch(() => null);
  const c = results?.analysis?.comparison ?? null;
  return c ? { rateA: c.a.rate, rateB: c.b.rate, uplift: c.uplift.mid, pB: c.pBest?.b ?? null, visitors: c.a.visitors + c.b.visitors, days: results!.analysis!.days } : null;
}

export async function winnerFor(testId: string): Promise<Winner> {
  const t = await wonTest(testId);
  const [changes, version, result, shipped] = await Promise.all([
    testedChanges(testId),
    t.versionId ? versionById(t.versionId).catch(() => null) : Promise.resolve(null),
    resultOf(t),
    shippedAs(testId).catch(() => null),
  ]);
  return {
    testId: t.id, versionId: t.versionId, rev: t.versionRev, summary: version?.summary ?? "", changes, result,
    decidedBy: t.decidedBy, decidedAt: t.decidedAt, shipped: shipped ? { id: shipped.id, status: shipped.status } : null,
    env: t.env, path: t.pages[0] ?? "", pages: t.pages, name: t.name,
  };
}

/** True when two change lists say the same (the order counts - a later change can depend on an earlier one). */
export function sameChanges(a: Change[], b: Change[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function publishFromContent(x: { testId: string; changes: unknown; by: string; pieceId: string }): Promise<Published> {
  const t = await wonTest(x.testId);
  const prev = await shippedAs(t.id).catch(() => null);
  if (prev && (prev.status === "running" || prev.status === "paused")) throw new ConvertError(`It is published already - on for everyone as #${prev.id}.`);
  const { changes, problems } = validateChanges(x.changes);
  if (problems.length) throw new ConvertError(`Some changes cannot be published: ${problems.slice(0, 3).join("; ")}`, 400);
  if (!changes.length) throw new ConvertError("No change to publish.", 400);
  const tested = await testedChanges(t.id);
  const edited = !sameChanges(changes, tested);
  if (edited && t.versionId) {
    // kept as a new revision of the version: published as it was NOT tested
    const r = await query<{ rev: number }>(`SELECT COALESCE(MAX(rev), 0) + 1 AS rev FROM apsomh_convert_revisions WHERE version_id = $1`, [t.versionId]);
    await query(
      `INSERT INTO apsomh_convert_revisions (version_id, rev, changes, summary, request, by_whom) VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [t.versionId, r.rows[0].rev, JSON.stringify(changes), `Edited in Content after test #${t.id} - published as it was not tested`, `edited in Content (piece ${x.pieceId})`, x.by],
    );
  }
  const path = t.pages[0];
  // a CMS page into Magento: when the hub has its keys and every change finds its place in the page's content
  const target = path ? cmsTarget(path) : null;
  if (target?.ok && cmsKeys()[t.env]) {
    const plan = await cmsPlan(t.id, t.env, path, null, changes);
    if (plan.canWrite && plan.chosen) {
      const w = await cmsWrite(t.id, t.env, path, plan.chosen, x.by, changes);
      await calendarPublished(t, "cms");
      return { ok: true, way: "cms", id: w.backupId, edited };
    }
  }
  // on for everyone through the shop's gateway
  if (gatewayState().configured) {
    const p = await shipToEveryone(t.id, x.by, changes);
    await calendarPublished(t, "everyone");
    return { ok: true, way: "everyone", id: p.id, edited };
  }
  // the code for dotSource
  const [idea, result] = await Promise.all([ideaOf(t).catch(() => null), resultOf(t)]);
  const info: ShipInfo = {
    testId: t.id, name: t.name, env: t.env, host: t.host, pages: t.pages, versionRev: t.versionRev, decidedBy: t.decidedBy, decidedAt: t.decidedAt,
    idea: idea ? { title: idea.title, why: idea.why, change: idea.change, expect: idea.expect } : null, result,
  };
  await markHanded(t.id, "dotsource", x.by);
  await calendarPublished(t, "dotsource");
  return { ok: true, way: "dotsource", edited, package: { css: cssBlock(changes, info), js: jsSnippet(changes, info), description: description(changes, info) } };
}
