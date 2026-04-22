"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AutoAwesomeMotionIcon from "@mui/icons-material/AutoAwesomeMotion";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CollectionsIcon from "@mui/icons-material/Collections";
import { readGallery, pushToGallery, clearGallery, type GalleryImage } from "@/lib/imageGallery";

type Aspect = "1:1" | "16:9" | "4:5" | "3:2";
type Reference = { id: string; dataUrl: string; note: string };
type Result = { id: string; url: string; brief: string; pending?: boolean; error?: string };

export default function PhotoStudio({
  audiences,
  categories,
}: {
  audiences: string[];
  categories: string[];
}) {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [category, setCategory] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [refs, setRefs] = useState<Reference[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);

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

  function onUploadRef(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setRefs((cur) => [
            ...cur,
            { id: crypto.randomUUID(), dataUrl: reader.result as string, note: "" },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeRef(id: string) {
    setRefs((cur) => cur.filter((r) => r.id !== id));
  }

  function setRefNote(id: string, note: string) {
    setRefs((cur) => cur.map((r) => (r.id === id ? { ...r, note } : r)));
  }

  async function generateOne() {
    if (!brief.trim()) {
      setError("Add a brief — what should the photo show?");
      return;
    }
    setError(null);
    setBusy(true);
    const id = crypto.randomUUID();
    setResults((cur) => [{ id, url: "", brief, pending: true }, ...cur]);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: brief,
          aspect,
          filters: {
            audience: audience || undefined,
            category: category || undefined,
            wantsImage: true,
          },
          references: refs.map((r) => ({ dataUrl: r.dataUrl, note: r.note })),
          referenceNotes: refs
            .map((r, i) => (r.note.trim() ? `Reference ${i + 1}: ${r.note.trim()}` : ""))
            .filter(Boolean)
            .join("\n"),
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setResults((cur) =>
          cur.map((r) => (r.id === id ? { ...r, url: data.imageUrl, pending: false } : r))
        );
        pushToGallery({ url: data.imageUrl, brief, source: "composer" });
      } else {
        setResults((cur) =>
          cur.map((r) =>
            r.id === id
              ? { ...r, pending: false, error: data.imageError ?? data.error ?? "Failed" }
              : r
          )
        );
        setError(data.imageError ?? data.error ?? "Image generation failed");
      }
    } catch (err) {
      setError(String(err));
      setResults((cur) =>
        cur.map((r) => (r.id === id ? { ...r, pending: false, error: String(err) } : r))
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateThree() {
    if (!brief.trim()) {
      setError("Add a brief — what should the photo show?");
      return;
    }
    setError(null);
    setBusy(true);
    const seeds = [
      "",
      " (alternative angle: closer macro detail)",
      " (alternative angle: wider establishing shot)",
    ];
    try {
      await Promise.all(
        seeds.map(async (suffix) => {
          const id = crypto.randomUUID();
          const fullBrief = `${brief}${suffix}`;
          setResults((cur) => [{ id, url: "", brief: fullBrief, pending: true }, ...cur]);
          try {
            const res = await fetch("/api/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: fullBrief,
                aspect,
                filters: {
                  audience: audience || undefined,
                  category: category || undefined,
                  wantsImage: true,
                },
                references: refs.map((r) => ({ dataUrl: r.dataUrl, note: r.note })),
              }),
            });
            const data = await res.json();
            if (data.imageUrl) {
              setResults((cur) =>
                cur.map((r) =>
                  r.id === id ? { ...r, url: data.imageUrl, pending: false } : r
                )
              );
              pushToGallery({ url: data.imageUrl, brief: fullBrief, source: "composer" });
            } else {
              setResults((cur) =>
                cur.map((r) =>
                  r.id === id
                    ? {
                        ...r,
                        pending: false,
                        error: data.imageError ?? data.error ?? "Failed",
                      }
                    : r
                )
              );
            }
          } catch (err) {
            setResults((cur) =>
              cur.map((r) => (r.id === id ? { ...r, pending: false, error: String(err) } : r))
            );
          }
        })
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadResult(r: Result) {
    if (!r.url) return;
    const a = document.createElement("a");
    a.href = r.url;
    a.download = `apso-${r.id}.png`;
    a.click();
  }

  function removeResult(id: string) {
    setResults((cur) => cur.filter((r) => r.id !== id));
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "360px 1fr" }, gap: 2.5 }}>
      {/* Left controls */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1.5 }}>
            Brief
          </Typography>
          <TextField
            placeholder="e.g. A maintenance engineer's gloved hand replacing an O-ring on a hydraulic cylinder, side view, soft daylight from a workshop window."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />

          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
            Filters
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Audience</InputLabel>
              <Select
                label="Audience"
                value={audience}
                onChange={(e) => setAudience(String(e.target.value))}
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {audiences.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(String(e.target.value))}
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#5f6368", mb: 0.5 }}>
                Aspect ratio
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={aspect}
                onChange={(_, v) => v && setAspect(v)}
                sx={{ flexWrap: "wrap" }}
              >
                {(["1:1", "16:9", "4:5", "3:2"] as Aspect[]).map((a) => (
                  <ToggleButton key={a} value={a} sx={{ textTransform: "none", py: 0.4, px: 1.25, fontSize: 12 }}>
                    {a}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Reference photos
            </Typography>
            <Button
              component="label"
              size="small"
              startIcon={<UploadFileIcon fontSize="small" />}
              sx={{ textTransform: "none", color: "#274e64", fontWeight: 600 }}
            >
              Upload
              <input type="file" hidden accept="image/*" multiple onChange={onUploadRef} />
            </Button>
          </Box>
          {refs.length === 0 ? (
            <Typography sx={{ fontSize: 11, color: "#9aa0a6", fontStyle: "italic" }}>
              Drop in 1–3 reference photos (Midjourney exports, mood images, ANP samples). The
              model will use them as style anchors for this generation.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {refs.map((r) => (
                <Box key={r.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Box
                    component="img"
                    src={r.dataUrl}
                    alt=""
                    sx={{ width: 56, height: 56, borderRadius: 1, objectFit: "cover", flexShrink: 0 }}
                  />
                  <TextField
                    placeholder="Optional note (e.g. 'match the lighting')"
                    value={r.note}
                    onChange={(e) => setRefNote(r.id, e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <IconButton size="small" onClick={() => removeRef(r.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={generateOne}
            disabled={busy}
            variant="contained"
            startIcon={<AutoFixHighIcon />}
            sx={{
              flex: 1,
              bgcolor: "#ed1b2f",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { bgcolor: "#c91528" },
            }}
          >
            Generate
          </Button>
          <Tooltip title="Generate 3 angle variations of the same brief">
            <span>
              <Button
                onClick={generateThree}
                disabled={busy}
                variant="outlined"
                startIcon={<AutoAwesomeMotionIcon />}
                sx={{ textTransform: "none", fontWeight: 700, color: "#274e64", borderColor: "#274e64" }}
              >
                ×3
              </Button>
            </span>
          </Tooltip>
        </Box>

        {busy && <LinearProgress sx={{ borderRadius: 1 }} />}
        {error && (
          <Box sx={{ p: 1.25, bgcolor: "#fdebed", border: "1px solid #ed1b2f", borderRadius: 1 }}>
            <Typography sx={{ fontSize: 11.5, color: "#ed1b2f" }}>{error}</Typography>
          </Box>
        )}
      </Box>

      {/* Right results + archive */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1a3a4c" }}>
              This session
            </Typography>
            <Chip label={results.length} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
          </Box>
          {results.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                borderRadius: 2,
                borderStyle: "dashed",
                textAlign: "center",
                color: "#5f6368",
              }}
            >
              <Typography sx={{ fontSize: 13 }}>
                Nothing generated yet. Write a brief, optionally pick an audience and category, and click <b>Generate</b>.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {results.map((r) => (
                <Paper key={r.id} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <Box
                    sx={{
                      width: "100%",
                      aspectRatio: aspectRatioCss(aspect),
                      bgcolor: "#eceff1",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {r.pending ? (
                      <Box sx={{ textAlign: "center" }}>
                        <LinearProgress sx={{ width: 120, mb: 1 }} />
                        <Typography sx={{ fontSize: 11, color: "#5f6368" }}>Generating…</Typography>
                      </Box>
                    ) : r.url ? (
                      <Box
                        component="img"
                        src={r.url}
                        alt={r.brief}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 11, color: "#ed1b2f", px: 2, textAlign: "center" }}>
                        {r.error ?? "No image"}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ p: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      sx={{ fontSize: 11, color: "#5f6368", flex: 1, minWidth: 0 }}
                      noWrap
                      title={r.brief}
                    >
                      {r.brief}
                    </Typography>
                    <Tooltip title="Download">
                      <span>
                        <IconButton size="small" disabled={!r.url} onClick={() => downloadResult(r)}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" onClick={() => removeResult(r.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>

        <Divider />

        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CollectionsIcon sx={{ fontSize: 18, color: "#274e64" }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1a3a4c", flex: 1 }}>
              Recent archive (cross-app)
            </Typography>
            <Chip
              label={`${gallery.length} / 6`}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
            {gallery.length > 0 && (
              <Tooltip title="Clear local archive">
                <IconButton
                  size="small"
                  onClick={() => {
                    clearGallery();
                    setGallery([]);
                  }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: "#9aa0a6", mb: 1 }}>
            Shared with the Composer and Templates editor. Phase 1 is browser-local, Phase 2
            (AWS) will move this to a persistent gold-image library.
          </Typography>
          {gallery.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, borderStyle: "dashed", textAlign: "center" }}
            >
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
                No archived images yet.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" },
                gap: 1,
              }}
            >
              {gallery.map((g) => (
                <Box
                  key={g.url}
                  sx={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    borderRadius: 1,
                    overflow: "hidden",
                    border: "1px solid #dde1e6",
                    cursor: "zoom-in",
                  }}
                  title={g.brief}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = g.url;
                    a.download = `apso-archive-${g.createdAt}.png`;
                    a.click();
                  }}
                >
                  <Box
                    component="img"
                    src={g.url}
                    alt={g.brief}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      bgcolor: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      fontSize: 9,
                      px: 0.5,
                      py: 0.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.source}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function aspectRatioCss(a: Aspect): string {
  return a.replace(":", " / ");
}