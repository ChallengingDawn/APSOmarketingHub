export type GenerationFilters = {
  contentType?: string;
  language?: string;
  framework?: string;
  audience?: string;
  category?: string;
  length?: string;
  creativity?: number;
  emphasizeTones?: string[];
  emphasizePhrases?: string[];
  wantsImage?: boolean;
};

type SimpleLog = { headline?: string; body?: string; correction?: string };

const AUDIENCE_IMAGE_HINT: Record<string, string> = {
  "Maintenance engineers":
    "industrial workshop, hands with tools (spanners, pliers), components on a workbench, worn-but-clean environment",
  "Procurement / buyers":
    "office-in-plant setting, parts boxes or catalogue pages, laptop with shop UI, neutral palette",
  "Design engineers":
    "engineering office, CAD station out of frame, physical prototype samples in hand, clean workshop context",
  "R&D engineers":
    "R&D lab, test rig, gloved hand holding a component under inspection",
  "Plant managers":
    "production floor overview, elevated angle over machinery, safety gear on nearby operator",
  "Production / operations":
    "live production line, machine in motion, operator in context",
  "Quality assurance":
    "QA bench, calipers/gauges, precision measurement of a part",
  "Automation engineers":
    "industrial automation setting, sensors and cables on a skid, control cabinet in background",
  "Facility managers":
    "building plant room, pipework, valves and facility infrastructure",
  "MRO / aftermarket technicians":
    "field service context, service van or toolbox, technician swapping a part on site",
  "OEM product managers":
    "OEM assembly line, subassembly in focus, premium industrial aesthetic",
  "Food & beverage engineers":
    "food-grade clean stainless environment, CIP piping, sanitary seals and fittings",
  "Chemical process engineers":
    "chemical process plant, stainless reactor or piping, chemical-resistant seals/gaskets, lab-adjacent cleanliness",
  "Pharma / GMP engineers":
    "GMP clean room, white surfaces, sanitary components, operator in clean garments",
  "Hydraulics & pneumatics specialists":
    "hydraulic power unit, pneumatic cylinders and fittings, pressure gauges visible",
  "Distributors / resellers":
    "warehouse aisle, neutral B2B logistics context, packaged components on racks",
  "C-level / technical directors":
    "wider plant overview, strategic calm composition, no close-up of hands",
};

const CATEGORY_IMAGE_HINT: Record<string, string> = {
  "Sealing Technology":
    "O-rings, gaskets and seals in real context (on a flange, hydraulic cylinder, or rotating shaft)",
  "Engineering Plastics Technology":
    "plastic sheets, rods, machined plastic parts (POM, PTFE, PEEK) in a fabrication context",
  "Fluid Handling Technology":
    "hoses, couplings, clamps, check valves on a fluid circuit",
  "Antivibration Technology":
    "vibration mounts, bushings, buffers installed on a machine frame",
  "Drive Technology":
    "timing belts, pulleys, couplings, brackets on a drive train",
  "Sensors and Power":
    "sensors, cables and control components wired on a machine",
};

export function buildFilterInstructions(filters: GenerationFilters | undefined): string {
  if (!filters) return "";
  const lines: string[] = [];

  if (filters.language === "DE") {
    lines.push(
      `- LANGUAGE: Output language is GERMAN (Deutsch). Write EVERY field — headline, body, imagePrompt — in fluent industrial German. Do not mix English and German. Keep brand names (APSOparts, Angst+Pfister, DirectCUT, Quickorder) untranslated.`
    );
  } else if (filters.language === "EN") {
    lines.push(`- LANGUAGE: Output language is ENGLISH. All fields in English.`);
  }

  if (filters.framework && filters.framework !== "auto") {
    const fw =
      filters.framework === "ican"
        ? "Use the 'I can do this now' framework: recognize a situation → early warning signs → simple guidance → remove friction."
        : filters.framework === "ease"
          ? "Use the 'Ease / feature focus' framework: highlight a concrete shop feature (DirectCUT, Quickorder, no-surcharge, 48/72h delivery) that removes friction."
          : filters.framework === "recognition"
            ? "Use the 'We've already met' framework: recognition narrative — the customer already knows these parts and this situation."
            : "";
    if (fw) lines.push(`- Framework: ${fw}`);
  }

  if (filters.audience) {
    lines.push(
      `- AUDIENCE (must drive vocabulary, pain points, and examples): ${filters.audience}. Do not default to generic "maintenance" framing unless the audience is actually maintenance.`
    );
  }

  if (filters.category) {
    lines.push(
      `- CATEGORY FOCUS: ${filters.category}. Every proposal must be relevant to this product family — mention the right material names, failure modes, and use cases for it.`
    );
  }

  if (filters.length) {
    const lenMap: Record<string, string> = {
      short: "Short — 80–120 words for posts, 2 sentences for headlines.",
      medium: "Medium — 140–220 words for posts, 1–2 paragraphs.",
      long: "Long — 300+ words, multiple short paragraphs with clear structure.",
    };
    lines.push(`- Length: ${lenMap[filters.length] ?? filters.length}`);
  }

  if (filters.emphasizeTones?.length) {
    lines.push(`- Emphasize these tone adjectives: ${filters.emphasizeTones.join(", ")}.`);
  }

  if (filters.emphasizePhrases?.length) {
    lines.push(
      `- Force-include (naturally, not forced) at least one of these signature phrases: ${filters.emphasizePhrases
        .map((p) => `"${p}"`)
        .join(" ; ")}.`
    );
  }

  // Image brief guidance
  if (filters.wantsImage !== false) {
    const audienceHint = filters.audience ? AUDIENCE_IMAGE_HINT[filters.audience] : undefined;
    const categoryHint = filters.category ? CATEGORY_IMAGE_HINT[filters.category] : undefined;
    const imgLines: string[] = [];
    if (audienceHint) imgLines.push(`audience-appropriate setting — ${audienceHint}`);
    if (categoryHint) imgLines.push(`show the right product family — ${categoryHint}`);
    if (imgLines.length) {
      lines.push(
        `- IMAGE BRIEF MUST MATCH: when you emit an imagePrompt / <image-brief>, the scene must be ${imgLines.join("; and ")}. Never fall back to a generic workshop/maintenance scene when the audience or category is different.`
      );
    }
  }

  return lines.length ? `\n\n# FILTERS (mandatory — override generic defaults)\n${lines.join("\n")}` : "";
}

export function buildFeedbackBlock(
  userDefaults: string,
  likes: SimpleLog[],
  dislikes: SimpleLog[]
): string {
  const parts: string[] = [];
  if (userDefaults?.trim()) {
    parts.push(`\n\n# USER DEFAULTS (always apply)\n${userDefaults.trim()}`);
  }
  if (likes.length) {
    const examples = likes
      .map(
        (l, i) =>
          `Example ${i + 1}:\n${l.headline ? `Headline: ${l.headline}\n` : ""}${l.body ?? ""}`
      )
      .join("\n\n---\n\n");
    parts.push(`\n\n# LIKED EXAMPLES (imitate style & framing)\n${examples}`);
  }
  if (dislikes.length) {
    const examples = dislikes
      .map((l, i) => {
        const sample = `${l.headline ? `Headline: ${l.headline}\n` : ""}${l.body ?? ""}`;
        const fix = l.correction ? `\nUser correction: ${l.correction}` : "";
        return `Example ${i + 1}:\n${sample}${fix}`;
      })
      .join("\n\n---\n\n");
    parts.push(`\n\n# DISLIKED EXAMPLES (avoid these patterns; apply corrections)\n${examples}`);
  }
  return parts.join("");
}
