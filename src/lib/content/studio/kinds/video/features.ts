// VIDEO - APSOPARTS' FEATURES AND WINNING POINTS (08.11.2026; SARCLA: "the video should also play with our features:
// you should be able to select a feature or key winning point of APSO, much better"). Pure - tests/studio-video.test.ts.
//
// NEVER INVENT ONE. Every feature below, its claim, its proof line and every number it may put on screen comes from what
// APSOparts already says - the source of each is in the comment above it:
//   [brain]      src/data/brain.json - the brand brain readBrain() seeds from (src/lib/brain.ts): brandVoice.messagingPillars,
//                brandVoice.donts ("Verified APSOparts shop features: DirectUP (PDF order upload), DirectCUT (cut-to-size
//                configurator for plastics), Quickorder (CSV part-list re-ordering), real-time stock + lead-time
//                visibility, 48/72h delivery across Europe, no small-order surcharge, 1:1 live chat & email in 7
//                languages"), positioningGuard.apsoparts, goldExamples (paidAds, newsletterExamples)
//   [home]       the shop's home page texts - C:/dev/_archive/apsoparts/shop-project/home-page-2026/home_kit.py (EN.SUB,
//                EN.USP3, EN.SEO_TEXT, EN.TOOLS, PROMISES = "the four promises of today's USP picture") and
//                gen_home_concepts.py (TOOLS, USPS, the shop's own 24 px line icons, ICON)
// The brain the hub runs on can be edited; the studio asks the server which features the brain still names
// (`brainTerms`) and marks the others, so a feature the brand dropped is not put in a film by mistake.
// Left out on purpose: the chemical compatibility table (its films carry a liability line; never name its source).

import { photoByKey } from "../banner/brand";
import type { SceneKind } from "./model";

export type FeatureKey =
  | "no-surcharge" | "realtime" | "directcut" | "quickorder" | "directup" | "delivery"
  | "range" | "support" | "cad3d" | "oring-expert" | "track" | "customers";

/** The film's icons: the shop's own line icons (gen_home_concepts.py ICON) and four drawn the same way. */
export type IconKey = "box" | "clock" | "directcut" | "quick" | "upload" | "truck" | "grid" | "chat" | "cube" | "expert" | "pin" | "user" | "check" | "list";

export type Feature = {
  key: FeatureKey;
  /** Its name in the picker. */
  name: string;
  /** The claim, as the shop says it (English; the AI writes it in the film's language). */
  claim: string;
  /** One line of proof. */
  proof: string;
  icon: IconKey;
  /** The facts the AI may use for its scenes - nothing else about this feature. */
  facts: string[];
  /** Figures it may put on screen (a "big number" scene), and what the first one is, under it. */
  numbers: string[];
  figure?: string;
  /** The scene kinds that tell it best, the best first. */
  scenes: SceneKind[];
  /** The shop photo its scenes show (banner/brand.ts SHOP_PHOTOS key - the shop's own 1000 px technology photos). */
  photo?: string;
  /** Words the brand brain must still carry for the feature to count as confirmed. */
  brainTerms: string[];
};

export const FEATURES: Feature[] = [
  // [home] PROMISES en ("No surcharges", " for small orders"), EN.USP3 "No surcharges for small orders";
  // [brain] messagingPillars "Ease: ... no small-order surcharge"; donts' verified list "no small-order surcharge";
  //   goldExamples.newsletterExamples: "So there isn't one at APSOparts. A two-position order gets the same treatment as
  //   a large one" and "there is no small-order surcharge if you only need two"
  {
    key: "no-surcharge", name: "No surcharge for small orders", claim: "No surcharge for small orders",
    proof: "A two-position order gets the same treatment as a large one.", icon: "box", photo: "orings",
    facts: ["No surcharge for small orders", "A two-position order gets the same treatment as a large one", "No small-order surcharge if you only need two"],
    numbers: [], scenes: ["compare", "feature", "claim"], brainTerms: ["surcharge"],
  },
  // [home] EN.SUB "with prices, delivery times and availability in real time", EN.USP3, PROMISES en ("Real-time prices",
  //   ", delivery times and availability"); [brain] verified list "real-time stock + lead-time visibility";
  //   newsletterExamples "Stock and lead times are visible in the shop before you order"
  {
    key: "realtime", name: "Real-time prices, delivery times and availability", claim: "Real-time prices, delivery times and availability",
    proof: "Stock and lead times are visible before you order.", icon: "clock", photo: "sensors",
    facts: ["Prices, delivery times and availability in real time", "Stock and lead times are visible in the shop before you order"],
    numbers: [], scenes: ["feature", "words", "steps"], brainTerms: ["real-time", "real time"],
  },
  // [home] PROMISES en ("Cut-to-size", " to your dimensions"); TOOLS en ("DirectCUT Configurator", "Cut-to-size your custom
  //   plastics and sealing components"); EN.SEO_TEXT "Configure cut-to-size parts with DirectCUT";
  // [brain] verified list "DirectCUT (cut-to-size configurator for plastics)"; messagingPillars "Ease: DirectCUT"
  {
    key: "directcut", name: "DirectCUT cut-to-size", claim: "Cut-to-size to your dimensions",
    proof: "Configure cut-to-size plastics and sealing parts with DirectCUT.", icon: "directcut", photo: "plastics",
    facts: ["DirectCUT configurator", "Cut-to-size to your dimensions", "Configure cut-to-size plastics and sealing components with DirectCUT"],
    numbers: [], scenes: ["steps", "feature", "product"], brainTerms: ["directcut"],
  },
  // [home] TOOLS en ("Quickorder", "Upload your orders in any format with just a few clicks"), PROMISES en ("Fast
  //   ordering", " with Quickorder & DirectUP"); [brain] verified list "Quickorder (CSV part-list re-ordering)";
  //   newsletterExamples "Quickorder takes your part list as a CSV ... every position lands in the cart with quantities",
  //   "A thirty-line reorder becomes a two-minute review: check stock, confirm, done."
  {
    key: "quickorder", name: "Quickorder", claim: "Fast ordering with Quickorder",
    proof: "Your part list as a CSV - every position lands in the cart.", icon: "quick", photo: "drive",
    facts: ["Quickorder takes your part list as a CSV", "Every position lands in the cart with quantities", "A thirty-line reorder becomes a two-minute review: check stock, confirm, done"],
    numbers: ["30", "2"], scenes: ["compare", "steps", "feature"], brainTerms: ["quickorder"],
  },
  // [home] TOOLS en ("DirectUP Order Upload", "Upload an Excel or PDF order - the articles land in the cart");
  // [brain] verified list "DirectUP (PDF order upload)"; rule: "describe it as 'upload your PDF order' ... never
  //   'connects to' or 'integrates with' a procurement system"
  {
    key: "directup", name: "DirectUP order upload", claim: "Upload your PDF order",
    proof: "Upload an Excel or PDF order - the articles land in the cart.", icon: "upload", photo: "fluid",
    facts: ["DirectUP: upload an Excel or PDF order", "The articles land in the cart", "Never say it connects to or integrates with a procurement system"],
    numbers: [], scenes: ["steps", "feature"], brainTerms: ["directup"],
  },
  // [brain] messagingPillars "Speed & availability: in-stock items 48/72h across Europe"; verified list "48/72h delivery
  //   across Europe"; positioningGuard "48/72h EU delivery"; paidAds "48/72h delivery across Europe"
  {
    key: "delivery", name: "48/72h delivery across Europe", claim: "48/72h delivery across Europe",
    proof: "In-stock items ship in 48/72h across Europe.", icon: "truck", photo: "antivibration",
    facts: ["In-stock items ship in 48/72h across Europe"], numbers: ["48/72h", "48/72"], figure: "delivery across *Europe*", scenes: ["number", "feature"], brainTerms: ["48/72"],
  },
  // [brain] positioningGuard.apsoparts "100K+ products"; paidAds "100,000+ products"; newsletterExamples "100,000+
  //   standard components"; [home] EN.SUB "Seals, engineering plastics, hoses, drive and antivibration technology"
  {
    key: "range", name: "100,000+ standard components", claim: "100,000+ standard components",
    proof: "Seals, engineering plastics, hoses, drive and antivibration technology.", icon: "grid", photo: "sealing",
    facts: ["100,000+ standard components", "Seals, engineering plastics, hoses, drive and antivibration technology"],
    numbers: ["100,000+", "100'000+", "100.000+", "100 000+"], figure: "standard *components*", scenes: ["number", "words"], brainTerms: ["100,000", "100k"],
  },
  // [brain] messagingPillars "Human support: 1:1 live chat & email in 7 languages"; verified list; linkedin gold post
  //   "Our support answers 1:1 by live chat and email, in seven languages."
  {
    key: "support", name: "1:1 support in 7 languages", claim: "1:1 support in 7 languages",
    proof: "Our support answers 1:1 by live chat and e-mail.", icon: "chat", photo: "sensors",
    facts: ["Our support answers 1:1 by live chat and email, in seven languages"], numbers: ["7", "1:1"], figure: "languages - *1:1* support", scenes: ["number", "feature"], brainTerms: ["7 languages", "seven languages"],
  },
  // [home] TOOLS en ("3D CAD File Download", "Download 3D models for your articles"); [brain] messagingPillars "Ease:
  //   ... 3D files"
  {
    key: "cad3d", name: "3D CAD files", claim: "3D models for your articles",
    proof: "Download the 3D CAD file of an article for your design.", icon: "cube", photo: "plastics",
    facts: ["3D CAD file download", "Download 3D models for your articles"], numbers: [], scenes: ["feature", "product"], brainTerms: ["3d"],
  },
  // [home] TOOLS en ("O-Ring Expert", "Find the best O-ring for your static or dynamic application"); EN.SEO_TEXT "find
  //   the right O-ring with the O-Ring Expert"
  {
    key: "oring-expert", name: "O-Ring Expert", claim: "Find the right O-ring",
    proof: "The O-Ring Expert finds the best O-ring for your static or dynamic application.", icon: "expert", photo: "orings",
    facts: ["O-Ring Expert", "Find the best O-ring for your static or dynamic application"], numbers: [], scenes: ["feature", "steps"], brainTerms: [],
  },
  // [brain] messagingPillars "Ease: ... track & trace"; newsletterExamples "The confirmation lands in your inbox as usual,
  //   with track & trace on the shipment"
  {
    key: "track", name: "Track & trace", claim: "Track & trace on every shipment",
    proof: "The confirmation lands in your inbox, with track & trace.", icon: "pin", photo: "fluid",
    facts: ["The confirmation lands in your inbox, with track & trace on the shipment"], numbers: [], scenes: ["feature"], brainTerms: ["track & trace"],
  },
  // [brain] goldExamples.paidAds[1] "17,000 customers trust APSOparts for fast, in-stock delivery of seals, plastics,
  //   fluid and drive parts."
  {
    key: "customers", name: "17,000 customers", claim: "17,000 customers trust APSOparts",
    proof: "For fast, in-stock delivery of seals, plastics, fluid and drive parts.", icon: "user", photo: "sealing",
    facts: ["17,000 customers trust APSOparts for fast, in-stock delivery of seals, plastics, fluid and drive parts"],
    numbers: ["17,000", "17'000", "17.000", "17 000"], figure: "customers *trust* APSOparts", scenes: ["number"], brainTerms: ["17,000"],
  },
];

export const FEATURE: Record<FeatureKey, Feature> = Object.fromEntries(FEATURES.map((f) => [f.key, f])) as Record<FeatureKey, Feature>;
export const isFeature = (k: unknown): k is FeatureKey => typeof k === "string" && k in FEATURE;
export const ICONS: IconKey[] = ["box", "clock", "directcut", "quick", "upload", "truck", "grid", "chat", "cube", "expert", "pin", "user", "check", "list"];
export const isIcon = (k: unknown): k is IconKey => typeof k === "string" && (ICONS as string[]).includes(k);

/** The features the brain's text still names (a feature without terms counts as named - its source is the shop). */
export function confirmedBy(brainText: string): FeatureKey[] {
  const t = brainText.toLowerCase();
  return FEATURES.filter((f) => !f.brainTerms.length || f.brainTerms.some((x) => t.includes(x.toLowerCase()))).map((f) => f.key);
}

/** The digits of a figure, for comparing "17'000" with "17,000". */
const digits = (s: string) => s.replace(/[^\d/]/g, "");

/** Is a figure on screen one these features may show? */
export function numberAllowed(text: string, keys: FeatureKey[]): boolean {
  const d = digits(text);
  if (!d) return true;
  return keys.some((k) => FEATURE[k]?.numbers.some((n) => digits(n) === d || d.split("/").every((x) => x && digits(n).split("/").includes(x))));
}

/** The picked features as the model reads them: each one's claim, proof and facts, nothing more. */
export function featuresBrief(keys: FeatureKey[]): string {
  return keys.filter(isFeature).map((k, i) => {
    const f = FEATURE[k];
    return [
      `${i + 1}. ${f.name} (key "${f.key}", icon "${f.icon}")`,
      `   claim: ${f.claim}`,
      `   proof: ${f.proof}`,
      `   facts you may use: ${f.facts.join(" | ")}`,
      `   figures you may show: ${f.numbers.length ? f.numbers[0] : "none - say it without a number"}`,
      `   scene kinds that tell it best: ${f.scenes.join(", ")}`,
    ].join("\n");
  }).join("\n");
}

/**
 * The picture a feature scene shows when none was picked (09.11.2026; a feature scene never shows an icon in a disc any
 * more): the shop's own photo for the feature - 1000 px square, sharp on the film's card in every format.
 */
export const featurePhoto = (k: FeatureKey | null | undefined): string => photoByKey((k && FEATURE[k]?.photo) || "sealing")?.url ?? "";
