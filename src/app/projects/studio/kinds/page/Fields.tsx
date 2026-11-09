"use client";
// A NEW PAGE'S FIELDS, ONE PART AT A TIME (SARCLA 08.11.2026: "the new page should allow many more fields and allow
// filling fields with AI"; that evening: "The UX and the Build on the left: can we improve it to be more fluid,
// subdivided"). The outline (./Outline.tsx) opens one part; this is that part's fields - the hero's lines, the intro, each
// benefit, section, link and question - with the look of the field selected and the part's background tucked under
// them. A field in focus is the element selected in the preview, and a click in the preview brings its field here.
//
// Pictures: SARCLA "AI wrote the whole page ... It's not generating photos". The AI's idea for each picture is made into
// the picture by the studio itself (./Studio.tsx autoPictures); the slot shows it being made, then offers "Make another"
// and "Upload" - and says plainly when the hub cannot make pictures.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LIMIT, addItem, moveItem, removeItem, setField, setLook,
  type BlockBg, type Btn, type Fields, type ListKey, type Look, type Pic, type TextAlign, type TextColor, type TextSize,
} from "@/lib/content/studio/kinds/page/fields";
import type { Part } from "@/lib/content/studio/kinds/page/fill";
import { urlKeyOf } from "@/lib/content/studio/kinds/page/model";
import type { PartKey } from "@/lib/content/studio/kinds/page/outline";
import type { PageRow } from "@/lib/content/studio/kinds/page/shop";
import { PicturePanel, uploadPicture, type PictureAspect } from "../../pictures";
import { Field, PINK, btn, field } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Choice, Hint } from "./ui";

export type FillRun = (part: Part, opts?: { id?: string; request?: string }) => Promise<string | null>;

/** A picture slot being made, or what went wrong (the studio keeps it by language and path). */
export type Making = { state: "making" | "error"; error?: string };
/** What the studio offers every picture slot: its state, "make it now", and whether the hub makes pictures at all. */
export type PictureCtl = {
  making: (path: string) => Making | null;
  make: (path: string, idea: string) => void;
  /** null while the hub has not said yet */
  imagesOn: boolean | null;
  /** "Gallery" asked over a picture in the page: that slot's gallery opens here */
  gallery?: { path: string; nonce: number } | null;
};

export const sheen = keyframes`from { background-position: 140% 0; } to { background-position: -140% 0; }`;
export const SHEEN_BG = "linear-gradient(100deg, rgba(255,255,255,0) 25%, rgba(194,44,110,.13) 42%, rgba(255,255,255,.75) 50%, rgba(36,89,209,.12) 58%, rgba(255,255,255,0) 75%)";

/** A field that says when it is in focus - the preview selects it - and shows it is the one selected. */
function F({ path, onFocusPath, focused, look, ...rest }: { path: string; onFocusPath: (p: string) => void; focused: boolean; look?: React.ReactNode } & Parameters<typeof Field>[0]) {
  return (
    <Box data-field={path} onFocus={() => onFocusPath(path)} sx={{ position: "relative", borderRadius: "8px", mx: -0.75, px: 0.75, pt: 0.75, mb: 0.25, transition: "background-color .2s", bgcolor: focused ? "rgba(194,44,110,.06)" : "transparent" }}>
      <Field {...rest} />
      {look}
    </Box>
  );
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
      <Collapse in={open} timeout={180} unmountOnExit>
        <Box sx={{ mt: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", p: 1 }}>
          <TextField fullWidth size="small" autoFocus placeholder={`Search the shop's pages in ${store}`} value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, mb: 0.75 }} />
          {!rows && <CircularProgress size={14} />}
          {rows?.length === 0 && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>No page matches.</Typography>}
          {rows?.map((r) => (
            <Box key={r.path} component="button" type="button" onClick={() => { onChange(r.path); setOpen(false); }} sx={{ all: "unset", display: "block", width: "100%", boxSizing: "border-box", cursor: "pointer", px: 1, py: 0.6, borderRadius: "6px", "&:hover": { bgcolor: "rgba(36,89,209,.06)" } }}>
              <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK, textTransform: "capitalize" }}>{r.name}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.path}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * A picture of the page: what it shows, being made (its own animation), then "Make another", "Upload", "Choose" -
 * or, when the hub cannot make pictures, that said plainly with "Upload" beside it.
 */
export function PictureSlot({ api, pic, set, disabled, aspect = "3:2", path, ctl }: {
  api: StudioApi; pic: Pic; set: (p: Pic) => void; disabled?: boolean; aspect?: PictureAspect; path?: string; ctl?: PictureCtl;
}) {
  const [open, setOpen] = useState(false);
  const askedGallery = ctl?.gallery && ctl.gallery.path === path ? ctl.gallery.nonce : 0;
  useEffect(() => { if (askedGallery) setOpen(true); }, [askedGallery]);
  const [up, setUp] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const m0 = path && ctl ? ctl.making(path) : null;
  // a picture put in after a failed try: the failure is history
  const m = m0?.state === "error" && pic.url ? null : m0;
  const making = m?.state === "making";
  const canMake = !!ctl && !!path && !!pic.idea.trim() && ctl.imagesOn !== false;
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setUp(0);
    const r = await uploadPicture(f, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id }, setUp);
    setUp(null);
    if (!r.ok) { setErr(r.error); return; }
    set({ ...pic, url: r.picture.url, alt: pic.alt || f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120) });
  };
  const lineColor = m?.state === "error" ? "#a96a12" : MUTED;
  const line = making ? "Up to 40 seconds - it lands here and in the page."
    : m?.state === "error" ? m.error
    : !pic.url && ctl?.imagesOn === false && pic.idea ? "Pictures cannot be made on this hub - its image model is not set up. Upload one instead."
    : pic.idea ? `Idea: ${pic.idea}` : pic.url ? "" : "No idea for it yet - upload one, or choose one already made.";
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
        <Box sx={{
          position: "relative", width: 112, height: 75, borderRadius: "6px", overflow: "hidden", flexShrink: 0, bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center",
          ...(making ? { backgroundImage: SHEEN_BG, backgroundSize: "260% 100%", animation: `${sheen} 1.4s linear infinite` } : {}),
        }}>
          {pic.url ? <Box component="img" src={pic.url} alt={pic.alt} sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: making ? 0.5 : 1 }} />
            : making ? <AutoAwesomeOutlinedIcon sx={{ color: PINK, fontSize: 20 }} /> : <ImageOutlinedIcon sx={{ color: MUTED }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: INK }}>{making ? "Making the picture" : pic.url ? "The picture" : "No picture yet"}</Typography>
          {line && <Typography sx={{ fontSize: "0.74rem", color: lineColor, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{line}</Typography>}
          {making && <LinearProgress sx={{ mt: 0.75, height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />}
          {!making && (
            <Box sx={{ display: "flex", gap: 0.25, mt: 0.25, flexWrap: "wrap", mx: -0.75 }}>
              {canMake && (
                <Button size="small" disabled={disabled} onClick={() => ctl!.make(path!, pic.idea)} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.75, color: PINK }}>
                  {pic.url ? "Make another" : m?.state === "error" ? "Try again" : "Make it"}
                </Button>
              )}
              <Button size="small" disabled={disabled || up !== null} onClick={() => file.current?.click()} startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.75, color: INK }}>Upload</Button>
              <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} sx={{ ...btn, px: 0.75, color: INK }}>{open ? "Close the gallery" : "Gallery"}</Button>
              {pic.url && <Button size="small" disabled={disabled} onClick={() => set({ ...pic, url: "" })} sx={{ ...btn, px: 0.75, color: MUTED }}>Remove</Button>}
            </Box>
          )}
          {up !== null && <LinearProgress variant="determinate" value={up * 100} sx={{ mt: 0.5, height: 3, borderRadius: 2 }} />}
          {err && <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", mt: 0.25 }}>{err}</Typography>}
          <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </Box>
      </Box>
      <Collapse in={open} timeout={200} unmountOnExit>
        <Box sx={{ mt: 1, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff" }}>
          <PicturePanel projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect={aspect} suggestion={pic.idea} columns={3}
            tabs={["project", "mine", "make"]} start="project"
            onPick={(p) => { set({ ...pic, url: p.url, alt: pic.alt || p.prompt?.slice(0, 120) || "" }); setOpen(false); }} />
        </Box>
      </Collapse>
      {pic.url && !making && <Box sx={{ mt: 1 }}><Field label="What it shows (alt text)" value={pic.alt} max={LIMIT.alt} disabled={disabled} onChange={(v) => set({ ...pic, alt: v })} /></Box>}
    </Box>
  );
}

/* ── the look of the field selected, the background of a part ─────────── */

function TextLook({ look, set }: { look: Look; set: (p: Partial<Look>) => void }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75, pb: 1.25 }}>
      <Choice label="Size" value={look.size ?? "m"} onChange={(v: TextSize) => set({ size: v === "m" ? undefined : v })} options={[{ key: "s", label: "Small" }, { key: "m", label: "Normal" }, { key: "l", label: "Large" }]} />
      <Choice label="Align" value={look.align ?? "left"} onChange={(v: TextAlign) => set({ align: v === "left" ? undefined : v })} options={[{ key: "left", label: "Left" }, { key: "center", label: "Centre" }]} />
      <Choice label="Colour" value={look.color ?? "auto"} onChange={(v: TextColor | "auto") => set({ color: v === "auto" ? undefined : v })}
        options={[{ key: "auto", label: "Standard" }, { key: "petrol", label: "Petrol" }, { key: "ink", label: "Ink" }, { key: "red", label: "Red" }, { key: "muted", label: "Grey" }]} />
    </Box>
  );
}

/** "Look" under the field selected - tucked away until asked for. */
function LookToggle({ path, f, setF, disabled }: { path: string; f: Fields; setF: (next: Fields, label?: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const look = f.looks[path] ?? {};
  const set = Object.keys(look).length;
  return (
    <Box sx={{ mt: -0.75, mb: 0.5 }}>
      <Button size="small" disabled={disabled} onClick={() => setOpen((x) => !x)} startIcon={<TuneIcon sx={{ fontSize: 15 }} />} sx={{ ...btn, px: 0.5, minWidth: 0, fontSize: "0.76rem", color: set ? PINK : MUTED }}>
        {open ? "Close the look" : set ? "Look · changed" : "Look"}
      </Button>
      <Collapse in={open} timeout={180} unmountOnExit><TextLook look={look} set={(p) => setF(setLook(f, path, p), "Changed the look")} /></Collapse>
    </Box>
  );
}

function Background({ path, f, setF, disabled }: { path: string; f: Fields; setF: (next: Fields, label?: string) => void; disabled: boolean }) {
  const look = f.looks[path] ?? {};
  return (
    <Box sx={{ pt: 1, mt: 0.5 }}>
      <Choice label="Background" value={look.bg ?? "default"} onChange={(v: BlockBg | "default") => !disabled && setF(setLook(f, path, { bg: v === "default" ? undefined : v }), "Changed the background")}
        options={[{ key: "default", label: "Standard" }, { key: "white", label: "White" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }]} />
    </Box>
  );
}

function ItemHead({ label, onUp, onDown, onRemove, onAi, busy, canAi, disabled }: {
  label: string; onUp?: () => void; onDown?: () => void; onRemove: () => void; onAi?: () => void; busy?: boolean; canAi?: boolean; disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.25 }}>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, flex: 1 }}>{label}</Typography>
      {onAi && <Tooltip title="Write it with AI"><span><IconButton size="small" disabled={!canAi || busy || disabled} onClick={onAi} sx={{ color: PINK }}>{busy ? <CircularProgress size={13} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}</IconButton></span></Tooltip>}
      <Tooltip title="Up"><span><IconButton size="small" disabled={!onUp || disabled} onClick={onUp}><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      <Tooltip title="Down"><span><IconButton size="small" disabled={!onDown || disabled} onClick={onDown}><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
      <Tooltip title="Remove"><span><IconButton size="small" disabled={disabled} onClick={onRemove}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
    </Box>
  );
}

/** One item of a list part (a benefit, a section, a link, a question), selected when its block is. */
const itemBox = (on: boolean) => ({
  p: 1.25, pt: 0.75, mb: 1, borderRadius: "8px", border: `1px solid ${on ? "rgba(194,44,110,.35)" : HAIRLINE}`, bgcolor: on ? "rgba(194,44,110,.03)" : "#fbfcfd",
  transition: "border-color .2s, background-color .2s",
});

/* ── a part's fields ──────────────────────────────────────────────────── */

export function PartBody({ api, part, f, set, store, canEdit, canAi, fill, busy, focusPath, selBlock, onFocusPath, pictures }: {
  api: StudioApi; part: PartKey; f: Fields; set: (next: Fields, label?: string) => void; store: string; canEdit: boolean; canAi: boolean;
  fill: FillRun; busy: string | null; focusPath: string | null; selBlock: string | null; onFocusPath: (p: string) => void; pictures: PictureCtl;
}) {
  const top = useRef<HTMLDivElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const d = !canEdit;
  const up = (path: string, v: unknown) => set(setField(f, path, v));
  const run = async (p: Part, opts?: { id?: string; request?: string }) => { setMsg(null); const r = await fill(p, opts); if (r) setMsg(r); };

  // a field (or an item) selected in the preview comes into view here
  useEffect(() => {
    const key = focusPath ?? selBlock;
    if (!key) return;
    const t = setTimeout(() => {
      const el = top.current?.querySelector(`[data-field="${CSS.escape(key)}"]`) ?? top.current?.querySelector(`[data-item="${CSS.escape(key)}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 240);
    return () => clearTimeout(t);
  }, [focusPath, selBlock]);

  const look = (path: string) => (focusPath === path && canEdit ? <LookToggle path={path} f={f} setF={set} disabled={d} /> : undefined);
  const fp = (path: string) => ({ path, onFocusPath, focused: focusPath === path, look: look(path) });
  const list = <K extends ListKey>(key: K) => ({
    add: () => { const r = addItem(f, key); set(r.fields); onFocusPath(`${key}.${r.id}`); },
    up: (id: string) => set(moveItem(f, key, id, -1)),
    down: (id: string) => set(moveItem(f, key, id, 1)),
    remove: (id: string) => set(removeItem(f, key, id), "Removed an item"),
  });
  const btnFields = (path: string, b: Btn) => (
    <>
      <F {...fp(`${path}.label`)} label="Button words" value={b.label} max={LIMIT.button} disabled={d} onChange={(v) => up(`${path}.label`, v)} />
      <LinkInput api={api} store={store} value={b.url} disabled={d} onChange={(v) => up(`${path}.url`, v)} />
    </>
  );
  const pic = (path: string, p: Pic) => (
    <Box data-field={path} onFocus={() => onFocusPath(path)}>
      <PictureSlot api={api} pic={p} disabled={d} path={path} ctl={pictures} set={(n) => set(setField(f, path, n), n.url !== p.url ? "Changed a picture" : undefined)} />
    </Box>
  );

  let body: React.ReactNode = null;
  if (part === "hero") {
    body = (
      <>
        <F {...fp("hero.eyebrow")} label="Small line above the title" value={f.hero.eyebrow} max={LIMIT.eyebrow} disabled={d} onChange={(v) => up("hero.eyebrow", v)} />
        <F {...fp("hero.title")} label="Title (the page's H1)" value={f.hero.title} max={LIMIT.heroTitle} disabled={d} onChange={(v) => up("hero.title", v)} />
        <F {...fp("hero.sub")} label="Line under the title" value={f.hero.sub} max={LIMIT.heroSub} multiline rows={2} disabled={d} onChange={(v) => up("hero.sub", v)} />
        {btnFields("hero.button", f.hero.button)}
        {pic("hero.picture", f.hero.picture)}
        <Background path="hero" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "intro") {
    body = (
      <>
        <F {...fp("intro")} label="Intro paragraph" value={f.intro} max={LIMIT.intro} multiline rows={4} disabled={d} onChange={(v) => up("intro", v)} />
        <Background path="intro-block" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "benefits") {
    body = (
      <>
        <F {...fp("benefitsTitle")} label="Heading" value={f.benefitsTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("benefitsTitle", v)} />
        {f.benefits.map((b, i) => (
          <Box key={b.id} data-item={`benefits.${b.id}`} sx={itemBox(selBlock === `benefits.${b.id}`)}>
            <ItemHead label={`Benefit ${i + 1}`} disabled={d} onUp={i ? () => list("benefits").up(b.id) : undefined} onDown={i < f.benefits.length - 1 ? () => list("benefits").down(b.id) : undefined} onRemove={() => list("benefits").remove(b.id)} />
            <F {...fp(`benefits.${b.id}.title`)} label="Title" value={b.title} max={LIMIT.benefitTitle} disabled={d} onChange={(v) => up(`benefits.${b.id}.title`, v)} />
            <F {...fp(`benefits.${b.id}.text`)} label="Text" value={b.text} max={LIMIT.benefitText} multiline rows={2} disabled={d} onChange={(v) => up(`benefits.${b.id}.text`, v)} />
          </Box>
        ))}
        {f.benefits.length < 8 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("benefits").add} sx={{ ...btn, color: INK }}>Add a benefit</Button>}
        <Background path="benefits" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "sections") {
    body = (
      <>
        {f.sections.length === 0 && <Hint mt={0}>Text with a picture beside it - each section one idea.</Hint>}
        {f.sections.map((s, i) => (
          <Box key={s.id} data-item={`sections.${s.id}`} sx={itemBox(selBlock === `sections.${s.id}`)}>
            <ItemHead label={`Section ${i + 1}`} disabled={d} canAi={canAi} busy={busy === `section:${s.id}`} onAi={() => void run("section", { id: s.id })}
              onUp={i ? () => list("sections").up(s.id) : undefined} onDown={i < f.sections.length - 1 ? () => list("sections").down(s.id) : undefined} onRemove={() => list("sections").remove(s.id)} />
            <F {...fp(`sections.${s.id}.title`)} label="Heading" value={s.title} max={LIMIT.sectionTitle} disabled={d} onChange={(v) => up(`sections.${s.id}.title`, v)} />
            <F {...fp(`sections.${s.id}.text`)} label="Text (a blank line = a new paragraph, - = a list)" value={s.text} max={LIMIT.sectionText} multiline rows={4} disabled={d} onChange={(v) => up(`sections.${s.id}.text`, v)} />
            {pic(`sections.${s.id}.picture`, s.picture)}
            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Choice label="Picture" value={s.side} onChange={(side) => !d && set(setField(f, `sections.${s.id}.side`, side), "Moved the picture")} options={[{ key: "left", label: "Left" }, { key: "right", label: "Right" }]} />
              <Background path={`sections.${s.id}`} f={f} setF={set} disabled={d} />
            </Box>
          </Box>
        ))}
        {f.sections.length < 10 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("sections").add} sx={{ ...btn, color: INK }}>Add a section</Button>}
      </>
    );
  } else if (part === "links") {
    body = (
      <>
        <Hint mt={0}>Categories and products of {store}. The AI picks only among the shop&apos;s real pages.</Hint>
        <Box sx={{ mt: 0.5 }}><F {...fp("linksTitle")} label="Heading" value={f.linksTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("linksTitle", v)} /></Box>
        {f.links.map((l, i) => (
          <Box key={l.id} data-item={`links.${l.id}`} data-field={`links.${l.id}`} onFocus={() => onFocusPath(`links.${l.id}`)} sx={itemBox(focusPath === `links.${l.id}`)}>
            <ItemHead label={`Link ${i + 1}`} disabled={d} onUp={i ? () => list("links").up(l.id) : undefined} onDown={i < f.links.length - 1 ? () => list("links").down(l.id) : undefined} onRemove={() => list("links").remove(l.id)} />
            <Field label="Words" value={l.label} max={LIMIT.linkLabel} disabled={d} onChange={(v) => up(`links.${l.id}.label`, v)} />
            <LinkInput api={api} store={store} value={l.url} disabled={d} label="The page" onChange={(v) => up(`links.${l.id}.url`, v)} />
            <Field label="What the visitor finds there" value={l.note} max={LIMIT.linkNote} disabled={d} onChange={(v) => up(`links.${l.id}.note`, v)} />
          </Box>
        ))}
        {f.links.length < 16 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("links").add} sx={{ ...btn, color: INK }}>Add a link</Button>}
        <Background path="links" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "faq") {
    body = (
      <>
        <F {...fp("faqTitle")} label="Heading" value={f.faqTitle} max={LIMIT.blockTitle} disabled={d} onChange={(v) => up("faqTitle", v)} />
        {f.faq.map((q, i) => (
          <Box key={q.id} data-item={`faq.${q.id}`} sx={itemBox(selBlock === `faq.${q.id}`)}>
            <ItemHead label={`Question ${i + 1}`} disabled={d} onUp={i ? () => list("faq").up(q.id) : undefined} onDown={i < f.faq.length - 1 ? () => list("faq").down(q.id) : undefined} onRemove={() => list("faq").remove(q.id)} />
            <F {...fp(`faq.${q.id}.q`)} label="Question" value={q.q} max={LIMIT.faqQ} disabled={d} onChange={(v) => up(`faq.${q.id}.q`, v)} />
            <F {...fp(`faq.${q.id}.a`)} label="Answer" value={q.a} max={LIMIT.faqA} multiline rows={3} disabled={d} onChange={(v) => up(`faq.${q.id}.a`, v)} />
          </Box>
        ))}
        {f.faq.length < 14 && <Button size="small" startIcon={<AddIcon />} disabled={d} onClick={list("faq").add} sx={{ ...btn, color: INK }}>Add a question</Button>}
        <Background path="faq" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "cta") {
    body = (
      <>
        <F {...fp("cta.title")} label="Title" value={f.cta.title} max={LIMIT.ctaTitle} disabled={d} onChange={(v) => up("cta.title", v)} />
        <F {...fp("cta.text")} label="Text" value={f.cta.text} max={LIMIT.ctaText} multiline rows={2} disabled={d} onChange={(v) => up("cta.text", v)} />
        {btnFields("cta.button", f.cta.button)}
        <Background path="cta" f={f} setF={set} disabled={d} />
      </>
    );
  } else if (part === "seo") {
    body = (
      <>
        <Hint mt={0}>What Google shows - not on the page itself.</Hint>
        <Box sx={{ mt: 0.75 }}>
          <F {...fp("seo.title")} look={undefined} label="Meta title" value={f.seo.title} max={LIMIT.seoTitle} disabled={d} placeholder={f.hero.title} onChange={(v) => up("seo.title", v)} />
          <F {...fp("seo.description")} look={undefined} label="Meta description" value={f.seo.description} max={LIMIT.seoDescription} multiline rows={2} disabled={d} onChange={(v) => up("seo.description", v)} />
          <F {...fp("seo.urlKey")} look={undefined} label="URL key" value={f.seo.urlKey} disabled={d} helper={`/${store}/${f.seo.urlKey || urlKeyOf(f.hero.title) || "…"}`} onChange={(v) => up("seo.urlKey", v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9-]+/g, "-").slice(0, 80))} />
        </Box>
      </>
    );
  }
  return (
    <Box ref={top}>
      {msg && <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px", mb: 1 }}>{msg}</Typography>}
      {body}
    </Box>
  );
}

