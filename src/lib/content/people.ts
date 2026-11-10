// WHO A NEW PROJECT'S TO-DOS START WITH (SARCLA 09.11.2026: "on all projects the owner is the person who creates it and
// the reviewer is Claudio - keep the dropdown but prefill"). Pure, shared with the browser and the tests.
//
//   owner     the person who makes it
//   reviewer  Claudio Saraiva - an action ("task") has no reviewer
// The dropdowns change both as before; nothing made before is touched. People are keyed by their hub username, which is
// their e-mail on most accounts - so the default reviewer is found by either.

/** The one place the default reviewer is named. */
export const DEFAULT_REVIEWER_EMAIL = "claudio.saraiva@apsoparts.com";

/** The default reviewer's username among the people offered (matched on username or e-mail, any case) - null if absent. */
export function defaultReviewerOf(people: { username: string; email?: string | null }[], email: string = DEFAULT_REVIEWER_EMAIL): string | null {
  const want = email.trim().toLowerCase();
  const hit = people.find((p) => p.username.toLowerCase() === want) ?? people.find((p) => (p.email ?? "").trim().toLowerCase() === want);
  return hit?.username ?? null;
}

/**
 * A new to-do's people, prefilled: the owner is who makes it, the reviewer the default one (an action none). What the
 * person picked wins - `undefined` = not said, so the default; `null` = nobody, on purpose.
 */
export function newTodoPeople(p: {
  kind: string; me: string; defaultReviewer: string | null; writer?: string | null; reviewer?: string | null; task?: string;
}): { writer: string | null; reviewer: string | null } {
  const task = p.kind === (p.task ?? "task");
  return {
    writer: p.writer === undefined ? p.me : p.writer,
    reviewer: task ? null : p.reviewer === undefined ? p.defaultReviewer : p.reviewer,
  };
}

/** Who "Ask for review" offers when a to-do has nobody yet: the default reviewer first and picked, then the others. */
export function reviewerChoices<T extends { username: string }>(people: T[], writer: string | null, defaultReviewer: string | null): { list: T[]; picked: string | null } {
  const def = defaultReviewer ? people.find((p) => p.username === defaultReviewer) ?? null : null;
  const others = people.filter((p) => p.username !== writer && p.username !== defaultReviewer);
  return { list: def ? [def, ...others] : others, picked: def?.username ?? null };
}

/**
 * What a to-do that came WITHOUT its people gets as its studio opens (Content v7, SARCLA 10.11.2026: "This should be already
 * prefilled" - the "Who does it" panel of the Page builder opened empty): the owner - whoever makes it: the project's maker
 * when they are among the people, else the person opening it - and the reviewer, the default one (an action none). Only
 * what is missing; null when nothing is. The panel's dropdowns change both afterwards.
 */
export function missingPeople(p: {
  kind: string | null; writer: string | null; reviewer: string | null; maker: string | null; me: string; people: string[]; defaultReviewer: string | null; task?: string;
}): { writer?: string; reviewer?: string } | null {
  const out: { writer?: string; reviewer?: string } = {};
  if (!p.writer) {
    const owner = p.maker && p.people.includes(p.maker) ? p.maker : p.me;
    if (owner) out.writer = owner;
  }
  const isTask = (p.kind ?? (p.task ?? "task")) === (p.task ?? "task");
  if (!p.reviewer && !isTask && p.defaultReviewer) out.reviewer = p.defaultReviewer;
  return Object.keys(out).length ? out : null;
}
