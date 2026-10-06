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

export const APP_KEYS = ["datatracker", "website", "reporting", "marketing", "journey", "uc", "connectors"] as const;
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

/** What a self-registered account starts as. */
export const SELF_SIGNUP_ROLE: Role = "viewer";

/**
 * What any new account that is not an admin starts with.
 *
 * An account granted nothing is an account that signs in to an empty hall, and
 * the first thing it does is generate a request to an admin. The Datatracker is
 * the one app that is useful to everybody and discloses nothing that is not
 * already in the order book, so it is where everyone starts; anything beyond it
 * is asked for and granted.
 */
export const STARTER_GRANTS: Partial<Record<AppKey, Level>> = { datatracker: "read" };

/**
 * May this address make its own account?
 *
 * The address has to BE an address first. Reading the domain off the last "@"
 * alone let "me@evil.com@apsoparts.com" and "@apsoparts.com" through — neither
 * is an email, both ended in an account. And the domain must match exactly:
 * a subdomain is somebody else's namespace, not ours.
 */
const EMAIL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

export function maySelfRegister(email: string): boolean {
  const address = email.trim().toLowerCase();
  if (!EMAIL.test(address)) return false;
  const domain = address.slice(address.lastIndexOf("@") + 1);
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

/**
 * Which app a path belongs to.
 *
 * One list, so a sub-page cannot quietly belong to nothing — that is exactly how
 * a route becomes a way in around the guard. Longest prefix wins, because
 * /analytics splits across two apps.
 */
const ROUTES: [string, AppKey][] = [
  ["/datatracker", "datatracker"],

  ["/website", "website"],
  ["/live", "website"],
  ["/analytics/tracking", "website"],
  ["/analytics/consent", "website"],
  ["/analytics/web-orders", "website"],

  // Advanced reporting has one page so far, and that page says so. It is an
  // app key with nothing behind it yet rather than a reshuffle of Website's.
  ["/reporting", "reporting"],

  // It is named after the hub, but what it draws is the content calendar and
  // the library — the Marketing app's own data. It belongs where its data does.
  ["/mission-control", "marketing"],
  ["/create", "marketing"],
  ["/library", "marketing"],
  ["/templates", "marketing"],
  ["/personality", "marketing"],
  ["/seo", "marketing"],
  ["/geo", "marketing"],
  ["/content", "marketing"],
  ["/editor", "marketing"],
  ["/blog", "marketing"],
  ["/newsletter", "marketing"],
  ["/linkedin", "marketing"],
  ["/personas", "marketing"],
  ["/photos", "marketing"],
  ["/knowledge-base", "marketing"],

  ["/journey", "journey"],
  ["/customers", "journey"],
  ["/analytics/new-customers", "journey"],
  ["/analytics/buyers", "journey"],
  ["/analytics/contact-requests", "journey"],
  ["/analytics/smec", "journey"],
  ["/analytics", "journey"],

  ["/uc", "uc"],

  // Where the data comes from - the Compass connector's chain while it moves
  // into the hub, and what every connection writes. Configuration, so nobody
  // has it until an admin grants it.
  ["/connectors", "connectors"],
];

/**
 * The hub's own pages that are still only an admin's.
 *
 * These belong to no app, so the grants say nothing about them — which is how a
 * viewer ended up being offered "Integrations" and "Audit" in their quick links
 * and in search results. The pages themselves refuse; this is so nothing offers
 * them in the first place.
 */
const ADMIN_PATHS = [
  "/settings/people",
  "/settings/roles",
  "/settings/integrations",
  "/settings/audit",
  "/audit",
  "/admin",
];

export function adminOnlyPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** The app a path belongs to, or null for the hub's own pages. */
export function appForPath(pathname: string): AppKey | null {
  let best: [string, AppKey] | null = null;
  for (const entry of ROUTES) {
    const [prefix] = entry;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best[0].length) best = entry;
    }
  }
  return best?.[1] ?? null;
}
