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
  kind: z.enum(["text", "rect", "image", "ellipse", "arrow", "scrim"]),
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
  shadow: z.boolean().optional(), locked: z.boolean().optional(), hidden: z.boolean().optional(),
  rotation: number.min(-36000).max(36000).optional(),
  background: z.boolean().optional(), backgroundFill: color.optional(),
  underline: z.boolean().optional(), upper: z.boolean().optional(),
  stroke: color.optional(), strokeWidth: number.nonnegative().max(1000).optional(),
  flipH: z.boolean().optional(), flipV: z.boolean().optional(),
  brightness: number.min(-100).max(100).optional(),
  contrastVal: number.min(-100).max(100).optional(), grayscale: z.boolean().optional(),
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

export type DesignDocument = z.infer<typeof designDocumentSchema>;
export type DesignNode = z.infer<typeof designNodeSchema>;
