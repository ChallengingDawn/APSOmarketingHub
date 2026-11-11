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
// cv16 (11.11.2026, SARCLA: "compare the evolution of this page [the Page builder] to the other content types' generators,
// and improve them") - the Page builder's bar where it fits a film:
//   - a click on the film held still picks ONE element - a line, the picture, the part, the end card's button - and opens
//     its popup beside it (./ElementPop.tsx): words, its own Ask AI (applied at once, Undo), Take it out / Duplicate / Move;
//     the bar's "Ask AI" puts the cursor in that box (page lib barAi.ts)
//   - a scene's own "Write it again with AI" box; "Write it all again" in four ways (./WriteAgain.tsx)
//   - a picture made from your own words, the newest ask wins (./PictureAsk.tsx)
//   - the film's languages, a tab each over the film (./Languages.tsx); the last step exports each language as its file
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
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
import { languageLabel } from "@/lib/content/languages";
import { AI_BOX_ATTR, barAiTarget } from "@/lib/content/studio/kinds/page/barAi";
import { duplicateEl, elementAt, elementName, elementsOf, moveEl, moveWords, takeOut, type El } from "@/lib/content/studio/kinds/video/element";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { FeatureKey } from "@/lib/content/studio/kinds/video/features";
import { seconds } from "@/lib/content/studio/kinds/video/engine/timeline";
import { plain } from "@/lib/content/studio/kinds/video/engine/text";
import {
  cleanVideo, dropLanguage, END_FIELDS, featureScene, FORMAT_INFO, FORMATS, inLanguage, KIND_INFO, languagesOf, MAX_SCENES, newScene, SCENE_KINDS, segments, setLangLine, totalFrames,
  untranslated, validate, wordsPrint,
  type CopyKey, type FilmLength, type Format, type Issue, type Scene, type SceneKind, type VideoDoc, type VideoSpec,
} from "@/lib/content/studio/kinds/video/model";
import type { AiAnswer } from "@/lib/content/studio/kinds/video/ai";
import { AssistantPanel, PINK, btn, mainBtn, Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import FilmPanel, { filmLine } from "./FilmPanel";
import Player, { type PlayerHandle } from "./Player";
import { LAYOUTS } from "@/lib/content/studio/kinds/video/film/layout";
import { WordField } from "./ui";
import { EndPanel, ScenePanel, Shows } from "./ScenePanel";
import type { Done } from "./AiBox";
import { ElementPop } from "./ElementPop";
import { LanguageBar, LanguageTabs } from "./Languages";
import { FILM_WROTE, FilmWriteAgain, type FilmWriteMode } from "./WriteAgain";
import { PartPicker } from "./ui";
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
/** One language's file in the last step (cv16): made, refused (in plain words), or being made. */
type ExportRow = { lang: string; state: "waiting" | "making" | "done" | "refused"; file?: string; why?: string };

function ExportView({ film, issues, onBack, onFormat, onExport, exporting, msg, rows, disabled }: {
  film: VideoDoc; issues: Issue[]; onBack: () => void; onFormat: (f: Format) => void; onExport: (langs: string[]) => void; exporting: boolean; msg: string | null; rows: ExportRow[]; disabled: boolean;
}) {
  const langs = languagesOf(film);
  const [pick, setPick] = useState<string[]>(langs);
  const chosen = langs.filter((l) => pick.includes(l));
  const stops = issues.filter((x) => x.level === "stop");
  const warns = issues.filter((x) => x.level !== "stop");
  const files = rows.filter((r) => r.state === "done" && r.file).map((r) => r.file!);
  const file = files[0] ?? null;
  const cmd = files.map((f) => `node scripts/content-video/render.mjs ${f} ${f.replace(/\.json$/, "")}.mp4 --format=all`).join("\n");
  const failed = rows.filter((r) => r.state === "refused").map((r) => r.lang);
  const done = rows.filter((r) => r.state === "done" || r.state === "refused").length;
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
      {langs.length > 1 && (
        <>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 0.75 }}>Languages · a file each</Typography>
          <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mb: 2 }}>
            {langs.map((l) => {
              const on = pick.includes(l);
              return (
                <Button key={l} size="small" aria-pressed={on} disabled={exporting} onClick={() => setPick((x) => (on ? x.filter((y) => y !== l) : [...x, l]))}
                  sx={{ ...btn, minWidth: 0, px: 1.1, py: 0.2, fontSize: "0.8rem", borderRadius: "6px", border: `1px solid ${on ? "#2459d1" : HAIRLINE}`, color: on ? "#2459d1" : MUTED, bgcolor: on ? "rgba(36,89,209,.06)" : "#fff" }}>
                  {l} · {languageLabel(l)}
                </Button>
              );
            })}
          </Box>
        </>
      )}

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

      <Button fullWidth variant="contained" disableElevation disabled={exporting || !film.scenes.length || stops.length > 0 || !chosen.length} onClick={() => onExport(chosen)}
        startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />} sx={{ ...mainBtn, borderRadius: "8px", height: 42 }}>
        {exporting ? `Exporting ${Math.min(done + 1, rows.length)} of ${rows.length}` : chosen.length > 1 ? `Export all ${chosen.length} languages` : "Export the story"}
      </Button>
      {rows.length > 1 && (
        <Box sx={{ mt: 1.25, display: "grid", gap: 0.5 }}>
          <LinearProgress variant="determinate" value={(done / rows.length) * 100} sx={{ height: 4, borderRadius: 2, bgcolor: "rgba(36,89,209,.12)", "& .MuiLinearProgress-bar": { bgcolor: "#2459d1" } }} />
          {rows.map((r) => (
            <Typography key={r.lang} sx={{ fontSize: "0.78rem", lineHeight: 1.4, color: r.state === "refused" ? RED : r.state === "done" ? "#1b7a55" : MUTED }}>
              <b>{r.lang}</b> · {r.state === "done" ? `saved as ${r.file}` : r.state === "refused" ? `not exported: ${r.why}` : r.state === "making" ? "exporting…" : "waiting"}
            </Typography>
          ))}
          {!exporting && failed.length > 0 && (
            <Button size="small" onClick={() => onExport(failed)} sx={{ ...btn, color: PINK, px: 0.5, justifySelf: "start" }}>Try again for {failed.join(", ")}</Button>
          )}
        </Box>
      )}
      {stops.length > 0 && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.75 }}>Fix what is in red first - the film never shows it.</Typography>}
      {msg && <Typography sx={{ mt: 1.25, fontSize: "0.8rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 1, borderRadius: "8px" }}>{msg}</Typography>}

      {file && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: "0.84rem", color: INK, mb: 1 }}>{files.length > 1 ? <>Saved as <b>{files.length} files</b>, one a language.</> : <>Saved as <b>{file}</b>.</>} On the render laptop, in the hub&apos;s folder:</Typography>
          <Box sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "0.76rem", bgcolor: "#15223a", color: "#e8edf6", p: 1.25, borderRadius: "8px", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{cmd}</Box>
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
  // the cursor lands in the scene's big words (the claim, the headline), not in the small line over them - a double-click
  // on the film is nearly always on those (QA 09.11: it went to "Feature" and the words typed landed there)
  const main = Math.max(0, fields.findIndex((f) => f.red));
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
        <WordField key={f.key} label={f.label} value={f.value} words={f.words} red={f.red} multiline={f.multiline} autoFocus={i === main} onChange={f.onChange} />
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
  const { setDoc } = api;
  // the language shown (cv16): the film's own, or one of its versions - the film plays in it, its words are typed in it
  const [view, setView] = useState<string>("");
  const langs = languagesOf(film);
  const shownLang = langs.includes(view) ? view : film.language;
  const inVersion = shownLang !== film.language;
  const shown = useMemo(() => (inVersion ? inLanguage(film, shownLang) : film), [film, shownLang, inVersion]);
  const issues = useMemo(() => validate(shown), [shown]);

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
  // a version looked at (read-only) leaves this browser's list of changes alone
  const changes = useChanges<VideoDoc>(api.looking ? undefined : `video-${api.data.piece.id}`, raw ? doc : undefined);
  const [busy, setBusy] = useState<Busy | null>(null);
  const ask = useRef<HTMLTextAreaElement | null>(null);
  /** set when an ask changed the film (a scene's own box says "Undo" only then) */
  const applied = useRef<string | false>(false);
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
      applied.current = r.result.note || "Written again.";
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

  // the words of the language shown (cv16): the film's own, or the version's (typed into it)
  const wordOf = (i: number, key: CopyKey) => (inVersion ? doc.langs?.[shownLang]?.scenes[doc.scenes[i]?.id ?? ""]?.[key] ?? "" : doc.scenes[i]?.copy[key] ?? "");
  const setWord = (i: number, key: CopyKey, v: string) => edit((d) => (inVersion ? setLangLine(d, shownLang, d.scenes[i].id, key, v) : { ...d, scenes: d.scenes.map((x, k) => (k === i ? { ...x, copy: { ...x.copy, [key]: v } } : x)) }));
  const endWordOf = (k: "line" | "cta") => (inVersion ? doc.langs?.[shownLang]?.end[k] ?? "" : doc.endCard[k]);
  const setEndWord = (k: "line" | "cta", v: string) => edit((d) => (inVersion ? setLangLine(d, shownLang, "end", k, v) : { ...d, endCard: { ...d.endCard, [k]: v } }));

  // a scene's (or the end card's) own "Write it again with AI" - applied at once, its Undo beside it
  const askScene = (i: number) => async (text: string): Promise<Done | string | null> => {
    const before = doc;
    applied.current = false;
    const msg = i === -1
      ? await runAi("end", text ? `End card: "${text.slice(0, 60)}"` : "End card: written again", { how: text ? "ask" : "another", ask: text }, () => setTimeout(() => hold(-1), 60))
      : await runAi("scene", text ? `Scene ${i + 1}: "${text.slice(0, 60)}"` : `Scene ${i + 1}: written again`, { index: i, how: "ask", ask: text }, () => setTimeout(() => hold(i), 60));
    return applied.current ? { text: [applied.current, msg].filter(Boolean).join(" "), undo: () => setDoc(before) } : msg || "It stays as it was.";
  };

  // ONE element picked on the film (cv16): a line, the picture or the part, the end card's line or button
  const [elSel, setElSel] = useState<El | null>(null);
  const [pickBox, setPickBox] = useState<HTMLDivElement | null>(null);
  const pick = (i: number, at: { x: number; y: number }): boolean => {
    if (!canEdit || busy) return false;
    const s = i >= 0 ? shown.scenes[i] : null;
    if (i >= 0 && !s) return false;
    const hit = elementAt(s, film.format, at.x, at.y, shown.endCard);
    if (!hit) { setElSel(null); return false; }
    select(i);
    setOnFilm(null);
    setElSel({ scene: i, key: hit.key });
    return true;
  };
  useEffect(() => { if (elSel && open !== elSel.scene) setElSel(null); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const elInfo = elSel ? elementsOf(elSel.scene >= 0 ? shown.scenes[elSel.scene] ?? null : null, film.format, shown.endCard).find((e) => e.key === elSel.key) ?? null : null;
  /** One line's own ask: that line only, in the language shown - applied at once. */
  const askLine = (el: El) => async (text: string): Promise<Done | string | null> => {
    const before = doc;
    const sceneId = el.scene >= 0 ? doc.scenes[el.scene]?.id : "end";
    if (!sceneId) return "That line is not in the film any more.";
    setBusy({ what: el.scene === -1 ? "end" : "scene", index: el.scene >= 0 ? el.scene : undefined, label: "Rewriting the line", since: Date.now() });
    try {
      const r = await api.ai<AiAnswer>("line", { index: el.scene, key: el.key, ask: text, ...(inVersion ? { lang: shownLang } : {}) });
      if (!r.ok) return r.error;
      const ans = r.result?.doc;
      if (!ans || !isV2(ans)) return "The assistant's answer could not be used - try again.";
      const k = el.key as CopyKey;
      const end = el.key === "cta" ? "cta" : "line";
      const next = el.scene === -1
        ? (inVersion ? ans.langs?.[shownLang]?.end[end] : ans.endCard[end])
        : (inVersion ? ans.langs?.[shownLang]?.scenes[sceneId]?.[k] : ans.scenes.find((x) => x.id === sceneId)?.copy[k]);
      const now = el.scene === -1 ? endWordOf(end) : wordOf(el.scene, k);
      const dropped = r.result.dropped?.length ? `Left out: ${r.result.dropped.join("; ")}.` : "";
      if (!next || next === now) return [r.result.note || "The line stays as it was.", dropped].filter(Boolean).join(" ");
      if (el.scene === -1) setEndWord(end, next); else setWord(el.scene, k, next);
      changes.record(`${elementName(film, el)}${inVersion ? ` (${shownLang})` : ""}: ${text ? `"${text.slice(0, 50)}"` : "written again"}`, before, r.result.note || undefined);
      return { text: [r.result.note || "Rewritten.", dropped].filter(Boolean).join(" "), undo: () => setDoc(before) };
    } finally {
      setBusy(null);
    }
  };
  const elDo = (fn: () => { doc: VideoDoc; el: El } | VideoDoc | null, label: string) => {
    const before = doc;
    const r = fn();
    if (!r) return;
    const next = "doc" in r ? r.doc : r;
    setDoc(next);
    changes.record(label, before, undefined, "you");
    if ("el" in r) { setSel(r.el.scene); setElSel(r.el); setTimeout(() => hold(r.el.scene), 60); } else setElSel(null);
  };

  // "Write it all again" in four ways (cv16)
  const seek0 = () => setTimeout(() => player.current?.seek(0, true), 60);
  const writeAgain = (mode: FilmWriteMode, text?: string) => {
    setElSel(null);
    if (mode === "topic") { void makeFilm(); return; }
    if (mode === "reset") {
      const before = doc;
      edit((d) => { const { langs: _l, ...rest } = d; return { ...rest, scenes: [], endCard: { ...d.endCard, line: "" } }; });
      changes.record(FILM_WROTE.reset, before, undefined, "you");
      setSel(null); setView("");
      return;
    }
    if (mode === "better") { void runAi("revise", FILM_WROTE.better, { how: "better" }, seek0).then(setMakeMsg); return; }
    void runAi("revise", `${FILM_WROTE.ask}: "${(text ?? "").slice(0, 60)}"`, { ask: text ?? "" }, seek0).then(setMakeMsg);
  };

  // the film's languages (cv16): "+ Language" translates every line at once into a version of its own
  const [translating, setTranslating] = useState<{ code: string; since: number } | null>(null);
  const [langMsg, setLangMsg] = useState<string | null>(null);
  const translate = async (code: string) => {
    setTranslating({ code, since: Date.now() }); setLangMsg(null); setView(code); setElSel(null);
    const before = doc;
    try {
      const r = await api.ai<AiAnswer>("translate", { to: code });
      if (!r.ok) { setLangMsg(r.error); return; }
      const v = r.result?.doc?.langs?.[code];
      if (!v) { setLangMsg(r.result?.note || "No translation came back - try again."); return; }
      edit((d) => ({ ...d, langs: { ...d.langs, [code]: v } }));
      changes.record(`Translated into ${languageLabel(code)}`, before, r.result.note || undefined);
      const dropped = r.result.dropped?.length ? `Left out: ${r.result.dropped.join("; ")}.` : "";
      if (dropped || r.result.note) setLangMsg([r.result.note, dropped].filter(Boolean).join(" "));
    } finally {
      setTranslating(null);
    }
  };
  const dropLang = (code: string) => {
    const before = doc;
    edit((d) => dropLanguage(d, code));
    changes.record(`${languageLabel(code)} taken out`, before, undefined, "you");
    setView("");
  };
  const version = inVersion ? doc.langs?.[shownLang] : undefined;
  const missing = inVersion ? untranslated(film, shownLang).length : 0;
  const stale = !!version?.from && version.from !== wordsPrint(film);

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
  const [rows, setRows] = useState<ExportRow[]>([]);
  /** Each language asked for, one after another - its file saved, or why not, in plain words (Try again for those). */
  const exportFilm = async (list: string[]) => {
    setExporting(true); setExportMsg(null);
    const many = languagesOf(film).length > 1;
    const keep = rows.filter((r) => r.state === "done" && !list.includes(r.lang));
    let cur: ExportRow[] = [...keep, ...list.map((lang): ExportRow => ({ lang, state: "waiting" }))];
    const put = (lang: string, p: Partial<ExportRow>) => { cur = cur.map((r) => (r.lang === lang ? { ...r, ...p } : r)); setRows(cur); };
    setRows(cur);
    for (const lang of list) {
      put(lang, { state: "making" });
      const r = await api.act<{ spec: VideoSpec | null; issues: Issue[] }>("export", { format: film.format, lang });
      if (!r.ok) { put(lang, { state: "refused", why: r.error }); continue; }
      if (!r.result.spec) { put(lang, { state: "refused", why: r.result.issues.filter((x) => x.level === "stop").map((x) => x.text).join(" ") || "the film is not ready" }); continue; }
      const name = `${slug(api.data.piece.title)}${many ? `-${lang.toLowerCase()}` : ""}-${film.format.replace(":", "x")}.json`;
      download(name, r.result.spec);
      put(lang, { state: "done", file: name });
    }
    setExporting(false);
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
          <FilmWriteAgain disabled={!api.data.ai || !!busy} busy={false} onRun={writeAgain} />
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
              <MapRow key={s.id} id={`v-${i}`} title={`Scene ${i + 1}`} sub={KIND_INFO[s.kind].label} summary={wordsOf(shown.scenes[i] ?? s) || "Not written yet"}
                state={writing ? "busy" : markOf(s, mine)} busyLabel={makingFilm ? "Writing…" : `${busy?.label ?? "Rewriting"}…`} open={open === i} onToggle={() => toggle(i)}>
                <ScenePanel key={s.id} doc={doc} i={i} issues={mine} edit={edit} disabled={!canEdit} where={where} onShow={() => hold(i)} onRemove={() => remove(i)}
                  words={(k) => wordOf(i, k)} setWord={(k, v) => setWord(i, k, v)} lang={inVersion ? shownLang : null} onAsk={aiOn ? askScene(i) : undefined} />
              </MapRow>
            );
          })}
          <MapRow id="v--1" title="End card" summary={plain(doc.endCard.line) || "Not written yet"} state={makingFilm || busy?.what === "end" ? "busy" : sceneIssues("end").some((x) => x.level === "stop") ? "stop" : plain(doc.endCard.line) ? "written" : "empty"}
            busyLabel={busy?.what === "end" ? `${busy.label}…` : "Writing…"} open={open === -1} onToggle={() => toggle(-1)}>
            <EndPanel doc={doc} issues={sceneIssues("end")} edit={edit} disabled={!canEdit} onShow={() => hold(-1)}
              words={endWordOf} setWord={setEndWord} lang={inVersion ? shownLang : null} onAsk={aiOn ? askScene(-1) : undefined} />
          </MapRow>
        </MapList>
      )}
      <AddScene onAdd={add} disabled={!canEdit || !!busy || doc.scenes.length >= MAX_SCENES} after={onScene ? open : null} />
    </MapPane>
  );

  /* ── the film, with what is selected on it ── */
  const selLabel = elSel && elInfo ? elementName(shown, elSel) : onScene ? sceneName(open!) : open === -1 ? "End card" : null;
  /** The bar's "Ask AI" (page lib barAi.ts): the picked element's own box, else the scene's, else the assistant. */
  const barAsk = () => {
    const target = barAiTarget({ selected: !!elSel || onScene || onEnd, wholeRow: !elSel, popKind: elSel ? (elInfo?.type === "picture" ? "picture" : "text") : null, inRow: onScene || onEnd });
    const box = target === "element" ? document.querySelector<HTMLElement>(`#video-el-pop [${AI_BOX_ATTR}]`)
      : target === "block" ? document.querySelector<HTMLElement>(`[data-row="v-${open}"] [${AI_BOX_ATTR}]`) : null;
    if (box) { box.focus(); box.scrollIntoView({ block: "nearest", behavior: "smooth" }); } else ask.current?.focus();
  };
  const middle = (
    <Pane tone="stage" title={`The film · ${seconds(totalFrames(film))} seconds`} right={
      <SquareChoice<Format> value={film.format} onChange={(f) => canEdit && edit((d) => ({ ...d, format: f }))} options={FORMATS.map((f) => ({ key: f, label: FORMAT_INFO[f].label, disabled: !canEdit }))} />
    }>
      <Box sx={{ height: { xs: "auto", lg: "100%" }, minHeight: { xs: 520, lg: 0 }, display: "flex", flexDirection: "column", gap: 1 }}>
        {hasScenes && (
          <Box sx={{ display: "grid", gap: 0.75, flexShrink: 0 }}>
            <LanguageTabs langs={langs} view={shownLang} onView={(c) => { setView(c); setElSel(null); }} onAdd={(c) => void translate(c)} disabled={!canEdit || !api.data.ai || !!busy} busy={translating} />
            {inVersion && <LanguageBar code={shownLang} missing={missing} stale={stale} disabled={!canEdit || !api.data.ai} busy={!!translating} onTranslate={() => void translate(shownLang)} onDrop={() => dropLang(shownLang)} />}
            {langMsg && <Typography sx={{ fontSize: "0.78rem", color: "#7f4f0b", bgcolor: "#fff8ec", p: 0.75, borderRadius: "6px" }}>{langMsg}</Typography>}
          </Box>
        )}
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
                <Button size="small" onClick={barAsk} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...btn, color: "#f7b6cf", fontSize: "0.74rem", py: 0, px: 0.75, minWidth: 0 }}>Ask AI</Button>
              )}
              <IconButton size="small" onClick={() => { if (elSel) setElSel(null); else setSel(null); }} aria-label={elSel ? "Let go of the element" : "Let go of the scene"} sx={{ color: "rgba(255,255,255,.75)", p: 0.4 }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
            </Box>
          )}
          <Player doc={shown} handle={player} onPick={pick} onOpen={(i) => {
            // the scene showing opens in the map, and its words become fields right on the film
            select(i);
            setElSel(null);
            if (canEdit && (i === -1 || doc.scenes[i])) setOnFilm({ index: i, before: doc });
          }} overlay={!onFilm && elSel && elInfo ? (scale) => (
            // the element picked, outlined on the film - its popup opens beside it
            <Box key={`${elSel.scene}:${elSel.key}`} ref={setPickBox} aria-hidden sx={{ position: "absolute", zIndex: 2, pointerEvents: "none", left: elInfo.box.x * scale - 4, top: elInfo.box.y * scale - 4, width: elInfo.box.w * scale + 8, height: elInfo.box.h * scale + 8,
              border: "2px solid #c22c6e", borderRadius: elInfo.type === "picture" ? "12px" : "6px", boxShadow: "0 0 0 4px rgba(194,44,110,.16)", transition: "all .15s ease-out" }} />
          ) : onFilm ? (scale) => {
            const i = onFilm.index;
            const sc = i >= 0 ? doc.scenes[i] : null;
            const fields = sc
              ? KIND_INFO[sc.kind].fields.map((f) => ({ key: f.key, label: f.label, value: wordOf(i, f.key), words: f.words, red: redOnFilm(sc.kind, f.key), multiline: sc.kind === "quote" && f.key === "line1",
                onChange: (v: string) => setWord(i, f.key, v) }))
              : END_FIELDS.map((f) => ({ key: f.key, label: f.label, value: endWordOf(f.key), words: f.words, red: f.key === "line", onChange: (v: string) => setEndWord(f.key, v) }));
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
            <Strip film={shown} segs={segs} selected={open !== null && open >= -1 ? open : null} playing={playing ? seg.index : null} frame={frame} issues={issues} disabled={!canEdit}
              onSelect={select} onMove={move} onAdd={add} />
          )} />
        </Box>
      </Box>
    </Pane>
  );

  /* ── the element picked: its popup ── */
  const elPop = (() => {
    if (!elSel || !elInfo || onFilm) return null;
    const el = elSel;
    const s = el.scene >= 0 ? doc.scenes[el.scene] : null;
    const name = elementName(shown, el);
    const mv = moveWords(doc, el);
    const isText = elInfo.type === "text";
    const k = el.key as CopyKey;
    const endKey = el.key === "cta" ? "cta" : "line";
    const value = el.scene === -1 ? endWordOf(endKey) : wordOf(el.scene, k);
    const dup = el.scene >= 0 && !inVersion ? duplicateEl(doc, el) : null;
    const picture = !isText && s ? (
      s.kind === "title"
        ? <PartPicker value={s.image ? null : (s.part ?? null)} none columns={3} disabled={!canEdit} onChange={(part) => edit((d) => ({ ...d, scenes: d.scenes.map((x) => (x.id === s.id ? { ...x, part: part ?? undefined, shape: part ? (part === "shaft-seal" ? "seal" : "oring") : "none", image: undefined } : x)) }))} />
        : <Shows s={s} bare disabled={!canEdit} where={where} lang={doc.language} patch={(p) => edit((d) => ({ ...d, scenes: d.scenes.map((x) => (x.id === s.id ? { ...x, ...p } : x)) }))} />
    ) : undefined;
    return (
      <Box>
        <ElementPop anchor={pickBox} name={name} kind={isText ? "text" : "picture"} value={value} words={elInfo.words} lang={inVersion ? shownLang : null}
          placeholder={inVersion ? (el.scene === -1 ? film.endCard[endKey] : film.scenes[el.scene]?.copy[k] ?? "") : undefined}
          red={isText && (el.scene === -1 ? endKey === "line" : !!s && redOnFilm(s.kind, el.key))} multiline={s?.kind === "quote" && el.key === "line1"}
          disabled={!canEdit || !!busy} aiOn={aiOn && !(s?.kind === "quote" && el.key === "line1")}
          onWords={(v) => (el.scene === -1 ? setEndWord(endKey, v) : setWord(el.scene, k, v))}
          onAsk={askLine(el)} picture={picture}
          // the film's structure (a line out, a picture out, a duplicate, a move) is changed in its own language's tab only
          onTakeOut={!inVersion && (isText || s?.image || (s?.kind === "title" && s.part)) ? () => elDo(() => takeOut(doc, el), `${name}: taken out`) : null}
          takeOutLabel={isText ? "Take it out" : s?.image ? (s.kind === "feature" ? "Back to the shop's photo" : "Take the picture out") : "No part"}
          duplicate={dup ? { label: dup.what === "line" ? "Duplicate" : "Duplicate the scene", run: () => elDo(() => duplicateEl(doc, el), `${name}: duplicated`) } : null}
          up={mv.up && !inVersion ? { label: mv.up, run: () => elDo(() => moveEl(doc, el, -1), `${name}: ${mv.up!.toLowerCase()}`) } : null}
          down={mv.down && !inVersion ? { label: mv.down, run: () => elDo(() => moveEl(doc, el, 1), `${name}: ${mv.down!.toLowerCase()}`) } : null}
          onClose={() => setElSel(null)} />
      </Box>
    );
  })();

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
              <ExportView film={film} issues={issues} onBack={() => setStep("map")} onFormat={(f) => canEdit && edit((d) => ({ ...d, format: f }))} onExport={(l) => void exportFilm(l)}
                exporting={exporting} msg={exportMsg} rows={rows} disabled={!canEdit} />
            </Box>
          ) : map}
        </Pane>
      }
      preview={<>{middle}{elPop}</>}
      assist={assistant}
    />
  );
}
