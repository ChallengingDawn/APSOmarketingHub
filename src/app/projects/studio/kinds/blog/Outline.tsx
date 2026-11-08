"use client";
// THE BLOG STUDIO'S OUTLINE (Content v3, 08.11.2026 - SARCLA: "the editing is really not yet fully clear"). The map of the
// post on the left, top to bottom as the page shows it: each part with its state (written, still to do, to look at). A
// click brings the part into view in the preview and picks it - its words are edited there, the assistant works on it.
// Sections are added, moved and removed here. Under the page, what is not on it: what Google shows, the way to the shop
// (Magento), more posts, the team's notes - one opened at a time.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { LIMITS, postPath, slugify, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { moveSection, outlineOf, sectionOf, type PartState } from "@/lib/content/studio/kinds/blog/parts";
import { serp } from "@/lib/content/studio/kinds/blog/render";
import { Field, PINK, Pane } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Publish } from "./Publish";
import { BLUE, toolBtn } from "./ui";

const DOT: Record<PartState, string> = { done: "#1b7a55", todo: "#c3ccd1", warn: AMBER };

/** Where a picked part shows in the outline: its row's key (a section's parts all show on its row). */
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

type Around = "google" | "publish" | "notes" | null;

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

export function Outline({ api, d, set, sel, onPick, onAddSection, cards }: {
  api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; sel: string | null; onPick: (key: string) => void;
  onAddSection: () => void; cards: BlogCard[] | null;
}) {
  const canEdit = api.data.access.canEdit;
  const [around, setAround] = useState<Around>(null);
  const rows = outlineOf(d);
  const on = rowOf(sel);
  const n = d.sections.length;
  const meta = `Title ${(d.metaTitle || d.title).length}/${LIMITS.metaTitle} · description ${d.metaDescription ? `${d.metaDescription.length}/${LIMITS.metaDescription}` : "none yet"}`;
  const AROUND: { key: Exclude<Around, null>; label: string; short: string; detail: string }[] = [
    { key: "google", label: "What Google shows", short: "Google", detail: meta },
    { key: "publish", label: "Publish on the shop", short: "Publish", detail: "The pages for Magento, and more posts" },
    { key: "notes", label: "Notes for the team", short: "Notes", detail: d.notes.trim() ? d.notes.trim().slice(0, 60) : "No notes yet" },
  ];

  return (
    <Pane title="Outline" pad={false}>
      <Box sx={{ p: 1.25 }}>
        {rows.map((r) => {
          const isSec = !!r.section;
          const i = isSec ? d.sections.findIndex((s) => s.id === r.section) : -1;
          const active = on === r.key;
          return (
            <Box key={r.key}>
              <Box role="button" tabIndex={0} onClick={() => onPick(r.key)} onKeyDown={(e) => { if (e.key === "Enter") onPick(r.key); }}
                sx={{
                  display: "flex", alignItems: "flex-start", gap: 1, pl: isSec ? 2.25 : 1, pr: 0.5, py: 0.75, borderRadius: "6px", cursor: "pointer", position: "relative",
                  bgcolor: active ? "rgba(36,89,209,.08)" : "transparent", "&:hover": { bgcolor: active ? "rgba(36,89,209,.1)" : "rgba(21,34,58,.04)" },
                  "&:hover .tools": { opacity: 1, pointerEvents: "auto" }, "&:focus-visible": { outline: `2px solid ${BLUE}` },
                }}>
                {isSec
                  ? <Typography sx={{ width: 16, flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, color: active ? BLUE : MUTED, mt: "2px", fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
                  : null}
                <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: DOT[r.state], flexShrink: 0, mt: "6px" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: active ? 700 : 600, color: active ? BLUE : INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: isSec ? 1 : 2, WebkitBoxOrient: "vertical" }}>{r.label}</Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: r.state === "warn" ? AMBER : MUTED, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.detail}</Typography>
                </Box>
                {isSec && canEdit && (
                  <Box className="tools" onClick={(e) => e.stopPropagation()} sx={{ position: "absolute", right: 4, top: 4, display: "flex", borderRadius: "6px", bgcolor: "#fff", boxShadow: "0 1px 4px rgba(31,45,78,.14)", opacity: 0, transition: "opacity .12s", pointerEvents: "none" }}>
                    <Tooltip title="Up"><span><IconButton size="small" disabled={i === 0} onClick={() => set(moveSection(d, r.section!, -1))} aria-label="Move the section up"><ArrowUpwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Down"><span><IconButton size="small" disabled={i === n - 1} onClick={() => set(moveSection(d, r.section!, 1))} aria-label="Move the section down"><ArrowDownwardIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Remove the section">
                      <IconButton size="small" aria-label="Remove the section"
                        onClick={() => { if (window.confirm(`Remove section ${i + 1}${d.sections[i]?.heading ? ` "${d.sections[i].heading}"` : ""}? Undo is in Versions.`)) set({ ...d, sections: d.sections.filter((s) => s.id !== r.section) }); }}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              {/* a new section goes after the last one */}
              {isSec && i === n - 1 && canEdit && (
                <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={onAddSection} sx={{ ...toolBtn, border: "none", color: BLUE, ml: 2.5, my: 0.25, "&:hover": { bgcolor: "rgba(36,89,209,.06)", color: BLUE } }}>Add a section</Button>
              )}
              {r.key === "hero" && n === 0 && canEdit && (
                <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={onAddSection} sx={{ ...toolBtn, border: "none", color: BLUE, ml: 1.5, my: 0.25, "&:hover": { bgcolor: "rgba(36,89,209,.06)", color: BLUE } }}>Add a section</Button>
              )}
            </Box>
          );
        })}
      </Box>

      {/* what is not on the page, at the foot of the column however long the post: one opened at a time, above its row */}
      <Box sx={{ position: "sticky", bottom: 0, zIndex: 2, borderTop: `1px solid ${HAIRLINE}`, px: 1.25, pt: 0.75, pb: 1, bgcolor: "rgba(250,251,252,.97)", backdropFilter: "blur(6px)" }}>
        {around && (
          <Box sx={{ px: 0.5, pt: 0.75, pb: 1.25, maxHeight: "58vh", overflowY: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Typography sx={{ flex: 1, fontSize: "0.9rem", fontWeight: 700, color: INK }}>{AROUND.find((a) => a.key === around)?.label}</Typography>
              <IconButton size="small" aria-label="Close" onClick={() => setAround(null)}><KeyboardArrowDownIcon sx={{ fontSize: 18 }} /></IconButton>
            </Box>
            {around === "google" && <Google api={api} d={d} set={set} canEdit={canEdit} />}
            {around === "publish" && <Publish api={api} d={d} cards={cards} />}
            {around === "notes" && <Field label="For the team" value={d.notes} multiline rows={3} disabled={!canEdit} onChange={(v) => set({ ...d, notes: v })} />}
          </Box>
        )}
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, px: 0.5, pb: 0.5 }}>Around the post</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.5 }}>
          {AROUND.map((a) => {
            const isOn = around === a.key;
            return (
              <Tooltip key={a.key} title={a.detail} describeChild>
                <Box component="button" type="button" onClick={() => setAround(isOn ? null : a.key)} sx={{
                  all: "unset", cursor: "pointer", boxSizing: "border-box", textAlign: "center", py: 0.75, px: 0.5, borderRadius: "4px", fontSize: "0.78rem", fontWeight: 600,
                  border: `1px solid ${isOn ? BLUE : HAIRLINE}`, bgcolor: isOn ? BLUE : "#fff", color: isOn ? "#fff" : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  "&:hover": isOn ? {} : { borderColor: BLUE, color: BLUE }, "&:focus-visible": { outline: `2px solid ${BLUE}`, outlineOffset: 1 },
                }}>{a.short}</Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Pane>
  );
}
