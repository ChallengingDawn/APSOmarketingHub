import { NextRequest, NextResponse } from "next/server";
import { readBrain, writeBrain, type Brain } from "@/lib/brain";

export async function GET() {
  try {
    const brain = await readBrain();
    return NextResponse.json(brain);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to read brain", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const next = (await req.json()) as Brain;
    await writeBrain(next);
    const saved = await readBrain();
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to write brain", details: String(err) },
      { status: 500 }
    );
  }
}