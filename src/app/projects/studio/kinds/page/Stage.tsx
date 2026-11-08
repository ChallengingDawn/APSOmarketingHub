"use client";
// THE PAGE STUDIO'S MIDDLE (08.11.2026): the page, as it will look on the shop, in the language chosen - desktop or phone,
// and for a page of the shop also before / after / side by side. SARCLA 08.11.2026 about the old "Shown inside ... /
// Shown from ..." setting: "this makes no sense" - gone: a new page simply shows inside its store's own page, an
// existing page as the shop has it.
//
//   languages   one squared choice: DE · FR · IT · EN, each saying whether it is made, out of date or still to make
//   select      hover outlines, a click selects (the left pane shows it), a double-click edits the words in place
//   a new page  drawn into its store's page as it is typed (no reload); an existing page is built by the server from
//               the SAVED document (the GET route, so a reviewer who only comments sees it too) once the studio saved
//   the check   any placeholder left in the words is marked red in the page and named above it, with "Fix with AI"

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { fieldLabel } from "@/lib/content/studio/kinds/page/fields";
import {
  langName, langState, langsOf, leftoversOf, shopUrl, type LangState, type Leftover, type PageDoc,
} from "@/lib/content/studio/kinds/page/model";
import { renderNewPage } from "@/lib/content/studio/kinds/page/newpage";
import type { InsertOut, PreviewOut } from "@/lib/content/studio/kinds/page/shop";
import { PINK, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Frame, type Device, type Picked } from "./Frame";
import { Choice } from "./ui";

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
        const out = await fetch(`/api/content/studio/page/${pieceId}/preview?side=${side}&lang=${lang}${fresh ? "&fresh=1" : ""}`)
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
  const lang = d.store.slice(0, 2).toLowerCase();
  useEffect(() => {
    if (!isNew) return;
    const key = `${d.store}|${fresh}`;
    if (shell?.key === key) return;
    let gone = false;
    void fetch(`/api/content/studio/page/${pieceId}/preview?side=shell&lang=${lang}${fresh ? "&fresh=1" : ""}`)
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

/* ── the language choice ──────────────────────────────────────────────── */

const STATE_NOTE: Record<LangState, string> = {
  main: "The page's own language", done: "Made", stale: "Out of date - the main language changed since it was translated", empty: "Not made yet",
};

export function LangSwitch({ d, lang, onLang }: { d: PageDoc; lang: string; onLang: (l: string) => void }) {
  const langs = langsOf(d);
  return (
    <Box role="radiogroup" aria-label="Language" sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.85)" }}>
      {langs.map((l, i) => {
        const on = l === lang;
        const st = langState(d, l);
        return (
          <Tooltip key={l} title={`${langName(l)} · ${STATE_NOTE[st]}`}>
            <Box component="button" type="button" role="radio" aria-checked={on} onClick={() => onLang(l)} sx={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.55, fontSize: "0.8rem", fontWeight: 700,
              borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : st === "empty" ? "#9aa5b8" : INK, bgcolor: on ? BLUE : "transparent",
              "&:hover": on ? {} : { bgcolor: "rgba(36,89,209,.07)" }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: -2 },
            }}>
              {l.toUpperCase()}
              {st === "main" && <Box component="span" sx={{ width: 6, height: 6, borderRadius: "1px", bgcolor: on ? "#fff" : PINK }} />}
              {st === "done" && <CheckIcon sx={{ fontSize: 14, color: on ? "#fff" : "#1b7a55" }} />}
              {st === "stale" && <WarningAmberIcon sx={{ fontSize: 14, color: on ? "#fff" : AMBER }} />}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/* ── the toolbar over the selected element ────────────────────────────── */

function SelBar({ label, canWords, onWords, onAi, onClose }: { label: string; canWords: boolean; onWords: () => void; onAi: () => void; onClose: () => void }) {
  const b = { ...btn, color: "#fff", minWidth: 0, px: 1, py: 0.25, fontSize: "0.76rem", borderRadius: "5px", "&:hover": { bgcolor: "rgba(255,255,255,.12)" } };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: "#15223a", color: "#fff", borderRadius: "7px", px: 0.5, py: 0.4, boxShadow: "0 10px 26px rgba(21,34,58,.32)" }}
      onMouseDown={(e) => e.preventDefault()}>
      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, px: 0.75, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "rgba(255,255,255,.8)" }}>{label}</Typography>
      {canWords && <Button size="small" onClick={onWords} startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Edit words</Button>}
      <Button size="small" onClick={onAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={b}>Ask AI</Button>
      <IconButton size="small" onClick={onClose} aria-label="Unselect" sx={{ color: "rgba(255,255,255,.7)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
    </Box>
  );
}

/* ── the stage ────────────────────────────────────────────────────────── */

export function Stage({ api, doc, d, lang, onLang, view, onView, preview, selected, picked, onPick, onEdit, editNonce, onEditWords, onAskAi, inserts, shell, onFix, empty, children, fold }: {
  api: StudioApi; doc: PageDoc; d: PageDoc; lang: string; onLang: (l: string) => void; view: View; onView: (v: View) => void;
  preview: ReturnType<typeof usePagePreview>; selected: string | null; picked: Picked | null;
  onPick: (p: Picked | null) => void; onEdit: (p: Picked, v: { text: string; inner: string; outer: string }) => void;
  editNonce: number; onEditWords: () => void; onAskAi: () => void; inserts: InsertOut[] | null; shell: PreviewOut | null;
  onFix: (left: Leftover[]) => void;
  /** what shows in place of the page (the page list, a language still to make) */
  empty?: React.ReactNode;
  children?: React.ReactNode;
  /** the side columns folded away, for a bigger page */
  fold?: { build: boolean; assist: boolean; onBuild: () => void; onAssist: () => void };
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
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
    const r = renderNewPage(d.fields, { marks: true, inserts: (inserts ?? []).filter((x) => x.ok).map((x) => ({ id: x.id, where: x.where, html: x.html })) });
    return `<style>${r.css}</style>${r.html}`;
  }, [isNew, d.fields, inserts]);

  const selectOpts = {
    mode: (isNew ? "field" : "element") as "field" | "element",
    selected, onPick, onEdit, editNonce,
  };
  const label = !selected ? "" : selected.startsWith("f:") || selected.startsWith("b:") ? fieldLabel(d.fields, selected.slice(2)).replace(/^\w/, (c) => c.toUpperCase())
    : selected.startsWith("i:") ? "Banner" : picked ? `<${picked.tag}>${picked.text ? ` ${picked.text.slice(0, 28)}` : ""}` : "";
  const canWords = !!selected && (selected.startsWith("f:") ? !/picture$|\.button$|^f:links\./.test(selected) || selected.endsWith(".label") : !!picked?.editable);
  const toolbar = selected ? <SelBar label={label} canWords={canWords} onWords={onEditWords} onAi={onAskAi} onClose={() => onPick(null)} /> : undefined;

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
              select={side === "after" ? selectOpts : undefined} toolbar={side === "after" ? toolbar : undefined} fit={fit || want.length === 2} />
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", borderRadius: "18px", overflow: "hidden", bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, backgroundImage: "radial-gradient(rgba(21,34,58,.07) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, flexWrap: "wrap", borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", backdropFilter: "blur(6px)", flexShrink: 0 }}>
        {fold && (
          <Tooltip title={fold.build ? "Show the build column" : "Fold the build column away"}>
            <IconButton size="small" onClick={fold.onBuild} aria-label="Fold the build column" sx={{ color: fold.build ? BLUE : MUTED }}><ViewSidebarOutlinedIcon sx={{ fontSize: 19, transform: "scaleX(-1)" }} /></IconButton>
          </Tooltip>
        )}
        <LangSwitch d={doc} lang={lang} onLang={onLang} />
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
        {views.length > 0 && !empty && <Choice value={view} onChange={onView} options={views} />}
        {!empty && <Choice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
        {!empty && device === "desktop" && <Choice value={zoom} onChange={setZoom} options={[{ key: "fit", label: "Fit" }, { key: "full", label: "100%" }]} />}
        <Tooltip title="Read the page from the shop again">
          <span><IconButton size="small" disabled={!!empty || busy.before || busy.after} onClick={preview.readAgain} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></span>
        </Tooltip>
        {d.path && !isNew && (
          <Tooltip title="Open the page on the shop">
            <IconButton size="small" component="a" href={shopUrl(d.env, d.path)} target="_blank" rel="noopener noreferrer" aria-label="Open on the shop"><OpenInNewIcon sx={{ fontSize: 17 }} /></IconButton>
          </Tooltip>
        )}
        {fold && (
          <Tooltip title={fold.assist ? "Show the assistant" : "Fold the assistant away"}>
            <IconButton size="small" onClick={fold.onAssist} aria-label="Fold the assistant" sx={{ color: fold.assist ? BLUE : MUTED }}><ViewSidebarOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>
          </Tooltip>
        )}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
              {langName(lang)} · {isNew ? `a new page in ${d.store}` : d.store} · click an element to select it, double-click to edit its words
            </Typography>
            {isNew ? (
              !shell ? <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, color: MUTED, py: 10 }}><CircularProgress size={16} /> Opening the store&apos;s page…</Box>
                : !shell.ok ? (
                  <Box sx={{ maxWidth: 520, mx: "auto", my: 4 }}>
                    <Typography sx={{ fontSize: "0.82rem", color: AMBER, textAlign: "center", mb: 1.5 }}>{shell.error} The page shows without the shop around it.</Typography>
                    <Frame html={`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font-family:Jost,Arial,sans-serif"><div id="apx-root"></div></body></html>`} device={device} title="The new page" select={selectOpts} patch={patch} toolbar={toolbar} fit={fit} />
                  </Box>
                ) : <Frame html={shell.html} device={device} title="The new page" select={selectOpts} patch={patch} toolbar={toolbar} fit={fit} />
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

/** What the middle shows for a language whose page is not made yet. */
export function LangEmpty({ d, lang, main, busy, canAi, onTranslate, onFind, onPick, finding }: {
  d: PageDoc; lang: string; main: string; busy: boolean; canAi: boolean; onTranslate: () => void; onFind?: () => void; onPick?: React.ReactNode; finding?: boolean;
}) {
  const isNew = d.source === "new";
  return (
    <Box sx={{ maxWidth: 640, mx: "auto", textAlign: "center", py: 8, px: 2 }}>
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 750, color: INK, mb: 0.75 }}>The {langName(lang)} page is not made yet</Typography>
      <Typography sx={{ fontSize: "0.9rem", color: MUTED, mb: 2.5 }}>
        {isNew
          ? `It will be its own page in ${d.store}, with its own words and address. Translate the ${langName(main)} page into it - the structure and pictures stay, every word is translated - then change what you like.`
          : `The shop's ${langName(lang)} page is its own page, with its own address. The changes made in ${langName(main)} are translated onto it - the same structure, the words in ${langName(lang)}.`}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="contained" disableElevation disabled={!canAi || busy} onClick={onTranslate} startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <AutoAwesomeOutlinedIcon />}
          sx={{ ...btn, bgcolor: PINK, borderRadius: "8px", height: 44, px: 2.5, "&:hover": { bgcolor: "#a3245c" } }}>
          {busy ? "Translating… (about a minute)" : `Translate the whole page into ${langName(lang)}`}
        </Button>
        {onFind && <Button variant="outlined" disabled={finding} onClick={onFind} sx={{ ...btn, borderRadius: "8px", height: 44, borderColor: HAIRLINE, color: INK }}>{finding ? "Looking…" : `Find the ${langName(lang)} page`}</Button>}
      </Box>
      {onPick}
    </Box>
  );
}
