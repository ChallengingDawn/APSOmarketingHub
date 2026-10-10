// Hand the borrowed access back.
//
// After this the hub reads Google as itself again — which means Search Console
// returns to 403 until the service account is added to the property. The
// Integrations page says so before anybody presses it.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { disconnectUser, userConnection } from "@/lib/integrations/googleUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const me = await requireAdmin();
  const was = await userConnection();
  await disconnectUser();
  await query(
    `INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`,
    [me.username, "google.disconnected", JSON.stringify({ email: was?.email ?? null })],
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
