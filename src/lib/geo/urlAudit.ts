// Extracted from the route module: Next.js only permits route handlers and a
// fixed set of config exports from a route file, so shared helpers live here.

import { type GeoAuditResult } from "@/lib/geo/audit";
import { checkUrlShape } from "@/lib/geo/netGuard";

/** Stop reading a response past this size — a page, not a download. */
export const MAX_HTML_BYTES = 3 * 1024 * 1024;

export const ALLOWED_HOSTS = ["apsoparts.com", "angst-pfister.com"] as const;

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

export type UrlPolicy = {
  /**
   * "own-sites" keeps the original allowlist: only our own domains, which is
   * what the live-page audit wants. "public" permits any public host and is
   * used by the competitor comparison — the private/loopback/link-local
   * refusal in `netGuard` is what makes that safe, and it still applies to
   * "own-sites" too.
   */
  scope: "own-sites" | "public";
};

export function validateAuditUrl(raw: string, policy: UrlPolicy = { scope: "own-sites" }): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Enter a URL to audit." };

  let parsed: URL;
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }

  // Scheme, credentials and port are judged by one shared rule set so the
  // competitor route cannot drift away from the live-page route.
  const shape = checkUrlShape(parsed);
  if (!shape.ok) return { ok: false, error: shape.error };

  if (policy.scope === "own-sites" && !isAllowedHost(parsed.hostname)) {
    return {
      ok: false,
      error: `Only pages on ${ALLOWED_HOSTS.join(" and ")} (and their subdomains) can be audited from here.`,
    };
  }
  return { ok: true, url: parsed };
}

/* ────────────────────────── HTML → auditable text ─────────────────────────── */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
  eacute: "é",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  times: "×",
  middot: "·",
  euro: "€",
  minus: "−",
  plusmn: "±",
  frac12: "½",
  sup2: "²",
  sup3: "³",
  micro: "µ",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
  shy: "",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Turns a published page into the markdown-ish text the auditor understands:
 * headings become "## …", list items become "- …", block elements become
 * paragraph breaks. Nothing is invented — only tags are removed.
 */
export function htmlToAuditText(html: string): string {
  let s = html;
  // <head> holds the <title> and meta content, which is not body copy — left in,
  // it would be read as the page's opening paragraph and audited as the answer.
  s = s.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, " ");
  // Non-prose subtrees, including their content.
  s = s.replace(/<(script|style|noscript|svg|template|iframe|form|select)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Chrome that would otherwise dominate the word counts.
  s = s.replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  s = s.replace(/<h([1-6])\b[^>]*>/gi, (_m, level: string) => `\n\n${"#".repeat(Number(level))} `);
  s = s.replace(/<\/h[1-6]>/gi, "\n\n");
  // One newline per item so the list stays one block: a blank line between two
  // items would split it into separate one-line "lists".
  s = s.replace(/<\/li\s*>\s*<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\/li\s*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|section|article|tr|ul|ol|table|blockquote|dd|dt)>/gi, "\n\n");
  s = s.replace(/<\/(td|th)>/gi, " | ");
  s = s.replace(/<[^>]+>/g, " ");

  s = decodeEntities(s);
  s = s.replace(/[ \t ]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function extractTitle(html: string): string | null {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const title = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  return title.length ? title : null;
}

/**
 * Reports the date signals the *page* carries, separate from the copy: a
 * <time> element, an article:published_time/modified meta, or a visible date.
 */
export function extractPageDates(html: string, text: string): { machineDates: string[]; visibleDate: string | null } {
  const machine: string[] = [];
  const timeAttr = /<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = timeAttr.exec(html)) !== null) machine.push(m[1].trim());

  const metaRe =
    /<meta\b[^>]*\b(?:property|name)\s*=\s*["'](article:published_time|article:modified_time|datePublished|dateModified|date)["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/gi;
  while ((m = metaRe.exec(html)) !== null) machine.push(`${m[1]}=${m[2].trim()}`);

  const visible =
    /\b(?:\d{4}-\d{2}-\d{2}|[0-3]?\d[./][01]?\d[./]20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[0-3]?\d?,?\s*20\d{2})\b/.exec(
      text
    );

  return { machineDates: Array.from(new Set(machine)).slice(0, 6), visibleDate: visible ? visible[0] : null };
}

export async function readCapped(res: Response): Promise<string> {
  const declared = Number.parseInt(res.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
    throw new Error(`Page is ${Math.round(declared / 1024)} kB — larger than the ${MAX_HTML_BYTES / 1024 / 1024} MB audit limit.`);
  }
  const text = await res.text();
  return text.length > MAX_HTML_BYTES ? text.slice(0, MAX_HTML_BYTES) : text;
}

/** One fetched-and-scored page. Shared by the live audit and the comparison. */
export type GeoPageAuditData = {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  words: number;
  audit: GeoAuditResult;
  page: {
    schemaTypes: string[];
    hasFaqPageSchema: boolean;
    hasArticleSchema: boolean;
    hasJsonLdBlock: boolean;
    machineDates: string[];
    visibleDate: string | null;
  };
};

export type GeoUrlAuditResponse = {
  ok: true;
  data: GeoPageAuditData;
};
