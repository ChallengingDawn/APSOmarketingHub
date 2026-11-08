"use client";
// THE BLOG STUDIO (SARCLA 08.11.2026: "blog - a blog page that needs to update a main blog page that will also be
// deployed, some kind of hierarchy, and then we can automate multiple posts").
//
// Build on the left (the post, its sections and questions, Google, Magento and more posts), the post, the blog's home or
// Google's result in the middle, the assistant on the right: it writes the post from the brief, a section again, the
// questions, the title and description for Google - each an answer laid over the post, which Undo takes back.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK } from "@/app/uc/report/ui";
import { blogDoc, slugify, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { AssistantPanel, StudioPanes, btn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { setDocSafely } from "../page/safeSet";
import { Build, type Step } from "./Build";
import { Stage } from "./Stage";

type Outline = Pick<BlogDoc, "title" | "slug" | "metaTitle" | "metaDescription" | "excerpt" | "sections" | "faq" | "tags">;
type Meta = Pick<BlogDoc, "metaTitle" | "metaDescription" | "excerpt" | "slug">;

function Assistant({ api, d, latest, onStep }: { api: StudioApi; d: BlogDoc; latest: () => BlogDoc; onStep: (s: Step) => void }) {
  const [last, setLast] = useState<{ text: string; before: Partial<BlogDoc>; keys: (keyof BlogDoc)[] } | null>(null);
  const enabled = api.data.ai && api.data.access.canEdit;

  /** An answer laid over the post as it is now; what it replaced kept for Undo. */
  const lay = async (patch: Partial<BlogDoc>, text: string) => {
    const cur = latest();
    const keys = Object.keys(patch) as (keyof BlogDoc)[];
    const before = Object.fromEntries(keys.map((k) => [k, cur[k]])) as Partial<BlogDoc>;
    await setDocSafely(api, cur, { ...cur, ...patch });
    setLast({ text, before, keys });
  };

  const write = async (request: string): Promise<string | null> => {
    const r = await api.ai<Outline>("outline", { topic: d.title || api.data.piece.title, request });
    if (!r.ok) return r.error;
    const x = r.result;
    if (!x.sections.length) return "No post came back - ask again.";
    const cur = latest();
    await lay({
      title: x.title || cur.title, slug: cur.slug && cur.slug !== slugify(cur.title) ? cur.slug : x.slug || cur.slug,
      metaTitle: x.metaTitle, metaDescription: x.metaDescription, excerpt: x.excerpt, sections: x.sections, faq: x.faq.length ? x.faq : cur.faq,
      tags: cur.tags.length ? cur.tags : x.tags,
    }, `The post has ${x.sections.length} sections and ${x.faq.length} questions - read them through.`);
    onStep("sections");
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
        }, "The meta title and description are written - see them in Google.");
        onStep("google");
        return null;
      },
    },
  ];

  return (
    <AssistantPanel quick={quick} enabled={enabled} onAsk={write} placeholder="What should the post say, or change?">
      {last && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>{last.text}</Typography>
          <Button size="small" onClick={() => { const cur = latest(); void setDocSafely(api, cur, { ...cur, ...last.before }); setLast(null); }} sx={{ ...btn, mt: 0.75, color: INK, px: 0 }}>Undo</Button>
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
  const [cards, setCards] = useState<BlogCard[] | null>(null);
  const docRef = useRef(d);
  docRef.current = d;

  // every post of the hub this person can see - for the blog's home and its paste
  const readCards = useCallback(async () => {
    const r = await fetch(`/api/content/studio/blog/${p.id}/posts`).then((x) => x.json()).catch(() => null) as { ok: boolean; cards?: BlogCard[] } | null;
    setCards(r?.ok && r.cards ? r.cards : []);
  }, [p.id]);
  useEffect(() => { void readCards(); }, [readCards]);

  const writeSection = async (i: number): Promise<string | null> => {
    const r = await api.ai<{ heading: string; body: string }>("section", { index: i });
    if (!r.ok) return r.error;
    if (!r.result.body) return "No text came back - ask again.";
    const cur = docRef.current;
    const id = d.sections[i]?.id;
    await setDocSafely(api, cur, { ...cur, sections: cur.sections.map((s) => (s.id === id ? { ...s, heading: r.result.heading || s.heading, body: r.result.body } : s)) });
    return null;
  };

  return (
    <StudioPanes
      build={<Build api={api} d={d} set={(next) => api.setDoc(next)} step={step} onStep={setStep} cards={cards} writeSection={writeSection} />}
      preview={<Stage api={api} d={d} cards={cards} onRefresh={() => { setCards(null); void readCards(); }} />}
      assist={<Assistant api={api} d={d} latest={() => docRef.current} onStep={setStep} />}
    />
  );
}
