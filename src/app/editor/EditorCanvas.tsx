"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import CircularProgress from "@mui/material/CircularProgress";
import TitleIcon from "@mui/icons-material/Title";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SaveIcon from "@mui/icons-material/Save";
import FlipToFrontIcon from "@mui/icons-material/FlipToFront";
import FlipToBackIcon from "@mui/icons-material/FlipToBack";
import { TEMPLATES, type TemplateSpec } from "@/data/templates";

/* ── palette & canvas presets ── */

const BRAND_COLORS = ["#ed1b2f", "#274e64", "#1a1d21", "#ffffff", "#f5f6f8", "#1e7e45", "#c77700"];

const CANVAS_PRESETS: Record<string, { w: number; h: number; label: string }> = {
  linkedin: { w: 1200, h: 627, label: "LinkedIn 1200×627" },
  square: { w: 1080, h: 1080, label: "Square 1080" },
  story: { w: 1080, h: 1920, label: "Story 1080×1920" },
  wide: { w: 1920, h: 1080, label: "Wide 1920×1080" },
};

type NodeSpec = {
  id: string;
  kind: "text" | "rect";
  x: number;
  y: number;
  text?: string;
  fontKey?: "inter" | "outfit";
  fontSize?: number;
  fontStyle?: string; // "normal" | "bold"
  fill: string;
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
  cornerRadius?: number;
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

export default function EditorCanvas({
  itemId,
  initialImage,
  initialTemplateId,
}: {
  itemId?: number;
  initialImage?: string | null;
  initialTemplateId?: string;
}) {
  const fonts = useResolvedFonts();

  const [canvas, setCanvas] = useState({ w: 1200, h: 627 });
  const [bgColor, setBgColor] = useState("#ffffff");
  const [bgSrc, setBgSrc] = useState<string | null>(initialImage ?? null);
  const bgImage = useHtmlImage(bgSrc);

  const [nodes, setNodes] = useState<NodeSpec[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  /* fit-to-viewport scale */
  const [viewW, setViewW] = useState(900);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      if (wrapRef.current) setViewW(Math.max(360, wrapRef.current.clientWidth - 4));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const scale = Math.min(viewW / canvas.w, 640 / canvas.h, 1);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  /* transformer binding */
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!selectedId) {
      tr.nodes([]);
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (node) tr.nodes([node as Konva.Node]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, nodes]);

  const patch = useCallback((id: string, attrs: Partial<NodeSpec>) => {
    setNodes((cur) => cur.map((n) => (n.id === id ? { ...n, ...attrs } : n)));
  }, []);

  /* ── node factories ── */
  const addText = (kind: "headline" | "body") => {
    const id = nid();
    setNodes((cur) => [
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
    setNodes((cur) => [
      ...cur,
      { id, kind: "rect", x: canvas.w * 0.08, y: canvas.h * 0.75, width: canvas.w * 0.28, height: Math.round(canvas.h * 0.1), fill: "#ed1b2f", cornerRadius: 6 },
    ]);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setNodes((cur) => cur.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  };

  const moveLayer = (dir: 1 | -1) => {
    if (!selectedId) return;
    setNodes((cur) => {
      const i = cur.findIndex((n) => n.id === selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  /* ── template loading ── */
  const loadTemplate = useCallback((spec: TemplateSpec) => {
    setCanvas({ w: spec.width, h: spec.height });
    setBgSrc(spec.src);
    setBgColor("#ffffff");
    setNodes(
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
  }, []);

  useEffect(() => {
    if (initialTemplateId) {
      const spec = TEMPLATES.find((t) => t.id === initialTemplateId);
      if (spec) loadTemplate(spec);
    }
  }, [initialTemplateId, loadTemplate]);

  /* ── snapping ── */
  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const cx = canvas.w / 2;
    const cy = canvas.h / 2;
    const w = node.width() * node.scaleX();
    const h = node.height() * node.scaleY();
    const nodeCx = node.x() + w / 2;
    const nodeCy = node.y() + h / 2;
    const snap = 8 / scale;
    const g: { v?: number; h?: number } = {};
    if (Math.abs(nodeCx - cx) < snap) {
      node.x(cx - w / 2);
      g.v = cx;
    }
    if (Math.abs(nodeCy - cy) < snap) {
      node.y(cy - h / 2);
      g.h = cy;
    }
    setGuides(g);
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
    const commit = () => {
      patch(node.id, { text: ta.value });
      ta.remove();
    };
    ta.addEventListener("blur", commit);
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ta.remove();
      }
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) commit();
    });
  };

  /* ── export ── */
  const exportDataUrl = (): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    setSelectedId(null);
    trRef.current?.nodes([]);
    // render at native resolution regardless of on-screen scale
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

  return (
    <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", lg: "row" } }}>
      {/* ── left: tools ── */}
      <Card sx={{ width: { lg: 280 }, flexShrink: 0, alignSelf: "flex-start" }}>
        <Box sx={{ p: 2 }}>
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
          </Box>

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
          <Box sx={{ display: "flex", gap: 0.5, mb: 2, flexWrap: "wrap" }}>
            {BRAND_COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => setBgColor(c)}
                sx={{ width: 22, height: 22, borderRadius: 0.75, bgcolor: c, cursor: "pointer", border: bgColor === c ? "2px solid #274e64" : "1px solid #d5d9df" }}
              />
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
        </Box>
      </Card>

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
                      variant={selected.fontStyle === "bold" ? "contained" : "outlined"}
                      onClick={() => patch(selected.id, { fontStyle: selected.fontStyle === "bold" ? "normal" : "bold" })}
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
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {BRAND_COLORS.map((c) => (
                    <Box
                      key={c}
                      onClick={() => patch(selected.id, { fill: c })}
                      sx={{ width: 20, height: 20, borderRadius: 0.75, bgcolor: c, cursor: "pointer", border: selected.fill === c ? "2px solid #274e64" : "1px solid #d5d9df" }}
                    />
                  ))}
                </Box>
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
                Select an element to style it · double-click text to edit · drag to move (snaps to center)
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {itemId && (
              <Button onClick={attachToDraft} disabled={saving} startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} variant="contained" sx={{ bgcolor: "#274e64", fontWeight: 700 }}>
                {saving ? "Attaching…" : "Attach to draft"}
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

        {/* canvas */}
        <Box sx={{ display: "inline-block", boxShadow: "0 4px 24px rgba(22,48,63,0.14)", borderRadius: 1, overflow: "hidden", bgcolor: "#fff" }}>
          <Stage
            ref={stageRef}
            width={canvas.w * scale}
            height={canvas.h * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
            onKeyDown={undefined}
          >
            <Layer ref={layerRef}>
              <Rect x={0} y={0} width={canvas.w} height={canvas.h} fill={bgColor} listening={false} />
              {bgImage && bgFit && (
                <KImage image={bgImage} x={bgFit.x} y={bgFit.y} width={bgFit.width} height={bgFit.height} listening={false} />
              )}
              {nodes.map((n) =>
                n.kind === "text" ? (
                  <KText
                    key={n.id}
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
                    lineHeight={1.25}
                    draggable
                    onClick={() => setSelectedId(n.id)}
                    onTap={() => setSelectedId(n.id)}
                    onDblClick={() => editTextInline(n)}
                    onDragMove={onDragMove}
                    onDragEnd={(e) => onDragEnd(e, n.id)}
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
                ) : (
                  <Rect
                    key={n.id}
                    id={n.id}
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    fill={n.fill}
                    cornerRadius={n.cornerRadius}
                    draggable
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
                <Line points={[guides.v, 0, guides.v, canvas.h]} stroke="#ed1b2f" strokeWidth={1 / scale} dash={[6, 4]} listening={false} />
              )}
              {guides.h !== undefined && (
                <Line points={[0, guides.h, canvas.w, guides.h]} stroke="#ed1b2f" strokeWidth={1 / scale} dash={[6, 4]} listening={false} />
              )}
              <Transformer
                ref={trRef}
                rotateEnabled={false}
                anchorSize={9}
                borderStroke="#274e64"
                anchorStroke="#274e64"
                anchorFill="#ffffff"
                keepRatio={false}
              />
            </Layer>
          </Stage>
        </Box>
      </Box>
    </Box>
  );
}
