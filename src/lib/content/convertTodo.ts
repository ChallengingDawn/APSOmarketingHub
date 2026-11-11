// A PAGE ADDED TO A PROJECT THAT IS THERE ALREADY, FROM AI TESTING & PERSONALIZATION (SARCLA 10.11.2026: "upon sending to
// Content allow to create a new project or associate to the current one + the ticket"; "A/B should be sent to Content
// and then decided in Content"). Pure (no "@/" imports), so it is tested.
//
// "Send to Content" makes a project whose brief carries the page's marker (lib/convert/handoff.ts) - one page a project.
// "Add to a project" (POST /api/content/projects/<id>/work, action "piece-add-convert") adds a Page builder to-do to a
// project that is there already, and the marker goes on the TO-DO (apsomh_content_pieces.brief): a project holds as many
// pages as were added to it. The studio reads the to-do's marker first, then the project's (markerFor), and opens on
// that page and version with all the idea's versions as its A/B versions - as a project made by Send to Content does.

import { markerOf, pageMarker } from "../convert/handoff";
import { ENVS, classify, storeCase, type Env } from "../convert/model";
import { pieceKindFromConvert } from "./convertPiece";
import { CONTENT_BY_KEY } from "./contentTypes";

export type TicketAsk = { link: string } | { create: true };

export type AddConvert = {
  env: Env;
  path: string;
  versionId: string | null;
  ideaTitle: string;
  brief: string;
  /** the to-do's kind: the Page builder ("page-refresh") unless a kind the board offers was asked (./convertPiece.ts) */
  kind: string;
  ticket: TicketAsk | null;
};

/** The longest brief a to-do keeps (as Send to Content's, lib/convert/handoff.ts), its marker included. */
export const TODO_BRIEF_MAX = 6000;
const MARKS = /\[APSOconvert page [^\]]*\]/g;

/** A page address of the shop the studio may open - the rules of lib/convert/studio.ts cleanPath, and nothing that would
 *  break the marker (no "]", no space). */
export function shopPathOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      if (u.origin !== ENVS.prod.base && u.origin !== ENVS.acc.base) return null;
      p = u.pathname;
    } catch { return null; }
  }
  p = p.split(/[?#]/)[0];
  if (!p.startsWith("/") || p.startsWith("//") || p.length > 400 || /[\s<>"'\\\]\[]|\.\.\//.test(p)) return null;
  p = storeCase(p);
  return classify(p).kind === "system" ? null : p;
}

const textOf = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/** The request read, or what is wrong with it in plain words. */
export function checkAddConvert(b: Record<string, unknown>): { ok: true; value: AddConvert } | { ok: false; error: string } {
  if (b.env !== "acc" && b.env !== "prod") return { ok: false, error: `Which shop is the page on? Send env "prod" or "acc".` };
  const path = shopPathOf(b.path);
  if (!path) return { ok: false, error: "That is not a page of the shop - send the page's path, e.g. /de-CH/o-ringe." };
  let versionId: string | null = null;
  if (b.versionId !== undefined && b.versionId !== null && b.versionId !== "") {
    const v = String(b.versionId).trim();
    if (!/^\d{1,18}$/.test(v)) return { ok: false, error: "versionId is the number of the optimization's version." };
    versionId = v;
  }
  if (b.ideaTitle !== undefined && b.ideaTitle !== null && typeof b.ideaTitle !== "string") return { ok: false, error: "ideaTitle is the optimization's name, in words." };
  if (b.brief !== undefined && b.brief !== null && typeof b.brief !== "string") return { ok: false, error: "brief is the to-do's brief, in words." };
  if (typeof b.brief === "string" && b.brief.length > 7000) return { ok: false, error: "The brief is too long - keep it under 6000 characters." };
  if (b.contentType !== undefined && b.contentType !== null && typeof b.contentType !== "string") return { ok: false, error: "contentType is a Content type's key." };
  // "page-builder" (the name the apps say) and anything the board does not offer are the Page builder
  const kind = pieceKindFromConvert(typeof b.contentType === "string" ? b.contentType : null, path);
  let ticket: TicketAsk | null = null;
  const t = b.ticket;
  if (t !== undefined && t !== null && t !== false) {
    const o = (typeof t === "object" ? t : {}) as Record<string, unknown>;
    const link = o.link === undefined || o.link === null || o.link === "" ? null : String(o.link).trim();
    const create = o.create === true;
    if (link !== null && create) return { ok: false, error: "Either link a ticket or make one - not both." };
    if (link !== null) {
      if (!/^\d{1,20}$/.test(link)) return { ok: false, error: "That is not a ticket number - send the ticket's id from HubSpot." };
      ticket = { link };
    } else if (create) ticket = { create: true };
    else return { ok: false, error: `ticket is {"link": "<ticket id>"} to link a Scroll to Sale ticket, or {"create": true} to make one.` };
  }
  return { ok: true, value: { env: b.env, path, versionId, ideaTitle: textOf(b.ideaTitle, 200), brief: textOf(b.brief, 7000), kind, ticket } };
}

/** The to-do's own brief: what was sent, any marker in it taken out, and the to-do's marker - the page, the version -
 *  as its last line, so it always says the page this to-do was added for. */
export function todoBrief(x: { env: Env; path: string; versionId: string | null; brief: string }): string {
  const marker = pageMarker(x.env, x.path, null, x.versionId);
  let words = x.brief.replace(MARKS, "").replace(/\n{3,}/g, "\n\n").trim();
  const room = TODO_BRIEF_MAX - marker.length - 2;
  if (words.length > room) words = `${words.slice(0, room - 1).trimEnd()}…`;
  return words ? `${words}\n\n${marker}` : marker;
}

/** The page a to-do's studio opens on: the to-do's own marker first, then the project's. */
export function markerFor(pieceNotes: string | null | undefined, projectNotes: string | null | undefined): ReturnType<typeof markerOf> {
  return markerOf(pieceNotes ?? null) ?? markerOf(projectNotes ?? null);
}

/** The brief a to-do's studio reads: its own when it carries its page's marker, else the project's. */
export function notesFor(pieceNotes: string | null | undefined, projectNotes: string | null | undefined): string | null {
  return markerOf(pieceNotes ?? null) ? (pieceNotes as string) : projectNotes ?? null;
}

/** "Page builder · Clearer sizes on top · /de-CH/o-ringe" - the to-do's name (its sub-action's and its ticket's too). */
export function todoTitle(ideaTitle: string, path: string, kind: string): string {
  const label = CONTENT_BY_KEY[kind]?.label ?? "Page builder";
  const idea = ideaTitle.replace(/\s+/g, " ").trim();
  return (idea ? `${label} · ${idea} · ${path}` : `${label} · ${path}`).slice(0, 200);
}

/** The store view's language, as the to-dos write it: de-CH -> DE. */
export const todoLanguage = (path: string): string | null => classify(path).store?.slice(0, 2).toUpperCase() || null;

/** The to-do's studio. */
export const studioPath = (projectId: number, pieceId: number) => `/projects/${projectId}/pieces/${pieceId}`;

/** The pages a project holds, for the picker: the project's own marker (pieceId null), then each to-do's. */
export type ProjectPage = { pieceId: number | null; env: Env; path: string; versionId: string | null; testId: string | null };
export function pagesOf(projectNotes: string | null, pieces: { id: number; brief: string | null }[]): ProjectPage[] {
  const out: ProjectPage[] = [];
  const add = (pieceId: number | null, notes: string | null) => {
    const m = markerOf(notes);
    if (m) out.push({ pieceId, env: m.env, path: m.path, versionId: m.versionId ?? null, testId: m.testId ?? null });
  };
  add(null, projectNotes);
  for (const p of pieces) add(p.id, p.brief);
  return out;
}

/** The to-do that holds this page and version already (a second "Add to a project" of the same, a double click), or null -
 *  the project's own marker is left out: the picker sees it in `pages`. */
export function sameTodo(pieces: { id: number; brief: string | null }[], a: { env: Env; path: string; versionId: string | null }): number | null {
  return pagesOf(null, pieces).find((p) => p.pieceId !== null && p.env === a.env && p.path === a.path && p.versionId === a.versionId)?.pieceId ?? null;
}
