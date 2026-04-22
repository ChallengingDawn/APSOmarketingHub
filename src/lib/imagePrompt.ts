import type { Brain } from "@/lib/brain";
import type { GenerationFilters } from "@/lib/filters";

export type ImagePromptInput = {
  brief: string;
  filters?: GenerationFilters;
  referenceNotes?: string;
  aspect?: "1:1" | "16:9" | "4:5" | "3:2";
};

export function buildImagePrompt(brain: Brain, input: ImagePromptInput): string {
  const g = brain.photoGuidelines;
  const sections: string[] = [];

  sections.push(
    "Generate ONE photorealistic editorial photograph for APSOparts (B2B industrial e-commerce, parent brand: Angst+Pfister)."
  );
  sections.push(`SUBJECT BRIEF: ${input.brief.trim()}`);

  if (input.aspect && input.aspect !== "1:1") {
    const fmt: Record<string, string> = {
      "16:9": "wide cinematic horizontal frame (16:9)",
      "4:5": "vertical social-feed frame (4:5)",
      "3:2": "classic 35mm horizontal frame (3:2)",
    };
    sections.push(`FRAMING: ${fmt[input.aspect]}.`);
  } else {
    sections.push("FRAMING: square 1:1 frame.");
  }

  // Creativity = strictness signal. Low creativity = the brief is a literal
  // instruction; high = the model has room to interpret. This is the single
  // most useful knob against hallucination — a low-creativity image must hew
  // to the literal scene, not invent additional elements.
  const creativity =
    typeof input.filters?.creativity === "number" ? input.filters.creativity : 70;
  if (creativity <= 30) {
    sections.push(
      `STRICTNESS: HIGH (creativity ${creativity}/100). Reproduce the brief literally. Do NOT invent extra props, extra people, decorative elements, or scene drama. If the brief mentions one component, show one. If it mentions one operation, show that exact operation — no embellishment.`
    );
  } else if (creativity <= 60) {
    sections.push(
      `STRICTNESS: MEDIUM (creativity ${creativity}/100). Stay close to the brief. Modest tasteful additions (background context that fits the scene) are fine, but do not invent additional people, additional operations, or fictional tools.`
    );
  } else {
    sections.push(
      `STRICTNESS: RELAXED (creativity ${creativity}/100). Interpret the brief with editorial flair, but every visible tool must still match the operation realistically (see SCENE RULES).`
    );
  }

  if (g) {
    sections.push("");
    sections.push("# IMAGE DNA (must be respected on every image)");
    sections.push(`Mood: ${g.imageDNA.moodAdjectives.join(", ")}.`);
    sections.push(`Lighting: ${g.imageDNA.lighting}`);
    sections.push(`Palette: ${g.imageDNA.palette}`);
    sections.push(`Framing convention: ${g.imageDNA.framing}`);
    sections.push(`Depth of field: ${g.imageDNA.depthOfField}`);
    sections.push(`Cross-brand rule: ${g.imageDNA.anpFamilyRule}`);

    sections.push("");
    sections.push("# SCENE RULES (mandatory — pick the right tools and operations)");
    for (const r of g.sceneRules) sections.push(`- ${r}`);

    sections.push("");
    sections.push("# HARD NO (do NOT produce)");
    for (const r of g.hardNo) sections.push(`- ${r}`);
  }

  const audienceHint =
    input.filters?.audience && g?.audienceSceneHints[input.filters.audience];
  if (audienceHint) {
    sections.push("");
    sections.push("# AUDIENCE-APPROPRIATE SETTING (must match)");
    sections.push(`Audience: ${input.filters!.audience}.`);
    sections.push(`Setting: ${audienceHint}.`);
  }

  const categoryHint =
    input.filters?.category && g?.categorySceneHints[input.filters.category];
  if (categoryHint) {
    sections.push("");
    sections.push("# CATEGORY-CORRECT CONTEXT (must match)");
    sections.push(`Category: ${input.filters!.category}.`);
    sections.push(`Required context: ${categoryHint}.`);
    sections.push(
      "If the subject brief contradicts the category-correct context (e.g. 'cutting plastic with a knife' for a plastics-machining category), TRUST THE CATEGORY CONTEXT and generate the realistic operation, not the literal brief."
    );
  }

  if (g?.midjourneyTranslation?.patterns?.length) {
    sections.push("");
    sections.push("# STYLE ANCHORS (match the visual language of these examples)");
    for (const p of g.midjourneyTranslation.patterns.slice(0, 3)) {
      sections.push(`- ${p.gemini}`);
    }
  }

  if (input.referenceNotes?.trim()) {
    sections.push("");
    sections.push("# USER-PROVIDED REFERENCES");
    sections.push(input.referenceNotes.trim());
  }

  // ── Anti-hallucination terminal block ─────────────────────────────────
  // Repeat the category override and the highest-violation rules right at the
  // end so the model cannot "drift" through a long prompt and forget them.
  sections.push("");
  sections.push("# FINAL CHECKLIST — verify BEFORE producing the image:");
  sections.push(
    "1. Tools must match the operation. Cutting plastic stock = CNC mill / bandsaw / precision saw, NEVER a hand cutter or utility knife. Replacing an O-ring = pick tool, NEVER pliers. Tightening a fitting = correct-size wrench, NEVER a generic adjustable spanner on a precision component."
  );
  sections.push(
    "2. No invented props. Do not add components, people, machinery, or workshop elements that the brief did not request. Empty space is acceptable."
  );
  sections.push(
    "3. Hands and gloves must match the context (bare for clean small-seal assembly, nitrile for chemical/food/pharma, leather for heavy hardware). Hands must hold tools in physically plausible ways."
  );
  sections.push(
    "4. No CAD, no isolated white-bg product shots, no stock-photo people in suits, no promotional badges or rendered text overlays, no fear/catastrophe drama."
  );
  sections.push(
    "5. Lighting is soft and natural. No glossy studio rim-light. No HDR. No neon."
  );
  if (categoryHint) {
    sections.push(
      `6. The scene must look like the production context for ${input.filters!.category}: ${categoryHint}. If the brief drifts, the category wins.`
    );
  }

  return sections.join("\n");
}