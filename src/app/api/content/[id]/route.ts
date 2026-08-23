import { NextRequest, NextResponse } from "next/server";
import { getContent, updateContentStatus, isContentStatus } from "@/lib/content";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const item = await getContent(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[content:id] GET error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isContentStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be one of draft|approved|published|archived" },
      { status: 400 }
    );
  }
  try {
    const item = await updateContentStatus(id, body.status);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[content:id] PATCH error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
