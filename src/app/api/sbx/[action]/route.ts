// `npm run sbx` - the relay's CLI routes (scripts/sbx.mjs): login-start / login-poll (a code confirmed on the hub's
// Sandbox app, behind the hub's TOTP - the sandbox has no password of its own), whoami, data (the coded answers the hub brought,
// copied down to the person's computer), misses (the reads their computer could not answer, for the hub's Sandbox app),
// ask / ask?id= (Bring requested data), review (Send to review), pull (the hub's current code, scrubbed).
// 404 anywhere but the sandbox. See src/lib/sandbox/cli.ts and door.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { pollCli, startCli } from "@/lib/sandbox/door";
import { publicUrl } from "@/lib/sandbox/peopleList";
import { missIn } from "@/lib/sandbox/canon";
import { noteMiss, refusedMisses, replayed, replaysAfter } from "@/lib/sandbox/store";
import { addAsk, addReview, askSpec, askState, cliUser, latestSnapshot, reviewIn, signCli } from "@/lib/sandbox/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** The hub, and its Sandbox app - where the person confirms a CLI code and brings data. */
const hubUrl = () => (process.env.SANDBOX_HUB_URL ? process.env.SANDBOX_HUB_URL.replace(/\/+$/, "") : null);
const hubPage = () => { const h = hubUrl(); return h ? `${h}/sandbox` : null; };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isSandbox()) return json({ error: "Not found" }, 404);
  const { action } = await ctx.params;
  if (action === "login-start") {
    const c = await startCli();
    const hub = hubPage();
    // the sandbox as the hub knows it: its name, the last part of the path it runs under (/sandbox/run/<name>)
    const pub = publicUrl(process.env);
    const self = process.env.SANDBOX_BASE_PATH?.split("/").filter(Boolean).pop()
      ?? (pub ? new URL(pub).host : (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host));
    return json({ ...c, confirmAt: hub ? `${hub}?cli=${self}:${c.code}` : null });
  }
  const u = await cliUser(req);
  if (!u) return json({ error: "Sign in first: npm run sbx -- login" }, 401);
  const body = await req.json().catch(() => null);
  if (action === "misses") {
    // what the person's computer could not answer: written down here for the hub's Sandbox app (Bring data), each key
    // made here from its request; a read already brought is not asked again - the next copy-down carries it
    const list = Array.isArray((body as { misses?: unknown } | null)?.misses) ? (body as { misses: unknown[] }).misses.slice(0, 200) : [];
    let noted = 0, skipped = 0;
    for (const m of list) {
      const x = missIn((m as { kind?: unknown })?.kind, (m as { request?: unknown })?.request);
      if (!x || (await replayed(x.key)) !== undefined) { skipped++; continue; }
      await noteMiss(x.kind, x.key, x.request);
      noted++;
    }
    return json({ noted, skipped, next: noted ? `Bring them on the hub: ${hubPage() ?? "the hub's Sandbox app"} - Bring data.` : null });
  }
  if (action === "ask") {
    const spec = askSpec((body as { spec?: unknown } | null)?.spec);
    if (typeof spec === "string") return json({ error: spec }, 400);
    const id = await addAsk(u.username, spec, String((body as { reason?: unknown }).reason ?? ""));
    return json({ id, next: `Bring it on the hub: ${hubPage() ?? "the hub's Sandbox app"} - Bring requested data.` });
  }
  if (action === "review") {
    const r = reviewIn(body);
    if (typeof r === "string") return json({ error: r }, 400);
    return json({ id: await addReview(u.username, r), next: "The hub mails it to the reviewer within a minute." });
  }
  return json({ error: "Unknown action" }, 404);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isSandbox()) return json({ error: "Not found" }, 404);
  const { action } = await ctx.params;
  if (action === "login-poll") {
    const r = await pollCli(req.nextUrl.searchParams.get("poll") ?? "");
    if (r.state !== "granted") return json(r, r.state === "expired" ? 410 : 202);
    return json({ state: "granted", ...(await signCli(r.uid)), user: r.user, hub: hubUrl() });
  }
  const u = await cliUser(req);
  if (!u) return json({ error: "Sign in first: npm run sbx -- login" }, 401);
  if (action === "whoami") return json({ email: u.email ?? u.username, name: u.full_name, hub: hubUrl() });
  if (action === "data") {
    // the coded answers the hub brought, a page at a time, and the reads it refused - what the computer copies down
    const page = await replaysAfter(req.nextUrl.searchParams.get("after"), 100);
    return json({ ...page, refused: page.more ? [] : await refusedMisses() });
  }
  if (action === "ask") {
    const a = await askState(Number(req.nextUrl.searchParams.get("id")));
    return a ? json(a) : json({ error: "No such ask" }, 404);
  }
  if (action === "pull") {
    const s = await latestSnapshot();
    if (!s) return json({ error: "No code here yet - it arrives with the hub's next release" }, 409);
    return new NextResponse(new Uint8Array(s.tar), { headers: { "content-type": "application/gzip", "x-snapshot-sha": s.sha, "x-snapshot-at": new Date(s.at).toISOString() } });
  }
  return json({ error: "Unknown action" }, 404);
}
