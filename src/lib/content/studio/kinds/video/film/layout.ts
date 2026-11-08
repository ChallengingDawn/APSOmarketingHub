// WHERE EVERYTHING SITS, PER FORMAT (08.11.2026). One story, three layouts: 16:9 (1920x1080) puts the words left and
// the part right; 9:16 (1080x1920) stacks them and keeps everything between y 250 and 1650, where the stories' own
// bars do not cover it; 1:1 (1080x1080) stacks them tighter. The logo sits black, top left, in every one.
// Pure - tests/studio-video.test.ts checks every box against its format's safe area.

import type { Format } from "../model";

export type Box = { x: number; y: number; w: number; h: number };
export type Circle = { cx: number; cy: number; r: number };
export type Spot = { x: number; y: number; h: number };

export type Layout = {
  fmt: Format;
  W: number;
  H: number;
  /** Where the content may go. */
  safe: Box;
  /** The logo in the corner, and where it grows to on the end card. */
  logo: Spot;
  bigLogo: Spot;
  /** Largest type sizes, px. */
  fs: { head: number; words: number; claim: number; kicker: number; body: number; quote: number; step: number; end: number; cta: number };
  title: { text: Box; part: Circle };
  words: { text: Box };
  claim: { text: Box };
  /** A feature: its icon tile, its words, its picture (or a big icon where it has none). */
  feature: { icon: Spot; text: Box; card: Box; big: Circle };
  /** A big number: the figure, what it is, its proof; the feature's icon beside the figure. */
  number: { fig: Box; label: Box; sub: Box };
  /** Before / after: two cards. */
  compare: { head: Box; before: Box; after: Box };
  steps: { head: Box; cards: [Box, Box, Box]; row: boolean };
  product: { text: Box; card: Box };
  quote: { mark: Spot; text: Box; who: Box };
  end: { line: Box; cta: Spot; part: Circle };
};

const row = (x: number, y: number, w: number, h: number, gap: number): [Box, Box, Box] =>
  [0, 1, 2].map((i) => ({ x: x + i * (w + gap), y, w, h })) as [Box, Box, Box];
const col = (x: number, y: number, w: number, h: number, gap: number): [Box, Box, Box] =>
  [0, 1, 2].map((i) => ({ x, y: y + i * (h + gap), w, h })) as [Box, Box, Box];

export const LAYOUTS: Record<Format, Layout> = {
  "16:9": {
    fmt: "16:9", W: 1920, H: 1080,
    safe: { x: 150, y: 150, w: 1620, h: 790 },
    logo: { x: 96, y: 62, h: 46 }, bigLogo: { x: 150, y: 210, h: 150 },
    fs: { head: 150, words: 176, claim: 112, kicker: 42, body: 42, quote: 66, step: 54, end: 92, cta: 44 },
    title: { text: { x: 150, y: 290, w: 1000, h: 470 }, part: { cx: 1460, cy: 590, r: 235 } },
    words: { text: { x: 150, y: 230, w: 1560, h: 640 } },
    claim: { text: { x: 150, y: 300, w: 1520, h: 480 } },
    feature: { icon: { x: 150, y: 230, h: 150 }, text: { x: 150, y: 420, w: 860, h: 460 }, card: { x: 1110, y: 170, w: 660, h: 760 }, big: { cx: 1440, cy: 560, r: 250 } },
    number: { fig: { x: 150, y: 230, w: 1620, h: 440 }, label: { x: 150, y: 690, w: 1620, h: 110 }, sub: { x: 150, y: 820, w: 1620, h: 70 } },
    compare: { head: { x: 150, y: 190, w: 1620, h: 80 }, before: { x: 150, y: 320, w: 770, h: 520 }, after: { x: 1000, y: 320, w: 770, h: 520 } },
    steps: { head: { x: 150, y: 190, w: 1620, h: 80 }, cards: row(150, 360, 520, 380, 30), row: true },
    product: { text: { x: 150, y: 330, w: 840, h: 420 }, card: { x: 1070, y: 170, w: 640, h: 760 } },
    quote: { mark: { x: 140, y: 150, h: 300 }, text: { x: 150, y: 380, w: 1440, h: 400 }, who: { x: 150, y: 820, w: 1300, h: 70 } },
    end: { line: { x: 150, y: 420, w: 1080, h: 300 }, cta: { x: 150, y: 770, h: 104 }, part: { cx: 1480, cy: 600, r: 225 } },
  },
  "9:16": {
    fmt: "9:16", W: 1080, H: 1920,
    safe: { x: 90, y: 400, w: 900, h: 1250 },
    logo: { x: 90, y: 270, h: 56 }, bigLogo: { x: 90, y: 500, h: 176 },
    fs: { head: 140, words: 156, claim: 108, kicker: 42, body: 44, quote: 74, step: 64, end: 104, cta: 54 },
    title: { text: { x: 90, y: 420, w: 900, h: 520 }, part: { cx: 540, cy: 1290, r: 270 } },
    words: { text: { x: 90, y: 520, w: 900, h: 900 } },
    claim: { text: { x: 90, y: 560, w: 900, h: 760 } },
    feature: { icon: { x: 90, y: 430, h: 150 }, text: { x: 90, y: 610, w: 900, h: 460 }, card: { x: 140, y: 1110, w: 800, h: 520 }, big: { cx: 540, cy: 1330, r: 230 } },
    number: { fig: { x: 90, y: 600, w: 900, h: 460 }, label: { x: 90, y: 1080, w: 900, h: 200 }, sub: { x: 90, y: 1300, w: 900, h: 140 } },
    compare: { head: { x: 90, y: 420, w: 900, h: 80 }, before: { x: 90, y: 560, w: 900, h: 480 }, after: { x: 90, y: 1080, w: 900, h: 480 } },
    steps: { head: { x: 90, y: 420, w: 900, h: 80 }, cards: col(90, 560, 900, 300, 40), row: false },
    product: { text: { x: 90, y: 420, w: 900, h: 340 }, card: { x: 140, y: 800, w: 800, h: 820 } },
    quote: { mark: { x: 80, y: 410, h: 300 }, text: { x: 90, y: 700, w: 900, h: 620 }, who: { x: 90, y: 1400, w: 900, h: 80 } },
    end: { line: { x: 90, y: 760, w: 900, h: 400 }, cta: { x: 90, y: 1200, h: 124 }, part: { cx: 800, cy: 1470, r: 150 } },
  },
  "1:1": {
    fmt: "1:1", W: 1080, H: 1080,
    safe: { x: 80, y: 150, w: 920, h: 860 },
    logo: { x: 70, y: 56, h: 42 }, bigLogo: { x: 80, y: 180, h: 124 },
    fs: { head: 116, words: 132, claim: 88, kicker: 34, body: 36, quote: 56, step: 50, end: 76, cta: 40 },
    title: { text: { x: 80, y: 190, w: 920, h: 400 }, part: { cx: 790, cy: 790, r: 190 } },
    words: { text: { x: 80, y: 210, w: 920, h: 720 } },
    claim: { text: { x: 80, y: 280, w: 920, h: 540 } },
    feature: { icon: { x: 80, y: 170, h: 110 }, text: { x: 80, y: 300, w: 920, h: 310 }, card: { x: 270, y: 640, w: 540, h: 360 }, big: { cx: 790, cy: 800, r: 180 } },
    number: { fig: { x: 80, y: 240, w: 920, h: 380 }, label: { x: 80, y: 640, w: 920, h: 150 }, sub: { x: 80, y: 810, w: 920, h: 100 } },
    compare: { head: { x: 80, y: 160, w: 920, h: 64 }, before: { x: 80, y: 260, w: 920, h: 350 }, after: { x: 80, y: 640, w: 920, h: 350 } },
    steps: { head: { x: 80, y: 160, w: 920, h: 64 }, cards: col(80, 270, 920, 220, 30), row: false },
    product: { text: { x: 80, y: 170, w: 920, h: 250 }, card: { x: 270, y: 440, w: 540, h: 560 } },
    quote: { mark: { x: 70, y: 150, h: 220 }, text: { x: 80, y: 360, w: 920, h: 460 }, who: { x: 80, y: 870, w: 920, h: 64 } },
    end: { line: { x: 80, y: 360, w: 920, h: 280 }, cta: { x: 80, y: 690, h: 92 }, part: { cx: 840, cy: 850, r: 125 } },
  },
};

/** 9:16 keeps everything between these lines (the platforms' own bars cover the rest). */
export const TALL_SAFE = { top: 250, bottom: 1650 } as const;

/** Every box a layout places, by name - for the safe-area check. */
export function boxesOf(L: Layout): [string, Box][] {
  const c = (n: string, k: Circle): [string, Box] => [n, { x: k.cx - k.r, y: k.cy - k.r, w: 2 * k.r, h: 2 * k.r }];
  const s = (n: string, k: Spot, ratio = 1): [string, Box] => [n, { x: k.x, y: k.y, w: k.h * ratio, h: k.h }];
  return [
    s("logo", L.logo, 3.3), s("bigLogo", L.bigLogo, 3.3),
    ["title.text", L.title.text], c("title.part", L.title.part),
    ["words.text", L.words.text], ["claim.text", L.claim.text],
    s("feature.icon", L.feature.icon), ["feature.text", L.feature.text], ["feature.card", L.feature.card], c("feature.big", L.feature.big),
    ["number.fig", L.number.fig], ["number.label", L.number.label], ["number.sub", L.number.sub],
    ["compare.head", L.compare.head], ["compare.before", L.compare.before], ["compare.after", L.compare.after],
    ["steps.head", L.steps.head], ...L.steps.cards.map((b, i): [string, Box] => [`steps.card${i + 1}`, b]),
    ["product.text", L.product.text], ["product.card", L.product.card],
    s("quote.mark", L.quote.mark, 0.5), ["quote.text", L.quote.text], ["quote.who", L.quote.who],
    ["end.line", L.end.line], s("end.cta", L.end.cta, 3), c("end.part", L.end.part),
  ];
}
