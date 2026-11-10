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
// app's brief - otherwise the start card asks what page is wanted.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addBlock, addItem, blockOrder, fieldLabel, filledCount, getField, onlyOnPage, setField, type ListKey, type NewBlock, type Pic,
} from "@/lib/content/studio/kinds/page/fields";
import { PART_LABEL, mergeField, mergeFill, type Candidate, type FillAnswer, type Part } from "@/lib/content/studio/kinds/page/fill";
import {
  addVersion, baseStore, carryMeta, changeId, copyView, dropVersion, pathIn, emptyPage, howToAdd, isLegacyBody, langName, langOfStore, mainView, nextPageLetter, openVersion, pageDoc, shopLanguages, shopViews, sourceHash, storeForLanguage,
  viewOf, viewsOf, withChange, withView, type LangOption, type LangVersion, type Leftover, type PageChange, type PageDoc,
} from "@/lib/content/studio/kinds/page/model";
import { lookLine, problemsLine } from "@/lib/content/studio/kinds/page/readable";
import { ITEM_NAME, PICTURE_ASPECT, blockOfPath, blocksOf, busyOf, previewOf, picturesToMake, type PictureJob } from "@/lib/content/studio/kinds/page/outline";
import type { Presence } from "@/lib/content/studio/kinds/page/shop";
import { headKey, shopPartsOf, type Located, type ShopPart } from "@/lib/content/studio/kinds/page/shopParts";
import type { Change } from "@/lib/convert/versions";
import { StudioPanes, type QuickAsk } from "../../parts";
import { useTimeline } from "../../frame";
import { PICTURE_TUNES, makePicture, refinePicture, uploadPicture } from "../../pictures";
import type { StudioProps } from "../../registry";
import { AddBlockMenu, type AddAt } from "./AddBlock";
import { AddElementMenu } from "./AddElement";
import { Assistant, type Entry, type Idea, type Said, type SeoCard } from "./Assistant";
import { Build, type AppBrief, type Step } from "./Build";
import { applyElementEdit } from "./edits";
import type { Selection } from "./Element";
import { fillOfBlock, type FillRun, type Making, type PictureCtl } from "./Fields";
import type { AddPlace, Picked } from "./Frame";
import { checkChange } from "./guard";
import { PagePicker, type Picked as PickedPage } from "./PagePicker";
import { setDocSafely } from "./safeSet";
import { LangEmpty, Stage, usePagePreview, useShell, type View } from "./Stage";
import type { SeoProposal } from "./Seo";
import { VersionStrip } from "./Versions";
import { ModuleActions } from "./modules/Actions";
import { ModuleGallery } from "./modules/Gallery";
import { ModulePanel } from "./modules/Panel";
import { useModules } from "./modules/useModules";
import { moduleOfChange } from "@/lib/content/studio/kinds/page/modules/model";

type Rewrite = { summary: string; changes: Change[]; problems: string[]; leftovers: string[] };
/** The AI's block (./block.ts): the change, what it could not put right itself, what it put right */
type BlockOut = { summary: string; change: PageChange | null; problems: string[]; fixed: string[]; leftovers: string[] };

/** A change kept back while the check looks at it - said so if the studio closes before it is done. */
const CHECKING = "Not checked yet - the check did not finish. Show it anyway, or ask again.";
const WRONG = "Looks wrong - not applied";
type Translated = { fields?: PageDoc["fields"]; changes?: Change[]; from: string; missing: number; leftovers: string[]; problems: string[] };

let entryId = 0;

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
  // a page of the shop as its parts (SARCLA's night list, 09.11.2026): where the preview found each change, a part opened
  // on the left (found in the page by its heading), and the part the AI is changing
  const [located, setLocated] = useState<Located | null>(null);
  const [seek, setSeek] = useState<{ nonce: number; heading: string } | null>(null);
  const seeking = useRef<string | null>(null);
  const [selPart, setSelPart] = useState<ShopPart | null>(null);
  const selPartRef = useRef(selPart);
  selPartRef.current = selPart;
  const [busyPart, setBusyPart] = useState<string | null>(null);
  // Content v6: what the AI is doing now, in words over the page ("Checking that it reads well…"); "Show the old one";
  // the "+" between a shop page's elements
  const [workNote, setWorkNote] = useState<string | null>(null);
  const [oldShown, setOldShown] = useState<number[]>([]);
  const [addPlace, setAddPlace] = useState<AddPlace | null>(null);
  const preview = usePagePreview(api, d, lang, view);
  const { shell, inserts } = useShell(api, d, preview.fresh);
  const shop = useMemo(() => (isNew || !d.path ? null : shopPartsOf(d.outline && d.outline.path === d.path ? d.outline : null, d.changes, located)), [isNew, d.path, d.outline, d.changes, located]);
  const partOfSection = (heading: string | undefined): ShopPart | null => {
    if (heading === undefined || !shop) return null;
    return shop.parts.find((x) => headKey(x.heading) === headKey(heading)) ?? (heading === "" ? shop.parts.find((x) => x.id === "top") ?? null : null);
  };

  /* ── the page's versions A / B / C (Content v6, SARCLA 09.11.2026: "another version of the same") ── */

  /** another version opened: the open one's list kept under its letter, the other's laid in its place (not an edit) */
  const openLetter = async (letter: string) => {
    const cur = docRef.current;
    const v = viewOf(cur, langRef.current);
    if ((v.letter || "A") === letter) return;
    setSelState(null); setSelPart(null); setLocated(null);
    await setDocSafely(api, cur, withView(cur, langRef.current, openVersion(v, letter)));
  };
  /** "+ Another version": a copy of the open one under the next letter, opened to change on its own */
  const addLetter = async () => {
    const cur = docRef.current;
    const v = viewOf(cur, langRef.current);
    const next = nextPageLetter(v);
    if (!next) return;
    record(`Made version ${next} from ${v.letter || "A"}`, cur);
    setSelState(null); setSelPart(null); setLocated(null);
    await setDocSafely(api, cur, withView(cur, langRef.current, addVersion(v)));
  };
  const dropLetter = async (letter: string) => {
    if (!window.confirm(`Remove version ${letter}? Its changes stay in the version history.`)) return;
    const cur = docRef.current;
    record(`Removed version ${letter}`, cur);
    setSelState(null); setSelPart(null); setLocated(null);
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

  const record = (label: string, before: PageDoc = docRef.current, by: "ai" | "you" = "you", note?: string) =>
    setHistory((h) => [{ id: ++entryId, label, note, at: Date.now(), lang: langRef.current, before, undone: false, by }, ...h].slice(0, 40));
  const setDoc = (next: PageDoc, label?: string) => { if (label) record(label); api.setDoc(next); };
  const setView = (next: PageDoc, label?: string) => { if (label) record(label); api.setDoc(withView(docRef.current, langRef.current, next)); };
  /** an AI answer laid over the document as it is NOW (the person may have typed while it wrote) */
  const applyView = async (make: (cur: PageDoc) => PageDoc, label: string, note?: string, forLang = langRef.current) => {
    const cur = docRef.current;
    const next = withView(cur, forLang, make(viewOf(cur, forLang)));
    record(label, cur, "ai", note);
    await setDocSafely(api, cur, next);
  };
  // the module gallery (Content v6, SARCLA 09.11.2026 points 7-9): a module is a change of the store view shown, its panel
  // takes the Build pane while it is edited (./modules/*)
  const modules = useModules({ view: () => viewOf(docRef.current, langRef.current), put: (next, label) => setView(next, label), store: lang, canEdit });
  const undo = async (e: Entry) => {
    const cur = docRef.current;
    await setDocSafely(api, cur, e.before);
    setHistory((h) => h.map((x) => (x.at >= e.at ? { ...x, undone: true } : x)));
    setSelState(null);
  };
  // "Changes made here" lives in the bar's timeline (Content v7, SARCLA 10.11.2026: "a small icon on top") - ../../frame.tsx
  useTimeline(history.map((e) => ({
    id: e.id, label: e.label, note: e.note, warn: e.warn, at: e.at, by: e.by, where: e.lang, undone: e.undone,
    undo: canEdit ? { tip: "Put the page back as it was before this (and every later change)", run: () => void undo(e) } : null,
  })));

  /* ── what is selected: the outline and the page say the same ─────────── */

  const setLang = (l: string) => { modules.edit(null); setLangState(l); setSelState(null); setSelPart(null); setLocated(null); setPicking(false); setStep("page"); if (open === "selected") setOpen(null); };
  /** A store view opened - from the tabs, "+ Store view" or the left. One the page does not have yet, of a language it has,
   * is made at once as a COPY of that store view's words (no AI): its own version from then on. Another language waits
   * in the middle for its translation. */
  const openView = (key: string) => {
    const cur = docRef.current;
    const k = baseStore(key) ?? storeFor(key);
    if (k === mainView(cur) || viewsOf(cur).includes(k) || !canEdit) { setLang(k); return; }
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
  const setSel = (s: Selection | null) => { setSelState(s); if (!s) setSelPart(null); if (!s && open === "selected") setOpen(null); };
  /** a click in the page: its part opens on the left (a new page), or the element selected (a page of the shop) */
  const onPick = (p: Picked | null) => {
    if (!p) { setSel(null); return; }
    setSelState({ key: p.key, picked: p });
    // a click inside a module of the gallery opens its settings (Content v6)
    if (p.frag) { const c = viewOf(docRef.current, langRef.current).changes[p.frag.change]; if (c?.id && moduleOfChange(c)) { modules.edit(c.id); return; } }
    setStep("page");
    // a click in a new page: its block opens in the map (an item of it too - Content v5)
    if (p.key.startsWith("f:") || p.key.startsWith("b:")) { const block = blockOfPath(p.key.slice(2)); if (block) setOpen(block); return; }
    // a part opened on the left, now found in the page: it stays open, the part itself selected
    if (seeking.current) { setOpen(`part:${seeking.current}`); seeking.current = null; return; }
    // a click in a page of the shop: the part it is in opens, the element at its top
    setSelPart(null);
    const part = p.key.startsWith("e:") ? partOfSection(p.section) : null;
    setOpen(part ? `part:${part.id}` : "selected");
  };
  /** a part of a page of the shop opened on the left: found in the page by its heading, selected, scrolled to */
  const onOpenShopPart = (p: ShopPart | null) => {
    if (!p) { setOpen(null); return; }
    setOpen(`part:${p.id}`);
    setStep("page");
    if (!p.heading) { setSelState(null); setSelPart(null); return; }
    setSelPart(p);
    seeking.current = p.id;
    setSeek((x) => ({ nonce: (x?.nonce ?? 0) + 1, heading: p.heading }));
  };
  /** a block opened in the map: selected in the page, which scrolls to it (the search engine fields are not on it) */
  const onOpenBlock = (block: string | null) => {
    setOpen(block);
    const pv = block ? previewOf(block) : null;
    if (block && pv) { setSelState({ key: `b:${pv}`, picked: null }); setReveal((n) => n + 1); }
    else setSelState(null);
  };
  /** an item of a block (a tile, a question, a link) clicked in the map: selected in the page; null = its block again */
  const onSelectKey = (key: string | null) => {
    if (!key) { onOpenBlock(open); return; }
    setSelState({ key, picked: null });
    const block = blockOfPath(key.slice(2));
    if (block) setOpen(block);
    setStep("page");
    setReveal((n) => n + 1);
  };
  /** a field in focus on the left: selected in the page */
  const onFocusPath = (path: string) => {
    const key = `f:${path}`;
    if (sel?.key === key) return;
    setSelState({ key, picked: null });
    setReveal((n) => n + 1);
  };
  const onOpenRow = (row: string | null) => {
    if (row && isNew && blockOfPath(row) === row) { onOpenBlock(row); return; }
    setOpen(row);
  };
  const askAi = () => { if (fold.assist) toggleFold("assist"); setTimeout(() => askRef.current?.focus(), 60); };

  /* ── an element's words edited in the page ───────────────────────────── */

  const onEdit = (p: Picked, v: { text: string; inner: string; outer: string }) => {
    const cur = viewOf(docRef.current, langRef.current);
    if (p.path) { setView({ ...cur, fields: setField(cur.fields, p.path, v.text) }, `Edited ${fieldLabel(cur.fields, p.path).toLowerCase()}`); return; }
    const rich = /<(?!br\b)[a-z]/i.test(v.inner) && /<[a-z]/i.test(p.inner);
    const r = applyElementEdit(cur, p, { kind: "words", text: v.text, inner: rich ? v.inner : undefined });
    if ("error" in r) { window.alert(r.error); return; }
    setView({ ...cur, changes: r.changes }, r.label);
    // the panel shows the element's new words at once
    setSelState((s) => (s && s.key === p.key && s.picked ? { ...s, picked: { ...s.picked, text: v.text, inner: v.inner, outer: v.outer } } : s));
  };

  /* ── pictures: made from the AI's idea, each in its slot ─────────────── */

  const [making, setMaking] = useState<Record<string, Making>>({});
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
    setMaking((m) => ({ ...m, [key]: { state: "making" } }));
    const r = await makePicture(job.idea, job.aspect, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id });
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

  const [gallery, setGallery] = useState<{ path: string; nonce: number } | null>(null);
  const pictures: PictureCtl = {
    making: (path) => making[slotKey(lang, path)] ?? null,
    make: (path, idea) => { void makeOne(langRef.current, { path, idea, aspect: "3:2" }, true); },
    imagesOn, gallery,
  };

  /* ── a picture slot in the page: Make it / Make another · Upload · Gallery · Remove (the flow standard) ── */

  const upInput = useRef<HTMLInputElement | null>(null);
  const upTo = useRef<{ path: string; lang: string } | null>(null);
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
    const pic = getField(viewOf(docRef.current, to.lang).fields, to.path) as Pic | undefined;
    setPic(to.lang, to.path, { url: r.picture.url, alt: pic?.alt || f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) }, "Put a picture in");
  };
  const openGallery = (path: string) => {
    const block = blockOfPath(path);
    if (fold.build) toggleFold("build");
    if (block) setOpen(block);
    setGallery((g) => ({ path, nonce: (g?.nonce ?? 0) + 1 }));
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
    setSelState({ key: `f:${path}`, picked: null });
    const block = blockOfPath(path);
    if (block) setOpen(block);
    setReveal((n) => n + 1);
    askAi();
  };
  const onAct = (path: string, act: string) => {
    const pic = getField(viewOf(docRef.current, langRef.current).fields, path) as Pic | undefined;
    if (!pic || !canEdit) return;
    if (act === "make" && pic.idea.trim() && canAi) pictures.make(path, pic.idea);
    if (act === "upload") askUpload(path);
  };
  const makingPaths = Object.entries(making).filter(([k, m]) => m.state === "making" && k.startsWith(`${lang}|`)).map(([k]) => k.slice(lang.length + 1));
  const tuningPaths = Object.entries(making).filter(([k, m]) => m.state === "making" && m.label?.startsWith("Fine") && k.startsWith(`${lang}|`)).map(([k]) => k.slice(lang.length + 1));
  const makingIn = (block: string) => makingPaths.filter((p) => blockOfPath(p) === block).length;

  /* ── the AI ──────────────────────────────────────────────────────────── */

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
      const r = await api.ai<{ answer: FillAnswer; leftovers: string[] }>(`fill_${part}`, { lang: forLang, id: opts.id ?? null, request: opts.request ?? null, candidates: cands });
      if (!r.ok) return r.error;
      if (!Object.keys(r.result.answer).length) return "Nothing came back - ask again.";
      // the whole page written: only the blocks the page has (a block taken out stays out - Content v5)
      await applyView((cur) => ({ ...cur, fields: part === "all" ? onlyOnPage(mergeFill(cur.fields, r.result.answer, opts.id), blockOrder(cur.fields)) : mergeFill(cur.fields, r.result.answer, opts.id) }),
        `AI wrote ${PART_LABEL[part as Part]}`, r.result.answer.summary ?? opts.request ?? undefined, forLang);
      wrote = true;
      return checkNote(r.result.leftovers);
    } finally {
      setBusy(null);
      // its pictures, made without another click - once the words are saved
      if (wrote && (part === "all" || part === "hero" || part === "sections" || part === "section")) setTimeout(() => void autoPictures(forLang, part, opts.id), 50);
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
    setBusyPart("page");
    try {
      await ensureOutline(forLang);
      const r = await api.ai<Rewrite>("rewrite", { lang: forLang, request });
      if (!r.ok) return r.error;
      if (!r.result.changes.length) return `No usable change came back${r.result.problems.length ? `: ${r.result.problems.join("; ")}` : ""}. Ask again, in other words.`;
      // the changes that came back the same keep their id and module; a block that is new or written again is checked
      const before = viewOf(docRef.current, forLang).changes;
      const next = carryMeta(before, r.result.changes);
      const fresh = next.filter((c) => (c.op === "replace" || c.op === "insert") && !before.some((o) => o.id === c.id && JSON.stringify(o) === JSON.stringify(c)) && !c.off);
      await applyView((cur) => ({ ...cur, changes: next.map((c) => (fresh.includes(c) ? ({ ...c, off: CHECKING } as PageChange) : c)) }), "AI changed the page", r.result.summary || request, forLang);
      setIdeas([]);
      setStep("page");
      const held: string[] = [];
      for (const c of fresh) { const m = await checkAndPlace(c.id!, forLang, { fix: true }); if (m) held.push(m); }
      const left = checkNote(r.result.leftovers);
      return [r.result.problems.length ? `Left out: ${r.result.problems.join("; ")}` : null, ...held, left].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); setBusyPart(null); setWorkNote(null); }
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
    setBusyPart(p ? (selPartRef.current?.id ?? partOfSection(p.section)?.id ?? null) : "page");
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
      await applyView((cur) => ({ ...cur, changes: withChange(cur.changes, { ...c, off: CHECKING } as PageChange) }), label, r.result.summary || request, forLang);
      setIdeas([]);
      const msg = await checkAndPlace(c.id, forLang, { fix: true, first: r.result.problems, look: lookText });
      return [msg, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); setBusyPart(null); setWorkNote(null); }
  };

  /** "Show it anyway": a change the check held back, applied as the person decides. */
  const keepAnyway = (i: number) => {
    const cur = viewOf(docRef.current, langRef.current);
    const c = cur.changes[i];
    if (!c?.off) return;
    const { off: _o, ...rest } = c;
    setView({ ...cur, changes: cur.changes.map((x, k) => (k === i ? (rest as PageChange) : x)) }, `Applied change ${i + 1} anyway`);
  };
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
    if (langOfStore(to) === langOfStore(from)) { openView(to); return `${to} is the page's own language - it is made as a copy of ${howToAdd(cur0, to).from}, no AI.`; }
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
        if (rl.ok && Object.keys(rl.result.map).length) {
          const m = rl.result.map;
          const cur = docRef.current;
          const v = viewOf(cur, to);
          const fx = (u: string) => m[u] ?? u;
          const fields = { ...v.fields, hero: { ...v.fields.hero, button: { ...v.fields.hero.button, url: fx(v.fields.hero.button.url) } }, cta: { ...v.fields.cta, button: { ...v.fields.cta.button, url: fx(v.fields.cta.button.url) } }, links: v.fields.links.map((l) => ({ ...l, url: fx(l.url) })) };
          await setDocSafely(api, cur, withView(cur, to, { ...v, fields }));
        }
        if (rl.ok && rl.result.missing.length) relinked = ` ${rl.result.missing.length} link${rl.result.missing.length === 1 ? " has" : "s have"} no ${langName(to)} page on the shop and still point${rl.result.missing.length === 1 ? "s" : ""} to the ${from} one.`;
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
    if (fold.build) toggleFold("build");
    setTimeout(() => onOpenBlock(r.key), 30);
  };
  /** "+ Tile" / "+ Question" / "+ Link" in the page: one more, selected, its fields open */
  const addItemTo = (list: string) => {
    if (list !== "benefits" && list !== "faq" && list !== "links") return;
    const cur = viewOf(docRef.current, langRef.current);
    const r = addItem(cur.fields, list as ListKey);
    setView({ ...cur, fields: r.fields }, `Added ${(ITEM_NAME[list as ListKey] ?? "an item").toLowerCase()}`);
    if (fold.build) toggleFold("build");
    setTimeout(() => onSelectKey(list === "links" ? `f:links.${r.id}` : `b:${list}.${r.id}`), 30);
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

  const scope = sel?.picked ?? null;
  const blockKey = sel?.key.startsWith("b:") ? blockOfPath(sel.key.slice(2)) : null;
  const blockInfo = blockKey ? blocksOf(d.fields).find((b) => b.key === blockKey) ?? null : null;
  // a whole block selected (not one of its items): "4 · Proof tiles"
  const wholeBlock = blockInfo && sel && previewOf(blockInfo.key) === sel.key.slice(2) ? blockInfo : null;
  const scopeLabel = !sel ? null : wholeBlock ? `${wholeBlock.num} · ${wholeBlock.name}`
    : sel.key.startsWith("f:") || sel.key.startsWith("b:") ? fieldLabel(d.fields, sel.key.slice(2)) : sel.key.startsWith("i:") ? "A banner" : selPart ? selPart.name : scope ? `<${scope.tag}> ${scope.text.slice(0, 60)}` : null;
  const fieldPath = sel?.key.startsWith("f:") ? sel.key.slice(2) : null;
  const blockPart = sel?.key.startsWith("b:") ? sel.key.slice(2) : null;
  const pictureField = !!fieldPath && /picture$|\.button$|^links\.[^.]+$/.test(fieldPath);
  const picPath = fieldPath && /(^|\.)picture$/.test(fieldPath) ? fieldPath : null;
  const selPic = picPath ? (getField(d.fields, picPath) as Pic | undefined) : undefined;
  const picActs = picPath && selPic && canEdit && !makingPaths.includes(picPath) ? {
    has: !!selPic.url, canMake: canAi && imagesOn !== false && !!selPic.idea.trim(),
    onMake: () => pictures.make(picPath, selPic.idea), onUpload: () => askUpload(picPath), onGallery: () => openGallery(picPath),
    onRemove: () => setPic(lang, picPath, { url: "" }, "Took the picture out"),
    onRefine: canAi && imagesOn !== false && selPic.url ? () => askRefine(picPath) : undefined,
  } : null;
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
        : fieldPath && !pictureField ? [
          { label: "Write it again", run: () => fill("field", { id: fieldPath }) },
          { label: "Make it shorter", run: () => fill("field", { id: fieldPath, request: "Make it shorter, same meaning." }) },
          { label: "Make it more convincing", run: () => fill("field", { id: fieldPath, request: "Make it more convincing for a buyer - concrete benefits, no hype." }) },
          ...englishAsk,
        ] : englishAsk
    ) : scope && selPart ? [
      { label: "Make this part more convincing", run: () => rewrite(`Make this part of the page ("${selPart.name}") more convincing for a buyer: clearer benefits, in the page's own facts. Keep its structure.`, scope) },
      { label: "Make it shorter", run: () => rewrite("Make this part's words shorter and easier to scan, same meaning.", scope) },
      { label: "Make it stand out", run: () => rewrite("Make this part stand out more on the page, in the shop's look (petrol, a small red accent).", scope) },
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
    { label: "Ideas for this page", run: async () => {
      if (!d.path) return "Pick the page first.";
      await ensureOutline(lang);
      const r = await api.ai<{ ideas: Idea[] }>("ideas", { lang });
      if (!r.ok) return r.error;
      setIdeas(r.result.ideas);
      return r.result.ideas.length ? null : "No idea came back - ask again.";
    } },
    { label: "Make it more convincing", run: () => rewrite("Make the page more convincing for a buyer: the reasons to order here, clearer benefits, in the page's own facts. Keep what works.") },
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
        return fill("all", { request: text });
      }
      return rewrite(text, scope);
    }
    if (/^(translate|übersetz|tradu|vertaal|przetłum)/i.test(text.trim())) {
      const to = others.find((l) => new RegExp(langName(l), "i").test(text) || new RegExp(`\\b${l}\\b`, "i").test(text));
      if (to) return translate(to);
    }
    return isNew ? fill("all", { request: text }) : rewrite(text);
  };

  /* ── written by itself only from an app's brief (SARCLA 09.11.2026: "if the project was created via an SEO brief,
   *    writing the page should be by default; otherwise the user should prompt each page he wants") ── */

  const [appBrief, setAppBrief] = useState<AppBrief | null>(null);
  const autoAsked = useRef(false);
  const emptyNew = isNew && filledCount(d.fields) === 0 && !isLegacyBody(d);
  useEffect(() => {
    if (autoAsked.current || !doc.started || !emptyNew || lang !== main) return;
    autoAsked.current = true;
    void api.act<AppBrief>("brief").then((r) => {
      if (!r.ok) return;
      setAppBrief(r.result);
      // an app's brief: the page is written at once, the blocks shimmering - once, and only while it is still empty
      if (r.result.auto && canAi && filledCount(viewOf(docRef.current, mainView(docRef.current)).fields) === 0) void fill("all");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.started, emptyNew, lang, main]);

  /* ── the page picked, and the middle ─────────────────────────────────── */

  const onPicked = (p: PickedPage) => {
    const cur = docRef.current;
    if (lang === mainView(cur)) {
      const store = p.store ?? cur.store;
      setDoc({ ...cur, env: p.env, path: p.path, store, pageKind: p.kind, outline: null, source: cur.source === "new" ? "pick" : cur.source }, cur.path ? "Picked another page" : undefined);
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
    <PagePicker api={api} store={lang === main ? d.store || "de-CH" : lang} lockStore={lang !== main} current={d.path}
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
    : sel ? (selPart || wholeBlock ? "What should change in this block?" : "What should change in this element?") : isNew ? "What should the page say or do?" : "What should change on this page?";
  // what the AI does shows in its own language only; elsewhere its buttons wait until it is done
  const busyHere = busy && busyLang === lang ? busy : null;
  const aiHere = canAi && !(busy && busyLang !== lang);
  const marks = busyOf(busyHere, d.fields);
  const contextKind = picPath ? "This picture only" : selPart && sel?.picked ? "This part only" : wholeBlock ? "This block only" : undefined;

  return (
    <>
      <StudioPanes id="page" buildWidth={410} assistWidth={340} hideBuild={fold.build} hideAssist={fold.assist}
        build={modules.editing ? (
          <ModulePanel key={modules.editing} ctl={modules} api={api} onBack={() => modules.edit(null)}
            pageCategory={d.pageKind === "category" && d.path ? { name: d.outline?.path === d.path ? d.outline.h1[0] ?? "This category" : "This category", url: `https://www.apsoparts.com${d.path}` } : null} />
        ) : <Build api={api} doc={doc} d={d} lang={lang} onLang={openView} groups={groups} presence={presence} set={setDoc} setView={setView} hits={hits} step={step} onStep={setStep}
          sel={sel} setSel={setSel} fill={fill} busy={busyHere} canAi={aiHere} onEditInPage={() => setEditNonce((n) => n + 1)} onAskAi={askAi}
          inserts={inserts} record={(label) => record(label)} onPickPage={() => setPicking(true)} removeInsert={removeInsert}
          open={open} onOpen={onOpenRow} onOpenBlock={onOpenBlock} onSelectKey={onSelectKey} onFocusPath={onFocusPath} pictures={pictures} makingIn={makingIn} since={busyHere ? since : null}
          onAdd={(at, el) => setAddWhere({ at, anchor: el })} onAddText={(at) => addBlockAt("text", at)} onRefine={canAi ? askRefine : undefined} appBrief={appBrief} onSeoPropose={seoPropose}
          moduleSlot={isNew || d.path ? <ModuleActions ctl={modules} d={d} picked={sel?.picked ?? null} /> : null}
          shop={shop ? {
            ...shop, busyPart: busyHere ? busyPart : null, onOpen: onOpenShopPart, selPart: selPart?.id ?? null,
            selIn: sel?.picked && !selPart ? partOfSection(sel.picked.section)?.id ?? null : null,
            onAsk: (p) => { onOpenShopPart(p); askAi(); },
            onRemove: (i) => setView({ ...d, changes: d.changes.filter((_, k) => k !== i) }, `Took change ${i + 1} out`),
            extra: { oldShown, onOld: toggleOld, onKeep: keepAnyway },
          } : null} />}
        preview={<Stage api={api} doc={doc} d={d} lang={lang} onLang={openView} groups={groups} presence={presence} view={view} onView={setViewMode} preview={preview} selected={sel?.key ?? null} picked={sel?.picked ?? null}
          onPick={onPick} onEdit={onEdit} editNonce={editNonce} reveal={reveal} onEditWords={() => setEditNonce((n) => n + 1)} onAskAi={askAi}
          inserts={inserts} shell={shell} onFix={(left) => void fixLeftovers(left)} empty={empty}
          writing={{ blocks: marks.blocks, fields: marks.fields, pictures: makingPaths, tuning: tuningPaths }} working={busyHere === "rewrite" ? since : null} workingLabel={busyHere === "rewrite" ? workNote : null}
          oldShown={oldShown} onAddEl={!isNew && d.path && canEdit ? setAddPlace : undefined}
          onMap={isNew ? undefined : setLocated} seek={seek} selLabel={selPart && sel?.picked ? selPart.name : wholeBlock ? `${wholeBlock.num} · ${wholeBlock.name}` : null}
          picActs={picActs} onAct={isNew ? onAct : undefined}
          strip={!isNew && d.path && !empty ? <VersionStrip view={d} docOrigin={lang === main ? doc.origin : null} canEdit={canEdit} busy={!!busy} onOpen={(l) => void openLetter(l)} onAdd={() => void addLetter()} onDrop={(l) => void dropLetter(l)} /> : undefined}
          adds={isNew && canEdit ? { onAdd: (at, pos) => setAddWhere({ at, pos }), onAddItem: addItemTo } : undefined}
          fold={{ ...fold, onBuild: () => toggleFold("build"), onAssist: () => toggleFold("assist") }}>
          <input ref={upInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void onUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
        </Stage>}
        assist={<Assistant quick={quick} onAsk={onAsk} enabled={canAi} context={scopeLabel} contextKind={contextKind} onClearContext={() => setSel(null)}
          ideas={ideas} onIdea={(i) => void rewrite(`${i.title}: ${i.change}`)} seo={seo} lang={lang} inputRef={askRef} placeholder={placeholder}
          said={said} onCloseSaid={() => setSaid(null)}
          translate={lang === main ? { doc, groups, busy, onTranslate: (l) => translate(l) } : null}
          // a page of the shop keeps its URL key: a new one moves the page - it is taken on the left, on purpose (Content v6)
          onUseSeo={(s) => { setView({ ...d, fields: { ...d.fields, seo: { title: s.title, description: s.description, urlKey: isNew ? s.urlKey : d.fields.seo.urlKey } } }, "Kept the search engine fields"); setSeo(null); if (!isNew) setOpen("seo"); }} />}
      />
      <AddBlockMenu where={addWhere} onClose={() => setAddWhere(null)} onPick={addBlockAt} onPage={blockOrder(d.fields)}
        onGallery={canEdit ? (at) => modules.openGallery({ how: "block", after: blockOrder(d.fields)[at - 1] ?? "", label: `block ${at}` }) : undefined} />
      <AddElementMenu place={addPlace} onClose={() => setAddPlace(null)} onInsert={insertAt} canAi={aiHere}
        onAskAi={(text, place) => { void designBlock(text, { place }).then((m) => { if (m) window.alert(m); }); }}
        onGallery={(place) => modules.openGallery({ how: "insert", selector: place.selector, where: place.where, label: place.label })} />
      <ModuleGallery ctl={modules} />
    </>
  );
}
