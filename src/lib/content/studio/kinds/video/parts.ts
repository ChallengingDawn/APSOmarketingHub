// VIDEO - OUR REAL PARTS, AS THE FILM SHOWS THEM (08.11.2026; SARCLA: "O-ring is not realistic on video"). Pure.
//
// The film used to DRAW its O-ring and shaft seal (flat SVG circles). Now every part in a film is the shop's own product
// photo: the pictures of these articles on www.apsoparts.com (the 3D renders the shop shows), cut out of their white
// background once (scripts/content-video/parts-cutout.py) and kept beside the film's logo in public/video/parts - so the
// part can drop, hop and turn on the light stage with its own shadow, in the studio and on the render machine alike.
// `shop` and `photo` say where each comes from; nothing here is drawn or generated.

export type PartKey = "oring-nbr" | "oring-fkm" | "oring-vmq" | "oring-hnbr" | "xring" | "vring" | "shaft-seal";

export type Part = {
  key: PartKey;
  /** Its name in the studio's picker. */
  name: string;
  /** One line under it: the material and its colour. */
  note: string;
  /** The cut-out picture, under public/video (the film's own folder). */
  cut: string;
  /** Width over height of the cut-out. */
  ratio: number;
  /** The cut-out's own height in pixels - the film never draws it taller, so it stays sharp (the shop's photos are 500 px). */
  px: number;
  /** The article on the shop, and its photo there (the source of the cut-out). */
  shop: string;
  photo: string;
};

const MEDIA = "https://www.apsoparts.com/media/catalog/product/std.lang.all";

export const PARTS: Part[] = [
  { key: "oring-nbr", name: "O-ring NBR", note: "Black nitrile rubber", cut: "parts/oring-nbr.png", ratio: 262 / 381, px: 381, shop: "https://www.apsoparts.com/en-CH/11411201-normatecr-o-ring-nbr-70-00-01.html", photo: `${MEDIA}/62/56/296256.jpg` },
  { key: "oring-fkm", name: "O-ring FKM", note: "Brown fluororubber", cut: "parts/oring-fkm.png", ratio: 254 / 365, px: 365, shop: "https://www.apsoparts.com/en-CH/10417501-normatecr-o-ring-fkm-77-00-01-brown.html", photo: `${MEDIA}/40/39/444039.jpg` },
  { key: "oring-vmq", name: "O-ring silicone", note: "Red silicone (VMQ)", cut: "parts/oring-vmq.png", ratio: 254 / 365, px: 365, shop: "https://www.apsoparts.com/en-CH/10414501-normatecr-o-ring-vmq-70-00-02-red.html", photo: `${MEDIA}/40/33/444033.jpg` },
  { key: "oring-hnbr", name: "O-ring HNBR", note: "Green HNBR", cut: "parts/oring-hnbr.png", ratio: 254 / 365, px: 365, shop: "https://www.apsoparts.com/en-CH/10416502-normatecr-o-ring-hnbr-70-00-02-green.html", photo: `${MEDIA}/40/37/444037.jpg` },
  { key: "xring", name: "X-ring", note: "Black NBR, four lips", cut: "parts/xring.png", ratio: 261 / 382, px: 382, shop: "https://www.apsoparts.com/en-CH/10481001-x-ring-nbr-70-315-04.html", photo: `${MEDIA}/62/49/296249.jpg` },
  { key: "vring", name: "V-ring", note: "Black NBR", cut: "parts/vring.png", ratio: 277 / 389, px: 389, shop: "https://www.apsoparts.com/en-CH/11521201-v-ring-form-a-nbr.html", photo: `${MEDIA}/62/86/296286.jpg` },
  { key: "shaft-seal", name: "Shaft seal", note: "Radial shaft seal, steel case", cut: "parts/shaft-seal.png", ratio: 292 / 392, px: 392, shop: "https://www.apsoparts.com/en-CH/11502802-radial-shaft-seal-hts-ii.html", photo: `${MEDIA}/62/79/296279.jpg` },
];

export const PART: Record<PartKey, Part> = Object.fromEntries(PARTS.map((p) => [p.key, p])) as Record<PartKey, Part>;
export const isPart = (k: unknown): k is PartKey => typeof k === "string" && k in PART;
export const DEFAULT_PART: PartKey = "oring-nbr";

/** The part a scene shows: its own, else the one its old drawn shape stood for (a film made before the photos). */
export function partOf(s: { part?: unknown; shape?: unknown }): PartKey | null {
  if (isPart(s.part)) return s.part;
  if (s.shape === "seal") return "shaft-seal";
  if (s.shape === "oring") return DEFAULT_PART;
  return null;
}
