"use client";
// EXPORT (08.11.2026, fixed that day; night of 09.11 moved from the canvas's bar to the foot of the map, beside the last
// step - flow standard §5): this page as PNG or JPG, every page, the carousel as a PDF, every format.

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { FORMATS, formatLabel } from "@/lib/content/studio/kinds/social/design";
import { formatsInUse } from "@/lib/content/studio/kinds/social/model";
import { T } from "./look";
import { fileStem } from "./actions";
import { exportEverything, exportPages, exportPdf } from "./exportDesign";
import type { StudioCtx } from "./Studio";

function ExportLine({ title, sub }: { title: string; sub: string }) {
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: T.ink }}>{title}</Typography>
      <Typography sx={{ fontSize: "0.74rem", color: T.ink3 }}>{sub}</Typography>
    </Box>
  );
}

export default function ExportMenu({ ctx }: { ctx: StudioCtx }) {
  const d = ctx.doc.design;
  const [exp, setExp] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const stem = fileStem(ctx.api.data.piece.title);
  const pages = d.pages.length;
  const everyFormat = [...new Set([...d.formats, ...formatsInUse(ctx.doc)])];
  const run = async (tag: string, fn: () => Promise<string | null>) => {
    setBusy(tag); setNote(null); setExp(null);
    try { setNote(await fn()); } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  return (
    <Box>
      <Box component="button" type="button" onClick={(e) => setExp(e.currentTarget)} disabled={!!busy} sx={{
        all: "unset", boxSizing: "border-box", cursor: busy ? "default" : "pointer", width: "100%", height: 36, borderRadius: "8px", border: `1px solid ${T.line2}`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontSize: "0.84rem", fontWeight: 650, color: T.ink, whiteSpace: "nowrap",
        "&:hover": { bgcolor: T.hover }, "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: 2 }, "& svg": { fontSize: 18 },
      }}>
        {busy ? <CircularProgress size={15} color="inherit" /> : <FileDownloadOutlinedIcon />}
        {busy ? "Exporting…" : "Export · PNG, JPG, PDF"}
        {!busy && <KeyboardArrowUpIcon sx={{ color: T.ink3 }} />}
      </Box>
      {note && <Typography sx={{ mt: 0.5, fontSize: "0.76rem", color: T.ink2 }}>{note}</Typography>}
      <Menu anchorEl={exp} open={!!exp} onClose={() => setExp(null)} anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 300, borderRadius: "12px", mb: 0.5, boxShadow: T.shadow } } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: "0.72rem", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em" }}>{formatLabel(ctx.fmt, d)}</Typography>
        <MenuItem onClick={() => run("png", async () => (await exportPages(d, ctx.fmt, stem, "image/png", ctx.pageIx)) ? null : "Not exported - a picture did not load.")}>
          <ExportLine title="This page · PNG" sub="Sharp, for every network" />
        </MenuItem>
        <MenuItem onClick={() => run("jpg", async () => (await exportPages(d, ctx.fmt, stem, "image/jpeg", ctx.pageIx)) ? null : "Not exported - a picture did not load.")}>
          <ExportLine title="This page · JPG" sub="Lighter, for a mail" />
        </MenuItem>
        {pages > 1 && (
          <MenuItem onClick={() => run("all", async () => `${await exportPages(d, ctx.fmt, stem)} pictures saved.`)}>
            <ExportLine title={`Every page · PNG (${pages})`} sub="One picture per page - an Instagram carousel" />
          </MenuItem>
        )}
        {pages > 1 && (
          <MenuItem onClick={() => run("pdf", async () => ((await exportPdf(d, ctx.fmt, stem)) ? null : "The PDF could not be made."))}>
            <ExportLine title="The carousel · PDF" sub="LinkedIn shows a carousel as a document" />
          </MenuItem>
        )}
        {everyFormat.length > 1 && <Divider />}
        {everyFormat.length > 1 && (
          <MenuItem onClick={() => run("every", async () => `${await exportEverything(d, everyFormat, stem)} pictures saved.`)}>
            <ExportLine title={`Every format · PNG (${everyFormat.length})`} sub={everyFormat.map((f) => (f === "custom" ? "custom" : FORMATS[f].label.toLowerCase())).join(", ")} />
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
