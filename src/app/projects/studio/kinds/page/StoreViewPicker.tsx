"use client";
// "+ STORE VIEW": EVERY STORE VIEW OF THE SHOP, AS MAGENTO GROUPS THEM (Content v6, 10.11.2026). SARCLA 09.11.2026: "store
// views are still missing - e.g. the international ones and the EUR versions of the store". The shop's own 25 (its
// country / language switcher: src/lib/content/studio/kinds/page/storeViews.ts), a country in a currency per group -
// "Switzerland · CHF", "Switzerland · EUR", "Germany · EUR" ... "International · EUR" - each language a row that says what
// a click does: opens it (made), makes a copy (a language the page has, no AI) or has the AI translate it.

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { howToAdd, langName, shopCountries, viewName, viewState, viewsOf, type PageDoc, type StoreGroup } from "@/lib/content/studio/kinds/page/model";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import { PINK } from "../../parts";

const BLUE = "#2459d1";
const GREEN = "#1b7a55";

/** One store view as a row: its address, its language, what a click does. */
function ViewRow({ d, k, on, presence, onPick }: { d: PageDoc; k: string; on: boolean; presence: Record<string, Presence>; onPick: (k: string) => void }) {
  const st = viewState(d, k);
  const made = viewsOf(d).includes(k);
  const off = d.source !== "new" && presence[k]?.exists === false && !made;
  const how = made ? null : howToAdd(d, k);
  const tag = st === "main" ? "Its own" : st === "done" ? "Made" : st === "stale" ? "Out of date" : how?.how === "copy" ? "Copy" : "Translate";
  const tip = st === "main" ? `${viewName(k)} - the page's own store view`
    : made ? `${viewName(k)} - open it${st === "stale" ? " (the store view it was made from changed since)" : ""}`
      : `${viewName(k)} - ${how?.how === "copy" ? `a copy of ${how.from}, no AI` : `the AI translates the page from ${how?.from}`}${off ? ` · the shop's index has no such page in ${k}` : ""}`;
  return (
    <Tooltip title={tip} placement="right" enterDelay={400}>
      <Box component="button" type="button" onClick={() => onPick(k)} aria-label={viewName(k)} sx={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, width: "100%", px: 1, py: 0.6, borderRadius: "4px",
        bgcolor: on ? "rgba(36,89,209,.09)" : "transparent", "&:hover": { bgcolor: on ? "rgba(36,89,209,.12)" : "rgba(36,89,209,.05)" },
        "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
      }}>
        <Typography component="span" sx={{ width: 54, flexShrink: 0, fontSize: "0.76rem", fontWeight: 800, letterSpacing: ".02em", color: off ? "#9aa5b8" : INK, fontVariantNumeric: "tabular-nums" }}>{k.split("/")[0].toUpperCase()}</Typography>
        <Typography component="span" sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: off ? "#9aa5b8" : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{langName(k)}</Typography>
        <Box component="span" sx={{
          display: "inline-flex", alignItems: "center", gap: 0.35, flexShrink: 0, fontSize: "0.68rem", fontWeight: 700, px: 0.6, py: 0.1, borderRadius: "3px",
          color: st === "main" ? PINK : st === "done" ? GREEN : st === "stale" ? AMBER : MUTED,
          bgcolor: st === "main" ? "rgba(194,44,110,.08)" : st === "done" ? "rgba(27,122,85,.08)" : st === "stale" ? "rgba(183,121,31,.1)" : "rgba(21,34,58,.05)",
        }}>
          {st === "done" && <CheckIcon sx={{ fontSize: 12 }} />}
          {st === "stale" && <WarningAmberIcon sx={{ fontSize: 12 }} />}
          {tag}
        </Box>
      </Box>
    </Tooltip>
  );
}

/** Every store view of the shop in a panel of country groups - three columns, nothing to scroll for at 1480 px. */
export function StoreViewPicker({ anchor, onClose, ...rest }: {
  anchor: HTMLElement | null; onClose: () => void; d: PageDoc; lang: string; onPick: (k: string) => void;
  /** the shop's store views by language (the studio's list) - every one of them is shown here, by country */
  groups: StoreGroup[]; presence: Record<string, Presence>;
}) {
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "8px", width: 760, maxWidth: "calc(100vw - 32px)", boxShadow: "0 18px 50px rgba(21,34,58,.18)" } } }}>
      <StoreViewPanel {...rest} onPick={(k) => { onClose(); rest.onPick(k); }} />
    </Popover>
  );
}

/** The panel itself: a header, the country groups, one line of how a store view is made. */
export function StoreViewPanel({ d, lang, onPick, groups, presence }: { d: PageDoc; lang: string; onPick: (k: string) => void; groups: StoreGroup[]; presence: Record<string, Presence> }) {
  const countries = shopCountries(groups.flatMap((g) => g.stores), d);
  const total = countries.reduce((n, g) => n + g.stores.length, 0);
  const made = viewsOf(d).length;
  return (
    <>
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: "flex", alignItems: "baseline", gap: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 750, color: INK, flex: 1 }}>Store views</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{made} of {total} made · every store view of the shop, as Magento has them</Typography>
      </Box>
      <Box sx={{ p: 1.25, columnCount: { xs: 1, sm: 3 }, columnGap: "10px" }}>
        {countries.map((g) => (
          <Box key={g.key} sx={{ breakInside: "avoid", mb: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", p: 0.5, bgcolor: "#fff" }}>
            <Typography sx={{ px: 1, pt: 0.5, pb: 0.25, fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
              {g.country}{g.currency ? <Box component="span" sx={{ color: g.currency === "EUR" && g.country === "Switzerland" ? BLUE : MUTED }}> · {g.currency}</Box> : null}
            </Typography>
            {g.stores.map((k) => <ViewRow key={k} d={d} k={k} on={k === lang} presence={presence} onPick={onPick} />)}
          </Box>
        ))}
      </Box>
      <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.74rem", color: MUTED }}>
        Each store view is its own page in Magento. A language the page has starts as a copy (no AI); another language is translated by the assistant.
      </Typography>
    </>
  );
}
