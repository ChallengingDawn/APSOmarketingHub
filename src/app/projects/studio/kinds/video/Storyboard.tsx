"use client";
// THE VIDEO STUDIO'S STORYBOARD (08.11.2026): the film's scenes in order - drag one by its handle or move it up and
// down, set its kind and its bars, write its few words (each line counts its words against what can be read in under
// two seconds), add one of our kinds, take one out; then the end card. Clicking a scene plays the film from it;
// typing in one shows it on the player. A scene that tells one of APSOparts' features carries it (and its icon); a
// picture comes from the shop's photos or the hub's picture panel (made from a few words, or uploaded) - never typed.
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";

import { AMBER, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { SquareChoice as Choice } from "@/app/website/ai-personalization/SquareChoice";
import { FEATURE, ICONS, type IconKey } from "@/lib/content/studio/kinds/video/features";
import { wordCount } from "@/lib/content/studio/kinds/video/engine/text";
import { BAR, FPS, timecode } from "@/lib/content/studio/kinds/video/engine/timeline";
import {
  CUTS, END_FIELDS, KIND_INFO, MAX_BARS, MAX_SCENES, MIN_BARS, newScene, SCENE_KINDS,
  type CopyKey, type Cut, type FieldDef, type Issue, type Scene, type SceneKind, type Segment, type Shape, type VideoDoc,
} from "@/lib/content/studio/kinds/video/model";
import { btn, field, Label, PINK } from "../../parts";
import { PicturePanel } from "../../pictures";
import { PhotoPicker } from "../banner/ui";
import { LineIcon } from "./FeaturePicker";

/** Where the scene cards' pictures are kept: the to-do's project and piece, the person. */
export type PicWhere = { projectId: number; pieceId: number; me: string };

export type Edit = (fn: (d: VideoDoc) => VideoDoc) => void;

const CUT_LABEL: Record<Cut, string> = { auto: "Auto", whip: "Whip", sweep: "Sweep", lift: "Lift" };

/** A line of the film: its words counted against what is read in under two seconds. */
function WordField({ label, value, words, placeholder, onChange, onFocus, disabled, multiline }: {
  label: string; value: string; words: number; placeholder?: string; onChange: (v: string) => void; onFocus?: () => void; disabled?: boolean; multiline?: boolean;
}) {
  const n = wordCount(value);
  const over = n > words;
  return (
    <TextField fullWidth size="small" label={label} value={value} placeholder={placeholder} disabled={disabled} multiline={multiline} minRows={multiline ? 2 : undefined}
      onChange={(e) => onChange(e.target.value)} onFocus={onFocus}
      helperText={<Box component="span" sx={{ display: "flex", justifyContent: "flex-end" }}><span style={{ color: over ? RED : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${n - words} word${n - words > 1 ? "s" : ""} too many` : `${n} / ${words} words`}</span></Box>}
      sx={{ ...field, mb: 1, "& .MuiFormHelperText-root": { mx: 0.5, mt: 0.25 } }} />
  );
}

function IssueLines({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <Box sx={{ display: "grid", gap: 0.5, mt: 0.5 }}>
      {issues.map((x, i) => (
        <Typography key={i} sx={{ fontSize: "0.76rem", lineHeight: 1.35, color: x.level === "stop" ? RED : AMBER, fontWeight: x.level === "stop" ? 700 : 500 }}>
          {x.level === "stop" ? "Not in our films: " : ""}{x.text}
        </Typography>
      ))}
    </Box>
  );
}

function KindMenu({ kind, onPick, disabled }: { kind: SceneKind; onPick: (k: SceneKind) => void; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" disabled={disabled} onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }} endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
        sx={{ ...btn, color: INK, px: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 700 }}>
        {KIND_INFO[kind].label}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()} slotProps={{ paper: { sx: { width: 300, borderRadius: "14px" } } }}>
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

function Bars({ bars, onChange, disabled, min = MIN_BARS, max = MAX_BARS }: { bars: number; onChange: (n: number) => void; disabled?: boolean; min?: number; max?: number }) {
  return (
    <Box onClick={(e) => e.stopPropagation()} sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff", height: 28 }}>
      <IconButton size="small" disabled={disabled || bars <= min} onClick={() => onChange(bars - 1)} aria-label="One bar less" sx={{ p: 0.25 }}><RemoveRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
      <Tooltip title={`${bars * (BAR / FPS)} seconds - a bar is two`}>
        <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: INK, px: 0.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{bars} bar{bars > 1 ? "s" : ""}</Typography>
      </Tooltip>
      <IconButton size="small" disabled={disabled || bars >= max} onClick={() => onChange(bars + 1)} aria-label="One bar more" sx={{ p: 0.25 }}><AddRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
    </Box>
  );
}

/** The scene's picture: the shop's photos, or one made or uploaded in the hub - picked here, in the card. */
function ScenePicture({ s, patch, disabled, onShow, where, lang }: { s: Scene; patch: (p: Partial<Scene>) => void; disabled: boolean; onShow: () => void; where: PicWhere; lang: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<"shop" | "hub">("shop");
  const words = [s.copy.kicker, s.copy.line1].filter(Boolean).join(" - ").replace(/\*/g, "");
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 64, height: 44, borderRadius: "6px", overflow: "hidden", bgcolor: "#eef1f6", border: `1px solid ${HAIRLINE}`, flexShrink: 0, display: "grid", placeItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.image ? <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <Typography sx={{ fontSize: "0.66rem", color: MUTED }}>{s.kind === "product" ? "Drawn part" : "Icon"}</Typography>}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 650, color: INK }}>Picture</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{s.image ? "Shown on its card" : s.kind === "product" ? "None - the part is drawn" : "None - the icon shows big"}</Typography>
        </Box>
        <Button size="small" disabled={disabled} onClick={() => { setOpen((o) => !o); onShow(); }} sx={{ ...btn, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", py: 0.25 }}>{open ? "Done" : s.image ? "Change" : "Add"}</Button>
        {s.image && <Button size="small" disabled={disabled} onClick={() => patch({ image: undefined })} sx={{ ...btn, color: MUTED, minWidth: 0, py: 0.25 }}>Out</Button>}
      </Box>
      {open && (
        <Box sx={{ mt: 1, p: 1.25, borderRadius: "8px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fafbfc" }}>
          <Box sx={{ mb: 1 }}><Choice value={from} onChange={setFrom} options={[{ key: "shop", label: "The shop's photos" }, { key: "hub", label: "Make or upload" }]} /></Box>
          {from === "shop"
            ? <PhotoPicker lang={lang} selected={s.image ? [s.image] : []} onPick={(p) => { patch({ image: p.url }); onShow(); }} />
            : <PicturePanel onPick={(p) => { patch({ image: p.url }); onShow(); }} projectId={where.projectId} pieceId={where.pieceId} me={where.me} aspect={s.kind === "feature" ? "4:5" : "1:1"}
              suggestion={words ? `${words}. Industrial components, real, calm light, for an APSOparts film.` : ""} columns={3} />}
        </Box>
      )}
    </Box>
  );
}

/** The icon a feature or number scene shows: the shop's own line icons. */
function IconRow({ value, onChange, disabled }: { value: IconKey; onChange: (k: IconKey) => void; disabled: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 52 }}>Icon</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {ICONS.map((k) => (
          <Box key={k} component="button" type="button" disabled={disabled} aria-pressed={value === k} aria-label={k} onClick={() => onChange(k)} sx={{
            all: "unset", cursor: disabled ? "default" : "pointer", width: 26, height: 26, borderRadius: "5px", display: "grid", placeItems: "center",
            bgcolor: value === k ? "#d80901" : "#fff", border: `1px solid ${value === k ? "#d80901" : HAIRLINE}`, "&:hover": { borderColor: value === k ? "#d80901" : "#9fb3c0" },
          }}>
            <LineIcon name={k} size={16} color={value === k ? "#fff" : "#274e64"} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SceneCard({ s, i, n, seg, issues, active, disabled, edit, onPlay, onShow, dragging, onDragStart, onDropAt, where, lang }: {
  s: Scene; i: number; n: number; seg: Segment | undefined; issues: Issue[]; active: boolean; disabled: boolean; edit: Edit;
  onPlay: (i: number) => void; onShow: (i: number) => void; dragging: number | null; onDragStart: (i: number) => void; onDropAt: (i: number) => void;
  where: PicWhere; lang: string;
}) {
  const info = KIND_INFO[s.kind];
  const [over, setOver] = useState(false);
  const patch = (p: Partial<Scene>) => edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, ...p } : x)) }));
  const setCopy = (key: CopyKey, v: string) => edit((d) => ({ ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, copy: { ...x.copy, [key]: v } } : x)) }));
  const move = (to: number) => edit((d) => {
    const a = [...d.scenes];
    const [m] = a.splice(i, 1);
    a.splice(to, 0, m);
    return { ...d, scenes: a };
  });
  const setKind = (k: SceneKind) => {
    const ki = KIND_INFO[k];
    patch({
      kind: k, bars: Math.max(ki.bars.min, Math.min(ki.bars.max, s.bars)), shape: ki.shape ? (s.shape && s.shape !== "none" ? s.shape : k === "product" ? "oring" : "none") : undefined, image: ki.image ? s.image : undefined,
      icon: ki.icon ? s.icon ?? (s.feature ? FEATURE[s.feature].icon : "check") : undefined,
    });
  };
  const stops = issues.some((x) => x.level === "stop");
  return (
    <Box
      onDragOver={(e) => { if (dragging !== null) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDropAt(i); }}
      sx={{
        borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${stops ? "rgba(197,34,31,.45)" : active ? "rgba(194,44,110,.55)" : HAIRLINE}`,
        boxShadow: active ? "0 0 0 3px rgba(194,44,110,.10)" : "0 1px 2px rgba(31,45,78,.04)", mb: 1.25, opacity: dragging === i ? 0.45 : 1,
        borderTop: over && dragging !== i ? `3px solid ${PINK}` : undefined, transition: "box-shadow .2s, border-color .2s",
      }}>
      <Box onClick={() => onPlay(i)} sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, cursor: "pointer", borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box draggable={!disabled} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); onDragStart(i); }} onClick={(e) => e.stopPropagation()}
          sx={{ display: "grid", placeItems: "center", cursor: disabled ? "default" : "grab", color: MUTED }} aria-label="Drag to move the scene">
          <DragIndicatorRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ width: 22, height: 22, borderRadius: "5px", bgcolor: active ? PINK : "#eef1f6", color: active ? "#fff" : INK, display: "grid", placeItems: "center", fontSize: "0.74rem", fontWeight: 700, flexShrink: 0 }}>{i + 1}</Box>
        <KindMenu kind={s.kind} onPick={setKind} disabled={disabled} />
        <Bars bars={s.bars} onChange={(b) => patch({ bars: b })} disabled={disabled} />
        {seg && <Typography sx={{ fontSize: "0.72rem", color: MUTED, ml: 0.5, fontVariantNumeric: "tabular-nums" }}>{timecode(seg.start).replace(/\.\d+$/, "")}</Typography>}
        {s.feature && (
          <Tooltip title={`Tells: ${FEATURE[s.feature].name}`}>
            <Box component="span" sx={{ ml: 0.5, display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.6, py: 0.1, borderRadius: "4px", bgcolor: "#fde3e2", color: "#a30700", fontSize: "0.68rem", fontWeight: 700, maxWidth: 110, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              <LineIcon name={FEATURE[s.feature].icon} size={12} color="#a30700" />{FEATURE[s.feature].name}
            </Box>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Play from here"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onPlay(i); }} aria-label="Play from here"><PlayArrowRoundedIcon sx={{ fontSize: 18, color: PINK }} /></IconButton></Tooltip>
        <Tooltip title="Earlier"><span><IconButton size="small" disabled={disabled || i === 0} onClick={(e) => { e.stopPropagation(); move(i - 1); }} aria-label="Move earlier"><ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
        <Tooltip title="Later"><span><IconButton size="small" disabled={disabled || i === n - 1} onClick={(e) => { e.stopPropagation(); move(i + 1); }} aria-label="Move later"><ArrowDownwardRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
        <Tooltip title="Take it out"><span><IconButton size="small" disabled={disabled} onClick={(e) => { e.stopPropagation(); edit((d) => ({ ...d, scenes: d.scenes.filter((_, k) => k !== i) })); }} aria-label="Take the scene out"><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
      </Box>
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
        {info.fields.map((f: FieldDef) => (
          <WordField key={f.key} label={f.required ? f.label : `${f.label} (optional)`} value={s.copy[f.key] ?? ""} words={f.words} placeholder={f.placeholder}
            onChange={(v) => setCopy(f.key, v)} onFocus={() => onShow(i)} disabled={disabled} multiline={s.kind === "quote" && f.key === "line1"} />
        ))}
        {info.icon && <IconRow value={s.icon ?? "check"} onChange={(k) => { patch({ icon: k }); onShow(i); }} disabled={disabled} />}
        {info.image && <ScenePicture s={s} patch={patch} disabled={disabled} onShow={() => onShow(i)} where={where} lang={lang} />}
        {info.shape && !(info.image && s.image) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 52 }}>The part</Typography>
            <Choice<Shape> value={s.shape ?? "none"} onChange={(v) => patch({ shape: v })}
              options={[{ key: "oring", label: "O-ring" }, { key: "seal", label: "Shaft seal" }, ...(s.kind === "product" ? [] : [{ key: "none" as Shape, label: "None" }])]} />
          </Box>
        )}
        {i > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, minWidth: 52 }}>Cut in</Typography>
            <Choice<Cut> value={s.cut ?? "auto"} onChange={(v) => patch({ cut: v === "auto" ? undefined : v })} options={CUTS.map((c) => ({ key: c, label: c === "auto" && seg && seg.cut !== "open" ? `Auto (${CUT_LABEL[seg.cut]})` : CUT_LABEL[c] }))} />
          </Box>
        )}
        <IssueLines issues={issues} />
      </Box>
    </Box>
  );
}

/** Buttons to add one of our kinds of scene. */
export function AddScene({ onAdd, disabled, full }: { onAdd: (k: SceneKind) => void; disabled?: boolean; full?: boolean }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {SCENE_KINDS.map((k) => (
        <Tooltip key={k} title={KIND_INFO[k].blurb}>
          <span>
            <Button size="small" variant="outlined" disabled={disabled || full} onClick={() => onAdd(k)} startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{ ...btn, borderColor: HAIRLINE, color: INK, bgcolor: "#fff", py: 0.25, fontSize: "0.8rem", "&:hover": { borderColor: PINK, bgcolor: "#fff" } }}>
              {KIND_INFO[k].label}
            </Button>
          </span>
        </Tooltip>
      ))}
    </Box>
  );
}

export default function Storyboard({ doc, segs, issues, edit, disabled, current, onPlay, onShow, where }: {
  doc: VideoDoc; segs: Segment[]; issues: Issue[]; edit: Edit; disabled: boolean; current: number;
  onPlay: (index: number) => void; onShow: (index: number) => void; where: PicWhere;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const add = (k: SceneKind) => edit((d) => {
    const at = current >= 0 && current < d.scenes.length ? current + 1 : d.scenes.length;
    const a = [...d.scenes];
    a.splice(at, 0, newScene(k));
    return { ...d, scenes: a };
  });
  const dropAt = (to: number) => {
    const from = dragging;
    setDragging(null);
    if (from === null || from === to) return;
    edit((d) => {
      const a = [...d.scenes];
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      return { ...d, scenes: a };
    });
  };
  const e = doc.endCard;
  const endSeg = segs[segs.length - 1];
  const setEnd = (p: Partial<VideoDoc["endCard"]>) => edit((d) => ({ ...d, endCard: { ...d.endCard, ...p } }));
  // "no scenes yet" is said by the empty storyboard itself
  const film = doc.scenes.length ? issues.filter((x) => x.scene === "film") : [];
  return (
    <Box onDragEnd={() => setDragging(null)}>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.5, lineHeight: 1.45 }}>
        A scene lasts whole bars of two seconds; every cut lands on the beat. Put the key word between *stars* to make it red.
      </Typography>
      <IssueLines issues={film} />
      {doc.scenes.length === 0 && (
        <Box sx={{ p: 1.5, borderRadius: "14px", border: `1px dashed ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.86rem", color: INK, fontWeight: 600, mb: 0.5 }}>No scenes yet</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 1.25 }}>Ask the assistant for a storyboard from the brief, or start with a scene of your own.</Typography>
          <AddScene onAdd={add} disabled={disabled} />
        </Box>
      )}
      {doc.scenes.map((s, i) => (
        <SceneCard key={s.id} s={s} i={i} n={doc.scenes.length} seg={segs[i]} issues={issues.filter((x) => x.scene === i)} active={current === i}
          disabled={disabled} edit={edit} onPlay={onPlay} onShow={onShow} dragging={dragging} onDragStart={setDragging} onDropAt={dropAt} where={where} lang={doc.language} />
      ))}
      {doc.scenes.length > 0 && (
        <>
          <Label mt={0.5}>Add a scene{current >= 0 && current < doc.scenes.length ? ` after ${current + 1}` : ""}</Label>
          <AddScene onAdd={add} disabled={disabled} full={doc.scenes.length >= MAX_SCENES} />
        </>
      )}

      <Box onClick={() => onPlay(-1)} sx={{ mt: 2.5, borderRadius: "10px", bgcolor: "#fff", border: `1px solid ${current === -1 ? "rgba(194,44,110,.55)" : HAIRLINE}`, boxShadow: current === -1 ? "0 0 0 3px rgba(194,44,110,.10)" : undefined }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, cursor: "pointer" }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>End card</Typography>
          <Bars bars={e.bars} min={2} max={3} onChange={(b) => setEnd({ bars: b })} disabled={disabled} />
          {endSeg && <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{timecode(endSeg.start).replace(/\.\d+$/, "")}</Typography>}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Play the end card"><IconButton size="small" onClick={(ev) => { ev.stopPropagation(); onPlay(-1); }} aria-label="Play the end card"><PlayArrowRoundedIcon sx={{ fontSize: 18, color: PINK }} /></IconButton></Tooltip>
        </Box>
        <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }} onClick={(ev) => ev.stopPropagation()}>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED, mb: 1.25 }}>APSOparts big, your line, the button - it keeps moving while it holds.</Typography>
          {END_FIELDS.map((f) => (
            <WordField key={f.key} label={f.label} value={e[f.key]} words={f.words} placeholder={f.placeholder} disabled={disabled}
              onChange={(v) => setEnd({ [f.key]: v } as Partial<VideoDoc["endCard"]>)} onFocus={() => onShow(-1)} />
          ))}
          <IssueLines issues={issues.filter((x) => x.scene === "end")} />
        </Box>
      </Box>

      <Label mt={2.5}>Notes for the film</Label>
      <TextField fullWidth size="small" multiline minRows={2} value={doc.notes ?? ""} disabled={disabled} placeholder="Pictures to use, who it is for, where it runs"
        onChange={(ev) => edit((d) => ({ ...d, notes: ev.target.value }))} sx={field} />
    </Box>
  );
}
