"use client";
// THE A/B TEST IN THE STUDIO'S TOP BAR (Content v8, 10.11.2026). SARCLA (point 6): "A/B testing should be on top header -
// if I click activate then I can set it on the last step". The page studio hands the bar its test's state - Off, Planned
// or Running (src/lib/content/studio/kinds/page/abState.ts) - and what a click does; the bar draws a small squared control:
//   Off               a click opens a small card: "Activate" (the setup then opens in the Build pane's last step)
//   Planned, Running  a click opens the last step, where the setup is (which versions, the split, the goal, who)
// Like the timeline (./frame.tsx) the state lives in a small store outside React's tree: the studio publishes on every
// render, only the bar's control draws again - and only when what it says changed. A studio that publishes nothing (every
// kind but the page, a new page) shows no control.

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { AB_STATE_LABEL, type AbState } from "@/lib/content/studio/kinds/page/abState";
import { mainBtn } from "./parts";

export type AbBar = {
  state: AbState;
  /** the tooltip: what runs against what - or "No A/B test on this page" */
  line: string;
  canEdit: boolean;
  /** "Activate": switched on, the last step opened on its setup */
  onActivate: () => void;
  /** the last step opened on the test's setup */
  onOpen: () => void;
};

type Store = { get: () => AbBar | null; snap: () => { n: number; v: AbBar | null }; set: (v: AbBar | null) => void; subscribe: (fn: () => void) => () => void };

function makeStore(): Store {
  let current: AbBar | null = null;
  let said = "none";
  let snap = { n: 0, v: null as AbBar | null };
  const fns = new Set<() => void>();
  return {
    get: () => current,
    snap: () => snap,
    set: (v) => {
      current = v;
      const s = v ? `${v.state}|${v.line}|${v.canEdit ? 1 : 0}` : "none";
      if (s === said) return;
      said = s;
      snap = { n: snap.n + 1, v };
      fns.forEach((f) => f());
    },
    subscribe: (fn) => { fns.add(fn); return () => fns.delete(fn); },
  };
}

const Ctx = createContext<Store | null>(null);
export const AbBarProvider = Ctx.Provider;
export function useAbBarStore(): Store {
  const ref = useRef<Store | null>(null);
  ref.current ??= makeStore();
  return ref.current;
}

/** A kind's studio publishes its A/B test to the bar (null: none to show). Called on every render; a click calls the
 * functions as they are at the click. */
export function useAbBar(v: AbBar | null) {
  const store = useContext(Ctx);
  useEffect(() => { store?.set(v); });
  useEffect(() => () => store?.set(null), [store]);
}

const TONE: Record<AbState, { fg: string; bg: string; dot: string }> = {
  off: { fg: MUTED, bg: "transparent", dot: "#b3bccb" },
  planned: { fg: "#1d4fb8", bg: "rgba(36,89,209,.08)", dot: "#2459d1" },
  running: { fg: "#1b7a55", bg: "rgba(27,122,85,.09)", dot: "#1b7a55" },
};

/** The control itself (also drawn on its own by the static check, with its card open). */
export function AbControl({ v, onClick, open }: { v: AbBar; onClick: (el: HTMLElement) => void; open?: boolean }) {
  const t = TONE[v.state];
  return (
    <Tooltip title={open ? "" : v.state === "off" ? "A/B test - activate it" : `${v.line} - open its setup in the last step`}>
      <Box component="button" type="button" aria-label={`A/B test: ${AB_STATE_LABEL[v.state]}`} onClick={(e: React.MouseEvent<HTMLElement>) => onClick(e.currentTarget)} sx={{
        all: "unset", cursor: "pointer", boxSizing: "border-box", height: 30, display: "inline-flex", alignItems: "stretch", border: `1px solid ${HAIRLINE}`, borderRadius: "6px",
        overflow: "hidden", bgcolor: open ? "rgba(21,34,58,.05)" : "#fff", fontSize: "0.78rem", fontWeight: 650, flexShrink: 0,
        "&:hover": { borderColor: "#c9d2de" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
      }}>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", px: 1, color: INK, borderRight: `1px solid ${HAIRLINE}` }}>A/B test</Box>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1, color: t.fg, bgcolor: t.bg }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: t.dot, flexShrink: 0 }} />
          {AB_STATE_LABEL[v.state]}
        </Box>
      </Box>
    </Tooltip>
  );
}

/** The card a click on "Off" opens: Activate, and where the setup then is. */
export function AbActivateCard({ canEdit, onActivate }: { canEdit: boolean; onActivate: () => void }) {
  return (
    <Box sx={{ p: 1.75, width: 280, boxSizing: "border-box" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 750, color: INK }}>A/B test · Off</Typography>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.5, lineHeight: 1.45 }}>Its setup opens in the last step: which versions, the split, the goal, who.</Typography>
      <Button fullWidth variant="contained" disableElevation disabled={!canEdit} onClick={onActivate} sx={{ ...mainBtn, mt: 1.5, height: 36, borderRadius: "6px" }}>Activate</Button>
      {!canEdit && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>Activating is for the project&apos;s editors.</Typography>}
    </Box>
  );
}

/** The bar's A/B control - nothing when the studio publishes none. */
export function AbTestButton() {
  const store = useContext(Ctx);
  const empty = useMemo(() => ({ subscribe: () => () => undefined, snap: () => ({ n: 0, v: null }) }), []);
  const { v } = useSyncExternalStore((store ?? empty).subscribe, (store ?? empty).snap, (store ?? empty).snap);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!v) return null;
  // the functions as the studio has them now - never those of an older render
  const now = () => store?.get() ?? v;
  const click = (el: HTMLElement) => { if (now().state === "off") setAnchor(el); else now().onOpen(); };
  return (
    <>
      <AbControl v={v} onClick={click} open={!!anchor} />
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "10px", boxShadow: "0 18px 50px rgba(21,34,58,.18)" } } }}>
        <AbActivateCard canEdit={v.canEdit} onActivate={() => { setAnchor(null); now().onActivate(); }} />
      </Popover>
    </>
  );
}
