// `npm run sbx` - the sandbox's CLI (scripts/sbx.mjs): login-start / login-poll (a code confirmed on the hub's Sandbox
// app, behind the hub's TOTP - the sandbox has no password of its own), railway (today's token, sandbox only),
// ask / ask?id= (Bring requested data), review (Send to review), pull (the hub's current code, scrubbed).
// 404 anywhere but the sandbox copy. See src/lib/sandbox/cli.ts and door.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { pollCli, startCli } from "@/lib/sandbox/door";
import { publicUrl } from "@/lib/sandbox/peopleList";
import { addAsk, addReview, askSpec, askState, cliUser, latestSnapshot, railwayFor, reviewIn, signCli } from "@/lib/sandbox/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT = "30bd5735-8463-4dc5-9b6a-ab43baabdc66";      // APSOAssistant
const ENVIRONMENT = "a8472f7f-7ddd-4f49-8506-53246f8dab8d";  // its "sandbox"

type Ctx = { params: Promise<{ action: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Where the person confirms a CLI code: the hub's Sandbox app. */
const hubPage = () => (process.env.SANDBOX_HUB_URL ? `${process.env.SANDBOX_HUB_URL.replace(/\/+$/, "")}/sandbox` : null);

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isSandbox()) return json({ error: "Not found" }, 404);
  const { action } = await ctx.params;
  if (action === "login-start") {
    const c = await startCli();
    const hub = hubPage();
    // the sandbox as the hub knows it: its public address (Railway's domain), not the name the server runs under
    const pub = publicUrl(process.env);
    const self = pub ? new URL(pub).host : (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host);
    return json({ ...c, confirmAt: hub ? `${hub}?cli=${self}:${c.code}` : null });
  }
  const u = await cliUser(req);
  if (!u) return json({ error: "Sign in first: npm run sbx -- login" }, 401);
  const body = await req.json().catch(() => null);
  if (action === "ask") {
    const spec = askSpec((body as { spec?: unknown } | null)?.spec);
    if (typeof spec === "string") return json({ error: spec }, 400);
    const id = await addAsk(u.username, spec, String((body as { reason?: unknown }).reason ?? ""));
    const hub = process.env.SANDBOX_HUB_URL ? `${process.env.SANDBOX_HUB_URL.replace(/\/+$/, "")}/sandbox` : "the hub's Sandbox app";
    return json({ id, next: `Bring it on the hub: ${hub} - Bring requested data.` });
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
    return json({ state: "granted", ...(await signCli(r.uid)), user: r.user });
  }
  const u = await cliUser(req);
  if (!u) return json({ error: "Sign in first: npm run sbx -- login" }, 401);
  if (action === "railway") {
    const r = await railwayFor(u.username);
    if (!r) return json({ error: "The hub has not handed over a Railway token yet - try again in a minute" }, 409);
    return json({ ...r, project: PROJECT, environment: ENVIRONMENT });
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
