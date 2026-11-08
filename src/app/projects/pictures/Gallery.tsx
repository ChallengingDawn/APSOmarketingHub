"use client";
// THE HUB'S PICTURES, ALL IN ONE PLACE (08.11.2026): the same panel the studios use, the whole page wide. A click shows
// the picture big, with what it was made from and its address to copy.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import { GlassCard, MUTED } from "@/app/uc/report/ui";
import { PicturePanel, type Picture } from "../studio/pictures";

export default function Gallery() {
  const [open, setOpen] = useState<Picture | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <GlassCard>
      <PicturePanel tabs={["mine", "all", "logos", "make", "upload"]} start="mine" columns={6} onPick={(p) => { setCopied(false); setOpen(p); }} />
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
        {open && (
          <DialogContent sx={{ display: "grid", gap: 1.5 }}>
            <Box component="img" src={open.url} alt={open.prompt ?? open.name ?? "picture"} sx={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px", bgcolor: "#eef1f6" }} />
            <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
              {open.kind === "generated" ? "Made from: " : open.kind === "logo" ? "Logo · " : "Uploaded · "}{open.prompt ?? open.name ?? ""}
              {open.width ? ` · ${open.width} × ${open.height} px` : ""} · {new Date(open.at).toLocaleDateString("en-GB")}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px" }}
                onClick={async () => { await navigator.clipboard.writeText(new URL(open.url, window.location.origin).toString()).catch(() => undefined); setCopied(true); }}>
                {copied ? "Address copied" : "Copy its address"}
              </Button>
              <Button component="a" href={open.url} download sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px" }}>Download</Button>
            </Box>
          </DialogContent>
        )}
      </Dialog>
    </GlassCard>
  );
}
