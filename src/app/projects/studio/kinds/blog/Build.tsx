"use client";
// THE BLOG STUDIO'S BUILD PANE (08.11.2026), in steps: the post (title, lead, picture, topics, author, day), its sections,
// its questions, what Google shows, and the way to Magento with the blog's home and more posts at once.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import MuiChip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { BLOG_STORES, LIMITS, newId, postPath, slugify, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { Field, PINK, Pane, btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Block, Choice, Hint } from "../page/ui";
import { Publish } from "./Publish";

export type Step = "post" | "sections" | "faq" | "google" | "publish";

/** A list's item moved, removed - the list returned new. */
const moved = <T,>(list: T[], i: number, to: number) => { const n = [...list]; n.splice(to, 0, n.splice(i, 1)[0]); return n; };

function Rows({ i, n, onMove, onRemove, extra }: { i: number; n: number; onMove: (to: number) => void; onRemove: () => void; extra?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      {extra}
      <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => onMove(i - 1)}><ArrowUpwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
      <Tooltip title="Down"><span><IconButton size="small" disabled={i === n - 1} onClick={() => onMove(i + 1)}><ArrowDownwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
      <Tooltip title="Remove"><IconButton size="small" onClick={onRemove}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
    </Box>
  );
}

const card = { border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, pb: 0.5, mb: 1.5, bgcolor: "#fff" };

function PostStep({ d, set, canEdit }: { d: BlogDoc; set: (next: BlogDoc) => void; canEdit: boolean }) {
  const [topic, setTopic] = useState("");
  const addTopic = () => {
    const t = topic.replace(/,/g, " ").trim();
    if (t && !d.tags.includes(t) && d.tags.length < LIMITS.tags) set({ ...d, tags: [...d.tags, t] });
    setTopic("");
  };
  return (
    <Box>
      <Block first title="The post">
        <Field label="Its title" value={d.title} max={LIMITS.title} disabled={!canEdit}
          onChange={(v) => set({ ...d, title: v, slug: !d.slug || d.slug === slugify(d.title) ? slugify(v) : d.slug })} />
        <Field label="The lead - the answer at once" value={d.excerpt} max={LIMITS.excerpt} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, excerpt: v })} />
      </Block>
      <Block title="Its picture">
        <Field label="Picture address" value={d.hero.url} disabled={!canEdit} placeholder="https://www.apsoparts.com/media/…" onChange={(v) => set({ ...d, hero: { ...d.hero, url: v.trim() } })} />
        <Field label="What it shows" value={d.hero.alt} disabled={!canEdit} max={125} onChange={(v) => set({ ...d, hero: { ...d.hero, alt: v } })} />
        <Hint mt={-0.5}>A picture from the shop (www.apsoparts.com) or the hub shows in the preview.</Hint>
      </Block>
      <Block title="Topics">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: d.tags.length ? 1.25 : 0 }}>
          {d.tags.map((t) => <MuiChip key={t} size="small" label={t} onDelete={canEdit ? () => set({ ...d, tags: d.tags.filter((x) => x !== t) }) : undefined} sx={{ fontWeight: 600 }} />)}
        </Box>
        {canEdit && d.tags.length < LIMITS.tags && (
          <TextField fullWidth size="small" placeholder="A topic, then Enter (O-rings, Food industry…)" value={topic} sx={field}
            onChange={(e) => (e.target.value.endsWith(",") ? addTopic() : setTopic(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} onBlur={addTopic} />
        )}
        <Hint>The first topic shows above the title; each has a page of its own on the blog.</Hint>
      </Block>
      <Block title="Who and when">
        <Field label="Author" value={d.author} disabled={!canEdit} onChange={(v) => set({ ...d, author: v })} />
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <TextField size="small" type="date" label="Publishing day" value={d.publishAt} disabled={!canEdit} onChange={(e) => set({ ...d, publishAt: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, mb: 1.25 }} />
          <TextField select size="small" label="Store view" value={BLOG_STORES.includes(d.store) ? d.store : ""} disabled={!canEdit} onChange={(e) => set({ ...d, store: e.target.value })} sx={{ ...field, mb: 1.25 }}>
            {BLOG_STORES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>
      </Block>
      <Block title="Notes">
        <Field label="For the team" value={d.notes} multiline rows={2} disabled={!canEdit} onChange={(v) => set({ ...d, notes: v })} />
      </Block>
    </Box>
  );
}

function SectionsStep({ d, set, canEdit, writeSection }: { d: BlogDoc; set: (next: BlogDoc) => void; canEdit: boolean; writeSection: (i: number) => Promise<string | null> }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const up = (i: number, p: Partial<BlogDoc["sections"][number]>) => set({ ...d, sections: d.sections.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  return (
    <Block first title="Sections">
      <Hint mt={0}>Markdown: ### a sub-heading, - a list, | a | table |, **bold**, ==a key word== in red.</Hint>
      <Box sx={{ mt: 1.5 }}>
        {d.sections.map((s, i) => (
          <Box key={s.id} sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>Section {i + 1}</Typography>
              {canEdit && <Rows i={i} n={d.sections.length} onMove={(to) => set({ ...d, sections: moved(d.sections, i, to) })} onRemove={() => set({ ...d, sections: d.sections.filter((x) => x.id !== s.id) })}
                extra={<Tooltip title="The assistant writes it again"><span><IconButton size="small" disabled={busy !== null} onClick={async () => { setBusy(i); setMsg(await writeSection(i)); setBusy(null); }}>
                  {busy === i ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: PINK }} />}</IconButton></span></Tooltip>} />}
            </Box>
            <Field label="Heading" value={s.heading} disabled={!canEdit} onChange={(v) => up(i, { heading: v })} />
            <Field label="Text" value={s.body} multiline rows={6} disabled={!canEdit} onChange={(v) => up(i, { body: v })} />
          </Box>
        ))}
      </Box>
      {msg && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mb: 1 }}>{msg}</Typography>}
      {canEdit && <Button startIcon={<AddIcon />} onClick={() => set({ ...d, sections: [...d.sections, { id: newId(), heading: "", body: "" }] })} sx={{ ...btn, color: INK }}>Add a section</Button>}
    </Block>
  );
}

function FaqStep({ d, set, canEdit }: { d: BlogDoc; set: (next: BlogDoc) => void; canEdit: boolean }) {
  const up = (i: number, p: Partial<BlogDoc["faq"][number]>) => set({ ...d, faq: d.faq.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  return (
    <Block first title="Questions and answers">
      <Hint mt={0}>The questions a reader still has. They show at the end of the post, and Google can show them under it.</Hint>
      <Box sx={{ mt: 1.5 }}>
        {d.faq.map((f, i) => (
          <Box key={f.id} sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>Question {i + 1}</Typography>
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

function GoogleStep({ d, set, canEdit }: { d: BlogDoc; set: (next: BlogDoc) => void; canEdit: boolean }) {
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

export function Build({ api, d, set, step, onStep, cards, writeSection }: {
  api: StudioApi; d: BlogDoc; set: (next: BlogDoc) => void; step: Step; onStep: (s: Step) => void; cards: BlogCard[] | null; writeSection: (i: number) => Promise<string | null>;
}) {
  const canEdit = api.data.access.canEdit;
  const steps: { key: Step; label: string }[] = [
    { key: "post", label: "Post" },
    { key: "sections", label: d.sections.length ? `Sections · ${d.sections.length}` : "Sections" },
    { key: "faq", label: d.faq.length ? `Questions · ${d.faq.length}` : "Questions" },
    { key: "google", label: "Google" },
    { key: "publish", label: "Magento" },
  ];
  return (
    <Pane title="Build">
      <Box sx={{ mb: 2.25 }}><Choice value={step} onChange={onStep} options={steps} /></Box>
      {step === "post" && <PostStep d={d} set={set} canEdit={canEdit} />}
      {step === "sections" && <SectionsStep d={d} set={set} canEdit={canEdit} writeSection={writeSection} />}
      {step === "faq" && <FaqStep d={d} set={set} canEdit={canEdit} />}
      {step === "google" && <GoogleStep d={d} set={set} canEdit={canEdit} />}
      {step === "publish" && <Publish api={api} d={d} cards={cards} />}
    </Pane>
  );
}
