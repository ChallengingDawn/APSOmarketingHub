"use client";
// THE BANNER STUDIO (08.11.2026; SARCLA: "banners - like the newsletter banner the other session made").
// Build on the left (sizes, words, picture, background), the banner itself in the middle (live, as pasted, or every size
// side by side), what it gives and the assistant on the right. The banner is drawn by the same code that writes the paste
// block and the PNGs (lib/content/studio/kinds/banner/render.ts), so the preview is the thing itself.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { normalizeBanner, sizesOf, type BannerDoc, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { prefixFor } from "@/lib/content/studio/kinds/banner/render";
import { Pane, StudioPanes, type Device } from "../../parts";
import type { StudioProps } from "../../registry";
import BuildPane from "./BuildPane";
import { BannerAssistant, OutputCard } from "./Output";
import Preview, { type View } from "./Preview";
import { useBrandFont } from "./ui";

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => normalizeBanner(api.doc), [api.doc]);
  const { setDoc } = api;
  const set = useCallback((fn: (d: BannerDoc) => BannerDoc) => setDoc((cur: unknown) => fn(normalizeBanner(cur))), [setDoc]);
  const [picked, setPicked] = useState<PresetKey | null>(null);
  const [view, setView] = useState<View>("one");
  const [device, setDevice] = useState<Device>("desktop");
  const font = useBrandFont();
  // the size looked at: the one picked while it is still made, else the main one
  const active = picked && sizesOf(doc).includes(picked) ? picked : doc.format;
  const prefix = prefixFor(api.data.piece.id);
  const title = api.data.piece.title;
  const canEdit = api.data.access.canEdit;

  return (
    <StudioPanes buildWidth={400} assistWidth={350}
      build={<Pane title="Build"><BuildPane doc={doc} set={set} active={active} setActive={(k) => { setPicked(k); setView("one"); }} canEdit={canEdit} /></Pane>}
      preview={<Preview doc={doc} prefix={prefix} active={active} setActive={setPicked} font={font} view={view} setView={setView} device={device} setDevice={setDevice} title={title} />}
      assist={(
        <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ flex: "0 1 auto", minHeight: 0, maxHeight: { lg: "58%" }, display: "flex", flexDirection: "column" }}>
            <OutputCard doc={doc} active={active} prefix={prefix} title={title} font={font} />
          </Box>
          <Box sx={{ flex: "1 1 0", minHeight: { xs: 360, lg: 0 } }}>
            <BannerAssistant api={api} doc={doc} set={set} />
          </Box>
        </Box>
      )}
    />
  );
}
