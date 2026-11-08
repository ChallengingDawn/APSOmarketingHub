"use client";
// THE BLOG STUDIO (SARCLA 08.11.2026: "blog - a blog page that needs to update a main blog page that will also be
// deployed, some kind of hierarchy, and then we can automate multiple posts"; then, the same day: "The blog is just
// ridiculous on the site").
//
// Build on the left (the post, its sections with their own AI, its questions, Google, Magento and more posts), the post,
// the blog's home or Google's result in the middle, the assistant on the right: it writes the complete post from the brief
// (lead, "in short", sections with pull quotes and picture ideas, questions, Google's texts, the band to the shop),
// translates it, writes the questions or Google's texts again - each change listed with its own Undo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TranslateIcon from "@mui/icons-material/Translate";
import UndoIcon from "@mui/icons-material/Undo";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { LANGUAGE_NAME, blogDoc, slugify, storeOf, type BlogCard, type BlogDoc, type BlogSection } from "@/lib/content/studio/kinds/blog/model";
import { AssistantPanel, Label, StudioPanes, btn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { setDocSafely } from "./safeSet";
import { Build, LANGS, type SectionMode, type Step } from "./Build";
import { Stage, type View } from "./Stage";
import { BLUE, toolBtn } from "./ui";

type Outline = Pick<BlogDoc, "title" | "slug" | "metaTitle" | "metaDescription" | "excerpt" | "sections" | "faq" | "tags" | "takeaways"> & {
  cta: { title: string; text: string; label: string }; picture: string; pictureAlt: string;
};
type Meta = Pick<BlogDoc, "metaTitle" | "metaDescription" | "excerpt" | "slug">;
type Change = { id: number; text: string; before: Partial<BlogDoc>; at: string };

/** The AI's sections laid over the post's: a picture already in place stays with the section at the same place. */
function keepPictures(next: BlogSection[], cur: BlogSection[]): BlogSection[] {
  return next.map((s, i) => (cur[i]?.image.url ? { ...s, image: { ...cur[i].image, alt: cur[i].image.alt || s.image.alt } } : s));
}

function Assistant({ api, d, latest, onStep, onView }: { api: StudioApi; d: BlogDoc; latest: () => BlogDoc; onStep: (s: Step) => void; onView: (v: View) => void }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [lang, setLang] = useState<string>(() => (d.language === "EN" ? "DE" : "EN"));
  const [translating, setTranslating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const enabled = api.data.ai && api.data.access.canEdit;

  /** An answer laid over the post as it is now; what it replaced kept for Undo. */
  const lay = async (patch: Partial<BlogDoc>, text: string) => {
    const cur = latest();
    const keys = Object.keys(patch) as (keyof BlogDoc)[];
    const before = Object.fromEntries(keys.map((k) => [k, cur[k]])) as Partial<BlogDoc>;
    await setDocSafely(api, cur, { ...cur, ...patch });
    setChanges((c) => [{ id: Date.now(), text, before, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, ...c].slice(0, 12));
  };
  const undo = async (ch: Change) => {
    const cur = latest();
    await setDocSafely(api, cur, { ...cur, ...ch.before });
    setChanges((c) => c.filter((x) => x.id !== ch.id));
  };

  const write = async (request: string, language?: string): Promise<string | null> => {
    const ask = language ? `Translate the whole post into ${LANGUAGE_NAME[language] ?? language}, faithfully.${request ? ` ${request}` : ""}` : request;
    const r = await api.ai<Outline>("outline", { topic: d.title || api.data.piece.title, request: ask, ...(language ? { language } : {}) });
    if (!r.ok) return r.error;
    const x = r.result;
    if (!x.sections.length) return "No post came back - ask again.";
    const cur = latest();
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
      : `The post: ${x.sections.length} sections, ${x.takeaways.length} lines "in short", ${x.faq.length} questions, Google's texts and the band to the shop.${cur.hero.url ? "" : " Its picture is one click away under Post."}`);
    onStep(cur.hero.url || language ? "sections" : "post");
    onView("post");
    return null;
  };

  const quick: QuickAsk[] = [
    {
      label: d.sections.length ? "Write the post again" : "Write the post from the brief",
      run: async () => {
        if (latest().sections.some((s) => s.body.trim()) && !window.confirm("Write the post again? It takes the place of what is written - Undo brings it back.")) return null;
        return write("");
      },
    },
    {
      label: "Questions and answers",
      run: async () => {
        if (!latest().sections.length) return "Write the post first - the questions come from it.";
        const r = await api.ai<{ faq: BlogDoc["faq"] }>("faq");
        if (!r.ok) return r.error;
        if (!r.result.faq.length) return "No question came back - ask again.";
        await lay({ faq: r.result.faq }, `${r.result.faq.length} questions with their answers.`);
        onStep("faq");
        return null;
      },
    },
    {
      label: "Title and description for Google",
      run: async () => {
        const r = await api.ai<Meta>("meta");
        if (!r.ok) return r.error;
        const cur = latest();
        await lay({
          metaTitle: r.result.metaTitle, metaDescription: r.result.metaDescription,
          ...(cur.excerpt.trim() ? {} : { excerpt: r.result.excerpt }),
          ...(!cur.slug || cur.slug === slugify(cur.title) ? { slug: r.result.slug || cur.slug } : {}),
        }, "Google's title and description.");
        onStep("google");
        onView("google");
        return null;
      },
    },
  ];

  return (
    <AssistantPanel quick={quick} enabled={enabled} onAsk={(t) => write(t)} placeholder="What should the post say, or change? e.g. add a section on storage, for buyers rather than engineers">
      <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
        <Label mt={0}>Translate the whole post</Label>
        <SquareChoice value={lang} onChange={setLang} options={LANGS.filter((l) => l !== d.language).map((l) => ({ key: l, label: l }))} />
        <Button fullWidth variant="outlined" disabled={!enabled || translating || !d.sections.length} startIcon={<TranslateIcon sx={{ fontSize: 17 }} />}
          onClick={async () => { setTranslating(true); setMsg(null); setMsg(await write("", lang)); setTranslating(false); }}
          sx={{ ...btn, mt: 1, justifyContent: "flex-start", borderColor: HAIRLINE, color: INK, bgcolor: "#fff", "&:hover": { borderColor: BLUE, bgcolor: "#fff" } }}>
          {translating ? `Translating into ${LANGUAGE_NAME[lang]}…` : `Into ${LANGUAGE_NAME[lang]} - this to-do`}
        </Button>
        {msg && <Typography sx={{ mt: 1, fontSize: "0.8rem", color: "#c5221f" }}>{msg}</Typography>}
        <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.75 }}>Everything is translated, its store view follows; Undo brings the {LANGUAGE_NAME[d.language] ?? d.language} back.</Typography>
      </Box>
      {changes.length > 0 && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          <Label mt={0}>What the assistant changed</Label>
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
}

export default function Studio({ api }: StudioProps) {
  const p = api.data.piece;
  const me = api.data.people.find((x) => x.username === api.data.me)?.name ?? api.data.me;
  const d = useMemo(() => blogDoc(api.doc, { language: p.language, author: me, title: p.title }), [api.doc, p.language, p.title, me]);
  const [step, setStep] = useState<Step>(d.sections.length ? "sections" : "post");
  const [view, setView] = useState<View>("post");
  const [cards, setCards] = useState<BlogCard[] | null>(null);
  const [focus, setFocus] = useState<{ heading: string; at: number } | null>(null);
  const docRef = useRef(d);
  docRef.current = d;

  // every blog post of the hub this person can see - for the blog's home, the posts under this one, and the paste
  const readCards = useCallback(async () => {
    const r = await fetch(`/api/content/studio/blog/${p.id}/posts`).then((x) => x.json()).catch(() => null) as { ok: boolean; cards?: BlogCard[] } | null;
    setCards(r?.ok && r.cards ? r.cards : []);
  }, [p.id]);
  useEffect(() => { void readCards(); }, [readCards]);

  /** One section's own AI; the section as it was comes back for its Undo. */
  const runSection = async (i: number, mode: SectionMode, language?: string): Promise<{ error: string | null; before?: BlogSection }> => {
    const id = docRef.current.sections[i]?.id;
    const r = await api.ai<{ heading: string; body: string; quote: string }>("section", { index: i, mode, ...(language ? { language } : {}) });
    if (!r.ok) return { error: r.error };
    if (!r.result.body) return { error: "No text came back - ask again." };
    const cur = docRef.current;
    const before = cur.sections.find((s) => s.id === id);
    if (!before) return { error: "That section is gone." };
    await setDocSafely(api, cur, { ...cur, sections: cur.sections.map((s) => (s.id === id ? { ...s, heading: r.result.heading || s.heading, body: r.result.body, quote: r.result.quote ?? s.quote } : s)) });
    return { error: null, before };
  };

  return (
    <StudioPanes id="blog" buildWidth={430}
      build={<Build api={api} d={d} set={(next) => api.setDoc(next)} step={step} onStep={setStep} cards={cards} runSection={runSection}
        onFocusSection={(heading) => setFocus((f) => (f && f.heading === heading && Date.now() - f.at < 1500 ? f : { heading, at: Date.now() }))} />}
      preview={<Stage api={api} d={d} cards={cards} view={view} onView={setView} focus={focus} onRefresh={() => { setCards(null); void readCards(); }} />}
      assist={<Assistant api={api} d={d} latest={() => docRef.current} onStep={setStep} onView={setView} />}
    />
  );
}
