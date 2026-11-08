"use client";
// THE PAGES (08.11.2026): a carousel's pages under the board, small pictures of each in the format on screen. Click one
// to work on it; add a page, duplicate it, move it, take it out. One page is a single picture post.

import { useState } from "react";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import { DesignThumb } from "@/app/editor/designRender";
import { MAX_PAGES, clonePage, insertPage, movePage, pageIn, pageId, removePage, sizeOf } from "@/lib/content/studio/kinds/social/design";
import { templateByKey } from "@/lib/content/studio/kinds/social/templates";
import { T } from "./look";
import { templatePage } from "./actions";
import type { StudioCtx } from "./Studio";

const H = 52;

export default function PageStrip({ ctx }: { ctx: StudioCtx }) {
  const d = ctx.doc.design;
  const [menu, setMenu] = useState<{ el: HTMLElement; i: number } | null>(null);
  const s = sizeOf(ctx.fmt, d);
  const w = Math.max(30, Math.round((H * s.w) / s.h));
  const add = () => {
    const t = templateByKey("slide")!;
    const at = ctx.pageIx + 1;
    ctx.set((x) => ({ ...x, design: insertPage(x.design, at, { id: pageId(), by: templatePage(x.design, t, { ...t.words, number: String(at + 1).padStart(2, "0") }, ctx.mf) }) }));
    ctx.goPage(at);
  };
  const act = (fn: () => void) => { setMenu(null); fn(); };
  return (
    <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 82, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 4 }}>
      <Box sx={{
        pointerEvents: "auto", display: "flex", alignItems: "center", gap: 0.75, p: 0.75, pl: 1.25, maxWidth: "calc(100% - 48px)", overflowX: "auto",
        bgcolor: "rgba(255,255,255,.9)", backdropFilter: "blur(10px)", borderRadius: "12px", border: `1px solid ${T.line}`, boxShadow: "0 6px 20px -10px rgba(16,24,40,.25)",
      }}>
        <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: T.ink3, whiteSpace: "nowrap", mr: 0.5, fontVariantNumeric: "tabular-nums" }}>
          {d.pages.length > 1 ? `Page ${ctx.pageIx + 1} / ${d.pages.length}` : "1 page"}
        </Typography>
        {d.pages.map((p, i) => {
          const on = i === ctx.pageIx;
          return (
            <Box key={p.id} sx={{ position: "relative", flexShrink: 0, "&:hover .more": { opacity: 1 } }}>
              <Tooltip title={`Page ${i + 1}`} enterDelay={500}>
                <Box component="button" type="button" aria-label={`Page ${i + 1}`} aria-current={on} onClick={() => ctx.goPage(i)}
                  onContextMenu={(e) => { e.preventDefault(); setMenu({ el: e.currentTarget, i }); }}
                  sx={{ all: "unset", cursor: "pointer", display: "block", borderRadius: "6px", boxShadow: on ? `0 0 0 2px ${T.accent}` : `0 0 0 1px ${T.line}`, "&:hover": { boxShadow: on ? `0 0 0 2px ${T.accent}` : `0 0 0 1px ${T.line2}` }, "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 } }}>
                  <DesignThumb doc={on && ctx.live ? ctx.live : pageIn(d, p, ctx.fmt)} width={w} radius={6} />
                </Box>
              </Tooltip>
              {ctx.canEdit && (
                <Box component="button" type="button" className="more" aria-label={`Page ${i + 1}: more`} onClick={(e) => setMenu({ el: e.currentTarget, i })} sx={{
                  all: "unset", cursor: "pointer", position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "5px", display: "grid", placeItems: "center",
                  bgcolor: "rgba(255,255,255,.95)", boxShadow: "0 1px 3px rgba(0,0,0,.2)", opacity: 0, transition: "opacity .12s", "& svg": { fontSize: 14, color: T.ink2 },
                }}><MoreVertIcon /></Box>
              )}
            </Box>
          );
        })}
        {ctx.canEdit && d.pages.length < MAX_PAGES && (
          <Tooltip title="Add a page (a carousel)">
            <Box component="button" type="button" aria-label="Add a page" onClick={add} sx={{
              all: "unset", cursor: "pointer", flexShrink: 0, width: w, height: H, borderRadius: "6px", display: "grid", placeItems: "center", color: T.ink2,
              border: `1.5px dashed ${T.line2}`, boxSizing: "border-box", "&:hover": { color: T.accent, borderColor: T.accent, bgcolor: T.accentSoft },
            }}><AddIcon sx={{ fontSize: 20 }} /></Box>
          </Tooltip>
        )}
      </Box>
      <Menu anchorEl={menu?.el ?? null} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "10px", minWidth: 190 } } }}>
        <MenuItem onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: insertPage(x.design, i + 1, clonePage(x.design.pages[i])) })); ctx.goPage(i + 1); })}>Duplicate</MenuItem>
        <MenuItem disabled={!menu || menu.i === 0} onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: movePage(x.design, i, i - 1) })); ctx.goPage(i - 1); })}>Move left</MenuItem>
        <MenuItem disabled={!menu || menu.i >= d.pages.length - 1} onClick={() => act(() => { const i = menu!.i; ctx.set((x) => ({ ...x, design: movePage(x.design, i, i + 1) })); ctx.goPage(i + 1); })}>Move right</MenuItem>
        <MenuItem disabled={d.pages.length < 2} onClick={() => act(() => {
          const i = menu!.i;
          ctx.set((x) => ({ ...x, design: removePage(x.design, i) }));
          ctx.goPage(Math.max(0, i <= ctx.pageIx ? ctx.pageIx - 1 : ctx.pageIx));
          ctx.reload();
        })} sx={{ color: "#b42318" }}>Delete the page</MenuItem>
      </Menu>
    </Box>
  );
}
