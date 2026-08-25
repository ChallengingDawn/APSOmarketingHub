/**
 * GEO (generative-engine optimisation) readiness auditor.
 *
 * Pure and dependency-free: string in, verdicts out. No network, no DB, no
 * randomness, no clock unless one is injected — so the same text always yields
 * the same score and the UI can explain every number it shows.
 *
 * What it measures is what makes a passage *quotable by an AI answer engine*:
 * an answer that arrives before the preamble, passages that survive being cut
 * out of their page, headings that state something, figures instead of
 * adjectives, an FAQ that maps onto FAQPage schema, a recency signal, and a
 * claim someone can be held to. These mirror the GEO rules the content brain
 * already writes with (see `src/lib/brain.ts` — "GEO RULES").
 *
 * Every threshold below is a named exported constant with the reason it exists.
 * Nothing here invents data: when a signal is absent the check says it is
 * absent and tells the author what to add.
 */

/* ────────────────────────────── check catalogue ───────────────────────────── */

export const GEO_CHECK_IDS = [
  "direct-answer",
  "extractable-blocks",
  "structure",
  "specificity",
  "faq-schema",
  "freshness",
  "sourcing",
] as const;

export type GeoCheckId = (typeof GEO_CHECK_IDS)[number];

export type GeoVerdict = "pass" | "warn" | "fail";

export type GeoCheckDefinition = {
  id: GeoCheckId;
  label: string;
  /** Short label for chips and dense tables. */
  short: string;
  /** Share of the 0-100 score. The seven weights sum to 100. */
  weight: number;
  /** The question the check asks of the text. */
  question: string;
  /** Why an answer engine cares — rendered as the check's explanation. */
  why: string;
};

/**
 * Weights sum to 100. The first two carry the most because extraction is the
 * whole game: an engine that cannot lift a self-contained passage from the page
 * will not cite the page at all, however well the rest scores.
 */
export const GEO_CHECKS: readonly GeoCheckDefinition[] = [
  {
    id: "direct-answer",
    label: "Direct answer opening",
    short: "Opening",
    weight: 20,
    question: "Does the piece answer its own question in the first 40–60 words, before any preamble?",
    why: "Answer engines lift the first coherent passage of a page. A run-up sentence ('In today's industry…') is what gets quoted instead of your answer — or the page is skipped.",
  },
  {
    id: "extractable-blocks",
    label: "Extractable blocks",
    short: "Extractable",
    weight: 20,
    question: "Are there self-contained 40–60 word passages that still make sense quoted out of context?",
    why: "A citation is a cut-out fragment. Paragraphs that open with 'This means…' or run past 90 words cannot be cut out cleanly, so they are never used.",
  },
  {
    id: "structure",
    label: "Structure & headings",
    short: "Structure",
    weight: 15,
    question: "Are headings phrased as questions or claims rather than labels, and is there list/table structure?",
    why: "Headings are how a retriever segments a page. 'Benefits' matches no question; 'Which temperature range does EPDM cover?' matches the query it answers.",
  },
  {
    id: "specificity",
    label: "Specificity",
    short: "Specificity",
    weight: 15,
    question: "How dense are concrete figures, units, standards and material names?",
    why: "Engines cite specifics, not adjectives. '−40 °C to +130 °C' is quotable; 'excellent temperature resistance' is unusable and reads as filler.",
  },
  {
    id: "faq-schema",
    label: "FAQ & schema",
    short: "FAQ/schema",
    weight: 10,
    question: "Is there an FAQ section, and would FAQPage / Article JSON-LD be emitted?",
    why: "An FAQ block is pre-segmented question→answer training material, and the JSON-LD tells the crawler which text is the answer rather than making it guess.",
  },
  {
    id: "freshness",
    label: "Freshness signal",
    short: "Freshness",
    weight: 10,
    question: "Does the copy carry an explicit date or recency signal?",
    why: "Answer engines prefer datable sources and will drop an undated page in favour of a dated competitor when a query looks time-sensitive.",
  },
  {
    id: "sourcing",
    label: "Sourcing & E-E-A-T",
    short: "Sourcing",
    weight: 10,
    question: "Are claims attributable — named standards, sources, author or company expertise?",
    why: "Unattributed statistics are the fastest way to be filtered out. A named standard or datasheet turns a claim into something the engine can stand behind.",
  },
];

export function geoCheckDefinition(id: GeoCheckId): GeoCheckDefinition {
  const found = GEO_CHECKS.find((c) => c.id === id);
  // GEO_CHECKS is exhaustive over GeoCheckId; the fallback keeps this total.
  return found ?? GEO_CHECKS[0];
}

/* ──────────────────────────────── thresholds ──────────────────────────────── */

/** The window an engine reads before deciding the page answers the question. */
export const DIRECT_ANSWER_TARGET_MIN_WORDS = 40;
export const DIRECT_ANSWER_TARGET_MAX_WORDS = 60;
/** Below this the opening is a teaser, not an answer — nothing to quote. */
export const DIRECT_ANSWER_HARD_MIN_WORDS = 20;
/** Above this the answer is buried inside a block too long to lift whole. */
export const DIRECT_ANSWER_HARD_MAX_WORDS = 110;

/** The quotable window: what a citation-sized passage looks like. */
export const EXTRACTABLE_MIN_WORDS = 40;
export const EXTRACTABLE_MAX_WORDS = 60;
/** Tolerance band — still liftable, just not ideal. Counted separately. */
export const EXTRACTABLE_TOLERANCE_MIN_WORDS = 30;
export const EXTRACTABLE_TOLERANCE_MAX_WORDS = 80;
/** A paragraph past this length cannot be quoted whole; it is a wall. */
export const WALL_PARAGRAPH_WORDS = 90;
/** Expect roughly one citation-sized passage per this many words of body. */
export const EXTRACTABLE_WORDS_PER_BLOCK = 250;
/** Even a short piece needs this many quotable passages to be citable. */
export const EXTRACTABLE_MIN_BLOCKS = 2;

/** One heading per this many words, otherwise the page is one undivided slab. */
export const STRUCTURE_WORDS_PER_HEADING = 250;
/** Share of headings that must be a question or a claim rather than a label. */
export const STRUCTURE_DESCRIPTIVE_RATIO_PASS = 0.6;
export const STRUCTURE_DESCRIPTIVE_RATIO_WARN = 0.35;
/** A heading this short is a filing label ("Benefits"), not a claim. */
export const HEADING_LABEL_MAX_WORDS = 2;

/** Concrete signals (figures with units, standards, materials) per 100 words. */
export const SPECIFICITY_PASS_PER_100_WORDS = 3;
export const SPECIFICITY_WARN_PER_100_WORDS = 1.5;
/** Above this density of empty adjectives the copy reads as marketing filler. */
export const VAGUE_ADJECTIVES_WARN_PER_100_WORDS = 1;

/** An FAQ block needs this many real question→answer pairs to be worth schema. */
export const FAQ_MIN_QUESTIONS = 3;
/** Each FAQ answer should itself be a citation-sized passage. */
export const FAQ_ANSWER_MIN_WORDS = 40;
export const FAQ_ANSWER_MAX_WORDS = 60;

/** A date older than this reads as stale to a recency-sensitive query. */
export const FRESHNESS_MAX_AGE_YEARS = 2;

/** Distinct kinds of attribution signal needed to pass / to avoid failing. */
export const SOURCING_PASS_SIGNAL_KINDS = 3;
export const SOURCING_WARN_SIGNAL_KINDS = 1;

/** Below this length there is not enough text to judge; every check says so. */
export const MIN_AUDITABLE_WORDS = 25;

/** Score bands used for the portfolio distribution and the score badge. */
export const SCORE_BAND_STRONG = 80;
export const SCORE_BAND_WORKABLE = 60;
export const SCORE_BAND_WEAK = 40;

export type GeoBand = "strong" | "workable" | "weak" | "poor";

export function geoBand(score: number): GeoBand {
  if (score >= SCORE_BAND_STRONG) return "strong";
  if (score >= SCORE_BAND_WORKABLE) return "workable";
  if (score >= SCORE_BAND_WEAK) return "weak";
  return "poor";
}

export const GEO_BAND_LABELS: Record<GeoBand, string> = {
  strong: "Citable",
  workable: "Workable",
  weak: "Weak",
  poor: "Not citable",
};

/* ─────────────────────────────── word lists ───────────────────────────────── */

/**
 * Openers that delay the answer. Matched only against the very first words of
 * the body — the same list the brain bans for LinkedIn hooks.
 */
export const PREAMBLE_PATTERNS: readonly { re: RegExp; label: string }[] = [
  { re: /^in today'?s\b/i, label: "In today's…" },
  { re: /^in the (world|field|realm|age) of\b/i, label: "In the world of…" },
  { re: /^in this (article|post|guide|blog|piece)\b/i, label: "In this article…" },
  { re: /^(this|the following) (article|post|guide|page) (will|explores|covers|looks)\b/i, label: "This article will…" },
  { re: /^(we|i) (will|'ll|are going to) (explore|look|cover|discuss|explain)\b/i, label: "We will explore…" },
  { re: /^let'?s (talk|look|dive|explore|start|begin)\b/i, label: "Let's talk about…" },
  { re: /^did you know\b/i, label: "Did you know…" },
  { re: /^have you ever\b/i, label: "Have you ever…" },
  { re: /^are you (struggling|tired|looking|searching)\b/i, label: "Are you struggling…" },
  { re: /^imagine\b/i, label: "Imagine…" },
  { re: /^welcome to\b/i, label: "Welcome to…" },
  { re: /^(we|our team) (are|'re|is) (excited|proud|pleased|happy)\b/i, label: "We are excited…" },
  { re: /^when it comes to\b/i, label: "When it comes to…" },
  { re: /^attention\b/i, label: "Attention […]" },
];

/**
 * A paragraph that starts with one of these depends on the paragraph before it,
 * so it cannot be quoted alone however well-sized it is.
 */
export const CONTEXT_DEPENDENT_OPENERS =
  /^(this|that|these|those|it|they|he|she|such|both|either|however|therefore|thus|also|moreover|furthermore|additionally|as a result|for this reason|in contrast|on the other hand|besides|meanwhile|then|so|but|and|because of this|which)\b/i;

/** Headings that segment nothing because they match no user question. */
export const GENERIC_HEADING_LABELS: readonly string[] = [
  "introduction",
  "intro",
  "overview",
  "background",
  "summary",
  "conclusion",
  "benefits",
  "advantages",
  "features",
  "applications",
  "about",
  "about us",
  "details",
  "more",
  "products",
  "services",
  "solutions",
  "options",
  "general",
  "notes",
  "other",
  "misc",
];

/** Adjectives that carry no extractable fact. Counted, never guessed at. */
export const VAGUE_ADJECTIVES: readonly string[] = [
  "excellent",
  "superior",
  "outstanding",
  "high-quality",
  "high quality",
  "top-quality",
  "best-in-class",
  "world-class",
  "state-of-the-art",
  "cutting-edge",
  "innovative",
  "revolutionary",
  "unmatched",
  "unparalleled",
  "wide range",
  "broad range",
  "vast range",
  "extensive range",
  "robust",
  "optimal",
  "perfect",
  "premium",
  "seamless",
  "powerful",
  "leading",
  "reliable solution",
  "cost-effective",
  "highly efficient",
  "exceptional",
];

/**
 * Material names in the elastomer / polymer domain this hub writes about.
 * A material name is a concrete, citable noun — engines quote them verbatim.
 */
export const MATERIAL_NAMES: readonly string[] = [
  "EPDM", "NBR", "HNBR", "XNBR", "FKM", "FPM", "FFKM", "VMQ", "MVQ", "FVMQ",
  "AEM", "ACM", "ECO", "CR", "SBR", "IIR", "CIIR", "BIIR", "NR", "TPE", "TPU",
  "TPV", "PU", "PTFE", "PFA", "FEP", "ETFE", "PVDF", "PEEK", "PEI", "PES",
  "PSU", "PPS", "POM", "PA6", "PA66", "PA12", "PET", "PBT", "PC", "PMMA",
  "PVC", "PE", "HDPE", "UHMWPE", "PP", "ABS", "silicone", "Viton", "Kalrez",
  "Aflas", "Perlast", "graphite", "aramid", "PTFE-compound", "nitrile",
  "fluoroelastomer", "perfluoroelastomer", "polyurethane", "polyamide",
  "stainless steel", "1.4301", "1.4404", "AISI 304", "AISI 316",
];

/** Bare-name standards and regulations that need no number to be concrete. */
export const NAMED_STANDARDS: readonly string[] = [
  "FDA", "REACH", "RoHS", "ATEX", "NSF", "USP Class VI", "WRAS", "KTW", "3-A",
  "UL94", "CE marking", "EC 1935/2004", "EU 10/2011", "EU 2024/3190",
];

/* ─────────────────────────────── result types ─────────────────────────────── */

export type GeoCheckResult = {
  id: GeoCheckId;
  label: string;
  weight: number;
  verdict: GeoVerdict;
  /** 0-100 for this check alone. Weighted into the overall score. */
  score: number;
  /** What was actually measured, in plain words. Always concrete. */
  measured: string;
  /** The specific edit that would raise this check. */
  fix: string;
  /** Verbatim excerpts backing the measurement, when there are any. */
  evidence: string[];
};

export type ParagraphBucket = {
  label: string;
  count: number;
};

export type GeoAuditStats = {
  words: number;
  paragraphs: number;
  headings: number;
  descriptiveHeadings: number;
  lists: number;
  tables: number;
  links: number;
  /** Word count of every body paragraph, in document order. */
  paragraphWordCounts: number[];
  /** Distribution of paragraph lengths against the quotable window. */
  buckets: ParagraphBucket[];
  quotableBlocks: number;
  wallParagraphs: number;
  figuresWithUnits: number;
  standards: number;
  materials: number;
  vagueAdjectives: number;
  faqQuestions: number;
  schemaTypes: string[];
  dateSignals: string[];
};

export type GeoAuditResult = {
  /** 0-100, weighted sum of the seven checks. */
  score: number;
  band: GeoBand;
  /** True when there is too little text to judge — the UI must say so. */
  tooShort: boolean;
  checks: GeoCheckResult[];
  failing: GeoCheckId[];
  warning: GeoCheckId[];
  stats: GeoAuditStats;
};

export type GeoAuditOptions = {
  /** Channel the piece was written for; only used to phrase fixes. */
  channel?: string | null;
  /** Title, when it lives outside the body (the library stores it separately). */
  title?: string | null;
  /**
   * Raw HTML of the source page, when auditing a live URL. Scanned for JSON-LD
   * in addition to the extracted text.
   */
  html?: string | null;
  /** Injected clock so freshness is deterministic and testable. */
  now?: Date;
};

/* ──────────────────────────────── text parsing ────────────────────────────── */

type BlockKind = "heading" | "paragraph" | "list" | "table" | "code";

type Block = {
  kind: BlockKind;
  /** Markdown removed, ready for word counting. */
  text: string;
  words: number;
  /** Heading level, 1-6. Zero for non-headings. */
  level: number;
};

const FENCE_RE = /```[\s\S]*?```/g;

function normalize(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(/ /g, " ");
}

/** Strips inline markdown so word counts measure prose, not syntax. */
export function stripInlineMarkdown(input: string): string {
  return input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*\*|\*\*|\*|___|__|_)([^*_\n]+)\1/g, "$2")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_]{2,}/g, "")
    .trim();
}

export function countWords(input: string): number {
  const cleaned = stripInlineMarkdown(input).replace(/[|#>-]+/g, " ");
  const parts = cleaned.split(/\s+/).filter((w) => /[A-Za-z0-9À-ÿ]/.test(w));
  return parts.length;
}

function isListLine(line: string): boolean {
  return /^\s*(?:[-*+•]\s+|\d+[.)]\s+)/.test(line);
}

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const chunks = raw.split(/\n{2,}/);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("```")) {
      blocks.push({ kind: "code", text: trimmed, words: 0, level: 0 });
      continue;
    }

    const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);

    // A chunk may hold a heading followed by its paragraph when the author did
    // not leave a blank line, so headings are peeled off line by line.
    let pending: string[] = [];
    const flush = () => {
      if (!pending.length) return;
      const text = pending.join("\n");
      const listLines = pending.filter(isListLine).length;
      const tableLines = pending.filter((l) => l.trim().startsWith("|") || /\|.*\|/.test(l)).length;
      let kind: BlockKind = "paragraph";
      if (tableLines >= 2) kind = "table";
      else if (listLines > 0 && listLines >= pending.length / 2) kind = "list";
      const clean = stripInlineMarkdown(text.replace(/^\s*(?:[-*+•]\s+|\d+[.)]\s+)/gm, ""));
      blocks.push({ kind, text: clean, words: countWords(text), level: 0 });
      pending = [];
    };

    for (const line of lines) {
      const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        flush();
        const text = stripInlineMarkdown(heading[2]).replace(/[:：]\s*$/, "").trim();
        blocks.push({ kind: "heading", text, words: countWords(text), level: heading[1].length });
        continue;
      }
      pending.push(line);
    }
    flush();
  }

  return blocks;
}

function firstSentences(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function excerpt(text: string, maxChars = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars - 1)}…`;
}

function matchAll(text: string, re: RegExp): string[] {
  const matches = text.match(re);
  return matches ? matches : [];
}

function buildAlternationRegex(terms: readonly string[]): RegExp {
  const escaped = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:^|[^A-Za-z0-9])(${escaped.join("|")})(?![A-Za-z0-9])`, "gi");
}

const MATERIAL_RE = buildAlternationRegex(MATERIAL_NAMES);
const NAMED_STANDARD_RE = buildAlternationRegex(NAMED_STANDARDS);
const VAGUE_RE = buildAlternationRegex(VAGUE_ADJECTIVES);

/** A number carrying a unit — the shape of a fact an engine will quote. */
const UNIT_FIGURE_RE =
  /\b\d+(?:[.,]\d+)?\s?(?:°\s?[CF]|K\b|mm|cm|dm|m\b|µm|um|nm|in\b|"|bar|mbar|MPa|kPa|Pa\b|psi|N\/mm²|N\b|kN|kg|g\b|mg|t\b|%|h\b|hrs?\b|min\b|sec\b|s\b|days?\b|weeks?\b|years?\b|Shore\s?[AD]|IRHD|HRC|rpm|m\/s|l\/min|ml\b|l\b|ppm|V\b|kV|W\b|kW|Hz|kHz|×|x\s?\d)/gi;

/** Standards written as CODE + number, e.g. "ISO 3601", "DIN EN 681-1". */
const CODED_STANDARD_RE =
  /\b(?:ISO|DIN|EN|ASTM|ASME|BS|JIS|SAE|UL|VDA|IEC|IATF|NAS|MIL|AMS|USP|NSF|EC|EU)\s?(?:EN\s?)?\d{2,5}(?:[-–/][\dA-Za-z]+)*\b/g;

const URL_RE = /https?:\/\/[^\s)\]]+/gi;
const MARKDOWN_LINK_RE = /\[[^\]]+\]\((?:https?:)?\/\/[^)]+\)/g;

/**
 * Scans raw markdown or HTML for schema.org types. Used both for the FAQ/schema
 * check and, on the live-URL route, to report what the published page emits.
 */
export function detectSchemaTypes(raw: string): string[] {
  const found = new Set<string>();
  const re = /"@type"\s*:\s*"([A-Za-z]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) found.add(m[1]);
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

export function hasFaqPageSchema(types: readonly string[]): boolean {
  return types.includes("FAQPage") || types.includes("QAPage");
}

export function hasArticleSchema(types: readonly string[]): boolean {
  return types.some((t) => t === "Article" || t === "TechArticle" || t === "BlogPosting" || t === "NewsArticle");
}

/* ─────────────────────────────── date signals ─────────────────────────────── */

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|januar|februar|märz|maerz|mai|juni|juli|oktober|dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

const DATE_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b(20\\d{2})-(0?[1-9]|1[0-2])-([0-3]?\\d)\\b`, "g"),
  new RegExp(`\\b([0-3]?\\d)[./ ](?:${MONTHS})\\.?[ ,]+20\\d{2}\\b`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+([0-3]?\\d)(?:st|nd|rd|th)?,?\\s+20\\d{2}\\b`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+20\\d{2}\\b`, "gi"),
  /\b[0-3]?\d[./][01]?\d[./]20\d{2}\b/g,
  /\bQ[1-4]\s?20\d{2}\b/gi,
  /\b(?:updated|last updated|reviewed|revised|as of|published|stand|mise à jour|aktualisiert)\b[^.\n]{0,40}\b20\d{2}\b/gi,
];

const BARE_YEAR_RE = /\b20\d{2}\b/g;

function collectDateSignals(text: string): { explicit: string[]; years: number[] } {
  const explicit: string[] = [];
  for (const re of DATE_PATTERNS) {
    for (const hit of matchAll(text, re)) {
      const flat = hit.replace(/\s+/g, " ").trim();
      if (!explicit.includes(flat)) explicit.push(flat);
    }
  }
  const years = Array.from(
    new Set(matchAll(text, BARE_YEAR_RE).map((y) => Number.parseInt(y, 10)))
  ).filter((y) => Number.isFinite(y));
  return { explicit, years };
}

/* ───────────────────────────────── sourcing ───────────────────────────────── */

const ATTRIBUTION_RE =
  /\b(according to|as specified in|as defined in|per (?:ISO|DIN|EN|ASTM|the)|source:|sources:|data ?sheet|datasheet|test report|technical bulletin|manufacturer'?s? (?:data|specification|spec)|regulation \(?(?:EU|EC)\)?|directive \d|white paper|study by)\b/gi;

const EXPERTISE_RE =
  /\b(by [A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+|our (?:application )?engineers|our technical team|our specialists|in-house laboratory|years of experience|since (?:18|19|20)\d{2}|Angst\s?\+\s?Pfister|APSOparts|APSOgroup)\b/g;

/** Statistic-shaped claims with nothing to attribute them to. */
const UNSOURCED_STAT_RE =
  /\b(?:studies show|research shows|experts (?:say|agree)|it is (?:widely )?known|surveys? (?:show|found)|\d{1,3}\s?% of (?:companies|users|customers|engineers|plants))\b/gi;

/* ───────────────────────────────── the audit ──────────────────────────────── */

type CheckDraft = {
  verdict: GeoVerdict;
  score: number;
  measured: string;
  fix: string;
  evidence?: string[];
};

function result(def: GeoCheckDefinition, draft: CheckDraft): GeoCheckResult {
  return {
    id: def.id,
    label: def.label,
    weight: def.weight,
    verdict: draft.verdict,
    score: Math.max(0, Math.min(100, Math.round(draft.score))),
    measured: draft.measured,
    fix: draft.fix,
    evidence: draft.evidence ?? [],
  };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Audits a piece of writing for generative-engine readiness.
 *
 * @param text  The body. Markdown is understood; plain text works too.
 * @param opts  Channel/title context, optional raw HTML, injected clock.
 */
export function auditGeoReadiness(text: string, opts: GeoAuditOptions = {}): GeoAuditResult {
  const raw = normalize(typeof text === "string" ? text : "");
  const withoutCode = raw.replace(FENCE_RE, "\n\n");
  const blocks = parseBlocks(withoutCode);
  const prose = blocks.filter((b) => b.kind !== "code");
  const paragraphs = prose.filter((b) => b.kind === "paragraph");
  const headings = prose.filter((b) => b.kind === "heading");
  const lists = prose.filter((b) => b.kind === "list");
  const tables = prose.filter((b) => b.kind === "table");

  const flatText = prose.map((b) => b.text).join("\n\n");
  const totalWords = prose.reduce((sum, b) => sum + b.words, 0);
  const tooShort = totalWords < MIN_AUDITABLE_WORDS;

  /* ── signal counts, shared by several checks ── */
  const unitFigures = matchAll(flatText, UNIT_FIGURE_RE);
  const codedStandards = matchAll(flatText, CODED_STANDARD_RE);
  const namedStandards = matchAll(flatText, NAMED_STANDARD_RE);
  const standards = [...codedStandards, ...namedStandards.map((s) => s.trim())];
  const materials = matchAll(flatText, MATERIAL_RE).map((s) => s.trim());
  const vague = matchAll(flatText, VAGUE_RE).map((s) => s.trim());
  const links = [...matchAll(raw, MARKDOWN_LINK_RE), ...matchAll(raw, URL_RE)];
  const schemaTypes = detectSchemaTypes(`${raw}\n${opts.html ?? ""}`);
  const dates = collectDateSignals(flatText);

  const checks: GeoCheckResult[] = [];

  /* ── 1. DIRECT ANSWER OPENING ── */
  {
    const def = geoCheckDefinition("direct-answer");
    // The opening is the first body paragraph — a title/H1 is not an answer.
    const opening = paragraphs[0] ?? null;
    const openingText = opening ? opening.text.replace(/\s+/g, " ").trim() : "";
    const openingWords = opening ? opening.words : 0;
    const preamble = PREAMBLE_PATTERNS.find((p) => p.re.test(openingText));
    const firstIsHeading = prose[0]?.kind === "heading";
    const blocksBeforeOpening = opening ? prose.indexOf(opening) : -1;

    if (!opening) {
      checks.push(
        result(def, {
          verdict: "fail",
          score: 0,
          measured: "No body paragraph found — the piece is headings, lists or empty.",
          fix: `Open with one paragraph of ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} words that answers the title's implied question outright.`,
        })
      );
    } else if (preamble) {
      checks.push(
        result(def, {
          verdict: "fail",
          score: 10,
          measured: `Opens with a preamble ("${preamble.label}") — the answer arrives somewhere after this ${plural(openingWords, "word")} run-up.`,
          fix: `Delete the run-up sentence and start with the answer itself. First ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} words must state what the piece concludes.`,
          evidence: [excerpt(openingText)],
        })
      );
    } else if (openingWords < DIRECT_ANSWER_HARD_MIN_WORDS) {
      checks.push(
        result(def, {
          verdict: "fail",
          score: 25,
          measured: `Opening paragraph is ${plural(openingWords, "word")} — under the ${DIRECT_ANSWER_HARD_MIN_WORDS}-word floor, so there is nothing to lift.`,
          fix: `Expand the opening to ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} words: the answer, then the one qualifier that makes it safe to quote.`,
          evidence: [excerpt(openingText)],
        })
      );
    } else if (openingWords > DIRECT_ANSWER_HARD_MAX_WORDS) {
      checks.push(
        result(def, {
          verdict: "warn",
          score: 45,
          measured: `Opening paragraph is ${plural(openingWords, "word")} — past the ${DIRECT_ANSWER_HARD_MAX_WORDS}-word ceiling for a liftable answer.`,
          fix: `Split it: keep the first ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} words as a standalone answer, move the rest into the section below.`,
          evidence: [excerpt(openingText)],
        })
      );
    } else {
      const inWindow =
        openingWords >= DIRECT_ANSWER_TARGET_MIN_WORDS && openingWords <= DIRECT_ANSWER_TARGET_MAX_WORDS;
      const buried = blocksBeforeOpening > (firstIsHeading ? 1 : 0);
      if (inWindow && !buried) {
        checks.push(
          result(def, {
            verdict: "pass",
            score: 100,
            measured: `Answers in the first ${plural(openingWords, "word")}, no preamble.`,
            fix: "Nothing to change — keep the answer ahead of the context in future edits.",
            evidence: [excerpt(openingText)],
          })
        );
      } else {
        const reasons: string[] = [];
        if (!inWindow) {
          reasons.push(
            `opening is ${plural(openingWords, "word")}, outside the ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} window`
          );
        }
        if (buried) reasons.push(`${plural(blocksBeforeOpening, "block")} sit before the first paragraph`);
        checks.push(
          result(def, {
            verdict: "warn",
            score: 65,
            measured: `No preamble, but ${reasons.join(" and ")}.`,
            fix: inWindow
              ? "Move the answering paragraph directly under the title, before any list or aside."
              : `Resize the opening to ${DIRECT_ANSWER_TARGET_MIN_WORDS}–${DIRECT_ANSWER_TARGET_MAX_WORDS} words — long enough to stand alone, short enough to quote whole.`,
            evidence: [excerpt(openingText)],
          })
        );
      }
    }
  }

  /* ── 2. EXTRACTABLE BLOCKS ── */
  const paragraphWordCounts = paragraphs.map((p) => p.words);
  let quotableBlocks = 0;
  let nearQuotable = 0;
  let wallParagraphs = 0;
  let contextDependent = 0;
  const contextDependentExamples: string[] = [];
  {
    const def = geoCheckDefinition("extractable-blocks");

    for (const p of paragraphs) {
      const selfContained = !CONTEXT_DEPENDENT_OPENERS.test(p.text.trim());
      if (!selfContained) {
        contextDependent += 1;
        if (contextDependentExamples.length < 3) contextDependentExamples.push(excerpt(p.text, 120));
      }
      if (p.words > WALL_PARAGRAPH_WORDS) wallParagraphs += 1;
      if (p.words >= EXTRACTABLE_MIN_WORDS && p.words <= EXTRACTABLE_MAX_WORDS && selfContained) {
        quotableBlocks += 1;
      } else if (
        p.words >= EXTRACTABLE_TOLERANCE_MIN_WORDS &&
        p.words <= EXTRACTABLE_TOLERANCE_MAX_WORDS &&
        selfContained
      ) {
        nearQuotable += 1;
      }
    }

    const expected = Math.max(
      EXTRACTABLE_MIN_BLOCKS,
      Math.ceil(totalWords / EXTRACTABLE_WORDS_PER_BLOCK)
    );
    const effective = quotableBlocks + nearQuotable * 0.5;
    const coverage = expected > 0 ? effective / expected : 0;
    const distribution = `${plural(paragraphs.length, "paragraph")}: ${quotableBlocks} in the ${EXTRACTABLE_MIN_WORDS}–${EXTRACTABLE_MAX_WORDS}-word window, ${nearQuotable} near (${EXTRACTABLE_TOLERANCE_MIN_WORDS}–${EXTRACTABLE_TOLERANCE_MAX_WORDS}), ${wallParagraphs} over ${WALL_PARAGRAPH_WORDS} words, ${contextDependent} starting with a back-reference`;

    let verdict: GeoVerdict = "fail";
    let score = Math.round(Math.min(1, coverage) * 70);
    if (coverage >= 1 && wallParagraphs === 0) {
      verdict = "pass";
      score = 100;
    } else if (coverage >= 1) {
      verdict = "warn";
      score = 75;
    } else if (coverage >= 0.5) {
      verdict = "warn";
      score = 55;
    }

    const fixParts: string[] = [];
    if (quotableBlocks < expected) {
      fixParts.push(
        `Add ${plural(Math.max(1, expected - quotableBlocks), "passage")} of ${EXTRACTABLE_MIN_WORDS}–${EXTRACTABLE_MAX_WORDS} words that state a full fact — a definition, a rule of thumb, a spec comparison — one per section`
      );
    }
    if (wallParagraphs > 0) {
      fixParts.push(`Split the ${plural(wallParagraphs, "paragraph")} over ${WALL_PARAGRAPH_WORDS} words into quotable halves`);
    }
    if (contextDependent > 0) {
      fixParts.push(
        `Rewrite the ${plural(contextDependent, "paragraph")} opening with "This/It/However" so each names its own subject`
      );
    }

    checks.push(
      result(def, {
        verdict,
        score,
        measured: distribution,
        fix: fixParts.length
          ? `${fixParts.join(". ")}.`
          : "Nothing to change — keep one self-contained passage per section.",
        evidence: contextDependentExamples,
      })
    );
  }

  /* ── 3. STRUCTURE ── */
  let descriptiveHeadings = 0;
  {
    const def = geoCheckDefinition("structure");
    const labelHeadings: string[] = [];
    for (const h of headings) {
      const clean = h.text.trim();
      const lower = clean.toLowerCase().replace(/[?!.:]+$/, "");
      const isQuestion = clean.endsWith("?");
      const isLabel =
        GENERIC_HEADING_LABELS.includes(lower) || countWords(clean) <= HEADING_LABEL_MAX_WORDS;
      // A claim needs a verb-ish shape: more than a noun phrase's worth of words.
      const isClaim = !isLabel && countWords(clean) >= HEADING_LABEL_MAX_WORDS + 1;
      if (isQuestion || isClaim) descriptiveHeadings += 1;
      else if (labelHeadings.length < 4) labelHeadings.push(clean);
    }

    const expectedHeadings = Math.max(1, Math.ceil(totalWords / STRUCTURE_WORDS_PER_HEADING));
    const ratio = headings.length ? descriptiveHeadings / headings.length : 0;
    const depthOk = headings.length === 0 || headings.some((h) => h.level <= 2 || h.level === 0);
    const hasStructureBlocks = lists.length + tables.length > 0;

    const measured = `${plural(headings.length, "heading")} (at least ${expectedHeadings} expected for ${plural(totalWords, "word")}), ${descriptiveHeadings} phrased as a question or claim (${pct(descriptiveHeadings, headings.length)}%), ${plural(lists.length, "list")}, ${plural(tables.length, "table")}`;

    let verdict: GeoVerdict;
    let score: number;
    if (headings.length === 0) {
      verdict = "fail";
      score = 10;
    } else if (headings.length >= expectedHeadings && ratio >= STRUCTURE_DESCRIPTIVE_RATIO_PASS && hasStructureBlocks && depthOk) {
      verdict = "pass";
      score = 100;
    } else if (ratio >= STRUCTURE_DESCRIPTIVE_RATIO_WARN || headings.length >= expectedHeadings) {
      verdict = "warn";
      score = 60;
    } else {
      verdict = "fail";
      score = 30;
    }

    const fixParts: string[] = [];
    if (headings.length === 0) {
      fixParts.push(
        `Break the piece into sections and give each a heading phrased as the question it answers`
      );
    } else {
      if (headings.length < expectedHeadings) {
        fixParts.push(`Add ${plural(expectedHeadings - headings.length, "heading")} — one section per ${STRUCTURE_WORDS_PER_HEADING} words`);
      }
      if (ratio < STRUCTURE_DESCRIPTIVE_RATIO_PASS && labelHeadings.length) {
        fixParts.push(
          `Rephrase label headings (${labelHeadings.map((h) => `"${h}"`).join(", ")}) as the question or claim underneath them`
        );
      }
      if (!hasStructureBlocks) {
        fixParts.push("Add at least one bulleted list or spec table — engines lift rows and bullets verbatim");
      }
    }

    checks.push(
      result(def, {
        verdict,
        score,
        measured,
        fix: fixParts.length ? `${fixParts.join(". ")}.` : "Nothing to change — headings already segment the page by question.",
        evidence: labelHeadings,
      })
    );
  }

  /* ── 4. SPECIFICITY ── */
  {
    const def = geoCheckDefinition("specificity");
    const concrete = unitFigures.length + standards.length + materials.length;
    const per100 = totalWords > 0 ? (concrete / totalWords) * 100 : 0;
    const vaguePer100 = totalWords > 0 ? (vague.length / totalWords) * 100 : 0;

    const measured = `${per100.toFixed(1)} concrete signals per 100 words — ${plural(unitFigures.length, "figure")} with units, ${plural(standards.length, "standard")}, ${plural(materials.length, "material mention")}; ${plural(vague.length, "vague adjective")}`;

    let verdict: GeoVerdict;
    let score: number;
    if (per100 >= SPECIFICITY_PASS_PER_100_WORDS) {
      verdict = vaguePer100 > VAGUE_ADJECTIVES_WARN_PER_100_WORDS ? "warn" : "pass";
      score = vaguePer100 > VAGUE_ADJECTIVES_WARN_PER_100_WORDS ? 75 : 100;
    } else if (per100 >= SPECIFICITY_WARN_PER_100_WORDS) {
      verdict = "warn";
      score = 55;
    } else {
      verdict = "fail";
      score = Math.round((per100 / SPECIFICITY_WARN_PER_100_WORDS) * 35);
    }

    const need = Math.max(
      0,
      Math.ceil((SPECIFICITY_PASS_PER_100_WORDS * Math.max(totalWords, 1)) / 100) - concrete
    );
    const fixParts: string[] = [];
    if (need > 0) {
      fixParts.push(
        `Add ${plural(need, "verified specific")} — a temperature range, a hardness in Shore A, a standard number, a named material — taken from a source you can point to, never estimated`
      );
    }
    if (vague.length > 0) {
      const sample = Array.from(new Set(vague.map((v) => v.toLowerCase()))).slice(0, 4);
      fixParts.push(`Replace ${sample.map((v) => `"${v}"`).join(", ")} with the number behind them, or cut them`);
    }

    checks.push(
      result(def, {
        verdict,
        score,
        measured,
        fix: fixParts.length ? `${fixParts.join(". ")}.` : "Nothing to change — the copy is already specific enough to quote.",
        evidence: Array.from(new Set([...unitFigures.slice(0, 3), ...standards.slice(0, 3)])).map((s) => s.trim()),
      })
    );
  }

  /* ── 5. FAQ + SCHEMA ── */
  let faqQuestions = 0;
  {
    const def = geoCheckDefinition("faq-schema");
    const faqIndex = prose.findIndex(
      (b) => b.kind === "heading" && /^(faq|faqs|frequently asked|häufige fragen|questions fréquentes)/i.test(b.text.trim())
    );

    const faqAnswerWords: number[] = [];
    const questionSamples: string[] = [];
    const scanFrom = faqIndex >= 0 ? faqIndex + 1 : -1;
    if (scanFrom >= 0) {
      for (let i = scanFrom; i < prose.length; i += 1) {
        const b = prose[i];
        if (b.kind === "heading" && b.text.trim().endsWith("?")) {
          faqQuestions += 1;
          if (questionSamples.length < 3) questionSamples.push(b.text.trim());
          const answer = prose[i + 1];
          if (answer && answer.kind !== "heading") faqAnswerWords.push(answer.words);
          continue;
        }
        // "Q: … — A: …" (the SEO channel contract) and bare "Q:" lines.
        const qa = /^Q\s*:\s*([^\n]*?)(?:\s*[—–-]{1,2}\s*A\s*:\s*([\s\S]*))?$/i.exec(b.text.trim());
        if (qa) {
          faqQuestions += 1;
          if (questionSamples.length < 3) questionSamples.push(excerpt(qa[1], 90));
          if (qa[2]) faqAnswerWords.push(countWords(qa[2]));
          else {
            const answer = prose[i + 1];
            if (answer && answer.kind !== "heading") faqAnswerWords.push(answer.words);
          }
        }
      }
    }
    // A piece can carry Q/A pairs without an FAQ heading — count those too.
    if (faqIndex < 0) {
      for (const b of prose) {
        if (b.kind === "paragraph" && /^Q\s*:/i.test(b.text.trim())) faqQuestions += 1;
      }
    }

    const faqPage = hasFaqPageSchema(schemaTypes);
    const article = hasArticleSchema(schemaTypes);
    const answersInWindow = faqAnswerWords.filter(
      (w) => w >= FAQ_ANSWER_MIN_WORDS && w <= FAQ_ANSWER_MAX_WORDS
    ).length;

    const measured = `${faqIndex >= 0 ? "FAQ section present" : "No FAQ section"} · ${plural(faqQuestions, "question")} · ${answersInWindow}/${faqAnswerWords.length || 0} answers in the ${FAQ_ANSWER_MIN_WORDS}–${FAQ_ANSWER_MAX_WORDS}-word window · JSON-LD: ${schemaTypes.length ? schemaTypes.join(", ") : "none detected"}`;

    let verdict: GeoVerdict;
    let score: number;
    if (faqQuestions >= FAQ_MIN_QUESTIONS && faqPage && article) {
      verdict = answersInWindow >= FAQ_MIN_QUESTIONS ? "pass" : "warn";
      score = answersInWindow >= FAQ_MIN_QUESTIONS ? 100 : 75;
    } else if (faqQuestions >= FAQ_MIN_QUESTIONS || faqPage) {
      verdict = "warn";
      score = 55;
    } else if (faqQuestions > 0) {
      verdict = "warn";
      score = 35;
    } else {
      verdict = "fail";
      score = 0;
    }

    const fixParts: string[] = [];
    if (faqQuestions < FAQ_MIN_QUESTIONS) {
      fixParts.push(
        `Add a "## FAQ" section with ${FAQ_MIN_QUESTIONS}–5 questions phrased the way a customer asks them, each answered in one self-contained ${FAQ_ANSWER_MIN_WORDS}–${FAQ_ANSWER_MAX_WORDS}-word paragraph`
      );
    } else if (answersInWindow < faqQuestions) {
      fixParts.push(`Resize ${plural(faqQuestions - answersInWindow, "FAQ answer")} to ${FAQ_ANSWER_MIN_WORDS}–${FAQ_ANSWER_MAX_WORDS} words so each stands alone`);
    }
    if (!faqPage) fixParts.push("Emit FAQPage JSON-LD built only from the FAQ's actual questions and answers");
    if (!article) fixParts.push("Emit Article JSON-LD (headline, description, datePublished)");

    checks.push(
      result(def, {
        verdict,
        score,
        measured,
        fix: fixParts.length ? `${fixParts.join(". ")}.` : "Nothing to change — FAQ and schema are both in place.",
        evidence: questionSamples,
      })
    );
  }

  /* ── 6. FRESHNESS ── */
  {
    const def = geoCheckDefinition("freshness");
    const now = opts.now ?? new Date();
    const currentYear = now.getUTCFullYear();
    const newestYear = dates.years.length ? Math.max(...dates.years) : null;
    const age = newestYear === null ? null : currentYear - newestYear;

    let verdict: GeoVerdict;
    let score: number;
    let measured: string;
    let fix: string;

    if (dates.explicit.length > 0 && age !== null && age <= FRESHNESS_MAX_AGE_YEARS) {
      verdict = "pass";
      score = 100;
      measured = `Explicit date in the copy: ${dates.explicit.slice(0, 2).join(", ")} (${age === 0 ? "this year" : `${plural(age, "year")} old`}).`;
      fix = "Nothing to change — refresh the date when the facts are next reviewed.";
    } else if (dates.explicit.length > 0) {
      verdict = "warn";
      score = 45;
      measured = `Dated, but the newest date is ${newestYear} — ${plural(age ?? 0, "year")} old, past the ${FRESHNESS_MAX_AGE_YEARS}-year window.`;
      fix = `Re-verify the facts and state the review date ("Reviewed ${currentYear}"), or remove the stale date if it no longer applies.`;
    } else if (newestYear !== null) {
      verdict = "warn";
      score = 35;
      measured = `Only a bare year (${newestYear}) appears — no month, day or "updated" wording.`;
      fix = `Add an explicit recency line near the top or bottom, e.g. "Last updated ${now.toISOString().slice(0, 10)}".`;
    } else {
      verdict = "fail";
      score = 0;
      measured = "No date or recency signal anywhere in the copy.";
      fix = `State when the piece was written or last reviewed, e.g. "Last updated ${now.toISOString().slice(0, 10)}", and mirror it in the Article JSON-LD.`;
    }

    checks.push(result(def, { verdict, score, measured, fix, evidence: dates.explicit.slice(0, 3) }));
  }

  /* ── 7. SOURCING / E-E-A-T ── */
  {
    const def = geoCheckDefinition("sourcing");
    const attributions = matchAll(flatText, ATTRIBUTION_RE);
    const expertise = matchAll(flatText, EXPERTISE_RE);
    const unsourced = matchAll(flatText, UNSOURCED_STAT_RE);

    const kinds: string[] = [];
    if (standards.length > 0) kinds.push(`${plural(standards.length, "named standard")}`);
    if (attributions.length > 0) kinds.push(`${plural(attributions.length, "attribution phrase")}`);
    if (expertise.length > 0) kinds.push(`${plural(expertise.length, "expertise signal")}`);
    if (links.length > 0) kinds.push(`${plural(links.length, "link")}`);

    const kindCount = kinds.length;
    const measured = `${kindCount} of 4 signal kinds present${kindCount ? `: ${kinds.join(", ")}` : ""}${unsourced.length ? ` · ${plural(unsourced.length, "unattributed claim")}` : ""}.`;

    let verdict: GeoVerdict;
    let score: number;
    if (kindCount >= SOURCING_PASS_SIGNAL_KINDS && unsourced.length === 0) {
      verdict = "pass";
      score = 100;
    } else if (kindCount >= SOURCING_WARN_SIGNAL_KINDS) {
      verdict = "warn";
      score = unsourced.length ? 45 : 65;
    } else {
      verdict = "fail";
      score = 10;
    }

    const fixParts: string[] = [];
    if (unsourced.length > 0) {
      fixParts.push(
        `Attribute or delete ${unsourced.map((u) => `"${u}"`).slice(0, 3).join(", ")} — an unsourced statistic is a filter-out signal`
      );
    }
    if (standards.length === 0) fixParts.push("Name the standard the claims rest on (ISO/DIN/EN/FDA number)");
    if (attributions.length === 0) fixParts.push('Point at the source in the sentence ("per the material datasheet", "according to ISO 3601-1")');
    if (expertise.length === 0) fixParts.push("Say who is speaking — the author, the in-house lab, or the company's track record");

    checks.push(
      result(def, {
        verdict,
        score,
        measured,
        fix: fixParts.length ? `${fixParts.join(". ")}.` : "Nothing to change — claims are attributable as written.",
        evidence: unsourced.slice(0, 3),
      })
    );
  }

  /* ── weighted score ── */
  const weighted = checks.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0);
  const score = Math.round(Math.max(0, Math.min(100, weighted)));

  const buckets: ParagraphBucket[] = [
    { label: `<${EXTRACTABLE_TOLERANCE_MIN_WORDS}w`, count: paragraphWordCounts.filter((w) => w < EXTRACTABLE_TOLERANCE_MIN_WORDS).length },
    {
      label: `${EXTRACTABLE_TOLERANCE_MIN_WORDS}–${EXTRACTABLE_MIN_WORDS - 1}w`,
      count: paragraphWordCounts.filter((w) => w >= EXTRACTABLE_TOLERANCE_MIN_WORDS && w < EXTRACTABLE_MIN_WORDS).length,
    },
    {
      label: `${EXTRACTABLE_MIN_WORDS}–${EXTRACTABLE_MAX_WORDS}w`,
      count: paragraphWordCounts.filter((w) => w >= EXTRACTABLE_MIN_WORDS && w <= EXTRACTABLE_MAX_WORDS).length,
    },
    {
      label: `${EXTRACTABLE_MAX_WORDS + 1}–${WALL_PARAGRAPH_WORDS}w`,
      count: paragraphWordCounts.filter((w) => w > EXTRACTABLE_MAX_WORDS && w <= WALL_PARAGRAPH_WORDS).length,
    },
    { label: `>${WALL_PARAGRAPH_WORDS}w`, count: paragraphWordCounts.filter((w) => w > WALL_PARAGRAPH_WORDS).length },
  ];

  const stats: GeoAuditStats = {
    words: totalWords,
    paragraphs: paragraphs.length,
    headings: headings.length,
    descriptiveHeadings,
    lists: lists.length,
    tables: tables.length,
    links: links.length,
    paragraphWordCounts,
    buckets,
    quotableBlocks,
    wallParagraphs,
    figuresWithUnits: unitFigures.length,
    standards: standards.length,
    materials: materials.length,
    vagueAdjectives: vague.length,
    faqQuestions,
    schemaTypes,
    dateSignals: dates.explicit,
  };

  return {
    score,
    band: geoBand(score),
    tooShort,
    checks,
    failing: checks.filter((c) => c.verdict === "fail").map((c) => c.id),
    warning: checks.filter((c) => c.verdict === "warn").map((c) => c.id),
    stats,
  };
}

/**
 * Flattens the failing (and optionally warning) checks into one instruction
 * list — what the /create studio is handed when the user clicks "Improve".
 */
export function geoFixList(audit: GeoAuditResult, includeWarnings = true): string[] {
  return audit.checks
    .filter((c) => c.verdict === "fail" || (includeWarnings && c.verdict === "warn"))
    .sort((a, b) => b.weight * (100 - b.score) - a.weight * (100 - a.score))
    .map((c) => `${c.label}: ${c.fix}`);
}

/** Title-cased opening excerpt used by list rows when a piece has no title. */
export function derivedTitle(text: string, maxWords = 12): string {
  const raw = normalize(text);
  const heading = /^\s*#{1,6}\s+(.+)$/m.exec(raw);
  const source = heading ? heading[1] : raw;
  return firstSentences(stripInlineMarkdown(source).replace(/\s+/g, " ").trim(), maxWords);
}
