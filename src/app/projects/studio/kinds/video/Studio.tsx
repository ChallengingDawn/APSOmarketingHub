"use client";
// THE VIDEO STUDIO (08.11.2026 Content v3; 09.11.2026 the studio flow standard - SARCLA: "the features are there, but the
// editing and the flow is not logical yet"; "button is not fit"; "the controls are really hard"). Start to finish:
//   1. Empty: the start card on the left - "What are you making?": the features the film is about, how long - and ONE
//      pink "Make the whole film with AI" (or add a scene and write it yourself).
//   2. The film plays in the middle, big, its format top right (16:9 / 9:16 / 1:1); the scenes as a strip under it.
//   3. The left is the film's map: "What it is about", then every scene with its state (written, empty, something to
//      fix, being written) and its words, then the end card. A click on a row - or on a scene in the strip - opens it
//      under its row (one at a time) and holds the film on it.
//   4. The assistant (right) works on what is selected ("Scene 2 · Feature" with ×) or on the whole film; a scene's ask
//      changes that scene only. Every change is listed under "Changes made here", each with Undo.
//   5. LAST STEP, pinned at the foot of the map: "Export for rendering" - its own view: the checks, the file, the command.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";

import { AMBER, HAIRLINE, INK, MUTED, RED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { FeatureKey } from "@/lib/content/studio/kinds/video/features";
import { seconds } from "@/lib/content/studio/kinds/video/engine/timeline";
import { plain } from "@/lib/content/studio/kinds/video/engine/text";
import {
  cleanVideo, END_FIELDS, featureScene, FORMAT_INFO, FORMATS, KIND_INFO, MAX_SCENES, newScene, SCENE_KINDS, segments, totalFrames, validate,
  type FilmLength, type Format, type Issue, type Scene, type SceneKind, type VideoDoc, type VideoSpec,
} from "@/lib/content/studio/kinds/video/model";
import type { AiAnswer } from "@/lib/content/studio/kinds/video/ai";
import { AssistantPanel, PINK, btn, mainBtn, Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import FilmPanel, { filmLine } from "./FilmPanel";
import Player, { type PlayerHandle } from "./Player";
import { LAYOUTS } from "@/lib/content/studio/kinds/video/film/layout";
import { WordField } from "./ui";
import { EndPanel, ScenePanel } from "./ScenePanel";
import Strip, { holdFrame } from "./Strip";
import { ChangesList, Kick, LastStep, MapList, MapPane, MapRow, StartCard, StepView, WorkingOn, Writing, useChanges, useClock, type Mark } from "./map";

/** The lines the film draws with a red word (a kicker, a proof, a quote and a figure are drawn plain). */
const redOnFilm = (kind: SceneKind, key: string) => (key === "line1" || key === "line2" || key === "line3") && kind !== "quote" && !(kind === "number" && key === "line1");

const isV2 = (v: unknown): v is VideoDoc => !!v && typeof v === "object" && (v as { v?: unknown }).v === 2 && Array.isArray((v as { scenes?: unknown }).scenes) && !!(v as { endCard?: unknown }).endCard;
/** The document as it is being typed (spaces kept); anything older is brought up to date. */
const editable = (v: unknown, language: string | null): VideoDoc => (isV2(v) ? v : cleanVideo(v, { language }));

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "film";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** What a scene holds, in a line. */
const wordsOf = (s: Scene) => KIND_INFO[s.kind].fields.map((f) => plain(s.copy[f.key] ?? "")).filter(Boolean).join(" · ");

/** A scene's state in the map: something to fix, written, or not yet. */
function markOf(s: Scene, issues: Issue[]): Mark {
  if (issues.some((x) => x.level === "stop")) return "stop";
  return KIND_INFO[s.kind].fields.every((f) => !f.required || plain(s.copy[f.key] ?? "")) ? "written" : "empty";
}

/** "+ Add a scene": one of our kinds, after the scene open. */
function AddScene({ onAdd, disabled, after }: { onAdd: (k: SceneKind) => void; disabled: boolean; after: number | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button size="small" disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} startIcon={<AddRoundedIcon sx={{ fontSize: 17 }} />} sx={{ ...btn, color: INK, mt: 1 }}>
        {after !== null ? `Add a scene after scene ${after + 1}` : "Add a scene"}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: 300, borderRadius: "10px" } } }}>
        {SCENE_KINDS.map((k) => (
          <MenuItem key={k} onClick={() => { setAnchor(null); onAdd(k); }} sx={{ display: "block", whiteSpace: "normal" }}>
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{KIND_INFO[k].label}</Typography>
            <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{KIND_INFO[k].blurb}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** The last step's view: what is still to fix, the file for the render machine, and how it is rendered. */
function ExportView({ film, issues, onBack, onFormat, onExport, exporting, msg, file, disabled }: {
  film: VideoDoc; issues: Issue[]; onBack: () => void; onFormat: (f: Format) => void; onExport: () => void; exporting: boolean; msg: string | null; file: string | null; disabled: boolean;
}) {
  const stops = issues.filter((x) => x.level === "stop");
  const warns = issues.filter((x) => x.level !== "stop");
  const cmd = file ? `node scripts/content-video/render.mjs ${file} ${file.replace(/\.json$/, "")}.mp4 --format=all` : "";
  const [copied, setCopied] = useState(false);
  const where = (x: Issue) => (x.scene === "end" ? "End card: " : typeof x.scene === "number" ? `Scene ${x.scene + 1}: ` : "");
  return (
    <StepView back="The film" onBack={onBack} name="Export for rendering">
      <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 1.5, lineHeight: 1.5 }}>
        The story goes to the render machine as a file; it makes the MP4 - the hub cannot (no Chromium on its servers).
      </Typography>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Format</Typography>
      <SquareChoice<Format> value={film.format} onChange={onFormat} options={FORMATS.map((f) => ({ key: f, label: FORMAT_INFO[f].label, disabled }))} />
      <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.6, mb: 2 }}>{FORMAT_INFO[film.format].use.replace(/\.?$/, ".")} The render makes all three.</Typography>

      <Box sx={{ p: 1.5, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", mb: 2 }}>
        {!issues.length ? (
          <Typography sx={{ fontSize: "0.84rem", color: "#1b7a55", fontWeight: 600 }}>Ready: {film.scenes.length} scenes and the end card, {seconds(totalFrames(film))} s, every line within its words.</Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 0.6 }}>
            {[...stops, ...warns].map((x, i) => (
              <Typography key={i} sx={{ fontSize: "0.8rem", lineHeight: 1.4, color: x.level === "stop" ? RED : AMBER, fontWeight: x.level === "stop" ? 700 : 500 }}>{where(x)}{x.text}</Typography>
            ))}
          </Box>
        )}
      </Box>

      <Button fullWidth variant="contained" disableElevation disabled={exporting || !film.scenes.length || stops.length > 0} onClick={onExport}
        startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
        Export the story
      </Button>
      {stops.length > 0 && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>Fix what is in red first - the film never shows it.</Typography>}
      {msg && <Typography sx={{ mt: 1.25, fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px" }}>{msg}</Typography>}

      {file && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 1 }}>Saved as <b>{file}</b>. On the render laptop, in the hub&apos;s folder:</Typography>
          <Box sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.76rem", bgcolor: "#15223a", color: "#e8edf6", p: 1.25, borderRadius: "8px", wordBreak: "break-all" }}>{cmd}</Box>
          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 15 }} />} onClick={async () => { await navigator.clipboard?.writeText(cmd).catch(() => undefined); setCopied(true); }} sx={{ ...btn, color: PINK, px: 0.5, mt: 0.5 }}>
            {copied ? "Copied" : "Copy the command"}
          </Button>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.5 }}>
            It makes all three formats. For a quick look first add <b>--scale=0.5</b>, or <b>--stills=0,60,120</b> for pictures of those frames. It needs Chromium and ffmpeg on that machine.
          </Typography>
        </Box>
      )}
    </StepView>
  );
}

/** Where a scene's words sit on the film (its layout's text box), for the words typed on the film. */
type Box4 = { x: number; y: number; w: number; h: number };
function wordsBox(fmt: Format, kind: SceneKind | "end"): Box4 {
  const L = LAYOUTS[fmt];
  if (kind === "end") return L.end.line;
  if (kind === "title") return L.title.text;
  if (kind === "words") return L.words.text;
  if (kind === "claim") return L.claim.text;
  if (kind === "feature") return L.feature.text;
  if (kind === "number") return { x: L.number.fig.x, y: L.number.fig.y, w: L.number.fig.w, h: L.number.label.y + L.number.label.h - L.number.fig.y };
  if (kind === "compare") return L.compare.before;
  if (kind === "steps") return { x: L.steps.head.x, y: L.steps.head.y, w: L.steps.head.w, h: L.steps.cards[0].y + L.steps.cards[0].h - L.steps.head.y };
  if (kind === "product") return L.product.text;
  return L.quote.text;
}

/**
 * The words of the scene showing, typed right on the film (09.11.2026, the flow standard): a field for each of its
 * lines, set over the scene's words; each key writes the same field as the left card (which follows) and the film
 * behind it. Enter or a click outside keeps them, Esc puts the scene back as it was.
 */
function OnFilm({ box, scale, title, fields, onKeep, onDrop }: {
  box: Box4; scale: number; title: string; onKeep: () => void; onDrop: () => void;
  fields: { key: string; label: string; value: string; words: number; red: boolean; multiline?: boolean; onChange: (v: string) => void }[];
}) {
  const card = useRef<HTMLDivElement | null>(null);
  const keep = useRef(onKeep);
  keep.current = onKeep;
  // a click anywhere else keeps the words
  useEffect(() => {
    const down = (e: MouseEvent) => { if (card.current && !card.current.contains(e.target as Node)) keep.current(); };
    const t = setTimeout(() => document.addEventListener("mousedown", down, true), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", down, true); };
  }, []);
  const w = Math.max(300, Math.min(440, box.w * scale));
  return (
    <Box ref={card} role="dialog" aria-label={`${title} - typed on the film`}
      onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const multi = (e.target as HTMLElement).getAttribute("aria-multiline") === "true";
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onDrop(); } else if (e.key === "Enter" && !e.shiftKey && !multi) { e.preventDefault(); e.stopPropagation(); onKeep(); }
      }}
      sx={{
        position: "absolute", zIndex: 3, left: Math.max(8, box.x * scale - 12), top: Math.max(8, box.y * scale - 12), width: w, maxHeight: "calc(100% - 16px)", overflowY: "auto",
        p: 1.25, pb: 0.5, borderRadius: "10px", bgcolor: "rgba(255,255,255,.97)", border: "1.5px solid #c22c6e", boxShadow: "0 16px 40px rgba(21,34,58,.28)", cursor: "default",
      }}>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: INK, mb: 0.75 }}>
        {title} <Box component="span" sx={{ fontWeight: 500, color: MUTED }}>· Enter keeps it, Esc drops it</Box>
      </Typography>
      {fields.map((f, i) => (
        <WordField key={f.key} label={f.label} value={f.value} words={f.words} red={f.red} multiline={f.multiline} autoFocus={i === 0} onChange={f.onChange} />
      ))}
    </Box>
  );
}

type Busy = { what: "film" | "scene" | "end"; index?: number; label: string; since: number };

export default function Studio({ api }: StudioProps) {
  const lang = api.data.piece.language;
  const canEdit = api.data.access.canEdit;
  const raw = api.doc;
  const doc = useMemo(() => editable(raw, lang), [raw, lang]);
  /** What the film plays: the document cleaned (trimmed words, kinds and bars in range). */
  const film = useMemo(() => cleanVideo(doc, { language: lang }), [doc, lang]);
  const segs = useMemo(() => segments(film), [film]);
  const issues = useMemo(() => validate(film), [film]);
  const { setDoc } = api;

  // the first studio's {notes}: brought up to a film once
  useEffect(() => { if (canEdit && raw && !isV2(raw)) setDoc(cleanVideo(raw, { language: lang })); }, [raw, canEdit, lang, setDoc]);

  const edit = useCallback((fn: (d: VideoDoc) => VideoDoc) => setDoc((cur: unknown) => fn(editable(cur, lang))), [setDoc, lang]);

  // what is open in the map: a scene (its index), the end card (-1), the film's settings (-2), or nothing
  const [sel, setSel] = useState<number | null>(null);
  const open = sel !== null && (sel < 0 || sel < doc.scenes.length) ? sel : null;
  const [step, setStep] = useState<"map" | "export">("map");

  const player = useRef<PlayerHandle | null>(null);
  const segOf = (i: number) => (i === -1 ? segs[segs.length - 1] : segs[i]);
  /** The film held on a scene, its words in. */
  const hold = (i: number) => { const s = segOf(i); if (s) player.current?.seek(holdFrame(s), false); };
  const select = (i: number) => { setSel(i); setStep("map"); if (i >= -1) hold(i); };
  const toggle = (i: number) => (open === i ? setSel(null) : select(i));
  // the row opened in the map scrolls into view (a click on the strip opens a row that may be out of sight)
  useEffect(() => {
    if (open === null) return;
    const t = setTimeout(() => document.querySelector(`[data-row="v-${open}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 260);
    return () => clearTimeout(t);
  }, [open]);
  // on opening, the film shows its first scene with its words in - not an empty first frame
  useEffect(() => { const t = setTimeout(() => { if (segs[0]) player.current?.seek(holdFrame(segs[0]), false); }, 120); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the words of the scene showing, typed right on the film (a double-click on it)
  const [onFilm, setOnFilm] = useState<{ index: number; before: VideoDoc } | null>(null);
  const onFilmRef = useRef(onFilm);
  onFilmRef.current = onFilm;
  const docRef = useRef(doc);
  docRef.current = doc;
  // another scene opened: the words typed are kept
  useEffect(() => { if (onFilm && open !== onFilm.index) setOnFilm(null); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // the AI: its answer is applied at once and played; every change is listed with an Undo
  const changes = useChanges<VideoDoc>(`video-${api.data.piece.id}`, raw ? doc : undefined);
  const [busy, setBusy] = useState<Busy | null>(null);
  const ask = useRef<HTMLTextAreaElement | null>(null);
  const runAi = async (task: string, label: string, input: Record<string, unknown> = {}, after?: () => void): Promise<string | null> => {
    const before = doc;
    const scene = task === "scene" ? before.scenes[Number(input.index)] : undefined;
    const end = task === "end";
    setBusy({ what: scene ? "scene" : end ? "end" : "film", index: scene ? Number(input.index) : undefined, label, since: Date.now() });
    try {
      const r = await api.ai<AiAnswer>(task, input);
      if (!r.ok) return r.error;
      if (!r.result?.doc || !isV2(r.result.doc)) return "The assistant's answer could not be used - try again.";
      const ans = r.result.doc;
      const dropped = r.result.dropped?.length ? `Left out: ${r.result.dropped.join("; ")}.` : "";
      if (scene) {
        // a scene's ask changes that scene only - whatever else the answer holds, the rest of the film stays as it is now
        const next = ans.scenes.find((x) => x.id === scene.id);
        if (!next || JSON.stringify(next) === JSON.stringify(scene)) return [r.result.note || "The scene stays as it was.", dropped].filter(Boolean).join(" ");
        edit((d) => ({ ...d, features: ans.features ?? d.features, scenes: d.scenes.map((x) => (x.id === scene.id ? next : x)) }));
      } else if (end) {
        // the end card's ask changes the end card only: its line and its button
        if (ans.endCard.line === before.endCard.line && ans.endCard.cta === before.endCard.cta) return [r.result.note || "The end card stays as it was.", dropped].filter(Boolean).join(" ");
        edit((d) => ({ ...d, endCard: { ...d.endCard, line: ans.endCard.line, cta: ans.endCard.cta } }));
      } else {
        setDoc(ans);
      }
      changes.record(label, before, r.result.note || undefined);
      after?.();
      return dropped || null;
    } finally {
      setBusy(null);
    }
  };

  // the film as a whole: what it is about, how long - then "Make the whole film with AI"
  const picked = doc.features ?? [];
  const length: FilmLength = doc.length ?? 20;
  const [confirmed, setConfirmed] = useState<FeatureKey[] | null>(null);
  const [makeMsg, setMakeMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    void api.act<{ confirmed: FeatureKey[] }>("features").then((r) => { if (r.ok) setConfirmed(r.result.confirmed); });
  }, [canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  const makeFilm = async () => {
    setMakeMsg(null);
    const msg = await runAi("storyboard", film.scenes.length ? "Made the film again" : "Made the film", { features: picked, seconds: length }, () => { setSel(null); setTimeout(() => player.current?.seek(0, true), 60); });
    setMakeMsg(msg);
    return msg;
  };
  const addFeatureScenes = () => edit((d) => ({ ...d, scenes: [...d.scenes, ...picked.map((k) => featureScene(k))].slice(0, MAX_SCENES) }));

  // the scenes: move, add, take out
  const move = (from: number, to: number) => {
    edit((d) => { const a = [...d.scenes]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return { ...d, scenes: a }; });
    if (open === from) setSel(to);
  };
  const add = (k: SceneKind) => {
    const at = open !== null && open >= 0 ? open + 1 : doc.scenes.length;
    edit((d) => { const a = [...d.scenes]; a.splice(at, 0, newScene(k)); return { ...d, scenes: a }; });
    setSel(at);
    setTimeout(() => hold(at), 60);
  };
  const remove = (i: number) => {
    edit((d) => ({ ...d, scenes: d.scenes.filter((_, k) => k !== i) }));
    setSel(doc.scenes.length > 1 ? Math.max(0, i - 1) : null);
  };

  // the last step: the story for the render machine
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const exportFilm = async () => {
    setExporting(true); setExportMsg(null);
    const r = await api.act<{ spec: VideoSpec | null; issues: Issue[] }>("export", { format: film.format });
    setExporting(false);
    if (!r.ok) { setExportMsg(r.error); return; }
    if (!r.result.spec) { setExportMsg(`Not yet: ${r.result.issues.filter((x) => x.level === "stop").map((x) => x.text).join(" ")}`); return; }
    const name = `${slug(api.data.piece.title)}-${film.format.replace(":", "x")}.json`;
    download(name, r.result.spec);
    setFile(name);
  };

  const stops = issues.filter((x) => x.level === "stop");
  const where = { projectId: api.data.piece.projectId, pieceId: api.data.piece.id, me: api.data.me };
  const sceneIssues = (i: Issue["scene"]) => issues.filter((x) => x.scene === i);
  const aiOn = api.data.ai && canEdit;
  const onScene = open !== null && open >= 0 && !!doc.scenes[open];
  const onEnd = open === -1 && film.scenes.length > 0;
  const hasScenes = film.scenes.length > 0;
  const makingFilm = busy?.what === "film";
  const clock = useClock(busy?.since ?? null);
  const sceneName = (i: number) => `Scene ${i + 1} · ${KIND_INFO[doc.scenes[i]?.kind ?? "title"].label}`;

  /* ── the map ── */
  const settings = (
    <FilmPanel picked={picked} onPick={(keys) => edit((d) => ({ ...d, features: keys }))} confirmed={confirmed}
      length={length} onLength={(n) => edit((d) => ({ ...d, length: n }))} disabled={!canEdit} issues={hasScenes ? sceneIssues("film") : []} />
  );
  const readyLine = stops.length
    ? <Box component="span" sx={{ color: RED, fontWeight: 600 }}>{stops.length} thing{stops.length === 1 ? "" : "s"} to fix before it goes out</Box>
    : `${film.scenes.length} scene${film.scenes.length === 1 ? "" : "s"} · ${seconds(totalFrames(film))} s · ${FORMAT_INFO[film.format].label} - ready for the render machine`;

  const map = (
    <MapPane foot={hasScenes ? <LastStep name="Export for rendering" line={readyLine} onClick={() => { setSel(null); setStep("export"); }} /> : undefined}>
      {!hasScenes && (
        <StartCard>
          {settings}
          <Button fullWidth variant="contained" disableElevation disabled={!canEdit || !api.data.ai || !!busy} onClick={() => void makeFilm()}
            startIcon={makingFilm ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlinedIcon />} sx={{ ...mainBtn, borderRadius: "8px", height: 42, mt: 2.25 }}>
            {makingFilm ? `Making the film · ${clock}` : "Make the whole film with AI"}
          </Button>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75, lineHeight: 1.45 }}>
            {api.data.ai ? "From the brief and the features you picked, in the to-do's language. Or add a scene below and write it yourself." : "The AI is not set up on this hub - add a scene below and write it yourself."}
          </Typography>
          {picked.length > 0 && <Button size="small" disabled={!canEdit || !!busy} onClick={addFeatureScenes} sx={{ ...btn, color: PINK, px: 0.5, mt: 0.5 }}>Add them as scenes to write myself</Button>}
        </StartCard>
      )}
      {makeMsg && <Typography sx={{ mb: 1.5, fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px" }}>{makeMsg}</Typography>}
      {hasScenes && (
        <Kick right={makingFilm ? <Writing label={busy?.label === "Made the film again" ? "Making it again" : "Writing the film"} since={busy?.since ?? null} /> : canEdit ? (
          <Button size="small" disabled={!api.data.ai || !!busy} onClick={() => void makeFilm()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
            sx={{ ...btn, color: PINK, px: 0.75, py: 0.1, fontSize: "0.76rem", minWidth: 0 }}>Make it all again</Button>
        ) : undefined}>
          The film · {film.scenes.length} scene{film.scenes.length === 1 ? "" : "s"} · {seconds(totalFrames(film))} s
        </Kick>
      )}
      {hasScenes && (
        <MapList>
          <MapRow id="v--2" title="What it is about" summary={filmLine(picked, length)} state="none" accent="blue" open={open === -2} onToggle={() => toggle(-2)}>
            {settings}
            <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 1.25 }}>A change here is used the next time the film is made again - the scenes stay as they are.</Typography>
          </MapRow>
          {doc.scenes.map((s, i) => {
            const mine = sceneIssues(i);
            const writing = makingFilm || (busy?.what === "scene" && busy.index === i);
            return (
              <MapRow key={s.id} id={`v-${i}`} title={`Scene ${i + 1}`} sub={KIND_INFO[s.kind].label} summary={wordsOf(s) || "Not written yet"}
                state={writing ? "busy" : markOf(s, mine)} busyLabel={makingFilm ? "Writing…" : `${busy?.label ?? "Rewriting"}…`} open={open === i} onToggle={() => toggle(i)}>
                <ScenePanel key={s.id} doc={doc} i={i} issues={mine} edit={edit} disabled={!canEdit} where={where} onShow={() => hold(i)} onRemove={() => remove(i)} />
              </MapRow>
            );
          })}
          <MapRow id="v--1" title="End card" summary={plain(doc.endCard.line) || "Not written yet"} state={makingFilm || busy?.what === "end" ? "busy" : sceneIssues("end").some((x) => x.level === "stop") ? "stop" : plain(doc.endCard.line) ? "written" : "empty"}
            busyLabel={busy?.what === "end" ? `${busy.label}…` : "Writing…"} open={open === -1} onToggle={() => toggle(-1)}>
            <EndPanel doc={doc} issues={sceneIssues("end")} edit={edit} disabled={!canEdit} onShow={() => hold(-1)} />
          </MapRow>
        </MapList>
      )}
      <AddScene onAdd={add} disabled={!canEdit || !!busy || doc.scenes.length >= MAX_SCENES} after={onScene ? open : null} />
    </MapPane>
  );

  /* ── the film, with what is selected on it ── */
  const selLabel = onScene ? sceneName(open!) : open === -1 ? "End card" : null;
  const middle = (
    <Pane tone="stage" title={`The film · ${seconds(totalFrames(film))} seconds`} right={
      <SquareChoice<Format> value={film.format} onChange={(f) => canEdit && edit((d) => ({ ...d, format: f }))} options={FORMATS.map((f) => ({ key: f, label: FORMAT_INFO[f].label, disabled: !canEdit }))} />
    }>
      <Box sx={{ height: { xs: "auto", lg: "100%" }, minHeight: { xs: 520, lg: 0 }, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
          {busy && (
            <Box aria-live="polite" sx={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <Box sx={{ mt: 1, px: 2, py: 1, borderRadius: "8px", bgcolor: "rgba(21,34,58,.86)", color: "#fff", display: "flex", alignItems: "center", gap: 1.25, boxShadow: "0 10px 30px rgba(21,34,58,.25)", overflow: "hidden", position: "relative" }}>
                <CircularProgress size={16} sx={{ color: "#fff" }} />
                <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {busy.what === "end" ? `${busy.label} · ${clock}` : busy.what === "scene" ? `${busy.label} · scene ${(busy.index ?? 0) + 1} · ${clock}` : `Writing the scenes${picked.length ? ` around ${picked.length === 1 ? "your feature" : `your ${picked.length} features`}` : ""} · ${clock}`}
                </Typography>
                <Box sx={{ position: "absolute", left: 0, bottom: 0, height: 2, width: "40%", bgcolor: "#d80901", animation: "cv3make 1.6s ease-in-out infinite", "@keyframes cv3make": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } } }} />
              </Box>
            </Box>
          )}
          {selLabel && !busy && (
            // what is selected, on the film: "<Scene> · Ask AI · ×" (the flow standard's label)
            <Box sx={{ position: "absolute", left: 12, top: 10, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 0.25, pl: 1.25, pr: 0.25, py: 0.25, borderRadius: "6px", bgcolor: "#15223a", color: "#fff", boxShadow: "0 6px 18px rgba(21,34,58,.25)" }}>
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#fff", mr: 0.5, whiteSpace: "nowrap" }}>{selLabel}</Typography>
              {(onScene || onEnd) && aiOn && (
                <Button size="small" onClick={() => ask.current?.focus()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...btn, color: "#f7b6cf", fontSize: "0.74rem", py: 0, px: 0.75, minWidth: 0 }}>Ask AI</Button>
              )}
              <IconButton size="small" onClick={() => setSel(null)} aria-label="Let go of the scene" sx={{ color: "rgba(255,255,255,.75)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
            </Box>
          )}
          <Player doc={film} handle={player} onOpen={(i) => {
            // the scene showing opens in the map, and its words become fields right on the film
            select(i);
            if (canEdit && (i === -1 || doc.scenes[i])) setOnFilm({ index: i, before: doc });
          }} overlay={onFilm ? (scale) => {
            const i = onFilm.index;
            const sc = i >= 0 ? doc.scenes[i] : null;
            const fields = sc
              ? KIND_INFO[sc.kind].fields.map((f) => ({ key: f.key, label: f.label, value: sc.copy[f.key] ?? "", words: f.words, red: redOnFilm(sc.kind, f.key), multiline: sc.kind === "quote" && f.key === "line1",
                onChange: (v: string) => edit((d) => ({ ...d, scenes: d.scenes.map((x) => (x.id === sc.id ? { ...x, copy: { ...x.copy, [f.key]: v } } : x)) })) }))
              : END_FIELDS.map((f) => ({ key: f.key, label: f.label, value: doc.endCard[f.key], words: f.words, red: f.key === "line", onChange: (v: string) => edit((d) => ({ ...d, endCard: { ...d.endCard, [f.key]: v } })) }));
            return (
              <OnFilm box={wordsBox(film.format, sc ? sc.kind : "end")} scale={scale} title={sc ? sceneName(i) : "End card"} fields={fields}
                onKeep={() => {
                  const was = onFilmRef.current;
                  setOnFilm(null);
                  if (was && JSON.stringify(was.before) !== JSON.stringify(docRef.current)) changes.record(`${sc ? `Scene ${i + 1}` : "End card"}: typed on the film`, was.before, undefined, "you");
                }}
                onDrop={() => { const was = onFilmRef.current; setOnFilm(null); if (was) setDoc(was.before); }} />
            );
          } : undefined} strip={(frame, seg, playing) => (
            <Strip film={film} segs={segs} selected={open !== null && open >= -1 ? open : null} playing={playing ? seg.index : null} frame={frame} issues={issues} disabled={!canEdit}
              onSelect={select} onMove={move} onAdd={add} />
          )} />
        </Box>
      </Box>
    </Pane>
  );

  /* ── the assistant ── */
  const holdAfter = (i: number) => () => setTimeout(() => hold(i), 60);
  const assistant = (
    <AssistantPanel
      enabled={aiOn}
      inputRef={ask}
      top={<WorkingOn selection={onScene ? sceneName(open!) : onEnd ? "End card" : null} whole="The whole film" hint="click a scene to work on it alone" onClear={() => setSel(null)} />}
      placeholder={onScene ? "What should change in this scene? E.g. for buyers in food plants" : onEnd ? "What should change in the end card? E.g. end on DirectCUT" : "What should change in the film? E.g. a calmer opening, end on DirectCUT"}
      quick={onEnd ? [
        { label: "Shorter", run: () => runAi("end", "End card: shorter", { how: "shorter" }, () => setTimeout(() => hold(-1), 60)) },
        { label: "Another closing line", run: () => runAi("end", "End card: another closing line", { how: "another" }, () => setTimeout(() => hold(-1), 60)) },
      ] : onScene ? [
        { label: "Shorter", run: () => runAi("scene", `Scene ${open! + 1}: shorter`, { index: open, how: "shorter" }, holdAfter(open!)) },
        { label: "Another feature", run: () => runAi("scene", `Scene ${open! + 1}: another feature`, { index: open, how: "feature" }, holdAfter(open!)) },
      ] : [
        ...(hasScenes ? [] : [{ label: "Make the whole film", run: makeFilm }]),
        ...(hasScenes ? [
          { label: "Shorten every line", run: () => runAi("tighten", "Every line shorter") },
          { label: "Another opening", run: () => runAi("variant", "Another opening", {}, () => setTimeout(() => player.current?.seek(0, true), 60)) },
        ] : []),
      ]}
      onAsk={(text) => (onEnd
        ? runAi("end", `End card: "${text.slice(0, 60)}"`, { how: "ask", ask: text }, () => setTimeout(() => hold(-1), 60))
        : onScene
        ? runAi("scene", `Scene ${open! + 1}: "${text.slice(0, 60)}"`, { index: open, how: "ask", ask: text }, holdAfter(open!))
        : runAi(hasScenes ? "revise" : "storyboard", hasScenes ? `"${text.slice(0, 60)}"` : "Made the film", hasScenes ? { ask: text } : { features: picked, seconds: length, ask: text }, () => setTimeout(() => player.current?.seek(0, true), 60)))}
    >
      <ChangesList list={changes.list} what="film" onUndo={(e) => { setDoc(changes.undo(e)); }} />
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
        It writes from the project&apos;s brief and the features you picked, in the to-do&apos;s language, and keeps our rules: few words a line, never a discount value, no prices, no figure our features do not state, no quote nobody gave us.
      </Typography>
    </AssistantPanel>
  );

  return (
    <StudioPanes id="video4" buildWidth={380} assistWidth={320}
      build={
        <Pane pad={false} title="Build">
          {step === "export" ? (
            <Box sx={{ height: "100%", overflowY: "auto" }}>
              <ExportView film={film} issues={issues} onBack={() => setStep("map")} onFormat={(f) => canEdit && edit((d) => ({ ...d, format: f }))} onExport={exportFilm}
                exporting={exporting} msg={exportMsg} file={file} disabled={!canEdit} />
            </Box>
          ) : map}
        </Pane>
      }
      preview={middle}
      assist={assistant}
    />
  );
}
