// BLOG POST - THE LAST STEP ON THE SERVER (cv16, 11.11.2026). The post's pictures in the hub's picture storage, by the Page
// builder's own helpers (page/contentMedia.ts names, page/pictureStore.ts stores - a picture stored once is never stored
// again), and the post's pages read on the shop (www.apsoparts.com, never written). Nothing is written to Magento.

import { getAsset } from "@/lib/content/assets";
import { readPage } from "@/lib/directup/check";
import { contentAddress, contentFileOf, contentMediaState } from "../page/contentMedia";
import { storePictures, storedStates } from "../page/pictureStore";
import type { MediaFile } from "../page/media";
import { SHOP } from "./model";
import { isLive, livePathsIn, picturesIn, type LiveRead, type PictureRow } from "./publish";

export type PicturesOut = { on: boolean; why: string | null; list: PictureRow[] };

async function filesOf(raw: unknown, base: string): Promise<MediaFile[]> {
  const out: MediaFile[] = [];
  for (const p of picturesIn(raw)) {
    const a = await getAsset(p.id).catch(() => null);
    const file = contentFileOf(p.id, a?.mime, p.words || a?.name?.replace(/\.[a-z0-9]{2,5}$/i, "") || a?.prompt || "");
    out.push({ file, url: p.url, address: contentAddress(base, file) });
  }
  return out;
}

/** Each picture's name and address in the hub's picture storage, and whether it is stored yet. Off: said why (or not). */
export async function readPictureFiles(raw: unknown): Promise<PicturesOut> {
  const store = contentMediaState();
  if (!store.on) return { on: false, why: store.why, list: [] };
  const files = await filesOf(raw, store.base);
  const checked = await storedStates(files).catch(() => files.map((f) => ({ ...f, address: f.address ?? "", state: "unknown" as const })));
  return { on: true, why: null, list: checked.map((c) => ({ url: c.url, file: c.file, address: c.address, state: c.state })) };
}

/** The pictures not stored yet, stored. Never throws for one picture: `failed` says which and why. */
export async function storePictureFiles(raw: unknown): Promise<PicturesOut & { failed: { file: string; why: string }[]; stored: number }> {
  const store = contentMediaState();
  if (!store.on) throw new Error(store.why ?? "The hub's picture storage is off - the pictures go to Magento's Media Gallery by hand.");
  const files = await filesOf(raw, store.base);
  const out = await storePictures(files);
  const checked = await storedStates(files).catch(() => files.map((f) => ({ ...f, address: f.address ?? "", state: "unknown" as const })));
  return { on: true, why: null, list: checked.map((c) => ({ url: c.url, file: c.file, address: c.address, state: c.state })), failed: out.failed, stored: out.stored.length };
}

/** Each page read on the shop (production, one at a time): there with the blog's own article in it, or not yet. */
export async function livePaths(raw: unknown): Promise<LiveRead[]> {
  const out: LiveRead[] = [];
  for (const path of livePathsIn(raw)) {
    const url = `${SHOP}${path}`;
    try {
      const r = await readPage(url, 12_000);
      out.push({ path, url, status: r.status, live: isLive(r.status, r.body) });
    } catch {
      out.push({ path, url, status: 0, live: false });
    }
  }
  return out;
}
