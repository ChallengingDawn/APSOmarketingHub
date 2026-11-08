"use client";
// THE VIDEO STUDIO (08.11.2026; Content v3 - SARCLA tonight: "button is not fit", "O-ring is not realistic on video,
// and also here the controls are really hard"). The way a film is made, start to finish:
//   1. The film (left): what it is about - our features as cards -, how long, the format; one button, "Make the film".
//   2. It plays in the middle, big; under it the scenes as a strip of small pictures, then the end card.
//   3. A click on a scene holds the film on it and opens it on the left: its words (the frame changes as you type), what
//      it shows (one of our real parts - the shop's own product photo - or a photo), how long it lasts.
//   4. Drag a scene in the strip to move it; "+" adds one after the one open.
//   5. The assistant (right) works on what is open: this scene ("Shorter", "Another feature", your words) or the whole
//      film. One click brings back what was there.
//   6. "Export for rendering" hands the story to the render machine (the hub cannot render: no Chromium on Fargate).
// Gone from the first studio: the bars, the cut and the icon pickers, the loop and back buttons, the scrub track, the
// notes field (kept in the document, not on the way) - and the button that carried a feature's whole name.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { FeatureKey } from "@/lib/content/studio/kinds/video/features";
import { seconds } from "@/lib/content/studio/kinds/video/engine/timeline";
import {
  cleanVideo, featureScene, FORMAT_INFO, MAX_SCENES, newScene, segments, totalFrames, validate,
  type FilmLength, type Issue, type SceneKind, type VideoDoc, type VideoSpec,
} from "@/lib/content/studio/kinds/video/model";
import type { AiAnswer } from "@/lib/content/studio/kinds/video/ai";
import { AssistantPanel, btn, mainBtn, Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import FilmPanel from "./FilmPanel";
import Player, { type PlayerHandle } from "./Player";
import { EndPanel, ScenePanel } from "./ScenePanel";
import Strip, { holdFrame } from "./Strip";

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

function RenderHelp({ open, onClose, file }: { open: boolean; onClose: () => void; file: string }) {
  const cmd = `node scripts/content-video/render.mjs ${file} ${file.replace(/\.json$/, "")}.mp4 --format=all`;
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Rendering the film</DialogTitle>
      <DialogContent sx={{ pt: "4px !important" }}>
        <Typography sx={{ fontSize: "0.9rem", color: INK, mb: 1.5 }}>
          The story is saved as <b>{file}</b>. The hub cannot make the MP4 itself; the render laptop does, in the hub&apos;s folder:
        </Typography>
        <Box sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.8rem", bgcolor: "#15223a", color: "#e8edf6", p: 1.5, borderRadius: "10px", wordBreak: "break-all" }}>{cmd}</Box>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 1.5, lineHeight: 1.5 }}>
          That makes all three formats (16:9, 9:16, 1:1). For a quick look first, add <b>--scale=0.5</b> (540p) or <b>--stills=0,60,120</b> (pictures of those frames). It needs Chromium and ffmpeg on that machine.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={async () => { await navigator.clipboard?.writeText(cmd).catch(() => undefined); setCopied(true); }} sx={btn}>{copied ? "Copied" : "Copy the command"}</Button>
        <Button variant="contained" disableElevation onClick={onClose} sx={mainBtn}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

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

  // what is open: a scene (its index), the end card (-1), or the film as a whole (null)
  const [sel, setSel] = useState<number | null>(null);
  const open = sel !== null && (sel === -1 || sel < doc.scenes.length) ? sel : null;

  const player = useRef<PlayerHandle | null>(null);
  const segOf = (i: number) => (i === -1 ? segs[segs.length - 1] : segs[i]);
  /** The film held on a scene, its words in. */
  const hold = (i: number) => { const s = segOf(i); if (s) player.current?.seek(holdFrame(s), false); };
  const select = (i: number) => { setSel(i); hold(i); };
  // on opening, the film shows its first scene with its words in - not an empty first frame
  useEffect(() => { const t = setTimeout(() => { if (segs[0]) player.current?.seek(holdFrame(segs[0]), false); }, 120); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the assistant: its answer is applied at once and played; one click brings back what was there
  const [undo, setUndo] = useState<VideoDoc | null>(null);
  const runAi = async (task: string, input?: Record<string, unknown>, after?: (d: VideoDoc) => void): Promise<string | null> => {
    const before = doc;
    const r = await api.ai<AiAnswer>(task, input);
    if (!r.ok) return r.error;
    if (!r.result?.doc || !isV2(r.result.doc)) return "The assistant's answer could not be used - try again.";
    setUndo(before);
    setDoc(r.result.doc);
    after?.(r.result.doc);
    const dropped = r.result.dropped?.length ? ` Left out: ${r.result.dropped.join("; ")}.` : "";
    return `${r.result.note || "Done."}${dropped}`;
  };

  // the film as a whole: what it is about, how long, the format - then "Make the film"
  const picked = doc.features ?? [];
  const length: FilmLength = doc.length ?? 20;
  const [confirmed, setConfirmed] = useState<FeatureKey[] | null>(null);
  const [making, setMaking] = useState(false);
  const [makeMsg, setMakeMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    void api.act<{ confirmed: FeatureKey[] }>("features").then((r) => { if (r.ok) setConfirmed(r.result.confirmed); });
  }, [canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  const makeFilm = async () => {
    setMaking(true); setMakeMsg(null);
    const msg = await runAi("storyboard", { features: picked, seconds: length }, () => { setSel(null); setTimeout(() => player.current?.seek(0, true), 60); });
    setMaking(false); setMakeMsg(msg);
  };
  const addFeatureScenes = () => edit((d) => ({ ...d, scenes: [...d.scenes, ...picked.map((k) => featureScene(k))].slice(0, MAX_SCENES) }));

  // the strip: move, add, take out
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

  // export for the render machine
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [helpFile, setHelpFile] = useState<string | null>(null);
  const exportFilm = async () => {
    setExporting(true); setExportMsg(null);
    const r = await api.act<{ spec: VideoSpec | null; issues: Issue[] }>("export", { format: film.format });
    setExporting(false);
    if (!r.ok) { setExportMsg(r.error); return; }
    if (!r.result.spec) { setExportMsg(`Not yet: ${r.result.issues.filter((x) => x.level === "stop").map((x) => x.text).join(" ")}`); return; }
    const file = `${slug(api.data.piece.title)}-${film.format.replace(":", "x")}.json`;
    download(file, r.result.spec);
    setHelpFile(file);
  };

  const stops = issues.filter((x) => x.level === "stop").length;
  const where = { projectId: api.data.piece.projectId, pieceId: api.data.piece.id, me: api.data.me };
  const sceneIssues = (i: Issue["scene"]) => issues.filter((x) => x.scene === i);
  const aiOn = api.data.ai && canEdit;
  const onScene = open !== null && open >= 0;

  return (
    <>
      <StudioPanes id="video3" buildWidth={360} assistWidth={320}
        build={
          <Pane title={
            <Box sx={{ textTransform: "none", letterSpacing: "normal" }}>
              <SquareChoice<string> value={open === null ? "film" : "open"} onChange={(v) => { if (v === "film") setSel(null); }} options={[
                { key: "film", label: "The film" },
                ...(open !== null ? [{ key: "open", label: open === -1 ? "End card" : `Scene ${open + 1}` }] : []),
              ]} />
            </Box>
          }>
            {open === null ? (
              <>
                <FilmPanel picked={picked} onPick={(keys) => edit((d) => ({ ...d, features: keys }))} confirmed={confirmed}
                  length={length} onLength={(n) => edit((d) => ({ ...d, length: n }))} format={film.format} onFormat={(f) => edit((d) => ({ ...d, format: f }))}
                  disabled={!canEdit} aiReady={api.data.ai} busy={making} hasScenes={film.scenes.length > 0} onMake={makeFilm} onAdd={addFeatureScenes}
                  issues={film.scenes.length ? sceneIssues("film") : []} />
                {makeMsg && <Typography sx={{ mt: 1.5, fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px" }}>{makeMsg}</Typography>}
              </>
            ) : open === -1 ? (
              <EndPanel doc={doc} issues={sceneIssues("end")} edit={edit} disabled={!canEdit} onShow={() => hold(-1)} />
            ) : (
              <ScenePanel key={doc.scenes[open]?.id ?? open} doc={doc} i={open} issues={sceneIssues(open)} edit={edit} disabled={!canEdit} where={where}
                onShow={() => hold(open)} onRemove={() => remove(open)} />
            )}
          </Pane>
        }
        preview={
          <Pane tone="stage" title={`Film · ${seconds(totalFrames(film))} s · ${FORMAT_INFO[film.format].label}`} right={
            <Tooltip title={stops ? "The film holds something our films never show - see the scene marked red" : "The story as a file for the render machine"}>
              <span>
                <Button size="small" variant="outlined" disabled={exporting || !film.scenes.length} onClick={exportFilm}
                  startIcon={exporting ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />}
                  sx={{ ...btn, borderColor: HAIRLINE, color: INK, bgcolor: "#fff" }}>
                  Export for rendering
                </Button>
              </span>
            </Tooltip>
          }>
            <Box sx={{ height: { xs: "auto", lg: "100%" }, minHeight: { xs: 520, lg: 0 }, display: "flex", flexDirection: "column", gap: 1 }}>
              {exportMsg && <Typography sx={{ fontSize: "0.82rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "10px" }}>{exportMsg}</Typography>}
              <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
                {making && (
                  <Box aria-live="polite" sx={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                    <Box sx={{ mt: 1, px: 2, py: 1, borderRadius: "8px", bgcolor: "rgba(21,34,58,.86)", color: "#fff", display: "flex", alignItems: "center", gap: 1.25, boxShadow: "0 10px 30px rgba(21,34,58,.25)", overflow: "hidden", position: "relative" }}>
                      <CircularProgress size={16} sx={{ color: "#fff" }} />
                      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600 }}>Writing the scenes{picked.length ? ` around ${picked.length === 1 ? "your feature" : `your ${picked.length} features`}` : ""} - about half a minute</Typography>
                      <Box sx={{ position: "absolute", left: 0, bottom: 0, height: 2, width: "40%", bgcolor: "#d80901", animation: "cv3make 1.6s ease-in-out infinite", "@keyframes cv3make": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } } }} />
                    </Box>
                  </Box>
                )}
                <Player doc={film} handle={player} strip={(frame, seg, playing) => (
                  <Strip film={film} segs={segs} selected={open} playing={playing ? seg.index : null} frame={frame} issues={issues} disabled={!canEdit}
                    onSelect={select} onMove={move} onAdd={add} />
                )} />
              </Box>
            </Box>
          </Pane>
        }
        assist={
          <AssistantPanel
            enabled={aiOn}
            top={onScene ? (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, mb: 0.5 }}>Working on</Typography>
                <SquareChoice<string> value="scene" onChange={(v) => { if (v === "film") setSel(null); }} options={[{ key: "scene", label: `Scene ${(open ?? 0) + 1}` }, { key: "film", label: "The whole film" }]} />
              </Box>
            ) : undefined}
            placeholder={onScene ? "Change this scene in your words - e.g. for buyers in food plants" : "Change the film in your words - e.g. a calmer opening, end on DirectCUT"}
            quick={onScene ? [
              { label: "Shorter", run: () => runAi("scene", { index: open, how: "shorter" }, () => setTimeout(() => hold(open!), 60)) },
              { label: "Another feature", run: () => runAi("scene", { index: open, how: "feature" }, () => setTimeout(() => hold(open!), 60)) },
            ] : [
              ...(film.scenes.length ? [] : [{ label: "Make the film", run: async () => { await makeFilm(); return null; } }]),
              { label: "Shorten every line", run: () => runAi("tighten") },
              { label: "Another opening", run: () => runAi("variant", undefined, () => setTimeout(() => player.current?.seek(0, true), 60)) },
            ]}
            onAsk={(text) => (onScene ? runAi("scene", { index: open, how: "ask", ask: text }, () => setTimeout(() => hold(open!), 60)) : runAi("revise", { ask: text }, () => setTimeout(() => player.current?.seek(0, true), 60)))}
          >
            {undo && (
              <Button fullWidth size="small" startIcon={<UndoRoundedIcon sx={{ fontSize: 18 }} />} onClick={() => { setDoc(undo); setUndo(null); }} sx={{ ...btn, mt: 1.5, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
                Bring back what was there
              </Button>
            )}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
              It writes from the project&apos;s brief and the features you picked, in the to-do&apos;s language, and keeps our rules: few words a line, never a discount value, no prices, no figure our features do not state, no quote nobody gave us.
            </Typography>
          </AssistantPanel>
        }
      />
      <RenderHelp open={!!helpFile} onClose={() => setHelpFile(null)} file={helpFile ?? ""} />
    </>
  );
}
