"use client";
// THE SELECTED ELEMENT (SARCLA 08.11.2026: "the page editor should allow element select for editing and so forth; it
// should be a real AI-assisted CMS"). What a click in the preview selected, and what can be done with it: its words
// (here, or in the page with a double-click), its picture, its link, its look (what makes sense for it - size,
// alignment, colour, background, button style), hidden or removed - or "Change it with AI", for this element alone.
//   a new page    the element IS a field: editing it edits the field, its look is kept apart (fields.looks)
//   a shop page   the element is the shop's own (a change aimed at it) or one a change put in (that change edited)

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  LIMIT, fieldKind, fieldLabel, getField, moveItem, removeItem, setField, setLook,
  type BlockBg, type ButtonLook, type Fields, type ListKey, type Look, type Pic, type TextAlign, type TextColor, type TextSize,
} from "@/lib/content/studio/kinds/page/fields";
import type { Part } from "@/lib/content/studio/kinds/page/fill";
import { INSERT_WHERE, INSERT_WHERE_LABEL, type InsertWhere, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import type { InsertOut } from "@/lib/content/studio/kinds/page/shop";
import type { Picture } from "../../pictures";
import { PicturePanel } from "../../pictures";
import { Field, PINK, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { applyElementEdit, lookCss, lookOf, type ElementEdit } from "./edits";
import { LinkInput, PictureSlot, type FillRun } from "./Fields";
import type { Picked } from "./Frame";
import { Chip, Choice, Hint, Kicker } from "./ui";

export type Selection = { key: string; picked: Picked | null };

const LIST: ListKey[] = ["benefits", "sections", "links", "faq"];
const PART_OF_BLOCK: Record<string, Part> = { hero: "hero", "intro-block": "intro", benefits: "benefits", sections: "sections", links: "links", faq: "faq", cta: "cta" };
const BLOCK_NAME: Record<string, string> = { hero: "The hero", "intro-block": "The intro", benefits: "The benefits", sections: "The sections", links: "The links", faq: "The questions", cta: "The call to action" };

/* ── a new page's field ───────────────────────────────────────────────── */

function TextLook({ look, set, heading }: { look: Look; set: (p: Partial<Look>) => void; heading: boolean }) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Choice label="Size" value={look.size ?? "m"} onChange={(v: TextSize) => set({ size: v === "m" ? undefined : v })} options={[{ key: "s", label: "Small" }, { key: "m", label: heading ? "Normal" : "Normal" }, { key: "l", label: "Large" }]} />
      <Choice label="Align" value={look.align ?? "left"} onChange={(v: TextAlign) => set({ align: v === "left" ? undefined : v })} options={[{ key: "left", label: "Left" }, { key: "center", label: "Centre" }]} />
      <Choice label="Colour" value={look.color ?? "auto"} onChange={(v: TextColor | "auto") => set({ color: v === "auto" ? undefined : v })}
        options={[{ key: "auto", label: "Standard" }, { key: "petrol", label: "Petrol" }, { key: "ink", label: "Ink" }, { key: "red", label: "Red" }, { key: "muted", label: "Grey" }]} />
    </Box>
  );
}

function FieldPanel({ api, f, setF, sel, fill, busy, canAi, store, onEditInPage, record }: {
  api: StudioApi; f: Fields; setF: (next: Fields, label?: string) => void; sel: Selection; fill: FillRun; busy: string | null; canAi: boolean; store: string;
  onEditInPage: () => void; record: (label: string) => void;
}) {
  const key = sel.key;
  const path = key.slice(2);
  const canEdit = api.data.access.canEdit;
  const [msg, setMsg] = useState<string | null>(null);
  const ai = async (request?: string) => { setMsg(null); const r = await fill("field", { id: path, request }); if (r) setMsg(r); };

  if (key.startsWith("b:")) {
    const parts = path.split(".");
    const item = parts.length === 2 && LIST.includes(parts[0] as ListKey);
    const listKey = parts[0] as ListKey;
    const look = f.looks[path] ?? {};
    const part = item && parts[0] === "sections" ? "section" : PART_OF_BLOCK[parts[0]];
    const name = item ? fieldLabel(f, path) : BLOCK_NAME[path] ?? path;
    const sec = item && listKey === "sections" ? f.sections.find((s) => s.id === parts[1]) : null;
    return (
      <Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.25 }}>{name}</Typography>
        {part && (
          <Button fullWidth variant="outlined" disabled={!canAi || !canEdit || !!busy} onClick={() => void fill(part, item ? { id: parts[1] } : undefined).then((r) => setMsg(r))}
            startIcon={busy ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, borderRadius: "8px", borderColor: HAIRLINE, color: INK, mb: 1.5, justifyContent: "flex-start" }}>
            Write {item ? "this one" : name.toLowerCase().replace(/^the /, "the ")} with AI
          </Button>
        )}
        {!item || listKey === "sections" ? (
          <>
            <Kicker mt={0}>Background</Kicker>
            <Choice value={look.bg ?? "default"} onChange={(v: BlockBg | "default") => setF(setLook(f, path, { bg: v === "default" ? undefined : v }), "Changed the background")}
              options={[{ key: "default", label: "Standard" }, { key: "white", label: "White" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }]} />
          </>
        ) : null}
        {sec && (
          <>
            <Kicker>Picture</Kicker>
            <Box sx={{ mb: 1 }}><Choice value={sec.side} onChange={(side) => setF(setField(f, `${path}.side`, side), "Moved the picture")} options={[{ key: "left", label: "On the left" }, { key: "right", label: "On the right" }]} /></Box>
          </>
        )}
        {item && (
          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            <Button size="small" disabled={!canEdit} onClick={() => setF(moveItem(f, listKey, parts[1], -1), "Moved up")} sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Move up</Button>
            <Button size="small" disabled={!canEdit} onClick={() => setF(moveItem(f, listKey, parts[1], 1), "Moved down")} sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Move down</Button>
            <Button size="small" disabled={!canEdit} onClick={() => { record(`Removed ${name.toLowerCase()}`); setF(removeItem(f, listKey, parts[1])); }} sx={{ ...btn, color: "#c5221f", ml: "auto" }}>Remove</Button>
          </Box>
        )}
        {msg && <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", mt: 1 }}>{msg}</Typography>}
      </Box>
    );
  }

  const kind = fieldKind(path);
  const value = getField(f, path);
  const look = f.looks[path] ?? {};
  const label = fieldLabel(f, path);

  if (kind === "picture") {
    const pic = (value ?? { url: "", alt: "", idea: "" }) as Pic;
    return (
      <Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.25 }}>{label}</Typography>
        <PictureSlot api={api} pic={pic} disabled={!canEdit} aspect={path.startsWith("hero") ? "4:5" : "3:2"} set={(p) => setF(setField(f, path, p), p.url !== pic.url ? "Changed the picture" : undefined)} />
        {pic.idea && <Hint>The AI&apos;s idea for it is typed in for you under &quot;Make one&quot;.</Hint>}
      </Box>
    );
  }
  if (kind === "button") {
    const b = (value ?? { label: "", url: "" }) as { label: string; url: string };
    return (
      <Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.25 }}>{label}</Typography>
        <Field label="Its words" value={b.label} max={LIMIT.button} disabled={!canEdit} onChange={(v) => setF(setField(f, `${path}.label`, v))} />
        <LinkInput api={api} store={store} value={b.url} disabled={!canEdit} onChange={(v) => setF(setField(f, `${path}.url`, v))} />
        <Box sx={{ display: "grid", gap: 1 }}>
          <Choice label="Style" value={look.button ?? "red"} onChange={(v: ButtonLook) => setF(setLook(f, path, { button: v === "red" ? undefined : v }), "Changed the button")} options={[{ key: "red", label: "Red" }, { key: "petrol", label: "Petrol" }, { key: "outline", label: "Outline" }]} />
          <Choice label="Align" value={look.align ?? "left"} onChange={(v: TextAlign) => setF(setLook(f, path, { align: v === "left" ? undefined : v }))} options={[{ key: "left", label: "Left" }, { key: "center", label: "Centre" }]} />
        </Box>
        <Button size="small" disabled={!canAi || !canEdit || !!busy} onClick={() => void fill("field", { id: `${path}.label` }).then(setMsg)} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: PINK, mt: 1.25, px: 0 }}>Write its words with AI</Button>
        {msg && <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", mt: 1 }}>{msg}</Typography>}
      </Box>
    );
  }
  if (kind === "link") {
    const id = path.split(".")[1];
    const l = f.links.find((x) => x.id === id);
    if (!l) return <Hint mt={0}>This link is gone.</Hint>;
    return (
      <Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.25 }}>{label}</Typography>
        <Field label="Words" value={l.label} max={LIMIT.linkLabel} disabled={!canEdit} onChange={(v) => setF(setField(f, `${path}.label`, v))} />
        <LinkInput api={api} store={store} value={l.url} disabled={!canEdit} label="The page" onChange={(v) => setF(setField(f, `${path}.url`, v))} />
        <Field label="What the visitor finds there" value={l.note} max={LIMIT.linkNote} disabled={!canEdit} onChange={(v) => setF(setField(f, `${path}.note`, v))} />
        <Button size="small" disabled={!canEdit} onClick={() => { record("Removed a link"); setF(removeItem(f, "links", id)); }} sx={{ ...btn, color: "#c5221f", px: 0 }}>Remove the link</Button>
      </Box>
    );
  }
  const text = typeof value === "string" ? value : "";
  const heading = /title|\.q$|Title$/.test(path);
  return (
    <Box>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.25 }}>{label}</Typography>
      <TextField fullWidth multiline minRows={kind === "long" ? 4 : 1} maxRows={16} size="small" value={text} disabled={!canEdit} onChange={(e) => setF(setField(f, path, e.target.value))} sx={{ ...field, mb: 1 }} />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.75 }}>
        <Button size="small" disabled={!canEdit} onClick={onEditInPage} startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Edit in the page</Button>
      </Box>
      <Kicker mt={0}>With AI, this field only</Kicker>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.75 }}>
        {[["Write it", undefined], ["Shorter", "Make it shorter, same meaning."], ["More convincing", "Make it more convincing for a buyer - concrete benefits, no hype."], ["Simpler", "Simpler words, shorter sentences."]].map(([l, r]) => (
          <Button key={l} size="small" disabled={!canAi || !canEdit || !!busy} onClick={() => void ai(r)} startIcon={busy === `field:${path}` && l === "Write it" ? <CircularProgress size={13} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff" }}>{l}</Button>
        ))}
      </Box>
      {busy === `field:${path}` && <Hint mt={0}>Writing…</Hint>}
      {msg && <Typography sx={{ fontSize: "0.8rem", color: "#7f4f0b", mb: 1 }}>{msg}</Typography>}
      {path !== "seo.title" && path !== "seo.description" && path !== "seo.urlKey" && !path.endsWith(".alt") && (
        <>
          <Kicker mt={0}>Look</Kicker>
          <TextLook look={look} heading={heading} set={(p) => setF(setLook(f, path, p), "Changed the look")} />
        </>
      )}
    </Box>
  );
}

/* ── an existing page's element ───────────────────────────────────────── */

const COLORS: Record<string, string> = { petrol: "#274e64", ink: "#1d2326", red: "#d80901", grey: "#6b767c", white: "#ffffff" };
const SIZES: Record<string, string> = { s: "0.88em", l: "1.2em", xl: "1.45em" };
const BGS: Record<string, string> = { grey: "#f2f4f5", petrol: "#274e64", sand: "#f7f2ea", white: "#ffffff" };
const keyOf = (map: Record<string, string>, v: string | undefined) => Object.entries(map).find(([, x]) => x === v)?.[0];

function ElementPanel({ api, view, setChanges, picked, onEditInPage }: {
  api: StudioApi; view: PageDoc; setChanges: (changes: PageDoc["changes"], label: string) => void; picked: Picked; onEditInPage: () => void;
}) {
  const canEdit = api.data.access.canEdit;
  const [words, setWords] = useState(picked.text);
  // the words the page has now (after "Use these words" the button rests until they change again)
  const [kept, setKept] = useState(picked.text);
  const [href, setHref] = useState(picked.href ?? "");
  const [alt, setAlt] = useState(picked.alt ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pics, setPics] = useState(false);
  useEffect(() => { setWords(picked.text); setKept(picked.text); setHref(picked.href ?? ""); setAlt(picked.alt ?? ""); setErr(null); setPics(false); }, [picked.key, picked.text, picked.href, picked.alt]);

  const run = (e: ElementEdit) => {
    const r = applyElementEdit(view, picked, e);
    if ("error" in r) { setErr(r.error); return; }
    setErr(null);
    if (e.kind === "words") setKept(e.text);
    setChanges(r.changes, r.label);
  };
  const origin = picked.frag ? `Put in by change ${picked.frag.change + 1}` : picked.host?.changes.length ? `Changed by change ${picked.host.changes.map((n) => n + 1).join(", ")}` : "The shop's own element";
  const look = picked.selector ? lookOf(view.changes, picked.selector) : {};
  const setLookRule = (k: string, v: string | undefined) => {
    const next = { ...look, [k]: v ?? "" };
    if (!picked.selector || picked.frag) { if (v) run({ kind: "look", css: `${k}:${v}` }); return; }
    run({ kind: "look", css: lookCss(picked.selector, next) });
  };
  const hidden = view.changes.some((c) => c.op === "hide" && (c as { selector?: string }).selector === picked.selector);
  const isImg = picked.tag === "img";
  const textish = picked.editable && !isImg;

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
        <Chip tint="slate">&lt;{picked.tag}&gt;</Chip>
        <Chip tint={picked.frag || picked.host ? "purple" : "blue"}>{origin}</Chip>
      </Box>
      {picked.selector && <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontFamily: "ui-monospace, Consolas, monospace", wordBreak: "break-all", mb: 1.5 }}>{picked.selector}</Typography>}

      {textish && (
        <>
          <Kicker mt={0.5}>Its words</Kicker>
          <TextField fullWidth multiline minRows={2} maxRows={14} size="small" value={words} disabled={!canEdit} onChange={(e) => setWords(e.target.value)} sx={{ ...field, mb: 0.75 }} />
          <Box sx={{ display: "flex", gap: 0.75, mb: 1.75 }}>
            <Button size="small" variant="contained" disableElevation disabled={!canEdit || words.trim() === kept.trim() || !words.trim()} onClick={() => run({ kind: "words", text: words.trim() })} sx={{ ...mainBtn, borderRadius: "6px" }}>Use these words</Button>
            <Button size="small" disabled={!canEdit} onClick={onEditInPage} startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Edit in the page</Button>
          </Box>
        </>
      )}

      {isImg && (
        <>
          <Kicker mt={0.5}>The picture</Kicker>
          {picked.src && <Box component="img" src={picked.src} alt={picked.alt} sx={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: "6px", bgcolor: "#f2f4f5", mb: 1 }} />}
          <Button size="small" disabled={!canEdit} onClick={() => setPics((x) => !x)} sx={{ ...btn, color: PINK, px: 0, mb: 1 }}>{pics ? "Close" : "Use another picture"}</Button>
          {pics && (
            <Box sx={{ p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", mb: 1.25 }}>
              <PicturePanel projectId={api.data.piece.projectId} pieceId={api.data.piece.id} me={api.data.me} aspect="3:2" tabs={["make", "upload", "project", "mine"]} start="project"
                onPick={(p: Picture) => { run({ kind: "attr", name: "src", value: p.url }); setPics(false); }} />
              <Hint>A picture kept in the hub must be uploaded to Magento before this goes live - the hand-over lists it.</Hint>
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", mb: 1.5 }}>
            <TextField fullWidth size="small" label="What it shows (alt text)" value={alt} disabled={!canEdit} onChange={(e) => setAlt(e.target.value)} sx={field} />
            <Button size="small" disabled={!canEdit || alt === (picked.alt ?? "")} onClick={() => run({ kind: "attr", name: "alt", value: alt })} sx={{ ...btn, height: 40, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Use</Button>
          </Box>
        </>
      )}

      {picked.href !== undefined && (
        <>
          <Kicker mt={0.5}>Its link</Kicker>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", mb: 1.5 }}>
            <TextField fullWidth size="small" value={href} disabled={!canEdit} onChange={(e) => setHref(e.target.value)} sx={field} />
            <Button size="small" disabled={!canEdit || href === (picked.href ?? "") || !href.trim()} onClick={() => run({ kind: "attr", name: "href", value: href.trim() })} sx={{ ...btn, height: 40, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px" }}>Use</Button>
          </Box>
        </>
      )}

      {!isImg && (
        <>
          <Kicker mt={0.5}>Look</Kicker>
          <Box sx={{ display: "grid", gap: 1, mb: 1.5 }}>
            <Choice label="Colour" value={keyOf(COLORS, look.color) ?? "auto"} onChange={(v) => setLookRule("color", v === "auto" ? undefined : COLORS[v])}
              options={[{ key: "auto", label: "As it is" }, { key: "petrol", label: "Petrol" }, { key: "ink", label: "Ink" }, { key: "red", label: "Red" }, { key: "grey", label: "Grey" }, { key: "white", label: "White" }]} />
            <Choice label="Size" value={keyOf(SIZES, look["font-size"]) ?? "auto"} onChange={(v) => setLookRule("font-size", v === "auto" ? undefined : SIZES[v])}
              options={[{ key: "auto", label: "As it is" }, { key: "s", label: "Smaller" }, { key: "l", label: "Larger" }, { key: "xl", label: "Much larger" }]} />
            <Choice label="Weight" value={look["font-weight"] === "700" ? "bold" : look["font-weight"] === "400" ? "regular" : "auto"} onChange={(v) => setLookRule("font-weight", v === "bold" ? "700" : v === "regular" ? "400" : undefined)}
              options={[{ key: "auto", label: "As it is" }, { key: "regular", label: "Regular" }, { key: "bold", label: "Bold" }]} />
            <Choice label="Align" value={look["text-align"] ?? "auto"} onChange={(v) => setLookRule("text-align", v === "auto" ? undefined : v)}
              options={[{ key: "auto", label: "As it is" }, { key: "left", label: "Left" }, { key: "center", label: "Centre" }]} />
            <Choice label="Background" value={keyOf(BGS, look.background) ?? "auto"} onChange={(v) => setLookRule("background", v === "auto" ? undefined : BGS[v])}
              options={[{ key: "auto", label: "As it is" }, { key: "grey", label: "Grey" }, { key: "sand", label: "Sand" }, { key: "petrol", label: "Petrol" }, { key: "white", label: "White" }]} />
          </Box>
        </>
      )}

      <Button size="small" disabled={!canEdit} onClick={() => run({ kind: "hide", on: !hidden })} sx={{ ...btn, color: hidden ? INK : "#c5221f", px: 0 }}>
        {picked.frag ? "Remove it from the page" : hidden ? "Show it again" : "Hide it on the page"}
      </Button>
      {err && <Typography sx={{ fontSize: "0.82rem", color: "#c5221f", mt: 1 }}>{err}</Typography>}
    </Box>
  );
}

/* ── a banner placed in the page ──────────────────────────────────────── */

function InsertPanel({ view, setView, id, inserts, record }: { view: PageDoc; setView: (v: PageDoc) => void; id: string; inserts: InsertOut[] | null; record: (label: string) => void }) {
  const ins = view.inserts.find((x) => x.id === id);
  const out = inserts?.find((x) => x.id === id);
  if (!ins) return <Hint mt={0}>This banner is no longer in the page.</Hint>;
  return (
    <Box>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.5 }}>{out?.title ?? "A banner"}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, mb: 1.5 }}><Chip tint="purple">Banner</Chip><Chip tint="slate">{ins.preset}</Chip></Box>
      {out && !out.ok && <Typography sx={{ fontSize: "0.82rem", color: "#a96a12", mb: 1 }}>{out.error}</Typography>}
      <Kicker mt={0}>Where it is</Kicker>
      <Choice value={ins.where} onChange={(where: InsertWhere) => setView({ ...view, inserts: view.inserts.map((x) => (x.id === id ? { ...x, where } : x)) })}
        options={INSERT_WHERE.map((k) => ({ key: k, label: INSERT_WHERE_LABEL[k] }))} />
      <Hint>The banner is edited in its own to-do (Banner); it shows here as it is there.</Hint>
      <Button size="small" onClick={() => { record("Took a banner out of the page"); setView({ ...view, inserts: view.inserts.filter((x) => x.id !== id) }); }} sx={{ ...btn, color: "#c5221f", px: 0, mt: 1.5 }}>Take it out of the page</Button>
    </Box>
  );
}

/* ── the panel ────────────────────────────────────────────────────────── */

export function ElementPane({ api, view, setView, sel, onClose, fill, busy, canAi, onEditInPage, onAskAi, inserts, record }: {
  api: StudioApi; view: PageDoc; setView: (v: PageDoc, label?: string) => void; sel: Selection; onClose: () => void;
  fill: FillRun; busy: string | null; canAi: boolean; onEditInPage: () => void; onAskAi: () => void; inserts: InsertOut[] | null; record: (label: string) => void;
}) {
  const isField = sel.key.startsWith("f:") || sel.key.startsWith("b:");
  // inside the outline's "Selected" row (./Build.tsx): its title says what it is - here only the way to the AI and out
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 0.5, mx: -0.75 }}>
        <Button size="small" onClick={onAskAi} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: PINK, px: 0.75 }}>Change it with AI</Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onClose} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: MUTED, px: 0.75 }}>Unselect</Button>
      </Box>
      {sel.key.startsWith("i:") ? (
        <InsertPanel view={view} setView={(v) => setView(v)} id={sel.key.slice(2)} inserts={inserts} record={record} />
      ) : isField ? (
        <FieldPanel api={api} f={view.fields} setF={(f, label) => setView({ ...view, fields: f }, label)} sel={sel} fill={fill} busy={busy} canAi={canAi} store={view.store} onEditInPage={onEditInPage} record={record} />
      ) : sel.picked ? (
        <ElementPanel api={api} view={view} picked={sel.picked} onEditInPage={onEditInPage} setChanges={(changes, label) => setView({ ...view, changes }, label)} />
      ) : <Hint mt={0}>Click an element in the page.</Hint>}
    </Box>
  );
}
