"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import DownloadIcon from "@mui/icons-material/Download";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ImageIcon from "@mui/icons-material/Image";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import type { TemplateSpec, TextField as TemplateField } from "@/data/templates";
import { readGallery, pushToGallery, type GalleryImage } from "@/lib/imageGallery";

type Values = Record<string, string>;

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  // Preserve explicit line breaks, then wrap each segment by width.
  const out: string[] = [];
  const segments = text.split(/\r?\n/);
  for (const seg of segments) {
    if (out.length >= maxLines) break;
    const words = seg.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        if (out.length >= maxLines) break;
        line = w;
      } else {
        line = test;
      }
    }
    if (out.length < maxLines && line) out.push(line);
  }
  return out.slice(0, maxLines);
}

function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number
) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + letterSpacing;
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function drawField(
  ctx: CanvasRenderingContext2D,
  field: TemplateField,
  value: string
) {
  // Cover placeholder
  ctx.fillStyle = field.cover.color;
  ctx.fillRect(field.cover.x, field.cover.y, field.cover.w, field.cover.h);

  // Text
  const text = field.uppercase ? value.toUpperCase() : value;
  ctx.fillStyle = field.color;
  ctx.textBaseline = "top";
  ctx.textAlign = field.align ?? "left";
  ctx.font = `${field.fontWeight} ${field.fontSize}px ${field.fontFamily}`;

  const lines = wrapLines(ctx, text, field.maxWidth, field.maxLines ?? 4);
  const lh = field.fontSize * field.lineHeight;
  for (let i = 0; i < lines.length; i++) {
    const y = field.y + i * lh;
    if (field.letterSpacing && field.letterSpacing > 0) {
      drawLetterSpaced(ctx, lines[i], field.x, y, field.letterSpacing);
    } else {
      ctx.fillText(lines[i], field.x, y);
    }
  }
}

// Clip to a cloud-ish rounded shape for the Event Recap photo slot.
function cloudPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.beginPath();
  const r = Math.min(w, h) * 0.5;
  ctx.moveTo(x + r, y + h);
  ctx.arc(x + r, y + h * 0.6, r * 0.85, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + w * 0.35, y + r * 0.9, r * 0.75, Math.PI, Math.PI * 1.85);
  ctx.arc(x + w * 0.62, y + r * 0.7, r * 0.95, Math.PI * 1.15, Math.PI * 1.95);
  ctx.arc(x + w - r, y + h * 0.55, r * 0.9, Math.PI * 1.5, Math.PI * 0.5);
  ctx.lineTo(x + r, y + h);
  ctx.closePath();
}

export default function TemplateEditor({ template }: { template: TemplateSpec }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(template.fields.map((f) => [f.id, f.defaultValue]))
  );
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoPrompt, setPhotoPrompt] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const photoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setGallery(readGallery());
    const onUpdate = () => setGallery(readGallery());
    window.addEventListener("apsoMH:gallery:update", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("apsoMH:gallery:update", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  // Load the template background once.
  useEffect(() => {
    let cancelled = false;
    setValues(Object.fromEntries(template.fields.map((f) => [f.id, f.defaultValue])));
    setPhotoUrl("");
    setPhotoPrompt("");
    bgImgRef.current = null;
    photoImgRef.current = null;
    loadImage(template.src)
      .then((img) => {
        if (!cancelled) {
          bgImgRef.current = img;
          render();
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  // Load generated / uploaded photo when URL changes.
  useEffect(() => {
    let cancelled = false;
    if (!photoUrl) {
      photoImgRef.current = null;
      render();
      return;
    }
    loadImage(photoUrl)
      .then((img) => {
        if (!cancelled) {
          photoImgRef.current = img;
          render();
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const bg = bgImgRef.current;
    if (!canvas || !bg) return;
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    // Big background covers — wipe baked-in placeholder text in one pass.
    if (template.coverRegions) {
      for (const r of template.coverRegions) {
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }

    // Photo slot (below text so text stays readable on top of photo).
    if (template.photoSlot && photoImgRef.current) {
      const slot = template.photoSlot;
      const ph = photoImgRef.current;
      ctx.save();
      if (slot.mask === "cloud") {
        cloudPath(ctx, slot.x, slot.y, slot.w, slot.h);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(slot.x, slot.y, slot.w, slot.h);
        ctx.clip();
      }
      // Object-fit: cover
      const ratio = ph.width / ph.height;
      const slotRatio = slot.w / slot.h;
      let dw = slot.w;
      let dh = slot.h;
      let dx = slot.x;
      let dy = slot.y;
      if (ratio > slotRatio) {
        dw = slot.h * ratio;
        dx = slot.x - (dw - slot.w) / 2;
      } else {
        dh = slot.w / ratio;
        dy = slot.y - (dh - slot.h) / 2;
      }
      ctx.drawImage(ph, dx, dy, dw, dh);
      ctx.restore();
    }

    // Text fields
    for (const field of template.fields) {
      drawField(ctx, field, values[field.id] ?? "");
    }
  }, [template, values]);

  useEffect(() => {
    render();
  }, [render, values, photoUrl]);

  async function generatePhoto() {
    const brief = photoPrompt.trim();
    if (!brief) {
      setError("Add a short image brief first (what should the photo show?).");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: brief }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setPhotoUrl(data.imageUrl);
        pushToGallery({ url: data.imageUrl, brief, source: "template" });
      } else {
        setError(data.imageError ?? data.error ?? "Image generation failed");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `apso-${template.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
      },
      "image/png",
      1
    );
  }

  function reset() {
    setValues(Object.fromEntries(template.fields.map((f) => [f.id, f.defaultValue])));
    setPhotoUrl("");
    setPhotoPrompt("");
    setError(null);
  }

  async function autofillText() {
    setError(null);
    setGenerating(true);
    try {
      const names = template.fields.map((f) => f.id).join(", ");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "linkedin",
          prompt: `Fill these template fields for the APSOparts template "${template.name}". Return ONLY a JSON object with exactly these keys: ${names}. Keep values short enough to fit their role (titles short and punchy, subheadlines 1-2 lines).${
            photoPrompt.trim() ? ` Context: ${photoPrompt.trim()}.` : ""
          }`,
          model: "claude",
          context: { templateId: template.id },
          withImage: false,
        }),
      });
      const data = await res.json();
      if (data.content) {
        const m = data.content.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]) as Record<string, unknown>;
            setValues((cur) => {
              const next = { ...cur };
              for (const f of template.fields) {
                const v = parsed[f.id];
                if (typeof v === "string") next[f.id] = v;
              }
              return next;
            });
          } catch {
            setError("Model returned non-JSON for autofill");
          }
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  const canvasAspect = useMemo(() => `${template.width} / ${template.height}`, [template]);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 360px" },
        gap: 0,
        bgcolor: "#ffffff",
      }}
    >
      <Box
        sx={{
          bgcolor: "#f4f6fa",
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 420,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 720,
            aspectRatio: canvasAspect,
            bgcolor: "#ffffff",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </Box>
      </Box>

      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2, maxHeight: "90vh", overflow: "auto" }}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a3a4c" }}>
            {template.name}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#5f6368", mt: 0.25 }}>
            {template.description}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
            <Chip label={`${template.width}×${template.height}`} size="small" variant="outlined" />
            <Chip label={template.category} size="small" variant="outlined" />
          </Box>
        </Box>
        <Divider />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>
              Text
            </Typography>
            <Tooltip title="Fill text with AI (brain-informed)">
              <span>
                <Button
                  size="small"
                  onClick={autofillText}
                  disabled={generating}
                  startIcon={<AutoAwesomeIcon fontSize="small" />}
                  sx={{ textTransform: "none", color: "#ed1b2f", fontWeight: 600 }}
                >
                  Autofill
                </Button>
              </span>
            </Tooltip>
          </Box>
          {template.fields.map((f) => (
            <TextField
              key={f.id}
              label={f.label}
              value={values[f.id] ?? ""}
              onChange={(e) => setValues((cur) => ({ ...cur, [f.id]: e.target.value }))}
              size="small"
              fullWidth
              multiline={f.multiline}
              minRows={f.multiline ? 2 : 1}
            />
          ))}
        </Box>

        {template.photoSlot && (
          <>
            <Divider />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ImageIcon sx={{ color: "#ed1b2f", fontSize: 18 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Photo slot
                </Typography>
              </Box>
              {gallery.length > 0 && (
                <FormControl size="small" fullWidth>
                  <InputLabel id="gallery-label">Use generated photo</InputLabel>
                  <Select
                    labelId="gallery-label"
                    label="Use generated photo"
                    value={gallery.find((g) => g.url === photoUrl)?.url ?? ""}
                    onChange={(e) => {
                      const url = String(e.target.value);
                      const hit = gallery.find((g) => g.url === url);
                      if (hit) {
                        setPhotoUrl(hit.url);
                        if (!photoPrompt.trim() && hit.brief) setPhotoPrompt(hit.brief);
                      }
                    }}
                    renderValue={(val) => {
                      const hit = gallery.find((g) => g.url === val);
                      if (!hit) return "Pick from recently generated";
                      return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            component="img"
                            src={hit.url}
                            alt=""
                            sx={{ width: 28, height: 28, borderRadius: 0.5, objectFit: "cover" }}
                          />
                          <Typography sx={{ fontSize: 12, color: "#1a3a4c" }} noWrap>
                            {hit.brief || hit.source}
                          </Typography>
                        </Box>
                      );
                    }}
                  >
                    {gallery.map((g) => (
                      <MenuItem key={g.url} value={g.url} sx={{ py: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, width: "100%" }}>
                          <Box
                            component="img"
                            src={g.url}
                            alt=""
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 0.5,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#1a3a4c" }} noWrap>
                              {g.brief || "(no brief)"}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: "#5f6368" }}>
                              from {g.source}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField
                label="Image brief"
                placeholder="What should the photo show?"
                value={photoPrompt}
                onChange={(e) => setPhotoPrompt(e.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={2}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={generatePhoto}
                  disabled={generating}
                  variant="contained"
                  startIcon={<AutoFixHighIcon fontSize="small" />}
                  sx={{
                    flex: 1,
                    bgcolor: "#ed1b2f",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { bgcolor: "#c91528" },
                  }}
                >
                  {generating ? "Working…" : "Generate"}
                </Button>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon fontSize="small" />}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Upload
                  <input type="file" hidden accept="image/*" onChange={onUpload} />
                </Button>
              </Box>
              {photoUrl && (
                <Button
                  onClick={() => setPhotoUrl("")}
                  size="small"
                  sx={{ textTransform: "none", color: "#5f6368" }}
                >
                  Remove photo
                </Button>
              )}
            </Box>
          </>
        )}

        {generating && <LinearProgress sx={{ borderRadius: 1 }} />}
        {error && (
          <Box sx={{ p: 1.25, bgcolor: "#fdebed", border: "1px solid #ed1b2f", borderRadius: 1 }}>
            <Typography sx={{ fontSize: 11.5, color: "#ed1b2f" }}>{error}</Typography>
          </Box>
        )}

        <Divider />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={download}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{
              flex: 1,
              bgcolor: "#274e64",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { bgcolor: "#1a3a4c" },
            }}
          >
            Download PNG
          </Button>
          <Tooltip title="Reset to defaults">
            <IconButton onClick={reset} sx={{ border: "1px solid #dde1e6" }}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}