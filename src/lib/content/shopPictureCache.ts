// THE SHOP'S PICTURES, KEPT ONCE FETCHED (09.11.2026). The studios show the shop's own photos through the hub
// (/api/content/studio/banner/picture); every request went to the shop again, and on a busy hub or a slow shop one took
// up to a minute - long enough for a post's photo to stay an empty frame (the lead's report: a spotlight post "no longer
// shows its picture"). A picture fetched once is kept here, in memory, for half a day; the oldest go first past 200
// pictures or 40 MB. Pure: tests/studio-social-canvas.test.ts.

export type Kept = { bytes: Uint8Array; type: string; at: number };

export function pictureCache(o: { maxItems?: number; maxBytes?: number; ttlMs?: number; now?: () => number } = {}) {
  const maxItems = o.maxItems ?? 200;
  const maxBytes = o.maxBytes ?? 40 * 1024 * 1024;
  const ttl = o.ttlMs ?? 12 * 3600 * 1000;
  const now = o.now ?? Date.now;
  const map = new Map<string, Kept>();
  let total = 0;
  const drop = (k: string) => { const v = map.get(k); if (v) { total -= v.bytes.length; map.delete(k); } };
  return {
    get(url: string): Kept | null {
      const v = map.get(url);
      if (!v) return null;
      if (now() - v.at > ttl) { drop(url); return null; }
      // the most recently used last: the oldest go first
      map.delete(url);
      map.set(url, v);
      return v;
    },
    put(url: string, bytes: Uint8Array, type: string) {
      if (bytes.length > maxBytes) return;
      drop(url);
      map.set(url, { bytes, type, at: now() });
      total += bytes.length;
      for (const k of map.keys()) {
        if (map.size <= maxItems && total <= maxBytes) break;
        drop(k);
      }
    },
    get size() { return map.size; },
    get bytes() { return total; },
  };
}

/** The hub's one cache of shop pictures (one per server process). */
export const shopPictures = pictureCache();
