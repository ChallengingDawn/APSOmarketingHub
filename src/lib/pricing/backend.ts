// PRICING: WHAT THE HUB MAY ASK OF THE PRICINGHUB BACKEND, AND WHO MAY CHANGE WHAT.
//
// The Pricing app's pages (src/app/pricing) read and write the PricingHub backend's data through one route,
// /api/pricing/api/<backend path> (src/app/api/pricing/api/[...path]/route.ts), which adds the backend's key on the
// server - the browser never holds it. This file is that route's rule book, pure so it can be tested:
//
//   - which of the backend's areas the pages use: nothing else passes (its DoC, DirectUP, O-ring and shaft-seal
//     routes belong to other apps, and the hub's identity lookup to the prefs route);
//   - which pages a change belongs to: a write needs Edit on at least one of them (src/lib/auth/tree.ts), so a person
//     given Edit on Product matching alone approves matches and changes no price;
//   - who made it: the backend takes "user_email", "user_name" and "approved_by" from the request, and the PricingHub
//     dashboard used to let the browser say who that was. Here the hub's own session says it.

/** The backend's top-level areas the Pricing pages read from (the first segment after /api/). */
export const PRICING_AREAS = [
  "products", "competitors", "matches", "matching", "benchmark", "dashboard", "analytics", "alerts",
  "scrapers", "dimensions", "anyseals", "purchasing", "card",
] as const;

/** Of the HubSpot card's routes (/api/card/*), the Benchmark's manual competitor price only. */
const CARD_ALLOWED = /^manual-prices?(\/\d+(\/file)?)?$/;

const SEGMENT = /^[A-Za-z0-9._~\-]+$/;

/**
 * Is this backend path one the Pricing pages use? `segs` is the path after /api/ (["matches", "approve-group"]).
 * Every segment must be a plain name - no "..", no encoded slashes - so a request cannot walk out of its area.
 */
export function allowedPath(segs: string[]): boolean {
  if (!segs.length || !segs.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) return false;
  const [area, ...rest] = segs;
  if (!(PRICING_AREAS as readonly string[]).includes(area)) return false;
  if (area === "card") return CARD_ALLOWED.test(rest.join("/"));
  return true;
}

const MATCHING = ["/pricing/matches", "/pricing/matches/pending", "/pricing/matches/unmatched", "/pricing/matches/logs"];
const PURCHASING = ["/pricing/purchasing/ocr", "/pricing/purchasing/benchmark", "/pricing/purchasing/price-index", "/pricing/purchasing/logs"];

/**
 * The pages a change to this backend path is made from - Edit on any one of them allows it. Listed from what each page
 * of the PricingHub dashboard sends (its sources, 14.11.2026); a path no page writes to answers with no page, and
 * only an Edit on the whole app allows it.
 */
export function writePages(segs: string[]): string[] {
  const [area, second] = segs;
  switch (area) {
    case "matches":
      // approved, refused, deleted on the matching pages; a wrong match deleted from the Prices page's detail
      return [...MATCHING, "/pricing/prices"];
    case "matching":
      return MATCHING;
    case "products":
      // the catalogue re-read from HubSpot: on the products page and before a matching run
      if (second === "sync") return ["/pricing/products", ...MATCHING];
      // edited or deleted on the products page; deleted from the Repricing studio's detail
      return ["/pricing/products", "/pricing/repricing"];
    case "analytics":
      return ["/pricing/repricing"];
    case "benchmark":
    case "card":
      return ["/pricing/benchmark"];
    case "competitors":
    case "scrapers":
      return ["/pricing/competitors"];
    case "dimensions":
      return ["/pricing/scrapers"];
    case "anyseals":
      return ["/pricing/stock"];
    case "purchasing":
      return PURCHASING;
    default:
      return [];
  }
}

export type Who = { email: string; name: string };

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * A JSON body with the person written in by the hub: user_email and user_name always, approved_by where the page sends
 * one. Anything else - an array, a number, not JSON at all - goes through as it came.
 */
export function stampBody(raw: string, who: Who): string {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return raw; }
  if (!isPlainObject(body)) return raw;
  const out: Record<string, unknown> = { ...body, user_email: who.email, user_name: who.name };
  if ("approved_by" in body) out.approved_by = who.email;
  return JSON.stringify(out);
}

/**
 * The same for a query string - a DELETE carries its person there (a match deleted with ?reason=...&user_email=...),
 * so a DELETE always gets them: the person is the hub's, never the address's.
 */
export function stampQuery(search: URLSearchParams, who: Who, always = false): URLSearchParams {
  const out = new URLSearchParams(search);
  if (always || out.has("user_email") || out.has("user_name")) {
    out.set("user_email", who.email);
    out.set("user_name", who.name);
  }
  return out;
}
