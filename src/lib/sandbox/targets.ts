// WHICH SANDBOX AN ADDRESS IS - the hub's SANDBOX_URLS names each sandbox's relay on Railway; the relay runs under
// /sandbox/run/<name> (Next basePath, a build arg), and the hub calls it there. People never open the relay: their
// sandbox runs on their own computer (`npm run sbx -- dev`) and pulls its coded data from the relay (SARCLA
// 28.10.2026: "the data outside, ideally in Railway, a port where they can pull the data to localhost").
//
// Pure: the hub and the release scripts use it, the tests pin it.

export type Target = { slug: string; origin: string; basePath: string; base: string };

/**
 * One SANDBOX_URLS entry. With a path, that path is the relay's base path; without one it is /sandbox/run/<name>, the
 * name being its Railway host without the word "sandbox" (sandbox-diana-fehr-sandbox.up.railway.app -> diana-fehr).
 */
export function targetOf(raw: string): Target | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return null;
  const path = u.pathname.replace(/\/+$/, "");
  const slug = path
    ? path.split("/").pop()!
    : u.hostname.split(".")[0].split("-").filter((w) => w && w !== "sandbox").join("-");
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug)) return null;
  const basePath = path || `/sandbox/run/${slug}`;
  if (!/^\/sandbox\/run\/[a-z0-9-]+$/.test(basePath)) return null;
  return { slug, origin: u.origin, basePath, base: `${u.origin}${basePath}` };
}
