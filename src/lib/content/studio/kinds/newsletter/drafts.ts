// NEWSLETTER - ONE HUBSPOT DRAFT PER LANGUAGE, IN THAT LANGUAGE'S OWN LOOK (cv17, 11.11.2026). Pure: relative imports
// only, HubSpot handed in - ./hubspotEmails.ts gives it the hub's HubSpot; tests/studio-newsletter-cv17.test.ts a fake one.
//
// Round cv16 left two gaps in the last step (SARCLA 11.11.2026: "continue"):
//   one draft, updated   "Make it again" made a NEW draft each time, the older one left in HubSpot. Now a language whose
//                        draft is still a DRAFT in HubSpot has it updated in place (PATCH /marketing/v3/emails/{id} - the
//                        same e-mail, the same address); a draft that was sent, scheduled, put into a workflow or deleted
//                        there is left as it is and a new one is made - said why. Never sent, never scheduled.
//   its own look         a translated language copied the e-mail it was started from: that language's template, footer and
//                        subscription settings. Now, when our e-mails in HubSpot hold the same campaign in the draft's
//                        language - its name says so (DE_x / FR_x) - and every part a block was read from is in it (the
//                        same widget, or the same place in the same order of parts), the draft is made from THAT e-mail.
//                        Anything less is not a proof: the original's look stays and the draft's note says so.
//   baseFor / widgetMap  which of our e-mails a language's draft is made from, and where each part of the original is in it
//   draftAction          update the draft made before, or a new one - and why
//   makeDraft            the whole step against HubSpot (read, pick, upload pictures, update or make)

import type { NewsletterDoc } from "./model";
import { draftFrom, picturesToUpload, readEmail, type DraftBase, type EmailGroup, type RawEmailFull, type SourceEmail } from "./ourEmails";

/* ── which of our e-mails a language's draft is made from ──────────────────────────────────────────────────────── */

export type BaseChoice =
  | { id: string; how: "own"; subject: null; why: null }
  | { id: string; how: "language"; subject: string; why: null }
  /** the e-mail it was started from, though it is in another language - `why` no other is proven */
  | { id: string; how: "original"; subject: null; why: string };

/**
 * The e-mail a language's draft copies: the one the newsletter was started from when it is in that language; else the
 * same campaign's e-mail in that language - both named with their language (DE_x, FR_x: the same name but for it), one
 * only (two: the one sent the same day); else the one it was started from, with why.
 */
export function baseFor(groups: readonly EmailGroup[] | null, from: { emailId: string; language: string }, lang: string): BaseChoice {
  const L = lang.toUpperCase();
  const own: BaseChoice = { id: from.emailId, how: "own", subject: null, why: null };
  const original = (why: string): BaseChoice => ({ id: from.emailId, how: "original", subject: null, why });
  if (L === (from.language || "").toUpperCase()) return own;
  if (!groups) return original("our e-mails in HubSpot could not be read");
  const g = groups.find((x) => x.variants.some((v) => v.id === from.emailId));
  const s = g?.variants.find((v) => v.id === from.emailId);
  if (!g || !s) return original("the e-mail it was started from is not among our last e-mails in HubSpot");
  if (s.language === L) return own;
  if (!s.named) return original("the e-mail it was started from has no language in its name");
  const found = g.variants.filter((v) => v.named && v.language === L && v.id !== s.id);
  if (!found.length) return original(`no ${L} e-mail of this campaign in HubSpot`);
  const sameDay = found.filter((v) => v.date === s.date);
  const pick = found.length === 1 ? found[0] : sameDay.length === 1 ? sameDay[0] : null;
  if (!pick) return original(`${found.length} ${L} e-mails of this campaign - which one is not clear`);
  return { id: pick.id, how: "language", subject: pick.subject, why: null };
}

/** The widgets of the original the blocks were read from (their words, title, picture, button). */
export function refsOf(blocks: NewsletterDoc["blocks"]): string[] {
  const out = new Set<string>();
  for (const b of blocks) for (const w of [b.hs?.text, b.hs?.title, b.hs?.image, b.hs?.button]) if (w) out.add(w);
  return [...out];
}

/**
 * Where each part of the original is in another e-mail: the same widget holding the same kind of part (our languages are
 * clones of each other in HubSpot - most widgets keep their id), else - when both e-mails have the same parts in the same
 * order - the part at the same place. `missing`: parts that are in neither way (then no map: nothing is guessed).
 */
export function widgetMap(original: RawEmailFull, other: RawEmailFull, refs: readonly string[]): { map: Record<string, string>; byPlace: number } | { missing: number } {
  const seq = (e: RawEmailFull) => readEmail(e).parts.filter((p) => p.kind !== "chrome").map((p) => ({ widget: p.widget, kind: p.kind }));
  const a = seq(original);
  const b = seq(other);
  const kindA = new Map(a.map((p) => [p.widget, p.kind]));
  const kindB = new Map(b.map((p) => [p.widget, p.kind]));
  const sameOrder = a.length === b.length && a.every((p, i) => p.kind === b[i].kind);
  const map: Record<string, string> = {};
  let byPlace = 0;
  let missing = 0;
  for (const r of refs) {
    const k = kindA.get(r);
    if (k && kindB.get(r) === k) { map[r] = r; continue; }
    const i = a.findIndex((p) => p.widget === r);
    if (k && sameOrder && i >= 0 && b[i].kind === k) { map[r] = b[i].widget; byPlace += 1; continue; }
    missing += 1;
  }
  // two parts of the original never land in one
  const to = Object.values(map);
  if (new Set(to).size !== to.length) missing += to.length - new Set(to).size;
  return missing ? { missing } : { map, byPlace };
}

/* ── the draft made before: updated, or a new one ──────────────────────────────────────────────────────────────── */

/** The draft made before as HubSpot answers it (null: HubSpot does not have it - 404). */
export type ExistingDraft = { id?: string | number; state?: string; archived?: boolean; isPublished?: boolean; content?: { templatePath?: string } } | null;

export type DraftAction = { mode: "update"; id: string; why: null } | { mode: "new"; why: string | null };

/** HubSpot's state of an e-mail in plain words: what happened to it there. */
function stateSaid(state: string): string {
  const s = state.toUpperCase();
  if (/SCHEDULED/.test(s)) return "was scheduled in HubSpot";
  if (/AUTOMATED/.test(s)) return "was put into a workflow in HubSpot";
  if (/PUBLISHED|SENT/.test(s)) return "was sent from HubSpot";
  return `is ${s.toLowerCase().replace(/_/g, " ")} in HubSpot`;
}

/**
 * The language's draft: no draft made before - a new one; made before and still a DRAFT in HubSpot, with the same
 * template - updated in place; sent, scheduled, put into a workflow, deleted, or on another template - left as it is,
 * a new one made, said why.
 */
export function draftAction(madeBefore: string | null | undefined, existing: ExistingDraft, templatePath?: string | null): DraftAction {
  if (!madeBefore) return { mode: "new", why: null };
  const keep = " - it stays as it is there; this is a new draft";
  if (!existing || existing.archived) return { mode: "new", why: `Its draft made before (${madeBefore}) is no longer in HubSpot (deleted there) - this is a new draft.` };
  const state = String(existing.state ?? "");
  if (existing.isPublished || state.toUpperCase() !== "DRAFT") return { mode: "new", why: `Its draft made before (${madeBefore}) ${stateSaid(state || "PUBLISHED")}${keep}.` };
  const was = existing.content?.templatePath;
  if (was && templatePath && was !== templatePath) return { mode: "new", why: `Its draft made before (${madeBefore}) has another HubSpot template than this e-mail now${keep} - delete the older one there.` };
  return { mode: "update", id: String(existing.id ?? madeBefore), why: null };
}

/** An update HubSpot refused: a new draft when HubSpot would not take the update itself (gone, or not valid as it was);
 *  its pace, its side or its permissions are said instead - nothing doubled on a passing refusal. */
export function afterRefusal(status: number | null): "new" | "refuse" {
  return status === 404 || status === 400 || status === 409 || status === 422 ? "new" : "refuse";
}

/** A HubSpot error's status (the hub's IntegrationError, or a fake one in the tests). */
export const statusOf = (e: unknown): number | null =>
  e && typeof e === "object" && "status" in e && typeof (e as { status?: unknown }).status === "number" ? (e as { status: number }).status : null;

/* ── the whole step ────────────────────────────────────────────────────────────────────────────────────────────── */

export type HubspotCall = <T>(req: { path: string; method?: "GET" | "POST" | "PATCH"; body?: unknown }) => Promise<T>;
export type DraftDeps = {
  /** our e-mails in HubSpot, grouped by campaign (./hubspotEmails.ts ourEmails) */
  groups: () => Promise<EmailGroup[]>;
  /** a picture kept in the hub, put into HubSpot's files - its address there (null: it could not go) */
  upload: (url: string, alt: string) => Promise<string | null>;
  /** the draft's address in HubSpot */
  urlOf: (id: string) => string;
};
export type DraftMade = {
  id: string; url: string;
  /** updated in place, or made new (`why` a draft made before was not updated) */
  made: "updated" | "new"; why: string | null;
  /** the e-mail its look is: the one started from, or the campaign's e-mail in this language */
  base: { id: string; how: BaseChoice["how"]; subject: string | null };
  changed: string[]; notes: string[];
};

const path = (id: string) => `/marketing/v3/emails/${encodeURIComponent(id)}`;

/**
 * A language's e-mail as its draft in HubSpot: made from the right e-mail (baseFor, proven by widgetMap), its hub pictures
 * in HubSpot's files, the draft made before updated in place when it still is one (draftAction) - else a new one. Only
 * drafts: nothing is ever sent or scheduled from here.
 */
export async function makeDraft(hs: HubspotCall, doc: NewsletterDoc, name: string, deps: DraftDeps): Promise<DraftMade> {
  const from = doc.startedFrom;
  if (!from?.emailId) throw new Error("Start the newsletter from one of our e-mails first - the draft copies its look.");
  const L = (doc.language || "").toUpperCase();
  const source = await hs<SourceEmail>({ path: path(from.emailId) });
  // its own look: the campaign's e-mail in this language, when the data proves it (else the original's, said)
  const choice = baseFor(await deps.groups().catch(() => null), from, L);
  const lookNotes: string[] = [];
  let base: DraftBase | undefined;
  let used: DraftMade["base"] = { id: from.emailId, how: choice.how === "language" ? "original" : choice.how, subject: null };
  const fromLang = (from.language || "").toUpperCase() || "original";
  if (choice.how === "language") {
    const other = await hs<SourceEmail>({ path: path(choice.id) }).catch(() => null);
    const m = other ? widgetMap(source, other, refsOf(doc.blocks)) : null;
    if (other && m && "map" in m) {
      base = { email: other, map: m.map };
      used = { id: choice.id, how: "language", subject: choice.subject };
      lookNotes.push(`Made from our ${L} e-mail “${choice.subject.slice(0, 60)}” - its look, footer and subscription settings.`);
    } else {
      lookNotes.push(`The ${L} draft copies the ${fromLang} e-mail's look, footer and subscription settings (${other ? `${m && "missing" in m ? m.missing : 0} of its parts are not in our ${L} e-mail “${choice.subject.slice(0, 50)}” in the same place` : `our ${L} e-mail could not be read`}) - check its footer in HubSpot.`);
    }
  } else if (choice.how === "original") {
    lookNotes.push(`The ${L} draft copies the ${fromLang} e-mail's look, footer and subscription settings (${choice.why}) - check its footer in HubSpot.`);
  }
  // its pictures kept in the hub, into HubSpot's files - each named from what it shows (its block's alt text)
  const uploaded: Record<string, string> = {};
  const altOf = (u: string) => { for (const b of doc.blocks) if ("imageUrl" in b && b.imageUrl === u && "imageAlt" in b) return b.imageAlt; return ""; };
  for (const u of picturesToUpload(doc)) {
    const at = await deps.upload(u, altOf(u)).catch(() => null);
    if (at) uploaded[u] = at;
  }
  const plan = draftFrom(source, doc, { name, uploaded, base });
  const template = ((plan.body.content ?? {}) as { templatePath?: string }).templatePath ?? null;
  // the draft made before: still a draft in HubSpot - updated in place; else a new one, said why
  const before = doc.hubspot?.emailId ? String(doc.hubspot.emailId) : null;
  let action: DraftAction = { mode: "new", why: null };
  if (before) {
    let existing: ExistingDraft = null;
    try { existing = await hs<NonNullable<ExistingDraft>>({ path: path(before) }); }
    catch (e) { if (statusOf(e) !== 404) throw e; }
    action = draftAction(before, existing, template);
  }
  const done = (id: string, made: DraftMade["made"], why: string | null): DraftMade => ({ id, url: deps.urlOf(id), made, why, base: used, changed: plan.changed, notes: [...lookNotes, ...plan.notes] });
  if (action.mode === "update") {
    // an existing e-mail keeps its kind: everything else of the draft goes as made here
    const { subcategory: _kind, ...patch } = plan.body;
    try {
      await hs<{ id?: string }>({ path: path(action.id), method: "PATCH", body: patch });
      return done(action.id, "updated", null);
    } catch (e) {
      if (afterRefusal(statusOf(e)) === "refuse") throw e;
      action = { mode: "new", why: `HubSpot did not take the update of its draft made before (${before}: ${(e instanceof Error ? e.message : String(e)).replace(/^HubSpot:\s*/, "").slice(0, 120)}) - this is a new draft; delete the older one there.` };
    }
  }
  const made = await hs<{ id?: string | number }>({ path: "/marketing/v3/emails", method: "POST", body: plan.body });
  if (!made.id) throw new Error("HubSpot made no draft.");
  return done(String(made.id), "new", action.why);
}

/** What the last step says of a draft made: updated in place or new (and why), then what is in it. */
export function madeNote(r: Pick<DraftMade, "made" | "why" | "changed" | "notes">): string {
  const head = r.made === "updated" ? "Its draft in HubSpot is updated - the same e-mail." : r.why ?? "";
  const what = r.changed.length ? `In the draft: ${r.changed.length} change${r.changed.length === 1 ? "" : "s"} from here.` : "The draft is the original with this subject and preheader.";
  return [head, what, ...r.notes].filter(Boolean).join(" ");
}
