// Goes and reads our own locale homepages, and reports which ones Google
// cannot cluster. The rule it applies lives in @/lib/seo/hreflang; this file
// is only the fetching, the caching and the refusal to guess.

import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
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

async function readPage(locale: string): Promise<LocaleCheck> {
  const url = homepageUrl(ORIGIN, locale);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "APSOmarketingHub/1.0 (+hreflang self-check)" },
    });
    if (!res.ok) return checkLocale(locale, url, null, `HTTP ${res.status}`);
    return checkLocale(locale, url, await res.text(), null);
  } catch (e) {
    // A page we could not read is reported as unreadable, never as a fault.
    // "The shop was restarting" and "this page is missing from the cluster"
    // lead to completely different afternoons.
    const why = e instanceof Error && e.name === "AbortError" ? "Timed out" : e instanceof Error ? e.message : "Failed";
    return checkLocale(locale, url, null, why);
  } finally {
    clearTimeout(timer);
  }
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

  const checks = await Promise.all(LOCALE_HOMEPAGES.map(readPage));
  const at = new Date().toISOString();
  await writeCache({ at, checks }).catch(() => {});

  return NextResponse.json({ ok: true, cached: false, at, ...verdictOf(checks) });
}
