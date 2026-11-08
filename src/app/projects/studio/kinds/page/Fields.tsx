"use client";
// A NEW PAGE'S FIELDS (SARCLA 08.11.2026: "the new page should allow many more fields and allow filling fields with
// AI"). One card per part of the page - hero, intro, benefits, sections, links, questions, call to action, search
// engines - each with "Write with AI" for that part alone; "Write the whole page" fills them all. A field in focus is
// the element selected in the preview, and a click in the preview opens its card here. Pictures: the picture panel
// (make one from words - the AI's idea for it already typed in - upload one, or pick one already made).

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LIMIT, addItem, moveItem, removeItem, setField, type Btn, type Fields, type ListKey, type Pic,
} from "@/lib/content/studio/kinds/page/fields";
import type { Part } from "@/lib/content/studio/kinds/page/fill";
import { urlKeyOf } from "@/lib/content/studio/kinds/page/model";
import type { PageRow } from "@/lib/content/studio/kinds/page/shop";
import { PicturePanel } from "../../pictures";
import { Field, PINK, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Choice, Hint } from "./ui";

export type FillRun = (part: Part, opts?: { id?: string; request?: string }) => Promise<string | null>;

/** A field that says when it is in focus - the preview selects it. */
function F({ path, onFocusPath, ...rest }: { path: string; onFocusPath: (p: string) => void } & Parameters<typeof Field>[0]) {
  return <Box data-field={path} onFocus={() => onFocusPath(path)}><Field {...rest} /></Box>;
}

/** A shop address: typed, or found among the shop's pages. */
export function LinkInput({ api, value, onChange, store, disabled, label = "Where it goes" }: {
  api: StudioApi; value: string; onChange: (v: string) => void; store: string; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PageRow[] | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const r = await api.act<{ rows: PageRow[] }>("pages", { q, store, page: 0 });
      setRows(r.ok ? r.result.rows.slice(0, 8) : []);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, store]);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
        <TextField fullWidth size="small" label={label} value={value} disabled={disabled} placeholder={`/${store}/…`} onChange={(e) => onChange(e.target.value)} sx={field} />
        <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ ...btn, color: INK, borderRadius: "6px", border: `1px solid ${HAIRLINE}`, height: 40, flexShrink: 0 }}>{open ? "Close" : "Find a page"}</Button>
      </Box>
      {open && (
        <Box sx={{ mt: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", p: 1 }}>
          <TextField fullWidth size="small" autoFocus placeholder="Search the shop's pages" value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, mb: 0.75 }} />
          {!rows && <CircularProgress size={14} />}
          {rows?.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No page matches.</Typography>}
          {rows?.map((r) => (
            <Box key={r.path} component="button" type="button" onClick={() => { onChange(r.path); setOpen(false); }} sx={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", cursor: "pointer", px: 1, py: 0.6, borderRadius: "6px", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textTransform: "capitalize" }}>{r.name}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.path}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** A picture of the page: what it shows, then the panel to make one (the AI's idea typed in), upload one or pick one. */
export function PictureSlot({ api, pic, set, disabled, aspect = "16:9" }: { api: StudioApi; pic: Pic; set: (p: Pic) => void; disabled?: boolean; aspect?: "16:9" | "4:5" | "1:1" | "3:2" }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
        <Box sx={{ width: 96, height: 64, borderRadius: "6px", overflow: "hidden", flexShrink: 0, bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center" }}>
          {pic.url ? <Box component="img" src={pic.url} alt={pic.alt} sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageOutlinedIcon sx={{ color: MUTED }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: INK }}>{pic.url ? "The picture" : "No picture yet"}</Typography>
          {pic.idea && <Typography sx={{ fontSize: "0.74rem", color: MUTED, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>Idea: {pic.idea}</Typography>}
          <Box sx={{ display: "flex", gap: 0.5, mt: 0.25 }}>
            <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ ...btn, px: 0.75, color: PINK }}>{open ? "Close" : pic.url ? "Change" : "Add a picture"}</Button>
            {pic.url && <Button size="small" disabled={disabled} onClick={() => set({ ...pic, url: "" })} sx={{ ...btn, px: 0.75, color: MUTED }}>Remove</Button>}
          </Box>
        </Box>
      </Box>
      {open && (
        <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff" }}>
          <PicturePanel projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect={aspect} suggestion={pic.idea} columns={3}
            tabs={["make", "upload", "project", "mine"]} start={pic.idea ? "make" : "project"}
            onPick={(p) => { set({ ...pic, url: p.url, alt: pic.alt || p.prompt?.slice(0, 120) || "" }); setOpen(false); }} />
        </Box>
      )}
      {pic.url && <Field label="What it shows (alt text)" value={pic.alt} max={LIMIT.alt} disabled={disabled} onChange={(v) => set({ ...pic, alt: v })} />}
    </Box>
  );
}

function Card({ id, title, done, open, onToggle, onAi, busy, aiLabel = "Write with AI", children, canAi }: {
  id: string; title: string; done: boolean; open: boolean; onToggle: () => void; onAi?: () => void; busy?: boolean; aiLabel?: string; children: React.ReactNode; canAi: boolean;
}) {
  return (
    <Box data-card={id} sx={{ border: `1px solid ${open ? "rgba(194,44,110,.28)" : HAIRLINE}`, borderRadius: "10px", bgcolor: "#fff", mb: 1, overflow: "hidden", transition: "border-color .15s" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, cursor: "pointer", "&:hover": { bgcolor: "rgba(21,34,58,.025)" } }} onClick={onToggle}>
        {done ? <CheckCircleIcon sx={{ fontSize: 17, color: "#1b7a55" }} /> : <Box sx={{ width: 15, height: 15, mx: "1px", borderRadius: "50%", border: `1.5px solid ${HAIRLINE}` }} />}
        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, flex: 1 }}>{title}</Typography>
        {onAi && (
          <Tooltip title={aiLabel}>
            <span>
              <IconButton size="small" disabled={!canAi || busy} onClick={(e) => { e.stopPropagation(); onAi(); }} aria-label={aiLabel} sx={{ color: PINK }}>
                {busy ? <CircularProgress size={15} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <ExpandMoreIcon sx={{ fontSize: 20, color: MUTED, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </Box>
      {open && <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>{children}</Box>}
    </Box>
  );
}

function ItemHead({ label, onUp, onDown, onRemove, onAi, busy, canAi, disabled }: {
  label: string; onUp?: () => void; onDown?: () => void; onRemove: () => void; onAi?: () => void; busy?: boolean; canAi?: boolean; disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.75 }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, flex: 1 }}>{label}</Typography>
      {onAi && <Tooltip title="Write it with AI"><span><IconButton size="small" disabled={!canAi || busy || disabled} onClick={onAi} sx={{ color: PINK }}>{busy ? <CircularProgress size={13} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}</IconButton></span></Tooltip>}
      <Tooltip title="Up"><span><IconButton size="small" disabled={!onUp || disabled} onClick={onUp}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      <Tooltip title="Down"><span><IconButton size="small" disabled={!onDown || disabled} onClick={onDown}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      <Tooltip title="Remove"><span><IconButton size="small" disabled={disabled} onClick={onRemove}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
    </Box>
  );
}

const CARD_OF = (path: string) => {
  const p = path.split(".")[0];
  return p === "benefitsTitle" ? "benefits" : p === "linksTitle" ? "links" : p === "faqTitle" ? "faq" : p === "intro-block" ? "intro" : p;
};

export function FieldsEditor({ api, f, set, store, canEdit, canAi, fill, busy, focusPath, onFocusPath }: {
  api: StudioApi; f: Fields; set: (next: Fields) => void; store: string; canEdit: boolean; canAi: boolean;
  fill: FillRun; busy: string | null; focusPath: string | null; onFocusPath: (p: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set(["hero", "intro"]));
  const [msg, setMsg] = useState<string | null>(null);
  const top = useRef<HTMLDivElement | null>(null);
  const up = (path: string, v: unknown) => set(setField(f, path, v));
  const run = async (part: Part, opts?: { id?: string; request?: string }) => { setMsg(null); const r = await fill(part, opts); if (r) setMsg(r); };
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const d = !canEdit;

  // a field selected in the preview: its card opens and it comes into view
  useEffect(() => {
    if (!focusPath) return;
    const card = CARD_OF(focusPath);
    setOpen((s) => (s.has(card) ? s : new Set([...s, card])));
    const t = setTimeout(() => {
      const el = top.current?.querySelector(`[data-field="${CSS.escape(focusPath)}"]`) ?? top.current?.querySelector(`[data-card="${CSS.escape(card)}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [focusPath]);

  const list = <K extends ListKey>(key: K) => ({
    add: () => { const r = addItem(f, key); set(r.fields); onFocusPath(`${key}.${r.id}`); },
    up: (id: string) => set(moveItem(f, key, id, -1)),
    down: (id: string) => set(moveItem(f, key, id, 1)),
    remove: (id: string) => set(removeItem(f, key, id)),
  });
  const btnFields = (path: string, b: Btn) => (
    <>
      <F path={`${path}.label`} onFocusPath={onFocusPath} label="Button words" value={b.label} max={LIMIT.button} disabled={d} onChange={(v) => up(`${path}.label`, v)} />
      <LinkInput api={api} store={store} value={b.url} disabled={d} onChange={(v) => up(`${path}.url`, v)} />
    </>
  );
  const busyIs = (k: string) => busy === k;

  return (
    <Box ref={top}>
      <Box sx={{ p: 1.5, mb: 1.5, borderRadius: "10px", background: "linear-gradient(135deg, rgba(194,44,110,.07), rgba(36,89,209,.06))", border: `1px solid rgba(194,44,110,.18)` }}>
        <Button fullWidth variant="contained" disableElevation disabled={!canAi || d || !!busy} onClick={() => void run("all")}
          startIcon={busyIs("all") ? <CircularProgress size={15} color="inherit" /> : <AutoAwesomeOutlinedIcon />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
          {busyIs("all") ? "Writing the page… (about a minute)" : "Write the whole page with AI"}
        </Button>
        <Hint mt={0.75}>Every field from the brief and the brand&apos;s facts, in the page&apos;s language - final words, no placeholders. Your pictures stay; each part can be written again on its own.</Hint>
      </Box>
      {msg && <Typography sx={{ fontSize: "0.82rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1.25, borderRadius: "8px", mb: 1.25 }}>{msg}</Typography>}

      <Card id="hero" title="Hero" done={!!f.hero.title.trim()} open={open.has("hero")} onToggle={() => toggle("hero")} onAi={() => void run("hero")} busy={busyIs("hero")} canAi={canAi && !d}>
        <F path="hero.eyebrow" onFocusPath={onFocusPath} label="Small line above the title" value={f.hero.eyebrow} max={LIMIT.eyebrow} disabled={d} onChange={(v) => up("hero.eyebrow", v)} />
        <F path="hero.title" onFocusPath={onFocusPath} label="Title (the page's H1)" value={f.hero.title} max={LIMIT.heroTitle} disabled={d} onChange={(v) => up("hero.title", v)} />
        <F path="hero.sub" onFocusPath={onFocusPath} label="Line under the title" value={f.hero.sub} max={LIMIT.heroSub} multiline rows={2} disabled={d} onChange={(v) => up("hero.sub", v)} />
        {btnFields("hero.button", f.hero.button)}
        <Box data-field="hero.picture" onFocus={() => onFocusPath("hero.picture")}><PictureSlot api={api} pic={f.hero.picture} disabled={d} aspect="4:5" set={(p) => up("hero.picture", p)} /></Box>
      </Card>

      <Card id="intro" title="Intro" done={!!f.intro.trim()} open={open.has("intro")} onToggle={() => toggle("intro")} onAi={() => void run("intro")} busy={busyIs("intro")} canAi={canAi && !d}>
        <F path="intro" onFocusPath={onFocusPath} label="Intro paragraph" value={f.intro} max={LIMIT.intro} multiline rows={4} disabled={d} onChange={(v) => up("intro", v)} />
      </Card>

      <Card id="benefits" title={`Benefits${f.benefits.length ? ` · ${f.benefits.length}` : ""}`} done={f.benefits.length > 0} open={open.has("benefits")} onToggle={() => toggle("benefits")} onAi={() => void run("benefits")} busy={busyIs("benefits")} canAi={canAi && !d}>
        <F path="benefitsTitle" onFocusPath={onFocusPath} label="Heading" value={f.benefitsTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("benefitsTitle", v)} />
        {f.benefits.map((b, i) => (
          <Box key={b.id} sx={{ pl: 1.25, borderLeft: `2px solid ${HAIRLINE}`, mb: 1.25 }}>
            <ItemHead label={`Benefit ${i + 1}`} disabled={d} onUp={i ? () => list("benefits").up(b.id) : undefined} onDown={i < f.benefits.length - 1 ? () => list("benefits").down(b.id) : undefined} onRemove={() => list("benefits").remove(b.id)} />
            <F path={`benefits.${b.id}.title`} onFocusPath={onFocusPath} label="Title" value={b.title} max={LIMIT.benefitTitle} disabled={d} onChange={(v) => up(`benefits.${b.id}.title`, v)} />
            <F path={`benefits.${b.id}.text`} onFocusPath={onFocusPath} label="Text" value={b.text} max={LIMIT.benefitText} multiline rows={2} disabled={d} onChange={(v) => up(`benefits.${b.id}.text`, v)} />
          </Box>
        ))}
        {f.benefits.length < 8 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("benefits").add} sx={{ ...btn, color: INK }}>Add a benefit</Button>}
      </Card>

      <Card id="sections" title={`Sections${f.sections.length ? ` · ${f.sections.length}` : ""}`} done={f.sections.length > 0} open={open.has("sections")} onToggle={() => toggle("sections")} onAi={() => void run("sections")} busy={busyIs("sections")} canAi={canAi && !d}>
        {f.sections.length === 0 && <Hint mt={0}>Text with a picture beside it - each section one idea.</Hint>}
        {f.sections.map((s, i) => (
          <Box key={s.id} sx={{ pl: 1.25, borderLeft: `2px solid ${HAIRLINE}`, mb: 1.5 }}>
            <ItemHead label={`Section ${i + 1}`} disabled={d} canAi={canAi} busy={busyIs(`section:${s.id}`)} onAi={() => void run("section", { id: s.id })}
              onUp={i ? () => list("sections").up(s.id) : undefined} onDown={i < f.sections.length - 1 ? () => list("sections").down(s.id) : undefined} onRemove={() => list("sections").remove(s.id)} />
            <F path={`sections.${s.id}.title`} onFocusPath={onFocusPath} label="Heading" value={s.title} max={LIMIT.sectionTitle} disabled={d} onChange={(v) => up(`sections.${s.id}.title`, v)} />
            <F path={`sections.${s.id}.text`} onFocusPath={onFocusPath} label="Text (a blank line = a new paragraph, - = a list)" value={s.text} max={LIMIT.sectionText} multiline rows={4} disabled={d} onChange={(v) => up(`sections.${s.id}.text`, v)} />
            <Box sx={{ mb: 1 }}><Choice label="Picture" value={s.side} onChange={(side) => up(`sections.${s.id}.side`, side)} options={[{ key: "left", label: "Left" }, { key: "right", label: "Right" }]} /></Box>
            <Box data-field={`sections.${s.id}.picture`} onFocus={() => onFocusPath(`sections.${s.id}.picture`)}><PictureSlot api={api} pic={s.picture} disabled={d} aspect="3:2" set={(p) => up(`sections.${s.id}.picture`, p)} /></Box>
          </Box>
        ))}
        {f.sections.length < 10 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("sections").add} sx={{ ...btn, color: INK }}>Add a section</Button>}
      </Card>

      <Card id="links" title={`Links to the shop${f.links.length ? ` · ${f.links.length}` : ""}`} done={f.links.length > 0} open={open.has("links")} onToggle={() => toggle("links")} onAi={() => void run("links")} busy={busyIs("links")} aiLabel="Find the shop's pages with AI" canAi={canAi && !d}>
        <Hint mt={0}>Categories and products of this store. The AI picks only among the shop&apos;s real pages.</Hint>
        <Box sx={{ mt: 1 }}><F path="linksTitle" onFocusPath={onFocusPath} label="Heading" value={f.linksTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("linksTitle", v)} /></Box>
        {f.links.map((l, i) => (
          <Box key={l.id} data-field={`links.${l.id}`} onFocus={() => onFocusPath(`links.${l.id}`)} sx={{ pl: 1.25, borderLeft: `2px solid ${HAIRLINE}`, mb: 1.25 }}>
            <ItemHead label={`Link ${i + 1}`} disabled={d} onUp={i ? () => list("links").up(l.id) : undefined} onDown={i < f.links.length - 1 ? () => list("links").down(l.id) : undefined} onRemove={() => list("links").remove(l.id)} />
            <Field label="Words" value={l.label} max={LIMIT.linkLabel} disabled={d} onChange={(v) => up(`links.${l.id}.label`, v)} />
            <LinkInput api={api} store={store} value={l.url} disabled={d} label="The page" onChange={(v) => up(`links.${l.id}.url`, v)} />
            <Field label="What the visitor finds there" value={l.note} max={LIMIT.linkNote} disabled={d} onChange={(v) => up(`links.${l.id}.note`, v)} />
          </Box>
        ))}
        {f.links.length < 16 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("links").add} sx={{ ...btn, color: INK }}>Add a link</Button>}
      </Card>

      <Card id="faq" title={`Questions${f.faq.length ? ` · ${f.faq.length}` : ""}`} done={f.faq.length > 0} open={open.has("faq")} onToggle={() => toggle("faq")} onAi={() => void run("faq")} busy={busyIs("faq")} canAi={canAi && !d}>
        <F path="faqTitle" onFocusPath={onFocusPath} label="Heading" value={f.faqTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("faqTitle", v)} />
        {f.faq.map((q, i) => (
          <Box key={q.id} sx={{ pl: 1.25, borderLeft: `2px solid ${HAIRLINE}`, mb: 1.25 }}>
            <ItemHead label={`Question ${i + 1}`} disabled={d} onUp={i ? () => list("faq").up(q.id) : undefined} onDown={i < f.faq.length - 1 ? () => list("faq").down(q.id) : undefined} onRemove={() => list("faq").remove(q.id)} />
            <F path={`faq.${q.id}.q`} onFocusPath={onFocusPath} label="Question" value={q.q} max={LIMIT.faqQ} disabled={d} onChange={(v) => up(`faq.${q.id}.q`, v)} />
            <F path={`faq.${q.id}.a`} onFocusPath={onFocusPath} label="Answer" value={q.a} max={LIMIT.faqA} multiline rows={3} disabled={d} onChange={(v) => up(`faq.${q.id}.a`, v)} />
          </Box>
        ))}
        {f.faq.length < 14 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("faq").add} sx={{ ...btn, color: INK }}>Add a question</Button>}
      </Card>

      <Card id="cta" title="Call to action" done={!!f.cta.title.trim()} open={open.has("cta")} onToggle={() => toggle("cta")} onAi={() => void run("cta")} busy={busyIs("cta")} canAi={canAi && !d}>
        <F path="cta.title" onFocusPath={onFocusPath} label="Title" value={f.cta.title} max={LIMIT.ctaTitle} disabled={d} onChange={(v) => up("cta.title", v)} />
        <F path="cta.text" onFocusPath={onFocusPath} label="Text" value={f.cta.text} max={LIMIT.ctaText} multiline rows={2} disabled={d} onChange={(v) => up("cta.text", v)} />
        {btnFields("cta.button", f.cta.button)}
      </Card>

      <Card id="seo" title="Search engines" done={!!f.seo.title.trim() && !!f.seo.description.trim()} open={open.has("seo")} onToggle={() => toggle("seo")} onAi={() => void run("seo")} busy={busyIs("seo")} canAi={canAi && !d}>
        <F path="seo.title" onFocusPath={onFocusPath} label="Meta title" value={f.seo.title} max={LIMIT.seoTitle} disabled={d} placeholder={f.hero.title} onChange={(v) => up("seo.title", v)} />
        <F path="seo.description" onFocusPath={onFocusPath} label="Meta description" value={f.seo.description} max={LIMIT.seoDescription} multiline rows={2} disabled={d} onChange={(v) => up("seo.description", v)} />
        <F path="seo.urlKey" onFocusPath={onFocusPath} label="URL key" value={f.seo.urlKey} disabled={d} helper={`/${store}/${f.seo.urlKey || urlKeyOf(f.hero.title) || "…"}`} onChange={(v) => up("seo.urlKey", v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9-]+/g, "-").slice(0, 80))} />
      </Card>
    </Box>
  );
}
