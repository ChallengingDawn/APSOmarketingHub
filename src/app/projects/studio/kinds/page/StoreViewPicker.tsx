"use client";
// "+ STORE VIEW": EVERY STORE VIEW OF THE SHOP, AS MAGENTO GROUPS THEM (Content v6, 10.11.2026). SARCLA 09.11.2026: "store
// views are still missing - e.g. the international ones and the EUR versions of the store". The shop's own 25 (its
// country / language switcher: src/lib/content/studio/kinds/page/storeViews.ts), a country in a currency per group -
// "Switzerland · CHF", "Switzerland · EUR", "Germany · EUR" ... "International · EUR" - each language a row that says what
// a click does: opens it (made), makes a copy (a language the page has, no AI) or has the AI translate it.
// Content v7 (SARCLA 10.11.2026: "you should be able to multiselect store view"): each store view not made yet has a
// tick, a country's header ticks all of it, two quick rows tick all of a language or all of a country; the foot says the
// plan - copies (no AI), translations and how many AI calls - and ONE button makes them, one at a time, each row showing
// its progress (./MakeViews.tsx). A click on the row itself still opens that one store view.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { howToAdd, langName, shopCountries, viewName, viewState, viewsOf, type PageDoc, type StoreGroup } from "@/lib/content/studio/kinds/page/model";
import { SHOP_COUNTRIES, SHOP_LANGUAGES, planSummary, toggleAll, viewsOfCountry, viewsOfLanguage } from "@/lib/content/studio/kinds/page/makeViews";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import { PINK, mainBtn } from "../../parts";
import { RunLine, StepTag, useMakeViewsCtx, type Run } from "./MakeViews";

const BLUE = "#2459d1";
const GREEN = "#1b7a55";

/** The tick of a store view not made yet - squared, as every choice. `part`: some of a group ticked. */
function Tick({ on, part, disabled, label, onClick }: { on: boolean; part?: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <Box component="button" type="button" role="checkbox" aria-checked={part ? "mixed" : on} aria-label={label} disabled={disabled}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClick(); }} sx={{
        all: "unset", cursor: disabled ? "default" : "pointer", width: 15, height: 15, borderRadius: "3px", boxSizing: "border-box", flexShrink: 0, display: "grid", placeItems: "center",
        border: `1.5px solid ${on || part ? PINK : "#9aa5b8"}`, bgcolor: on ? PINK : "#fff", opacity: disabled ? 0.35 : 1,
        "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 2 },
      }}>
      {on && <CheckIcon sx={{ fontSize: 12, color: "#fff" }} />}
      {part && !on && <Box sx={{ width: 7, height: 2, bgcolor: PINK, borderRadius: 1 }} />}
    </Box>
  );
}

/** One store view as a row: its tick (not made yet), its address, its language, what a click does - or, in a run, how far. */
function ViewRow({ d, k, on, presence, onPick, tick, run }: {
  d: PageDoc; k: string; on: boolean; presence: Record<string, Presence>; onPick: (k: string) => void;
  /** undefined: no ticks in this panel; null: this one cannot be ticked (made already) */
  tick?: { on: boolean; disabled: boolean; toggle: () => void } | null; run?: Run | null;
}) {
  const st = viewState(d, k);
  const made = viewsOf(d).includes(k);
  const off = d.source !== "new" && presence[k]?.exists === false && !made;
  const how = made ? null : howToAdd(d, k);
  const tag = st === "main" ? "Its own" : st === "done" ? "Made" : st === "stale" ? "Out of date" : how?.how === "copy" ? "Copy" : "Translate";
  const tip = st === "main" ? `${viewName(k)} - the page's own store view`
    : made ? `${viewName(k)} - open it${st === "stale" ? " (the store view it was made from changed since)" : ""}`
      : `${viewName(k)} - ${how?.how === "copy" ? `a copy of ${how.from}, no AI` : `the AI translates the page from ${how?.from}`}${off ? ` · the shop's index has no such page in ${k}` : ""}`;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: tick !== undefined ? 0.75 : 0, borderRadius: "4px", bgcolor: tick?.on ? "rgba(194,44,110,.06)" : "transparent" }}>
      {tick !== undefined && (tick ? <Tick on={tick.on} disabled={tick.disabled} label={`Tick ${viewName(k)}`} onClick={tick.toggle} /> : <Box sx={{ width: 15, flexShrink: 0 }} />)}
      <Tooltip title={tip} placement="right" enterDelay={400}>
        <Box component="button" type="button" onClick={() => onPick(k)} aria-label={viewName(k)} sx={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0, px: 1, py: 0.6, borderRadius: "4px",
          bgcolor: on ? "rgba(36,89,209,.09)" : "transparent", "&:hover": { bgcolor: on ? "rgba(36,89,209,.12)" : "rgba(36,89,209,.05)" },
          "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
        }}>
          <Typography component="span" sx={{ width: 50, flexShrink: 0, fontSize: "0.76rem", fontWeight: 800, letterSpacing: ".02em", color: off ? "#9aa5b8" : INK, fontVariantNumeric: "tabular-nums" }}>{k.split("/")[0].toUpperCase()}</Typography>
          <Typography component="span" sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: off ? "#9aa5b8" : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{langName(k)}</Typography>
          {run?.state[k] ? <StepTag run={run} k={k} /> : (
            <Box component="span" sx={{
              display: "inline-flex", alignItems: "center", gap: 0.35, flexShrink: 0, fontSize: "0.68rem", fontWeight: 700, px: 0.6, py: 0.1, borderRadius: "3px",
              color: st === "main" ? PINK : st === "done" ? GREEN : st === "stale" ? AMBER : MUTED,
              bgcolor: st === "main" ? "rgba(194,44,110,.08)" : st === "done" ? "rgba(27,122,85,.08)" : st === "stale" ? "rgba(183,121,31,.1)" : "rgba(21,34,58,.05)",
            }}>
              {st === "done" && <CheckIcon sx={{ fontSize: 12 }} />}
              {st === "stale" && <WarningAmberIcon sx={{ fontSize: 12 }} />}
              {tag}
            </Box>
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}

/** A squared row of quick ticks ("all of a language", "all of a country"), each filled when all of it is ticked. */
function QuickTicks({ label, items, picked, onToggle, disabled }: {
  label: string; items: { key: string; label: string; set: string[] }[]; picked: string[]; onToggle: (set: string[]) => void; disabled: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Typography component="span" sx={{ width: 118, flexShrink: 0, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED }}>{label}</Typography>
      <Box sx={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
        {items.map((o, i) => {
          const on = o.set.length > 0 && o.set.every((k) => picked.includes(k));
          const some = !on && o.set.some((k) => picked.includes(k));
          const dead = disabled || !o.set.length;
          return (
            <Box key={o.key} component="button" type="button" aria-pressed={on} disabled={dead} onClick={() => onToggle(o.set)}
              title={o.set.length ? `${o.set.length} not made yet: ${o.set.join(", ")}` : "Every one is made"} sx={{
                all: "unset", cursor: dead ? "default" : "pointer", px: 0.9, py: 0.4, fontSize: "0.76rem", fontWeight: 650, whiteSpace: "nowrap",
                borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : !o.set.length ? "#b3bccb" : INK, bgcolor: on ? PINK : some ? "rgba(194,44,110,.08)" : "transparent",
                "&:hover": on || dead ? {} : { bgcolor: "rgba(194,44,110,.1)", color: PINK }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: -2 },
              }}>{o.label}</Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** Every store view of the shop in a panel of country groups - three columns, nothing to scroll for at 1480 px. A run of
 * several keeps it open (its rows show their progress); a click on one row opens that store view and closes it. */
export function StoreViewPicker({ anchor, onClose, ...rest }: {
  anchor: HTMLElement | null; onClose: () => void; d: PageDoc; lang: string; onPick: (k: string) => void;
  /** the shop's store views by language (the studio's list) - every one of them is shown here, by country */
  groups: StoreGroup[]; presence: Record<string, Presence>;
}) {
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "8px", width: 820, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 120px)", boxShadow: "0 18px 50px rgba(21,34,58,.18)" } } }}>
      <StoreViewPanel {...rest} onPick={(k) => { onClose(); rest.onPick(k); }} />
    </Popover>
  );
}

/** The panel itself: a header, the quick ticks, the country groups, and the foot - the plan and its one button, the run's
 * progress, or how a store view is made. */
export function StoreViewPanel({ d, lang, onPick, groups, presence }: { d: PageDoc; lang: string; onPick: (k: string) => void; groups: StoreGroup[]; presence: Record<string, Presence> }) {
  const mv = useMakeViewsCtx();
  const [picked, setPicked] = useState<string[]>([]);
  const countries = shopCountries(groups.flatMap((g) => g.stores), d);
  const all = countries.flatMap((g) => g.stores);
  const have = viewsOf(d);
  const run = mv?.current ?? null;
  const running = !!run && !run.done;
  // only a store view not made yet is ticked (one made is opened - or translated again from its own view)
  const open = all.filter((k) => !have.includes(k));
  const canTick = !!mv?.canMake;
  const haveKey = have.join();
  // a store view the run made drops out of the ticks
  useEffect(() => { setPicked((p) => p.filter((k) => !have.includes(k))); }, [haveKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (set: string[]) => setPicked((p) => toggleAll(p, set.filter((k) => open.includes(k))));
  const steps = mv && picked.length ? mv.plan(picked) : [];
  const tickOf = (k: string) => (!canTick ? undefined : open.includes(k) ? { on: picked.includes(k), disabled: running, toggle: () => flip([k]) } : null);
  return (
    <>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: "flex", alignItems: "baseline", gap: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 750, color: INK, flex: 1 }}>Store views</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{have.length} of {all.length} made · every store view of the shop, as Magento has them</Typography>
      </Box>
      {canTick && (
        <Box sx={{ px: 2, pt: 1.1, pb: 0.25, display: "grid", gap: 0.75 }}>
          <QuickTicks label="All of a language" disabled={running} picked={picked} onToggle={flip}
            items={SHOP_LANGUAGES.map((l) => ({ key: l.lang, label: l.name, set: viewsOfLanguage(l.lang, all).filter((k) => open.includes(k)) }))} />
          <QuickTicks label="All of a country" disabled={running} picked={picked} onToggle={flip}
            items={SHOP_COUNTRIES.map((c) => ({ key: c.cc, label: c.name, set: viewsOfCountry(c.cc, all).filter((k) => open.includes(k)) }))} />
        </Box>
      )}
      <Box sx={{ p: 1.25, columnCount: { xs: 1, sm: 3 }, columnGap: "10px" }}>
        {countries.map((g) => {
          const free = g.stores.filter((k) => open.includes(k));
          const on = free.length > 0 && free.every((k) => picked.includes(k));
          const part = !on && free.some((k) => picked.includes(k));
          return (
            <Box key={g.key} sx={{ breakInside: "avoid", mb: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", p: 0.5, bgcolor: "#fff" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: canTick ? 0.75 : 1, pt: 0.5, pb: 0.25 }}>
                {canTick && <Tick on={on} part={part} disabled={running || !free.length} label={`Tick all of ${g.country}${g.currency ? ` · ${g.currency}` : ""}`} onClick={() => flip(free)} />}
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
                  {g.country}{g.currency ? <Box component="span" sx={{ color: g.currency === "EUR" && g.country === "Switzerland" ? BLUE : MUTED }}> · {g.currency}</Box> : null}
                </Typography>
              </Box>
              {g.stores.map((k) => <ViewRow key={k} d={d} k={k} on={k === lang} presence={presence} onPick={onPick} tick={tickOf(k)} run={run} />)}
            </Box>
          );
        })}
      </Box>
      {mv && run ? (
        <Box sx={{ px: 2, pb: 1.5, pt: 0.25 }}><RunLine mv={mv} /></Box>
      ) : picked.length > 0 && mv ? (
        <Box sx={{ mx: 1.25, mb: 1.25, px: 1.25, py: 1, display: "flex", alignItems: "center", gap: 1.25, borderRadius: "8px", bgcolor: "rgba(194,44,110,.06)", border: "1px solid rgba(194,44,110,.22)" }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: INK, fontWeight: 600 }}>
            {planSummary(steps)}
            {steps.some((s) => s.how === "translate") && !mv.canAi && <Box component="span" sx={{ color: "#c5221f" }}> · the AI is not set up on this hub - only the copies can be made</Box>}
          </Typography>
          <Button size="small" onClick={() => setPicked([])} sx={{ textTransform: "none", fontWeight: 650, color: MUTED, minWidth: 0 }}>Clear</Button>
          <Button variant="contained" disableElevation disabled={!steps.length} onClick={() => void mv.run(picked)} sx={{ ...mainBtn, borderRadius: "6px", px: 1.75, flexShrink: 0 }}>
            Make {steps.length === 1 ? "it" : `these ${steps.length}`}
          </Button>
        </Box>
      ) : (
        <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.74rem", color: MUTED }}>
          Each store view is its own page in Magento. A language the page has starts as a copy (no AI); another language is translated by the AI.{canTick ? " Tick several to make them in one go." : ""}
        </Typography>
      )}
    </>
  );
}
