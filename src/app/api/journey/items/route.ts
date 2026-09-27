// Editing the board.
//
// One endpoint, four verbs: add a card, change its text, tick it off, remove it,
// or move it to another stage or lane. Every write stores the whole definition
// back, which is cheap at this size and keeps "what did the board look like on
// Monday" answerable from one row.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { ITEM_KINDS, type JourneyItem, type JourneyItemKind } from "@/lib/journey/model";
import { loadJourney, saveJourney } from "@/lib/journey/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 400;
const isKind = (value: unknown): value is JourneyItemKind =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ITEM_KINDS, value);

type Body = {
  action?: "add" | "edit" | "toggle" | "delete" | "move";
  id?: string;
  stageId?: string;
  kind?: string;
  text?: string;
  toStageId?: string;
  toKind?: string;
};

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "viewer") {
    return NextResponse.json({ ok: false, error: "Your account can read the journey but not change it." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action) return NextResponse.json({ ok: false, error: "No action given." }, { status: 400 });

  const model = await loadJourney();
  if (!model) return NextResponse.json({ ok: false, error: "There is no journey to edit." }, { status: 404 });

  const items = [...model.items];
  const find = (id: string) => items.findIndex((i) => i.id === id);
  const now = new Date().toISOString();
  const who = user.email ?? user.username;

  switch (body.action) {
    case "add": {
      const text = (body.text ?? "").trim();
      if (!text) return NextResponse.json({ ok: false, error: "The card needs some text." }, { status: 400 });
      if (text.length > MAX_TEXT) return NextResponse.json({ ok: false, error: `Keep it under ${MAX_TEXT} characters.` }, { status: 400 });
      if (!isKind(body.kind)) return NextResponse.json({ ok: false, error: "Unknown lane." }, { status: 400 });
      if (!model.stages.some((s) => s.id === body.stageId)) {
        return NextResponse.json({ ok: false, error: "Unknown stage." }, { status: 400 });
      }
      const order = items.filter((i) => i.stageId === body.stageId && i.kind === body.kind).length;
      const item: JourneyItem = {
        id: `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        stageId: body.stageId!,
        kind: body.kind,
        text,
        origin: "app",
        addedBy: who,
        addedAt: now,
        order,
        done: false,
      };
      items.push(item);
      break;
    }
    case "edit": {
      const at = find(body.id ?? "");
      if (at < 0) return NextResponse.json({ ok: false, error: "That card is gone." }, { status: 404 });
      const text = (body.text ?? "").trim();
      if (!text) return NextResponse.json({ ok: false, error: "The card needs some text." }, { status: 400 });
      items[at] = { ...items[at], text: text.slice(0, MAX_TEXT), addedBy: who, addedAt: now };
      break;
    }
    case "toggle": {
      const at = find(body.id ?? "");
      if (at < 0) return NextResponse.json({ ok: false, error: "That card is gone." }, { status: 404 });
      items[at] = { ...items[at], done: !items[at].done };
      break;
    }
    case "delete": {
      const at = find(body.id ?? "");
      if (at < 0) return NextResponse.json({ ok: false, error: "That card is gone." }, { status: 404 });
      items.splice(at, 1);
      break;
    }
    case "move": {
      const at = find(body.id ?? "");
      if (at < 0) return NextResponse.json({ ok: false, error: "That card is gone." }, { status: 404 });
      const toStage = body.toStageId ?? items[at].stageId;
      const toKind = isKind(body.toKind) ? body.toKind : items[at].kind;
      if (!model.stages.some((s) => s.id === toStage)) {
        return NextResponse.json({ ok: false, error: "Unknown stage." }, { status: 400 });
      }
      const order = items.filter((i) => i.stageId === toStage && i.kind === toKind).length;
      items[at] = { ...items[at], stageId: toStage, kind: toKind, order };
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  const next = {
    ...model,
    items,
    source: { ...model.source, lastEditedBy: who, lastEditedAt: now },
  };
  try {
    await saveJourney(next);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `The change could not be saved: ${String((err as Error)?.message ?? err)}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, model: next });
}
