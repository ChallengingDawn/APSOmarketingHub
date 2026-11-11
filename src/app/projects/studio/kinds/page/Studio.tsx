"use client";
// THE PAGE STUDIO (SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should
// also contain A/B testing possibility, live preview of the pages, editing page, select a page to modify"; then, the
// same day: "it should be a real AI-assisted CMS").
//
// Build on the left - the page's parts as one short outline, a click opens one part (./Build.tsx, ./Outline.tsx), the
// last step (Magento, or Publish for a test's winner) pinned at its foot; the page itself in the middle - in the
// language chosen, as the shop will show it, every element selectable and its words editable in place - and the
// assistant on the right, for the whole page or the element selected, every change it makes listed with an Undo. A page
// is published by STORE VIEW (SARCLA 09.11.2026: "the locales are not all complete in Magento - we select by store
// view"): each store view is its own version - a copy of a store view of the same language (no AI), or a translation -
// then changed as it needs. `lang` below is the store view shown ("fr-CH"), the key of its version.
//
// When the AI writes, the parts it writes shimmer in the outline and in the page from the moment of the click; once it
// wrote, the pictures it had an idea for are made, a few side by side, each landing in its slot (SARCLA: "AI wrote the
// whole page ... It's not generating photos").
//
// Content v5 (SARCLA 09.11.2026): a new page is its blocks in an order - each its own row in the map, numbered as on the
// page, a block with items opening into them; a "+" in the map or between two blocks of the page adds one there; a
// picture selected is fine-tuned by the assistant (the same picture, one thing changed); "What does it say? (in
// English)" reads a part in English without changing it; and the page writes itself only when the project came with an
// app's brief - otherwise the start card asks what page is wanted. Content v9 (SARCLA 10.11.2026: "new page should be
// empty and then we start to build, only not when they come from ideas"): it writes itself only when its to-do came from
// an idea (any source) and nothing is on it - lib/content/studio/kinds/page/appBrief.ts.
//
// Content v8 (SARCLA 10.11.2026, points 1-4: "the text editor should come as a popup when clicking the text itself", "on
// the left side leave only the blocks", "consider pages' blocks as existing blocks and allow block settings", "a module
// should be counted as a block"): the Build pane is the page's blocks, one row each - a new page's own and its modules, a
// page of the shop's own and what the hub put on it (./BlockList.tsx, lib .../blocklist.ts). Editing happens ON the page:
// a click on a text opens its editor under it, on a picture the picture's, and a block's settings open beside the block -
// from the bar over it or its row's settings (./pops.tsx). The selection is one: a row clicked selects its block in the
// page, a click in the page selects its row.

import { relinkModule } from "@/lib/content/studio/kinds/page/links";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIMIT, addBlock, addItem, asWritten, blockOrder, emptyFields, fieldKind, fieldLabel, filledCount, getField, heroBack, moveItem, onlyOnPage, setField, setLook, type Fields, type ListKey, type Look, type NewBlock, type Pic,
} from "@/lib/content/studio/kinds/page/fields";
import {
  duplicateRow, isModuleKey, moduleKeyOf, moduleWordsEdit, takeOutField, moveRow, moveRowBy, newPageRows, removeRow, rowOfSelection, selectionOfRow, shopRowOf, shopRows,
  type BlockRow, type FoundBlock,
} from "@/lib/content/studio/kinds/page/blocklist";
import { limitOf } from "@/lib/content/studio/kinds/page/fit";
import { appBriefOf, pageHasContent, startLine, writesItself, type StartState } from "@/lib/content/studio/kinds/page/appBrief";
import { PART_LABEL, mergeField, mergeFill, type Candidate, type FillAnswer, type Part } from "@/lib/content/studio/kinds/page/fill";
import {
  MAIN_SELECTOR, addVersion, baseStore, carryMeta, changeId, copyView, dropVersion, pathIn, emptyPage, howToAdd, isLegacyBody, langName, langOfStore, leadOf, mainView, nextPageLetter, openVersion, pageDoc, shopLanguages, shopViews, sourceHash, storeForLanguage, tickStore, versionOfStore,
  storesOfView, viewOf, viewsOf, withChange, withView, type LangOption, type LangVersion, type Leftover, type PageChange, type PageDoc,
} from "@/lib/content/studio/kinds/page/model";
import { lookLine, problemsLine } from "@/lib/content/studio/kinds/page/readable";
import { PICTURE_ASPECT, blockOfPath, blocksOf, busyBlocks, busyOf, previewOf, picturesToMake, type PictureJob } from "@/lib/content/studio/kinds/page/outline";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import type { Change } from "@/lib/convert/versions";
import { PINK, StudioPanes, btn, type QuickAsk } from "../../parts";
import { useTimeline } from "../../frame";
import { MakeViewsProvider, useMakeViews } from "./MakeViews";
import { PICTURE_TUNES, PictureDialog, makePicture, refinePicture, uploadPicture, type Picture } from "../../pictures";
import type { StudioProps } from "../../registry";
import { AddBlockMenu, type AddAt } from "./AddBlock";
import { AddElementMenu } from "./AddElement";
import { Assistant, type Entry, type Idea, type Said, type SeoCard } from "./Assistant";
import { Build, type AppBrief, type Step } from "./Build";
import { BlockList, type RowAct } from "./BlockList";
import { applyElementEdit, lookCss, lookOf as elementLook, type ElementEdit } from "./edits";
import { InsertPanel, type Selection } from "./Element";
import { AddPartMenu, AskPop, BlockSettingsPop, ButtonPop, CardPop, EditBar, PartPop, PicturePop, PopCard, ShopBlockPop, TextPop, cleanRich, type AiWords, type BlockAiAnswer, type ItemOrder } from "./pops";
import { addOptions, addPart, addPicture, cardOfProduct, duplicatePart, itemOfLink, lookKind, movePart, partInfo, partLook, partOrder, takeOutPart, withCard, withPartLook, withPartPicture, withPartUrl, withPartWords, type AddKey } from "@/lib/content/studio/kinds/page/modules/elements";
import { DATE_KEYS, DATE_PANEL_KEY, GROUNDS } from "@/lib/content/studio/kinds/page/modules/looks";
import { groundsOfModule } from "@/lib/content/studio/kinds/page/modules/looks";
import { fieldOf as specOf, moduleDef as libDef } from "@/lib/content/studio/kinds/page/modules/registry";
import type { Card, ModuleRef } from "@/lib/content/studio/kinds/page/modules/model";
import { findPart, partIn } from "./parts";
import { Choice } from "./ui";
import { useModuleAi } from "./modules/useModuleAi";
import { SwitchList } from "./Switch";
import { useEdit } from "./useEdit";
import { buttonLookOfField, cleanButtonLook, cleanTextLook, fieldButtonPatchOf, groundOfField, groundsOfLook, packLook, unpackLook } from "@/lib/content/studio/kinds/page/style";
import { fillOfBlock, type FillRun, type Making, type PictureCtl } from "./Fields";
import type { AddPlace, PartHit, Picked } from "./Frame";
import { checkChange } from "./guard";
import { PagePicker, type Picked as PickedPage } from "./PagePicker";
import { setDocSafely } from "./safeSet";
import { LangEmpty, Stage, usePagePreview, useShell, type View } from "./Stage";
import type { SeoProposal } from "./Seo";
import { VersionStrip } from "./Versions";
import { ModulesTab } from "./modules/ModulesTab";
import { SideTabs } from "./modules/SideTabs";
import { ModulePanel } from "./modules/Panel";
import { WROTE, WriteAgain, type WriteMode } from "./WriteAgain";
import { moduleChangeOf, modulePending, useModules, type Place } from "./modules/useModules";
import { MODULES } from "@/lib/content/studio/kinds/page/modules/registry";
import { kindOf, moduleGap, moduleOfChange } from "@/lib/content/studio/kinds/page/modules/model";
import { itemsAs, productNumbersOf } from "@/lib/content/studio/kinds/page/modules/translate";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { looksEnglish } from "@/lib/content/studio/kinds/page/plan/plan";
import { PlanCard } from "./plan/PlanCard";
import { servedOf, usePlan } from "./plan/usePlan";
import { AbLastStep } from "./Sections";
import { useAbBar } from "../../abBar";
import { abApplies, abLineOf, abStateOf, activateAb, type AbRunning } from "@/lib/content/studio/kinds/page/abState";
import { fullOnly, type NewPageModule } from "@/lib/content/studio/kinds/page/plan/newpage";
import { useNewPageModules } from "./plan/useNewPageModules";
import { isNewest, startJob, type SlotJobs } from "@/lib/content/studio/kinds/page/pictureJobs";

type Rewrite = { summary: string; changes: Change[]; problems: string[]; leftovers: string[] };
/** The AI's block (./block.ts): the change, what it could not put right itself, what it put right */
type BlockOut = { summary: string; change: PageChange | null; problems: string[]; fixed: string[]; leftovers: string[] };

/** A change kept back while the check looks at it - said so if the studio closes before it is done. */
const CHECKING = "Not checked yet - the check did not finish. Show it anyway, or ask again.";
const WRONG = "Looks wrong - not applied";
/** The note SARCLA reads under an AI change: one short English line - the AI's summary when it is that, else its short note. */
const shortNote = (summary: string, note: string | undefined): string | undefined => {
  const one = (t: string | undefined) => { const x = (t ?? "").split(/\r?\n/)[0].replace(/\s+/g, " ").trim(); return x && x.length <= 110 && looksEnglish(x) ? x : ""; };
  return one(summary.split(/(?<=[.!?])\s/)[0]) || one(note) || undefined;
};
type Translated = { fields?: PageDoc["fields"]; changes?: Change[]; from: string; missing: number; leftovers: string[]; problems: string[] };

let entryId = 0;

/** A popup open at the selection (Content v8): a text's editor, a picture's, or a block's settings (its row's key); Content
 * v10: the modules a block can become ("switch", its row's key). */
type Pop = { kind: "text" | "picture" | "settings" | "switch" | "ask" | "part"; key: string; part?: { mod: string; field: string } };

/** A module's settings and the modules a block can become: as wide as a module of products' (Content v10, v11). */
const MODULE_POP_WIDTH = 620;

/** Pictures made side by side, at most. */
const AT_ONCE = 3;

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => pageDoc(api.doc, api.data.piece.language), [api.doc, api.data.piece.language]);
  const docRef = useRef(doc);
  docRef.current = doc;
  const canEdit = api.data.access.canEdit;
  const canAi = api.data.ai && canEdit;
  // the page's own store view, and the one shown (a version's key: "de-CH", "fr-CH")
  const main = mainView(doc);
  const [lang, setLangState] = useState(main);
  const langRef = useRef(lang);
  langRef.current = lang;
  const d = useMemo(() => viewOf(doc, lang), [doc, lang]);
  const isNew = d.source === "new";

  const [step, setStep] = useState<Step>("page");
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSelState] = useState<Selection | null>(null);
  const [editNonce, setEditNonce] = useState(0);
  const [reveal, setReveal] = useState(0);
  const [view, setViewMode] = useState<View>("after");
  const [picking, setPicking] = useState(false);
  const [busy, setBusyState] = useState<string | null>(null);
  const [since, setSince] = useState<number | null>(null);
  // the language the AI is working in: the other languages never shimmer (SARCLA's night list, 09.11.2026)
  const [busyLang, setBusyLang] = useState<string | null>(null);
  const setBusy = (b: string | null, l: string = langRef.current) => { setBusyState(b); setSince(b ? Date.now() : null); setBusyLang(b ? l : null); };
  const [history, setHistory] = useState<Entry[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [seo, setSeo] = useState<SeoCard | null>(null);
  const [finding, setFinding] = useState(false);
  // the side columns folded away for a bigger page (SARCLA: the page "should be visible") - kept for next time
  const [fold, setFold] = useState<{ build: boolean; assist: boolean }>({ build: false, assist: false });
  useEffect(() => { try { const f = JSON.parse(window.localStorage.getItem("page-studio:fold") ?? "null"); if (f) setFold({ build: !!f.build, assist: !!f.assist }); } catch { /* no storage */ } }, []);
  const toggleFold = (k: "build" | "assist") => setFold((f) => { const n = { ...f, [k]: !f[k] }; try { window.localStorage.setItem("page-studio:fold", JSON.stringify(n)); } catch { /* no storage */ } return n; });
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  // Content v8: a page of the shop's blocks as the frame finds them (the Build list), a row to find in the page, and the
  // popup open at the selection (a text's or a picture's editor, a block's settings)
  const [found, setFound] = useState<FoundBlock[]>([]);
  const [seekRow, setSeekRow] = useState<{ nonce: number; key: string } | null>(null);
  const [pop, setPopState] = useState<Pop | null>(null);
  /** what to open once a row's block is selected in the page (its settings) */
  const nextPop = useRef<Pop | null>(null);
  // Content v6: what the AI is doing now, in words over the page ("Checking that it reads well…"); "Show the old one";
  // the "+" between a shop page's elements
  const [workNote, setWorkNote] = useState<string | null>(null);
  const [oldShown, setOldShown] = useState<number[]>([]);
  const [addPlace, setAddPlace] = useState<AddPlace | null>(null);
  // Content v11: the whole page written again - the stage shows it from its top
  const [toTop, setToTop] = useState(0);
  const preview = usePagePreview(api, d, lang, view);
  const { shell, inserts } = useShell(api, d, preview.fresh);
  /** the page's blocks, one row each (Content v8) */
  // a page of the shop: once its frame has read its blocks (until then the list says it is reading them)
  const rows = useMemo(() => (isNew ? newPageRows(d.fields) : d.path && found.length ? shopRows(found, d.changes) : []), [isNew, d.fields, d.path, found, d.changes]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /* ── the page's versions A / B / C (Content v6, SARCLA 09.11.2026: "another version of the same") ── */

  /** another version opened: the open one's list kept under its letter, the other's laid in its place (not an edit) */
  const openLetter = async (letter: string) => {
    const cur = docRef.current;
    const v = viewOf(cur, langRef.current);
    if ((v.letter || "A") === letter) return;
    setSelState(null); setPopState(null); setFound([]);
    await setDocSafely(api, cur, withView(cur, langRef.current, openVersion(v, letter)));
  };
  /** "+ Another version": a copy of the open one under the next letter, opened to change on its own */
  const addLetter = async () => {
    const cur = docRef.current;
    const v = viewOf(cur, langRef.current);
    const next = nextPageLetter(v);
    if (!next) return;
    record(`Made version ${next} from ${v.letter || "A"}`, cur);
    setSelState(null); setPopState(null); setFound([]);
    await setDocSafely(api, cur, withView(cur, langRef.current, addVersion(v)));
  };
  const dropLetter = async (letter: string) => {
    if (!window.confirm(`Remove version ${letter}? Its changes stay in the version history.`)) return;
    const cur = docRef.current;
    record(`Removed version ${letter}`, cur);
    setSelState(null); setPopState(null); setFound([]);
    await setDocSafely(api, cur, withView(cur, langRef.current, dropVersion(viewOf(cur, langRef.current), letter)));
  };
  // a page taken over from AI testing & personalization before its letter was kept: read it once ("version B")
  const letterAsked = useRef(false);
  useEffect(() => {
    if (letterAsked.current || !canEdit || doc.source !== "convert" || !doc.origin?.versionId || doc.origin.letter) return;
    letterAsked.current = true;
    void api.act("convert_letter").then((r) => { if (r.ok) void api.reload(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, doc.source, doc.origin?.versionId, doc.origin?.letter]);

  /* ── the shop's languages: every store view it has ───────────────────── */

  const [stores, setStores] = useState<string[]>([]);
  useEffect(() => {
    void api.act<{ stores: { store: string }[] }>("stores").then((r) => { if (r.ok) setStores(r.result.stores.map((s) => s.store)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const offered: LangOption[] = useMemo(() => shopLanguages(stores, doc.store), [stores, doc.store]);
  const offeredRef = useRef(offered);
  offeredRef.current = offered;
  /** every store view of the shop, by language */
  const groups = useMemo(() => shopViews(stores, doc.store), [stores, doc.store]);
  /** a store view as asked (a store view, or a language: its store view for this page) */
  const storeFor = (l: string) => baseStore(l) ?? offeredRef.current.find((o) => o.lang === l)?.store ?? storeForLanguage(l, docRef.current.store, stores);

  // the main store view follows the page (a page picked in fr-CH makes fr-CH the main one)
  const mainWas = useRef(main);
  useEffect(() => { if (mainWas.current !== main) { mainWas.current = main; setLangState(main); } }, [main]);

  // a page of the shop: in which store views it is on the shop (the page index) - "+ Store view" says so
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  useEffect(() => {
    if (doc.source === "new" || !doc.path) { setPresence({}); return; }
    let gone = false;
    void api.act<{ presence: Record<string, Presence> }>("views").then((r) => { if (!gone && r.ok) setPresence(r.result.presence); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.source, doc.path, doc.env]);

  // the first open: the brief kept for the AI; a landing page starts as a new page; a page from AI testing taken over
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !canEdit || doc.started) return;
    started.current = true;
    void api.act<{ imported: { path: string } | null }>("start").then(async (r) => { if (r.ok) await api.reload(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, doc.started]);

  /* ── the document, a language at a time, with a record of what changed ── */

  // every line of "Changes made here" by its number, so an ask can take back exactly what it did (Content v11)
  const entries = useRef(new Map<number, Entry>());
  const record = (label: string, before: PageDoc = docRef.current, by: "ai" | "you" = "you", note?: string, change?: string) => {
    const e: Entry = { id: ++entryId, label, note, at: Date.now(), lang: langRef.current, before, undone: false, by, ...(change ? { change } : {}) };
    entries.current.set(e.id, e);
    setHistory((h) => [e, ...h].slice(0, 40));
  };
  const setDoc = (next: PageDoc, label?: string) => { if (label) record(label); api.setDoc(next); };
  const setView = (next: PageDoc, label?: string) => { if (label) record(label); api.setDoc(withView(docRef.current, langRef.current, next)); };
  /** an AI answer laid over the document as it is NOW (the person may have typed while it wrote) */
  const applyView = async (make: (cur: PageDoc) => PageDoc, label: string, note?: string, forLang = langRef.current, change?: string) => {
    const cur = docRef.current;
    const next = withView(cur, forLang, make(viewOf(cur, forLang)));
    record(label, cur, "ai", note, change);
    await setDocSafely(api, cur, next);
  };
  // the module gallery (Content v6, SARCLA 09.11.2026 points 7-9): a module is a change of the store view shown, its panel
  // takes the Build pane while it is edited (./modules/*)
  // Content v7 (SARCLA 10.11.2026 points 3, 6): the library is the right side bar's Modules tab; a module added shows in the
  // page at once (its skeleton while it fills - modulePending below)
  const modules = useModules({ view: () => viewOf(docRef.current, langRef.current), put: (next, label) => setView(next, label), store: lang, canEdit, unfold: () => { if (fold.assist) toggleFold("assist"); } });
  const undo = async (e: Entry) => {
    const cur = docRef.current;
    await setDocSafely(api, cur, e.before);
    setHistory((h) => h.map((x) => (x.at >= e.at ? { ...x, undone: true } : x)));
    setSelState(null);
  };
  /** what was done since a line of "Changes made here" (its number) taken back - an ask's Undo */
  const undoSince = (mark: number) => {
    const first = [...entries.current.values()].filter((e) => e.id > mark).sort((a, b) => a.id - b.id)[0];
    if (first) void undo(first);
  };
  // "Fill it with AI" for one module (Content v11, SARCLA 10.11.2026: "I can't see launch the AI to fill me the block"):
  // its settings' button, "Ask AI" on it, and the pass after "Write it all again" - ./modules/useModuleAi.ts
  const moduleAi = useModuleAi({ api, lang: () => langRef.current, record: (label, before, note) => record(label, before, "ai", note), busy: (k, t) => modules.setBusy(k, t) });
  // Content v10 (SARCLA 10.11.2026 points 2-5): a text's and a button's look, a block changed into another module, a drag in
  // the preview resizing inside a block (./useEdit.tsx)
  const tools = useEdit({
    api, isNew, canEdit, rows, view: () => viewOf(docRef.current, langRef.current), setView,
    undoLabel: (label) => { const e = history.find((x) => x.label === label && !x.undone); if (e) void undo(e); },
    editModule: (k) => modules.edit(k),
  });
  // the bar over a module just switched (its Undo) goes once its popup is closed
  useEffect(() => { if (!pop) tools.clearSwitched(); }, [!!pop]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Changes made here" lives in the bar's timeline (Content v7, SARCLA 10.11.2026: "a small icon on top") - ../../frame.tsx
  useTimeline(history.map((e) => ({
    id: e.id, label: e.label, note: e.note, warn: e.warn, at: e.at, by: e.by, where: e.lang, undone: e.undone,
    undo: canEdit ? { tip: "Put the page back as it was before this (and every later change)", run: () => void undo(e) } : null,
  })));
  // several store views made in one go (Content v7, SARCLA 10.11.2026: "multiselect store view") - "+ Store view" and the
  // assistant's translate row tick them, this makes them one at a time (./MakeViews.tsx)
  const makeViews = useMakeViews({ api, language: api.data.piece.language, canEdit, canAi, presence: () => presenceRef.current, record: (label, before) => record(label, before), translate: (k) => translate(k) });

  /* ── what is selected: the outline and the page say the same ─────────── */

  const setLang = (l: string) => { modules.edit(null); setLangState(l); setSelState(null); setPopState(null); setFound([]); setPicking(false); setStep("page"); };
  /** A store view opened - from the tabs, "+ Store view" or the left. One the page does not have yet, of a language it has,
   * is made at once as a COPY of that store view's words (no AI): its own version from then on. Another language waits
   * in the middle for its translation. */
  const openView = (key: string) => {
    const cur = docRef.current;
    const k = baseStore(key) ?? storeFor(key);
    if (k === mainView(cur) || viewsOf(cur).includes(k)) { setLang(k); return; }
    // Content v10 (SARCLA point 6: one page per language): a store view a language's page goes to opens that page; one of
    // a language the page has, not ticked yet, is ticked for it (no copy, no AI) and opens it
    const has = versionOfStore(cur, k);
    if (has) { setLang(has); return; }
    const lead = leadOf(cur, langOfStore(k));
    if (lead && canEdit) { record(`Ticked ${k} for the ${langName(k)} page`, cur); api.setDoc(tickStore(cur, k, true)); setLang(lead); return; }
    if (lead || !canEdit) { setLang(lead ?? k); return; }
    const add = howToAdd(cur, k);
    const there = presenceRef.current[k];
    // a page of the shop is copied onto its own page in that store view - when the shop has it there
    if (add.how === "copy" && (cur.source === "new" || there?.path)) {
      record(`Copied ${add.from} into ${k}`, cur);
      api.setDoc(copyView(cur, k, add.from, cur.source === "new" ? "" : there?.path ?? ""));
    }
    setLang(k);
  };
  /** The store view shown made again as a copy of the one it was copied from (its own changes dropped). */
  const copyAgain = (k: string) => {
    const cur = docRef.current;
    const from = cur.langs[k]?.source || howToAdd(cur, k).from;
    record(`Copied ${from} into ${k} again`, cur);
    api.setDoc(copyView(cur, k, from, cur.source === "new" ? "" : cur.langs[k]?.path || presenceRef.current[k]?.path || ""));
    return Promise.resolve(null);
  };
  /* ── one selection: the Build list's row and the page say the same (Content v8) ── */

  /** a module's settings are its panel: the library's hook knows which one is open ("np:<id>", or its change's id) */
  const moduleEditKey = (rowKey: string): string | null => {
    const r = rowsRef.current.find((x) => x.key === rowKey);
    if (!r?.module) return isModuleKey(rowKey) ? rowKey : null;
    return isModuleKey(rowKey) ? rowKey : r.changeId ?? null;
  };
  /** a popup opened (or closed): a module's settings tell the library's hook which module is edited */
  const openPop = (p: Pop | null) => {
    const mod = p?.kind === "settings" ? moduleEditKey(p.key) : null;
    editingWas.current = mod;
    if (mod !== modules.editing) modules.edit(mod);
    setPopState(p);
  };
  const editingWas = useRef<string | null>(null);
  // a module put on the page from the library (its hook opens it): its settings beside it in the page, the module selected
  useEffect(() => {
    const ed = modules.editing;
    if (ed === editingWas.current) return;
    editingWas.current = ed;
    if (!ed) { setPopState((p) => (p?.kind === "settings" ? null : p)); return; }
    const key = isModuleKey(ed) ? ed : `c:${ed}`;
    setPopState({ kind: "settings", key });
    if (isModuleKey(ed)) { setSelState({ key: ed, picked: null }); setReveal((n) => n + 1); return; }
    const r = rowsRef.current.find((x) => x.key === key);
    if (r) seekShop(r, { kind: "settings", key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules.editing]);

  const setSel = (s: Selection | null) => { setSelState(s); if (!s) openPop(null); };

  /** what a click on an element opens: a text's editor, a picture's, a module's settings - a block itself: its bar only */
  const popFor = (p: Picked): Pop | null => {
    const k = p.key;
    // Content v13 (SARCLA 11.11.2026: "allow editing per element"): an element of a module - its own popup; the module's
    // own ground - the block's
    if (p.part) return p.part.part ? { kind: "part", key: k, part: { mod: p.part.mod, field: p.part.part } } : { kind: "settings", key: p.part.mod };
    if (k.startsWith("f:")) {
      const path = k.slice(2);
      if (path.startsWith("seo.")) return null;
      const kind = fieldKind(path);
      if (kind === "picture") return { kind: "picture", key: k };
      return kind === "block" || kind === "item" ? null : { kind: "text", key: k };
    }
    // a module's words: their setting's popup - words that are none of its settings (a product's name, the shop's) open its
    // settings, where its products are chosen, never a box that cannot keep them (Content v12)
    if (k.startsWith("nt:")) return p.editable && tools.moduleField(p) ? { kind: "text", key: k } : { kind: "settings", key: moduleKeyOf(k.split(":")[1]) };
    if (k.startsWith("np:")) return { kind: "settings", key: k };
    if (k.startsWith("i:")) return { kind: "settings", key: k };
    if (k.startsWith("e:")) {
      const c = p.frag ? viewOf(docRef.current, langRef.current).changes[p.frag.change] : undefined;
      const mod = c?.id && moduleOfChange(c) ? `c:${c.id}` : null;
      // a module's picture comes from its products or its settings: those open
      if (p.tag === "img" && p.src) return mod ? { kind: "settings", key: mod } : { kind: "picture", key: k };
      if (p.editable && mod && !tools.moduleField(p)) return { kind: "settings", key: mod };
      if (p.editable) return { kind: "text", key: k };
      // the module itself (not one of its texts): its settings
      if (mod) return { kind: "settings", key: mod };
    }
    return null;
  };

  /** a click in the page: the element selected - its row lit in the list - and its editor opened at it */
  const onPick = (p: Picked | null) => {
    const want = nextPop.current;
    nextPop.current = null;
    if (!p) { setSel(null); return; }
    setSelState({ key: p.key, picked: p });
    setStep("page");
    openPop(want ?? popFor(p));
  };

  /** a page of the shop: a row's block found in the page and selected (then `then` opens) - one not on the page opens
   * its settings at the page's top */
  const seekShop = (r: BlockRow, then: Pop | null = null) => {
    const i = r.change ?? -1;
    const key = r.kind === "page" && r.selector ? `p:${r.selector}`
      : i >= 0 && found.some((b) => b.change === i) ? `c:${i}`
        : r.changeId && found.some((b) => b.changeId === r.changeId) ? `mod:${r.changeId}` : null;
    if (!key) { setSelState(null); openPop(then); return; }
    nextPop.current = then;
    setSeekRow((s) => ({ nonce: (s?.nonce ?? 0) + 1, key }));
  };
  /** a row of the list clicked: its block selected in the page, which scrolls to it (and `then` opens) */
  const selectRow = (r: BlockRow, then: Pop | null = null) => {
    setStep("page");
    if (isNew) {
      setSelState({ key: selectionOfRow(r.key), picked: null });
      setReveal((n) => n + 1);
      openPop(then);
      return;
    }
    seekShop(r, then);
  };
  const openSettings = (r: BlockRow) => selectRow(r, { kind: "settings", key: r.key });
  /** a field of a new page selected and its editor opened (a tile just added, a picture from its block's settings) */
  const selectField = (path: string, kind: "text" | "picture" = "text") => {
    setSelState({ key: `f:${path}`, picked: null });
    setStep("page");
    setReveal((n) => n + 1);
    openPop({ kind, key: `f:${path}` });
  };
  /** a block of a new page selected (a block just added) */
  const onOpenBlock = (block: string | null) => {
    const pv = block ? previewOf(block) : null;
    if (block && pv) { setSelState({ key: `b:${pv}`, picked: null }); setReveal((n) => n + 1); }
    else setSelState(null);
    openPop(null);
  };
  const askAi = () => { if (fold.assist) toggleFold("assist"); setTimeout(() => askRef.current?.focus(), 60); };

  /* ── an element's words edited in the page ───────────────────────────── */

  const onEdit = (p: Picked, v: { text: string; inner: string; outer: string }) => {
    const cur = viewOf(docRef.current, langRef.current);
    if (p.path) { setView({ ...cur, fields: setField(cur.fields, p.path, v.text) }, `Edited ${fieldLabel(cur.fields, p.path).toLowerCase()}`); return; }
    const rich = /<(?!br\b)[a-z]/i.test(v.inner) && /<[a-z]/i.test(p.inner);
    const err = putWords(p, v.text, rich ? v.inner : undefined);
    if (err) window.alert(err);
  };

  /**
   * An element's words put on the page (a double-click in place, or the text popup's Done) - Content v8: a module's text
   * goes back into its settings (it is drawn from them), a new page's module's too; any other element of a page of the
   * shop becomes (or updates) its change. Returns what went wrong, or null.
   */
  const putWords = (p: Picked, text: string, html?: string): string | null => {
    const cur = viewOf(docRef.current, langRef.current);
    if (p.key.startsWith("nt:")) {
      const id = p.key.split(":")[1];
      const pm = (cur.fields.modules ?? []).find((m) => m.id === id);
      if (!pm) return "That module is not on the page any more.";
      const r = moduleWordsEdit(pm.module, p.text, text, p.href ?? null);
      if (!r) return "These words come from the shop (a product's or a category's name) - the module's settings choose its products.";
      setView({ ...cur, fields: { ...cur.fields, modules: (cur.fields.modules ?? []).map((m) => (m.id === id ? { ...m, module: r.module } : m)) } }, `Changed the ${kindOf(pm.module.type).name.toLowerCase()}'s words`);
      return null;
    }
    const mc = p.frag ? cur.changes[p.frag.change] : undefined;
    const mod = mc ? moduleOfChange(mc) : null;
    if (mc && mod) {
      const r = moduleWordsEdit(mod, p.text, text, p.href ?? null);
      if (!r) return "These words come from the shop (a product's or a category's name) - the module's settings choose its products.";
      setView({ ...cur, changes: cur.changes.map((c) => (c === mc ? moduleChangeOf(c, r.module) : c)) }, `Changed the ${kindOf(mod.type).name.toLowerCase()}'s words`);
      return null;
    }
    const r = applyElementEdit(cur, p, { kind: "words", text, inner: html });
    if ("error" in r) return r.error;
    setView({ ...cur, changes: r.changes }, r.label);
    // the bar and the popup show the element's new words at once
    setSelState((s) => (s && s.key === p.key && s.picked ? { ...s, picked: { ...s.picked, text, inner: html ?? s.picked.inner } } : s));
    return null;
  };

  /** a new page's field typed in its popup: drawn at once; one line in "Changes made here" for the popup's whole edit */
  const editedIn = useRef<string | null>(null);
  const setFieldText = (path: string, value: string) => {
    const cur = viewOf(docRef.current, langRef.current);
    if (getField(cur.fields, path) === value) return;
    const first = editedIn.current !== path;
    editedIn.current = path;
    setView({ ...cur, fields: setField(cur.fields, path, value) }, first ? `Edited ${fieldLabel(cur.fields, path).toLowerCase()}` : undefined);
  };
  useEffect(() => { editedIn.current = null; }, [pop?.key]);

  /* ── pictures: made from the AI's idea, each in its slot ─────────────── */

  const [making, setMaking] = useState<Record<string, Making>>({});
  /** each slot's asks, numbered - the newest one's picture is the one put in (./pictureJobs.ts) */
  const slotJobs = useRef<SlotJobs>({});
  const makingRef = useRef(making);
  makingRef.current = making;
  const [imagesOn, setImagesOn] = useState<boolean | null>(null);
  useEffect(() => {
    void fetch(`/api/content/assets?scope=project&project=${api.data.piece.projectId}`).then((r) => r.json()).then((j: { ok?: boolean; images?: boolean }) => setImagesOn(j.ok ? j.images !== false : null)).catch(() => setImagesOn(null));
  }, [api.data.piece.projectId]);
  const slotKey = (l: string, path: string) => `${l}|${path}`;
  // a picture still being made is lost when the page closes (it stays in the project's pictures): say so before
  const anyMaking = Object.values(making).some((m) => m.state === "making");
  useEffect(() => {
    if (!anyMaking) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyMaking]);

  /** One picture made and put in its slot - unless the person put one there meanwhile (`again`: "Make another" replaces
   * the one there), or the slot is gone. */
  const makeOne = async (forLang: string, job: PictureJob, again = false) => {
    const key = slotKey(forLang, job.path);
    // Content v13 (SARCLA 11.11.2026: "make another on photo don't take into account new prompt"): each ask numbered, the
    // newest one's picture lands - an older ask's still arrives in the project's pictures, never in the slot
    const n = startJob(slotJobs.current, key);
    setMaking((m) => ({ ...m, [key]: { state: "making", idea: job.idea } }));
    const r = await makePicture(job.idea, job.aspect, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id });
    if (!isNewest(slotJobs.current, key, n)) return false;
    if (!r.ok) { setMaking((m) => ({ ...m, [key]: { state: "error", error: r.error } })); return false; }
    api.setDoc((raw: unknown) => {
      const cur = pageDoc(raw, api.data.piece.language);
      const v = viewOf(cur, forLang);
      const pic = getField(v.fields, job.path) as Pic | undefined;
      if (!pic || (pic.url && !again)) return raw;
      const whose = job.path === "hero.picture" ? "the hero's picture" : `the picture of ${fieldLabel(v.fields, job.path).replace(/ · picture$/, "").toLowerCase()}`;
      record(`AI made ${whose}`, cur, "ai", job.idea.length > 110 ? `${job.idea.slice(0, 108)}…` : job.idea);
      return withView(cur, forLang, { ...v, fields: setField(v.fields, job.path, { ...pic, url: r.picture.url, alt: pic.alt || job.idea.slice(0, 120) }) });
    });
    setMaking((m) => { const n = { ...m }; delete n[key]; return n; });
    return true;
  };

  /** The pictures of what the AI just wrote, made a few side by side, each landing in its slot as it comes. */
  const autoPictures = async (forLang: string, run: string, id?: string | null) => {
    const v = viewOf(docRef.current, forLang);
    const jobs = picturesToMake(v.fields, run, id).filter((j) => makingRef.current[slotKey(forLang, j.path)]?.state !== "making");
    if (!jobs.length) return;
    if (imagesOn === false) {
      setMaking((m) => ({ ...m, ...Object.fromEntries(jobs.map((j) => [slotKey(forLang, j.path), { state: "error", error: "Pictures cannot be made on this hub - its image model is not set up. Upload one instead." } as Making])) }));
      return;
    }
    setMaking((m) => ({ ...m, ...Object.fromEntries(jobs.map((j) => [slotKey(forLang, j.path), { state: "making" } as Making])) }));
    let next = 0;
    const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; await makeOne(forLang, j); } };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, jobs.length) }, worker));
  };

  const pictures: PictureCtl = {
    making: (path) => making[slotKey(lang, path)] ?? null,
    make: (path, idea) => { void makeOne(langRef.current, { path, idea, aspect: "3:2" }, true); },
    imagesOn, gallery: null,
  };

  /* ── a picture slot in the page: Make it / Make another · Upload · Gallery · Remove (the flow standard) ── */

  const upInput = useRef<HTMLInputElement | null>(null);
  const upTo = useRef<{ path: string; lang: string; el?: Picked } | null>(null);
  const setPic = (forLang: string, path: string, next: Partial<Pic>, label: string) => {
    const cur = docRef.current;
    const v = viewOf(cur, forLang);
    const pic = getField(v.fields, path) as Pic | undefined;
    if (!pic) return;
    record(label, cur);
    api.setDoc(withView(cur, forLang, { ...v, fields: setField(v.fields, path, { ...pic, ...next }) }));
  };
  const askUpload = (path: string) => { upTo.current = { path, lang: langRef.current }; upInput.current?.click(); };
  const onUploadFile = async (f: File | undefined) => {
    const to = upTo.current;
    if (!f || !to) return;
    const r = await uploadPicture(f, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id });
    if (!r.ok) { window.alert(r.error); return; }
    // a picture of a page of the shop: another picture there (a change of its address)
    if (to.el) { putPicture(to.el, r.picture); return; }
    const pic = getField(viewOf(docRef.current, to.lang).fields, to.path) as Pic | undefined;
    setPic(to.lang, to.path, { url: r.picture.url, alt: pic?.alt || f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) }, "Put a picture in");
  };

  /* ── a picture fine-tuned (SARCLA 09.11.2026: "Ask AI under a photo should give you the option to fine-tune the
   *    photo"): the same picture with one change - the image model is given the picture as it is. Its slot shows it
   *    being made, the new one takes its place, the old stays in the gallery and "Changes made here" has the Undo ── */
  const refine = async (path: string, ask: string): Promise<string | null> => {
    const forLang = langRef.current;
    const pic = getField(viewOf(docRef.current, forLang).fields, path) as Pic | undefined;
    if (!pic) return "That picture is gone.";
    if (!pic.url) return "There is no picture there yet - make one first, then fine-tune it.";
    if (imagesOn === false) return "Pictures cannot be made on this hub - its image model is not set up.";
    const key = slotKey(forLang, path);
    if (makingRef.current[key]?.state === "making") return "That picture is being made already.";
    setMaking((m) => ({ ...m, [key]: { state: "making", label: "Fine-tuning the picture…" } }));
    const r = await refinePicture(pic.url, ask, PICTURE_ASPECT, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id });
    if (!r.ok) { setMaking((m) => { const n = { ...m }; delete n[key]; return n; }); return r.error; }
    api.setDoc((raw: unknown) => {
      const cur = pageDoc(raw, api.data.piece.language);
      const v = viewOf(cur, forLang);
      const now = getField(v.fields, path) as Pic | undefined;
      // the person put another picture there meanwhile: theirs stays (the new one is in the gallery)
      if (!now || now.url !== pic.url) return raw;
      const whose = path === "hero.picture" ? "the hero's picture" : `the picture of ${fieldLabel(v.fields, path).replace(/ · picture$/, "").toLowerCase()}`;
      record(`AI fine-tuned ${whose}`, cur, "ai", ask.length > 110 ? `${ask.slice(0, 108)}…` : ask);
      return withView(cur, forLang, { ...v, fields: setField(v.fields, path, { ...now, url: r.picture.url }) });
    });
    setMaking((m) => { const n = { ...m }; delete n[key]; return n; });
    return null;
  };
  /** "Fine-tune" asked on a picture (its slot, the bar over it): it is selected, the assistant offers its asks */
  const askRefine = (path: string) => {
    selectField(path, "picture");
    askAi();
  };
  const onAct = (path: string, act: string) => {
    const pic = getField(viewOf(docRef.current, langRef.current).fields, path) as Pic | undefined;
    if (!pic || !canEdit) return;
    if (act === "make" && pic.idea.trim() && canAi) pictures.make(path, pic.idea);
    if (act === "upload") askUpload(path);
  };
  /** a picture of a page of the shop: another one in its place (its address), its alt text kept unless it had none */
  const putPicture = (p: Picked, pic: Picture) => {
    const cur = viewOf(docRef.current, langRef.current);
    const r = applyElementEdit(cur, p, { kind: "attr", name: "src", value: pic.url });
    if ("error" in r) { window.alert(r.error); return; }
    let changes = r.changes;
    if (!p.alt && (pic.alt || pic.prompt)) { const a = applyElementEdit({ ...cur, changes }, p, { kind: "attr", name: "alt", value: (pic.alt || pic.prompt || "").slice(0, 140) }); if (!("error" in a)) changes = a.changes; }
    setView({ ...cur, changes }, "Another picture");
    setSelState((s) => (s && s.key === p.key && s.picked ? { ...s, picked: { ...s.picked, src: pic.url } } : s));
  };
  /** one edit of a page of the shop's element (its link, hidden), into the change list */
  const elEdit = (p: Picked, ed: ElementEdit) => {
    const cur = viewOf(docRef.current, langRef.current);
    const r = applyElementEdit(cur, p, ed);
    if ("error" in r) { window.alert(r.error); return; }
    setView({ ...cur, changes: r.changes }, r.label);
  };
  /** a page of the shop's element's look: one stylesheet for it, a rule set or cleared */
  const setElLook = (p: Picked, rule: string, value: string | undefined) => {
    if (!p.selector) return;
    const cur = viewOf(docRef.current, langRef.current);
    elEdit(p, { kind: "look", css: lookCss(p.selector, { ...elementLook(cur.changes, p.selector), [rule]: value ?? "" }) });
  };
  const putAlt = (p: Picked, alt: string) => {
    const cur = viewOf(docRef.current, langRef.current);
    const r = applyElementEdit(cur, p, { kind: "attr", name: "alt", value: alt });
    if ("error" in r) { window.alert(r.error); return; }
    setView({ ...cur, changes: r.changes }, "Its alt text");
    setSelState((s) => (s && s.key === p.key && s.picked ? { ...s, picked: { ...s.picked, alt } } : s));
  };

  const makingPaths = Object.entries(making).filter(([k, m]) => m.state === "making" && k.startsWith(`${lang}|`)).map(([k]) => k.slice(lang.length + 1));
  const tuningPaths = Object.entries(making).filter(([k, m]) => m.state === "making" && m.label?.startsWith("Fine") && k.startsWith(`${lang}|`)).map(([k]) => k.slice(lang.length + 1));
  const makingIn = (block: string) => makingPaths.filter((p) => blockOfPath(p) === block).length;

  /* ── the AI ──────────────────────────────────────────────────────────── */

  // a new page's modules written with it (Content v8, SARCLA 10.11.2026 point 5) - ./plan/useNewPageModules.ts
  const npModules = useNewPageModules({ api, record: (label, before, note) => record(label, before, "ai", note) });

  const candidates = async (): Promise<Candidate[]> => {
    const r = await api.act<{ candidates: Candidate[] }>("candidates", { lang: langRef.current });
    return r.ok ? r.result.candidates : [];
  };
  const checkNote = (left: string[]) => (left.length ? `Check: it left ${left.length} placeholder${left.length === 1 ? "" : "s"} (${left.slice(0, 2).join(", ")}) - marked red in the page.` : null);

  const fill: FillRun = async (part, opts = {}) => {
    if (!canAi) return "The AI is not set up on this hub.";
    const key = part === "section" ? `section:${opts.id}` : part === "field" ? `field:${opts.id}` : part;
    setBusy(key);
    const forLang = langRef.current;
    let wrote = false;
    // the modules the whole-page write put on the page (Content v8), filled once the words are saved
    let placed: { id: string; step: NewPageModule }[] = [];
    let composed = false;
    try {
      if (part === "field") {
        const path = opts.id ?? "";
        const r = await api.ai<{ text: string; leftovers: string[] }>("fill_field", { lang: forLang, path, request: opts.request ?? null });
        if (!r.ok) return r.error;
        if (!r.result.text) return "No words came back - ask again.";
        await applyView((cur) => ({ ...cur, fields: mergeField(cur.fields, path, r.result.text) }), `AI wrote ${fieldLabel(viewOf(docRef.current, forLang).fields, path).toLowerCase()}`, opts.request ?? undefined, forLang);
        return checkNote(r.result.leftovers);
      }
      const cands = part === "all" || part === "links" || part === "hero" || part === "cta" ? await candidates() : [];
      // the whole page written (Content v8, point 5): with its modules - unless the ask only reworks the words
      // Content v12: "Write it all again" from the topic, directly or as asked - always the whole page with its modules
      const compose = part === "all" && (!!opts.mode || !opts.request || /^THE PAGE THE PERSON WANTS:/.test(opts.request) || filledCount(viewOf(docRef.current, forLang).fields) === 0);
      // an empty page (Content v9, SARCLA 10.11.2026: "it should by default start empty ... the block and number of
      // blocks are decided by the AI on the first prompt"): the AI decides its blocks and modules
      composed = compose;
      const decide = compose && !blockOrder(viewOf(docRef.current, forLang).fields).length;
      const r = await api.ai<{ answer: FillAnswer; leftovers: string[]; modules?: NewPageModule[]; problems?: string[] }>(compose ? "fill_page" : `fill_${part}`, { lang: forLang, id: opts.id ?? null, request: opts.request ?? null, candidates: cands, ...(compose ? { decide } : {}), ...(compose && opts.mode ? { mode: opts.mode } : {}) });
      if (!r.ok) return r.error;
      if (!Object.keys(r.result.answer).length) return "Nothing came back - ask again.";
      // a module of words that is not full is not put on the page (Content v9) - the server kept full ones; checked again
      const full = fullOnly(r.result.modules ?? [], forLang);
      // the whole page written: only the blocks the page has (a block taken out stays out - Content v5); an empty page:
      // exactly the blocks the AI wrote (Content v9)
      await applyView((cur) => {
        const merged = mergeFill(cur.fields, r.result.answer, opts.id);
        const fields = part !== "all" ? merged : decide && !blockOrder(cur.fields).length ? asWritten(merged) : onlyOnPage(merged, blockOrder(cur.fields));
        if (!compose || !full.kept.length) return { ...cur, fields };
        const c = npModules.place(fields, full.kept, forLang);
        placed = c.placed;
        return { ...cur, fields: c.fields };
      }, `AI wrote ${PART_LABEL[part as Part]}${opts.mode === "topic" ? " again from the topic" : opts.mode === "better" ? " again, better" : opts.mode === "ask" ? " again as asked" : ""}${compose && full.kept.length ? ` with ${full.kept.length} module${full.kept.length === 1 ? "" : "s"}` : ""}`, r.result.answer.summary ?? opts.request ?? undefined, forLang);
      wrote = true;
      if (part === "all") setToTop((n) => n + 1);
      const out = [...(r.result.problems ?? []), ...full.left];
      const left = out.length ? `Left out: ${out.slice(0, 2).join(" ")}` : null;
      return [left, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || null;
    } finally {
      setBusy(null);
      // its pictures, made without another click - once the words are saved
      if (wrote && (part === "all" || part === "hero" || part === "sections" || part === "section")) setTimeout(() => void autoPictures(forLang, part, opts.id), 50);
      // its modules, filled from the shop in front of the person (Content v8) - then every module of the page still lacking
      // something filled by the AI, or taken out (Content v11: no module "Not on the page yet" after an AI write)
      if (wrote && composed) void npModules.fillAll(forLang, placed).then(() => moduleAi.fillLeft(forLang, { rewrite: !!opts.mode, request: opts.mode === "ask" ? opts.request ?? "" : "" }));
      else if (wrote && placed.length) void npModules.fillAll(forLang, placed);
    }
  };

  const ensureOutline = async (forLang: string) => {
    const v = viewOf(docRef.current, forLang);
    if (v.source === "new" || !v.path || (v.outline?.path === v.path && v.outline.env === v.env)) return;
    await api.act("outline", { lang: forLang });
  };

  // a page of the shop: its outline read once it is shown, for its parts on the left
  const outlineAsked = useRef("");
  useEffect(() => {
    if (isNew || !d.path || !canEdit || (d.outline?.path === d.path && d.outline.env === d.env)) return;
    const key = `${lang}|${d.env}|${d.path}`;
    if (outlineAsked.current === key) return;
    outlineAsked.current = key;
    void api.act("outline", { lang }).then(() => api.reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, d.path, d.env, lang, canEdit, d.outline?.path]);

  const rewrite = async (request: string, scope: Picked | null = null): Promise<string | null> => {
    // an element (or a part) of the page selected: the AI designs the block that takes its place (Content v6)
    if (scope) return designBlock(request, { picked: scope });
    const forLang = langRef.current;
    const v = viewOf(docRef.current, forLang);
    if (!v.path) return "Pick the page first.";
    setBusy("rewrite");
    try {
      await ensureOutline(forLang);
      const r = await api.ai<Rewrite>("rewrite", { lang: forLang, request });
      if (!r.ok) return r.error;
      if (!r.result.changes.length) return `No usable change came back${r.result.problems.length ? `: ${r.result.problems.join("; ")}` : ""}. Ask again, in other words.`;
      // the changes that came back the same keep their id and module; a block that is new or written again is checked
      const before = viewOf(docRef.current, forLang).changes;
      const next = carryMeta(before, r.result.changes);
      const fresh = next.filter((c) => (c.op === "replace" || c.op === "insert") && !before.some((o) => o.id === c.id && JSON.stringify(o) === JSON.stringify(c)) && !c.off);
      await applyView((cur) => ({ ...cur, changes: next.map((c) => (fresh.includes(c) ? ({ ...c, off: CHECKING } as PageChange) : c)) }), "AI changed the page", shortNote(r.result.summary, ""), forLang);
      setIdeas([]);
      setStep("page");
      const held: string[] = [];
      for (const c of fresh) { const m = await checkAndPlace(c.id!, forLang, { fix: true }); if (m) held.push(m); }
      const left = checkNote(r.result.leftovers);
      return [r.result.problems.length ? `Left out: ${r.result.problems.join("; ")}` : null, ...held, left].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); setWorkNote(null); }
  };

  /* ── a block designed by the AI, then LOOKED AT before it counts (Content v6, SARCLA 09.11.2026 points 2, 9, 10) ── */

  /** The latest history entry gets the check's verdict (shown red under it in "Changes made here"). */
  const warnLast = (warn: string) => setHistory((h) => (h.length ? [{ ...h[0], warn }, ...h.slice(1)] : h));
  /** The document as the studio last set it - the newest, even before React has drawn it (setDoc's own latest). */
  const latestDoc = (): PageDoc => {
    let raw: unknown = api.doc;
    api.setDoc((r: unknown) => { raw = r; return r; });
    return pageDoc(raw, api.data.piece.language);
  };
  /** One change of a store view set (its html, its hold) - without a new history entry: the entry is the AI's ask. */
  const setChange = async (forLang: string, id: string, make: (c: PageChange) => PageChange) => {
    const cur = latestDoc();
    const v = viewOf(cur, forLang);
    if (!v.changes.some((c) => c.id === id)) return;
    await setDocSafely(api, cur, withView(cur, forLang, { ...v, changes: v.changes.map((c) => (c.id === id ? make(c) : c)) }));
  };

  /**
   * The check: the change (saved, held back) put on the page in a hidden frame and looked at; wrong -> the AI once more
   * with what was seen (block_fix) -> looked at again; still wrong -> kept "Looks wrong - not applied" with the reason.
   * Returns what to tell the person (null = it reads well and is applied).
   */
  const checkAndPlace = async (id: string, forLang: string, o: { fix: boolean; first?: string[]; look?: string }): Promise<string | null> => {
    setWorkNote("Checking that it reads well");
    const look = async () => checkChange({ pieceId: api.data.piece.id, lang: forLang, view: viewOf(latestDoc(), forLang), id });
    let seen = await look();
    let problems = [...(o.first ?? []), ...seen.problems.map((p) => p.why)];
    if (problems.length && o.fix) {
      setWorkNote(`It looked wrong - fixing it: ${problems[0].slice(0, 90)}`);
      const f = await api.ai<BlockOut>("block_fix", { lang: forLang, id, problems: problems.join(" ").slice(0, 1500), look: o.look ?? "" });
      if (f.ok && f.result.change) {
        const fixed = f.result.change;
        await setChange(forLang, id, (c) => ({ ...c, ...(fixed as object), id, off: CHECKING } as PageChange));
        setWorkNote("Checking the fixed block");
        seen = await look();
        problems = [...f.result.problems, ...seen.problems.map((p) => p.why)];
      }
    }
    if (!seen.checked && !problems.length) {
      // the page could not be read to look at it: applied, and said
      await setChange(forLang, id, (c) => { const { off: _o, ...rest } = c; return rest as PageChange; });
      return "Applied - the page could not be read just now to check how it looks; look at it before it goes out.";
    }
    if (!problems.length) {
      await setChange(forLang, id, (c) => { const { off: _o, ...rest } = c; return rest as PageChange; });
      return null;
    }
    const why = `${WRONG}: ${problems.slice(0, 2).join(" ")}${problems.length > 2 ? ` (${problems.length - 2} more)` : ""}`;
    await setChange(forLang, id, (c) => ({ ...c, off: why.slice(0, 600) } as PageChange));
    warnLast(why);
    return `${why} It is kept in the list of changes - "Show it anyway" applies it, or ask again in other words.`;
  };

  /** The AI designs one block: in place of the element selected (it is hidden, kept), a block it made before written
   * again, or a new block at a place of the page (the "+"). Then the check. */
  const designBlock = async (request: string, target: { picked?: Picked; place?: AddPlace }): Promise<string | null> => {
    const forLang = langRef.current;
    const v = viewOf(docRef.current, forLang);
    if (!v.path) return "Pick the page first.";
    if (!canAi) return "The AI is not set up on this hub.";
    const p = target.picked ?? null;
    setBusy("rewrite");
    setWorkNote("Designing the block");
    try {
      await ensureOutline(forLang);
      const id = changeId();
      let input: Record<string, unknown>;
      let label: string;
      let lookText = "";
      if (p?.frag) {
        // inside a block the hub put on the page: that block written again
        const base = v.changes[p.frag.change];
        lookText = p.look ? lookLine(p.look) : "";
        input = { mode: "rework", change: p.frag.change, id: base?.id ?? null, look: lookText };
        label = "AI changed its block";
      } else if (p) {
        // the element - or, a word or a line, the block it stands in - replaced by a block (it is hidden, kept)
        const box = p.box ?? null;
        const outer = (box?.outer ?? p.outer);
        lookText = (box?.look ?? p.look) ? lookLine((box?.look ?? p.look)!) : "";
        input = { mode: "replace", selector: box?.selector ?? p.selector, html: outer.slice(0, 4000), hadH1: /<h1\b/i.test(outer), look: lookText, id };
        label = "AI changed the element";
      } else if (target.place) {
        lookText = target.place.look ? lookLine(target.place.look) : "";
        input = { mode: "insert", selector: target.place.selector, where: target.place.where, near: target.place.near.slice(0, 600), look: lookText, id };
        label = "AI added a block";
      } else return "Select an element, or a place with the +.";
      input = { ...input, lang: forLang, request: request.slice(0, 2000) };
      // the firewall takes 8 KB a request: the element's HTML gives way first
      while (new TextEncoder().encode(JSON.stringify(input)).length > 7000 && typeof input.html === "string" && input.html.length > 500) input = { ...input, html: (input.html as string).slice(0, Math.floor((input.html as string).length * 0.7)) };
      const r = await api.ai<BlockOut>("block", input);
      if (!r.ok) return r.error;
      const c = r.result.change;
      if (!c?.id) return `No block came back${r.result.problems.length ? `: ${r.result.problems[0]}` : ""}. Ask again, in other words.`;
      // saved, held back while it is looked at - the preview shows it only once it reads well
      // the note SARCLA reads: one short English line (09.11.2026 it came back as a long German paragraph)
      await applyView((cur) => ({ ...cur, changes: withChange(cur.changes, { ...c, off: CHECKING } as PageChange) }), label, shortNote(r.result.summary, c.note), forLang, c.id);
      setIdeas([]);
      // a check that does not finish never leaves the block silently held back: it is said
      const msg = await checkAndPlace(c.id, forLang, { fix: true, first: r.result.problems, look: lookText })
        .catch((e: unknown) => { const why = `Held back: the check did not finish (${String((e as Error)?.message ?? e).slice(0, 80)}) - "Show it anyway" applies it.`; warnLast(why); return why; });
      return [msg, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); setWorkNote(null); }
  };

  /** "Show it anyway": a change the check held back, applied as the person decides. */
  const keepAnyway = (i: number) => {
    const cur = viewOf(docRef.current, langRef.current);
    const c = cur.changes[i];
    if (!c?.off) return;
    // a module still lacking what it needs is never shown empty: its settings open, to fill it (Content v7)
    const m = moduleOfChange(c);
    if (m && moduleGap(m) && c.id) { modules.edit(c.id); return; }
    const { off: _o, ...rest } = c;
    setView({ ...cur, changes: cur.changes.map((x, k) => (k === i ? (rest as PageChange) : x)) }, `Applied change ${i + 1} anyway`);
  };
  /* ── the AI builds with modules (Content v7, SARCLA 10.11.2026 points 5, 13): a plan of steps, each shown at once ── */

  const served = useMemo(() => servedOf(preview.held.after), [preview.held.after]);
  const modPending = useMemo(() => (isNew ? [] : modulePending(d.changes, served, modules.busy)), [isNew, d.changes, served, modules.busy]);
  const plan = usePlan({
    api, lang: () => langRef.current, view: (l) => viewOf(latestDoc(), l),
    put: (l, make, label, note, change) => applyView(make, label, note, l, change),
    check: (id, l, o) => checkAndPlace(id, l, o),
    warn: (label, why) => setHistory((h) => { const i = h.findIndex((e) => e.label === label && !e.undone); return i < 0 ? h : h.map((e, k) => (k === i ? { ...e, warn: why } : e)); }),
    served, changes: d.changes, canAi,
  });
  /** what the selection is, for the plan: its element (or the block it stands in), its words, the change it is in */
  const scopeOf = (p: Picked | null) => {
    if (!p) return {};
    const c = p.frag ? viewOf(docRef.current, langRef.current).changes[p.frag.change] : undefined;
    return { selector: p.box?.selector ?? p.selector, text: p.text.slice(0, 400), ...(c?.id ? { change: c.id } : {}) };
  };
  // a change the AI made that the server's picture does not show, or that stays held back: said under its line
  useEffect(() => {
    if (!served) return;
    setHistory((h) => {
      let moved = false;
      const next = h.map((e) => {
        const id = e.change;
        if (!id || e.undone || e.warn || e.lang !== lang) return e;
        const c = d.changes.find((x) => x.id === id) as (PageChange & { off?: string }) | undefined;
        if (!c) return e;
        if (c.off && c.off !== CHECKING) { moved = true; return { ...e, warn: /^Looks wrong/.test(c.off) ? c.off : `Held back - not on the page: ${c.off}` }; }
        const i = served.changes.findIndex((x) => x.id === id && !(x as { off?: string }).off);
        const hit = i >= 0 ? served.hits.find((x) => x.index === i) : undefined;
        if (hit?.state === "missing") { moved = true; return { ...e, warn: "Not on the page: its place was not found on the page as the shop has it now. Take it out and add it again with the +." }; }
        return e;
      });
      return moved ? next : h;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [served, d.changes, lang]);

  /** "Show the old one": a replace's hidden element shown again in the preview (nothing changes in the page itself). */
  const toggleOld = (i: number) => setOldShown((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]));
  useEffect(() => { setOldShown([]); }, [lang]);

  const translate = async (target: string): Promise<string | null> => {
    if (!canAi) return "The AI is not set up on this hub.";
    const cur0 = docRef.current;
    const from = mainView(cur0);
    // the store view it goes in (a language asked: its store view for this page)
    const to = storeFor(target);
    if (to === from) return `${to} is the page's own store view.`;
    // one page per language (Content v10): a store view of a language the page has goes to that language's page - no AI
    const leadTo = leadOf(cur0, langOfStore(to));
    if (langOfStore(to) === langOfStore(from) || (leadTo && leadTo !== to && !viewsOf(cur0).includes(to))) { openView(to); return `${to} goes to the ${langName(to)} page - the same words, no AI.`; }
    setLangState(to);
    setSelState(null);
    setStep("page");
    setBusy(`translate:${to}`, to);
    try {
      let path = "";
      if (cur0.source !== "new") {
        path = cur0.langs[to]?.path || presenceRef.current[to]?.path || "";
        if (!path) {
          const c = await api.act<{ ok: boolean; path: string | null; store: string | null; error?: string }>("counterpart", { lang: to, store: to });
          if (!c.ok) return c.error;
          if (!c.result.ok) return c.result.error ?? "The page could not be read.";
          // the shop's hreflang links know no currency: a page of fr-CH is the fr-CH/eur one under its own prefix (Content v6)
          const there = pathIn(c.result.path, to);
          if (!there) { setPicking(true); return `The shop's page in ${to} could not be found by itself - pick it in the middle, then translate again.`; }
          path = there;
        }
      }
      const r = await api.ai<Translated>("translate", { to, store: to });
      if (!r.ok) return r.error;
      const latest = docRef.current;
      const old = latest.langs[to];
      const lv: LangVersion = {
        path, store: to, texts: [], outline: old?.path === path ? old.outline : null, from: r.result.from || sourceHash(latest), source: mainView(latest), made: "translate",
        at: new Date().toISOString(), changes: r.result.changes ?? old?.changes ?? [], fields: r.result.fields ?? old?.fields ?? emptyPage().fields,
        letter: old?.letter || "A", versions: old?.versions ?? [],
      };
      record(`Translated the page into ${to}`, latest, "ai", r.result.missing ? `${r.result.missing} text${r.result.missing === 1 ? "" : "s"} came back untranslated - check them` : undefined);
      await setDocSafely(api, latest, { ...latest, langs: { ...latest.langs, [to]: lv } });
      setLangState(to);
      setSelState(null);
      setPicking(false);
      // a new page's links to the shop: the same pages in this store view's language
      let relinked = "";
      if (latest.source === "new") {
        const rl = await api.act<{ map: Record<string, string>; missing: string[] }>("relink", { lang: to });
        // a module of the page in this store view's language even when no link needed its counterpart
        if (rl.ok && !Object.keys(rl.result.map).length && viewOf(docRef.current, to).fields.modules?.some((x) => x.module.settings.store !== to)) {
          const cur = docRef.current;
          const v = viewOf(cur, to);
          await setDocSafely(api, cur, withView(cur, to, { ...v, fields: { ...v.fields, modules: v.fields.modules!.map((x) => ({ ...x, module: { ...x.module, settings: { ...x.module.settings, store: to } } })) } }));
        }
        if (rl.ok && Object.keys(rl.result.map).length) {
          const m = rl.result.map;
          const cur = docRef.current;
          const v = viewOf(cur, to);
          const fx = (u: string) => m[u] ?? u;
          const fields = {
            ...v.fields, hero: { ...v.fields.hero, button: { ...v.fields.hero.button, url: fx(v.fields.hero.button.url) } }, cta: { ...v.fields.cta, button: { ...v.fields.cta.button, url: fx(v.fields.cta.button.url) } }, links: v.fields.links.map((l) => ({ ...l, url: fx(l.url) })),
            // its modules' products and categories too, and their words in its language (Content v10, SARCLA point 9)
            ...(v.fields.modules ? { modules: v.fields.modules.map((x) => ({ ...x, module: { ...x.module, settings: { ...relinkModule(x.module.settings, m), store: to } } })) } : {}),
          };
          await setDocSafely(api, cur, withView(cur, to, { ...v, fields }));
        }
        if (rl.ok && rl.result.missing.length) relinked = ` ${rl.result.missing.length} link${rl.result.missing.length === 1 ? " has" : "s have"} no ${langName(to)} page on the shop and still point${rl.result.missing.length === 1 ? "s" : ""} to the ${from} one.`;
        // its modules' products as this store view's shop has them - names, addresses, counts in its language (Content v13,
        // SARCLA 11.11.2026: "also one link also when translated" - /de-CH/<the English key>, the English names)
        const reread = new Map<string, Card[]>();
        let notThere = 0;
        for (const pm of viewOf(docRef.current, to).fields.modules ?? []) {
          const nums = productNumbersOf(pm.module);
          if (!nums.length) continue;
          const pr = await api.act<{ cards: Card[]; missing: unknown[] }>("module_numbers", { store: to, text: nums.join(" "), count: Math.max(nums.length, 2) });
          if (!pr.ok || !pr.result.cards.length) { notThere += nums.length; continue; }
          const got = itemsAs(pm.module.settings.items, pr.result.cards);
          notThere += got.missing;
          reread.set(pm.id, got.items);
        }
        if (reread.size) {
          const cur = docRef.current;
          const v = viewOf(cur, to);
          const modules = (v.fields.modules ?? []).map((x) => (reread.has(x.id) ? { ...x, module: { ...x.module, settings: { ...x.module.settings, items: reread.get(x.id)!, store: to } } } : x));
          await setDocSafely(api, cur, withView(cur, to, { ...v, fields: { ...v.fields, modules } }));
        }
        if (notThere) relinked += ` ${notThere} product${notThere === 1 ? " is" : "s are"} not in the ${to} shop and keep${notThere === 1 ? "s" : ""} the ${from} card.`;
      }
      return [r.result.problems.length ? r.result.problems.join("; ") : null, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || `The ${to} page is made - its links go to the shop's ${langName(to)} pages. Change what you like; it is its own page.${relinked}`;
    } finally { setBusy(null); }
  };

  /** a page of the shop's search engine fields, proposed by the AI for the store view shown (the `seo` ask - Content v6) */
  const seoPropose = async (): Promise<SeoProposal | string> => {
    if (!canAi) return "The AI is not set up on this hub.";
    const forLang = langRef.current;
    if (!viewOf(docRef.current, forLang).path) return "Pick the page first.";
    await ensureOutline(forLang);
    const r = await api.ai<{ answer: FillAnswer }>("seo", { lang: forLang });
    if (!r.ok) return r.error;
    return r.result.answer.seo ?? "Nothing came back - ask again.";
  };

  const fixLeftovers = async (left: Leftover[]) => {
    const v = viewOf(docRef.current, langRef.current);
    const words = [...new Set(left.map((x) => x.text))].slice(0, 6).join(" | ");
    if (v.source === "new") {
      if (isLegacyBody(v)) { await fill("all", { request: "Move the earlier draft into the fields: final words everywhere, no placeholders." }); return; }
      const paths = [...new Set(left.map((x) => x.path).filter((p): p is string => !!p))].slice(0, 6);
      for (const p of paths) await fill("field", { id: p, request: `It still holds a placeholder (${words}). Write the final words in its place.` });
      return;
    }
    const msg = await rewrite(`Some words on the page are placeholders, not final copy: ${words}. Replace each with the final words in the page's language; change nothing else.`);
    if (msg) window.alert(msg);
  };

  /* ── the quick asks ──────────────────────────────────────────────────── */

  const others = offered.map((o) => o.lang).filter((l) => l !== langOfStore(main));
  /** a block of a new page written by the AI alone ("hero", "intro-block", "sections.<id>", an item's block...) */
  const fillBlock = (block: string, request?: string) => {
    const run = fillOfBlock(blockOfPath(block) ?? block);
    return run ? fill(run.part, { id: run.id, request }) : fill("all", { request });
  };

  /**
   * "Ask AI" on ONE block, applied to it at once (Content v11, SARCLA 10.11.2026: "ask the AI on block should display the
   * inbox there like a pop and really apply the change on block level"; "Fill it with AI" is the same with no question): a
   * module - its settings filled by the AI from the page (./modules/useModuleAi.ts, the `module_words` task); a new page's
   * own block - written again (fill); a page of the shop's block - the plan aimed at it, one step applied at once. Says what
   * it did, and its Undo takes back exactly that.
   */
  const askBlock = async (rowKey: string, request: string): Promise<BlockAiAnswer> => {
    const r = rowsRef.current.find((x) => x.key === rowKey);
    if (!r) return { ok: false, text: "That block is not on the page any more.", undo: null };
    if (!canAi) return { ok: false, text: "The AI is not set up on this hub.", undo: null };
    const mark = entryId;
    let text: string;
    let ok = true;
    if (r.module) {
      const out = await moduleAi.fill(isModuleKey(r.key) ? r.key : r.changeId ?? "", request);
      text = out.text; ok = out.ok;
    } else if (isNew) {
      const m = await fillBlock(r.key, request || undefined);
      text = m ?? (request ? "Done - the block is written again as you asked." : "The block is written from the page.");
    } else {
      const p = sel?.picked ?? null;
      const m = await plan.ask("part", request || `Make this part of the page ("${r.name}") more convincing for a buyer: clearer benefits, the right products at hand, in the page's own facts.`, p ? scopeOf(p) : {});
      text = m ?? "Done - the change is on the page.";
    }
    const made = entryId > mark;
    return { ok: ok && made, text, undo: made ? () => undoSince(mark) : null };
  };

  /** "Write it all again" from the topic, directly or as asked (Content v12): the whole page written, what it did said under
   * the header with its Undo - everything since, the modules filled after it too */
  const [wrote, setWrote] = useState<BlockAiAnswer | null>(null);
  const writeAgain = async (mode: WriteMode, request?: string) => {
    const mark = entryId;
    setWrote(null);
    // "Start again" (SARCLA 11.11.2026): the page empty - its words, blocks, modules and looks out; its search engine fields
    // (the URL key its Magento pages carry), store views and records kept, so a publish later updates the same pages
    if (mode === "reset") {
      const cur = viewOf(docRef.current, langRef.current);
      setView({ ...cur, fields: { ...emptyFields(), seo: cur.fields.seo }, changes: [], texts: [] }, "Started again - an empty page");
      try { window.localStorage.removeItem(emptyKey); } catch { /* no storage */ }
      setWrote({ ok: true, text: `${WROTE.reset}. Add blocks with +, or ask the assistant on the right to write it.`, undo: () => undoSince(mark) });
      return;
    }
    const m = await fill("all", { mode, ...(request ? { request } : {}) });
    const made = entryId > mark;
    setWrote({ ok: made, text: made ? `${WROTE[mode]}${m ? ` - ${m}` : "."}` : m ?? "Nothing came back - ask again.", undo: made ? () => undoSince(mark) : null });
  };

  /* ── blocks added, moved, taken out (Content v5: "add more elements by + next to sections, or in the photo") ── */

  const [addWhere, setAddWhere] = useState<AddAt | null>(null);
  /** a block put at a place of a page of the shop with the "+" (Content v6): "Text and picture" at once, or a module of the
   * gallery - checked like any block */
  const insertAt = (c: PageChange, label: string) => {
    const cur = viewOf(docRef.current, langRef.current);
    setView({ ...cur, changes: withChange(cur.changes, c) }, label);
  };
  /** a block added at a place of the page: it lands there, selected, its fields open */
  const addBlockAt = (kind: NewBlock, at: number) => {
    const cur = viewOf(docRef.current, langRef.current);
    const had = blockOrder(cur.fields).includes(kind);
    const r = addBlock(cur.fields, kind, at);
    const name = blocksOf(r.fields).find((b) => b.key === r.key);
    setView({ ...cur, fields: r.fields }, `${had ? "Moved" : "Added"} ${name ? `${name.name.toLowerCase()} (block ${name.num})` : "a block"}`);
    setTimeout(() => onOpenBlock(r.key), 30);
  };
  /** "+ Tile" / "+ Question" / "+ Link" in the page: one more, selected, its fields open */
  const addItemTo = (list: string) => {
    if (list !== "benefits" && list !== "faq" && list !== "links") return;
    const cur = viewOf(docRef.current, langRef.current);
    const r = addItem(cur.fields, list as ListKey);
    setView({ ...cur, fields: r.fields }, `Added ${list === "benefits" ? "a tile" : list === "faq" ? "a question" : "a link"}`);
    // its words open at once, in the page
    setTimeout(() => selectField(list === "links" ? `links.${r.id}` : list === "faq" ? `faq.${r.id}.q` : `benefits.${r.id}.title`), 30);
  };

  /* ── what it says, in English (SARCLA 09.11.2026: "Ask: translate to English, if I want to understand what is
   *    written") - read only: the page does not change, nothing goes into "Changes made here" ── */

  const [said, setSaid] = useState<Said | null>(null);
  useEffect(() => { setSaid(null); }, [sel?.key, lang]);
  const english = async (): Promise<string | null> => {
    const s0 = sel;
    const input: Record<string, unknown> = { lang: langRef.current };
    let scopeName = "The whole page";
    if (s0?.key.startsWith("f:")) { input.path = s0.key.slice(2); scopeName = fieldLabel(d.fields, s0.key.slice(2)); }
    else if (s0?.key.startsWith("b:")) { input.block = s0.key.slice(2); scopeName = scopeLabel ?? "This block"; }
    else if (s0?.picked) { input.text = s0.picked.text.slice(0, 3000); input.label = scopeLabel ?? "The element"; scopeName = scopeLabel ?? "The element"; }
    else if (!isNew) await ensureOutline(langRef.current);
    const viaDeepl = await api.act<{ items: { label: string; text: string }[] | null; by?: string }>("english", input);
    let items = viaDeepl.ok ? viaDeepl.result.items : null;
    if (!items) {
      const r = await api.ai<{ items: { label: string; text: string }[] }>("english", input);
      if (!r.ok) return r.error;
      items = r.result.items;
    }
    if (!items.length) return "There are no words there yet.";
    setSaid({ scope: scopeName, items });
    return null;
  };

  /* ── the selection, as the assistant says it ──────────────────────────── */

  /** "Section 1 · title" -> "title"; "Tile 2" stays */
  const partName = (label: string) => (label.includes(" · ") ? label.split(" · ").slice(1).join(" · ") : label);
  const scope = sel?.picked ?? null;
  const inModule = !!scope?.frag && !!moduleOfChange(d.changes[scope.frag.change]);
  // the row of the list the selection is in (Content v8): a new page's block or module; a page of the shop's block
  const selRowKey = !sel ? (pop?.kind === "settings" ? pop.key : null)
    : isNew ? (sel.key.startsWith("nt:") ? moduleKeyOf(sel.key.split(":")[1]) : rowOfSelection(sel.key))
      : sel.picked?.inBlock ? shopRowOf(rows, { change: sel.picked.inBlock.change, block: sel.picked.inBlock.selector }) ?? (sel.picked.inBlock.changeId ? `c:${sel.picked.inBlock.changeId}` : null) : null;
  const selRow = selRowKey ? rows.find((r) => r.key === selRowKey) ?? null : null;
  // the whole block selected, not a text in it
  const wholeRow = !!selRow && !!sel && (isNew ? sel.key === selectionOfRow(selRow.key)
    : !!sel.picked && ((selRow.kind === "page" && sel.picked.selector === selRow.selector) || (!!sel.picked.frag && !sel.picked.frag.path.length)));
  const shopBlock = !isNew && wholeRow ? selRow : null;
  const blockKey = sel?.key.startsWith("b:") ? blockOfPath(sel.key.slice(2)) : null;
  const blockInfo = blockKey ? blocksOf(d.fields).find((b) => b.key === blockKey) ?? null : null;
  // a whole block selected (not one of its items): "4 · Proof tiles" - numbered as the list numbers it
  const wholeBlock = blockInfo && sel && previewOf(blockInfo.key) === sel.key.slice(2) ? blockInfo : null;
  const blockName = wholeBlock && selRow ? `${selRow.num} · ${selRow.name}` : wholeBlock ? `${wholeBlock.num} · ${wholeBlock.name}` : null;
  const scopeLabel = !sel ? null : blockName ?? (shopBlock ? `${shopBlock.num} · ${shopBlock.name}`
    : (sel.key.startsWith("f:") || sel.key.startsWith("b:")) && selRow ? `${selRow.num} · ${selRow.name} · ${partName(fieldLabel(d.fields, sel.key.slice(2)))}`
      : sel.key.startsWith("f:") || sel.key.startsWith("b:") ? fieldLabel(d.fields, sel.key.slice(2)) : sel.key.startsWith("i:") ? "A banner"
      : (sel.key.startsWith("np:") || sel.key.startsWith("nt:")) && selRow ? `${selRow.num} · ${selRow.name}` : scope ? `<${scope.tag}> ${scope.text.slice(0, 60)}` : null);
  const fieldPath = sel?.key.startsWith("f:") ? sel.key.slice(2) : null;
  const blockPart = sel?.key.startsWith("b:") ? sel.key.slice(2) : null;
  const pictureField = !!fieldPath && /picture$|\.button$|^links\.[^.]+$/.test(fieldPath);
  const picPath = fieldPath && /(^|\.)picture$/.test(fieldPath) ? fieldPath : null;
  const selPic = picPath ? (getField(d.fields, picPath) as Pic | undefined) : undefined;
  const made = doc.langs[lang]?.made;
  const againAsk: QuickAsk[] = lang === main ? [] : made === "copy"
    ? [{ label: `Copy it from ${doc.langs[lang]?.source || main} again`, run: () => (window.confirm(`Copy ${doc.langs[lang]?.source || main} into ${lang} again? What was changed in ${lang} goes (it stays in the version history).`) ? copyAgain(lang) : Promise.resolve(null)) }]
    : [{ label: `Translate it from ${main} again`, run: () => translate(lang) }];
  // to READ it, in English - wherever the page is not English (the page does not change)
  const englishAsk: QuickAsk[] = langOfStore(lang) === "en" ? [] : [{ label: "What does it say? (in English)", run: english }];

  // a picture selected: its fine-tunes - the same picture, one thing changed (never a new one)
  const pictureAsks: QuickAsk[] = picPath && selPic ? (selPic.url ? PICTURE_TUNES.map((t) => ({ label: t.label, run: () => refine(picPath, t.ask) }))
    : selPic.idea.trim() ? [{ label: "Make the picture from its idea", run: async () => { pictures.make(picPath, selPic.idea); return null; } }] : []) : [];

  const quick: QuickAsk[] = sel && !sel.key.startsWith("i:") ? (
    isNew ? (
      picPath ? pictureAsks
        : blockPart ? [
          { label: "Write this block", run: () => fillBlock(blockPart) },
          { label: "Make it shorter", run: () => fillBlock(blockPart, "Make this block shorter and easier to scan, same meaning.") },
          { label: "Make it more convincing", run: () => fillBlock(blockPart, "Make this block more convincing for a buyer - concrete benefits, no hype.") },
          ...englishAsk,
        ]
        : sel.key.startsWith("np:") && selRow ? [
          // a module (Content v11): the AI fills its settings from the page - the same as its settings' button
          { label: selRow.note ? "Fill it with AI" : "Write it again with AI", run: async () => (await askBlock(selRow.key, "")).text },
          { label: "Make it shorter", run: async () => (await askBlock(selRow.key, "Make its words shorter and easier to scan, same meaning.")).text },
          ...englishAsk,
        ]
        : fieldPath && !pictureField ? [
          { label: "Write it again", run: () => fill("field", { id: fieldPath }) },
          { label: "Make it shorter", run: () => fill("field", { id: fieldPath, request: "Make it shorter, same meaning." }) },
          { label: "Make it more convincing", run: () => fill("field", { id: fieldPath, request: "Make it more convincing for a buyer - concrete benefits, no hype." }) },
          ...englishAsk,
        ] : englishAsk
    ) : scope && (shopBlock || inModule) ? [
      // a block (or a module the hub put): the AI plans with the module library (Content v7)
      { label: "Make this part more convincing", run: () => plan.ask("part", `Make this part of the page${shopBlock ? ` ("${shopBlock.name}")` : ""} more convincing for a buyer: clearer benefits, the right products at hand, in the page's own facts.`, scopeOf(scope)) },
      { label: "Make it shorter", run: () => plan.ask("part", "Make this part's words shorter and easier to scan, same meaning.", scopeOf(scope)) },
      { label: "A better module here", run: () => plan.ask("part", "Put the module of the library that does this part's job best in its place, filled from the shop.", scopeOf(scope)) },
      ...englishAsk,
    ] : scope ? [
      { label: "Rewrite this element", run: () => rewrite("Rewrite this element's words: clearer and more useful for a buyer.", scope) },
      { label: "Make it shorter", run: () => rewrite("Make this element's words shorter, same meaning.", scope) },
      { label: "Make it stand out", run: () => rewrite("Make this element stand out more on the page, in the shop's look (petrol, a small red accent).", scope) },
      ...englishAsk,
    ] : []
  ) : isNew ? [
    { label: isLegacyBody(d) ? "Move the draft into the fields" : "Write the whole page", run: () => fill("all", isLegacyBody(d) ? { request: "Move the earlier draft into the fields: final words everywhere, no placeholders." } : undefined) },
    { label: "Make it more convincing", run: () => fill("all", { request: "Make every part more convincing for a buyer: concrete benefits, the reasons to order here, no hype. Keep the structure." }) },
    { label: "Make it shorter", run: () => fill("all", { request: "Make the whole page shorter and easier to scan: fewer words, the same structure." }) },
    { label: "Search engine fields", run: () => fill("seo") },
    ...(filledCount(d.fields) ? englishAsk : []),
    ...againAsk,
  ] : [
    // Content v7: the AI answers with a plan of modules of the library, filled from the shop (./plan/*)
    { label: "Ideas for this page", run: async () => {
      if (!d.path) return "Pick the page first.";
      await ensureOutline(lang);
      setIdeas([]);
      return plan.ask("ideas", "");
    } },
    { label: "Make it more convincing", run: async () => { if (!d.path) return "Pick the page first."; await ensureOutline(lang); return plan.ask("convincing", ""); } },
    { label: "Make it read well on a phone", run: () => rewrite("Make every new block read well on a phone (390 px): check spacing, font sizes and stacking. Keep everything else.") },
    { label: "Search engine fields", run: async () => {
      if (!d.path) return "Pick the page first.";
      await ensureOutline(lang);
      const r = await api.ai<{ answer: FillAnswer }>("seo", { lang });
      if (!r.ok) return r.error;
      const s = r.result.answer.seo;
      if (!s) return "Nothing came back - ask again.";
      setSeo(s);
      // the page's own search engine fields open on the left, beside the proposal (Content v6)
      setOpen("seo");
      return null;
    } },
    ...(d.path ? englishAsk : []),
    ...againAsk,
  ];

  const onAsk = async (text: string): Promise<string | null> => {
    // Content v13: one element of a module selected - that element alone, applied at once (its Undo in "Changes made here")
    const pp = sel?.picked?.part;
    if (pp?.part) {
      const info = partNow(pp.mod, pp.part);
      if (info?.kind === "item") return (await cardAi(pp.mod, pp.part, text)).error ?? null;
      if (info && info.kind !== "picture") return (await partAi(pp.mod, pp.part, text)).error ?? null;
    }
    if (sel && !sel.key.startsWith("i:")) {
      if (isNew) {
        // a picture selected: the ask changes THIS picture (or, with none there yet, says what it should show)
        if (picPath && selPic) {
          if (selPic.url) return refine(picPath, text);
          setPic(lang, picPath, { idea: text }, "Wrote the picture's idea");
          pictures.make(picPath, text);
          return null;
        }
        if (fieldPath && !pictureField) return fill("field", { id: fieldPath, request: text });
        // a part selected: that part alone is written - never the whole page (only it shimmers, the rest stays)
        if (blockPart) return fillBlock(blockPart, text);
        // a module's text (Content v8): those words written again; a module: its settings fill it
        if (sel.key.startsWith("nt:") && sel.picked) { const r = await aiWords(sel.picked, text, sel.picked.text); return r.error ?? (r.text ? putWords(sel.picked, r.text) : null); }
        // a module (Content v11): the AI fills it - its settings - from the page and the ask
        if (sel.key.startsWith("np:") && selRow) return (await askBlock(selRow.key, text)).text;
        return fill("all", { request: text });
      }
      // a block, or a module the hub put: a plan; one element: the block that takes its place
      if (scope && (shopBlock || inModule)) return plan.ask("part", text, scopeOf(scope));
      return rewrite(text, scope);
    }
    if (/^(translate|übersetz|tradu|vertaal|przetłum)/i.test(text.trim())) {
      const to = others.find((l) => new RegExp(langName(l), "i").test(text) || new RegExp(`\\b${l}\\b`, "i").test(text));
      if (to) return translate(to);
    }
    if (isNew) return fill("all", { request: text });
    if (!d.path) return "Pick the page first.";
    await ensureOutline(langRef.current);
    return plan.ask("ask", text);
  };

  /* ── written by itself only from an idea's brief (SARCLA 09.11.2026: "if the project was created via an SEO brief,
   *    writing the page should be by default; otherwise the user should prompt each page he wants"; 10.11.2026: "new
   *    page should be empty and then we start to build, only not when they come from ideas") - the rule in
   *    lib/content/studio/kinds/page/appBrief.ts: an idea's to-do writes itself while the page has nothing on it; any
   *    other opens empty, the start card offering "Write it with AI" and "Start empty and add blocks" ── */

  const [appBrief, setAppBrief] = useState<AppBrief | null>(null);
  // what the project's link says before the server answers (and for someone who may only read: no action for them)
  const projectNotes = api.data.project?.brief ?? null;
  const localBrief = useMemo(() => appBriefOf({ source: null, goal: api.data.brief?.goal ?? null, notes: projectNotes, title: api.data.project?.title ?? null }),
    [projectNotes, api.data.brief?.goal, api.data.project?.title]);
  const briefNow = appBrief ?? localBrief;
  /** the page written by itself in this open: under way, then done (with what fill said when nothing landed) */
  const [autoRun, setAutoRun] = useState<{ done: boolean; error: string | null } | null>(null);
  // "Start empty and add blocks": the card put away (kept for this to-do, on this browser), the blocks' menu open at once
  const emptyKey = `page-studio:start-empty:${api.data.piece.id}`;
  const [startedEmpty, setStartedEmpty] = useState(false);
  const autoAsked = useRef(false);
  const emptyNew = isNew && !pageHasContent(d);
  useEffect(() => {
    if (autoAsked.current || !canEdit || !doc.started || !emptyNew || lang !== main) return;
    autoAsked.current = true;
    void api.act<AppBrief>("brief").then((r) => {
      // the brief could not be read: an idea's page says so and offers its buttons (never a card waiting for nothing)
      if (!r.ok) { setAutoRun({ done: true, error: r.error }); return; }
      setAppBrief(r.result);
      // started empty on purpose here before: it stays the person's
      let chose = false;
      try { chose = window.localStorage.getItem(emptyKey) === "1"; } catch { /* no storage */ }
      // an idea's to-do: the page is written at once, the blocks shimmering - once, and only while nothing is on it
      if (!canAi || chose || !writesItself(r.result, pageHasContent(viewOf(docRef.current, mainView(docRef.current))))) { setAutoRun(null); return; }
      setAutoRun({ done: false, error: null });
      void fill("all").then((m) => setAutoRun({ done: true, error: m }), (e: unknown) => setAutoRun({ done: true, error: e instanceof Error ? e.message : String(e) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, doc.started, emptyNew, lang, main]);
  // where the start card stands, and its one line: why the page is empty, or why it wrote itself (an idea's page says
  // "writes itself" from the first moment - until the brief's answer, then while it writes)
  const startState: StartState = !briefNow.idea ? "empty"
    : autoRun ? (!autoRun.done ? "writing" : pageHasContent(viewOf(doc, main)) ? "wrote" : "failed")
    : !api.data.ai ? "noAi" : !canEdit ? "readOnly" : briefNow.auto && !appBrief && !startedEmpty ? "writing" : "empty";
  useEffect(() => { try { setStartedEmpty(window.localStorage.getItem(emptyKey) === "1"); } catch { /* no storage */ } }, [emptyKey]);
  const startEmpty = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setStartedEmpty(true);
    try { window.localStorage.setItem(emptyKey, "1"); } catch { /* no storage */ }
    setAddWhere({ at: 1, pos: { top: Math.round(r.top), left: Math.round(r.left + r.width / 2) } });
  };
  const start = { state: startState, line: startLine(briefNow, startState, autoRun?.error ?? null), startedEmpty, onStartEmpty: startEmpty };

  /* ── the A/B test: in the top bar, set up in the last step (Content v8, SARCLA 10.11.2026 point 6: "A/B testing should
   *    be on top header - if I click activate then I can set it on the last step") - ../../abBar.tsx ── */

  const [abRunning, setAbRunning] = useState<AbRunning>(null);
  const [abLit, setAbLit] = useState(0);
  const abOn = abApplies(d);
  useEffect(() => {
    if (!abOn) { setAbRunning(null); return; }
    let gone = false;
    void api.act<{ running: AbRunning }>("ab_state", { lang }).then((r) => { if (!gone && r.ok) setAbRunning(r.result.running); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abOn, doc.env, d.path, lang]);
  /** the last step opened on the test's setup (the Build pane unfolded, a module's panel closed), the setup lit */
  const openAbStep = () => { modules.edit(null); if (fold.build) toggleFold("build"); setStep("publish"); setAbLit((n) => n + 1); };
  const abNow = abStateOf(d, abRunning);
  useAbBar(abOn ? {
    state: abNow, line: abLineOf(d, abNow, abRunning), canEdit,
    onActivate: () => { const cur = docRef.current; if (!cur.abTest.enabled) setDoc(activateAb(cur), "Activated the A/B test"); openAbStep(); },
    onOpen: openAbStep,
  } : null);

  /* ── the page picked, and the middle ─────────────────────────────────── */

  const onPicked = (p: PickedPage) => {
    const cur = docRef.current;
    setFound([]); setSelState(null); openPop(null);
    if (lang === mainView(cur)) {
      const store = p.store ?? cur.store;
      // the to-do works where the page was picked: production, or ACC (Content v8, point 7)
      setDoc({ ...cur, env: p.env, path: p.path, store, pageKind: p.kind, outline: null, source: cur.source === "new" ? "pick" : cur.source }, cur.path ? `Picked another page${p.env !== cur.env ? ` (on ${p.env === "acc" ? "ACC" : "production"})` : ""}` : undefined);
      setLangState(baseStore(store) ?? store);
    } else {
      const add = howToAdd(cur, lang);
      // a store view of the page's own language: its changes start as a copy, on the page picked there
      if (!cur.langs[lang] && add.how === "copy") { record(`Copied ${add.from} into ${lang}`, cur); api.setDoc(copyView(cur, lang, add.from, p.path)); }
      else { const v = viewOf(cur, lang); setView({ ...v, path: p.path, outline: null }, `Picked the ${lang} page`); }
    }
    setPicking(false);
  };
  const removeInsert = (id: string) => setDoc({ ...docRef.current, inserts: docRef.current.inserts.filter((x) => x.id !== id) }, "Took a banner out of the page");

  const findCounterpart = async () => {
    setFinding(true);
    const there = presenceRef.current[lang]?.path;
    const c = there ? null : await api.act<{ ok: boolean; path: string | null; error?: string }>("counterpart", { lang, store: lang });
    setFinding(false);
    const path = there ?? (c?.ok && c.result.ok ? pathIn(c.result.path, lang) : null);
    if (path) { const v = viewOf(docRef.current, lang); setView({ ...v, path }, `Found the ${lang} page`); }
    else setPicking(true);
  };

  const translating = busy === `translate:${lang}`;
  const langEmpty = lang !== main && (isNew ? !d.fields.hero.title && !d.fields.intro && !d.fields.sections.length : !d.path || !d.changes.length);
  const needsPage = !isNew && lang === main && !d.path;
  const addHow = lang !== main ? howToAdd(doc, lang) : null;
  const notOnShop = !isNew && lang !== main && !d.path && presence[lang]?.exists === false;
  const empty = picking || needsPage ? (
    <PagePicker api={api} store={lang === main ? d.store || "de-CH" : lang} lockStore={lang !== main} env={doc.env} lockEnv={lang !== main} current={d.path}
      title={lang === main ? undefined : `Which is the ${lang} page?`} onPick={onPicked} onClose={d.path || lang !== main ? () => setPicking(false) : undefined} />
  ) : langEmpty ? (
    <LangEmpty d={d} lang={lang} main={main} store={lang} busy={translating} since={translating ? since : null} canAi={canAi}
      onTranslate={() => void translate(lang).then((m) => { if (m && !/is made/.test(m)) window.alert(m); })}
      onCopy={addHow?.how === "copy" && canEdit ? { from: addHow.from, run: () => openView(lang) } : null} notOnShop={notOnShop}
      onFind={!isNew && !d.path ? () => void findCounterpart() : undefined} finding={finding} />
  ) : undefined;

  const after = preview.held.after?.out;
  const hits = after?.ok ? after.hits : null;
  const placeholder = picPath ? (selPic?.url ? "What should change in the picture?" : "What should the picture show?")
    : sel ? (shopBlock || wholeBlock ? "What should change in this block?" : "What should change in this element?") : isNew ? "What should the page say or do?" : "What should change on this page?";
  // what the AI does shows in its own language only; elsewhere its buttons wait until it is done
  const busyHere = busy && busyLang === lang ? busy : null;
  const aiHere = canAi && !(busy && busyLang !== lang);
  const marks = busyOf(busyHere, d.fields);
  const contextKind = picPath ? "This picture only" : shopBlock ? "This block only" : wholeBlock ? "This block only" : undefined;

  /* ── the Build list, the bar over the selection and its popup (Content v8) ── */

  const closePop = () => openPop(null);
  // Esc closes the popup wherever the focus is
  useEffect(() => {
    if (!pop) return;
    const k = (ev: KeyboardEvent) => { if (ev.key === "Escape") openPop(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pop]);

  /** "Ask AI for this text" on any element that is not a new page's field: its words written again (the `words` task) */
  async function aiWords(p: Picked, ask: string, now: string): Promise<{ text?: string; error?: string }> {
    if (!canAi) return { error: "The AI is not set up on this hub." };
    const r = await api.ai<{ text: string }>("words", { lang: langRef.current, text: now.slice(0, 3000), request: ask.slice(0, 1500), tag: p.tag, block: selRow?.name ?? "" });
    if (!r.ok) return { error: r.error };
    return r.result.text ? { text: r.result.text } : { error: "No words came back - ask again." };
  }
  const aiField = async (path: string, ask: string): Promise<{ text?: string; error?: string }> => {
    const r = await fill("field", { id: path, request: ask });
    return r ? { error: r } : {};
  };

  /* the rows' acts */
  // Content v13 (SARCLA 11.11.2026: "sometimes drag and drop on modules don't put it up"): from the page as it is now, and
  // the moved block stays selected
  const moveTo = (r: BlockRow, to: number) => {
    const cur = viewOf(docRef.current, langRef.current);
    setView({ ...cur, fields: moveRow(cur.fields, r.key, to) }, `Moved ${r.name.toLowerCase()}`);
    setSelState({ key: selectionOfRow(r.key), picked: null });
    setReveal((n) => n + 1);
  };
  const moveBy = (r: BlockRow, by: -1 | 1) => setView({ ...d, fields: moveRowBy(d.fields, r.key, by) }, `Moved ${r.name.toLowerCase()} ${by < 0 ? "up" : "down"}`);
  const dup = (r: BlockRow) => {
    const res = duplicateRow(d.fields, r.key);
    if (!res) return;
    setView({ ...d, fields: res.fields }, `Duplicated ${r.name.toLowerCase()} (block ${r.num})`);
    setTimeout(() => { setSelState({ key: selectionOfRow(res.key), picked: null }); setReveal((n) => n + 1); openPop(null); }, 30);
  };
  const removeRowAct = (r: BlockRow) => {
    if (selRowKey === r.key) setSel(null);
    if (pop?.key === r.key) openPop(null);
    setView({ ...d, fields: removeRow(d.fields, r.key) }, `Took ${r.name.toLowerCase()} (block ${r.num}) out`);
  };
  /** a page of the shop's own block, as a change aims at it */
  const pickedFor = (r: BlockRow): Picked => ({ key: `e:${r.selector ?? ""}`, selector: r.selector ?? "", tag: "div", text: "", inner: "", outer: "", frag: null, host: null, editable: false });
  const setShopLook = (r: BlockRow, rule: string, value: string | undefined) => {
    if (!r.selector) return;
    const cur = viewOf(docRef.current, langRef.current);
    const next = { ...elementLook(cur.changes, r.selector), [rule]: value ?? "" };
    const res = applyElementEdit(cur, pickedFor(r), { kind: "look", css: lookCss(r.selector, next) });
    if ("error" in res) { window.alert(res.error); return; }
    setView({ ...cur, changes: res.changes }, `Changed the look of block ${r.num}`);
  };
  const hideShop = (r: BlockRow, on: boolean) => {
    const cur = viewOf(docRef.current, langRef.current);
    const res = applyElementEdit(cur, pickedFor(r), { kind: "hide", on });
    if ("error" in res) { window.alert(res.error); return; }
    setView({ ...cur, changes: res.changes }, `${on ? "Hid" : "Showed again"} block ${r.num} (${r.name})`);
  };
  const replaceWithModule = (r: BlockRow) => {
    if (!r.selector) return;
    openPop(null);
    modules.openGallery({ how: "replace", selector: r.selector, label: `In place of block ${r.num} · ${r.name} (it is hidden, kept)` });
  };
  const takeOut = (r: BlockRow) => {
    if (r.change === undefined) return;
    if (pop?.key === r.key) openPop(null);
    if (selRowKey === r.key) setSel(null);
    setView({ ...d, changes: d.changes.filter((_, i) => i !== r.change) }, `Took ${r.name.toLowerCase()} (block ${r.num}) out`);
  };
  /** where a module goes from the list's "+" on a page of the shop: after the block above it */
  const shopPlaceAfter = (above: BlockRow | undefined): Place => {
    if (!above) return { how: "insert", selector: MAIN_SELECTOR, where: "prepend", label: "At the top of the page's content" };
    if (above.kind === "page" && above.selector) return { how: "insert", selector: above.selector, where: "after", label: `After block ${above.num} · ${above.name}` };
    const c = above.change !== undefined ? d.changes[above.change] : undefined;
    const m = c ? moduleOfChange(c) : null;
    if (m) return { how: "insert", selector: `.apx-${m.settings.id}`, where: "after", label: `After block ${above.num} · ${above.name}` };
    const below = rows.slice(rows.indexOf(above) + 1).find((x) => x.kind === "page" && x.selector);
    return below ? { how: "insert", selector: below.selector!, where: "before", label: `Before block ${below.num} · ${below.name}` } : { how: "insert", selector: MAIN_SELECTOR, where: "append", label: "At the end of the page's content" };
  };
  const addAt = (at: number, el: HTMLElement) => {
    if (isNew) { setAddWhere({ at: Math.max(1, rows.slice(0, at).filter((x) => x.kind === "block").length), anchor: el }); return; }
    modules.openGallery(shopPlaceAfter(rows[at - 1]));
  };
  const rowMenu = (r: BlockRow): RowAct[] => {
    const acts: RowAct[] = [
      { key: "settings", label: "Settings", icon: <TuneIcon />, run: () => openSettings(r) },
      // Content v11 (SARCLA: "ask the AI on block should display the inbox there like a pop"): its question box, at it
      { key: "ai", label: "Ask AI about it", icon: <AutoAwesomeOutlinedIcon />, run: () => selectRow(r, { kind: "ask", key: r.key }), disabled: !aiHere },
    ];
    if (!canEdit) return acts;
    // Content v10 (point 4): the modules of the same kind it can become
    const sw = tools.optionsFor(r);
    if (sw && sw.options.length) acts.push({ key: "switch", label: "Change it into another module", icon: <SwapHorizIcon />, run: () => selectRow(r, { kind: "switch", key: r.key }) });
    const i = rows.indexOf(r);
    if (isNew) {
      acts.push({ key: "dup", label: "Duplicate", icon: <ContentCopyOutlinedIcon />, run: () => dup(r), disabled: !r.copyable, tip: `A page has one ${r.name.toLowerCase()}` });
      acts.push({ key: "up", label: "Move up", icon: <ArrowUpwardIcon />, run: () => moveBy(r, -1), disabled: !r.movable || i <= (r.module ? 0 : 1) });
      acts.push({ key: "down", label: "Move down", icon: <ArrowDownwardIcon />, run: () => moveBy(r, 1), disabled: !r.movable || i >= rows.length - 1 });
      // Content v12 (SARCLA 10.11.2026: "also you should delete here if you want to replace by another hero"): the hero too -
      // the first module then carries the page's H1; "+" > "The page's hero" brings it back
      acts.push({ key: "out", label: "Take it out", icon: <DeleteOutlineIcon />, run: () => removeRowAct(r), danger: true });
    } else if (r.kind === "page") {
      acts.push({ key: "replace", label: "Replace it with a module", icon: <SwapHorizIcon />, run: () => replaceWithModule(r) });
      acts.push({ key: "hide", label: r.state === "hidden" ? "Show it again" : "Hide it on the page", icon: r.state === "hidden" ? <VisibilityOutlinedIcon /> : <VisibilityOffOutlinedIcon />, run: () => hideShop(r, r.state !== "hidden"), danger: r.state !== "hidden" });
    } else {
      acts.push({ key: "out", label: "Take it out", icon: <DeleteOutlineIcon />, run: () => takeOut(r), danger: true });
    }
    return acts;
  };
  // what is being written or filled now, by row
  const rowBusy: Record<string, string> = {};
  if (isNew) {
    for (const k of busyBlocks(busyHere, d.fields)) rowBusy[k] = "Writing…";
    for (const r of rows) { const n = makingIn(r.key); if (n) rowBusy[r.key] = n === 1 ? "Making the picture…" : `Making ${n} pictures…`; }
  }
  for (const [k, v] of Object.entries(modules.busy)) rowBusy[isModuleKey(k) ? k : `c:${k}`] = v;
  // a new page's module the AI or the shop fills from its settings: its block says so on the page too (Content v11)
  const npBusy = Object.fromEntries(Object.entries(modules.busy).filter(([k]) => isModuleKey(k)).map(([k, v]) => [k.slice(3), v]));

  /* ── a module's elements, one by one (Content v13, SARCLA 11.11.2026, screenshot 25: "still confusing ... You should
   *    allow editing per element, therefore also the AI per element, like a text, a button. I should be able to add
   *    another button, take out elements. Both settings and ask AI go to block level - we need to dig into element also.
   *    Allow element create inside of the block.") ──
   * A click inside a module selects the element of it the click is in (./parts.ts, lib .../modules/elements.ts) - its
   * headline, a button, a date, a point, a card of the shop, its picture, an element added - and opens THAT element's
   * popup: its words, its look, its own Ask AI (applied at once, with Undo), Take it out. Its own ground is the block. */

  /** the module a module's element in the page belongs to: a new page's ("np:<id>") or a change's ("c:<id>") */
  const modOfRoot = (root: Element): { key: string; m: ModuleRef } | null => {
    const sid = Array.from(root.classList).find((c) => /^apx-[a-z][a-z0-9]{2,11}$/.test(c))?.slice(4);
    if (!sid) return null;
    const v = viewOf(docRef.current, langRef.current);
    const pm = (v.fields.modules ?? []).find((x) => x.module.settings.id === sid);
    if (pm) return { key: moduleKeyOf(pm.id), m: pm.module };
    for (const c of v.changes) { const m = moduleOfChange(c); if (m && m.settings.id === sid && c.id) return { key: `c:${c.id}`, m }; }
    return null;
  };
  /** a click inside a module: the element of it, or the module itself on its own ground (a new page's: its block) */
  const clickInModule = (target: Element): PartHit | null => {
    const root = target.closest("[data-apx-module]");
    if (!root || root.hasAttribute("data-apx-wait")) return null;
    const mm = modOfRoot(root);
    if (!mm) return null;
    const hit = partIn(target, root, mm.m);
    if (hit.part) return { el: hit.el, mod: mm.key, part: hit.part };
    return { el: isNew ? root.closest("[data-apx-mod]") ?? root : root, mod: mm.key, part: null };
  };
  /** the module's root in the page */
  const rootOfMod = (doc0: Document, mod: string): Element | null => {
    const at = tools.moduleAt(mod);
    if (!at) return null;
    return Array.from(doc0.querySelectorAll(`.apx-${at.m.settings.id}`)).find((x) => x.hasAttribute("data-apx-module")) ?? null;
  };
  // an element asked for (just added, a row of the block's list): selected in the page once it shows there, its popup at it
  const [seekPart, setSeekPart] = useState<{ nonce: number; find: (d: Document) => PartHit | null } | null>(null);
  /** an element selected and its popup opened - at the block at once, at the element itself once the page shows it */
  const focusPart = (mod: string, field: string) => {
    const r = rowsRef.current.find((x) => x.key === mod);
    setStep("page");
    // a new page's block selected at once (the popup stands at it until its element shows); a page of the shop's
    // module is found with the element (its preview comes back from the hub first)
    if (isNew && r) setSelState({ key: mod, picked: null });
    setPopState({ kind: "part", key: `part:${mod}|${field}`, part: { mod, field } });
    if (modules.editing) modules.edit(null);
    const t0 = Date.now();
    setSeekPart((s0) => ({
      nonce: (s0?.nonce ?? 0) + 1,
      find: (doc0) => {
        const root = rootOfMod(doc0, mod);
        const at = tools.moduleAt(mod);
        if (!root || !at) return null;
        const el = findPart(root, at.m, field);
        if (el) return { el, mod, part: field };
        // not drawn (a date still empty): its popup stays at the block
        return Date.now() - t0 > 1800 ? { el: isNew ? root.closest("[data-apx-mod]") ?? root : root, mod, part: field } : null;
      },
    }));
  };
  /** an element just added: its words selected in its popup, so typing writes over them */
  const justAdded = useRef<string | null>(null);
  /** one line in "Changes made here" per element edited in one popup (typing is many changes) */
  const partEdited = useRef<string | null>(null);
  useEffect(() => { partEdited.current = null; }, [pop?.key]);
  const once = (key: string, label: string) => { if (partEdited.current === key) return undefined; partEdited.current = key; return label; };
  /** the module at `mod` changed - `label`: its line in "Changes made here" (none: the same edit going on) */
  const putPart = (mod: string, make: (m: ModuleRef) => ModuleRef | null, label?: string): boolean => {
    const at = tools.moduleAt(mod);
    const next = at ? make(at.m) : null;
    if (!at || !next) return false;
    at.put(next, label as string);
    return true;
  };
  /** an element as it is now (its popup's words) */
  const partNow = (mod: string, field: string) => { const at = tools.moduleAt(mod); return at ? partInfo(at.m, field) : null; };

  /** "Take it out" on an element of a module: out at once, the line above the blocks with its Undo */
  const takeOutAt = (mod: string, field: string): { label: string; run: () => void } | null => {
    if (!canEdit) return null;
    const at = tools.moduleAt(mod);
    const t = at ? takeOutPart(at.m, field) : null;
    if (!t) return null;
    return {
      label: t.label,
      run: () => {
        const mark = entryId;
        const a = tools.moduleAt(mod);
        const t2 = a ? takeOutPart(a.m, field) : null;
        if (!a || !t2) return;
        a.put(t2.module, t2.done);
        setSel(null);
        setWrote({ ok: true, text: `${t2.done}.`, undo: () => undoSince(mark) });
      },
    };
  };

  /**
   * "Ask AI" on ONE element of a module: its words written again from the page (the `words` task - the shop's word rules
   * run on them: no stock or delivery promise, no price), put into that element at once; its Undo takes back exactly that.
   * A point or a question is written as its two lines (its title and its line, the question and its answer).
   */
  const partAi = async (mod: string, field: string, ask: string): Promise<AiWords> => {
    if (!canAi) return { error: "The AI is not set up on this hub." };
    const at = tools.moduleAt(mod);
    const info = at ? partInfo(at.m, field) : null;
    if (!at || !info) return { error: "That element is not on the page any more." };
    const s0 = at.m.settings;
    const pt = /^points\.(\d+)$/.exec(field);
    const fq = /^faq\.(\d+)$/.exec(field);
    const pair = pt ? { a: `points.${pt[1]}.title`, b: `points.${pt[1]}.text`, now: `${s0.points[Number(pt[1])]?.title ?? ""}\n${s0.points[Number(pt[1])]?.text ?? ""}`, how: "Keep it as two lines: the first its title, the second the line under it." }
      : fq ? { a: `faq.${fq[1]}.q`, b: `faq.${fq[1]}.a`, now: `${s0.faq[Number(fq[1])]?.q ?? ""}\n${s0.faq[Number(fq[1])]?.a ?? ""}`, how: "Keep it as two lines: the first the question, the second its answer." } : null;
    const name = kindOf(at.m.type).name;
    const r = await api.ai<{ text: string; note?: string }>("words", {
      lang: langRef.current, text: (pair ? pair.now : info.words).slice(0, 3000), request: `${ask || "Write it again: clearer and more useful for a buyer."}${pair ? ` ${pair.how}` : ""}`.slice(0, 1500),
      tag: info.tag, block: `${name} - ${info.label}`.slice(0, 120),
    });
    if (!r.ok) return { error: r.error };
    const text = (r.result.text ?? "").trim();
    if (!text) return { error: "No words came back - ask again." };
    const mark = entryId;
    const before = docRef.current;
    let done = false;
    const label = `AI wrote the ${name.toLowerCase()}'s ${info.label.toLowerCase()}`;
    if (pair) {
      const [first, ...rest] = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
      done = putPart(mod, (m) => { const a = withPartWords(m, pair.a, first ?? ""); return a && rest.length ? withPartWords(a, pair.b, rest.join(" ")) ?? a : a; });
    } else done = putPart(mod, (m) => withPartWords(m, field, info.max ? text.slice(0, info.max) : text));
    if (!done) return { error: "The AI's words could not go there." };
    record(label, before, "ai", ask.slice(0, 160) || undefined);
    const said = (r.result as { note?: string }).note;
    return { undo: () => undoSince(mark), note: said ? `The AI wrote it - it is on the page. Taken out of it: ${said}.` : "The AI wrote it - it is on the page." };
  };

  /** one card of the shop: another product, WHOLE - its number, name, count, page (in the store view shown) and photo
   * (Content v13 part 6, SARCLA 11.11.2026: "links have not updated when I select the specific product") */
  const [cardBusy, setCardBusy] = useState<string | null>(null);
  const cardInto = async (mod: string, field: string, p: { name: string; number: string; url: string; img: string }) => {
    setCardBusy(`Reading ${p.number || p.name} on the shop…`);
    const r = p.number ? await api.act<{ cards: Card[] }>("module_numbers", { store: langRef.current, text: p.number, count: 1 }) : null;
    setCardBusy(null);
    const card = (r?.ok ? r.result.cards[0] : null) ?? cardOfProduct(p);
    if (!card) return;
    putPart(mod, (m) => withCard(m, field, card), `Put ${card.name} on the ${kindOf(tools.moduleAt(mod)?.m.type ?? "").name.toLowerCase()}`);
  };
  /** "Ask AI" on a card: another of the shop's products here, chosen by the AI (never one of its own) */
  const cardAi = async (mod: string, field: string, ask: string): Promise<AiWords> => {
    if (!canAi) return { error: "The AI is not set up on this hub." };
    const at = tools.moduleAt(mod);
    const i = Number(/^items\.(\d+)$/.exec(field)?.[1] ?? -1);
    const was = at?.m.settings.items[i];
    if (!at || !was) return { error: "That card is not on the page any more." };
    const store = langRef.current;
    const c = await api.act<{ candidates: unknown[] }>("module_candidates", { store, url: at.m.settings.fill?.category ?? "" });
    if (!c.ok) return { error: c.error };
    if (!c.result.candidates.length) return { error: "There is nothing to choose from yet - pick another product by its name or number." };
    const have = new Set(at.m.settings.items.map((x) => x.number).filter(Boolean));
    const r = await api.ai<{ picks: string[]; why: string }>("module_fill", { lang: store, type: at.m.type, count: 3, ask: `${ask} - one product instead of ${was.name}`.slice(0, 400), category: "", candidates: c.result.candidates });
    if (!r.ok) return { error: r.error };
    const pick = r.result.picks.find((n) => !have.has(n));
    if (!pick) return { error: "The AI found no other product that fits - say more about what it should show." };
    const p = await api.act<{ cards: Card[] }>("module_picks", { store, numbers: [pick], count: 1 });
    if (!p.ok || !p.result.cards[0]) return { error: p.ok ? "That product was not found on the shop." : p.error };
    const mark = entryId;
    const card = p.result.cards[0];
    if (!putPart(mod, (m) => withCard(m, field, card), `AI put ${card.name} on the ${kindOf(at.m.type).name.toLowerCase()}`)) return { error: "That card is not on the page any more." };
    return { undo: () => undoSince(mark), note: r.result.why || `The AI put ${card.name} here.` };
  };

  /** a picture chosen for an element (its picture, a point's, one added): put in, then selected */
  const [partPic, setPartPic] = useState<{ mod: string; field: string } | null>(null);
  const pictureInto = (mod: string, field: string, x: Picture) => {
    const name = kindOf(tools.moduleAt(mod)?.m.type ?? "").name.toLowerCase();
    if (field === "+add") {
      const at = tools.moduleAt(mod);
      const r = at ? addPicture(at.m, { url: x.url, alt: x.alt ?? x.name ?? "" }) : null;
      if (!at || !r) return;
      at.put(r.module, `Added a picture to the ${name}`);
      focusPart(mod, r.part);
      return;
    }
    if (putPart(mod, (m) => withPartPicture(m, field, { url: x.url, alt: x.alt ?? undefined, name: x.name, product: x.product ?? null }), x.product ? `Put ${x.alt || x.name || "a product"} on the ${name}` : `Changed the ${name}'s picture`)) focusPart(mod, field);
  };

  /** "Add" inside a block (its popup's Add, the "+" in the bar over it): the element there at once, selected, its popup open */
  const [addIn, setAddIn] = useState<{ anchor: HTMLElement; mod: string } | null>(null);
  const addInto = (mod: string, key: string) => {
    const at = tools.moduleAt(mod);
    if (!at || !canEdit) return;
    const r = addPart(at.m, key as AddKey);
    if (!r) return;
    if ("pick" in r) { setPartPic({ mod, field: r.pick === "feature" ? "feature" : "+add" }); return; }
    const what = addOptions(at.m).find((o) => o.key === key)?.label.toLowerCase() ?? "an element";
    if (r.module !== at.m) at.put(r.module, `Added ${what} to the ${kindOf(at.m.type).name.toLowerCase()}`);
    justAdded.current = r.part;
    focusPart(mod, r.part);
  };

  /** Content v14: an element of a list moved or duplicated - its popup follows it; a card duplicated opens on its search */
  const justPick = useRef<string | null>(null);
  /** Content v14: what a picture of a module should show, while its popup is open (Make it uses these words) */
  const partIdea = useRef<Record<string, string>>({});
  const relist = (mod: string, r: { module: ModuleRef; part: string } | null, label: string, pick = false) => {
    const at = tools.moduleAt(mod);
    if (!at || !r) return;
    at.put(r.module, label);
    if (pick) justPick.current = r.part;
    focusPart(mod, r.part);
  };
  /** Duplicate · Move up · Move down of a list's item (a point, a tile, a question, a product, a row) */
  const orderOf = (mod: string, m: ModuleRef, field: string): ItemOrder | null => {
    const o = canEdit ? partOrder(m, field) : null;
    if (!o) return null;
    const name = kindOf(m.type).name.toLowerCase();
    return {
      word: o.word,
      dup: o.dup ? () => { const a = tools.moduleAt(mod); relist(mod, a ? duplicatePart(a.m, field) : null, `Duplicated a ${o.word} of the ${name}`, /^items\.\d+$/.test(field)); } : null,
      up: o.up ? () => { const a = tools.moduleAt(mod); relist(mod, a ? movePart(a.m, field, -1) : null, `Moved a ${o.word} of the ${name} up`); } : null,
      down: o.down ? () => { const a = tools.moduleAt(mod); relist(mod, a ? movePart(a.m, field, 1) : null, `Moved a ${o.word} of the ${name} down`); } : null,
    };
  };
  /** what a list's look reaches: every tile's title alike */
  const lookNote = (field: string, word: string): string | undefined =>
    /^points\.\d+\.title$/.test(field) ? `every ${word}'s title alike` : /^points\.\d+\.text$/.test(field) ? `every ${word}'s line alike`
      : /^faq\.\d+\.q$/.test(field) ? "every question alike" : /^faq\.\d+\.a$/.test(field) ? "every answer alike" : /^table\./.test(field) ? "every cell alike" : undefined;

  /** an element's popup: its words (a text, a date, a cell), a button, a picture, a card of the shop, a point or a question */
  const partPopup = (mod: string, field: string, kick: string): { node: React.ReactNode; at: "below" | "side"; width?: number } | null => {
    const at = tools.moduleAt(mod);
    const info = at ? partInfo(at.m, field) : null;
    if (!at || !info) return null;
    const m = at.m;
    const name = kindOf(m.type).name.toLowerCase();
    const key = `${mod}|${field}`;
    const ai = aiHere ? (ask: string) => partAi(mod, field, ask) : null;
    const out = takeOutAt(mod, field);
    // the ground it stands on: the block's own, else what the page shows under it
    const grounds = groundsOfModule(m) ?? groundsOfLook(sel?.picked?.look?.ground);
    const look = lookKind(m, field);
    const fresh = justAdded.current === field;
    const order = orderOf(mod, m, field);
    const ex = /^extra\.([\w-]+)$/.exec(field);
    // Content v14: a campaign's dates - its start, the word between and its end in one popup, their look and their panel's colour
    if (ex && (DATE_KEYS as readonly string[]).includes(ex[1]) && libDef(m.type)?.fields.some((f) => f.kind === "extra" && f.key === "to")) {
      const ds = [{ k: "from", label: "Starts (e.g. 16.11.)" }, { k: "until", label: "The word between (bis, to…)" }, { k: "to", label: "Ends (e.g. 06.12.2026)" }];
      const panel = String(m.settings.extra[DATE_PANEL_KEY] ?? "");
      const panelHex = GROUNDS.find((g) => g.key === panel)?.hex ?? (/^#[0-9a-f]{6}$/i.test(panel) ? panel : "#d80901");
      return { at: "below", width: 440, node: (
        <PartPop key={key} kicker={kick} title="Its dates" canEdit={canEdit} onClose={closePop} onRemove={out} ai={ai}
          fields={ds.map((x) => ({ key: x.k, label: x.label, value: partInfo(m, `extra.${x.k}`)?.words ?? "", max: 16, onChange: (v: string) => { putPart(mod, (y) => withPartWords(y, `extra.${x.k}`, v), once(`${key}.${x.k}`, `Changed the ${name}'s dates`)); } }))}
          textLook={{ value: cleanTextLook(unpackLook(partLook(m, field))), grounds: [panelHex], large: true, note: "the dates and the word between",
            set: (next, label) => { putPart(mod, (y) => withPartLook(y, field, packLook(next)), label); } }}
          extra={(
            <Box sx={{ mt: 1.25 }}>
              <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: "#6b7785", mb: 0.6 }}>Its panel</Typography>
              <Choice value={GROUNDS.some((g) => g.key === panel) ? panel : "standard"} onChange={(v: string) => putPart(mod, (y) => ({ ...y, settings: { ...y.settings, extra: (() => { const e = { ...y.settings.extra }; if (v === "standard" || v === "red") delete e[DATE_PANEL_KEY]; else e[DATE_PANEL_KEY] = v; return e; })() } }), v === "standard" || v === "red" ? "Put the dates' panel back to red" : `Made the dates' panel ${GROUNDS.find((g) => g.key === v)?.label.toLowerCase() ?? v}`)}
                options={[{ key: "standard", label: "Red (standard)" }, ...GROUNDS.filter((g) => g.key !== "red").map((g) => ({ key: g.key, label: g.label }))]} />
            </Box>
          )}
          hint="Empty, a date is not on the page - type it and it shows." />
      ) };
    }
    if (info.kind === "words" || info.kind === "cell") {
      const put = (v: string) => putPart(mod, (x) => withPartWords(x, field, v), once(key, `Changed the ${name}'s ${info.label.toLowerCase()}`));
      return { at: "below", width: 440, node: (
        <TextPop key={key} kicker={kick} title={info.label} value={info.words} max={info.max || null} multiline={info.multiline} canEdit={canEdit} live selectAll={fresh}
          onChange={put} onDone={(v) => { put(v); justAdded.current = null; closePop(); }} onClose={() => { justAdded.current = null; closePop(); }}
          ai={ai ? (ask) => ai(ask) : null} onRemove={out} order={order}
          textLook={look === "text" ? { value: cleanTextLook(unpackLook(partLook(m, field))), grounds, large: field === "title" || /^h[1-3]$/.test(info.tag), note: lookNote(field, order?.word ?? "point"),
            set: (next, label) => { putPart(mod, (x) => withPartLook(x, field, packLook(next)), label); } } : null}
          hint={field.startsWith("extra.") && !info.words ? "Empty, it is not on the page - type it and it shows." : field === "title" ? "==word== shows a word in the shop's red." : undefined} />
      ) };
    }
    if (info.kind === "button") {
      const tile = field.startsWith("words.");
      // Content v14: the tile it stands on (its link) - its product, and "Pick another product" for it
      const onItem = tile ? itemOfLink(m, sel?.picked?.href ?? null) : null;
      const item = onItem ? m.settings.items[Number(onItem.split(".")[1])] : null;
      return { at: "below", width: MODULE_POP_WIDTH, node: (
        <ButtonPop key={key} kicker={kick} title={info.label} label={info.words} max={info.max || 60} api={api} store={d.store} canEdit={canEdit} stores={pageStores}
          onLabel={(v) => putPart(mod, (x) => withPartWords(x, field, v), once(key, `Changed the ${name}'s ${info.label.toLowerCase()}`))}
          url={tile ? undefined : info.url ?? ""} onUrl={tile ? undefined : (v) => putPart(mod, (x) => withPartUrl(x, field, v), `Changed where the ${name}'s ${info.label.toLowerCase()} goes`)}
          leads={tile ? "Each tile's button leads to that tile's own product or category (chosen in the block's settings). Every tile of this block says these words and takes the look set here." : undefined}
          look={look === "button" ? cleanButtonLook(unpackLook(partLook(m, field))) : undefined}
          onLook={look === "button" ? (next, label) => { putPart(mod, (x) => withPartLook(x, field, packLook(next)), label); } : undefined}
          grounds={grounds} fallback={field === "link" ? "red" : "petrol"} arrowDefault={field === "link" || tile}
          ai={ai ? (ask) => ai(ask) : null} onRemove={out} onClose={() => { justAdded.current = null; closePop(); }}
          fixed={item && onItem ? { text: <>This one leads to <b>{item.name}</b> - its page is the tile&apos;s {item.kind === "category" ? "category" : "product"}.</>, onPick: item.kind === "product" ? () => { justPick.current = onItem; focusPart(mod, onItem); } : () => { const r = rowsRef.current.find((x) => x.key === mod); if (r) openSettings(r); } } : null}
          hint={tile ? "Kept in the block's settings - empty, it says the shop's own words again." : undefined} />
      ) };
    }
    if (info.kind === "picture") {
      const hub = !!info.img && info.img.includes("/api/content/picture/");
      const cardPhoto = /^items\.\d+\.img$/.test(field);
      return { at: "below", width: 420, node: (
        <PicturePop key={key} kicker={kick} title={info.label} api={api} store={d.store} aspect="16:9" url={info.img ?? ""} alt={info.words} idea={partIdea.current[key] ?? ""} making={null}
          canEdit={canEdit} canMake={aiHere && imagesOn !== false} noAlt={field === "feature" || cardPhoto || /^points\.\d+\.img$/.test(field)}
          onMake={(idea) => { void makePicture(idea, "16:9", { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }).then((r) => { if (r.ok) pictureInto(mod, field, r.picture); else window.alert(r.error); }); }}
          hint={cardPhoto ? "The card stays this product - its name, number and page. A product picked under Products puts that whole product on the card." : undefined}
          onProduct={cardPhoto && info.card?.kind === "product" ? () => { const it = field.replace(/\.img$/, ""); justPick.current = it; focusPart(mod, it); } : null}
          onIdea={(idea) => { partIdea.current[key] = idea; }} onUpload={() => setPartPic({ mod, field })}
          onPick={(x) => pictureInto(mod, field, x)}
          onAlt={(alt) => { if (field !== "feature") putPart(mod, (x) => withPartWords(x, field, alt), `Wrote the ${name}'s picture's alt text`); }}
          onRemove={out ? out.run : undefined}
          onRefine={hub && aiHere && imagesOn !== false ? async (ask) => { const r = await refinePicture(info.img!, ask, "16:9", { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }); if (!r.ok) return r.error; pictureInto(mod, field, r.picture); return null; } : null}
          onClose={closePop} />
      ) };
    }
    if (info.kind === "item" && info.card) {
      return { at: "below", width: 480, node: (
        <CardPop key={key} kicker={kick} card={info.card} store={langRef.current} canEdit={canEdit} busy={cardBusy}
          onProducts={() => { const r = rowsRef.current.find((x) => x.key === mod); if (r) openSettings(r); }}
          onPick={info.card.kind === "product" ? (p) => void cardInto(mod, field, p) : null} order={order} picking={justPick.current === field}
          onPhoto={() => focusPart(mod, `${field}.img`)}
          ai={aiHere ? (ask) => cardAi(mod, field, ask) : null} onRemove={out} onClose={() => { justPick.current = null; closePop(); }} />
      ) };
    }
    if (info.kind === "point" || info.kind === "question") {
      const i = Number(field.split(".")[1]);
      const def = libDef(m.type);
      const spec = def ? specOf(def, "points") : undefined;
      const s0 = m.settings;
      const fields = info.kind === "point"
        ? [{ key: "t", label: spec?.item?.title ?? "Title", value: s0.points[i]?.title ?? "", max: 80, sub: `points.${i}.title` }, { key: "x", label: spec?.item?.text ?? "Its line", value: s0.points[i]?.text ?? "", max: 240, multiline: true, sub: `points.${i}.text` }]
        : [{ key: "q", label: "The question", value: s0.faq[i]?.q ?? "", max: 300, sub: `faq.${i}.q` }, { key: "a", label: "The answer", value: s0.faq[i]?.a ?? "", max: 1500, multiline: true, sub: `faq.${i}.a` }];
      return { at: "below", width: 440, node: (
        <PartPop key={key} kicker={kick} title={info.label} canEdit={canEdit} onClose={closePop} onRemove={out} ai={ai} order={order}
          fields={fields.map((f) => ({ ...f, onChange: (v: string) => { putPart(mod, (x) => withPartWords(x, f.sub, v), once(`${key}.${f.key}`, `Changed the ${name}'s ${info.label.toLowerCase()}`)); } }))}
          link={info.kind === "point" && spec?.links ? { api, store: d.store, value: s0.points[i]?.url ?? "", stores: pageStores, onChange: (v) => putPart(mod, (x) => withPartUrl(x, field, v), `Changed where the ${name}'s ${info.label.toLowerCase()} goes`) } : null}
          picture={info.kind === "point" && spec?.pictures ? { url: s0.points[i]?.img ?? "", onChange: () => { if (s0.points[i]?.img) focusPart(mod, `points.${i}.img`); else setPartPic({ mod, field }); }, onRemove: () => putPart(mod, (x) => withPartPicture(x, field, { url: "" }), `Took the ${name}'s picture out`) } : null} />
      ) };
    }
    return null;
  };

  /* "Take it out" where the selection is (Content v12, SARCLA 10.11.2026: "here on tile I cannot take out - also other small
   * elements, I should be able to delete them"): a tile, a question, a link, a small line, a button, a picture - a module's
   * part, a product of it; taken out at once, the line above the blocks with its Undo */
  const takeOutHere = (): { label: string; run: () => void } | null => {
    if (!sel || !canEdit) return null;
    const k = sel.key;
    const done = (text: string, mark: number) => { setSel(null); setWrote({ ok: true, text: `${text}.`, undo: () => undoSince(mark) }); };
    if (isNew && (k.startsWith("f:") || k.startsWith("b:"))) {
      const path = k.slice(2);
      const t = takeOutField(viewOf(docRef.current, langRef.current).fields, path);
      if (!t) return null;
      return { label: t.label, run: () => { const mark = entryId; const c = viewOf(docRef.current, langRef.current); const t2 = takeOutField(c.fields, path); if (!t2) return; setView({ ...c, fields: t2.fields }, t2.done); done(t2.done, mark); } };
    }
    const p = sel.picked;
    if (p?.part?.part) return takeOutAt(p.part.mod, p.part.part);
    if (!p || !(k.startsWith("nt:") || p.frag)) return null;
    const m = tools.moduleTakeOut(p);
    return m ? { label: m.label, run: () => { const mark = entryId; m.run(); if (entryId > mark) done(m.label.replace(/^Take/, "Took"), mark); } } : null;
  };
  const outHere = takeOutHere();

  /* the bar over the selection */
  const popOfSel: Pop | null = !sel ? null : sel.picked ? popFor(sel.picked)
    : sel.key.startsWith("f:") && !sel.key.startsWith("f:seo.") ? (fieldKind(sel.key.slice(2)) === "picture" ? { kind: "picture", key: sel.key } : { kind: "text", key: sel.key }) : null;
  const lastPart = (label: string) => { const p = label.split(" · "); const t = p.length > 1 ? p.slice(1).join(" · ") : label; return t.charAt(0).toUpperCase() + t.slice(1); };
  const partSel = sel?.picked?.part?.part ? partNow(sel.picked.part.mod, sel.picked.part.part) : null;
  const elLabel = !sel || wholeRow ? "" : partSel ? partSel.label : sel.key.startsWith("f:") || sel.key.startsWith("b:") ? lastPart(fieldLabel(d.fields, sel.key.slice(2)))
    : sel.key.startsWith("i:") ? "Banner" : sel.picked ? (sel.picked.tag === "img" ? "Picture" : /^h[1-6]$/.test(sel.picked.tag) || /^h[1-6]$/.test(sel.picked.box?.tag ?? "") ? "Heading" : sel.picked.text ? `“${sel.picked.text.slice(0, 24)}${sel.picked.text.length > 24 ? "…" : ""}”` : `<${sel.picked.tag}>`) : "";
  const bar = sel ? (
    <EditBar block={selRow ? { num: selRow.num, name: selRow.name, module: !!selRow.module } : null} label={elLabel && elLabel !== selRow?.name ? elLabel : null}
      onBlock={selRow && !wholeRow ? () => selectRow(selRow) : undefined}
      edit={popOfSel && pop?.key !== popOfSel.key && canEdit && !(popOfSel.kind === "settings" && selRow) ? { label: popOfSel.kind === "picture" ? "Picture" : popOfSel.kind === "settings" ? "Settings" : popOfSel.kind === "part" ? "Edit" : "Edit text", run: () => openPop(popOfSel) } : null}
      onAdd={canEdit && selRow?.module ? (el) => setAddIn({ anchor: el, mod: selRow.key }) : null}
      onSettings={selRow && !(pop?.kind === "settings" && pop.key === selRow.key) ? () => openSettings(selRow) : undefined}
      onAi={aiHere ? (partSel && popOfSel ? () => openPop(popOfSel) : selRow ? () => openPop({ kind: "ask", key: selRow.key }) : askAi) : undefined} onRemove={outHere} onClose={() => onPick(null)} />
  ) : undefined;

  /* the popup at the selection */
  // every store view the page goes to (Content v11: a link as each of them sends its visitor)
  const pageStores = [...new Set(viewsOf(doc).flatMap((v) => storesOfView(doc, v)))];
  const pageCategory = d.pageKind === "category" && d.path ? { name: d.outline?.path === d.path ? d.outline.h1[0] ?? "This category" : "This category", url: `https://www.apsoparts.com${d.path}` } : null;
  const popup0 = ((): { node: React.ReactNode; at: "below" | "side"; width?: number } | null => {
    if (!pop) return null;
    const k = pop.key;
    const kick = selRow ? `Block ${selRow.num} · ${selRow.name}` : "The page";
    if (pop.kind === "part" && pop.part) return partPopup(pop.part.mod, pop.part.field, kick);
    if (pop.kind === "text" && k.startsWith("f:")) {
      const path = k.slice(2);
      const kind = fieldKind(path);
      const title = lastPart(fieldLabel(d.fields, path));
      // Content v14: a tile, a link or a question of the page's own - Duplicate (right after it) and Move up / down
      const li = /^(benefits|links|faq)\.([a-z0-9]+)(?:\.(title|text|q|a|label))?$/i.exec(path);
      const items = li ? (d.fields[li[1] as "benefits" | "links" | "faq"] as { id: string }[]) : [];
      const at = li ? items.findIndex((x) => x.id === li[2]) : -1;
      const word = li ? (li[1] === "benefits" ? "tile" : li[1] === "links" ? "link" : "question") : "";
      const max = li ? (li[1] === "benefits" ? 8 : li[1] === "links" ? 16 : 14) : 0;
      const sub = li?.[3] ? `.${li[3]}` : "";
      const relistField = (make: (f: Fields) => { fields: Fields; id: string } | null, label: string) => {
        const cur = viewOf(docRef.current, langRef.current);
        const r = make(cur.fields);
        if (!r) return;
        setView({ ...cur, fields: r.fields }, label);
        selectField(`${li![1]}.${r.id}${sub}`);
      };
      const fieldOrder: ItemOrder | null = li && at >= 0 && canEdit ? {
        word,
        dup: items.length < max ? () => relistField((f) => { const list = f[li[1] as "benefits"] as { id: string }[]; const i = list.findIndex((x) => x.id === li[2]); if (i < 0) return null; const r = addItem(f, li[1] as ListKey, i + 1); return { id: r.id, fields: { ...r.fields, [li[1]]: (r.fields[li[1] as "benefits"] as { id: string }[]).map((x) => (x.id === r.id ? { ...list[i], id: r.id } : x)) } as Fields }; }, `Duplicated a ${word}`) : null,
        up: at > 0 ? () => relistField((f) => ({ fields: moveItem(f, li[1] as ListKey, li[2], -1), id: li[2] }), `Moved a ${word} up`) : null,
        down: at < items.length - 1 ? () => relistField((f) => ({ fields: moveItem(f, li[1] as ListKey, li[2], 1), id: li[2] }), `Moved a ${word} down`) : null,
      } : null;
      if (kind === "link") {
        const id = path.split(".")[1];
        const l = d.fields.links.find((x) => x.id === id);
        if (!l) return null;
        return { at: "below", width: 400, node: (
          <TextPop key={k} kicker={kick} title={title || "Link"} value={l.label} max={LIMIT.linkLabel} multiline={false} canEdit={canEdit} live
            onChange={(v) => setFieldText(`${path}.label`, v)} onDone={(v) => { setFieldText(`${path}.label`, v); closePop(); }} onClose={closePop} onRemove={outHere}
            ai={aiHere ? (ask) => aiField(`${path}.label`, ask) : null} order={fieldOrder} stores={pageStores}
            link={{ api, store: d.store, value: l.url, onChange: (v) => setFieldText(`${path}.url`, v), label: "The page" }}
            note={{ value: l.note, onChange: (v) => setFieldText(`${path}.note`, v), max: LIMIT.linkNote }} />
        ) };
      }
      if (kind === "button") {
        // Content v10 (point 3): its words, its page, its style, colour, size, arrow and tab
        const b = (getField(d.fields, path) ?? { label: "", url: "" }) as { label: string; url: string };
        return { at: "below", width: MODULE_POP_WIDTH, node: (
          <ButtonPop key={k} kicker={kick} label={b.label} max={LIMIT.button} onLabel={(v) => setFieldText(`${path}.label`, v)} url={b.url} onUrl={(v) => setFieldText(`${path}.url`, v)} stores={pageStores}
            api={api} store={d.store} look={buttonLookOfField(d.fields.looks[path])} grounds={groundOfField(d.fields, path)} fallback="red" canEdit={canEdit}
            onLook={(next, label) => { const cur = viewOf(docRef.current, langRef.current); setView({ ...cur, fields: setLook(cur.fields, path, fieldButtonPatchOf(next)) }, label); }}
            ai={aiHere ? (ask) => aiField(`${path}.label`, ask) : null} onClose={closePop} onRemove={outHere} />
        ) };
      }
      const value = (getField(d.fields, path) as string | undefined) ?? "";
      const long = kind === "long";
      const marks = long && !/^hero\.sub$|^cta\.text$/.test(path) ? { bold: true, list: true, link: true } : null;
      return { at: "below", width: long ? 440 : 400, node: (
        <TextPop key={k} kicker={kick} title={title} value={value} max={limitOf(path) ?? null} multiline={long} marks={marks} canEdit={canEdit} live
          onChange={(v) => setFieldText(path, v)} onDone={(v) => { setFieldText(path, v); closePop(); }} onClose={closePop}
          ai={aiHere ? (ask) => aiField(path, ask) : null} order={fieldOrder}
          textLook={tools.fieldLook(path)} onRemove={outHere} />
      ) };
    }
    if (pop.kind === "text" && sel?.picked && sel.picked.key === k) {
      const p = sel.picked;
      const mc = p.frag ? d.changes[p.frag.change] : undefined;
      const inMod = k.startsWith("nt:") || !!(mc && moduleOfChange(mc));
      // a heading's words (a span in it too), a button's, a link's: one line, no marks
      const inHeading = /^h[1-6]$/.test(p.tag) || /^h[1-6]$/.test(p.box?.tag ?? "");
      const heading = inHeading || /^(a|button|summary|label|small|strong|b|dt|th)$/.test(p.tag);
      const richOk = !inMod && !heading && /^(p|div|li|td|dd|blockquote|figcaption|span)$/.test(p.tag);
      // Content v10 (point 3): a module's button clicked on the page - its words, page and look
      const modBtn = inMod ? tools.moduleButton(p) : null;
      // the setting the words are (Content v12): its name over the box, its own words in it - never the page's capitals
      const modHit = inMod ? tools.moduleField(p) : null;
      if (modBtn) {
        return { at: "below", width: MODULE_POP_WIDTH, node: (
          <ButtonPop key={k} kicker={kick} {...modBtn} api={api} store={d.store} canEdit={canEdit} onClose={closePop} ai={aiHere ? (ask, now) => aiWords(p, ask, now) : null} stores={pageStores} onRemove={modBtn.leads ? null : outHere} />
        ) };
      }
      return { at: "below", width: 420, node: (
        <TextPop key={k} kicker={kick} title={modHit ? modHit.label : inMod ? "The module's words" : inHeading ? "Heading" : heading ? "Words" : "Text"} value={modHit ? modHit.words : p.text} multiline={!heading}
          rich={richOk ? p.inner : null} canEdit={canEdit} live={false} onClose={closePop}
          // Content v10 (point 2): its look - a page of the shop's own element (its look change), a module's words (its settings)
          textLook={inMod ? tools.moduleTextLook(p) : tools.elementLook(p)}
          onHide={!inMod ? () => { elEdit(p, { kind: "hide", on: true }); setSel(null); } : null}
          onRemove={inMod ? outHere : null}
          href={!inMod && p.tag === "a" ? p.href ?? "" : null}
          onDone={(text, html, href) => {
            if (href) elEdit(p, { kind: "attr", name: "href", value: href });
            // nothing changed (the box gives back the element's words as it cleans them): nothing written
            if (text === (modHit ? modHit.words : p.text) && (html === undefined || html === cleanRich(p.inner))) { closePop(); return; }
            const err = putWords(p, text, html && /<(?!br\b)[a-z]/i.test(html) ? html : undefined);
            if (err) { window.alert(err); return; }
            closePop();
          }}
          ai={aiHere ? (ask, now) => aiWords(p, ask, now) : null}
          hint={inMod ? "A module's words - kept in its settings too, so it stays editable there." : undefined} />
      ) };
    }
    if (pop.kind === "picture" && k.startsWith("f:")) {
      const path = k.slice(2);
      const pic = getField(d.fields, path) as Pic | undefined;
      if (!pic) return null;
      return { at: "below", width: 420, node: (
        <PicturePop key={k} kicker={kick} title={lastPart(fieldLabel(d.fields, path))} api={api} store={d.store} aspect={PICTURE_ASPECT}
          url={pic.url} alt={pic.alt} idea={pic.idea} making={making[slotKey(lang, path)] ?? null} canEdit={canEdit} canMake={aiHere && imagesOn !== false}
          onMake={(idea) => { if (idea !== pic.idea) setPic(lang, path, { idea }, "Wrote the picture's idea"); pictures.make(path, idea); }}
          onIdea={(idea) => setPic(lang, path, { idea }, "Wrote the picture's idea")}
          onUpload={() => askUpload(path)}
          onPick={(x) => setPic(lang, path, { url: x.url, alt: pic.alt || x.alt || x.prompt?.slice(0, 120) || "" }, "Put a picture in")}
          onAlt={(alt) => setPic(lang, path, { alt }, "Wrote the picture's alt text")}
          onRemove={() => setPic(lang, path, { url: "" }, "Took the picture out")}
          onRefine={aiHere && imagesOn !== false && pic.url ? (ask) => refine(path, ask) : null} onClose={closePop} />
      ) };
    }
    if (pop.kind === "picture" && sel?.picked && sel.picked.key === k) {
      const p = sel.picked;
      const hub = !!p.src && p.src.includes("/api/content/picture/");
      return { at: "below", width: 420, node: (
        <PicturePop key={k} kicker={kick} title="Picture" api={api} store={d.store} aspect="3:2" url={p.src ?? ""} alt={p.alt ?? ""} idea={null} making={null}
          canEdit={canEdit} canMake={aiHere && imagesOn !== false}
          onUpload={() => { upTo.current = { path: "", lang, el: p }; upInput.current?.click(); }}
          onPick={(x) => putPicture(p, x)} onAlt={(alt) => putAlt(p, alt)} onHide={() => { elEdit(p, { kind: "hide", on: true }); setSel(null); }}
          onRefine={hub && aiHere && imagesOn !== false ? async (ask) => { const r = await refinePicture(p.src!, ask, PICTURE_ASPECT, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }); if (!r.ok) return r.error; putPicture(p, r.picture); return null; } : null}
          onClose={closePop} />
      ) };
    }
    if (pop.kind === "settings" && k.startsWith("i:")) {
      return { at: "side", width: 360, node: (
        <PopCard kicker="A banner in the page" title="Banner" onClose={closePop}>
          <InsertPanel view={d} setView={(v) => setView(v)} id={k.slice(2)} inserts={inserts} record={(l) => record(l)} />
        </PopCard>
      ) };
    }
    // Content v11: "Ask AI" on a block, at the block - its answer applied to the block at once, with its Undo
    if (pop.kind === "ask") {
      const r = rows.find((x) => x.key === k);
      if (!r) return null;
      return { at: "side", width: 460, node: (
        <AskPop key={k} kicker={`Block ${r.num} · ${r.name}${r.module ? " · module" : ""}`} title="Ask AI about this block"
          empty={r.module ? (r.note ? "Fill it with AI" : "Write it again with AI") : isNew ? (r.state === "written" ? "Write it again with AI" : "Write it with AI") : "Make it more convincing"}
          quick={[{ label: "Make it shorter", ask: "Make its words shorter and easier to scan, same meaning." }, { label: "More convincing", ask: "Make it more convincing for a buyer - concrete benefits from the page, no hype." }]}
          onAsk={(t) => askBlock(r.key, t)} onClose={closePop} />
      ) };
    }
    // Content v10 (point 4): "Change it into another module" - the compatible modules, each with its thumbnail
    if (pop.kind === "switch") {
      const r = rows.find((x) => x.key === k);
      const o = r ? tools.optionsFor(r) : null;
      if (!r || !o) return null;
      return { at: "side", width: MODULE_POP_WIDTH, node: (
        <PopCard kicker={`Block ${r.num} · ${r.name}`} title="Change it into another module" onClose={closePop} maxBody="min(66vh, 620px)">
          <SwitchList options={o.options} keeps={o.keeps} disabled={!canEdit} first={9} columns={3} onPick={(t) => tools.switchRow(r, t)} />
        </PopCard>
      ) };
    }
    if (pop.kind === "settings") {
      const r = rows.find((x) => x.key === k);
      if (!r) return null;
      if (r.module) {
        // every module's settings as wide as a module of products' (Content v10: 620 px, so each one's number and link
        // show) - Content v11, SARCLA 10.11.2026: "make the popup wider like the product"
        return { at: "side", width: MODULE_POP_WIDTH, node: (
          <ModulePanel key={modules.editing ?? k} ctl={modules} api={api} onBack={closePop} pageCategory={pageCategory} pop={{ num: r.num }} ai={aiHere ? { run: (ask) => askBlock(r.key, ask ?? "") } : null} stores={pageStores}
            parts={{ onPart: (part) => focusPart(r.key, part), onAdd: (key) => addInto(r.key, key) }}
            onSwitch={canEdit ? (t) => tools.switchRow(r, t) : undefined} top={tools.switchedBar(r.key)} />
        ) };
      }
      if (isNew) {
        const run = fillOfBlock(r.key);
        return { at: "side", width: 360, node: (
          <BlockSettingsPop key={k} api={api} row={r} f={d.fields} setF={(fields, label) => setView({ ...d, fields }, label)} store={d.store} canEdit={canEdit} canAi={aiHere}
            busy={busyBlocks(busyHere, d.fields).includes(r.key)}
            onWrite={run ? () => void fillBlock(r.key) : undefined} onDuplicate={r.copyable ? () => dup(r) : undefined} onRemove={r.key !== "hero" ? () => removeRowAct(r) : undefined}
            onPicture={(path) => selectField(path, "picture")} onText={(path) => selectField(path)}
            onAddText={() => addBlockAt("text", blockOrder(d.fields).indexOf("sections") + 1)}
            switchTo={(() => { const o = tools.optionsFor(r); return o ? { ...o, run: (t: string) => tools.switchRow(r, t) } : null; })()} onClose={closePop} />
        ) };
      }
      const ci = r.change;
      return { at: "side", width: 340, node: (
        <ShopBlockPop key={k} row={r} look={r.selector ? elementLook(d.changes, r.selector) : undefined} onLook={r.kind === "page" ? (rule, v) => setShopLook(r, rule, v) : undefined}
          hidden={r.state === "hidden"} onHide={r.kind === "page" ? (on) => hideShop(r, on) : undefined}
          onReplace={r.kind === "page" ? () => replaceWithModule(r) : undefined} onAskAi={() => { closePop(); askAi(); }}
          onRemove={r.kind !== "page" && ci !== undefined ? () => takeOut(r) : undefined}
          onKeep={r.state === "held" && ci !== undefined ? () => keepAnyway(ci) : undefined}
          old={r.kind === "ours" && ci !== undefined && d.changes[ci]?.op === "replace" ? { shown: oldShown.includes(ci), toggle: () => toggleOld(ci) } : null}
          canEdit={canEdit} canAi={aiHere} onClose={closePop} />
      ) };
    }
    return null;
  })();
  const popup = popup0 && pop ? { ...popup0, id: `${pop.kind}|${pop.key}` } : null;
  // the block around the selection, outlined quietly in the page
  const selectedBlock = !selRow ? null : isNew ? selectionOfRow(selRow.key)
    : selRow.kind === "page" && selRow.selector ? `e:${selRow.selector}` : selRow.change !== undefined ? `e:[data-apx-c="${selRow.change}"]:not(style)` : null;
  const blockList = (
    <>
    {wrote && (
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1, px: 1.25, py: 0.75, borderRadius: "8px", bgcolor: wrote.ok ? "#f3f8f5" : "#fff8ec", border: `1px solid ${wrote.ok ? "#cfe5d8" : "#f1d9ad"}` }}>
        <Typography sx={{ flex: 1, fontSize: "0.78rem", lineHeight: 1.45, color: INK }}>{wrote.text}</Typography>
        {wrote.undo && <Button size="small" onClick={() => { wrote.undo?.(); setWrote({ ok: true, text: "Taken back - the page is as it was.", undo: null }); }} sx={{ ...btn, px: 1, minWidth: 0, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", flexShrink: 0 }}>Undo</Button>}
        <Button size="small" onClick={() => setWrote(null)} sx={{ ...btn, px: 0.5, minWidth: 0, color: MUTED, flexShrink: 0 }} aria-label="Close">×</Button>
      </Box>
    )}
    <BlockList rows={rows} selected={selRowKey} busy={rowBusy} canEdit={canEdit} onSelect={(r) => selectRow(r)} onSettings={openSettings} menu={rowMenu}
      onMove={isNew && canEdit ? moveTo : undefined} onAdd={canEdit ? addAt : undefined}
      // a new page with no block yet (Content v9): its first one added here - or, while the AI writes it, it says so
      empty={!isNew ? <><CircularProgress size={13} /> Reading the page&apos;s blocks…</>
        : busyHere === "all" ? <><CircularProgress size={13} sx={{ color: PINK }} /> The AI is choosing the page&apos;s blocks…</>
          : <><Box component="span" sx={{ flex: 1 }}>No blocks yet - the page is empty.</Box>{canEdit && <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={(e) => addAt(0, e.currentTarget)} sx={{ ...btn, color: PINK, px: 1, py: 0.25, fontSize: "0.8rem", flexShrink: 0 }}>Add a block</Button>}</>} />
    </>
  );
  // Content v12 (SARCLA 10.11.2026: "write from topic or direct or ask"): "Write it all again" a choice of three, its Undo after
  const blocksRight = isNew && canEdit && busyHere !== "all" && (filledCount(d.fields) > 0 || isLegacyBody(d)) ? (isLegacyBody(d) ? (
    <Button size="small" disabled={!aiHere || !!busyHere} onClick={() => void fill("all")} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
      sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Move the draft in with AI</Button>
  ) : <WriteAgain label="Write it all again" disabled={!aiHere || !!busyHere} busy={false} onRun={(mode, request) => void writeAgain(mode, request)} />) : undefined;

  return (
    <MakeViewsProvider value={makeViews}>
      <StudioPanes id="page" buildWidth={410} assistWidth={340} hideBuild={fold.build} hideAssist={fold.assist} wide={step === "publish"} railLabel="Assistant"
        // the left: the page's blocks only (Content v8) - a module's settings, a block's look, a text's words open on the page
        build={<Build api={api} doc={doc} d={d} lang={lang} onLang={openView} groups={groups} presence={presence} set={setDoc} setView={setView} hits={hits} step={step} onStep={setStep}
          fill={fill} busy={busyHere} canAi={aiHere} inserts={inserts} onPickPage={() => setPicking(true)} removeInsert={removeInsert}
          open={open} onOpen={setOpen} pictures={pictures} since={busyHere ? since : null} appBrief={briefNow} start={start} onSeoPropose={seoPropose}
          blocks={blockList} blocksTitle={`The page · ${rows.length} block${rows.length === 1 ? "" : "s"}`} blocksRight={blocksRight}
          readyLine={isNew ? `${rows.filter((r) => r.state === "written" || r.state === "picture").length} of ${rows.length} blocks ready${rows.some((r) => r.note) ? ` · ${rows.filter((r) => r.note).length} need${rows.filter((r) => r.note).length === 1 ? "s" : ""} something` : ""}` : undefined}
          abPart={abOn ? <AbLastStep d={d} set={(v) => setView(v)} canEdit={canEdit} running={abRunning} lit={abLit} /> : null} />}
        preview={<Stage api={api} doc={doc} d={d} lang={lang} onLang={openView} groups={groups} presence={presence} view={view} onView={setViewMode} preview={preview} selected={sel?.key ?? null} picked={sel?.picked ?? null}
          onPick={onPick} onEdit={onEdit} editNonce={editNonce} reveal={reveal} onEditWords={() => setEditNonce((n) => n + 1)} onAskAi={askAi}
          inserts={inserts} shell={shell} onFix={(left) => void fixLeftovers(left)} empty={empty}
          writing={{ blocks: marks.blocks, fields: marks.fields, pictures: makingPaths, tuning: tuningPaths, modules: { ...npModules.busyFor(lang), ...npBusy }, moduleWhy: npModules.whyFor(lang) }} working={busyHere === "rewrite" ? since : null} workingLabel={busyHere === "rewrite" ? workNote : null}
          oldShown={oldShown} onAddEl={!isNew && d.path && canEdit ? setAddPlace : undefined}
          plan={isNew ? undefined : {
            // the AI's steps and the library's modules, drawn in the page at once (Content v7, points 6 and 13)
            pending: [...plan.pending, ...modPending],
            flash: (modules.flash?.nonce ?? 0) > (plan.flash?.nonce ?? 0) ? modules.flash : plan.flash,
            onShown: (f, why) => (f.key?.startsWith("mod:") ? modules.onShown(f.key, why) : plan.onShown(f, why)),
          }}
          onAct={isNew ? onAct : undefined} bar={bar} popup={popup} toTop={toTop}
          blocks={{ onBlocks: !isNew && d.path ? setFound : undefined, seekRow, selectedBlock, onEditStart: () => openPop(null), resize: tools.resizeFor(sel?.key ?? null, selRowKey, wholeRow), inModule: clickInModule, seekPart }}
          strip={!isNew && d.path && !empty ? <VersionStrip view={d} docOrigin={lang === main ? doc.origin : null} canEdit={canEdit} busy={!!busy} onOpen={(l) => void openLetter(l)} onAdd={() => void addLetter()} onDrop={(l) => void dropLetter(l)} /> : undefined}
          adds={isNew && canEdit ? { onAdd: (at, pos) => setAddWhere({ at, pos }), onAddItem: addItemTo } : undefined}
          fold={{ ...fold, onBuild: () => toggleFold("build"), onAssist: () => toggleFold("assist") }}>
          <input ref={upInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void onUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
        </Stage>}
        assist={<SideTabs nonce={modules.tabNonce} count={MODULES.length}
          modules={<ModulesTab ctl={modules} d={d} picked={sel?.picked ?? null} openBlock={isNew && selRow && !selRow.module ? selRow.key : null} />}
          assistant={<Assistant bare quick={quick} onAsk={onAsk} enabled={canAi} context={scopeLabel} contextKind={contextKind} onClearContext={() => setSel(null)}
          ideas={ideas} onIdea={(i) => void rewrite(`${i.title}: ${i.change}`)} seo={seo} lang={lang} inputRef={askRef} placeholder={placeholder}
          said={said} onCloseSaid={() => setSaid(null)}
          plan={isNew ? null : <PlanCard ctl={plan} enabled={aiHere} />}
          translate={lang === main ? { doc, groups, busy, onTranslate: (l) => translate(l) } : null}
          // a page of the shop keeps its URL key: a new one moves the page - it is taken on the left, on purpose (Content v6)
          onUseSeo={(s) => { setView({ ...d, fields: { ...d.fields, seo: { title: s.title, description: s.description, urlKey: isNew ? s.urlKey : d.fields.seo.urlKey } } }, "Kept the search engine fields"); setSeo(null); if (!isNew) setOpen("seo"); }} />} />}
      />
      <AddBlockMenu where={addWhere} onClose={() => setAddWhere(null)} onPick={addBlockAt} onPage={blockOrder(d.fields)}
        onHero={isNew && d.fields.noHero && canEdit ? () => { const cur = viewOf(docRef.current, langRef.current); setView({ ...cur, fields: heroBack(cur.fields) }, "Put the page's hero back"); } : undefined}
        onGallery={canEdit ? (at) => modules.openGallery({ how: "block", after: blockOrder(d.fields)[at - 1] ?? "", label: `block ${at}` }) : undefined} />
      <AddPartMenu anchor={addIn?.anchor ?? null} options={addIn ? (() => { const at = tools.moduleAt(addIn.mod); return at ? addOptions(at.m) : []; })() : []} onPick={(key) => { if (addIn) addInto(addIn.mod, key); }} onClose={() => setAddIn(null)} />
      <PictureDialog open={!!partPic} onClose={() => setPartPic(null)} title="A picture for this block" projectId={api.data.piece.projectId} pieceId={api.data.piece.id}
        tabs={["upload", "mine", "project", "make"]} start="mine" aspect="16:9" onPick={(x) => { if (partPic) pictureInto(partPic.mod, partPic.field, x); setPartPic(null); }} />
      <AddElementMenu place={addPlace} onClose={() => setAddPlace(null)} onInsert={insertAt} canAi={aiHere}
        onAskAi={(text, place) => { void designBlock(text, { place }).then((m) => { if (m) window.alert(m); }); }}
        onGallery={(place) => modules.openGallery({ how: "insert", selector: place.selector, where: place.where, label: place.label })} />
    </MakeViewsProvider>
  );
}
