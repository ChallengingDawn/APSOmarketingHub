// THE SANDBOX BAR - whose sandbox it is, where its data comes from (HubSpot through the person's own app, the
// microservices through the read-only door), the HubSpot writes it held back, and Delete all. Answers 404 anywhere but
// a sandbox, so the real hub has no such route at all.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { isSandbox } from "@/lib/sandbox/mode";
import { parsePeople } from "@/lib/sandbox/peopleList";
import { deleteAll, sandboxState } from "@/lib/sandbox/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** Whose sandbox it is, for its band: the person's first name. */
function owner(): string | null {
  const p = parsePeople(process.env.SANDBOX_PEOPLE).people[0];
  return p ? p.name.split(/\s+/)[0] : null;
}

export async function GET() {
  const refused = await gate();
  if (refused) return refused;
  return NextResponse.json({
    ...(await sandboxState()), name: owner(),
    hubspot: !!(process.env.HUBSPOT_TOKEN ?? "").trim(),
    door: !!((process.env.SANDBOX_VIEWER_URL ?? "").trim() && (process.env.SANDBOX_VIEWER_KEY ?? "").trim()),
  });
}

export async function POST(req: NextRequest) {
  const refused = await gate();
  if (refused) return refused;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "delete-all") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    return NextResponse.json({ ...(await deleteAll()), state: await sandboxState() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
