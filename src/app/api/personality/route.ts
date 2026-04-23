import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    // Invalidate every page that depends on brain data so the next navigation
    // re-renders with the fresh values (composer dropdown, image studio
    // filters, photo guidelines etc.).
    revalidatePath("/personality");
    revalidatePath("/content-generation");
    revalidatePath("/photos");
    revalidatePath("/templates");
    revalidatePath("/");
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to write brain", details: String(err) },
      { status: 500 }
    );
  }
}