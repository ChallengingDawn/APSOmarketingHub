// PAGE - THE STUDIO'S DOCUMENT (08.11.2026). Pure, shared with the browser and the tests: relative imports only.
//
// SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should also contain A/B
// testing possibility, live preview of the pages, editing page, select a page to modify; always trigger on the to-do".
//
// A page to-do is one shop page and what changes on it:
//   source    "convert" - the page and its approved version came from APSOconvert (the project's brief carries its marker)
//             "pick"    - a page of the shop picked here, from the pages APSOconvert keeps indexed
//             "new"     - a new CMS page, shown inside an existing CMS page of the store (its body put into #maincontent)
//   changes   APSOconvert's change list (src/lib/convert/versions.ts) - the same declarative list the shop's test applies,
//             so what is approved here is what visitors get
//   texts     the words for the placeholders <span class="apx-text">[Text from Content: ...]</span> a version leaves
//             for Content to write - by a key that never runs long (a doc path key must stay short: studio/doc.ts)
//   abTest    the test's plan; it runs from a gateway, not from the hub (the hub has no public address)
//   publish   how it reaches Magento - a paste block today; a direct publish needs CMS keys for ACC first

import { classify, isEnv, isKind, type Env, type PageKind } from "../../../../convert/model";
import { describe, validateChanges, type Change } from "../../../../convert/versions";

export type PageSource = "convert" | "pick" | "new";
export const SOURCES: PageSource[] = ["convert", "pick", "new"];
export const SOURCE_LABEL: Record<PageSource, string> = {
  convert: "From AI testing & personalization", pick: "A page of the shop", new: "A new page",
};

export type AbGoal = "orders" | "add-to-cart" | "clicks";
export const AB_GOAL_LABEL: Record<AbGoal, string> = { orders: "Orders", "add-to-cart": "Add to cart", clicks: "Clicks on one element" };
export type AbAudience = "all" | "new" | "returning" | "customers";
export const AB_AUDIENCE_LABEL: Record<AbAudience, string> = {
  all: "Every visitor", new: "New visitors", returning: "Returning visitors", customers: "Signed-in customers",
};

export type TextSlot = { id: string; ask: string; text: string };

export type PageOutline = { env: Env; path: string; title: string; description: string; h1: string[]; lines: string[]; truncated: boolean };

export type PageDoc = {
  v: 1;
  source: PageSource;
  env: Env;
  /** the page's path on the shop ("/de-CH/dichtungstechnik.html"); for a new page, the CMS page it is shown inside */
  path: string;
  /** its store view ("de-CH"); a new page's store */
  store: string;
  pageKind: PageKind | null;
  /** the first open has looked for an APSOconvert page in the project's brief */
  started: boolean;
  /** the APSOconvert version the changes came from */
  origin: { versionId: string; rev: number; status: string; summary: string; idea: string } | null;
  newPage: { title: string; urlKey: string; metaTitle: string; metaDescription: string; body: string };
  changes: Change[];
  texts: TextSlot[];
  abTest: { enabled: boolean; split: number; goal: AbGoal; clickTarget: string; audience: AbAudience; notes: string; status: "draft" };
  publish: { mode: "paste" | "magento"; status: "draft" | "copied"; notes: string };
  notes: string;
  /** the page's outline as the server last read it - what the AI is shown (never edited by hand) */
  outline: PageOutline | null;
  /** the project's brief as written, kept for the AI (the studio's context carries only its fields) */
  briefText: string;
};

/** Where a new page's body goes inside the CMS page it is shown in. */
export const SHELL_SELECTOR = "#maincontent";
/** The part of a Magento page that is the CMS page's own content. */
export const MAIN_SELECTOR = "#maincontent .column.main";

const STORE_OF_LANGUAGE: Record<string, string> = { DE: "de-CH", FR: "fr-CH", IT: "it-CH", EN: "en-CH", NL: "nl-NL", PL: "pl-PL" };
const LANGUAGE_NAME: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English", nl: "Dutch", pl: "Polish", es: "Spanish" };

export const storeForLanguage = (lang: string | null | undefined) => STORE_OF_LANGUAGE[String(lang ?? "").toUpperCase()] ?? "de-CH";
/** The language a store view's visitors read: "de-CH" -> German. */
export const languageOfStore = (store: string | null | undefined) => LANGUAGE_NAME[String(store ?? "").slice(0, 2).toLowerCase()] ?? null;

export function emptyPage(language?: string | null): PageDoc {
  return {
    v: 1, source: "pick", env: "prod", path: "", store: storeForLanguage(language), pageKind: null, started: false, origin: null,
    newPage: { title: "", urlKey: "", metaTitle: "", metaDescription: "", body: "" },
    changes: [], texts: [],
    abTest: { enabled: false, split: 50, goal: "add-to-cart", clickTarget: "", audience: "all", notes: "", status: "draft" },
    publish: { mode: "paste", status: "draft", notes: "" },
    notes: "", outline: null, briefText: "",
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 20_000) => (typeof v === "string" ? v.slice(0, max) : "");

/** Any stored document as a page document: missing parts filled, unknown values put right (an older first shape too). */
export function pageDoc(raw: unknown, language?: string | null): PageDoc {
  const d = isObj(raw) ? raw : {};
  const e = emptyPage(language);
  const np = isObj(d.newPage) ? d.newPage : {};
  const ab = isObj(d.abTest) ? d.abTest : {};
  const pub = isObj(d.publish) ? d.publish : {};
  const o = isObj(d.origin) ? d.origin : null;
  const out = isObj(d.outline) ? d.outline : null;
  const split = Number(ab.split);
  return {
    v: 1,
    source: SOURCES.includes(d.source as PageSource) ? (d.source as PageSource) : e.source,
    env: isEnv(d.env) ? d.env : e.env,
    path: str(d.path, 400),
    store: str(d.store, 20) || e.store,
    pageKind: isKind(d.pageKind) ? d.pageKind : null,
    started: d.started === true,
    origin: o ? { versionId: str(o.versionId, 40), rev: Number(o.rev) || 1, status: str(o.status, 20), summary: str(o.summary, 600), idea: str(o.idea, 200) } : null,
    newPage: { title: str(np.title, 200), urlKey: str(np.urlKey, 200), metaTitle: str(np.metaTitle, 200), metaDescription: str(np.metaDescription, 400), body: str(np.body, 60_000) },
    // a change keeps whatever shape it has while a person edits it - the preview and the exports validate
    changes: Array.isArray(d.changes) ? (d.changes.filter(isObj) as unknown as Change[]) : [],
    texts: Array.isArray(d.texts) ? d.texts.filter(isObj).map((t) => ({ id: str(t.id, 40), ask: str(t.ask, 400), text: str(t.text, 8000) })).filter((t) => t.id) : [],
    abTest: {
      enabled: ab.enabled === true,
      split: Number.isFinite(split) ? Math.max(5, Math.min(95, Math.round(split))) : e.abTest.split,
      goal: (["orders", "add-to-cart", "clicks"] as AbGoal[]).includes(ab.goal as AbGoal) ? (ab.goal as AbGoal) : e.abTest.goal,
      clickTarget: str(ab.clickTarget, 300),
      audience: (["all", "new", "returning", "customers"] as AbAudience[]).includes(ab.audience as AbAudience) ? (ab.audience as AbAudience) : "all",
      notes: str(ab.notes, 2000),
      status: "draft",
    },
    publish: { mode: pub.mode === "magento" ? "magento" : "paste", status: pub.status === "copied" ? "copied" : "draft", notes: str(pub.notes, 2000) },
    notes: str(d.notes, 4000),
    outline: out && typeof out.path === "string" ? {
      env: isEnv(out.env) ? out.env : "prod", path: str(out.path, 400), title: str(out.title, 400), description: str(out.description, 600),
      h1: Array.isArray(out.h1) ? out.h1.map((x) => str(x, 300)).slice(0, 5) : [],
      lines: Array.isArray(out.lines) ? out.lines.map((x) => str(x, 400)).slice(0, 300) : [], truncated: out.truncated === true,
    } : null,
    briefText: str(d.briefText, 7000),
  };
}

/* ── the page ─────────────────────────────────────────────────────────── */

/** The page on the shop, as an address. */
export function shopUrl(env: Env, path: string): string {
  return `${env === "acc" ? "https://acc.apsoparts.com" : "https://www.apsoparts.com"}${path}`;
}

/** What the studio knows of an address typed or picked: its store view and kind - null when it is not a page path. */
export function pathInfo(path: string): { store: string | null; kind: PageKind } | null {
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//") || /[\s<>"'\\?#]/.test(p) || p.length > 400) return null;
  const c = classify(p);
  return c.kind === "system" ? null : { store: c.store, kind: c.kind };
}

/** A new page's address key, from its title: lower case, plain letters, dashes. */
export function urlKeyOf(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/* ── the texts Content writes ─────────────────────────────────────────── */

/** <span class="apx-text" [data-key="t1"]>[Text from Content: what it must say]</span> - the placeholder a version leaves. */
const PLACEHOLDER = /<span\b([^>]*\bclass\s*=\s*["'][^"']*\bapx-text\b[^"']*["'][^>]*)>\s*\[Text from Content:\s*([\s\S]*?)\]\s*<\/span\s*>/gi;

/** A short stable id from the placeholder's key and its ask (FNV-1a, base 36) - same words, same id. */
export function placeholderId(key: string | null, ask: string): string {
  const s = `${key ?? ""}|${ask.replace(/\s+/g, " ").trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `t${h.toString(36)}`;
}

export type Placeholder = { id: string; key: string | null; ask: string; where: string };

export function placeholdersIn(html: string, where: string): Placeholder[] {
  const out: Placeholder[] = [];
  for (const m of html.matchAll(PLACEHOLDER)) {
    const key = /\bdata-key\s*=\s*["']([^"']{1,40})["']/i.exec(m[1])?.[1] ?? null;
    const ask = m[2].replace(/\s+/g, " ").trim();
    if (ask) out.push({ id: placeholderId(key, ask), key, ask, where });
  }
  return out;
}

/** Every placeholder of the page, in the order it shows - once each. */
export function placeholdersOf(doc: PageDoc): Placeholder[] {
  const all: Placeholder[] = [];
  if (doc.source === "new") all.push(...placeholdersIn(doc.newPage.body, "the page's body"));
  doc.changes.forEach((c, i) => {
    const h = (c as { html?: unknown }).html;
    if (typeof h === "string") all.push(...placeholdersIn(h, `change ${i + 1}`));
  });
  const seen = new Set<string>();
  return all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The placeholders that have their words, with the words in their place (a line break kept); the others stay. */
export function fillTexts(html: string, texts: TextSlot[]): string {
  if (!texts.length) return html;
  const by = new Map(texts.filter((t) => t.text.trim()).map((t) => [t.id, t.text.trim()]));
  return html.replace(PLACEHOLDER, (all, attrs: string, ask: string) => {
    const key = /\bdata-key\s*=\s*["']([^"']{1,40})["']/i.exec(attrs)?.[1] ?? null;
    const text = by.get(placeholderId(key, ask.replace(/\s+/g, " ").trim()));
    return text === undefined ? all : esc(text).replace(/\r?\n/g, "<br>");
  });
}

/** The placeholders still waiting for their words. */
export const unwritten = (doc: PageDoc) => {
  const have = new Set(doc.texts.filter((t) => t.text.trim()).map((t) => t.id));
  return placeholdersOf(doc).filter((p) => !have.has(p.id));
};

/* ── the changes as the page gets them ────────────────────────────────── */

/** The new page's body as the one change that puts it in place. */
export const bodyChange = (doc: PageDoc): Change => ({ op: "html", selector: SHELL_SELECTOR, html: doc.newPage.body, note: "The new page" });

/**
 * The list the page gets: a new page's body first, then the changes, the written texts in their places - validated
 * (anything a version may not carry is left out, and said).
 */
export function finalChanges(doc: PageDoc): { changes: Change[]; problems: string[] } {
  const list: unknown[] = [];
  if (doc.source === "new" && doc.newPage.body.trim()) list.push(bodyChange(doc));
  list.push(...doc.changes);
  const filled = list.map((c) => {
    if (!isObj(c) || typeof c.html !== "string") return c;
    return { ...c, html: fillTexts(c.html, doc.texts) };
  });
  return validateChanges(filled);
}

/** A change as a line - its note, else what it does. */
export function changeLine(c: Change): string {
  try { return describe(c); } catch { return "A change"; }
}

/* ── the AI's answers ─────────────────────────────────────────────────── */

export type AiChange = { op: string; selector: string; where: string; html: string; css: string; text: string; name: string; value: string; all: boolean; note: string };

/** The AI's flat change (every field present, as its schema asks) as a change list item; then validated. */
export function fromAi(list: AiChange[] | null | undefined): { changes: Change[]; problems: string[] } {
  const raw = (list ?? []).map((c) => {
    const o: Record<string, unknown> = { op: c.op };
    if (c.note) o.note = c.note;
    if (c.all) o.all = true;
    if (c.op === "css") o.css = c.css;
    else {
      o.selector = c.selector;
      if (c.op === "html" || c.op === "replace" || c.op === "insert") o.html = c.html;
      if (c.op === "insert") o.where = c.where || "after";
      if (c.op === "text") o.text = c.text;
      if (c.op === "attr") { o.name = c.name; o.value = c.value; }
    }
    return o;
  });
  return validateChanges(raw);
}

/** The words the AI wrote for the placeholders it left, by their data-key, matched to the placeholders now there. */
export function textsFromAi(placeholders: Placeholder[], answers: { key: string; text: string }[] | null | undefined): TextSlot[] {
  const out: TextSlot[] = [];
  for (const a of answers ?? []) {
    const k = String(a?.key ?? "").trim();
    const text = String(a?.text ?? "").trim();
    if (!k || !text) continue;
    const p = placeholders.find((x) => x.key === k || x.id === k);
    if (p && !out.some((t) => t.id === p.id)) out.push({ id: p.id, ask: p.ask, text: text.slice(0, 8000) });
  }
  return out;
}

/** The texts after an answer: the new words over the old, the old kept for placeholders the answer did not write. */
export function mergeTexts(old: TextSlot[], fresh: TextSlot[]): TextSlot[] {
  const out = old.filter((t) => !fresh.some((f) => f.id === t.id));
  return [...out, ...fresh];
}

/* ── for the library and the exports ──────────────────────────────────── */

/** The version's text: what page, what changes, the words written. */
export function pageText(raw: unknown): string {
  const d = pageDoc(raw);
  const head = d.source === "new"
    ? `New page: ${d.newPage.title || "(no title)"}${d.newPage.urlKey ? ` (/${d.store}/${d.newPage.urlKey})` : ""}`
    : `${SOURCE_LABEL[d.source]}: ${d.path ? shopUrl(d.env, d.path) : "(no page yet)"}`;
  const lines = [head];
  if (d.origin?.summary) lines.push(d.origin.summary);
  if (d.changes.length) lines.push("", "Changes:", ...d.changes.map((c, i) => `${i + 1}. ${changeLine(c)}`));
  const texts = d.texts.filter((t) => t.text.trim());
  if (texts.length) lines.push("", "Texts:", ...texts.map((t) => `- ${t.ask}\n${t.text}`));
  if (d.abTest.enabled) lines.push("", `A/B test: ${d.abTest.split}% see the new version; goal ${AB_GOAL_LABEL[d.abTest.goal].toLowerCase()}; ${AB_AUDIENCE_LABEL[d.abTest.audience].toLowerCase()}.`);
  if (d.notes.trim()) lines.push("", d.notes.trim());
  return lines.join("\n");
}

/** The stylesheet of a change list, as one <style> block for a paste (empty when there is none). */
export function styleBlock(changes: Change[]): string {
  const css = changes.filter((c): c is Extract<Change, { op: "css" }> => c.op === "css").map((c) => c.css.trim()).filter(Boolean).join("\n\n");
  return css ? `<style>\n${css}\n</style>\n` : "";
}

export type PasteBlock = { key: string; label: string; steps: string[]; code: string; lang: "html" | "text" };

/** A new page for Magento: where each field goes, and its content as one HTML Code element. */
export function newPagePaste(doc: PageDoc): PasteBlock[] {
  const { changes } = finalChanges(doc);
  const body = changes.find((c) => c.op === "html" && c.selector === SHELL_SELECTOR) as Extract<Change, { op: "html" }> | undefined;
  const rest = changes.filter((c) => c !== body);
  const code = `${styleBlock(rest)}${body?.html ?? ""}`.trim();
  const np = doc.newPage;
  return [
    {
      key: "fields", label: "The page's fields", lang: "text",
      steps: ["Content > Pages > Add New Page.", "Copy each value into its field; Store View: " + doc.store + "."],
      code: [`Page Title: ${np.title}`, `URL Key: ${np.urlKey || urlKeyOf(np.title)}`, `Meta Title: ${np.metaTitle || np.title}`, `Meta Description: ${np.metaDescription}`].join("\n"),
    },
    {
      key: "content", label: "The page's content", lang: "html",
      steps: [
        "In Content, drag an HTML Code element (Elements) onto the stage.",
        "Paste this into it, then Save. Leave the page disabled until it is reviewed on the shop.",
      ],
      code,
    },
  ];
}
