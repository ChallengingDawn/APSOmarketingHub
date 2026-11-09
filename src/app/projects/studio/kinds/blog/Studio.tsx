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
import TranslateIcon from "@mui/icons-material/Translate";
import UndoIcon from "@mui/icons-material/Undo";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  BLOG_STORES, LANGUAGE_NAME, LIMITS, blogDoc, shopUrl, slugify, storeOf, type BlogCard, type BlogDoc, type BlogSection,
} from "@/lib/content/studio/kinds/blog/model";
import { addFaq, addProduct, addSection, moveSection, oneLine, partLabel, partText, sectionOf, setPart } from "@/lib/content/studio/kinds/blog/parts";
import { postDocument } from "@/lib/content/studio/kinds/blog/render";
import type { RichMode } from "@/lib/content/studio/kinds/blog/richEdit";
import { AssistantPanel, Field, Label, PINK, Pane, StudioPanes, btn, field, mainBtn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { EditFrame, type Device } from "./EditFrame";
import { Outline } from "./Outline";
import { setDocSafely } from "./safeSet";
import { BLUE, Hint, PictureSlot, Working, toolBtn, useSettled } from "./ui";

export const LANGS = ["DE", "FR", "IT", "EN", "NL", "PL"] as const;
/** The page's width on a computer: the article's column and its contents at their real size, zoomed less. */
const DESKTOP = 1040;

type Outline = Pick<BlogDoc, "title" | "slug" | "metaTitle" | "metaDescription" | "excerpt" | "sections" | "faq" | "tags" | "takeaways"> & {
  cta: { title: string; text: string; label: string }; picture: string; pictureAlt: string;
};
type Change = { id: number; text: string; before: Partial<BlogDoc>; at: string };
type Work = { label: string; key: string | null; since: number } | null;

/** The AI's sections laid over the post's: a picture already in place stays with the section at the same place. */
function keepPictures(next: BlogSection[], cur: BlogSection[]): BlogSection[] {
  return next.map((s, i) => (cur[i]?.image.url ? { ...s, image: { ...cur[i].image, alt: cur[i].image.alt || s.image.alt } } : s));
}

const isPicture = (key: string | null) => !!key && (key === "hero" || /^s:[^:]+:img$/.test(key));

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
function Picture({ api, d, set, pkey, canEdit }: { api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; pkey: string; canEdit: boolean }) {
  const p = api.data.piece;
  const sid = sectionOf(pkey);
  const s = sid ? d.sections.find((x) => x.id === sid) : null;
  const pic = s ? s.image : d.hero;
  const put = (next: BlogDoc["hero"]) => set(s ? { ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, image: next } : x)) } : { ...d, hero: next });
  const idea = pic.prompt || (s ? `${s.heading}${d.title ? ` - for a blog article "${d.title}"` : ""}` : [d.title, d.excerpt].filter(Boolean).join(" - "));
  return (
    <Box>
      <PictureSlot url={pic.url} alt={pic.alt} aspect={s ? "3:2" : "16:9"} suggestion={idea} projectId={p.projectId} pieceId={p.id} me={api.data.me} disabled={!canEdit}
        onPick={(x) => put({ ...pic, url: x.url, alt: pic.alt || (s ? s.heading : d.title), prompt: x.prompt ?? pic.prompt })}
        onAlt={(alt) => put({ ...pic, alt })} onRemove={() => put({ ...pic, url: "" })} altLabel="What it shows (for Google and screen readers)" />
      {pic.url && <Box sx={{ mt: 1 }}><Field label="A line under it (optional)" value={pic.caption} disabled={!canEdit} onChange={(v) => put({ ...pic, caption: v })} /></Box>}
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
  const [focus, setFocus] = useState<{ key: string; at: number } | null>(null);
  const [editKey, setEditKey] = useState<{ key: string; at: number } | null>(null);
  const [open, setOpen] = useState<string[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [work, setWork] = useState<Work>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [lang, setLang] = useState<string>(() => (d.language === "EN" ? "DE" : "EN"));
  const [cards, setCards] = useState<BlogCard[] | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);

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

  /** An answer laid over the post as it is now; what it replaced kept for Undo. */
  const lay = async (patch: Partial<BlogDoc>, text: string) => {
    const cur = docRef.current;
    const keys = Object.keys(patch) as (keyof BlogDoc)[];
    const before = Object.fromEntries(keys.map((k) => [k, cur[k]])) as Partial<BlogDoc>;
    await setDocSafely(api, cur, { ...cur, ...patch });
    setChanges((c) => [{ id: Date.now(), text, before, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, ...c].slice(0, 12));
  };
  const undo = async (ch: Change) => {
    const cur = docRef.current;
    await setDocSafely(api, cur, { ...cur, ...ch.before });
    setChanges((c) => c.filter((x) => x.id !== ch.id));
  };
  /** The assistant at work: the band over the preview, the part it works on breathing. */
  const busyRun = async (label: string, key: string | null, fn: () => Promise<string | null>) => {
    setWork({ label, key, since: Date.now() });
    try { return await fn(); } finally { setWork(null); }
  };

  const write = (request: string, language?: string) => busyRun(language ? `Translating the post into ${LANGUAGE_NAME[language] ?? language}…` : docRef.current.sections.length ? "Writing the post again…" : "Writing the post from the brief - about a minute or two…", null, async () => {
    const ask = language ? `Translate the whole post into ${LANGUAGE_NAME[language] ?? language}, faithfully.${request ? ` ${request}` : ""}` : request;
    const r = await api.ai<Outline>("outline", { topic: docRef.current.title || p.title, request: ask, ...(language ? { language } : {}) });
    if (!r.ok) return r.error;
    const x = r.result;
    if (!x.sections.length) return "No post came back - ask again.";
    const cur = docRef.current;
    const lg = language ?? cur.language;
    await lay({
      title: x.title || cur.title, slug: language ? x.slug || slugify(x.title) : cur.slug && cur.slug !== slugify(cur.title) ? cur.slug : x.slug || cur.slug,
      metaTitle: x.metaTitle, metaDescription: x.metaDescription, excerpt: x.excerpt, takeaways: x.takeaways,
      sections: keepPictures(x.sections, cur.sections), faq: x.faq.length ? x.faq : cur.faq,
      tags: language || !cur.tags.length ? x.tags : cur.tags,
      cta: { ...cur.cta, title: x.cta.title, text: x.cta.text, label: x.cta.label },
      hero: { ...cur.hero, prompt: x.picture || cur.hero.prompt, alt: cur.hero.alt || x.pictureAlt },
      ...(language ? { language: lg, store: storeOf(lg) } : {}),
    }, language
      ? `Translated into ${LANGUAGE_NAME[lg] ?? lg}: ${x.sections.length} sections, ${x.faq.length} questions, store view ${storeOf(lg)}.`
      : `The post: ${x.sections.length} sections, ${x.takeaways.length} lines "in short", ${x.faq.length} questions, Google's texts and the band to the shop.${cur.hero.url ? "" : " Its picture: click the empty frame under the title."}`);
    setSel(null);
    return null;
  });

  /** One part changed by the assistant (the part task), or a section written again (the section task). */
  const changePart = (key: string, request: string, label: string) => busyRun(`${label} - ${partLabel(docRef.current, key).toLowerCase()}…`, key, async () => {
    const r = await api.ai<{ text: string }>("part", { key, request });
    if (!r.ok) return r.error;
    if (!r.result.text.trim()) return "Nothing came back - ask again, in other words.";
    const cur = docRef.current;
    const before = partText(cur, key);
    if (before === null) return "That part is gone.";
    const sid = sectionOf(key);
    const patch: Partial<BlogDoc> = sid ? { sections: setPart(cur, key, r.result.text).sections } : (() => { const n = setPart(cur, key, r.result.text); const k = key.split(":")[0]; return k === "title" ? { title: n.title } : k === "lead" ? { excerpt: n.excerpt } : k === "short" ? { takeaways: n.takeaways } : k === "cta" ? { cta: n.cta } : k === "faq" ? { faq: n.faq } : k === "prod" ? { relatedProducts: n.relatedProducts } : k === "hero" ? { hero: n.hero } : {}; })();
    await lay(patch, `${label}: ${partLabel(cur, key).toLowerCase()}.`);
    return null;
  });
  const sectionAgain = (sid: string, request = "") => busyRun("Writing this section again…", `s:${sid}:h`, async () => {
    const i = docRef.current.sections.findIndex((s) => s.id === sid);
    if (i < 0) return "That section is gone.";
    const r = await api.ai<{ heading: string; body: string; quote: string }>("section", { index: i, mode: "write", ...(request ? { request } : {}) });
    if (!r.ok) return r.error;
    if (!r.result.body) return "No text came back - ask again.";
    const cur = docRef.current;
    await lay({ sections: cur.sections.map((s) => (s.id === sid ? { ...s, heading: r.result.heading || s.heading, body: r.result.body, quote: r.result.quote ?? s.quote } : s)) }, `Section ${i + 1} written again.`);
    return null;
  });
  const questions = (add: boolean) => busyRun(add ? "Adding a question…" : "Writing the questions and answers…", "faq", async () => {
    if (!docRef.current.sections.length) return "Write the post first - the questions come from it.";
    const r = await api.ai<{ faq: BlogDoc["faq"] }>("faq", add ? { add: true } : {});
    if (!r.ok) return r.error;
    if (!r.result.faq.length) return "No question came back - ask again.";
    await lay({ faq: add ? [...docRef.current.faq, ...r.result.faq] : r.result.faq }, add ? `${r.result.faq.length} question${r.result.faq.length === 1 ? "" : "s"} added.` : `${r.result.faq.length} questions with their answers.`);
    pick("faq", true);
    return null;
  });
  const meta = () => busyRun("Writing Google's title and description…", null, async () => {
    const r = await api.ai<{ metaTitle: string; metaDescription: string; excerpt: string; slug: string }>("meta");
    if (!r.ok) return r.error;
    const cur = docRef.current;
    await lay({
      metaTitle: r.result.metaTitle, metaDescription: r.result.metaDescription,
      ...(cur.excerpt.trim() ? {} : { excerpt: r.result.excerpt }),
      ...(!cur.slug || cur.slug === slugify(cur.title) ? { slug: r.result.slug || cur.slug } : {}),
    }, "Google's title and description (under the outline: What Google shows).");
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
        label: d.sections.length ? "Write the post again" : "Write the post from the brief",
        run: async () => {
          if (docRef.current.sections.some((s) => s.body.trim()) && !window.confirm("Write the post again? It takes the place of what is written - Undo brings it back.")) return null;
          return write("");
        },
      },
      // with nothing written yet, writing it is the one next step
      ...(d.sections.length ? [
        { label: d.faq.length ? "Add a question" : "Questions and answers", run: () => questions(d.faq.length > 0) },
        { label: "Title and description for Google", run: meta },
      ] : []),
    ];
    onAsk = (t) => write(t);
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
    placeholder = "What should this section say?";
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
      {isPicture(sel) && <Picture api={api} d={d} set={set} pkey={sel!} canEdit={canEdit} />}
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
          <Label mt={0}>Translate the whole post</Label>
          <SquareChoice value={lang} onChange={setLang} options={LANGS.filter((l) => l !== d.language).map((l) => ({ key: l, label: l }))} />
          <Button fullWidth variant="outlined" disabled={!enabled || !!work} startIcon={<TranslateIcon sx={{ fontSize: 17 }} />}
            onClick={() => void write("", lang)}
            sx={{ ...btn, mt: 1, justifyContent: "flex-start", borderColor: HAIRLINE, color: INK, bgcolor: "#fff", "&:hover": { borderColor: BLUE, bgcolor: "#fff" } }}>
            Into {LANGUAGE_NAME[lang]} - this to-do
          </Button>
          <Hint mt={0.75}>Everything is translated and its store view follows; Undo brings the {LANGUAGE_NAME[d.language] ?? d.language} back.</Hint>
        </Box>
      )}
      {changes.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>Changes made here</Label>
          {changes.map((ch) => (
            <Box key={ch.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start", p: 1.25, mb: 0.75, borderRadius: "6px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.82rem", color: INK, lineHeight: 1.45 }}>{ch.text}</Typography>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{ch.at}</Typography>
              </Box>
              <Button size="small" onClick={() => void undo(ch)} startIcon={<UndoIcon sx={{ fontSize: 15 }} />} sx={toolBtn}>Undo</Button>
            </Box>
          ))}
        </Box>
      )}
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
          selected={sel} onSelect={(k) => setSel(k)} onCommit={commit} readOnly={!canEdit} focus={focus} editKey={editKey} busy={work?.key ?? null}
          rich={richOf} redMarks label={(k) => partLabel(docRef.current, k)} onAskAi={enabled ? () => askRef.current?.focus() : undefined} />
      </Box>
    </Pane>
  );

  /* ── the start, at the top of the map while nothing is written (the flow standard) ── */
  const start = empty && canEdit && !work ? (
    <Box sx={{ p: 1.5, mb: 1.25, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, boxShadow: "0 6px 18px rgba(31,45,78,.08)" }}>
      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK }}>What are you making?</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>A post for the shop&apos;s blog, from the project&apos;s brief - in</Typography>
      <SquareChoice value={d.language} onChange={(l: string) => set({ ...d, language: l, store: storeOf(l) })} options={LANGS.map((l) => ({ key: l, label: l }))} />
      <Button fullWidth variant="contained" disableElevation disabled={!enabled} startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => void write("")} sx={{ ...mainBtn, mt: 1.25, height: 38 }}>Write the whole post with AI</Button>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75, textAlign: "center" }}>or open a part below and write it yourself</Typography>
    </Box>
  ) : null;
  const writeAll = !empty && enabled ? () => {
    if (docRef.current.sections.some((x) => x.body.trim()) && !window.confirm("Write the post again? It takes the place of what is written - Undo brings it back.")) return;
    void write("");
  } : undefined;

  return (
    <StudioPanes id="blog4" buildWidth={300} assistWidth={330}
      build={<Outline api={api} d={d} set={set} sel={sel} cards={cards} onAddSection={newSection}
        onPick={(key) => pick(key, true)} fields={fields} start={start} onWriteAll={writeAll} busy={work ? work.key ?? "all" : null} />}
      preview={preview}
      assist={assist}
    />
  );
}

