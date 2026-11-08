"use client";
// THE BANNER STUDIO (08.11.2026; SARCLA: "banners - like the newsletter banner the other session made"; then: "the banner
// can be in multiple places", "we should be able to push it inside a page visually as well").
// Build on the left (where it goes, its words, its picture, its background), the banner itself in the middle (every
// place side by side, one place live with its own words, checks and files, or inside a page of the project), and on the
// right "Put it in a page" and the assistant. The banner is drawn by the same code that writes the paste block and the
// PNGs (lib/content/studio/kinds/banner/render.ts), so the preview is the thing itself.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { normalizeBanner, type BannerDoc } from "@/lib/content/studio/kinds/banner/model";
import { prefixFor } from "@/lib/content/studio/kinds/banner/render";
import { Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import BuildPane from "./BuildPane";
import { BannerAssistant } from "./Output";
import { PutInPage, usePages } from "./Place";
import Stage, { type View } from "./Preview";
import { useBrandFontState } from "./ui";

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => normalizeBanner(api.doc), [api.doc]);
  const { setDoc } = api;
  const set = useCallback((fn: (d: BannerDoc) => BannerDoc) => setDoc((cur: unknown) => fn(normalizeBanner(cur))), [setDoc]);
  const [view, setView] = useState<View>("all");
  const [pageId, setPageId] = useState<number | null>(null);
  // the brand's type is never waited on: drawn at once in its look-alike stack, swapped in when it comes
  const brandFont = useBrandFontState();
  const font = brandFont.css;
  const piece = api.data.piece;
  const prefix = prefixFor(piece.id);
  const canEdit = api.data.access.canEdit;
  const pages = usePages(piece.id);
  const showPage = (id: number) => { setPageId(id); setView("pages"); };

  return (
    <StudioPanes id="banner" buildWidth={380} assistWidth={340}
      build={(
        <Pane title="Build">
          <BuildPane doc={doc} set={set} canEdit={canEdit} onAdded={(k) => setView(k)} projectId={piece.projectId} pieceId={piece.id} me={api.data.me} />
        </Pane>
      )}
      preview={(
        <Stage doc={doc} set={set} prefix={prefix} view={view} setView={setView} font={font} fontFailed={brandFont.state === "failed"} title={piece.title} canEdit={canEdit}
          pages={pages} pageId={pageId} setPageId={setPageId} saved={api.save === "saved"} pieceId={piece.id} projectId={piece.projectId} />
      )}
      assist={(
        <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ flex: "0 1 auto", minHeight: 0, maxHeight: { lg: "60%" }, display: "flex", flexDirection: "column" }}>
            <PutInPage api={api} doc={doc} set={set} pages={pages} onShow={showPage} />
          </Box>
          <Box sx={{ flex: "1 1 0", minHeight: { xs: 360, lg: 0 } }}>
            <BannerAssistant api={api} doc={doc} set={set} />
          </Box>
        </Box>
      )}
    />
  );
}
