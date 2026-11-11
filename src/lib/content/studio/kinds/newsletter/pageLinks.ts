// NEWSLETTER - A PAGE FROM THE PAGE BUILDER AS A LINK (11.11.2026). Pure: relative imports only - the studio, the server
// reader (./pageLinksRead.ts) and tests/studio-newsletter-pagelinks.test.ts.
//
// SARCLA 11.11.2026: "with these new pages (one Magento page per store view, same URL key), how do we generate the link
// for the correct page in the newsletter?" The newsletter is sent PER LANGUAGE, so each language's newsletter links the
// page in its language's own store view - the Page builder's own map (../page/model.ts HOME_STORE): en -> en-INT,
// de -> de-CH, fr -> fr-CH, it -> it-CH, nl -> nl-NL, pl -> pl-PL - at the shop's address
// https://www.apsoparts.com/<store view>/<url key>. Never an ACC address: a page only on ACC (or not written yet) still
// gives its production address, said plainly as not on the shop yet.
//
// Where a page is: the Page builder's last step keeps one record per environment and store view it wrote (doc.magento,
// newest first): created / updated / restored leave the page on, switched-off took it off again.

import {
  HOME_STORE, isLegacyBody, langName, langOfStore, mainView, pageDoc, pageTitleOf, urlKeyOf, versionOfStore, viewOf,
  type MagentoRecord, type PageDoc,
} from "../page/model";
import { ENV_LABEL } from "../page/env";
import { shopOrder, storeKey } from "../page/storeViews";
import { BLOCK_LABEL, type NewsletterDoc } from "./model";

/** The shop's address - the newsletter's readers open it. */
export const SHOP_BASE = "https://www.apsoparts.com";

/** The store view a newsletter in this language links to: its language's own ("FR" -> fr-CH, "EN" -> en-INT). */
export function newsletterStore(language: string | null | undefined): string {
  const l = String(language ?? "").slice(0, 2).toLowerCase();
  return HOME_STORE[l] ?? HOME_STORE.en;
}

/** A version's URL key, as the Page builder's last step writes it into Magento (../page/shop.ts magentoOf): the key set
 * in its search engine fields, else made from its title. "" when it has neither yet. */
export function urlKeyOfView(view: PageDoc): string {
  if (isLegacyBody(view)) return view.newPage.urlKey.trim() || urlKeyOf(view.newPage.title);
  return view.fields.seo.urlKey.trim() || urlKeyOf(view.fields.hero.title);
}

/** The page's address on the shop in a store view. */
export const pageAddress = (store: string, key: string) => `${SHOP_BASE}/${store}/${key.replace(/^\/+/, "")}`;

/** The newest write of the page into one environment's store view. */
export type Written = { env: "prod" | "acc"; store: string; identifier: string; action: MagentoRecord["action"]; at: string };

/** The newest write per environment and store view (the records are kept newest first). */
export function lastWrites(records: readonly MagentoRecord[]): Written[] {
  const seen = new Set<string>();
  const out: Written[] = [];
  for (const r of records) {
    const k = `${r.env}|${r.store}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ env: r.env, store: r.store, identifier: r.identifier, action: r.action, at: r.at });
  }
  return out;
}

const isOn = (w: Written) => w.action !== "switched-off";

/** Where the page is now, per environment: the store views whose newest write left it on, in the shop's order. */
export function publishedIn(last: readonly Written[]): { prod: string[]; acc: string[] } {
  const of = (env: Written["env"]) => last.filter((w) => w.env === env && isOn(w)).map((w) => w.store).sort((a, b) => shopOrder(a) - shopOrder(b));
  return { prod: of("prod"), acc: of("acc") };
}

/** "de-CH, fr-CH, it-CH and 4 more" - a list of store views kept short. */
export function storesLine(stores: readonly string[], max = 4): string {
  if (stores.length <= max) return stores.join(", ");
  return `${stores.slice(0, max - 1).join(", ")} and ${stores.length - (max - 1)} more`;
}

/** Where the page is, in a line: "Production: de-CH, fr-CH · ACC: de-CH, fr-CH, it-CH" - or that it is in neither. */
export function whereLine(last: readonly Written[]): string {
  const on = publishedIn(last);
  const parts = (["prod", "acc"] as const).filter((e) => on[e].length).map((e) => `${ENV_LABEL[e]}: ${storesLine(on[e])}`);
  return parts.length ? parts.join(" · ") : "Not published yet";
}

/** One page of the Page builder, as the newsletter's picker lists it. */
export type PageLinkRow = {
  pieceId: number; projectId: number;
  /** the project's title and the to-do's */
  project: string; todo: string; status: string; updatedAt: string;
  /** the page's title, in its own language */
  title: string;
  /** the page's own store view */
  main: string;
  /** per language store view (de-CH, fr-CH, en-INT ...): the version that goes there, its URL key and its title - absent
   * where the page has no version going there, or one with no title nor URL key yet */
  views: Record<string, { version: string; key: string; title: string }>;
  /** the newest write per environment and store view */
  last: Written[];
};

/** The store views a newsletter links to (one per language). */
const LINKED_STORES = [...new Set(Object.values(HOME_STORE))];

/** A page document as a row of the picker - null for what is not a new page with a URL key in any of the languages. */
export function pageLinkRow(doc: PageDoc, meta: { pieceId: number; projectId: number; project: string; todo: string; status: string; updatedAt: string }): PageLinkRow | null {
  if (doc.source !== "new") return null;
  const views: PageLinkRow["views"] = {};
  for (const store of LINKED_STORES) {
    const version = versionOfStore(doc, store);
    if (!version) continue;
    const view = viewOf(doc, version);
    const key = urlKeyOfView(view);
    if (!key) continue;
    views[store] = { version, key, title: (isLegacyBody(view) ? view.newPage.title : view.fields.hero.title).trim() };
  }
  if (!Object.keys(views).length) return null;
  return { ...meta, title: pageTitleOf(doc) || meta.todo, main: mainView(doc), views, last: lastWrites(doc.magento) };
}

/* ── the server's one read (./pageLinksRead.ts runs it; the tests run it on PGlite) ── */

/** A page's fields without what no link needs (its modules, looks and block order - the heaviest parts). */
const slimFields = (f: string) => `CASE WHEN jsonb_typeof(${f}) = 'object' THEN (${f}) - 'modules' - 'looks' - 'order' ELSE ${f} END`;

/**
 * ONE query, only what the rows need ($1 = the person's username): the page to-dos' documents of a new page (source
 * "new") in the projects this person may open - the Content rules (src/lib/content/sharing.ts): their own, the ones
 * shared with them (editor or commenter), every one for an admin; a deleted project never (an archived one still: its
 * page may well be on the shop). Of each document only its store views, its URL keys and titles, and what was written
 * into Magento - not its words, modules or pictures (a page's document is large). Nothing is written.
 */
export function pageLinksQuery(admin: boolean): string {
  const member = "EXISTS (SELECT 1 FROM apsomh_content_project_members x WHERE x.project_id = p.id AND x.username = $1)";
  // an admin sees every project - the parameter is still read, or Postgres refuses the one sent (as workflow.ts boardFor)
  const visible = admin ? "$1::text IS NOT NULL" : `(p.created_by = $1 OR ${member})`;
  return `SELECT d.piece_id, pc.project_id, p.title AS project, pc.title, pc.status, pc.language, d.updated_at,
            jsonb_build_object(
              'source', d.doc -> 'source', 'env', d.doc -> 'env', 'store', d.doc -> 'store', 'path', d.doc -> 'path', 'stores', d.doc -> 'stores',
              'fields', ${slimFields("d.doc -> 'fields'")},
              'newPage', CASE WHEN jsonb_typeof(d.doc -> 'newPage') = 'object' THEN jsonb_build_object(
                'title', d.doc #> '{newPage,title}', 'urlKey', d.doc #> '{newPage,urlKey}',
                -- an older new page kept its words as one block of HTML: only whether it has one
                'body', CASE WHEN COALESCE(d.doc #>> '{newPage,body}', '') ~ '[^[:space:]]' THEN 'x' ELSE '' END) END,
              'langs', COALESCE((
                SELECT jsonb_object_agg(e.key, CASE WHEN jsonb_typeof(e.value) = 'object' THEN jsonb_build_object(
                         'store', e.value -> 'store', 'stores', e.value -> 'stores', 'path', e.value -> 'path', 'fields', ${slimFields("e.value -> 'fields'")})
                       ELSE e.value END)
                  FROM jsonb_each(CASE WHEN jsonb_typeof(d.doc -> 'langs') = 'object' THEN d.doc -> 'langs' ELSE '{}'::jsonb END) e), '{}'::jsonb),
              'magento', d.doc -> 'magento'
            ) AS doc
       FROM apsomh_content_piece_docs d
       JOIN apsomh_content_pieces pc ON pc.id = d.piece_id
       JOIN apsomh_content_projects p ON p.id = pc.project_id
      WHERE d.kind = 'page' AND d.doc ->> 'source' = 'new' AND p.deleted_at IS NULL AND ${visible}
      ORDER BY d.updated_at DESC
      LIMIT 150`;
}

export type PageLinksDbRow = { piece_id: number; project_id: number; project: string | null; title: string | null; status: string | null; language: string | null; updated_at: Date | string; doc: unknown };

/** The query's rows as the picker's: each document read as a page document, the ones with no address left out. */
export function pageLinkRows(rows: readonly PageLinksDbRow[]): PageLinkRow[] {
  const out: PageLinkRow[] = [];
  for (const x of rows) {
    const row = pageLinkRow(pageDoc(x.doc, x.language), {
      pieceId: x.piece_id, projectId: x.project_id, project: x.project ?? "", todo: x.title ?? "", status: x.status ?? "", updatedAt: new Date(x.updated_at).toISOString(),
    });
    if (row) out.push(row);
  }
  return out;
}

export type Tone = "ok" | "warn" | "bad" | "none";
export type LinkState = "live" | "moved" | "off" | "acc" | "none";

/** Is the page on the shop at this address? From its newest writes - said in plain words. */
export function stateIn(last: readonly Written[], store: string, key: string): { state: LinkState; tone: Tone; line: string } {
  const prod = last.find((w) => w.env === "prod" && w.store === store);
  const acc = last.find((w) => w.env === "acc" && w.store === store);
  if (prod && isOn(prod) && (!prod.identifier || prod.identifier === key)) return { state: "live", tone: "ok", line: `On the shop in ${store}` };
  if (prod && isOn(prod)) return { state: "moved", tone: "warn", line: `The shop has it at /${store}/${prod.identifier} - publish it to production again for this address` };
  if (prod) return { state: "off", tone: "warn", line: "Switched off on the shop - publish it to production again" };
  if (acc && isOn(acc)) return { state: "acc", tone: "warn", line: "Only on ACC - not on the shop yet. Publish it to production first" };
  return { state: "none", tone: "warn", line: "Not on the shop yet - publish it to production first" };
}

/** The link a newsletter in this language gets for a page: its production address in the language's store view, and
 * whether it is there yet. `address` is null when the page has no version in that language. */
export type PageLink = { store: string; address: string | null; state: LinkState | "no-version"; tone: Tone; line: string };

export function linkFor(row: PageLinkRow, language: string | null | undefined): PageLink {
  const store = newsletterStore(language);
  const v = row.views[store];
  if (!v) return { store, address: null, state: "no-version", tone: "none", line: `No ${langName(store)} version yet - add ${store} in the Page builder first` };
  return { store, address: pageAddress(store, v.key), ...stateIn(row.last, store, v.key) };
}

/** The rows in the picker's order: the pages the newsletter can link first (on the shop before the others), newest first. */
export function pickerOrder(rows: readonly PageLinkRow[], language: string | null | undefined): PageLinkRow[] {
  const rank = (r: PageLinkRow) => { const l = linkFor(r, language); return l.state === "live" ? 0 : l.address ? 1 : 2; };
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
}

const ADDRESS = /^https?:\/\/(www\.|acc\.)?apsoparts\.com\/([a-z]{2}-[a-z]{2,3}(?:\/(?:eur|chf))?)\/([^?#]*)/i;

/**
 * What to say under a link field of the newsletter (null: nothing): an ACC address (readers cannot open it), a page of the
 * Page builder that is not on the shop yet at that address, an address in another language's store view than the
 * newsletter's (it was picked before the newsletter was translated).
 */
export function linkNote(url: string, language: string | null | undefined, rows: readonly PageLinkRow[] | null): { tone: Tone; line: string } | null {
  const u = url.trim();
  if (!u) return null;
  const m = ADDRESS.exec(u);
  if (/^https?:\/\/acc\.apsoparts\.com/i.test(u)) return { tone: "bad", line: "An ACC address - readers cannot open it. Use the shop's address (www.apsoparts.com)" };
  if (!m) return null;
  const store = storeKey(m[2]) ?? m[2];
  const key = m[3].replace(/\/+$/, "");
  const want = newsletterStore(language);
  const other = langOfStore(store) !== langOfStore(want);
  const row = (rows ?? []).find((r) => r.views[store]?.key === key);
  if (other) return { tone: "warn", line: `This address is in ${store} - the newsletter is in ${langName(want)} (${want})` };
  if (!row) return null;
  return stateIn(row.last, store, key);
}

/** Every link of the newsletter, named as its outline names the block ("Story 2", "Products · product 3"). */
export function linksOf(d: NewsletterDoc): { where: string; url: string }[] {
  const out: { where: string; url: string }[] = [];
  const seen: Record<string, number> = {};
  for (const b of d.blocks) {
    const n = (seen[b.kind] = (seen[b.kind] ?? 0) + 1);
    const name = `${BLOCK_LABEL[b.kind]}${d.blocks.filter((x) => x.kind === b.kind).length > 1 ? ` ${n}` : ""}`;
    if (b.kind === "hero" || b.kind === "cta") out.push({ where: name, url: b.button.url });
    else if (b.kind === "article") out.push({ where: name, url: b.link.url });
    else if (b.kind === "banner") out.push({ where: name, url: b.url });
    else if (b.kind === "products") b.items.forEach((x, i) => out.push({ where: `${name} · product ${i + 1}`, url: x.url }));
  }
  return out.filter((x) => x.url.trim());
}

/** What "Before it goes out" says of the links: an ACC address, another language's store view, a page of the Page
 * builder not on the shop yet (the last needs the pages read). */
export function linkIssues(d: NewsletterDoc, rows: readonly PageLinkRow[] | null): { tone: Tone; text: string }[] {
  const out: { tone: Tone; text: string }[] = [];
  for (const l of linksOf(d)) {
    const n = linkNote(l.url, d.language, rows);
    if (n && (n.tone === "warn" || n.tone === "bad")) out.push({ tone: n.tone, text: `${l.where}: ${n.line}` });
  }
  return out;
}
