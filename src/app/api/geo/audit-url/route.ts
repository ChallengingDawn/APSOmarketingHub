import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/guard";
import {
  auditGeoReadiness,
  detectSchemaTypes,
  hasArticleSchema,
  hasFaqPageSchema,
  type GeoAuditResult,
} from "@/lib/geo/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  ALLOWED_HOSTS,
  validateAuditUrl,
  htmlToAuditText,
  readCapped,
  extractPageDates,
  extractTitle,
  type GeoUrlAuditResponse,
} from "@/lib/geo/urlAudit";

/** Same ceiling the integration routes use for an upstream call. */
const TIMEOUT_MS = 15_000;


export async function POST(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  const checked = validateAuditUrl(rawUrl.slice(0, 2048));
  if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(checked.url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify the crawler honestly; some edges reject an empty UA.
        "user-agent": "APSOmarketingHub-GEO-Audit/1.0 (+https://apsoparts.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `The page responded ${res.status} ${res.statusText}. Nothing was audited.`,
        status: res.status,
      });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return NextResponse.json({
        ok: false,
        error: `That URL returned "${contentType.split(";")[0]}" — only HTML pages can be audited.`,
      });
    }

    const html = await readCapped(res);
    const text = htmlToAuditText(html);
    const audit = auditGeoReadiness(text, { html });
    const schemaTypes = detectSchemaTypes(html);
    const dates = extractPageDates(html, text);

    const payload: GeoUrlAuditResponse = {
      ok: true,
      data: {
        url: checked.url.toString(),
        finalUrl: res.url || checked.url.toString(),
        status: res.status,
        title: extractTitle(html),
        words: audit.stats.words,
        audit,
        page: {
          schemaTypes,
          hasFaqPageSchema: hasFaqPageSchema(schemaTypes),
          hasArticleSchema: hasArticleSchema(schemaTypes),
          hasJsonLdBlock: /application\/ld\+json/i.test(html),
          machineDates: dates.machineDates,
          visibleDate: dates.visibleDate,
        },
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError" || err.name === "TimeoutError"
          ? `The page did not respond within ${TIMEOUT_MS / 1000} s.`
          : err.message
        : "The page could not be fetched.";
    return NextResponse.json({ ok: false, error: message });
  } finally {
    clearTimeout(timer);
  }
}
