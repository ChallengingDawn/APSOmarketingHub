// Who asks, for the action plan: Marketing (where Mission Control was) or Advanced reporting (the KPI tiles whose
// tasks are its sub-actions) to read it, write on either to change it. The page's layout holds the same rule.
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import type { Who } from "../reporting/kpi-actions/guard";

export async function planWho(write = false): Promise<Who | NextResponse> {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("marketing") && !access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const canWrite = access.canWrite("marketing") || access.canWrite("reporting");
  if (write && !canWrite) return NextResponse.json({ error: "Read only - ask for Marketing or Advanced reporting with write access" }, { status: 403 });
  const u = await getOptionalUser();
  return { userId: access.userId, name: u?.full_name || u?.username || `user ${access.userId}`, email: u?.email ?? null, canWrite };
}
