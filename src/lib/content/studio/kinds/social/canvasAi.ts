// SOCIAL POST - THE AI ON THE CANVAS (SARCLA 08.11.2026: "improve the AI window a lot ... it doesn't create the photo,
// and it opens another window. Just put it on the canvas"; "the AI module should help generate anything that you
// prompt").
//
// One prompt box. The model answers in canvas operations (a JSON schema, below): change these words, add a headline,
// put our logo bottom right, make the background a photo of ..., use the "stat" template with these words, make a
// carousel of six pages, switch to the story format. `planOps` turns them into the page's new design document - pure,
// so the studio applies it as ONE undo step - and lists the pictures still to make (makePicture, 10-40 s each), which the
// studio puts in place when they arrive. Pure - tests/studio-social-ai.test.ts.

import type { DesignDocument, DesignNode } from "../../../../design-document";
import { plainText } from "../../../../editor/richText";
import { C, FORMATS, LOGOS, isFormat, type FormatKey, type LogoKey } from "./design";
import {
  TEMPLATES, TEMPLATE_KEYS, TEXT_ROLES, composeWords, estimateFor, isTextRole, logoNode, roleNodes, shapeOf, templateByKey,
  type MeasureFor, type TemplateKey, type TextRole, type Words,
} from "./templates";

export const OPS = ["set_text", "add_text", "remove", "move", "recolour", "resize", "background", "picture", "logo", "template", "pages", "format"] as const;
export type OpKind = (typeof OPS)[number];
export const POSITIONS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right", "background", "frame", "none"] as const;
export type Position = (typeof POSITIONS)[number];
const FORMAT_CHOICES = [...Object.keys(FORMATS), "none"];

const WORDS_SCHEMA = {
  type: "object",
  description: "The words for a template (empty strings and an empty list where the template does not use them). Key words between *stars*.",
  properties: {
    eyebrow: { type: "string" }, headline: { type: "string" }, body: { type: "string" }, cta: { type: "string" },
    number: { type: "string" }, who: { type: "string" }, items: { type: "array", items: { type: "string" } },
  },
  required: ["eyebrow", "headline", "body", "cta", "number", "who", "items"],
  additionalProperties: false,
} as const;

export const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "One short sentence to the person: what you changed, or why you could not." },
    ops: {
      type: "array",
      description: "The changes, in order. At most 10.",
      items: {
        type: "object",
        properties: {
          do: { type: "string", enum: [...OPS] },
          target: { type: "string", description: "The id of the object it changes (from the list), or empty." },
          text: { type: "string", description: "set_text / add_text: the words, key words between *stars*. Else empty." },
          role: { type: "string", enum: [...TEXT_ROLES, "none"], description: "add_text: what kind of text. Else none." },
          position: { type: "string", enum: [...POSITIONS], description: "Where it goes (add_text, move, logo, picture). picture: frame = into the target frame, background = the page's background." },
          colour: { type: "string", description: "recolour / background: red, petrol, ink, white, light, grey, mute, or #hex; for a gradient two of them joined by '>' (petrol>ink). Else empty." },
          amount: { type: "number", description: "resize: the factor (1.25 = a quarter bigger, 0.8 = smaller). Else 1." },
          prompt: { type: "string", description: "picture, or background with a picture: what the photo shows, one or two sentences, no text or logos in it. Else empty." },
          template: { type: "string", enum: [...TEMPLATE_KEYS, "none"], description: "template: which one. Else none." },
          format: { type: "string", enum: FORMAT_CHOICES, description: "format: the size to switch to. Else none." },
          words: WORDS_SCHEMA,
          slides: {
            type: "array",
            description: "pages: the carousel's pages in order (3 to 10), each a template with its words. Else empty.",
            items: {
              type: "object",
              properties: {
                template: { type: "string", enum: [...TEMPLATE_KEYS] },
                words: WORDS_SCHEMA,
                prompt: { type: "string", description: "A photo to make for this page (only where it really helps; at most two pages), else empty." },
              },
              required: ["template", "words", "prompt"],
              additionalProperties: false,
            },
          },
        },
        required: ["do", "target", "text", "role", "position", "colour", "amount", "prompt", "template", "format", "words", "slides"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "ops"],
  additionalProperties: false,
} as const;

export type AiSlide = { template: TemplateKey; words: Words; prompt: string };
export type AiOp = {
  do: OpKind; target: string; text: string; role: TextRole | null; position: Position; colour: string; amount: number;
  prompt: string; template: TemplateKey | null; format: FormatKey | null; words: Words; slides: AiSlide[];
};
export type DesignAnswer = { reply: string; ops: AiOp[] };

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");

/** The words of a template from the model, kept short. */
export function cleanWords(raw: unknown): Words {
  const w = obj(raw);
  const out: Words = {};
  for (const k of ["eyebrow", "headline", "body", "cta", "number", "who"] as const) {
    const v = str(w[k], k === "body" ? 400 : 220);
    if (v) out[k] = v;
  }
  const items = Array.isArray(w.items) ? w.items.map((x) => str(x, 160)).filter(Boolean).slice(0, 8) : [];
  if (items.length) out.items = items;
  return out;
}

/** The model's answer kept where it makes sense: known operations only, two pictures at most, ten pages at most. */
export function cleanDesign(raw: unknown): DesignAnswer {
  const r = obj(raw);
  let pictures = 0;
  const ops: AiOp[] = [];
  for (const x of Array.isArray(r.ops) ? r.ops.slice(0, 12) : []) {
    const o = obj(x);
    const kind = (OPS as readonly string[]).includes(String(o.do)) ? (o.do as OpKind) : null;
    if (!kind) continue;
    const slides: AiSlide[] = (Array.isArray(o.slides) ? o.slides : []).slice(0, 10).map((s) => {
      const so = obj(s);
      const t = templateByKey(String(so.template))?.key ?? "slide";
      let prompt = str(so.prompt, 600);
      if (prompt && pictures >= 2) prompt = "";
      if (prompt) pictures += 1;
      return { template: t, words: cleanWords(so.words), prompt };
    });
    let prompt = str(o.prompt, 600);
    if ((kind === "picture" || kind === "background") && prompt) {
      if (pictures >= 2) prompt = "";
      else pictures += 1;
    }
    if (kind === "picture" && !prompt) continue;
    ops.push({
      do: kind,
      target: str(o.target, 100),
      text: str(o.text, 600),
      role: isTextRole(o.role) ? o.role : null,
      position: (POSITIONS as readonly string[]).includes(String(o.position)) ? (o.position as Position) : "none",
      colour: str(o.colour, 40),
      amount: typeof o.amount === "number" && Number.isFinite(o.amount) ? Math.min(4, Math.max(0.25, o.amount)) : 1,
      prompt,
      template: templateByKey(String(o.template))?.key ?? null,
      format: isFormat(o.format) && o.format !== "custom" ? o.format : null,
      words: cleanWords(o.words),
      slides,
    });
  }
  return { reply: str(r.reply, 400), ops };
}

/* ── what the model is shown ───────────────────────────────────────────────────────────────────────────────────── */

/** A name for what an object is, for the model and for people. */
export function roleOf(n: DesignNode, doc: DesignDocument): string {
  if (n.kind === "image") return Object.values(LOGOS).some((l) => l.src === n.src) ? "logo" : "picture";
  if (n.kind === "text") {
    const k = (n.fontSize ?? 24) / Math.min(doc.canvas.w, doc.canvas.h);
    return k > 0.2 ? "big number" : k > 0.06 ? "headline" : k > 0.04 ? "subheading" : "text";
  }
  if (n.kind === "rect" || n.kind === "ellipse") return (n.width ?? 0) * (n.height ?? 0) > doc.canvas.w * doc.canvas.h * 0.05 ? "frame or panel" : "shape";
  return n.kind;
}

/** The page as the model reads it: its board, background, and every object with its id. */
export function describePage(doc: DesignDocument, page: number, pages: number, format: string): string {
  const b = doc.background;
  const lines = [
    `The page on the canvas: page ${page + 1} of ${pages}, format ${format} (${doc.canvas.w} x ${doc.canvas.h} px).`,
    `Background: ${b.src ? (b.src.includes("/social/grid") ? "the blueprint grid" : "a picture") : b.gradientId ? `a gradient ${b.customGradient.from} > ${b.customGradient.to}` : b.color}.`,
    "Objects, back to front (id | what | box x,y,w,h | colour | words):",
  ];
  for (const n of doc.nodes) {
    if (n.hidden) continue;
    const box = [n.x, n.y, n.width ?? 0, n.height ?? 0].map((v) => Math.round(v)).join(",");
    const words = n.kind === "text" ? ` | "${(n.text ?? "").replace(/\n/g, " / ").slice(0, 160)}"` : "";
    lines.push(`- ${n.id} | ${roleOf(n, doc)}${n.kind === "text" ? ` ${n.fontSize}px` : ""} | ${box} | ${n.fill}${words}`);
  }
  if (!doc.nodes.length) lines.push("- (nothing yet)");
  return lines.join("\n");
}

export const TEMPLATE_CATALOGUE = TEMPLATES.map((t) => `- ${t.key}: ${t.name} - ${t.note}`).join("\n");

/* ── the answer applied ────────────────────────────────────────────────────────────────────────────────────────── */

const NAMED: Record<string, string> = {
  red: C.red, petrol: C.petrol, ink: C.ink, black: C.ink, white: C.white, light: C.light, grey: C.grey, gray: C.grey, mute: C.mute, blue: C.petrol, pale: C.pale,
};
/** A colour from the model: a brand name or a #hex; null when it is neither. */
export function colourOf(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  return /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : /^#[0-9a-f]{3}$/i.test(v.trim()) ? v.trim() : null;
}

const isDark = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 140;
};

/** Whether the page reads as dark (white words, the white logo). */
export function darkPage(doc: DesignDocument): boolean {
  const b = doc.background;
  if (b.src?.includes("grid-dark")) return true;
  if (b.src && !b.src.startsWith("/social/")) return true;
  if (b.gradientId) return isDark(b.customGradient.from) && isDark(b.customGradient.to);
  return isDark(b.color);
}

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}a${(seq += 1)}`;

/** A box of `w` x `h` at a named place on the board, inside its margins. */
export function boxAt(pos: Position, s: { w: number; h: number }, w: number, h: number): { x: number; y: number } {
  const m = Math.round(Math.min(s.w, s.h) * 0.075);
  const story = shapeOf(s) === "story";
  const top = story ? Math.round(s.h * 0.13) : m;
  const bottom = story ? Math.round(s.h * 0.86) : s.h - m;
  const col = pos.includes("left") ? m : pos.includes("right") ? s.w - m - w : (s.w - w) / 2;
  const row = pos.startsWith("top") ? top : pos.startsWith("bottom") ? bottom - h : (s.h - h) / 2;
  return { x: Math.round(col), y: Math.round(row) };
}

export type PictureJob = {
  /** Where it goes: an image node (replacing the frame of that id), or the background. */
  into: { node: string } | "background";
  prompt: string;
  aspect: "1:1" | "4:5" | "16:9" | "3:2";
  /** The page it belongs to (its index), when the answer made new pages. */
  page?: number;
};

export type Plan = {
  /** The page as it becomes (null: unchanged). */
  doc: DesignDocument | null;
  /** New pages (a carousel), each a document in the current format, replacing the pages. */
  pages: DesignDocument[] | null;
  format: FormatKey | null;
  pictures: PictureJob[];
  /** What could not be done, in plain words. */
  skipped: string[];
};

export const aspectFor = (w: number, h: number): PictureJob["aspect"] => {
  const r = w / Math.max(1, h);
  return r > 1.6 ? "16:9" : r > 1.2 ? "3:2" : r < 0.9 ? "4:5" : "1:1";
};

/** A light frame where a picture is being made - replaced by the picture when it comes. */
function frameNode(x: number, y: number, w: number, h: number, radius = 0): DesignNode {
  return { id: nid("frame"), kind: "rect", x, y, width: Math.round(w), height: Math.round(h), fill: "#DDE5EB", ...(radius ? { cornerRadius: radius } : {}) };
}

/** The answer applied to the page on the canvas. Pure: the pictures are listed, not made. */
export function planOps(ops: AiOp[], page: DesignDocument, mf: MeasureFor = estimateFor): Plan {
  let doc: DesignDocument = JSON.parse(JSON.stringify(page));
  let changed = false;
  let pages: DesignDocument[] | null = null;
  let format: FormatKey | null = null;
  const pictures: PictureJob[] = [];
  const skipped: string[] = [];
  const S = () => doc.canvas;
  const find = (id: string) => doc.nodes.find((n) => n.id === id) ?? null;
  const setNodes = (nodes: DesignNode[]) => { doc = { ...doc, nodes }; changed = true; };

  for (const op of ops) {
    const target = op.target ? find(op.target) : null;
    const group = target?.groupId ? doc.nodes.filter((n) => n.groupId === target.groupId) : target ? [target] : [];
    switch (op.do) {
      case "set_text": {
        if (!target || target.kind !== "text") { if (op.text) skipped.push("A text to change was not found."); break; }
        setNodes(doc.nodes.map((n) => (n.id === target.id ? { ...n, text: op.text } : n)));
        break;
      }
      case "add_text": {
        if (!op.text) break;
        const role = op.role ?? "headline";
        const s = S();
        const m = Math.round(Math.min(s.w, s.h) * 0.075);
        const w = s.w - m * 2;
        const placed = roleNodes(role, op.text, s, { x: m, y: 0, w }, mf, darkPage(doc));
        const bw = Math.max(...placed.nodes.map((n) => (n.width ?? 0)));
        const at = boxAt(op.position === "none" || op.position === "background" || op.position === "frame" ? "center" : op.position, s, role === "cta" ? bw : w, placed.h);
        const dx = role === "cta" ? at.x - m : 0;
        setNodes([...doc.nodes, ...placed.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + at.y }))]);
        break;
      }
      case "remove": {
        if (!group.length) break;
        const ids = new Set(group.map((n) => n.id));
        setNodes(doc.nodes.filter((n) => !ids.has(n.id)));
        break;
      }
      case "move": {
        if (!group.length || op.position === "none" || op.position === "background" || op.position === "frame") break;
        const x0 = Math.min(...group.map((n) => n.x)); const y0 = Math.min(...group.map((n) => n.y));
        const x1 = Math.max(...group.map((n) => n.x + (n.width ?? 0))); const y1 = Math.max(...group.map((n) => n.y + (n.height ?? (n.fontSize ?? 24) * 1.2)));
        const at = boxAt(op.position, S(), x1 - x0, y1 - y0);
        const ids = new Set(group.map((n) => n.id));
        setNodes(doc.nodes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + at.x - x0, y: n.y + at.y - y0 } : n)));
        break;
      }
      case "recolour": {
        const c = colourOf(op.colour);
        if (!target || !c) break;
        setNodes(doc.nodes.map((n) => (n.id === target.id ? { ...n, fill: c, ...(n.gradient ? { gradient: undefined } : {}) } : n)));
        break;
      }
      case "resize": {
        if (!target) break;
        const k = op.amount;
        setNodes(doc.nodes.map((n) => {
          if (n.id !== target.id) return n;
          if (n.kind === "text") return { ...n, fontSize: Math.max(8, Math.round((n.fontSize ?? 24) * k)) };
          const w = (n.width ?? 100) * k; const h = (n.height ?? 100) * k;
          return { ...n, x: Math.round(n.x - (w - (n.width ?? 100)) / 2), y: Math.round(n.y - (h - (n.height ?? 100)) / 2), width: Math.round(w), height: Math.round(h) };
        }));
        break;
      }
      case "background": {
        if (op.prompt) {
          pictures.push({ into: "background", prompt: op.prompt, aspect: aspectFor(S().w, S().h) });
          break;
        }
        const parts = op.colour.split(">").map((x) => colourOf(x)).filter((x): x is string => !!x);
        if (parts.length >= 2) doc = { ...doc, background: { ...doc.background, gradientId: "custom", customGradient: { from: parts[0], to: parts[1] }, src: null, scrim: 0 } };
        else if (parts.length === 1) doc = { ...doc, background: { ...doc.background, color: parts[0], gradientId: null, src: null, scrim: 0 } };
        else if (/grid/i.test(op.colour)) doc = { ...doc, background: { ...doc.background, color: C.light, gradientId: null, src: "/social/grid-light.svg", scrim: 0 } };
        else break;
        changed = true;
        break;
      }
      case "picture": {
        if (!op.prompt) break;
        if (op.position === "background") { pictures.push({ into: "background", prompt: op.prompt, aspect: aspectFor(S().w, S().h) }); break; }
        if (target && (target.kind === "rect" || target.kind === "ellipse" || target.kind === "image")) {
          pictures.push({ into: { node: target.id }, prompt: op.prompt, aspect: aspectFor(target.width ?? 1, target.height ?? 1) });
          break;
        }
        // a new frame where it was asked for: half the board, on its side
        const s = S();
        const wide = shapeOf(s) === "wide";
        const w = Math.round(wide ? s.w * 0.42 : s.w * 0.84);
        const h = Math.round(wide ? s.h * 0.78 : s.h * 0.42);
        const at = boxAt(op.position === "none" || op.position === "frame" ? (wide ? "right" : "bottom") : op.position, s, w, h);
        const f = frameNode(at.x, at.y, w, h, Math.round(Math.min(s.w, s.h) * 0.028));
        setNodes([...doc.nodes, f]);
        pictures.push({ into: { node: f.id }, prompt: op.prompt, aspect: aspectFor(w, h) });
        break;
      }
      case "logo": {
        const s = S();
        const dark = darkPage(doc);
        const key: LogoKey = /white/i.test(op.colour) ? "white" : /colou?r|red/i.test(op.colour) ? "colour" : dark ? "white" : "black";
        const lh = Math.round(40 * Math.min(s.w / 1080, Math.sqrt(s.w * s.h) / 1080));
        const probe = logoNode(key, 0, 0, lh);
        const letterW = (probe.width ?? 0) * LOGOS[key].box.w;
        const at = boxAt(op.position === "none" || op.position === "background" || op.position === "frame" ? "top-left" : op.position, s, letterW, lh);
        // the logos already there make way: one logo on a page
        const rest = doc.nodes.filter((n) => !(n.kind === "image" && Object.values(LOGOS).some((l) => l.src === n.src)));
        setNodes([...rest, logoNode(key, at.x, at.y, lh)]);
        break;
      }
      case "template": {
        const t = op.template ? templateByKey(op.template) : null;
        if (!t) break;
        doc = t.build(S(), { ...t.words, ...op.words }, mf);
        changed = true;
        if (op.prompt) {
          const frame = doc.nodes.find((n) => n.kind === "image" && !Object.values(LOGOS).some((l) => l.src === n.src));
          if (frame) pictures.push({ into: { node: frame.id }, prompt: op.prompt, aspect: aspectFor(frame.width ?? 1, frame.height ?? 1) });
          else if (doc.background.src && !doc.background.src.startsWith("/social/")) pictures.push({ into: "background", prompt: op.prompt, aspect: aspectFor(S().w, S().h) });
        }
        break;
      }
      case "pages": {
        if (!op.slides.length) break;
        pages = op.slides.map((sl, i) => {
          const t = templateByKey(sl.template) ?? TEMPLATES[0];
          const d = t.build(S(), { ...t.words, ...sl.words }, mf);
          if (sl.prompt) {
            const frame = d.nodes.find((n) => n.kind === "image" && !Object.values(LOGOS).some((l) => l.src === n.src));
            if (frame) pictures.push({ into: { node: frame.id }, prompt: sl.prompt, aspect: aspectFor(frame.width ?? 1, frame.height ?? 1), page: i });
            else if (d.background.src && !d.background.src.startsWith("/social/")) pictures.push({ into: "background", prompt: sl.prompt, aspect: aspectFor(S().w, S().h), page: i });
          }
          return d;
        });
        break;
      }
      case "format": {
        if (op.format) format = op.format;
        break;
      }
    }
  }
  return { doc: changed ? doc : null, pages, format, pictures, skipped };
}

/* ── the Text panel's AI: words from a description ─────────────────────────────────────────────────────────────── */

export const WORDS_STYLES = ["poster", "headline", "list", "quote", "number"] as const;
export type WordsStyle = (typeof WORDS_STYLES)[number];

export const WORDS_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      description: "The texts, top to bottom, 1 to 6. Key words between *stars* (one or two per text at most).",
      items: {
        type: "object",
        properties: { role: { type: "string", enum: [...TEXT_ROLES] }, text: { type: "string" } },
        required: ["role", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["blocks"],
  additionalProperties: false,
} as const;

export const STYLE_GUIDE: Record<WordsStyle, string> = {
  poster: "A type poster as in our films: a headline of 2 to 4 very short lines (one to three words each, a line break \\n between them), the last line or one key word between stars; then one short body line. Roles: headline, body.",
  headline: "A kicker of one to three words, a headline of at most 8 words with one key word between stars, one or two short body sentences, and a call to action of two or three words. Roles: eyebrow, headline, body, cta.",
  list: "A headline of at most 7 words with a key word, then a list of 3 to 5 short points (one per line, \\n between them, no bullets typed). Roles: headline, list.",
  quote: "The quote as the person said it (only words given in the description - never invent a quote), then who said it. Roles: quote, caption.",
  number: "A big figure (only one given in the description or the brief - never invent one), what it means in at most 6 words with a key word, one short line under it. Roles: number, headline, body.",
};

/** The words from the model: known roles, short, at most six. */
export function cleanWordsAnswer(raw: unknown): { blocks: { role: TextRole; text: string }[] } {
  const list = Array.isArray(obj(raw).blocks) ? (obj(raw).blocks as unknown[]) : [];
  return {
    blocks: list.slice(0, 6).map((b) => ({ role: isTextRole(obj(b).role) ? (obj(b).role as TextRole) : "body", text: str(obj(b).text, 500).replace(/\\n/g, "\n") }))
      .filter((b) => plainText(b.text).trim()),
  };
}

/** The words placed on the page: the texts there (not the logo) replaced, or added. */
export function placeWords(page: DesignDocument, blocks: { role: TextRole; text: string }[], replace: boolean, mf: MeasureFor = estimateFor): DesignDocument {
  const gone = (n: DesignNode) => n.kind === "text" || (n.kind === "rect" && !!n.groupId && page.nodes.some((t) => t.kind === "text" && t.groupId === n.groupId));
  const keep = replace ? page.nodes.filter((n) => !gone(n)) : page.nodes;
  // the new words start where the old ones did (the picture and the logo keep their places)
  const old = replace ? page.nodes.filter((n) => n.kind === "text") : [];
  const top = old.length ? Math.min(...old.map((n) => n.y)) : undefined;
  const placed = composeWords(blocks, page.canvas, mf, { dark: darkPage(page), place: "middle", top });
  return { ...page, nodes: [...keep, ...placed] };
}
