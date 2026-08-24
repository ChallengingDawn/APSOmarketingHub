"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Rect, Text as KText, Image as KImage, Transformer, Line } from "react-konva";
import type Konva from "konva";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import TitleIcon from "@mui/icons-material/Title";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";
import FlipToBackIcon from "@mui/icons-material/FlipToBack";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AlignHorizontalLeftIcon from "@mui/icons-material/AlignHorizontalLeft";
import AlignHorizontalCenterIcon from "@mui/icons-material/AlignHorizontalCenter";
import AlignHorizontalRightIcon from "@mui/icons-material/AlignHorizontalRight";
import AlignVerticalTopIcon from "@mui/icons-material/AlignVerticalTop";
import AlignVerticalCenterIcon from "@mui/icons-material/AlignVerticalCenter";
import AlignVerticalBottomIcon from "@mui/icons-material/AlignVerticalBottom";
import { TEMPLATES, type TemplateSpec } from "@/data/templates";

/* ── palette & canvas presets ── */

const BRAND_COLORS = ["#ed1b2f", "#274e64", "#1a1d21", "#ffffff", "#f5f6f8", "#1e7e45", "#c77700"];

const BG_GRADIENTS = [
  { id: "navy", label: "Navy deep", from: "#16303f", to: "#274e64" },
  { id: "red", label: "Red", from: "#ed1b2f", to: "#8f0f1c" },
  { id: "slate", label: "Slate", from: "#1a1d21", to: "#3c4043" },
  { id: "light", label: "Light", from: "#f5f6f8", to: "#dfe4ea" },
] as const;

const CANVAS_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  linkedin: { w: 1200, h: 627, label: "LinkedIn 1200×627" },
  square: { w: 1080, h: 1080, label: "Square 1080" },
  story: { w: 1080, h: 1920, label: "Story 1080×1920" },
  wide: { w: 1920, h: 1080, label: "Wide 1920×1080" },
};

const HISTORY_MAX = 50;
const SAFE_MARGIN = 0.04;

type NodeSpec = {
  id: string;
  kind: "text" | "rect" | "image";
  x: number;
  y: number;
  text?: string;
  fontKey?: "inter" | "outfit";
  fontSize?: number;
  fontStyle?: string; // combinations of "bold" / "italic" / "normal"
  fill: string;
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
  cornerRadius?: number;
  lineHeight?: number;
  opacity?: number;
  src?: string; // image nodes
  letterSpacing?: number;
  shadow?: boolean;
  locked?: boolean;
  background?: boolean; // text nodes: rounded pill behind the text
  backgroundFill?: string; // pill colour (auto-contrast when unset)
};

/** Seed text placed on the canvas by the studio after generation. */
export type SeedText = {
  text: string;
  role: "headline" | "body";
};

let idSeq = 1;
const nid = () => `n${Date.now().toString(36)}${idSeq++}`;

/** Resolve the real next/font family names from the CSS variables. */
function useResolvedFonts() {
  const [fonts, setFonts] = useState({ inter: "Inter, sans-serif", outfit: "Outfit, sans-serif" });
  useEffect(() => {
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    probe.style.fontFamily = "var(--font-inter)";
    const inter = getComputedStyle(probe).fontFamily || "Inter, sans-serif";
    probe.style.fontFamily = "var(--font-outfit)";
    const outfit = getComputedStyle(probe).fontFamily || "Outfit, sans-serif";
    probe.remove();
    setFonts({ inter, outfit });
  }, []);
  return fonts;
}

function useHtmlImage(src: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);
  return img;
}

function isLightHex(c: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62;
}

/** Default pill colour that contrasts with the text colour. */
const autoPillFill = (textFill: string) => (isLightHex(textFill) ? "#16303f" : "#ffffff");

/** Padding of the background pill, proportional to the font size. */
const pillPad = (n: NodeSpec) => {
  const fs = n.fontSize ?? 24;
  return { px: fs * 0.55, py: fs * 0.3 };
};

type GuideKind = "canvas" | "margin" | "node";
type Guides = { v?: number; h?: number; vKind?: GuideKind; hKind?: GuideKind };
const GUIDE_COLORS: Record<GuideKind, string> = { canvas: "#ed1b2f", margin: "#1e7e45", node: "#7b61ff" };

export default function EditorCanvas({
  itemId,
  initialImage,
  initialTemplateId,
  initialTexts,
  seedSignal,
  painting,
  onExported,
  toolsContainer,
}: {
  itemId?: number;
  initialImage?: string | null;
  initialTemplateId?: string;
  initialTexts?: SeedText[];
  /** Increment to append the generated text onto the canvas (no auto-seed). */
  seedSignal?: number;
  /** Background image is being generated — show the painting state on the artboard. */
  painting?: boolean;
  /** Called with the exported PNG data URL after Attach / Use design. */
  onExported?: (dataUrl: string) => void;
  /**
   * Host element for the tools panel. When provided, the Insert/Canvas/templates
   * tools render into it via a portal (the studio sidebar); when undefined they
   * render inline as a left card (standalone /editor). While the element is still
   * null the tools stay unrendered — never fall back to inline mid-mount.
   */
  toolsContainer?: HTMLElement | null;
}) {
  const fonts = useResolvedFonts();

  const [canvas, setCanvas] = useState({ w: 1200, h: 627 });
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgGradientId, setBgGradientId] = useState<string | null>(null);
  const [bgSrc, setBgSrc] = useState<string | null>(initialImage ?? null);
  const bgImage = useHtmlImage(bgSrc);

  const [nodes, setNodesState] = useState<NodeSpec[]>([]);
  const nodesRef = useRef<NodeSpec[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [textSizes, setTextSizes] = useState<Record<string, { w: number; h: number }>>({});

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  /* ── history (undo / redo) ── */
  const pastRef = useRef<NodeSpec[][]>([]);
  const futureRef = useRef<NodeSpec[][]>([]);
  const [histSizes, setHistSizes] = useState({ past: 0, future: 0 });

  const applyNodes = useCallback((next: NodeSpec[]) => {
    nodesRef.current = next;
    setNodesState(next);
  }, []);

  /** Committed mutation: snapshots the current nodes into history, then applies. */
  const commit = useCallback(
    (updater: NodeSpec[] | ((cur: NodeSpec[]) => NodeSpec[])) => {
      const prev = nodesRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return;
      pastRef.current = [...pastRef.current, prev].slice(-HISTORY_MAX);
      futureRef.current = [];
      applyNodes(next);
      setHistSizes({ past: pastRef.current.length, future: 0 });
    },
    [applyNodes]
  );

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [nodesRef.current, ...futureRef.current].slice(0, HISTORY_MAX);
    applyNodes(prev);
    setGuides({});
    setHistSizes({ past: pastRef.current.length, future: futureRef.current.length });
  }, [applyNodes]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const [next, ...rest] = futureRef.current;
    futureRef.current = rest;
    pastRef.current = [...pastRef.current, nodesRef.current].slice(-HISTORY_MAX);
    applyNodes(next);
    setGuides({});
    setHistSizes({ past: pastRef.current.length, future: futureRef.current.length });
  }, [applyNodes]);

  /* fit-to-viewport scale + zoom */
  const [viewW, setViewW] = useState(900);
  const wrapRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setViewW(Math.max(360, wrapRef.current.clientWidth - 4));
    };
    measure();
    window.addEventListener("resize", measure);
    // the studio sidebar collapses without a window resize — track the wrapper itself too
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  const fitScale = Math.min(viewW / canvas.w, 640 / canvas.h, 1);
  /** null = fit to viewport; a number = absolute canvas zoom (1 = native pixels). */
  const [zoomScale, setZoomScale] = useState<number | null>(null);
  const scale = zoomScale ?? fitScale;
  const fitScaleRef = useRef(fitScale);
  useEffect(() => {
    fitScaleRef.current = fitScale;
  }, [fitScale]);

  /* Ctrl+wheel zoom (native listener — React's wheel handler is passive) */
  useEffect(() => {
    const el = workRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomScale((cur) => {
        const base = cur ?? fitScaleRef.current;
        return Math.min(3, Math.max(0.1, base * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  /* seed generated text onto the canvas (once per mount) */
  const lastSeedRef = useRef(0);
  useEffect(() => {
    if (!seedSignal || seedSignal === lastSeedRef.current || !initialTexts?.length) return;
    lastSeedRef.current = seedSignal;
    const seeds: NodeSpec[] = [];
    let y = canvas.h * 0.08;
    for (const t of initialTexts) {
      const isH = t.role === "headline";
      const fontSize = isH ? Math.round(canvas.w / 16) : Math.round(canvas.w / 40);
      seeds.push({
        id: nid(),
        kind: "text",
        x: canvas.w * 0.06,
        y,
        text: t.text,
        fontKey: isH ? "outfit" : "inter",
        fontSize,
        fontStyle: isH ? "bold" : "normal",
        fill: "#ffffff",
        width: canvas.w * 0.88,
        align: "left",
        lineHeight: 1.2,
        background: true,
      });
      y += fontSize * 1.6 * Math.max(1, Math.ceil(t.text.length / 40));
    }
    commit((cur) => [...cur, ...seeds]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedSignal]);

  /* uploaded/imported image elements cache */
  const [imgEls, setImgEls] = useState<Record<string, HTMLImageElement>>({});
  const loadNodeImage = useCallback((id: string, src: string) => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImgEls((cur) => ({ ...cur, [id]: el }));
    el.src = src;
  }, []);

  /* ensure every image node has a loaded element (e.g. after remount/undo) */
  useEffect(() => {
    nodes.forEach((n) => {
      if (n.kind === "image" && n.src && !imgEls[n.id]) loadNodeImage(n.id, n.src);
    });
  }, [nodes, imgEls, loadNodeImage]);

  /* drop selection when the selected node no longer exists (undo/redo, template load) */
  useEffect(() => {
    if (selectedId && !nodes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [nodes, selectedId]);

  const importImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const el = new window.Image();
      el.onload = () => {
        const id = nid();
        const maxW = canvas.w * 0.35;
        const sc = Math.min(1, maxW / el.width);
        setImgEls((cur) => ({ ...cur, [id]: el }));
        commit((cur) => [
          ...cur,
          { id, kind: "image", x: canvas.w * 0.06, y: canvas.h * 0.06, width: el.width * sc, height: el.height * sc, fill: "#fff", src, opacity: 1 },
        ]);
        setSelectedId(id);
      };
      el.src = src;
    };
    reader.readAsDataURL(file);
  };

  /* transformer binding */
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      return;
    }
    const spec = nodes.find((n) => n.id === selectedId);
    const node = stage.findOne(`#${selectedId}`);
    if (node && !spec?.locked) tr.nodes([node as Konva.Node]);
    else tr.nodes([]); // never leave the transformer attached to a removed or locked node
    tr.getLayer()?.batchDraw();
  }, [selectedId, nodes]);

  const patch = useCallback(
    (id: string, attrs: Partial<NodeSpec>) => {
      commit((cur) => cur.map((n) => (n.id === id ? { ...n, ...attrs } : n)));
    },
    [commit]
  );

  /* ── node factories ── */
  const addText = (kind: "headline" | "body") => {
    const id = nid();
    commit((cur) => [
      ...cur,
      {
        id,
        kind: "text",
        x: canvas.w * 0.08,
        y: canvas.h * (kind === "headline" ? 0.12 : 0.4),
        text: kind === "headline" ? "Your headline here" : "Supporting copy — double-click to edit",
        fontKey: kind === "headline" ? "outfit" : "inter",
        fontSize: kind === "headline" ? Math.round(canvas.w / 18) : Math.round(canvas.w / 38),
        fontStyle: kind === "headline" ? "bold" : "normal",
        fill: kind === "headline" ? "#1a1d21" : "#3c4043",
        width: canvas.w * 0.84,
        align: "left",
      },
    ]);
    setSelectedId(id);
  };

  const addBadge = () => {
    const id = nid();
    commit((cur) => [
      ...cur,
      { id, kind: "rect", x: canvas.w * 0.08, y: canvas.h * 0.75, width: canvas.w * 0.28, height: Math.round(canvas.h * 0.1), fill: "#ed1b2f", cornerRadius: 6 },
    ]);
    setSelectedId(id);
  };

  const addCircle = () => {
    const id = nid();
    const d = Math.round(canvas.h * 0.3);
    commit((cur) => [
      ...cur,
      { id, kind: "rect", x: canvas.w * 0.1, y: canvas.h * 0.3, width: d, height: d, fill: "#274e64", cornerRadius: 9999 },
    ]);
    setSelectedId(id);
  };

  const addLine = () => {
    const id = nid();
    commit((cur) => [
      ...cur,
      { id, kind: "rect", x: canvas.w * 0.08, y: canvas.h * 0.5, width: canvas.w * 0.4, height: 6, fill: "#1a1d21", cornerRadius: 3 },
    ]);
    setSelectedId(id);
  };

  const moveNode = (id: string, dir: 1 | -1) => {
    commit((cur) => {
      const i = cur.findIndex((n) => n.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeSelected = useCallback(() => {
    const id = selectedId;
    if (!id) return;
    setSelectedId(null);
    commit((cur) => cur.filter((n) => n.id !== id));
  }, [selectedId, commit]);

  const duplicateSelected = useCallback(() => {
    const sel = nodesRef.current.find((n) => n.id === selectedId);
    if (!sel) return;
    const id = nid();
    if (sel.kind === "image") {
      setImgEls((cur) => (cur[sel.id] ? { ...cur, [id]: cur[sel.id] } : cur));
    }
    commit((cur) => [...cur, { ...sel, id, x: sel.x + 20, y: sel.y + 20 }]);
    setSelectedId(id);
  }, [selectedId, commit]);

  const moveLayer = (dir: 1 | -1) => {
    if (!selectedId) return;
    commit((cur) => {
      const i = cur.findIndex((n) => n.id === selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  /* measured size of the selected node as rendered on the stage */
  const measuredSize = (n: NodeSpec): { w: number; h: number } => {
    const stageNode = stageRef.current?.findOne(`#${n.id}`);
    if (stageNode) return { w: stageNode.width() * stageNode.scaleX(), h: stageNode.height() * stageNode.scaleY() };
    return { w: n.width ?? 100, h: n.height ?? (n.fontSize ?? 24) * (n.lineHeight ?? 1.25) };
  };

  /* ── alignment (relative to canvas) ── */
  const alignSelected = (mode: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") => {
    if (!selected) return;
    const { w, h } = measuredSize(selected);
    if (mode === "left") patch(selected.id, { x: 0 });
    else if (mode === "centerH") patch(selected.id, { x: (canvas.w - w) / 2 });
    else if (mode === "right") patch(selected.id, { x: canvas.w - w });
    else if (mode === "top") patch(selected.id, { y: 0 });
    else if (mode === "centerV") patch(selected.id, { y: (canvas.h - h) / 2 });
    else patch(selected.id, { y: canvas.h - h });
  };

  /* ── template loading ── */
  const loadTemplate = useCallback(
    (spec: TemplateSpec) => {
      setCanvas({ w: spec.width, h: spec.height });
      setBgSrc(spec.src);
      setBgColor("#ffffff");
      setBgGradientId(null);
      commit(
        spec.fields.map((f) => ({
          id: nid(),
          kind: "text" as const,
          x: f.x,
          y: f.y,
          text: (f.uppercase ? f.defaultValue.toUpperCase() : f.defaultValue) || f.label,
          fontKey: /outfit/i.test(f.fontFamily) ? ("outfit" as const) : ("inter" as const),
          fontSize: f.fontSize,
          fontStyle: f.fontWeight >= 600 ? "bold" : "normal",
          fill: f.color,
          width: f.maxWidth,
          align: (f.align as NodeSpec["align"]) ?? "left",
        }))
      );
      setSelectedId(null);
    },
    [commit]
  );

  useEffect(() => {
    if (initialTemplateId) {
      const spec = TEMPLATES.find((t) => t.id === initialTemplateId);
      if (spec) loadTemplate(spec);
    }
  }, [initialTemplateId, loadTemplate]);

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicateSelected, removeSelected]);

  /* ── snapping: canvas center/edges, 4% safe margin, other nodes' edges/centers ── */
  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const id = node.id();
    const w = node.width() * node.scaleX();
    const h = node.height() * node.scaleY();
    const thr = 8 / scale;

    const vTargets: { pos: number; kind: GuideKind }[] = [
      { pos: canvas.w / 2, kind: "canvas" },
      { pos: 0, kind: "canvas" },
      { pos: canvas.w, kind: "canvas" },
      { pos: canvas.w * SAFE_MARGIN, kind: "margin" },
      { pos: canvas.w * (1 - SAFE_MARGIN), kind: "margin" },
    ];
    const hTargets: { pos: number; kind: GuideKind }[] = [
      { pos: canvas.h / 2, kind: "canvas" },
      { pos: 0, kind: "canvas" },
      { pos: canvas.h, kind: "canvas" },
      { pos: canvas.h * SAFE_MARGIN, kind: "margin" },
      { pos: canvas.h * (1 - SAFE_MARGIN), kind: "margin" },
    ];
    const stage = node.getStage();
    for (const other of nodesRef.current) {
      if (other.id === id) continue;
      const on = stage?.findOne(`#${other.id}`);
      if (!on) continue;
      const ow = on.width() * on.scaleX();
      const oh = on.height() * on.scaleY();
      vTargets.push({ pos: on.x(), kind: "node" }, { pos: on.x() + ow / 2, kind: "node" }, { pos: on.x() + ow, kind: "node" });
      hTargets.push({ pos: on.y(), kind: "node" }, { pos: on.y() + oh / 2, kind: "node" }, { pos: on.y() + oh, kind: "node" });
    }

    let bestV: { pos: number; kind: GuideKind; nx: number; d: number } | null = null;
    for (const t of vTargets) {
      for (const o of [0, w / 2, w]) {
        const d = Math.abs(t.pos - (node.x() + o));
        if (d < thr && (!bestV || d < bestV.d)) bestV = { pos: t.pos, kind: t.kind, nx: t.pos - o, d };
      }
    }
    let bestH: { pos: number; kind: GuideKind; ny: number; d: number } | null = null;
    for (const t of hTargets) {
      for (const o of [0, h / 2, h]) {
        const d = Math.abs(t.pos - (node.y() + o));
        if (d < thr && (!bestH || d < bestH.d)) bestH = { pos: t.pos, kind: t.kind, ny: t.pos - o, d };
      }
    }

    if (bestV) node.x(bestV.nx);
    if (bestH) node.y(bestH.ny);

    /* keep the background pill glued to its text while dragging */
    const spec = nodesRef.current.find((n) => n.id === id);
    if (spec?.kind === "text" && spec.background) {
      const pill = stage?.findOne(`#pill-${id}`);
      if (pill) {
        const { px, py } = pillPad(spec);
        pill.position({ x: node.x() - px, y: node.y() - py });
      }
    }

    const g: Guides = {};
    if (bestV) {
      g.v = bestV.pos;
      g.vKind = bestV.kind;
    }
    if (bestH) {
      g.h = bestH.pos;
      g.hKind = bestH.kind;
    }
    setGuides((prev) => (prev.v === g.v && prev.h === g.h && prev.vKind === g.vKind && prev.hKind === g.hKind ? prev : g));
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    setGuides({});
    patch(id, { x: e.target.x(), y: e.target.y() });
  };

  /* ── inline text editing (double-click) ── */
  const editTextInline = (node: NodeSpec) => {
    const stage = stageRef.current;
    if (!stage) return;
    const areaPos = stage.container().getBoundingClientRect();
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.value = node.text ?? "";
    Object.assign(ta.style, {
      position: "fixed",
      top: `${areaPos.top + node.y * scale}px`,
      left: `${areaPos.left + node.x * scale}px`,
      width: `${(node.width ?? 300) * scale}px`,
      fontSize: `${(node.fontSize ?? 24) * scale}px`,
      fontFamily: node.fontKey === "outfit" ? fonts.outfit : fonts.inter,
      fontWeight: node.fontStyle === "bold" ? "700" : "400",
      color: node.fill,
      background: "rgba(255,255,255,0.92)",
      border: "2px solid #274e64",
      borderRadius: "4px",
      padding: "2px 4px",
      zIndex: "2000",
      lineHeight: "1.25",
      minHeight: `${(node.fontSize ?? 24) * 1.6 * scale}px`,
      resize: "none",
      outline: "none",
    });
    ta.focus();
    ta.select();
    const commitEdit = () => {
      if (ta.value !== (node.text ?? "")) patch(node.id, { text: ta.value });
      ta.remove();
    };
    ta.addEventListener("blur", commitEdit);
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ta.removeEventListener("blur", commitEdit);
        ta.remove();
      }
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) commitEdit();
    });
  };

  /* ── measure rendered text boxes for background pills ── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const next: Record<string, { w: number; h: number }> = {};
    for (const n of nodes) {
      if (n.kind !== "text" || !n.background) continue;
      const tn = stage.findOne<Konva.Text>(`#${n.id}`);
      if (!tn) continue;
      next[n.id] = { w: tn.width(), h: tn.height() };
    }
    setTextSizes((prev) => {
      const pk = Object.keys(prev);
      const nk = Object.keys(next);
      if (pk.length === nk.length && nk.every((k) => prev[k] && prev[k].w === next[k].w && prev[k].h === next[k].h)) return prev;
      return next;
    });
  }, [nodes, fonts]);

  /* ── export ── */
  const exportDataUrl = (): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    setSelectedId(null);
    trRef.current?.nodes([]);
    // render at native resolution regardless of the effective on-screen scale (fit × zoom)
    return stage.toDataURL({ pixelRatio: 1 / scale, mimeType: "image/png" });
  };

  const download = () => {
    // allow transformer detach to paint
    requestAnimationFrame(() => {
      const url = exportDataUrl();
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `apso-design-${canvas.w}x${canvas.h}.png`;
      a.click();
    });
  };

  const attachToDraft = () => {
    if (!itemId) return;
    setSaving(true);
    requestAnimationFrame(async () => {
      try {
        const url = exportDataUrl();
        if (!url) return;
        const res = await fetch(`/api/content/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: url }),
        });
        setNotice(res.ok ? `Design attached to draft #${itemId} in the Library.` : "Attaching failed — download instead.");
        if (res.ok && url) onExported?.(url);
      } catch {
        setNotice("Attaching failed — download instead.");
      } finally {
        setSaving(false);
      }
    });
  };

  /* ── render ── */
  const fontFamilyOf = (n: NodeSpec) => (n.fontKey === "outfit" ? fonts.outfit : fonts.inter);

  const bgFit = useMemo(() => {
    if (!bgImage) return null;
    const s = Math.max(canvas.w / bgImage.width, canvas.h / bgImage.height);
    return { width: bgImage.width * s, height: bgImage.height * s, x: (canvas.w - bgImage.width * s) / 2, y: (canvas.h - bgImage.height * s) / 2 };
  }, [bgImage, canvas]);

  const bgGrad = BG_GRADIENTS.find((g) => g.id === bgGradientId) ?? null;

  const zoomValue = zoomScale == null ? "fit" : zoomScale === 0.5 ? "50" : zoomScale === 0.75 ? "75" : zoomScale === 1 ? "100" : "custom";

  const pillRect = (n: NodeSpec) => {
    const { px, py } = pillPad(n);
    const size = textSizes[n.id] ?? { w: n.width ?? 200, h: (n.fontSize ?? 24) * (n.lineHeight ?? 1.25) };
    const pillH = size.h + py * 2;
    return (
      <Rect
        id={`pill-${n.id}`}
        x={n.x - px}
        y={n.y - py}
        width={size.w + px * 2}
        height={pillH}
        fill={n.backgroundFill ?? autoPillFill(n.fill)}
        cornerRadius={Math.min(pillH / 2, (n.fontSize ?? 24) * 0.9)}
        opacity={n.opacity ?? 1}
        listening={false}
      />
    );
  };

  /* keep the pill glued during transformer resizes (state catches up on transform end) */
  const syncPillDuringTransform = (n: NodeSpec, t: Konva.Node) => {
    if (!n.background) return;
    const pill = t.getStage()?.findOne(`#pill-${n.id}`);
    if (!pill) return;
    const { px, py } = pillPad(n);
    pill.setAttrs({ x: t.x() - px, y: t.y() - py, width: t.width() * t.scaleX() + px * 2, height: t.height() * t.scaleY() + py * 2 });
  };

  /* tools panel — inline card on /editor, portaled into the studio sidebar when a container is provided */
  const toolsPanel = (
    <Box sx={{ p: toolsContainer !== undefined ? 0 : 2 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
        Insert
      </Typography>
      <Box sx={{ display: "flex", gap: 0.75, mb: 2 }}>
        <Tooltip title="Headline (Outfit bold)">
          <Button onClick={() => addText("headline")} startIcon={<TitleIcon />} size="small" variant="outlined" sx={{ fontWeight: 700 }}>
            Headline
          </Button>
        </Tooltip>
        <Tooltip title="Body text (Inter)">
          <Button onClick={() => addText("body")} startIcon={<TextFieldsIcon />} size="small" variant="outlined" sx={{ fontWeight: 700 }}>
            Text
          </Button>
        </Tooltip>
        <Tooltip title="Colour block / badge">
          <IconButton onClick={addBadge} size="small" sx={{ border: "1px solid #c9ced6", borderRadius: 1 }}>
            <CropSquareIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Circle">
          <IconButton onClick={addCircle} size="small" sx={{ border: "1px solid #c9ced6", borderRadius: 1 }}>
            <CircleOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Divider line">
          <IconButton onClick={addLine} size="small" sx={{ border: "1px solid #c9ced6", borderRadius: 1 }}>
            <HorizontalRuleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Button component="label" size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} sx={{ fontWeight: 700, mb: 2 }}>
        Import photo / logo
        <input
          hidden
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importImage(f);
            e.currentTarget.value = "";
          }}
        />
      </Button>

      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
        Canvas
      </Typography>
      <TextField
        select
        fullWidth
        size="small"
        value={Object.entries(CANVAS_PRESETS).find(([, p]) => p.w === canvas.w && p.h === canvas.h)?.[0] ?? "custom"}
        onChange={(e) => {
          const p = CANVAS_PRESETS[e.target.value];
          if (p) setCanvas({ w: p.w, h: p.h });
        }}
        sx={{ mb: 1.25 }}
      >
        {Object.entries(CANVAS_PRESETS).map(([k, p]) => (
          <MenuItem key={k} value={k}>
            {p.label}
          </MenuItem>
        ))}
        <MenuItem value="custom" disabled>
          Custom ({canvas.w}×{canvas.h})
        </MenuItem>
      </TextField>
      <Typography sx={{ fontSize: 11.5, color: "#5b6470", mb: 0.5 }}>Background colour</Typography>
      <Box sx={{ display: "flex", gap: 0.5, mb: 1.25, flexWrap: "wrap", alignItems: "center" }}>
        {BRAND_COLORS.map((c) => (
          <Box
            key={c}
            onClick={() => {
              setBgColor(c);
              setBgGradientId(null);
            }}
            sx={{
              width: 22,
              height: 22,
              borderRadius: 0.75,
              bgcolor: c,
              cursor: "pointer",
              border: !bgGradientId && bgColor === c ? "2px solid #274e64" : "1px solid #d5d9df",
            }}
          />
        ))}
        <input
          type="color"
          value={bgColor.startsWith("#") ? bgColor : "#ffffff"}
          onChange={(e) => {
            setBgColor(e.target.value);
            setBgGradientId(null);
          }}
          style={{ width: 30, height: 26, border: "1px solid #d5d9df", borderRadius: 4, padding: 0, background: "none", cursor: "pointer" }}
          title="Custom colour"
        />
      </Box>
      <Typography sx={{ fontSize: 11.5, color: "#5b6470", mb: 0.5 }}>Background gradient</Typography>
      <Box sx={{ display: "flex", gap: 0.5, mb: 2, alignItems: "center" }}>
        {BG_GRADIENTS.map((g) => (
          <Tooltip key={g.id} title={g.label}>
            <Box
              onClick={() => setBgGradientId(g.id)}
              sx={{
                width: 30,
                height: 22,
                borderRadius: 0.75,
                cursor: "pointer",
                background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                border: bgGradientId === g.id ? "2px solid #274e64" : "1px solid #d5d9df",
              }}
            />
          </Tooltip>
        ))}
      </Box>

      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
        Brand templates
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 220, overflow: "auto", mb: 1 }}>
        {TEMPLATES.filter((t) => t.category === "LinkedIn event").map((t) => (
          <Chip key={t.id} label={t.name} size="small" onClick={() => loadTemplate(t)} sx={{ justifyContent: "flex-start", fontWeight: 600, bgcolor: "#f0f1f3" }} />
        ))}
      </Box>

          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mt: 2, mb: 1 }}>
            Layers
          </Typography>
          {nodes.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: "#8a93a0" }}>Nothing on the canvas yet.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, maxHeight: 200, overflow: "auto" }}>
              {[...nodes].reverse().map((n) => (
                <Box
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.75,
                    py: 0.4,
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor: selectedId === n.id ? "#e8f0f4" : "transparent",
                    "&:hover": { bgcolor: selectedId === n.id ? "#e8f0f4" : "#f5f6f8" },
                  }}
                >
                  <Typography noWrap sx={{ flex: 1, fontSize: 12, color: "#1a1d21", minWidth: 0 }}>
                    {n.kind === "text" ? (n.text || "Text").slice(0, 26) : n.kind === "image" ? "Image" : "Shape"}
                  </Typography>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); moveNode(n.id, 1); }} sx={{ p: 0.25 }}>
                    <FlipToFrontIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); moveNode(n.id, -1); }} sx={{ p: 0.25 }}>
                    <FlipToBackIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); patch(n.id, { locked: !n.locked }); }} sx={{ p: 0.25, color: n.locked ? "#ed1b2f" : "#8a93a0" }}>
                    {n.locked ? <LockIcon sx={{ fontSize: 14 }} /> : <LockOpenIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); commit((cur) => cur.filter((x) => x.id !== n.id)); if (selectedId === n.id) setSelectedId(null); }} sx={{ p: 0.25, color: "#c5221f" }}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" } }}>
      {/* ── left: tools ── */}
      {toolsContainer === undefined ? (
        <Card sx={{ width: { lg: 280 }, flexShrink: 0, alignSelf: "flex-start" }}>{toolsPanel}</Card>
      ) : toolsContainer ? (
        createPortal(toolsPanel, toolsContainer)
      ) : null}

      {/* ── center: stage ── */}
      <Box ref={wrapRef} sx={{ flex: 1, minWidth: 0 }}>
        {/* selection toolbar */}
        <Card sx={{ mb: 1.5 }}>
          <Box sx={{ p: 1.25, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", minHeight: 52 }}>
            {selected ? (
              <>
                {selected.kind === "text" && (
                  <>
                    <TextField
                      select
                      size="small"
                      value={selected.fontKey ?? "inter"}
                      onChange={(e) => patch(selected.id, { fontKey: e.target.value as "inter" | "outfit" })}
                      sx={{ width: 110 }}
                    >
                      <MenuItem value="outfit">Outfit</MenuItem>
                      <MenuItem value="inter">Inter</MenuItem>
                    </TextField>
                    <TextField
                      type="number"
                      size="small"
                      value={selected.fontSize ?? 24}
                      onChange={(e) => patch(selected.id, { fontSize: Math.max(8, Number(e.target.value) || 24) })}
                      sx={{ width: 84 }}
                    />
                    <Button
                      size="small"
                      variant={selected.fontStyle?.includes("bold") ? "contained" : "outlined"}
                      onClick={() => {
                        const bold = selected.fontStyle?.includes("bold");
                        const italic = selected.fontStyle?.includes("italic");
                        const next = [bold ? "" : "bold", italic ? "italic" : ""].filter(Boolean).join(" ") || "normal";
                        patch(selected.id, { fontStyle: next });
                      }}
                      sx={{ fontWeight: 800, minWidth: 40 }}
                    >
                      B
                    </Button>
                    <TextField
                      select
                      size="small"
                      value={selected.align ?? "left"}
                      onChange={(e) => patch(selected.id, { align: e.target.value as NodeSpec["align"] })}
                      sx={{ width: 100 }}
                    >
                      <MenuItem value="left">Left</MenuItem>
                      <MenuItem value="center">Center</MenuItem>
                      <MenuItem value="right">Right</MenuItem>
                    </TextField>
                  </>
                )}
                {selected.kind !== "image" && (
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    {BRAND_COLORS.map((c) => (
                      <Box
                        key={c}
                        onClick={() => patch(selected.id, { fill: c })}
                        sx={{ width: 20, height: 20, borderRadius: 0.75, bgcolor: c, cursor: "pointer", border: selected.fill === c ? "2px solid #274e64" : "1px solid #d5d9df" }}
                      />
                    ))}
                    <input type="color" value={selected.fill.startsWith("#") ? selected.fill : "#000000"} onChange={(e) => patch(selected.id, { fill: e.target.value })} style={{ width: 28, height: 24, border: "1px solid #d5d9df", borderRadius: 4, padding: 0, background: "none", cursor: "pointer" }} title="Custom colour" />
                  </Box>
                )}
                {selected.kind === "text" && (
                  <>
                    <Button
                      size="small"
                      variant={selected.fontStyle?.includes("italic") ? "contained" : "outlined"}
                      onClick={() => {
                        const bold = selected.fontStyle?.includes("bold");
                        const italic = selected.fontStyle?.includes("italic");
                        const next = [bold ? "bold" : "", italic ? "" : "italic"].filter(Boolean).join(" ") || "normal";
                        patch(selected.id, { fontStyle: next });
                      }}
                      sx={{ fontStyle: "italic", fontWeight: 700, minWidth: 40 }}
                    >
                      I
                    </Button>
                    <Tooltip title="Line height">
                      <TextField
                        type="number"
                        size="small"
                        value={selected.lineHeight ?? 1.25}
                        onChange={(e) => patch(selected.id, { lineHeight: Math.min(3, Math.max(0.8, Number(e.target.value) || 1.25)) })}
                        inputProps={{ step: 0.05 }}
                        sx={{ width: 78 }}
                      />
                    </Tooltip>
                    <Tooltip title="Background pill behind the text">
                      <Button
                        size="small"
                        variant={selected.background ? "contained" : "outlined"}
                        onClick={() => patch(selected.id, { background: !selected.background })}
                        sx={{ fontWeight: 700, minWidth: 44 }}
                      >
                        Pill
                      </Button>
                    </Tooltip>
                    {selected.background && (
                      <input
                        type="color"
                        value={selected.backgroundFill ?? autoPillFill(selected.fill)}
                        onChange={(e) => patch(selected.id, { backgroundFill: e.target.value })}
                        style={{ width: 28, height: 24, border: "1px solid #d5d9df", borderRadius: 4, padding: 0, background: "none", cursor: "pointer" }}
                        title="Pill colour"
                      />
                    )}
                  </>
                )}
                {(selected.kind === "image" || selected.kind === "rect") && (
                  <Tooltip title="Corner radius">
                    <TextField
                      type="number"
                      size="small"
                      value={selected.cornerRadius ?? 0}
                      onChange={(e) => patch(selected.id, { cornerRadius: Math.max(0, Number(e.target.value) || 0) })}
                      inputProps={{ step: 2 }}
                      sx={{ width: 78 }}
                    />
                  </Tooltip>
                )}
                {selected.kind === "text" && (
                  <Tooltip title="Letter spacing">
                    <TextField
                      type="number"
                      size="small"
                      value={selected.letterSpacing ?? 0}
                      onChange={(e) => patch(selected.id, { letterSpacing: Math.min(40, Math.max(-2, Number(e.target.value) || 0)) })}
                      inputProps={{ step: 0.5 }}
                      sx={{ width: 78 }}
                    />
                  </Tooltip>
                )}
                <Tooltip title="Drop shadow">
                  <Button
                    size="small"
                    variant={selected.shadow ? "contained" : "outlined"}
                    onClick={() => patch(selected.id, { shadow: !selected.shadow })}
                    sx={{ minWidth: 44, fontWeight: 700 }}
                  >
                    Sh
                  </Button>
                </Tooltip>
                <Tooltip title={selected.locked ? "Unlock" : "Lock position"}>
                  <IconButton size="small" onClick={() => patch(selected.id, { locked: !selected.locked })} sx={{ color: selected.locked ? "#ed1b2f" : "#5b6470" }}>
                    {selected.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Opacity">
                  <TextField
                    type="number"
                    size="small"
                    value={Math.round((selected.opacity ?? 1) * 100)}
                    onChange={(e) => patch(selected.id, { opacity: Math.min(100, Math.max(5, Number(e.target.value) || 100)) / 100 })}
                    inputProps={{ step: 5 }}
                    sx={{ width: 78 }}
                  />
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                <Tooltip title="Align left edge">
                  <IconButton size="small" onClick={() => alignSelected("left")}>
                    <AlignHorizontalLeftIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Center horizontally">
                  <IconButton size="small" onClick={() => alignSelected("centerH")}>
                    <AlignHorizontalCenterIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Align right edge">
                  <IconButton size="small" onClick={() => alignSelected("right")}>
                    <AlignHorizontalRightIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Align top edge">
                  <IconButton size="small" onClick={() => alignSelected("top")}>
                    <AlignVerticalTopIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Center vertically">
                  <IconButton size="small" onClick={() => alignSelected("centerV")}>
                    <AlignVerticalCenterIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Align bottom edge">
                  <IconButton size="small" onClick={() => alignSelected("bottom")}>
                    <AlignVerticalBottomIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
                <Tooltip title="Duplicate (Ctrl+D)">
                  <IconButton size="small" onClick={duplicateSelected}>
                    <ContentCopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Bring forward">
                  <IconButton size="small" onClick={() => moveLayer(1)}>
                    <FlipToFrontIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Send back">
                  <IconButton size="small" onClick={() => moveLayer(-1)}>
                    <FlipToBackIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete (Del)">
                  <IconButton size="small" onClick={removeSelected} sx={{ color: "#c5221f" }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Typography sx={{ fontSize: 12.5, color: "#5b6470" }}>
                Select an element to style it · double-click text to edit · Ctrl+Z undo · Ctrl+D duplicate
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Undo (Ctrl+Z)">
              <span>
                <IconButton size="small" onClick={undo} disabled={histSizes.past === 0}>
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo (Ctrl+Shift+Z / Ctrl+Y)">
              <span>
                <IconButton size="small" onClick={redo} disabled={histSizes.future === 0}>
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Zoom (Ctrl+wheel on the canvas)">
              <TextField
                select
                size="small"
                value={zoomValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setZoomScale(v === "fit" ? null : v === "50" ? 0.5 : v === "75" ? 0.75 : 1);
                }}
                sx={{ width: 96 }}
              >
                <MenuItem value="fit">Fit</MenuItem>
                <MenuItem value="50">50%</MenuItem>
                <MenuItem value="75">75%</MenuItem>
                <MenuItem value="100">100%</MenuItem>
                {zoomValue === "custom" && (
                  <MenuItem value="custom" disabled>
                    {Math.round(scale * 100)}%
                  </MenuItem>
                )}
              </TextField>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            {itemId && (
              <Button onClick={attachToDraft} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} variant="contained" sx={{ bgcolor: "#274e64", fontWeight: 700 }}>
                {saving ? "Attaching…" : "Attach to draft"}
              </Button>
            )}
            {!itemId && onExported && (
              <Button
                onClick={() =>
                  requestAnimationFrame(() => {
                    const url = exportDataUrl();
                    if (url) onExported(url);
                  })
                }
                startIcon={<SaveIcon />}
                variant="contained"
                sx={{ bgcolor: "#274e64", fontWeight: 700 }}
              >
                Use design
              </Button>
            )}
            <Button onClick={download} startIcon={<DownloadIcon />} variant="contained" sx={{ bgcolor: "#ed1b2f", fontWeight: 700 }}>
              Download PNG
            </Button>
          </Box>
        </Card>

        {notice && (
          <Alert severity={notice.startsWith("Design") ? "success" : "warning"} onClose={() => setNotice("")} sx={{ mb: 1.5 }}>
            {notice}
          </Alert>
        )}

        {/* workspace surface — the artboard floats on a neutral dotted board like a real design tool */}
        <Box
          ref={workRef}
          sx={{
            bgcolor: "#eef1f5",
            backgroundImage: "radial-gradient(#d5dbe3 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            borderRadius: 1.5,
            border: "1px solid #e2e6eb",
            p: { xs: 1.5, md: 3 },
            display: "flex",
            overflow: "auto",
            maxHeight: 720,
          }}
        >
        <Box sx={{ display: "inline-block", m: "auto", boxShadow: "0 8px 32px rgba(22,48,63,0.18)", borderRadius: 0.5, overflow: "hidden", bgcolor: "#fff", position: "relative", flexShrink: 0 }}>
          {painting && !bgImage && (
            <Box
              className="shimmer"
              sx={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", borderRadius: 0 }}
            >
              <Typography sx={{ position: "relative", zIndex: 1, fontSize: 13, fontWeight: 700, color: "#5b6470", bgcolor: "rgba(255,255,255,0.85)", px: 2, py: 0.75, borderRadius: 1 }}>
                Gemini is painting the background…
              </Typography>
            </Box>
          )}
          <Stage
            ref={stageRef}
            width={canvas.w * scale}
            height={canvas.h * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <Layer ref={layerRef}>
              {bgGrad ? (
                <Rect
                  x={0}
                  y={0}
                  width={canvas.w}
                  height={canvas.h}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                  fillLinearGradientEndPoint={{ x: canvas.w, y: canvas.h }}
                  fillLinearGradientColorStops={[0, bgGrad.from, 1, bgGrad.to]}
                  listening={false}
                />
              ) : (
                <Rect x={0} y={0} width={canvas.w} height={canvas.h} fill={bgColor} listening={false} />
              )}
              {bgImage && bgFit && (
                <KImage image={bgImage} x={bgFit.x} y={bgFit.y} width={bgFit.width} height={bgFit.height} listening={false} />
              )}
              {nodes.map((n) =>
                n.kind === "text" ? (
                  <Fragment key={n.id}>
                    {n.background && pillRect(n)}
                    <KText
                      id={n.id}
                      x={n.x}
                      y={n.y}
                      text={n.text}
                      width={n.width}
                      fontSize={n.fontSize}
                      fontFamily={fontFamilyOf(n)}
                      fontStyle={n.fontStyle}
                      fill={n.fill}
                      align={n.align}
                      lineHeight={n.lineHeight ?? 1.25}
                      letterSpacing={n.letterSpacing ?? 0}
                      opacity={n.opacity ?? 1}
                      shadowColor="rgba(0,0,0,0.45)"
                      shadowBlur={n.shadow ? 14 : 0}
                      shadowOffsetY={n.shadow ? 4 : 0}
                      shadowEnabled={Boolean(n.shadow)}
                      draggable={!n.locked}
                      onClick={() => setSelectedId(n.id)}
                      onTap={() => setSelectedId(n.id)}
                      onDblClick={() => editTextInline(n)}
                      onDragMove={onDragMove}
                      onDragEnd={(e) => onDragEnd(e, n.id)}
                      onTransform={(e) => syncPillDuringTransform(n, e.target)}
                      onTransformEnd={(e) => {
                        const t = e.target;
                        patch(n.id, {
                          x: t.x(),
                          y: t.y(),
                          width: Math.max(40, (n.width ?? 200) * t.scaleX()),
                          fontSize: Math.max(8, Math.round((n.fontSize ?? 24) * t.scaleY())),
                        });
                        t.scaleX(1);
                        t.scaleY(1);
                      }}
                    />
                  </Fragment>
                ) : n.kind === "image" ? (
                  <KImage
                    key={n.id}
                    id={n.id}
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    image={imgEls[n.id]}
                    cornerRadius={n.cornerRadius}
                    opacity={n.opacity ?? 1}
                    shadowColor="rgba(0,0,0,0.45)"
                    shadowBlur={n.shadow ? 14 : 0}
                    shadowOffsetY={n.shadow ? 4 : 0}
                    shadowEnabled={Boolean(n.shadow)}
                    draggable={!n.locked}
                    onClick={() => setSelectedId(n.id)}
                    onTap={() => setSelectedId(n.id)}
                    onDragMove={onDragMove}
                    onDragEnd={(e) => onDragEnd(e, n.id)}
                    onTransformEnd={(e) => {
                      const t = e.target;
                      patch(n.id, {
                        x: t.x(),
                        y: t.y(),
                        width: Math.max(16, (n.width ?? 100) * t.scaleX()),
                        height: Math.max(16, (n.height ?? 100) * t.scaleY()),
                      });
                      t.scaleX(1);
                      t.scaleY(1);
                    }}
                  />
                ) : (
                  <Rect
                    key={n.id}
                    id={n.id}
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    fill={n.fill}
                    cornerRadius={Math.min(n.cornerRadius ?? 0, Math.min(n.width ?? 0, n.height ?? 0) / 2)}
                    opacity={n.opacity ?? 1}
                    shadowColor="rgba(0,0,0,0.45)"
                    shadowBlur={n.shadow ? 14 : 0}
                    shadowOffsetY={n.shadow ? 4 : 0}
                    shadowEnabled={Boolean(n.shadow)}
                    draggable={!n.locked}
                    onClick={() => setSelectedId(n.id)}
                    onTap={() => setSelectedId(n.id)}
                    onDragMove={onDragMove}
                    onDragEnd={(e) => onDragEnd(e, n.id)}
                    onTransformEnd={(e) => {
                      const t = e.target;
                      patch(n.id, {
                        x: t.x(),
                        y: t.y(),
                        width: Math.max(16, (n.width ?? 100) * t.scaleX()),
                        height: Math.max(16, (n.height ?? 60) * t.scaleY()),
                      });
                      t.scaleX(1);
                      t.scaleY(1);
                    }}
                  />
                )
              )}
              {guides.v !== undefined && (
                <Line
                  points={[guides.v, 0, guides.v, canvas.h]}
                  stroke={GUIDE_COLORS[guides.vKind ?? "canvas"]}
                  strokeWidth={1 / scale}
                  dash={[6, 4]}
                  listening={false}
                />
              )}
              {guides.h !== undefined && (
                <Line
                  points={[0, guides.h, canvas.w, guides.h]}
                  stroke={GUIDE_COLORS[guides.hKind ?? "canvas"]}
                  strokeWidth={1 / scale}
                  dash={[6, 4]}
                  listening={false}
                />
              )}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                anchorSize={9}
                borderStroke="#274e64"
                anchorStroke="#274e64"
                anchorFill="#ffffff"
                keepRatio={selected?.kind === "image"}
                enabledAnchors={
                  selected?.kind === "image"
                    ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                    : ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
                }
              />
            </Layer>
          </Stage>
        </Box>
        </Box>
      </Box>
    </Box>
  );
}
