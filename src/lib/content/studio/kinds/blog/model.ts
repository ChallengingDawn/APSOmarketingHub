// BLOG POST - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser and the tests: relative imports only.
//
// SARCLA 08.11.2026: "blog - a blog page that needs to update a main blog page that will also be deployed, some kind of
// hierarchy, and then we can automate multiple posts". There is no blog on the shop yet, so the studio makes the whole
// of it: the post (/<store>/blog/<slug>), the blog's home that lists every post (/<store>/blog), and a page per topic
// (/<store>/blog/tag/<tag>) - each as a CMS page to paste, never written to Magento from here.

export type BlogSection = { id: string; heading: string; body: string };
export type BlogFaq = { id: string; q: string; a: string };
export type BlogProduct = { id: string; name: string; url: string };

export type BlogDoc = {
  v: 1;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  hero: { url: string; alt: string };
  /** each section's body is markdown (### sub-headings, lists, tables, **bold**, [links](...), ==key words==) */
  sections: BlogSection[];
  faq: BlogFaq[];
  relatedProducts: BlogProduct[];
  tags: string[];
  author: string;
  /** "YYYY-MM-DD" or "" */
  publishAt: string;
  /** "DE", "FR", ... (the to-do's language) */
  language: string;
  /** the store view the post is published in: "de-CH" */
  store: string;
  notes: string;
};

export const LIMITS = { title: 110, metaTitle: 60, metaDescription: 155, excerpt: 300, tags: 8 };

const STORE_OF: Record<string, string> = { DE: "de-CH", FR: "fr-CH", IT: "it-CH", EN: "en-CH", NL: "nl-NL", PL: "pl-PL" };
export const BLOG_STORES = ["de-CH", "fr-CH", "it-CH", "en-CH", "fr-FR", "it-IT", "nl-NL", "pl-PL"];
export const storeOf = (lang: string | null | undefined) => STORE_OF[String(lang ?? "").toUpperCase()] ?? "de-CH";
export const LANGUAGE_NAME: Record<string, string> = { DE: "German", FR: "French", IT: "Italian", EN: "English", NL: "Dutch", PL: "Polish" };

/** The words a post's page carries around its text, in its language. */
export const WORDS: Record<string, { faq: string; related: string; read: string; all: string; back: string; home: string }> = {
  DE: { faq: "Häufige Fragen", related: "Passende Produkte", read: "Min. Lesezeit", all: "Alle Beiträge", back: "Zum Blog", home: "Blog" },
  FR: { faq: "Questions fréquentes", related: "Produits associés", read: "min de lecture", all: "Tous les articles", back: "Retour au blog", home: "Blog" },
  IT: { faq: "Domande frequenti", related: "Prodotti correlati", read: "min di lettura", all: "Tutti gli articoli", back: "Torna al blog", home: "Blog" },
  EN: { faq: "Questions and answers", related: "Related products", read: "min read", all: "All posts", back: "Back to the blog", home: "Blog" },
  NL: { faq: "Veelgestelde vragen", related: "Gerelateerde producten", read: "min leestijd", all: "Alle berichten", back: "Terug naar de blog", home: "Blog" },
  PL: { faq: "Najczęściej zadawane pytania", related: "Powiązane produkty", read: "min czytania", all: "Wszystkie wpisy", back: "Wróć do bloga", home: "Blog" },
};
export const wordsOf = (lang: string) => WORDS[lang.toUpperCase()] ?? WORDS.EN;

/** A short random id for a section, a question, a product. */
export const newId = () => Math.random().toString(36).slice(2, 10);

/** An address part from words: lower case, plain letters, dashes (ä -> a, ß -> ss). */
export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

/** "Blog article · DE" - the name a to-do gets when nobody named it; not a post's title. */
const DEFAULT_TITLE = /^(blog article|piece)( · [A-Z]{2})?$/i;

export function emptyBlog(p: { title?: string | null; language?: string | null; author?: string | null } = {}): BlogDoc {
  const lang = String(p.language ?? "").toUpperCase() || "DE";
  const title = p.title && !DEFAULT_TITLE.test(p.title.trim()) ? p.title.trim().slice(0, LIMITS.title) : "";
  return {
    v: 1, title, slug: slugify(title), metaTitle: "", metaDescription: "", excerpt: "", hero: { url: "", alt: "" },
    sections: [], faq: [], relatedProducts: [], tags: [], author: p.author ?? "", publishAt: "", language: lang, store: storeOf(lang), notes: "",
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** Any stored document as a post: missing parts filled, unknown values put right (an older first shape too). */
export function blogDoc(raw: unknown, defaults: { language?: string | null; author?: string | null; title?: string | null } = {}): BlogDoc {
  const d = isObj(raw) ? raw : {};
  const e = emptyBlog(defaults);
  const hero = isObj(d.hero) ? d.hero : {};
  const list = <T,>(v: unknown, f: (x: Record<string, unknown>) => T): T[] => (Array.isArray(v) ? v.filter(isObj).map(f) : []);
  const lang = (str(d.language, 4) || e.language).toUpperCase();
  return {
    v: 1,
    title: typeof d.title === "string" ? str(d.title, 300) : e.title,
    slug: typeof d.slug === "string" ? str(d.slug, 120) : e.slug,
    metaTitle: str(d.metaTitle, 300),
    metaDescription: str(d.metaDescription, 600),
    excerpt: str(d.excerpt, 1200),
    hero: { url: str(hero.url, 1000), alt: str(hero.alt, 300) },
    sections: list(d.sections, (x) => ({ id: str(x.id, 20) || newId(), heading: str(x.heading, 300), body: str(x.body, 40_000) })),
    faq: list(d.faq, (x) => ({ id: str(x.id, 20) || newId(), q: str(x.q, 400), a: str(x.a, 4000) })),
    relatedProducts: list(d.relatedProducts, (x) => ({ id: str(x.id, 20) || newId(), name: str(x.name, 200), url: str(x.url, 600) })),
    tags: Array.isArray(d.tags) ? d.tags.map((t) => str(t, 40).trim()).filter(Boolean).slice(0, LIMITS.tags) : [],
    author: typeof d.author === "string" ? str(d.author, 120) : e.author,
    publishAt: day(d.publishAt),
    language: lang,
    store: str(d.store, 20) || storeOf(lang),
    notes: str(d.notes, 4000),
  };
}

/** The post's address on the shop, its home's, a topic's. */
export const postPath = (d: Pick<BlogDoc, "store" | "slug" | "title">) => `/${d.store}/blog/${d.slug || slugify(d.title) || "…"}`;
export const homePath = (store: string) => `/${store}/blog`;
export const tagPath = (store: string, tag: string) => `/${store}/blog/tag/${slugify(tag)}`;
export const SHOP = "https://www.apsoparts.com";

/** The post's words, for reading time and the library. */
export function blogText(raw: unknown): string {
  const d = blogDoc(raw);
  const parts = [
    d.title && `# ${d.title}`,
    d.excerpt,
    ...d.sections.map((s) => `## ${s.heading}\n\n${s.body}`),
    d.faq.length ? `## FAQ\n\n${d.faq.map((f) => `**${f.q}**\n${f.a}`).join("\n\n")}` : "",
    d.metaTitle && `Meta title: ${d.metaTitle}`,
    d.metaDescription && `Meta description: ${d.metaDescription}`,
    d.tags.length ? `Tags: ${d.tags.join(", ")}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function readingMinutes(d: BlogDoc): number {
  const words = [d.excerpt, ...d.sections.map((s) => `${s.heading} ${s.body}`), ...d.faq.map((f) => `${f.q} ${f.a}`)].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/* ── the brand's rules, checked ───────────────────────────────────────── */

const COMPAT = /(compatib|beständig|bestaendig|resistan|résistan|resisten|chemical|chemisch|chimique|chimic|odporno)/i;
const DISCLAIMER = /(no guarantee|no liability|ohne gewähr|ohne gewaehr|keine haftung|sans garantie|sans responsabilit|senza garanzia|nessuna responsabilit|geen garantie|bez gwarancji|for information only|nur zur information|à titre informatif|a titolo informativo)/i;
const DISCOUNT = /(\d+\s?%\s?(rabatt|off|discount|remise|réduction|sconto|korting|zniżk|rabat))|((rabatt|discount|remise|sconto|korting|rabat)\s?(von|of|de|di|van|w wysokości)?\s?\d+\s?%)/i;

/** What the brand's rules say about a text: a manufacturer named, a discount value, compatibility without its line. */
export function brandWarnings(text: string): string[] {
  const out: string[] = [];
  if (/chemours/i.test(text)) out.push("It names Chemours - never in our content.");
  if (DISCOUNT.test(text)) out.push("It shows a discount value - never in our content.");
  if (COMPAT.test(text) && !DISCLAIMER.test(text)) out.push("It speaks of chemical compatibility - add \"for information only, no guarantee, no liability\".");
  return out;
}

/** What still stands in the way of putting the post live. */
export function postWarnings(d: BlogDoc): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push("The post has no title.");
  if (!d.slug.trim()) out.push("The post has no address yet.");
  if (!d.sections.length) out.push("The post has no section yet.");
  if (!d.metaDescription.trim()) out.push("The meta description is empty - Google will pick a sentence of its own.");
  if (d.metaTitle.length > LIMITS.metaTitle) out.push(`The meta title is ${d.metaTitle.length - LIMITS.metaTitle} characters too long.`);
  if (d.metaDescription.length > LIMITS.metaDescription) out.push(`The meta description is ${d.metaDescription.length - LIMITS.metaDescription} characters too long.`);
  if (d.hero.url && !d.hero.alt.trim()) out.push("The picture has no description for screen readers and Google.");
  out.push(...brandWarnings(blogText(d)));
  return out;
}

/* ── many posts at once ───────────────────────────────────────────────── */

/** "YYYY-MM-DD" n days after another. */
export function addDays(dayIso: string, n: number): string {
  const t = Date.parse(`${dayIso}T12:00:00Z`);
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/** Topics (one per line, list marks dropped, each once) as to-dos due a week apart from `start`. 20 at most. */
export function batchPlan(topics: string, start: string): { title: string; dueDate: string }[] {
  const seen = new Set<string>();
  const out: { title: string; dueDate: string }[] = [];
  for (const line of topics.split(/\r?\n/)) {
    const t = line.replace(/^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/, "").replace(/\s+/g, " ").trim().slice(0, 200);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push({ title: t, dueDate: addDays(start, 7 * out.length) });
    if (out.length >= 20) break;
  }
  return out;
}

/* ── the blog's home ──────────────────────────────────────────────────── */

/** One post as the blog's home lists it (from any project the person can open). */
export type BlogCard = {
  pieceId: number; projectId: number; title: string; slug: string; excerpt: string; hero: { url: string; alt: string };
  date: string | null; tags: string[]; status: string; language: string; store: string; minutes: number;
};

/** Newest first: by its publishing day, else its due day; the ones without either last. */
export function sortCards(cards: BlogCard[]): BlogCard[] {
  return [...cards].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.pieceId - a.pieceId);
}

/** The cards of one store view, with the post being written laid over its stored card (so the home shows it as typed). */
export function homeCards(cards: BlogCard[], current: BlogCard): BlogCard[] {
  const rest = cards.filter((c) => c.pieceId !== current.pieceId);
  return sortCards([...rest, current].filter((c) => c.store === current.store));
}

/** Every topic of these posts, the most used first. */
export function topicsOf(cards: BlogCard[]): string[] {
  const n = new Map<string, number>();
  for (const c of cards) for (const t of c.tags) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export const cardOf = (d: BlogDoc, x: { pieceId: number; projectId: number; status: string; due: string | null }): BlogCard => ({
  pieceId: x.pieceId, projectId: x.projectId, title: d.title, slug: d.slug || slugify(d.title), excerpt: d.excerpt, hero: d.hero,
  date: d.publishAt || x.due, tags: d.tags, status: x.status, language: d.language, store: d.store, minutes: readingMinutes(d),
});
