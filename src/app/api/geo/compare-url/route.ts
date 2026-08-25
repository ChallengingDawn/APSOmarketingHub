import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { auditPageByUrl } from "@/lib/geo/fetchPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scores two pages — one of ours, one a competitor's — with the same auditor.
 *
 * This is the only route that fetches an arbitrary public host, so it is also
 * the one that would be an open SSRF proxy if the address rules in
 * `@/lib/geo/netGuard` were skipped: scheme, credentials, port, resolved
 * address family and every redirect hop are checked there before a socket is
 * opened. Nothing is fetched until the caller supplies both URLs.
 */
export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body ?? {}) as { ourUrl?: unknown; theirUrl?: unknown };
  const ourUrl = typeof raw.ourUrl === "string" ? raw.ourUrl : "";
  const theirUrl = typeof raw.theirUrl === "string" ? raw.theirUrl : "";

  if (!ourUrl.trim() || !theirUrl.trim()) {
    return NextResponse.json({
      ok: false,
      error: "Both a page of ours and a competitor page are needed before anything is fetched.",
    });
  }

  // Sequential, not parallel: two 15 s fetches at once against one edge is the
  // kind of burst that gets a crawler blocked, and the second URL is only worth
  // fetching if the first one worked.
  const ours = await auditPageByUrl(ourUrl, { scope: "public" });
  if (!ours.ok) {
    return NextResponse.json({ ok: false, side: "ours", error: `Our page: ${ours.error}` });
  }

  const theirs = await auditPageByUrl(theirUrl, { scope: "public" });
  if (!theirs.ok) {
    return NextResponse.json({ ok: false, side: "theirs", error: `Competitor page: ${theirs.error}` });
  }

  return NextResponse.json({ ok: true, data: { ours: ours.data, theirs: theirs.data } });
}
