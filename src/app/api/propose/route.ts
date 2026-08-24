import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { readBrain, brandSystemPrompt } from "@/lib/brain";
import { readLogs, saveCurrentBatch } from "@/lib/logs";
import {
  buildFilterInstructions,
  buildFeedbackBlock,
  type GenerationFilters,
} from "@/lib/filters";
import { getAnthropic, channelBudget, claudeText } from "@/lib/ai/claude";
import { saveContent } from "@/lib/content";
import { getOptionalUser } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const maxDuration = 180;

type ProposeBody = {
  topic?: string;
  channel?: "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
  filters?: GenerationFilters;
  personaId?: string;
  personaIds?: string[];
};

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
  imagePending?: boolean;
};

const FALLBACK_IMAGES = ["/mood/oring.png", "/mood/no-surcharge.png", "/mood/oring.png"];

// Each of the three parallel proposals gets a distinct angle so they don't
// converge on the same idea (structured runs are near-deterministic).
const ANGLES = [
  `Angle for THIS proposal: problem-first. Name ONE specific failure scenario — a moment where something concretely goes wrong (a swollen O-ring found at inspection, a line down before the morning shift, a quote lost because raw material wasn't confirmed in time) — open the piece INSIDE that moment, then resolve it. The scenario must be specific enough that a reader thinks "that exact thing happened to us". No generic "downtime is costly" framing.`,
  `Angle for THIS proposal: ease-first. Pick exactly ONE named APSOparts shop capability — DirectCUT, Quickorder, DirectUP, no small-order surcharge, real-time stock visibility, or 48/72h delivery — and build the ENTIRE piece around it: the tedious manual process it replaces, what concretely changes in the reader's day, one before/after contrast. Do not stack or list multiple features; depth on one beats a tour of six.`,
  `Angle for THIS proposal: knowledge-first. Teach ONE rule of thumb an engineer would screenshot and keep — a material boundary (temperature/media limits), a comparison that settles a common either/or choice, or an inspection heuristic — stated crisply enough to be quoted in a meeting. The brand appears only as the competent source; no pitch, no feature list.`,
];

const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "Scroll-stopping opening line that also works as a standalone visual headline over an image: max 8 words, concrete, no colon-splitting, in the requested language.",
    },
    body: {
      type: "string",
      description:
        "The full channel content, exactly in the mandated channel format, in the requested language.",
    },
    imagePrompt: {
      type: "string",
      description:
        "Concrete brief for ONE photorealistic B2B industrial photograph with clean negative space in the lower-left third for a text overlay and no text of any kind in the image, or empty string when no image is wanted.",
    },
  },
  required: ["headline", "body", "imagePrompt"],
  additionalProperties: false,
} as const;

const channelExpectations: Record<string, string> = {
  linkedin: `The "body" MUST be an actual LinkedIn post (80–160 words, 1–3 short paragraphs with blank lines between them, a scroll-stopping first line, a soft CTA, and 2–4 hashtags at the bottom).`,
  newsletter: `The "body" MUST start with "Subject: ..." on line 1, "Preheader: ..." on line 2, then the email body (220–350 words, 2–4 short sections) ending with "— APSOparts".`,
  blog: `The "body" MUST be a 600–900 word blog article in markdown: "# H1", then 2–3 sentence intro, then 3–5 "## Section" headings (each opening with a direct 1–2 sentence answer), at least one bulleted list of specs or criteria, a closing "## FAQ" section with 3–5 self-contained Q&As (40–60 words each), and a trailing \`\`\`json fenced block with schema.org Article + FAQPage JSON-LD built from the actual content.`,
  ad: `The "body" MUST contain exactly three labelled lines: "HEADLINE: ...", "BODY: ...", "CTA: ...". No other text. Keep the total under 50 words.`,
  product: `The "body" MUST be a full product page using markdown H2 sections in this order: Product Summary, Key Benefits, Typical Applications, Material Explanation, Technical Specifications (markdown table Property | Value | Unit), Selection Guidance, Variants / Dimensions.`,
  seo: `The "body" MUST contain exactly five labelled blocks: "META TITLE: ...", "META DESCRIPTION: ...", "H1: ...", "INTRO PARAGRAPH: ...", "FAQ: ..." (3 lines "Q: ... — A: ..."). Nothing else. Obey char limits from the system prompt.`,
};

export async function POST(req: NextRequest) {
  let body: ProposeBody = {};
  try {
    body = (await req.json()) as ProposeBody;
  } catch {
    // allow empty body
  }
  const channel = body.channel ?? "linkedin";
  const topic = body.topic?.trim() ?? "";
  const filters = body.filters ?? {};
  const wantsImage =
    filters.wantsImage ?? (channel === "linkedin" || channel === "newsletter" || channel === "blog");

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured", proposals: [] },
      { status: 503 }
    );
  }

  try {
    const brain = await readBrain();
    const logs = await readLogs();
    const likes = logs.entries
      .filter((e) => e.type === "like" && (!e.channel || e.channel === channel))
      .slice(0, 6);
    const dislikes = logs.entries
      .filter((e) => e.type === "dislike" && (!e.channel || e.channel === channel))
      .slice(0, 6);
    const filtersForBrief: GenerationFilters = { ...filters, wantsImage };

    // Stable, cacheable brand/channel block + volatile filters/feedback block.
    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: brandSystemPrompt(brain, channel, body.personaIds?.length ? body.personaIds : body.personaId),
        cache_control: { type: "ephemeral" },
      },
    ];
    const volatile =
      buildFilterInstructions(filtersForBrief) +
      buildFeedbackBlock(logs.userDefaults, likes, dislikes);
    if (volatile.trim()) systemBlocks.push({ type: "text", text: volatile });

    const imageRule = wantsImage
      ? [
          `"imagePrompt": a 40-80 word brief for ONE photograph that accompanies this proposal. The brief MUST follow this recipe:`,
          `(a) a photorealistic professional B2B industrial marketing photograph directly relevant to the topic — name the concrete subject (the specific sealing component, polymer part, machine, material or engineering situation this proposal is about), shot in a real industrial context, never a generic workshop;`,
          `(b) composition MUST reserve generous clean negative space in the lower-left third of the frame — dark, out-of-focus, or a plain uncluttered surface — for a text overlay, and the brief must say this explicitly; the subject sits right of centre or in the upper half;`,
          `(c) subtle brand-compatible palette: deep navy and petrol tones with cool greys, at most one small red accent, no warm orange glow;`,
          `(d) soft directional light, shallow depth of field, premium editorial look;`,
          `(e) state that the image contains ABSOLUTELY NO text, letters, numbers, logos, watermarks, labels or UI — image models render these as gibberish;`,
          `(f) ONE single scene: no collage, no split frame, no CAD, no schematic, no white-background product shot, no stock-photo people in suits.`,
        ].join("\n")
      : `"imagePrompt": return an empty string.`;

    const budget = channelBudget(channel);
    const expectation = channelExpectations[channel] ?? "";

    // Three independent proposals in parallel — each gets its own token
    // budget (fixes the old single-call truncation on long channels) and a
    // guaranteed-valid JSON shape via structured outputs.
    const results = await Promise.all(
      ANGLES.map((angle) =>
        claudeText({
          client: anthropic,
          system: systemBlocks,
          user: [
            `Produce ONE ${channel} proposal${topic ? ` about: ${topic}` : ""}.`,
            ``,
            angle,
            ``,
            `Write like a senior industrial copywriter: specificity beats adjectives, and every claim is concrete — a number, a named feature, a material property, a recognisable situation — or it gets cut. The FIRST LINE of the "body" must work as a standalone visual headline: 8 words or fewer, concrete, no colon-splitting, readable on its own over an image. Before returning, read the draft once as the target reader would (skeptical, technical, short on time) and tighten anything that reads as marketing filler.`,
            ``,
            expectation ? `FORMAT (mandatory): ${expectation}` : ``,
            imageRule,
          ]
            .filter(Boolean)
            .join("\n"),
          budget,
          outputFormat: {
            type: "json_schema",
            schema: PROPOSAL_SCHEMA as unknown as Record<string, unknown>,
          },
        })
      )
    );

    const parsed: { headline: string; body: string; imagePrompt: string }[] = [];
    const errors: string[] = [];
    for (const r of results) {
      if (!r.ok) {
        errors.push(r.failure.error);
        continue;
      }
      try {
        parsed.push(JSON.parse(r.text));
      } catch {
        errors.push("Model returned unparseable JSON");
      }
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: errors[0] ?? "Proposal generation failed", proposals: [] },
        { status: 502 }
      );
    }

    const proposals: Proposal[] = parsed.slice(0, 3).map((p, i) => ({
      headline: p.headline ?? "",
      body: p.body ?? "",
      imagePrompt: p.imagePrompt ?? "",
      imageUrl: FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
      imageSource: "fallback",
      imagePending: Boolean(wantsImage && (p.imagePrompt?.trim() ?? "").length > 0),
    }));

    // Persist the batch so it can be rehydrated on the client next visit.
    await saveCurrentBatch({
      channel,
      filters,
      proposals,
      generatedAt: new Date().toISOString(),
    });

    // Every proposal also lands in the library as a draft (best-effort).
    try {
      const user = await getOptionalUser();
      await Promise.all(
        proposals.map((p) =>
          saveContent({
            channel,
            title: p.headline.slice(0, 160) || null,
            body: p.body,
            filters: filters as Record<string, unknown>,
            createdBy: user?.username ?? null,
          })
        )
      );
    } catch (err) {
      console.error("[propose] draft save failed", err);
    }

    return NextResponse.json({ proposals, ...(errors.length ? { partialErrors: errors } : {}) });
  } catch (err) {
    console.error("[propose] error", err);
    return NextResponse.json({ error: "Proposal generation failed" }, { status: 500 });
  }
}
