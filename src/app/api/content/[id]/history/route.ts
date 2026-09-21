import { NextResponse } from "next/server";
import { contentAccess } from "@/lib/auth/content-access";
import { contentHistory, getContent } from "@/lib/content";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await contentAccess();
    if (access.response) return access.response;
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const item = await getContent(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ revision: item.revision, history: await contentHistory(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load version history" }, { status: 500 });
  }
}
