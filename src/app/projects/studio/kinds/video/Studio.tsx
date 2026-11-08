"use client";
// THE VIDEO STUDIO (08.11.2026; SARCLA: "if you could integrate video generation and the outcome would be like the
// motion graphics video design we have been doing, this is also welcomed"). A to-do of kind "video" opens here:
//   Storyboard   the film's scenes in order, each one of our kinds (title, words, claim, steps, product, quote), its bars,
//                its few words; then the end card
//   Film         the film itself, playing live in our motion style - 16:9, 9:16 or 1:1, the same story; "Export for
//                rendering" hands the story to the render machine (the hub cannot render: no Chromium on Fargate)
//   Assistant    a storyboard from the brief, every line shorter, another opening, or a change in your words - always
//                within our rules (never a discount value, no prices, no invented quote); one click undoes it
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
import { Choice } from "@/app/connectors/parts";
import { seconds } from "@/lib/content/studio/kinds/video/engine/timeline";
import {
  cleanVideo, FORMAT_INFO, FORMATS, segments, totalBars, totalFrames, validate,
  type Format, type Issue, type VideoDoc, type VideoSpec,
} from "@/lib/content/studio/kinds/video/model";
import type { AiAnswer } from "@/lib/content/studio/kinds/video/ai";
import { AssistantPanel, btn, mainBtn, Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import Player, { type PlayerHandle } from "./Player";
import Storyboard from "./Storyboard";

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

  const player = useRef<PlayerHandle | null>(null);
  const [current, setCurrent] = useState(0);
  const startOf = (i: number) => (i === -1 ? segs[segs.length - 1] : segs[i]);
  const play = (i: number) => { const s = startOf(i); if (s) player.current?.seek(s.start, true); };
  // while typing in a scene, the player holds it where its words are in
  const show = (i: number) => { const s = startOf(i); if (s) player.current?.seek(s.start + Math.min(s.dur - 6, 54), false); };

  // the assistant: its answer is applied at once and played; one click brings back what was there
  const [undo, setUndo] = useState<VideoDoc | null>(null);
  const runAi = async (task: string, input?: Record<string, unknown>): Promise<string | null> => {
    const before = doc;
    const r = await api.ai<AiAnswer>(task, input);
    if (!r.ok) return r.error;
    if (!r.result?.doc || !isV2(r.result.doc)) return "The assistant's answer could not be used - try again.";
    setUndo(before);
    setDoc(r.result.doc);
    setTimeout(() => player.current?.seek(0, true), 50);
    const dropped = r.result.dropped?.length ? ` Left out: ${r.result.dropped.join("; ")}.` : "";
    return `${r.result.note || "Done - it is playing."}${dropped}`;
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
  const warns = issues.filter((x) => x.level === "warn").length;

  return (
    <>
      <StudioPanes
        buildWidth={420}
        assistWidth={320}
        build={
          <Pane title="Storyboard" right={<Typography sx={{ fontSize: "0.78rem", color: MUTED, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{seconds(totalFrames(film))} s · {totalBars(film)} bars</Typography>}>
            <Storyboard doc={doc} segs={segs} issues={issues} edit={edit} disabled={!canEdit} current={current} onPlay={play} onShow={show} />
          </Pane>
        }
        preview={
          <Pane tone="stage" title="Film" right={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Choice<Format> value={film.format} onChange={(f) => edit((d) => ({ ...d, format: f }))} options={FORMATS.map((f) => ({ key: f, label: FORMAT_INFO[f].label }))} />
              <Tooltip title={stops ? "The film holds something our films never show - see the storyboard" : "The story as a file for the render machine"}>
                <span>
                  <Button size="small" variant="outlined" disabled={exporting || !film.scenes.length} onClick={exportFilm}
                    startIcon={exporting ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />}
                    sx={{ ...btn, borderColor: HAIRLINE, color: INK, bgcolor: "#fff" }}>
                    Export for rendering
                  </Button>
                </span>
              </Tooltip>
            </Box>
          }>
            <Box sx={{ height: { xs: "auto", lg: "100%" }, minHeight: { xs: 420, lg: 0 }, display: "flex", flexDirection: "column", gap: 1 }}>
              {exportMsg && <Typography sx={{ fontSize: "0.82rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "10px" }}>{exportMsg}</Typography>}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Player doc={film} handle={player} onScene={setCurrent} />
              </Box>
              <Typography sx={{ fontSize: "0.74rem", color: MUTED, textAlign: "center" }}>
                {FORMAT_INFO[film.format].w} x {FORMAT_INFO[film.format].h} · {FORMAT_INFO[film.format].use} · silent for now{stops || warns ? ` · ${stops ? `${stops} to fix` : ""}${stops && warns ? ", " : ""}${warns ? `${warns} to look at` : ""}` : ""}
              </Typography>
            </Box>
          </Pane>
        }
        assist={
          <AssistantPanel
            enabled={api.data.ai && canEdit}
            placeholder="Change it in your words - e.g. a calmer opening, end on DirectCUT"
            quick={[
              { label: film.scenes.length ? "Write the storyboard again" : "Write the storyboard", run: () => runAi("storyboard") },
              { label: "Shorten every line", run: () => runAi("tighten") },
              { label: "Another opening", run: () => runAi("variant") },
            ]}
            onAsk={(text) => runAi("revise", { ask: text })}
          >
            {undo && (
              <Button fullWidth size="small" startIcon={<UndoRoundedIcon sx={{ fontSize: 18 }} />} onClick={() => { setDoc(undo); setUndo(null); }} sx={{ ...btn, mt: 1.5, color: INK, border: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
                Bring back what was there
              </Button>
            )}
            <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
              The assistant writes from the project&apos;s brief, in the to-do&apos;s language, and keeps our rules: few words a line, never a discount value, no prices, no quote nobody gave us.
            </Typography>
          </AssistantPanel>
        }
      />
      <RenderHelp open={!!helpFile} onClose={() => setHelpFile(null)} file={helpFile ?? ""} />
    </>
  );
}
