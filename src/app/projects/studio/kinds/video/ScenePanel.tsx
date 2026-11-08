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
import { FEATURE } from "@/lib/content/studio/kinds/video/features";
import { BAR, FPS } from "@/lib/content/studio/kinds/video/engine/timeline";
import {
  END_FIELDS, KIND_INFO, SCENE_KINDS,
  type CopyKey, type Issue, type Scene, type SceneKind, type VideoDoc,
} from "@/lib/content/studio/kinds/video/model";
import { DEFAULT_PART, partOf, type PartKey } from "@/lib/content/studio/kinds/video/parts";
import { btn } from "../../parts";
import { PicturePanel } from "../../pictures";
import { PhotoPicker } from "../banner/ui";
import { Head, LineIcon, PartPicker, WordField } from "./ui";

export type PicWhere = { projectId: number; pieceId: number; me: string };
export type Edit = (fn: (d: VideoDoc) => VideoDoc) => void;

const secs = (bars: number) => `${(bars * BAR) / FPS} s`;

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

/** What a scene shows: one of our parts, or a photo (the shop's, or one made or uploaded in the hub). */
function Shows({ s, patch, disabled, where, lang }: { s: Scene; patch: (p: Partial<Scene>) => void; disabled: boolean; where: PicWhere; lang: string }) {
  const info = KIND_INFO[s.kind];
  const canPart = !!info.shape;
  const canPhoto = !!info.image;
  const [from, setFrom] = useState<"part" | "shop" | "hub">(canPart && !s.image ? "part" : "shop");
  const words = [s.copy.kicker, s.copy.line1].filter(Boolean).join(" - ").replace(/\*/g, "");
  const setPart = (k: PartKey | null) => patch({ part: k ?? undefined, shape: k ? (k === "shaft-seal" ? "seal" : "oring") : "none", image: undefined });
  const tabs = [
    ...(canPart ? [{ key: "part" as const, label: "Our parts" }] : []),
    ...(canPhoto ? [{ key: "shop" as const, label: "The shop's photos" }, { key: "hub" as const, label: "Make or upload" }] : []),
  ];
  if (!tabs.length) return null;
  const tab = tabs.some((t) => t.key === from) ? from : tabs[0].key;
  return (
    <>
      <Head right={s.image && canPhoto ? <Button size="small" disabled={disabled} onClick={() => patch({ image: undefined, ...(canPart ? { part: partOf(s) ?? DEFAULT_PART } : {}) })} sx={{ ...btn, color: MUTED, py: 0, minWidth: 0, fontSize: "0.74rem" }}>{canPart ? "Back to a part" : "No photo"}</Button> : undefined}>
        What it shows
      </Head>
      {s.image && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt="" style={{ width: 72, height: 50, objectFit: "cover", borderRadius: 4, border: `1px solid ${HAIRLINE}` }} />
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{s.kind === "feature" ? "On its card, beside the words" : "On its card"}</Typography>
        </Box>
      )}
      {tabs.length > 1 && <Box sx={{ mb: 1 }}><SquareChoice value={tab} onChange={setFrom} options={tabs} /></Box>}
      {tab === "part" && <PartPicker value={s.image ? null : partOf(s)} onChange={setPart} disabled={disabled} none={s.kind !== "product"} />}
      {tab === "shop" && <PhotoPicker lang={lang} selected={s.image ? [s.image] : []} onPick={(p) => !disabled && patch({ image: p.url })} />}
      {tab === "hub" && (
        <PicturePanel onPick={(p) => !disabled && patch({ image: p.url })} projectId={where.projectId} pieceId={where.pieceId} me={where.me} aspect={s.kind === "feature" ? "4:5" : "1:1"}
          suggestion={words ? `${words}. Industrial components, real, calm light, for an APSOparts film.` : ""} columns={3} />
      )}
      {!s.image && s.kind === "feature" && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75 }}>No photo: the feature&apos;s icon shows big, in its turning disc.</Typography>}
    </>
  );
}

export function ScenePanel({ doc, i, issues, edit, disabled, where, onShow, onRemove }: {
  doc: VideoDoc; i: number; issues: Issue[]; edit: Edit; disabled: boolean; where: PicWhere; onShow: () => void; onRemove: () => void;
}) {
  const s = doc.scenes[i];
  if (!s) return null;
  const info = KIND_INFO[s.kind];
  const patch = (p: Partial<Scene>) => { edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, ...p } : x)) })); onShow(); };
  const setCopy = (key: CopyKey, v: string) => edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, copy: { ...x.copy, [key]: v } } : x)) }));
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
        <Typography sx={{ flex: 1, fontSize: "0.95rem", fontWeight: 700, color: INK }}>Scene {i + 1}</Typography>
        <LookMenu kind={s.kind} onPick={setKind} disabled={disabled} />
      </Box>
      {s.feature && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mb: 1.5, p: 0.9, borderRadius: "6px", bgcolor: "#f6f7f9", border: `1px solid ${HAIRLINE}` }}>
          <Box sx={{ width: 24, height: 24, borderRadius: "5px", bgcolor: "#d80901", display: "grid", placeItems: "center", flexShrink: 0 }}><LineIcon name={FEATURE[s.feature].icon} size={15} color="#fff" /></Box>
          <Typography sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.3 }}>Tells <b>{FEATURE[s.feature].name}</b></Typography>
        </Box>
      )}
      {info.fields.map((f, k) => (
        <WordField key={`${s.id}-${f.key}`} label={f.required ? f.label : `${f.label} (optional)`} value={s.copy[f.key] ?? ""} words={f.words} placeholder={f.placeholder}
          onChange={(v) => setCopy(f.key, v)} onFocus={onShow} disabled={disabled} multiline={s.kind === "quote" && f.key === "line1"} autoFocus={k === 0 && !s.copy[f.key]} />
      ))}
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: -0.25 }}>A word between *stars* turns red.</Typography>

      <Shows s={s} patch={patch} disabled={disabled} where={where} lang={doc.language} />

      <Head>How long</Head>
      <Length bars={s.bars} min={info.bars.min} max={Math.max(info.bars.min, Math.min(4, info.bars.max))} onChange={(b) => patch({ bars: b })} disabled={disabled} />

      <Issues items={issues} />

      <Button size="small" disabled={disabled} onClick={onRemove} startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, mt: 2.5, color: MUTED }}>Take this scene out</Button>
    </Box>
  );
}

/** The end card: APSOparts big, the line, the button - and the part that hops beside them. */
export function EndPanel({ doc, issues, edit, disabled, onShow }: { doc: VideoDoc; issues: Issue[]; edit: Edit; disabled: boolean; onShow: () => void }) {
  const e = doc.endCard;
  const setEnd = (p: Partial<VideoDoc["endCard"]>) => edit((d) => ({ ...d, endCard: { ...d.endCard, ...p } }));
  return (
    <Box>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, mb: 0.5 }}>End card</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.5 }}>APSOparts big, your line, the button - it keeps moving while it holds.</Typography>
      {END_FIELDS.map((f) => (
        <WordField key={f.key} label={f.label} value={e[f.key]} words={f.words} placeholder={f.placeholder} disabled={disabled}
          onChange={(v) => setEnd({ [f.key]: v } as Partial<VideoDoc["endCard"]>)} onFocus={onShow} />
      ))}
      <Head>The part beside it</Head>
      <PartPicker value={partOf(e) ?? DEFAULT_PART} onChange={(k) => { setEnd({ part: k ?? DEFAULT_PART }); onShow(); }} disabled={disabled} />
      <Head>How long</Head>
      <Length bars={e.bars} min={2} max={3} onChange={(b) => { setEnd({ bars: b }); onShow(); }} disabled={disabled} />
      <Issues items={issues} />
    </Box>
  );
}
