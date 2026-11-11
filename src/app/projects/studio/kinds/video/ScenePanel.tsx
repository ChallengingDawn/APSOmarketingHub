"use client";
// ONE SCENE, OPEN (08.11.2026, Content v3; SARCLA: "the controls are really hard"). A click on a scene in the strip
// holds the film on it and opens it here: its words (the frame changes as you type), what it shows (one of our real
// parts - the shop's own product photo - or a photo), how long it lasts, and what to look at. The cut, the icon and
// the bars of the first studio are gone from here: the cut takes turns on its own, the icon follows the feature, and
// a length is said in seconds.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

import { AMBER, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { FEATURE, featurePhoto } from "@/lib/content/studio/kinds/video/features";
import { BAR, FPS } from "@/lib/content/studio/kinds/video/engine/timeline";
import {
  END_FIELDS, KIND_INFO, SCENE_KINDS,
  type CopyKey, type Issue, type Scene, type SceneKind, type VideoDoc,
} from "@/lib/content/studio/kinds/video/model";
import { DEFAULT_PART, partOf, type PartKey } from "@/lib/content/studio/kinds/video/parts";
import { btn } from "../../parts";
import { PicturePanel } from "../../pictures";
import { PhotoPicker } from "../banner/ui";
import { AiBox, type Done } from "./AiBox";
import { PictureAsk } from "./PictureAsk";
import { Head, LineIcon, PartPicker, WordField } from "./ui";

export type PicWhere = { projectId: number; pieceId: number; me: string };
export type Edit = (fn: (d: VideoDoc) => VideoDoc) => void;
/** A scene's (or the end card's) AI box: the words asked ("" = written again from the film) - what it did, with its Undo. */
export type AskScene = (ask: string) => Promise<Done | string | null>;

const secs = (bars: number) => `${(bars * BAR) / FPS} s`;
const plainOf = (v: string | undefined) => (v ?? "").replace(/\*/g, "");

/** How long a scene lasts, in seconds, within what its kind allows. */
function Length({ bars, min, max, onChange, disabled }: { bars: number; min: number; max: number; onChange: (b: number) => void; disabled: boolean }) {
  const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return <SquareChoice<string> value={String(bars)} onChange={(v) => onChange(Number(v))} options={opts.map((b) => ({ key: String(b), label: secs(b), disabled }))} />;
}

function Issues({ items }: { items: Issue[] }) {
  if (!items.length) return null;
  return (
    <Box sx={{ mt: 2, display: "grid", gap: 0.5 }}>
      {items.map((x, i) => (
        <Typography key={i} sx={{ fontSize: "0.76rem", lineHeight: 1.4, color: x.level === "stop" ? RED : AMBER, fontWeight: x.level === "stop" ? 700 : 500 }}>
          {x.level === "stop" ? "Not in our films: " : ""}{x.text}
        </Typography>
      ))}
    </Box>
  );
}

/** The scene's look (its kind), as a quiet menu: the words it has are kept where the new look has room for them. */
function LookMenu({ kind, onPick, disabled }: { kind: SceneKind; onPick: (k: SceneKind) => void; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
        sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", px: 1.1, py: 0.2, fontSize: "0.8rem", borderRadius: "6px" }}>
        {KIND_INFO[kind].label}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 300, borderRadius: "10px" } } }}>
        {SCENE_KINDS.map((k) => (
          <MenuItem key={k} selected={k === kind} onClick={() => { setAnchor(null); onPick(k); }} sx={{ display: "block", whiteSpace: "normal" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{KIND_INFO[k].label}</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{KIND_INFO[k].blurb}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * What a scene shows (09.11.2026, the flow standard's picture slot): a title, one of our parts; a product, one of our
 * parts or a photo; a feature, its photo - the one picked, else the shop's own photo for the feature (never an icon in a
 * disc). A photo is made, uploaded or picked from the gallery (the shop's photos, ours) right here.
 */
export function Shows({ s, patch, disabled, where, lang, bare }: { s: Scene; patch: (p: Partial<Scene>) => void; disabled: boolean; where: PicWhere; lang: string; bare?: boolean }) {
  const info = KIND_INFO[s.kind];
  const canPart = !!info.shape;
  const canPhoto = !!info.image;
  const [from, setFrom] = useState<"part" | "photo">(canPart && !s.image ? "part" : "photo");
  const words = [s.copy.kicker, s.copy.line1].filter(Boolean).join(" - ").replace(/\*/g, "");
  const idea = `${words ? `${words}. ` : ""}Industrial components, real, calm light, for an APSOparts film.`;
  const setPart = (k: PartKey | null) => patch({ part: k ?? undefined, shape: k ? (k === "shaft-seal" ? "seal" : "oring") : "none", image: undefined });
  if (!canPart && !canPhoto) return null;
  const fallback = s.kind === "feature" ? featurePhoto(s.feature) : "";
  const gallery = (
    <Box>
      <Head mt={0}>The shop&apos;s photos</Head>
      <PhotoPicker lang={lang} selected={s.image ? [s.image] : []} onPick={(p) => !disabled && patch({ image: p.url })} />
      <Head>Ours</Head>
      <PicturePanel onPick={(p) => !disabled && patch({ image: p.url })} projectId={where.projectId} pieceId={where.pieceId} me={where.me} aspect={s.kind === "feature" ? "4:5" : "1:1"} tabs={["mine", "project"]} start="project" columns={3} />
    </Box>
  );
  // cv16: the Page builder's picture popup - This picture / Gallery / Fine-tune, made from your own words, the newest ask wins
  const slot = (
    <PictureAsk slot={s.id} url={s.image || fallback || null} idea={idea} aspect={s.kind === "feature" ? "4:5" : "1:1"} where={where} disabled={disabled} gallery={gallery}
      onSet={(url) => patch({ image: url })}
      onRemove={s.image && s.image !== fallback ? () => patch({ image: undefined }) : undefined} removeLabel={s.kind === "feature" ? "Back to the shop's photo" : "Remove"}
      note={(!s.image || s.image === fallback) && s.feature ? <>The shop&apos;s own photo for <b>{FEATURE[s.feature].name}</b>.</> : undefined} />
  );
  const tab = canPart && canPhoto ? from : canPart ? "part" : "photo";
  return (
    <>
      {!bare && <Head>{canPart && !canPhoto ? "The part" : "What it shows"}</Head>}
      {canPart && canPhoto && <Box sx={{ mb: 1 }}><SquareChoice value={tab} onChange={setFrom} options={[{ key: "part", label: "One of our parts" }, { key: "photo", label: "A photo" }]} /></Box>}
      {tab === "part" && <PartPicker value={s.image ? null : partOf(s)} onChange={setPart} disabled={disabled} none={s.kind !== "product"} />}
      {tab === "photo" && slot}
    </>
  );
}

/** The lines the film draws with their red word (a kicker, a proof, a quote and a figure are drawn plain). */
const redLine = (kind: SceneKind, key: string) => (key === "line1" || key === "line2" || key === "line3") && kind !== "quote" && !(kind === "number" && key === "line1");

export function ScenePanel({ doc, i, issues, edit, disabled, where, onShow, onRemove, words, setWord, lang, onAsk }: {
  doc: VideoDoc; i: number; issues: Issue[]; edit: Edit; disabled: boolean; where: PicWhere; onShow: () => void; onRemove: () => void;
  /** cv16: the words shown and typed - the film's own, or a language version's (`lang`) */
  words?: (key: CopyKey) => string; setWord?: (key: CopyKey, v: string) => void; lang?: string | null;
  /** cv16: the scene's own "Write it again with AI" (the Page builder's block popup) */
  onAsk?: AskScene;
}) {
  const s = doc.scenes[i];
  if (!s) return null;
  const info = KIND_INFO[s.kind];
  const patch = (p: Partial<Scene>) => { edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, ...p } : x)) })); onShow(); };
  const setCopy = setWord ?? ((key: CopyKey, v: string) => edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, copy: { ...x.copy, [key]: v } } : x)) })));
  const wordOf = words ?? ((key: CopyKey) => s.copy[key] ?? "");
  const setKind = (k: SceneKind) => {
    const ki = KIND_INFO[k];
    patch({
      kind: k, bars: Math.max(ki.bars.min, Math.min(ki.bars.max, s.bars)),
      shape: ki.shape ? (s.shape && s.shape !== "none" ? s.shape : k === "product" ? "oring" : "none") : undefined,
      part: ki.shape ? (partOf(s) ?? (k === "product" ? DEFAULT_PART : undefined)) : undefined,
      image: ki.image ? s.image : undefined,
      icon: ki.icon ? s.icon ?? (s.feature ? FEATURE[s.feature].icon : "check") : undefined,
    });
  };
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Typography sx={{ flex: 1, fontSize: "0.72rem", color: MUTED }}>{KIND_INFO[s.kind].blurb}</Typography>
        <LookMenu kind={s.kind} onPick={setKind} disabled={disabled} />
      </Box>
      {s.feature && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mb: 1.5, p: 0.9, borderRadius: "6px", bgcolor: "#f6f7f9", border: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ width: 24, height: 24, borderRadius: "5px", bgcolor: "#d80901", display: "grid", placeItems: "center", flexShrink: 0 }}><LineIcon name={FEATURE[s.feature].icon} size={15} color="#fff" /></Box>
          <Typography sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.3 }}>Tells <b>{FEATURE[s.feature].name}</b></Typography>
        </Box>
      )}
      {info.fields.map((f, k) => (
        <WordField key={`${s.id}-${f.key}-${lang ?? ""}`} label={`${f.required ? f.label : `${f.label} (optional)`}${lang ? ` · ${lang}` : ""}`} value={wordOf(f.key)} words={f.words} placeholder={lang ? plainOf(s.copy[f.key]) || f.placeholder : f.placeholder}
          onChange={(v) => setCopy(f.key, v)} onFocus={onShow} disabled={disabled} multiline={s.kind === "quote" && f.key === "line1"} autoFocus={k === 0 && !wordOf(f.key)} red={redLine(s.kind, f.key)} />
      ))}
      {info.fields.some((f) => redLine(s.kind, f.key)) && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: -0.5 }}>One word a scene can be red: select it, then Red.</Typography>}

      <Shows s={s} patch={patch} disabled={disabled} where={where} lang={doc.language} />

      <Head>How long</Head>
      <Length bars={s.bars} min={info.bars.min} max={Math.max(info.bars.min, Math.min(4, info.bars.max))} onChange={(b) => patch({ bars: b })} disabled={disabled} />

      <Issues items={issues} />

      {onAsk && !lang && (
        <AiBox title="Write it again with AI" placeholder="What should change? Empty: write it again from the film" button="Write it again" disabled={disabled} onRun={onAsk} />
      )}
      {onAsk && lang && <Typography sx={{ mt: 2, fontSize: "0.74rem", color: MUTED, lineHeight: 1.45 }}>Write it again in the film&apos;s own language tab - this one follows with Translate again. A line alone: click it on the film.</Typography>}

      <Button size="small" disabled={disabled} onClick={onRemove} startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, mt: 2.5, color: MUTED }}>Take this scene out</Button>
    </Box>
  );
}

/** The end card: APSOparts big, the line, the button - and the part that hops beside them. */
export function EndPanel({ doc, issues, edit, disabled, onShow, words, setWord, lang, onAsk }: {
  doc: VideoDoc; issues: Issue[]; edit: Edit; disabled: boolean; onShow: () => void;
  words?: (key: "line" | "cta") => string; setWord?: (key: "line" | "cta", v: string) => void; lang?: string | null; onAsk?: AskScene;
}) {
  const e = doc.endCard;
  const setEnd = (p: Partial<VideoDoc["endCard"]>) => edit((d) => ({ ...d, endCard: { ...d.endCard, ...p } }));
  const wordOf = words ?? ((k: "line" | "cta") => e[k]);
  return (
    <Box>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, mb: 0.5 }}>End card</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.5 }}>APSOparts big, your line, the button - it keeps moving while it holds.</Typography>
      {END_FIELDS.map((f) => (
        <WordField key={`${f.key}-${lang ?? ""}`} label={lang ? `${f.label} · ${lang}` : f.label} value={wordOf(f.key)} words={f.words} placeholder={lang ? plainOf(e[f.key]) || f.placeholder : f.placeholder} disabled={disabled}
          onChange={(v) => (setWord ? setWord(f.key, v) : setEnd({ [f.key]: v } as Partial<VideoDoc["endCard"]>))} onFocus={onShow} red={f.key === "line"} />
      ))}
      <Head>The part beside it</Head>
      <PartPicker value={partOf(e) ?? DEFAULT_PART} onChange={(k) => { setEnd({ part: k ?? DEFAULT_PART }); onShow(); }} disabled={disabled} />
      <Head>How long</Head>
      <Length bars={e.bars} min={2} max={3} onChange={(b) => { setEnd({ bars: b }); onShow(); }} disabled={disabled} />
      <Issues items={issues} />
      {onAsk && !lang && <AiBox title="Write it again with AI" placeholder="What should change? Empty: write it again from the film" button="Write it again" disabled={disabled} onRun={onAsk} />}
    </Box>
  );
}
