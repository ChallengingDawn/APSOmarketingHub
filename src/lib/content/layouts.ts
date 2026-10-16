// STARTER LAYOUTS: SOMETHING ON THE CANVAS BEFORE ANYBODY TYPES.
//
// "Canvas — blank" has been the first thing the studio shows since it was
// built, and it is the honest reason the editor kept reading as unfinished
// next to Express. Express never opens empty: a layout is already there, and
// the work is replacing its words.
//
// These are built as DesignDocuments — the editor's own format — rather than
// as background JPEGs like the LinkedIn-event templates in src/data. That
// matters: every block stays a real node, so you can move it, restyle it and
// delete it. A picture of a layout is a picture; this is a layout.
//
// They are generated from the brand rather than designed one by one, which is
// a deliberate trade and worth naming. They are competent, not inspired: a
// grid, the brand's type scale, the brand's colours, and the structure each
// content type actually requires. When somebody points at four designs we
// already like, these should be replaced by those — the format is the same,
// so that is a data change and not a rebuild.

import type { DesignDocument } from "@/lib/design-document";

const RED = "#ed1b2f";
const NAVY = "#274e64";
const INK = "#1a1d21";
const SLATE = "#3c4043";
const PAPER = "#ffffff";
const BONE = "#f3f1ec";

export type Layout = {
  id: string;
  name: string;
  /** Which content types offer it. Empty means every type. */
  types: string[];
  /** One line on the card, so the gallery says what it is for. */
  note: string;
  build: () => DesignDocument;
};

/** Fractions, not pixels: one layout has to survive every artboard size. */
function doc(
  w: number,
  h: number,
  background: Partial<DesignDocument["background"]>,
  nodes: DesignDocument["nodes"],
): DesignDocument {
  return {
    schemaVersion: 1,
    canvas: { w, h },
    background: {
      color: PAPER,
      gradientId: null,
      customGradient: { from: NAVY, to: INK },
      src: null,
      scrim: 0,
      ...background,
    },
    nodes,
  };
}

let seq = 0;
const id = (p: string) => `${p}${(seq += 1)}`;

/* ── the pieces every layout is made of ─────────────────────────────────── */

function eyebrow(w: number, h: number, y: number, text = "APSOPARTS"): DesignDocument["nodes"][number] {
  return {
    id: id("eyebrow"), kind: "text", x: Math.round(w * 0.08), y: Math.round(h * y),
    text, fill: RED, fontKey: "inter", fontSize: Math.round(w / 52), fontStyle: "bold",
    width: Math.round(w * 0.84), align: "left", letterSpacing: Math.round(w / 500),
  };
}

function headline(w: number, h: number, y: number, text: string, fill = INK, div = 15): DesignDocument["nodes"][number] {
  return {
    id: id("head"), kind: "text", x: Math.round(w * 0.08), y: Math.round(h * y),
    text, fill, fontKey: "outfit", fontSize: Math.round(w / div), fontStyle: "bold",
    width: Math.round(w * 0.84), align: "left", lineHeight: 1.1,
  };
}

function body(w: number, h: number, y: number, text: string, fill = SLATE): DesignDocument["nodes"][number] {
  return {
    id: id("body"), kind: "text", x: Math.round(w * 0.08), y: Math.round(h * y),
    text, fill, fontKey: "inter", fontSize: Math.round(w / 36),
    width: Math.round(w * 0.84), align: "left", lineHeight: 1.45,
  };
}

function bar(w: number, h: number, y: number, fill = RED): DesignDocument["nodes"][number] {
  return {
    id: id("bar"), kind: "rect", x: Math.round(w * 0.08), y: Math.round(h * y),
    width: Math.round(w * 0.1), height: Math.max(3, Math.round(h * 0.008)),
    fill, cornerRadius: 2,
  };
}

/* ── the layouts ────────────────────────────────────────────────────────── */

export const LAYOUTS: Layout[] = [
  {
    id: "statement",
    name: "Statement",
    types: ["linkedin-post"],
    note: "One claim, nothing competing with it.",
    build: () => {
      const w = 1200, h = 627;
      return doc(w, h, { color: BONE }, [
        eyebrow(w, h, 0.12),
        headline(w, h, 0.24, "The claim, in eight words or fewer", INK, 13),
        bar(w, h, 0.62),
        body(w, h, 0.7, "One sentence that makes the claim specific — a number, a material, a situation."),
      ]);
    },
  },
  {
    id: "question",
    name: "Question",
    types: ["linkedin-post"],
    note: "Opens with the question the reader already has.",
    build: () => {
      const w = 1200, h = 627;
      return doc(w, h, { color: NAVY }, [
        eyebrow(w, h, 0.14, "WHY DOES THIS KEEP HAPPENING?"),
        headline(w, h, 0.3, "The question, asked the way they would ask it", PAPER, 14),
        body(w, h, 0.68, "The answer, in one line. Then the part most people get wrong.", "#dbe5ea"),
      ]);
    },
  },
  {
    id: "split",
    name: "Split",
    types: ["linkedin-post"],
    note: "Half colour, half room for a photograph.",
    build: () => {
      const w = 1200, h = 627;
      return doc(w, h, { color: PAPER }, [
        { id: id("panel"), kind: "rect", x: 0, y: 0, width: Math.round(w * 0.52), height: h, fill: NAVY },
        {
          id: id("eyebrow"), kind: "text", x: Math.round(w * 0.06), y: Math.round(h * 0.18),
          text: "APSOPARTS", fill: RED, fontKey: "inter", fontSize: Math.round(w / 52),
          fontStyle: "bold", width: Math.round(w * 0.4), align: "left", letterSpacing: 2,
        },
        {
          id: id("head"), kind: "text", x: Math.round(w * 0.06), y: Math.round(h * 0.3),
          text: "The headline, in the coloured half", fill: PAPER, fontKey: "outfit",
          fontSize: Math.round(w / 20), fontStyle: "bold", width: Math.round(w * 0.4),
          align: "left", lineHeight: 1.12,
        },
        {
          id: id("body"), kind: "text", x: Math.round(w * 0.06), y: Math.round(h * 0.68),
          text: "Supporting line. The right half is for a photograph.",
          fill: "#dbe5ea", fontKey: "inter", fontSize: Math.round(w / 44),
          width: Math.round(w * 0.4), align: "left", lineHeight: 1.45,
        },
      ]);
    },
  },
  {
    id: "hero",
    name: "Page hero",
    types: ["landing-page", "product-page"],
    note: "The promise, the sentence under it, one action.",
    build: () => {
      const w = 1600, h = 900;
      return doc(w, h, { color: PAPER }, [
        eyebrow(w, h, 0.14, "TECHNICAL PLASTICS · CUT TO SIZE"),
        headline(w, h, 0.24, "The promise, in the words they searched for", INK, 16),
        body(w, h, 0.46, "One sentence saying plainly what this is and who it is for. No adjective a competitor could copy."),
        { id: id("cta"), kind: "rect", x: Math.round(w * 0.08), y: Math.round(h * 0.62), width: Math.round(w * 0.22), height: Math.round(h * 0.09), fill: RED, cornerRadius: 8 },
        {
          id: id("ctaText"), kind: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.645),
          text: "Configure your cut", fill: PAPER, fontKey: "outfit",
          fontSize: Math.round(w / 48), fontStyle: "bold", width: Math.round(w * 0.22), align: "center",
        },
      ]);
    },
  },
  {
    id: "proofs",
    name: "Six proofs",
    types: ["landing-page", "product-page"],
    note: "The grid that made the DirectCut page work.",
    build: () => {
      const w = 1600, h = 900;
      const nodes: DesignDocument["nodes"] = [
        eyebrow(w, h, 0.07, "WHY BUY HERE"),
        headline(w, h, 0.13, "Six things we can actually do", INK, 22),
      ];
      // Three across, two down — the shape of the section that turned a
      // brochure page into a page that shows capability.
      for (let i = 0; i < 6; i += 1) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = Math.round(w * (0.08 + col * 0.29));
        const y = Math.round(h * (0.3 + row * 0.3));
        nodes.push(
          { id: id("tile"), kind: "rect", x, y, width: Math.round(w * 0.25), height: Math.round(h * 0.24), fill: BONE, cornerRadius: 10 },
          { id: id("tileNo"), kind: "text", x: x + Math.round(w * 0.015), y: y + Math.round(h * 0.03), text: `0${i + 1}`, fill: RED, fontKey: "outfit", fontSize: Math.round(w / 60), fontStyle: "bold", width: Math.round(w * 0.2), align: "left" },
          { id: id("tileTxt"), kind: "text", x: x + Math.round(w * 0.015), y: y + Math.round(h * 0.09), text: "A capability, stated as a fact with a number.", fill: SLATE, fontKey: "inter", fontSize: Math.round(w / 72), width: Math.round(w * 0.22), align: "left", lineHeight: 1.4 },
        );
      }
      return doc(w, h, { color: PAPER }, nodes);
    },
  },
  {
    id: "spec",
    name: "Spec sheet",
    types: ["product-page"],
    note: "Properties first, for a reader who already knows what they want.",
    build: () => {
      const w = 1600, h = 900;
      const nodes: DesignDocument["nodes"] = [
        eyebrow(w, h, 0.09, "SPECIFICATION"),
        headline(w, h, 0.15, "The part, named", INK, 20),
      ];
      for (let i = 0; i < 5; i += 1) {
        const y = Math.round(h * (0.34 + i * 0.1));
        nodes.push(
          { id: id("rowLine"), kind: "rect", x: Math.round(w * 0.08), y, width: Math.round(w * 0.84), height: 1, fill: "#e3e6ea" },
          { id: id("rowKey"), kind: "text", x: Math.round(w * 0.08), y: y + Math.round(h * 0.02), text: "Property", fill: "#8b97ac", fontKey: "inter", fontSize: Math.round(w / 78), width: Math.round(w * 0.3), align: "left" },
          { id: id("rowVal"), kind: "text", x: Math.round(w * 0.4), y: y + Math.round(h * 0.02), text: "Value — only if it was supplied", fill: INK, fontKey: "inter", fontSize: Math.round(w / 70), width: Math.round(w * 0.5), align: "left" },
        );
      }
      return doc(w, h, { color: PAPER }, nodes);
    },
  },
  {
    id: "quote",
    name: "Customer",
    types: ["linkedin-post", "landing-page"],
    note: "One voice, in their own words.",
    build: () => {
      const w = 1200, h = 627;
      return doc(w, h, { color: BONE }, [
        {
          id: id("mark"), kind: "text", x: Math.round(w * 0.07), y: Math.round(h * 0.1),
          text: "“", fill: RED, fontKey: "outfit", fontSize: Math.round(w / 6),
          fontStyle: "bold", width: Math.round(w * 0.2), align: "left",
        },
        headline(w, h, 0.3, "What they said, kept short enough to believe", INK, 22),
        body(w, h, 0.72, "Their role, their company — only if we have permission to name it.", "#5b6470"),
      ]);
    },
  },
  {
    id: "blank",
    name: "Blank",
    types: [],
    note: "Nothing on it. Start from the brand colours.",
    build: () => doc(1200, 627, { color: PAPER }, []),
  },
];

/** The layouts offered for a content type, most specific first. */
export function layoutsFor(typeKey: string | null | undefined): Layout[] {
  const specific = LAYOUTS.filter((l) => typeKey && l.types.includes(typeKey));
  const general = LAYOUTS.filter((l) => l.types.length === 0);
  return [...specific, ...general];
}
