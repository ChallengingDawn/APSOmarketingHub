"use client";
// SEVERAL STORE VIEWS MADE IN ONE GO (Content v7, 10.11.2026 - SARCLA: "you should be able to multiselect store view").
// The page studio holds ONE maker (useMakeViews) and hands it down by context, so "+ Store view" (./StoreViewPicker.tsx)
// and the assistant's "Translate the whole page into" row (TranslateMany, below) tick store views and run the same plan:
// copies where the page has the language (no AI), a translation otherwise - how many AI calls is said before it starts -
// then one store view at a time, each with its progress (waiting, copying, translating, made, or why not), and a stop.
// The plan itself is pure: lib/content/studio/kinds/page/makeViews.ts.
// Content v10 (SARCLA point 6): a version is a language - a store view of a language the page has is ticked into that
// language's page at once (no copy, no AI); a new language is translated once and goes to the store views ticked of it.

import { createContext, useContext, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { planSummary, planViews, type MakeStep } from "@/lib/content/studio/kinds/page/makeViews";
import { copyView, joinStore, langName, langOfStore, leadOf, mainView, pageDoc, splitStore, storesInLanguage, tickStore, versionOfStore, viewState, viewsLine, viewsOf, withStores, type PageDoc, type StoreGroup } from "@/lib/content/studio/kinds/page/model";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import { PINK, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";

const GREEN = "#1b7a55";

export type StepState = "waiting" | "doing" | "done" | "failed";
export type Run = { steps: MakeStep[]; state: Record<string, { s: StepState; msg?: string }>; at: number; stopping: boolean; done: boolean };

export type MakeViews = {
  canMake: boolean; canAi: boolean;
  /** the plan for these store views, as it would run now */
  plan: (keys: readonly string[]) => MakeStep[];
  run: (keys: readonly string[]) => Promise<void>;
  stop: () => void;
  /** the run going on (or the last one, until it is cleared) */
  current: Run | null;
  clear: () => void;
  /** Content v10 - a store view ticked on or off for its language's page (no AI), given its own words, or joined back;
   * each returns what to say when it could not be done */
  tick: (store: string, on: boolean) => string | null;
  split: (store: string) => string | null;
  join: (store: string) => string | null;
};

const Ctx = createContext<MakeViews | null>(null);
export const MakeViewsProvider = Ctx.Provider;
export const useMakeViewsCtx = () => useContext(Ctx);

/**
 * The page studio's maker. `translate` is the studio's own (it finds the page in that store view, asks the AI, records it,
 * shows it); a copy is made here, on the document as it is at that moment, and recorded in "Changes made here".
 */
export function useMakeViews(o: {
  api: StudioApi; language: string | null | undefined; canEdit: boolean; canAi: boolean;
  presence: () => Record<string, Presence>;
  record: (label: string, before: PageDoc) => void;
  translate: (key: string) => Promise<string | null>;
}): MakeViews {
  const [current, setCurrent] = useState<Run | null>(null);
  const stopRef = useRef(false);
  const busy = !!current && !current.done;
  /** the document as the studio last set it - the newest, even before React has drawn it */
  const latest = (): PageDoc => {
    let raw: unknown = o.api.doc;
    o.api.setDoc((r: unknown) => { raw = r; return r; });
    return pageDoc(raw, o.language);
  };
  // the plan as drawn: on the document of this render (never a set while drawing)
  const plan = (keys: readonly string[]) => planViews(pageDoc(o.api.doc, o.language), keys);
  const mark = (key: string, s: StepState, msg?: string) => setCurrent((c) => (c ? { ...c, state: { ...c.state, [key]: { s, msg } } } : c));

  const copy = (step: MakeStep): string | null => {
    const cur = latest();
    if (viewsOf(cur).includes(step.key)) return null;
    const there = o.presence()[step.key];
    // a page of the shop is copied onto ITS page in that store view - when the shop has one there
    if (cur.source !== "new" && !there?.path) return there?.exists === false ? "The shop has no such page in this store view." : "Its page in this store view is not known yet - open it and pick it.";
    o.record(`Copied ${step.from} into ${step.key}`, cur);
    o.api.setDoc(copyView(cur, step.key, step.from, cur.source === "new" ? "" : there?.path ?? ""));
    return null;
  };

  const run = async (keys: readonly string[]) => {
    if (busy || !o.canEdit) return;
    const steps = planViews(latest(), keys);
    if (!steps.length) return;
    stopRef.current = false;
    setCurrent({ steps, state: Object.fromEntries(steps.map((s) => [s.key, { s: "waiting" as StepState }])), at: 0, stopping: false, done: false });
    // the store views of the page's languages: into their language's page at once - one change, no AI
    const ticks = steps.filter((s) => s.how === "tick");
    if (ticks.length) {
      const cur = latest();
      let next = cur;
      for (const t of ticks) next = tickStore(next, t.key, true);
      o.record(`Ticked ${ticks.map((t) => t.key).join(", ")}`, cur);
      o.api.setDoc(next);
      for (const t of ticks) mark(t.key, versionOfStore(next, t.key) ? "done" : "failed", versionOfStore(next, t.key) ? undefined : "Its language has no page yet.");
      await new Promise((r) => setTimeout(r, 120));
    }
    for (const [i, step] of steps.entries()) {
      if (step.how === "tick") continue;
      if (stopRef.current) break;
      setCurrent((c) => (c ? { ...c, at: i } : c));
      mark(step.key, "doing");
      if (step.how === "copy") {
        // its source may have failed (a translation that did not come): then this one is not made either
        if (!viewsOf(latest()).includes(step.from)) { mark(step.key, "failed", `${step.from} was not made - nothing to copy.`); continue; }
        const why = copy(step);
        mark(step.key, why ? "failed" : "done", why ?? undefined);
        // the studio saves in small steps: a breath between two
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      if (!o.canAi) { mark(step.key, "failed", "The AI is not set up on this hub."); continue; }
      const before = latest().langs[step.key]?.at ?? "";
      const said = await o.translate(step.key).catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
      const after = latest().langs[step.key];
      const made = !!after && after.at !== before && after.made === "translate";
      // the new language goes to the store views ticked of it (all of them from "Translate the whole page into")
      if (made && step.stores?.length) { const cur = latest(); o.api.setDoc(withStores(cur, step.key, step.stores)); }
      mark(step.key, made ? "done" : "failed", made ? undefined : said ?? "It was not translated - try it alone.");
    }
    setCurrent((c) => (c ? { ...c, done: true, stopping: false } : c));
  };

  return {
    canMake: o.canEdit, canAi: o.canAi, plan, run, current,
    stop: () => { stopRef.current = true; setCurrent((c) => (c ? { ...c, stopping: true } : c)); },
    clear: () => { if (!busy) setCurrent(null); },
    tick: (store, on) => {
      if (!o.canEdit) return "For the project's editors.";
      const cur = latest();
      const next = tickStore(cur, store, on);
      if (next === cur) return on && !leadOf(cur, langOfStore(store)) ? `The page has no ${langName(store)} yet - tick it and translate.` : null;
      const v = versionOfStore(on ? next : cur, store);
      o.record(on ? `Ticked ${store} for the ${langName(store)} page` : `Took ${store} out of ${v ?? "the page"}`, cur);
      o.api.setDoc(next);
      return null;
    },
    split: (store) => {
      if (!o.canEdit) return "For the project's editors.";
      const cur = latest();
      const there = o.presence()[store];
      // a page of the shop: its own words go onto ITS page in that store view - when the shop has one there
      if (cur.source !== "new" && !there?.path) return there?.exists === false ? `The shop has no such page in ${store}.` : `Its page in ${store} is not known yet - open it and pick it.`;
      const next = splitStore(cur, store, cur.source === "new" ? "" : there?.path ?? "");
      if (next === cur) return null;
      o.record(`${store} got its own words (a copy of ${versionOfStore(cur, store) ?? "its language's page"})`, cur);
      o.api.setDoc(next);
      return null;
    },
    join: (store) => {
      if (!o.canEdit) return "For the project's editors.";
      const cur = latest();
      const next = joinStore(cur, store);
      if (next === cur) return null;
      o.record(`${store} has the ${langName(store)} page's words again`, cur);
      o.api.setDoc(next);
      return null;
    },
  };
}

/* ── what a store view's row shows while a run goes ─────────────────────────────────────────────────────────────── */

/** A step's state, as a small squared tag (or null when the store view is not in the run). */
export function StepTag({ run, k }: { run: Run | null; k: string }) {
  const st = run?.state[k];
  if (!st) return null;
  const step = run!.steps.find((x) => x.key === k);
  const doing = step?.how === "translate" ? "Translating…" : step?.how === "tick" ? "Adding…" : "Copying…";
  const look = st.s === "done" ? { c: GREEN, t: "Made" } : st.s === "failed" ? { c: "#c5221f", t: "Not made" } : st.s === "doing" ? { c: PINK, t: doing } : { c: MUTED, t: "Waiting" };
  const tag = (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.35, flexShrink: 0, fontSize: "0.68rem", fontWeight: 700, px: 0.6, py: 0.1, borderRadius: "3px", color: look.c, bgcolor: `${look.c}14` }}>
      {st.s === "doing" && <CircularProgress size={9} thickness={7} sx={{ color: PINK }} />}
      {st.s === "done" && <CheckIcon sx={{ fontSize: 12 }} />}
      {st.s === "failed" && <ErrorOutlineIcon sx={{ fontSize: 12 }} />}
      {look.t}
    </Box>
  );
  return st.msg ? <Tooltip title={st.msg}>{tag}</Tooltip> : tag;
}

/** The run in one line, with its stop: "Making 2 of 5 · translating fr-FR" / "5 made" / "4 made, 1 not". */
export function RunLine({ mv }: { mv: MakeViews }) {
  const r = mv.current;
  if (!r) return null;
  const vals = Object.values(r.state);
  const done = vals.filter((x) => x.s === "done").length;
  const failed = r.steps.filter((s) => r.state[s.key]?.s === "failed");
  const now = r.steps[r.at];
  const pct = Math.round(((done + failed.length) / r.steps.length) * 100);
  return (
    <Box sx={{ display: "grid", gap: 0.6 }}>
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: "rgba(21,34,58,.08)", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${r.done ? 100 : Math.max(4, pct)}%`, bgcolor: r.done && failed.length ? AMBER : r.done ? GREEN : PINK, transition: "width .3s ease" }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexWrap: "wrap", rowGap: 0.25 }}>
        <Typography role="status" sx={{ flex: "1 1 180px", minWidth: 0, fontSize: "0.8rem", color: INK, fontWeight: 600 }}>
          {!r.done
            ? <>{r.stopping ? "Stopping after this one - " : ""}Making {Math.min(r.at + 1, r.steps.length)} of {r.steps.length} · <Box component="span" sx={{ color: PINK, whiteSpace: "nowrap" }}>{now?.how === "translate" ? `translating into ${langName(now.key)}` : now?.how === "tick" ? "adding" : "copying"} {now?.how === "translate" ? "" : now?.key}</Box></>
            : `${done} made${failed.length ? `, ${failed.length} not` : ""}${done + failed.length < r.steps.length ? `, ${r.steps.length - done - failed.length} stopped` : ""}`}
        </Typography>
        {!r.done && !r.stopping && <Button size="small" onClick={mv.stop} sx={{ textTransform: "none", fontWeight: 650, color: MUTED, minWidth: 0, px: 0.75, whiteSpace: "nowrap", ml: "auto" }}>Stop after this one</Button>}
        {r.done && <Button size="small" onClick={mv.clear} sx={{ textTransform: "none", fontWeight: 650, color: MUTED, minWidth: 0, px: 0.75, ml: "auto" }}>Close</Button>}
      </Box>
      {/* why each one was not made, in its own words */}
      {failed.map((s) => (
        <Typography key={s.key} sx={{ fontSize: "0.76rem", color: "#c5221f", lineHeight: 1.4 }}>
          <Box component="span" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{s.key}:</Box> {r.state[s.key]?.msg ?? "not made"}
        </Typography>
      ))}
    </Box>
  );
}

/* ── the assistant's row: translate the whole page into several, ticked ─────────────────────────────────────────── */

/**
 * "Translate the whole page into" (Content v7: tick several; Content v10: by LANGUAGE). The languages the shop has besides
 * the page's own - each a squared tick; one button translates the ticked ones, each once, going to every store view of its
 * language (the store view panel unticks any). A language made already says so (open it to translate it again).
 */
export function TranslateMany({ doc, groups, enabled, initialPicked = [] }: { doc: PageDoc; groups: StoreGroup[]; enabled: boolean; initialPicked?: string[] }) {
  const mv = useMakeViewsCtx();
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const main = mainView(doc);
  const list = groups.filter((g) => g.lang !== langOfStore(main)).map((g) => ({ lang: g.lang, name: g.name, lead: leadOf(doc, g.lang), stores: storesInLanguage(g.lang) }));
  if (!list.length || !mv) return null;
  const running = !!mv.current && !mv.current.done;
  const ofPicked = picked.filter((l) => !list.find((x) => x.lang === l)?.lead);
  const steps = mv.plan(ofPicked.flatMap((l) => storesInLanguage(l)));
  const again = picked.filter((l) => list.find((x) => x.lang === l)?.lead);
  const toggle = (l: string) => setPicked((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Translate the whole page into</Typography>
      <Box role="group" aria-label="Translate into" sx={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
        {list.map((o, i) => {
          const st = o.lead ? viewState(doc, o.lead) : "empty";
          const on = picked.includes(o.lang);
          const runSt = o.lead ? undefined : steps.find((x) => x.how === "translate" && langOfStore(x.key) === o.lang) && mv.current?.state[steps.find((x) => langOfStore(x.key) === o.lang)!.key]?.s;
          return (
            <Tooltip key={o.lang} title={`${o.name} · ${o.stores.length} store view${o.stores.length === 1 ? "" : "s"}: ${o.stores.join(", ")}${st === "done" ? " - made" : st === "stale" ? " - out of date" : ""}`}>
              <Box component="button" type="button" aria-pressed={on} disabled={!enabled || running} onClick={() => toggle(o.lang)} sx={{
                all: "unset", cursor: !enabled || running ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.6, fontSize: "0.8rem", fontWeight: 700,
                borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : !enabled ? "#b3bccb" : INK, bgcolor: on ? PINK : "transparent", transition: "background-color .12s",
                "&:hover": on || !enabled || running ? {} : { bgcolor: "rgba(194,44,110,.07)", color: PINK },
              }}>
                {runSt === "doing" ? <CircularProgress size={11} sx={{ color: on ? "#fff" : PINK }} />
                  : <Box component="span" sx={{ width: 10, height: 10, borderRadius: "2px", border: `1.5px solid ${on ? "#fff" : "#9aa5b8"}`, display: "grid", placeItems: "center", boxSizing: "border-box" }}>{on && <CheckIcon sx={{ fontSize: 9 }} />}</Box>}
                {o.name}
                {!on && runSt !== "doing" && st === "done" && <CheckIcon sx={{ fontSize: 13, color: GREEN }} />}
                {!on && runSt !== "doing" && st === "stale" && <WarningAmberIcon sx={{ fontSize: 13, color: AMBER }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {running || mv.current?.done ? (
        <Box sx={{ mt: 1 }}><RunLine mv={mv} /></Box>
      ) : picked.length > 0 ? (
        <Box sx={{ mt: 1, display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.76rem", color: INK }}>{steps.length ? planSummary(steps) : "Nothing new to make."}{again.length ? ` ${again.map(langName).join(", ")} ${again.length === 1 ? "is" : "are"} made already - open ${again.length === 1 ? "it" : "each"} to translate it again.` : ""}</Typography>
          <Button variant="contained" disableElevation disabled={!enabled || !steps.length} onClick={() => { void mv.run(ofPicked.flatMap((l) => storesInLanguage(l))).then(() => setPicked([])); }}
            sx={{ ...mainBtn, borderRadius: "6px", justifySelf: "start", px: 1.75 }}>
            {`Translate ${steps.length === 1 ? "it" : `into these ${steps.length}`}`}
          </Button>
        </Box>
      ) : (
        <Typography sx={{ mt: 0.75, fontSize: "0.74rem", color: MUTED }}>{viewsLine(doc, groups)} · one page per language, for all its store views</Typography>
      )}
    </Box>
  );
}
