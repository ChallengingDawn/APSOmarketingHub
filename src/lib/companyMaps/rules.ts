// COMPANY DATA > Google Maps link - the rule, pure: no HubSpot, no "@/" imports (the tests compile this file on its own).
// The engine is engine.ts. Replaces the HubSpot workflow "SARCLA | GMAPS QUERY WITH CODE" (2865179896), SARCLA 10.11.2026
// ("create a complete sub app, for the moment with only GMAPS query inside"), with its rule as it was: a company without
// a Google Maps link gets one made of its name and its address - street, second line, postcode, city, state, country -
// "https://www.google.com/maps/search/?api=1&query=<name, street, …>" (Google's own link format; no Google key, nothing is
// sent to Google). The parts are joined with ", "; without an address, the name alone. Line breaks inside a part become
// spaces (the workflow kept them, as %0A).
//
// A link once written is kept: 35,696 links (10.11.2026) hold a house number the company's street lost on 15.02.2026, when
// a HubSpot data set rewrote 'address' without it - a link made again from today's address would be worse.

export const WORKFLOW_ID = "2865179896";
export const PROPERTY = "google_maps_link";
export const MAPS_PREFIX = "https://www.google.com/maps/search/?api=1&query=";
/** The company properties the link is made of, in its order (after the name). */
export const ADDRESS = ["address", "address2", "zip", "city", "state", "country"] as const;

const clean = (x: string | null | undefined) => String(x ?? "").replace(/\s+/g, " ").trim();

/** "Sika Schweiz AG, Tüffenwies 16, 8048, Zürich, Switzerland" - or the name alone without an address. */
export function mapsQuery(p: Record<string, string | null | undefined>): string {
  const parts = ADDRESS.map((k) => clean(p[k])).filter(Boolean);
  const name = clean(p.name);
  return parts.length ? [name, ...parts].filter(Boolean).join(", ") : name;
}
/** Python's quote_plus, as the workflow encoded: everything but letters, digits and _.-~ as %XX of UTF-8, a space as "+". */
export function quotePlus(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, "+");
}
/** The link, or "" for a company with neither a name nor an address. */
export function mapsLink(p: Record<string, string | null | undefined>): string {
  const q = mapsQuery(p);
  return q ? `${MAPS_PREFIX}${quotePlus(q)}` : "";
}
/** What a link searches for ("" when it is not a Google Maps search link). */
export function queryOf(link: string | null | undefined): string {
  const s = String(link ?? "").trim();
  if (!s.startsWith(MAPS_PREFIX)) return "";
  try { return decodeURIComponent(s.slice(MAPS_PREFIX.length).replace(/\+/g, " ")); } catch { return ""; }
}
