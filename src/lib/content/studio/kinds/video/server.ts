// VIDEO - WHAT ITS STUDIO ASKS OF THE SERVER (08.11.2026). The AI tasks (ai.ts holds their words and their cleaning,
// tested) and one action:
//   export   "Export for rendering": the story as a spec for the render machine (scripts/content-video/render.mjs) -
//            the hub itself cannot render (AWS Fargate: no Chromium, no GPU). Refused while the film holds a discount
//            value or a price; its advice comes along.
//   features which of APSOparts' features (features.ts) the brand brain still names - the picker marks the others
import type { AiTask, KindDef, StudioCtx } from "../../contract";
import { readBrain } from "@/lib/brain";
import { confirmedBy } from "./features";
import { cleanStoryboard, cleanTighten, cleanVariant, FILM_RULES, reviseUser, STORYBOARD_SCHEMA, storyboardUser, TIGHTEN_SCHEMA, tightenUser, VARIANT_SCHEMA, variantUser } from "./ai";
import { cleanVideo, emptyVideo, FORMATS, toSpec, validate, videoText, type Format } from "./model";

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
  },
  actions: {
    features: async () => ({ confirmed: confirmedBy(JSON.stringify(await readBrain())) }),
    export: async (ctx, doc, input) => {
      const d = cleanVideo(doc, { language: ctx.piece.language });
      const format = (FORMATS as readonly string[]).includes(String(input.format)) ? (input.format as Format) : d.format;
      const issues = validate(d);
      const stops = issues.filter((i) => i.level === "stop");
      if (stops.length) return { spec: null, issues };
      return { spec: toSpec(d, { title: ctx.piece.title, pieceId: ctx.pieceId, at: new Date().toISOString(), format }), issues };
    },
  },
};
