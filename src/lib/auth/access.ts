// WHO MAY OPEN WHICH APP, AND HOW FAR.
//
// Two things, kept apart:
//
//   the ROLE says HOW MUCH a person may do — read, or write, or everything;
//   the GRANT says WHICH apps they may do it in.
//
// Keeping them separate is what stops the usual drift, where "editor" quietly
// comes to mean "editor of whatever editors happen to have" and nobody can say
// who can see revenue. A promotion changes the role and no grant is touched; a
// demotion is the same in reverse.
//
// Pure functions, no database — so the rule can be tested, and so the screen
// that draws it and the guard that enforces it cannot disagree.

/** The role as stored. `user` is the editor tier; it predates the name. */
export type Role = "admin" | "user" | "viewer";

/** What a person may do in an app they have been granted. */
export type Level = "none" | "read" | "write";

export const APP_KEYS = ["datatracker", "website", "marketing", "journey", "uc"] as const;
export type AppKey = (typeof APP_KEYS)[number];

/** What each role is called on screen. `user` has always meant editor. */
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  user: "Editor",
  viewer: "Viewer",
};

export const ROLE_NOTE: Record<Role, string> = {
  admin: "Every app, and the parts of Settings that govern other people.",
  user: "Can change things in the apps they are given.",
  viewer: "Read-only, in the apps they are given.",
};

/**
 * The highest level a role may ever reach, whatever a grant says.
 *
 * An admin is not granted apps one at a time: the point of the role is that it
 * does not need to be, and a half-granted admin is a support call waiting to
 * happen.
 */
export function ceiling(role: Role): Level {
  if (role === "admin") return "write";
  if (role === "user") return "write";
  return "read";
}

const ORDER: Record<Level, number> = { none: 0, read: 1, write: 2 };

/** The lower of two levels. */
export function cap(level: Level, limit: Level): Level {
  return ORDER[level] <= ORDER[limit] ? level : limit;
}

/**
 * What this person may actually do in this app.
 *
 * An admin gets everything without a grant. Everyone else gets what they were
 * granted, capped by their role — and nothing at all where there is no grant.
 */
export function effectiveLevel(role: Role, granted: Level | undefined): Level {
  if (role === "admin") return "write";
  if (!granted || granted === "none") return "none";
  return cap(granted, ceiling(role));
}

export function canOpen(role: Role, granted: Level | undefined): boolean {
  return effectiveLevel(role, granted) !== "none";
}

export function canWrite(role: Role, granted: Level | undefined): boolean {
  return effectiveLevel(role, granted) === "write";
}

/**
 * Must this person carry a second factor?
 *
 * Anyone who can change something must. A viewer may go without — they still
 * see customer names and order values, so it is a real trade, taken knowingly:
 * the sign-in nudges them, and an admin can require it per person.
 */
export function mfaRequired(role: Role, requiredForPerson = false): boolean {
  return requiredForPerson || role === "admin" || role === "user";
}

/**
 * WHO MAY REGISTER THEMSELVES.
 *
 * Confirmed by SARCLA, 04.10.2026. An address at one of these may create its
 * own account; everybody else has to be invited by an admin.
 *
 * The domain rule only protects anything once the address is VERIFIED — without
 * that, anyone outside who knows the pattern can claim any address at it. So
 * self-registration must not be switched on before the verification mail works.
 */
export const SELF_SIGNUP_DOMAINS = ["apsoparts.com", "angst-pfister.com"] as const;

/** What a self-registered account starts as: a viewer who can open nothing. */
export const SELF_SIGNUP_ROLE: Role = "viewer";

export function maySelfRegister(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return (SELF_SIGNUP_DOMAINS as readonly string[]).includes(domain);
}

/** Levels in the order a chooser should offer them. */
export const LEVELS: { value: Level; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "read", label: "View" },
  { value: "write", label: "Edit" },
];

/** What a role may be offered, so a viewer is never shown "Edit". */
export function levelsFor(role: Role): { value: Level; label: string }[] {
  const limit = ORDER[ceiling(role)];
  return LEVELS.filter((l) => ORDER[l.value] <= limit);
}
