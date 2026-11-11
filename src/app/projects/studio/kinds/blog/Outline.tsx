"use client";
// THE BLOG STUDIO'S MAP (Content v3, 08.11.2026 - SARCLA: "the editing is really not yet fully clear"; Content v4, 09.11.2026:
// the flow standard of all six studios). The left of the studio, top to bottom as the page shows it:
//   start       nothing written yet: "What are you making?" (its language), ONE pink "Write the whole post with AI", or
//               open a part and write it yourself; once written, "Write it all again" in the header
//   the parts   each with its state (written ●, empty ○, picture missing ▣, being written: it shimmers), its name, one line
//               of what it holds, a chevron. A click picks the part in the page (and scrolls there) and opens ITS fields
//               under its row - one open at a time. Sections are added, moved and removed here.
//   around it   what is not on the page: what Google shows, notes for the team - opened under their row like a part
//   last step   pinned at the foot: "LAST STEP · Publish" opens its own view here, "<- The post" goes back
// cv16 (11.11.2026): "Write it all again" is the Page builder's own choice (../page/WriteAgain.tsx: From the topic /
// Directly / Ask / Start again); the last step tells the studio it is open (`onStep`) - the build column becomes the wide
// publishing view, the assistant a rail.
// cv17 (12.11.2026): the map is the language open (each language a tab over the page); the last step lists every
// language's pages (`whole`, each language's record put back with `setIn`).

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { LIMITS, postPath, postWarnings, slugify, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { moveSection, outlineOf, sectionOf, type PartState } from "@/lib/content/studio/kinds/blog/parts";
import { serp } from "@/lib/content/studio/kinds/blog/render";
import { Field, PINK, Pane, btn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Publish } from "./Publish";
import type { WriteMode } from "../page/WriteAgain";
import { WriteAgainPost } from "./WriteAgain";
import { BLUE, toolBtn, useFitHeight } from "./ui";

/** Where a picked part shows in the map: its row's key (a section's parts all show on its row). */
export function rowOf(key: string | null): string | null {
  if (!key) return null;
  const s = sectionOf(key);
  if (s) return `s:${s}:h`;
  if (key === "lead") return "title";
  if (key.startsWith("hero")) return "hero";
  if (key.startsWith("cta")) return "cta";
  if (key.startsWith("faq")) return "faq";
  if (key.startsWith("prod")) return "prods";
  return key;
}

/** A part's state, as every studio's map shows it: written ●, empty ○, a picture missing ▣, being written (it shimmers). */
export function StateMark({ state, picture, busy }: { state: PartState; picture?: boolean; busy?: boolean }) {
  const size = 9;
  if (busy) {
    return <Box aria-label="Being written" sx={{
      width: size + 1, height: size + 1, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(110deg, ${PINK}, #f3b5cf, ${PINK})`, backgroundSize: "200% 100%",
      animation: "xmark 1s linear infinite", "@keyframes xmark": { "0%": { backgroundPosition: "100% 0", opacity: 0.6 }, "50%": { opacity: 1 }, "100%": { backgroundPosition: "-100% 0", opacity: 0.6 } },
    }} />;
  }
  const color = state === "done" ? "#1b7a55" : state === "warn" ? AMBER : "#9aa5ad";
  if (picture && state !== "done") return <Box aria-label="Picture missing" sx={{ width: size, height: size, flexShrink: 0, borderRadius: "2px", border: `1.5px solid ${color}`, boxShadow: `inset 0 0 0 1.5px #fff, inset 0 0 0 3px ${color}` }} />;
  return <Box aria-label={state === "done" ? "Written" : state === "warn" ? "To look at" : "Empty"} sx={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", ...(state === "todo" ? { border: `1.5px solid ${color}` } : { bgcolor: color }) }} />;
}

function Google({ api, d, set, canEdit }: { api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; canEdit: boolean }) {
  const s = serp(d);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const write = async () => {
    setBusy(true); setErr(null);
    const r = await api.ai<{ metaTitle: string; metaDescription: string; excerpt: string; slug: string }>("meta");
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    set({ ...d, metaTitle: r.result.metaTitle, metaDescription: r.result.metaDescription, ...(!d.slug || d.slug === slugify(d.title) ? { slug: r.result.slug || d.slug } : {}) });
  };
  return (
    <Box>
      <Box sx={{ p: 1.5, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", fontFamily: "arial, sans-serif", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: "#4d5156", fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.crumbs}</Typography>
        <Typography sx={{ fontSize: 17, lineHeight: 1.3, color: "#1a0dab", fontFamily: "inherit", my: 0.25 }}>{s.title || "…"}</Typography>
        <Typography sx={{ fontSize: 13, lineHeight: 1.5, color: "#4d5156", fontFamily: "inherit" }}>{s.description || "…"}</Typography>
      </Box>
      <Field label="Its address" value={d.slug} disabled={!canEdit} helper={`apsoparts.com${postPath(d)}`} onChange={(v) => set({ ...d, slug: slugify(v) || v.toLowerCase() })} />
      <Field label="Title on Google" value={d.metaTitle} max={LIMITS.metaTitle} disabled={!canEdit} placeholder={d.title} onChange={(v) => set({ ...d, metaTitle: v })} />
      <Field label="Description on Google" value={d.metaDescription} max={LIMITS.metaDescription} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, metaDescription: v })} />
      {canEdit && api.data.ai && (
        <Button size="small" onClick={() => void write()} disabled={busy} startIcon={busy ? <CircularProgress size={12} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 15, color: PINK }} />} sx={toolBtn}>
          {d.metaTitle || d.metaDescription ? "Write them again" : "Write them with the assistant"}
        </Button>
      )}
      {err && <Typography sx={{ fontSize: "0.78rem", color: "#c5221f", mt: 0.75 }}>{err}</Typography>}
    </Box>
  );
}

const Kick = ({ children }: { children: React.ReactNode }) => (
  <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, px: 1, pt: 1.5, pb: 0.5 }}>{children}</Typography>
);

/** A row of the map: its mark, its name, one line of what it holds, a chevron; its fields open under it. */
function Row({ active, onClick, mark, num, label, detail, warn, tools, children, indent = false }: {
  active: boolean; onClick: () => void; mark: React.ReactNode; num?: number; label: string; detail: string; warn?: boolean; tools?: React.ReactNode; children?: React.ReactNode; indent?: boolean;
}) {
  return (
    <Box>
      <Box role="button" tabIndex={0} aria-expanded={active} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
        sx={{
          display: "flex", alignItems: "center", gap: 1, pl: indent ? 2.25 : 1, pr: 0.5, py: 0.75, borderRadius: "6px", cursor: "pointer", position: "relative",
          bgcolor: active ? "rgba(194,44,110,.07)" : "transparent", "&:hover": { bgcolor: active ? "rgba(194,44,110,.09)" : "rgba(21,34,58,.04)" },
          "&:hover .tools": { opacity: 1, pointerEvents: "auto" }, "&:focus-visible": { outline: `2px solid ${PINK}` },
        }}>
        {num !== undefined && <Typography sx={{ width: 14, flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: active ? PINK : MUTED, fontVariantNumeric: "tabular-nums" }}>{num}</Typography>}
        {mark}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: active ? 700 : 600, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: warn ? AMBER : MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</Typography>
        </Box>
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: active ? PINK : "#a7b0bb", flexShrink: 0, transform: active ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
        {tools}
      </Box>
      <Collapse in={active && !!children} timeout={200} unmountOnExit>
        <Box sx={{ ml: indent ? 2.25 : 0.5, mr: 0.25, mt: 0.5, mb: 1.25, p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export function Outline({ api, d, set, whole, setIn, sel, onPick, onAddSection, cards, fields, start, onWriteAll, busy, onStep }: {
  api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; sel: string | null; onPick: (key: string | null) => void;
  /** the whole post, every language (cv17) - the last step lists each language's pages; none: the post open only */
  whole?: BlogDoc;
  /** one language's post changed (its record of the shop) */
  setIn?: (lang: string, fn: (cur: BlogDoc) => BlogDoc) => void;
  onAddSection: () => void; cards: BlogCard[] | null;
  /** the picked part's own fields (its picture, its topics, where its button goes...) - under its row */
  fields?: React.ReactNode;
  /** the start card, while nothing is written */
  start?: React.ReactNode;
  /** "Write it all again" in the header, once something is written - its way (and the person's words for "Ask") */
  onWriteAll?: (mode: WriteMode, request?: string) => void;
  /** the row being written by the assistant ("all": the whole post) */
  busy?: string | null;
  /** the last step opened or closed (the studio makes it the wide publishing view) */
  onStep?: (step: "map" | "publish") => void;
}) {
  const canEdit = api.data.access.canEdit;
  const [around, setAround] = useState<"google" | "notes" | null>(null);
  const [step, setStep] = useState<"map" | "publish">("map");
  useEffect(() => { onStep?.(step); }, [step, onStep]);
  // the map scrolls inside the left pane and the last step stands at its foot, at any height
  const fit = useFitHeight(14, step);
  const rows = outlineOf(d);
  const on = rowOf(sel);
  const busyRow = busy === "all" ? "all" : rowOf(busy ?? null);
  const n = d.sections.length;
  const meta = `Title ${(d.metaTitle || d.title).length}/${LIMITS.metaTitle} · description ${d.metaDescription ? `${d.metaDescription.length}/${LIMITS.metaDescription}` : "none yet"}`;
  const warnings = postWarnings(d);

  /* ── the last step, as its own view ── */
  if (step === "publish") {
    return (
      <Pane title="Build" pad={false}>
        <Box sx={{ p: 2 }}>
          <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 17 }} />} onClick={() => setStep("map")} sx={{ ...btn, color: INK, px: 0.5, ml: -0.5, mb: 1.25 }}>The post</Button>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: PINK }}>Last step</Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, mb: 1.5, letterSpacing: "-0.01em" }}>Publish on the shop</Typography>
          <Publish api={api} d={d} whole={whole ?? d} setIn={setIn ?? ((_l, fn) => set(fn(d)))} cards={cards} />
        </Box>
      </Pane>
    );
  }

  return (
    <Pane title="Build" pad={false} right={onWriteAll ? (
      <WriteAgainPost label="Write it all again" disabled={busy !== null && busy !== undefined} busy={busy === "all"} onRun={onWriteAll} />
    ) : undefined}>
      <Box ref={fit.ref} sx={{ height: fit.height ?? "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Box sx={{ p: 1.25 }}>
        {start}
        {rows.map((r) => {
          const isSec = !!r.section;
          const i = isSec ? d.sections.findIndex((s) => s.id === r.section) : -1;
          const active = on === r.key;
          return (
            <Box key={r.key}>
              <Row active={active} onClick={() => onPick(active ? null : r.key)} indent={isSec} num={isSec ? i + 1 : undefined}
                mark={<StateMark state={r.state} picture={r.key === "hero"} busy={busyRow === "all" || busyRow === r.key} />}
                label={r.label} detail={r.detail} warn={r.state === "warn"}
                tools={isSec && canEdit ? (
                  <Box className="tools" onClick={(e) => e.stopPropagation()} sx={{ position: "absolute", right: 26, top: 4, display: "flex", borderRadius: "6px", bgcolor: "#fff", boxShadow: "0 1px 4px rgba(31,45,78,.14)", opacity: 0, transition: "opacity .12s", pointerEvents: "none" }}>
                    <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => set(moveSection(d, r.section!, -1))} aria-label="Move the section up"><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Down"><span><IconButton size="small" disabled={i === n - 1} onClick={() => set(moveSection(d, r.section!, 1))} aria-label="Move the section down"><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Remove the section">
                      <IconButton size="small" aria-label="Remove the section"
                        onClick={() => { if (window.confirm(`Remove section ${i + 1}${d.sections[i]?.heading ? ` "${d.sections[i].heading}"` : ""}? Undo is in Versions.`)) set({ ...d, sections: d.sections.filter((s) => s.id !== r.section) }); }}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : undefined}>
                {active ? fields : null}
              </Row>
              {/* a new section goes after the last one */}
              {((isSec && i === n - 1) || (r.key === "hero" && n === 0)) && canEdit && (
                <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={onAddSection} sx={{ ...toolBtn, border: "none", color: BLUE, ml: isSec ? 2.5 : 1.5, my: 0.25, "&:hover": { bgcolor: "rgba(36,89,209,.06)", color: BLUE } }}>Add a section</Button>
              )}
            </Box>
          );
        })}

        <Kick>Around the post</Kick>
        <Row active={around === "google"} onClick={() => setAround((a) => (a === "google" ? null : "google"))} mark={<StateMark state={d.metaTitle && d.metaDescription ? "done" : "todo"} />}
          label="What Google shows" detail={meta}>
          <Google api={api} d={d} set={set} canEdit={canEdit} />
        </Row>
        <Row active={around === "notes"} onClick={() => setAround((a) => (a === "notes" ? null : "notes"))} mark={<StateMark state={d.notes.trim() ? "done" : "todo"} />}
          label="Notes for the team" detail={d.notes.trim() ? d.notes.trim().slice(0, 60) : "No notes yet"}>
          <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, notes: v })} />
        </Row>
      </Box>
      </Box>

      {/* the last step, always in view at the foot of the column */}
      <Box sx={{ flexShrink: 0, px: 1.5, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.94)" }}>
        <Typography sx={{ fontSize: "0.74rem", color: warnings.length ? AMBER : MUTED, mb: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {!n ? "Nothing written yet" : warnings.length ? `${warnings.length} thing${warnings.length === 1 ? "" : "s"} to look at before it goes live` : "Ready for the shop"}
        </Typography>
        <Button fullWidth variant="contained" disableElevation onClick={() => setStep("publish")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
          sx={{ ...btn, height: 40, borderRadius: "8px", bgcolor: "#15223a", color: "#fff", justifyContent: "space-between", px: 1.75, "&:hover": { bgcolor: "#24344f" } }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
            <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Last step</Box>
            Publish
          </Box>
        </Button>
      </Box>
      </Box>
    </Pane>
  );
}
