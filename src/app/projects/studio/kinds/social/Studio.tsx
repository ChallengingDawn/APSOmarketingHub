"use client";
// THE SOCIAL STUDIO: ONE DESIGN CANVAS (SARCLA 08.11.2026, on the LinkedIn post: "the window needs to be movable", "this
// top bar needs to be completely reworked", "improve text tiles", "on picture frames you should be able to upload a photo
// or generate one", "Brand should have the logo visible like a gallery", "Size, colour and background should be much more
// complete", "Brand templates: take them out completely", "the gallery of photos that I've generated", "on the side bar
// you should have Publish", "improve the AI window a lot ... just put it on the canvas", "improve the canvas design page").
//
// The canvas in the middle is the hub's Konva editor (src/app/editor/EditorCanvas.tsx), with its own bars switched off:
//   left    a rail of panels, one open at a time - Templates, Text, Pictures, Photos, Brand, Size & colour, Publish
//   top     a minimal bar: undo, redo, the format, zoom, Export, and a "…" for the rare things
//   middle  the board on a calm dotted stage; the pages of a carousel under it; the AI's prompt box at the bottom
//   right   the selected object's properties (the editor's own sections), docked - or floating, dragged by its handle
// Every change saves itself (api.setDoc, small ops); pictures are kept by their address, never their bytes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeMosaicOutlinedIcon from "@mui/icons-material/AutoAwesomeMosaicOutlined";
import TitleIcon from "@mui/icons-material/Title";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import AspectRatioOutlinedIcon from "@mui/icons-material/AspectRatioOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CloseIcon from "@mui/icons-material/Close";

import type { CanvasApi } from "@/app/editor/EditorCanvas";
import { FUTURA_STACK } from "@/app/editor/richKonva";
import { whenFontsReady } from "@/app/editor/designRender";
import type { DesignDocument } from "@/lib/design-document";
import { canonicalDesign } from "@/lib/design-document";
import { listItems } from "@/lib/content/studio/kinds/social/slides";
import { normalizeSocial, slidesOf, type Slide, type SocialDoc } from "@/lib/content/studio/kinds/social/model";
import {
  PALETTE, insertPage, isInlinePicture, pageIn, setPageDoc, withFormat, type FormatKey, type SocialDesign,
} from "@/lib/content/studio/kinds/social/design";
import { templateByKey, type MeasureFor, type Words } from "@/lib/content/studio/kinds/social/templates";
import { placePicture, templatePage } from "./actions";
import { STUDIO_BAR } from "../../parts";
import { uploadPicture } from "../../pictures";
import type { StudioProps } from "../../registry";
import { BAR_H, RAIL_W, T } from "./look";
import CanvasBar from "./CanvasBar";
import Inspector from "./Inspector";
import AiBar from "./AiBar";
import PageStrip from "./PageStrip";
import TemplatesPanel from "./panels/TemplatesPanel";
import TextPanel from "./panels/TextPanel";
import PicturesPanel from "./panels/PicturesPanel";
import PhotosPanel from "./panels/PhotosPanel";
import BrandPanel from "./panels/BrandPanel";
import SizePanel from "./panels/SizePanel";
import PublishPanel from "./panels/PublishPanel";

const EditorCanvas = dynamic(() => import("@/app/editor/EditorCanvas"), { ssr: false, loading: () => null });

export type PanelKey = "templates" | "text" | "pictures" | "photos" | "brand" | "size" | "publish";
const PANELS: { key: PanelKey; label: string; icon: React.ReactNode; width: number }[] = [
  { key: "templates", label: "Templates", icon: <AutoAwesomeMosaicOutlinedIcon />, width: 344 },
  { key: "text", label: "Text", icon: <TitleIcon />, width: 344 },
  { key: "pictures", label: "Pictures", icon: <AddPhotoAlternateOutlinedIcon />, width: 344 },
  { key: "photos", label: "Photos", icon: <PhotoLibraryOutlinedIcon />, width: 344 },
  { key: "brand", label: "Brand", icon: <WorkspacePremiumOutlinedIcon />, width: 344 },
  { key: "size", label: "Size & colour", icon: <AspectRatioOutlinedIcon />, width: 344 },
  { key: "publish", label: "Publish", icon: <SendOutlinedIcon />, width: 460 },
];

/** The brand font's real measure, once the font is in (the templates lay their words out with it). */
function useMeasureFor(): MeasureFor | null {
  const [mf, setMf] = useState<MeasureFor | null>(null);
  useEffect(() => {
    let live = true;
    void whenFontsReady().then(() => {
      if (!live) return;
      const c = document.createElement("canvas").getContext("2d");
      setMf(() => (size: number, weight: number) => (s: string) => {
        if (!c) return s.length * size * 0.55;
        c.font = `${weight} ${size}px ${FUTURA_STACK}`;
        return c.measureText(s).width;
      });
    });
    return () => { live = false; };
  }, []);
  return mf;
}

/** An old post's slide (the studio before the canvas) as a template page. */
function slideWords(s: Slide): { key: string; words: Words } {
  if (s.layout === "cover") return { key: "cover", words: { eyebrow: s.eyebrow, headline: s.headline, cta: "Swipe" } };
  if (s.layout === "list") return { key: "tip", words: { eyebrow: s.eyebrow, headline: s.headline, items: listItems(s.text) } };
  if (s.layout === "photo") return { key: "photo", words: { eyebrow: s.eyebrow, headline: s.headline, body: s.text } };
  return { key: "statement", words: { headline: s.headline, body: s.text } };
}


/** What a page's document may keep: never a picture's bytes (a data: picture is left out until it is kept). */
function storable(d: DesignDocument): DesignDocument {
  return {
    ...d,
    background: isInlinePicture(d.background.src) ? { ...d.background, src: null } : d.background,
    nodes: d.nodes.filter((n) => !(n.kind === "image" && isInlinePicture(n.src))),
  };
}

export type StudioCtx = {
  api: StudioProps["api"];
  doc: SocialDoc;
  set: (fn: (d: SocialDoc) => SocialDoc) => void;
  canvas: React.MutableRefObject<CanvasApi | null>;
  mf: MeasureFor;
  fmt: FormatKey;
  goFormat: (f: FormatKey, custom?: { w: number; h: number }) => void;
  pageIx: number;
  goPage: (i: number) => void;
  /** The pages changed outside the canvas: the canvas reads its page again. */
  reload: () => void;
  /** The live document on the canvas. */
  live: DesignDocument | null;
  selection: string[];
  openPanel: (p: PanelKey | null) => void;
  canEdit: boolean;
};

export default function Studio({ api }: StudioProps) {
  const doc = useMemo(() => normalizeSocial(api.doc), [api.doc]);
  const { setDoc } = api;
  const set = useCallback((fn: (d: SocialDoc) => SocialDoc) => setDoc((cur: unknown) => fn(normalizeSocial(cur))), [setDoc]);
  const mf = useMeasureFor();
  const canEdit = api.data.access.canEdit;
  const canvas = useRef<CanvasApi | null>(null);
  const [fmtWanted, setFmt] = useState<FormatKey>(doc.design.formats[0]);
  const [pageWanted, setPage] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [panel, setPanel] = useState<PanelKey | null>("templates");
  const [selection, setSelection] = useState<string[]>([]);
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const [zoom, setZoom] = useState({ scale: 1, fit: true });
  const [live, setLive] = useState<DesignDocument | null>(null);
  const [inspectorHost, setInspectorHost] = useState<HTMLElement | null>(null);
  // the studio fills the window under whatever sits above it (the studio's bar, a sandbox's banner)
  const [top, setTop] = useState(STUDIO_BAR);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const measure = () => { const el = rootRef.current; if (el) setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY))); };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 400);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  });

  const fmt = doc.design.formats.includes(fmtWanted) ? fmtWanted : doc.design.formats[0];
  const pageIx = Math.min(pageWanted, Math.max(0, doc.design.pages.length - 1));
  const page = doc.design.pages[pageIx];

  // the first opening: an old post's slides become pages; a new post starts on a template, never on a white board
  const seeded = useRef(false);
  useEffect(() => {
    if (!mf || seeded.current || doc.design.pages.length || !canEdit) return;
    seeded.current = true;
    const old = slidesOf(doc);
    set((cur) => {
      if (cur.design.pages.length) return cur;
      let design: SocialDesign = { ...cur.design, pages: [] };
      const starts = old.length ? old.map(slideWords) : [{ key: "spotlight", words: undefined as Words | undefined }];
      for (const s of starts) {
        const t = templateByKey(s.key) ?? templateByKey("spotlight")!;
        design = insertPage(design, design.pages.length, { id: `p${Date.now().toString(36)}${design.pages.length}`, by: templatePage(design, t, s.words ? { ...t.words, ...s.words } : undefined, mf) });
      }
      return { ...cur, design };
    });
  }, [mf, doc, canEdit, set]);

  // the canvas holds one page in one format; a new key = a new canvas on that page
  const key = page ? `${fmt}:${page.id}:${epoch}` : "";
  const initial = useRef<{ key: string; doc: DesignDocument | null }>({ key: "", doc: null });
  if (page && initial.current.key !== key) initial.current = { key, doc: pageIn(doc.design, page, fmt) };

  // the canvas's changes into the post's document - only when something really changed
  const where = useRef({ fmt, pageId: page?.id ?? "" });
  where.current = { fmt, pageId: page?.id ?? "" };
  const docRef = useRef(doc);
  docRef.current = doc;
  const onDocument = useCallback((d: DesignDocument) => {
    setLive(d);
    if (!canEdit) return;
    const w = where.current;
    const cur = docRef.current;
    const at = cur.design.pages.findIndex((p) => p.id === w.pageId);
    if (at < 0) return;
    const keep = storable(d);
    const prev = cur.design.pages[at].by[w.fmt];
    if (prev && canonicalDesign(prev) === canonicalDesign(keep)) return;
    set((c) => {
      const i = c.design.pages.findIndex((p) => p.id === w.pageId);
      return i < 0 ? c : { ...c, design: setPageDoc(c.design, i, w.fmt, keep) };
    });
  }, [set, canEdit]);

  const goFormat = useCallback((f: FormatKey, custom?: { w: number; h: number }) => {
    const cur = docRef.current;
    if (!cur.design.formats.includes(f) || (f === "custom" && custom)) set((c) => ({ ...c, design: withFormat(c.design, f, custom, where.current.fmt) }));
    setFmt(f);
    setEpoch((e) => e + 1);
  }, [set]);
  const goPage = useCallback((i: number) => { setPage(i); }, []);
  const reload = useCallback(() => setEpoch((e) => e + 1), []);
  const storeImage = useCallback(async (data: Blob, name: string) => {
    const file = data instanceof File ? data : new File([data], name, { type: data.type || "image/png" });
    const r = await uploadPicture(file, { projectId: api.data.piece.projectId, pieceId: api.data.piece.id });
    return r.ok ? r.picture.url : null;
  }, [api.data.piece.projectId, api.data.piece.id]);

  if (!mf || !page) {
    return (
      <Box ref={rootRef} sx={{ height: `calc(100vh - ${top}px)`, display: "grid", placeItems: "center", color: T.ink3, bgcolor: T.stage }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, fontSize: "0.9rem" }}><CircularProgress size={18} /> Setting up the canvas…</Box>
      </Box>
    );
  }

  const ctx: StudioCtx = {
    api, doc, set, canvas, mf, fmt, goFormat, pageIx, goPage, reload, live, selection, canEdit,
    openPanel: (p) => setPanel(p),
  };
  const open = PANELS.find((p) => p.key === panel) ?? null;

  return (
    <Box ref={rootRef} sx={{
      height: `calc(100vh - ${top}px)`, display: "grid", overflow: "hidden", bgcolor: T.stage,
      gridTemplateColumns: `${RAIL_W}px ${open ? `${open.width}px` : "0px"} minmax(0, 1fr) auto`, transition: "grid-template-columns .22s cubic-bezier(.2,.8,.2,1)",
    }}>
      {/* the rail */}
      <Box component="nav" aria-label="Panels" sx={{ bgcolor: "#fff", borderRight: `1px solid ${T.line}`, display: "flex", flexDirection: "column", alignItems: "stretch", py: 1, gap: 0.25, zIndex: 3 }}>
        {PANELS.map((p) => {
          const on = panel === p.key;
          const last = p.key === "publish";
          return (
            <Box key={p.key} sx={last ? { mt: 1, pt: 1, borderTop: `1px solid ${T.line}`, mx: 1 } : { mx: 1 }}>
              <Box component="button" type="button" aria-pressed={on} onClick={() => setPanel(on ? null : p.key)} sx={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%", py: 0.9, borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4,
                color: on ? (last ? T.accent : T.ink) : T.ink2, bgcolor: on ? (last ? T.accentSoft : T.hover) : "transparent",
                "&:hover": { bgcolor: on ? undefined : T.sunken, color: last ? T.accent : T.ink }, "&:focus-visible": { outline: `2px solid ${T.focus}` },
                "& svg": { fontSize: 22 },
              }}>
                {p.icon}
                <Typography component="span" sx={{ fontSize: "0.68rem", fontWeight: on ? 700 : 600, lineHeight: 1.15, textAlign: "center", px: 0.25 }}>{p.label}</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* the open panel */}
      <Box sx={{ bgcolor: "#fff", borderRight: open ? `1px solid ${T.line}` : "none", overflow: "hidden", minWidth: 0, position: "relative", zIndex: 2, boxShadow: open ? "8px 0 24px -20px rgba(16,24,40,.35)" : "none" }}>
        {open && (
          <Box sx={{ width: open.width, height: "100%", position: "relative" }}>
            <Tooltip title="Close the panel">
              <Box component="button" type="button" aria-label="Close the panel" onClick={() => setPanel(null)} sx={{ all: "unset", cursor: "pointer", position: "absolute", top: 14, right: 12, zIndex: 2, width: 30, height: 30, borderRadius: "8px", display: "grid", placeItems: "center", color: T.ink3, "&:hover": { bgcolor: T.hover, color: T.ink } }}>
                <CloseIcon sx={{ fontSize: 18 }} />
              </Box>
            </Tooltip>
            {panel === "templates" && <TemplatesPanel ctx={ctx} />}
            {panel === "text" && <TextPanel ctx={ctx} />}
            {panel === "pictures" && <PicturesPanel ctx={ctx} />}
            {panel === "photos" && <PhotosPanel ctx={ctx} />}
            {panel === "brand" && <BrandPanel ctx={ctx} />}
            {panel === "size" && <SizePanel ctx={ctx} />}
            {panel === "publish" && <PublishPanel ctx={ctx} />}
          </Box>
        )}
      </Box>

      {/* the stage */}
      <Box sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <CanvasBar ctx={ctx} hist={hist} zoom={zoom} />
        <Box sx={{
          flex: 1, minHeight: 0, position: "relative",
          backgroundImage: "radial-gradient(rgba(17,24,39,.10) 1px, transparent 1.2px)", backgroundSize: "22px 22px", backgroundPosition: "11px 11px",
        }}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-hub-picture")) e.preventDefault(); }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData("application/x-hub-picture");
            if (!raw) return;
            e.preventDefault();
            try {
              const pic = JSON.parse(raw) as { url: string; width?: number | null; height?: number | null };
              void placePicture(ctx, pic, canvas.current?.toCanvas(e.clientX, e.clientY) ?? undefined);
            } catch { /* not a picture */ }
          }}>
          {inspectorHost && <EditorCanvas
            key={key}
            initialDocument={initial.current.doc}
            apiRef={canvas}
            bare
            coverImages
            fitArea={{ top: 36, side: 44, bottom: 152 }}
            palette={PALETTE}
            chromeHosts={{ selection: inspectorHost }}
            toolsContainers={{}}
            storeImage={storeImage}
            onDocumentChange={onDocument}
            onSelectionChange={setSelection}
            onHistoryChange={setHist}
            onZoomChange={setZoom}
          />}
          <PageStrip ctx={ctx} />
          <AiBar ctx={ctx} />
        </Box>
      </Box>

      {/* the properties of what is selected - docked, or floating over the stage */}
      <Inspector ctx={ctx} onHost={setInspectorHost} />
    </Box>
  );
}
