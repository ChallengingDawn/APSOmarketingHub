import { NextRequest, NextResponse } from "next/server";
import { getContent, updateContent, isContentStatus, type ContentPatch } from "@/lib/content";

export const runtime = "nodejs";

const BODY_CAP = 200_000;

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
  let body: {
    status?: unknown;
    title?: unknown;
    body?: unknown;
    imageUrl?: unknown;
    scheduledFor?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: ContentPatch = {};
  if (body.status !== undefined) {
    if (!isContentStatus(body.status)) {
      return NextResponse.json(
        { error: "status must be one of draft|approved|published|archived" },
        { status: 400 }
      );
    }
    patch.status = body.status;
  }
  if (body.title !== undefined) {
    if (body.title !== null && typeof body.title !== "string") {
      return NextResponse.json({ error: "title must be a string or null" }, { status: 400 });
    }
    patch.title = body.title === null ? null : body.title.slice(0, 300);
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "body must be a non-empty string" }, { status: 400 });
    }
    if (body.body.length > BODY_CAP) {
      return NextResponse.json({ error: "body too large" }, { status: 413 });
    }
    patch.body = body.body;
  }
  if (body.imageUrl !== undefined) {
    if (body.imageUrl !== null && typeof body.imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl must be a string or null" }, { status: 400 });
    }
    patch.imageUrl = body.imageUrl as string | null;
  }
  if (body.scheduledFor !== undefined) {
    if (body.scheduledFor === null) {
      patch.scheduledFor = null;
    } else if (typeof body.scheduledFor === "string" && !Number.isNaN(Date.parse(body.scheduledFor))) {
      patch.scheduledFor = new Date(body.scheduledFor).toISOString();
    } else {
      return NextResponse.json(
        { error: "scheduledFor must be an ISO date string or null" },
        { status: 400 }
      );
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const item = await updateContent(id, patch);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[content:id] PATCH error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
