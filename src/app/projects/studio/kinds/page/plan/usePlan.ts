"use client";
// THE AI BUILDS WITH MODULES - the studio's side (Content v7, 10.11.2026; SARCLA points 5 and 13: "the quality of
// generation is far from good", "the AI could directly bring modules and adjust text").
//
// "Ideas for this page", "Make it more convincing", a part's ask and a free ask answer with a PLAN (the `plan` task,
// src/lib/content/studio/kinds/page/plan/*): steps that add a module of the library at a place, put one in place of a part,
// give a module the hub put there new words, or (no module fits) add a free block. One step is applied at once; more are
// shown first as a short list - Apply all, or one by one.
//
// A step applied:
//   1. AT ONCE in the page: the module's skeleton (its own shape, grey, "Filling it from the shop…") drawn into the frame
//      at its place (./overlay.ts), scrolled to and lit
//   2. filled from the shop (the `plan_fill` action: the category tree, most viewed, most bought, numbers), drawn
//   3. saved as a change of the store view (held back while it is checked), listed in "Changes made here" with Undo
//   4. checked like every block (../guard.ts: it must read well at the desktop's width and a phone's) - held back with the
//      reason in plain words when it does not
//   5. once the server's picture of the page has it, the frame's own drawing goes; if the server did NOT draw it (its place
//      not found, hidden, no room) the step says so in plain words - never a change listed that nobody can see

import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioApi } from "../../../useStudio";
import { withChange, type PageChange, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { ChangeHit } from "@/lib/content/studio/kinds/page/shop";
import { drawModule, fitModuleOf, libModule, makeModule, moduleGapOf, readModule, skeletonOf, withWords } from "@/lib/content/studio/kinds/page/plan/library";
import { stepChange, withFill, type Plan, type PlanMode, type PlanStep } from "@/lib/content/studio/kinds/page/plan/plan";
import type { PagePart } from "@/lib/content/studio/kinds/page/plan/places";
import type { Card, ModuleRef } from "@/lib/content/studio/kinds/page/modules/types";
import type { Flash, Pending } from "./overlay";

export type StepState =
  | { state: "waiting" } | { state: "placing" } | { state: "filling" } | { state: "checking" }
  | { state: "done"; note?: string } | { state: "held"; why: string } | { state: "failed"; why: string } | { state: "lost"; why: string } | { state: "skipped" };

export type PlanRun = { plan: Plan; parts: Omit<PagePart, "text">[]; lang: string; at: number; states: Record<string, StepState> };

/** What the server's picture of the page was made from: its change list and what each found (Stage's usePagePreview). */
export type Served = { changes: PageChange[]; hits: ChangeHit[] } | null;

/** The server's picture's change list, read from the preview's key (Stage.tsx usePagePreview: [lang, source, env, path,
 * changes, texts, inserts]|fresh). */
export function servedOf(held: { key: string; out: { ok: boolean; hits?: ChangeHit[] } } | null | undefined): Served {
  if (!held || !held.out.ok) return null;
  try {
    const arr = JSON.parse(held.key.slice(0, held.key.lastIndexOf("|"))) as unknown[];
    const changes = Array.isArray(arr[4]) ? (arr[4] as PageChange[]) : [];
    return { changes, hits: held.out.hits ?? [] };
  } catch { return null; }
}

const FILLING = "Filling it from the shop…";
const WAITING = "Waiting for its turn…";

export function usePlan(o: {
  api: StudioApi;
  /** the store view shown, and its version as a page document (the latest) */
  lang: () => string;
  view: (lang: string) => PageDoc;
  /** the view's change list put back, with a line for "Changes made here" (the AI's) */
  put: (lang: string, make: (cur: PageDoc) => PageDoc, label: string, note: string, change?: string) => Promise<void>;
  /** the check after a change (Studio's checkAndPlace): null = it reads well and is applied */
  check: (id: string, lang: string, o: { fix: boolean }) => Promise<string | null>;
  /** a line of "Changes made here" gets a warning */
  warn: (label: string, why: string) => void;
  /** the server's picture of the page shown now */
  served: Served;
  /** the view's changes now (to follow an Undo) */
  changes: PageChange[];
  canAi: boolean;
}) {
  const [run, setRun] = useState<PlanRun | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const ref = useRef(o);
  ref.current = o;
  const [pend, setPend] = useState<Record<string, Pending>>({});
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busy, setBusy] = useState(false);
  const flashed = useRef(new Set<string>());
  /** the steps of the plan open now whose change is on the page (saved) - a later one after the same part goes after them */
  const placed = useRef<string[]>([]);

  const setState = (id: string, st: StepState) => setRun((r) => (r ? { ...r, states: { ...r.states, [id]: st } } : r));
  const pendFor = (step: PlanStep, html: string): Pending => {
    if (step.place.how === "change") {
      const id = step.place.change;
      const i = (ref.current.served?.changes ?? ref.current.changes).findIndex((c) => c.id === id);
      return { key: step.id, selector: "", where: "replace", change: i, html };
    }
    return { key: step.id, selector: step.place.selector, where: step.place.how === "replace" ? "replace" : step.place.where, html };
  };
  const show = (step: PlanStep, html: string, lit = false) => {
    setPend((p) => ({ ...p, [step.id]: pendFor(step, html) }));
    if (lit) setFlash({ key: step.id, nonce: Date.now() });
  };
  const unshow = (id: string) => setPend((p) => { if (!p[id]) return p; const n = { ...p }; delete n[id]; return n; });

  /** The module a step brings, with its words for the page (not filled yet). */
  const moduleOf = (step: PlanStep, base: PageChange | null): ModuleRef | null => {
    const store = ref.current.lang();
    if (step.do === "words") {
      const m = base ? readModule((base as { module?: unknown }).module) : null;
      return m ? withWords(m, step.words, step.link, step.extras, step.link2) : null;
    }
    const m0 = makeModule(step.module, store);
    if (!m0) return null;
    const m1 = withWords(m0, step.words, step.link, step.extras, step.link2);
    return step.layout ? { ...m1, settings: { ...m1.settings, layout: step.layout } } : m1;
  };

  /** One step applied: at once in the page, filled, saved, checked. Returns what to tell the person (null = it is on). */
  const apply = async (planned: PlanStep): Promise<string | null> => {
    const forLang = ref.current.lang();
    let step = planned;
    const baseOf = (st: PlanStep) => (st.place.how === "change" ? ref.current.view(forLang).changes.find((c) => c.id === (st.place as { change: string }).change) ?? null : null);
    let base = baseOf(step);
    if (step.place.how === "change" && !base) { const why = "What it was to change is not on the page any more."; setState(step.id, { state: "failed", why }); return why; }
    let module: ModuleRef | null = null;
    let html = "";
    const m1 = step.do === "block" ? null : moduleOf(step, base);
    if (step.do !== "block" && !m1) { const why = `"${step.module}" is not in the module library any more.`; setState(step.id, { state: "failed", why }); return why; }
    const lib = m1 ? libModule(m1.type) : null;
    const needsShop = step.do !== "words" && step.do !== "block" && !!lib && (lib.takes !== "none" || lib.needs.includes("picture"));
    setState(step.id, { state: needsShop ? "filling" : "placing" });
    // 1. at once: its skeleton (or the block, the module with its new words) at its place, scrolled to and lit
    show(step, step.do === "block" ? step.html : needsShop ? skeletonOf(m1!, FILLING) : drawModule(m1!), true);
    // 2. its place found again on the page as it is now (an earlier step may stand before it), and - a module of the
    //    shop's products, categories or pictures - filled from the shop
    const r = await ref.current.api.act<{ items: Card[]; feature: Card | null; note: string; missing: string[]; place: PlanStep["place"] | null; placeWhy: string }>("plan_fill", {
      lang: forLang, module: m1?.type ?? "", shop: needsShop, fill: step.fill, count: step.fill.count, target: step.target, do: step.do, where: step.where,
      // the plan's steps already on the page: one planned after the same part goes after them (the plan's order kept)
      earlier: placed.current.filter((id) => id !== step.id),
    });
    if (!r.ok) {
      const why = needsShop ? `It could not be filled from the shop: ${r.error}` : r.error;
      if (m1 && needsShop) show(step, skeletonOf(m1, why, false)); else unshow(step.id);
      setState(step.id, { state: "failed", why });
      return why;
    }
    if (!r.result.place) {
      const why = `Not on the page: ${r.result.placeWhy || "its place was not found on the page as it is now."}`;
      unshow(step.id);
      setState(step.id, { state: "failed", why });
      return why;
    }
    step = { ...step, place: r.result.place };
    base = baseOf(step);
    if (step.place.how === "change" && !base) { const why = "What it was to change is not on the page any more."; unshow(step.id); setState(step.id, { state: "failed", why }); return why; }
    if (step.do === "block") {
      html = step.html;
      show(step, html);
    } else {
      let m2 = m1!;
      if (needsShop) m2 = withFill(m1!, r.result, step.fill);
      const gap = moduleGapOf(m2);
      if (gap) {
        const why = `Not on the page: ${gap.charAt(0).toLowerCase()}${gap.slice(1)}${/[.!?]$/.test(gap) ? "" : "."}`;
        show(step, skeletonOf(m2, why, false));
        setState(step.id, { state: "failed", why });
        return why;
      }
      const fit = fitModuleOf(m2);
      module = fit.m;
      html = drawModule(module);
      show(step, html);
    }
    // 3. saved, held back while it is checked
    const change = stepChange(step, html, module, base);
    if (!change?.id) { const why = "The change could not be made."; setState(step.id, { state: "failed", why }); return why; }
    setState(step.id, { state: "checking" });
    const note = runRef.current?.plan.note ?? "";
    placed.current = [...placed.current.filter((x) => x !== change.id), change.id];
    await ref.current.put(forLang, (cur) => ({ ...cur, changes: withChange(cur.changes, { ...change, off: "Not checked yet - the check did not finish. Show it anyway, or ask again." } as PageChange) }), `AI: ${step.line}`, note, change.id);
    // 4. the check: it must read well (a free block is fixed once by the AI when it does not)
    let msg: string | null = null;
    try { msg = await ref.current.check(change.id, forLang, { fix: step.do === "block" }); } catch (e) { msg = `The check did not finish (${String((e as Error)?.message ?? e).slice(0, 80)}) - it is kept back; "Show it anyway" applies it.`; }
    const now = ref.current.view(forLang).changes.find((c) => c.id === change.id) as (PageChange & { off?: string }) | undefined;
    if (now?.off) {
      unshow(step.id);
      setState(step.id, { state: "held", why: now.off });
      return msg ?? now.off;
    }
    setState(step.id, { state: "done", note: msg ?? undefined });
    return msg;
  };

  /** Ask the AI for a plan; one step is applied at once, more are listed first. */
  const ask = async (mode: PlanMode, request: string, scope: { selector?: string; text?: string; change?: string } = {}): Promise<string | null> => {
    if (!ref.current.canAi) return "The AI is not set up on this hub.";
    const forLang = ref.current.lang();
    setBusy(true);
    try {
      const input: Record<string, unknown> = { lang: forLang, mode, request: request.slice(0, 2000), ...(scope.selector ? { selector: scope.selector.slice(0, 300) } : {}), ...(scope.text ? { text: scope.text.slice(0, 400) } : {}), ...(scope.change ? { change: scope.change } : {}) };
      const r = await ref.current.api.ai<{ plan: Plan; parts: Omit<PagePart, "text">[] }>("plan", input);
      if (!r.ok) return r.error;
      const plan = r.result.plan;
      // what is drawn of an earlier plan goes
      setPend({});
      placed.current = [];
      if (!plan.steps.length) {
        setRun(null);
        return `${plan.note}.${plan.problems.length ? ` ${plan.problems.join(" ")}` : ""} Ask again in other words.`;
      }
      const states = Object.fromEntries(plan.steps.map((s) => [s.id, { state: "waiting" } as StepState]));
      setRun({ plan, parts: r.result.parts, lang: forLang, at: Date.now(), states });
      runRef.current = { plan, parts: r.result.parts, lang: forLang, at: Date.now(), states };
      // one step: applied at once
      if (plan.steps.length === 1) return await apply(plan.steps[0]);
      return null;
    } finally { setBusy(false); }
  };

  /** Every step not applied yet: all their skeletons in the page at once, then filled one after the other. */
  const applyAll = async (): Promise<string | null> => {
    const r = runRef.current;
    if (!r) return null;
    const todo = r.plan.steps.filter((s) => { const st = r.states[s.id]?.state; return st === "waiting" || st === "failed"; });
    setBusy(true);
    try {
      for (const s of todo) {
        const m = s.do === "block" ? null : moduleOf(s, null);
        show(s, s.do === "block" ? s.html : m && s.do !== "words" ? skeletonOf(m, WAITING) : (m ? drawModule(m) : ""));
      }
      const said: string[] = [];
      for (const s of todo) { const m = await apply(s); if (m) said.push(`${s.line}: ${m}`); }
      return said.length ? said.join(" ") : null;
    } finally { setBusy(false); }
  };
  const applyOne = async (id: string): Promise<string | null> => {
    const s = runRef.current?.plan.steps.find((x) => x.id === id);
    if (!s) return null;
    setBusy(true);
    try { return await apply(s); } finally { setBusy(false); }
  };
  const skip = (id: string) => { unshow(id); setState(id, { state: "skipped" }); };
  const drop = () => {
    const r = runRef.current;
    // a step already on the page stays (it has its Undo); what is only drawn here goes
    if (r) for (const s of r.plan.steps) { const st = r.states[s.id]?.state; if (st !== "done" && st !== "checking") unshow(s.id); }
    setRun(null);
  };

  // 5. the server's picture: a step it has drawn is no longer drawn here (lit once there); one it did not draw is said
  useEffect(() => {
    const r = runRef.current;
    const sv = o.served;
    if (!r || !sv) return;
    for (const s of r.plan.steps) {
      const st = r.states[s.id]?.state;
      if (st !== "done" && st !== "checking") continue;
      const id = s.place.how === "change" ? s.place.change : s.id;
      const mine = o.changes.find((c) => c.id === id) as (PageChange & { html?: string; off?: string }) | undefined;
      if (!mine) { unshow(s.id); continue; }
      const i = sv.changes.findIndex((c) => c.id === id && (c as { html?: string }).html === mine.html && !(c as { off?: string }).off);
      if (i < 0) continue;
      unshow(s.id);
      const hit = sv.hits.find((h) => h.index === i);
      if (hit && hit.state === "missing") {
        const why = "Not on the page: the place it was put at is not on the page as the shop has it now - take it out and add it again with the +.";
        setState(s.id, { state: "lost", why });
        ref.current.warn(`AI: ${s.line}`, why);
        continue;
      }
      if (!flashed.current.has(`${id}|${i}`)) { flashed.current.add(`${id}|${i}`); setFlash({ index: i, nonce: Date.now() + i }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.served, o.changes]);

  // an Undo took a step's change out: what was drawn for it goes too
  useEffect(() => {
    const r = runRef.current;
    if (!r) return;
    for (const s of r.plan.steps) {
      const st = r.states[s.id]?.state;
      if (st !== "done" && st !== "checking" && st !== "held") continue;
      const id = s.place.how === "change" ? s.place.change : s.id;
      if (!o.changes.some((c) => c.id === id)) { unshow(s.id); if (st !== "checking") setState(s.id, { state: "waiting" }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.changes]);

  /** The frame says whether a step (or a change it lit) can be seen: if not, said in plain words. */
  const onShown = (f: { key?: string; index?: number }, why: string) => {
    if (!why) return;
    const r = runRef.current;
    if (!r) return;
    const s = f.key ? r.plan.steps.find((x) => x.id === f.key) : r.plan.steps.find((x) => {
      const id = x.place.how === "change" ? x.place.change : x.id;
      return ref.current.served?.changes.findIndex((c) => c.id === id) === f.index;
    });
    if (!s) return;
    const st = r.states[s.id]?.state;
    if (st === "failed" || st === "held" || st === "skipped") return;
    const text = `Not on the page: ${why.charAt(0).toLowerCase()}${why.slice(1)}`;
    setState(s.id, { state: "lost", why: text });
    ref.current.warn(`AI: ${s.line}`, text);
  };

  const pending = useMemo(() => Object.values(pend), [pend]);
  return { run, ask, applyAll, applyOne, skip, drop, busy, pending, flash, onShown };
}

export type PlanCtl = ReturnType<typeof usePlan>;
