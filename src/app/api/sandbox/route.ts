// THE SANDBOX BAR - its counts, where to bring data (the hub's Sandbox app: the sandbox never asks the hub itself), and
// Delete all. Answers 404 anywhere but the sandbox copy, so the real hub has no such route at all.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { isSandbox } from "@/lib/sandbox/mode";
import { parsePeople } from "@/lib/sandbox/peopleList";
import { deleteAll, sandboxState } from "@/lib/sandbox/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The hub's Sandbox app, where the waiting reads are brought (SANDBOX_HUB_URL on the sandbox's Railway service). */
const hubPage = () => (process.env.SANDBOX_HUB_URL ? `${process.env.SANDBOX_HUB_URL.replace(/\/+$/, "")}/sandbox` : null);

async function gate() {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** Whose sandbox it is, for its band: the builders' first names (the base copy has none - it is nobody's). */
function builders(): string | null {
  const names = parsePeople(process.env.SANDBOX_PEOPLE).people.filter((p) => p.role === "user").map((p) => p.name.split(/\s+/)[0]);
  return names.length ? names.join(" & ") : null;
}

export async function GET() {
  const refused = await gate();
  if (refused) return refused;
  return NextResponse.json({ ...(await sandboxState()), hub: hubPage(), name: builders() });
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
