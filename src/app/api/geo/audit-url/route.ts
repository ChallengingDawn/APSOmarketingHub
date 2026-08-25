import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { auditPageByUrl } from "@/lib/geo/fetchPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scores one published page of ours. The fetching, the redirect re-validation
 * and the private-address refusal all live in `@/lib/geo/fetchPage`, because a
 * route file may export nothing but handlers and config — and because the
 * competitor route must fetch through exactly the same guards.
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

  const rawUrl = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  const outcome = await auditPageByUrl(rawUrl, { scope: "own-sites" });
  return NextResponse.json(outcome);
}
