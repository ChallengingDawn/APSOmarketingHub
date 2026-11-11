// VIDEO - ONE ELEMENT OF A SCENE, PICKED ON THE FILM (cv16, 11.11.2026). Pure: relative imports only - the studio
// (app/projects/studio/kinds/video/ElementPop.tsx) and tests/studio-video-cv16.test.ts.
//
// SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them". In the Page builder a click selects ONE element - a text, a button, a picture - and opens its popup.
// In the film the same: a click on the film (held still) picks the line under it - the headline, the small line over it,
// the proof, a step, the end card's line or its button - or the picture / the part. Where each sits is the scene's own
// layout per format (./film/layout.ts); lines that share a text box share it top to bottom in the order they show.
// What the popup does to one is here too: take it out, duplicate it, move it (the lines of a words or steps scene change
// places; any other scene moves in the film).

import { LAYOUTS, type Box, type Layout } from "./film/layout";
import { BOLD, REG } from "./film/theme";
import { fitBlock, fitFs, lineText, lineW, plain, type Block } from "./engine/text";
import { KIND_INFO, MAX_SCENES, sceneId, type CopyKey, type Format, type Scene, type SceneKind, type VideoDoc } from "./model";
import { partOf } from "./parts";

export type ElKey = CopyKey | "line" | "cta" | "picture";
/** One element of a scene (`scene` -1 = the end card). */
export type El = { scene: number; key: ElKey };
export type ElInfo = { key: ElKey; label: string; type: "text" | "picture"; box: Box; words?: number };

/** The lines that follow one another in a scene and may change places. */
const FLOW: Partial<Record<SceneKind, CopyKey[]>> = { words: ["line1", "line2", "line3"], steps: ["line1", "line2", "line3"] };

/** A box cut into stacked parts by weight (a small line over a headline is lighter). */
function stack(b: Box, parts: { key: ElKey; w: number }[]): Map<ElKey, Box> {
  const total = parts.reduce((n, p) => n + p.w, 0) || 1;
  const out = new Map<ElKey, Box>();
  let y = b.y;
  for (const p of parts) { const h = (b.h * p.w) / total; out.set(p.key, { x: b.x, y, w: b.w, h }); y += h; }
  return out;
}
const circle = (c: { cx: number; cy: number; r: number }): Box => ({ x: c.cx - c.r, y: c.cy - c.r, w: 2 * c.r, h: 2 * c.r });
const has = (s: Scene, k: CopyKey) => !!plain(s.copy[k] ?? "");

/* ── where the words really sit: measured as the film lays them out (./film/scenes.tsx, featureScenes.tsx) ───────── */

const PAD = 14;
const pad = (b: Box): Box => ({ x: b.x - PAD, y: b.y - PAD / 2, w: b.w + 2 * PAD, h: b.h + PAD });
/** The lines of a fitted block each field gave (the block holds them in order; a long one may have been split). */
function fieldLines(block: Block, fields: { key: CopyKey; text: string }[]): { key: CopyKey; from: number; n: number }[] {
  const out: { key: CopyKey; from: number; n: number }[] = [];
  let at = 0;
  for (const f of fields) {
    const want = plain(f.text).replace(/\s/g, "").length;
    const from = at;
    let got = 0;
    while (at < block.lines.length && got < want) { got += lineText(block.lines[at]).replace(/[\s*]/g, "").length; at++; }
    out.push({ key: f.key, from, n: at - from });
  }
  return out;
}
/** Each field's box in a block drawn at (x, top). */
function blockBoxes(block: Block, fields: { key: CopyKey; text: string }[], x: number, top: number, lh: number, weight: number): Map<ElKey, Box> {
  const m = new Map<ElKey, Box>();
  const lineH = block.fs * lh;
  for (const f of fieldLines(block, fields)) {
    if (!f.n) continue;
    const w = Math.max(...block.lines.slice(f.from, f.from + f.n).map((l) => lineW(l, weight, block.fs)));
    m.set(f.key, pad({ x, y: top + f.from * lineH, w, h: f.n * lineH }));
  }
  return m;
}
const src = (s: Scene, keys: CopyKey[]) => keys.filter((k) => has(s, k)).map((k) => ({ key: k, text: s.copy[k] ?? "" }));
const blockH = (b: Block, lh: number) => b.lines.length * b.fs * lh;

/** The written lines of a scene, where the film draws them - null when it has a required line not written yet (then
 * the box is shared out, so the empty line still has a place to be clicked). */
function measured(s: Scene, L: Layout): Map<ElKey, Box> | null {
  if (KIND_INFO[s.kind].fields.some((f) => f.required && !has(s, f.key))) return null;
  const fmt = L.fmt;
  if (s.kind === "title") {
    const box = partOf(s) || fmt !== "16:9" ? L.title.text : { ...L.title.text, w: L.safe.w };
    const kicker = plain(s.copy.kicker ?? "");
    const kfs = kicker ? fitFs([kicker], REG, L.fs.kicker, box.w - L.fs.kicker * 1.8) : 0;
    const lh = 1.04;
    const fields = src(s, ["line1", "line2"]);
    const block = fitBlock(fields.map((f) => f.text), BOLD, L.fs.head, { w: box.w, h: box.h - (kicker ? kfs * 2.2 : 0) }, { lh, breakable: fmt !== "16:9", maxLines: 4 });
    const kh = kicker ? kfs * 1.3 + kfs * 0.7 : 0;
    const top = box.y + (box.h - kh - blockH(block, lh)) / 2;
    const m = blockBoxes(block, fields, box.x, top + kh, lh, BOLD);
    if (kicker) m.set("kicker", pad({ x: box.x, y: top, w: kfs * 1.7 + lineW(kicker, REG, kfs), h: kfs * 1.3 }));
    return m;
  }
  if (s.kind === "words") {
    const box = L.words.text;
    const fields = src(s, ["line1", "line2", "line3"]);
    const block = fitBlock(fields.map((f) => f.text), BOLD, L.fs.words, box, { lh: 1.0, breakable: fmt !== "16:9", maxLines: 6 });
    return blockBoxes(block, fields, box.x, box.y + (box.h - blockH(block, 1.0)) / 2, 1.0, BOLD);
  }
  if (s.kind === "claim") {
    const box = L.claim.text;
    const sub = plain(s.copy.sub ?? "");
    const indent = Math.max(28, L.fs.claim * 0.36);
    const subFs = sub ? fitFs([sub], REG, L.fs.body, box.w - indent) : 0;
    const lh = 1.06;
    const fields = src(s, ["line1"]);
    const block = fitBlock(fields.map((f) => f.text), BOLD, L.fs.claim, { w: box.w - indent, h: box.h - (sub ? subFs * 2.6 : 0) }, { lh, breakable: true, maxLines: 3 });
    const bh = blockH(block, lh);
    const top = box.y + (box.h - bh - (sub ? subFs * 2.2 : 0)) / 2;
    const m = blockBoxes(block, fields, box.x + indent, top, lh, BOLD);
    if (sub) m.set("sub", pad({ x: box.x + indent, y: top + bh + subFs * 0.5, w: lineW(sub, REG, subFs), h: subFs * 1.5 }));
    return m;
  }
  if (s.kind === "feature") {
    const F = L.feature;
    const name = plain(s.copy.kicker ?? "");
    const proof = plain(s.copy.sub ?? "");
    const lh = 1.05;
    const kfs = name ? fitFs([name], REG, L.fs.kicker, F.text.w - L.fs.kicker * 1.8) : 0;
    const pfs = proof ? Math.min(L.fs.body, fitFs([proof], REG, L.fs.body, F.text.w)) : 0;
    const proofBlock = proof ? fitBlock([proof], REG, pfs, { w: F.text.w, h: pfs * 2.5 }, { lh: 1.22, breakable: true, maxLines: 2 }) : null;
    const fields = src(s, ["line1"]);
    const claim = fitBlock(fields.map((f) => f.text), BOLD, L.fs.claim, { w: F.text.w, h: F.text.h - (name ? kfs * 2 : 0) - (proofBlock ? blockH(proofBlock, 1.22) + pfs : 0) }, { lh, breakable: true, maxLines: 3 });
    const total = (name ? kfs * 1.9 : 0) + blockH(claim, lh) + (proofBlock ? pfs * 0.8 + blockH(proofBlock, 1.22) : 0);
    const top = F.text.y + Math.max(0, (F.text.h - total) / 2);
    const m = blockBoxes(claim, fields, F.text.x, top + (name ? kfs * 1.9 : 0), lh, BOLD);
    if (name) m.set("kicker", pad({ x: F.text.x, y: top, w: kfs * 1.7 + lineW(name, REG, kfs), h: kfs * 1.4 }));
    if (proofBlock) {
      const y = top + (name ? kfs * 1.9 : 0) + blockH(claim, lh) + pfs * 0.8;
      m.set("sub", pad({ x: F.text.x, y, w: Math.max(...proofBlock.lines.map((l) => lineW(l, REG, pfs))), h: blockH(proofBlock, 1.22) }));
    }
    return m;
  }
  if (s.kind === "product") {
    const Tb = L.product.text;
    const what = plain(s.copy.line1 ?? "");
    const lh = 1.04;
    const whatFs = what ? fitFs([what], REG, L.fs.body, Tb.w) : 0;
    const fields = src(s, ["kicker"]);
    const block = fitBlock(fields.map((f) => f.text), BOLD, L.fs.claim, { w: Tb.w, h: Tb.h - (what ? whatFs * 2.4 : 0) }, { lh, breakable: true, maxLines: 3 });
    const top = Tb.y + (Tb.h - blockH(block, lh) - (what ? whatFs * 2 : 0)) / 2;
    const m = blockBoxes(block, fields, Tb.x, top, lh, BOLD);
    if (what) m.set("line1", pad({ x: Tb.x, y: top + blockH(block, lh) + whatFs * 0.5, w: lineW(what, REG, whatFs), h: whatFs * 1.4 }));
    return m;
  }
  return null;
}

/** The elements of a scene - or the end card (`s` null) - where they sit in `fmt`. A line not written yet still has its
 * place (it can be picked and written). */
export function elementsOf(s: Scene | null, fmt: Format, end?: VideoDoc["endCard"]): ElInfo[] {
  const L = LAYOUTS[fmt];
  if (!s) {
    const E = L.end;
    // as the end card draws them (./film/scenes.tsx EndScene): the line centred in its box, the button sized to its words
    const line = plain(end?.line ?? "");
    const block = line ? fitBlock([end!.line], BOLD, L.fs.end, E.line, { lh: 1.04, breakable: true, maxLines: 3 }) : null;
    const lineBox = block ? pad({ x: E.line.x, y: E.line.y + Math.max(0, (E.line.h - blockH(block, 1.04)) / 2), w: Math.max(...block.lines.map((l) => lineW(l, BOLD, block.fs))), h: blockH(block, 1.04) }) : E.line;
    const cta = plain(end?.cta ?? "");
    const ctaMax = fmt === "16:9" ? 760 : fmt === "9:16" ? 900 : 640;
    const ctaFs = cta ? Math.min(L.fs.cta, ctaMax / (lineW(cta, BOLD, 1) + 2.6)) : 0;
    const ctaW = cta ? ctaFs * (lineW(cta, BOLD, 1) + 2.6) : E.cta.h * 3.2;
    return [
      { key: "line", label: "The line", type: "text", box: lineBox, words: 7 },
      { key: "cta", label: "The button", type: "text", box: { x: E.cta.x - 6, y: E.cta.y - 6, w: ctaW + 12, h: E.cta.h + 12 }, words: 4 },
    ];
  }
  const info = KIND_INFO[s.kind];
  const field = (k: CopyKey) => info.fields.find((f) => f.key === k);
  const text = (key: CopyKey, box: Box): ElInfo => ({ key, label: field(key)?.label ?? key, type: "text", box, words: field(key)?.words });
  const out: ElInfo[] = [];
  const stacked = (b: Box, keys: CopyKey[], small: CopyKey[] = []) => {
    const shown = keys.filter((k) => has(s, k) || k === keys.find((x) => !small.includes(x)));
    const m = stack(b, shown.map((k) => ({ key: k, w: small.includes(k) ? 0.45 : 1 })));
    for (const k of shown) out.push(text(k, m.get(k)!));
  };
  if (s.kind === "title") {
    const box = partOf(s) || fmt !== "16:9" ? L.title.text : { ...L.title.text, w: L.safe.w };
    stacked(box, ["kicker", "line1", "line2"], ["kicker"]);
    if (partOf(s)) out.push({ key: "picture", label: "The part", type: "picture", box: circle(L.title.part) });
  } else if (s.kind === "words") stacked(L.words.text, ["line1", "line2", "line3"]);
  else if (s.kind === "claim") stacked(L.claim.text, ["line1", "sub"], ["sub"]);
  else if (s.kind === "feature") {
    stacked(L.feature.text, ["kicker", "line1", "sub"], ["kicker", "sub"]);
    out.push({ key: "picture", label: "The picture", type: "picture", box: L.feature.card });
  } else if (s.kind === "number") {
    out.push(text("line1", L.number.fig), text("line2", L.number.label));
    if (has(s, "sub")) out.push(text("sub", L.number.sub));
  } else if (s.kind === "compare") {
    if (has(s, "kicker")) out.push(text("kicker", L.compare.head));
    out.push(text("line1", L.compare.before), text("line2", L.compare.after));
  } else if (s.kind === "steps") {
    if (has(s, "kicker")) out.push(text("kicker", L.steps.head));
    (["line1", "line2", "line3"] as CopyKey[]).forEach((k, n) => out.push(text(k, L.steps.cards[n])));
  } else if (s.kind === "product") {
    stacked(L.product.text, ["kicker", "line1"], ["line1"]);
    out.push({ key: "picture", label: s.image ? "The picture" : "The part", type: "picture", box: L.product.card });
  } else if (s.kind === "quote") {
    out.push(text("line1", L.quote.text), text("sub", L.quote.who));
  }
  // the written lines where the film really draws them (the outline hugs the words)
  const m = measured(s, L);
  if (m) for (const e of out) { const b = m.get(e.key); if (b) e.box = b; }
  return out;
}

/** The element at a point of the film (its own pixels) - the smallest box holding it, else the nearest within 40 px. */
export function elementAt(s: Scene | null, fmt: Format, x: number, y: number, end?: VideoDoc["endCard"]): ElInfo | null {
  const els = elementsOf(s, fmt, end);
  const inside = els.filter((e) => x >= e.box.x && x <= e.box.x + e.box.w && y >= e.box.y && y <= e.box.y + e.box.h);
  if (inside.length) return inside.sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0];
  const dist = (b: Box) => Math.hypot(Math.max(b.x - x, 0, x - b.x - b.w), Math.max(b.y - y, 0, y - b.y - b.h));
  const near = els.map((e) => ({ e, d: dist(e.box) })).sort((a, b) => a.d - b.d)[0];
  return near && near.d <= 40 ? near.e : null;
}

/** What an element's name says in the popup and the bar ("Scene 2 · Headline", "End card · The button"). */
export const elementName = (doc: VideoDoc, el: El): string => {
  const s = el.scene >= 0 ? doc.scenes[el.scene] : null;
  const info = elementsOf(s, doc.format, doc.endCard).find((e) => e.key === el.key);
  return `${el.scene === -1 ? "End card" : `Scene ${el.scene + 1}`} · ${info?.label ?? el.key}`;
};

/* ── what the popup does to one ───────────────────────────────────────────────────────────────────────────────── */

type Copy = Partial<Record<CopyKey, string>>;

/** A change to one scene's words, made to the film's own words AND to every language version's (they follow it). */
function withCopy(doc: VideoDoc, i: number, fn: (c: Copy) => Copy): VideoDoc {
  const s = doc.scenes[i];
  const next: VideoDoc = { ...doc, scenes: doc.scenes.map((x, k) => (k === i ? { ...x, copy: fn({ ...x.copy }) } : x)) };
  if (doc.langs) next.langs = Object.fromEntries(Object.entries(doc.langs).map(([code, v]) => [code, v.scenes[s.id] ? { ...v, scenes: { ...v.scenes, [s.id]: fn({ ...v.scenes[s.id] }) } } : v]));
  return next;
}

/** Lines that follow one another, closed up after one went (as an AI answer's are). */
function closeUp(c: Copy, flow: CopyKey[]): Copy {
  const kept = flow.map((k) => c[k]).filter((t): t is string => !!t);
  flow.forEach((k, n) => { if (kept[n]) c[k] = kept[n]; else delete c[k]; });
  return c;
}

/** The line taken out (its words emptied, in every language), the picture or the part taken out where the scene can
 * do without. */
export function takeOut(doc: VideoDoc, el: El): VideoDoc {
  if (el.scene === -1) {
    const k = el.key === "cta" ? "cta" : "line";
    const langs = doc.langs ? Object.fromEntries(Object.entries(doc.langs).map(([code, v]) => [code, { ...v, end: { ...v.end, [k]: "" } }])) : undefined;
    return { ...doc, endCard: { ...doc.endCard, [k]: "" }, ...(langs ? { langs } : {}) };
  }
  const s = doc.scenes[el.scene];
  if (!s) return doc;
  if (el.key === "picture") {
    const p: Partial<Scene> = s.image ? { image: undefined } : s.kind === "title" ? { part: undefined, shape: "none" } : {};
    return { ...doc, scenes: doc.scenes.map((x, i) => (i === el.scene ? { ...x, ...p } : x)) };
  }
  const flow = FLOW[s.kind];
  return withCopy(doc, el.scene, (c) => { delete c[el.key as CopyKey]; return flow?.includes(el.key as CopyKey) ? closeUp(c, flow) : c; });
}

/** Where a line can go one place up (-1) or down (+1) within its scene - null when it cannot. */
export function lineMove(s: Scene | null, key: ElKey, dir: -1 | 1): CopyKey | null {
  const flow = s ? FLOW[s.kind] : undefined;
  if (!flow || !s) return null;
  const at = flow.indexOf(key as CopyKey);
  const to = flow[at + dir];
  return at >= 0 && to && (has(s, to) || dir === -1) ? to : null;
}

/** The element moved: a line changes places with its neighbour; anything else moves its scene one place in the film. */
export function moveEl(doc: VideoDoc, el: El, dir: -1 | 1): { doc: VideoDoc; el: El } | null {
  if (el.scene < 0) return null;
  const s = doc.scenes[el.scene];
  const to = lineMove(s, el.key, dir);
  if (to) {
    const from = el.key as CopyKey;
    const swap = (c: Copy): Copy => { const a = c[from]; const b = c[to]; if (b) c[from] = b; else delete c[from]; if (a) c[to] = a; else delete c[to]; return c; };
    return { doc: withCopy(doc, el.scene, swap), el: { scene: el.scene, key: to } };
  }
  const at = el.scene + dir;
  if (at < 0 || at >= doc.scenes.length) return null;
  const a = [...doc.scenes];
  const [m] = a.splice(el.scene, 1);
  a.splice(at, 0, m);
  return { doc: { ...doc, scenes: a }, el: { scene: at, key: el.key } };
}

/** What "Move" does to it, in words: "Up" / "Down" for a line that can, else the scene's place. */
export function moveWords(doc: VideoDoc, el: El): { up: string | null; down: string | null } {
  if (el.scene < 0) return { up: null, down: null };
  const s = doc.scenes[el.scene];
  const flowing = !!FLOW[s.kind]?.includes(el.key as CopyKey);
  return {
    up: flowing ? (lineMove(s, el.key, -1) ? "Line up" : null) : el.scene > 0 ? "Scene earlier" : null,
    down: flowing ? (lineMove(s, el.key, 1) ? "Line down" : null) : el.scene < doc.scenes.length - 1 ? "Scene later" : null,
  };
}

/** The element duplicated: a line into the next free line of its scene (words, steps); else the scene after itself. */
export function duplicateEl(doc: VideoDoc, el: El): { doc: VideoDoc; el: El; what: "line" | "scene" } | null {
  if (el.scene < 0) return null;
  const s = doc.scenes[el.scene];
  const flow = FLOW[s.kind];
  if (flow?.includes(el.key as CopyKey)) {
    const free = flow.find((k) => !has(s, k));
    if (free) {
      const at = flow.indexOf(el.key as CopyKey);
      const twice = (c: Copy): Copy => {
        const lines = flow.map((k) => c[k] ?? "").filter((t) => plain(t));
        if (c[el.key as CopyKey]) lines.splice(at + 1, 0, c[el.key as CopyKey]!);
        flow.forEach((k, n) => { if (lines[n]) c[k] = lines[n]; else delete c[k]; });
        return c;
      };
      return { doc: withCopy(doc, el.scene, twice), el: { scene: el.scene, key: flow[at + 1] }, what: "line" };
    }
  }
  if (doc.scenes.length >= MAX_SCENES) return null;
  const a = [...doc.scenes];
  const id = sceneId();
  a.splice(el.scene + 1, 0, { ...s, id, copy: { ...s.copy } });
  // its words in every language come along
  const langs = doc.langs ? Object.fromEntries(Object.entries(doc.langs).map(([code, v]) => [code, v.scenes[s.id] ? { ...v, scenes: { ...v.scenes, [id]: { ...v.scenes[s.id] } } } : v])) : undefined;
  return { doc: { ...doc, scenes: a, ...(langs ? { langs } : {}) }, el: { scene: el.scene + 1, key: el.key }, what: "scene" };
}
