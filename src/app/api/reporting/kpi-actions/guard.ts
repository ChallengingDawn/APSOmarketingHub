// Who asks, for the tile toolbar's routes: Advanced reporting's grant to read, its write to change - the write of the
// report the tile, the view or the panel belongs to when it is known (`where`, from its page's key: tree.ts
// reportPathOfPage), so Edit given on one report is Edit there and nowhere else (SARCLA 01.11.2026: a sales leader
// "can be editor on certain advanced reports but not all").
import { NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { getOptionalUser } from "@/lib/auth/guard";
import { reportPathOfPage } from "@/lib/auth/tree";

export type Who = { userId: number; name: string; email: string | null; canWrite: boolean };

/** `where`: the report's address; "*" - anywhere in Advanced reporting (a person's own saved view); none - all of it. */
export async function who(write = false, where?: string | null): Promise<Who | NextResponse> {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("reporting")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const canWrite = where === "*"
    ? Object.entries(access.levels).some(([k, l]) => l === "write" && (k === "reporting" || k.startsWith("reporting:") || k.startsWith("reporting#")))
    : where ? access.levelAt(where) === "write" : access.canWrite("reporting");
  if (write && !canWrite) return NextResponse.json({ error: "Read only - ask for Advanced reporting with write access" }, { status: 403 });
  const u = await getOptionalUser();
  return { userId: access.userId, name: u?.full_name || u?.username || `user ${access.userId}`, email: u?.email ?? null, canWrite };
}

/**
 * An action of the action plan ("plan:<id>") is the plan's, not Advanced reporting's: its sub-actions answer to the
 * plan's rule (Marketing or Advanced reporting - src/app/api/action-plan/guard.ts). Every other tile, to this file's.
 */
export async function whoForTile(tile: unknown, write = false): Promise<Who | NextResponse> {
  if (typeof tile === "string" && /^plan:\d+$/.test(tile)) {
    const { planWho } = await import("../../action-plan/guard");
    return planWho(write);
  }
  return who(write, typeof tile === "string" ? reportPathOfPage(tile) : null);
}

export const fail = (e: unknown, status = 500) => NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e).slice(0, 300) }, { status });
