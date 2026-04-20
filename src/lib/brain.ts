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
  trainingSources: { file: string; type: string }[];
};

export async function readBrain(): Promise<Brain> {
  const raw = await fs.readFile(BRAIN_PATH, "utf8");
  return JSON.parse(raw) as Brain;
}

export async function writeBrain(next: Brain): Promise<void> {
  next.updatedAt = new Date().toISOString();
  await fs.writeFile(BRAIN_PATH, JSON.stringify(next, null, 2), "utf8");
}

export function brandSystemPrompt(brain: Brain, channel?: string): string {
  const bv = brain.brandVoice;
  const pg = brain.positioningGuard;
  const sm = brain.socialMediaRules;
  const pc = brain.productContentRules;

  const isSocial = channel === "linkedin" || channel === "newsletter";
  const isProduct = channel === "product" || channel === "seo";

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
    ...(isSocial
      ? [
          ``,
          `# SOCIAL MEDIA RULES`,
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
          `# PRODUCT CONTENT RULES`,
          `Page structure:`,
          ...pc.pageStructure.map((s, i) => `${i + 1}. ${s}`),
          ``,
          `Style:`,
          ...pc.styleRules.map((s) => `- ${s}`),
        ]
      : []),
  ].join("\n");
}