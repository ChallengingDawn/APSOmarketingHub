"use client";
// A BIG CHANGE TO A STUDIO'S DOCUMENT, SAVED IN TWO STEPS (08.11.2026; the blog and newsletter studios' own copy of the page studio's). The studio saves in small ops under the hub's
// 8 KB request limit (studio/doc.ts batches), and slices a long text - but an item put into a list goes whole, so an AI
// answer with a 7 KB block of HTML (a page's change, a post's section) would be refused by the firewall with a bare 403.
// So a list that comes back heavy is saved first with its long texts empty (every item small), the studio waits for
// that save (any action waits for it), and then the texts go in - set field by field, each sliced to fit.

import { applyWithRoot, diffOps, type Op } from "@/lib/content/studio/doc";
import type { StudioApi } from "../../useStudio";

const HEAVY = 5_500;
const size = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/** The same value with every long text emptied. */
function light(v: unknown): unknown {
  if (typeof v === "string") return v.length > 600 ? "" : v;
  if (Array.isArray(v)) return v.map(light);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, light(x)]));
  return v;
}

/** `cur` is the document as it is now (the studio's latest, not the one a slow answer started from). */
export async function setDocSafely(api: StudioApi, cur: unknown, next: unknown): Promise<void> {
  const ops = diffOps(cur, next);
  const heavy = (o: Op) => o.op === "set" && !!o.value && typeof o.value === "object" && size(o.value) > HEAVY;
  if (!ops.some(heavy)) { api.setDoc(next); return; }
  api.setDoc(applyWithRoot(cur, ops.map((o) => (heavy(o) && o.op === "set" ? { ...o, value: light(o.value) } : o))));
  await api.act("ping");
  api.setDoc(next);
}
