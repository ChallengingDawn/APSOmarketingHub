"use client";
// THE PAGE STUDIO (SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should
// also contain A/B testing possibility, live preview of the pages, editing page, select a page to modify"; then, the
// same day: "it should be a real AI-assisted CMS").
//
// Build on the left - the page's parts as one short outline, a click opens one part (./Build.tsx, ./Outline.tsx), the
// last step (Magento, or Publish for a test's winner) pinned at its foot; the page itself in the middle - in the
// language chosen, as the shop will show it, every element selectable and its words editable in place - and the
// assistant on the right, for the whole page or the element selected, every change it makes listed with an Undo. A page
// is published in every language the shop has (SARCLA that evening: "we should have all locales: NL, PL"): each is its own
// version, made by translating the whole page and then changed as it needs.
//
// When the AI writes, the parts it writes shimmer in the outline and in the page from the moment of the click; once it
// wrote, the pictures it had an idea for are made, a few side by side, each landing in its slot (SARCLA: "AI wrote the
// whole page ... It's not generating photos").

import { useEffect, useMemo, useRef, useState } from "react";
import { fieldLabel, getField, setField, type Pic } from "@/lib/content/studio/kinds/page/fields";
import { PART_LABEL, mergeField, mergeFill, type Candidate, type FillAnswer, type Part } from "@/lib/content/studio/kinds/page/fill";
import {
  emptyPage, isLegacyBody, langName, mainLang, pageDoc, shopLanguages, sourceHash, storeForLanguage, viewOf, withView,
  type LangOption, type LangVersion, type Leftover, type PageDoc,
} from "@/lib/content/studio/kinds/page/model";
import { BLOCK_OF, PART_KEYS, PART_NAME, busyOf, partOfPath, picturesToMake, type PartKey, type PictureJob } from "@/lib/content/studio/kinds/page/outline";
import { headKey, shopPartsOf, type Located, type ShopPart } from "@/lib/content/studio/kinds/page/shopParts";
import type { Change } from "@/lib/convert/versions";
import { StudioPanes, type QuickAsk } from "../../parts";
import { makePicture } from "../../pictures";
import type { StudioProps } from "../../registry";
import { Assistant, type Entry, type Idea, type SeoCard } from "./Assistant";
import { Build, type Step } from "./Build";
import { applyElementEdit } from "./edits";
import type { Selection } from "./Element";
import type { FillRun, Making, PictureCtl } from "./Fields";
import type { Picked } from "./Frame";
import { PagePicker, type Picked as PickedPage } from "./PagePicker";
import { setDocSafely } from "./safeSet";
import { LangEmpty, Stage, usePagePreview, useShell, type View } from "./Stage";

type Rewrite = { summary: string; changes: Change[]; problems: string[]; leftovers: string[] };
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
  const main = mainLang(doc);
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
  const preview = usePagePreview(api, d, lang, view);
  const { shell, inserts } = useShell(api, d, preview.fresh);
  const shop = useMemo(() => (isNew || !d.path ? null : shopPartsOf(d.outline && d.outline.path === d.path ? d.outline : null, d.changes, located)), [isNew, d.path, d.outline, d.changes, located]);
  const partOfSection = (heading: string | undefined): ShopPart | null => {
    if (heading === undefined || !shop) return null;
    return shop.parts.find((x) => headKey(x.heading) === headKey(heading)) ?? (heading === "" ? shop.parts.find((x) => x.id === "top") ?? null : null);
  };

  /* ── the shop's languages: every store view it has ───────────────────── */

  const [stores, setStores] = useState<string[]>([]);
  useEffect(() => {
    void api.act<{ stores: { store: string }[] }>("stores").then((r) => { if (r.ok) setStores(r.result.stores.map((s) => s.store)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const offered: LangOption[] = useMemo(() => shopLanguages(stores, doc.store), [stores, doc.store]);
  const offeredRef = useRef(offered);
  offeredRef.current = offered;
  const storeFor = (l: string) => offeredRef.current.find((o) => o.lang === l)?.store ?? storeForLanguage(l, docRef.current.store, stores);

  // the main language follows the page (a page picked in fr-CH makes French the main one)
  useEffect(() => { if (!offered.some((o) => o.lang === lang)) setLangState(main); }, [main, offered, lang]);

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
  const undo = async (e: Entry) => {
    const cur = docRef.current;
    await setDocSafely(api, cur, e.before);
    setHistory((h) => h.map((x) => (x.at >= e.at ? { ...x, undone: true } : x)));
    setSelState(null);
  };

  /* ── what is selected: the outline and the page say the same ─────────── */

  const setLang = (l: string) => { setLangState(l); setSelState(null); setSelPart(null); setLocated(null); setPicking(false); setStep("page"); if (open === "selected") setOpen(null); };
  const setSel = (s: Selection | null) => { setSelState(s); if (!s) setSelPart(null); if (!s && open === "selected") setOpen(null); };
  /** a click in the page: its part opens on the left (a new page), or the element selected (a page of the shop) */
  const onPick = (p: Picked | null) => {
    if (!p) { setSel(null); return; }
    setSelState({ key: p.key, picked: p });
    setStep("page");
    if (p.key.startsWith("f:") || p.key.startsWith("b:")) { const part = partOfPath(p.key.slice(2)); if (part) setOpen(part); return; }
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
  /** a part opened on the left: selected in the page, which scrolls to it */
  const onOpenPart = (part: PartKey | null) => {
    setOpen(part);
    const block = part ? BLOCK_OF[part] : null;
    if (part && block) { setSelState({ key: `b:${block}`, picked: null }); setReveal((n) => n + 1); }
    else setSelState(null);
  };
  /** a field in focus on the left: selected in the page */
  const onFocusPath = (path: string) => {
    const key = `f:${path}`;
    if (sel?.key === key) return;
    setSelState({ key, picked: null });
    setReveal((n) => n + 1);
  };
  const onOpenRow = (row: string | null) => {
    if ((PART_KEYS as readonly string[]).includes(row ?? "")) { onOpenPart(row as PartKey); return; }
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

  const pictures: PictureCtl = {
    making: (path) => making[slotKey(lang, path)] ?? null,
    make: (path, idea) => { void makeOne(langRef.current, { path, idea, aspect: "3:2" }, true); },
    imagesOn,
  };
  const makingPaths = Object.entries(making).filter(([k, m]) => m.state === "making" && k.startsWith(`${lang}|`)).map(([k]) => k.slice(lang.length + 1));
  const makingIn = (part: PartKey) => makingPaths.filter((p) => partOfPath(p) === part).length;

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
      await applyView((cur) => ({ ...cur, fields: mergeFill(cur.fields, r.result.answer, opts.id) }), `AI wrote ${PART_LABEL[part as Part]}`, r.result.answer.summary ?? opts.request ?? undefined, forLang);
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
    const forLang = langRef.current;
    const v = viewOf(docRef.current, forLang);
    if (!v.path) return "Pick the page first.";
    setBusy("rewrite");
    setBusyPart(scope ? (selPartRef.current?.id ?? partOfSection(scope.section)?.id ?? null) : "page");
    try {
      await ensureOutline(forLang);
      const selector = scope ? (scope.frag ? `${scope.selector} (inside change ${scope.frag.change + 1}, an element it put in)` : scope.selector) : null;
      const r = await api.ai<Rewrite>("rewrite", { lang: forLang, request, selector, text: scope?.text.slice(0, 400) ?? null, html: scope?.outer.slice(0, 3000) ?? null });
      if (!r.ok) return r.error;
      if (!r.result.changes.length) return `No usable change came back${r.result.problems.length ? `: ${r.result.problems.join("; ")}` : ""}. Ask again, in other words.`;
      await applyView((cur) => ({ ...cur, changes: r.result.changes }), scope ? "AI changed the element" : "AI changed the page", r.result.summary || request, forLang);
      setIdeas([]);
      // the parts it changed turn green on the left - the list stays as it was
      if (!scope) setStep("page");
      const left = checkNote(r.result.leftovers);
      return [r.result.problems.length ? `Left out: ${r.result.problems.join("; ")}` : null, left].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); setBusyPart(null); }
  };

  const translate = async (to: string): Promise<string | null> => {
    if (!canAi) return "The AI is not set up on this hub.";
    const cur0 = docRef.current;
    const from = mainLang(cur0);
    if (to === from) return `${langName(to)} is the page's own language.`;
    setLangState(to);
    setSelState(null);
    setStep("page");
    setBusy(`translate:${to}`, to);
    try {
      let path = "";
      let store = storeFor(to);
      if (cur0.source !== "new") {
        path = cur0.langs[to]?.path ?? "";
        if (!path) {
          const c = await api.act<{ ok: boolean; path: string | null; store: string | null; error?: string }>("counterpart", { lang: to, store });
          if (!c.ok) return c.error;
          if (!c.result.ok) return c.result.error ?? "The page could not be read.";
          if (!c.result.path) { setPicking(true); return `The shop's ${langName(to)} page could not be found by itself - pick it in the middle, then translate again.`; }
          path = c.result.path;
        }
        store = path.split("/")[1] || store;
      }
      const r = await api.ai<Translated>("translate", { to, store });
      if (!r.ok) return r.error;
      const latest = docRef.current;
      const old = latest.langs[to];
      const lv: LangVersion = {
        path, store, texts: [], outline: old?.path === path ? old.outline : null, from: r.result.from || sourceHash(latest), at: new Date().toISOString(),
        changes: r.result.changes ?? old?.changes ?? [], fields: r.result.fields ?? old?.fields ?? emptyPage().fields,
      };
      record(`Translated the page into ${langName(to)}`, latest, "ai", r.result.missing ? `${r.result.missing} text${r.result.missing === 1 ? "" : "s"} came back untranslated - check them` : undefined);
      await setDocSafely(api, latest, { ...latest, langs: { ...latest.langs, [to]: lv } });
      setLangState(to);
      setSelState(null);
      setPicking(false);
      // a new page's links to the shop: the same pages in this language
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
        if (rl.ok && rl.result.missing.length) relinked = ` ${rl.result.missing.length} link${rl.result.missing.length === 1 ? " has" : "s have"} no ${langName(to)} page on the shop and still point${rl.result.missing.length === 1 ? "s" : ""} to the ${langName(from)} one.`;
      }
      return [r.result.problems.length ? r.result.problems.join("; ") : null, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || `The ${langName(to)} page is made (${store}) - its links go to the shop's ${langName(to)} pages. Change what you like; it is its own page.${relinked}`;
    } finally { setBusy(null); }
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

  const others = offered.map((o) => o.lang).filter((l) => l !== main);
  const scope = sel?.picked ?? null;
  const wholePart = sel?.key.startsWith("b:") ? partOfPath(sel.key.slice(2)) : null;
  const scopeLabel = !sel ? null : wholePart && !sel.key.slice(2).includes(".") ? PART_NAME[wholePart]
    : sel.key.startsWith("f:") || sel.key.startsWith("b:") ? fieldLabel(d.fields, sel.key.slice(2)) : sel.key.startsWith("i:") ? "A banner" : selPart ? selPart.name : scope ? `<${scope.tag}> ${scope.text.slice(0, 60)}` : null;
  const fieldPath = sel?.key.startsWith("f:") ? sel.key.slice(2) : null;
  const blockPart = sel?.key.startsWith("b:") ? sel.key.slice(2) : null;
  const pictureField = !!fieldPath && /picture$|\.button$|^links\.[^.]+$/.test(fieldPath);
  const againAsk: QuickAsk[] = lang === main ? [] : [{ label: `Translate it from ${langName(main)} again`, run: () => translate(lang) }];

  const quick: QuickAsk[] = sel && !sel.key.startsWith("i:") ? (
    isNew ? (
      blockPart ? [{ label: "Write this part", run: () => (blockPart.startsWith("sections.") ? fill("section", { id: blockPart.split(".")[1] }) : fill(({ hero: "hero", "intro-block": "intro", benefits: "benefits", sections: "sections", links: "links", faq: "faq", cta: "cta" } as Record<string, Part>)[blockPart.split(".")[0]] ?? "all")) }]
        : fieldPath && !pictureField ? [
          { label: "Write it again", run: () => fill("field", { id: fieldPath }) },
          { label: "Make it shorter", run: () => fill("field", { id: fieldPath, request: "Make it shorter, same meaning." }) },
          { label: "Make it more convincing", run: () => fill("field", { id: fieldPath, request: "Make it more convincing for a buyer - concrete benefits, no hype." }) },
        ] : []
    ) : scope && selPart ? [
      { label: "Make this part more convincing", run: () => rewrite(`Make this part of the page ("${selPart.name}") more convincing for a buyer: clearer benefits, in the page's own facts. Keep its structure.`, scope) },
      { label: "Make it shorter", run: () => rewrite("Make this part's words shorter and easier to scan, same meaning.", scope) },
      { label: "Make it stand out", run: () => rewrite("Make this part stand out more on the page, in the shop's look (petrol, a small red accent).", scope) },
    ] : scope ? [
      { label: "Rewrite this element", run: () => rewrite("Rewrite this element's words: clearer and more useful for a buyer.", scope) },
      { label: "Make it shorter", run: () => rewrite("Make this element's words shorter, same meaning.", scope) },
      { label: "Make it stand out", run: () => rewrite("Make this element stand out more on the page, in the shop's look (petrol, a small red accent).", scope) },
    ] : []
  ) : isNew ? [
    { label: isLegacyBody(d) ? "Move the draft into the fields" : "Write the whole page", run: () => fill("all", isLegacyBody(d) ? { request: "Move the earlier draft into the fields: final words everywhere, no placeholders." } : undefined) },
    { label: "Make it more convincing", run: () => fill("all", { request: "Make every part more convincing for a buyer: concrete benefits, the reasons to order here, no hype. Keep the structure." }) },
    { label: "Make it shorter", run: () => fill("all", { request: "Make the whole page shorter and easier to scan: fewer words, the same structure." }) },
    { label: "Search engine fields", run: () => fill("seo") },
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
      return null;
    } },
    ...againAsk,
  ];

  const onAsk = async (text: string): Promise<string | null> => {
    if (sel && !sel.key.startsWith("i:")) {
      if (isNew) {
        if (fieldPath && !pictureField) return fill("field", { id: fieldPath, request: text });
        if (blockPart) return blockPart.startsWith("sections.") ? fill("section", { id: blockPart.split(".")[1], request: text }) : fill("all", { request: `${text} (for ${fieldLabel(d.fields, blockPart)} only - keep the rest as it is)` });
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

  /* ── the page picked, and the middle ─────────────────────────────────── */

  const onPicked = (p: PickedPage) => {
    const cur = docRef.current;
    if (lang === mainLang(cur)) {
      const store = p.store ?? cur.store;
      setDoc({ ...cur, env: p.env, path: p.path, store, pageKind: p.kind, outline: null, source: cur.source === "new" ? "pick" : cur.source }, cur.path ? "Picked another page" : undefined);
      setLangState(store.slice(0, 2).toLowerCase());
    } else {
      const v = viewOf(cur, lang);
      setView({ ...v, path: p.path, store: p.store ?? v.store, outline: null }, `Picked the ${langName(lang)} page`);
    }
    setPicking(false);
  };
  const removeInsert = (id: string) => setDoc({ ...docRef.current, inserts: docRef.current.inserts.filter((x) => x.id !== id) }, "Took a banner out of the page");

  const findCounterpart = async () => {
    setFinding(true);
    const c = await api.act<{ ok: boolean; path: string | null; error?: string }>("counterpart", { lang, store: storeFor(lang) });
    setFinding(false);
    if (c.ok && c.result.ok && c.result.path) { const v = viewOf(docRef.current, lang); setView({ ...v, path: c.result.path, store: c.result.path.split("/")[1] || v.store }, `Found the ${langName(lang)} page`); }
    else setPicking(true);
  };

  const translating = busy === `translate:${lang}`;
  const langEmpty = lang !== main && (isNew ? !d.fields.hero.title && !d.fields.intro && !d.fields.sections.length : !d.path || !d.changes.length);
  const needsPage = !isNew && lang === main && !d.path;
  const empty = picking || needsPage ? (
    <PagePicker api={api} store={lang === main ? d.store || "de-CH" : storeFor(lang)} lockStore={lang !== main} current={d.path}
      title={lang === main ? undefined : `Which is the ${langName(lang)} page?`} onPick={onPicked} onClose={d.path || lang !== main ? () => setPicking(false) : undefined} />
  ) : langEmpty ? (
    <LangEmpty d={d} lang={lang} main={main} store={storeFor(lang)} busy={translating} since={translating ? since : null} canAi={canAi}
      onTranslate={() => void translate(lang).then((m) => { if (m && !/is made/.test(m)) window.alert(m); })}
      onFind={!isNew && !d.path ? () => void findCounterpart() : undefined} finding={finding} />
  ) : undefined;

  const after = preview.held.after?.out;
  const hits = after?.ok ? after.hits : null;
  const placeholder = sel ? (selPart ? "What should change in this part?" : "What should change in this element?") : isNew ? "What should the page say or do?" : "What should change on this page?";
  // what the AI does shows in its own language only; elsewhere its buttons wait until it is done
  const busyHere = busy && busyLang === lang ? busy : null;
  const aiHere = canAi && !(busy && busyLang !== lang);
  const marks = busyOf(busyHere, d.fields);

  return (
    <StudioPanes id="page" buildWidth={410} assistWidth={340} hideBuild={fold.build} hideAssist={fold.assist}
      build={<Build api={api} doc={doc} d={d} lang={lang} onLang={setLang} set={setDoc} setView={setView} hits={hits} step={step} onStep={setStep}
        sel={sel} setSel={setSel} fill={fill} busy={busyHere} canAi={aiHere} onEditInPage={() => setEditNonce((n) => n + 1)} onAskAi={askAi}
        inserts={inserts} record={(label) => record(label)} onPickPage={() => setPicking(true)} removeInsert={removeInsert}
        offered={offered} open={open} onOpen={onOpenRow} onOpenPart={onOpenPart} onFocusPath={onFocusPath} pictures={pictures} makingIn={makingIn} since={busyHere ? since : null}
        shop={shop ? {
          ...shop, busyPart: busyHere ? busyPart : null, onOpen: onOpenShopPart, selPart: selPart?.id ?? null,
          selIn: sel?.picked && !selPart ? partOfSection(sel.picked.section)?.id ?? null : null,
          onAsk: (p) => { onOpenShopPart(p); askAi(); },
          onRemove: (i) => setView({ ...d, changes: d.changes.filter((_, k) => k !== i) }, `Took change ${i + 1} out`),
        } : null} />}
      preview={<Stage api={api} doc={doc} d={d} lang={lang} onLang={setLang} offered={offered} view={view} onView={setViewMode} preview={preview} selected={sel?.key ?? null} picked={sel?.picked ?? null}
        onPick={onPick} onEdit={onEdit} editNonce={editNonce} reveal={reveal} onEditWords={() => setEditNonce((n) => n + 1)} onAskAi={askAi}
        inserts={inserts} shell={shell} onFix={(left) => void fixLeftovers(left)} empty={empty}
        writing={{ blocks: marks.blocks, fields: marks.fields, pictures: makingPaths }} working={busyHere === "rewrite" ? since : null}
        onMap={isNew ? undefined : setLocated} seek={seek} selLabel={selPart && sel?.picked ? selPart.name : null}
        fold={{ ...fold, onBuild: () => toggleFold("build"), onAssist: () => toggleFold("assist") }} />}
      assist={<Assistant quick={quick} onAsk={onAsk} enabled={canAi} context={scopeLabel} contextKind={selPart && sel?.picked ? "This part only" : wholePart ? "This part only" : undefined} onClearContext={() => setSel(null)} history={history} onUndo={(e) => void undo(e)}
        ideas={ideas} onIdea={(i) => void rewrite(`${i.title}: ${i.change}`)} seo={seo} lang={lang} inputRef={askRef} placeholder={placeholder}
        translate={lang === main ? { doc, offered, busy, onTranslate: (l) => translate(l) } : null}
        onUseSeo={(s) => { setView({ ...d, fields: { ...d.fields, seo: { title: s.title, description: s.description, urlKey: s.urlKey } } }, "Kept the search engine fields"); setSeo(null); }} />}
    />
  );
}
