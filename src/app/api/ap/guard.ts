// The Angst+Pfister hub's APIs answer its people only - cross-user or cross-admin, never an admin without the mark
// (src/app/ap/layout.tsx is the pages' half): the figures are the whole group's, with margins.
import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { asCross } from "@/lib/auth/access";
import type { UserRow } from "@/lib/db/init";

export async function apHubUser(): Promise<{ user: UserRow } | { error: NextResponse }> {
  const u = await getOptionalUser();
  if (!u) return { error: NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 }) };
  if (asCross(u.cross_access) === null) {
    return { error: NextResponse.json({ ok: false, error: "The Angst+Pfister hub is not opened to you." }, { status: 403 }) };
  }
  return { user: u };
}
