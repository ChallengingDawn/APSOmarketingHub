// THE PRICING APP'S WAY TO ITS DATA.
//
// The Pricing pages (src/app/pricing) call /api/pricing/api/<path>; this route checks the person and passes the call to
// the PricingHub backend's /api/<path>, with the backend's key - the one the hub already holds for Declarations of
// Conformity (DOC_BACKEND_URL / DOC_BACKEND_KEY, src/lib/doc/config.ts: the backend's INTERNAL_API_KEY). The rules -
// which paths, who may change what, who is stamped on a change - are in src/lib/pricing/backend.ts.
//
// The answer streams back as it came, so the Excel and PDF downloads keep working.

import type { NextRequest } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { backend } from "@/lib/doc/config";
import { allowedPath, stampBody, stampQuery, writePages } from "@/lib/pricing/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (status: number, error: string) => Response.json({ ok: false, error }, { status });

async function pass(req: NextRequest, segs: string[]): Promise<Response> {
  const access = await myAccess();
  if (!access) return no(401, "Your session has ended. Sign in again.");
  if (!access.canOpen("pricing")) return no(403, "Pricing is not part of your access.");
  if (!allowedPath(segs)) return no(404, "Not a Pricing address.");

  const read = req.method === "GET" || req.method === "HEAD";
  if (!read) {
    // Edit on a page this change is made from, or on the whole app (an admin, a person given Pricing to edit)
    const pages = writePages(segs);
    const mayWrite = access.canWrite("pricing") || pages.some((p) => access.levelAt(p) === "write");
    if (!mayWrite) return no(403, "View only: you can look at this in Pricing, not change it.");
  }

  const { url: base, key } = backend();
  if (!key) return no(503, "The Pricing backend's key is not set on the hub (DOC_BACKEND_KEY).");

  const u = read ? null : await getOptionalUser();
  const who = u ? { email: u.email ?? u.username, name: u.full_name || u.username } : null;

  const search = who ? stampQuery(req.nextUrl.searchParams, who, req.method === "DELETE") : req.nextUrl.searchParams;
  const qs = search.toString();
  const target = `${base}/api/${segs.map(encodeURIComponent).join("/")}${qs ? `?${qs}` : ""}`;

  const headers = new Headers({ "x-internal-key": key });
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  let body: BodyInit | undefined;
  if (!read) {
    const buf = Buffer.from(await req.arrayBuffer());
    body = who && ct?.includes("application/json") ? stampBody(buf.toString("utf8"), who) : buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers, body, redirect: "manual", cache: "no-store" });
  } catch (e) {
    return no(502, `The Pricing backend did not answer: ${(e as Error)?.message ?? e}`);
  }

  if (!read && u && upstream.ok) {
    await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`, [
      String(u.id), "pricing.change", JSON.stringify({ method: req.method, path: `/${segs.join("/")}` }),
    ]).catch(() => {});
  }

  const out = new Headers();
  for (const h of ["content-type", "content-disposition", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) { return pass(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Ctx) { return pass(req, (await ctx.params).path); }
export async function PUT(req: NextRequest, ctx: Ctx) { return pass(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return pass(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return pass(req, (await ctx.params).path); }
