// The release step's upload: the hub's released code, scrubbed (scripts/sandbox-snapshot.mjs), as one .tar.gz -
// what `sbx pull` hands out. The hub's link key, like the feed; 404 anywhere but the sandbox copy.

import { NextRequest, NextResponse } from "next/server";
import { isSandbox } from "@/lib/sandbox/mode";
import { hubKeyOk } from "@/lib/sandbox/link";
import { saveSnapshot } from "@/lib/sandbox/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hubKeyOk(req.headers.get("authorization"), process.env.SANDBOX_LINK_KEY_SHA256)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sha = req.headers.get("x-snapshot-sha") ?? "";
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return NextResponse.json({ error: "x-snapshot-sha missing" }, { status: 400 });
  const tar = Buffer.from(await req.arrayBuffer());
  if (tar.length < 100 || tar[0] !== 0x1f || tar[1] !== 0x8b) return NextResponse.json({ error: "not a .tar.gz" }, { status: 400 });
  await saveSnapshot(sha, tar);
  return NextResponse.json({ ok: true, sha, bytes: tar.length });
}
