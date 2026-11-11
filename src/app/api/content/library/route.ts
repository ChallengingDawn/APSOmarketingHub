// THE CONTENT LIBRARY (SARCLA 11.11.2026: "one page per type of content, and content should really display, and in one
// click back to edit"): every piece with a studio document in the projects this person may open (lib/content/libraryRead.ts
// - the projects' own sharing rules), what it shows and where it went out, and the names of the people it names. One
// answer for every kind: each library page shows its own kind and the counts of all of them.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { myAccess } from "@/lib/auth/appAccess";
import { libraryFor } from "@/lib/content/libraryRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await requireUser();
  const access = await myAccess();
  // the library pages answer to Marketing & Content's grant, as the projects do (src/app/projects/layout.tsx)
  if (!access?.canOpen("marketing")) return NextResponse.json({ ok: false, error: "No access" }, { status: 403 });
  try {
    const { items, people } = await libraryFor({ username: me.username, admin: me.role === "admin" });
    return NextResponse.json({ ok: true, items, people });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
