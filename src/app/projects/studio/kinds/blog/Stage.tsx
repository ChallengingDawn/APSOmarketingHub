"use client";
// THE BLOG STUDIO'S PREVIEW (08.11.2026): "The post" as the shop would show it, "The blog's home" with every post of the
// hub (this one as it is being typed, the others as their studios hold them - with their state, which the paste never
// carries), one topic's page, and "Google": the result as Google would list it, and the structured data it reads.
// Built in the browser from the document (pure render.ts): nothing big travels to the hub.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { LIMITS, cardOf, homeCards, topicsOf, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { homeDocument, jsonLd, postDocument, serp } from "@/lib/content/studio/kinds/blog/render";
import { Pane } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Frame, type Device } from "../page/Frame";
import { Choice, mono } from "../page/ui";

export type View = "post" | "home" | "google";

/** The document a moment after the last keystroke - the frame is not rebuilt on every letter. */
function useSettled<T>(v: T, ms = 350): T {
  const [x, setX] = useState(v);
  useEffect(() => { const t = setTimeout(() => setX(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return x;
}

function Google({ d }: { d: BlogDoc }) {
  const s = serp(d);
  const ld = jsonLd(d);
  return (
    <Box sx={{ maxWidth: 680, mx: "auto" }}>
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, boxShadow: "0 18px 50px rgba(31,45,78,.12)", fontFamily: "arial, sans-serif" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: "#f1f3f4", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#5f6368" }}>A</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, color: "#202124", lineHeight: 1.3, fontFamily: "inherit" }}>APSOparts</Typography>
            <Typography sx={{ fontSize: 12, color: "#4d5156", lineHeight: 1.3, fontFamily: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.crumbs}</Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 20, lineHeight: 1.3, color: "#1a0dab", fontFamily: "inherit", mb: 0.5 }}>{s.title || "…"}</Typography>
        <Typography sx={{ fontSize: 14, lineHeight: 1.58, color: "#4d5156", fontFamily: "inherit" }}>{s.description || "…"}</Typography>
      </Box>
      <Box sx={{ mt: 1.5, px: 1 }}>
        <Typography sx={{ fontSize: "0.8rem", color: d.metaTitle.length > LIMITS.metaTitle ? AMBER : MUTED }}>
          Title {(d.metaTitle || d.title).length} / {LIMITS.metaTitle}{s.titleCut ? " - Google cuts it" : ""}{!d.metaTitle ? " (the post's title, no meta title yet)" : ""}
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: s.fromText || d.metaDescription.length > LIMITS.metaDescription ? AMBER : MUTED }}>
          {s.fromText ? "No meta description - Google picks words from the post." : `Description ${d.metaDescription.length} / ${LIMITS.metaDescription}${s.descriptionCut ? " - Google cuts it" : ""}`}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mt: 3, mb: 1, px: 1 }}>
        Structured data · {ld.map((x) => x["@type"]).join(" + ")}
      </Typography>
      <Box component="pre" sx={{ ...mono, m: 0, p: 2, bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: "14px", color: INK, overflow: "auto", maxHeight: 420, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(ld.length === 1 ? ld[0] : ld, null, 2)}
      </Box>
    </Box>
  );
}

export function Stage({ api, d, cards, onRefresh }: { api: StudioApi; d: BlogDoc; cards: BlogCard[] | null; onRefresh: () => void }) {
  const [view, setView] = useState<View>("post");
  const [device, setDevice] = useState<Device>("desktop");
  const [tag, setTag] = useState<string>("");
  const settled = useSettled(d);
  const p = api.data.piece;
  const home = useMemo(() => homeCards(cards ?? [], cardOf(settled, { pieceId: p.id, projectId: p.projectId, status: p.status, due: p.dueDate })), [cards, settled, p.id, p.projectId, p.status, p.dueDate]);
  const topics = useMemo(() => topicsOf(home), [home]);
  const html = useMemo(() => {
    if (view === "post") return postDocument(settled);
    if (view === "home") return homeDocument(home, { store: settled.store, language: settled.language, topics, tag: tag && topics.includes(tag) ? tag : null });
    return "";
  }, [view, settled, home, topics, tag]);

  return (
    <Pane tone="stage" pad={false} title="Preview" right={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Choice value={view} onChange={setView} options={[{ key: "post", label: "The post" }, { key: "home", label: "The blog's home" }, { key: "google", label: "Google" }]} />
        {view !== "google" && <Choice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
        {view === "home" && (
          <Tooltip title="Read the other posts again">
            <IconButton size="small" onClick={onRefresh} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        )}
      </Box>
    }>
      <Box sx={{ p: 3 }}>
        {view === "home" && topics.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <Choice value={tag && topics.includes(tag) ? tag : ""} onChange={setTag} options={[{ key: "", label: "The home" }, ...topics.map((t) => ({ key: t, label: t }))]} />
          </Box>
        )}
        {view === "home" && cards === null && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: MUTED, fontSize: "0.85rem", mb: 2 }}>
            <CircularProgress size={14} /> Reading the other posts…
          </Box>
        )}
        {view === "google" ? <Google d={settled} /> : <Frame html={html} device={device} title={view === "post" ? "The post" : "The blog's home"} />}
      </Box>
    </Pane>
  );
}
