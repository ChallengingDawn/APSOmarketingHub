"use client";
// THE NEWSLETTER STUDIO (Content v3, 08.11.2026). SARCLA, that evening: "newsletter also: editing is very confusing; the
// logo is not the true one, though we have it".
//
// The flow: open the to-do -> the e-mail is in the middle as the reader sees it (our logo on top, our footer under it),
// with the inbox's line above it: from, subject, preview text and the send day (= its day on the content calendar) ->
// nothing written yet? start from one of our e-mails, let the assistant write it from the brief, or take a layout -> click
// a block to pick it, click its words to edit them right there; "+" over and under the picked block adds one, the arrows
// move it, the bin removes it -> a picture: click it, make or upload it on the right -> the assistant on the right works
// on the picked block or on the whole e-mail -> the blocks on the left are the map (drag to move) -> "Send it out" under
// them: the checks, the HTML, a HubSpot draft (behind its admin switch).
//
// Taken out (the confusing parts of Content v2): a card of fields per block in the build pane (the words are edited in
// the e-mail; only a picture, a link and a story's side are set on the right); the big send-day card and the From /
// Subject / Preheader fields (the inbox line); the "In the inbox" tab (the inbox line is always there); the "Asks work on:
// this block / the whole letter" switch (the assistant works on what is picked - the x goes back to the whole e-mail);
// the warnings box at the top (under "Send it out", as "Before it goes out"); the "Line beside the logo" field and the
// logo written in letters (our real logo, as our e-mails carry it); "How the last did" (the figures are in Our e-mails).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TranslateIcon from "@mui/icons-material/Translate";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_LABEL, PREHEADER_MAX, SUBJECT_MAX, TEMPLATES, applyDraft, applyEdits, applyTemplate, asNewsletter, blockOf, checks, copyBlock, hubPictures,
  isBlank, moveBlock, oneLine, partText, renderEmail, sendDay, setPart, type BlockKind, type DraftAnswer, type Edits, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { AssistantPanel, Label, PINK, Pane, StudioPanes, btn, mainBtn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { EditFrame, type Device } from "../blog/EditFrame";
import { setDocSafely } from "../blog/safeSet";
import { addChange, madeLanguages, versionLabel, versionOf, type StudioChange } from "@/lib/content/studio/kinds/blog/changes";
import { BLUE, ChangesList, TranslateRow, Working, shopPageSearch, toolBtn, useSettled } from "../blog/ui";
import { BlockTools, Gallery, Layouts, Outline, made } from "./Blocks";
import { OurEmails, type Learned } from "./OurEmails";

const LANGS: { key: string; label: string }[] = [{ key: "DE", label: "German" }, { key: "FR", label: "French" }, { key: "IT", label: "Italian" }, { key: "EN", label: "English" }, { key: "NL", label: "Dutch" }, { key: "PL", label: "Polish" }];

const LANG_KEYS = LANGS.map((l) => l.key);
const LANG_NAME: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.key, l.label]));
type EditAnswer = Edits & { note: string };
type Work = { label: string; key: string | null; since: number } | null;

/** A part's name in the label over it: the block, and which of its words. */
const FIELD: Record<string, string> = { headline: "headline", eyebrow: "line over it", title: "title", text: "words", button: "button", link: "button", tagline: "line", image: "picture", logo: "logo", imageAlt: "picture's words" };
function nameOf(d: NewsletterDoc, key: string): string | null {
  const [id, field] = key.split(":");
  const b = d.blocks.find((x) => x.id === id);
  if (!b) return null;
  const f = field ? FIELD[field] ?? (/^item\d/.test(field) ? `product ${field.slice(4, 5)}` : field) : "";
  return `${BLOCK_LABEL[b.kind]}${f ? ` · ${f}` : ""}`;
}

/** The inbox's line over the e-mail: who it is from, its subject, its preview text, the day it goes out. Typed in place. */
function InboxLine({ api, d, set, width }: { api: StudioApi; d: NewsletterDoc; set: (d: NewsletterDoc) => void; width: number }) {
  const canEdit = api.data.access.canEdit;
  const p = api.data.piece;
  const [err, setErr] = useState<string | null>(null);
  const [focus, setFocus] = useState<"subject" | "pre" | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const moveDay = async (day: string | null) => { setErr(null); const r = await api.edit({ dueDate: day }); if (!r.ok) setErr(r.error ?? "Not moved."); };
  const count = (n: number, max: number, on: boolean) => (on || n > max ? (
    <Typography component="span" sx={{ fontSize: "0.72rem", color: n > max ? "#c5221f" : MUTED, fontWeight: n > max ? 700 : 500, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{n > max ? `${n - max} too many` : `${n} / ${max}`}</Typography>
  ) : null);
  const input = { fontFamily: "inherit", color: INK, p: 0, "& input": { p: "2px 4px", mx: "-4px", borderRadius: "4px", transition: "background-color .12s" }, "& input:hover": canEdit ? { bgcolor: "rgba(36,89,209,.06)" } : {}, "& input:focus": { bgcolor: "rgba(36,89,209,.08)" } };
  return (
    <Box sx={{ width, maxWidth: "100%", mx: "auto", mb: 1.5, bgcolor: "#fff", borderRadius: "8px", boxShadow: "0 1px 2px rgba(31,45,78,.06), 0 8px 24px rgba(31,45,78,.08)", px: 2, py: 1.5, display: "flex", gap: 1.5, boxSizing: "border-box" }}>
      <Box sx={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, bgcolor: "#d80901", color: "#fff", display: "grid", placeItems: "center", fontSize: "0.9rem", fontWeight: 700 }}>{(d.fromName || "A")[0]}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InputBase value={d.fromName} disabled={!canEdit} onChange={(e) => set({ ...d, fromName: e.target.value.slice(0, 60) })} placeholder="From"
            inputProps={{ "aria-label": "From" }} sx={{ ...input, flex: 1, fontSize: "0.88rem", fontWeight: 600 }} />
          <Tooltip title="The day it goes out - its day on the content calendar, the same as in the bar">
            <Box component="button" type="button" disabled={!canEdit} onClick={() => { const i = dayRef.current; if (!i) return; try { i.showPicker(); } catch { i.focus(); } }}
              sx={{ all: "unset", display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.78rem", color: p.dueDate ? MUTED : "#9a6b00", cursor: canEdit ? "pointer" : "default", position: "relative", whiteSpace: "nowrap", px: 0.5, borderRadius: "4px", "&:hover": canEdit ? { bgcolor: "rgba(36,89,209,.06)", color: BLUE } : {} }}>
              {p.dueDate ? sendDay(p.dueDate) : "Not planned yet"}
              <input ref={dayRef} type="date" value={p.dueDate ?? ""} disabled={!canEdit} onChange={(e) => void moveDay(e.target.value || null)} aria-label="Send day" tabIndex={-1}
                style={{ position: "absolute", left: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }} />
            </Box>
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InputBase value={d.subject} disabled={!canEdit} onChange={(e) => set({ ...d, subject: e.target.value })} placeholder="Write the subject line"
            onFocus={() => setFocus("subject")} onBlur={() => setFocus(null)} inputProps={{ "aria-label": "Subject line" }}
            sx={{ ...input, flex: 1, fontSize: "0.98rem", fontWeight: 700, "& input::placeholder": { color: "#b26a00", opacity: 1, fontWeight: 600 } }} />
          {count(d.subject.length, SUBJECT_MAX, focus === "subject")}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <InputBase value={d.preheader} disabled={!canEdit} onChange={(e) => set({ ...d, preheader: e.target.value })} placeholder="Preview text - the line the inbox shows after the subject"
            onFocus={() => setFocus("pre")} onBlur={() => setFocus(null)} inputProps={{ "aria-label": "Preview text" }}
            sx={{ ...input, flex: 1, fontSize: "0.86rem", color: MUTED }} />
          {count(d.preheader.length, PREHEADER_MAX, focus === "pre")}
        </Box>
        {err && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f" }}>{err}</Typography>}
      </Box>
    </Box>
  );
}

export default function Studio({ api }: StudioProps) {
  const d = useMemo(() => asNewsletter(api.doc), [api.doc]);
  const canEdit = api.data.access.canEdit;
  const p = api.data.piece;
  const docRef = useRef(d);
  docRef.current = d;
  const set = useCallback((next: NewsletterDoc) => api.setDoc(next), [api]);

  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ key: string; at: number } | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [adder, setAdder] = useState<{ el: HTMLElement; at: number } | null>(null);
  const [layouts, setLayouts] = useState<HTMLElement | null>(null);
  const [work, setWork] = useState<Work>(null);
  const [subjects, setSubjects] = useState<{ subject: string; preheader: string; why: string }[] | null>(null);
  const [learned, setLearned] = useState<Learned | null>(null);
  const [ours, setOurs] = useState(false);
  // the e-mail as it was before each change of this sitting, for its Undo (the list itself is kept in the e-mail)
  const befores = useRef(new Map<number, NewsletterDoc>());
  /** the language being made by a translation */
  const [tl, setTl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  // a link's address: the shop's pages, found as it is typed (an e-mail carries the full address)
  const linkSearch = useMemo(() => shopPageSearch(), []);
  /** the picture being made: it breathes in the e-mail */
  const [picBusy, setPicBusy] = useState<string | null>(null);
  // a block dragged in the e-mail itself (SARCLA 08.11.2026 "editing is very confusing" - it moved by arrows only there):
  // which, and where it would land
  const [drag, setDrag] = useState<{ id: string; to: number | null; y: number | null } | null>(null);
  const rectRef = useRef<((s: string) => { left: number; top: number; width: number; height: number } | null) | null>(null);
  // drafts to HubSpot: on or off, and the admin's switch (SARCLA 08.11.2026 "go" after the test draft)
  const [push, setPush] = useState<{ on: boolean; byEnv: boolean; admin: boolean } | null>(null);
  // once per to-do (the api object is new on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void api.act<{ on: boolean; byEnv: boolean; admin: boolean }>("pushState").then((r) => { if (r.ok) setPush(r.result); }); }, [p.id]);

  const issues = useMemo(() => checks(d), [d]);
  const blank = useMemo(() => isBlank(d), [d]);
  const settled = useSettled(d, 120);
  const blockId = blockOf(sel);
  // the picked block shows the parts it may leave out (a line over the headline, a button) where they would go
  const html = useMemo(() => renderEmail(settled, { edit: true, selected: blockId }), [settled, blockId]);
  const block = blockId ? d.blocks.find((b) => b.id === blockId) ?? null : null;
  const bi = block ? d.blocks.indexOf(block) : -1;

  // a picked block that is gone is not picked any more
  useEffect(() => { if (blockId && !d.blocks.some((b) => b.id === blockId)) setSel(null); }, [d, blockId]);

  /** A change by the assistant (or a layout, or one of our e-mails): laid over the newsletter as it is now, with Undo. */
  // listed in "Changes made here" (kept in the e-mail, it survives a reload); a version saved just before each change lets
  // it be gone back from after a reload too
  const apply = async (next: NewsletterDoc, text: string, lang?: string) => {
    const entry: StudioChange = { id: Date.now(), text, at: new Date().toISOString(), ...(lang ? { lang, from: docRef.current.language.toUpperCase() } : {}) };
    await api.saveVersion(versionLabel(entry));
    const before = docRef.current;
    befores.current.set(entry.id, before);
    await setDocSafely(api, before, { ...next, changes: addChange(before.changes, entry) });
  };
  const undoMode = (c: StudioChange): "undo" | "back" | null => (befores.current.has(c.id) ? "undo" : versionOf(api.data.versions, c.id) ? "back" : null);
  /** Back to before a change: the e-mail as it was then (the later changes go too). */
  const undo = async (c: StudioChange) => {
    const before = befores.current.get(c.id);
    if (before) { befores.current.delete(c.id); await setDocSafely(api, docRef.current, before); return; }
    const v = versionOf(api.data.versions, c.id);
    if (!v || !window.confirm("Go back to the e-mail as it was before this change? What was done after it goes too - the e-mail as it is now is kept in Versions.")) return;
    await api.saveVersion("Before going back");
    if (!(await api.restore(v.id))) window.alert("Going back did not work - try again, or pick the version in Versions in the bar.");
  };
  const busyRun = async (label: string, key: string | null, fn: () => Promise<string | null>) => {
    setWork({ label, key, since: Date.now() });
    try { return await fn(); } finally { setWork(null); }
  };

  // what the assistant knows of our e-mails: subject and figures - and, for the ones picked, their words
  const learnedText = (learned?.newsletters?.map((n) => `${n.subject} - ${n.opens} - ${n.clicks}${n.words ? `\n${n.words}` : ""}`).join("\n\n") ?? "").slice(0, 3000);

  const draft = (request: string) => busyRun("Writing the newsletter from the brief…", null, async () => {
    const r = await api.ai<DraftAnswer>("draft", { learned: learnedText, request });
    if (!r.ok) return r.error;
    await apply(applyDraft(docRef.current, r.result), `The whole newsletter: subject, preview text, lead story and ${r.result.stories.length} stories - with an idea for each picture.`);
    setSel(null);
    return null;
  });
  /** Words changed by the assistant: in the picked block, or in the whole e-mail. */
  const edit = (request: string, o: { block?: string | null; language?: string; label: string }) => busyRun(
    o.language ? `Translating into ${LANGS.find((l) => l.key === o.language)?.label}…` : `${o.label}${o.block ? "" : " - the whole e-mail"}…`, o.block ?? null, async () => {
      const r = await api.ai<EditAnswer>("edit", { request, ...(o.block ? { blockId: o.block } : {}), ...(o.language ? { language: o.language } : {}) });
      if (!r.ok) return r.error;
      if (!r.result.blocks.length && !r.result.subject && !r.result.preheader) return "Nothing came back to change - ask again, in other words.";
      const next = applyEdits(docRef.current, r.result);
      const b = o.block ? docRef.current.blocks.find((x) => x.id === o.block) : null;
      await apply(o.language ? { ...next, language: o.language } : next, `${o.label}${b ? ` - ${BLOCK_LABEL[b.kind].toLowerCase()}` : ""}${r.result.note ? `: ${r.result.note}` : ""}`, o.language);
      return null;
    });

  const enabled = api.data.ai && canEdit;
  const kind = block ? BLOCK_LABEL[block.kind].toLowerCase() : "";
  const hasWords = !!block && !["divider", "header", "banner"].includes(block.kind);
  const quick: QuickAsk[] = block
    ? hasWords ? [
        { label: `Rewrite this ${kind}`, run: () => edit("Rewrite it: clearer, more concrete, same facts and links.", { block: block.id, label: "Rewritten" }) },
        { label: "Shorter", run: () => edit("Make it about a third shorter: keep every fact, cut padding and repetition.", { block: block.id, label: "Shorter" }) },
        { label: "More personal", run: () => edit("Make it more personal: speak to the reader directly (the language's polite form for business), as one practical person to another, about their day at work; keep every fact.", { block: block.id, label: "More personal" }) },
      ] : []
    : [
        {
          // the same words as the start card and the map (the flow standard)
          label: blank ? "Write the whole newsletter with AI" : "Write it all again",
          run: async () => {
            if (!isBlank(docRef.current) && !window.confirm("Write the whole newsletter again? Its words are replaced - Undo brings them back; pictures stay.")) return null;
            return draft("");
          },
        },
        {
          label: "Five subject lines",
          run: () => busyRun("Five subject lines…", null, async () => {
            const r = await api.ai<{ subject: string; preheader: string; why: string }[]>("subjects");
            if (!r.ok) return r.error;
            setSubjects(r.result);
            return null;
          }),
        },
        ...(blank ? [] : [
          { label: "Shorter - the whole e-mail", run: () => edit("Make it about a third shorter: keep every fact, cut padding and repetition.", { label: "Shorter" }) },
          { label: "More personal - the whole e-mail", run: () => edit("Make it more personal: speak to the reader directly (the language's polite form for business), as one practical person to another, about their day at work; keep every fact.", { label: "More personal" }) },
        ]),
      ];
  const onAsk = block ? (hasWords ? (t: string) => edit(t, { block: block.id, label: "As asked" }) : undefined) : (t: string) => (isBlank(docRef.current) ? draft(t) : edit(t, { label: "As asked" }));

  /* ── blocks: added, moved, copied, removed - in the e-mail and in the outline ── */
  const insert = (at: number, k: BlockKind, layout?: "stacked" | "left" | "right") => {
    const b = made(docRef.current, k, layout);
    api.setDoc((cur: unknown) => { const n = asNewsletter(cur); const blocks = [...n.blocks]; blocks.splice(at, 0, b); return { ...n, blocks }; });
    setSel(b.id);
    setFocus({ key: b.id, at: Date.now() });
  };
  const pickBlock = (id: string | null) => { setSel(id); if (id) setFocus({ key: id, at: Date.now() }); };

  const getHtml = async () => {
    const r = await api.act<{ html: string }>("html");
    return r.ok ? r.result.html : null;
  };
  const hub = hubPictures(d).length;
  const frameW = device === "mobile" ? 390 : 680;

  /* ── the way out (under the blocks) ── */
  const out = (
    <Box sx={{ display: "grid", gap: 1 }}>
      {issues.length > 0 ? (
        <Box sx={{ p: 1.25, borderRadius: "8px", bgcolor: "#fff8ec", border: "1px solid #f0d6a8" }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#7f4f0b", mb: 0.5 }}>Before it goes out</Typography>
          {issues.map((c, i) => (
            <Box key={i} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", fontSize: "0.8rem", color: c.level === "bad" ? "#8f1d1b" : "#7f4f0b", py: 0.25 }}>
              <WarningAmberOutlinedIcon sx={{ fontSize: 16, mt: "1px" }} />{c.text}
            </Box>
          ))}
        </Box>
      ) : <Typography sx={{ fontSize: "0.8rem", color: "#1b7a55" }}>Nothing to fix before it goes out.</Typography>}
      {hub > 0 && (
        <Typography sx={{ fontSize: "0.78rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "6px" }}>
          {hub === 1 ? "One picture is" : `${hub} pictures are`} kept in the hub. The HubSpot draft puts {hub === 1 ? "it" : "them"} into HubSpot&apos;s files; in the HTML {hub === 1 ? "it carries" : "they carry"} the hub&apos;s address.
        </Typography>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} sx={{ ...toolBtn, height: 34 }}
          onClick={async () => { const h = await getHtml(); if (h) { await navigator.clipboard.writeText(h); setNote("The HTML is copied."); } }}>Copy HTML</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} sx={{ ...toolBtn, height: 34 }}
          onClick={async () => {
            const h = await getHtml();
            if (!h) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([h], { type: "text/html" }));
            a.download = `${(d.subject || p.title).replace(/[^\w-]+/g, "-").slice(0, 60) || "newsletter"}.html`;
            a.click();
          }}>Download</Button>
      </Box>
      {push && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.8rem", color: MUTED }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: push.on ? "#1b7a55" : "#9aa5b8" }} />
          <Box component="span" sx={{ flex: 1 }}>{push.on ? "Drafts go to HubSpot - a person schedules them there" : "Drafts to HubSpot are off"}</Box>
          {push.admin && !push.byEnv && (
            <Button size="small" sx={{ ...toolBtn, height: 26 }}
              onClick={async () => { const r = await api.act<{ ok: boolean; on?: boolean; why?: string }>("pushSwitch", { on: !push.on }); if (r.ok && r.result.ok) setPush({ ...push, on: !!r.result.on }); else setNote(r.ok ? r.result.why ?? null : r.error); }}>
              {push.on ? "Switch off" : "Switch on"}
            </Button>
          )}
        </Box>
      )}
      <Tooltip title={push?.on ? "A draft in HubSpot - a person schedules it there" : "Drafts to HubSpot are switched off"}>
        <span><Button fullWidth variant="contained" disableElevation startIcon={<SendOutlinedIcon />} disabled={!canEdit || !push?.on} onClick={() => setSending(true)} sx={mainBtn}>Send to HubSpot as a draft</Button></span>
      </Tooltip>
      {d.hubspot?.url && <Button size="small" href={d.hubspot.url} target="_blank" rel="noreferrer" sx={btn}>Open the draft in HubSpot</Button>}
      {note && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{note}</Typography>}
    </Box>
  );

  /* ── a block dragged by its handle, in the e-mail ── */
  const startDrag = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const layer = e.currentTarget.closest("[data-x-overlay]") as HTMLElement | null;
    if (!layer) return;
    let scroller: HTMLElement | null = layer.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    const ids = docRef.current.blocks.map((b) => b.id);
    const from = ids.indexOf(id);
    let to: number | null = null;
    const where = (clientY: number) => {
      const y = clientY - layer.getBoundingClientRect().top;
      const rs = ids.map((x) => rectRef.current?.(`[data-block="${CSS.escape(x)}"]`) ?? null);
      let at = ids.length;
      for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r && y < r.top + r.height / 2) { at = i; break; } }
      const r = at < rs.length ? rs[at] : rs[rs.length - 1];
      const lineY = r ? (at < rs.length ? r.top : r.top + r.height) : null;
      // where it is already: no move
      to = at === from || at === from + 1 ? null : at;
      setDrag({ id, to, y: to === null ? null : lineY });
    };
    const move = (ev: PointerEvent) => {
      where(ev.clientY);
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (ev.clientY < sr.top + 70) scroller.scrollBy(0, -16);
        else if (ev.clientY > sr.bottom - 70) scroller.scrollBy(0, 16);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const at = to;
      setDrag(null);
      if (at === null) return;
      api.setDoc((cur: unknown) => {
        const n = asNewsletter(cur);
        const i = n.blocks.findIndex((b) => b.id === id);
        if (i < 0) return n;
        const blocks = [...n.blocks];
        const [b] = blocks.splice(i, 1);
        blocks.splice(at > i ? at - 1 : at, 0, b);
        return { ...n, blocks };
      });
      setSel(id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    setDrag({ id, to: null, y: null });
  };

  /* ── the e-mail in the middle ── */
  const overlay = ({ rect }: { rect: (s: string) => { left: number; top: number; width: number; height: number } | null }) => {
    rectRef.current = rect;
    if (drag) {
      const r = rect(`[data-block="${CSS.escape(drag.id)}"]`);
      return (
        <>
          {/* while a block is dragged, the e-mail under the pointer is the studio's: the move is followed over it */}
          <Box sx={{ position: "absolute", inset: 0, pointerEvents: "auto", cursor: "grabbing" }} />
          {r && <Box sx={{ position: "absolute", left: r.left, top: r.top, width: r.width, height: r.height, bgcolor: "rgba(194,44,110,.08)", outline: "2px dashed #c22c6e", outlineOffset: 2 }} />}
          {drag.y !== null && r && <Box sx={{ position: "absolute", left: r.left - 6, width: r.width + 12, top: drag.y - 2, height: 4, borderRadius: 2, bgcolor: "#c22c6e", boxShadow: "0 0 0 3px rgba(194,44,110,.18)" }} />}
        </>
      );
    }
    if (!block || !canEdit) return null;
    const r = rect(`[data-block="${CSS.escape(block.id)}"]`);
    if (!r) return null;
    const plus = (at: number, top: number, label: string) => (
      <Tooltip title={label} placement="left">
        <Box component="button" type="button" aria-label={label} onClick={(e) => setAdder({ el: e.currentTarget, at })}
          sx={{ all: "unset", pointerEvents: "auto", cursor: "pointer", position: "absolute", left: r.left + r.width / 2 - 13, top: top - 13, width: 26, height: 26, borderRadius: "50%", bgcolor: BLUE, color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(36,89,209,.4)", "&:hover": { bgcolor: "#1d47a8" } }}>
          <AddIcon sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>
    );
    const tool = (label: string, icon: React.ReactNode, on: () => void, disabled = false) => (
      <Tooltip title={label} placement="right">
        <span>
          <IconButton size="small" aria-label={label} disabled={disabled} onClick={on}
            sx={{ pointerEvents: "auto", bgcolor: "#fff", borderRadius: "6px", width: 28, height: 28, "&:hover": { bgcolor: "#eef3ff", color: BLUE } }}>{icon}</IconButton>
        </span>
      </Tooltip>
    );
    // beside the e-mail, never over its words (on a phone too: outside its frame)
    const right = r.left + r.width + (device === "mobile" ? 18 : 8);
    return (
      <>
        {plus(bi, r.top, "Add a block above")}
        {plus(bi + 1, r.top + r.height, "Add a block below")}
        <Box sx={{ position: "absolute", left: right, top: r.top + 4, display: "flex", flexDirection: "column", gap: 0.5, p: 0.5, borderRadius: "8px", bgcolor: "#fff", boxShadow: "0 4px 16px rgba(31,45,78,.18)", pointerEvents: "auto" }}>
          <Tooltip title="Drag to move the block" placement="right">
            <Box component="button" type="button" aria-label="Drag to move the block" onPointerDown={(e: React.PointerEvent<HTMLElement>) => startDrag(e, block.id)}
              sx={{ all: "unset", width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: "6px", cursor: "grab", color: "#5f6a70", touchAction: "none", "&:hover": { bgcolor: "#fbeef4", color: "#c22c6e" } }}>
              <DragIndicatorIcon sx={{ fontSize: 18 }} />
            </Box>
          </Tooltip>
          {tool("Move up", <ArrowUpwardIcon sx={{ fontSize: 16 }} />, () => api.setDoc((cur: unknown) => moveBlock(cur, block.id, -1)), bi === 0)}
          {tool("Move down", <ArrowDownwardIcon sx={{ fontSize: 16 }} />, () => api.setDoc((cur: unknown) => moveBlock(cur, block.id, 1)), bi === d.blocks.length - 1)}
          {tool("Duplicate", <ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />, () => {
            const c = copyBlock(block);
            api.setDoc((cur: unknown) => { const n = asNewsletter(cur); const blocks = [...n.blocks]; const at = blocks.findIndex((x) => x.id === block.id); blocks.splice(at + 1, 0, c); return { ...n, blocks }; });
            setSel(c.id);
          })}
          {tool("Remove", <DeleteOutlineIcon sx={{ fontSize: 16 }} />, () => { api.setDoc((cur: unknown) => { const n = asNewsletter(cur); return { ...n, blocks: n.blocks.filter((x) => x.id !== block.id) }; }); setSel(null); })}
        </Box>
      </>
    );
  };

  const preview = (
    <Pane tone="stage" pad={false} title="The e-mail, as readers see it" right={
      <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
    }>
      <Box sx={{ p: 2.5 }}>
        {work && <Working label={work.label} since={work.since} />}
        <InboxLine api={api} d={d} set={set} width={frameW + (device === "mobile" ? 16 : 2)} />
        <EditFrame html={html} device={device} width={680} title="The e-mail" texts={(k) => partText(docRef.current, k)} oneLine={oneLine}
          selected={sel} onSelect={setSel} onCommit={(k, t) => api.setDoc((cur: unknown) => setPart(cur, k, t))} readOnly={!canEdit} focus={focus} busy={work ? work.key ?? "*" : picBusy}
          overlay={overlay}
          rich={(k) => { const b = docRef.current.blocks.find((x) => x.id === k.split(":")[0]); return k.endsWith(":text") && b && (b.kind === "hero" || b.kind === "article" || b.kind === "text") ? "blocks" : null; }}
          linkSearch={linkSearch} linkBase="https://www.apsoparts.com"
          label={drag ? undefined : (k) => nameOf(docRef.current, k)} onAskAi={enabled && onAsk ? () => askRef.current?.focus() : undefined} />
      </Box>
    </Pane>
  );

  /* ── the assistant ── */
  const top = (
    <Box sx={{ mb: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>Working on</Typography>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: block ? PINK : INK, lineHeight: 1.3 }}>{block ? `${BLOCK_LABEL[block.kind]} · block ${bi + 1}` : "The whole e-mail"}</Typography>
        </Box>
        {block && <Tooltip title="Back to the whole e-mail"><IconButton size="small" onClick={() => setSel(null)} aria-label="Back to the whole e-mail"><CloseIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
      </Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>
        {block ? (hasWords ? "Its words are edited in the e-mail, as they look - click them. Its picture and links are open on the left, under its row." : "What it needs is open on the left, under its row.") : "Click a block in the e-mail to work on it; click its words to edit them there."}
      </Typography>
    </Box>
  );
  // the picked block's own fields: under its row in the map (the flow standard)
  const fields = block ? (
    <BlockTools b={block} picked={sel} disabled={!canEdit} where={{ projectId: p.projectId, pieceId: p.id, me: api.data.me }} onMaking={setPicBusy}
      patch={(id, f) => api.setDoc((cur: unknown) => { const n = asNewsletter(cur); return { ...n, blocks: n.blocks.map((x) => (x.id === id ? ({ ...x, ...f } as typeof x) : x)) }; })}
      set={(nb) => set({ ...docRef.current, blocks: docRef.current.blocks.map((x) => (x.id === nb.id ? nb : x)) })} />
  ) : null;
  // the start, at the top of the map while nothing is written (the flow standard)
  const start = blank && canEdit && !work ? (
    <Box sx={{ p: 1.5, mb: 1.25, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>What are you making?</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>A newsletter from the project&apos;s brief - in</Typography>
      <SquareChoice value={d.language.toUpperCase()} onChange={(l: string) => set({ ...docRef.current, language: l })} options={LANGS.map((l) => ({ key: l.key, label: l.key }))} />
      <Button fullWidth variant="contained" disableElevation disabled={!enabled} startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => void draft("")} sx={{ ...mainBtn, mt: 1.25, minHeight: 38, height: "auto", py: 0.75, whiteSpace: "normal", lineHeight: 1.25 }}>Write the whole newsletter with AI</Button>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, mt: 1 }}>
        <Button size="small" startIcon={<MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => setOurs(true)} sx={{ ...toolBtn, height: 32 }}>One of ours</Button>
        <Button size="small" startIcon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: 16 }} />} onClick={(e) => setLayouts(e.currentTarget)} sx={{ ...toolBtn, height: 32 }}>A layout</Button>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75, textAlign: "center" }}>or click any block and write it yourself</Typography>
    </Box>
  ) : null;
  const writeAll = !blank && enabled ? () => {
    if (!window.confirm("Write the whole newsletter again? Its words are replaced - Undo brings them back; pictures stay.")) return;
    void draft("");
  } : undefined;

  const assist = (
    <AssistantPanel enabled={enabled} quick={quick} onAsk={onAsk} top={top} inputRef={askRef}
      placeholder={block ? `What should change in this ${kind}? e.g. for buyers, not engineers` : blank ? "Say what this newsletter should say" : "Ask for a change to the whole e-mail"}>
      {!block && subjects && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>Subject lines - click one to use it</Label>
          {subjects.map((x, i) => (
            <Box key={i} component="button" type="button" onClick={() => void apply({ ...docRef.current, subject: x.subject, preheader: x.preheader }, `Subject: “${x.subject}”`)}
              sx={{ display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", p: 1.25, mb: 0.75, borderRadius: "6px", border: `1px solid ${d.subject === x.subject ? BLUE : HAIRLINE}`, bgcolor: "#fff", "&:hover": { borderColor: BLUE } }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK }}>{x.subject}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{x.preheader}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: "#3d4a63", mt: 0.4 }}>{x.why}</Typography>
            </Box>
          ))}
        </Box>
      )}
      {!block && !blank && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <TranslateRow what="e-mail" langs={LANG_KEYS} names={LANG_NAME} current={d.language} made={madeLanguages(d.changes, d.language.toUpperCase())} busy={tl}
            disabled={!enabled || (!!work && !tl)}
            onPick={async (l) => { setTl(l); try { setNote(await edit("Translate every word of the newsletter faithfully.", { language: l, label: `Into ${LANG_NAME[l]}` })); } finally { setTl(null); } }} />
        </Box>
      )}
      {!block && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>Our e-mails</Label>
          {d.startedFrom && (
            <Typography sx={{ fontSize: "0.8rem", color: INK, mb: 0.75 }}>
              Started from <b>“{d.startedFrom.subject}”</b>{d.startedFrom.date ? ` (${d.startedFrom.date})` : ""} - a HubSpot draft copies its look.
            </Typography>
          )}
          {learned?.newsletters && learned.newsletters.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 0.5 }}>The assistant writes like these:</Typography>
              {learned.newsletters.map((n, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.5, borderBottom: `1px solid ${HAIRLINE}` }}>
                  <Box sx={{ flex: 1, minWidth: 0, color: INK }}>{n.subject}</Box><Box sx={{ color: MUTED, whiteSpace: "nowrap" }}>{n.opens} · {n.clicks}</Box>
                </Box>
              ))}
            </Box>
          )}
          <Button size="small" variant="outlined" disabled={!canEdit} startIcon={<MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => setOurs(true)} sx={{ ...toolBtn, height: 32 }}>
            Start from one, or write like them
          </Button>
        </Box>
      )}
      <ChangesList changes={d.changes ?? []} mode={undoMode} onUndo={(c) => void undo(c)} disabled={!canEdit || !!work} />
      {note && <Typography sx={{ mt: 1.5, fontSize: "0.8rem", color: MUTED }}>{note}</Typography>}
    </AssistantPanel>
  );

  return (
    <>
      <StudioPanes id="newsletter4" buildWidth={300} assistWidth={340}
        build={<Outline d={d} set={set} sel={sel} onPick={pickBlock} canEdit={canEdit} onAdd={(el, at) => setAdder({ el, at })} onOurs={canEdit ? () => setOurs(true) : undefined}
          fields={fields} startCard={start} onWrite={enabled ? () => (blank ? void draft("") : writeAll?.()) : undefined} busy={work ? work.key ?? "all" : null}
          onLayout={(key) => void apply(applyTemplate(docRef.current, key), `Layout: ${TEMPLATES.find((t) => t.key === key)?.name ?? key} - the words already written are kept.`)} out={out} />}
        preview={preview}
        assist={assist}
      />
      <Popover open={!!adder} anchorEl={adder?.el} onClose={() => setAdder(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: "8px" } } }}>
        <Gallery onPick={(k, layout) => { if (adder) insert(adder.at, k, layout); setAdder(null); }} />
      </Popover>
      <Popover open={!!layouts} anchorEl={layouts} onClose={() => setLayouts(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 360, borderRadius: "8px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>A layout - the words written stay</Typography>
        <Layouts current={d.layout} onPick={(k) => { setLayouts(null); void apply(applyTemplate(docRef.current, k), `Layout: ${TEMPLATES.find((t) => t.key === k)?.name ?? k}.`); }} />
      </Popover>
      <Dialog open={sending} onClose={() => setSending(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Send to HubSpot as a draft?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.9rem", color: INK }}>HubSpot gets a draft e-mail “{d.subject || p.title}”. Nothing is sent to anybody: a person checks it and schedules it in HubSpot.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSending(false)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation sx={mainBtn} onClick={async () => {
            setSending(false);
            const r = await api.act<{ done: boolean; why?: string; url?: string; emailId?: string; note?: string }>("hubspot", { confirm: true });
            if (!r.ok) return setNote(r.error);
            if (!r.result.done) return setNote(r.result.why ?? "Not sent.");
            set({ ...docRef.current, hubspot: { emailId: r.result.emailId ?? undefined, url: r.result.url ?? undefined, state: "draft", at: new Date().toISOString() } });
            setNote(r.result.note ?? "The draft is in HubSpot.");
          }}>Send the draft</Button>
        </DialogActions>
      </Dialog>
      <OurEmails api={api} open={ours} onClose={() => setOurs(false)} language={d.language}
        onStart={(r) => {
          if (!isBlank(docRef.current) && !window.confirm(`Start from “${r.subject}”? Its stories, pictures and buttons replace this newsletter's - Undo brings them back.`)) return;
          void apply({ ...docRef.current, subject: r.subject, preheader: r.preheader, language: r.language || docRef.current.language, blocks: r.blocks as NewsletterDoc["blocks"], startedFrom: r.startedFrom, layout: undefined },
            `Started from our e-mail “${r.subject}” - its stories, pictures and buttons.`);
          setSel(null);
        }}
        onLearn={(l, picked) => { setLearned(l); set({ ...docRef.current, learnFrom: picked }); }} />
    </>
  );
}
