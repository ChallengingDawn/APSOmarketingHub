// BANNER - ITS OWN PICTURES IN THE HUB'S PICTURE STORAGE (cv16, 11.11.2026). Pure: tests/studio-banner-cv16.test.ts.
//
// SARCLA 11.11.2026: "I can't copy-paste each new picture to Magento" - the Page builder's pictures go to the hub's picture
// storage (page/contentMedia.ts: a public address, a readable name from the picture's words). A banner's paste block (the
// home band, a category band, a page hero, the home slot) named a picture made or uploaded in the hub by the hub's own
// address, which the shop's visitors cannot reach ("Download it, put it in the shop's media"). Now "Copy the paste block"
// stores the banner's own pictures there first (server.ts store_media) and the block names them at their public address.

import { isHubPicture } from "./brand";
import type { BannerDoc } from "./model";

/** The hub pictures the banner shows, each with the words its stored file is named from: its alt text, else its label,
 * else the banner's headline. */
export function bannerPictureWords(d: BannerDoc): Map<string, string> {
  const out = new Map<string, string>();
  const head = `${d.content.headline} ${d.content.rotatingWords[0] ?? ""}`.trim();
  const pics = d.content.photos.length >= 2 ? d.content.photos : [d.content.image];
  for (const p of pics) {
    const u = p.url.trim();
    if (!isHubPicture(u) || out.has(u)) continue;
    out.set(u, p.alt.trim() || p.label.trim() || head);
  }
  return out;
}

/** The banner with its hub pictures named at their stored addresses (`at`: hub address -> public address); the others
 * as they are. Only for what goes out (the paste block) - the banner itself keeps the hub's addresses. */
export function withStoredPictures(d: BannerDoc, at: Readonly<Record<string, string>>): BannerDoc {
  const swap = <T extends { url: string }>(p: T): T => (at[p.url] && /^https:\/\//.test(at[p.url]) ? { ...p, url: at[p.url] } : p);
  return { ...d, content: { ...d.content, image: swap(d.content.image), photos: d.content.photos.map(swap) } };
}
