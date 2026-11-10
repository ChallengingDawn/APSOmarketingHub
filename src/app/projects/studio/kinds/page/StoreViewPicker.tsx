"use client";
// THE PAGE'S STORE VIEWS, AS MAGENTO LISTS THEM (Content v6 -> v10). SARCLA 09.11.2026: "store views are still missing";
// 10.11.2026 (Content v7): "you should be able to multiselect store view"; and that afternoon (Content v10, point 6): "one
// page should be able to work to multiple locales directly by language association, for example de-en ch-en it's the same
// page but we should be able to see the locale and select as now on Store views" - with two photos of Magento's own CMS
// page form, its "Store View" multi-select.
//
// One page per LANGUAGE now: the English page goes to en-INT, en-CH, en-DE ... Every store view of the shop is a row,
// grouped by website as that form lists them (Switzerland EUR, Switzerland CHF, Germany ... Czech Republic, China,
// International, Poland - lib/content/studio/kinds/page/storeViews.ts), each with:
//   its tick       ticked = it gets the page of its language. A store view of a language the page has is ticked or
//                  unticked at once (no AI, no copy); one of a language the page does not have is ticked for the plan,
//                  and ONE translation makes that language for all of them (the foot says it, with its AI calls)
//   whose words    "English page" (the language's page), "Own words" (a store view split off), "Shown here" (the store
//                  view a page is shown and previewed in), "Not ticked"
//   its id         Magento's store id the write puts in store_id - "id ?" where the hub does not know it (never guessed)
//   one action     "Own words" (split it off: a copy of its language's page, then its own) / "Same words" (join it back)
// A click on a ticked row opens its page; on another, ticks it.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CheckIcon from "@mui/icons-material/Check";
import MergeIcon from "@mui/icons-material/Merge";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { langName, leadOf, shopCountries, storeKnown, storeState, viewName, viewsOf, versionOfStore, type PageDoc, type StoreGroup } from "@/lib/content/studio/kinds/page/model";
import { SHOP_COUNTRIES, SHOP_LANGUAGES, planSummary, viewsOfCountry, viewsOfLanguage, type MakeStep } from "@/lib/content/studio/kinds/page/makeViews";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import { PINK, mainBtn } from "../../parts";
import { RunLine, StepTag, useMakeViewsCtx, type Run } from "./MakeViews";

const BLUE = "#2459d1";

/** A tick - squared, as every choice. `part`: some of a group ticked. */
function Tick({ on, part, disabled, label, onClick, tip }: { on: boolean; part?: boolean; disabled?: boolean; label: string; onClick: () => void; tip?: string }) {
  const box = (
    <Box component="button" type="button" role="checkbox" aria-checked={part ? "mixed" : on} aria-label={label} disabled={disabled}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClick(); }} sx={{
        all: "unset", cursor: disabled ? "default" : "pointer", width: 15, height: 15, borderRadius: "3px", boxSizing: "border-box", flexShrink: 0, display: "grid", placeItems: "center",
        border: `1.5px solid ${on || part ? PINK : "#9aa5b8"}`, bgcolor: on ? PINK : "#fff", opacity: disabled && !on ? 0.35 : 1,
        "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 2 },
      }}>
      {on && <CheckIcon sx={{ fontSize: 12, color: "#fff" }} />}
      {part && !on && <Box sx={{ width: 7, height: 2, bgcolor: PINK, borderRadius: 1 }} />}
    </Box>
  );
  return tip ? <Tooltip title={tip} placement="left" enterDelay={300}><span style={{ display: "inline-flex" }}>{box}</span></Tooltip> : box;
}

/** Whose words a store view gets, as a small squared tag. */
function Whose({ d, k, picked, step }: { d: PageDoc; k: string; picked: boolean; step?: MakeStep }) {
  const st = storeState(d, k);
  const lead = st.version ? leadOf(d, k.slice(0, 2)) : null;
  const t = step ? (step.how === "translate" ? { c: PINK, w: "Translate · AI" } : { c: PINK, w: `${langName(k)} page` })
    : st.lead ? { c: PINK, w: `${langName(k)} page` }
      : st.own ? { c: "#8a3ffc", w: "Own words" }
        : st.version ? { c: BLUE, w: lead === st.version ? `${langName(k)} page` : `${st.version} words` }
          : picked ? { c: PINK, w: "Translate · AI" } : { c: MUTED, w: leadOf(d, k.slice(0, 2)) ? "Not ticked" : `No ${langName(k)} page` };
  return (
    <Box component="span" sx={{ flexShrink: 0, fontSize: "0.66rem", fontWeight: 700, px: 0.55, py: 0.1, borderRadius: "3px", color: t.c, bgcolor: `${t.c}12`, whiteSpace: "nowrap" }}>{t.w}</Box>
  );
}

/** One store view: its tick, its address, its language, whose words it gets, its Magento id, and its one action. */
function ViewRow({ d, k, shown, presence, onOpen, tick, step, run, act }: {
  d: PageDoc; k: string; shown: boolean; presence: Record<string, Presence>; onOpen: (k: string) => void;
  tick: { on: boolean; disabled: boolean; tip?: string; toggle: () => void } | null; step?: MakeStep; run?: Run | null;
  /** split it off / join it back (null: neither) */
  act: { icon: "split" | "join"; tip: string; run: () => void } | null;
}) {
  const st = storeState(d, k);
  const known = storeKnown(k);
  const off = d.source !== "new" && presence[k]?.exists === false && !st.version;
  const covered = !!st.version;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 0.75, pr: 0.25, borderRadius: "4px", bgcolor: shown ? "rgba(36,89,209,.07)" : tick?.on && !covered ? "rgba(194,44,110,.06)" : "transparent" }}>
      {tick ? <Tick on={tick.on} disabled={tick.disabled} tip={tick.tip} label={`${tick.on ? "Untick" : "Tick"} ${viewName(k)}`} onClick={tick.toggle} /> : <Box sx={{ width: 15, flexShrink: 0 }} />}
      <Tooltip title={`${viewName(k)}${covered ? ` - gets ${st.own ? "its own words" : `the ${st.version} page`}; a click opens it` : ""}${!known.open ? " · not open on the shop yet" : ""}${off ? ` · the shop's index has no such page in ${k}` : ""}`} placement="right" enterDelay={400}>
        <Box component="button" type="button" onClick={() => (covered ? onOpen(st.version!) : tick && !tick.disabled ? tick.toggle() : undefined)} aria-label={viewName(k)} sx={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.75, flex: 1, minWidth: 0, px: 0.75, py: 0.55, borderRadius: "4px",
          "&:hover": { bgcolor: "rgba(36,89,209,.05)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
        }}>
          {/* the store view as Magento's list writes it - its language is its first two letters (the tooltip says it) */}
          <Typography component="span" sx={{ flex: 1, minWidth: 0, fontSize: "0.76rem", fontWeight: 800, letterSpacing: ".02em", color: off || !covered ? "#7d8799" : INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {k.split("/")[0].toUpperCase()}{k.includes("/") && <Box component="span" sx={{ fontSize: "0.6rem", fontWeight: 800, color: BLUE, ml: 0.4 }}>{k.split("/")[1].toUpperCase()}</Box>}
          </Typography>
          {/* Magento's id the write puts in store_id - said, never guessed */}
          <Typography component="span" title={known.id ? `Magento store id ${known.id}` : "Magento has this store view; the hub does not know its id (its front page is not open on the shop)"}
            sx={{ width: 30, flexShrink: 0, textAlign: "right", fontSize: "0.68rem", color: known.id ? MUTED : AMBER, fontVariantNumeric: "tabular-nums", fontWeight: known.id ? 500 : 700 }}>
            {known.id ? `#${known.id}` : "id ?"}
          </Typography>
          {run?.state[k] ? <StepTag run={run} k={k} /> : <Whose d={d} k={k} picked={!!tick?.on && !covered} step={step} />}
        </Box>
      </Tooltip>
      <Box sx={{ width: 24, flexShrink: 0, display: "grid", placeItems: "center" }}>
        {act && (
          <Tooltip title={act.tip}>
            <Box component="button" type="button" aria-label={act.tip} onClick={act.run} sx={{
              all: "unset", cursor: "pointer", width: 22, height: 22, borderRadius: "4px", display: "grid", placeItems: "center", color: MUTED,
              "&:hover": { bgcolor: "rgba(138,63,252,.1)", color: "#8a3ffc" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 0 },
            }}>
              {act.icon === "split" ? <CallSplitIcon sx={{ fontSize: 15 }} /> : <MergeIcon sx={{ fontSize: 15 }} />}
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

/** A squared row of quick ticks ("all of a language", "all of a country"), each filled when all of it is ticked. */
function QuickTicks({ label, items, isOn, onToggle, disabled }: {
  label: string; items: { key: string; label: string; set: string[] }[]; isOn: (k: string) => boolean; onToggle: (set: string[], on: boolean) => void; disabled: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Typography component="span" sx={{ width: 128, flexShrink: 0, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: MUTED, whiteSpace: "nowrap" }}>{label}</Typography>
      <Box sx={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
        {items.map((o, i) => {
          const on = o.set.length > 0 && o.set.every(isOn);
          const some = !on && o.set.some(isOn);
          return (
            <Box key={o.key} component="button" type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(o.set, !on)}
              title={`${o.set.length} store view${o.set.length === 1 ? "" : "s"}: ${o.set.join(", ")}`} sx={{
                all: "unset", cursor: disabled ? "default" : "pointer", px: 0.9, py: 0.4, fontSize: "0.76rem", fontWeight: 650, whiteSpace: "nowrap",
                borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : INK, bgcolor: on ? PINK : some ? "rgba(194,44,110,.08)" : "transparent",
                "&:hover": on || disabled ? {} : { bgcolor: "rgba(194,44,110,.1)", color: PINK }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: -2 },
              }}>{o.label}</Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** Every store view of the shop in a panel of Magento's websites - three columns, nothing to scroll for at 1480 px. */
export function StoreViewPicker({ anchor, onClose, ...rest }: {
  anchor: HTMLElement | null; onClose: () => void; d: PageDoc; lang: string; onPick: (k: string) => void;
  /** the shop's store views by language (the studio's list) - every one of them is shown here, by website */
  groups: StoreGroup[]; presence: Record<string, Presence>;
}) {
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "8px", width: 1000, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 120px)", boxShadow: "0 18px 50px rgba(21,34,58,.18)" } } }}>
      <StoreViewPanel {...rest} onPick={(k) => { onClose(); rest.onPick(k); }} />
    </Popover>
  );
}

/** The panel itself: a header, the quick ticks, the websites, and the foot - the plan for new languages and its one button,
 * the run's progress, or how it works. */
export function StoreViewPanel({ d, lang, onPick, groups, presence, initialPicked = [] }: {
  d: PageDoc; lang: string; onPick: (k: string) => void; groups: StoreGroup[]; presence: Record<string, Presence>;
  /** ticked as it opens - store views of languages the page does not have yet (a static check draws the plan's foot) */
  initialPicked?: string[];
}) {
  const mv = useMakeViewsCtx();
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const [said, setSaid] = useState<string | null>(null);
  const countries = shopCountries(groups.flatMap((g) => g.stores), d);
  const all = countries.flatMap((g) => g.stores);
  const run = mv?.current ?? null;
  const running = !!run && !run.done;
  const canTick = !!mv?.canMake;
  const covered = all.filter((k) => versionOfStore(d, k));
  const shownVersion = versionOfStore(d, lang) ?? lang;
  const haveLangs = new Set(viewsOf(d).map((k) => k.slice(0, 2)));
  // a store view the run made drops out of the plan's ticks
  const coveredKey = covered.join();
  useEffect(() => { setPicked((p) => p.filter((k) => !versionOfStore(d, k))); }, [coveredKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const isOn = (k: string) => !!versionOfStore(d, k) || picked.includes(k);
  /** ticks a set on or off: the page's languages at once, the others for the plan */
  const flip = (set: string[], on: boolean) => {
    if (!mv || running) return;
    setSaid(null);
    const now = set.filter((k) => haveLangs.has(k.slice(0, 2)));
    const later = set.filter((k) => !haveLangs.has(k.slice(0, 2)));
    for (const k of now) { if (isOn(k) !== on && !storeState(d, k).own) { const m = mv.tick(k, on); if (m) setSaid(m); } }
    setPicked((p) => (on ? [...new Set([...p, ...later])] : p.filter((k) => !later.includes(k))));
  };
  const steps = mv && picked.length ? mv.plan(picked) : [];
  const tickOf = (k: string) => {
    if (!canTick) return null;
    const st = storeState(d, k);
    if (st.own) return { on: true, disabled: true, tip: st.lead ? `The ${langName(k)} page is shown in ${k} - it always goes there` : `${k} has its own words - "Same words" puts it back in the ${langName(k)} page`, toggle: () => undefined };
    return { on: isOn(k), disabled: running, toggle: () => flip([k], !isOn(k)) };
  };
  const actOf = (k: string) => {
    if (!canTick || running) return null;
    const st = storeState(d, k);
    if (st.own && !st.lead && k !== viewsOf(d)[0]) return { icon: "join" as const, tip: `Same words as the ${langName(k)} page - ${k}'s own words go (they stay in Versions)`, run: () => setSaid(mv!.join(k)) };
    if (st.version && !st.own) return { icon: "split" as const, tip: `Its own words for ${k} - a copy of the ${st.version} page, then changed on its own`, run: () => { const m = mv!.split(k); setSaid(m); if (!m) setTimeout(() => onPick(k), 80); } };
    return null;
  };
  const langs = SHOP_LANGUAGES.filter((l) => all.some((k) => k.startsWith(`${l.lang}-`)));
  return (
    <>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: "flex", alignItems: "baseline", gap: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 750, color: INK }}>Store views</Typography>
        <Typography sx={{ fontSize: "0.78rem", color: MUTED, flex: 1 }}>One page per language - tick the store views it goes to, as in Magento&apos;s Store View</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{covered.length} of {all.length} get the page</Typography>
      </Box>
      {canTick && (
        <Box sx={{ px: 2, pt: 1.1, pb: 0.25, display: "grid", gap: 0.75 }}>
          <QuickTicks label="All of a language" disabled={running} isOn={isOn} onToggle={flip}
            items={langs.map((l) => ({ key: l.lang, label: l.name, set: viewsOfLanguage(l.lang, all).filter((k) => !storeState(d, k).own) }))} />
          <QuickTicks label="All of a country" disabled={running} isOn={isOn} onToggle={flip}
            items={SHOP_COUNTRIES.map((c) => ({ key: c.cc, label: c.name, set: viewsOfCountry(c.cc, all).filter((k) => !storeState(d, k).own) }))} />
        </Box>
      )}
      <Box sx={{ p: 1.25, columnCount: { xs: 1, sm: 3 }, columnGap: "10px" }}>
        {countries.map((g) => {
          const free = g.stores.filter((k) => !storeState(d, k).own);
          const on = free.length > 0 && free.every(isOn);
          const part = !on && free.some(isOn);
          return (
            <Box key={g.key} sx={{ breakInside: "avoid", mb: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", p: 0.5, bgcolor: "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: canTick ? 0.75 : 1, pt: 0.5, pb: 0.25 }}>
                {canTick && <Tick on={on} part={part} disabled={running || !free.length} label={`Tick all of ${g.country}${g.currency ? ` ${g.currency}` : ""}`} onClick={() => flip(free, !on)} />}
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
                  {g.country}{g.currency ? <Box component="span" sx={{ color: g.currency === "EUR" && g.country === "Switzerland" ? BLUE : MUTED }}> {g.currency}</Box> : null}
                </Typography>
              </Box>
              {g.stores.map((k) => (
                <ViewRow key={k} d={d} k={k} shown={versionOfStore(d, k) === shownVersion} presence={presence} onOpen={onPick}
                  tick={tickOf(k)} run={run} step={steps.find((s) => s.key === k || s.stores?.includes(k))} act={actOf(k)} />
              ))}
            </Box>
          );
        })}
      </Box>
      {said && <Typography role="status" sx={{ px: 2, pb: 1, fontSize: "0.78rem", color: "#c5221f" }}>{said}</Typography>}
      {mv && run ? (
        <Box sx={{ px: 2, pb: 1.5, pt: 0.25 }}><RunLine mv={mv} /></Box>
      ) : picked.length > 0 && mv ? (
        <Box sx={{ mx: 1.25, mb: 1.25, px: 1.25, py: 1, display: "flex", alignItems: "center", gap: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.06)", border: "1px solid rgba(194,44,110,.22)" }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: INK, fontWeight: 600 }}>
            {planSummary(steps)}
            {steps.some((s) => s.how === "translate") && !mv.canAi && <Box component="span" sx={{ color: "#c5221f" }}> · the AI is not set up on this hub</Box>}
          </Typography>
          <Button size="small" onClick={() => setPicked([])} sx={{ textTransform: "none", fontWeight: 650, color: MUTED, minWidth: 0 }}>Clear</Button>
          <Button variant="contained" disableElevation disabled={!steps.length || !mv.canAi} onClick={() => void mv.run(picked)} sx={{ ...mainBtn, borderRadius: "6px", px: 1.75, flexShrink: 0 }}>
            {(() => { const n = steps.filter((s) => s.how === "translate").length; return n === 1 ? `Translate into ${langName(steps.find((s) => s.how === "translate")!.key)}` : `Translate into these ${n}`; })()}
          </Button>
        </Box>
      ) : (
        <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: 1, minWidth: 260 }}>
            Magento gets one page per language, for all its ticked store views. A store view that needs other words:{" "}
            <CallSplitIcon sx={{ fontSize: 13, verticalAlign: "-2px" }} /> Own words. Another language is translated by the AI once, for all of its store views.
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <Box component="span" sx={{ fontSize: "0.68rem", color: AMBER, fontWeight: 700 }}>id ?</Box> Magento has it; its id is not known to the hub
          </Typography>
        </Box>
      )}
    </>
  );
}
