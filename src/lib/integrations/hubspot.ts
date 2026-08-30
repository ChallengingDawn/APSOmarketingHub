// HubSpot private-app access (portal 26492587). Object counts come from the
// CRM search endpoint's `total` — one request per count instead of paging every
// record. The token is read per call and never logged.

import { IntegrationError, hubspotEventsToken, hubspotToken } from "./status";

const API_BASE = "https://api.hubapi.com";

// The CRM search endpoint enforces a hard per-second limit, and the customer
// view legitimately needs a dozen counts. All search calls therefore flow
// through one queue with a minimum spacing, and every call retries a 429
// after the wait HubSpot asks for — the limit is a pace, not a quota.
const SEARCH_MIN_INTERVAL_MS = 320;
const RETRY_ATTEMPTS = 3;
let searchChain: Promise<void> = Promise.resolve();
let lastSearchAt = 0;

function throttleSearch(): Promise<void> {
  const turn = searchChain.then(async () => {
    const wait = lastSearchAt + SEARCH_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSearchAt = Date.now();
  });
  searchChain = turn.catch(() => {});
  return turn;
}
const DEFAULT_RECENT_DAYS = 30;
const MAX_RECENT_DAYS = 365;

export type HubspotAccount = {
  portalId: number | null;
  accountType: string | null;
  timeZone: string | null;
  companyCurrency: string | null;
  uiDomain: string | null;
};

export type HubspotSummary = {
  contacts: number | null;
  companies: number | null;
  newContacts: number | null;
  days: number;
  since: string;
};

type AccountResponse = {
  portalId?: unknown;
  accountType?: unknown;
  timeZone?: unknown;
  companyCurrency?: unknown;
  uiDomain?: unknown;
};

type SearchResponse = { total?: unknown };

function extractHubspotError(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { message?: unknown; errors?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
    if (Array.isArray(parsed.errors)) {
      const first = parsed.errors[0] as { message?: unknown } | undefined;
      if (first && typeof first.message === "string") return first.message;
    }
  } catch {
    /* non-JSON body — fall through to the HTTP status text */
  }
  const trimmed = payload.trim();
  return trimmed ? trimmed.slice(0, 400) : null;
}

export async function hubspotFetchJson<T>(req: {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  /** Events API calls use the dedicated events token when one is set. */
  useEventsToken?: boolean;
}): Promise<T> {
  const token = req.useEventsToken ? hubspotEventsToken() : hubspotToken();
  if (!token) throw new IntegrationError("HUBSPOT_TOKEN is not set.");

  let res: Response | null = null;
  let text = "";
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    if (req.path.includes("/search")) await throttleSearch();
    res = await fetch(`${API_BASE}${req.path}`, {
      method: req.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: req.signal,
      cache: "no-store",
    });
    text = await res.text();
    if (res.status !== 429 || attempt === RETRY_ATTEMPTS) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1100 * attempt;
    await new Promise((r) => setTimeout(r, delay));
  }
  if (!res) throw new IntegrationError("HubSpot: no response.");
  if (!res.ok) {
    throw new IntegrationError(
      `HubSpot: ${extractHubspotError(text) ?? res.statusText}`,
      res.status,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new IntegrationError("HubSpot: upstream returned a non-JSON response.", res.status);
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function total(res: SearchResponse): number | null {
  return typeof res.total === "number" && Number.isFinite(res.total) ? res.total : null;
}

/** Proves the token works and reports which portal it belongs to. */
export async function fetchHubspotAccount(signal?: AbortSignal): Promise<HubspotAccount> {
  const res = await hubspotFetchJson<AccountResponse>({
    path: "/account-info/v3/details",
    signal,
  });

  return {
    portalId: typeof res.portalId === "number" ? res.portalId : null,
    accountType: str(res.accountType),
    timeZone: str(res.timeZone),
    companyCurrency: str(res.companyCurrency),
    uiDomain: str(res.uiDomain),
  };
}

export async function searchTotal(
  object: "contacts" | "companies",
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await hubspotFetchJson<SearchResponse>({
    path: `/crm/v3/objects/${object}/search`,
    method: "POST",
    body: { ...body, limit: 1, properties: [] },
    signal,
  });
  return total(res);
}

export async function fetchHubspotSummary(params: {
  days?: number;
  signal?: AbortSignal;
}): Promise<HubspotSummary> {
  const requested = Number.isFinite(params.days)
    ? Math.floor(params.days as number)
    : DEFAULT_RECENT_DAYS;
  const days = Math.min(Math.max(requested, 1), MAX_RECENT_DAYS);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  // Sequential: the CRM search endpoint throttles hard (~4 requests/second per
  // token) and a burst here would surface as a 429 in the UI.
  const contacts = await searchTotal("contacts", { filterGroups: [] }, params.signal);
  const companies = await searchTotal("companies", { filterGroups: [] }, params.signal);
  const newContacts = await searchTotal(
    "contacts",
    {
      filterGroups: [
        {
          filters: [
            { propertyName: "createdate", operator: "GTE", value: String(sinceMs) },
          ],
        },
      ],
    },
    params.signal,
  );

  return {
    contacts,
    companies,
    newContacts,
    days,
    since: new Date(sinceMs).toISOString(),
  };
}

export type HubspotWeek = { start: string; end: string; newContacts: number | null; newCompanies: number | null };

export type HubspotWeekly = { weeks: HubspotWeek[]; weeksRequested: number };

const DEFAULT_WEEKS = 8;
const MAX_WEEKS = 26;

/**
 * New contacts and companies per ISO week, most recent last. Two search calls
 * per week, run sequentially because the CRM search endpoint throttles hard;
 * eight weeks is sixteen calls and a few seconds, which is why the trend is
 * its own request rather than part of the summary.
 */
export async function fetchHubspotWeekly(params: {
  weeks?: number;
  /** Inclusive ISO window; when given, buckets end at `to` and the count of
   *  weeks follows the window length, so the trend tracks the picker. */
  from?: string;
  to?: string;
  signal?: AbortSignal;
}): Promise<HubspotWeekly> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  let anchor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let derived = Number.isFinite(params.weeks) ? Math.floor(params.weeks as number) : DEFAULT_WEEKS;
  if (params.from && params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.from) && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
    const startMs = Date.UTC(Number(params.from.slice(0, 4)), Number(params.from.slice(5, 7)) - 1, Number(params.from.slice(8, 10)));
    const endMs = Date.UTC(Number(params.to.slice(0, 4)), Number(params.to.slice(5, 7)) - 1, Number(params.to.slice(8, 10))) + dayMs;
    anchor = endMs;
    derived = Math.ceil((endMs - startMs) / (7 * dayMs));
  }
  const weeks = Math.min(Math.max(derived, 1), MAX_WEEKS);
  const todayStart = anchor;

  const out: HubspotWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = todayStart - i * 7 * dayMs;
    const start = end - 7 * dayMs;
    const between = (property: string) => ({
      filterGroups: [
        {
          filters: [
            { propertyName: property, operator: "GTE", value: String(start) },
            { propertyName: property, operator: "LT", value: String(end) },
          ],
        },
      ],
    });
    const newContacts = await searchTotal("contacts", between("createdate"), params.signal);
    const newCompanies = await searchTotal("companies", between("createdate"), params.signal);
    out.push({
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end - dayMs).toISOString().slice(0, 10),
      newContacts,
      newCompanies,
    });
  }
  return { weeks: out, weeksRequested: weeks };
}
