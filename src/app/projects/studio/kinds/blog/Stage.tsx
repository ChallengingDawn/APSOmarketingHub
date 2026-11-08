"use client";
// THE BLOG STUDIO'S PREVIEW (08.11.2026; Content v2 the same day - SARCLA: "The blog is just ridiculous on the site").
//   The post        as the shop shows it: in the shop's header and footer, with more posts under it
//   The blog's home every blog to-do of the hub this person can see (this project's and the others'), the one being
//                   written as it is typed, each with its state on its card; a free place in the grid marked as a slot
//   Google          the result as Google lists it, and the structured data it reads
// Built in the browser from the document (pure render.ts): nothing big travels to the hub.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { LIMITS, cardOf, homeCards, relatedCards, topicsOf, type BlogCard, type BlogDoc } from "@/lib/content/studio/kinds/blog/model";
import { homeDocument, jsonLd, postDocument, serp } from "@/lib/content/studio/kinds/blog/render";
import { Pane } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Frame, mono, useSettled, type Device } from "./ui";

export type View = "post" | "home" | "google";

function Google({ d }: { d: BlogDoc }) {
  const s = serp(d);
  const ld = jsonLd(d);
  return (
    <Box sx={{ maxWidth: 680, mx: "auto" }}>
      <Box sx={{ bgcolor: "#fff", borderRadius: "8px", p: 3, boxShadow: "0 18px 50px rgba(31,45,78,.12)", fontFamily: "arial, sans-serif" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.75 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: "#f1f3f4", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#d80901" }}>A</Box>
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
      <Box component="pre" sx={{ ...mono, m: 0, p: 2, bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: "8px", color: INK, overflow: "auto", maxHeight: 420, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(ld.length === 1 ? ld[0] : ld, null, 2)}
      </Box>
    </Box>
  );
}

export function Stage({ api, d, cards, onRefresh, view, onView }: { api: StudioApi; d: BlogDoc; cards: BlogCard[] | null; onRefresh: () => void; view: View; onView: (v: View) => void }) {
  const [device, setDevice] = useState<Device>("desktop");
  const [tag, setTag] = useState<string>("");
  const settled = useSettled(d);
  const p = api.data.piece;
  const current = useMemo(() => cardOf(settled, { pieceId: p.id, projectId: p.projectId, status: p.status, due: p.dueDate }), [settled, p.id, p.projectId, p.status, p.dueDate]);
  const home = useMemo(() => homeCards(cards ?? [], current), [cards, current]);
  const topics = useMemo(() => topicsOf(home), [home]);
  const html = useMemo(() => {
    if (view === "post") return postDocument(settled, { related: relatedCards(home, current), withState: true });
    if (view === "home") return homeDocument(home, { store: settled.store, language: settled.language, topics, tag: tag && topics.includes(tag) ? tag : null, withState: true, currentId: p.id });
    return "";
  }, [view, settled, home, current, topics, tag, p.id]);
  const others = home.filter((c) => c.pieceId !== p.id).length;

  return (
    <Pane tone="stage" pad={false} title="Preview" right={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "nowrap" }}>
        <SquareChoice value={view} onChange={onView} options={[{ key: "post", label: "The post" }, { key: "home", label: "The blog's home", count: home.length }, { key: "google", label: "Google" }]} />
        {view !== "google" && <SquareChoice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />}
        <Tooltip title="Read the other posts again">
          <IconButton size="small" onClick={onRefresh} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
      </Box>
    }>
      <Box sx={{ p: 3 }}>
        {view === "home" && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
              {cards === null ? <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}><CircularProgress size={12} /> Reading the hub&apos;s blog posts…</Box>
                : `This post and ${others} other blog post${others === 1 ? "" : "s"} of the hub in ${settled.store}, each with its state - the shop only ever gets the approved and live ones.`}
            </Typography>
            {topics.length > 0 && <SquareChoice label="Page" value={tag && topics.includes(tag) ? tag : ""} onChange={setTag} options={[{ key: "", label: "The home" }, ...topics.map((t) => ({ key: t, label: t }))]} />}
          </Box>
        )}
        {view === "google" ? <Google d={settled} /> : <Frame html={html} device={device} title={view === "post" ? "The post" : "The blog's home"} />}
      </Box>
    </Pane>
  );
}
