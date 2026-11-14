// THE PAGE'S A/B TEST IN THREE STEPS (Content v15, 11.11.2026). Pure: no "@/" imports - the A/B test section of the
// publishing view (src/app/projects/studio/kinds/page/PublishAb.tsx), the studio's server (./server.ts ab_variant) and the
// tests.
//
// SARCLA 11.11.2026, ~18:00: "I cannot define the test. I should be able in one click to create, with the same content,
// another version to send, and then it sends to AI personalization - this should send to the A/B testing sub app, but
// always be tracked from the page as well, on its tab. Needs also to behave more featured and straightforward."
//   1  version B in one click - the same content, opened on the stage to be changed; a line says what differs from A
//   2  the test defined on one card, its defaults filled in - sent to A/B testing as a draft
//   3  tracked on the page's tab: each test's figures, its verdict in plain words, its day-by-day line, its actions
// This file says what differs between A and B, the change list the test lays over the page, the test's defaults, and
// where the person stands.

import { blockOrder, type Fields } from "./fields";

/* ── 1. what B changes ── */

/** A block of a page made here as a label a person reads ("the hero", "section «Alternatives»", "module «Bento»"). */
function blockLabel(f: Fields, key: string): string {
  if (key === "hero") return "the hero";
  if (key === "intro") return "the intro";
  if (key === "benefits") return "the benefits";
  if (key === "links") return "the links";
  if (key === "faq") return "the questions";
  if (key === "cta") return "the call to action";
  if (key.startsWith("sections.")) {
    const s = f.sections.find((x) => x.id === key.slice(9));
    return s?.title.trim() ? `section «${s.title.trim().slice(0, 40)}»` : "a section";
  }
  if (key.startsWith("mod:")) {
    const m = (f.modules ?? []).find((x) => x.id === key.slice(4));
    const t = String((m?.module.settings as { title?: unknown } | undefined)?.title ?? "").replace(/==/g, "").trim();
    return t ? `module «${t.slice(0, 40)}»` : `a ${m?.module.type ?? ""} module`.replace(/\s+/g, " ");
  }
  return key;
}

/** One block's content, to compare (its words, pictures, buttons and looks). */
function blockSlice(f: Fields, key: string): unknown {
  const looks = Object.entries(f.looks ?? {}).filter(([k]) => k === key || k.startsWith(`${key}.`) || (key === "benefits" && k.startsWith("benefits")) || (key === "links" && k.startsWith("links")) || (key === "faq" && k.startsWith("faq")));
  if (key === "hero") return [f.hero, looks, !!f.noHero];
  if (key === "intro") return [f.intro, looks];
  if (key === "benefits") return [f.benefitsTitle, f.benefits, looks];
  if (key === "links") return [f.linksTitle, f.links, looks];
  if (key === "faq") return [f.faqTitle, f.faq, looks];
  if (key === "cta") return [f.cta, looks];
  if (key.startsWith("sections.")) return [f.sections.find((x) => x.id === key.slice(9)) ?? null, looks];
  if (key.startsWith("mod:")) return (f.modules ?? []).find((x) => x.id === key.slice(4)) ?? null;
  return null;
}

/** The blocks of a page made here, in their order, its modules where they stand ("mod:<id>"). */
export function blocksOf(f: Fields): string[] {
  const mods = f.modules ?? [];
  const after = (k: string) => mods.filter((m) => m.after === k).map((m) => `mod:${m.id}`);
  const out = [...after("")];
  for (const k of blockOrder(f)) { if (!(k === "hero" && f.noHero)) out.push(k); out.push(...after(k)); }
  out.push(...after("~end"));
  // a module after a block no longer on the page stands at the end, as the page draws it
  for (const m of mods) if (!out.includes(`mod:${m.id}`)) out.push(`mod:${m.id}`);
  return out;
}

/** What B changes on a page made here, in a person's words: each block changed, added or taken out, and the order. */
export function blocksChanged(a: Fields, b: Fields): string[] {
  const ka = blocksOf(a);
  const kb = blocksOf(b);
  const out: string[] = [];
  for (const k of kb) {
    if (!ka.includes(k)) out.push(`${blockLabel(b, k)} added`);
    else if (JSON.stringify(blockSlice(a, k)) !== JSON.stringify(blockSlice(b, k))) out.push(blockLabel(b, k));
  }
  for (const k of ka) if (!kb.includes(k)) out.push(`${blockLabel(a, k)} taken out`);
  const common = kb.filter((k) => ka.includes(k));
  if (common.join() !== ka.filter((k) => kb.includes(k)).join()) out.push("the order of the blocks");
  return out;
}

/** The line under "Make version B": what B changes - or that it is still the same as A. */
export function differsLine(changed: readonly string[], letter = "B"): string {
  if (!changed.length) return `Version ${letter} is the same as A so far - change what you want to test (a headline, the hero, a block) on the page.`;
  const shown = changed.slice(0, 4).join(", ");
  return `Version ${letter} changes ${shown}${changed.length > 4 ? ` and ${changed.length - 4} more` : ""}.`;
}

/* ── the test's change list for a page made here: B's blocks laid over A's on the shop ── */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** The top-level elements of an HTML fragment (the page's own renderer wrote it: well-formed), each as its text. */
export function topParts(html: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    const [, close, tagRaw, selfClose] = m;
    const tag = tagRaw.toLowerCase();
    if (close) {
      // the parent's own end: the fragment's elements are all read
      if (depth === 0) break;
      depth -= 1;
      if (depth === 0 && start >= 0) { out.push(html.slice(start, re.lastIndex)); start = -1; }
      continue;
    }
    if (depth === 0) start = m.index;
    if (VOID.has(tag) || selfClose) { if (depth === 0) { out.push(html.slice(start, re.lastIndex)); start = -1; } continue; }
    // a style or script block's text is not markup
    if (tag === "style" || tag === "script") {
      const end = html.toLowerCase().indexOf(`</${tag}>`, re.lastIndex);
      if (end < 0) break;
      re.lastIndex = end + tag.length + 3;
      if (depth === 0) { out.push(html.slice(start, re.lastIndex)); start = -1; }
      continue;
    }
    depth += 1;
  }
  return out;
}

/** The blocks of the page's own root (<div class="apx-np">) as the shop has them, in order - or null without one. */
export function rootParts(html: string): string[] | null {
  const at = html.indexOf('<div class="apx-np">');
  return at < 0 ? null : topParts(html.slice(at + '<div class="apx-np">'.length));
}

/** A change of the shop's change list (lib/convert/versions.ts Change) - what is made here. */
export type VariantChange =
  | { op: "replace"; selector: string; html: string }
  | { op: "hide"; selector: string }
  | { op: "insert"; selector: string; where: "after" | "prepend"; html: string }
  | { op: "css"; css: string };

const ROOT = ".apx-np";
const child = (k: number) => `${ROOT} > :nth-child(${k})`;

/**
 * B's change list for a page made here: A's page as it is on the shop, B's blocks laid over it. The same number of blocks:
 * each block that differs is replaced (the last first, so the places before it never move). Blocks added or taken out:
 * A's differing run hidden, B's put after the last block they share. The stylesheet rules B has that A has not, as a style.
 */
export function pageVariant(aContent: string, bContent: string): { changes: VariantChange[]; problem: string | null } {
  const A = rootParts(aContent);
  const B = rootParts(bContent);
  if (A === null || B === null) return { changes: [], problem: "The page's own blocks were not found - publish it once from here first." };
  const changes: VariantChange[] = [];
  // a style of B's own (a colour of its own on a block): the rules A's page lacks
  const cssOf = (h: string) => (/<style>([\s\S]*?)<\/style>/i.exec(h)?.[1] ?? "");
  const rules = (css: string) => css.split("}").map((r) => r.trim()).filter(Boolean).map((r) => `${r}}`);
  const aRules = new Set(rules(cssOf(aContent)));
  const extra = rules(cssOf(bContent)).filter((r) => !aRules.has(r));
  if (extra.length) changes.push({ op: "css", css: extra.join("\n") });
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p += 1;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s += 1;
  if (A.length === B.length) {
    for (let k = A.length - s - 1; k >= p; k -= 1) if (A[k] !== B[k]) changes.push({ op: "replace", selector: child(k + 1), html: B[k] });
  } else {
    for (let k = p; k < A.length - s; k += 1) changes.push({ op: "hide", selector: child(k + 1) });
    const put = B.slice(p, B.length - s).join("\n");
    if (put) changes.push(p > 0 ? { op: "insert", selector: child(p), where: "after", html: put } : { op: "insert", selector: ROOT, where: "prepend", html: put });
  }
  return { changes, problem: null };
}

/* ── 2. the test's defaults ── */

export type SplitKey = "half" | "bandit";
export type AbEnv = "acc" | "prod";
export type TestDraft = {
  name: string;
  /** what decides - add to cart is what A/B testing counts */
  goal: "add_to_cart";
  /** all visitors, or only the store views of this language */
  who: "all" | "stores";
  stores: string[];
  split: SplitKey;
  env: AbEnv;
};

/** "Kalrez page – B: the hero" - the page's name, the version, what it changes (two at most). */
export function testName(page: string, letter: string, changed: readonly string[]): string {
  const name = String(page ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || "This page";
  const what = changed.slice(0, 2).join(", ");
  return `${name} – ${letter}${what ? `: ${what}` : ""}`.slice(0, 200);
}

/** The test as it starts: its name filled in, add to cart, the language's store views, half and half, ACC first. */
export function testDefaults(x: { page: string; letter: string; changed: readonly string[]; stores: readonly string[] }): TestDraft {
  return { name: testName(x.page, x.letter, x.changed), goal: "add_to_cart", who: "stores", stores: [...x.stores], split: "half", env: "acc" };
}

/** The test's split as A/B testing takes it: half and half, or more visitors to the better one (each keeps 10%). */
export const allocationOf = (k: SplitKey) => (k === "bandit" ? { mode: "bandit" as const, split: { a: 50, b: 50 }, floor: 10 } : { mode: "split" as const, split: { a: 50, b: 50 }, floor: 10 });
/** Who sees it, as A/B testing takes it (every other condition: any). */
export const audienceOf = (t: Pick<TestDraft, "who" | "stores">) => ({ stores: t.who === "stores" ? [...t.stores] : [], device: "any" as const, visitor: "any" as const, login: "any" as const, source: "any" as const });

/** Why "Send to A/B testing" cannot go yet - or null. Production only once the page is on it. */
export function sendWhy(x: { canEdit: boolean; changes: number; onShop: Record<AbEnv, boolean>; env: AbEnv; name: string; sending: boolean }): string | null {
  if (!x.canEdit) return "Sending a test needs the write level of A/B testing > Page tests.";
  if (!x.onShop[x.env]) return x.env === "acc" ? "Publish the page on ACC first - a test runs on the page as it is on the shop." : "Publish the page on production first - then its test can run there.";
  if (!x.changes) return "Version B does nothing the page on the shop does not do already - change it first.";
  if (!x.name.trim()) return "Give the test a name.";
  return x.sending ? "Sending…" : null;
}

/* ── 3. where the person stands, and the tests in plain words ── */

export type FlowStep = "make" | "change" | "define" | "track";
/** The step: no version B yet; B made but the same as A; B differs and no test of the page runs or waits; a test there. */
export function flowStep(x: { hasB: boolean; changed: number; tests: readonly { status: string }[] }): FlowStep {
  if (x.tests.some((t) => t.status === "draft" || t.status === "running" || t.status === "paused")) return "track";
  if (!x.hasB) return "make";
  if (!x.changed) return "change";
  return "define";
}

/** A test's figures in a person's words: "B adds to cart 3.7% of the time, A 2.5% - +46.9% (-5% to +120%)". */
export function upliftLine(f: { counted: boolean; a: { rate: number | null; visitors: number }; b: { rate: number | null; visitors: number }; uplift: { mid: number | null; low: number | null; high: number | null } } | null | undefined): string {
  if (!f || !f.counted) return "No visitor counted yet.";
  const pc = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(Math.abs(r) < 0.1 ? 1 : 0)}%`);
  const sg = (r: number | null) => (r === null ? "–" : `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(1)}%`);
  const range = f.uplift.low !== null && f.uplift.high !== null ? ` (${sg(f.uplift.low)} to ${sg(f.uplift.high)})` : "";
  return `B: ${pc(f.b.rate)} add to cart, A: ${pc(f.a.rate)} - ${sg(f.uplift.mid)}${range}`;
}

/** The day-by-day line as a small chart's points: each day's cart rate so far for A and B, scaled into w × h. */
export function sparkPoints(daily: readonly { rateA: number | null; rateB: number | null }[], w = 160, h = 36): { a: string; b: string } {
  const pts = daily.filter((d) => d.rateA !== null || d.rateB !== null);
  if (pts.length < 2) return { a: "", b: "" };
  const all = pts.flatMap((d) => [d.rateA, d.rateB]).filter((x): x is number => x !== null);
  const hi = Math.max(...all, 0.0001);
  const lo = Math.min(...all, 0);
  const y = (r: number) => (h - 2 - ((r - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1);
  const line = (k: "rateA" | "rateB") => pts.map((d, i) => (d[k] === null ? null : `${((i / (pts.length - 1)) * w).toFixed(1)},${y(d[k]!)}`)).filter(Boolean).join(" ");
  return { a: line("rateA"), b: line("rateB") };
}

/* ── 4. the loop with A/B testing (Content v19, 14.11.2026 - dev-eb's side of it: each letter its own version, each test
   its origin, "published" closes a won test once its winner is on the shop) ── */

/** The page's letter a test's version arm is: the letter its convert version was made under (A/B testing's
 * `origin.letter`), never the letter the studio has open now. A is always the page itself here, so an "A" or none is a
 * test made before the letters were sent - then the page's only other version if it has exactly one, else not known. */
export function armLetterOf(origin: { letter?: string | null } | null | undefined, versionLetters: readonly string[]): string | null {
  const l = origin?.letter ?? null;
  if (l && l !== "A" && /^[B-D]$/.test(l)) return l;
  const others = [...new Set(versionLetters.filter((x) => x !== "A"))];
  return others.length === 1 ? others[0] : null;
}

/** "Make C the page" must record C as the test's winner first - unless A/B testing has it decided for the version already. */
export const needsDecide = (t: { status: string; winner?: string | null }) =>
  (t.status === "running" || t.status === "paused" || t.status === "stopped") && !(t.status === "stopped" && t.winner === "b");

export type WonMark = { testId: string; letter: string; view: string; at: string; by: string };
/** The page's waiting tests with one more (the newest first, one per test, ten at most). */
export const withWon = (list: readonly WonMark[], m: WonMark): WonMark[] => [m, ...list.filter((x) => x.testId !== m.testId)].slice(0, 10);

/** The waiting tests a production write closes: each one whose store view was written - its own, or one of the store
 * views its version goes to (`storesOf`) - without an error. */
export function wonDue(list: readonly WonMark[], results: readonly { view: string; ok: boolean }[], storesOf: (view: string) => readonly string[]): WonMark[] {
  const written = new Set(results.filter((r) => r.ok).map((r) => r.view));
  return list.filter((m) => written.has(m.view) || storesOf(m.view).some((s) => written.has(s)));
}

/** What A/B testing's log says about it (300 characters at most there). */
export const wonHow = (m: Pick<WonMark, "letter" | "view">, stores: readonly string[]) =>
  `Made ${m.letter || "the version"} the page in the Page builder and wrote it into Magento production (${[...new Set([m.view, ...stores])].join(", ")})`.slice(0, 300);
