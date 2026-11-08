"use client";
// THE BLOG STUDIO'S BUILD PANE (08.11.2026; Content v2 the same day). One squared row of steps that never wraps
// (SARCLA: the tabs "wrap onto two lines"): the post (title, lead, "in short", its picture, topics, author, day, the band
// to the shop), its sections (each with its picture, its pull quote and its own AI: write, shorter, more concrete,
// translate - each undone with one click), its questions, what Google shows, and the way to Magento.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CompressIcon from "@mui/icons-material/Compress";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TranslateIcon from "@mui/icons-material/Translate";
import UndoIcon from "@mui/icons-material/Undo";
import AdsClickOutlinedIcon from "@mui/icons-material/AdsClickOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  BLOG_STORES, LANGUAGE_NAME, LIMITS, newId, newSection, postPath, slugify, wordsOf, type BlogCard, type BlogDoc, type BlogSection,
} from "@/lib/content/studio/kinds/blog/model";
import { Field, PINK, Pane, btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Publish } from "./Publish";
import { BLUE, Block, Hint, PictureSlot, StepTabs, ToolRow, toolBtn } from "./ui";

export type Step = "post" | "sections" | "faq" | "google" | "publish";
export type SectionMode = "write" | "shorter" | "concrete" | "translate";

/** A list's item moved - the list returned new. */
const moved = <T,>(list: T[], i: number, to: number) => { const n = [...list]; n.splice(to, 0, n.splice(i, 1)[0]); return n; };

function Rows({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => onMove(i - 1)}><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
      <Tooltip title="Down"><span><IconButton size="small" disabled={i === n - 1} onClick={() => onMove(i + 1)}><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
      <Tooltip title="Remove"><IconButton size="small" onClick={onRemove}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
    </Box>
  );
}

const card = { border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1.5, pb: 0.75, mb: 1.5, bgcolor: "#fff" };
const SQUARE_TAG = { display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.25, height: 28, border: `1px solid ${HAIRLINE}`, borderRadius: "4px", bgcolor: "#fff", fontSize: "0.8rem", fontWeight: 600, color: INK };
export const LANGS = ["DE", "FR", "IT", "EN", "NL", "PL"] as const;

type Ctx = { api: StudioApi; d: BlogDoc; set: (next: BlogDoc) => void; canEdit: boolean; me: string };

function PostStep({ api, d, set, canEdit, me }: Ctx) {
  const [topic, setTopic] = useState("");
  const w = wordsOf(d.language);
  const p = api.data.piece;
  const addTopic = () => {
    const t = topic.replace(/,/g, " ").trim();
    if (t && !d.tags.includes(t) && d.tags.length < LIMITS.tags) set({ ...d, tags: [...d.tags, t] });
    setTopic("");
  };
  const heroIdea = d.hero.prompt || [d.title, d.excerpt].filter(Boolean).join(" - ");
  return (
    <Box>
      <Block first title="The post">
        <Field label="Its title" value={d.title} max={LIMITS.title} disabled={!canEdit}
          onChange={(v) => set({ ...d, title: v, slug: !d.slug || d.slug === slugify(d.title) ? slugify(v) : d.slug })} />
        <Field label="The lead - the answer at once" value={d.excerpt} max={LIMITS.excerpt} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, excerpt: v })} />
        <Field label={`"${w.inShort}" - one line each`} value={d.takeaways.join("\n")} multiline rows={3} disabled={!canEdit}
          helper="Three or four lines a reader takes away; they show in a box under the lead"
          onChange={(v) => set({ ...d, takeaways: v.split("\n").slice(0, 6) })} />
      </Block>
      <Block title="Its picture">
        <PictureSlot url={d.hero.url} alt={d.hero.alt} aspect="16:9" suggestion={heroIdea} projectId={p.projectId} pieceId={p.id} me={me} disabled={!canEdit}
          onPick={(pic) => set({ ...d, hero: { ...d.hero, url: pic.url, alt: d.hero.alt || d.title, prompt: pic.prompt ?? d.hero.prompt } })}
          onAlt={(alt) => set({ ...d, hero: { ...d.hero, alt } })} onRemove={() => set({ ...d, hero: { ...d.hero, url: "" } })} />
        {d.hero.url && <Field label="A line under it (optional)" value={d.hero.caption} disabled={!canEdit} onChange={(v) => set({ ...d, hero: { ...d.hero, caption: v } })} />}
      </Block>
      <Block title="Topics">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: d.tags.length ? 1.25 : 0 }}>
          {d.tags.map((t, i) => (
            <Box key={t} sx={{ ...SQUARE_TAG, ...(i === 0 ? { borderColor: "#d80901", color: "#b00700" } : {}) }}>
              {t}
              {canEdit && <IconButton size="small" aria-label={`Remove ${t}`} onClick={() => set({ ...d, tags: d.tags.filter((x) => x !== t) })} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>}
            </Box>
          ))}
        </Box>
        {canEdit && d.tags.length < LIMITS.tags && (
          <TextField fullWidth size="small" placeholder="A topic, then Enter (O-rings, Food industry…)" value={topic} sx={field}
            onChange={(e) => (e.target.value.endsWith(",") ? addTopic() : setTopic(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} onBlur={addTopic} />
        )}
        <Hint>The first topic (in red) shows above the title and on the post's card; each topic has a page of its own on the blog.</Hint>
      </Block>
      <Block title="Who and when">
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <Field label="Author" value={d.author} disabled={!canEdit} onChange={(v) => set({ ...d, author: v })} />
          <Field label="Their role" value={d.authorRole} disabled={!canEdit} placeholder="Product manager seals" onChange={(v) => set({ ...d, authorRole: v })} />
          <TextField size="small" type="date" label="Publishing day" value={d.publishAt} disabled={!canEdit} onChange={(e) => set({ ...d, publishAt: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, mb: 1.25 }} />
          <TextField select size="small" label="Store view" value={BLOG_STORES.includes(d.store) ? d.store : ""} disabled={!canEdit} onChange={(e) => set({ ...d, store: e.target.value })} sx={{ ...field, mb: 1.25 }}>
            {BLOG_STORES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>
        {p.dueDate && !d.publishAt && <Hint mt={-0.5}>On the content calendar on {p.dueDate} - the post shows that day until it has a publishing day.</Hint>}
      </Block>
      <Block title="The band to the shop">
        <Hint mt={0}>After the article, a petrol band leads to the shop. Left empty, it says the words in grey.</Hint>
        <Box sx={{ mt: 1.25 }}>
          <Field label="Title" value={d.cta.title} placeholder={w.ctaTitle} disabled={!canEdit} onChange={(v) => set({ ...d, cta: { ...d.cta, title: v } })} />
          <Field label="One line" value={d.cta.text} placeholder={w.ctaText} disabled={!canEdit} onChange={(v) => set({ ...d, cta: { ...d.cta, text: v } })} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 1 }}>
            <Field label="Button" value={d.cta.label} placeholder={w.ctaLabel} disabled={!canEdit} onChange={(v) => set({ ...d, cta: { ...d.cta, label: v } })} />
            <Field label="Its address" value={d.cta.url} placeholder={`www.apsoparts.com/${d.store}/`} disabled={!canEdit} onChange={(v) => set({ ...d, cta: { ...d.cta, url: v.trim() } })} />
          </Box>
        </Box>
      </Block>
      <Block title="Notes">
        <Field label="For the team" value={d.notes} multiline rows={2} disabled={!canEdit} onChange={(v) => set({ ...d, notes: v })} />
      </Block>
    </Box>
  );
}

/** A section's own AI: write, shorter, more concrete, translate (into a language picked from a menu); then Undo. */
function SectionAi({ busy, onRun, undo, disabled }: { busy: SectionMode | null; onRun: (mode: SectionMode, language?: string) => void; undo: (() => void) | null; disabled: boolean }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const spin = (m: SectionMode, icon: React.ReactNode) => (busy === m ? <CircularProgress size={12} /> : icon);
  return (
    <ToolRow>
      <Button size="small" disabled={disabled} onClick={() => onRun("write")} startIcon={spin("write", <AutoAwesomeOutlinedIcon sx={{ fontSize: 15, color: PINK }} />)} sx={toolBtn}>Write</Button>
      <Button size="small" disabled={disabled} onClick={() => onRun("shorter")} startIcon={spin("shorter", <CompressIcon sx={{ fontSize: 15 }} />)} sx={toolBtn}>Shorter</Button>
      <Button size="small" disabled={disabled} onClick={() => onRun("concrete")} startIcon={spin("concrete", <AdsClickOutlinedIcon sx={{ fontSize: 15 }} />)} sx={toolBtn}>More concrete</Button>
      <Button size="small" disabled={disabled} onClick={(e) => setMenu(e.currentTarget)} startIcon={spin("translate", <TranslateIcon sx={{ fontSize: 15 }} />)} endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 15 }} />} sx={toolBtn}>Translate</Button>
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "6px" } } }}>
        {LANGS.map((l) => <MenuItem key={l} dense onClick={() => { setMenu(null); onRun("translate", l); }}>{LANGUAGE_NAME[l]}</MenuItem>)}
      </Menu>
      {undo && <Button size="small" onClick={undo} startIcon={<UndoIcon sx={{ fontSize: 15 }} />} sx={{ ...toolBtn, color: BLUE, borderColor: "rgba(36,89,209,.35)" }}>Undo</Button>}
    </ToolRow>
  );
}

function SectionCard({ s, i, n, ctx, runSection }: {
  s: BlogSection; i: number; n: number; ctx: Ctx;
  runSection: (i: number, mode: SectionMode, language?: string) => Promise<{ error: string | null; before?: BlogSection }>;
}) {
  const { api, d, set, canEdit, me } = ctx;
  const [busy, setBusy] = useState<SectionMode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [before, setBefore] = useState<BlogSection | null>(null);
  const up = (p: Partial<BlogSection>) => set({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, ...p } : x)) });
  const run = async (mode: SectionMode, language?: string) => {
    setBusy(mode); setMsg(null);
    const r = await runSection(i, mode, language);
    setBusy(null);
    if (r.error) setMsg(r.error); else if (r.before) setBefore(r.before);
  };
  const p = api.data.piece;
  return (
    <Box sx={card} id={`section-${s.id}`}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", flex: 1 }}>Section {i + 1}</Typography>
        {canEdit && <Rows i={i} n={n} onMove={(to) => set({ ...d, sections: moved(d.sections, i, to) })} onRemove={() => set({ ...d, sections: d.sections.filter((x) => x.id !== s.id) })} />}
      </Box>
      {canEdit && api.data.ai && (
        <Box sx={{ mb: 1.25 }}>
          <SectionAi busy={busy} disabled={busy !== null} onRun={(m, l) => void run(m, l)}
            undo={before ? () => { set({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...before, id: s.id } : x)) }); setBefore(null); } : null} />
          {msg && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mt: 0.75 }}>{msg}</Typography>}
        </Box>
      )}
      <Field label="Heading" value={s.heading} disabled={!canEdit} onChange={(v) => up({ heading: v })} />
      <Field label="Text" value={s.body} multiline rows={7} disabled={!canEdit} onChange={(v) => up({ body: v })} />
      <Field label="Pull quote (optional)" value={s.quote} disabled={!canEdit} helper="One sentence shown large, with a red line, inside the section" onChange={(v) => up({ quote: v })} />
      <Box sx={{ mb: 1.25 }}>
        <PictureSlot url={s.image.url} alt={s.image.alt} aspect="3:2" startOpen={false} suggestion={s.image.prompt || `${s.heading}${d.title ? ` - for a blog article "${d.title}"` : ""}`}
          projectId={p.projectId} pieceId={p.id} me={me} disabled={!canEdit}
          onPick={(pic) => up({ image: { ...s.image, url: pic.url, alt: s.image.alt || s.heading, prompt: pic.prompt ?? s.image.prompt } })}
          onAlt={(alt) => up({ image: { ...s.image, alt } })} onRemove={() => up({ image: { ...s.image, url: "" } })} />
        {s.image.url && <Field label="A line under the picture (optional)" value={s.image.caption} disabled={!canEdit} onChange={(v) => up({ image: { ...s.image, caption: v } })} />}
        {!s.image.url && s.image.prompt && <Hint>The assistant's idea for its picture: “{s.image.prompt}”</Hint>}
      </Box>
    </Box>
  );
}

function SectionsStep({ ctx, runSection }: { ctx: Ctx; runSection: (i: number, mode: SectionMode, language?: string) => Promise<{ error: string | null; before?: BlogSection }> }) {
  const { d, set, canEdit } = ctx;
  return (
    <Block first title="Sections" right={canEdit ? <Button size="small" startIcon={<AddIcon />} onClick={() => set({ ...d, sections: [...d.sections, newSection()] })} sx={toolBtn}>Add one</Button> : undefined}>
      <Hint mt={0}>Markdown: ### a sub-heading, - a list, | a | table |, **bold**, ==a key word== in red.</Hint>
      <Box sx={{ mt: 1.5 }}>
        {d.sections.map((s, i) => <SectionCard key={s.id} s={s} i={i} n={d.sections.length} ctx={ctx} runSection={runSection} />)}
      </Box>
      {!d.sections.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, py: 2 }}>No section yet. The assistant writes the whole post from the brief - or add one.</Typography>}
      {canEdit && d.sections.length > 0 && <Button startIcon={<AddIcon />} onClick={() => set({ ...d, sections: [...d.sections, newSection()] })} sx={{ ...btn, color: INK }}>Add a section</Button>}
    </Block>
  );
}

function FaqStep({ d, set, canEdit }: Ctx) {
  const up = (i: number, p: Partial<BlogDoc["faq"][number]>) => set({ ...d, faq: d.faq.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  return (
    <Block first title="Questions and answers">
      <Hint mt={0}>The questions a reader still has. They show at the end of the post, and Google can show them under it.</Hint>
      <Box sx={{ mt: 1.5 }}>
        {d.faq.map((f, i) => (
          <Box key={f.id} sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, letterSpacing: "0.07em", textTransform: "uppercase", flex: 1 }}>Question {i + 1}</Typography>
              {canEdit && <Rows i={i} n={d.faq.length} onMove={(to) => set({ ...d, faq: moved(d.faq, i, to) })} onRemove={() => set({ ...d, faq: d.faq.filter((x) => x.id !== f.id) })} />}
            </Box>
            <Field label="Question" value={f.q} disabled={!canEdit} onChange={(v) => up(i, { q: v })} />
            <Field label="Answer" value={f.a} multiline rows={3} disabled={!canEdit} onChange={(v) => up(i, { a: v })} />
          </Box>
        ))}
      </Box>
      {canEdit && <Button startIcon={<AddIcon />} onClick={() => set({ ...d, faq: [...d.faq, { id: newId(), q: "", a: "" }] })} sx={{ ...btn, color: INK }}>Add a question</Button>}
    </Block>
  );
}

function GoogleStep({ d, set, canEdit }: Ctx) {
  const upP = (i: number, p: Partial<BlogDoc["relatedProducts"][number]>) => set({ ...d, relatedProducts: d.relatedProducts.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  return (
    <Box>
      <Block first title="What Google shows">
        <Field label="Its address" value={d.slug} disabled={!canEdit} helper={`apsoparts.com${postPath(d)}`} onChange={(v) => set({ ...d, slug: slugify(v) || v.toLowerCase() })} />
        <Field label="Meta title" value={d.metaTitle} max={LIMITS.metaTitle} disabled={!canEdit} placeholder={d.title} onChange={(v) => set({ ...d, metaTitle: v })} />
        <Field label="Meta description" value={d.metaDescription} max={LIMITS.metaDescription} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, metaDescription: v })} />
      </Block>
      <Block title="Products it leads to">
        <Hint mt={0}>Shop pages the post points to - by their address on the shop.</Hint>
        <Box sx={{ mt: 1.25 }}>
          {d.relatedProducts.map((p, i) => (
            <Box key={p.id} sx={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 1, alignItems: "flex-start" }}>
              <Field label="Name" value={p.name} disabled={!canEdit} onChange={(v) => upP(i, { name: v })} />
              <Field label="Address" value={p.url} disabled={!canEdit} placeholder="/de-CH/…" onChange={(v) => upP(i, { url: v.trim() })} />
              {canEdit && <IconButton size="small" sx={{ mt: 0.5 }} onClick={() => set({ ...d, relatedProducts: d.relatedProducts.filter((x) => x.id !== p.id) })}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton>}
            </Box>
          ))}
        </Box>
        {canEdit && <Button startIcon={<AddIcon />} onClick={() => set({ ...d, relatedProducts: [...d.relatedProducts, { id: newId(), name: "", url: "" }] })} sx={{ ...btn, color: INK }}>Add a product</Button>}
      </Block>
    </Box>
  );
}

export function Build({ api, d, set, step, onStep, cards, runSection }: {
  api: StudioApi; d: BlogDoc; set: (next: BlogDoc) => void; step: Step; onStep: (s: Step) => void; cards: BlogCard[] | null;
  runSection: (i: number, mode: SectionMode, language?: string) => Promise<{ error: string | null; before?: BlogSection }>;
}) {
  const canEdit = api.data.access.canEdit;
  const me = api.data.me;
  const ctx: Ctx = { api, d, set, canEdit, me };
  return (
    <Pane title="Build" pad={false}>
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ flexShrink: 0, px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}` }}>
        <StepTabs value={step} onChange={onStep} options={[
          { key: "post", label: "Post" },
          { key: "sections", label: "Sections", count: d.sections.length },
          { key: "faq", label: "FAQ", count: d.faq.length },
          { key: "google", label: "Google" },
          { key: "publish", label: "Publish" },
        ]} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
      {step === "post" && <PostStep {...ctx} />}
      {step === "sections" && <SectionsStep ctx={ctx} runSection={runSection} />}
      {step === "faq" && <FaqStep {...ctx} />}
      {step === "google" && <GoogleStep {...ctx} />}
      {step === "publish" && <Publish api={api} d={d} cards={cards} />}
      </Box>
      </Box>
    </Pane>
  );
}
