// Goes and reads our own locale homepages, and reports which ones Google
// cannot cluster. The rule it applies lives in @/lib/seo/hreflang; this file
// is only the fetching, the caching and the refusal to guess.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { fetchPageHtml } from "@/lib/geo/fetchPage";
import {
  LOCALE_HOMEPAGES, checkLocale, homepageUrl, verdictOf, type LocaleCheck,
} from "@/lib/seo/hreflang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORIGIN = "https://www.apsoparts.com";
const PER_PAGE_TIMEOUT_MS = 20_000;
// Fourteen pages fetched on every load would be rude to our own shop and slow
// for the reader. hreflang changes when somebody deploys the shop, not hourly.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_KEY = "seo:hreflang-homepages";

type Cached = { at: string; checks: LocaleCheck[] };

async function readCache(): Promise<Cached | null> {
  await ensureSchema();
  const r = await query<{ v: Cached }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [CACHE_KEY]);
  return r.rows[0]?.v ?? null;
}

async function writeCache(value: Cached): Promise<void> {
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [CACHE_KEY, JSON.stringify(value)],
  );
}

/**
 * One homepage, read through the GEO auditor's fetcher rather than a fetch of
 * our own.
 *
 * The first version here did hand-roll it, and all fourteen pages came back
 * "terminated" — because apsoparts.com serves a malformed chunked body that
 * Node's strict HTTP parser refuses, and because an unread redirect body
 * poisons the next request to the same origin. fetchPageHtml already solves
 * both, having met them on this same site.
 *
 * A page we could not read is reported as unreadable, never as a fault. "The
 * shop was restarting" and "this page is missing from the cluster" lead to
 * completely different afternoons.
 */
async function readPage(locale: string): Promise<LocaleCheck> {
  const url = homepageUrl(ORIGIN, locale);
  const res = await fetchPageHtml(url, { scope: "own-sites" }, PER_PAGE_TIMEOUT_MS);
  return res.ok ? checkLocale(locale, url, res.html, null) : checkLocale(locale, url, null, res.error);
}

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("refresh") === "1";

  if (!force) {
    const cached = await readCache().catch(() => null);
    if (cached && Date.now() - new Date(cached.at).getTime() < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, cached: true, at: cached.at, ...verdictOf(cached.checks) });
    }
  }

  // Sequential, not Promise.all. Fourteen at once is a burst at our own shop
  // from one IP, which is the shape a WAF is built to stop, and the hop-to-hop
  // connection reuse these fetches depend on does not survive it.
  const checks: LocaleCheck[] = [];
  for (const locale of LOCALE_HOMEPAGES) checks.push(await readPage(locale));
  const at = new Date().toISOString();
  await writeCache({ at, checks }).catch(() => {});

  return NextResponse.json({ ok: true, cached: false, at, ...verdictOf(checks) });
}
