// Reject requests with bodies larger than `limit` bytes before we even buffer
// them. Without this guard a single authenticated user could OOM the Node
// process by POSTing a multi-hundred-MB JSON blob (Next.js App Router has no
// built-in body limit on Route Handlers).

export function tooLarge(req: Request, limit: number): boolean {
  const raw = req.headers.get('content-length');
  if (!raw) return false;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > limit;
}

export const BODY_LIMIT_SMALL = 64 * 1024;        // 64 KB — text-only routes
export const BODY_LIMIT_MEDIUM = 512 * 1024;      // 512 KB — brain JSON, logs
export const BODY_LIMIT_LARGE = 8 * 1024 * 1024;  // 8 MB — image reference uploads
