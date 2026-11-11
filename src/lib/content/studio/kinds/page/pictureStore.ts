// PAGE - ITS PICTURES INTO THE HUB'S PICTURE STORAGE (server, 11.11.2026). SARCLA: "I can't copy-paste each new picture to
// Magento". With the storage on (./contentMedia.ts) a page's own pictures are named at <base>/content/<file>; here each
// is read (a HEAD of its object) and, when it is not stored yet, stored - its bytes from the hub's picture store
// (lib/content/assets.ts), its type, a year's immutable caching. A file's name never changes for the same picture, so a
// stored one is never stored again.

import { assetBytes, pictureRef } from "@/lib/content/assets";
import { s3Has, s3Put, type S3Target } from "@/lib/aws/s3";
import { CACHE_CONTROL, CONTENT_MEDIA, contentKey, contentTypeOf } from "./contentMedia";
import type { MediaFile, PictureCheck } from "./media";

const target = (file: string): S3Target => ({ bucket: CONTENT_MEDIA.bucket, region: CONTENT_MEDIA.region, key: contentKey(file) });

// a stored file stays stored (its name is the picture's): read once per process
const STORED = new Set<string>();
const remember = (file: string) => { STORED.add(file); while (STORED.size > 2000) STORED.delete(STORED.values().next().value as string); };

/** Each picture in the storage: stored ("there"), to be stored on Publish ("missing"), or not read ("unknown"). */
export async function storedStates(files: readonly MediaFile[]): Promise<PictureCheck[]> {
  const out: PictureCheck[] = [];
  for (const f of files) {
    const address = f.address ?? "";
    if (STORED.has(f.file)) { out.push({ ...f, address, state: "there" }); continue; }
    try {
      const has = await s3Has(target(f.file));
      if (has) remember(f.file);
      out.push({ ...f, address, state: has ? "there" : "missing" });
    } catch {
      out.push({ ...f, address, state: "unknown" });
    }
  }
  return out;
}

export type StoreOut = { stored: string[]; had: string[]; failed: { file: string; why: string }[] };

/** Each picture stored when it is not yet: a HEAD, then a PUT of the hub's bytes. Never throws - `failed` says. */
export async function storePictures(files: readonly MediaFile[]): Promise<StoreOut> {
  const out: StoreOut = { stored: [], had: [], failed: [] };
  const seen = new Set<string>();
  for (const f of files) {
    if (seen.has(f.file)) continue;
    seen.add(f.file);
    if (STORED.has(f.file)) { out.had.push(f.file); continue; }
    try {
      if (await s3Has(target(f.file))) { remember(f.file); out.had.push(f.file); continue; }
      const ref = pictureRef(f.url);
      const bytes = ref ? await assetBytes(ref.id, ref.key) : null;
      if (!bytes) { out.failed.push({ file: f.file, why: "the picture is not in the hub any more" }); continue; }
      await s3Put(target(f.file), bytes.data, bytes.mime || contentTypeOf(f.file), CACHE_CONTROL);
      remember(f.file);
      out.stored.push(f.file);
    } catch (e) {
      out.failed.push({ file: f.file, why: (e as Error).message || "no answer" });
    }
  }
  return out;
}

/** The plain line a refused Publish says when a picture could not be stored. */
export function storeFailed(out: StoreOut): string | null {
  if (!out.failed.length) return null;
  const n = out.failed.length;
  const list = out.failed.slice(0, 3).map((x) => `${x.file}: ${x.why}`).join("; ");
  return `${n === 1 ? "A picture" : `${n} pictures`} of the page could not be stored in the hub's picture storage (${list}) - nothing was written to Magento. Try Publish again in a moment.`;
}
