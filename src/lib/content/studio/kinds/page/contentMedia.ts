// PAGE - THE HUB'S OWN PICTURE STORAGE FOR THE SHOP (11.11.2026). Pure: tests/studio-page-media-store.test.ts.
//
// SARCLA 11.11.2026: "I can't copy-paste each new picture to Magento". Magento's REST API cannot upload media, so a new
// page's own pictures (generated or uploaded in the hub) waited for a person in Magento's Media Gallery. Now the hub keeps
// them itself: an S3 bucket (private) served publicly by CloudFront - the page names each picture at its address there,
// and Publish stores the ones not stored yet (./pictureStore.ts).
//
// Switched on by `base`: the public https origin the bucket is served at (CloudFront's domain, later perhaps
// https://media.apsoparts.com) - written below; CONTENT_MEDIA_BASE on the hub's task overrides it ("off" switches it off
// without a release). Empty = OFF: the pictures go to Magento's media as before (wysiwyg/content, uploaded by hand,
// Publish waits for them). The hub's task role holds
// s3:PutObject / s3:GetObject on content/* and s3:ListBucket with the prefix content/ (a missing file answers 404).

export const CONTENT_MEDIA = {
  bucket: "apsoparts-content-media-905418292914",
  region: "eu-central-1",
  prefix: "content/",
  /** the public https origin, without a slash at its end - "" = off. CloudFront E1MXZFQ6JS0W5M (live 11.11.2026 12:59,
   * the bucket read through its origin access control) */
  base: "https://dss0ijjcuug27.cloudfront.net",
};

/** Where AWS's container credentials are read (the ECS task's role). Absent on a laptop. */
export const CREDENTIALS_ENV = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI";
export const ONLY_FROM_THE_HUB = "Pictures can only be stored from the hub itself.";

type EnvLike = Readonly<Record<string, string | undefined>>;

/** The public origin: CONTENT_MEDIA_BASE when set ("off": none), else the constant - an https origin without its last
 * slash, or "". */
export function contentMediaBase(env: EnvLike = process.env): string {
  const set = (env.CONTENT_MEDIA_BASE ?? "").trim();
  if (/^(off|none|0|false)$/i.test(set)) return "";
  const raw = set || CONTENT_MEDIA.base.trim();
  const base = raw.replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(base) ? base : "";
}

/**
 * Is the hub's picture storage on? On: a base, and the task's credentials to store with. A base without them (a laptop,
 * the sandbox) keeps it off and says why; no base = off and nothing said (everything as before).
 */
export function contentMediaState(env: EnvLike = process.env): { on: true; base: string } | { on: false; why: string | null } {
  const base = contentMediaBase(env);
  if (!base) return { on: false, why: null };
  if (!(env[CREDENTIALS_ENV] ?? "").trim()) return { on: false, why: ONLY_FROM_THE_HUB };
  return { on: true, base };
}

/** A file's key in the bucket: content/<file>. */
export const contentKey = (file: string) => `${CONTENT_MEDIA.prefix}${file}`;
/** A file's public address: <base>/content/<file>. */
export const contentAddress = (base: string, file: string) => `${base.replace(/\/+$/, "")}/${contentKey(file)}`;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

/** Words made into a file name: lower case, no accents, dashes - at most `max` characters, cut at a dash. */
export function slugOf(words: string, max = 60): string {
  const s = String(words ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/æ/gi, "ae").replace(/ø/gi, "o").replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf("-");
  return (at >= Math.floor(max / 2) ? cut.slice(0, at) : s.slice(0, max)).replace(/-+$/g, "");
}

/**
 * A hub picture's file in the hub's picture storage: its words (alt text, else its idea), readable, then its number -
 * kalrez-6221-6230-discontinued-evolast-o-ring-448.jpg. The number is the picture's own, so two pictures never share a
 * name, and the same picture with the same words always gets the same one (stored once: a picture's bytes never change -
 * a fine-tuned one is a new picture). Its type's extension, jpg when unknown.
 */
export function contentFileOf(id: number, mime: string | null | undefined, words: string | null | undefined): string {
  const stem = slugOf(words ?? "") || "picture";
  return `${stem}-${Math.trunc(id)}.${EXT[mime ?? ""] ?? "jpg"}`;
}

/** The content type a file is stored with, from its name. */
export function contentTypeOf(file: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? "";
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

/** How a stored picture is served: a year, never changed (its name changes with it). */
export const CACHE_CONTROL = "public, max-age=31536000, immutable";
