// VIDEO - WHAT THE AI IS ASKED, AND WHAT IS KEPT OF ITS ANSWER (08.11.2026). Pure - tests/studio-video.test.ts.
// The route puts the brand's voice in front (brandSystemPrompt); these add the film's own rules:
//   storyboard  from the brief and the to-do: 5-8 scenes of our kinds, few words a line, the piece's language, an end card;
//               with features picked (features.ts - SARCLA 08.11.2026: "select a feature or key winning point of APSO"),
//               a film around them: a scene per feature (its claim, its proof, its visual), then the end card
//   tighten     every line shorter (a customer's quote is never touched - those are their words)
//   variant     another opening shot, the rest kept
//   revise      the storyboard changed the way the person asks in their own words, the rest kept
//   scene       ONE scene changed (SARCLA 08.11.2026: the controls "really hard" - the AI for one scene): shorter, another
//               feature, or the person's own words; every other scene stays as it is
// Whatever comes back is cleaned before the studio sees it: a discount value or a price is dropped, a quote that is
// not word for word in what the team gave us is dropped, the kinds and bars are held to the library's.

import { LANGUAGE_BY_CODE } from "../../../languages";
import { photoByKey } from "../banner/brand";
import { cleanVideo, COPY_KEYS, forbidden, KIND_INFO, SCENE_KINDS, SHAPES, END_FIELDS, videoText, type CopyKey, type Scene, type SceneKind, type VideoDoc } from "./model";
import { plain } from "./engine/text";
import { FEATURE, FEATURES, ICONS, featuresBrief, isFeature, isIcon, numberAllowed, type FeatureKey } from "./features";
import { PARTS, isPart } from "./parts";
import { wordCount } from "./engine/text";

/** What the tasks read of the studio's context (StudioCtx has it all). */
export type VideoCtx = {
  projectTitle: string;
  brief: { goal: string; audience: string; message: string; keywords: string[] };
  piece: { id: number; title: string; language: string | null };
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// ───────────────────────── the rules the model is given ─────────────────────────

const KINDS_DOC = SCENE_KINDS.map((k) => {
  const i = KIND_INFO[k];
  const fields = i.fields.map((f) => `${f.key} = ${f.label.toLowerCase()} (max ${f.words} words${f.required ? "" : ", may be empty"})`).join("; ");
  return `- ${k}: ${i.blurb} Fields: ${fields}. ${i.bars.min}-${i.bars.max} bars.`;
}).join("\n");

export const FILM_RULES = [
  `# THIS TASK: ON-SCREEN TEXT FOR A MOTION-GRAPHICS FILM`,
  `The channel rules above are for posts; they do NOT apply here (no hashtags, no paragraphs, no post length). This is a short film in APSOparts' motion-graphics style: big kinetic words on screen, no voice-over, cut on the beat of 120 BPM music. A bar is 2 seconds; every scene lasts whole bars.`,
  `The scene kinds (use only these):`,
  KINDS_DOC,
  `Rules - all of them, always:`,
  `- Few words: every line is read in under two seconds. Keep to each field's word limit; fewer is better. One idea per scene.`,
  `- Mark ONE key word per scene (at most) with *stars*, e.g. "Cut to *your* size". It shows in red. Never a whole line.`,
  `- NEVER a discount value: no percentages, no "up to 20%", no amounts off. No prices, no currency amounts.`,
  `- Nothing invented: no numbers, delivery times, stock levels, certifications, customer names or claims that are not in the brief, the to-do or the brand facts above. If you have no verified fact, say the benefit without a number.`,
  `- A "quote" scene ONLY with words a customer said that are given word for word in the brief; otherwise never use the quote kind.`,
  `- Sentence case, no all-caps words, no exclamation marks except at most one on the end card, no emoji.`,
  `- The part (title and product scenes): one of our real parts, shown as the shop's own product photo - ${PARTS.map((x) => `"${x.key}" (${x.name}, ${x.note.toLowerCase()})`).join(", ")}. Pick the one that suits the audience (e.g. red silicone for food plants, brown FKM for chemicals and heat, black NBR in general), or "" for none (a title may have none). Other kinds: "". Set "shape" to "oring" for an O-ring, X-ring or V-ring part, "seal" for the shaft seal, "none" without a part.`,
  `- APSOparts features: only the ones listed in the question, only their own facts. A scene that tells one sets "feature" to its key and "icon" to its icon; any other scene sets both to "". A "number" scene shows ONLY a figure listed for its feature - never another number.`,
  `- The end card shows the APSOparts logo big; give its line (max ${END_FIELDS[0].words} words, may carry one *key* word) and the button text (max ${END_FIELDS[1].words} words; the shop address "apsoparts.com" or a short action).`,
].join("\n");

// ───────────────────────── the answers' shapes ─────────────────────────

const sceneSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...SCENE_KINDS] },
    bars: { type: "integer", description: "1 to 4 - whole bars of 2 seconds" },
    kicker: { type: "string" }, line1: { type: "string" }, line2: { type: "string" }, line3: { type: "string" }, sub: { type: "string" },
    shape: { type: "string", enum: [...SHAPES] },
    part: { type: "string", enum: ["", ...PARTS.map((x) => x.key)], description: "The real part the scene shows (title and product scenes), or empty" },
    feature: { type: "string", enum: ["", ...FEATURES.map((f) => f.key)], description: "The APSOparts feature this scene tells, or empty" },
    icon: { type: "string", enum: ["", ...ICONS], description: "The feature's icon (feature and number scenes), or empty" },
  },
  required: ["kind", "bars", "kicker", "line1", "line2", "line3", "sub", "shape", "part", "feature", "icon"],
  additionalProperties: false,
} as const;

export const STORYBOARD_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    scenes: { type: "array", items: sceneSchema },
    endLine: { type: "string" },
    cta: { type: "string" },
    note: { type: "string", description: "One short sentence to the person: what the film says, or what fact is missing to make it stronger." },
  },
  required: ["scenes", "endLine", "cta", "note"],
  additionalProperties: false,
};

export const TIGHTEN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, kicker: { type: "string" }, line1: { type: "string" }, line2: { type: "string" }, line3: { type: "string" }, sub: { type: "string" } },
        required: ["id", "kicker", "line1", "line2", "line3", "sub"],
        additionalProperties: false,
      },
    },
    endLine: { type: "string" },
    cta: { type: "string" },
    note: { type: "string" },
  },
  required: ["scenes", "endLine", "cta", "note"],
  additionalProperties: false,
};

export const SCENE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: { scene: sceneSchema, note: { type: "string", description: "One short sentence to the person: what changed." } },
  required: ["scene", "note"],
  additionalProperties: false,
};

export const VARIANT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: { opening: sceneSchema, note: { type: "string" } },
  required: ["opening", "note"],
  additionalProperties: false,
};

// ───────────────────────── the question ─────────────────────────

export function languageOf(code: string | null | undefined): string {
  const c = (code || "EN").toUpperCase();
  return LANGUAGE_BY_CODE[c]?.instruction ?? c;
}

/** The context every task starts from: the project, its brief, the to-do, the language, the storyboard as it is. */
export function context(ctx: VideoCtx, doc: unknown): string {
  const d = cleanVideo(doc, { language: ctx.piece.language });
  const b = ctx.brief;
  return [
    `Project: ${ctx.projectTitle || "(untitled)"}`,
    `The brief:`,
    `- Goal: ${b.goal || "(not given)"}`,
    `- Audience: ${b.audience || "(not given)"}`,
    `- Key message: ${b.message || "(not given)"}`,
    `- Keywords: ${b.keywords?.length ? b.keywords.join(", ") : "(none)"}`,
    `The to-do: ${ctx.piece.title}`,
    `Write every word on screen in: ${languageOf(d.language || ctx.piece.language)}.`,
    `Format: ${d.format} (the same words play in 16:9, 9:16 and 1:1).`,
    ``,
    `The storyboard as it is now:`,
    d.scenes.length ? videoText(d) : "(empty - no scenes yet)",
  ].join("\n");
}

/** The features a film is made around: the ones asked for, else the ones the film already holds. */
export function pickedFeatures(doc: unknown, input: Record<string, unknown> = {}): FeatureKey[] {
  const asked = Array.isArray(input.features) ? input.features.filter(isFeature) : [];
  const held = cleanVideo(doc).features ?? [];
  return [...new Set(asked.length ? asked : held)].slice(0, 6);
}

/** The film's length in seconds: the one asked for, else the one the film keeps, else none. */
export function lengthOf(doc: unknown, input: Record<string, unknown> = {}): number | null {
  const n = Number(input.seconds ?? cleanVideo(doc).length);
  return [15, 20, 30].includes(n) ? n : null;
}

export const storyboardUser = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => {
  const feats = pickedFeatures(doc, input);
  const secs = lengthOf(doc, input);
  // a bar is 2 s; the end card takes 2 of them
  const aim = secs ? `The film lasts about ${secs} seconds in all: ${Math.round(secs / 2) - 2} bars of scenes, then the 2-bar end card (${secs <= 15 ? "3 or 4 scenes" : secs <= 20 ? "4 to 6 scenes" : "6 to 9 scenes"}).` : "";
  return [
    context(ctx, doc),
    ``,
    feats.length
      ? [
        `Make the film around these APSOparts features, in this order - ${feats.length === 1 ? "one feature, told in two or three scenes" : "one or two scenes per feature"}:`,
        featuresBrief(feats),
        ``,
        `For each feature: its claim, its proof, its visual - use one of its scene kinds (a "feature" scene carries the claim, the proof and its icon; a "number" scene its figure; "compare" the old way against the APSOparts way; "steps" how it works). Translate the claim and the proof into the film's language; do not add facts. Open with one calm scene that says what the film is about, then the features, then the end card (its line sums them up). ${aim || (feats.length > 3 ? "Keep it under 30 seconds: one scene per feature." : "Aim for 16-26 seconds in all.")}`,
      ].join("\n")
      : `Write the film's storyboard: 5 to 8 scenes of our kinds, then the end card. ${aim || "Aim for 18-26 seconds in all (the end card is 2 bars)."} Open calm (a title or a claim), build, land the benefit, then the end card. A new scene every bar or two.`,
    str(input.ask, 600) ? `What the person asks: ${str(input.ask, 600)}` : "",
  ].filter(Boolean).join("\n");
};

export const reviseUser = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => [
  context(ctx, doc),
  pickedFeatures(doc, input).length ? `\nThe film's APSOparts features (only these, only their facts):\n${featuresBrief(pickedFeatures(doc, input))}` : "",
  ``,
  `Change the storyboard the way the person asks; keep every scene they did not ask about exactly as it is (same kind, bars and words). Give back the whole storyboard.`,
  `What the person asks: ${str(input.ask, 800) || "(nothing - make it stronger)"}`,
].join("\n");

export const tightenUser = (ctx: VideoCtx, doc: unknown) => {
  const d = cleanVideo(doc, { language: ctx.piece.language });
  const rows = d.scenes.map((s) => `- id ${s.id} (${s.kind}): ${KIND_INFO[s.kind].fields.map((f) => `${f.key}="${s.copy[f.key] ?? ""}"`).join(", ")}`);
  return [
    context(ctx, doc),
    ``,
    `Shorten every line: fewer words, the same meaning, the same language, keep the *key* word marks where they still fit. Return every scene by its id with all five fields (empty where the scene has none). Leave quote scenes exactly as they are - they are a customer's words.`,
    ...rows,
    `End card: endLine="${d.endCard.line}", cta="${d.endCard.cta}"`,
  ].join("\n");
};

/** The features one scene may tell when it is asked for "another feature": the film's own first, then the others. */
export function featuresForScene(doc: unknown, index: number): FeatureKey[] {
  const d = cleanVideo(doc);
  const told = new Set(d.scenes.filter((_, i) => i !== index).map((x) => x.feature).filter(Boolean));
  const own = d.features ?? [];
  const mine = d.scenes[index]?.feature;
  const order = [...own, ...FEATURES.map((f) => f.key).filter((k) => !own.includes(k))];
  return order.filter((k) => k !== mine && !told.has(k));
}

export const sceneUser = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => {
  const d = cleanVideo(doc, { language: ctx.piece.language });
  const i = Math.max(0, Math.min(d.scenes.length - 1, Math.round(Number(input.index) || 0)));
  const sc = d.scenes[i];
  const how = String(input.how ?? "ask");
  const row = sc ? `scene ${i + 1} (${sc.kind}, ${sc.bars} bar${sc.bars > 1 ? "s" : ""}${sc.feature ? `, tells "${sc.feature}"` : ""}): ${KIND_INFO[sc.kind].fields.map((f) => `${f.key}="${sc.copy[f.key] ?? ""}"`).join(", ")}` : "(no such scene)";
  const others = featuresForScene(doc, i).slice(0, 6);
  const ask = how === "shorter"
    ? `Make it shorter: fewer words in every line, the same meaning, the same kind and language. Keep the *key* word mark where it still fits.`
    : how === "feature"
      ? `Make it tell ANOTHER APSOparts feature - the first of these that suits the film, in the kind that tells it best:\n${featuresBrief(others)}`
      : `What the person asks for this scene: ${str(input.ask, 600) || "(nothing - make it stronger)"}`;
  return [
    context(ctx, doc),
    pickedFeatures(doc).length && how !== "feature" ? `\nThe film's APSOparts features (only these, only their facts):\n${featuresBrief(pickedFeatures(doc))}` : "",
    ``,
    `Change ONLY this scene and give it back as "scene"; every other scene stays as it is.`,
    row,
    ask,
  ].filter(Boolean).join("\n");
};

export const variantUser = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => {
  const d = cleanVideo(doc, { language: ctx.piece.language });
  const first = d.scenes[0];
  return [
    context(ctx, doc),
    ``,
    first ? `Write another opening scene to replace scene 1 (${first.kind}): a different angle on the same film - calm, one idea, it must lead into scene 2.` : `Write an opening scene for this film - calm, one idea.`,
    str(input.ask, 400) ? `What the person asks: ${str(input.ask, 400)}` : "",
  ].filter(Boolean).join("\n");
};

// ───────────────────────── what is kept ─────────────────────────

const norm = (s: string) => plain(s).toLowerCase().replace(/[“”„«»"'‘’.,;:!?()\-–—]/g, " ").replace(/\s+/g, " ").trim();

/** Words a quote may be: found word for word in what the team gave (the brief, the ask, a quote already in the film). */
export function quoteAllowed(text: string, sources: string[]): boolean {
  const q = norm(text);
  if (!q) return false;
  return sources.some((s) => norm(s).includes(q));
}

const sourcesOf = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => {
  const d = cleanVideo(doc);
  return [ctx.brief.goal, ctx.brief.audience, ctx.brief.message, ...(ctx.brief.keywords ?? []), str(input.ask, 2000),
    ...d.scenes.filter((s) => s.kind === "quote").map((s) => s.copy.line1 ?? "")].filter(Boolean);
};

/** A line kept, or "" when it carries what the film never shows (and why, into `dropped`). */
function keep(v: unknown, max: number, dropped: string[]): string {
  const s = str(v, max);
  if (!s) return "";
  const bad = forbidden(s);
  if (bad) { dropped.push(`"${plain(s)}" (${bad.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())})`); return ""; }
  return s;
}

/** One scene of an answer, as a scene of the film (null when nothing of it can be kept). `allowed` = the film's features. */
export function sceneFrom(raw: unknown, id: string, sources: string[], dropped: string[], allowed: FeatureKey[] = []): Scene | null {
  if (!isObj(raw)) return null;
  const kind = (SCENE_KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as SceneKind) : null;
  if (!kind) return null;
  const info = KIND_INFO[kind];
  const copy: Partial<Record<CopyKey, string>> = {};
  for (const f of info.fields) {
    const v = keep(raw[f.key], Math.max(f.chars * 2, 60), dropped);
    if (v) copy[f.key] = v;
  }
  // lines that follow one another close up when one was dropped (words, steps)
  if (kind === "words" || kind === "steps") {
    const ls = [copy.line1, copy.line2, copy.line3].filter((x): x is string => !!x);
    copy.line1 = ls[0]; copy.line2 = ls[1]; copy.line3 = ls[2];
    for (const k of ["line1", "line2", "line3"] as const) if (!copy[k]) delete copy[k];
  }
  if (kind === "quote" && !quoteAllowed(copy.line1 ?? "", sources)) {
    if (copy.line1) dropped.push(`a quote nobody gave us ("${plain(copy.line1)}")`);
    return null;
  }
  if (!info.fields.some((f) => f.required && copy[f.key])) return null;
  // a feature only of the film's own; a figure only one its feature states
  const feature = isFeature(raw.feature) && allowed.includes(raw.feature) ? raw.feature : undefined;
  if (kind === "number" && !numberAllowed(plain(copy.line1 ?? ""), feature ? [feature] : allowed)) {
    dropped.push(`a figure no feature of ours states ("${plain(copy.line1 ?? "")}")`);
    return null;
  }
  const icon = isIcon(raw.icon) ? raw.icon : feature ? FEATURE[feature].icon : undefined;
  const part = info.shape && isPart(raw.part) ? raw.part : undefined;
  // a feature with a shop photo of its own shows it, where the scene takes a picture
  const photo = feature && info.image && FEATURE[feature].photo ? photoByKey(FEATURE[feature].photo!)?.url : undefined;
  const bars = typeof raw.bars === "number" ? raw.bars : info.bars.start;
  return cleanVideo({ scenes: [{ id, kind, bars, copy, shape: raw.shape, part, feature, icon, image: photo }] }).scenes[0] ?? null;
}

export type AiAnswer = { doc: VideoDoc; note: string; dropped: string[] };

const fresh = (n: number, taken: Set<string>) => {
  let id = `s${n}`;
  for (let k = n; taken.has(id); k++) id = `s${k + 1}`;
  taken.add(id);
  return id;
};

/** A storyboard answer (storyboard, revise) as the whole film, keeping the format, the language and the notes. */
export function cleanStoryboard(raw: unknown, doc: unknown, ctx: VideoCtx, input: Record<string, unknown> = {}): AiAnswer {
  const cur = cleanVideo(doc, { language: ctx.piece.language });
  const r = isObj(raw) ? raw : {};
  const dropped: string[] = [];
  const sources = sourcesOf(ctx, doc, input);
  const allowed = pickedFeatures(doc, input);
  const matched = new Set<string>();
  const all = new Set(cur.scenes.map((s) => s.id));
  // a scene the person did not ask to change keeps its id, so its place in the studio stays put
  const scenes = (Array.isArray(r.scenes) ? r.scenes : []).slice(0, 10)
    .map((x, i) => {
      const same = cur.scenes.find((s) => !matched.has(s.id) && isObj(x) && s.kind === x.kind && plain(s.copy.line1 ?? "") === plain(str(x.line1)));
      const id = same ? (matched.add(same.id), same.id) : fresh(i + 1, all);
      return sceneFrom(x, id, sources, dropped, allowed);
    })
    .filter((s): s is Scene => !!s);
  const next = cleanVideo({ ...cur, features: allowed, scenes, endCard: { line: keep(r.endLine, 120, dropped), cta: keep(r.cta, 60, dropped) || cur.endCard.cta || "apsoparts.com", bars: cur.endCard.bars } }, { language: cur.language });
  return { doc: next, note: str(r.note, 300), dropped };
}

/** "Shorter": the new words laid on the scenes they belong to - never on a quote, never longer than before. */
export function cleanTighten(raw: unknown, doc: unknown): AiAnswer {
  const cur = cleanVideo(doc);
  const r = isObj(raw) ? raw : {};
  const dropped: string[] = [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const x of Array.isArray(r.scenes) ? r.scenes : []) if (isObj(x) && typeof x.id === "string") byId.set(x.id, x);
  const scenes = cur.scenes.map((s) => {
    const x = byId.get(s.id);
    if (!x || s.kind === "quote") return s;
    const copy = { ...s.copy };
    for (const f of KIND_INFO[s.kind].fields) {
      const before = s.copy[f.key] ?? "";
      const v = keep(x[f.key], Math.max(f.chars * 2, 60), dropped);
      if (v && plain(v).length <= plain(before).length) copy[f.key] = v;
    }
    return { ...s, copy };
  });
  const line = keep(r.endLine, 120, dropped);
  const cta = keep(r.cta, 60, dropped);
  const endCard = {
    ...cur.endCard,
    line: line && plain(line).length <= plain(cur.endCard.line).length ? line : cur.endCard.line,
    cta: cta && plain(cta).length <= plain(cur.endCard.cta).length ? cta : cur.endCard.cta,
  };
  return { doc: { ...cur, scenes, endCard }, note: str(r.note, 300), dropped };
}

/** "Another opening": the first scene replaced (or one put first when there is none). */
export function cleanVariant(raw: unknown, doc: unknown, ctx: VideoCtx, input: Record<string, unknown> = {}): AiAnswer {
  const cur = cleanVideo(doc, { language: ctx.piece.language });
  const r = isObj(raw) ? raw : {};
  const dropped: string[] = [];
  const taken = new Set(cur.scenes.map((s) => s.id));
  const scene = sceneFrom(r.opening, fresh(cur.scenes.length + 1, taken), sourcesOf(ctx, doc, input), dropped, pickedFeatures(doc, input));
  if (!scene) return { doc: cur, note: str(r.note, 300) || "No opening came back that the film can use - try again.", dropped };
  return { doc: { ...cur, scenes: [scene, ...cur.scenes.slice(1)].slice(0, 12) }, note: str(r.note, 300), dropped };
}

/**
 * One scene changed: laid on its place, keeping its id (so the studio keeps it selected). "Shorter" never lengthens it;
 * "another feature" brings the new feature into the film's own list, so its figures may show.
 */
export function cleanScene(raw: unknown, doc: unknown, ctx: VideoCtx, input: Record<string, unknown> = {}): AiAnswer {
  const cur = cleanVideo(doc, { language: ctx.piece.language });
  const r = isObj(raw) ? raw : {};
  const dropped: string[] = [];
  const i = Math.round(Number(input.index));
  const old = Number.isInteger(i) ? cur.scenes[i] : undefined;
  if (!old) return { doc: cur, note: "That scene is not in the film any more.", dropped };
  const how = String(input.how ?? "ask");
  const allowed = how === "feature" ? [...pickedFeatures(doc), ...featuresForScene(doc, i)] : pickedFeatures(doc);
  const scene = sceneFrom(r.scene, old.id, sourcesOf(ctx, doc, input), dropped, allowed);
  if (!scene) return { doc: cur, note: str(r.note, 300) || "Nothing came back that the film can use - try again.", dropped };
  const words = (x: Scene) => KIND_INFO[x.kind].fields.reduce((n, f) => n + wordCount(x.copy[f.key] ?? ""), 0);
  if (how === "shorter" && (scene.kind !== old.kind || words(scene) > words(old))) {
    return { doc: cur, note: "The answer was not shorter - the scene stays as it was.", dropped };
  }
  // what the scene had that the answer does not say: its picture, its part, its cut
  const next: Scene = { ...scene, ...(old.image && KIND_INFO[scene.kind].image && !scene.image ? { image: old.image } : {}), ...(old.cut ? { cut: old.cut } : {}) };
  if (!scene.part && old.part && KIND_INFO[scene.kind].shape) next.part = old.part;
  const features = next.feature && !(cur.features ?? []).includes(next.feature) ? [...(cur.features ?? []), next.feature].slice(0, 6) : cur.features;
  return { doc: { ...cur, ...(features ? { features } : {}), scenes: cur.scenes.map((x, k) => (k === i ? next : x)) }, note: str(r.note, 300), dropped };
}

/** COPY_KEYS, for the studio's own use. */
export { COPY_KEYS };

// ───────────────────────── the end card alone (09.11.2026) ─────────────────────────

export const END_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    endLine: { type: "string", description: "The end card's line: few words, may carry one *key* word." },
    cta: { type: "string", description: "The button: the shop address \"apsoparts.com\" or a short action." },
    note: { type: "string", description: "One short sentence to the person: what changed." },
  },
  required: ["endLine", "cta", "note"],
  additionalProperties: false,
};

/** The end card asked again: shorter, another closing line, or the person's own words - the scenes are not touched. */
export const endUser = (ctx: VideoCtx, doc: unknown, input: Record<string, unknown>) => {
  const d = cleanVideo(doc, { language: ctx.piece.language });
  const how = String(input.how ?? "ask");
  const ask = how === "shorter"
    ? "Make the end card shorter: fewer words in its line, the same meaning and language; keep the button unless it can be shorter too."
    : how === "another"
      ? "Write another closing line for the end card - a different angle that sums up the film; the button stays an action or the shop address."
      : `What the person asks for the end card: ${str(input.ask, 600) || "(nothing - make it stronger)"}`;
  return [
    context(ctx, doc),
    pickedFeatures(doc).length ? `\nThe film's APSOparts features (only these, only their facts):\n${featuresBrief(pickedFeatures(doc))}` : "",
    ``,
    `Change ONLY the end card (its line and its button). Every scene stays exactly as it is.`,
    `End card now: line="${d.endCard.line}", button="${d.endCard.cta}"`,
    ask,
  ].filter(Boolean).join("\n");
};

/** The end card's answer laid on the film: its line and button only; "shorter" never longer than before. */
export function cleanEnd(raw: unknown, doc: unknown, input: Record<string, unknown> = {}): AiAnswer {
  const cur = cleanVideo(doc);
  const r = isObj(raw) ? raw : {};
  const dropped: string[] = [];
  const line = keep(r.endLine, 120, dropped);
  const cta = keep(r.cta, 60, dropped);
  if (!line) return { doc: cur, note: str(r.note, 300) || "No closing line came back that the film can use - try again.", dropped };
  if (String(input.how) === "shorter" && wordCount(line) > wordCount(cur.endCard.line)) return { doc: cur, note: "The answer was not shorter - the end card stays as it was.", dropped };
  return { doc: { ...cur, endCard: { ...cur.endCard, line, cta: cta || cur.endCard.cta } }, note: str(r.note, 300), dropped };
}
