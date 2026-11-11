// PAGE - ITS PICTURES IN MAGENTO'S MEDIA (10.11.2026). Pure: tests/studio-page-frame.test.ts.
//
// SARCLA's Kalrez page on ACC showed Magento's grey "APSOparts - the Online Shop of Angst+Pfister" in its hero: the content
// pointed to wysiwyg/content/apx-199.jpg, a picture the hub keeps and nobody had put into Magento's media. The last step
// said so in one easy-to-miss line, and nothing checked it. Magento answers a missing media file with that placeholder -
// status 200, image/jpeg, 261,451 bytes, on ACC and on production alike (read 10.11.2026), never a 404 - so a check must
// know the placeholder's answer. Now:
//   - every picture address in the page is absolute, as the home page kit writes them (absolute_media): the shop's own
//     pictures on www (ACC lacks many of the shop's media files), the hub's pictures at their file in the TARGET's media
//     (<shop>/media/wysiwyg/content/apx-<id>.<ext>) - the address the check reads is the address the page shows;
//   - before Publish the hub reads each hub picture's address on the target (a HEAD, ./shop.ts): one that answers with the
//     placeholder is missing - the last step lists it and holds Publish, with the pictures to download (one zip), the
//     Media Gallery's steps and "Read Magento again".

/** A picture kept in the hub, as a page names it (lib/content/assets.ts: public, no cookie). */
const HUB_PICTURE = /\/api\/content\/picture\/(\d{1,12})-[A-Za-z0-9_-]{4,40}/g;

/** The hub's pictures a page's HTML names, each once, in order: [path, its id]. */
export function hubPicturesIn(html: string): { url: string; id: number }[] {
  const out: { url: string; id: number }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(HUB_PICTURE)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({ url: m[0], id: Number(m[1]) });
  }
  return out;
}

/** Where the hub's pictures go in Magento's media. */
export const MEDIA_FOLDER = "wysiwyg/content";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
/** A hub picture's file name in Magento's media: apx-<id>.<ext> (its type's extension, jpg when unknown). */
export const mediaFileOf = (id: number, mime?: string | null) => `apx-${id}.${EXT[mime ?? ""] ?? "jpg"}`;
/** A file's address in a shop's media (`base`: https://acc.apsoparts.com or https://www.apsoparts.com). */
export const mediaAddress = (base: string, file: string) => `${base.replace(/\/+$/, "")}/media/${MEDIA_FOLDER}/${file}`;

/** The shop's own media, for the pictures that are the shop's (the kit's MEDIA_BASE). */
export const SHOP_MEDIA = "https://www.apsoparts.com/media/";

export type MediaFile = { file: string; url: string };

/**
 * The page's HTML with every picture address absolute (the home page kit's absolute_media): a Magento media directive
 * ({{media url="..."}}) is the shop's own picture on www; a hub picture is its file in the target's media. `files`: each hub
 * picture's file (by its path) - one the hub could not name keeps its path, and the check says so.
 */
export function withMediaAddresses(html: string, files: ReadonlyMap<string, MediaFile>, base: string): string {
  return html
    .replace(/\{\{\s*media\s+url=(?:&quot;|["'])([^"'&{}]+)(?:&quot;|["'])\s*\}\}/g, (_all, path: string) => SHOP_MEDIA + path.replace(/^\/+/, ""))
    .replace(HUB_PICTURE, (u) => { const f = files.get(u); return f ? mediaAddress(base, f.file) : u; });
}

/** Every picture address the page carries (src, srcset, a CSS url()) - for the check that they are all absolute. */
export function pictureAddressesIn(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*?\ssrc="([^"]*)"/gi)) out.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/gi)) for (const part of m[1].split(",")) { const u = part.trim().split(/\s+/)[0]; if (u) out.push(u); }
  for (const m of html.matchAll(/url\(\s*(?:&quot;|["'])?([^"')&]+)(?:&quot;|["'])?\s*\)/gi)) if (!m[1].startsWith("data:")) out.push(m[1]);
  return out;
}

/* ── is it in Magento's media? ─────────────────────────────────────────── */

/** What a HEAD of a media address answered. */
export type MediaHead = { status: number; type: string; length: number | null; etag: string; modified: string };
export type PictureState = "there" | "missing" | "unknown";

/**
 * Is the file there, from its HEAD and the HEAD of an address that surely is not (`probe`, the placeholder's answer)?
 * Missing: not 200, not a picture, or the placeholder's size without a file's own marks (a file the web server sends
 * itself carries an ETag and its date; the placeholder is made by Magento and carries neither). Unknown: no answer.
 */
export function pictureState(head: MediaHead | null, probe: MediaHead | null): PictureState {
  if (!head || !head.status) return "unknown";
  if (head.status !== 200 || !/^image\//i.test(head.type)) return "missing";
  const own = !!(head.etag || head.modified);
  if (probe && probe.status === 200 && probe.length !== null && head.length === probe.length && !own) return "missing";
  if (!probe && !own) return "unknown";
  return "there";
}

export type PictureCheck = MediaFile & { address: string; state: PictureState };

/** What the last step says of a target's pictures: none missing (null), or the line that holds Publish. */
export function picturesHold(list: readonly PictureCheck[], target: string): string | null {
  const missing = list.filter((p) => p.state !== "there");
  if (!missing.length) return null;
  const gone = missing.filter((p) => p.state === "missing").length;
  const n = missing.length;
  return gone === n
    ? `${n} picture${n === 1 ? " is" : "s are"} not in ${target}'s media yet - the page would show Magento's grey placeholder. Upload ${n === 1 ? "it" : "them"} first.`
    : `${n} picture${n === 1 ? "" : "s"} could not be checked in ${target}'s media - read Magento again.`;
}

/** The Media Gallery's steps, exactly (Magento 2.4, Content > Media Gallery). */
export function mediaGallerySteps(target: string, files: readonly string[]): string[] {
  const n = files.length;
  return [
    `Download the picture${n === 1 ? "" : "s"} below${n > 1 ? " (one zip) and unzip it" : ""} - keep the name${n === 1 ? "" : "s"}: ${files.join(", ")}.`,
    `In Magento's admin of ${target}: Content > Media Gallery.`,
    `In the folders on the left open wysiwyg, then content. No content folder yet: select wysiwyg, Create Folder, name it content.`,
    `Upload Image: pick the file${n === 1 ? "" : "s"} - Magento keeps ${n === 1 ? "its name" : "their names"}.`,
    `Back here: Read Magento again - each picture says "in Magento", and Publish opens.`,
  ];
}
