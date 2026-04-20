import { NextRequest, NextResponse } from "next/server";
import { addLogEntry, readLogs, setUserDefaults, type LogEntry } from "@/lib/logs";

export const runtime = "nodejs";

export async function GET() {
  const file = await readLogs();
  return NextResponse.json(file);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const asRecord = body as Record<string, unknown>;

  if (asRecord?.action === "setUserDefaults" && typeof asRecord.text === "string") {
    const file = await setUserDefaults(asRecord.text);
    return NextResponse.json(file);
  }

  const type = asRecord?.type;
  if (type !== "like" && type !== "dislike") {
    return NextResponse.json({ error: "type must be 'like' or 'dislike'" }, { status: 400 });
  }

  const entry = await addLogEntry({
    type,
    channel: String(asRecord.channel ?? ""),
    headline: typeof asRecord.headline === "string" ? asRecord.headline : undefined,
    body: typeof asRecord.body === "string" ? asRecord.body : undefined,
    prompt: typeof asRecord.prompt === "string" ? asRecord.prompt : undefined,
    filters: (asRecord.filters as Record<string, unknown>) ?? undefined,
    correction: typeof asRecord.correction === "string" ? asRecord.correction : undefined,
  } as Omit<LogEntry, "id" | "ts">);

  return NextResponse.json({ entry });
}