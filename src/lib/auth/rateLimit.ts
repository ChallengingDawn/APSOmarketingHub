// Lightweight in-process rate limiter for auth endpoints. Railway runs a
// single instance per service so a process-local Map is enough; if we ever
// scale horizontally this must move to Redis. Failed attempts only — successes
// reset the counter so legitimate users are never locked out by their own
// past typos.

type Bucket = { count: number; firstAt: number; blockedUntil: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;          // 15 minutes
const MAX_FAILS = 8;                        // 8 wrong tries / 15 min
const BLOCK_MS = 15 * 60 * 1000;            // then 15-min cool-down
const PURGE_AFTER_MS = 60 * 60 * 1000;

function purge(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) {
    if (now - v.firstAt > PURGE_AFTER_MS && now > v.blockedUntil) buckets.delete(k);
  }
}

export function clientKey(req: Request, scope: string): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}

export function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  purge(now);
  const b = buckets.get(key);
  if (b && b.blockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { ok: true };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.firstAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  b.count += 1;
  if (b.count >= MAX_FAILS) b.blockedUntil = now + BLOCK_MS;
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
