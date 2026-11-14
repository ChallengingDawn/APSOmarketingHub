// Website > A/B testing > MISSION CONTROL's record (src/lib/experiments). GET = every test with the last sync and whether
// this person may write; GET ?key= = one test with its log. A list older than 15 minutes starts a sync in the background.
// POST {action:"sync"} (now, under the lock) | {action:"create", ...} (an idea, a planned or a past test, typed in) |
// {action:"save", key, patch} (a person's word: decision, what we learned, hypothesis, owner, score, notes, a result another
// tool reported - and on a typed-in test the rest) | {action:"remove", key} (a typed-in test only). Writing needs the write
// level of A/B testing.
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { body, who } from "@/lib/convert/api";
import { ExpError, createManual, experimentByKey, listExperiments, logOf, removeManual, savePerson } from "@/lib/experiments/store";
import { lastSync, syncLocked } from "@/lib/experiments/sync";
import { placeOf } from "@/lib/experiments/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const APP = "/website/ab-testing";
const ok = (data: unknown) => NextResponse.json({ configured: true, ok: true, data });
const fail = (e: unknown) => NextResponse.json({ configured: true, ok: false, error: String((e as Error)?.message ?? e) },
  { status: e instanceof ExpError ? e.status : 500 });
const KEY = /^(convert|webyn|chat|pagebuilder|manual)-[A-Za-z0-9_-]{1,80}$/;
let syncing = false;

export async function GET(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("website")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const canEdit = access.levelAt(APP) === "write";
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (key !== null) {
      if (!KEY.test(key)) return fail(new ExpError("Which test?"));
      const e = await experimentByKey(key);
      if (!e) return fail(new ExpError("No such test - it may still be waiting for the next sync.", 404));
      // the other tests on the same page or service, oldest first - the page walks from one to the next (14.11.2026)
      const [log, all] = await Promise.all([logOf(key), listExperiments()]);
      const siblings = all.filter((x) => placeOf(x) === placeOf(e))
        .sort((a, b) => Date.parse(a.startedAt ?? a.createdAt) - Date.parse(b.startedAt ?? b.createdAt))
        .map((x) => ({ key: x.key, name: x.name, status: x.status, startedAt: x.startedAt }));
      return ok({ experiment: e, log, siblings, canEdit });
    }
    const [experiments, sync] = await Promise.all([listExperiments(), lastSync()]);
    // stale: refreshed in the background, the page shows what it has meanwhile
    const stale = !sync || Date.now() - Date.parse(sync.at) > 15 * 60_000;
    if (stale && !syncing) {
      syncing = true;
      void syncLocked().catch(() => null).finally(() => { syncing = false; });
    }
    return ok({ experiments, sync: sync ?? null, syncing: stale, canEdit });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.levelAt(APP) !== "write") return fail(new ExpError("Changing the A/B testing record needs its write access.", 403));
  try {
    const b = await body(req);
    const by = await who();
    if (b.action === "sync") {
      const r = await syncLocked();
      if (!r) return fail(new ExpError("A refresh is going on right now - try again in a minute.", 409));
      return ok(r);
    }
    if (b.action === "create") {
      const e = await createManual((b.experiment ?? {}) as Record<string, unknown>, by);
      console.log(`[experiments] ${e.key} recorded by ${by}: ${e.status} "${e.name}"`);
      return ok(e);
    }
    const key = typeof b.key === "string" && KEY.test(b.key) ? b.key : null;
    if (!key) return fail(new ExpError("Which test?"));
    if (b.action === "save") {
      const e = await savePerson(key, (b.patch ?? {}) as Record<string, unknown>, by);
      return ok(e);
    }
    if (b.action === "remove") {
      await removeManual(key, by);
      console.log(`[experiments] ${key} taken out by ${by}`);
      return ok({ key });
    }
    return fail(new ExpError("Unknown action"));
  } catch (e) {
    return fail(e);
  }
}
