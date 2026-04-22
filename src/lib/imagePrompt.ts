import type { Brain, PhotoGuidelines } from "@/lib/brain";
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

  // Aspect (Gemini Nano Banana Pro respects framing cues but not strict --ar; we tell it descriptively).
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

  // Audience-driven scene hint.
  const audienceHint =
    input.filters?.audience && g?.audienceSceneHints[input.filters.audience];
  if (audienceHint) {
    sections.push("");
    sections.push("# AUDIENCE-APPROPRIATE SETTING (must match)");
    sections.push(`Audience: ${input.filters!.audience}.`);
    sections.push(`Setting: ${audienceHint}.`);
  }

  // Category-driven scene hint — this is what stops "hand-cutting plastic" type errors.
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

  // Midjourney pattern translation hint — gives Gemini concrete style anchors.
  if (g?.midjourneyTranslation?.patterns?.length) {
    sections.push("");
    sections.push("# STYLE ANCHORS (match the visual language of these examples)");
    for (const p of g.midjourneyTranslation.patterns.slice(0, 3)) {
      sections.push(`- ${p.gemini}`);
    }
  }

  // Reference notes uploaded by the user.
  if (input.referenceNotes?.trim()) {
    sections.push("");
    sections.push("# USER-PROVIDED REFERENCES");
    sections.push(input.referenceNotes.trim());
  }

  // Final terminal guards — repeat the most-violated rules at the end so the model
  // does not "forget" them after a long prompt.
  sections.push("");
  sections.push(
    "FINAL CHECKS before generating: (1) Is every tool the correct tool for the operation shown? (2) Is the lighting natural and soft, not glossy studio? (3) No CAD, no white-isolated product shot, no stock-suit people, no promotional badges or rendered text overlays. (4) Does the scene look like an honest workshop / lab / plant a real engineer would recognize?"
  );

  return sections.join("\n");
}