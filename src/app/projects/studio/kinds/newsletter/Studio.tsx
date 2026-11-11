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
//
// cv16 (SARCLA 11.11.2026 ~18:25: "compare the evolution of this page [the Page builder] to the other content types'
// generators, and improve them"): every language is a tab of its own over the e-mail (a translation makes the language's
// own e-mail - every part, the shop's facts and our footer in it, a Page builder page linked in its store view - and the
// e-mail it came from stays); a click on words, a button or a picture opens ITS card beside the e-mail (./ElementPop.tsx:
// its words, its link, its own Ask AI applied at once with Undo, take it out); "Write it all again" in four ways
// (./WriteAgain.tsx); the last step is a publishing view - one HubSpot draft per language (./Send.tsx), the assistant
// folded away while it is open.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOCK_LABEL, PREHEADER_MAX, SUBJECT_MAX, TEMPLATES, applyDraft, applyEdits, applyTemplate, asNewsletter, blockOf, copyBlock,
  isBlank, moveBlock, oneLine, partText, renderEmail, sendDay, setPart, type BlockKind, type DraftAnswer, type Edits, type NewsletterDoc,
} from "@/lib/content/studio/kinds/newsletter/model";
import { followLanguage, languagesOf, mainLanguage, translationBase, versionIn, withVersion, withoutLanguage } from "@/lib/content/studio/kinds/newsletter/langs";
import { AssistantPanel, Label, PINK, Pane, StudioPanes, btn, mainBtn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { EditFrame, type Device } from "../blog/EditFrame";
import { setDocSafely } from "../blog/safeSet";
import { addChange, versionLabel, versionOf, type StudioChange } from "@/lib/content/studio/kinds/blog/changes";
import { BLUE, ChangesList, Working, shopPageSearch, toolBtn, useSettled } from "../blog/ui";
import { BlockTools, Gallery, Layouts, Outline, made } from "./Blocks";
import { OurEmails, type Learned } from "./OurEmails";
import { usePageLinks } from "./PagePick";
import { LangTabs, TranslateInto } from "./LangTabs";
import { Send } from "./Send";
import { ElementPop } from "./ElementPop";
import { WriteAgain, type WriteMode } from "./WriteAgain";
import { BlockAsk } from "./BlockAsk";

const LANGS: { key: string; label: string }[] = [{ key: "DE", label: "German" }, { key: "FR", label: "French" }, { key: "IT", label: "Italian" }, { key: "EN", label: "English" }, { key: "NL", label: "Dutch" }, { key: "PL", label: "Polish" }];

const LANG_KEYS = LANGS.map((l) => l.key);
const LANG_NAME: Record<string, string> = Object.fromEntries(LANGS.map((l) => [l.key, l.label]));
type EditAnswer = Edits & { note: string; left?: string[] };
/** What the shop's word rules took out of an AI answer, said in its change (cv16). */
const leftLine = (left?: string[]) => (left?.length ? ` - left out by the shop's rules: ${left.length === 1 ? left[0] : `${left.length} sentences`}` : "");
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
  const input = { fontFamily: "inherit", color: INK, p: 0, "& input": { p: "2px 4px", mx: "-4px", borderRadius: "4px", transition: "background-color .12s", textOverflow: "ellipsis" }, "& input:hover": canEdit ? { bgcolor: "rgba(36,89,209,.06)" } : {}, "& input:focus": { bgcolor: "rgba(36,89,209,.08)" } };
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
  // cv16: every language is a version of its own - the tab open is the e-mail edited here (./langs.ts)
  const langs = useMemo(() => languagesOf(api.doc), [api.doc]);
  const main = langs[0];
  const [tabWanted, setTab] = useState<string | null>(null);
  const tab = tabWanted && langs.includes(tabWanted) ? tabWanted : main;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const d = useMemo(() => versionIn(api.doc, tab), [api.doc, tab]);
  const canEdit = api.data.access.canEdit;
  const p = api.data.piece;
  const docRef = useRef(d);
  docRef.current = d;
  const wholeRef = useRef<unknown>(api.doc);
  wholeRef.current = api.doc;
  /** The open language's e-mail changed (a value, or a change of the e-mail as it is when it lands). */
  const setV = useCallback((next: NewsletterDoc | ((cur: NewsletterDoc) => NewsletterDoc)) => {
    const lang = tabRef.current;
    api.setDoc((cur: unknown) => withVersion(cur, lang, typeof next === "function" ? next(versionIn(cur, lang)) : next));
  }, [api]);
  const set = useCallback((next: NewsletterDoc) => setV(next), [setV]);

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
  const [note, setNote] = useState<string | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  // a link's address: the shop's pages, found as it is typed (an e-mail carries the full address)
  const linkSearch = useMemo(() => shopPageSearch(), []);
  // ... and the Page builder's new pages, picked under each link field - read once, when first wanted (11.11.2026)
  const pageLinks = usePageLinks(api.act);
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
  // cv16: into the open language's e-mail - or, for a translation, into the language made (`into`); its Undo brings the
  // whole newsletter back as it was (every language)
  const apply = async (next: NewsletterDoc, text: string, lang?: string, into?: string) => {
    const entry: StudioChange = { id: Date.now(), text, at: new Date().toISOString(), ...(lang ? { lang, from: docRef.current.language.toUpperCase() } : {}) };
    // kept quietly (09.11.2026): no line on the project's feed per change, the newest 20 kept, Versions names it
    await api.keepVersion?.(versionLabel(entry));
    const before = asNewsletter(wholeRef.current);
    const where = into ?? tabRef.current;
    const had = languagesOf(before).includes(where) ? versionIn(before, where).changes : [];
    befores.current.set(entry.id, before);
    await setDocSafely(api, before, withVersion(before, where, { ...next, changes: addChange(had, entry) }));
  };
  const undoMode = (c: StudioChange): "undo" | "back" | null => (befores.current.has(c.id) ? "undo" : versionOf(api.data.versions, c.id) ? "back" : null);
  /** Back to before a change: the e-mail as it was then (the later changes go too). */
  const undo = async (c: StudioChange) => {
    const before = befores.current.get(c.id);
    if (before) { befores.current.delete(c.id); await setDocSafely(api, asNewsletter(wholeRef.current), before); return; }
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

  const draft = (request: string, mode: WriteMode = "topic") => busyRun("Writing the newsletter from the brief…", null, async () => {
    const r = await api.ai<DraftAnswer & { left?: string[] }>("draft", { learned: learnedText, request, mode, lang: tabRef.current });
    if (!r.ok) return r.error;
    const extra = r.result.extra?.length ?? 0;
    await apply(applyDraft(docRef.current, r.result), `The whole newsletter${mode === "better" ? ", written again better" : mode === "ask" ? ", as asked" : ""}: subject, preview text, lead story and ${r.result.stories.length} stories${extra ? ` and ${extra} block${extra === 1 ? "" : "s"} added here` : ""} - with an idea for each picture${leftLine(r.result.left)}.`);
    setSel(null);
    return null;
  });
  /** "Write it all again" in its four ways (cv16, as the Page builder): from the topic, directly, as asked, or empty. */
  const writeAgain = (mode: WriteMode, request?: string) => {
    if (mode === "reset") {
      const cur = docRef.current;
      void apply({ ...cur, subject: "", preheader: "", blocks: TEMPLATES.find((t) => t.key === (cur.layout ?? "news"))?.blocks(cur.language) ?? TEMPLATES[1].blocks(cur.language) }, "Started again - the e-mail is empty (its layout's blocks).");
      setSel(null);
      return;
    }
    void draft(mode === "better" ? "Write it again better: clearer, more concrete, the same facts and links." : request ?? "", mode);
  };
  /** Words changed by the assistant: in the picked block, or in the whole e-mail. */
  const edit = (request: string, o: { block?: string | null; language?: string; label: string }) => busyRun(
    o.language ? `Translating into ${LANGS.find((l) => l.key === o.language)?.label}…` : `${o.label}${o.block ? "" : " - the whole e-mail"}…`, o.block ?? null, async () => {
      const r = await api.ai<EditAnswer>("edit", { request, lang: tabRef.current, ...(o.block ? { blockId: o.block } : {}), ...(o.language ? { language: o.language } : {}) });
      if (!r.ok) return r.error;
      if (!r.result.blocks.length && !r.result.subject && !r.result.preheader) return `Nothing came back to change - ask again, in other words.${leftLine(r.result.left)}`;
      const b = o.block ? docRef.current.blocks.find((x) => x.id === o.block) : null;
      const said = `${o.label}${b ? ` - ${BLOCK_LABEL[b.kind].toLowerCase()}` : ""}${r.result.note ? `: ${r.result.note}` : ""}${leftLine(r.result.left)}`;
      if (o.language) {
        // a translation (cv16): the language's own e-mail - every part along, what follows the language set - and the
        // e-mail it came from stays as it is
        const source = docRef.current;
        const { doc: next, moved } = followLanguage(source, applyEdits(translationBase(source, o.language), r.result), pageLinks.rows);
        await apply(next, `${said}${moved ? ` - ${moved} link${moved === 1 ? "" : "s"} to the ${o.language} page` : ""}`, o.language, o.language);
        setTab(o.language);
        setSel(null);
        return null;
      }
      await apply(applyEdits(docRef.current, r.result), said);
      return null;
    });
  /** One element's words changed by its own Ask AI (cv16): applied at once; its Undo is that change's. */
  const askElement = async (key: string, request: string): Promise<{ error?: string; undo?: () => void; note?: string }> => {
    const [blockId, field] = key.split(":");
    const r = await api.ai<EditAnswer>("edit", { request, lang: tabRef.current, blockId, field });
    if (!r.ok) return { error: r.error };
    const f = r.result.blocks.find((x) => x.id === blockId)?.fields.find((x) => x.name === field);
    if (!f) return { error: `Nothing came back to change - ask again, in other words.${leftLine(r.result.left)}` };
    const id = Date.now();
    const before = asNewsletter(wholeRef.current);
    await apply(setPart(docRef.current, key, f.value), `${nameOf(docRef.current, key) ?? "Its words"}: ${request.slice(0, 60)}${leftLine(r.result.left)}`);
    const entry = [...befores.current.keys()].pop() ?? id;
    return { note: r.result.left?.length ? `Written - the shop's rules left out ${r.result.left.length === 1 ? r.result.left[0] : `${r.result.left.length} sentences`}.` : "Written - it is in the e-mail.", undo: () => { befores.current.delete(entry); void setDocSafely(api, asNewsletter(wholeRef.current), before); } };
  };

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
        // the same words as the start card and the map (the flow standard); written already, "Write it all again" has its
        // four ways over these (cv16)
        ...(blank ? [{ label: "Write the whole newsletter with AI", run: () => draft("") }] : []),
        {
          label: "Five subject lines",
          run: () => busyRun("Five subject lines…", null, async () => {
            const r = await api.ai<{ subject: string; preheader: string; why: string }[]>("subjects", { lang: tabRef.current });
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
    setV((n) => { const blocks = [...n.blocks]; blocks.splice(at, 0, b); return { ...n, blocks }; });
    setSel(b.id);
    setFocus({ key: b.id, at: Date.now() });
  };
  const pickBlock = (id: string | null) => { setSel(id); if (id) setFocus({ key: id, at: Date.now() }); };

  const frameW = device === "mobile" ? 390 : 680;

  /* ── the way out: one HubSpot draft per language (cv16, ./Send.tsx) ── */
  const [step, setStep] = useState<"blocks" | "out">("blocks");
  /** the picked block's own AI (cv16, the Page builder's block popup) - from its tools beside the e-mail */
  const [blockAsk, setBlockAsk] = useState<HTMLElement | null>(null);
  const out = (
    <Send api={api} pages={pageLinks} push={push} onPush={setPush} open={tab} onOpen={(l) => { setTab(l); setSel(null); }} />
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
      setV((n) => {
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
          {tool("Move up", <ArrowUpwardIcon sx={{ fontSize: 16 }} />, () => setV((n) => moveBlock(n, block.id, -1)), bi === 0)}
          {tool("Move down", <ArrowDownwardIcon sx={{ fontSize: 16 }} />, () => setV((n) => moveBlock(n, block.id, 1)), bi === d.blocks.length - 1)}
          {enabled && hasWords && (
            <Tooltip title="Write it again with AI" placement="right">
              <IconButton size="small" aria-label="Write this block again with AI" onClick={(e) => setBlockAsk(e.currentTarget)}
                sx={{ pointerEvents: "auto", bgcolor: blockAsk ? "#fbeef4" : "#fff", color: PINK, borderRadius: "6px", width: 28, height: 28, "&:hover": { bgcolor: "#fbeef4" } }}><AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} /></IconButton>
            </Tooltip>
          )}
          {tool("Duplicate", <ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />, () => {
            const c = copyBlock(block);
            setV((n) => { const blocks = [...n.blocks]; const at = blocks.findIndex((x) => x.id === block.id); blocks.splice(at + 1, 0, c); return { ...n, blocks }; });
            setSel(c.id);
          })}
          {tool("Remove", <DeleteOutlineIcon sx={{ fontSize: 16 }} />, () => { setV((n) => ({ ...n, blocks: n.blocks.filter((x) => x.id !== block.id) })); setSel(null); })}
        </Box>
        {/* the element picked: ITS card beside the e-mail - its words, its link, its own Ask AI, take it out (cv16) */}
        {sel && sel.includes(":") && !work && (
          <ElementPop d={d} k={sel} rect={rect} device={device} canEdit={canEdit} aiOn={!!enabled} pages={pageLinks} whole={api.doc} langs={langs}
            where={{ projectId: p.projectId, pieceId: p.id, me: api.data.me }} onMaking={setPicBusy}
            setV={setV} onAsk={(t) => askElement(sel, t)} onClose={() => setSel(blockOf(sel))} onKey={setSel} />
        )}
      </>
    );
  };

  const preview = (
    <Pane tone="stage" pad={false} title="The e-mail, as readers see it" right={
      <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
    }>
      <Box sx={{ p: 2.5 }}>
        {work && <Working label={work.label} since={work.since} />}
        <LangTabs langs={langs} open={tab} names={LANG_NAME} all={LANG_KEYS} doc={api.doc} busy={tl} canEdit={canEdit && !!enabled && !work}
          width={frameW + (device === "mobile" ? 16 : 2)}
          onOpen={(l) => { setTab(l); setSel(null); }}
          onAdd={(l) => { setTl(l); void edit("Translate every word of the newsletter faithfully.", { language: l, label: `Into ${LANG_NAME[l]}` }).then((e) => setNote(e)).finally(() => setTl(null)); }}
          onDrop={canEdit ? (l) => { if (!window.confirm(`Take the ${LANG_NAME[l] ?? l} e-mail out of this newsletter? Its HubSpot draft stays in HubSpot. Versions keeps it.`)) return; void api.keepVersion?.(`Before the ${l} e-mail was taken out`); api.setDoc((cur: unknown) => withoutLanguage(cur, l)); if (tab === l) setTab(main); } : undefined} />
        <InboxLine api={api} d={d} set={set} width={frameW + (device === "mobile" ? 16 : 2)} />
        <EditFrame html={html} device={device} width={680} title="The e-mail" texts={(k) => partText(docRef.current, k)} oneLine={oneLine}
          selected={sel} onSelect={setSel} onCommit={(k, t) => setV((n) => setPart(n, k, t))} readOnly={!canEdit} focus={focus} busy={work ? work.key ?? "*" : picBusy}
          overlay={overlay}
          rich={(k) => { const b = docRef.current.blocks.find((x) => x.id === k.split(":")[0]); return k.endsWith(":text") && b && (b.kind === "hero" || b.kind === "article" || b.kind === "text") ? "blocks" : null; }}
          linkSearch={linkSearch} linkBase="https://www.apsoparts.com"
          label={drag ? undefined : (k) => nameOf(docRef.current, k)}
          // the bar's Ask AI (cv16, as the Page builder's barAi): an element's own AI box; a whole block, the assistant's
          onAskAi={enabled && onAsk ? () => { const own = document.querySelector<HTMLInputElement>("[data-ai-box]"); if (own) own.focus(); else askRef.current?.focus(); } : undefined} />
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
      pages={pageLinks} language={d.language}
      patch={(id, f) => setV((n) => ({ ...n, blocks: n.blocks.map((x) => (x.id === id ? ({ ...x, ...f } as typeof x) : x)) }))}
      set={(nb) => set({ ...docRef.current, blocks: docRef.current.blocks.map((x) => (x.id === nb.id ? nb : x)) })} />
  ) : null;
  // the start, at the top of the map while nothing is written (the flow standard)
  const start = blank && canEdit && !work ? (
    <Box sx={{ p: 1.5, mb: 1.25, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>What are you making?</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>A newsletter from the project&apos;s brief - in</Typography>
      {langs.length === 1 ? <SquareChoice value={d.language.toUpperCase()} onChange={(l: string) => set({ ...docRef.current, language: l })} options={LANGS.map((l) => ({ key: l.key, label: l.key }))} />
        : <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{LANG_NAME[tab] ?? tab}</Typography>}
      <Button fullWidth variant="contained" disableElevation disabled={!enabled} startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => void draft("")} sx={{ ...mainBtn, mt: 1.25, minHeight: 38, height: "auto", py: 0.75, whiteSpace: "normal", lineHeight: 1.25 }}>Write the whole newsletter with AI</Button>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, mt: 1 }}>
        <Button size="small" startIcon={<MarkEmailReadOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => setOurs(true)} sx={{ ...toolBtn, height: 32 }}>Our e-mails</Button>
        <Button size="small" startIcon={<DashboardCustomizeOutlinedIcon sx={{ fontSize: 16 }} />} onClick={(e) => setLayouts(e.currentTarget)} sx={{ ...toolBtn, height: 32 }}>A layout</Button>
      </Box>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75, textAlign: "center" }}>or click any block and write it yourself</Typography>
    </Box>
  ) : null;
  const writeAll = !blank && enabled ? () => {
    if (!window.confirm("Write the whole newsletter again? Its words are replaced - Undo brings them back; pictures stay.")) return;
    void draft("");
  } : undefined;
  // "Write it all again" in four ways, at the top of the assistant while the whole e-mail is worked on (cv16)
  const again = !blank && canEdit ? (
    <Box sx={{ mt: 1 }}><WriteAgain disabled={!enabled} busy={!!work && !work.key} onRun={writeAgain} /></Box>
  ) : null;

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
      {!block && again}
      {!block && !blank && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          {/* cv16: a language made before is a tab of its own - a click here makes it again from this e-mail */}
          <TranslateInto langs={LANG_KEYS} names={LANG_NAME} open={tab} made={langs.filter((l) => l !== tab)} busy={tl}
            disabled={!enabled || (!!work && !tl)}
            onPick={async (l) => {
              if (langs.includes(l) && !window.confirm(`Translate this ${LANG_NAME[tab] ?? tab} e-mail into ${LANG_NAME[l] ?? l} again? The ${l} e-mail's words are replaced - Undo brings them back.`)) return;
              setTl(l); try { setNote(await edit("Translate every word of the newsletter faithfully.", { language: l, label: `Into ${LANG_NAME[l]}` })); } finally { setTl(null); }
            }} />
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
      <StudioPanes id="newsletter4" buildWidth={300} assistWidth={340} wide={step === "out"}
        build={<Outline d={d} set={set} sel={sel} onPick={pickBlock} canEdit={canEdit} onAdd={(el, at) => setAdder({ el, at })} onOurs={canEdit ? () => setOurs(true) : undefined}
          step={step} onStep={setStep}
          fields={fields} startCard={start} onWrite={enabled ? () => (blank ? void draft("") : writeAll?.()) : undefined} busy={work ? work.key ?? "all" : null}
          onLayout={(key) => void apply(applyTemplate(docRef.current, key), `Layout: ${TEMPLATES.find((t) => t.key === key)?.name ?? key} - the words already written are kept.`)} out={out} />}
        preview={preview}
        assist={assist}
      />
      <BlockAsk anchor={block ? blockAsk : null} title={block ? `${BLOCK_LABEL[block.kind]} · block ${bi + 1}` : ""} onClose={() => setBlockAsk(null)}
        onRun={(ask) => (block ? edit(ask || "Write it again from the e-mail: clearer, more concrete, the same facts and links.", { block: block.id, label: ask ? "As asked" : "Written again" }) : Promise.resolve("Pick a block first."))}
        onUndo={() => { const c = (docRef.current.changes ?? [])[0]; if (c) void undo(c); }} />
      <Popover open={!!adder} anchorEl={adder?.el} onClose={() => setAdder(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { borderRadius: "8px" } } }}>
        <Gallery onPick={(k, layout) => { if (adder) insert(adder.at, k, layout); setAdder(null); }} />
      </Popover>
      <Popover open={!!layouts} anchorEl={layouts} onClose={() => setLayouts(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 360, borderRadius: "8px" } } }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 1 }}>A layout - the words written stay</Typography>
        <Layouts current={d.layout} onPick={(k) => { setLayouts(null); void apply(applyTemplate(docRef.current, k), `Layout: ${TEMPLATES.find((t) => t.key === k)?.name ?? k}.`); }} />
      </Popover>
      <OurEmails api={api} open={ours} onClose={() => setOurs(false)} language={d.language}
        onStart={(r) => {
          if (!isBlank(docRef.current) && !window.confirm(`Start from “${r.subject}”? Its stories, pictures and buttons replace this newsletter's - Undo brings them back.`)) return;
          const own = tabRef.current === mainLanguage(wholeRef.current);
          void apply({ ...docRef.current, subject: r.subject, preheader: r.preheader, language: own && langs.length === 1 ? r.language || docRef.current.language : docRef.current.language, blocks: r.blocks as NewsletterDoc["blocks"], startedFrom: r.startedFrom, layout: undefined },
            `Started from our e-mail “${r.subject}” - its stories, pictures and buttons.`).then(() => {
            // its look is the whole newsletter's: every language's draft copies it
            if (!own) api.setDoc((cur: unknown) => ({ ...asNewsletter(cur), startedFrom: r.startedFrom }));
          });
          setSel(null);
        }}
        onLearn={(l, picked) => { setLearned(l); api.setDoc((cur: unknown) => ({ ...asNewsletter(cur), learnFrom: picked })); }} />
    </>
  );
}
