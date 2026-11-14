// APSOconvert > SHIP - the tests a person decided the version won (and those whose figures say so, to decide), each with
// its three ways out (src/lib/convert/ship.ts): kept on for everyone (a personalisation without an audience limit -
// instant, undoable), the code for dotSource (CSS + an ES5 script + what changes and why), and for CMS pages only the
// write into Magento (src/lib/convert/cms.ts - off until the hub has its MAGENTO_CMS_* keys).
//   GET          the decided tests in short, and whether the gateway and Magento are connected
//   GET ?id=     one test: its code, its pages with what Magento would do (?plan=<path>&env=&page=), its backups, and
//                what Content Studio needs to write its texts
//   POST {action:"decide"|"everyone"|"undo"|"handed", id} · {action:"cms-write", id, env, path, pageId} · {action:"cms-restore", backupId}
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { ENVS, isEnv } from "@/lib/convert/model";
import { cmsBackups, cmsKeys, cmsPlan, cmsRestore, cmsWrite, CMS_OFF } from "@/lib/convert/cms";
import { cmsTarget, cssBlock, description, jsSnippet, pageName } from "@/lib/convert/ship";
import { ConvertError, act, gatewayState, ideaOf, listTests, markHanded, originsOf, resultsOf, baseRateOf, shipToEveryone, shippedAs, testById, undoEveryone } from "@/lib/convert/tests";
import { body, fail, failOf, figuresOf, idOf, inTurns, ok, who } from "@/lib/convert/api";
import type { Change } from "@/lib/convert/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = "/website/ai-personalization/ship";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const canEdit = access.levelAt(PAGE) === "write";
  try {
    const id = idOf(sp.get("id"));
    if (id) {
      const t = await testById(id);
      if (!t || t.kind !== "test") return fail("No such test.", 404);
      const planPath = sp.get("plan");
      if (planPath) {
        const env = isEnv(sp.get("env")) ? (sp.get("env") as "acc" | "prod") : "acc";
        return ok({ plan: await cmsPlan(id, env, planPath, idOf(sp.get("page"))) });
      }
      const [changes, idea, shipped, backups, results] = await Promise.all([
        query<{ changes: Change[] }>(`SELECT changes FROM apsomh_convert_tests WHERE id = $1`, [id]).then((r) => r.rows[0]?.changes ?? []),
        ideaOf(t),
        shippedAs(id),
        cmsBackups(id),
        resultsOf(t, { baseRate: await baseRateOf(t).catch(() => null) }),
      ]);
      const c = results.analysis?.comparison ?? null;
      const info = {
        testId: t.id, name: t.name, env: t.env, host: t.host, pages: t.pages, versionRev: t.versionRev, decidedBy: t.decidedBy, decidedAt: t.decidedAt,
        idea: idea ? { title: idea.title, why: idea.why, change: idea.change, expect: idea.expect } : null,
        result: c ? { rateA: c.a.rate, rateB: c.b.rate, uplift: c.uplift.mid, pB: c.pBest?.b ?? null, visitors: c.a.visitors + c.b.visitors, days: results.analysis!.days } : null,
      };
      const keys = cmsKeys();
      return ok({
        test: { ...t, results: undefined },
        code: { css: cssBlock(changes, info), js: jsSnippet(changes, info), description: description(changes, info), changes: changes.length },
        pages: t.pages.map((p) => {
          const target = cmsTarget(p);
          return { path: p, name: pageName(p), cms: target.ok ? { ok: true as const, identifier: target.identifier } : { ok: false as const, why: target.why } };
        }),
        cms: { acc: keys.acc, prod: keys.prod, missing: keys.missing, off: !keys.acc ? CMS_OFF : null },
        backups,
        shippedAs: shipped ? { id: shipped.id, status: shipped.status, startedAt: shipped.startedAt, startedBy: shipped.startedBy } : null,
        idea,
        figures: c ? { rateA: c.a.rate, rateB: c.b.rate, uplift: c.uplift, pB: c.pBest?.b ?? null, visitors: { a: c.a.visitors, b: c.b.visitors }, days: results.analysis!.days, verdict: results.analysis!.verdict.key } : null,
        content: { url: `${ENVS[t.env].base}${t.pages[0]}`, path: t.pages[0], env: t.env },
        origin: (await originsOf([t]).catch(() => ({} as Awaited<ReturnType<typeof originsOf>>)))[t.id] ?? null,
        gateway: gatewayState(),
        canEdit,
        canContent: access.canOpen("marketing"),
      });
    }
    const tests = (await listTests("test")).filter((t) => t.status !== "draft");
    const figures = await inTurns(tests, 4, (t) => figuresOf(t).catch(() => null));
    const rows = tests.map((t, i) => ({ ...t, results: undefined, figures: figures[i] }))
      // decided by a person (the version won), or the figures say the version wins and a person can decide it
      .filter((t) => t.winner === "b" || (t.winner === null && t.figures?.verdict?.key === "b-wins"));
    const [shipped, origins] = await Promise.all([Promise.all(rows.map((t) => shippedAs(t.id).catch(() => null))), originsOf(rows).catch(() => ({} as Awaited<ReturnType<typeof originsOf>>))]);
    const keys = cmsKeys();
    return ok({
      tests: rows.map((t, i) => ({ ...t, shippedAs: shipped[i] ? { id: shipped[i]!.id, status: shipped[i]!.status } : null, origin: origins[t.id] ?? null })),
      gateway: gatewayState(),
      cms: { acc: keys.acc, prod: keys.prod, missing: keys.missing },
      canEdit,
    });
  } catch (e) {
    return failOf(e);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return fail("Shipping needs the write access of Ship.", 403);
  try {
    const b = await body(req);
    const by = await who();
    if (b.action === "cms-restore") {
      const backupId = idOf(b.backupId);
      if (!backupId) return fail("Which backup?", 400);
      return ok(await cmsRestore(backupId, by));
    }
    const id = idOf(b.id);
    if (!id) return fail("Which test?", 400);
    switch (b.action) {
      case "everyone": {
        const p = await shipToEveryone(id, by);
        console.log(`[convert-ship] #${id} on for everyone as #${p.id} by ${by}`);
        return ok({ id: p.id });
      }
      case "undo":
        await undoEveryone(id, by);
        console.log(`[convert-ship] #${id} for everyone undone by ${by}`);
        return ok({ id });
      case "decide": {
        // the figures say the version wins: a person ends the test with it (the test stops)
        const t = await act(id, "decide", by, { winner: "b" });
        return ok({ id, status: t?.status ?? null });
      }
      case "handed":
        await markHanded(id, "dotsource", by);
        return ok({ id });
      case "cms-write": {
        const env = isEnv(b.env) ? b.env : null;
        const path = typeof b.path === "string" ? b.path : "";
        const pageId = idOf(b.pageId);
        if (!env || !path || !pageId) return fail("Which environment, page and Magento page?", 400);
        const r = await cmsWrite(id, env, path, pageId, by);
        console.log(`[convert-ship] #${id} written to Magento ${env} ${path} (backup ${r.backupId}) by ${by}`);
        return ok(r);
      }
      default:
        throw new ConvertError("Unknown action.", 400);
    }
  } catch (e) {
    return failOf(e);
  }
}
