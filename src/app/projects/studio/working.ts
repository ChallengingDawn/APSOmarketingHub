"use client";
// WHAT THE AI IS DOING, FOR WHOEVER SHOWS IT (SARCLA 08.11.2026: "it would also be great to have an AI animation as soon
// as it starts working"). A call that makes the AI work says so here the moment it starts and stops saying it when it
// ends - useStudio for every studio's ai/act calls, makePicture for a picture - and the studio's frame shows it (one
// place, so every kind of studio gets it without a line of its own). Several at once: the newest is shown.

import { useSyncExternalStore } from "react";

export type Working = { label: string; kind: "ai" | "picture" | "work" };

let running: { id: number; w: Working }[] = [];
let shown: Working | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const changed = () => {
  shown = running.length ? running[running.length - 1].w : null;
  for (const l of listeners) l();
};

/**
 * Says the work started (after `delayMs`, so a call that answers at once never flashes anything); the function it returns
 * says it ended. Ending before the delay shows nothing at all.
 */
export function startWorking(w: Working, delayMs = 0): () => void {
  const id = ++seq;
  let on = false;
  let ended = false;
  const show = () => { if (ended) return; on = true; running = [...running, { id, w }]; changed(); };
  const timer = delayMs > 0 ? setTimeout(show, delayMs) : null;
  if (!timer) show();
  return () => {
    ended = true;
    if (timer) clearTimeout(timer);
    if (!on) return;
    running = running.filter((x) => x.id !== id);
    changed();
  };
}

/** `fn`, said to be running while it runs. */
export async function whileWorking<T>(w: Working, fn: () => Promise<T>, delayMs = 0): Promise<T> {
  const stop = startWorking(w, delayMs);
  try { return await fn(); } finally { stop(); }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** What is running now (the newest), or null. */
export function useWorking(): Working | null {
  return useSyncExternalStore(subscribe, () => shown, () => null);
}
