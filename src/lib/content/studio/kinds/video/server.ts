// VIDEO - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026; 09.11.2026 the end card's own asks). The AI tasks (ai.ts holds their words and their cleaning,
// tested) and one action:
//   export   "Export for rendering": the story as a spec for the render machine (scripts/content-video/render.mjs) -
//            the hub itself cannot render (AWS Fargate: no Chromium, no GPU). Refused while the film holds a discount
//            value or a price; its advice comes along.
//   features which of APSOparts' features (features.ts) the brand brain still names - the picker marks the others
import type { AiTask, KindDef, StudioCtx } from "../../contract";
import { readBrain } from "@/lib/brain";
import { confirmedBy } from "./features";
import {
  cleanEnd, cleanLine, cleanScene, cleanStoryboard, cleanTighten, cleanTranslate, cleanVariant, END_SCHEMA, endUser, FILM_RULES, LINE_SCHEMA, lineUser, reviseUser, SCENE_SCHEMA, sceneUser,
  STORYBOARD_SCHEMA, storyboardUser, TIGHTEN_SCHEMA, tightenUser, TRANSLATE_SCHEMA, TRANSLATE_SYSTEM, translateUser, VARIANT_SCHEMA, variantUser,
} from "./ai";
import { cleanVideo, emptyVideo, FORMATS, inLanguage, languagesOf, toSpec, validate, videoText, type Format } from "./model";

const storyboard: AiTask = {
  label: "Write the storyboard",
  schema: STORYBOARD_SCHEMA,
  system: FILM_RULES,
  user: storyboardUser,
  maxTokens: 6000,
  clean: (raw, doc, ctx, input) => cleanStoryboard(raw, doc, ctx, input),
};

export const videoKind: KindDef = {
  kind: "video",
  channel: "linkedin",
  empty: (ctx: StudioCtx) => emptyVideo({ language: ctx.piece.language }),
  toText: videoText,
  tasks: {
    storyboard,
    tighten: { label: "Shorten every line", schema: TIGHTEN_SCHEMA, system: FILM_RULES, user: (ctx, doc) => tightenUser(ctx, doc), maxTokens: 5000, clean: (raw, doc) => cleanTighten(raw, doc) },
    variant: { label: "Another opening", schema: VARIANT_SCHEMA, system: FILM_RULES, user: variantUser, maxTokens: 3000, clean: (raw, doc, ctx, input) => cleanVariant(raw, doc, ctx, input) },
    revise: { label: "Change it", schema: STORYBOARD_SCHEMA, system: FILM_RULES, user: reviseUser, maxTokens: 6000, clean: (raw, doc, ctx, input) => cleanStoryboard(raw, doc, ctx, input) },
    end: { label: "Change the end card", schema: END_SCHEMA, system: FILM_RULES, user: endUser, maxTokens: 1200, effort: "low", clean: (raw, doc, _ctx, input) => cleanEnd(raw, doc, input) },
    scene: { label: "Change one scene", schema: SCENE_SCHEMA, system: FILM_RULES, user: sceneUser, maxTokens: 2500, effort: "low", clean: (raw, doc, ctx, input) => cleanScene(raw, doc, ctx, input) },
    // cv16 (11.11.2026, the Page builder's bar): one line's own "Ask AI", and a language version of every line
    line: { label: "Change one line", schema: LINE_SCHEMA, system: FILM_RULES, user: lineUser, maxTokens: 1200, effort: "low", clean: (raw, doc, ctx, input) => cleanLine(raw, doc, ctx, input) },
    translate: { label: "Translate the film", schema: TRANSLATE_SCHEMA, system: TRANSLATE_SYSTEM, user: translateUser, maxTokens: 6000, clean: (raw, doc, ctx, input) => cleanTranslate(raw, doc, ctx, input) },
  },
  actions: {
    features: async () => ({ confirmed: confirmedBy(JSON.stringify(await readBrain())) }),
    export: async (ctx, doc, input) => {
      const d = cleanVideo(doc, { language: ctx.piece.language });
      const format = (FORMATS as readonly string[]).includes(String(input.format)) ? (input.format as Format) : d.format;
      // one language a file (cv16): the film's own, or one of its versions - its words checked as they go out
      const lang = typeof input.lang === "string" && languagesOf(d).includes(input.lang.toUpperCase()) ? input.lang.toUpperCase() : d.language;
      const issues = validate(inLanguage(d, lang));
      const stops = issues.filter((i) => i.level === "stop");
      if (stops.length) return { spec: null, issues, lang };
      return { spec: toSpec(d, { title: ctx.piece.title, pieceId: ctx.pieceId, at: new Date().toISOString(), format, lang }), issues, lang };
    },
  },
};
