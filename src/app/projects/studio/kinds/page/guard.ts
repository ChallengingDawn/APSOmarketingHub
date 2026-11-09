"use client";
// THE CHECK AFTER A CHANGE (Content v6, 09.11.2026) - so the night's failure cannot reach SARCLA again ("dark grey text on
// the dark petrol hero, invisible bullet lines with only red dots showing"). A block the AI made is put on the page in a
// frame nobody sees - the page as the shop has it, every change of the store view laid over it the way the server's
// preview does (./apply.ts), at the desktop's width and a phone's - and LOOKED AT (./readable.ts checkBlock): text below
// 4.5:1 on its real ground, text the colour of its ground, text with no size or cut off, a block that runs out of its
// place. Only a block that passes is applied; the studio asks the AI once more with what was seen, else keeps the change
// "Looks wrong - not applied" with the reason in plain words.

import { applyChanges, type AnyChange } from "@/lib/content/studio/kinds/page/apply";
import { finalChanges, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { checkBlock, type Problem } from "@/lib/content/studio/kinds/page/readable";
import type { PreviewOut } from "@/lib/content/studio/kinds/page/shop";
import { DEVICE_WIDTH, brandFont, hubAbsolute } from "./Frame";

const HELD = new Map<string, { at: number; html: string }>();

/** The page as the shop has it (the preview's "before"), kept a few minutes. */
async function pageAsItIs(pieceId: number, lang: string): Promise<string | null> {
  const key = `${pieceId}|${lang}`;
  const held = HELD.get(key);
  if (held && Date.now() - held.at < 4 * 60_000) return held.html;
  const out = await fetch(`/api/content/studio/page/${pieceId}/preview?side=before&lang=${encodeURIComponent(lang)}`)
    .then((r) => r.json() as Promise<PreviewOut>).catch(() => null);
  if (!out || !out.ok) return null;
  HELD.set(key, { at: Date.now(), html: out.html });
  while (HELD.size > 4) HELD.delete(HELD.keys().next().value as string);
  return out.html;
}

const nextFrame = (w: Window) => new Promise<void>((r) => w.requestAnimationFrame(() => r()));

/** One look at a page in a hidden frame of this width: `run` gets its document once it is laid out. */
function inFrame<T>(html: string, width: number, run: (d: Document, w: Window & typeof globalThis) => T, font: string): Promise<T | null> {
  return new Promise((resolve) => {
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-same-origin");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = `position:fixed;left:-30000px;top:0;width:${width}px;height:1000px;border:0;opacity:0;pointer-events:none`;
    let done = false;
    const finish = (v: T | null) => { if (done) return; done = true; clearTimeout(stop); f.remove(); resolve(v); };
    const stop = setTimeout(() => finish(null), 15_000);
    const go = async () => {
      const d = f.contentDocument;
      const w = f.contentWindow as (Window & typeof globalThis) | null;
      if (!d?.body || !w || d.URL !== "about:srcdoc") return false;
      if (font && !d.getElementById("apx-font")) { const st = d.createElement("style"); st.id = "apx-font"; st.textContent = font; d.head?.appendChild(st); }
      await Promise.race([d.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
      await nextFrame(w); await nextFrame(w);
      try { finish(run(d, w)); } catch { finish(null); }
      return true;
    };
    let tries = 0;
    const poll = () => {
      if (done) return;
      const d = f.contentDocument;
      if (d && d.URL === "about:srcdoc" && d.readyState !== "loading" && d.body) { void go(); return; }
      if (tries++ < 100) setTimeout(poll, 100);
    };
    f.srcdoc = html;
    document.body.appendChild(f);
    setTimeout(poll, 60);
  });
}

export type CheckOut = { problems: Problem[]; checked: boolean };

/**
 * The store view with this change applied, looked at on a desktop and on a phone. `checked` false = the page could not be
 * read to look at it (the change then counts as not checked - said, never passed silently).
 */
export async function checkChange(o: { pieceId: number; lang: string; view: PageDoc; id: string }): Promise<CheckOut> {
  const index = o.view.changes.findIndex((c) => c.id === o.id);
  if (index < 0) return { problems: [], checked: false };
  const live: PageDoc = { ...o.view, changes: o.view.changes.map((c, k) => (k === index ? ({ ...c, off: undefined } as PageChange) : c)) };
  const base = await pageAsItIs(o.pieceId, o.lang);
  if (!base) return { problems: [], checked: false };
  const final = finalChanges(live);
  const html = hubAbsolute(applyChanges(base, final.changes as AnyChange[], { marks: final.from }).html);
  const font = await brandFont().catch(() => "");
  const out: Problem[] = [];
  let looked = false;
  for (const [w, phone] of [[DEVICE_WIDTH.desktop, false], [DEVICE_WIDTH.mobile, true]] as const) {
    const found = await inFrame(html, w, (d, win) => checkBlock(d, win, index), font);
    if (!found) continue;
    looked = true;
    for (const p of found) {
      // what the desktop already showed is said once; what only a phone shows says so
      if (out.some((x) => x.kind === p.kind && x.text === p.text)) continue;
      out.push(phone ? { ...p, why: `On a phone: ${p.why}` } : p);
    }
  }
  return { problems: out, checked: looked };
}
