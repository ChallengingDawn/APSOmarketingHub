"use client";
// THE BANNER STUDIO (08.11.2026 Content v3; 09.11.2026 the studio flow standard - SARCLA: "banner also": the editing
// "very confusing"; "the features are there, but the editing and the flow is not logical yet"). Start to finish:
//   1. Empty: the start card on the left - "What are you making?": where it is for, then ONE pink "Write the whole
//      banner with AI" (or open a part and write it yourself).
//   2. The banner is in the middle at its real size, in the place chosen; Desktop / Phone and the language top right.
//   3. The left is its map: the banner's parts (headline, small line, line, button, picture, label, background) with
//      their state and words, then its places. A click on a part - in the map or on the banner - selects it (pink
//      outline, "<Part> · Ask AI · ×" under it) and opens its fields under its row; a place's row shows it in the middle.
//   4. The assistant (right) works on the part selected ("Shorter", "Another one", "Three other headlines", your words)
//      or on every word; a part's ask changes that part only, and shows on the banner at once. "Changes made here" lists
//      each change with Undo.
//   5. LAST STEP, pinned at the foot of the map (Content v7, SARCLA 10.11.2026 point 11): "Put it on a page" - a page of the
//      shop and a place on it; the page's Page builder to-do gets the banner as a module, shown in the middle - and "or
//      get the pictures and the paste block" (the PNGs, the paste block for Magento).
//   Since Content v7 a banner starts from a DESIGN - the shop's own best banners (./Design.tsx) - and its picture can be any
//   of the shop's products (the picture panel's Products source).
// The banner is drawn by the same code that writes the paste block and the PNGs (lib/content/studio/kinds/banner/
// render.ts), so the stage is the thing.

import { useCallback, useMemo, useRef, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { LANGUAGES } from "@/lib/content/languages";
import { normalizeBanner, sizesOf, type BannerDoc } from "@/lib/content/studio/kinds/banner/model";
import { prefixFor, type PickPart } from "@/lib/content/studio/kinds/banner/render";
import { Pane, StudioPanes, field } from "../../parts";
import type { StudioProps } from "../../registry";
import BannerMap from "./Map";
import { BannerAssistant, useBannerAi, usePng } from "./Output";
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
  const [pick, setPickState] = useState<PickPart | null>(null);
  // a part opened from the map takes the cursor into its words; one selected on the banner does not (a double-click
  // there types right on the banner)
  const [focusLeft, setFocusLeft] = useState(true);
  const pickFromMap = useCallback((p: PickPart | null) => { setFocusLeft(true); setPickState(p); }, []);
  const pickOnBanner = useCallback((p: PickPart | null) => { setFocusLeft(false); setPickState(p); }, []);
  // the brand's type is never waited on: drawn at once in its look-alike stack, swapped in when it comes
  const brandFont = useBrandFontState();
  const piece = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const pages = usePages(piece.id);
  const prefix = prefixFor(piece.id);
  const ai = useBannerAi(api, doc, set);
  const png = usePng(doc, prefix, piece.title, brandFont.css);
  const ask = useRef<HTMLTextAreaElement | null>(null);

  const language = (
    <TextField select size="small" value={LANGUAGES.some((l) => l.code === doc.language) ? doc.language : "EN"} disabled={!canEdit} aria-label="Language"
      onChange={(e) => set((d) => ({ ...d, language: e.target.value }))}
      sx={{ ...field, width: 74, "& .MuiInputBase-root": { borderRadius: "6px", fontSize: "0.8rem", bgcolor: "#fff" }, "& .MuiSelect-select": { py: "5px" } }}
      slotProps={{ select: { renderValue: (v) => String(v) } }}>
      {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
    </TextField>
  );

  return (
    <StudioPanes id="banner4" buildWidth={360} assistWidth={320}
      build={(
        <Pane pad={false} title="Build">
          <BannerMap api={api} doc={doc} set={set} view={view} setView={setView} pick={pick} setPick={pickFromMap} pages={pages} ai={ai} png={png} prefix={prefix} title={piece.title} focusLeft={focusLeft}
            font={brandFont.css} showPage={(id) => { setPageId(id); setView("pages"); }} />
        </Pane>
      )}
      preview={(
        <Stage doc={doc} set={set} prefix={prefix} view={view} setView={setView} font={brandFont.css} fontFailed={brandFont.state === "failed"} title={piece.title} canEdit={canEdit}
          pages={pages} pageId={pageId} setPageId={(id) => { setPageId(id); setView("pages"); }} saved={api.save === "saved"} pieceId={piece.id} projectId={piece.projectId} me={api.data.me}
          api={api} pick={pick} setPick={pickOnBanner} language={language} busy={ai.busy} onAskAi={() => ask.current?.focus()} png={png} onTyped={ai.note} />
      )}
      assist={<BannerAssistant api={api} doc={doc} ai={ai} pick={pick} setPick={pickFromMap} inputRef={ask} />}
    />
  );
}
