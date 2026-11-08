"use client";
// PHOTOS (SARCLA 08.11.2026: "a new one on the side bar: the gallery of photos that I've generated"). The pictures you
// made or uploaded, this project's, and the shop's own technology photos. A click puts one on the page (into the
// selected frame); drag one onto the board to drop it where you let go.

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { SHOP_PHOTOS } from "@/lib/content/studio/kinds/banner/brand";
import { shopPhoto } from "@/lib/content/studio/kinds/social/templates";
import { PictureGrid, usePictures, type Picture } from "../../../pictures";
import { Note, PanelFrame, T } from "../look";
import { backgroundPicture, frameOf, placePicture } from "../actions";
import type { StudioCtx } from "../Studio";

type Scope = "mine" | "project" | "shop";

export default function PhotosPanel({ ctx }: { ctx: StudioCtx }) {
  const [scope, setScope] = useState<Scope>("mine");
  const mine = usePictures("mine");
  const project = usePictures("project", ctx.api.data.piece.projectId);
  const frame = frameOf(ctx);
  const shift = useRef(false);
  const pick = (p: { url: string; width?: number | null; height?: number | null }, bg = false) => {
    if (!ctx.canEdit) return;
    if (bg) backgroundPicture(ctx, p.url);
    else void placePicture(ctx, p);
  };
  const shop: Picture[] = SHOP_PHOTOS.map((p, i) => ({ id: -1 - i, kind: "upload", url: shopPhoto(p.key), width: null, height: null, name: p.label.EN, prompt: p.label.EN, projectId: null, by: null, at: "" }));
  const list = scope === "mine" ? mine.pictures : scope === "project" ? project.pictures : shop;
  return (
    <PanelFrame title="Photos">
      <SquareChoice value={scope} onChange={setScope} options={[
        { key: "mine", label: "Mine", count: mine.pictures?.length },
        { key: "project", label: "This project", count: project.pictures?.length },
        { key: "shop", label: "The shop's" },
      ]} />
      <Note sx={{ mt: 1.25, mb: 1.5 }}>
        {frame ? "A click puts it into the selected frame." : "A click puts it on the page; drag it onto the board to drop it where you want."} Shift-click: as the background.
      </Note>
      <Box onClickCapture={(e) => { shift.current = e.shiftKey; }}>
        <PictureGrid pictures={list} columns={2} me={ctx.api.data.me}
          onPick={(p) => pick(p, shift.current)}
          empty={scope === "mine" ? "The pictures you make or upload come here - make one in Pictures." : "No picture in this project yet."} />
      </Box>
      {scope === "mine" && (mine.pictures?.length ?? 0) > 0 && <Typography sx={{ mt: 1.5, fontSize: "0.74rem", color: T.ink3 }}>Newest first. Pictures are kept in the hub, by their address.</Typography>}
    </PanelFrame>
  );
}
