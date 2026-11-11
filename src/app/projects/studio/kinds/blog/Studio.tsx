"use client";
// THE BLOG STUDIO (Content v3, 08.11.2026). SARCLA, that evening: "Improve the blog page a lot, and the editing is really
// not yet fully clear. On the preview, show just the blog page."
//
// The flow: open the to-do -> the article is in the middle, exactly as a reader sees it on the shop (nothing else: no
// blog home, no other posts) -> nothing written yet? "Write the post from the brief" -> click any part to edit its words
// right there -> the assistant on the right works on the part clicked ("shorter", "for a buyer", "add a question") or on
// the whole post -> a picture: click its frame, make or upload it on the right -> the outline on the left is the map
// (each part with its state; sections added, moved, removed) -> Google, Magento and notes under the outline -> ask for
// review in the bar.
//
// cv16 (SARCLA 11.11.2026: "compare the evolution of this page to the other content types and improve them") - the Page
// builder's bar, where it fits a post: the label over a picked part moves, duplicates and takes out a block, a section, a
// question, a product, and writes a section again at once; a picture is made from the words in its own box (the newest
// ask wins, "From: ..."), or fine-tuned; "Write it all again" has the Page builder's four ways; every AI text is read
// against the shop's word rules on the server and the change's line says what was left out; a translation takes every
// part along and its links follow the language; the last step is a wide publishing view (Publish.tsx).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOG_STORES, LANGUAGE_NAME, LIMITS, blogDoc, shopUrl, slugify, storeOf, type BlogCard, type BlogDoc, type BlogSection,
} from "@/lib/content/studio/kinds/blog/model";
import { addFaq, addProduct, addSection, moveSection, oneLine, partLabel, partText, sectionOf, setPart } from "@/lib/content/studio/kinds/blog/parts";
import { doPartAction, partActions, type PartAction } from "@/lib/content/studio/kinds/blog/elements";
import { postFollowsStore } from "@/lib/content/studio/kinds/blog/publish";
import { isNewest, startJob, type SlotJobs } from "@/lib/content/studio/kinds/page/pictureJobs";
import type { WriteMode } from "../page/WriteAgain";
import { makePicture, refinePicture } from "../../pictures";
import { PictureWords, type PictureMaking } from "./PictureWords";
import { postDocument } from "@/lib/content/studio/kinds/blog/render";
import type { RichMode } from "@/lib/content/studio/kinds/blog/richEdit";
import { AssistantPanel, Field, Label, PINK, Pane, StudioPanes, btn, field, mainBtn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { EditFrame, type Device } from "./EditFrame";
import { Outline } from "./Outline";
import { setDocSafely } from "./safeSet";
import { addChange, madeLanguages, versionLabel, versionOf, type StudioChange } from "@/lib/content/studio/kinds/blog/changes";
import { BLUE, ChangesList, Hint, PictureSlot, TranslateRow, Working, shopPageSearch, toolBtn, useSettled } from "./ui";

export const LANGS = ["DE", "FR", "IT", "EN", "NL", "PL"] as const;
/** The page's width on a computer: the article's column and its contents at their real size, zoomed less. */
const DESKTOP = 1040;

type Outline = Pick<BlogDoc, "title" | "slug" | "metaTitle" | "metaDescription" | "excerpt" | "sections" | "faq" | "tags" | "takeaways"> & {
  cta: { title: string; text: string; label: string }; picture: string; pictureAlt: string; heroCaption?: string; authorRole?: string;
  /** what the shop's word rules left out (server: lib/content/studio/kinds/blog/guard.ts) */
  note?: string;
};
/** What the change's line says of what the shop's word rules left out. */
const ruled = (note?: string) => (note ? ` Left out by the shop's word rules: ${note}.` : "");
type Work = { label: string; key: string | null; since: number } | null;

/** The AI's sections laid over the post's: a picture already in place stays with the section at the same place. */
function keepPictures(next: BlogSection[], cur: BlogSection[], translated = false): BlogSection[] {
  return next.map((s, i) => (cur[i]?.image.url
    // a translation: what the picture shows and the line under it in the new language (cv16 - every part goes along)
    ? { ...s, image: { ...cur[i].image, alt: translated ? s.image.alt || cur[i].image.alt : cur[i].image.alt || s.image.alt, caption: translated ? s.image.caption || cur[i].image.caption : cur[i].image.caption } }
    : s));
}

const isPicture = (key: string | null) => !!key && (key === "hero" || /^s:[^:]+:img$/.test(key));
/** The name a to-do gets when nobody typed one ("Untitled blog article"): never the post's topic. */
const untitled = (t: string) => !t.trim() || /^untitled\b/i.test(t.trim());

/** The parts whose words are edited AS they look (bold bold, red red - Content v4) and how their words are kept; the
 *  title, the band's words, a caption and a product's name have no marks: plain words. */
function richOf(key: string): RichMode | null {
  if (key === "lead" || /^s:[^:]+:(h|q)$/.test(key) || /^faq:[^:]+:q$/.test(key)) return "inline";
  if (key === "short" || /^s:[^:]+:b:\d+$/.test(key) || /^faq:[^:]+:a$/.test(key)) return "blocks";
  return null;
}

/* ── what the picked part needs besides its words (on the right, above the assistant's asks) ─────────────────────── */

function TopicEditor({ d, set, canEdit }: { d: BlogDoc; set: (d: BlogDoc) => void; canEdit: boolean }) {
  const [topic, setTopic] = useState("");
  const add = () => {
    const t = topic.replace(/,/g, " ").trim();
    if (t && !d.tags.includes(t) && d.tags.length < LIMITS.tags) set({ ...d, tags: [...d.tags, t] });
    setTopic("");
  };
  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        {d.tags.map((t, i) => (
          <Box key={t} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.25, height: 28, border: `1px solid ${i === 0 ? "#d80901" : HAIRLINE}`, borderRadius: "4px", bgcolor: "#fff", fontSize: "0.8rem", fontWeight: 600, color: i === 0 ? "#b00700" : INK }}>
            {t}
            {canEdit && <IconButton size="small" aria-label={`Remove ${t}`} onClick={() => set({ ...d, tags: d.tags.filter((x) => x !== t) })} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>}
          </Box>
        ))}
      </Box>
      {canEdit && d.tags.length < LIMITS.tags && (
        <TextField fullWidth size="small" placeholder="A topic, then Enter (O-rings, Food industry…)" value={topic} sx={field}
          onChange={(e) => (e.target.value.endsWith(",") ? add() : setTopic(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} />
      )}
      <Hint>The first one (in red) shows above the title; each topic has a page of its own on the blog.</Hint>
    </Box>
  );
}

function Products({ d, set, canEdit, picked, onPick }: { d: BlogDoc; set: (d: BlogDoc) => void; canEdit: boolean; picked: string | null; onPick: (key: string) => void }) {
  const up = (id: string, p: Partial<BlogDoc["relatedProducts"][number]>) => set({ ...d, relatedProducts: d.relatedProducts.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  return (
    <Box>
      {d.relatedProducts.map((p) => (
        <Box key={p.id} sx={{ p: 1.25, pb: 0.25, mb: 1, borderRadius: "8px", border: `1px solid ${picked === `prod:${p.id}` ? BLUE : HAIRLINE}`, bgcolor: "#fff" }} onClick={() => onPick(`prod:${p.id}`)}>
          <Field label="Name" value={p.name} disabled={!canEdit} onChange={(v) => up(p.id, { name: v })} />
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-start" }}>
            <Field label="Its page on the shop" value={p.url} disabled={!canEdit} placeholder={`https://www.apsoparts.com/${d.store}/…`} onChange={(v) => up(p.id, { url: v.trim() })} />
            {canEdit && <IconButton size="small" sx={{ mt: 0.5 }} aria-label="Remove the product" onClick={() => set({ ...d, relatedProducts: d.relatedProducts.filter((x) => x.id !== p.id) })}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>}
          </Box>
        </Box>
      ))}
      {canEdit && <Button size="small" startIcon={<AddIcon />} onClick={() => { const r = addProduct(d); set(r.doc); onPick(`prod:${r.id}`); }} sx={toolBtn}>Add a product</Button>}
      <Hint>Shop pages only, by their address - the card shows the name and leads there.</Hint>
    </Box>
  );
}

function Author({ api, d, set, canEdit }: { api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; canEdit: boolean }) {
  const p = api.data.piece;
  return (
    <Box>
      <Field label="Author" value={d.author} disabled={!canEdit} onChange={(v) => set({ ...d, author: v })} />
      <Field label="Their role" value={d.authorRole} disabled={!canEdit} placeholder="Product manager seals" onChange={(v) => set({ ...d, authorRole: v })} />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <TextField size="small" type="date" label="Publishing day" value={d.publishAt} disabled={!canEdit} onChange={(e) => set({ ...d, publishAt: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, mb: 1.25 }} />
        <TextField select size="small" label="Store view" value={BLOG_STORES.includes(d.store) ? d.store : ""} disabled={!canEdit} onChange={(e) => set({ ...d, store: e.target.value })} sx={{ ...field, mb: 1.25 }}>
          {BLOG_STORES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Box>
      {p.dueDate && !d.publishAt && <Hint mt={-0.5}>Until it has a publishing day, the post shows its day on the content calendar ({p.dueDate}).</Hint>}
    </Box>
  );
}

/** A picture of the post: the picture with Change / Remove, what it shows, the line under it - or, without one, the
 *  hub's picture panel: make it from the idea (prefilled), upload one, or pick one already made. */
/** A picture made or uploaded lands up to 40 s later: on the post as it is then, never on an older copy. `from`: the words
 *  the ask started from - words typed in the box since are the person's and stay there. */
function landPicture(api: StudioApi, d: BlogDoc, pkey: string, x: { url: string; prompt?: string | null; alt?: string | null }, from?: string) {
  const sid = sectionOf(pkey);
  api.setDoc((raw: unknown) => {
    const cur = blogDoc(raw, { language: d.language, author: d.author, title: d.title });
    const sec = sid ? cur.sections.find((y) => y.id === sid) : null;
    if (sid && !sec) return cur;
    const was = sec ? sec.image : cur.hero;
    const typed = from !== undefined && !!was.prompt.trim() && was.prompt !== from;
    const next = { ...was, url: x.url, alt: x.alt || was.alt || (sec ? sec.heading : cur.title), prompt: typed ? was.prompt : x.prompt ?? was.prompt };
    return sec ? { ...cur, sections: cur.sections.map((y) => (y.id === sec.id ? { ...y, image: next } : y)) } : { ...cur, hero: next };
  });
}

/** The words a picture starts from: the AI's idea, else its section's heading or the post's title. */
const ideaOf = (d: BlogDoc, s: BlogSection | null, pic: BlogDoc["hero"]) =>
  pic.prompt || (s ? `${s.heading}${d.title ? ` - for a blog article "${d.title}"` : ""}` : [d.title, d.excerpt].filter(Boolean).join(" - "));

function Picture({ api, d, set, pkey, canEdit, making, error, onMake }: {
  api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; pkey: string; canEdit: boolean;
  making: PictureMaking | null; error: string | null; onMake: (pkey: string, words: string, how: "make" | "tune") => void;
}) {
  const p = api.data.piece;
  const sid = sectionOf(pkey);
  const s = sid ? d.sections.find((x) => x.id === sid) ?? null : null;
  const pic = s ? s.image : d.hero;
  const put = (next: BlogDoc["hero"]) => set(s ? { ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, image: next } : x)) } : { ...d, hero: next });
  const idea = ideaOf(d, s, pic);
  return (
    <Box>
      {/* the slot: the picture, Upload, Gallery, Remove - made from words in the box under it (cv16) */}
      <PictureSlot url={pic.url} alt={pic.alt} aspect={s ? "3:2" : "16:9"} suggestion={idea} projectId={p.projectId} pieceId={p.id} me={api.data.me} disabled={!canEdit}
        tabs={["upload", "project", "mine"]} onPick={(x) => landPicture(api, d, pkey, x)}
        onAlt={(alt) => put({ ...pic, alt })} onRemove={() => put({ ...pic, url: "" })} altLabel="What it shows (for Google)" />
      {canEdit && (
        <PictureWords words={idea} onWords={(w) => put({ ...pic, prompt: w })} hasPicture={!!pic.url} canTune={pic.url.startsWith("/api/content/picture/")}
          making={making} error={error} disabled={!canEdit} onMake={(w) => onMake(pkey, w, "make")} onTune={(ask) => onMake(pkey, ask, "tune")} />
      )}
      {pic.url && <Box sx={{ mt: 1.25 }}><Field label="A line under it (optional)" value={pic.caption} disabled={!canEdit} onChange={(v) => put({ ...pic, caption: v })} /></Box>}
    </Box>
  );
}

/* ── the studio ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export default function Studio({ api }: StudioProps) {
  const p = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const me = api.data.people.find((x) => x.username === api.data.me)?.name ?? api.data.me;
  const d = useMemo(() => blogDoc(api.doc, { language: p.language, author: me, title: p.title }), [api.doc, p.language, p.title, me]);
  const docRef = useRef(d);
  docRef.current = d;
  const set = useCallback((next: BlogDoc) => api.setDoc(next), [api]);

  const [sel, setSel] = useState<string | null>(null);
  /** the pictures being made (by their part): each breathes in the page; the newest ask of a part wins (cv16) */
  const [pics, setPics] = useState<Record<string, PictureMaking>>({});
  const [picErr, setPicErr] = useState<Record<string, string>>({});
  const jobs = useRef<SlotJobs>({});
  const picBusy = Object.keys(pics)[0] ?? null;
  /** the last step open: the build column twice as wide, the assistant a thin rail (the Page builder's publishing view) */
  const [publishing, setPublishing] = useState(false);
  const [focus, setFocus] = useState<{ key: string; at: number } | null>(null);
  const [editKey, setEditKey] = useState<{ key: string; at: number } | null>(null);
  const [open, setOpen] = useState<string[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [work, setWork] = useState<Work>(null);
  // what each change of this sitting replaced, for its Undo (the list itself is kept in the post: it survives a reload)
  const befores = useRef(new Map<number, Partial<BlogDoc>>());
  /** the language being made by a translation */
  const [tl, setTl] = useState<string | null>(null);
  const [cards, setCards] = useState<BlogCard[] | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  // a link's address: the shop's pages in the post's store view, found as it is typed
  const linkSearch = useMemo(() => shopPageSearch(d.store), [d.store]);

  // every blog post of the hub this person can see - for the blog's home in the paste
  const readCards = useCallback(async () => {
    const r = await fetch(`/api/content/studio/blog/${p.id}/posts`).then((x) => x.json()).catch(() => null) as { ok: boolean; cards?: BlogCard[] } | null;
    setCards(r?.ok && r.cards ? r.cards : []);
  }, [p.id]);
  useEffect(() => { void readCards(); }, [readCards]);

  // a part that is gone (a section removed, the AI's new sections) is not picked any more
  useEffect(() => { if (sel && partText(d, sel) === null && !isPicture(sel) && !["tags", "author", "faq", "prods", "cta"].includes(sel)) setSel(null); }, [d, sel]);

  const settled = useSettled(d, 120);
  const html = useMemo(() => postDocument(settled, { due: p.dueDate, edit: { open } }), [settled, p.dueDate, open]);

  const pick = (key: string | null, scroll = false) => { setSel(key); if (key && scroll) setFocus({ key, at: Date.now() }); };

  /** An answer laid over the post as it is now: listed in "Changes made here" (kept in the post), what it replaced kept for
   *  Undo in this sitting and, as a version saved just before, for going back after a reload. */
  const lay = async (patch: Partial<BlogDoc>, text: string, lang?: string) => {
    const entry: StudioChange = { id: Date.now(), text, at: new Date().toISOString(), ...(lang ? { lang, from: docRef.current.language.toUpperCase() } : {}) };
    // kept quietly (09.11.2026): no line on the project's feed per AI change, the newest 20 kept, Versions names it
    await api.keepVersion?.(versionLabel(entry));
    const cur = docRef.current;
    const keys = Object.keys(patch) as (keyof BlogDoc)[];
    befores.current.set(entry.id, Object.fromEntries(keys.map((k) => [k, cur[k]])) as Partial<BlogDoc>);
    await setDocSafely(api, cur, { ...cur, ...patch, changes: addChange(cur.changes, entry) });
  };
  const undoMode = (c: StudioChange): "undo" | "back" | null => (befores.current.has(c.id) ? "undo" : versionOf(api.data.versions, c.id) ? "back" : null);
  const undo = async (c: StudioChange) => {
    const cur = docRef.current;
    const before = befores.current.get(c.id);
    if (before) {
      befores.current.delete(c.id);
      await setDocSafely(api, cur, { ...cur, ...before, changes: (cur.changes ?? []).filter((x) => x.id !== c.id) });
      return;
    }
    const v = versionOf(api.data.versions, c.id);
    if (!v || !window.confirm("Go back to the post as it was before this change? What was done after it goes too - the post as it is now is kept in Versions.")) return;
    await api.saveVersion("Before going back");
    if (!(await api.restore(v.id))) window.alert("Going back did not work - try again, or pick the version in Versions in the bar.");
  };
  /** The assistant at work: the band over the preview, the part it works on breathing. */
  const busyRun = async (label: string, key: string | null, fn: () => Promise<string | null>) => {
    setWork({ label, key, since: Date.now() });
    try { return await fn(); } finally { setWork(null); }
  };

  /** The whole post written by the AI: from the brief, again (its ways - cv16), or translated. */
  const write = (request: string, language?: string, mode?: "topic" | "directly" | "ask") => { if (language) setTl(language); return busyRun(language ? `Translating the post into ${LANGUAGE_NAME[language] ?? language}…` : mode === "topic" ? "Writing the post new from the topic…" : docRef.current.sections.length ? "Writing the post again…" : "Writing the post from the brief - about a minute or two…", null, async () => {
    const ask = language ? `Translate the whole post into ${LANGUAGE_NAME[language] ?? language}, faithfully.${request ? ` ${request}` : ""}` : request;
    // the to-do's name in the bar is the topic while the post's own title is still "Untitled …"
    const topic = untitled(docRef.current.title) ? p.title : docRef.current.title;
    const r = await api.ai<Outline>("outline", { topic, request: ask, ...(language ? { language } : {}), ...(mode && !language ? { mode } : {}) });
    if (!r.ok) return r.error;
    const x = r.result;
    if (!x.sections.length) return "No post came back - ask again.";
    const cur = docRef.current;
    const lg = language ?? cur.language;
    const patch: Partial<BlogDoc> = {
      title: x.title || cur.title, slug: language ? x.slug || slugify(x.title) : cur.slug && cur.slug !== slugify(cur.title) ? cur.slug : x.slug || cur.slug,
      metaTitle: x.metaTitle, metaDescription: x.metaDescription, excerpt: x.excerpt, takeaways: x.takeaways,
      sections: keepPictures(x.sections, cur.sections, !!language), faq: x.faq.length ? x.faq : cur.faq,
      tags: language || !cur.tags.length ? x.tags : cur.tags,
      cta: { ...cur.cta, title: x.cta.title, text: x.cta.text, label: x.cta.label },
      hero: language
        ? { ...cur.hero, prompt: x.picture || cur.hero.prompt, alt: x.pictureAlt || cur.hero.alt, caption: x.heroCaption || cur.hero.caption }
        : { ...cur.hero, prompt: x.picture || cur.hero.prompt, alt: cur.hero.alt || x.pictureAlt },
      ...(language ? { language: lg, store: storeOf(lg), authorRole: x.authorRole || cur.authorRole } : {}),
    };
    // a translation's links follow the language: /de-CH/... in the text, the band's button and the products become the new
    // store view's (cv16 - the Page builder's "products and links follow the language")
    const moved = language ? postFollowsStore({ excerpt: patch.excerpt ?? "", sections: patch.sections ?? [], faq: patch.faq ?? [], cta: { ...cur.cta, ...patch.cta }, relatedProducts: cur.relatedProducts }, cur.store, storeOf(lg)) : null;
    await lay(moved ? { ...patch, ...moved } : patch, (language
      ? `Translated into ${LANGUAGE_NAME[lg] ?? lg}: ${x.sections.length} sections, ${x.faq.length} questions, the pictures' words, store view ${storeOf(lg)} - its links and products follow it.`
      : `${mode === "topic" ? "Written new from the topic" : mode === "directly" ? "Written again, better" : mode === "ask" ? "Written again as you asked" : "The post"}: ${x.sections.length} sections, ${x.takeaways.length} lines "in short", ${x.faq.length} questions, Google's texts and the band to the shop.${cur.hero.url ? "" : " Its picture: click the empty frame under the title."}`) + ruled(x.note), language);
    setSel(null);
    return null;
  }).finally(() => setTl(null)); };

  /** "Write it all again" (the Page builder's own choice, ../page/WriteAgain.tsx): its four ways. */
  const writeAgain = (mode: WriteMode, request?: string) => {
    if (mode === "reset") {
      const cur = docRef.current;
      void lay({
        excerpt: "", takeaways: [], sections: [], faq: [], metaTitle: "", metaDescription: "", hero: { url: "", alt: "", caption: "", prompt: "" },
        cta: { ...cur.cta, title: "", text: "", label: "" },
      }, "Started again - the post is empty (its title, author, day, store view, topics and products kept).");
      setSel(null);
      return;
    }
    void write(request ?? "", undefined, mode === "better" ? "directly" : mode);
  };

  /** A picture made from words, or fine-tuned - the newest ask of a part is the one that lands (page/pictureJobs.ts). */
  const makePic = async (pkey: string, words: string, how: "make" | "tune") => {
    const cur = docRef.current;
    const sid0 = sectionOf(pkey);
    const s = sid0 ? cur.sections.find((x) => x.id === sid0) ?? null : null;
    const pic = s ? s.image : cur.hero;
    if (!words.trim()) return;
    const n = startJob(jobs.current, pkey);
    setPics((m) => ({ ...m, [pkey]: { from: words, since: Date.now(), how } }));
    setPicErr((m) => ({ ...m, [pkey]: "" }));
    const where = { projectId: p.projectId, pieceId: p.id };
    const aspect = s ? "3:2" : "16:9";
    const r = how === "tune" ? await refinePicture(pic.url, words, aspect, where) : await makePicture(words, aspect, where);
    // an older ask: its picture reaches the project's pictures (the gallery), never this slot
    if (!isNewest(jobs.current, pkey, n)) return;
    setPics((m) => { const next = { ...m }; delete next[pkey]; return next; });
    if (!r.ok) { setPicErr((m) => ({ ...m, [pkey]: r.error })); return; }
    landPicture(api, cur, pkey, { url: r.picture.url, alt: r.picture.alt, prompt: how === "tune" ? pic.prompt || words : words }, how === "tune" ? pic.prompt : words);
  };

  /** Move / Duplicate / Take out from the label over the picked part (cv16, ../../../../lib/.../blog/elements.ts). */
  const partAct = (key: string, act: PartAction) => {
    const cur = docRef.current;
    if (act === "remove" && /^s:[^:]+:h$/.test(key)) {
      const i = cur.sections.findIndex((x) => x.id === sectionOf(key));
      if (!window.confirm(`Take section ${i + 1}${cur.sections[i]?.heading ? ` "${cur.sections[i].heading}"` : ""} out? Undo is in Versions.`)) return;
    }
    const r = doPartAction(cur, key, act);
    // on the post as it is this instant (the words just kept go first)
    api.setDoc((raw: unknown) => doPartAction(blogDoc(raw, { language: p.language, author: me, title: p.title }), key, act).doc);
    setSel(r.key);
    if (r.key) setFocus({ key: r.key, at: Date.now() });
  };

  /** One part changed by the assistant (the part task), or a section written again (the section task). */
  const changePart = (key: string, request: string, label: string) => busyRun(`${label} - ${partLabel(docRef.current, key).toLowerCase()}…`, key, async () => {
    const r = await api.ai<{ text: string; note?: string }>("part", { key, request });
    if (!r.ok) return r.error;
    if (!r.result.text.trim()) return "Nothing came back - ask again, in other words.";
    const cur = docRef.current;
    const before = partText(cur, key);
    if (before === null) return "That part is gone.";
    const sid = sectionOf(key);
    const patch: Partial<BlogDoc> = sid ? { sections: setPart(cur, key, r.result.text).sections } : (() => { const n = setPart(cur, key, r.result.text); const k = key.split(":")[0]; return k === "title" ? { title: n.title } : k === "lead" ? { excerpt: n.excerpt } : k === "short" ? { takeaways: n.takeaways } : k === "cta" ? { cta: n.cta } : k === "faq" ? { faq: n.faq } : k === "prod" ? { relatedProducts: n.relatedProducts } : k === "hero" ? { hero: n.hero } : {}; })();
    await lay(patch, `${label}: ${partLabel(cur, key).toLowerCase()}.${ruled(r.result.note)}`);
    return null;
  });
  const sectionAgain = (sid: string, request = "") => busyRun("Writing this section again…", `s:${sid}:h`, async () => {
    const i = docRef.current.sections.findIndex((s) => s.id === sid);
    if (i < 0) return "That section is gone.";
    const r = await api.ai<{ heading: string; body: string; quote: string; note?: string }>("section", { index: i, mode: "write", ...(request ? { request } : {}) });
    if (!r.ok) return r.error;
    if (!r.result.body) return "No text came back - ask again.";
    const cur = docRef.current;
    await lay({ sections: cur.sections.map((s) => (s.id === sid ? { ...s, heading: r.result.heading || s.heading, body: r.result.body, quote: r.result.quote ?? s.quote } : s)) }, `Section ${i + 1} written again${request ? " as asked" : ""}.${ruled(r.result.note)}`);
    return null;
  });
  const questions = (add: boolean) => busyRun(add ? "Adding a question…" : "Writing the questions and answers…", "faq", async () => {
    if (!docRef.current.sections.length) return "Write the post first - the questions come from it.";
    const r = await api.ai<{ faq: BlogDoc["faq"]; note?: string }>("faq", add ? { add: true } : {});
    if (!r.ok) return r.error;
    if (!r.result.faq.length) return "No question came back - ask again.";
    await lay({ faq: add ? [...docRef.current.faq, ...r.result.faq] : r.result.faq }, (add ? `${r.result.faq.length} question${r.result.faq.length === 1 ? "" : "s"} added.` : `${r.result.faq.length} questions with their answers.`) + ruled(r.result.note));
    pick("faq", true);
    return null;
  });
  const meta = () => busyRun("Writing Google's title and description…", null, async () => {
    const r = await api.ai<{ metaTitle: string; metaDescription: string; excerpt: string; slug: string; note?: string }>("meta");
    if (!r.ok) return r.error;
    const cur = docRef.current;
    await lay({
      metaTitle: r.result.metaTitle, metaDescription: r.result.metaDescription,
      ...(cur.excerpt.trim() ? {} : { excerpt: r.result.excerpt }),
      ...(!cur.slug || cur.slug === slugify(cur.title) ? { slug: r.result.slug || cur.slug } : {}),
    }, `Google's title and description (under the outline: What Google shows).${ruled(r.result.note)}`);
    return null;
  });

  /* ── the words edited in place ── */
  // on the document as it is this instant (a move or a removal may have just been made): never on an older copy
  const commit = (key: string, text: string) => api.setDoc((raw: unknown) => {
    const cur = blogDoc(raw, { language: p.language, author: me, title: p.title });
    const next = setPart(cur, key, text);
    // the address follows the title while nobody set one of its own
    return key === "title" && (!cur.slug || cur.slug === slugify(cur.title)) ? { ...next, slug: slugify(next.title) } : next;
  });

  // named in the bar while the post is still "Untitled …": the page's title follows (one name, not two)
  useEffect(() => {
    if (canEdit && untitled(d.title) && !untitled(p.title)) commit("title", p.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.title, canEdit]);

  const newSection = () => {
    const r = addSection(docRef.current, sectionOf(sel));
    set(r.doc);
    const key = `s:${r.id}:h`;
    setSel(key);
    setFocus({ key, at: Date.now() });
    setEditKey({ key, at: Date.now() });
  };
  const openPart = (key: string) => { setOpen((o) => (o.includes(key) ? o : [...o, key])); setSel(key); setFocus({ key, at: Date.now() }); if (!isPicture(key)) setEditKey({ key, at: Date.now() + 1 }); };

  /* ── the assistant, for the part picked or the whole post ── */
  const sid = sectionOf(sel);
  const section = sid ? d.sections.find((s) => s.id === sid) ?? null : null;
  const si = section ? d.sections.indexOf(section) : -1;
  const words = sel ? partText(d, sel) : null;
  const enabled = api.data.ai && canEdit;

  let quick: QuickAsk[] = [];
  let onAsk: ((t: string) => Promise<string | null>) | undefined;
  let placeholder = "";
  if (!sel) {
    quick = [
      {
        // the same words as the start card and the map's header (the flow standard)
        label: d.sections.length ? "Write it all again, better" : "Write the whole post with AI",
        // written again: every section kept and written better (Undo in the history); the other ways are in the map's header
        run: async () => write("", undefined, d.sections.length ? "directly" : undefined),
      },
      // with nothing written yet, writing it is the one next step
      ...(d.sections.length ? [
        { label: d.faq.length ? "Add a question" : "Questions and answers", run: () => questions(d.faq.length > 0) },
        { label: "Title and description for Google", run: meta },
      ] : []),
    ];
    onAsk = (t) => write(t, undefined, docRef.current.sections.length ? "ask" : undefined);
    placeholder = d.sections.length ? "Ask for a change to the whole post - e.g. add a section on storage, for buyers rather than engineers" : "What should the post say? Or ask the assistant to write it from the brief";
  } else if (words !== null && !sel.startsWith("prod:")) {
    // a product's name is the shop's: written by hand, never by the assistant
    const isTitle = oneLine(sel);
    quick = isTitle
      ? [{ label: "Sharper", run: () => changePart(sel, "Make it sharper: the question or the benefit first, the way a person would search it.", "Sharper") }, { label: "Shorter", run: () => changePart(sel, "Make it shorter, same meaning.", "Shorter") }]
      : [
          { label: "Shorter", run: () => changePart(sel, "Make it about a third shorter: keep every fact, cut padding and repetition.", "Shorter") },
          { label: "Rewrite for a buyer", run: () => changePart(sel, "Rewrite it for a buyer rather than an engineer: what it means for cost, risk, lead time and choosing - same facts.", "For a buyer") },
          { label: "More concrete", run: () => changePart(sel, "Make it more concrete: the mechanism, typical values from general engineering knowledge, an example from a plant - never invented figures about APSOparts.", "More concrete") },
        ];
    if (section) quick.push({ label: "Write this section again", run: () => sectionAgain(section.id) });
    if (sel.startsWith("faq")) quick.push({ label: "Add a question", run: () => questions(true) });
    onAsk = (t) => changePart(sel, t, "As asked");
    placeholder = `What should change in ${partLabel(d, sel).toLowerCase()}? e.g. say it for a buyer, add a check the reader can do`;
  } else if (sel === "faq") {
    quick = [{ label: d.faq.length ? "Add a question" : "Write the questions and answers", run: () => questions(d.faq.length > 0) }];
  } else if (section) {
    quick = [{ label: "Write this section again", run: () => sectionAgain(section.id) }];
    onAsk = (t) => sectionAgain(section.id, t);
    placeholder = "What should change? Empty: written again from the post";
  }

  const top = (
    <Box sx={{ mb: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>Working on</Typography>
          <Typography sx={{ fontSize: "0.98rem", fontWeight: 700, color: sel ? PINK : INK, lineHeight: 1.3 }}>{partLabel(d, sel)}</Typography>
        </Box>
        {sel && (
          <Tooltip title="Back to the whole post">
            <IconButton size="small" onClick={() => setSel(null)} aria-label="Back to the whole post"><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        )}
      </Box>
      {!sel && <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>Click any part of the page to edit its words there - the assistant then works on that part.</Typography>}
      {sel && words !== null && <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>{canEdit ? `Edit the words right on the page${oneLine(sel) ? " - Enter keeps them" : " - a click elsewhere keeps them"}, Esc drops the change. Or ask:` : "Read only."}</Typography>}
      {sel && words !== null && canEdit && richOf(sel) && (
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45, mt: 0.5, p: 0.75, borderRadius: "6px", bgcolor: "rgba(21,34,58,.04)" }}>
          Pick words, then <b>B</b> for bold or <Box component="b" sx={{ color: "#d80901" }}>Red</Box> for a key word in the label over the part (Ctrl+B, Ctrl+E).
        </Typography>
      )}
      {sel && words === null && <Typography sx={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.45 }}>Its fields are open on the left, under its row.</Typography>}
    </Box>
  );

  /* ── the picked part's own fields: under its row in the map (the flow standard) ── */
  const fields = (
    <Box>
      {isPicture(sel) && <Picture api={api} d={d} set={set} pkey={sel!} canEdit={canEdit} making={pics[sel!] ?? null} error={picErr[sel!] || null} onMake={(k, w, how) => void makePic(k, w, how)} />}
      {sel === "tags" && <TopicEditor d={d} set={set} canEdit={canEdit} />}
      {sel === "author" && <Author api={api} d={d} set={set} canEdit={canEdit} />}
      {(sel === "prods" || sel?.startsWith("prod:")) && <Products d={d} set={set} canEdit={canEdit} picked={sel} onPick={(k) => setSel(k)} />}
      {sel?.startsWith("cta") && <Field label="Where the button goes" value={d.cta.url} placeholder={shopUrl(d.store)} disabled={!canEdit} onChange={(v) => set({ ...d, cta: { ...d.cta, url: v.trim() } })} />}
      {sel?.startsWith("faq") && canEdit && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => { const r = addFaq(docRef.current); set(r.doc); const k = `faq:${r.id}:q`; setSel(k); setFocus({ key: k, at: Date.now() }); setEditKey({ key: k, at: Date.now() }); }} sx={toolBtn}>Add one yourself</Button>
          {/^faq:[^:]+/.test(sel) && <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={() => { const id = sel.split(":")[1]; set({ ...d, faq: d.faq.filter((f) => f.id !== id) }); setSel("faq"); }} sx={toolBtn}>Remove this question</Button>}
        </Box>
      )}
      {section && canEdit && !isPicture(sel) && (
        <Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {!section.image.url && !open.includes(`s:${section.id}:img`) && !section.image.prompt && <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => openPart(`s:${section.id}:img`)} sx={toolBtn}>Add a picture</Button>}
            {(section.image.url || section.image.prompt || open.includes(`s:${section.id}:img`)) && <Button size="small" startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => pick(`s:${section.id}:img`, true)} sx={toolBtn}>Its picture</Button>}
            {!section.quote.trim() && !open.includes(`s:${section.id}:q`) && <Button size="small" startIcon={<FormatQuoteIcon sx={{ fontSize: 16 }} />} onClick={() => openPart(`s:${section.id}:q`)} sx={toolBtn}>Add a pull quote</Button>}
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={newSection} sx={toolBtn}>A section after it</Button>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mt: 0.75 }}>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, flex: 1 }}>Section {si + 1} of {d.sections.length}</Typography>
            <Tooltip title="Up"><span><IconButton size="small" disabled={si === 0} onClick={() => set(moveSection(d, section.id, -1))} aria-label="Move the section up"><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            <Tooltip title="Down"><span><IconButton size="small" disabled={si === d.sections.length - 1} onClick={() => set(moveSection(d, section.id, 1))} aria-label="Move the section down"><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            <Tooltip title="Remove the section">
              <IconButton size="small" aria-label="Remove the section" onClick={() => { if (window.confirm(`Remove section ${si + 1}? Undo is in Versions.`)) { set({ ...d, sections: d.sections.filter((s) => s.id !== section.id) }); setSel(null); } }}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
      {sel && !isPicture(sel) && !section && !["tags", "author", "prods", "faq"].includes(sel) && !sel.startsWith("prod:") && !sel.startsWith("cta") && !sel.startsWith("faq") && (
        <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Its words are edited on the page - click them there.</Typography>
      )}
    </Box>
  );

  const assist = (
    <AssistantPanel quick={quick} enabled={enabled} onAsk={onAsk} placeholder={placeholder} top={top} inputRef={askRef}>
      {!sel && d.sections.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <TranslateRow what="post" langs={LANGS} names={LANGUAGE_NAME} current={d.language} made={madeLanguages(d.changes, d.language)} busy={tl}
            disabled={!enabled || (!!work && !tl)} onPick={(l) => void write("", l)} />
        </Box>
      )}
      <ChangesList changes={d.changes ?? []} mode={undoMode} onUndo={(c) => void undo(c)} disabled={!canEdit || !!work} />
    </AssistantPanel>
  );

  const empty = !d.sections.length && !d.excerpt.trim();
  const preview = (
    <Pane tone="stage" pad={false} title="The page, as readers see it" right={
      <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
    }>
      <Box sx={{ p: 2.5, position: "relative" }}>
        {work && <Working label={work.label} since={work.since} />}
        <EditFrame html={html} device={device} width={DESKTOP} title="The blog post" texts={(k) => partText(docRef.current, k)} oneLine={oneLine}
          selected={sel} onSelect={(k) => setSel(k)} onCommit={commit} readOnly={!canEdit} focus={focus} editKey={editKey} busy={work ? work.key ?? "*" : picBusy}
          rich={richOf} redMarks linkSearch={linkSearch} label={(k) => partLabel(docRef.current, k)} onAskAi={enabled && onAsk ? () => askRef.current?.focus() : undefined}
          partActions={(k) => partActions(docRef.current, k)} onPartAction={partAct}
          onAgain={enabled && !work && sid ? () => void sectionAgain(sid, askRef.current?.value.trim() ?? "") : undefined} />
      </Box>
    </Pane>
  );

  /* ── the start, at the top of the map while nothing is written (the flow standard) ── */
  const start = empty && canEdit && !work ? (
    <Box sx={{ p: 1.5, mb: 1.25, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>What are you making?</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>A post for the shop&apos;s blog, from the project&apos;s brief - in</Typography>
      <SquareChoice value={d.language} onChange={(l: string) => set({ ...d, language: l, store: storeOf(l) })} options={LANGS.map((l) => ({ key: l, label: l }))} />
      <Button fullWidth variant="contained" disableElevation disabled={!enabled} startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => void write("")} sx={{ ...mainBtn, mt: 1.25, minHeight: 38, height: "auto", py: 0.75, whiteSpace: "normal", lineHeight: 1.25 }}>Write the whole post with AI</Button>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75, textAlign: "center" }}>or open a part below and write it yourself</Typography>
    </Box>
  ) : null;
  const writeAll = !empty && enabled ? writeAgain : undefined;

  return (
    <StudioPanes id="blog4" buildWidth={300} assistWidth={330} wide={publishing}
      build={<Outline api={api} d={d} set={set} sel={sel} cards={cards} onAddSection={newSection}
        onPick={(key) => pick(key, true)} fields={fields} start={start} onWriteAll={writeAll} busy={work ? work.key ?? "all" : null} onStep={(s) => setPublishing(s === "publish")} />}
      preview={preview}
      assist={assist}
    />
  );
}

