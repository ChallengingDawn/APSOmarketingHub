"use client";
// THE PAGE STUDIO (SARCLA 08.11.2026: "pages - can come from AI & Personalization (Webyn) or be created here, but should
// also contain A/B testing possibility, live preview of the pages, editing page, select a page to modify; always
// trigger on the to-do").
//
// Build on the left (the page, its changes, the texts, the test, Magento), the page itself in the middle - before, after
// or side by side, desktop or phone - and the assistant on the right. On the first open of a to-do made in AI testing &
// personalization, its page and approved version come in by themselves.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import type { Change } from "@/lib/convert/versions";
import { mergeTexts, pageDoc, placeholdersOf, type PageDoc, type TextSlot } from "@/lib/content/studio/kinds/page/model";
import { AssistantPanel, StudioPanes, btn, type QuickAsk } from "../../parts";
import type { StudioProps } from "../../registry";
import type { StudioApi } from "../../useStudio";
import { Build, type Step } from "./Build";
import { setDocSafely } from "./safeSet";
import { Stage, usePagePreview, type View } from "./Stage";

type Idea = { title: string; why: string; change: string };
type Rewrite = { summary: string; body: string; changes: Change[]; texts: TextSlot[]; problems: string[] };

function Assistant({ api, d, latest, onStep }: { api: StudioApi; d: PageDoc; latest: () => PageDoc; onStep: (s: Step) => void }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [last, setLast] = useState<{ summary: string; problems: string[]; before: PageDoc } | null>(null);
  const outlined = useRef("");
  const enabled = api.data.ai && api.data.access.canEdit;
  const isNew = d.source === "new";

  // the AI reads the page's outline from the document; it is read once per page, before the first ask
  const ensureOutline = async () => {
    const key = `${d.env}${d.path}`;
    if (isNew || !d.path || outlined.current === key || (d.outline?.path === d.path && d.outline.env === d.env)) return;
    const r = await api.act<{ ok: boolean }>("outline");
    if (r.ok && r.result.ok) outlined.current = key;
  };

  const rewrite = async (request: string): Promise<string | null> => {
    if (!isNew && !d.path) return "Pick the page first.";
    await ensureOutline();
    const r = await api.ai<Rewrite>("rewrite", { request });
    if (!r.ok) return r.error;
    const x = r.result;
    if (!x.changes.length && !x.body) return `No usable change came back${x.problems.length ? `: ${x.problems.join("; ")}` : ""}. Ask again, in other words.`;
    // laid over the document as it is NOW - the person may have typed while the AI wrote
    const cur = latest();
    const next: PageDoc = { ...cur, changes: x.changes, newPage: x.body ? { ...cur.newPage, body: x.body } : cur.newPage, texts: mergeTexts(cur.texts, x.texts) };
    await setDocSafely(api, cur, next);
    setLast({ summary: x.summary, problems: x.problems, before: cur });
    setIdeas([]);
    onStep(isNew && x.body ? "page" : "changes");
    return null;
  };

  const quick: QuickAsk[] = [
    ...(isNew && !d.newPage.body.trim() ? [{ label: "Write the page from the brief", run: () => rewrite("Write the whole new page from the brief: its h1, its sections, its styles.") }] : []),
    {
      label: "Ideas for this page",
      run: async () => {
        if (!isNew && !d.path) return "Pick the page first.";
        await ensureOutline();
        const r = await api.ai<{ ideas: Idea[] }>("ideas");
        if (!r.ok) return r.error;
        setIdeas(r.result.ideas);
        return r.result.ideas.length ? null : "No idea came back - ask again.";
      },
    },
    {
      label: "Write the texts",
      run: async () => {
        if (!placeholdersOf(d).length) return "There is no placeholder to write yet - a change leaves one for its longer words.";
        await ensureOutline();
        const r = await api.ai<{ texts: TextSlot[] }>("texts");
        if (!r.ok) return r.error;
        if (!r.result.texts.length) return "No text came back - ask again.";
        const cur = latest();
        api.setDoc({ ...cur, texts: mergeTexts(cur.texts, r.result.texts) });
        onStep("texts");
        return `${r.result.texts.length} text${r.result.texts.length === 1 ? "" : "s"} written - read them in Texts.`;
      },
    },
    { label: "Make it read well on a phone", run: () => rewrite("Make every new block read well on a phone (390 px): check spacing, font sizes and stacking. Keep everything else.") },
  ];

  return (
    <AssistantPanel quick={quick} enabled={enabled} onAsk={rewrite}
      placeholder={isNew ? "What should the page say or do?" : "What should change on this page?"}>
      {last && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>{last.summary || "The page has its new changes."}</Typography>
          {last.problems.map((p) => <Typography key={p} sx={{ fontSize: "0.78rem", color: "#a96a12", mt: 0.5 }}>Left out: {p}</Typography>)}
          <Button size="small" onClick={() => { const cur = latest(); void setDocSafely(api, cur, { ...cur, changes: last.before.changes, newPage: last.before.newPage, texts: last.before.texts }); setLast(null); }} sx={{ ...btn, mt: 0.75, color: INK, px: 0 }}>Undo</Button>
        </Box>
      )}
      {ideas.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {ideas.map((i) => (
            <Box key={i.title} sx={{ p: 1.5, mb: 1, borderRadius: "12px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{i.title}</Typography>
              <Typography sx={{ fontSize: "0.8rem", color: INK, mt: 0.5 }}>{i.change}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>{i.why}</Typography>
              <Button size="small" disabled={!enabled} onClick={() => void rewrite(`${i.title}: ${i.change}`)} sx={{ ...btn, mt: 0.5, px: 0, color: "#c22c6e" }}>Make it</Button>
            </Box>
          ))}
        </Box>
      )}
    </AssistantPanel>
  );
}

export default function Studio({ api }: StudioProps) {
  const d = useMemo(() => pageDoc(api.doc, api.data.piece.language), [api.doc, api.data.piece.language]);
  const canEdit = api.data.access.canEdit;
  const [step, setStep] = useState<Step>(d.path || d.source === "new" ? "changes" : "page");
  const [view, setView] = useState<View>("after");
  const preview = usePagePreview(api, d, view);
  const started = useRef(false);
  const docRef = useRef(d);
  docRef.current = d;

  // the first open: the brief kept for the AI, and a page from AI testing & personalization taken over
  useEffect(() => {
    if (started.current || !canEdit || d.started) return;
    started.current = true;
    void api.act<{ imported: { path: string } | null }>("start").then(async (r) => {
      if (r.ok && r.result.imported) { await api.reload(); setStep("changes"); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, d.started]);

  const after = preview.held.after?.out;
  const hits = after?.ok ? after.hits : null;
  return (
    <StudioPanes
      build={<Build api={api} d={d} set={(next) => api.setDoc(next)} hits={hits} step={step} onStep={setStep} />}
      preview={<Stage d={d} view={view} onView={setView} preview={preview} />}
      assist={<Assistant api={api} d={d} latest={() => docRef.current} onStep={setStep} />}
    />
  );
}
