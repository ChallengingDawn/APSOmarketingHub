// Website > A/B testing > PAGE TESTS (src/lib/convert/tests.ts). GET = the tests with their figures in short (read from
// the shop's gateway for the live ones), the approved versions waiting for a test, and whether the gateway is
// connected; GET ?languages=<versionId>&env=acc|prod = the version's page in its other languages, to tick; GET
// ?piece=<Content piece id> = only that piece's tests (the Page builder's publishing view, SARCLA 11.11.2026).
// POST {action:"create", versionId, env?, pages?, name?, piece?} -> {id}; {action:"settings", id, name?, notes?, mde?, env?,
// pages?, allocation?, audience?} (a draft's conditions); {action: start|pause|resume|stop|restart|sync|remove|decide|
// delete|copy, id, winner?, env?}. Writing needs the page's write level; starting is the approval that puts a version
// on the shop. Without DIRECTUP_ADMIN_KEY drafts still work and the list says the gateway is not connected.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { isEnv } from "@/lib/convert/model";
import { ACTIONS, act, approvedVersionPath, candidates, createDraft, gatewayState, gatewayTests, languagePaths, listTests, originsOf, testById, updateSettings, type Action } from "@/lib/convert/tests";
import { body, fail, failOf, figuresOf, idOf, inTurns, ok, who } from "@/lib/convert/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = "/website/ab-testing/pages";

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const lv = idOf(sp.get("languages"));
    if (lv) {
      const c = await approvedVersionPath(lv);
      const env = isEnv(sp.get("env")) ? (sp.get("env") as "acc" | "prod") : "acc";
      if (!c) return fail("That version is not approved.", 404);
      return ok({ paths: await languagePaths(env, c.path) });
    }
    const piece = idOf(sp.get("piece"));
    const [tests, cands, live] = await Promise.all([listTests("test", piece), piece ? Promise.resolve([]) : candidates("test"), gatewayTests()]);
    const [figures, origins] = await Promise.all([inTurns(tests, 4, (t) => figuresOf(t).catch(() => null)), originsOf(tests).catch(() => ({} as Awaited<ReturnType<typeof originsOf>>))]);
    const held = new Map((live.tests ?? []).map((c) => [String(c.id), c]));
    return ok({
      tests: tests.map((t, i) => {
        const g = held.get(t.id);
        // the hub says live, the gateway does not hold it (or an older round): it can be sent again
        const drift = live.tests && (t.status === "running" || t.status === "paused") ? (!g ? "missing" : g.v !== t.v || g.status !== t.status ? "behind" : null) : null;
        return { ...t, results: undefined, figures: figures[i], drift, weights: g?.weights ?? null, origin: origins[t.id] ?? null };
      }),
      candidates: cands,
      gateway: { ...gatewayState(), error: live.error },
      canEdit: access.levelAt(PAGE) === "write",
    });
  } catch (e) {
    return failOf(e);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return fail("Page tests need the write access of Page tests.", 403);
  try {
    const b = await body(req);
    const by = await who();
    if (b.action === "create") {
      const versionId = idOf(b.versionId);
      if (!versionId) return fail("Which version?", 400);
      const t = await createDraft({ versionId, kind: "test", env: isEnv(b.env) ? b.env : "acc", pages: b.pages, name: typeof b.name === "string" ? b.name : null, allocation: b.allocation, audience: b.audience, piece: idOf(b.piece) }, by);
      console.log(`[convert-tests] #${t.id} made from version ${versionId} by ${by}`);
      return ok({ id: t.id });
    }
    const id = idOf(b.id);
    if (!id) return fail("Which test?", 400);
    const cur = await testById(id);
    if (!cur || cur.kind !== "test") return fail("No such page test.", 404);
    if (b.action === "settings") return ok(await updateSettings(id, b, by));
    if (!ACTIONS.includes(b.action as Action)) return fail("Unknown action.", 400);
    const t = await act(id, b.action as Action, by, { winner: b.winner, env: b.env });
    console.log(`[convert-tests] #${id} ${String(b.action)} by ${by}`);
    return ok(t ? { id: t.id, status: t.status } : { id: null, status: "deleted" });
  } catch (e) {
    return failOf(e);
  }
}
