// PAGE - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Behind the project's own access (the to-do's route).
//
// Actions
//   start     on the first open: the project's brief kept for the AI, and - when the brief carries APSOconvert's marker
//             ("[APSOconvert page prod:/de-CH/...]") - that page and its approved version's changes taken over.
//             Written here, not sent from the browser: a version can weigh 80 KB, the hub's firewall takes 8 KB a request
//   pages     the shop's pages APSOconvert keeps indexed, searched (store view, kind, words)
//   stores    the store views the index holds
//   outline   the page's outline read and kept in the document - what the AI tasks are shown
//   preview   the page as a still picture, as it is or with the changes over it (./shop.ts) - also a GET route for readers
//   paste     what to paste into Magento, and where. Nothing is written to Magento: its client is read-only, with
//             production keys shared with other jobs
//   ping      nothing - the studio waits on it so a big change goes in two steps (studio/doc.ts batches)
// AI tasks (in the brand's voice, the route adds it)
//   rewrite   the change list from the page's outline and a request - long words as placeholders, written in `texts`
//   ideas     three improvements for this page
//   texts     the words for the placeholders, in the page's language

import type { AiTask, KindDef, ServerAction, StudioCtx } from "../../contract";
import { s } from "../../contract";
import type { Op } from "../../doc";
import { saveOps } from "../../store";
import { projectHead } from "@/lib/content/workflow";
import { markerOf } from "@/lib/convert/handoff";
import { classify, isKind, nameFromRest } from "@/lib/convert/model";
import { listPages, pagesSummary } from "@/lib/convert/pages";
import { cleanPath, pageWork } from "@/lib/convert/studio";
import {
  SHELL_SELECTOR, emptyPage, fromAi, languageOfStore, pageDoc, pageText, placeholdersIn, placeholdersOf, shopUrl, textsFromAi,
  type AiChange, type PageDoc,
} from "./model";
import { outlineOf, pasteOf, previewOf } from "./shop";

/* ── what the AI is told ──────────────────────────────────────────────── */

const SHOP = `APSOparts (apsoparts.com) is the online shop of Angst+Pfister: technical parts for industry - seals and O-rings,
plastics, fluid handling, drive technology, anti-vibration, sensors. Buyers are companies: engineers, purchasers,
maintenance. Store views are language-COUNTRY (de-CH, fr-CH, it-CH, fr-FR, it-IT, nl-NL, pl-PL, ...). The shop's look:
petrol #274e64 (headings, main buttons), red #d80901 only for small accents, text #5e5e5e, font futura-pt, white cards
on a light grey ground (#f2f4f5), product photos on white, generous white space. Product pages list ARTICLES (sizes,
variants) in a table with quantity, availability, delivery date and price - the theme draws that table after loading.`;

const RULES = `Hard rules:
- Use only what the page, the brief and the person give. NEVER invent prices, stock, delivery times, certificates,
  approvals (FDA, KTW, ...), test results, figures, customer names or quotes. A fact that is missing is asked for
  ("needs: ..."), never made up.
- Never show a discount value (no "% off", no amount off).
- Never name a chemical manufacturer's brand (Chemours in particular). Chemical compatibility is always "for information
  only, no guarantee, no liability" - say so wherever it appears.
- Words a visitor reads are in the page's own language (its store view: de-CH = German, fr-CH = French, ...).
- Keep what search engines need: the H1's words, the links, the product data.
- Plain, concrete, human words; no slogans, no hype, no exclamation marks.`;

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
    return `A NEW PAGE for the store view ${d.store} (language: ${languageOfStore(d.store) ?? "-"}), shown inside a CMS page of the store:
its body replaces ${SHELL_SELECTOR}. Title: ${d.newPage.title || "-"}. Meta description: ${d.newPage.metaDescription || "-"}.
THE BODY AS IT IS NOW:
${d.newPage.body.slice(0, 30_000) || "(empty)"}`;
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
  return `THE CHANGES NOW (${d.changes.length}):\n${JSON.stringify(d.changes).slice(0, 40_000)}`;
}

/* ── rewrite ──────────────────────────────────────────────────────────── */

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

const REWRITE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "body", "changes", "texts"],
  properties: {
    summary: { type: "string", description: "What the list does now, for the person approving it, English, 1-2 sentences" },
    body: { type: "string", description: "Only for a NEW page: its whole HTML for the main area. Else empty." },
    changes: { type: "array", items: CHANGE_ITEM },
    texts: {
      type: "array", description: "The words for each placeholder you left, by its data-key",
      items: { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string" } } },
    },
  },
};

const REWRITE_SYSTEM = `You write the changes for one page of the shop: a list laid over the page in the browser after it
loads - the same list runs the page's A/B test, so what is approved is what visitors get. Kinds of change: css (a
stylesheet added), html (new inner HTML of an element), replace (an element replaced), insert (new HTML before, after,
prepended or appended to an element), text (new text of an element), hide (an element hidden), attr (an attribute set).

How to write it:
- Aim at selectors from the page's outline (ids first, then tag.class). Scope CSS to the page's own classes or yours;
  never restyle body, html or the whole header.
- Few, clean changes that do what is asked, nothing else. Answer with the WHOLE list: keep every change the person did
  not ask to change, as it is.
- Class names you add start with "apx-". Every new block reads well on a phone (390 px wide): give it a mobile rule.
- New HTML: no <script>, no on...= handlers, no javascript: links, no frames, no pictures from outside the shop.
- WORDS: a short label (a heading, a button, a column name) of at most six words is written in place, in the page's
  language. Anything longer - a sentence, a paragraph - goes in as a placeholder
  <span class="apx-text" data-key="t1">[Text from Content: what these words must do, in English]</span>
  (keys t1, t2, ... unique in the whole answer), and you write its words in "texts" under the same key.
- A NEW page: "body" is the page's whole HTML for the main area - one h1, then its sections in the shop's look - and
  "changes" holds only its CSS. For an existing page "body" is empty.

${SHOP}

${RULES}`;

const rewrite: AiTask = {
  label: "Change the page",
  schema: REWRITE_SCHEMA,
  system: REWRITE_SYSTEM,
  maxTokens: 16_000,
  user: (ctx, raw, input) => {
    const d = pageDoc(raw, ctx.piece.language);
    const ask = s(input.request, 3000) || "Make the page do what the brief asks.";
    return `${context(ctx, d)}

${pageBlock(d)}

${d.source === "new" ? "" : `${changesBlock(d)}\n\n`}THE PERSON ASKS: ${ask}`;
  },
  clean: (raw, docRaw) => {
    const d = pageDoc(docRaw);
    const r = (raw ?? {}) as { summary?: string; body?: string; changes?: AiChange[]; texts?: { key: string; text: string }[] };
    const { changes, problems } = fromAi(r.changes);
    const body = d.source === "new" ? s(r.body, 60_000) : "";
    const next: PageDoc = { ...d, changes, newPage: { ...d.newPage, body: body || d.newPage.body } };
    const holders = [...(body ? placeholdersIn(body, "the page's body") : []), ...placeholdersOf({ ...next, source: "pick" })];
    return { summary: s(r.summary, 600), body, changes, texts: textsFromAi(holders, r.texts), problems };
  },
};

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
  user: (ctx, raw) => {
    const d = pageDoc(raw, ctx.piece.language);
    return `${context(ctx, d)}\n\n${pageBlock(d)}\n\n${d.source === "new" ? "" : changesBlock(d)}`;
  },
  clean: (raw) => {
    const list = Array.isArray((raw as { ideas?: unknown })?.ideas) ? (raw as { ideas: Record<string, unknown>[] }).ideas : [];
    return { ideas: list.slice(0, 3).map((i) => ({ title: s(i.title, 120), why: s(i.why, 500), change: s(i.change, 600) })).filter((i) => i.title) };
  },
};

/* ── texts ────────────────────────────────────────────────────────────── */

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
    const d = pageDoc(raw, ctx.piece.language);
    const only = Array.isArray(input.ids) ? new Set(input.ids.map(String)) : null;
    const holders = placeholdersOf(d).filter((p) => !only || only.has(p.id));
    const lang = languageOfStore(d.source === "new" ? d.store : classify(d.path).store ?? d.store) ?? "the page's language";
    return `${context(ctx, d)}

${pageBlock(d)}

WRITE IN: ${lang}
THE PLACEHOLDERS (key · where · what the words must do):
${holders.map((p) => `${p.id} · ${p.where} · ${p.ask}`).join("\n") || "(none)"}
${s(input.request, 1000) ? `\nTHE PERSON ADDS: ${s(input.request, 1000)}` : ""}`;
  },
  clean: (raw, docRaw) => {
    const d = pageDoc(docRaw);
    return { texts: textsFromAi(placeholdersOf(d), (raw as { texts?: { key: string; text: string }[] })?.texts) };
  },
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
  const mark = markerOf(brief);
  const path = mark ? cleanPath(mark.path) : null;
  let imported: { env: string; path: string; version: { rev: number; status: string; summary: string } | null } | null = null;
  // a page from APSOconvert is taken over on the first open of an empty studio, or when asked again
  if (mark && path && (again || (!d.path && !d.changes.length))) {
    const work = await pageWork(mark.env, path).catch(() => null);
    const newest = (list: NonNullable<typeof work>["versions"]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    const v = work ? newest(work.versions.filter((x) => x.status === "approved")) ?? newest(work.versions) : null;
    const idea = v && work ? work.ideas.find((i) => i.id === v.ideaId) : null;
    const c = classify(path);
    ops.push(
      { op: "set", path: ["source"], value: "convert" },
      { op: "set", path: ["env"], value: mark.env },
      { op: "set", path: ["path"], value: path },
      { op: "set", path: ["store"], value: c.store ?? d.store },
      { op: "set", path: ["pageKind"], value: c.kind },
      { op: "set", path: ["origin"], value: v ? { versionId: v.id, rev: v.rev, status: v.status, summary: v.summary.slice(0, 600), idea: (idea?.title ?? "").slice(0, 200) } : null },
    );
    if (v) ops.push({ op: "set", path: ["changes"], value: v.changes });
    imported = { env: mark.env, path, version: v ? { rev: v.rev, status: v.status, summary: v.summary } : null };
  }
  await write(ctx, ops);
  return { imported, marker: !!mark };
};

let storesHeld: { at: number; list: { store: string; prod: number; acc: number }[] } | null = null;
const stores: ServerAction = async () => {
  if (storesHeld && Date.now() - storesHeld.at < 10 * 60_000) return { stores: storesHeld.list };
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
  return { stores: list };
};

const pathOf = (url: string) => { try { return new URL(url).pathname; } catch { return null; } };
const pages: ServerAction = async (_ctx, _raw, input) => {
  const store = typeof input.store === "string" && /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/.test(input.store) ? input.store : null;
  const page = Math.max(0, Math.min(500, Math.floor(Number(input.page) || 0)));
  const list = await listPages({ kind: isKind(input.kind) ? input.kind : null, store, where: "all", q: s(input.q, 120), page, perPage: 20 });
  return {
    total: list.total, page: list.page, perPage: list.perPage,
    rows: list.rows.filter((r) => r.kind !== "system").map((r) => ({
      store: r.store, rest: r.rest, kind: r.kind, product: r.product, name: r.kind === "home" ? "Home page" : nameFromRest(r.rest) || r.rest,
      prod: r.prod ? pathOf(r.prod.url) : null, acc: r.acc ? pathOf(r.acc.url) : null,
    })),
  };
};

const readOutline: ServerAction = async (ctx, raw) => {
  const d = pageDoc(raw, ctx.piece.language);
  if (d.source === "new") return { ok: true, outline: null };
  const r = await outlineOf(d);
  if (!r.ok) return r;
  const head = await projectHead(ctx.projectId);
  await write(ctx, [
    { op: "set", path: ["outline"], value: r.outline },
    { op: "set", path: ["briefText"], value: (head?.project.brief ?? "").slice(0, 7000) },
  ]);
  return { ok: true, title: r.outline.title, h1: r.outline.h1, lines: r.outline.lines.length };
};

const preview: ServerAction = async (_ctx, raw, input) => previewOf(raw, input.side === "before" ? "before" : "after", input.fresh === true);
const paste: ServerAction = async (_ctx, raw) => pasteOf(raw);

export const pageKind: KindDef = {
  kind: "page",
  channel: "seo",
  empty: (ctx) => emptyPage(ctx.piece.language),
  toText: pageText,
  tasks: { rewrite, ideas, texts },
  actions: { start, stores, pages, outline: readOutline, preview, paste, ping: async () => ({ ok: true }) },
};
