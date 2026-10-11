// WHAT WE ARE ACTUALLY WRITING.
//
// Create Studio used to offer six "channels" — LinkedIn, Blog, Newsletter, Ad,
// Product, SEO — and the only instruction the model received about shape was
// one sentence: "if product or SEO, follow the product content page
// structure". There was no such structure written down anywhere, so every type
// came back as the same essay with a different length, and the output was,
// fairly, called not great.
//
// A channel says where something is published. A TYPE says what it is: what
// sections it has, what each section must do, how long it runs, and what
// evidence it needs before it can be written at all. An ad with a 30-character
// headline limit and a landing page with six capability tiles are not the same
// job with a different word count.
//
// The landing-page skeleton below is not invented. It is the shape of the
// DirectCut landing page an agent built earlier this year, which is the best
// page we have produced: promise, what it is, the options, six concrete proofs
// of what we can actually do, a customer in their own words, then one ask. The
// "six proofs" section is the part that made it good — it is where the page
// stops describing a product and starts showing capability.

export type ContentSection = {
  heading: string;
  /** What this section is FOR. Goes to the model as the section's job. */
  job: string;
  /** Roughly how long, so one section cannot eat the page. */
  words: number;
};

export type SeoNeed =
  /** The query this page should own, with its position and impressions. */
  | "query"
  /** An existing page and what it has lost. */
  | "page"
  /** Two or more competing URLs and which should survive. */
  | "competing-urls"
  /** Nothing from Search Console; the brief stands on its own. */
  | "none";

export type ContentType = {
  key: string;
  label: string;
  /** One line, shown on the card. What you get, not what it is called. */
  blurb: string;
  /** Grouping for the picker, Adobe Express style. */
  group: "Pages" | "Posts" | "Campaigns" | "Fixes";
  /** Where it ends up — kept, because tone still follows the channel. */
  channel: "seo" | "blog" | "product" | "linkedin" | "newsletter" | "ad";
  format: "markdown" | "plain" | "fields";
  sections: ContentSection[];
  seoNeeds: SeoNeed;
  /** Hard limits the model must respect, written as the model will read them. */
  constraints?: string[];
};

export const CONTENT_TYPES: ContentType[] = [
  {
    key: "landing-page",
    label: "SEO landing page",
    blurb: "A page built to own one query — promise, proof, and what we can actually do.",
    group: "Pages",
    channel: "seo",
    format: "markdown",
    seoNeeds: "query",
    sections: [
      { heading: "Hero", job: "The promise in the reader's own words, as a headline of eight words or fewer plus one sentence. It must name the thing they searched for, not a category.", words: 40 },
      { heading: "What it is", job: "Plainly what we make or do here, and for whom. No adjectives that a competitor could copy word for word.", words: 110 },
      { heading: "The options", job: "The real choices — materials, dimensions, tolerances, finishes. Concrete values, not 'a wide range'. This is the section that proves the page is not a brochure.", words: 150 },
      { heading: "Why us — six proofs", job: "SIX short tiles, each one capability stated as a fact with a number, a named shop feature or a material property. This is the section that made the DirectCut page work: it shows what we can do rather than claiming we are good.", words: 180 },
      { heading: "A customer, in their own words", job: "One short quote or a described situation a real buyer would recognise from their own week. Never invented as a named testimonial.", words: 60 },
      { heading: "The ask", job: "One action, named, with what happens next. Not 'contact us'.", words: 40 },
    ],
    constraints: [
      "The query this page targets must appear in the H1 and in the first 100 words, written the way a person would say it.",
      "Never invent a customer name, a company, a certification or a tolerance. If a figure is not supplied, describe the capability without a number.",
    ],
  },
  {
    key: "product-page",
    label: "Product page copy",
    blurb: "Benefits, specification and applications for one article or family.",
    group: "Pages",
    channel: "product",
    format: "markdown",
    seoNeeds: "query",
    sections: [
      { heading: "What it is", job: "One paragraph a buyer can forward to a colleague who has never heard of the part.", words: 80 },
      { heading: "Where it is used", job: "Three to five named applications, each an industry and a situation, not a word.", words: 110 },
      { heading: "Specification", job: "The properties that decide a purchase: material, temperature range, pressure, dimensions, standards. Only values that were supplied.", words: 120 },
      { heading: "How to choose", job: "The two or three decisions a buyer gets wrong, and how to get them right.", words: 110 },
      { heading: "The ask", job: "What to do next — configure, request a sample, ask an engineer.", words: 30 },
    ],
    constraints: ["Never state a figure that was not supplied. An absent value is omitted, never estimated."],
  },
  {
    key: "blog-article",
    label: "Blog article",
    blurb: "An explainer that answers one question properly, with a point of view.",
    group: "Posts",
    channel: "blog",
    format: "markdown",
    seoNeeds: "query",
    sections: [
      { heading: "The question", job: "The problem as the reader would put it, and why the usual answer is not enough.", words: 90 },
      { heading: "The short answer", job: "Answer it in the first screen. Do not make them scroll for it.", words: 80 },
      { heading: "What actually decides it", job: "Two or three H2 sections of real engineering substance, each ending somewhere useful.", words: 400 },
      { heading: "What we would do", job: "Our own position, stated plainly, including where it differs from common practice.", words: 110 },
      { heading: "The ask", job: "One next step that fits someone who just learned something.", words: 30 },
    ],
  },
  {
    key: "linkedin-post",
    label: "LinkedIn post",
    blurb: "One idea, one hook, no thread.",
    group: "Posts",
    channel: "linkedin",
    format: "plain",
    seoNeeds: "none",
    sections: [
      { heading: "Hook", job: "A first line that works alone in the feed, before 'see more'. Concrete, no colon-splitting.", words: 15 },
      { heading: "The point", job: "The idea, with one specific detail that proves it is ours and not generic.", words: 90 },
      { heading: "The ask", job: "A question or an invitation that a peer would actually answer.", words: 20 },
    ],
    constraints: ["No hashtag soup: at most three, and only ones a human would use.", "No emoji bullets."],
  },
  {
    key: "newsletter",
    label: "Newsletter",
    blurb: "Subject line, preheader and three items worth opening for.",
    group: "Campaigns",
    channel: "newsletter",
    format: "fields",
    seoNeeds: "none",
    sections: [
      { heading: "Subject", job: "Under 55 characters, concrete, no 'newsletter' and no month name.", words: 10 },
      { heading: "Preheader", job: "Under 90 characters, and it must not repeat the subject.", words: 15 },
      { heading: "Lead item", job: "The one thing worth the open, written as news rather than as an announcement.", words: 110 },
      { heading: "Two shorter items", job: "Two more, each one sentence of substance plus a link reason.", words: 90 },
    ],
  },
  {
    key: "search-ad",
    label: "Search ad",
    blurb: "Headlines and descriptions inside Google's real character limits.",
    group: "Campaigns",
    channel: "ad",
    format: "fields",
    seoNeeds: "query",
    sections: [
      { heading: "Headlines", job: "Eight headlines, each 30 characters or fewer, counted. At least three contain the query.", words: 40 },
      { heading: "Descriptions", job: "Four descriptions, each 90 characters or fewer, counted.", words: 60 },
    ],
    constraints: [
      "Character limits are hard. Count every headline and description and state the count in brackets after each one.",
      "No superlatives that cannot be substantiated — no 'best', no 'leading'.",
    ],
  },
  {
    key: "page-refresh",
    label: "Page refresh",
    blurb: "What to add to a page that is losing clicks — written as edits, not a rewrite.",
    group: "Fixes",
    channel: "seo",
    format: "markdown",
    seoNeeds: "page",
    sections: [
      { heading: "What it has lost", job: "State the decline in the page's own numbers, from the evidence supplied. No speculation about why beyond what the data supports.", words: 60 },
      { heading: "What to add", job: "Three to five concrete additions — a section, a table, an answer the page does not currently give. Each written as a heading plus the paragraph to insert.", words: 320 },
      { heading: "What to cut", job: "Anything on the page that no longer earns its place, named.", words: 60 },
      { heading: "Leave alone", job: "What is working and must not be touched in the edit.", words: 40 },
    ],
    constraints: ["This is an edit list for an existing page. Never produce a replacement page."],
  },
  {
    key: "consolidation-brief",
    label: "Consolidation brief",
    blurb: "Two of our pages compete for one query — which survives, and what moves.",
    group: "Fixes",
    channel: "seo",
    format: "markdown",
    seoNeeds: "competing-urls",
    sections: [
      { heading: "The decision", job: "Which URL survives and which folds, stated once, with the reason from the evidence.", words: 70 },
      { heading: "What moves across", job: "The specific sections, tables and terms the losing page holds that the survivor does not.", words: 160 },
      { heading: "The redirect and the links", job: "The redirect to put in place and the internal links that must be repointed.", words: 90 },
      { heading: "What the survivor becomes", job: "The H1 and opening the surviving page should carry once it owns the query outright.", words: 90 },
    ],
    constraints: [
      "This is not a writing job and must not produce a new page. Publishing another page for a cannibalised query makes it worse.",
    ],
  },
];

export const CONTENT_BY_KEY: Record<string, ContentType> = Object.fromEntries(
  CONTENT_TYPES.map((t) => [t.key, t]),
);

export const CONTENT_GROUPS = ["Pages", "Posts", "Campaigns", "Fixes"] as const;

/**
 * The structure, written for the model rather than for us.
 *
 * Spelled out as sections with a job each, because "follow the product
 * content page structure" referred to a structure that existed in nobody's
 * head and certainly not in the model's.
 */
export function structurePrompt(type: ContentType): string {
  const lines = [
    `You are writing: ${type.label}. ${type.blurb}`,
    ``,
    `Produce EXACTLY these sections, in this order:`,
    ...type.sections.map(
      (s, i) => `${i + 1}. ${s.heading} (~${s.words} words) — ${s.job}`,
    ),
  ];
  if (type.constraints?.length) {
    lines.push(``, `Rules for this type, which override anything more general:`);
    lines.push(...type.constraints.map((c) => `- ${c}`));
  }
  lines.push(
    ``,
    type.format === "fields"
      ? `Return each section under its own heading. Where a section asks for a count, produce exactly that many.`
      : type.format === "plain"
        ? `Return plain prose with no markdown headings — it is published as a single block of text.`
        : `Return markdown, with each section as an H2 except the hero, which is the H1.`,
  );
  return lines.join("\n");
}
