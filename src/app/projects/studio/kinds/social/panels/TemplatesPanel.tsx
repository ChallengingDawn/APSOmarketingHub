"use client";
// TEMPLATES (SARCLA 08.11.2026: "Brand templates: take them out completely, these are PA, not ours. Improve the
// templates a lot"). Our own layouts only, each drawn here as it will look on this post's board - a click puts it on the
// page (in every format of the post, each built for its board), Ctrl+Z takes it back; "+ page" adds it as a new page.

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import { DesignThumb } from "@/app/editor/designRender";
import { FORMATS, insertPage, pageId, sizeOf } from "@/lib/content/studio/kinds/social/design";
import { TEMPLATES, type Template } from "@/lib/content/studio/kinds/social/templates";
import { Head, Note, PanelFrame, T } from "../look";
import { applyTemplate, templatePage } from "../actions";
import type { StudioCtx } from "../Studio";

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Single posts", keys: ["spotlight", "new", "stat", "quote", "fact", "statement", "photo", "poster"] },
  { title: "Carousels", keys: ["cover", "slide", "tip", "checklist", "compare"] },
  { title: "News", keys: ["event", "hiring"] },
];

export default function TemplatesPanel({ ctx }: { ctx: StudioCtx }) {
  const size = sizeOf(ctx.fmt, ctx.doc.design);
  const built = useMemo(() => new Map<string, ReturnType<Template["build"]>>(TEMPLATES.map((t) => [t.key, t.build(size, undefined, ctx.mf)])), [size.w, size.h, ctx.mf]); // eslint-disable-line react-hooks/exhaustive-deps
  const colW = 146;
  const addPage = (t: Template) => {
    const at = ctx.pageIx + 1;
    ctx.set((x) => ({ ...x, design: insertPage(x.design, at, { id: pageId(), by: templatePage(x.design, t, undefined, ctx.mf) }) }));
    ctx.goPage(at);
  };
  return (
    <PanelFrame title="Templates">
      <Note>Our layouts, drawn for this {ctx.fmt === "custom" ? "custom" : FORMATS[ctx.fmt].label.toLowerCase()} board. A click puts one on the page - its words are yours to change.</Note>
      {GROUPS.map((g) => (
        <Box key={g.title}>
          <Head>{g.title}</Head>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
            {g.keys.map((k) => {
              const t = TEMPLATES.find((x) => x.key === k);
              const doc = built.get(k);
              if (!t || !doc) return null;
              return (
                <Box key={k} sx={{ position: "relative", "&:hover .addp": { opacity: 1 } }}>
                  <Tooltip title={t.note} placement="top" enterDelay={500}>
                    <Box component="button" type="button" disabled={!ctx.canEdit} onClick={() => applyTemplate(ctx, t)} sx={{
                      all: "unset", cursor: ctx.canEdit ? "pointer" : "default", display: "block", width: "100%", boxSizing: "border-box",
                      "&:hover .thumb": { boxShadow: "0 0 0 2px #fff, 0 0 0 4px rgba(194,44,110,.55), 0 10px 24px -10px rgba(16,24,40,.4)" },
                      "&:focus-visible .thumb": { outline: `2px solid ${T.focus}`, outlineOffset: 2 },
                    }}>
                      <Box className="thumb" sx={{ borderRadius: "8px", overflow: "hidden", boxShadow: `0 0 0 1px ${T.line}`, transition: "box-shadow .15s", bgcolor: T.sunken, display: "flex", justifyContent: "center" }}>
                        <DesignThumb doc={doc} width={colW} radius={0} />
                      </Box>
                      <Typography sx={{ mt: 0.6, fontSize: "0.78rem", fontWeight: 600, color: T.ink }}>{t.name}</Typography>
                    </Box>
                  </Tooltip>
                  {ctx.canEdit && (
                    <Tooltip title="Add it as a new page after this one">
                      <Box component="button" type="button" className="addp" onClick={() => addPage(t)} aria-label={`Add ${t.name} as a new page`} sx={{
                        all: "unset", cursor: "pointer", position: "absolute", top: 6, right: 6, opacity: 0, transition: "opacity .12s",
                        display: "inline-flex", alignItems: "center", gap: 0.25, px: 0.75, py: 0.3, borderRadius: "6px", bgcolor: "rgba(255,255,255,.95)",
                        boxShadow: "0 2px 8px rgba(0,0,0,.18)", fontSize: "0.72rem", fontWeight: 700, color: T.ink, "& svg": { fontSize: 14 },
                      }}><AddIcon />page</Box>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </PanelFrame>
  );
}
