// APSOconvert > the click map drawn on the page, clean (src/lib/convert/heatDraw.ts - SARCLA 13.11.2026: "preview on
// click is not clean and clear"): which elements are drawn, their share in words, the legend's two parts, and where each
// badge goes (the frame runs HEAT_LAYOUT as it is - here it runs too). And the add-to-carts' shares (cartShares - "Search
// bar 13691%": "% of what =").
import assert from "node:assert/strict";
import { test } from "node:test";
import { HEAT_DRAW, HEAT_LAYOUT, heatLegend, heatPick, pctOf } from "../src/lib/convert/heatDraw";
import { cartShares } from "../src/lib/convert/cartShares";
import { shimSource } from "../src/lib/convert/preview";

type Box = { x: number; y: number; w: number; h: number; bw: number; bh: number };
type Placed = { b: { x: number; y: number } | null; tint: boolean };
const heatLayout = new Function(`${HEAT_LAYOUT}; return heatLayout;`)() as (items: Box[], W: number) => Placed[];
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test("pctOf: the share of the page's clicks in words - never above 100%", () => {
  assert.equal(pctOf(472, 2255), "21%");
  assert.equal(pctOf(5, 2255), "<1%");
  assert.equal(pctOf(2255, 2255), "100%");
  assert.equal(pctOf(0, 2255), "");
  assert.equal(pctOf(3, 0), "");
});

test("heatPick: the 12 most clicked with 1% or more - and the one pointed at", () => {
  // the screenshot's page: 2,255 clicks, 40 elements - one big, a few middling, a long tail under 1%
  const list = [{ s: "#apssInput", n: 472 }, ...Array.from({ length: 15 }, (_, i) => ({ s: `a.m${i}`, n: 120 - i * 5 })), ...Array.from({ length: 24 }, (_, i) => ({ s: `li.t${i}`, n: 10 }))];
  const total = list.reduce((t, i) => t + i.n, 0);
  const drawn = heatPick(list, total);
  assert.equal(drawn.length, HEAT_DRAW.top);
  assert.equal(drawn[0], "#apssInput");
  assert.ok(drawn.every((s) => list.find((i) => i.s === s)!.n / total >= HEAT_DRAW.minShare));
  assert.ok(!drawn.includes("li.t0"), "the long tail stays off the page");
  // under 1% is never drawn, even among the top
  assert.deepEqual(heatPick([{ s: "a", n: 990 }, { s: "b", n: 9 }, { s: "c", n: 1 }], 1000), ["a"]);
  // the element a person points at in the legend is drawn, whatever its share
  assert.deepEqual(heatPick([{ s: "a", n: 990 }, { s: "b", n: 9 }], 1000, "b"), ["a", "b"]);
  assert.deepEqual(heatPick([{ s: "a", n: 990 }], 1000, "not-in-the-list"), ["a"]);
  assert.deepEqual(heatPick([], 0), []);
});

test("heatLegend: the drawn elements on the page, the ones not on it in one line with their share together", () => {
  const list = [{ s: "a", n: 50 }, { s: "b", n: 30 }, { s: "c", n: 15 }, { s: "d", n: 5 }];
  const l = heatLegend(list, 100, ["b", "d"], ["a", "b", "c"]);
  assert.deepEqual(l.shown.map((x) => [x.s, x.pct]), [["a", "50%"], ["c", "15%"]]);
  assert.deepEqual(l.gone, { count: 2, n: 35, pct: "35%" });
  assert.deepEqual(heatLegend(list, 100, [], []).gone, { count: 0, n: 0, pct: "" });
});

test("HEAT_LAYOUT: the badges never cover each other - 300 random pages", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let run = 0; run < 300; run++) {
    const items: Box[] = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => ({
      x: Math.round(rnd() * 1200), y: Math.round(rnd() * 600), w: 10 + Math.round(rnd() * 300), h: 10 + Math.round(rnd() * 120), bw: 30 + Math.round(rnd() * 10), bh: 16,
    }));
    const out = heatLayout(items, 1280);
    assert.equal(out.length, items.length);
    const placed = out.map((o, i) => (o.b ? { x: o.b.x, y: o.b.y, w: items[i].bw, h: items[i].bh } : null)).filter((b): b is NonNullable<typeof b> => !!b);
    for (let a = 0; a < placed.length; a++) {
      assert.ok(placed[a].x >= 0 && placed[a].x + placed[a].w <= 1280 && placed[a].y >= 0, "inside the page");
      for (let b = a + 1; b < placed.length; b++) assert.ok(!overlap(placed[a], placed[b]), `run ${run}: badges ${a} and ${b} overlap`);
    }
  }
});

test("HEAT_LAYOUT: a crowded spot moves the next badge, a full one leaves it out; a box around others is not tinted", () => {
  const b = { bw: 32, bh: 16 };
  // two links side by side in the header: the second badge does not sit on the first
  const two = heatLayout([{ x: 100, y: 40, w: 60, h: 20, ...b }, { x: 130, y: 40, w: 60, h: 20, ...b }], 1280);
  assert.ok(two[0].b && two[1].b);
  assert.ok(!overlap({ ...two[0].b, w: 32, h: 16 }, { ...two[1].b, w: 32, h: 16 }));
  // the same tiny box ten times: some badges find no place and are left out - never piled up
  const same = heatLayout(Array.from({ length: 10 }, () => ({ x: 400, y: 300, w: 20, h: 12, ...b })), 1280);
  assert.ok(same.some((o) => o.b === null));
  assert.ok(same.filter((o) => o.b).length >= 2);
  // the header bar holding the search field: the bar gets no tint (only its outline), the field does
  const nest = heatLayout([{ x: 300, y: 20, w: 400, h: 40, ...b }, { x: 0, y: 0, w: 1280, h: 120, ...b }], 1280);
  assert.equal(nest[0].tint, true);
  assert.equal(nest[1].tint, false);
  // at the page's right edge the badge stays inside
  const edge = heatLayout([{ x: 1270, y: 200, w: 10, h: 10, ...b }], 1280);
  assert.ok(edge[0].b && edge[0].b.x + 32 <= 1280);
  // at the very top it goes inside the box or below it, never above the page
  const top = heatLayout([{ x: 10, y: 0, w: 200, h: 40, ...b }], 1280);
  assert.ok(top[0].b && top[0].b.y >= 0);
});

test("the frame's script carries the layout and still compiles", () => {
  const s = shimSource();
  assert.ok(s.includes("function heatLayout(items,W)"));
  assert.ok(s.includes(`rank>=${HEAT_DRAW.headTop}`), "the page's header: only the very top drawn");
  assert.ok(s.includes("shown:shown"), "the frame tells which it drew");
  assert.doesNotThrow(() => new Function(s));
});

test("cartShares: each source's share of ALL the add-to-carts - the tile's 'Search bar 136 · 91%', never 13691%", () => {
  const c = cartShares({ search: 136, chat: 13, page: 0 });
  assert.equal(c.all, 149);
  assert.deepEqual(c.cells.map((x) => [x.key, x.n, x.pct]), [["search", 136, "91%"], ["chat", 13, "9%"], ["page", 0, "0%"]]);
  const many = cartShares({ search: 3, chat: 1, page: 996 });
  assert.deepEqual(many.cells.map((x) => x.pct), ["<1%", "<1%", "100%"]);
  for (const x of many.cells.concat(c.cells)) assert.ok(x.pct === "<1%" || Number(x.pct.replace("%", "")) <= 100);
  // nothing counted: no share at all (not 0% of nothing); a bad number counts as none
  assert.deepEqual(cartShares({ search: 0, chat: 0, page: 0 }).cells.map((x) => x.pct), ["", "", ""]);
  assert.equal(cartShares({ search: NaN, chat: -4, page: 2 }).all, 2);
});
