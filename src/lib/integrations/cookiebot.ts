// COOKIEBOT CONSENT LOG — daily opt-in and opt-out counts from Cookiebot's data
// API (Cookiebot support: "Extracting consent data via API", updated 2026-08-25).
// Cookiebot keeps these records as proof of consent anyway, so reading them
// tracks nobody. Visitors who leave without answering the banner are not in
// them. The API key travels in the URL path: it is never logged, and it is
// scrubbed from any error text before that text can reach the UI.

import { IntegrationError } from "./status";

export const COOKIEBOT_DEFAULT_DOMAIN_GROUP = "0c548172-58a9-4606-9df6-9cfde47bb141";
export const COOKIEBOT_DEFAULT_DOMAIN = "www.apsoparts.com";

function env(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function cookiebotApiKey(): string | null {
  return env("COOKIEBOT_API_KEY");
}

export type ConsentDay = {
  date: string;
  /** All opt-ins: visitors who clicked a consent button plus implied opt-ins (Cookiebot's documented split below). */
  optIn: number | null;
  optOut: number | null;
  /** Consent recorded without a click — the banner ignored with implied consent on, or a visitor outside the consent regions. */
  optInImplied: number | null;
  /** Opt-ins given by clicking a button. */
  optInStrict: number | null;
  /** Cross-domain consent sharing opt-ins (implied / strict). */
  bulkOptInImplied: number | null;
  bulkOptInStrict: number | null;
  optInPreferences: number | null;
  optInStatistics: number | null;
  optInMarketing: number | null;
};

export type ConsentStats = {
  domain: string;
  from: string;
  to: string;
  days: ConsentDay[];
  /** Consents per country over the whole window, largest first. */
  countries: { code: string; count: number }[];
};

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export async function fetchConsentStats(params: { from: string; to: string; signal?: AbortSignal }): Promise<ConsentStats> {
  const key = cookiebotApiKey();
  if (!key) throw new IntegrationError("COOKIEBOT_API_KEY is not set.");
  const group = env("COOKIEBOT_DOMAIN_GROUP") ?? COOKIEBOT_DEFAULT_DOMAIN_GROUP;
  const domain = env("COOKIEBOT_DOMAIN") ?? COOKIEBOT_DEFAULT_DOMAIN;
  const compact = (iso: string) => iso.replace(/-/g, "");
  const url =
    `https://consent.cookiebot.com/api/v1/${encodeURIComponent(key)}/json/domaingroup/${encodeURIComponent(group)}` +
    `/domain/${encodeURIComponent(domain)}/consent/stats?startdate=${compact(params.from)}&enddate=${compact(params.to)}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: params.signal, cache: "no-store" });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) throw err;
    throw new IntegrationError("Cookiebot: the data API could not be reached.");
  }
  // Scrub the key in raw and URL-encoded form: an error body or proxy page may echo the request path.
  let text = (await res.text()).split(key).join("[api key]");
  const encodedKey = encodeURIComponent(key);
  if (encodedKey !== key) text = text.split(encodedKey).join("[api key]");
  if (!res.ok) {
    const detail = text.trim().slice(0, 300);
    throw new IntegrationError(`Cookiebot: HTTP ${res.status}${detail ? ` — ${detail}` : ""}`, res.status);
  }

  let body: { domain?: unknown; consentstat?: { consentday?: unknown }; error?: { message?: unknown } };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    throw new IntegrationError("Cookiebot: the data API returned a non-JSON response.", res.status);
  }
  // The API reports a bad key with HTTP 200 and {"error":{"message":"Invalid API key"}}
  // (checked 15.09.2026), so a 200 alone does not mean there is data.
  if (body.error && typeof body.error.message === "string") {
    throw new IntegrationError(`Cookiebot: ${body.error.message}`, null);
  }
  if (!body.consentstat) {
    throw new IntegrationError(
      "Cookiebot: the data API answered without consent statistics — check COOKIEBOT_DOMAIN_GROUP and COOKIEBOT_DOMAIN.",
      null,
    );
  }

  const countries = new Map<string, number>();
  const days: ConsentDay[] = [];
  for (const entry of asArray(body.consentstat?.consentday)) {
    const d = entry as Record<string, unknown>;
    const date = typeof d.Date === "string" ? d.Date.slice(0, 10) : "";
    if (!date) continue;
    const countryList = (d.Countries as { Country?: unknown } | undefined)?.Country;
    for (const c of asArray(countryList)) {
      const row = c as { Code?: unknown; Count?: unknown };
      const code = typeof row.Code === "string" ? row.Code.toLowerCase() : "";
      const count = num(row.Count);
      if (code && count !== null) countries.set(code, (countries.get(code) ?? 0) + count);
    }
    days.push({
      date,
      optIn: num(d.OptIn),
      optOut: num(d.OptOut),
      optInImplied: num(d.OptInImplied),
      optInStrict: num(d.OptInStrict),
      bulkOptInImplied: num(d.BulkOptInImplied),
      bulkOptInStrict: num(d.BulkOptInStrict),
      optInPreferences: num(d.TypeOptInPref),
      optInStatistics: num(d.TypeOptInStat),
      optInMarketing: num(d.TypeOptInMark),
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    domain: typeof body.domain === "string" ? body.domain : domain,
    from: params.from,
    to: params.to,
    days,
    countries: [...countries.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
  };
}
