// PAGE - ITS PICTURES IN MAGENTO'S MEDIA (10.11.2026). Pure: tests/studio-page-frame.test.ts.
//
// 11.11.2026 (SARCLA: "I can't copy-paste each new picture to Magento"): with the hub's picture storage on
// (./contentMedia.ts) a hub picture carries its address there - the page names it, Publish stores it, nothing waits.
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

/** A campaign's own photo shipped with the hub (13.11.2026, the Black Friday modules - modules/lib/bf26.ts): a file of
 * public/content/campaign/<campaign>/ - the preview shows it from the hub, Publish stores it in the hub's picture storage
 * at content/campaign/<campaign>/<file> (./pictureStore.ts reads it from the hub's own files). */
// (only a path the page wrote itself: never the same path inside an address already in the storage)
// (13.11.2026: and the Black Friday voucher's engine, a .js of the same folder - ../../../../convert/trustedScripts.ts)
export const CAMPAIGN_PICTURE = /(?<![A-Za-z0-9.:_-])\/content\/campaign\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}\.(?:webp|png|jpg|js)/g;

/** The campaign photos a page's HTML names, each once, in order. */
export function campaignPicturesIn(html: string): string[] {
  return [...new Set([...html.matchAll(CAMPAIGN_PICTURE)].map((m) => m[0]))];
}

/** A campaign photo's file in the hub's picture storage (its path under content/): "campaign/bf26/oring.webp". */
export const campaignFileOf = (url: string) => url.replace(/^\/content\//, "");

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

/**
 * A hub picture as the page names it on the shop: its file, its hub path - and, when the hub's picture storage is on
 * (./contentMedia.ts, 11.11.2026), its public address there (<base>/content/<file>); without one it is the file in the
 * target's Magento media.
 */
export type MediaFile = { file: string; url: string; address?: string };

/** Where a hub picture is shown: its address in the hub's picture storage, else its file in the target's media. */
export const shownAt = (f: MediaFile, base: string) => f.address || mediaAddress(base, f.file);

/**
 * The page's HTML with every picture address absolute (the home page kit's absolute_media): a Magento media directive
 * ({{media url="..."}}) is the shop's own picture on www; a hub picture is its address in the hub's picture storage when it
 * has one, else its file in the target's media. `files`: each hub picture's file (by its path) - one the hub could not
 * name keeps its path, and the check says so.
 */
export function withMediaAddresses(html: string, files: ReadonlyMap<string, MediaFile>, base: string): string {
  return html
    .replace(/\{\{\s*media\s+url=(?:&quot;|["'])([^"'&{}]+)(?:&quot;|["'])\s*\}\}/g, (_all, path: string) => SHOP_MEDIA + path.replace(/^\/+/, ""))
    .replace(HUB_PICTURE, (u) => { const f = files.get(u); return f ? shownAt(f, base) : u; })
    // a campaign's photo: its address in the hub's picture storage (no Magento media for these - see campaignPicturesIn)
    .replace(CAMPAIGN_PICTURE, (u) => { const f = files.get(u); return f?.address ? f.address : u; });
}

/* ── a picture's words, for its file's name in the hub's picture storage (11.11.2026) ── */

const attrOf = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Each hub picture's alt text in the page's HTML (its first <img> with one), by its path. */
export function pictureAltsIn(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attrOf(m[0], "src");
    const path = src ? /\/api\/content\/picture\/\d{1,12}-[A-Za-z0-9_-]{4,40}/.exec(src[2] ?? src[3] ?? "")?.[0] : null;
    if (!path || out.has(path)) continue;
    const alt = attrOf(m[0], "alt");
    const words = unescape(alt ? alt[2] ?? alt[3] ?? "" : "").trim();
    if (words) out.set(path, words);
  }
  return out;
}

/**
 * Each hub picture's words in a page's document (its fields, its modules): the object naming it - its alt text, else its
 * idea, else its title or name (a module's tile) - by its path, the first that has words.
 */
export function pictureWordsOf(value: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 12 || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    const o = v as Record<string, unknown>;
    const said = ["alt", "idea", "title", "name", "label"].map((k) => (typeof o[k] === "string" ? (o[k] as string).trim() : "")).find(Boolean) ?? "";
    for (const x of Object.values(o)) {
      if (typeof x === "string") {
        const path = /\/api\/content\/picture\/\d{1,12}-[A-Za-z0-9_-]{4,40}/.exec(x)?.[0];
        if (path && said && !out.has(path)) out.set(path, said);
      } else walk(x, depth + 1);
    }
  };
  walk(value, 0);
  return out;
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
