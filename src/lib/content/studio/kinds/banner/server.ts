// BANNER - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). Two AI tasks, in the brand's voice (the route puts
// brain.brandSystemPrompt for the "ad" channel before task.system):
//   copy       the words for every place the banner is used in, each within its room, in the banner's language
//   variants   three other headlines for the roomiest place
// and three actions for "Put it in a page" (SARCLA 08.11.2026: "we should be able to push it inside a page visually"):
//   place      this banner into a page to-do's document (an insert - the page studio owns the page and renders it)
//   unplace    one of this banner's inserts out of a page again
// The page list and the page with the banner in it are read through GET /api/content/studio/banner/[pieceId]/in-page,
// so a reviewer who only comments sees them too. Nothing is written outside the hub: the paste block and the PNGs are made in the browser, nothing goes to Magento.

import type { KindDef, StudioCtx } from "../../contract";
import { LANGUAGE_BY_CODE } from "@/lib/content/languages";
import { accessFor } from "@/lib/content/sharing";
import { getPiece, listPieces } from "@/lib/content/workflow";
import { studioKindOf } from "../../kinds";
import { docOrNew, readDoc, saveOps } from "../../store";
import type { Op } from "../../doc";
import { emptyPage, pageDoc, shopUrl } from "../page/model";
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

function context(ctx: StudioCtx, d: BannerDoc): string {
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
    "Its words now:",
    `- eyebrow: ${c.eyebrow || "(empty)"}`,
    `- headline: ${c.headline || "(empty)"}`,
    `- changing words: ${c.rotatingWords.length ? c.rotatingWords.join(" / ") : "(none)"}`,
    `- line: ${c.line || "(empty)"}`,
    `- button: ${c.button.label || "(empty)"}${c.button.url ? ` (goes to ${c.button.url})` : ""}`,
    d.content.image.label ? `- the photo shows: ${d.content.image.label}` : "",
    d.notes.trim() ? `\nNotes on this banner: ${d.notes.trim().slice(0, 1500)}` : "",
  ].filter((x) => x !== "").join("\n");
}

const ask = (input: Record<string, unknown>) => (typeof input.ask === "string" && input.ask.trim() ? `\n\nWhat the person asks: ${input.ask.trim().slice(0, 1200)}` : "");

/* ── put it in a page ─────────────────────────────────────────────────── */

export type PageRow = {
  id: number; title: string; status: string;
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
      id: p.id, title: p.title, status: p.status, source: d.source, path: d.path,
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
        return `${context(ctx, d)}\n\nWrite the banner's own words for the place with the most room (${PRESET[roomiest(d)].label}), then shorter ones for the other places where needed.${ask(input)}`;
      },
      maxTokens: 2500,
      clean: (raw, doc) => cleanCopy(raw, normalizeBanner(doc)),
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
      clean: (raw, doc) => cleanVariants(raw, normalizeBanner(doc)),
    },
  },
  actions: {
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
