// `npm run sbx` - the sandbox's CLI (scripts/sbx.mjs): login (password + TOTP), railway (today's token, sandbox only),
// ask / ask?id= (Bring requested data), review (Send to review), pull (the hub's current code, scrubbed).
// 404 anywhere but the sandbox copy. See src/lib/sandbox/cli.ts.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { getPool } from "@/lib/db/client";
import type { UserRow } from "@/lib/db/init";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from "@/lib/auth/rateLimit";
import { addAsk, addReview, askSpec, askState, cliUser, latestSnapshot, railwayFor, reviewIn, signCli } from "@/lib/sandbox/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT = "30bd5735-8463-4dc5-9b6a-ab43baabdc66";      // APSOAssistant
const ENVIRONMENT = "a8472f7f-7ddd-4f49-8506-53246f8dab8d";  // its "sandbox"

type Ctx = { params: Promise<{ action: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function login(req: NextRequest) {
  const rlKey = clientKey(req, "sbx-login");
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) return json({ error: "Too many attempts. Try again later." }, 429);
  const b = (await req.json().catch(() => ({}))) as { identifier?: string; password?: string; code?: string };
  const id = (b.identifier ?? "").trim().toLowerCase();
  const r = await getPool().query<UserRow>(`SELECT * FROM apsomh_users WHERE lower(username) = $1 OR lower(email) = $1 LIMIT 1`, [id]);
  const u = r.rows[0];
  const ok = !!u && u.is_active && !!b.password && (await verifyPassword(b.password, u.password_hash))
    && !!u.totp_enrolled && !!u.totp_secret && /^\d{6}$/.test((b.code ?? "").trim()) && verifyTotp(u.totp_secret, (b.code ?? "").trim());
  if (!ok) { recordFailure(rlKey); return json({ error: "Wrong user, password or code" }, 401); }
  if (u.must_change_password) return json({ error: "Set your own password in the sandbox's web login first" }, 403);
  recordSuccess(rlKey);
  return json({ ...(await signCli(u.id)), user: u.username });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isSandbox()) return json({ error: "Not found" }, 404);
  const { action } = await ctx.params;
  if (action === "login") return login(req);
  const u = await cliUser(req);
  if (!u) return json({ error: "Sign in first: npm run sbx -- login" }, 401);
  const body = await req.json().catch(() => null);
  if (action === "ask") {
    const spec = askSpec((body as { spec?: unknown } | null)?.spec);
    if (typeof spec === "string") return json({ error: spec }, 400);
    const id = await addAsk(u.username, spec, String((body as { reason?: unknown }).reason ?? ""));
    return json({ id, next: "Press Bring requested data in the sandbox; the hub answers within a minute." });
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
