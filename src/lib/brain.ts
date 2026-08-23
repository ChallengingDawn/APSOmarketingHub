import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet } from "./db/init";

// Bundled baseline — used to seed the database on first read and as a
// read-only fallback when the database is unreachable.
const BRAIN_PATH = path.join(process.cwd(), "src", "data", "brain.json");

const BRAIN_KEY = "brain";

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
  personas?: Persona[];
  trainingSources: { file: string; type: string }[];
};

export type PersonaDemographics = {
  age: string;
  incomeRange: string;
  education: string;
  location: string;
};

export type Persona = {
  id: string;                // stable slug, e.g. "p1_dach_oem_purchaser"
  code: string;              // short code shown in UI: "P1"..."P8"
  name: string;              // archetype name: "Markus Weber"
  role: string;              // role label: "DACH OEM Strategic Purchaser"
  description: string;       // 1-line positioning
  internalNotes: string;     // HubSpot filter + population stats
  roles: string;             // expanded role/seniority paragraph
  goals: string;
  challenges: string;
  demographics: PersonaDemographics;
  story: string;             // narrative
  hubspotValue: string;      // hs_persona internal value (persona_2 etc.)
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
  try {
    const stored = await kvGet<Brain>(BRAIN_KEY);
    if (stored) return stored;
  } catch {
    // Database unreachable — fall through to the bundled file so generation
    // keeps working read-only.
  }
  const raw = await fs.readFile(BRAIN_PATH, "utf8");
  const brain = JSON.parse(raw) as Brain;
  try {
    await kvSet(BRAIN_KEY, brain);
  } catch {
    // Seeding is best-effort; the next successful write will persist it.
  }
  return brain;
}

export async function writeBrain(next: Brain): Promise<void> {
  next.updatedAt = new Date().toISOString();
  await kvSet(BRAIN_KEY, next);
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
    `- Structure: an H1 title (one line, clear and specific), a 2–3 sentence intro that frames the problem, then 3–5 H2 sections that answer it in order, a short "Choose this if / Consider alternatives if" closing block, then a "## FAQ" section.`,
    `- Use markdown: "# Title", "## Section" headings, "-" bullets, short paragraphs. No H3 unless truly needed.`,
    `- Include at least one numbered/bulleted list with concrete specs or decision criteria. Units in SI (°C, Shore A, mm, bar).`,
    `- Optionally cite a real APSOparts feature (DirectCUT, Quickorder, 48/72h delivery) in ONE place where it's genuinely useful, not as an ad.`,
    `- No meta-talk ("In this article, we will explore…"); get into the substance immediately.`,
    ``,
    `# GEO RULES (write so AI answer engines cite this article)`,
    `- Every "## Section" opens with a DIRECT 1–2 sentence answer to the question its heading implies — never a run-up like "Let's look at why...". AI engines quote section openings.`,
    `- Each section must contain at least one self-contained block of 40–60 words that makes complete sense with zero surrounding context (a definition, a rule of thumb, a spec comparison). Bullets, numbered lists, and comparison tables beat paragraph walls.`,
    `- Prefer specific, dated, verifiable facts over vague claims ("EPDM handles −40 °C to +130 °C" beats "EPDM handles a wide temperature range"). Use ONLY facts supplied in this prompt or general well-established material science — NEVER invent statistics, percentages, or study citations. If no verified number exists, write without one.`,
    `- Close with "## FAQ": 3–5 questions phrased the way a customer would ask them, each answered in ONE self-contained 40–60-word paragraph.`,
    `- After the article, append a fenced \`\`\`json code block containing schema.org JSON-LD: an Article object (headline, description) plus a FAQPage object built ONLY from the FAQ section's actual questions and answers. Nothing invented.`,
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
    `  FAQ: <exactly 3 lines, each "Q: <customer-phrased question> — A: <one self-contained 40–60-word answer>". These feed the page's FAQ block and JSON-LD.>`,
    `- Use German only if the filters ask for it; otherwise English.`,
    `- No keyword stuffing — each keyword appears at most twice in the intro.`,
    `- GEO: the INTRO PARAGRAPH's first sentence must directly answer the searcher's implied question (what/which/how) — AI answer engines extract opening sentences. Facts must be verifiable; never invent numbers.`,
  ],
};

// Channels whose output contract REQUIRES markdown. Everything else must be
// plain text (LinkedIn/email render markdown literally).
const MARKDOWN_CHANNELS = new Set(["blog", "product"]);

export function brandSystemPrompt(
  brain: Brain,
  channel?: string,
  personaId?: string
): string {
  const bv = brain.brandVoice;
  const pg = brain.positioningGuard;
  const sm = brain.socialMediaRules;
  const pc = brain.productContentRules;
  const persona = personaId
    ? (brain.personas ?? []).find((p) => p.id === personaId)
    : undefined;

  const isSocial = channel === "linkedin" || channel === "newsletter";
  const isProduct = channel === "product" || channel === "seo";
  // Channels that benefit from real demand/category data in the prompt.
  const wantsIntelligence =
    channel === "blog" || channel === "seo" || channel === "product" || channel === "freeform";
  const usesMarkdown = channel ? MARKDOWN_CHANNELS.has(channel) : false;

  const channelRules = channel && CHANNEL_RULES[channel] ? CHANNEL_RULES[channel] : [];

  const formatRules = usesMarkdown
    ? [
        `# OUTPUT FORMAT`,
        `- This channel REQUIRES markdown structure: "# Title" / "## Section" headings, "-" bullets, and tables where the channel rules ask for them.`,
        `- No decorative markdown beyond structure: no bold/italic mid-sentence for emphasis, no emoji.`,
      ]
    : [
        `# OUTPUT FORMAT — STRICT`,
        `- Plain text only. NEVER use markdown bold (**word** or __word__), italic markers (*word*, _word_), backticks, or heading symbols (#, ##).`,
        `- LinkedIn, email and most CMS surfaces do not render markdown — emphasis written with asterisks shows up literally as **text** to the reader.`,
        `- For emphasis use natural language: a short label followed by a colon, an em-dash, capitalised key terms, or a "→" bullet. Never decorate.`,
        `- Bulleted lists use a plain "- " or "→ " prefix on each line, never "* ".`,
      ];

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
    ...formatRules,
    ``,
    `# POSITIONING GUARD`,
    `APSOparts lane: ${pg.apsoparts}`,
    `Parent brand (Angst+Pfister) lane: ${pg.angstPfisterParent}`,
    `Rule: ${pg.rule}`,
    ...(persona
      ? [
          ``,
          `# TARGET-READER PROFILE  (this is a research archetype — NOT a real recipient)`,
          `Archetype label (internal research only — never use in copy): "${persona.code} — ${persona.name}"`,
          `Reader role: ${persona.role}`,
          `Positioning: ${persona.description}`,
          `Reader's role & seniority: ${persona.roles}`,
          `What they want (goals): ${persona.goals}`,
          `What blocks them (challenges): ${persona.challenges}`,
          `Demographics: age ${persona.demographics.age}, ${persona.demographics.location}, education ${persona.demographics.education}`,
          `Story snapshot for context: ${persona.story}`,
          ``,
          `# PERSONA WRITING RULES (read carefully)`,
          `- "${persona.name}" is the NAME OF A FICTIONAL RESEARCH PERSONA. Do NOT greet the reader by this name. Do NOT write "Hallo ${persona.name}", "Hi ${persona.name}", "Dear ${persona.name}" or any variant. The reader is a real customer who happens to match this archetype — they have their own name we don't know.`,
          `- For email/newsletter salutations use a neutral form: "Hallo!" / "Liebe Kunden" / "Hello!" / "Hi there" / "Bonjour" / "Salve" — depending on language. If unsure, no salutation at all and start straight with the hook.`,
          `- Vocabulary, examples, and pain points must match the reader's role. Never default to generic "maintenance engineer" framing unless the persona is actually maintenance.`,
          `- The opening hook must reference a situation this reader recognises within the first second (specific number, sharp observation, named scenario from their day).`,
          `- The CTA must match the reader's buying behaviour: P1 Markus Weber = audit + sample + reference customers; P2 Sophie Müller = e-shop click; P3 Pietro Rossi = phone call in Italian; P4 Andreas Schmidt = phone call to a named sales rep; P5 Luca Liebertz = DirectCUT configurator; P6 Tomas Becker = same-day shipping CTA; P7 Jan Hoffmann = sample / datasheet / FEA reference; P8 Reseller = partner programme.`,
          `- Sign off with brand only ("— APSOparts"), never with the persona's name.`,
        ]
      : []),
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
    ...(channel === "ad" && brain.goldExamples.paidAds.length
      ? [
          ``,
          `# GOLD AD EXAMPLES (proven ads — match this tone and compression)`,
          ...brain.goldExamples.paidAds.map(
            (a, i) => `Example ${i + 1}:\nHEADLINE: ${a.headline}\nBODY: ${a.body}`
          ),
        ]
      : []),
    ...(wantsIntelligence
      ? [
          ``,
          `# REAL DEMAND SIGNALS (from APSOparts internal search + SEO analysis — use to pick angles and keywords)`,
          ...brain.keywordSignals.internalSearchTrends.map((t) => `- "${t.term}": ${t.signal}`),
          `- Brand terms customers search for that have NO landing page yet: ${brain.keywordSignals.brandTermsMissingLandingPages.join(", ")}.`,
          `- Context: ${brain.keywordSignals.externalListGaps}`,
          ``,
          `# CATEGORY CONTENT CONTEXT`,
          `- Shop top-level categories: ${brain.categoryIntelligence.topLevel.map((c) => c.en).join(", ")}.`,
          `- ${brain.categoryIntelligence.contentGap}`,
          `- When the request names a category, ground the content in that category's real materials, failure modes and use cases.`,
        ]
      : []),
  ].join("\n");
}