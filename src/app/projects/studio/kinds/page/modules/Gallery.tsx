"use client";
// THE GALLERY OF MODULES (Content v6, SARCLA 09.11.2026 point 7: "a gallery of forms like bentos and much more"). What
// "+ Add an element" and "Replace it with a module" open: each module of the home page kit as a picture of itself - a
// real render by the hub's own renderer with the shop's data (public/content/modules/<type>.webp, made by the static
// harness from src/lib/content/studio/kinds/page/modules/render.ts), never an icon. A click puts it on the page.

import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { MODULE_KINDS, type ModuleType } from "@/lib/content/studio/kinds/page/modules/model";
import { PINK } from "../../../parts";
import type { ModulesCtl } from "./useModules";

/** The order the gallery shows them in: the big product modules first, then the words. */
const ORDER: ModuleType[] = ["finder", "bento", "mosaic", "cards", "row", "banner", "usp", "textpic", "faq", "cta"];
const TAKES: Record<string, string> = { products: "Fills with products", categories: "Fills with categories", none: "Words and a picture" };

export function ModuleGallery({ ctl }: { ctl: ModulesCtl }) {
  const a = ctl.gallery;
  const replacing = a?.how === "replace";
  return (
    <Dialog open={!!a} onClose={ctl.closeGallery} maxWidth={false}
      slotProps={{ paper: { sx: { width: 1040, maxWidth: "calc(100vw - 48px)", maxHeight: "calc(100vh - 64px)", borderRadius: "12px", boxShadow: "0 24px 70px rgba(21,34,58,.28)" } } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 3, pt: 2.5, pb: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
            {replacing ? "Replace this element with a module" : "Add a module here"}
          </Typography>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, mt: 0.25 }}>The home page kit&apos;s modules</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {replacing ? "The element is hidden (kept - taking the module out brings it back) and the module stands in its place." : a?.label ? `After: ${a.label}` : "Each one is filled with the shop's own products, photos and links."}
          </Typography>
        </Box>
        <IconButton size="small" onClick={ctl.closeGallery} aria-label="Close"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ overflowY: "auto", p: 2.5, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 1.5, bgcolor: "#f6f7f9" }}>
        {ORDER.map((t) => MODULE_KINDS.find((k) => k.type === t)!).map((k) => (
          <Box key={k.type} component="button" type="button" data-module={k.type} onClick={() => ctl.pick(k.type)} sx={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden",
            bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, transition: "border-color .12s, box-shadow .15s, transform .15s",
            "&:hover": { borderColor: PINK, boxShadow: "0 12px 28px -14px rgba(21,34,58,.35)", transform: "translateY(-1px)" },
            "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 2 },
          }}>
            <Box sx={{ position: "relative", aspectRatio: "16 / 9", bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center", overflow: "hidden", px: 1 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/content/modules/${k.type}.webp`} alt={`${k.name}, as it looks on the shop`} loading="lazy"
                style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </Box>
            <Box sx={{ p: 1.25, pt: 1 }}>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>{k.name}</Typography>
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: MUTED, whiteSpace: "nowrap", border: `1px solid ${HAIRLINE}`, borderRadius: "4px", px: 0.6, py: 0.1 }}>{TAKES[k.takes]}</Typography>
              </Box>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4, mt: 0.25 }}>{k.note}</Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "#8a95a3", mt: 0.5 }}>From the {k.from}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}
