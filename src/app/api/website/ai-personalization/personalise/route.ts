// APSOconvert > PERSONALISE (src/lib/convert/tests.ts, kind "personalisation"): an audience always gets a version - no
// split, still counted. GET = the personalisations with their figures, the approved versions, the store views the
// shop's index knows, whether the gateway is connected; GET ?languages=<versionId>&env= = the page in its languages.
// POST {action:"create", versionId, env?, pages?, audience, name?} -> {id}; {action:"settings", id, ...} (a draft);
// {action:"on"|"off"|"end"|"delete", id}. Switching one on is the approval that puts it on the shop: the page's write level.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { isEnv } from "@/lib/convert/model";
import { ensureConvertSchema } from "@/lib/convert/pages";
import { act, approvedVersionPath, candidates, createDraft, gatewayState, gatewayTests, languagePaths, listTests, testById, updateSettings, type Action } from "@/lib/convert/tests";
import { body, fail, failOf, figuresOf, idOf, inTurns, ok, who } from "@/lib/convert/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = "/website/ai-personalization/personalise";
const STORES_KNOWN = ["de-CH", "fr-CH", "it-CH", "en-CH", "fr-FR", "it-IT", "nl-NL", "pl-PL"];

async function stores(): Promise<string[]> {
  await ensureConvertSchema();
  const r = await query<{ store: string }>(`SELECT DISTINCT store FROM apsomh_convert_pages WHERE gone_at IS NULL AND store <> '' ORDER BY store`);
  const list = r.rows.map((x) => x.store).filter((s) => /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/.test(s));
  return list.length ? list : STORES_KNOWN;
}

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const lv = idOf(sp.get("languages"));
    if (lv) {
      const c = await approvedVersionPath(lv);
      if (!c) return fail("That version is not approved.", 404);
      return ok({ paths: await languagePaths(isEnv(sp.get("env")) ? (sp.get("env") as "acc" | "prod") : "acc", c.path) });
    }
    const [items, cands, live, storeList] = await Promise.all([listTests("personalisation"), candidates("personalisation"), gatewayTests(), stores()]);
    const figures = await inTurns(items, 4, (t) => figuresOf(t).catch(() => null));
    const held = new Map((live.tests ?? []).map((c) => [String(c.id), c]));
    return ok({
      items: items.map((t, i) => ({
        ...t, results: undefined, figures: figures[i],
        drift: live.tests && (t.status === "running" || t.status === "paused") ? (!held.get(t.id) ? "missing" : held.get(t.id)!.v !== t.v || held.get(t.id)!.status !== t.status ? "behind" : null) : null,
      })),
      candidates: cands,
      stores: storeList,
      gateway: { ...gatewayState(), error: live.error },
      canEdit: access.levelAt(PAGE) === "write",
    });
  } catch (e) {
    return failOf(e);
  }
}

const VERB: Record<string, Action> = { on: "start", off: "pause", end: "stop", delete: "delete" };

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(PAGE) !== "write") return fail("Personalising needs the write access of Personalise.", 403);
  try {
    const b = await body(req);
    const by = await who();
    if (b.action === "create") {
      const versionId = idOf(b.versionId);
      if (!versionId) return fail("Which version?", 400);
      const t = await createDraft({ versionId, kind: "personalisation", env: isEnv(b.env) ? b.env : "acc", pages: b.pages, audience: b.audience, name: typeof b.name === "string" ? b.name : null }, by);
      console.log(`[convert-personalise] #${t.id} made from version ${versionId} by ${by}`);
      return ok({ id: t.id });
    }
    const id = idOf(b.id);
    if (!id) return fail("Which personalisation?", 400);
    const cur = await testById(id);
    if (!cur || cur.kind !== "personalisation") return fail("No such personalisation.", 404);
    if (b.action === "settings") return ok(await updateSettings(id, b, by));
    let verb = VERB[String(b.action)];
    if (!verb) return fail("Unknown action.", 400);
    // "on" again after "off" resumes it (same round, the figures go on)
    if (verb === "start" && cur.status === "paused") verb = "resume";
    // ... and after "end", it starts again as a new round
    if (verb === "start" && cur.status === "stopped") verb = "restart";
    const t = await act(id, verb, by);
    console.log(`[convert-personalise] #${id} ${String(b.action)} by ${by}`);
    return ok(t ? { id: t.id, status: t.status } : { id: null, status: "deleted" });
  } catch (e) {
    return failOf(e);
  }
}
