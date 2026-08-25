/**
 * Address safety for every outbound fetch the GEO cockpit makes.
 *
 * ─────────────────────────── THE RISK THIS EXISTS TO STOP ───────────────────
 * The competitor comparison has to fetch an arbitrary URL typed by a user. A
 * server-side fetcher that accepts arbitrary URLs is a Server-Side Request
 * Forgery (SSRF) primitive: the request leaves *our* host, from *inside* our
 * network, carrying our source address. An attacker who can choose the URL can
 * therefore reach things the public internet cannot —
 *
 *   • http://169.254.169.254/…      cloud instance metadata → IAM credentials
 *   • http://127.0.0.1:5432 / :6379 loopback databases, admin panels, /metrics
 *   • http://10.x / 172.16.x / 192.168.x   private VPC neighbours
 *   • http://[::1] / [fd00::…]      the same, over IPv6
 *   • file: / gopher: / ftp:        non-HTTP schemes that read local resources
 *   • http://user:pass@host         credentials smuggled into the request
 *
 * …and can then read the response back out through the audit UI. So the URL is
 * not merely pattern-matched: the hostname is RESOLVED and every returned
 * address is classified, and the same check is re-run on every redirect hop —
 * a public host is free to answer "302 → http://169.254.169.254/", and a
 * fetcher that follows redirects blindly hands over the metadata service.
 *
 * Residual risk, stated honestly rather than papered over: this validates the
 * addresses a hostname resolves to immediately before connecting, but Node's
 * fetch resolves the name again itself, so a DNS entry that flips between the
 * two lookups (DNS rebinding) is not closed by this layer. Closing it requires
 * pinning the validated IP into the socket via a custom dispatcher, which is
 * out of scope here; the port allowlist below (80/443 only) removes most of
 * what rebinding would otherwise be worth reaching.
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/** Only the two ports a public web page is served on. Everything internal —
 *  databases, admin consoles, metrics endpoints — lives somewhere else. */
export const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Redirect hops followed before giving up. Each hop is re-validated. */
export const MAX_REDIRECTS = 4;

export type AddressVerdict = { blocked: false } | { blocked: true; reason: string };

/* ──────────────────────────── address classification ──────────────────────── */

function ipv4ToBytes(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number.parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

/** Expands any IPv6 literal (including "::" and embedded IPv4) to 16 bytes. */
function ipv6ToBytes(ip: string): number[] | null {
  let value = ip.trim();
  // Zone identifiers ("fe80::1%eth0") are stripped before parsing.
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);

  // An embedded IPv4 tail ("::ffff:169.254.169.254") is peeled off and parsed as
  // four bytes; what remains is a six-group IPv6 prefix.
  let tail: number[] = [];
  const lastColon = value.lastIndexOf(":");
  const afterLastColon = lastColon >= 0 ? value.slice(lastColon + 1) : "";
  if (afterLastColon.includes(".")) {
    const v4 = ipv4ToBytes(afterLastColon);
    if (!v4) return null;
    tail = v4;
    const prefix = value.slice(0, lastColon + 1);
    // Keep a trailing "::" (it is the compression marker); drop a lone ":".
    value = prefix.endsWith("::") ? prefix : prefix.slice(0, -1);
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const toGroups = (segment: string): number[] | null => {
    if (!segment) return [];
    const out: number[] = [];
    for (const group of segment.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
      out.push(Number.parseInt(group, 16));
    }
    return out;
  };

  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || rest === null) return null;

  const groupsNeeded = tail.length ? 6 : 8;
  let groups: number[];
  if (halves.length === 2) {
    const fill = groupsNeeded - head.length - rest.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array<number>(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== groupsNeeded) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    bytes.push((g >> 8) & 0xff, g & 0xff);
  }
  return [...bytes, ...tail];
}

function classifyIpv4(b: number[]): AddressVerdict {
  const [a, second] = b;
  if (a === 0) return { blocked: true, reason: "0.0.0.0/8 (this network)" };
  if (a === 127) return { blocked: true, reason: "127.0.0.0/8 (loopback)" };
  if (a === 10) return { blocked: true, reason: "10.0.0.0/8 (private)" };
  if (a === 172 && second >= 16 && second <= 31) return { blocked: true, reason: "172.16.0.0/12 (private)" };
  if (a === 192 && second === 168) return { blocked: true, reason: "192.168.0.0/16 (private)" };
  if (a === 169 && second === 254) {
    return { blocked: true, reason: "169.254.0.0/16 (link-local, incl. 169.254.169.254 cloud metadata)" };
  }
  if (a === 100 && second >= 64 && second <= 127) return { blocked: true, reason: "100.64.0.0/10 (carrier NAT)" };
  if (a === 192 && second === 0) return { blocked: true, reason: "192.0.0.0/24 (IETF protocol assignments)" };
  if (a >= 224) return { blocked: true, reason: `${a}.0.0.0/4 (multicast or reserved)` };
  return { blocked: false };
}

/**
 * True when an address must never be connected to from the server.
 * Exported so the rule set can be exercised directly.
 */
export function classifyAddress(ip: string): AddressVerdict {
  const family = isIP(ip);

  if (family === 4) {
    const bytes = ipv4ToBytes(ip);
    return bytes ? classifyIpv4(bytes) : { blocked: true, reason: "unparseable IPv4 address" };
  }

  if (family === 6) {
    const bytes = ipv6ToBytes(ip);
    if (!bytes) return { blocked: true, reason: "unparseable IPv6 address" };

    if (bytes.every((x) => x === 0)) return { blocked: true, reason: ":: (unspecified)" };
    if (bytes.slice(0, 15).every((x) => x === 0) && bytes[15] === 1) {
      return { blocked: true, reason: "::1 (loopback)" };
    }

    // IPv4-mapped (::ffff:a.b.c.d) and the deprecated IPv4-compatible (::a.b.c.d)
    // forms reach the IPv4 stack, so they are judged by the IPv4 rules above —
    // otherwise "::ffff:169.254.169.254" walks straight past every IPv6 rule.
    const isV4Mapped =
      bytes.slice(0, 10).every((x) => x === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    const isV4Compatible = bytes.slice(0, 12).every((x) => x === 0);
    if (isV4Mapped || isV4Compatible) return classifyIpv4(bytes.slice(12));
    if ((bytes[0] & 0xfe) === 0xfc) return { blocked: true, reason: "fc00::/7 (unique local)" };
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) {
      return { blocked: true, reason: "fe80::/10 (link-local)" };
    }
    if (bytes[0] === 0xff) return { blocked: true, reason: "ff00::/8 (multicast)" };
    return { blocked: false };
  }

  return { blocked: true, reason: "not an IP address" };
}

/* ─────────────────────────────── host resolution ──────────────────────────── */

export type HostCheck = { ok: true; addresses: string[] } | { ok: false; error: string };

/**
 * Resolves a hostname and refuses it if ANY returned address is non-public.
 *
 * "Any", not "the first": a name that resolves to one public and one private
 * address is an attack, and which one the connection picks is not ours to
 * choose. An IP literal is classified without a lookup.
 */
export async function assertPublicHost(hostname: string): Promise<HostCheck> {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return { ok: false, error: "That URL has no hostname." };

  if (isIP(host)) {
    const verdict = classifyAddress(host);
    return verdict.blocked
      ? { ok: false, error: `That address is inside ${verdict.reason} and cannot be fetched from the server.` }
      : { ok: true, addresses: [host] };
  }

  // A bare label ("localhost", "intranet") has no public DNS meaning and is the
  // classic way to reach the loopback interface.
  if (!host.includes(".")) {
    return { ok: false, error: `"${host}" is not a public domain name.` };
  }

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    return { ok: false, error: `"${host}" could not be resolved — no DNS answer.` };
  }
  if (!records.length) return { ok: false, error: `"${host}" resolved to no addresses.` };

  for (const record of records) {
    const verdict = classifyAddress(record.address);
    if (verdict.blocked) {
      return {
        ok: false,
        error: `"${host}" resolves to ${record.address}, inside ${verdict.reason}. Fetching it would let this page reach a private service, so it is refused.`,
      };
    }
  }
  return { ok: true, addresses: records.map((r) => r.address) };
}

/** Rejects the shapes that are wrong before a lookup is even worth doing. */
export function checkUrlShape(url: URL): { ok: true } | { ok: false; error: string } {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: `Only http and https URLs can be fetched — "${url.protocol}" is refused.` };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs carrying credentials are not accepted." };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, error: `Port ${url.port} is not a public web port — only 80 and 443 can be fetched.` };
  }
  return { ok: true };
}
