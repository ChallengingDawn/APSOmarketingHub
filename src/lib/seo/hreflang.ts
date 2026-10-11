// COUNTRY LABELS: WHICH OF OUR OWN HOMEPAGES GOOGLE CANNOT CLUSTER.
//
// apsoparts.com publishes the same homepage once per locale — fourteen near
// identical copies. hreflang is what tells Google they are the same page in
// different languages, so it shows the Italian one in Italy and the Swiss one
// in Switzerland instead of picking a favourite.
//
// The rule that decides whether that works is unglamorous and absolute:
//
//   A page's hreflang set MUST contain an entry pointing at that page itself.
//
// Without the self-reference the set is invalid, Google will not join the page
// to the cluster, and the page floats free — competing with its own siblings
// rather than being the regional variant of them.
//
// This is not hypothetical here. Every locale homepage on apsoparts.com emits
// the SAME eleven-entry set, and that set names exactly one German URL:
// de-CH. So /de-DE/, /de-AT/, /de-INT/ and /en-INT/ each publish a list of
// alternates that leaves themselves out. Google duly made its own choice and
// settled on /de-INT/, which in September was the most-clicked page on the
// whole site (548 clicks) while the Swiss homepage it should have preferred
// did not reach the top three.
//
// Nothing in here fetches anything — it is the rule, applied to HTML that
// somebody else went and got, so it can be tested without a network.

/** One `<link rel="alternate" hreflang="..." href="...">` as published. */
export type Alternate = { hreflang: string; href: string };

export type LocaleCheck = {
  /** The locale segment as it appears in the path, e.g. "de-INT". */
  locale: string;
  url: string;
  /** Everything the page declared. Empty is itself a finding. */
  alternates: Alternate[];
  /**
   * Does the set point back at this page? The whole verdict turns on it.
   * `null` when we could not read the page at all, which is not the same as
   * "no" and must not be reported as one.
   */
  selfReferenced: boolean | null;
  /** Why we could not read it, when we could not. */
  error: string | null;
};

export type HreflangVerdict = {
  checked: number;
  /** Pages that published a set which leaves themselves out. The finding. */
  orphans: LocaleCheck[];
  /** Pages we could not read; excluded from the verdict rather than assumed. */
  unreadable: LocaleCheck[];
  /** Named okCount, not ok: the API response already has an `ok` boolean. */
  okCount: number;
};

const LINK_TAG = /<link\b[^>]*>/gi;
const ATTR = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");

/**
 * Pulls the alternates out of a page's HTML.
 *
 * Attribute order is not fixed and nothing guarantees `rel` comes first, so
 * each <link> is read as a bag of attributes rather than matched as a shape.
 * A regex is the right tool only because the input is our own markup and the
 * alternative is a DOM parser in a route that has no DOM.
 */
export function parseAlternates(html: string): Alternate[] {
  const out: Alternate[] = [];
  for (const tag of html.match(LINK_TAG) ?? []) {
    const rel = tag.match(ATTR("rel"))?.[1]?.trim().toLowerCase();
    if (rel !== "alternate") continue;
    const hreflang = tag.match(ATTR("hreflang"))?.[1]?.trim();
    const href = tag.match(ATTR("href"))?.[1]?.trim();
    if (!hreflang || !href) continue;
    out.push({ hreflang, href });
  }
  return out;
}

/** Trailing slashes and case differ harmlessly between href and address. */
function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Is this page named in its own hreflang set?
 *
 * x-default does NOT count. It says "use this when nothing else matches",
 * which is a fallback for the cluster and not a claim about this page's own
 * language — a page whose only mention is x-default is still unclustered.
 */
export function selfReferences(url: string, alternates: Alternate[]): boolean {
  return alternates.some(
    (a) => a.hreflang.toLowerCase() !== "x-default" && sameUrl(a.href, url),
  );
}

export function checkLocale(locale: string, url: string, html: string | null, error: string | null): LocaleCheck {
  if (html === null) {
    return { locale, url, alternates: [], selfReferenced: null, error: error ?? "Could not read the page." };
  }
  const alternates = parseAlternates(html);
  return { locale, url, alternates, selfReferenced: selfReferences(url, alternates), error: null };
}

export function verdictOf(checks: LocaleCheck[]): HreflangVerdict {
  const unreadable = checks.filter((c) => c.selfReferenced === null);
  const orphans = checks.filter((c) => c.selfReferenced === false);
  return {
    checked: checks.length,
    orphans,
    unreadable,
    okCount: checks.filter((c) => c.selfReferenced === true).length,
  };
}

/**
 * The locale homepages to look at.
 *
 * Hard-coded on purpose, and this is the one place it is right to be: the
 * check exists to find pages MISSING from the hreflang sets, so deriving the
 * list from those sets would guarantee it never found anything. Search Console
 * is no better a source — a page Google has decided to ignore earns no
 * impressions and would quietly drop off the list exactly when it matters.
 */
export const LOCALE_HOMEPAGES = [
  "de-CH", "de-DE", "de-AT", "de-INT",
  "it-IT", "it-CH", "it-INT",
  "fr-FR", "fr-CH", "fr-INT",
  "nl-NL", "nl-INT",
  "pl-PL",
  "en-INT",
] as const;

export function homepageUrl(origin: string, locale: string): string {
  return `${origin.replace(/\/+$/, "")}/${locale}/`;
}
