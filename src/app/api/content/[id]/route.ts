import { NextRequest, NextResponse } from "next/server";
import { getContent, updateContent } from "@/lib/content";
import { contentPatchSchema } from "@/lib/content-edit";
import { contentAccess } from "@/lib/auth/content-access";
import { readBoundedJson } from "@/lib/read-json";

export const runtime = "nodejs";
const BODY_LIMIT = 16 * 1024 * 1024;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await contentAccess();
    if (access.response) return access.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const item = await getContent(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[content:id] GET error", err);
    return NextResponse.json({ error: "Unable to load this item" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await contentAccess(true);
    if (access.response) return access.response;
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    let body: unknown;
    try { body = await readBoundedJson(req, BODY_LIMIT); }
    catch (err) {
      const large = err instanceof Error && err.message === "Payload too large";
      return NextResponse.json({ error: large ? "Design exceeds the 16 MB save limit" : "Invalid JSON" }, { status: large ? 413 : 400 });
    }
    const parsed = contentPatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 });
    const item = await updateContent(id, parsed.data, access.user.username);
    if (!item) {
      const current = await getContent(id);
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ error: "Someone saved a newer version. Your changes are still here. Open the latest version before trying again.", currentRevision: current.revision }, { status: 409 });
    }
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[content:id] PATCH error", err);
    return NextResponse.json({ error: "Unable to save. Your changes have not been discarded." }, { status: 500 });
  }
}
