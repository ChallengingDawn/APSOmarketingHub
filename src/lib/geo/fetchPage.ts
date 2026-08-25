/**
 * Fetches a published page and scores it with the same seven-check auditor the
 * stored library is scored with, so a live page, our page and a competitor's
 * page are always measured on one identical ruler.
 *
 * Lives in lib rather than in the route because a Next.js route file may only
 * export handlers and config, and because two routes share it: the live-page
 * audit (our own domains) and the competitor comparison (any public host).
 *
 * Every network hop goes through `netGuard` — see the SSRF explanation there.
 * Redirects are followed MANUALLY so each hop's host is re-validated: a public
 * page is free to answer "302 → http://169.254.169.254/", and a fetcher that
 * lets undici follow that redirect internally would hand over cloud metadata.
 */

import http from "node:http";
import https from "node:https";
import {
  auditGeoReadiness,
  detectSchemaTypes,
  hasArticleSchema,
  hasFaqPageSchema,
} from "@/lib/geo/audit";
import { assertPublicHost, MAX_REDIRECTS } from "@/lib/geo/netGuard";
import {
  extractPageDates,
  extractTitle,
  htmlToAuditText,
  MAX_HTML_BYTES,
  readCapped,
  validateAuditUrl,
  type GeoPageAuditData,
  type UrlPolicy,
} from "@/lib/geo/urlAudit";

/** Same ceiling the integration routes use for an upstream call. */
export const PAGE_FETCH_TIMEOUT_MS = 15_000;

const USER_AGENT = "APSOmarketingHub-GEO-Audit/1.0 (+https://apsoparts.com)";

export type PageAuditOutcome =
  | { ok: true; data: GeoPageAuditData }
  | { ok: false; error: string; status?: number };

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/* ─────────────────── the malformed-chunked-encoding fallback ──────────────── */

/**
 * True for the family of errors Node's strict HTTP parser raises on a response
 * whose framing is not spec-clean — most often HPE_INVALID_CHUNK_SIZE.
 */
function isHttpParserError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("HPE_")) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Re-reads a page with Node's lenient HTTP parser.
 *
 * Some production sites (apsoparts.com among them) emit chunked bodies that
 * every browser accepts and Node's strict parser rejects outright, so the audit
 * would report "terminated" for a page that is perfectly readable. This is the
 * ONLY situation this function is used in.
 *
 * Why the lenient parser is acceptable here, narrowly: `insecureHTTPParser`
 * matters when the parsed bytes are forwarded on — a proxy that disagrees with
 * the next hop about message boundaries is how request smuggling works. We are
 * the terminal consumer: the body is turned into plain text, scored and thrown
 * away, never relayed and never trusted as a request. The URL was already
 * validated and its address classified before this is reached, the byte cap and
 * the timeout still apply, and redirects are NOT followed here.
 */
function readBodyLeniently(
  url: URL,
  timeoutMs: number
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const transport = url.protocol === "http:" ? http : https;
    let settled = false;
    const finish = (result: { ok: true; html: string } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = transport.request(
      url,
      {
        method: "GET",
        // The single reason this function exists. See the note above.
        insecureHTTPParser: true,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          // No accept-encoding: an identity body needs no decompression step.
          "accept-encoding": "identity",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const encoding = String(res.headers["content-encoding"] ?? "");
        if (encoding && encoding !== "identity") {
          res.destroy();
          finish({ ok: false, error: `The page returned a ${encoding}-compressed body that could not be read.` });
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_HTML_BYTES) {
            res.destroy();
            finish({
              ok: false,
              error: `The page is larger than the ${MAX_HTML_BYTES / 1024 / 1024} MB audit limit.`,
            });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => finish({ ok: true, html: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", (err: Error) => finish({ ok: false, error: err.message }));
        // A destroyed-mid-stream response still counts as read if we already
        // have the bytes: a truncated tail is better than no audit, but it is
        // only accepted when the server closed after sending something.
        res.on("aborted", () => {
          if (chunks.length) finish({ ok: true, html: Buffer.concat(chunks).toString("utf8") });
          else finish({ ok: false, error: "The page closed the connection before sending anything." });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, error: `The page did not respond within ${timeoutMs / 1000} s.` });
    });
    req.on("error", (err: Error) => finish({ ok: false, error: err.message }));
    req.end();
  });
}

/**
 * Fetches one URL under the given policy and returns it scored, or the honest
 * reason it could not be. Never throws for an ordinary failure — an unreachable
 * page is a state the UI renders, not an exception.
 */
export async function auditPageByUrl(
  rawUrl: string,
  policy: UrlPolicy = { scope: "own-sites" }
): Promise<PageAuditOutcome> {
  const checked = validateAuditUrl(rawUrl.slice(0, 2048), policy);
  if (!checked.ok) return { ok: false, error: checked.error };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

  try {
    let current = checked.url;
    let response: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const host = await assertPublicHost(current.hostname);
      if (!host.ok) return { ok: false, error: host.error };

      const res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          // Identify the crawler honestly; some edges reject an empty UA.
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (!REDIRECT_STATUSES.has(res.status)) {
        response = res;
        break;
      }

      // A redirect's body is never read, and an abandoned body leaves the
      // connection half-consumed — the next request to that same origin then
      // fails with "terminated". Cancel it explicitly before the next hop.
      try {
        await res.body?.cancel();
      } catch {
        /* the body may already be closed; nothing to release */
      }

      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, error: `The page answered ${res.status} with no redirect target.`, status: res.status };
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, error: `The page redirected to "${location}", which is not a valid URL.` };
      }
      // The redirect target is judged by the same policy as the typed URL —
      // scheme, credentials, port, host scope — and its host is resolved and
      // classified on the next pass of this loop.
      const revalidated = validateAuditUrl(next.toString(), policy);
      if (!revalidated.ok) {
        return { ok: false, error: `Redirect refused: ${revalidated.error}` };
      }
      current = revalidated.url;

      if (hop === MAX_REDIRECTS) {
        return { ok: false, error: `The page redirected more than ${MAX_REDIRECTS} times.` };
      }
    }

    if (!response) return { ok: false, error: "The page could not be fetched." };

    if (!response.ok) {
      return {
        ok: false,
        error: `The page responded ${response.status} ${response.statusText}. Nothing was audited.`,
        status: response.status,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return {
        ok: false,
        error: `That URL returned "${contentType.split(";")[0]}" — only HTML pages can be audited.`,
      };
    }

    let html: string;
    try {
      html = await readCapped(response);
    } catch (err) {
      // The headers arrived fine and the body framing is what broke. Read it
      // once more with the lenient parser rather than reporting "terminated"
      // for a page every browser renders.
      if (!isHttpParserError(err)) throw err;
      const lenient = await readBodyLeniently(current, PAGE_FETCH_TIMEOUT_MS);
      if (!lenient.ok) {
        return {
          ok: false,
          error: `${lenient.error} (the page's HTTP chunked encoding is malformed, which the strict parser refuses)`,
        };
      }
      html = lenient.html;
    }
    const text = htmlToAuditText(html);
    const audit = auditGeoReadiness(text, { html });
    const schemaTypes = detectSchemaTypes(html);
    const dates = extractPageDates(html, text);

    return {
      ok: true,
      data: {
        url: checked.url.toString(),
        finalUrl: response.url || current.toString(),
        status: response.status,
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
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError" || err.name === "TimeoutError"
          ? `The page did not respond within ${PAGE_FETCH_TIMEOUT_MS / 1000} s.`
          : err.message
        : "The page could not be fetched.";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
