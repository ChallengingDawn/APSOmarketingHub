// A SANDBOX, SERVED BY THE HUB (SARCLA 27.10.2026: "it should be hosted on the hub, only using Railway as a relay for the
// CLI"). /sandbox/run/<name>/... on the hub's own address: the hub's sign-in and TOTP, the Sandbox app's grant and the
// sandbox's own list of people decide who may see it; the hub then fetches the request from the Railway copy - which
// runs under this very path - signed with who is asking. Never the hub's cookies up, never the sandbox's cookies down.
// See src/lib/sandbox/proxy.ts. 404 on a sandbox copy itself.

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { isSandbox } from "@/lib/sandbox/mode";
import { PROXY_HEADER, downstreamHeaders, signProxy, upstreamHeaders } from "@/lib/sandbox/proxy";
import { readSandbox } from "@/lib/sandboxFeed/feed";
import { sandboxTargetList } from "@/lib/sandboxFeed/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// who works in each sandbox, asked of it at most once a minute
const people = new Map<string, { until: number; emails: Set<string> }>();
async function peopleOf(base: string, linkKey: string): Promise<Set<string>> {
  const held = people.get(base);
  if (held && Date.now() < held.until) return held.emails;
  const a = await readSandbox(base, linkKey).catch(() => null);
  const emails = new Set((a?.people ?? []).map((p) => p.email.toLowerCase()));
  people.set(base, { until: Date.now() + (a ? 60_000 : 5_000), emails });
  return emails;
}

const refuse = (status: number, text: string) =>
  new NextResponse(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

async function handle(req: NextRequest, slug: string): Promise<Response> {
  if (isSandbox()) return refuse(404, "Not found");
  // (the hub's sign-in check sends page loads to /signin before they get here; this is for what it lets pass - images)
  const u = await getOptionalUser();
  if (!u) return refuse(401, "Sign in to the hub first.");
  const access = await myAccess();
  if (!access?.canOpen("sandbox")) return refuse(403, "The Sandbox app is not yours to open.");
  const linkKey = process.env.SANDBOX_LINK_KEY;
  const t = sandboxTargetList(process.env.SANDBOX_URLS).find((x) => x.slug === slug);
  if (!t || !linkKey) return refuse(404, "No such sandbox.");
  const email = (u.email ?? "").toLowerCase();
  if (!email || !(await peopleOf(t.base, linkKey)).has(email)) return refuse(403, "This sandbox does not name you.");

  const headers = upstreamHeaders(req.headers);
  headers.set(PROXY_HEADER, await signProxy(email, createHash("sha256").update(linkKey).digest("hex")));
  const hasBody = !["GET", "HEAD"].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(`${t.origin}${req.nextUrl.pathname}${req.nextUrl.search}`, {
      method: req.method, headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(60_000),
      ...(hasBody ? { body: req.body, duplex: "half" } : {}),
    } as RequestInit);
  } catch (e) {
    return refuse(502, `The sandbox did not answer (${(e as Error).message.slice(0, 120)}).`);
  }
  return new Response(upstream.body, { status: upstream.status, headers: downstreamHeaders(upstream.headers, t.origin) });
}

type Ctx = { params: Promise<{ slug: string }> };
const route = async (req: NextRequest, ctx: Ctx) => handle(req, (await ctx.params).slug);
export const GET = route;
export const HEAD = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
