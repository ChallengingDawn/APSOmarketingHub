import { z } from "zod";

// Persist plain data rather than Konva instances. The schema version lets future
// editors migrate documents without discarding the user's editable source.
const number = z.number().finite();
const color = z.string().max(100);
const imageSource = z.string().max(8 * 1024 * 1024).refine(
  (s) => /^\/(?!\/)/.test(s) || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(s)
    || /^data:image\/svg\+xml(?:;base64)?,/.test(s),
  "Use an uploaded image or an asset from this workspace",
);

export const designNodeSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["text", "rect", "image", "ellipse", "arrow", "scrim", "table", "chart"]),
  x: number.min(-100000).max(100000), y: number.min(-100000).max(100000),
  fill: color,
  text: z.string().max(200000).optional(),
  fontKey: z.enum(["inter", "outfit", "georgia", "mono"]).optional(),
  fontSize: number.positive().max(5000).optional(),
  fontStyle: z.string().max(100).optional(),
  width: number.nonnegative().max(20000).optional(),
  height: number.nonnegative().max(20000).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  cornerRadius: number.nonnegative().max(10000).optional(),
  lineHeight: number.positive().max(100).optional(),
  opacity: number.min(0).max(1).optional(),
  src: imageSource.optional(),
  letterSpacing: number.min(-1000).max(1000).optional(),
  /**
   * Type on a curve: -100 hangs under the circle, 0 is a straight line, 100
   * arches over it. Stored as the bow rather than an angle - see
   * src/lib/editor/curvedText.ts.
   */
  curve: number.min(-100).max(100).optional(),
  shadow: z.boolean().optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(),
  rotation: number.min(-36000).max(36000).optional(),
  background: z.boolean().optional(), backgroundFill: color.optional(),
  underline: z.boolean().optional(), upper: z.boolean().optional(),
  /**
   * Drawn as a list: one item per line, markers added at render time. A
   * property of the text rather than a new kind of node, so a list stays
   * editable as the words somebody wrote - see src/lib/editor/lists.ts.
   */
  listStyle: z.enum(["bullet", "number", "check", "dash"]).optional(),
  stroke: color.optional(), strokeWidth: number.nonnegative().max(1000).optional(),
  flipH: z.boolean().optional(), flipV: z.boolean().optional(),
  brightness: number.min(-100).max(100).optional(),
  /** Softens a photograph so text over it stays readable. 0-60px. */
  blur: number.min(0).max(60).optional(),
  /**
   * The shape the image is cut to. A rectangle is the absence of a mask, so
   * it is the default and costs nothing to store.
   */
  mask: z.enum(["circle", "rounded"]).optional(),
  /**
   * The part of the photograph that is shown, as FRACTIONS of the source.
   * Not pixels: the same design is opened against a 1200px web render and a
   * 4000px original, and a crop in pixels would be a different picture in
   * each. See src/lib/editor/crop.ts.
   */
  crop: z.object({
    x: number.min(0).max(1), y: number.min(0).max(1),
    w: number.min(0.001).max(1), h: number.min(0.001).max(1),
  }).strict().optional(),
  contrastVal: number.min(-100).max(100).optional(), grayscale: z.boolean().optional(),

  /* ── a table ── */
  /**
   * The cells, first row the header. Plain strings: a spec table holds
   * "-20 °C to +120 °C" and "on request" as often as it holds a number, and
   * typing a dimension into a cell that insists on being numeric is the
   * reason people go back to pasting a screenshot.
   */
  rows: z.array(z.array(z.string().max(500)).max(12)).max(60).optional(),
  /** Column widths as fractions. Normalised at layout, never trusted. */
  colFractions: z.array(number.min(0).max(1)).max(12).optional(),

  /* ── a chart ── */
  chartKind: z.enum(["column", "bar", "line", "donut"]).optional(),
  series: z.array(z.object({
    label: z.string().max(60),
    value: number.min(-1e12).max(1e12),
  }).strict()).max(40).optional(),
  /** Whether each category gets its own colour, or the series gets one. */
  multicolour: z.boolean().optional(),
  /** The number on each mark. Off for a chart that is a shape, not a table. */
  showValues: z.boolean().optional(),
}).strict();

export const designDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  canvas: z.object({ w: number.int().min(64).max(8192), h: number.int().min(64).max(8192) }).strict()
    .refine((c) => c.w * c.h <= 32_000_000, "Artboard is too large"),
  background: z.object({
    color, gradientId: z.string().max(100).nullable(),
    customGradient: z.object({ from: color, to: color }).strict(),
    src: imageSource.nullable(), scrim: number.min(0).max(100),
  }).strict(),
  nodes: z.array(designNodeSchema).max(500).refine(
    (nodes) => new Set(nodes.map((n) => n.id)).size === nodes.length, "Layer IDs must be unique",
  ),
}).strict();

/**
 * Stable serialization for change detection. A document that has been through
 * PostgreSQL comes back carrying jsonb's key order (by key length, then
 * bytewise), which never matches the order the editor builds its objects in.
 * Sorting keys at every level keeps "has this design actually changed?"
 * independent of how the document happened to travel.
 */
export function canonicalDesign(doc: unknown): string {
  return JSON.stringify(doc, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>).sort()
            .map((k) => [k, (value as Record<string, unknown>)[k]]),
        )
      : value,
  );
}

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type DesignNode = z.infer<typeof designNodeSchema>;
