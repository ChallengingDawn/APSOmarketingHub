import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";

export const runtime = "nodejs";
export const maxDuration = 30;

type SuggestBody = {
  page: string;
  channel?: string;
};

const FALLBACKS: Record<string, string[]> = {
  linkedin: [
    "Draft a 'I can do this now' post about O-ring replacement warning signs",
    "Write a short LinkedIn post about DirectCUT for cut-to-size plastics",
    "Create a 'No Surcharge for Small Orders' follow-up post",
  ],
  newsletter: [
    "Draft a monthly newsletter intro highlighting FFKM availability (6× demand spike)",
    "Write a section on preventive seal maintenance tips",
    "Create a feature spotlight on Quickorder for returning customers",
  ],
  blog: [
    "Write a blog post: 'PTFE Seals — Chemical Resistance Explained'",
    "Draft a comparison article: EPDM vs NBR for food-grade applications",
    "Create a technical guide on selecting hose clamps for industrial use",
  ],
  seo: [
    "Generate SEO category text for an empty O-ring variants leaf category",
    "Write meta title + description for PTFE products (EN + DE)",
    "Draft a branded landing page outline for 'Kapsto' protective caps",
  ],
  studio: [
    "Draft a visual brief for a 'Hands holding an O-ring' mood shot",
    "Suggest 3 variations of the 'We've already met' ad headline",
    "Create a LinkedIn carousel outline: 5 Signs Your Seal Needs Replacement",
  ],
  calendar: [
    "Suggest a 4-week LinkedIn content plan around the I-can-do-this-now series",
    "Draft a publication schedule for Q2 focused on Sealing Technology",
    "Propose a newsletter cadence aligned with the product launch roadmap",
  ],
  analytics: [
    "Summarize what the FFKM search spike means for content priorities",
    "Identify the 3 biggest SEO content gaps from the category structure",
    "Draft a weekly KPI brief for the marketing team",
  ],
  "knowledge-base": [
    "Outline a knowledge-base article on the 'I can do this now' framework",
    "Draft an entry on the APSOparts vs Angst+Pfister positioning rule",
    "Create a quick reference for signature phrases and when to use them",
  ],
  audit: [
    "Summarize today's content decisions for the audit log",
    "Draft a compliance note on APSOparts brand guardrails",
    "Write a change log entry for a brain voice update",
  ],
  default: [
    "Write a short LinkedIn post about the APSOparts 48/72h EU delivery promise",
    "Draft SEO meta copy for one of the 304 empty leaf categories",
    "Suggest a 'We've already met' campaign angle",
  ],
};

function fallback(page: string): string[] {
  const key = page.replace(/^\//, "").split("/")[0] || "default";
  return FALLBACKS[key] ?? FALLBACKS.default;
}

export async function POST(req: NextRequest) {
  let body: SuggestBody;
  try {
    body = (await req.json()) as SuggestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { page, channel } = body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ suggestions: fallback(page), fallback: true });
  }

  try {
    const brain = await readBrain();
    const system = brandSystemPrompt(brain, channel);
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0.8,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `The user is currently on the "${page}" page${
            channel ? ` (channel: ${channel})` : ""
          } of the APSOmarketingHub. Propose exactly 3 short, specific content prompts the user could click to kick off a generation. Each prompt must be one line, under 100 characters, and actionable (e.g. "Draft a LinkedIn post about..."). Return them as a plain numbered list (1. ... 2. ... 3. ...) with no extra commentary.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    const suggestions = text
      .split("\n")
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 3);

    if (suggestions.length < 3) {
      return NextResponse.json({ suggestions: fallback(page), fallback: true });
    }

    return NextResponse.json({ suggestions, fallback: false });
  } catch {
    return NextResponse.json({ suggestions: fallback(page), fallback: true });
  }
}