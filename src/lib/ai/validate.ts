// Deterministic output checks against the channel contracts in
// src/lib/brain.ts CHANNEL_RULES. Violations feed one revise pass in
// /api/generate — tolerant thresholds so borderline output doesn't loop.

const BANNED_PHRASES = [
  "excited to announce",
  "we are thrilled",
  "thrilled to",
  "revolutionary",
  "unlock the",
  "discover the",
  "engineered to perfection",
  "we are excited",
  "excited to share",
  "game-changer",
  "game-changing",
  "in today's fast-paced",
];

// Generic-hook openers (mirrors the BANNED OPENERS list in
// CHANNEL_RULES.linkedin). Checked only against the START of the first
// non-empty line — mid-text occurrences are handled by BANNED_PHRASES.
const BANNED_OPENERS = [
  "in today's",
  "did you know",
  "are you struggling",
  "we are excited",
  "attention",
  "imagine",
  "in the world of",
  "let's talk about",
  "have you ever",
];

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function hasMarkdown(text: string): boolean {
  return /\*\*[^*]+\*\*|__[^_]+__|^#{1,3} /m.test(text);
}

export function validateChannelOutput(channel: string, text: string): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  for (const p of BANNED_PHRASES) {
    if (lower.includes(p)) violations.push(`Contains banned phrase "${p}" — remove it.`);
  }

  switch (channel) {
    case "linkedin": {
      const firstLine =
        text
          .split("\n")
          .find((l) => l.trim().length > 0)
          ?.trim()
          .toLowerCase() ?? "";
      const opener = BANNED_OPENERS.find((o) => firstLine.startsWith(o));
      if (opener)
        violations.push(
          `Opens with the banned generic opener "${opener}..." — rewrite the hook using one of the hook patterns (number-first, contrarian, situation-recognition, cost-of-inaction, or a sharp question).`
        );
      const words = wordCount(text.replace(/#\w+/g, ""));
      if (words > 220) violations.push(`Post is ${words} words — LinkedIn rule is 80–160. Tighten it.`);
      const hashtags = (text.match(/#[A-Za-z]\w+/g) ?? []).length;
      if (hashtags < 2 || hashtags > 5)
        violations.push(`Post has ${hashtags} hashtags — the rule is 2–4 at the bottom.`);
      if (hasMarkdown(text))
        violations.push(`Post contains markdown formatting (** or #-headings) — LinkedIn renders it literally. Plain text only.`);
      break;
    }
    case "newsletter": {
      if (!/^subject:/im.test(text)) violations.push(`Missing "Subject: ..." on the first line.`);
      if (!/^preheader:/im.test(text)) violations.push(`Missing "Preheader: ..." line.`);
      if (!text.includes("— APSOparts") && !text.includes("- APSOparts"))
        violations.push(`Missing the "— APSOparts" sign-off.`);
      if (hasMarkdown(text))
        violations.push(`Email contains markdown formatting — use plain text with inline labels instead.`);
      break;
    }
    case "blog": {
      if (!/^# .+/m.test(text)) violations.push(`Missing the "# Title" H1 heading.`);
      const h2s = (text.match(/^## .+/gm) ?? []).length;
      if (h2s < 3) violations.push(`Only ${h2s} "## Section" headings — the rule is 3–5 plus FAQ.`);
      if (!/^## (faq|häufige fragen|foire aux questions|domande frequenti)/im.test(text))
        violations.push(`Missing the closing "## FAQ" section (3–5 Q&As, each answer 40–60 words).`);
      if (!/```json/.test(text))
        violations.push(
          `Missing the trailing \`\`\`json fenced block with schema.org JSON-LD (Article + FAQPage).`
        );
      break;
    }
    case "ad": {
      if (!/^headline:/im.test(text)) violations.push(`Missing "HEADLINE: ..." line.`);
      if (!/^body:/im.test(text)) violations.push(`Missing "BODY: ..." line.`);
      if (!/^cta:/im.test(text)) violations.push(`Missing "CTA: ..." line.`);
      const words = wordCount(text);
      if (words > 60) violations.push(`Ad is ${words} words — the rule is under 50 total.`);
      break;
    }
    case "product": {
      for (const section of [
        "## Product Summary",
        "## Key Benefits",
        "## Technical Specifications",
        "## Selection Guidance",
      ]) {
        if (!text.includes(section)) violations.push(`Missing required section "${section}".`);
      }
      if (!/\|.+\|.+\|/.test(text))
        violations.push(`Technical Specifications must contain a markdown table (Property | Value | Unit).`);
      break;
    }
    case "seo": {
      if (!/^meta title:/im.test(text)) violations.push(`Missing "META TITLE: ..." block.`);
      if (!/^meta description:/im.test(text)) violations.push(`Missing "META DESCRIPTION: ..." block.`);
      if (!/^h1:/im.test(text)) violations.push(`Missing "H1: ..." block.`);
      if (!/^intro paragraph:/im.test(text)) violations.push(`Missing "INTRO PARAGRAPH: ..." block.`);
      const metaTitle = text.match(/^meta title:\s*(.+)$/im)?.[1]?.trim() ?? "";
      if (metaTitle && (metaTitle.length < 35 || metaTitle.length > 70))
        violations.push(`META TITLE is ${metaTitle.length} chars — target 50–60.`);
      const metaDesc = text.match(/^meta description:\s*(.+)$/im)?.[1]?.trim() ?? "";
      if (metaDesc && (metaDesc.length < 110 || metaDesc.length > 175))
        violations.push(`META DESCRIPTION is ${metaDesc.length} chars — target 140–155.`);
      break;
    }
  }
  return violations;
}
