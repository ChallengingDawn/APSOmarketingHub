// Who asks, for the action plan: admins only (SARCLA 01.11.2026: "this should be only visible to admin"), to read it
// and to change it. The page's layout holds the same rule; a plan action's sub-actions and tickets answer to it too
// (src/app/api/reporting/kpi-actions/guard.ts whoForTile).
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import type { Who } from "../reporting/kpi-actions/guard";

export async function planWho(_write = false): Promise<Who | NextResponse> {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ error: "The action plan is for admins" }, { status: 403 });
  const u = await getOptionalUser();
  return { userId: access.userId, name: u?.full_name || u?.username || `user ${access.userId}`, email: u?.email ?? null, canWrite: true };
}
