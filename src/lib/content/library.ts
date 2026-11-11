// THE CONTENT LIBRARY: ONE PAGE PER KIND OF CONTENT (SARCLA 11.11.2026, ~13:40, right after publishing the first official
// Page builder page, the Kalrez page: "Content library: we should have one page per type of content, and content should
// really display, and in one click back to edit, for all that we publish from the one [hub]").
//
// Pure: relative imports only - the server's read (./libraryRead.ts), the library pages (src/app/projects/library) and
// tests/content-library.test.ts. Nothing here reads or writes anything.
//
// A piece of the library is a to-do with a studio document (apsomh_content_piece_docs): what it shows (its picture, its
// title, its languages), how far it is (draft, in review, approved, published) and WHERE IT IS - read from the to-do's own
// records of what went out:
//   page        the Page builder's last step keeps one record per environment and store view it wrote (doc.magento,
//               newest first; ./studio/kinds/page/published.ts liveOn) - a link per store view on production and on ACC
//   banner      put on a page by "Put it on a page" (a change `banner-<id>` of that page, or an older insert): where that
//               page is
//   newsletter  sent to HubSpot as a draft (doc.hubspot)
//   social      marked as posted (doc.published)
//   blog, video the hub writes them nowhere: marked Live on the board (the status event's when and who)
// OFFICIAL = live on production: a page written into production's store views, a banner on such a page, a social post
// marked posted, any piece the team moved to Live.

import { langOfStore, pageDoc, pageTitleOf, type MagentoRecord } from "./studio/kinds/page/model";
import { liveOn, type ShopEnv } from "./studio/kinds/page/published";
import { STUDIO_KINDS, type StudioKind } from "./studio/kinds";
import { isPieceStatus, type PieceStatus } from "./pieceRules";

/* ── the kinds, one library page each ─────────────────────────────────── */

export type LibraryKind = {
  slug: string;
  kind: StudioKind;
  /** the page's title and the menu's word */
  label: string;
  /** one of them, as a sentence says it */
  one: string;
  /** what the page says it holds */
  note: string;
  /** where "Make one" goes (Content's Make, lib/../projects/make/makeKinds.ts) */
  make: string;
};

/** The library's pages, in the menu's order - one per studio there is (./studio/kinds.ts). */
export const LIBRARY_KINDS: LibraryKind[] = [
  { slug: "pages", kind: "page", label: "Pages", one: "page", note: "Every page made in the Page builder - where it is on the shop, per store view", make: "/projects/make/page-refresh" },
  { slug: "banners", kind: "banner", label: "Banners", one: "banner", note: "Every banner - its picture, and the pages it is on", make: "/projects/make/banner" },
  { slug: "blog", kind: "blog", label: "Blog posts", one: "blog post", note: "Every blog article - as the reader sees it", make: "/projects/make/blog-article" },
  { slug: "newsletters", kind: "newsletter", label: "Newsletters", one: "newsletter", note: "Every newsletter - and its draft in HubSpot", make: "/projects/make/newsletter" },
  { slug: "social", kind: "social", label: "Social posts", one: "social post", note: "Every post for LinkedIn, Instagram and Facebook", make: "/projects/make/social-post" },
  { slug: "videos", kind: "video", label: "Videos", one: "video", note: "Every film made in the video studio", make: "/projects/make/video" },
];
export const libraryKindBySlug = (slug: string | null | undefined): LibraryKind | null => LIBRARY_KINDS.find((k) => k.slug === slug) ?? null;
export const libraryKindOf = (kind: StudioKind): LibraryKind => LIBRARY_KINDS.find((k) => k.kind === kind)!;
export const libraryHref = (slug: string) => `/projects/library/${slug}`;

/** The studio a piece opens in - the content board's own address (lib/content/convertTodo.ts studioPath). The page studio
 * opens at its Build step. */
export const studioHref = (projectId: number, pieceId: number) => `/projects/${projectId}/pieces/${pieceId}`;

/* ── a piece, as the library shows it ─────────────────────────────────── */

/** How far a piece is, as the library sorts and filters it: official first. */
export const LIB_STATES = ["official", "published", "approved", "review", "draft"] as const;
export type LibState = (typeof LIB_STATES)[number];
export const LIB_STATE_LABEL: Record<LibState, string> = {
  official: "Official", published: "Published", approved: "Approved", review: "In review", draft: "Draft",
};

/** One place a piece is: an environment (production, ACC), HubSpot, a page it is on, or the team's mark. */
export type WhereKind = "prod" | "acc" | "hubspot" | "page" | "marked";
export type WhereLink = { label: string; url: string; /** a page of the hub (opens here), not of the shop */ internal?: boolean };
export type Where = {
  kind: WhereKind;
  /** "Production", "ACC", "HubSpot draft", "Marked live" */
  label: string;
  /** what it is on, when it is not the piece itself ("on Kalrez® 6221 & 6230 Discontinued") */
  sub?: string;
  /** when it was written there, and by whom (a username) */
  at: string | null;
  by: string | null;
  links: WhereLink[];
};

export type LibraryItem = {
  pieceId: number;
  projectId: number;
  project: string;
  kind: StudioKind;
  slug: string;
  contentType: string | null;
  title: string;
  /** a line under the title: the page's address, the newsletter's preheader, the post's first words */
  line: string;
  /** its picture (the hub's address /api/content/picture/..., or the shop's) - null: none yet */
  picture: string | null;
  /** its languages, upper case (EN, DE ...) */
  languages: string[];
  /** a page: the store views it goes to */
  storeViews: number;
  status: PieceStatus;
  state: LibState;
  official: boolean;
  where: Where[];
  writer: string | null;
  reviewer: string | null;
  updatedAt: string;
  updatedBy: string | null;
  href: string;
};

/** A row of the server's one read (libraryQuery). */
export type LibraryDbRow = {
  piece_id: number; kind: string; project_id: number; project: string | null; title: string | null; status: string | null;
  language: string | null; content_type: string | null; writer: string | null; reviewer: string | null;
  updated_at: Date | string; updated_by: string | null;
  /** the last move to Live on the board: { at, by } */
  live_event: { at?: unknown; by?: unknown } | null;
  /** the document's parts the library reads (libraryQuery) */
  doc: unknown;
  /** the first picture found in the document's parts that hold pictures */
  first_pic: string | null;
  /** a banner: the pages of its project it is on, with their records of what went out */
  on_pages: unknown;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const iso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString();
  const s = str(v, 40);
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};
const https = (v: unknown): string => { const s = str(v, 600); return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : ""; };
/** A picture the hub may show: its own, the shop's, any https address. */
export function pictureOf(v: unknown): string | null {
  const s = str(v, 600);
  if (/^\/api\/content\/picture\/[\w-]+$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>\\]+$/i.test(s)) return s;
  return null;
}
const upperLang = (v: unknown) => { const s = str(v, 8).slice(0, 2).toUpperCase(); return /^[A-Z]{2}$/.test(s) ? s : ""; };
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Where a page is on each shop: a link per store view, when it was last written there and by whom. */
export function pageWhere(records: readonly MagentoRecord[], sub?: string): Where[] {
  const out: Where[] = [];
  for (const env of ["prod", "acc"] as ShopEnv[]) {
    const pages = liveOn(records, env);
    if (!pages.length) continue;
    const last = records.find((r) => r.env === env) ?? null;
    out.push({
      kind: env, label: env === "prod" ? "Production" : "ACC", ...(sub ? { sub } : {}),
      at: last?.at || null, by: last?.by || null,
      links: pages.map((p) => ({ label: p.store, url: p.url })),
    });
  }
  return out;
}

/** The library's state from the board's status and where the piece is. */
export function stateOf(status: PieceStatus, official: boolean, published: boolean): LibState {
  if (official) return "official";
  if (published || status === "live") return "published";
  if (status === "approved") return "approved";
  if (status === "review") return "review";
  return "draft";
}

/** A row of the read as the library's piece - null for a kind the library has no page for, or a document holding nothing. */
export function libraryItem(row: LibraryDbRow): LibraryItem | null {
  if (!(STUDIO_KINDS as readonly string[]).includes(row.kind)) return null;
  const kind = row.kind as StudioKind;
  const lib = libraryKindOf(kind);
  const status: PieceStatus = isPieceStatus(row.status) ? row.status : "todo";
  const d = isObj(row.doc) ? row.doc : {};
  const todo = str(row.title, 200);
  const marked: Where | null = status === "live" && isObj(row.live_event)
    ? { kind: "marked", label: "Marked live", at: iso(row.live_event.at) || null, by: str(row.live_event.by, 255) || null, links: [] }
    : status === "live" ? { kind: "marked", label: "Marked live", at: null, by: null, links: [] } : null;
  let own = "";
  let line = "";
  let picture: string | null = null;
  let languages: string[] = [];
  let storeViews = 0;
  let where: Where[] = [];
  let official = false;
  let published = false;

  if (kind === "page") {
    const page = pageDoc(d, row.language);
    // a page of the shop: its h1 as the studio read it, else its title there (" | APSOparts Shop" left out)
    own = pageTitleOf(page) || str(page.outline?.title, 200).replace(/\s*\|\s*APSOparts.*$/i, "");
    const key = page.source === "new" ? (page.fields.seo.urlKey.trim() || page.newPage.urlKey.trim()) : "";
    line = page.source === "new" ? (key ? `/${key}` : "A new page") : page.path || "A page of the shop";
    const hero = pictureOf(page.fields.hero.picture.url) ?? pictureOf(page.fields.sections.find((s) => s.picture.url)?.picture.url);
    picture = hero ?? pictureOf(row.first_pic);
    const views = [page.store, ...Object.values(page.langs).map((l) => l.store)].filter(Boolean);
    languages = uniq(views.map((s) => langOfStore(s).toUpperCase()));
    storeViews = uniq([...page.stores, ...Object.values(page.langs).flatMap((l) => l.stores ?? [l.store])].filter(Boolean)).length || views.length;
    where = pageWhere(page.magento);
    official = where.some((w) => w.kind === "prod");
    published = where.some((w) => w.kind === "acc");
  } else if (kind === "banner") {
    const c = isObj(d.content) ? d.content : {};
    own = str(c.headline, 200);
    line = str(c.line, 200) || str(c.eyebrow, 120);
    // cv16: the banner as it was last drawn for the shop's pages (doc.shot), else its photo
    const shot = isObj(d.shot) ? d.shot : {};
    picture = pictureOf(shot.desktop) ?? pictureOf(isObj(c.image) ? c.image.url : null) ?? pictureOf(row.first_pic);
    const shotAt = iso(shot.at);
    languages = [upperLang(d.language) || upperLang(row.language)].filter(Boolean);
    const pages = Array.isArray(row.on_pages) ? row.on_pages.filter(isObj) : [];
    for (const p of pages) {
      const pd = pageDoc({ magento: p.magento }, null);
      const name = str(p.title, 200) || "a page";
      // cv16: the banner drawn again after the page last went out - the shop still shows the older look; said
      const out = pd.magento.map((r) => iso(r.at)).filter(Boolean).sort().at(-1) ?? "";
      const at = pageWhere(pd.magento, `on ${name}${shotAt && out && shotAt > out ? " · changed since - goes out with the page's next update" : ""}`);
      if (at.length) where.push(...at);
      else if (typeof p.pieceId === "number" && typeof p.projectId === "number") {
        where.push({ kind: "page", label: "On a page", sub: name, at: null, by: null, links: [{ label: "Open the page", url: studioHref(p.projectId, p.pieceId), internal: true }] });
      }
    }
    official = status === "live" || where.some((w) => w.kind === "prod");
    published = where.length > 0;
  } else if (kind === "blog") {
    own = str(d.title, 200);
    const store = str(d.store, 20);
    const slug = str(d.slug, 120);
    line = store && slug ? `/${store}/blog/${slug}` : str(d.excerpt, 200);
    picture = pictureOf(d.hero) ?? pictureOf(row.first_pic);
    languages = [upperLang(d.language) || upperLang(row.language) || upperLang(store)].filter(Boolean);
    // cv16 (11.11.2026): its pages as the last step found them on the shop (www) - the post, the blog's home, its topics
    const pub = isObj(d.published) ? d.published : null;
    const links = (pub && Array.isArray(pub.pages) ? pub.pages.filter(isObj) : [])
      .map((x) => ({ label: str(x.label, 120) || str(x.path, 200), url: https(str(x.url, 400)) }))
      .filter((l): l is WhereLink => !!l.url).slice(0, 12);
    if (pub && links.length) where.push({ kind: "prod", label: "On the shop", at: iso(pub.at) || null, by: str(pub.by, 255) || null, links });
    official = status === "live" || where.length > 0;
  } else if (kind === "newsletter") {
    own = str(d.subject, 200);
    line = str(d.preheader, 200);
    picture = pictureOf(row.first_pic);
    // cv16: every language is an e-mail of its own (doc.langs), each with its own HubSpot draft
    const others = isObj(d.langs) ? Object.entries(d.langs).filter(([k, v]) => upperLang(k) && isObj(v)) as [string, Record<string, unknown>][] : [];
    const own1 = upperLang(d.language) || upperLang(row.language);
    languages = [own1, ...others.map(([k]) => upperLang(k))].filter((l, i, a) => l && a.indexOf(l) === i);
    const draftOf = (hsRaw: unknown, lang: string) => {
      const hs = isObj(hsRaw) ? hsRaw : null;
      const emailId = hs ? str(hs.emailId, 40) : "";
      if (!hs || !emailId) return;
      const url = https(hs.url);
      where.push({ kind: "hubspot", label: others.length ? `HubSpot draft · ${lang}` : "HubSpot draft", at: iso(hs.at) || null, by: null, links: url ? [{ label: `E-mail ${emailId}`, url }] : [] });
    };
    draftOf(d.hubspot, own1);
    for (const [k, v] of others) draftOf(v.hubspot, upperLang(k));
    official = status === "live";
    published = where.length > 0;
  } else if (kind === "social") {
    line = str(d.text, 200).split("\n")[0];
    picture = pictureOf(d.image) ?? pictureOf(row.first_pic);
    languages = [upperLang(row.language)].filter(Boolean);
    const pub = isObj(d.published) ? d.published : null;
    if (pub) where.push({ kind: "marked", label: "Posted", at: iso(pub.at) || null, by: str(pub.by, 255) || null, links: [] });
    official = !!pub || status === "live";
  } else {
    const scenes = typeof d.scenes === "number" ? d.scenes : 0;
    // the film's real length (cv16): its bars of 2 s, scenes and end card - else the length it was asked to be
    const secs = typeof d.secs === "number" && d.secs > 0 ? d.secs : typeof d.length === "number" ? d.length : 0;
    line = [scenes ? `${scenes} scene${scenes === 1 ? "" : "s"}` : "", secs ? `${secs} s` : "", str(d.format, 20)].filter(Boolean).join(" · ");
    picture = pictureOf(row.first_pic);
    // its language versions too (cv16: every language a tab of its own, exported a file each)
    languages = uniq([upperLang(d.language) || upperLang(row.language), ...(Array.isArray(d.langs) ? d.langs.map(upperLang) : [])].filter(Boolean));
    official = status === "live";
  }
  // the board's mark, when nothing else says where it went
  if (marked && !where.length) where = [marked];
  if (!own && !picture && !where.length && status === "todo") return null;
  return {
    pieceId: row.piece_id, projectId: row.project_id, project: str(row.project, 200), kind, slug: lib.slug,
    contentType: row.content_type ?? null, title: own || todo || `Untitled ${lib.one}`, line, picture, languages, storeViews,
    status, state: stateOf(status, official, published), official, where,
    writer: row.writer ?? null, reviewer: row.reviewer ?? null,
    updatedAt: iso(row.updated_at), updatedBy: row.updated_by ?? null, href: studioHref(row.project_id, row.piece_id),
  };
}

/** The words of a card's status: where it is when it is out ("Live on production", "On ACC", "HubSpot draft"), else how
 * far it is. */
export function stateWord(i: Pick<LibraryItem, "state" | "where" | "kind">): string {
  const has = (k: WhereKind) => i.where.some((w) => w.kind === k);
  if (i.state === "official") return has("prod") ? "Live on production" : i.kind === "social" && has("marked") ? "Posted" : "Live";
  if (i.state === "published") {
    if (has("acc")) return "On ACC";
    if (has("hubspot")) return "HubSpot draft";
    if (has("page")) return "On a page";
    return "Marked live";
  }
  return LIB_STATE_LABEL[i.state];
}

/** The newest time a piece went out anywhere ("" = never). */
export const lastOut = (i: LibraryItem): string => i.where.map((w) => w.at ?? "").sort().at(-1) ?? "";

/** The library's order: official first, then published, approved, in review, drafts - the newest out (else the newest
 * change) first in each. */
export function libraryOrder(items: readonly LibraryItem[]): LibraryItem[] {
  const rank = (s: LibState) => LIB_STATES.indexOf(s);
  return [...items].sort((a, b) => rank(a.state) - rank(b.state) || lastOut(b).localeCompare(lastOut(a)) || b.updatedAt.localeCompare(a.updatedAt) || b.pieceId - a.pieceId);
}

/** The rows as the library's pieces, in its order. */
export function libraryItems(rows: readonly LibraryDbRow[]): LibraryItem[] {
  return libraryOrder(rows.map(libraryItem).filter((x): x is LibraryItem => !!x));
}

/* ── the counts at the top, the filters ───────────────────────────────── */

export type KindCount = { slug: string; label: string; total: number; official: number; published: number };

/** Per kind: how many pieces, how many official, how many published (official ones not counted again). */
export function kindCounts(items: readonly LibraryItem[]): KindCount[] {
  return LIBRARY_KINDS.map((k) => {
    const mine = items.filter((i) => i.kind === k.kind);
    return { slug: k.slug, label: k.label, total: mine.length, official: mine.filter((i) => i.state === "official").length, published: mine.filter((i) => i.state === "published").length };
  });
}

/** "1 official", "1 official · 2 published", "3 in progress", "none yet" - the small line under a kind at the top. */
export function countLine(c: KindCount): string {
  const parts = [c.official ? `${c.official} official` : "", c.published ? `${c.published} published` : ""].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return c.total ? `${c.total} in progress` : "none yet";
}

export type LibraryFilter = { state: LibState | "all"; language: string | "all"; project: number | "all"; q: string };
export const NO_FILTER: LibraryFilter = { state: "all", language: "all", project: "all", q: "" };

/** The words a search looks through: the title, its line, the project, the languages, the store views and addresses. */
const hay = (i: LibraryItem, names: Readonly<Record<string, string>>) => [
  i.title, i.line, i.project, ...i.languages, ...i.where.flatMap((w) => [w.label, w.sub ?? "", ...w.links.map((l) => `${l.label} ${l.url}`)]),
  i.writer ?? "", i.writer ? names[i.writer] ?? "" : "", i.reviewer ? names[i.reviewer] ?? "" : "",
].join(" ").toLowerCase();

export function filterItems(items: readonly LibraryItem[], f: LibraryFilter, names: Readonly<Record<string, string>> = {}): LibraryItem[] {
  const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => (f.state === "all" || i.state === f.state)
    && (f.language === "all" || i.languages.includes(f.language))
    && (f.project === "all" || i.projectId === f.project)
    && (!words.length || ((h) => words.every((w) => h.includes(w)))(hay(i, names))));
}

/** The choices a filter row offers, from the pieces themselves: each state with its count; the languages and projects
 * present. */
export function filterChoices(items: readonly LibraryItem[]): {
  states: { key: LibState; count: number }[]; languages: string[]; projects: { id: number; title: string }[];
} {
  const order = ["EN", "DE", "FR", "IT", "NL", "PL", "CS", "ES"];
  const langs = uniq(items.flatMap((i) => i.languages)).sort((a, b) => ((order.indexOf(a) + 99) % 99) - ((order.indexOf(b) + 99) % 99) || a.localeCompare(b));
  const projects = new Map<number, string>();
  for (const i of items) if (!projects.has(i.projectId)) projects.set(i.projectId, i.project || `Project ${i.projectId}`);
  return {
    states: LIB_STATES.map((key) => ({ key, count: items.filter((i) => i.state === key).length })),
    languages: langs,
    projects: [...projects].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** Every username the pieces name (writers, reviewers, who wrote them out) - to read their names once. */
export const peopleIn = (items: readonly LibraryItem[]): string[] =>
  uniq(items.flatMap((i) => [i.writer, i.reviewer, i.updatedBy, ...i.where.map((w) => w.by)]).filter((u): u is string => !!u));

/* ── the server's one read (./libraryRead.ts runs it; the tests run it on PGlite) ── */

/** The first picture in a part of a document ($2): the hub's own address, a photo of the shop's media, a file of our
 * HubSpot's (a newsletter's) - the hosts the hub's pages may show pictures from (next.config.ts img-src). */
export const PICTURE_RE = String.raw`(/api/content/picture/[A-Za-z0-9_-]+|https://(www\.apsoparts\.com/media|26492587\.fs1\.hubspotusercontent-eu1\.net)/[^"[:space:]\\]+\.(jpe?g|png|webp|gif))`;

/** A page's fields without the parts no card needs (the modules' settings, looks, the block order). */
const slimFields = (f: string) => `CASE WHEN jsonb_typeof(${f}) = 'object' THEN jsonb_build_object(
    'hero', jsonb_build_object('title', ${f} #> '{hero,title}', 'picture', jsonb_build_object('url', ${f} #> '{hero,picture,url}')),
    'sections', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s -> 'id', 'picture', jsonb_build_object('url', s #> '{picture,url}'))), '[]'::jsonb)
                   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${f} -> 'sections') = 'array' THEN ${f} -> 'sections' ELSE '[]'::jsonb END) s),
    'seo', ${f} -> 'seo') ELSE NULL END`;

/**
 * ONE query ($1 = the person's username, $2 = PICTURE_RE): every to-do with a studio document in the projects this person
 * may open - the Content rules (src/lib/content/sharing.ts accessFor): their own, the ones shared with them (editor or
 * commenter), every one for an admin; a deleted project never (an archived one still: what it put out may be on the shop).
 * Of each document only the parts a card shows - never its words, modules or designs (a page's document is large).
 * Nothing is written.
 */
export function libraryQuery(admin: boolean): string {
  const member = "EXISTS (SELECT 1 FROM apsomh_content_project_members x WHERE x.project_id = p.id AND x.username = $1)";
  // an admin sees every project - the parameter is still read, or Postgres refuses the one sent (as workflow.ts boardFor)
  const visible = admin ? "$1::text IS NOT NULL" : `(p.created_by = $1 OR ${member})`;
  const arr = (x: string) => `CASE WHEN jsonb_typeof(${x}) = 'array' THEN ${x} ELSE '[]'::jsonb END`;
  return `SELECT d.piece_id, d.kind, pc.project_id, p.title AS project, pc.title, pc.status, pc.language, pc.content_type,
            pc.writer, pc.reviewer, d.updated_at, d.updated_by,
            (SELECT jsonb_build_object('at', e.created_at, 'by', e.actor) FROM apsomh_content_events e
              WHERE e.piece_id = pc.id AND e.kind = 'status' AND e.detail ->> 'to' = 'live' ORDER BY e.created_at DESC LIMIT 1) AS live_event,
            CASE d.kind
              WHEN 'page' THEN jsonb_build_object(
                'source', d.doc -> 'source', 'env', d.doc -> 'env', 'store', d.doc -> 'store', 'path', d.doc -> 'path', 'stores', d.doc -> 'stores',
                'outline', CASE WHEN jsonb_typeof(d.doc -> 'outline') = 'object' THEN jsonb_build_object('path', d.doc #> '{outline,path}',
                  'title', d.doc #> '{outline,title}', 'h1', d.doc #> '{outline,h1}') END,
                'fields', ${slimFields("d.doc -> 'fields'")},
                'newPage', jsonb_build_object('title', d.doc #> '{newPage,title}', 'urlKey', d.doc #> '{newPage,urlKey}'),
                'langs', COALESCE((
                  SELECT jsonb_object_agg(l.key, CASE WHEN jsonb_typeof(l.value) = 'object'
                           THEN jsonb_build_object('store', l.value -> 'store', 'stores', l.value -> 'stores', 'path', l.value -> 'path') ELSE l.value END)
                    FROM jsonb_each(CASE WHEN jsonb_typeof(d.doc -> 'langs') = 'object' THEN d.doc -> 'langs' ELSE '{}'::jsonb END) l), '{}'::jsonb),
                'magento', d.doc -> 'magento')
              WHEN 'banner' THEN jsonb_build_object('content', jsonb_build_object(
                  'headline', d.doc #> '{content,headline}', 'line', d.doc #> '{content,line}', 'eyebrow', d.doc #> '{content,eyebrow}',
                  'image', jsonb_build_object('url', d.doc #> '{content,image,url}')), 'language', d.doc -> 'language', 'shot', d.doc -> 'shot')
              WHEN 'blog' THEN jsonb_build_object('title', d.doc -> 'title', 'slug', d.doc -> 'slug', 'store', d.doc -> 'store', 'excerpt', d.doc -> 'excerpt',
                  'hero', d.doc #> '{hero,url}', 'language', d.doc -> 'language', 'published', d.doc -> 'published')
              WHEN 'newsletter' THEN jsonb_build_object('subject', d.doc -> 'subject', 'preheader', d.doc -> 'preheader', 'language', d.doc -> 'language',
                  'hubspot', d.doc -> 'hubspot',
                  -- cv16: each other language's own HubSpot draft (its words are not read)
                  'langs', COALESCE((SELECT jsonb_object_agg(l.key, jsonb_build_object('hubspot', l.value -> 'hubspot'))
                    FROM jsonb_each(CASE WHEN jsonb_typeof(d.doc -> 'langs') = 'object' THEN d.doc -> 'langs' ELSE '{}'::jsonb END) l
                    WHERE jsonb_typeof(l.value) = 'object'), '{}'::jsonb))
              WHEN 'social' THEN jsonb_build_object('text', LEFT(COALESCE(d.doc #>> '{networks,linkedin,text}', ''), 300),
                  'image', d.doc #> '{media,image,url}', 'published', d.doc -> 'published')
              WHEN 'video' THEN jsonb_build_object('scenes', jsonb_array_length(${arr("d.doc -> 'scenes'")}), 'length', d.doc -> 'length',
                  'format', d.doc -> 'format', 'language', d.doc -> 'language',
                  'secs', 2 * ((SELECT COALESCE(SUM(LEAST(4, GREATEST(1, CASE WHEN x ->> 'bars' ~ '^[0-9]{1,2}$' THEN (x ->> 'bars')::int ELSE 1 END))), 0)
                                 FROM jsonb_array_elements(${arr("d.doc -> 'scenes'")}) x)
                             + CASE WHEN jsonb_array_length(${arr("d.doc -> 'scenes'")}) = 0 THEN 0
                                    WHEN d.doc #>> '{endCard,bars}' = '3' THEN 3 ELSE 2 END),
                  'langs', CASE WHEN jsonb_typeof(d.doc -> 'langs') = 'object' THEN (SELECT jsonb_agg(k) FROM jsonb_object_keys(d.doc -> 'langs') k) END)
              ELSE '{}'::jsonb END AS doc,
            substring((CASE d.kind
              WHEN 'page' THEN COALESCE(d.doc -> 'fields', '{}'::jsonb)::text || ' ' || COALESCE(d.doc -> 'changes', '[]'::jsonb)::text
              WHEN 'banner' THEN COALESCE(d.doc -> 'content', '{}'::jsonb)::text
              WHEN 'blog' THEN COALESCE(d.doc -> 'hero', '{}'::jsonb)::text || ' ' || COALESCE(d.doc -> 'sections', '[]'::jsonb)::text
              WHEN 'newsletter' THEN COALESCE(d.doc -> 'blocks', '[]'::jsonb)::text
              WHEN 'social' THEN COALESCE(d.doc -> 'media', '{}'::jsonb)::text || ' ' || COALESCE(d.doc -> 'design', '{}'::jsonb)::text
              WHEN 'video' THEN COALESCE(d.doc -> 'scenes', '[]'::jsonb)::text
              ELSE '' END) from $2) AS first_pic,
            CASE WHEN d.kind = 'banner' THEN (
              SELECT COALESCE(jsonb_agg(jsonb_build_object('pieceId', d2.piece_id, 'projectId', pc2.project_id, 'title', pc2.title, 'magento', d2.doc -> 'magento')
                       ORDER BY d2.updated_at DESC), '[]'::jsonb)
                FROM apsomh_content_piece_docs d2 JOIN apsomh_content_pieces pc2 ON pc2.id = d2.piece_id
               WHERE d2.kind = 'page' AND pc2.project_id = pc.project_id
                 AND (EXISTS (SELECT 1 FROM jsonb_array_elements(${arr("d2.doc -> 'inserts'")}) i WHERE i ->> 'pieceId' = pc.id::text)
                   OR position(('"banner-' || pc.id || '"') IN COALESCE(d2.doc -> 'changes', '[]'::jsonb)::text) > 0
                   OR position(('"banner-' || pc.id || '"') IN COALESCE(d2.doc -> 'langs', '{}'::jsonb)::text) > 0)
            ) END AS on_pages
       FROM apsomh_content_piece_docs d
       JOIN apsomh_content_pieces pc ON pc.id = d.piece_id
       JOIN apsomh_content_projects p ON p.id = pc.project_id
      WHERE p.deleted_at IS NULL AND ${visible}
      ORDER BY d.updated_at DESC
      LIMIT 500`;
}
