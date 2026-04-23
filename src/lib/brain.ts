import fs from "node:fs/promises";
import path from "node:path";

const BRAIN_PATH = path.join(process.cwd(), "src", "data", "brain.json");

export type Brain = {
  version: number;
  updatedAt: string;
  brandVoice: {
    strapline: string;
    storyline: string;
    seriesFramework: string;
    toneAdjectives: string[];
    audience: string;
    // Structured short list of the brand's actual target audiences. Populates
    // the audience dropdown in the content generator. Keep this in sync with
    // the prose `audience` description above.
    audiences?: string[];
    messagingPillars: string[];
    signaturePhrases: string[];
    dos: string[];
    donts: string[];
  };
  positioningGuard: {
    apsoparts: string;
    angstPfisterParent: string;
    rule: string;
  };
  productContentRules: {
    pageStructure: string[];
    styleRules: string[];
  };
  socialMediaRules: {
    primaryChannel: string;
    postTemplate: string[];
    lengthGuidance: string;
    visualRules: string[];
  };
  goldExamples: {
    linkedinPosts: { title: string; framework: string; category: string }[];
    paidAds: { headline: string; body: string }[];
  };
  keywordSignals: {
    internalSearchTrends: { term: string; signal: string }[];
    brandTermsMissingLandingPages: string[];
    externalListGaps: string;
  };
  categoryIntelligence: {
    topLevel: { en: string; de: string; code: string }[];
    totalLeafCategories: number;
    categoriesWithSeoText: number;
    contentGap: string;
  };
  photoGuidelines?: PhotoGuidelines;
  trainingSources: { file: string; type: string }[];
};

export type PhotoGuidelines = {
  imageDNA: {
    purpose: string;
    moodAdjectives: string[];
    lighting: string;
    palette: string;
    framing: string;
    depthOfField: string;
    anpFamilyRule: string;
  };
  sceneRules: string[];
  hardNo: string[];
  audienceSceneHints: Record<string, string>;
  categorySceneHints: Record<string, string>;
  midjourneyTranslation: {
    note: string;
    patterns: { mj: string; gemini: string }[];
  };
  goldImageReferences: { title: string; url: string; notes: string }[];
};

export async function readBrain(): Promise<Brain> {
  const raw = await fs.readFile(BRAIN_PATH, "utf8");
  return JSON.parse(raw) as Brain;
}

export async function writeBrain(next: Brain): Promise<void> {
  next.updatedAt = new Date().toISOString();
  await fs.writeFile(BRAIN_PATH, JSON.stringify(next, null, 2), "utf8");
}

const CHANNEL_RULES: Record<string, string[]> = {
  linkedin: [
    `# LINKEDIN POST RULES`,
    `- Length: 80–160 words total. Short paragraphs (1–3 lines each), blank line between them. Mobile-first.`,
    `- Open with a scroll-stopping hook in the FIRST line (a sharp observation, a question, or a specific number) — not a greeting.`,
    `- Use the "I can do this now" framework where it fits: recognize situation → early signs → simple guidance → remove friction.`,
    `- End with a light CTA that invites a comment or a click (question, "what's your take?", link to a product family). No pushy sales language.`,
    `- 2–4 tasteful hashtags at the very bottom, industry-relevant (#SealingTechnology, #IndustrialMaintenance, #MRO, #B2B). No emoji spam — at most 1 subtle emoji if it genuinely fits.`,
    `- Never use "Excited to announce", "We are thrilled", or any promotional cliché.`,
  ],
  newsletter: [
    `# NEWSLETTER RULES (email)`,
    `- Start with a concrete SUBJECT LINE on its own line (max 60 chars, specific, curiosity-driven, no clickbait): "Subject: ..."`,
    `- Then a PREHEADER line (max 90 chars): "Preheader: ..."`,
    `- Then the body — 220–350 words, conversational but scannable. Use 2–4 short sections with bold inline labels or "→" bullets instead of heavy markdown headings.`,
    `- Always include ONE clear primary link or CTA at the end (shop category, DirectCUT configurator, a specific product family). Inline, not a button.`,
    `- Sign off with "— APSOparts" on its own line.`,
    `- Never copy-paste social post style; it has to feel like a peer sending an email, not a LinkedIn broadcast.`,
  ],
  blog: [
    `# BLOG ARTICLE RULES`,
    `- Length: 600–900 words. Written as a useful technical article, not a promo piece.`,
    `- Structure: an H1 title (one line, clear and specific), a 2–3 sentence intro that frames the problem, then 3–5 H2 sections that answer it in order, and a short "Choose this if / Consider alternatives if" closing block.`,
    `- Use markdown: "# Title", "## Section" headings, "-" bullets, short paragraphs. No H3 unless truly needed.`,
    `- Include at least one numbered/bulleted list with concrete specs or decision criteria. Units in SI (°C, Shore A, mm, bar).`,
    `- Optionally cite a real APSOparts feature (DirectCUT, Quickorder, 48/72h delivery) in ONE place where it's genuinely useful, not as an ad.`,
    `- No meta-talk ("In this article, we will explore…"); get into the substance immediately.`,
  ],
  ad: [
    `# PAID AD RULES (LinkedIn / display)`,
    `- Total length: under 50 words. Every word earns its place.`,
    `- Return in this exact shape, one item per line:`,
    `  HEADLINE: <max 10 words, scroll-stopping, no question mark unless essential>`,
    `  BODY: <max 25 words, one sentence, concrete benefit + one proof point>`,
    `  CTA: <max 4 words, imperative — "Shop O-rings", "Configure DirectCUT", "Get 48h delivery">`,
    `- Never use superlatives without a number. Never use "Discover", "Unlock", "Revolutionary".`,
    `- Reuse one signature phrase naturally ("We've already met", "One click away", "I can do this now").`,
  ],
  product: [
    `# PRODUCT PAGE RULES (PDP)`,
    `- Output MUST follow this exact structure with markdown headings in this order:`,
    `  ## Product Summary  — 2–3 sentences, states what it is and what decision it solves.`,
    `  ## Key Benefits  — 3–5 bullets, each one benefit + why it matters.`,
    `  ## Typical Applications  — 3–5 bullets with concrete industries/use cases.`,
    `  ## Material Explanation  — 1–2 short paragraphs on material behaviour in plain industrial language.`,
    `  ## Technical Specifications  — a markdown table with at least these columns: Property | Value | Unit. Units in SI.`,
    `  ## Selection Guidance  — "Choose this if …" bullets followed by "Consider alternatives if …" bullets.`,
    `  ## Variants / Dimensions  — short list of the common sizes/variants.`,
    `- Write for a decision-maker, not a data delivery form. Translate specs into user value.`,
    `- No marketing clichés, no emojis, no "Engineered to perfection".`,
  ],
  seo: [
    `# SEO META RULES`,
    `- Return in this exact shape, one item per line — nothing else:`,
    `  META TITLE: <50–60 characters, ends with " | APSOparts" or " | APSOparts Shop">`,
    `  META DESCRIPTION: <140–155 characters, includes the primary keyword naturally, one concrete value prop, no clickbait>`,
    `  H1: <clear, includes primary keyword, no brand name>`,
    `  INTRO PARAGRAPH: <80–120 words, 2 short paragraphs at most, primary keyword in the first sentence, one secondary keyword somewhere else, ends with a natural internal link suggestion like "See all <category> at APSOparts.">`,
    `- Use German only if the filters ask for it; otherwise English.`,
    `- No keyword stuffing — each keyword appears at most twice in the intro.`,
  ],
};

export function brandSystemPrompt(brain: Brain, channel?: string): string {
  const bv = brain.brandVoice;
  const pg = brain.positioningGuard;
  const sm = brain.socialMediaRules;
  const pc = brain.productContentRules;

  const isSocial = channel === "linkedin" || channel === "newsletter";
  const isProduct = channel === "product" || channel === "seo";

  const channelRules = channel && CHANNEL_RULES[channel] ? CHANNEL_RULES[channel] : [];

  return [
    `You are the APSOparts marketing content assistant. You write on behalf of APSOparts — a B2B e-commerce brand for standard industrial components (seals, plastics, fluid, drive, antivibration, sensors).`,
    ``,
    `# BRAND VOICE`,
    `Strapline: "${bv.strapline}"`,
    `Storyline: "${bv.storyline}"`,
    `Series framework: "${bv.seriesFramework}"`,
    `Audience: ${bv.audience}`,
    `Tone adjectives: ${bv.toneAdjectives.join(", ")}`,
    ``,
    `# MESSAGING PILLARS`,
    ...bv.messagingPillars.map((p) => `- ${p}`),
    ``,
    `# SIGNATURE PHRASES (reuse naturally, do not force)`,
    ...bv.signaturePhrases.map((p) => `- "${p}"`),
    ``,
    `# DO`,
    ...bv.dos.map((d) => `- ${d}`),
    ``,
    `# DO NOT`,
    ...bv.donts.map((d) => `- ${d}`),
    ``,
    `# POSITIONING GUARD`,
    `APSOparts lane: ${pg.apsoparts}`,
    `Parent brand (Angst+Pfister) lane: ${pg.angstPfisterParent}`,
    `Rule: ${pg.rule}`,
    ...(channelRules.length ? ["", ...channelRules] : []),
    ...(isSocial
      ? [
          ``,
          `# BRAND SOCIAL MEDIA STYLE`,
          `Primary channel: ${sm.primaryChannel}`,
          `Length: ${sm.lengthGuidance}`,
          `Post template:`,
          ...sm.postTemplate.map((s, i) => `${i + 1}. ${s}`),
          ``,
          `# GOLD LINKEDIN EXAMPLES (titles — match this tone)`,
          ...brain.goldExamples.linkedinPosts.map((p) => `- ${p.title} [${p.framework}]`),
        ]
      : []),
    ...(isProduct
      ? [
          ``,
          `# BRAND PRODUCT CONTENT STYLE`,
          `Page structure reference:`,
          ...pc.pageStructure.map((s, i) => `${i + 1}. ${s}`),
          ``,
          `Style:`,
          ...pc.styleRules.map((s) => `- ${s}`),
        ]
      : []),
  ].join("\n");
}