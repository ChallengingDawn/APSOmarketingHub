// BANNER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Two AI tasks, in the brand's voice (the route puts
// brain.brandSystemPrompt for the "ad" channel before task.system):
//   copy       the words for every place the banner is used in, each within its room, in the banner's language
//   variants   three other headlines for the roomiest place
// and three actions for "Put it in a page" (SARCLA 08.11.2026: "we should be able to push it inside a page visually"):
//   place      this banner into a page to-do's document (an insert - the page studio owns the page and renders it)
//   unplace    one of this banner's inserts out of a page again
// The page list and the page with the banner in it are read through GET /api/content/studio/banner/[pieceId]/in-page,
// so a reviewer who only comments sees them too. Nothing is written outside the hub: the paste block and the PNGs are made in the browser, nothing goes to Magento.
// Content v7 (10.11.2026, SARCLA point 11: "allow to push the banner directly on a page after editing") - the last step
// "Put it on a page", on any page of the shop:
//   shop_pages   the shop's pages from the page index (as the Page builder's picker) - read only
//   page_places  where on a page it can stand: the slider, the top, after each block (./pagePlaces.ts) - read only
//   to_page      that page's Page builder to-do in this project, made when there is none, with the banner on it as the
//                module library's campaign banner (./topage.ts) - the page studio shows it; nothing goes to Magento

import type { KindDef, StudioCtx } from "../../contract";
import { LANGUAGE_BY_CODE } from "@/lib/content/languages";
import { PAGE_BUILDER } from "@/lib/content/contentTypes";
import { defaultReviewerOf } from "@/lib/content/people";
import { accessFor, shareCandidates } from "@/lib/content/sharing";
import { syncPieceTasks } from "@/lib/content/todos";
import { addEvent, addPiece, getPiece, listPieces } from "@/lib/content/workflow";
import { classify, isKind } from "@/lib/convert/model";
import { studioKindOf } from "../../kinds";
import { docOrNew, readDoc, saveOps } from "../../store";
import type { Op } from "../../doc";
import { emptyPage, pageDoc, shopUrl, type PageChange } from "../page/model";
import { findPages, readShopPage } from "../page/shop";
import { placesIn } from "./pagePlaces";
import { bannerChange, bannerOn, changeIdFor, refreshedChange, withBanner, type PageWhere } from "./topage";
import { guardCopy, guardVariants, knownText } from "./guard";
import { bannerPictureWords } from "./media";
import { getAsset } from "@/lib/content/assets";
import { contentAddress, contentFileOf, contentMediaState } from "../page/contentMedia";
import { storePictures } from "../page/pictureStore";
import type { MediaFile } from "../page/media";
import { COPY_SCHEMA, VARIANTS_SCHEMA, cleanCopy, cleanVariants, sizesBrief } from "./ai";
import { PAGE_PLACES, PRESET, bannerText, emptyBanner, isPreset, normalizeBanner, roomiest, type BannerDoc } from "./model";
import { insertsOf, isWhere, placeOps, unplaceOp } from "./place";

const RULES = [
  "# THIS TASK: WORDS FOR A BANNER OF THE APSOPARTS SHOP",
  "- Answer only in the JSON schema. The HEADLINE/BODY/CTA line format of the ad rules above does not apply here.",
  "- A banner is read in two seconds: a short eyebrow (a topic, not a sentence), one headline, one line of substance, one action.",
  "- The same banner is used in several places at once (the shop, an e-mail, social media, ads). Keep every text within its place's room (characters, spaces included). Shorter is better.",
  "- Changing words (only where a place allows them): the headline is the fixed start and each word completes it, e.g. headline \"Want to know more about\" + words [\"sealing technology?\", \"fluid handling?\"]. 3 to 6 words, each grammatical with the start, of similar length. Give none when the banner is better without them.",
  "- Never show a discount value - no percentage, no \"up to\", no amount off. Never name Chemours.",
  "- Nothing invented: no figures, prices, delivery promises, customer names or claims that are not in the brief or the banner's own words. What the shop really offers (standard components, the six technologies, DirectCUT, Quickorder) may be named.",
  "- No exclamation marks, no clichés (\"Discover\", \"Unlock\", \"Revolutionary\"), no emoji.",
].join("\n");

const langOf = (code: string) => LANGUAGE_BY_CODE[code.toUpperCase()]?.instruction ?? code;

function context(ctx: StudioCtx, d: BannerDoc, withWords = true): string {
  const b = ctx.brief;
  const c = d.content;
  return [
    `Project: ${ctx.projectTitle || "(no title)"}`,
    `This banner: ${ctx.piece.title}`,
    b.goal ? `Goal: ${b.goal}` : "", b.audience ? `Audience: ${b.audience}` : "", b.message ? `Key message: ${b.message}` : "",
    b.keywords.length ? `Keywords: ${b.keywords.join(", ")}` : "",
    `Language: write in ${langOf(d.language)}.`,
    "",
    "The places this banner is used in, and their room:",
    sizesBrief(d),
    "",
    // cv16 "Write it all again > From the topic": its words left out of the question
    ...(withWords ? [
      "Its words now:",
      `- eyebrow: ${c.eyebrow || "(empty)"}`,
      `- headline: ${c.headline || "(empty)"}`,
      `- changing words: ${c.rotatingWords.length ? c.rotatingWords.join(" / ") : "(none)"}`,
      `- line: ${c.line || "(empty)"}`,
      `- button: ${c.button.label || "(empty)"}${c.button.url ? ` (goes to ${c.button.url})` : ""}`,
    ] : [`Its button goes to: ${c.button.url || "(nowhere yet)"}`]),
    d.content.image.label ? `- the photo shows: ${d.content.image.label}` : d.content.image.fit === "product" && d.content.image.alt ? `- the picture is the shop's product: ${d.content.image.alt}` : "",
    d.notes.trim() ? `\nNotes on this banner: ${d.notes.trim().slice(0, 1500)}` : "",
  ].filter((x) => x !== "").join("\n");
}

const ask = (input: Record<string, unknown>) => (typeof input.ask === "string" && input.ask.trim() ? `\n\nWhat the person asks: ${input.ask.trim().slice(0, 1200)}` : "");

/* ── cv16 (11.11.2026, SARCLA: "compare the evolution of this page to the other content types and improve them") ── */

/** "Write it all again" as the Page builder's (its WriteAgain): from the topic (the banner's words left out of the
 * question), directly (better, nothing asked), or as asked (the ask itself). */
type WriteMode = "topic" | "better" | "ask";
const modeOf = (input: Record<string, unknown>): WriteMode | null => (input.mode === "topic" || input.mode === "better" || input.mode === "ask" ? input.mode : null);
const MODE_TELL: Record<WriteMode, string> = {
  topic: "Write the banner FRESH from the project and the brief - its words now are left out on purpose; do not try to guess them.",
  better: "Write the banner's words again, better: the same message, clearer and sharper, shorter where it helps. Keep its angle.",
  ask: "Write the banner's words again with what the person asks below.",
};
/** What the person gave - a certificate named there may stay in the AI's words (./guard.ts). */
const knownOf = (ctx: StudioCtx, d: BannerDoc, input: Record<string, unknown>) => {
  const b = ctx.brief;
  const c = d.content;
  return knownText([ctx.projectTitle, ctx.piece.title, b.goal, b.audience, b.message, b.keywords.join(", "), d.notes, c.eyebrow, c.headline, c.rotatingWords.join(" "), c.line, c.button.label,
    typeof input.ask === "string" ? input.ask : ""]);
};

/* ── put it in a page ─────────────────────────────────────────────────── */

export type PageRow = {
  id: number; title: string; status: string;
  /** this banner stands on the page as a module (Content v7, "Put it on a page") */
  onPage: boolean;
  /** What the page is: a shop page's address, or a new page's title. */
  source: string; path: string; url: string | null; isNew: boolean; newTitle: string;
  /** This banner's inserts in the page. */
  mine: { id: string; preset: string; where: string }[];
  /** Every banner the page carries. */
  total: number;
};

/** The project's page to-dos, each with where this banner (`pieceId`) sits in it. */
export async function pageRows(projectId: number, pieceId: number): Promise<PageRow[]> {
  const pieces = (await listPieces(projectId)).filter((p) => studioKindOf(p.contentType) === "page");
  const out: PageRow[] = [];
  for (const p of pieces) {
    const stored = await readDoc(p.id);
    const d = pageDoc(stored?.doc ?? null, p.language);
    const ins = insertsOf(stored?.doc ?? null);
    out.push({
      id: p.id, title: p.title, status: p.status, onPage: bannerOn(d.changes, pieceId), source: d.source, path: d.path,
      url: d.path && d.source !== "new" ? shopUrl(d.env, d.path) : null, isNew: d.source === "new", newTitle: d.newPage.title,
      mine: ins.filter((i) => i.pieceId === pieceId).map((i) => ({ id: i.id, preset: i.preset, where: i.where })),
      total: ins.length,
    });
  }
  return out;
}

/** The page to-do, when it is a page of this banner's project that this person may change. */
async function editablePage(ctx: StudioCtx, raw: unknown) {
  const id = Number(raw);
  const page = Number.isInteger(id) && id > 0 ? await getPiece(id) : null;
  if (!page || page.projectId !== ctx.projectId || studioKindOf(page.contentType) !== "page") throw new Error("That page to-do is not in this project.");
  const access = await accessFor(page.projectId, { username: ctx.me.username, role: ctx.me.admin ? "admin" : "user" });
  if (!access?.canEdit) throw new Error("You can look at this project's pages, not change them.");
  return page;
}

/* ── put it on a page of the shop (Content v7) ───────────────────────── */

const STORE_RE = /^[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?$/;
const HUB_PICTURE = /^\/api\/content\/picture\/\d{1,12}-[A-Za-z0-9_-]{4,40}$/;
/** A page of the shop as the page index names it: its path, its store view, its kind - or why not. */
function shopPathIn(input: Record<string, unknown>): { path: string; store: string; env: "prod" | "acc"; kind: string } {
  const path = typeof input.path === "string" ? input.path.trim().split(/[?#]/)[0] : "";
  if (!/^\/[a-z]{2}-[A-Z]{2,3}(\/[a-z]{3})?(\/[^\s"'<>]*)?$/.test(path) || path.length > 300 || /\.\.\//.test(path)) throw new Error("Pick a page of the shop first.");
  const c = classify(path);
  if (!c.store || c.kind === "system") throw new Error("That page of the shop cannot take a banner.");
  return { path, store: c.store, env: input.env === "acc" ? "acc" : "prod", kind: c.kind };
}

/** The project's Page builder to-do for this page of the shop, if it has one (the newest). */
async function pageTodoFor(projectId: number, path: string) {
  const pieces = (await listPieces(projectId)).filter((p) => studioKindOf(p.contentType) === "page");
  for (const p of [...pieces].reverse()) {
    const stored = await readDoc(p.id);
    const d = pageDoc(stored?.doc ?? null, p.language);
    if (d.source !== "new" && d.path === path) return p;
  }
  return null;
}

const shopPages = async (_ctx: StudioCtx, _doc: unknown, input: Record<string, unknown>) => {
  const store = typeof input.store === "string" && STORE_RE.test(input.store) ? input.store : null;
  const kind = isKind(input.kind) && input.kind !== "system" ? input.kind : null;
  const page = Math.max(0, Math.min(200, Math.floor(Number(input.page) || 0)));
  return findPages({ q: typeof input.q === "string" ? input.q.slice(0, 120) : "", store, kind, page, perPage: 30 });
};

const pagePlaces = async (ctx: StudioCtx, _doc: unknown, input: Record<string, unknown>) => {
  const at = shopPathIn(input);
  const r = await readShopPage(pageDoc({ source: "pick", env: at.env, path: at.path, store: at.store }));
  if (!r.ok) throw new Error(r.error);
  const places = placesIn(r.page.html);
  const todo = await pageTodoFor(ctx.projectId, at.path);
  return { ...places, kind: at.kind, url: r.page.url, todo: todo ? { id: todo.id, title: todo.title } : null };
};

const toPage = async (ctx: StudioCtx, _doc: unknown, input: Record<string, unknown>) => {
  if (!ctx.canEdit) throw new Error("You can look at this banner, not put it on a page.");
  const at = shopPathIn(input);
  const where: PageWhere = input.where === "slider" || input.where === "after" ? input.where : "top";
  const desktop = typeof input.desktop === "string" && HUB_PICTURE.test(input.desktop) ? input.desktop : "";
  const phone = typeof input.phone === "string" && HUB_PICTURE.test(input.phone) ? input.phone : "";
  if (!desktop) throw new Error("The banner's picture was not kept - try again.");
  const selector = typeof input.selector === "string" ? input.selector.slice(0, 300) : "";
  if (where === "after" && (!selector || /[<{};]/.test(selector))) throw new Error("Say after which block of the page it goes.");
  // the page's to-do: the one this project has, or a new Page builder to-do for it (its owner who puts it there,
  // its reviewer the default one - as every new to-do)
  let page = await pageTodoFor(ctx.projectId, at.path);
  let created = false;
  if (!page) {
    page = await addPiece({
      projectId: ctx.projectId, contentType: PAGE_BUILDER, language: at.store.slice(0, 2).toUpperCase(), title: `Page builder · ${at.path}`.slice(0, 200),
      writer: ctx.me.username, reviewer: defaultReviewerOf(await shareCandidates()), dueDate: null, by: ctx.me.username,
    });
    created = true;
    await addEvent(ctx.projectId, page.id, ctx.me.username, "piece", { piece: page.title });
    await syncPieceTasks(ctx.projectId, ctx.me.username).catch((e) => console.warn(`[content] banner to page: sub-action not made (${String((e as Error)?.message ?? e)})`));
  } else {
    const access = await accessFor(page.projectId, { username: ctx.me.username, role: ctx.me.admin ? "admin" : "user" });
    if (!access?.canEdit) throw new Error("You can look at this project's pages, not change them.");
  }
  const lang = at.store.slice(0, 2).toUpperCase();
  const stored = await docOrNew(page.id, "page", () => ({ ...emptyPage(lang), source: "pick", env: at.env, path: at.path, store: at.store, pageKind: at.kind }), ctx.me.username);
  const d = pageDoc(stored.doc, lang);
  const ops: Op[] = [];
  // a to-do made before its page was picked: the page now
  if (!d.path) {
    ops.push({ op: "set", path: ["source"], value: "pick" }, { op: "set", path: ["env"], value: at.env }, { op: "set", path: ["path"], value: at.path },
      { op: "set", path: ["store"], value: at.store }, { op: "set", path: ["pageKind"], value: at.kind });
  }
  const change = bannerChange({
    pieceId: ctx.pieceId, store: at.store, desktop, phone, where,
    alt: typeof input.alt === "string" ? input.alt.slice(0, 200) : ctx.piece.title, link: typeof input.link === "string" ? input.link.slice(0, 600) : "",
  }, { selector, before: input.before === true });
  const changes: PageChange[] = withBanner(d.changes, change);
  ops.push({ op: "set", path: ["changes"], value: changes });
  const r = await saveOps(page.id, ops, ctx.me.username);
  if (!r.ok) throw new Error(r.error);
  return {
    pieceId: page.id, title: page.title, created, moved: bannerOn(d.changes, ctx.pieceId), change: changeIdFor(ctx.pieceId),
    href: `/projects/${ctx.projectId}/pieces/${page.id}`, pages: await pageRows(ctx.projectId, ctx.pieceId),
  };
};

/** cv16: the banner's own hub pictures stored in the hub's picture storage (the Page builder's: a public address, a
 * readable name from the picture's words) - "Copy the paste block" names them there (./media.ts). */
const storeMedia = async (ctx: StudioCtx, doc: unknown) => {
  if (!ctx.canEdit) throw new Error("You can look at this banner, not store its pictures.");
  const d = normalizeBanner(doc);
  const state = contentMediaState();
  if (!state.on) throw new Error(state.why ?? "The hub's picture storage is off here - download the picture and put it in the shop's media.");
  const files: MediaFile[] = [];
  for (const [u, words] of bannerPictureWords(d)) {
    const id = Number(/^\/api\/content\/picture\/(\d+)-/.exec(u)?.[1]);
    if (!id) continue;
    const a = await getAsset(id).catch(() => null);
    const file = contentFileOf(id, a?.mime, words || a?.name?.replace(/\.[a-z0-9]{2,5}$/i, "") || a?.prompt || "");
    files.push({ file, url: u, address: contentAddress(state.base, file) });
  }
  const out = await storePictures(files);
  if (out.failed.length) {
    const list = out.failed.slice(0, 3).map((x) => `${x.file}: ${x.why}`).join("; ");
    throw new Error(`${out.failed.length === 1 ? "The picture" : `${out.failed.length} pictures`} could not be stored in the hub's picture storage (${list}) - try again in a moment.`);
  }
  return { pictures: files.map((f) => ({ url: f.url, file: f.file, address: f.address ?? "" })) };
};

/** cv16 "Update all": the banner's change on one page to-do with its new pictures, at the same place - one call per page,
 * so the studio shows each page's progress and each refusal, with "Try again" for the failed ones. */
const rePlace = async (ctx: StudioCtx, _doc: unknown, input: Record<string, unknown>) => {
  if (!ctx.canEdit) throw new Error("You can look at this banner, not change the pages it is on.");
  const page = await editablePage(ctx, input.pageId);
  const desktop = typeof input.desktop === "string" && HUB_PICTURE.test(input.desktop) ? input.desktop : "";
  const phone = typeof input.phone === "string" && HUB_PICTURE.test(input.phone) ? input.phone : "";
  if (!desktop) throw new Error("The banner's picture was not kept - try again.");
  const stored = await readDoc(page.id);
  const d = pageDoc(stored?.doc ?? null, page.language);
  const old = d.changes.find((c) => c.id === changeIdFor(ctx.pieceId));
  if (!old) throw new Error("The banner is not on this page any more - put it there again with \"Put it on a page\".");
  const next = refreshedChange(old, {
    pieceId: ctx.pieceId, store: d.store || "de-CH", desktop, phone,
    alt: typeof input.alt === "string" ? input.alt.slice(0, 200) : ctx.piece.title, link: typeof input.link === "string" ? input.link.slice(0, 600) : "",
  });
  const r = await saveOps(page.id, [{ op: "set", path: ["changes"], value: withBanner(d.changes, next) }], ctx.me.username);
  if (!r.ok) throw new Error(r.error);
  return { pieceId: page.id, title: page.title, path: d.path, href: `/projects/${ctx.projectId}/pieces/${page.id}` };
};

export const bannerKind: KindDef = {
  kind: "banner",
  channel: "ad",
  empty: (ctx) => emptyBanner(ctx.piece.language),
  toText: bannerText,
  tasks: {
    copy: {
      label: "Write the words",
      schema: COPY_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n- "sizes": shorter words for a place only where the banner's own words do not fit its room; leave a field empty to keep the banner's words. List only the places in the question.`,
      user: (ctx, doc, input) => {
        const d = normalizeBanner(doc);
        const mode = modeOf(input);
        return `${context(ctx, d, mode !== "topic")}\n\nWrite the banner's own words for the place with the most room (${PRESET[roomiest(d)].label}), then shorter ones for the other places where needed.${mode ? `\n${MODE_TELL[mode]}` : ""}${ask(input)}`;
      },
      maxTokens: 2500,
      // the shop's word rules on every text (cv16, ./guard.ts): a text that breaks one is left out, and said
      clean: (raw, doc, ctx, input) => {
        const d = normalizeBanner(doc);
        return guardCopy(cleanCopy(raw, d), knownOf(ctx, d, input), d.language);
      },
    },
    variants: {
      label: "Three other headlines",
      schema: VARIANTS_SCHEMA as unknown as Record<string, unknown>,
      system: `${RULES}\n- Three headlines from three different angles (the situation, the benefit, the ease). With changing words, each headline is a fixed start the current words still complete.`,
      user: (ctx, doc, input) => {
        const d = normalizeBanner(doc);
        const k = roomiest(d);
        return `${context(ctx, d)}\n\nGive three other headlines for the banner (${PRESET[k].label}, ${PRESET[k].limits.headline} characters at most).${ask(input)}`;
      },
      maxTokens: 1200,
      clean: (raw, doc, ctx, input) => {
        const d = normalizeBanner(doc);
        return guardVariants(cleanVariants(raw, d).headlines, knownOf(ctx, d, input), d.language);
      },
    },
  },
  actions: {
    shop_pages: shopPages, page_places: pagePlaces, to_page: toPage,
    // cv16: the Page builder's "Find a page" (its LinkInput asks "pages") for the button's page; "Update all" on the pages
    pages: shopPages, re_place: rePlace, store_media: storeMedia,
    place: async (ctx, _doc, input) => {
      const page = await editablePage(ctx, input.pageId);
      const preset = isPreset(input.preset) && PAGE_PLACES.includes(input.preset) ? input.preset : null;
      if (!preset) throw new Error("A page takes one of the shop's places: home band, category band, page hero or home slot.");
      if (!isWhere(input.where)) throw new Error("Say where in the page it goes.");
      // the page's document - made as the page studio makes it, the first time, when the page was never opened
      const stored = await docOrNew(page.id, "page", () => emptyPage(page.language), ctx.me.username);
      const { ops, insert, existed } = placeOps(stored.doc, { pieceId: ctx.pieceId, preset, where: input.where });
      if (ops.length) {
        const r = await saveOps(page.id, ops as Op[], ctx.me.username);
        if (!r.ok) throw new Error(r.error);
      }
      return { insert, existed, pages: await pageRows(ctx.projectId, ctx.pieceId) };
    },
    unplace: async (ctx, _doc, input) => {
      const page = await editablePage(ctx, input.pageId);
      const stored = await readDoc(page.id);
      const own = insertsOf(stored?.doc ?? null).find((i) => i.id === input.insertId && i.pieceId === ctx.pieceId);
      if (!own) throw new Error("This banner is not in that page any more.");
      const op = unplaceOp(stored?.doc ?? null, own.id);
      if (op) {
        const r = await saveOps(page.id, [op], ctx.me.username);
        if (!r.ok) throw new Error(r.error);
      }
      return { pages: await pageRows(ctx.projectId, ctx.pieceId) };
    },
  },
};
