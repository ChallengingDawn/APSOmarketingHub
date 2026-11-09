// "CHANGES MADE HERE", KEPT WITH THE DOCUMENT (Content v4, 09.11.2026 - the lead: "Changes made here survives a reload in
// both studios"). The blog's and the newsletter's assistant changes are listed in the document itself: what changed, when,
// a translation's language - never a picture or a copy of the text. What it replaced is a version of the to-do, saved
// just before the change and found again by the change's number in its label ("... #<id>"), so a change made before a
// reload can still be gone back from (Versions keeps the state of now). Pure; tests/studio-changes.test.ts.

/** `lang`: a translation's language; `from`: the one it was translated from */
export type StudioChange = { id: number; text: string; at: string; lang?: string; from?: string };

export const CHANGES_KEPT = 20;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The stored list, put right: the newest first, at most 20, short words, no picture, no copy of the text. */
export function changesOf(v: unknown): StudioChange[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj)
    .map((x) => ({
      id: typeof x.id === "number" && Number.isFinite(x.id) ? x.id : 0,
      text: typeof x.text === "string" ? x.text.replace(/data:[^\s"')]+/g, "").slice(0, 300) : "",
      at: typeof x.at === "string" ? x.at.slice(0, 40) : "",
      ...(typeof x.lang === "string" && /^[A-Z]{2}$/.test(x.lang) ? { lang: x.lang } : {}),
      ...(typeof x.from === "string" && /^[A-Z]{2}$/.test(x.from) ? { from: x.from } : {}),
    }))
    .filter((x) => x.id > 0 && x.text)
    .sort((a, b) => b.id - a.id)
    .slice(0, CHANGES_KEPT);
}

/** A change put on top of the list (one with the same number replaced). */
export const addChange = (list: unknown, c: StudioChange): StudioChange[] => changesOf([c, ...changesOf(list).filter((x) => x.id !== c.id)]);

/** The label of the version saved just before a change - its number at the end finds it again. */
export const versionLabel = (c: Pick<StudioChange, "id" | "text">): string => `Before: ${c.text.replace(/\s+/g, " ").slice(0, 90)} #${c.id}`;

/** The version saved just before this change, if there is one. */
export function versionOf<V extends { id: number; label: string | null }>(versions: V[], id: number): V | null {
  return versions.find((v) => !!v.label && v.label.endsWith(`#${id}`)) ?? null;
}

/** The languages the thing has been translated into here (the newest first), its own language first. */
export function madeLanguages(list: unknown, current: string): string[] {
  const cur = current.toUpperCase();
  return [...new Set([cur, ...changesOf(list).flatMap((c) => [c.lang, c.from].filter((x): x is string => !!x))])];
}

/** When, as the list shows it: the hour today, the day and the hour before. */
export function whenOf(at: string, now = new Date()): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return "";
  const hm = t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return t.toDateString() === now.toDateString() ? hm : `${t.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hm}`;
}
