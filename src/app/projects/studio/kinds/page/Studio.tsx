"use client";
// THE PAGE STUDIO (SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should
// also contain A/B testing possibility, live preview of the pages, editing page, select a page to modify"; then, the
// same day: "it should be a real AI-assisted CMS").
//
// Build on the left (a new page's fields, or a shop page and its changes; the element selected; the test; Magento), the
// page itself in the middle - in the language chosen, as the shop will show it, every element selectable and its words
// editable in place - and the assistant on the right, for the whole page or the element selected, every change it makes
// listed with an Undo. A page is published in several languages: each is its own version, made by translating the
// whole page (the assistant) and then changed as it needs.

import { useEffect, useMemo, useRef, useState } from "react";
import { fieldLabel, setField } from "@/lib/content/studio/kinds/page/fields";
import { PART_LABEL, mergeField, mergeFill, type Candidate, type FillAnswer, type Part } from "@/lib/content/studio/kinds/page/fill";
import {
  emptyPage, isLegacyBody, langName, langsOf, mainLang, pageDoc, sourceHash, storeForLanguage, viewOf, withView,
  type LangVersion, type Leftover, type PageDoc,
} from "@/lib/content/studio/kinds/page/model";
import type { Change } from "@/lib/convert/versions";
import { StudioPanes, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import { Assistant, type Entry, type Idea, type SeoCard } from "./Assistant";
import { Build, type Step } from "./Build";
import { applyElementEdit } from "./edits";
import type { Selection } from "./Element";
import type { FillRun } from "./Fields";
import type { Picked } from "./Frame";
import { PagePicker, type Picked as PickedPage } from "./PagePicker";
import { setDocSafely } from "./safeSet";
import { LangEmpty, Stage, usePagePreview, useShell, type View } from "./Stage";

type Rewrite = { summary: string; changes: Change[]; problems: string[]; leftovers: string[] };
type Translated = { fields?: PageDoc["fields"]; changes?: Change[]; from: string; missing: number; leftovers: string[]; problems: string[] };

let entryId = 0;

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
  const [sel, setSelState] = useState<Selection | null>(null);
  const [editNonce, setEditNonce] = useState(0);
  const [view, setViewMode] = useState<View>("after");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [seo, setSeo] = useState<SeoCard | null>(null);
  const [finding, setFinding] = useState(false);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  const preview = usePagePreview(api, d, lang, view);
  const { shell, inserts } = useShell(api, d, preview.fresh);

  // the main language follows the page (a page picked in fr-CH makes French the main one)
  useEffect(() => { if (!langsOf(doc).includes(lang)) setLangState(main); }, [main, doc, lang]);

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

  const setLang = (l: string) => { setLangState(l); setSelState(null); setPicking(false); if (step === "element") setStep("page"); };
  const setSel = (s: Selection | null) => { setSelState(s); if (!s && step === "element") setStep("page"); };
  const onPick = (p: Picked | null) => { if (!p) { setSel(null); return; } setSelState({ key: p.key, picked: p }); setStep("element"); };

  /* ── an element's words edited in the page ───────────────────────────── */

  const onEdit = (p: Picked, v: { text: string; inner: string; outer: string }) => {
    const cur = viewOf(docRef.current, langRef.current);
    if (p.path) { setView({ ...cur, fields: setField(cur.fields, p.path, v.text) }, `Edited ${fieldLabel(cur.fields, p.path).toLowerCase()}`); return; }
    const rich = /<(?!br\b)[a-z]/i.test(v.inner) && /<[a-z]/i.test(p.inner);
    const r = applyElementEdit(cur, p, { kind: "words", text: v.text, inner: rich ? v.inner : undefined });
    if ("error" in r) { window.alert(r.error); return; }
    setView({ ...cur, changes: r.changes }, r.label);
  };

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
      return checkNote(r.result.leftovers);
    } finally { setBusy(null); }
  };

  const ensureOutline = async (forLang: string) => {
    const v = viewOf(docRef.current, forLang);
    if (v.source === "new" || !v.path || (v.outline?.path === v.path && v.outline.env === v.env)) return;
    await api.act("outline", { lang: forLang });
  };

  const rewrite = async (request: string, scope: Picked | null = null): Promise<string | null> => {
    const forLang = langRef.current;
    const v = viewOf(docRef.current, forLang);
    if (!v.path) return "Pick the page first.";
    setBusy("rewrite");
    try {
      await ensureOutline(forLang);
      const selector = scope ? (scope.frag ? `${scope.selector} (inside change ${scope.frag.change + 1}, an element it put in)` : scope.selector) : null;
      const r = await api.ai<Rewrite>("rewrite", { lang: forLang, request, selector, text: scope?.text.slice(0, 400) ?? null, html: scope?.outer.slice(0, 3000) ?? null });
      if (!r.ok) return r.error;
      if (!r.result.changes.length) return `No usable change came back${r.result.problems.length ? `: ${r.result.problems.join("; ")}` : ""}. Ask again, in other words.`;
      await applyView((cur) => ({ ...cur, changes: r.result.changes }), scope ? "AI changed the element" : "AI changed the page", r.result.summary || request, forLang);
      setIdeas([]);
      if (!scope) setStep("changes");
      const left = checkNote(r.result.leftovers);
      return [r.result.problems.length ? `Left out: ${r.result.problems.join("; ")}` : null, left].filter(Boolean).join(" ") || null;
    } finally { setBusy(null); }
  };

  const translate = async (to: string): Promise<string | null> => {
    if (!canAi) return "The AI is not set up on this hub.";
    const cur0 = docRef.current;
    const from = mainLang(cur0);
    if (to === from) return `${langName(to)} is the page's own language.`;
    setBusy(`translate:${to}`);
    try {
      let path = "";
      let store = storeForLanguage(to);
      if (cur0.source !== "new") {
        path = cur0.langs[to]?.path ?? "";
        if (!path) {
          const c = await api.act<{ ok: boolean; path: string | null; store: string | null; error?: string }>("counterpart", { lang: to });
          if (!c.ok) return c.error;
          if (!c.result.ok) return c.result.error ?? "The page could not be read.";
          if (!c.result.path) { setLangState(to); setPicking(true); return `The shop's ${langName(to)} page could not be found by itself - pick it in the middle, then translate again.`; }
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
      return [r.result.problems.length ? r.result.problems.join("; ") : null, checkNote(r.result.leftovers)].filter(Boolean).join(" ") || `The ${langName(to)} page is made - it shows now. Change what you like; it is its own page.`;
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

  const others = langsOf(doc).filter((l) => l !== main);
  const translateAsks: QuickAsk[] = others.map((l) => ({
    label: doc.langs[l] ? `Translate the whole page into ${langName(l)} again` : `Translate the whole page into ${langName(l)}`,
    run: () => translate(l),
  }));
  const scope = sel?.picked ?? null;
  const scopeLabel = !sel ? null : sel.key.startsWith("f:") || sel.key.startsWith("b:") ? fieldLabel(d.fields, sel.key.slice(2)) : sel.key.startsWith("i:") ? "A banner" : scope ? `<${scope.tag}> ${scope.text.slice(0, 60)}` : null;
  const fieldPath = sel?.key.startsWith("f:") ? sel.key.slice(2) : null;
  const blockPart = sel?.key.startsWith("b:") ? sel.key.slice(2) : null;
  const pictureField = !!fieldPath && /picture$|\.button$|^links\.[^.]+$/.test(fieldPath);

  const quick: QuickAsk[] = sel && !sel.key.startsWith("i:") ? (
    isNew ? (
      blockPart ? [{ label: "Write this part", run: () => (blockPart.startsWith("sections.") ? fill("section", { id: blockPart.split(".")[1] }) : fill(({ hero: "hero", "intro-block": "intro", benefits: "benefits", sections: "sections", links: "links", faq: "faq", cta: "cta" } as Record<string, Part>)[blockPart.split(".")[0]] ?? "all")) }]
        : fieldPath && !pictureField ? [
          { label: "Write it again", run: () => fill("field", { id: fieldPath }) },
          { label: "Make it shorter", run: () => fill("field", { id: fieldPath, request: "Make it shorter, same meaning." }) },
          { label: "Make it more convincing", run: () => fill("field", { id: fieldPath, request: "Make it more convincing for a buyer - concrete benefits, no hype." }) },
        ] : []
    ) : scope ? [
      { label: "Rewrite this element", run: () => rewrite("Rewrite this element's words: clearer and more useful for a buyer.", scope) },
      { label: "Make it shorter", run: () => rewrite("Make this element's words shorter, same meaning.", scope) },
      { label: "Make it stand out", run: () => rewrite("Make this element stand out more on the page, in the shop's look (petrol, a small red accent).", scope) },
    ] : []
  ) : isNew ? [
    { label: isLegacyBody(d) ? "Move the draft into the fields" : "Write the whole page", run: () => fill("all", isLegacyBody(d) ? { request: "Move the earlier draft into the fields: final words everywhere, no placeholders." } : undefined) },
    { label: "Make it more convincing", run: () => fill("all", { request: "Make every part more convincing for a buyer: concrete benefits, the reasons to order here, no hype. Keep the structure." }) },
    { label: "Make it shorter", run: () => fill("all", { request: "Make the whole page shorter and easier to scan: fewer words, the same structure." }) },
    { label: "Search engine fields", run: () => fill("seo") },
    ...(lang === main ? translateAsks : [{ label: `Translate it from ${langName(main)} again`, run: () => translate(lang) }]),
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
    ...(lang === main ? translateAsks : [{ label: `Translate it from ${langName(main)} again`, run: () => translate(lang) }]),
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
    if (/^(translate|übersetz|tradu)/i.test(text.trim())) {
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
    const c = await api.act<{ ok: boolean; path: string | null; error?: string }>("counterpart", { lang });
    setFinding(false);
    if (c.ok && c.result.ok && c.result.path) { const v = viewOf(docRef.current, lang); setView({ ...v, path: c.result.path, store: c.result.path.split("/")[1] || v.store }, `Found the ${langName(lang)} page`); }
    else setPicking(true);
  };

  const langEmpty = lang !== main && (isNew ? !d.fields.hero.title && !d.fields.intro && !d.fields.sections.length : !d.path || !d.changes.length);
  const needsPage = !isNew && lang === main && !d.path;
  const empty = picking || needsPage ? (
    <PagePicker api={api} store={lang === main ? d.store || "de-CH" : storeForLanguage(lang)} lockStore={lang !== main} current={d.path}
      title={lang === main ? undefined : `Which is the ${langName(lang)} page?`} onPick={onPicked} onClose={d.path || lang !== main ? () => setPicking(false) : undefined} />
  ) : langEmpty ? (
    <LangEmpty d={d} lang={lang} main={main} busy={busy === `translate:${lang}`} canAi={canAi} onTranslate={() => void translate(lang).then((m) => { if (m && !/is made/.test(m)) window.alert(m); })}
      onFind={!isNew && !d.path ? () => void findCounterpart() : undefined} finding={finding} />
  ) : undefined;

  const after = preview.held.after?.out;
  const hits = after?.ok ? after.hits : null;
  const placeholder = sel ? "What should change in this element?" : isNew ? "What should the page say or do?" : "What should change on this page?";

  return (
    <StudioPanes id="page" buildWidth={410} assistWidth={340}
      build={<Build api={api} doc={doc} d={d} lang={lang} onLang={setLang} set={setDoc} setView={setView} hits={hits} step={step} onStep={setStep}
        sel={sel} setSel={setSel} fill={fill} busy={busy} canAi={canAi} onEditInPage={() => setEditNonce((n) => n + 1)} onAskAi={() => askRef.current?.focus()}
        inserts={inserts} record={(label) => record(label)} onPickPage={() => setPicking(true)} removeInsert={removeInsert} />}
      preview={<Stage api={api} doc={doc} d={d} lang={lang} onLang={setLang} view={view} onView={setViewMode} preview={preview} selected={sel?.key ?? null} picked={sel?.picked ?? null}
        onPick={onPick} onEdit={onEdit} editNonce={editNonce} onEditWords={() => setEditNonce((n) => n + 1)} onAskAi={() => askRef.current?.focus()}
        inserts={inserts} shell={shell} onFix={(left) => void fixLeftovers(left)} empty={empty} />}
      assist={<Assistant quick={quick} onAsk={onAsk} enabled={canAi} context={scopeLabel} onClearContext={() => setSel(null)} history={history} onUndo={(e) => void undo(e)}
        ideas={ideas} onIdea={(i) => void rewrite(`${i.title}: ${i.change}`)} seo={seo} lang={lang} inputRef={askRef} placeholder={placeholder}
        onUseSeo={(s) => { setView({ ...d, fields: { ...d.fields, seo: { title: s.title, description: s.description, urlKey: s.urlKey } } }, "Kept the search engine fields"); setSeo(null); }} />}
    />
  );
}
