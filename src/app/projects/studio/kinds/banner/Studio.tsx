"use client";
// THE BANNER STUDIO (08.11.2026; Content v3 - SARCLA tonight: "banner also" - the editing "very confusing", like the
// newsletter's; this morning: "the banner can be in multiple places", "we should be able to push it inside a page
// visually"). The way a banner is made, start to finish:
//   1. The banner is in the middle at its real size, in the place it is for (the shop's home band first).
//   2. The row on top: its places (squared choices) - a click shows it there; "+ Place" adds one; "In a page" puts it
//      into a page to-do of the project and shows it inside that page; "All places" side by side.
//   3. A click on a part of the banner - the headline, the small line, the line, the button, the picture, its label,
//      the background - opens that part's card right there; words count against the place's room and can be the
//      banner's everywhere or this place's own.
//   4. The assistant (right) works on the part that is open ("Shorter", "Another one", your words) or on every word.
//   5. "Get it": the paste block for Magento or the PNG of the place shown; every picture at once.
// The build column of fields is gone: everything is changed on the banner itself. The banner is drawn by the same code
// that writes the paste block and the PNGs (lib/content/studio/kinds/banner/render.ts), so the stage is the thing.

import { useCallback, useMemo, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { LANGUAGES } from "@/lib/content/languages";
import { normalizeBanner, sizesOf, type BannerDoc } from "@/lib/content/studio/kinds/banner/model";
import { prefixFor, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import { StudioPanes, field } from "../../parts";
import type { StudioProps } from "../../registry";
import { BannerAssistant } from "./Output";
import { usePages } from "./Place";
import Stage, { type View } from "./Preview";
import { useBrandFontState } from "./ui";

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => normalizeBanner(api.doc), [api.doc]);
  const { setDoc } = api;
  const set = useCallback((fn: (d: BannerDoc) => BannerDoc) => setDoc((cur: unknown) => fn(normalizeBanner(cur))), [setDoc]);
  // the first place the banner is used in, at its real size - not an overview
  const [view, setView] = useState<View>(() => sizesOf(doc)[0]);
  const [pageId, setPageId] = useState<number | null>(null);
  const [pick, setPick] = useState<PickPart | null>(null);
  // the brand's type is never waited on: drawn at once in its look-alike stack, swapped in when it comes
  const brandFont = useBrandFontState();
  const piece = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const pages = usePages(piece.id);

  const language = (
    <TextField select size="small" value={LANGUAGES.some((l) => l.code === doc.language) ? doc.language : "EN"} disabled={!canEdit} aria-label="Language"
      onChange={(e) => set((d) => ({ ...d, language: e.target.value }))}
      sx={{ ...field, width: 74, "& .MuiInputBase-root": { borderRadius: "6px", fontSize: "0.8rem", bgcolor: "#fff" }, "& .MuiSelect-select": { py: "5px" } }}
      slotProps={{ select: { renderValue: (v) => String(v) } }}>
      {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
    </TextField>
  );

  return (
    <StudioPanes id="banner3" hideBuild buildWidth={300} assistWidth={320}
      build={null}
      preview={(
        <Stage doc={doc} set={set} prefix={prefixFor(piece.id)} view={view} setView={setView} font={brandFont.css} fontFailed={brandFont.state === "failed"} title={piece.title} canEdit={canEdit}
          pages={pages} pageId={pageId} setPageId={(id) => { setPageId(id); setView("pages"); }} saved={api.save === "saved"} pieceId={piece.id} projectId={piece.projectId} me={api.data.me}
          api={api} pick={pick} setPick={setPick} language={language} />
      )}
      assist={<BannerAssistant api={api} doc={doc} set={set} pick={pick} setPick={setPick} />}
    />
  );
}
