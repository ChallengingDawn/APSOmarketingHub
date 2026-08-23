import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { buildFilterInstructions, type GenerationFilters } from "@/lib/filters";
import { getAnthropic, claudeText } from "@/lib/ai/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  channel?: string;
  topic?: string;
  personaId?: string;
  personaIds?: string[];
  filters?: GenerationFilters;
};

/**
 * Brief enhancer: expands a thin topic into a rich creative brief grounded in
 * the brain (demand signals, category intel, persona) BEFORE generation.
 * A better brief is the cheapest lever for better content.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const topic = body.topic?.trim();
  const channel = body.channel ?? "linkedin";
  if (!topic) return NextResponse.json({ error: "Missing topic" }, { status: 400 });

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  try {
    const brain = await readBrain();
    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: brandSystemPrompt(brain, channel, body.personaIds?.length ? body.personaIds : body.personaId),
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: buildFilterInstructions(body.filters),
      },
    ];
    const result = await claudeText({
      client: anthropic,
      system,
      user: [
        `A marketer typed this raw topic for a ${channel} piece:`,
        ``,
        `"${topic}"`,
        ``,
        `Expand it into a sharp creative brief the content engine can execute brilliantly. Return EXACTLY this plain-text structure (no markdown headers):`,
        `TOPIC: <one tightened sentence stating what the piece is about>`,
        `ANGLE: <the specific angle that makes it worth reading — tie it to a real pain, demand signal, or buying moment from the context you have>`,
        `HOOK: <a concrete first-line hook suggestion>`,
        `MUST COVER: <2-4 bullet points "- ..." of specific facts, comparisons or decision criteria to include — only verifiable material knowledge, never invented numbers>`,
        `CTA: <the natural next step for this reader>`,
        ``,
        `Keep the whole brief under 140 words. Write it in English regardless of the output language filter (the brief steers generation; the generation obeys the language filter).`,
      ].join("\n"),
      budget: { maxTokens: 2000, effort: "low" },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.failure.error }, { status: result.failure.status });
    }
    return NextResponse.json({ brief: result.text });
  } catch (err) {
    console.error("[brief] error", err);
    return NextResponse.json({ error: "Brief enhancement failed" }, { status: 500 });
  }
}
