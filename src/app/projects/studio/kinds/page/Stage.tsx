"use client";
// THE PAGE STUDIO'S MIDDLE (08.11.2026): the page, as it will look on the shop, in the language chosen - desktop or phone,
// and for a page of the shop also before / after / side by side. SARCLA 08.11.2026 about the old "Shown inside ... /
// Shown from ..." setting: "this makes no sense" - gone: a new page simply shows inside its store's own page, an
// existing page as the shop has it.
//
//   store views the page's store views made, each saying whether it is up to date, and "+ Store view" for every other
//               store view of the shop by language (SARCLA 09.11.2026: "we select by store view") - never a row of 14
//   AI at work  the blocks the AI is writing shimmer in the page, a picture being made says so in its slot; a page of the
//               shop being changed is veiled with the same sheen (SARCLA: "an AI animation as soon as it starts working")
//   select      hover outlines, a click selects (the left pane shows it), a double-click edits the words in place
//   a new page  drawn into its store's page as it is typed (no reload); an existing page is built by the server from
//               the SAVED document (the GET route, so a reviewer who only comments sees it too) once the studio saved
//   the check   any placeholder left in the words is marked red in the page and named above it, with "Fix with AI"

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { fieldLabel } from "@/lib/content/studio/kinds/page/fields";
import {
  howToAdd, langName, leadOf, leftoversOf, mainView, shopUrl, storesOfView, versionLabel, viewName, viewShort, viewState, viewsOf, type LangState, type Leftover, type PageDoc, type StoreGroup,
} from "@/lib/content/studio/kinds/page/model";
import { ADD_CSS, renderNewPage } from "@/lib/content/studio/kinds/page/newpage";
import { PART_NAME, partOfPath } from "@/lib/content/studio/kinds/page/outline";
import type { InsertOut, Presence, PreviewOut } from "@/lib/content/studio/kinds/page/shop";
import type { Located } from "@/lib/content/studio/kinds/page/shopParts";
import { PINK, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { SHEEN_BG, sheen } from "./Fields";
import { Frame, type AddPlace, type Device, type Picked, type SelectOpts } from "./Frame";
import { StoreViewPicker } from "./StoreViewPicker";

export type View = "before" | "after" | "both";
type Side = "before" | "after";
type Held = { key: string; out: PreviewOut } | null;

const BLUE = "#2459d1";

/** The two pictures of an existing page, asked for when what they show has changed and the studio has saved it. */
export function usePagePreview(api: StudioApi, d: PageDoc, lang: string, view: View) {
  const [held, setHeld] = useState<Record<Side, Held>>({ before: null, after: null });
  const [busy, setBusy] = useState<Record<Side, boolean>>({ before: false, after: false });
  const [fresh, setFresh] = useState(0);
  const asked = useRef<Record<Side, string>>({ before: "", after: "" });
  const pieceId = api.data.piece.id;
  const isNew = d.source === "new";
  const keys: Record<Side, string> = {
    before: JSON.stringify([lang, d.env, d.path]),
    after: JSON.stringify([lang, d.source, d.env, d.path, d.changes, d.texts, d.inserts]),
  };
  const want: Side[] = isNew ? [] : view === "both" ? ["before", "after"] : [view];
  const saved = api.save === "saved";

  useEffect(() => {
    if (!d.path || !saved || isNew) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const side of want) {
      const key = `${keys[side]}|${fresh}`;
      if (asked.current[side] === key) continue;
      timers.push(setTimeout(async () => {
        asked.current[side] = key;
        setBusy((b) => ({ ...b, [side]: true }));
        // a version looked at (Versions, 09.11.2026) is drawn from that version, not from the page as it is now
        const out = await fetch(`/api/content/studio/page/${pieceId}/preview?side=${side}&lang=${encodeURIComponent(lang)}${fresh ? "&fresh=1" : ""}${api.looking ? `&version=${api.looking}` : ""}`)
          .then((r) => r.json() as Promise<PreviewOut>)
          .catch(() => ({ ok: false as const, error: "The hub did not answer - try again." }));
        if (asked.current[side] === key) setHeld((h) => ({ ...h, [side]: { key, out } }));
        setBusy((b) => ({ ...b, [side]: false }));
      }, 350));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.before, keys.after, want.join(), saved, fresh, d.path, pieceId, isNew]);

  // a language switched: what was shown belongs to the other one
  useEffect(() => { setHeld({ before: null, after: null }); }, [lang]);

  return { held, busy, readAgain: () => setFresh((n) => n + 1), want, fresh };
}

/** A new page's frame: its store's own page, once per store view; the page itself is drawn into it as it is typed. */
export function useShell(api: StudioApi, d: PageDoc, fresh: number) {
  const [shell, setShell] = useState<{ key: string; out: PreviewOut } | null>(null);
  const [inserts, setInserts] = useState<InsertOut[] | null>(null);
  const pieceId = api.data.piece.id;
  const isNew = d.source === "new";
  // the store view shown (its version's key)
  const lang = d.store;
  useEffect(() => {
    if (!isNew) return;
    const key = `${d.store}|${fresh}`;
    if (shell?.key === key) return;
    let gone = false;
    void fetch(`/api/content/studio/page/${pieceId}/preview?side=shell&lang=${encodeURIComponent(lang)}${fresh ? "&fresh=1" : ""}`)
      .then((r) => r.json() as Promise<PreviewOut>)
      .catch(() => ({ ok: false as const, error: "The hub did not answer - try again." }))
      .then((out) => { if (!gone) setShell({ key, out }); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, d.store, fresh, pieceId]);
  const insertKey = JSON.stringify(d.inserts);
  useEffect(() => {
    if (!d.inserts.length) { setInserts([]); return; }
    let gone = false;
    void api.act<{ inserts: InsertOut[] }>("inserts", { lang }).then((r) => { if (!gone && r.ok) setInserts(r.result.inserts); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertKey, fresh, lang]);
  return { shell: shell?.out ?? null, inserts };
}

/* ── the store view choice ────────────────────────────────────────────── */

// SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store view". The tabs are the page's
// store views (its own first); "+ Store view" lists every store view of the shop by language - for a page of the shop
// whether the page is there at all - and what picking one does: a copy of the same language (no AI), or a translation.

const STATE_NOTE: Record<LangState, string> = {
  main: "The page's own store view", done: "Made", stale: "Out of date - the store view it was made from changed since", empty: "Not made yet",
};

/** What a store view is or would be, in a few words ("Copied from de-CH", "The AI translates it"). */
export function viewNote(d: PageDoc, k: string, presence?: Record<string, Presence>): string {
  const st = viewState(d, k);
  const v = d.langs[k];
  const off = d.source !== "new" && presence?.[k]?.exists === false ? ` · not on the shop in ${k}` : "";
  if (st === "main") return "The page's own store view";
  if (st !== "empty" && v) {
    const how = v.made === "copy" ? `Copied from ${v.source || mainView(d)}` : v.made === "translate" ? `Translated from ${v.source || mainView(d)}` : "Its own page";
    return `${how}${st === "stale" ? " · out of date" : ""}${off}`;
  }
  const add = howToAdd(d, k);
  return `${add.how === "copy" ? `A copy of ${add.from} - no AI` : `The AI translates it from ${add.from}`}${off}`;
}

/** The page's store views as tabs, then one button for every other store view of the shop (by country and currency).
 * The toolbar keeps ONE row at the middle pane's real width (Content v6, 560-700 px at 1480): three tabs at most - the one
 * shown always among them - the others counted on the button ("+2"); the tabs scroll sideways when even that is too
 * wide. A click on the button opens every store view, the made ones with their check marks. */
export function LangSwitch({ d, lang, onLang, groups, presence }: { d: PageDoc; lang: string; onLang: (k: string) => void; groups: StoreGroup[]; presence: Record<string, Presence> }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  // Content v10 (SARCLA point 6): a tab is a LANGUAGE's page ("EN · 9") - or a store view with its own words ("EN-CH")
  const made = viewsOf(d);
  const all = made.includes(lang) ? made : [...made, lang];
  const covered = made.reduce((n, k) => n + storesOfView(d, k).length, 0);
  const MAX = 4;
  const tabs = all.length <= MAX ? all : all.slice(0, MAX).includes(lang) ? all.slice(0, MAX) : [...all.slice(0, MAX - 1), lang];
  const more = all.length - tabs.length;
  const total = groups.reduce((n, g) => n + g.stores.length, 0);
  const btnSx = (on: boolean, i: number, st: LangState | null) => ({
    all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.75, py: 0.45, fontSize: "0.74rem", fontWeight: 700, letterSpacing: ".02em", whiteSpace: "nowrap", flexShrink: 0,
    borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : st === "empty" ? "#9aa5b8" : INK, bgcolor: on ? BLUE : "transparent",
    transition: "background-color .15s, color .15s",
    "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
  });
  return (
    <Box sx={{ display: "flex", alignItems: "stretch", flex: "0 1 auto", minWidth: 0, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.85)" }}>
      <Box role="radiogroup" aria-label="Store view" sx={{ display: "flex", minWidth: 0, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {tabs.map((k, i) => {
          const on = k === lang;
          const st = viewState(d, k);
          const isLead = made.includes(k) && leadOf(d, k.slice(0, 2)) === k;
          const n = made.includes(k) ? storesOfView(d, k).length : 0;
          return (
            <Tooltip key={k} title={made.includes(k) ? `${versionLabel(d, k)}: ${storesOfView(d, k).join(", ")} · shown in ${k} · ${STATE_NOTE[st]}` : `${viewName(k)} · ${STATE_NOTE[st]}`}>
              <Box component="button" type="button" role="radio" aria-checked={on} onClick={() => onLang(k)} sx={btnSx(on, i, st)}>
                {/* a language's page: its language and how many store views it goes to; a store view's own words: its address */}
                {isLead ? k.slice(0, 2).toUpperCase() : k.split("/")[0].toUpperCase()}
                {!isLead && k.includes("/") && <Box component="span" aria-label={viewShort(k)} sx={{ fontSize: "0.6rem", fontWeight: 800, opacity: 0.85, ml: -0.1 }}>{k.split("/")[1].toUpperCase()}</Box>}
                {isLead && n > 1 && <Box component="span" sx={{ fontSize: "0.62rem", fontWeight: 800, px: 0.4, borderRadius: "3px", bgcolor: on ? "rgba(255,255,255,.22)" : "rgba(36,89,209,.1)", color: on ? "#fff" : BLUE }}>{n}</Box>}
                {st === "main" && <Box component="span" sx={{ width: 6, height: 6, borderRadius: "1px", bgcolor: on ? "#fff" : PINK }} />}
                {st === "done" && <CheckIcon sx={{ fontSize: 13, color: on ? "#fff" : "#1b7a55" }} />}
                {st === "stale" && <WarningAmberIcon sx={{ fontSize: 13, color: on ? "#fff" : AMBER }} />}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Tooltip title={`${more ? `${more} more of the page's languages, and ` : ""}every store view of the shop, as Magento lists them - ${covered} of ${total} get the page`}>
        <Box component="button" type="button" onClick={(e: React.MouseEvent<HTMLElement>) => setMenu(e.currentTarget)} aria-label={more ? `${more} more` : "Store views"}
          sx={{ ...btnSx(false, 1, null), color: more ? INK : MUTED, fontWeight: more ? 800 : 600 }}>
          {more ? `+${more}` : <><AddIcon sx={{ fontSize: 15 }} />Store views</>}
          <Box component="span" sx={{ fontSize: "0.64rem", fontWeight: 700, color: MUTED, ml: 0.25 }}>{covered}/{total}</Box>
        </Box>
      </Tooltip>
      {/* every store view of the shop by country and currency, as Magento has them (./StoreViewPicker.tsx) */}
      <StoreViewPicker anchor={menu} onClose={() => setMenu(null)} d={d} lang={lang} onPick={onLang} groups={groups} presence={presence} />
    </Box>
  );
}

/** A small squared segmented control for the toolbar: words or an icon per choice, one row, never wrapping. */
function Seg<K extends string>({ value, onChange, options, label }: { value: K; onChange: (k: K) => void; label: string; options: { key: K; label?: string; icon?: React.ReactNode; tip: string }[] }) {
  return (
    <Box role="radiogroup" aria-label={label} sx={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.85)" }}>
      {options.map((o, i) => {
        const on = value === o.key;
        return (
          <Tooltip key={o.key} title={o.tip}>
            <Box component="button" type="button" role="radio" aria-checked={on} aria-label={o.label ?? o.tip} onClick={() => onChange(o.key)} sx={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
              px: o.icon ? 0.6 : 0.85, py: o.icon ? 0.35 : 0.45, minWidth: o.icon ? 18 : 0, fontSize: "0.74rem", fontWeight: 650, lineHeight: 1.35,
              borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : INK, bgcolor: on ? BLUE : "transparent", transition: "background-color .12s, color .12s",
              "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)", color: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
            }}>
              {o.icon ?? o.label}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/* ── the toolbar over the selected element ────────────────────────────── */

/** A picture selected in the page: the slot's actions over it (the flow standard: Make another · Upload · Gallery · Remove). */
export type PicActs = { has: boolean; canMake: boolean; onMake: () => void; onUpload: () => void; onGallery: () => void; onRemove: () => void;
  /** "Fine-tune with AI": the same picture with one change, asked in the assistant (Content v5) */
  onRefine?: () => void };

function SelBar({ label, canWords, onWords, onAi, onClose, pic }: { label: string; canWords: boolean; onWords: () => void; onAi: () => void; onClose: () => void; pic?: PicActs | null }) {
  const b = { ...btn, color: "#fff", minWidth: 0, px: 1, py: 0.25, fontSize: "0.76rem", borderRadius: "5px", "&:hover": { bgcolor: "rgba(255,255,255,.12)" } };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: "#15223a", color: "#fff", borderRadius: "7px", px: 0.5, py: 0.4, boxShadow: "0 10px 26px rgba(21,34,58,.32)" }}
      onMouseDown={(e) => e.preventDefault()}>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, px: 0.75, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "rgba(255,255,255,.8)" }}>{label}</Typography>
      {canWords && <Button size="small" onClick={onWords} startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Edit words</Button>}
      {pic ? (
        <>
          {pic.onRefine && <Button size="small" onClick={pic.onRefine} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Fine-tune with AI</Button>}
          {pic.canMake && <Button size="small" onClick={pic.onMake} startIcon={pic.onRefine ? undefined : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>{pic.has ? "Make another" : "Make it"}</Button>}
          <Button size="small" onClick={pic.onUpload} sx={b}>Upload</Button>
          <Button size="small" onClick={pic.onGallery} sx={b}>Gallery</Button>
          {pic.has && <Button size="small" onClick={pic.onRemove} sx={b}>Remove</Button>}
        </>
      ) : <Button size="small" onClick={onAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Ask AI</Button>}
      <IconButton size="small" onClick={onClose} aria-label="Unselect" sx={{ color: "rgba(255,255,255,.7)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
    </Box>
  );
}

/* ── the stage ────────────────────────────────────────────────────────── */

export function Stage({ api, doc, d, lang, onLang, groups, presence, view, onView, preview, selected, picked, onPick, onEdit, editNonce, reveal, onEditWords, onAskAi, inserts, shell, onFix, empty, children, fold, writing, working, workingLabel, onMap, seek, selLabel, picActs, onAct, adds, onAddEl, oldShown, strip, plan, bar, popup, blocks, toTop }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; lang: string; onLang: (l: string) => void; view: View; onView: (v: View) => void;
  /** every store view of the shop, by language; for a page of the shop, whether it is there */
  groups: StoreGroup[]; presence: Record<string, Presence>;
  preview: ReturnType<typeof usePagePreview>; selected: string | null; picked: Picked | null;
  onPick: (p: Picked | null) => void; onEdit: (p: Picked, v: { text: string; inner: string; outer: string }) => void;
  editNonce: number;
  /** a selection made on the left: the page scrolls to it */
  reveal: number;
  onEditWords: () => void; onAskAi: () => void; inserts: InsertOut[] | null; shell: PreviewOut | null;
  /** what the AI is writing now in a new page (blocks, fields) and the pictures being made - they shimmer */
  writing?: { blocks: string[]; fields: string[]; pictures: string[]; tuning?: string[]; modules?: Record<string, string>; moduleWhy?: Record<string, string> };
  /** a page of the shop being changed by the AI: since when, and what it is doing ("Checking that it reads well") */
  working?: number | null;
  workingLabel?: string | null;
  /** a page of the shop: the "+" between its elements (Content v6) - and the replaced elements shown again ("Show the old one") */
  onAddEl?: (place: AddPlace) => void;
  oldShown?: number[];
  /** a page of the shop: where the preview found each change (the outline's parts), and a part to find and select */
  onMap?: (m: Located) => void;
  seek?: { nonce: number; heading: string } | null;
  /** the selection's name when it is a part of the page (not just an element) */
  selLabel?: string | null;
  /** a picture selected: its actions over it; a slot's own buttons in the page ("Make it", "Upload") */
  picActs?: PicActs | null;
  onAct?: (path: string, act: string) => void;
  /** a new page someone may change: the "+" between its blocks ("Add a block here") and in a block with items (Content v5) */
  adds?: { onAdd: (at: number, pos: { top: number; left: number }) => void; onAddItem: (list: string) => void };
  onFix: (left: Leftover[]) => void;
  /** what shows in place of the page (the page list, a language still to make) */
  empty?: React.ReactNode;
  children?: React.ReactNode;
  /** the side columns folded away, for a bigger page */
  fold?: { build: boolean; assist: boolean; onBuild: () => void; onAssist: () => void };
  /** a slim row under the toolbar: the page's versions A / B / C (Content v6, ./Versions.tsx) */
  strip?: React.ReactNode;
  /** Content v7: the AI plan's steps drawn in the page at once, one lit, whether it shows (./plan/overlay.ts) */
  plan?: Pick<SelectOpts, "pending" | "flash" | "onShown">;
  /** Content v8 (SARCLA 10.11.2026, points 1-4): the bar over the selection, made by the studio (the block it is in, its
   * settings, the AI) - in place of the default one */
  bar?: React.ReactNode;
  /** a popup at the selection: a text's or a picture's editor, a block's settings (./pops.tsx) */
  popup?: { node: React.ReactNode; at: "below" | "side"; width?: number; id?: string } | null;
  /** the Build list's ways into the page: the blocks found, a row to find, the block around the selection, a double-click */
  blocks?: Pick<SelectOpts, "onBlocks" | "seekRow" | "selectedBlock" | "onEditStart" | "resize">;
  /** Content v11: the whole page written again - the stage shows it from its top (a number that changes each time) */
  toTop?: number;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  // the whole page written again (Content v11, SARCLA 10.11.2026: "page regenerate after all regeneration of page"): the
  // new page from its top, wherever the stage was scrolled to
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!toTop) return;
    const t = setTimeout(() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [toTop]);
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
  // the toolbar keeps one row at 1480 px (SARCLA's night list): the rarer tools in a "More" menu
  const [more, setMore] = useState<HTMLElement | null>(null);
  const fit = zoom === "fit" || device === "mobile";
  const isNew = d.source === "new";
  const { held, busy, want } = preview;
  const after = held.after?.out;
  const notes = [...new Set([...(after?.ok ? after.notes : []), ...(held.before?.out.ok ? held.before.out.notes : []), ...(isNew && shell?.ok ? shell.notes : [])])];
  const problems = after?.ok ? after.problems : [];
  const views = isNew ? [] : [{ key: "before" as View, label: "Before" }, { key: "after" as View, label: "After" }, { key: "both" as View, label: "Both" }];
  const left = useMemo(() => leftoversOf(d), [d]);

  // a new page, drawn here from its fields as they are typed
  const patch = useMemo(() => {
    if (!isNew) return undefined;
    const r = renderNewPage(d.fields, { marks: true, adds: !!adds, busy: writing, store: d.store, inserts: (inserts ?? []).filter((x) => x.ok).map((x) => ({ id: x.id, where: x.where, html: x.html })) });
    return `<style>${r.css}\n${BUSY_CSS}\n${ADD_CSS}</style>${r.html}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, d.fields, inserts, JSON.stringify(writing ?? null), !!adds]);

  const selectOpts = {
    mode: (isNew ? "field" : "element") as "field" | "element",
    selected, onPick, onEdit, editNonce, reveal, onMap, seek, onAct, onAdd: adds?.onAdd, onAddItem: adds?.onAddItem,
    onAddEl: working ? undefined : onAddEl, oldShown, ...(plan ?? {}), ...(blocks ?? {}),
  };
  // a whole block says its number and name ("4 · Proof tiles" - the studio's selLabel), a field its own ("Tile 2 · title")
  const label = !selected ? "" : selLabel ? selLabel : selected.startsWith("f:") || selected.startsWith("b:") ? fieldLabel(d.fields, selected.slice(2)).replace(/^\w/, (c) => c.toUpperCase())
    : selected.startsWith("i:") ? "Banner" : picked ? `<${picked.tag}>${picked.text ? ` ${picked.text.slice(0, 28)}` : ""}` : "";
  const canWords = !!selected && (selected.startsWith("f:") ? !/picture$|\.button$|^f:links\./.test(selected) || selected.endsWith(".label") : !!picked?.editable);
  const toolbar = selected ? bar ?? <SelBar label={label} canWords={canWords} onWords={onEditWords} onAi={onAskAi} onClose={() => onPick(null)} pic={picActs} /> : undefined;

  const frameOf = (side: Side, h: Held, b: boolean, tag?: string) => {
    const out = h?.out;
    return (
      <Box sx={{ minWidth: 0 }}>
        {tag && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1, textAlign: "center" }}>{tag}</Typography>}
        {!out && <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, color: MUTED, py: 10 }}><CircularProgress size={16} /> Reading the page from the shop…</Box>}
        {out && !out.ok && (
          <Box sx={{ maxWidth: 460, mx: "auto", my: 6, p: 2, borderRadius: "10px", bgcolor: "#fff", color: INK, fontSize: "0.88rem", textAlign: "center", boxShadow: "0 8px 24px rgba(31,45,78,.08)" }}>
            {out.error}
            <Box sx={{ mt: 1 }}><Button size="small" onClick={preview.readAgain} sx={{ ...btn, color: INK }}>Try again</Button></Box>
          </Box>
        )}
        {out?.ok && (
          <Box sx={{ position: "relative", opacity: b ? 0.6 : 1, transition: "opacity .2s" }}>
            <Frame html={out.html} device={device} title={side === "before" ? "The page as it is" : "The page with its changes"}
              select={side === "after" ? selectOpts : undefined} toolbar={side === "after" ? toolbar : undefined} fit={fit || want.length === 2} popup={side === "after" ? popup : undefined} />
            {side === "after" && working && <Working since={working} label={workingLabel} />}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden", bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, backgroundImage: "radial-gradient(rgba(21,34,58,.07) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.85, flexWrap: "nowrap", minWidth: 0, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", backdropFilter: "blur(6px)", flexShrink: 0 }}>
        {fold && (
          <Tooltip title={fold.build ? "Show the build column" : "Fold the build column away"}>
            <IconButton size="small" onClick={fold.onBuild} aria-label="Fold the build column" sx={{ color: fold.build ? BLUE : MUTED }}><ViewSidebarOutlinedIcon sx={{ fontSize: 19, transform: "scaleX(-1)" }} /></IconButton>
          </Tooltip>
        )}
        <LangSwitch d={doc} lang={lang} onLang={onLang} groups={groups} presence={presence} />
        {/* one row at the middle pane's real width (560-700 px at 1480): compact controls; the store view tabs shrink and scroll */}
        <Box sx={{ flex: "1 0 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75, flexWrap: "nowrap" }}>
        {views.length > 0 && !empty && <Seg label="The page" value={view} onChange={onView} options={views.map((v) => ({ ...v, tip: v.key === "before" ? "The page as it is on the shop" : v.key === "after" ? "The page with its changes" : "Before and after, side by side" }))} />}
        {!empty && <Seg label="Device" value={device} onChange={setDevice} options={[
          { key: "desktop" as Device, icon: <DesktopWindowsOutlinedIcon sx={{ fontSize: 17 }} />, tip: "Desktop" },
          { key: "mobile" as Device, icon: <SmartphoneOutlinedIcon sx={{ fontSize: 17 }} />, tip: "Phone" },
        ]} />}
        <Tooltip title="More: zoom, read the page again, open it on the shop">
          <IconButton size="small" onClick={(e) => setMore(e.currentTarget)} aria-label="More" sx={{ color: MUTED }}><MoreHorizIcon sx={{ fontSize: 19 }} /></IconButton>
        </Tooltip>
        <Menu anchorEl={more} open={!!more} onClose={() => setMore(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 240 } } }}>
          {!empty && device === "desktop" && (
            <MenuItem dense onClick={() => { setZoom(zoom === "fit" ? "full" : "fit"); setMore(null); }} sx={{ gap: 1.25, fontSize: "0.86rem" }}>
              {zoom === "fit" ? "Show at 100% (real size)" : "Fit the page to the space"}
            </MenuItem>
          )}
          <MenuItem dense disabled={!!empty || busy.before || busy.after} onClick={() => { preview.readAgain(); setMore(null); }} sx={{ gap: 1.25, fontSize: "0.86rem" }}>
            <RefreshIcon sx={{ fontSize: 17, color: MUTED }} />{isNew ? "Read the store's page again" : "Read the page from the shop again"}
          </MenuItem>
          {d.path && !isNew && (
            <MenuItem dense component="a" href={shopUrl(d.env, d.path)} target="_blank" rel="noopener noreferrer" onClick={() => setMore(null)} sx={{ gap: 1.25, fontSize: "0.86rem" }}>
              <OpenInNewIcon sx={{ fontSize: 16, color: MUTED }} />Open the page on the shop
            </MenuItem>
          )}
        </Menu>
        {fold && (
          <Tooltip title={fold.assist ? "Show the assistant" : "Fold the assistant away"}>
            <IconButton size="small" onClick={fold.onAssist} aria-label="Fold the assistant" sx={{ color: fold.assist ? BLUE : MUTED }}><ViewSidebarOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
        )}
        </Box>
      </Box>
      {strip}
      <Box ref={scroller} data-stage-scroll sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {children}
        {empty ?? (
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            {left.length > 0 && (
              <Box sx={{ maxWidth: 980, mx: "auto", mb: 1.5, p: 1.25, pl: 1.75, borderRadius: "8px", bgcolor: "#fff4f2", border: "1px solid #f3c4bd", display: "flex", alignItems: "center", gap: 1.5 }}>
                <WarningAmberIcon sx={{ color: "#c5221f", fontSize: 20 }} />
                <Typography sx={{ fontSize: "0.84rem", color: INK, flex: 1, minWidth: 0 }}>
                  <b>{left.length} placeholder{left.length === 1 ? "" : "s"} in the words</b> - not final copy: {left.slice(0, 2).map((x) => `“${x.text.slice(0, 50)}”`).join(", ")}{left.length > 2 ? " …" : ""}
                </Typography>
                {api.data.ai && api.data.access.canEdit && (
                  <Button size="small" variant="contained" disableElevation onClick={() => onFix(left)} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, bgcolor: "#c5221f", borderRadius: "6px", "&:hover": { bgcolor: "#a51b18" } }}>Write them with AI</Button>
                )}
              </Box>
            )}
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, textAlign: "center", mb: 1.25 }}>
              {viewName(d.store)}{isNew ? " · a new page" : ""} · click a text or a picture to change it, a block for its settings
            </Typography>
            {isNew ? (
              !shell ? <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, color: MUTED, py: 10 }}><CircularProgress size={16} /> Opening the store&apos;s page…</Box>
                : !shell.ok ? (
                  <Box sx={{ maxWidth: 520, mx: "auto", my: 4 }}>
                    <Typography sx={{ fontSize: "0.82rem", color: AMBER, textAlign: "center", mb: 1.5 }}>{shell.error} The page shows without the shop around it.</Typography>
                    <Frame html={`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font-family:Jost,Arial,sans-serif"><div id="apx-root"></div></body></html>`} device={device} title="The new page" select={selectOpts} patch={patch} toolbar={toolbar} fit={fit} popup={popup} />
                  </Box>
                ) : <Frame html={shell.html} device={device} title="The new page" select={selectOpts} patch={patch} toolbar={toolbar} fit={fit} popup={popup} />
            ) : want.length === 2 ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 2, alignItems: "start" }}>
                {frameOf("before", held.before, busy.before, "Before")}
                {frameOf("after", held.after, busy.after, "After")}
              </Box>
            ) : frameOf(want[0] ?? "after", held[want[0] ?? "after"], busy[want[0] ?? "after"])}
            {(notes.length > 0 || problems.length > 0) && (
              <Box sx={{ maxWidth: 720, mx: "auto", mt: 2.5 }}>
                {problems.map((p) => <Typography key={p} sx={{ fontSize: "0.8rem", color: AMBER, textAlign: "center" }}>Left out: {p}</Typography>)}
                {notes.map((n) => <Typography key={n} sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "center" }}>{n}</Typography>)}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** The sheen over a page of the shop while the AI changes it, with how long it has been at it. */
function Working({ since, label }: { since: number; label?: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((Date.now() - since) / 1000));
  return (
    <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "10px", backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.6s linear infinite`, bgcolor: "rgba(255,255,255,.25)" }}>
      <Box sx={{ position: "sticky", top: 12, display: "flex", justifyContent: "center", pt: 1.5 }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "#15223a", color: "#fff", px: 1.5, py: 0.75, borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, boxShadow: "0 10px 26px rgba(21,34,58,.3)", fontVariantNumeric: "tabular-nums" }}>
          <CircularProgress size={13} thickness={6} sx={{ color: "#fff" }} />{label ? `${label}…` : "The AI is changing the page"} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </Box>
      </Box>
    </Box>
  );
}

/** The studio's own marks for the AI at work inside a new page (never in Magento's copy). */
const BUSY_CSS = `[data-apx-busy]{position:relative!important}
[data-apx-busy]::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:5;border-radius:inherit;background:linear-gradient(100deg,rgba(255,255,255,0) 25%,rgba(194,44,110,.16) 42%,rgba(255,255,255,.8) 50%,rgba(36,89,209,.14) 58%,rgba(255,255,255,0) 75%);background-size:260% 100%;animation:apx-sheen 1.5s linear infinite}
section[data-apx-busy]::before{content:"Writing…";position:absolute;top:16px;right:20px;z-index:6;font:600 19px/1 system-ui,"Segoe UI",sans-serif;letter-spacing:.02em;color:#fff;background:#c22c6e;padding:10px 16px;border-radius:6px;box-shadow:0 8px 20px rgba(194,44,110,.3)}
[data-apx-making]{background:linear-gradient(100deg,#e9edf1 25%,#f8e9f0 45%,#ffffff 50%,#e7edf9 55%,#e9edf1 75%)!important;background-size:260% 100%!important;animation:apx-sheen 1.4s linear infinite;border:1.5px solid rgba(194,44,110,.35)!important;color:#c22c6e!important;font-weight:600!important}
@keyframes apx-sheen{from{background-position:140% 0}to{background-position:-140% 0}}
.apx-np-pic-empty{position:relative}
.apx-np-pic-empty[data-apx-making]>span{font-size:21px!important}
.apx-np-slot{display:flex;flex-direction:column;align-items:center;gap:20px;max-width:560px}
.apx-np-idea{font:400 19px/1.45 system-ui,"Segoe UI",sans-serif;color:#8a96a3}
.apx-np-acts{display:flex;gap:12px}
.apx-np-acts b{font:600 21px/1 system-ui,"Segoe UI",sans-serif;padding:15px 26px;border-radius:8px;cursor:pointer;border:1px solid #cfd6de;background:#fff;color:#15223a}
.apx-np-acts b[data-apx-act=make]{background:#c22c6e;border-color:#c22c6e;color:#fff}
.apx-np-acts b:hover{filter:brightness(.95)}
.apx-np-bar{position:absolute;left:18%;right:18%;bottom:22%;height:6px;border-radius:2px;background:rgba(194,44,110,.15);overflow:hidden}
.apx-np-bar::after{content:"";position:absolute;top:0;bottom:0;width:35%;background:#c22c6e;border-radius:2px;animation:apx-bar 1.3s ease-in-out infinite}
@keyframes apx-bar{from{left:-35%}to{left:100%}}`;

/** What the middle shows for a store view whose page is not made yet - and, while it is translated, the page coming.
 * A store view of the page's own language is made by a copy (no AI); for a page of the shop, its page there is picked. */
export function LangEmpty({ d, lang, main, store, busy, since, canAi, onTranslate, onFind, onPick, finding, onCopy, notOnShop }: {
  d: PageDoc; lang: string; main: string; store: string; busy: boolean; since?: number | null; canAi: boolean; onTranslate: () => void; onFind?: () => void; onPick?: React.ReactNode; finding?: boolean;
  /** a store view of a language the page has: made as a copy of `copyFrom`, no AI */
  onCopy?: { from: string; run: () => void } | null;
  /** the page index says the page is not on the shop in this store view */
  notOnShop?: boolean;
}) {
  const isNew = d.source === "new";
  if (onCopy && !busy) {
    return (
      <Box sx={{ maxWidth: 640, mx: "auto", textAlign: "center", py: 8, px: 2 }}>
        <Typography sx={{ fontSize: "1.25rem", fontWeight: 750, color: INK, mb: 0.75 }}>{notOnShop ? `This page is not on the shop in ${store}` : `The ${store} page is not made yet`}</Typography>
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, mb: 2.5 }}>
          {isNew
            ? `It starts as a copy of ${onCopy.from} - the same words and pictures, no AI - and is its own page in ${store} from then on: change what ${store} needs.`
            : notOnShop
              ? `The shop's index has no such page in ${store} - Magento's store views are not all complete. Pick the ${store} page if it has another address; its changes then start as a copy of ${onCopy.from}.`
              : `The changes made in ${onCopy.from} are copied onto the ${store} page - no AI - and are its own from then on.`}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
          {!(notOnShop && !isNew) && (
            <Button variant="contained" disableElevation onClick={onCopy.run}
              sx={{ ...btn, bgcolor: PINK, borderRadius: "8px", height: 44, px: 2.5, "&:hover": { bgcolor: "#a3245c" } }}>
              {`Copy ${onCopy.from} into ${store}`}
            </Button>
          )}
          {onFind && <Button variant="outlined" disabled={finding} onClick={onFind} sx={{ ...btn, borderRadius: "8px", height: 44, borderColor: HAIRLINE, color: INK }}>{finding ? "Looking…" : `Pick the ${store} page`}</Button>}
        </Box>
        {onPick}
      </Box>
    );
  }
  const [, setTick] = useState(0);
  useEffect(() => { if (!busy) return; const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, [busy]);
  const secs = since ? Math.max(0, Math.round((Date.now() - since) / 1000)) : 0;
  return (
    <Box sx={{ maxWidth: 640, mx: "auto", textAlign: "center", py: 8, px: 2 }}>
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 750, color: INK, mb: 0.75 }}>{busy ? `Translating the page into ${langName(lang)} (${store})` : notOnShop ? `This page is not on the shop in ${store}` : `The ${store} page is not made yet`}</Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, mb: 2.5 }}>
        {isNew
          ? `It will be its own page in ${store}, with its own words and address. Translate the ${main} page into ${langName(lang)} - the structure and pictures stay, every word is translated - then change what you like.`
          : notOnShop
            ? `The shop's index has no such page in ${store} - Magento's store views are not all complete. Pick the ${store} page if it has another address, then translate the changes made in ${main} onto it.`
            : `The shop's page in ${store} is its own page, with its own address. The changes made in ${main} are translated onto it - the same structure, the words in ${langName(lang)}.`}
      </Typography>
      {busy ? (
        <Box sx={{ textAlign: "left", maxWidth: 520, mx: "auto" }}>
          {[0.92, 0.6, 0.98, 0.84, 0.7].map((w, i) => (
            <Box key={i} sx={{ height: i === 0 ? 26 : 14, width: `${w * 100}%`, mb: i === 0 ? 2 : 1.1, borderRadius: "4px", bgcolor: "#e6ebf1", backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.5s linear infinite`, animationDelay: `${i * 0.08}s` }} />
          ))}
          <Typography sx={{ mt: 2, fontSize: "0.82rem", color: PINK, fontWeight: 600, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            Every word into {langName(lang)} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} · about a minute
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="contained" disableElevation disabled={!canAi} onClick={onTranslate} startIcon={<AutoAwesomeOutlinedIcon />}
            sx={{ ...btn, bgcolor: PINK, borderRadius: "8px", height: 44, px: 2.5, "&:hover": { bgcolor: "#a3245c" } }}>
            {`Translate the whole page into ${store}`}
          </Button>
          {onFind && <Button variant="outlined" disabled={finding} onClick={onFind} sx={{ ...btn, borderRadius: "8px", height: 44, borderColor: HAIRLINE, color: INK }}>{finding ? "Looking…" : notOnShop ? `Pick the ${store} page` : `Find the ${store} page`}</Button>}
        </Box>
      )}
      {onPick}
    </Box>
  );
}
