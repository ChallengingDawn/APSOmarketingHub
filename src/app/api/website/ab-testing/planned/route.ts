// Website > A/B testing > PAGES: the A/B tests planned in Content's Page builder (src/lib/content/abPlanned.ts). GET only -
// read-only on the Website side; a test is planned and changed in its to-do. Nothing runs live: the shop's gateway that
// would serve the versions is not deployed, which the list says.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { plannedTests } from "@/lib/content/abPlannedRead";
import { shareCandidates } from "@/lib/content/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = "/website/ab-testing";

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ ok: false, error: "Your session has ended - sign in again." }, { status: 401 });
  if (access.levelAt(PAGE) === "none") return NextResponse.json({ ok: false, error: "A/B testing is not open to you." }, { status: 403 });
  try {
    const [tests, people] = await Promise.all([plannedTests(), shareCandidates().catch(() => [])]);
    const names = new Map(people.map((p) => [p.username, p.name]));
    return NextResponse.json({ ok: true, tests: tests.map((t) => ({ ...t, owner: t.owner ? names.get(t.owner) ?? t.owner : null })) });
  } catch (e) {
    console.warn(`[ab-testing/planned] ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ ok: false, error: "The planned tests could not be read just now - try again." }, { status: 500 });
  }
}
