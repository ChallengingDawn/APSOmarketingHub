"use client";
// THE WAY INTO THE GALLERY FROM THE BUILD PANE (Content v6, SARCLA 09.11.2026 points 7 and 9: "add new modules and replace
// the old one", "we should really be able to add elements"). On a page of the shop:
//   nothing selected   "+ Add a module" (at the top of the page's own content) and the modules already on the page, each
//                      with "Edit" - the "+" between the elements in the page (builder A) opens the same gallery
//   an element         "Add a module after it" and "Replace it with a module" (the element hidden, kept: taking the
//                      module out brings it back)
//   inside a module    "Edit this module"

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TuneIcon from "@mui/icons-material/Tune";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { MAIN_SELECTOR, isLive, type PageDoc } from "@/lib/content/studio/kinds/page/model";
import { kindOf, moduleOfChange } from "@/lib/content/studio/kinds/page/modules/model";
import { PINK, btn } from "../../../parts";
import type { Picked } from "../Frame";
import type { ModulesCtl } from "./useModules";

/** Elements a module can stand beside or in place of - a block of the page, not a word inside one. */
const BLOCK_TAGS = /^(div|section|article|aside|header|footer|main|nav|p|h[1-6]|ul|ol|figure|table|form|blockquote|details|img|picture|a)$/i;

export function ModuleActions({ ctl, d, picked }: { ctl: ModulesCtl; d: PageDoc; picked: Picked | null }) {
  if (!ctl.canEdit || d.source === "new") return null;
  const mods = d.changes.map((c, i) => ({ c, i, m: moduleOfChange(c) })).filter((x) => x.m && x.c.id);
  const inside = picked?.frag ? mods.find((x) => x.i === picked.frag!.change) : null;
  const sx = { ...btn, px: 1, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "#fff", "&:hover": { borderColor: PINK, bgcolor: "rgba(194,44,110,.04)" } };

  if (picked) {
    if (inside) {
      return (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.25 }}>
          <Button size="small" startIcon={<TuneIcon sx={{ fontSize: 16 }} />} onClick={() => ctl.edit(inside.c.id!)} sx={sx}>Edit this {kindOf(inside.m!.type).name.toLowerCase()}</Button>
        </Box>
      );
    }
    if (!BLOCK_TAGS.test(picked.tag)) return null;
    const label = `<${picked.tag}> ${picked.text.slice(0, 50)}`;
    return (
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.25 }}>
        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => ctl.openGallery({ how: "insert", selector: picked.selector, where: "after", label })} sx={sx}>Add a module after it</Button>
        <Button size="small" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />} onClick={() => ctl.openGallery({ how: "replace", selector: picked.selector, label })} sx={sx}>Replace it with a module</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 1.5, p: 1.25, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "rgba(255,255,255,.7)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DashboardCustomizeOutlinedIcon sx={{ fontSize: 18, color: PINK }} />
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 700, color: INK, flex: 1 }}>Modules</Typography>
        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => ctl.openGallery({ how: "insert", selector: MAIN_SELECTOR, where: "prepend", label: "the top of the page's content" })} sx={sx}>Add a module</Button>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5, lineHeight: 1.4 }}>
        Bentos, rows of products, mosaics, banners - the home page kit&apos;s. Click an element of the page to put one after it or in its place.
      </Typography>
      {mods.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {mods.map((x) => (
            <Box key={x.c.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: isLive(x.c) ? "#1e7d4f" : "#a96a12", flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.8rem", color: INK, flex: 1, minWidth: 0 }} noWrap>
                {kindOf(x.m!.type).name}{x.m!.settings.title ? ` · ${x.m!.settings.title}` : ""}{x.c.op === "replace" ? " (in place of an element)" : ""}
              </Typography>
              <Button size="small" onClick={() => ctl.edit(x.c.id!)} sx={{ ...btn, px: 0.75, minWidth: 0, color: PINK }}>Edit</Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
