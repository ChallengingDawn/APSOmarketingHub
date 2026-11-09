// PAGE - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Behind the project's own access (the to-do's route).
//
// Actions
//   start      on the first open: the project's brief kept for the AI, and - when the brief carries APSOconvert's marker
//              ("[APSOconvert page prod:/de-CH/...]") - that page and its approved version's changes taken over.
//              Written here, not sent from the browser: a version can weigh 80 KB, the hub's firewall takes 8 KB a request
//   pages      the shop's pages APSOconvert keeps indexed, searched (words, store view, kind) - 40 at a time
//   convert    the pages AI testing & personalization has a version for
//   stores     the store views the index holds
//   outline    one language's page outline read and kept in the document - what the AI tasks are shown
//   preview    one language's page as a still picture (./shop.ts) - also a GET route for readers
//   counterpart  the same page in another language (the page's hreflang links)
//   candidates the shop's category and product pages a new page may link to (the AI picks among them, never invents)
//   inserts    the banners placed in the page, drawn
//   relink     a translated new page's links moved to the same pages in its language (their hreflang links)
//   views      for each store view of the shop: is this page of the shop there (the page index)
//   paste      what to paste into Magento, and where - one store view (the hand-over, for what the hub does not write)
//   magento    the last step "To Magento" (SARCLA 09.11.2026: "The Magento publish should occur via the API ... update
//              ACC and/or PROD"): each store view's page as Magento gets it, the keys, the gate, what was written
//   magento_plan     what a write would do in each store view, read from ACC or production - nothing written
//   magento_publish  the store views written into ACC or production - once the to-do is approved, by someone with
//                    Edit on AI testing & personalization > Winners (the Ship grant), a backup of each page first
//   magento_restore  a store view's page brought back as it was before this to-do's last write there
//   ping       nothing - the studio waits on it so a big change goes in two steps (studio/doc.ts batches)
//   winner     a test's winner (the brief's marker names the test): the tested change list, its figures, published yet,
//              may this person publish (lib/convert/winner.ts)
//   publish    a test's winner out to the shop - once approved, by someone with Edit on APSOconvert's Ship (as Ship
//              itself was): the way is APSOconvert's (the Magento page, on for everyone, or the code for dotSource)
// AI tasks (in the brand's voice and with the brand brain's facts - the route puts them first)
//   rewrite    an existing page's change list from its outline and a request - the final words, never a placeholder;
//              with a selected element, that element only
//   fill_*     a new page's fields: everything, one part, or one field ("change this")
//   translate  the whole page into another language: a new page's words, or an existing page's changes - the
//              structure kept, the words translated
//   ideas      three improvements for this page
//   seo        a meta title and description for an existing page
//   texts      words for an older version's placeholders

import type { AiTask, KindDef, ServerAction, StudioCtx } from "../../contract";
import { s } from "../../contract";
import type { Op } from "../../doc";
import { saveOps } from "../../store";
import { projectBrief, projectHead } from "@/lib/content/workflow";
import { markerOf } from "@/lib/convert/handoff";
import { publishFromContent, winnerFor, type Winner } from "@/lib/convert/winner";
import { KEY_WAITING, cmsConnectionCheck, cmsKeys, cmsPageBackups, cmsPagePlans, cmsPageRestore, cmsPageWrite } from "@/lib/convert/cms";
import { seoFieldsOf } from "@/lib/convert/cmsPage";
import { connectionLine, type Check } from "./magentoCheck";
import { gateOf } from "@/lib/convert/cmsPage";
import { myAccess } from "@/lib/auth/appAccess";
import { ENVS, classify, isKind, type Env } from "@/lib/convert/model";
import { pagesSummary } from "@/lib/convert/pages";
import { cleanPath, pageWork } from "@/lib/convert/studio";
import { LIMIT, blockOrder, fieldLabel, fieldStrings, getField, withFieldStrings, type Fields, type Item } from "./fields";
import { FIELD_SCHEMA, FILL_SCHEMA, PART_LABEL, cleanFill, type Candidate, type Part } from "./fill";
import { fitField, fitFields, limitOf } from "./fit";
import {
  baseStore, changeId, changeLine, changeStrings, convertVersionsOf, emptyPage, opensMarkerPage, fillTexts, fromAi, hashOf, isLegacyBody, langName, langOfStore, languageOfStore, leftoversIn, mainLang, mainView, pageDoc,
  pageModesFor, pageSourceFix, pageText, shopList, placeholdersOf, shopUrl, sourceHash, textsFromAi, urlKeyOf, viewKey, viewOf, viewsOf, withChangeStrings,
  type AiChange, type MagentoRecord, type PageChange, type PageDoc,
} from "./model";
import { BLOCK_SCHEMA, BLOCK_SYSTEM, KIT_EXAMPLES, SHOP_TOKENS, blockAsk, blockChange, blockRules, cleanBlock, prefixIn, prefixOf, type BlockMode } from "./block";
import { blockOfPath, blocksOf, itemOfPath } from "./outline";
import { convertPages, counterpartOf, findPages, insertsOf, magentoOf, outlineOf, pasteOf, presenceOf, previewOf, relinkOf } from "./shop";
import { deeplConfigured, translate as deepl } from "@/lib/translator/deepl";
import { appBriefOf } from "./appBrief";
import { moduleFillTask } from "./modules/ai";
import { moduleActions } from "./modules/server";

/* ── what the AI is told ──────────────────────────────────────────────── */

const SHOP = `APSOparts (apsoparts.com) is the online shop of Angst+Pfister: technical parts for industry - seals and O-rings,
plastics, fluid handling, drive technology, anti-vibration, sensors. Buyers are companies: engineers, purchasers,
maintenance. Store views are language-COUNTRY (de-CH, de-DE, de-AT, de-INT, fr-CH, fr-FR, fr-INT, it-CH, it-IT, it-INT,
en-INT, nl-NL, nl-INT, pl-PL). The shop's look:
petrol #274e64 (headings, main buttons), red #d80901 only for small accents, text #5e5e5e, font futura-pt, white cards
on a light grey ground (#f2f4f5), product photos on white, generous white space. Product pages list ARTICLES (sizes,
variants) in a table with quantity, availability, delivery date and price - the theme draws that table after loading.`;

const RULES = `Hard rules:
- Write the FINAL words a visitor reads, ready to publish, in the page's language. NEVER a placeholder: no text in
  square brackets ("[Intro paragraph in German]", "[Product name]"), no "Lorem ipsum", no "TODO", no "XX", no note about
  what should go there. Every field you fill is finished copy.
- Facts about APSOparts, Angst+Pfister and their products come ONLY from the brand facts above, the page, the brief and
  the person's ask. NEVER invent prices, stock, delivery times, certificates, approvals (FDA, KTW, ...), test results,
  figures, customer names or quotes. When a fact is missing, write well about what IS known - leave the claim out,
  never leave a gap.
- Never show a discount value (no "% off", no amount off).
- Never name a chemical manufacturer's brand (Chemours in particular). Chemical compatibility is always "for information
  only, no guarantee, no liability" - say so wherever it appears.
- Keep what search engines need: the H1's words, the links, the product data.
- Plain, concrete, human words for engineers and buyers; no slogans, no hype ("revolutionary", "unleash", "seamless"),
  no exclamation marks, no emojis.`;

const langOf = (d: PageDoc) => languageOfStore(d.store) ?? "German";

function context(ctx: StudioCtx, d: PageDoc): string {
  const b = ctx.brief;
  return [
    `PROJECT: ${ctx.projectTitle}`,
    b.goal && `Goal: ${b.goal}`,
    b.audience && `Who for: ${b.audience}`,
    b.message && `Key message: ${b.message}`,
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : null,
    d.briefText && `THE BRIEF AS WRITTEN:\n${d.briefText}`,
    `THE TO-DO: ${ctx.piece.title}`,
  ].filter(Boolean).join("\n");
}

function pageBlock(d: PageDoc): string {
  if (d.source === "new") {
    return `A NEW PAGE for the store view ${d.store} (language: ${langOf(d)}).
THE PAGE'S BLOCKS, IN THEIR ORDER ON THE PAGE: ${blocksOf(d.fields).filter((b) => b.num).map((b) => `${b.num} ${b.name}${b.key.startsWith("sections.") ? ` (sections.${b.key.slice(9)})` : ""}`).join(" · ")}
THE PAGE'S FIELDS NOW (path: words):
${fieldStrings(d.fields).map((x) => `${x.id}: ${x.text}`).join("\n").slice(0, 20_000) || "(all empty)"}${isLegacyBody(d) ? `\n\nAN EARLIER DRAFT OF THIS PAGE (one block of HTML - take its good parts, never its placeholders):\n${d.newPage.body.slice(0, 16_000)}` : ""}`;
  }
  const o = d.outline && d.outline.path === d.path && d.outline.env === d.env ? d.outline : null;
  const c = classify(d.path);
  return `PAGE: ${shopUrl(d.env, d.path)}
Kind: ${c.kind}${c.product ? ` (product ${c.product})` : ""} · store view ${c.store ?? "-"} (language: ${languageOfStore(c.store) ?? "-"}) · ${d.env === "acc" ? "ACC" : "production"}
${o ? `Title: ${o.title}
Description: ${o.description}
H1: ${o.h1.join(" | ") || "-"}

MAIN COLUMN (indented lines "selector · text"; a line ending in "…" is shortened here only):
${o.lines.join("\n")}${o.truncated ? "\n(... cut here)" : ""}` : "(the page's outline could not be read - aim at the selectors already in the list)"}`;
}

function changesBlock(d: PageDoc): string {
  if (!d.changes.length) return "THE CHANGES NOW: none yet.";
  const filled = d.changes.map((c) => (typeof (c as { html?: unknown }).html === "string" ? { ...c, html: fillTexts((c as { html: string }).html, d.texts) } : c));
  return `THE CHANGES NOW (${d.changes.length}):\n${JSON.stringify(filled).slice(0, 40_000)}`;
}

const viewFor = (ctx: StudioCtx, raw: unknown, input: Record<string, unknown>) => viewOf(pageDoc(raw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);

/* ── rewrite: an existing page's changes ──────────────────────────────── */

const CHANGE_ITEM = {
  type: "object", additionalProperties: false,
  required: ["op", "selector", "where", "html", "css", "text", "name", "value", "all", "note"],
  properties: {
    op: { type: "string", enum: ["css", "html", "replace", "insert", "text", "hide", "attr"] },
    selector: { type: "string", description: "CSS selector of the element (empty for op css)" },
    where: { type: "string", enum: ["", "before", "after", "prepend", "append"], description: "only for op insert" },
    html: { type: "string", description: "for html (inner HTML), replace (the element), insert (the new block); else empty" },
    css: { type: "string", description: "only for op css: the stylesheet" },
    text: { type: "string", description: "only for op text" },
    name: { type: "string", description: "only for op attr" },
    value: { type: "string", description: "only for op attr" },
    all: { type: "boolean", description: "true = every element the selector finds, false = the first" },
    note: { type: "string", description: "What this change does, English, under 12 words" },
  },
};

const REWRITE_SYSTEM = `You write the changes for one page of the shop: a list laid over the page in the browser after it
loads - the same list runs the page's A/B test, so what is approved is what visitors get. Kinds of change: css (a
stylesheet added), html (new inner HTML of an element), replace (an element HIDDEN and your block put exactly in its
place), insert (a new block before, after, prepended or appended to an element), text (new text of an element), hide
(an element hidden), attr (an attribute set).

How to write it:
- Aim at selectors from the page's outline (ids first, then tag.class). Never restyle body, html or the whole header.
- Few, clean changes that do what is asked, nothing else. Answer with the WHOLE list: keep every change the person did
  not ask to change, exactly as it is.
- To change how a part of the page looks or what it holds, REPLACE that element with one finished block (op replace) -
  never a loose fragment inserted into a band whose colours you do not set (the night's failure: grey words added inside
  the dark petrol title band - unreadable). A new part of the page is an insert of one finished block.
- Every block you write (replace, insert) is built the kit's way - the rules below, with its own prefix class
  "apx-<short name>" (apx-hero2, apx-facts ...).
- Every word you put on the page is the final copy, written in the page's language - headings, paragraphs, buttons.
  The page's own facts are the ones to use.

${blockRules("apx-<name>")}

${SHOP}

${SHOP_TOKENS}

${KIT_EXAMPLES}

${RULES}`;

const rewrite: AiTask = {
  label: "Change the page",
  schema: {
    type: "object", additionalProperties: false, required: ["summary", "changes"],
    properties: {
      summary: { type: "string", description: "What the list does now, for the person approving it, English, 1-2 sentences" },
      changes: { type: "array", items: CHANGE_ITEM },
    },
  },
  system: REWRITE_SYSTEM,
  maxTokens: 16_000,
  user: (ctx, raw, input) => {
    const d = viewFor(ctx, raw, input);
    const ask = s(input.request, 3000) || "Make the page do what the brief asks.";
    const sel = s(input.selector, 300);
    const only = sel ? `\n\nTHE PERSON SELECTED ONE ELEMENT: ${sel}${s(input.text, 400) ? ` (it reads: "${s(input.text, 400)}")` : ""}${s(input.html, 3000) ? `\nITS HTML NOW: ${s(input.html, 3000)}` : ""}
Change THIS element only (a change aimed at it, or the change that made it); every other change stays as it is.` : "";
    return `${context(ctx, d)}

${pageBlock(d)}

${changesBlock(d)}

WRITE IN: ${langOf(d)}${only}

THE PERSON ASKS: ${ask}`;
  },
  clean: (raw) => {
    const r = (raw ?? {}) as { summary?: string; changes?: AiChange[] };
    const { changes: list, problems } = fromAi(r.changes);
    // a block with its own stylesheet: its rules kept inside it, its root's own colour and font (./block.ts)
    const changes = list.map((c) => {
      if ((c.op !== "replace" && c.op !== "insert") || !/<style\b/i.test(c.html)) return c;
      const prefix = prefixIn(c.html) ?? prefixOf(hashOf(c.html));
      return { ...c, html: cleanBlock(c.html, prefix).html };
    });
    const left = leftoversIn(changes.map((c) => JSON.stringify(c)).join(" "));
    return { summary: s(r.summary, 600), changes, problems, leftovers: left };
  },
};

/* ── block: one element of a page of the shop replaced, or a block added at a place (Content v6) ──────── */
//
// SARCLA 09.11.2026 (points 2, 9, 10). The AI designs ONE block the kit's way (./block.ts): for an element of the page
// the block that takes its place (the element hidden, kept), at a place of the page a new block, for a block the hub
// put there before that block written again. It is given the element's own HTML and how it looks on the page now (read
// from the preview by the studio), the shop's tokens and two finished blocks. `block_fix`: the same block once more,
// with what the check after applying saw wrong (text that cannot be read, a block that runs out of its place).

const lookIn = (input: Record<string, unknown>) => s(input.look, 600);
const groundOf = (look: string) => /ground (#[0-9a-f]{6})/i.exec(look)?.[1] ?? null;
const modeIn = (input: Record<string, unknown>): BlockMode => (input.mode === "insert" ? "insert" : input.mode === "rework" ? "rework" : "replace");
const idIn = (input: Record<string, unknown>) => { const v = s(input.id, 24); return /^c[a-z0-9]{4,22}$/.test(v) ? v : null; };

/** The change a block is written again for: by its id, else by its number. */
function baseChange(d: PageDoc, input: Record<string, unknown>): PageChange | null {
  const id = idIn(input);
  const byId = id ? d.changes.find((c) => c.id === id) : undefined;
  const n = Number(input.change);
  const c = byId ?? (Number.isInteger(n) && n >= 0 ? d.changes[n] : undefined);
  return c && (c.op === "replace" || c.op === "insert") ? c : null;
}

function blockTask(fix: boolean): AiTask {
  return {
    label: fix ? "Fix the block" : "Design a block",
    schema: BLOCK_SCHEMA,
    system: `${BLOCK_SYSTEM}\n\n${RULES}`,
    maxTokens: 12_000,
    user: (ctx, raw, input) => {
      const d = viewFor(ctx, raw, input);
      const base = fix || modeIn(input) === "rework" ? baseChange(d, input) : null;
      const mode: BlockMode = base ? "rework" : modeIn(input);
      const id = base?.id ?? idIn(input) ?? "c0";
      const others = d.changes.filter((c) => c !== base);
      return `${context(ctx, d)}

${pageBlock(d)}

${others.length ? `THE PAGE'S OTHER CHANGES (they stay as they are): ${others.map((c, i) => `${i + 1}. ${changeLine(c)}`).join(" · ").slice(0, 2000)}` : ""}

${blockAsk({
    mode, prefix: base ? prefixIn((base as { html: string }).html) ?? prefixOf(id) : prefixOf(id),
    selector: base ? (base as { selector: string }).selector : s(input.selector, 300), where: base?.op === "insert" ? base.where : s(input.where, 10),
    html: base ? (base as { html: string }).html : s(input.html, 4000), look: lookIn(input), near: s(input.near, 600),
    request: fix ? "Make it read well and fit its place - the words stay." : s(input.request, 2000) || "Make this part clearer and more useful for a buyer.",
    language: langOf(d), problems: fix ? s(input.problems, 1500) || "It could not be read well." : undefined,
  })}`;
    },
    clean: (raw, docRaw, ctx, input) => {
      const d = viewFor(ctx, docRaw, input);
      const base = fix || modeIn(input) === "rework" ? baseChange(d, input) : null;
      const mode: BlockMode = base ? "rework" : modeIn(input);
      const id = base?.id ?? idIn(input) ?? changeId();
      const prefix = base ? prefixIn((base as { html: string }).html) ?? prefixOf(id) : prefixOf(id);
      const r = blockChange(raw, {
        id, mode, prefix, base, ground: groundOf(lookIn(input)), hadH1: input.hadH1 === true || (!!base && /<h1\b/i.test((base as { html: string }).html)),
        selector: base ? (base as { selector: string }).selector : s(input.selector, 300), where: s(input.where, 10),
      });
      return { ...r, leftovers: r.change ? leftoversIn(JSON.stringify(r.change)) : [] };
    },
  };
}

/* ── fill: a new page's fields ────────────────────────────────────────── */

const FILL_SYSTEM = `You write a new page of the shop, field by field. The page is drawn from these fields in the shop's
look (hero with its title as the page's H1, intro, benefit cards, sections of text with a picture, links to the shop's
own category and product pages, questions and answers, a call to action, the search engine fields), so you write words
only - never HTML, never markdown.

- Write for engineers, maintenance and purchasers who want to find the right part and order it. Concrete, useful,
  specific to this page's subject; each part says something the others do not.
- Each field's "at most N characters" is a hard limit (spaces count): stay clearly under it - a field that runs over
  is cut. Short paragraphs; a list as lines starting "- " where a list helps.
- A link or a button points ONLY to an address from THE SHOP'S PAGES YOU MAY LINK; when none fits, leave its address empty.
- A picture idea is in English, for a photographer: a real industrial scene that fits the words, no text in the picture.

${SHOP}

${RULES}`;

function candidatesOf(input: Record<string, unknown>): Candidate[] {
  return (Array.isArray(input.candidates) ? input.candidates : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ url: s(c.url, 300), name: s(c.name, 120), kind: s(c.kind, 20) }))
    .filter((c) => c.url.startsWith("/"))
    .slice(0, 30);
}

function fillUser(part: Exclude<Part, "field">) {
  return (ctx: StudioCtx, raw: unknown, input: Record<string, unknown>) => {
    const d = viewFor(ctx, raw, input);
    const cands = candidatesOf(input);
    const sectionId = s(input.id, 20);
    const sec = part === "section" ? d.fields.sections.find((x) => x.id === sectionId) : null;
    // where a section sits among the blocks (Content v5: a block added anywhere with the +)
    const order = blockOrder(d.fields);
    const at = sec ? order.indexOf(`sections.${sec.id}`) : -1;
    const near = (k: string | undefined) => { const b = k ? blocksOf(d.fields).find((x) => x.key === k) : null; return b ? `${b.name}${b.line ? ` ("${b.line}")` : ""}` : null; };
    const where = at > 0 ? ` It is block ${at + 1} of the page, after ${near(order[at - 1]) ?? "the hero"}${order[at + 1] ? ` and before ${near(order[at + 1])}` : ""}.` : "";
    const what = part === "all" ? "Write the WHOLE page: every block it has (listed above), all of it final copy. A part whose block is not listed is not on the page: give it no items and empty words."
      : part === "section" ? `Write THIS section only (${sec?.title.trim() ? `now: "${sec.title}"` : "a new one"}) - it must say something the other sections do not.${where}`
        : `Write ${PART_LABEL[part]} only. The rest of the page stays as it is - fit in with it.`;
    return `${context(ctx, d)}

${pageBlock(d)}

THE SHOP'S PAGES YOU MAY LINK (address · name · kind):
${cands.map((c) => `${c.url} · ${c.name} · ${c.kind}`).join("\n") || "(none - leave every address empty)"}

WRITE IN: ${langOf(d)} (store view ${d.store})
${what}${s(input.request, 1500) ? `\n\nTHE PERSON ASKS: ${s(input.request, 1500)}` : ""}`;
  };
}

function fillTask(part: Exclude<Part, "field">): AiTask {
  return {
    label: `Write ${PART_LABEL[part]}`,
    schema: FILL_SCHEMA[part],
    system: FILL_SYSTEM,
    maxTokens: part === "all" ? 12_000 : 5_000,
    user: fillUser(part),
    clean: (raw, _doc, _ctx, input) => cleanFill(raw, candidatesOf(input)),
  };
}

const ROLE: Record<string, string> = {
  "hero.eyebrow": `a small line above the page's title, at most ${LIMIT.eyebrow} characters`,
  "hero.title": `the page's H1, at most ${LIMIT.heroTitle} characters`,
  "hero.sub": `one or two sentences under the title, at most ${LIMIT.heroSub} characters`,
  "hero.button.label": `a button's words, at most ${LIMIT.button} characters`,
  intro: `the intro paragraph, at most ${LIMIT.intro} characters`,
  "seo.title": `the meta title, at most ${LIMIT.seoTitle} characters`,
  "seo.description": `the meta description, at most ${LIMIT.seoDescription} characters`,
};

const fillField: AiTask = {
  label: "Write this field",
  schema: FIELD_SCHEMA,
  system: FILL_SYSTEM,
  maxTokens: 2500,
  user: (ctx, raw, input) => {
    const d = viewFor(ctx, raw, input);
    const path = s(input.path, 80);
    const now = getField(d.fields, path);
    return `${context(ctx, d)}

${pageBlock(d)}

WRITE IN: ${langOf(d)}
THE FIELD: ${path} - ${fieldLabel(d.fields, path)}${ROLE[path] ? ` (${ROLE[path]})` : limitOf(path) ? ` (at most ${limitOf(path)} characters - a hard limit, spaces count)` : ""}
IT READS NOW: ${typeof now === "string" && now.trim() ? now : "(empty)"}

Write this one field's new words only.${s(input.request, 1500) ? `\nTHE PERSON ASKS: ${s(input.request, 1500)}` : ""}`;
  },
  clean: (raw, _doc, _ctx, input) => {
    // within the field's limit, whatever came back (./fit.ts)
    const text = fitField(s(input.path, 80), s((raw as { text?: unknown })?.text, 6000));
    return { text, leftovers: leftoversIn(text) };
  },
};

/* ── translate: the whole page into another language ──────────────────── */

const TRANSLATE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["items", "urlKey"],
  properties: {
    items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } } },
    urlKey: { type: "string", description: "A new page only: its URL key in the target language (lower case, dashes); else empty" },
  },
};

const translate: AiTask = {
  label: "Translate the page",
  schema: TRANSLATE_SCHEMA,
  maxTokens: 16_000,
  system: `You translate one page of the shop into another language for the shop's store view in that language. You are
given its texts by id; answer every id with its translation.
- Translate the meaning for engineers and buyers in that country: natural, the shop's own terms (Dichtung = joint
  d'étanchéité = guarnizione = seal), the same length roughly. Not word for word.
- An HTML text keeps EVERY tag, attribute and class exactly as it is, in the same order: only the words between the
  tags change (and alt / title texts).
- Product names, brand names (APSOparts, Angst+Pfister, APSOvib, ...), article numbers, norms (DIN, ISO), units and
  material codes (NBR, EPDM, FKM) stay as they are.
- Nothing added, nothing left out, no note of your own.

${RULES}`,
  user: (ctx, raw, input) => {
    const doc = pageDoc(raw, ctx.piece.language);
    const to = s(input.to, 2).toLowerCase();
    const items = translateSource(doc);
    const store = baseStore(s(input.store, 20)) ?? baseStore(s(input.to, 20));
    return `TRANSLATE FROM ${langName(mainLang(doc))} INTO ${langName(to)} (store view ${store ?? "-"}).
${doc.source === "new" ? "A new page: also give its URL key in the new language." : "An existing page's changes: urlKey stays empty."}

THE TEXTS (JSON):
${JSON.stringify(items)}`;
  },
  clean: (raw, docRaw, ctx) => {
    const doc = pageDoc(docRaw, ctx.piece.language);
    const r = (raw ?? {}) as { items?: { id?: unknown; text?: unknown }[]; urlKey?: unknown };
    const items: Item[] = (Array.isArray(r.items) ? r.items : []).map((x) => ({ id: String(x?.id ?? ""), text: String(x?.text ?? "") })).filter((x) => x.id && x.text.trim());
    const from = sourceHash(doc);
    const source = translateSource(doc);
    const missing = source.filter((x) => !items.some((y) => y.id === x.id)).length;
    const leftovers = leftoversIn(items.map((x) => x.text).join(" "));
    if (doc.source === "new") {
      // a translation runs longer (German, French): every field brought back within its limit
      const fields: Fields = fitFields(withFieldStrings(doc.fields, items));
      const key = urlKeyOf(s(r.urlKey, 160)) || urlKeyOf(fields.hero.title);
      return { fields: { ...fields, seo: { ...fields.seo, urlKey: key } }, from, missing, leftovers, problems: [] as string[] };
    }
    const filled = doc.changes.map((c) => (typeof (c as { html?: unknown }).html === "string" ? { ...c, html: fillTexts((c as { html: string }).html, doc.texts) } : c));
    const out = withChangeStrings(filled, items);
    return { changes: out.changes, problems: out.problems, from, missing, leftovers };
  },
};

/** What a translation starts from: the main language's words (a new page) or its changes, with any written texts in. */
function translateSource(doc: PageDoc): { id: string; text: string }[] {
  if (doc.source === "new") return fieldStrings(doc.fields);
  const filled = doc.changes.map((c) => (typeof (c as { html?: unknown }).html === "string" ? { ...c, html: fillTexts((c as { html: string }).html, doc.texts) } : c));
  return changeStrings(filled).map(({ id, text }) => ({ id, text }));
}

/* ── ideas ────────────────────────────────────────────────────────────── */

const ideas: AiTask = {
  label: "Ideas for this page",
  maxTokens: 3000,
  schema: {
    type: "object", additionalProperties: false, required: ["ideas"],
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["title", "why", "change"],
          properties: {
            title: { type: "string", description: "The idea in under 10 words, English" },
            why: { type: "string", description: "Which part of the page or the brief points to it, English, 1-2 sentences" },
            change: { type: "string", description: "What changes on the page, concretely, English, 1-2 sentences" },
          },
        },
      },
    },
  },
  system: `You look at one page of the shop and its brief and propose exactly THREE improvements a version of the page can
make (layout, wording, order, emphasis, a piece of information the page or the brief already has). The one most likely to
help a buyer decide comes first. Never one that needs a fact nobody gave.

${SHOP}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = viewFor(ctx, raw, input);
    return `${context(ctx, d)}\n\n${pageBlock(d)}\n\n${d.source === "new" ? "" : changesBlock(d)}`;
  },
  clean: (raw) => {
    const list = Array.isArray((raw as { ideas?: unknown })?.ideas) ? (raw as { ideas: Record<string, unknown>[] }).ideas : [];
    return { ideas: list.slice(0, 3).map((i) => ({ title: s(i.title, 120), why: s(i.why, 500), change: s(i.change, 600) })).filter((i) => i.title) };
  },
};

/* ── seo: an existing page's meta title and description ───────────────── */

const seo: AiTask = {
  label: "Search engine fields",
  maxTokens: 1500,
  schema: FILL_SCHEMA.seo,
  system: `You write the search engine fields of one page of the shop: its meta title and meta description (what Google
shows) and a URL key, in the page's language, from the page's own words and the brief's keywords.

${SHOP}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = viewFor(ctx, raw, input);
    return `${context(ctx, d)}\n\n${pageBlock(d)}\n\nWRITE IN: ${langOf(d)}${s(input.request, 800) ? `\nTHE PERSON ASKS: ${s(input.request, 800)}` : ""}`;
  },
  clean: (raw) => cleanFill(raw, []),
};

/* ── texts: an older version's placeholders ───────────────────────────── */

const texts: AiTask = {
  label: "Write the texts",
  maxTokens: 6000,
  schema: {
    type: "object", additionalProperties: false, required: ["texts"],
    properties: {
      texts: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string" } } },
      },
    },
  },
  system: `You write the words for the placeholders a page's version left for Content. Each placeholder says what its words
must do. Write each one for the shop's visitors, in the page's language, as long as the placeholder asks - a line, a
sentence or a short paragraph. Plain text, no HTML; a line break where one helps. Use the page's own facts and the brief;
nothing else.

${SHOP}

${RULES}`,
  user: (ctx, raw, input) => {
    const d = viewFor(ctx, raw, input);
    const only = Array.isArray(input.ids) ? new Set(input.ids.map(String)) : null;
    const holders = placeholdersOf(d).filter((p) => !only || only.has(p.id));
    return `${context(ctx, d)}

${pageBlock(d)}

WRITE IN: ${langOf(d)}
THE PLACEHOLDERS (key · where · what the words must do):
${holders.map((p) => `${p.id} · ${p.where} · ${p.ask}`).join("\n") || "(none)"}
${s(input.request, 1000) ? `\nTHE PERSON ADDS: ${s(input.request, 1000)}` : ""}`;
  },
  clean: (raw, docRaw, ctx, input) => {
    const d = viewOf(pageDoc(docRaw, ctx.piece.language), typeof input.lang === "string" ? input.lang : null);
    return { texts: textsFromAi(placeholdersOf(d), (raw as { texts?: { key: string; text: string }[] })?.texts) };
  },
};

/* ── english: what a part of the page says, in English (Content v5) ───── */
//
// SARCLA 09.11.2026: "I should have Ask: translate to English, if I want to understand what is written". To READ it: the
// page does not change, nothing goes into its history. DeepL when the hub has it (the `english` action), else one short
// Claude call (this task).

type Said = { label: string; text: string };

/** The texts a selection holds, labelled: a field, a block, an element of a page of the shop - or the whole page. */
function saidOf(ctx: StudioCtx, raw: unknown, input: Record<string, unknown>): Said[] {
  const d = viewFor(ctx, raw, input);
  const text = s(input.text, 3000);
  if (text) return [{ label: s(input.label, 80) || "The element", text }];
  if (d.source === "new") {
    const path = s(input.path, 80);
    const block = s(input.block, 40);
    const all = fieldStrings(d.fields).filter((x) => !x.id.endsWith(".alt"));
    // one item of a block (a tile, a question): its words only; a block: all of its words
    const item = block && itemOfPath(block) === block ? block : null;
    const pick = path ? all.filter((x) => x.id === path || x.id.startsWith(`${path}.`))
      : item ? all.filter((x) => x.id.startsWith(`${item}.`))
        : block ? all.filter((x) => blockOfPath(x.id) === (blockOfPath(block) ?? block))
          : all;
    return pick.slice(0, 40).map((x) => ({ label: fieldLabel(d.fields, x.id), text: x.text.slice(0, 2000) }));
  }
  const o = d.outline && d.outline.path === d.path ? d.outline : null;
  if (!o) return [];
  return [
    ...(o.h1[0] ? [{ label: "Title (H1)", text: o.h1[0] }] : []),
    ...o.lines.map((l) => l.trim().split(" · ").slice(1).join(" · ").trim()).filter((t) => t.length > 2).slice(0, 60).map((t) => ({ label: "", text: t.replace(/…$/, "") })),
  ];
}
const capSaid = (list: Said[], max = 9000) => { let n = 0; return list.filter((x) => (n += x.text.length) <= max); };

const english: AiTask = {
  label: "What it says, in English",
  maxTokens: 4000,
  effort: "low",
  schema: { type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "text"], properties: { n: { type: "integer" }, text: { type: "string" } } } } } },
  system: "You translate a few texts of a web page into plain English, so a colleague who does not read the language understands what they say. Faithful and natural; product names, brands, norms and material codes stay as they are. Nothing added, nothing left out, no comment. Answer every text by its number.",
  user: (ctx, raw, input) => `THE TEXTS (number: text):\n${capSaid(saidOf(ctx, raw, input)).map((x, i) => `${i + 1}: ${x.text}`).join("\n")}`,
  clean: (raw, docRaw, ctx, input) => {
    const said = capSaid(saidOf(ctx, docRaw, input));
    const got = Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: { n?: unknown; text?: unknown }[] }).items : [];
    return { items: said.map((x, i) => ({ label: x.label, text: s(got.find((g) => Number(g.n) === i + 1)?.text, 4000) || x.text })), by: "ai" };
  },
};

/** The same through DeepL, when the hub has it - else { items: null } and the studio asks the AI task above. */
const englishAction: ServerAction = async (ctx, raw, input) => {
  const said = capSaid(saidOf(ctx, raw, input));
  if (!said.length) return { items: [], by: "none" };
  if (!deeplConfigured()) return { items: null };
  try {
    const out: Said[] = [];
    for (let i = 0; i < said.length; i += 4) {
      const part = await Promise.all(said.slice(i, i + 4).map(async (x) => ({ label: x.label, text: (await deepl(x.text, "EN-GB")).text })));
      out.push(...part);
    }
    return { items: out, by: "deepl" };
  } catch {
    return { items: null };
  }
};

/* ── where the project came from: written by itself only from an app's brief (Content v5) ──── */
//
// SARCLA 09.11.2026: "write the new page with AI: it depends - if the project was created via an SEO brief, writing the
// page should be by default; otherwise the user should prompt each page he wants". A project started from an idea of
// one of the apps carries that app as its source (lib/content/start.ts): SEO, AEO & LLM Optimizer, Search bar,
// Personality, AI testing & personalization. With a brief from one of them the studio writes the new page on its own.

// A project sent from AI testing & personalization (its brief carries the page's marker) is an app's brief too (./appBrief.ts).
const brief: ServerAction = async (ctx) => {
  const { source } = await projectBrief(ctx.projectId).catch(() => ({ source: null as string | null }));
  return appBriefOf({ source, goal: ctx.brief.goal, notes: ctx.projectNotes });
};

/* ── actions ──────────────────────────────────────────────────────────── */

async function write(ctx: StudioCtx, ops: Op[]) {
  const r = await saveOps(ctx.pieceId, ops, ctx.me.username);
  if (!r.ok) throw new Error(r.error);
}

const start: ServerAction = async (ctx, raw, input) => {
  const d = pageDoc(raw, ctx.piece.language);
  const again = input.again === true;
  if (d.started && !again) return { imported: null };
  const head = await projectHead(ctx.projectId);
  const brief = head?.project.brief ?? "";
  const ops: Op[] = [{ op: "set", path: ["started"], value: true }, { op: "set", path: ["briefText"], value: brief.slice(0, 7000) }];
  // a page starts the way its type makes it (model.ts pageModesFor): an SEO landing page as a new page, the Page builder by
  // picking the shop's page (SARCLA 09.11.2026)
  const fix = again ? null : pageSourceFix(ctx.piece.contentType, d);
  if (fix) ops.push({ op: "set", path: ["source"], value: fix });
  const mark = markerOf(brief);
  const path = mark ? cleanPath(mark.path) : null;
  let imported: { env: string; path: string; version: { rev: number; status: string; summary: string } | null } | null = null;
  // a page from APSOconvert is taken over on the first open of an empty studio, or when asked again - by a to-do that
  // changes a page of the shop; a landing page makes a NEW page, the marker's page being only context in its brief
  if (mark && path && opensMarkerPage(ctx.piece.contentType) && (again || (!d.path && !d.changes.length))) {
    // a test's winner: exactly the change list that was tested, and its figures
    const won = mark.testId ? await winnerFor(mark.testId).catch(() => null) : null;
    if (won) {
      const c = classify(path);
      ops.push(
        { op: "set", path: ["source"], value: "convert" },
        { op: "set", path: ["env"], value: mark.env },
        { op: "set", path: ["path"], value: path },
        { op: "set", path: ["store"], value: c.store ?? d.store },
        { op: "set", path: ["pageKind"], value: c.kind },
        { op: "set", path: ["origin"], value: originOfWinner(won) },
        { op: "set", path: ["changes"], value: won.changes },
      );
      await write(ctx, ops);
      return { imported: { env: mark.env, path, version: { rev: won.rev, status: "won", summary: won.summary } }, marker: true };
    }
    const work = await pageWork(mark.env, path).catch(() => null);
    const newest = (list: NonNullable<typeof work>["versions"]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    // the version the optimization was sent with (APSOconvert's "Send to project", marker v:<id>), else the newest approved
    const sent = mark.versionId && work ? work.versions.find((x) => x.id === mark.versionId) ?? null : null;
    const v = sent ?? (work ? newest(work.versions.filter((x) => x.status === "approved")) ?? newest(work.versions) : null);
    const idea = v && work ? work.ideas.find((i) => i.id === v.ideaId) : null;
    const c = classify(path);
    ops.push(
      { op: "set", path: ["source"], value: "convert" },
      { op: "set", path: ["env"], value: mark.env },
      { op: "set", path: ["path"], value: path },
      { op: "set", path: ["store"], value: c.store ?? d.store },
      { op: "set", path: ["pageKind"], value: c.kind },
      { op: "set", path: ["origin"], value: v ? { versionId: v.id, rev: v.rev, status: v.status, summary: v.summary.slice(0, 600), idea: (idea?.title ?? "").slice(0, 200), letter: v.letter || "A" } : null },
    );
    if (v) {
      // every version of the optimization comes along under its own letter (A, B ...), the one it was sent with open
      // (SARCLA 09.11.2026: "another version of the same page" - AI testing & personalization names them so)
      const mine = convertVersionsOf(work?.versions ?? [], v);
      ops.push({ op: "set", path: ["changes"], value: v.changes }, { op: "set", path: ["letter"], value: v.letter || "A" }, { op: "set", path: ["versions"], value: mine });
    }
    imported = { env: mark.env, path, version: v ? { rev: v.rev, status: v.status, summary: v.summary } : null };
  }
  await write(ctx, ops);
  return { imported, marker: !!mark };
};

/**
 * A page taken over from AI testing & personalization before its letter was kept (before 10.11.2026): the letter of the
 * version it came with, read from that app and kept - so the studio says "version B" as that app does. Its other
 * versions are listed (letter, revision, summary) for the studio to offer; nothing else of the page changes here.
 */
const convertLetter: ServerAction = async (ctx, raw) => {
  const d = pageDoc(raw, ctx.piece.language);
  if (!d.origin?.versionId || !d.path) return { letter: d.origin?.letter ?? "", others: [] };
  const work = await pageWork(d.env, d.path).catch(() => null);
  const v = work?.versions.find((x) => x.id === d.origin!.versionId) ?? null;
  if (!v) return { letter: d.origin.letter, others: [] };
  if (!d.origin.letter && ctx.canEdit) await write(ctx, [{ op: "set", path: ["origin", "letter"], value: v.letter || "A" }]);
  const others = (work?.versions ?? []).filter((x) => x.ideaId === v.ideaId && x.id !== v.id).map((x) => ({ letter: x.letter || "A", rev: x.rev, summary: x.summary.slice(0, 200) }));
  return { letter: v.letter || "A", others };
};

/** What the studio keeps of a winner: its version and the test's figures. */
function originOfWinner(w: Winner) {
  const r = w.result;
  return {
    versionId: w.versionId ?? "", rev: w.rev, status: "won", summary: w.summary.slice(0, 600), idea: w.name.slice(0, 200),
    test: {
      id: w.testId, rateA: r?.rateA ?? null, rateB: r?.rateB ?? null, uplift: r?.uplift ?? null, pB: r?.pB ?? null,
      visitors: r?.visitors ?? 0, days: r?.days ?? 0, decidedBy: w.decidedBy, decidedAt: w.decidedAt,
    },
  };
}

/** Publishing a winner is Ship's - the person's level on that page, as APSOconvert's Ship asked it. */
const SHIP_PAGE = "/website/ai-personalization/ship";
async function mayShip(): Promise<boolean> {
  const acc = await myAccess().catch(() => null);
  return !!acc && acc.levelAt(SHIP_PAGE) === "write";
}
async function testIdOf(ctx: StudioCtx): Promise<string | null> {
  const head = await projectHead(ctx.projectId);
  return markerOf(head?.project.brief ?? "")?.testId ?? null;
}

const winner: ServerAction = async (ctx, raw) => {
  const testId = await testIdOf(ctx);
  if (!testId) return { winner: null };
  const [w, may] = await Promise.all([winnerFor(testId), mayShip()]);
  const d = pageDoc(raw, ctx.piece.language);
  // figures as they are now (the test may have run on), kept in the document
  if (d.origin?.test && JSON.stringify(d.origin.test) !== JSON.stringify(originOfWinner(w).test)) {
    await write(ctx, [{ op: "set", path: ["origin", "test"], value: originOfWinner(w).test }]).catch(() => undefined);
  }
  return { winner: { testId: w.testId, tested: w.changes, result: w.result, shipped: w.shipped, name: w.name }, mayShip: may };
};

const publish: ServerAction = async (ctx, raw) => {
  const testId = await testIdOf(ctx);
  if (!testId) throw new Error("This page is not a test's winner - a page of the shop goes to Magento by the Magento step.");
  if (!ctx.canEdit) throw new Error("You can comment on this project, not publish from it.");
  if (ctx.piece.status !== "approved") throw new Error("It is published once approved - ask for review first.");
  if (!(await mayShip())) throw new Error("Publishing a winner needs Edit on Website > AI testing & personalization > Ship - an admin gives it under Users.");
  const d = pageDoc(raw, ctx.piece.language);
  if (d.published) throw new Error("It is published already.");
  const r = await publishFromContent({ testId, changes: d.changes, by: ctx.me.username, pieceId: String(ctx.pieceId) });
  const published = { way: r.way, id: r.id ?? "", edited: r.edited, at: new Date().toISOString(), by: ctx.me.username, package: r.package ?? null };
  await write(ctx, [{ op: "set", path: ["published"], value: published }]);
  return { published };
};

let storesHeld: { at: number; list: { store: string; prod: number; acc: number }[] } | null = null;
/** The store views the shop's page index holds, with their pages - kept ten minutes. */
async function storeList(): Promise<{ store: string; prod: number; acc: number }[]> {
  if (storesHeld && Date.now() - storesHeld.at < 10 * 60_000) return storesHeld.list;
  const sum = await pagesSummary();
  const by = new Map<string, { store: string; prod: number; acc: number }>();
  for (const c of sum.cells) {
    if (!c.store || c.kind === "system") continue;
    const x = by.get(c.store) ?? { store: c.store, prod: 0, acc: 0 };
    x.prod += c.prod; x.acc += c.acc;
    by.set(c.store, x);
  }
  const list = [...by.values()].sort((a, b) => a.store.localeCompare(b.store));
  storesHeld = { at: Date.now(), list };
  return list;
}
const stores: ServerAction = async () => ({ stores: await storeList() });
/** The shop's store views as names ("de-CH", ...) - none when the index cannot be read (the model's own list stands in). */
const shopStores = async () => (await storeList().catch(() => [])).map((x) => x.store);

const STORE_RE = /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/;
const pages: ServerAction = async (_ctx, _raw, input) => {
  const store = typeof input.store === "string" && STORE_RE.test(input.store) ? input.store : null;
  const page = Math.max(0, Math.min(500, Math.floor(Number(input.page) || 0)));
  return findPages({ q: s(input.q, 120), store, kind: isKind(input.kind) && input.kind !== "system" ? input.kind : null, page, perPage: 40 });
};

const convert: ServerAction = async () => ({ rows: await convertPages() });

/** The path in the document where one store view's part lives (a language names its version, as before). */
const at = (d: PageDoc, lang: string | null, key: string): (string | number)[] => {
  const k = viewKey(d, lang);
  return k === mainView(d) ? [key] : ["langs", k, key];
};

const readOutline: ServerAction = async (ctx, raw, input) => {
  const doc = pageDoc(raw, ctx.piece.language);
  const lang = typeof input.lang === "string" ? input.lang : null;
  const d = viewOf(doc, lang);
  if (d.source === "new") return { ok: true, outline: null };
  const r = await outlineOf(raw, lang);
  if (!r.ok) return r;
  const head = await projectHead(ctx.projectId);
  await write(ctx, [
    { op: "set", path: at(doc, lang, "outline"), value: r.outline },
    { op: "set", path: ["briefText"], value: (head?.project.brief ?? "").slice(0, 7000) },
  ]);
  return { ok: true, title: r.outline.title, h1: r.outline.h1, lines: r.outline.lines.length };
};

/** The store view asked for ("fr-CH"; an older caller: a language, "fr"). */
const langIn = (input: Record<string, unknown>) => (typeof input.lang === "string" && /^[a-z]{2}(-[A-Z]{2,3}(\/[a-z]{3})?)?$/.test(input.lang) ? input.lang : null);
const preview: ServerAction = async (_ctx, raw, input) =>
  previewOf(raw, input.side === "before" ? "before" : input.side === "shell" ? "shell" : "after", input.fresh === true, langIn(input));
const paste: ServerAction = async (_ctx, raw, input) => pasteOf(raw, langIn(input), await shopStores());
const counterpart: ServerAction = async (_ctx, raw, input) => {
  const key = langIn(input);
  const store = typeof input.store === "string" && STORE_RE.test(input.store) ? input.store : baseStore(key);
  return counterpartOf(raw, langOfStore(key ?? store ?? "fr"), store);
};

/** The category and product pages a new page may link to: the words of the brief and the page's title, in its store. */
const candidates: ServerAction = async (ctx, raw, input) => {
  const d = viewFor(ctx, raw, input);
  const words = [s(input.q, 120), ...ctx.brief.keywords, d.fields.hero.title, ctx.projectTitle].join(" ")
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9-]+/).filter((w) => w.length > 3).slice(0, 12);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const add = (rows: Awaited<ReturnType<typeof findPages>>["rows"]) => {
    for (const r of rows) if (!seen.has(r.path) && (r.kind === "category" || r.kind === "product" || r.kind === "cms")) { seen.add(r.path); out.push({ url: r.path, name: r.name, kind: r.kind }); }
  };
  for (const w of [...new Set(words)]) {
    if (out.length >= 24) break;
    add((await findPages({ q: w.slice(0, 8), store: d.store, kind: null, page: 0, perPage: 8 })).rows);
  }
  if (out.length < 8) add((await findPages({ q: "", store: d.store, kind: "category", page: 0, perPage: 16 })).rows);
  return { candidates: out.slice(0, 24) };
};

const inserts: ServerAction = async (ctx, raw, input) => ({ inserts: await insertsOf(viewFor(ctx, raw, input)) });
const relink: ServerAction = async (_ctx, raw, input) => relinkOf(raw, langIn(input) ?? "fr");
/** For each store view of the shop: is this page of the shop there (the page index; its own address there)? */
const views: ServerAction = async (ctx, raw) => ({ presence: await presenceOf(pageDoc(raw, ctx.piece.language), shopList(await shopStores())) });

/* ── the last step: into Magento, by store view ───────────────────────── */

// SARCLA 09.11.2026: "The Magento publish should occur via the API ... also be able to update ACC and/or PROD". The gate
// is the one a test's winner has (publish, above): the to-do approved by its reviewer, and the person's Edit on
// Website > AI testing & personalization > Winners - the hub's one grant for changing the shop. Each page is backed up
// before it is written (src/lib/convert/cms.ts); "bring it back" writes the backup back.

const envIn = (input: Record<string, unknown>): Env => (input.env === "prod" ? "prod" : "acc");
/** The store views asked for - only the page's own versions. */
function viewsIn(doc: PageDoc, input: Record<string, unknown>): string[] {
  const have = viewsOf(doc);
  const asked = Array.isArray(input.views) ? input.views.map((v) => baseStore(String(v))).filter((v): v is string => !!v) : have;
  return have.filter((v) => asked.includes(v));
}

const magento: ServerAction = async (ctx, raw) => {
  const doc = pageDoc(raw, ctx.piece.language);
  const keys = cmsKeys();
  const [views, grant, backups] = await Promise.all([
    Promise.all(viewsOf(doc).map((v) => magentoOf(raw, v))),
    mayShip(),
    cmsPageBackups(String(ctx.pieceId)).catch(() => []),
  ]);
  const gate = (env: Env, restore = false) => gateOf({ canEdit: ctx.canEdit, status: ctx.piece.status, grant, key: keys[env], env, restore });
  return {
    views: views.map(({ want: _want, ...v }) => v),
    envs: (["acc", "prod"] as Env[]).map((env) => ({
      env, label: ENVS[env].label, base: ENVS[env].base, key: keys[env], waiting: keys[env] ? null : KEY_WAITING[env], why: gate(env), restoreWhy: gate(env, true),
      // the connection in plain words (Content v6, SARCLA 09.11.2026: "the Magento connection is not working yet"), and
      // the last check's answer while it is fresh
      from: keys.from[env], connection: connectionLine(env, keys.from[env]).line, check: checkHeld(env, keys.from[env]),
    })),
    // what keeps this person from writing, whatever the target (the key is said per target)
    gate: { canEdit: ctx.canEdit, approved: ctx.piece.status === "approved" || ctx.piece.status === "live", grant, why: gateOf({ canEdit: ctx.canEdit, status: ctx.piece.status, grant, key: true, env: "acc" }) },
    backups,
  };
};

/* ── the connection checked (Content v6): ONE read, never a write ──────── */

const CHECKS = new Map<Env, { check: Check; from: string }>();
/** The last check of an environment while it is fresh (ten minutes) and made with the key it has now. */
function checkHeld(env: Env, from: string): Check | null {
  const h = CHECKS.get(env);
  return h && h.from === from && Date.now() - Date.parse(h.check.at) < 10 * 60_000 ? h.check : null;
}
/** "Check the connection": one GET of Magento's CMS pages with the environment's key (src/lib/convert/cms.ts) - at most
 * one a minute per environment, whoever asks; anyone in the project may ask (it reads nothing of the shop's pages). */
const magentoCheck: ServerAction = async (_ctx, _raw, input) => {
  const env = envIn(input);
  const from = cmsKeys().from[env];
  const held = CHECKS.get(env);
  if (held && held.from === from && Date.now() - Date.parse(held.check.at) < 60_000) return { check: held.check };
  const check = await cmsConnectionCheck(env);
  if (check.state !== "no-key") CHECKS.set(env, { check, from });
  return { check };
};

const magentoPlan: ServerAction = async (ctx, raw, input) => {
  const env = envIn(input);
  if (!cmsKeys()[env]) return { env, plans: [], waiting: KEY_WAITING[env] };
  const doc = pageDoc(raw, ctx.piece.language);
  const items: { view: string; want: NonNullable<Awaited<ReturnType<typeof magentoOf>>["want"]> }[] = [];
  for (const v of viewsIn(doc, input)) {
    const m = await magentoOf(raw, v);
    if (m.cms && m.want && !m.why) items.push({ view: v, want: m.want });
  }
  return { env, plans: await cmsPagePlans(String(ctx.pieceId), env, items), waiting: null };
};

const magentoPublish: ServerAction = async (ctx, raw, input) => {
  const env = envIn(input);
  const no = gateOf({ canEdit: ctx.canEdit, status: ctx.piece.status, grant: await mayShip(), key: cmsKeys()[env], env });
  if (no) throw new Error(no);
  const doc = pageDoc(raw, ctx.piece.language);
  const views = viewsIn(doc, input);
  if (!views.length) throw new Error("Pick the store views to write.");
  const results: { view: string; ok: boolean; action?: string; pageId?: string; error?: string }[] = [];
  const records: MagentoRecord[] = [];
  const moved: Op[] = [];
  for (const v of views) {
    const m = await magentoOf(raw, v);
    if (!m.cms || !m.want || m.why || m.blocked) { results.push({ view: v, ok: false, error: m.why ?? m.blocked ?? "Not a CMS page." }); continue; }
    try {
      const w = await cmsPageWrite(String(ctx.pieceId), env, { view: v, want: m.want }, ctx.me.username);
      results.push({ view: v, ok: true, action: w.action, pageId: w.pageId });
      // a page of the shop given a new URL key: it is at its new address from now on (the studio follows it there)
      const newKey = m.want.kind === "changes" ? seoFieldsOf(m.want.seo, m.want.identifier).identifier : undefined;
      const identifier = newKey ?? m.want.identifier;
      records.push({ env, store: v, pageId: w.pageId, identifier, action: w.action, at: new Date().toISOString(), by: ctx.me.username, backupId: w.backupId, url: `${ENVS[env].base}/${v}/${identifier}` });
      if (newKey && env === doc.env) moved.push({ op: "set", path: at(doc, v, "path"), value: `/${v}/${newKey}` }, { op: "set", path: [...at(doc, v, "fields"), "seo", "urlKey"], value: "" });
    } catch (e) {
      results.push({ view: v, ok: false, error: (e as Error).message });
    }
  }
  if (records.length) await write(ctx, [{ op: "set", path: ["magento"], value: [...records, ...doc.magento].slice(0, 40) }, ...moved]);
  return { env, results, records };
};

const magentoRestore: ServerAction = async (ctx, raw, input) => {
  const env = envIn(input);
  const no = gateOf({ canEdit: ctx.canEdit, status: ctx.piece.status, grant: await mayShip(), key: cmsKeys()[env], env, restore: true });
  if (no) throw new Error(no);
  const view = baseStore(String(input.view ?? ""));
  if (!view) throw new Error("Which store view?");
  const doc = pageDoc(raw, ctx.piece.language);
  const r = await cmsPageRestore(String(ctx.pieceId), env, view, ctx.me.username);
  const record: MagentoRecord = { env, store: view, pageId: r.pageId, identifier: r.identifier, action: r.action, at: new Date().toISOString(), by: ctx.me.username, backupId: r.backupId, url: `${ENVS[env].base}/${view}/${r.identifier}` };
  await write(ctx, [{ op: "set", path: ["magento"], value: [record, ...doc.magento].slice(0, 40) }]);
  return { record };
};

export const pageKind: KindDef = {
  kind: "page",
  channel: "seo",
  // made the way its type makes a page from the first open (an SEO landing page never shows the shop's page picker)
  empty: (ctx) => ({ ...emptyPage(ctx.piece.language), source: pageModesFor(ctx.piece.contentType)[0] }),
  toText: pageText,
  tasks: {
    rewrite, ideas, texts, translate, seo, english, block: blockTask(false), block_fix: blockTask(true),
    fill_all: fillTask("all"), fill_hero: fillTask("hero"), fill_intro: fillTask("intro"), fill_benefits: fillTask("benefits"),
    fill_sections: fillTask("sections"), fill_section: fillTask("section"), fill_links: fillTask("links"), fill_faq: fillTask("faq"),
    fill_cta: fillTask("cta"), fill_seo: fillTask("seo"), fill_field: fillField,
    // the module gallery's "Fill with AI" (Content v6): the page as the AI sees it, then the candidates - ./modules/ai.ts
    module_fill: moduleFillTask((ctx, raw, input) => { const d = viewFor(ctx, raw, input); return `${context(ctx, d)}

${pageBlock(d).slice(0, 6000)}`; }),
  },
  actions: {
    start, winner, publish, stores, views, pages, convert, outline: readOutline, preview, paste, counterpart, candidates, inserts, relink, ping: async () => ({ ok: true }),
    english: englishAction, brief,
    magento, magento_plan: magentoPlan, magento_publish: magentoPublish, magento_restore: magentoRestore, magento_check: magentoCheck,
    convert_letter: convertLetter,
    // the module gallery (Content v6): the shop's tree, categories, numbers, most viewed / bought - ./modules/server.ts
    ...moduleActions,
  },
};
