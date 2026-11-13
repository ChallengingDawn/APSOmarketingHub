// APSOconvert > Journeys > Visits > the visit replay's rules (src/lib/convert/replayRules.ts - SARCLA 13.11.2026: "on video
// we still don't see where the customer clicks"): the clicks of a page view, the still parts skipped, what a click landed
// on, and which recorded page view belongs to which step of a visit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { clickName, clicksOf, recordedSteps, skipIdle, smallestAt, stateAt, type Moment } from "../src/lib/convert/replayRules";

// a page view: scrolled to 0, pointer moves, a click at 3.2 s, scrolled to 800, a double click at 9 s, a click at 20 s
const EV: Moment[] = [
  [0, 1, 0, 3000], [500, 0, 400, 300], [3000, 0, 410, 320], [3200, 2, 412, 322],
  [5000, 1, 800, 3000], [8800, 0, 700, 1200], [9000, 2, 702, 1210], [9180, 2, 704, 1212], [20000, 2, 100, 1500],
];

test("clicksOf: every click with its number, time, place and the scroll then - a double click once", () => {
  const c = clicksOf(EV);
  assert.deepEqual(c, [
    { k: 1, t: 3200, x: 412, y: 322, scroll: 0, n: 1 },
    { k: 2, t: 9000, x: 702, y: 1210, scroll: 800, n: 2 },
    { k: 3, t: 20000, x: 100, y: 1500, scroll: 800, n: 1 },
  ]);
  assert.deepEqual(clicksOf([[0, 0, 1, 1], [10, 1, 5, 100]]), [], "pointer and scroll only: no click");
});

test("stateAt: a click is a ring for `ripple` ms - longer when asked (the player asks about a second of the screen's time)", () => {
  assert.equal(stateAt(EV, 3500).clicks.length, 1);
  assert.equal(stateAt(EV, 4000).clicks.length, 0, "0.7 s by default");
  assert.equal(stateAt(EV, 4000, 1800).clicks.length, 1);
  const s = stateAt(EV, 9100);
  assert.equal(s.scroll, 800);
  assert.deepEqual([s.px, s.py], [702, 1210]);
});

test("skipIdle: the still parts are skipped - to half a second before the next moment, or to the end", () => {
  assert.equal(skipIdle(EV, 3300), 3300, "the next moment is near");
  assert.equal(skipIdle(EV, 9200), 19500, "nothing from 9.2 s to 20 s");
  assert.equal(skipIdle(EV, 20000, 60000), 60000, "after the last moment: the end");
  assert.equal(skipIdle(EV, 20000, 21000), 20000, "the end is near");
  assert.equal(skipIdle(EV, 20000), 20000, "no end given");
});

test("smallestAt: the smallest box holding the point - the element the click landed on", () => {
  const boxes = [{ x: 0, y: 0, w: 1280, h: 3000 }, { x: 100, y: 100, w: 300, h: 60 }, { x: 120, y: 110, w: 80, h: 30 }, { x: 0, y: 0, w: 0, h: 0 }];
  assert.equal(smallestAt(boxes, 150, 120), 2);
  assert.equal(smallestAt(boxes, 350, 120), 1);
  assert.equal(smallestAt(boxes, 900, 2000), 0);
  assert.equal(smallestAt(boxes, 2000, 10), -1);
});

test("clickName: what was clicked, in words", () => {
  assert.equal(clickName({ tag: "A", text: "  Dichtungen \n " }), "Link · “Dichtungen”");
  assert.equal(clickName({ tag: "BUTTON", aria: "In den Warenkorb", text: "" }), "Button · “In den Warenkorb”");
  assert.equal(clickName({ tag: "INPUT", type: "text", placeholder: "Suche" }), "Field · “Suche”");
  assert.equal(clickName({ tag: "INPUT", type: "submit", title: "Suchen" }), "Button · “Suchen”");
  assert.equal(clickName({ tag: "IMG", alt: "O-Ring 10x2" }), "Picture · “O-Ring 10x2”");
  assert.equal(clickName({ tag: "DIV", role: "button", text: "Mehr" }), "Button · “Mehr”");
  assert.equal(clickName({ tag: "DIV" }), "On the page");
  assert.equal(clickName({ tag: "A", imgAlt: "APSOparts" }), "Link · “APSOparts”");
  const long = clickName({ tag: "P", text: "x".repeat(80) });
  assert.ok(long.length < 70 && long.endsWith("…”"));
});

test("recordedSteps: a step and its recorded page view - the same page, within 5 minutes, the closest, each once", () => {
  const steps = [
    { at: "2026-11-12T09:00:00Z", path: "/de-CH/dichtungen.html" },
    { at: "2026-11-12T09:03:00Z", path: "/de-CH/o-ringe.html" },
    { at: "2026-11-12T09:06:00Z", path: "/de-CH/dichtungen.html" },
    { at: "2026-11-12T09:30:00Z", path: "/de-CH/checkout/cart/" },
    { at: "2026-11-12T09:31:00Z", path: null },
  ];
  const rows = [
    { pv: "a", path: "/de-CH/dichtungen.html", started_at: "2026-11-12T09:00:20Z" },
    { pv: "b", path: "/de-CH/Dichtungen.html?p=2", started_at: "2026-11-12T09:06:10Z" },
    { pv: "c", path: "/de-CH/o-ringe.html", started_at: "2026-11-12T09:20:00Z" },
    { pv: "d", path: "/de-CH/checkout/cart", started_at: "2026-11-12T09:29:40Z" },
  ];
  const m = recordedSteps(steps, rows);
  assert.deepEqual([...m.entries()].map(([i, r]) => [i, r.pv]).sort(), [[0, "a"], [2, "b"], [3, "d"]]);
  // one page view, two steps on that page: the closer step has it
  const one = recordedSteps([{ at: "2026-11-12T09:00:00Z", path: "/x" }, { at: "2026-11-12T09:01:00Z", path: "/x" }], [{ pv: "z", path: "/x", started_at: "2026-11-12T09:00:50Z" }]);
  assert.deepEqual([...one.keys()], [1]);
  assert.equal(recordedSteps(steps, []).size, 0);
});
