"use client";
// THE SOCIAL STUDIO (08.11.2026; SARCLA: "social media - improve a lot what we have today").
// Build on the left (where it goes, its text per network, hashtags, its photo / card / carousel, link, day), the post
// in the middle as each feed shows it, ready-to-post and the assistant on the right. Nothing is posted from the hub.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { enabled, normalizeSocial, type Network, type SocialDoc } from "@/lib/content/studio/kinds/social/model";
import { slidePrefix } from "@/lib/content/studio/kinds/social/slides";
import { Pane, StudioPanes } from "../../parts";
import type { StudioProps } from "../../registry";
import { useBrandFont } from "../banner/ui";
import BuildPane from "./BuildPane";
import FeedPreview from "./FeedPreview";
import { ReadyCard, useSocialAi } from "./Ready";

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => normalizeSocial(api.doc), [api.doc]);
  const { setDoc } = api;
  const set = useCallback((fn: (d: SocialDoc) => SocialDoc) => setDoc((cur: unknown) => fn(normalizeSocial(cur))), [setDoc]);
  const [picked, setPicked] = useState<Network>("linkedin");
  const [slide, setSlide] = useState(0);
  const font = useBrandFont();
  const nets = enabled(doc);
  // one network looked at, in the text and in the feed alike
  const net = nets.includes(picked) ? picked : nets[0];
  const prefix = slidePrefix(api.data.piece.id);
  const canEdit = api.data.access.canEdit;
  const ai = useSocialAi({ api, doc, set, net, setSlide });

  return (
    <StudioPanes buildWidth={420} assistWidth={350}
      build={(
        <Pane title="Build">
          <BuildPane doc={doc} set={set} canEdit={canEdit} textNet={net} setTextNet={setPicked} slide={slide} setSlide={setSlide}
            adapt={api.data.ai ? ai.adapt : null} adapting={ai.adapting} />
        </Pane>
      )}
      preview={<FeedPreview doc={doc} net={net} setNet={setPicked} slide={slide} setSlide={setSlide} prefix={prefix} font={font} />}
      assist={(
        <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ flex: "0 1 auto", minHeight: 0, maxHeight: { lg: "60%" }, display: "flex", flexDirection: "column" }}>
            <ReadyCard doc={doc} title={api.data.piece.title} prefix={prefix} font={font} slide={slide} />
          </Box>
          <Box sx={{ flex: "1 1 0", minHeight: { xs: 360, lg: 0 } }}>{ai.panel}</Box>
        </Box>
      )}
    />
  );
}
