"use client";
// WHAT A KIND'S STUDIO HANDS TO THE FRAME'S BAR (Content v7, 10.11.2026). SARCLA: "Changes made here" - "bring it inside
// a small icon on top, a timeline; if you click, then you can see the detail"; and "on the top bar we should also be able
// to download". The bar (PieceStudio.tsx) is the same for the six studios, the history and the files are each kind's:
//   useTimeline(entries)   a kind's studio publishes its "Changes made here" - each change with its Undo - and the bar's
//                          history icon shows how many, a click the timeline. A studio that publishes nothing shows no icon.
//   Timeline               the bar's icon and its popover: every change, newest first, who made it (AI / you), where (a
//                          store view, a place), when, its note, and Undo (or "Go back") right there
//   Downloads              the bar's download icon: what the kind gives as files (studio/registry.tsx DOWNLOADS - a
//                          small module per kind, loaded when the menu opens)
// The list lives in a small store outside React's tree, so a studio that publishes on every render never makes its own
// tree draw again - only the bar's icon does, and only when the list says something new.

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import HistoryIcon from "@mui/icons-material/History";
import UndoIcon from "@mui/icons-material/Undo";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { StudioKind } from "@/lib/content/studio/kinds";
import { handOverPlan, safeName, savedLine, zipOf, type MadeFile } from "@/lib/handover";
import { PINK, btn } from "./parts";
import type { StudioApi } from "./useStudio";

/* ── the timeline: what a kind's studio publishes ─────────────────────────────────────────────────────────────────── */

export type TimelineEntry = {
  id: string | number;
  /** "AI changed the element", "Copied de-CH into fr-CH" */
  label: string;
  /** the ask, or what the AI said it did - one short line */
  note?: string | null;
  /** the check's verdict ("Looks wrong - not applied: ...") */
  warn?: string | null;
  /** when: a time in ms, or an ISO date */
  at: number | string;
  by?: "ai" | "you";
  /** where it was made: a store view ("de-CH"), a place, a page */
  where?: string | null;
  undone?: boolean;
  /** take it back: "Undo" (made in this sitting) or "Go back" (to the version kept before it); null = nothing to take back */
  undo?: { label?: "Undo" | "Go back"; tip?: string; disabled?: boolean; run: () => void } | null;
  /** why it cannot be taken back here ("to go back: Versions, top right") */
  why?: string | null;
};

export type Timeline = { entries: TimelineEntry[]; note?: string | null };

type Store = {
  get: () => Timeline | null;
  /** what the bar draws - a new object only when the list says something new */
  snap: () => { n: number; t: Timeline | null };
  set: (t: Timeline | null) => void;
  subscribe: (fn: () => void) => () => void;
};

/** What a list says, for "has it changed?" - not its Undo functions, which are new at every render. */
const sayOf = (t: Timeline | null) => (t ? `${t.note ?? ""}|${t.entries.map((e) => `${e.id}:${e.label}:${e.note ?? ""}:${e.warn ?? ""}:${e.undone ? 1 : 0}:${e.undo ? `${e.undo.label ?? "Undo"}${e.undo.disabled ? "-" : "+"}` : "x"}:${e.why ?? ""}`).join(",")}` : "none");

function makeStore(): Store {
  let current: Timeline | null = null;
  let said = "none";
  let snap = { n: 0, t: null as Timeline | null };
  const fns = new Set<() => void>();
  return {
    get: () => current,
    snap: () => snap,
    set: (t) => {
      current = t;
      const s = sayOf(t);
      if (s === said) return;
      said = s;
      snap = { n: snap.n + 1, t };
      fns.forEach((f) => f());
    },
    subscribe: (fn) => { fns.add(fn); return () => fns.delete(fn); },
  };
}

const FrameCtx = createContext<Store | null>(null);

/** The frame's store, for PieceStudio to hold and hand down. */
export function useFrameStore(): Store {
  const ref = useRef<Store | null>(null);
  ref.current ??= makeStore();
  return ref.current;
}
export const FrameProvider = FrameCtx.Provider;

/**
 * A kind's studio publishes its "Changes made here" to the bar's timeline (null: it has none). Called on every render
 * with the list as it is; the Undo of an entry is called as it is at the click (never an old one).
 */
export function useTimeline(entries: TimelineEntry[] | null, note?: string | null) {
  const store = useContext(FrameCtx);
  useEffect(() => { store?.set(entries ? { entries, note: note ?? null } : null); });
  useEffect(() => () => store?.set(null), [store]);
}

const toMs = (at: number | string) => (typeof at === "number" ? at : Date.parse(at));
function ago(at: number | string): string {
  const t = toMs(at);
  if (!Number.isFinite(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const AI_PINK = PINK;
const YOU_BLUE = "#2459d1";

/** The timeline itself - the popover's body (also drawn on its own by the static check). */
export function TimelineList({ t, onUndo }: { t: Timeline; onUndo: (e: TimelineEntry) => void }) {
  if (!t.entries.length) {
    return (
      <Typography sx={{ px: 2, py: 1.5, fontSize: "0.84rem", color: MUTED, lineHeight: 1.5 }}>
        Nothing changed yet. Every change - by the AI or by you - lands here, each with its Undo.
      </Typography>
    );
  }
  return (
    <Box sx={{ px: 1.5, py: 1, position: "relative" }}>
      {/* the line the changes hang on */}
      <Box aria-hidden sx={{ position: "absolute", left: 23, top: 18, bottom: 18, width: 2, bgcolor: "rgba(21,34,58,.09)", borderRadius: 1 }} />
      {t.entries.map((e) => {
        const color = e.undone ? "#b3bccb" : e.by === "you" ? YOU_BLUE : AI_PINK;
        return (
          <Box key={e.id} sx={{ position: "relative", display: "flex", gap: 1.25, alignItems: "flex-start", py: 0.9 }}>
            <Box sx={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0, pt: 0.55 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: e.undone ? "#fff" : color, border: `2px solid ${color}`, boxShadow: "0 0 0 3px #fff", boxSizing: "border-box" }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, opacity: e.undone ? 0.55 : 1 }}>
              <Typography sx={{ fontSize: "0.85rem", color: INK, fontWeight: 650, lineHeight: 1.35, textDecoration: e.undone ? "line-through" : "none", overflowWrap: "anywhere" }}>{e.label}</Typography>
              {e.note && (
                <Typography title={e.note} sx={{ fontSize: "0.77rem", color: MUTED, lineHeight: 1.4, mt: 0.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{e.note}</Typography>
              )}
              {e.warn && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f", fontWeight: 600, mt: 0.25, lineHeight: 1.4 }}>{e.warn}</Typography>}
              <Typography sx={{ fontSize: "0.71rem", color: MUTED, mt: 0.25 }}>
                <Box component="span" sx={{ fontWeight: 700, color: e.undone ? MUTED : color }}>{e.by === "you" ? "You" : "AI"}</Box>
                {e.where ? ` · ${e.where}` : ""} · {ago(e.at)}{e.undone ? " · undone" : e.why ? ` · ${e.why}` : ""}
              </Typography>
            </Box>
            {!e.undone && e.undo && (
              <Tooltip title={e.undo.tip ?? "Put it back as it was before this (and every later change)"}>
                <span>
                  <Button size="small" disabled={e.undo.disabled} onClick={() => onUndo(e)} startIcon={<UndoIcon sx={{ fontSize: 15 }} />}
                    sx={{ ...btn, color: INK, minWidth: 0, px: 1, flexShrink: 0, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", height: 28 }}>
                    {e.undo.label ?? "Undo"}
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        );
      })}
      {t.note && <Typography sx={{ px: 0.5, pt: 0.75, mt: 0.5, borderTop: `1px solid ${HAIRLINE}`, fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>{t.note}</Typography>}
    </Box>
  );
}

/** The count on the icon: the changes not undone. */
export const liveCount = (t: Timeline | null) => (t ? t.entries.filter((e) => !e.undone).length : 0);

/** The bar's history icon (a timeline) with its count; a click opens every change with its Undo. */
export function TimelineButton() {
  const store = useContext(FrameCtx);
  const empty = useMemo(() => ({ subscribe: () => () => undefined, snap: () => ({ n: 0, t: null }) }), []);
  const { t } = useSyncExternalStore((store ?? empty).subscribe, (store ?? empty).snap, (store ?? empty).snap);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // the ages ("2 min ago") move on while it is open
  const [, tick] = useState(0);
  useEffect(() => { if (!anchor) return; const i = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(i); }, [anchor]);
  if (!t) return null;
  const n = liveCount(t);
  const undo = (e: TimelineEntry) => {
    // the Undo as the studio has it now - never the one of an older render
    const now = store?.get()?.entries.find((x) => x.id === e.id);
    (now?.undo ?? e.undo)?.run();
  };
  return (
    <>
      <Tooltip title={n ? `Changes made here · ${n}` : "Changes made here"}>
        <Button size="small" aria-label="Changes made here" onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ ...btn, minWidth: 0, px: 0.9, height: 34, gap: 0.5, color: n ? INK : MUTED, borderRadius: "8px", bgcolor: anchor ? "rgba(21,34,58,.06)" : "transparent" }}>
          <HistoryIcon sx={{ fontSize: 20 }} />
          {n > 0 && (
            <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: "4px", bgcolor: PINK, color: "#fff", fontSize: "0.7rem", fontWeight: 800, display: "inline-grid", placeItems: "center", lineHeight: 1, boxSizing: "border-box" }}>{n > 99 ? "99+" : n}</Box>
          )}
        </Button>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.75, width: 400, maxWidth: "calc(100vw - 24px)", maxHeight: "72vh", borderRadius: "12px", boxShadow: "0 18px 50px rgba(21,34,58,.18)", display: "flex", flexDirection: "column" } } }}>
        <Box sx={{ px: 2, pt: 1.5, pb: 1, display: "flex", alignItems: "baseline", gap: 1, borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 750, color: INK, flex: 1 }}>Changes made here</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{t.entries.length ? `${n} of ${t.entries.length} kept · newest first` : ""}</Typography>
        </Box>
        <Box sx={{ overflowY: "auto", minHeight: 0 }}><TimelineList t={t} onUndo={undo} /></Box>
      </Popover>
    </>
  );
}

/* ── downloads: what a kind gives as files ─────────────────────────────────────────────────────────────────────────── */

/** One file (or one set of files) a kind gives; `run` makes and saves it - null when done, else what to say. */
export type DownloadItem = { key: string; label: string; sub?: string; group?: string; disabled?: string | null; run: () => Promise<string | null> };
/** A kind's downloads, from the to-do as it is now. */
export type DownloadsOf = (api: StudioApi) => DownloadItem[];

/** The bar's download icon: the kind's files in a menu, grouped; a file being made shows its progress, a problem its words. */
export function DownloadButton({ api, kind, load }: { api: StudioApi; kind: StudioKind; load: (() => Promise<DownloadsOf>) | undefined }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [of, setOf] = useState<DownloadsOf | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useNoteFade(note, setNote);
  if (!load) return null;
  const open = async (el: HTMLElement) => {
    setAnchor(el); setNote(null);
    if (!of) {
      try { const f = await load(); setOf(() => f); } catch { setLoadErr("The downloads could not be opened - reload the page."); }
    }
  };
  const items = of ? of(api) : [];
  const run = async (x: DownloadItem) => {
    setAnchor(null); setBusy(x.label); setNote(null);
    // the files this run hands to the browser - each offered as a link too, the person's own click (Content v10, point 8)
    const from = handedSeq();
    try {
      const said = await x.run();
      const files = handedSince(from);
      setNote(said ? { text: said, bad: /not|could|failed|first/i.test(said) && !files.length, files }
        : { text: files.length ? savedLine(files.map((f) => f.name), files[0]?.inside ?? 0) : `${x.label} - saved to your downloads.`, bad: false, files });
    } catch (e) { setNote({ text: e instanceof Error ? e.message : String(e), bad: true, files: handedSince(from) }); }
    setBusy(null);
  };
  return (
    <>
      <Tooltip title={busy ? `Making ${busy}…` : note ? note.text : "Download"}>
        <Button size="small" aria-label="Download" onClick={(e) => void open(e.currentTarget)} disabled={!!busy}
          sx={{ ...btn, minWidth: 0, px: 0.9, height: 34, gap: 0.5, color: note?.bad ? "#c5221f" : INK, borderRadius: "8px", bgcolor: anchor ? "rgba(21,34,58,.06)" : "transparent" }}>
          {busy ? <CircularProgress size={16} thickness={6} sx={{ color: PINK }} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 20 }} />}
          {busy && <Box component="span" sx={{ fontSize: "0.78rem", fontWeight: 650, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>Making…</Box>}
        </Button>
      </Tooltip>
      {note && !anchor && <SavedNote note={note} />}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.75, width: 340, maxHeight: "72vh", borderRadius: "12px", boxShadow: "0 18px 50px rgba(21,34,58,.18)" } } }}>
        {downloadEntries({ items: of ? items : null, loadErr, onRun: (x) => void run(x) })}
      </Menu>
    </>
  );
}

type Note = { text: string; bad: boolean; files?: Handed[] };

/** What a run said, and the file it made as a real link: a click on it is the person's own download, which the browser
 * lets through even where it held back the one the hub started ("Not there? Save it"). */
export function SavedNote({ note }: { note: Note }) {
  const f = note.files?.[note.files.length - 1] ?? null;
  return (
    <Typography role="status" component="div" sx={{ fontSize: "0.76rem", color: note.bad ? "#c5221f" : "#1b7a55", maxWidth: 300, lineHeight: 1.3 }}>
      <Box component="span" sx={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{note.text}</Box>
      {f && (
        <Box component="span" sx={{ color: MUTED }}>
          Not there?{" "}
          <Box component="a" href={f.href} download={f.name} title={f.name} sx={{ color: PINK, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "2px", "&:hover": { color: "#9e1f57" } }}>Save it</Box>
        </Box>
      )}
    </Typography>
  );
}

/** The menu's entries: its title, then the kind's files in their groups (also drawn on their own by the static check). */
export function downloadEntries({ items, loadErr, onRun }: { items: DownloadItem[] | null; loadErr?: string | null; onRun: (x: DownloadItem) => void }): React.ReactNode[] {
  const groups = [...new Set((items ?? []).map((x) => x.group ?? ""))];
  return [
    <Typography key="t" sx={{ px: 2, pt: 0.75, pb: 0.5, fontSize: "0.92rem", fontWeight: 750, color: INK }}>Download</Typography>,
    loadErr ? <MenuItem key="e" disabled sx={{ fontSize: "0.84rem", whiteSpace: "normal" }}>{loadErr}</MenuItem> : null,
    !items && !loadErr ? <MenuItem key="l" disabled sx={{ fontSize: "0.84rem", gap: 1 }}><CircularProgress size={14} />Reading what it gives…</MenuItem> : null,
    items && !items.length ? <MenuItem key="n" disabled sx={{ fontSize: "0.84rem", whiteSpace: "normal" }}>Nothing to download yet - write it first.</MenuItem> : null,
    ...groups.flatMap((g, gi) => [
      gi > 0 ? <Divider key={`d-${g}`} /> : null,
      g ? <Typography key={`g-${g}`} sx={{ px: 2, pt: 0.75, pb: 0.25, fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>{g}</Typography> : null,
      ...(items ?? []).filter((x) => (x.group ?? "") === g).map((x) => (
        <MenuItem key={x.key} disabled={!!x.disabled} onClick={() => onRun(x)} sx={{ display: "block", py: 0.75, whiteSpace: "normal" }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK, lineHeight: 1.35 }}>{x.label}</Typography>
          {(x.disabled || x.sub) && <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35 }}>{x.disabled || x.sub}</Typography>}
        </MenuItem>
      )),
    ]),
  ].filter(Boolean);
}

/** A done note stays a few seconds; a problem stays until the next click. */
function useNoteFade(note: Note | null, set: (n: null) => void) {
  useEffect(() => {
    if (!note || note.bad) return;
    // a note with its file's link stays a while: it is the way to the file when the browser held the download back
    const t = setTimeout(() => set(null), note.files?.length ? 45_000 : 6000);
    return () => clearTimeout(t);
  }, [note, set]);
}

/* ── helpers the kinds' downloads share ───────────────────────────────────────────────────────────────────────────── */

/** A file handed to the browser, kept a few minutes as a link the bar offers (SavedNote). */
export type Handed = { seq: number; name: string; href: string; size: number; inside: number };
const handed: Handed[] = [];
let seq = 0;
/** Where the list of handed files is now - a run's files are those after it. */
export const handedSeq = () => seq;
export const handedSince = (from: number): Handed[] => handed.filter((h) => h.seq > from);

/**
 * The browser's own download of a file made here (SARCLA 10.11.2026: "Download neither"). Started by the page, so the
 * browser may hold it back (an automatic download - see lib/handover.ts); the file stays ten minutes as a link the bar
 * offers, a click on which always saves it. `inside`: how many files a zip holds.
 */
export function saveFile(data: Blob | string, name: string, type = "text/html;charset=utf-8", inside = 1) {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const href = URL.createObjectURL(blob);
  const file = safeName(name);
  handed.push({ seq: ++seq, name: file, href, size: blob.size, inside });
  // a few at most, the older ones let go
  for (const old of handed.splice(0, Math.max(0, handed.length - 12))) URL.revokeObjectURL(old.href);
  setTimeout(() => { const i = handed.findIndex((h) => h.href === href); if (i >= 0) handed.splice(i, 1); URL.revokeObjectURL(href); }, 10 * 60_000);
  const a = document.createElement("a");
  a.href = href;
  a.download = file;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}

/** A file a kind makes; a picture drawn in the browser comes as a Blob. */
export type FileOut = { name: string; data: Blob | MadeFile["data"]; type?: string };

/**
 * Several files as ONE download - a zip (lib/handover.ts: a page that starts several downloads at once is asked about by
 * the browser, and a "no" there stops every later one). One file goes as it is. Returns what was saved.
 */
export async function saveFiles(files: FileOut[], zipName: string): Promise<{ name: string; files: number } | null> {
  const plan = handOverPlan(files.map((f) => ({ name: f.name, data: "", type: f.type })), zipName);
  if (!plan) return null;
  if (plan.files === 1) {
    const f = files[0];
    saveFile(f.data instanceof Blob ? f.data : new Blob([f.data as BlobPart], { type: f.type ?? "application/octet-stream" }), f.name, f.type);
    return { name: plan.name, files: 1 };
  }
  const made: MadeFile[] = [];
  for (const f of files) made.push({ name: f.name, data: f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data, type: f.type });
  saveFile(new Blob([zipOf(made) as BlobPart], { type: "application/zip" }), plan.name, "application/zip", made.length);
  return { name: plan.name, files: made.length };
}

/** A file name from a title: plain letters and dashes. */
export const fileStem = (title: string) =>
  (title || "apsoparts").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "apsoparts";

/** The browser lets a page start one download at a time: a short pause between two. */
export const pause = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** A picture made here, as WebP (the same pixels; Chrome and Edge write WebP, a browser that cannot keeps PNG). */
export async function asWebp(png: Blob, quality = 0.9): Promise<Blob> {
  const bmp = await createImageBitmap(png);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", quality));
  return out && out.type === "image/webp" ? out : png;
}
