"use client";
import { useEffect, useMemo, useState } from "react";
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
import Slider from "@mui/material/Slider";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AutoAwesomeMotionIcon from "@mui/icons-material/AutoAwesomeMotion";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CollectionsIcon from "@mui/icons-material/Collections";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { pushToGallery } from "@/lib/imageGallery";
import {
  archivePhoto,
  clearArchive,
  deleteArchive,
  listArchive,
  updateArchive,
  PHOTO_ARCHIVE_EVENT,
  PHOTO_ARCHIVE_CAP,
  type ArchivedPhoto,
} from "@/lib/photoArchive";

type Aspect = "1:1" | "16:9" | "4:5" | "3:2";
type ContentType = "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
type Framework = "auto" | "ican" | "ease" | "recognition";
type Reference = { id: string; dataUrl: string; note: string };
type Result = { id: string; url: string; brief: string; pending?: boolean; error?: string };

const CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: "linkedin", label: "LinkedIn post" },
  { id: "newsletter", label: "Newsletter" },
  { id: "blog", label: "Blog header" },
  { id: "ad", label: "Paid ad" },
  { id: "product", label: "Product mood" },
  { id: "seo", label: "SEO category" },
];

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "ican", label: "I can do this now" },
  { id: "ease", label: "Ease / feature" },
  { id: "recognition", label: "We've already met" },
];

export default function PhotoStudio({
  audiences,
  categories,
  toneAdjectives,
}: {
  audiences: string[];
  categories: string[];
  toneAdjectives: string[];
  signaturePhrases: string[];
}) {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [category, setCategory] = useState("");
  const [contentType, setContentType] = useState<ContentType>("linkedin");
  const [framework, setFramework] = useState<Framework>("auto");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [creativity, setCreativity] = useState<number>(70);
  const [selectedTones, setSelectedTones] = useState<string[]>(toneAdjectives.slice(0, 2));
  const [refs, setRefs] = useState<Reference[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchivedPhoto[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const list = await listArchive();
      if (alive) {
        setArchive(list);
        setArchiveLoading(false);
      }
    };
    void refresh();
    window.addEventListener(PHOTO_ARCHIVE_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(PHOTO_ARCHIVE_EVENT, refresh);
    };
  }, []);

  const filterContext = useMemo(
    () => ({
      contentType,
      framework,
      audience: audience || undefined,
      category: category || undefined,
      creativity,
      emphasizeTones: selectedTones,
      wantsImage: true,
    }),
    [contentType, framework, audience, category, creativity, selectedTones]
  );

  // Brief placeholder adapts to the selected filters so the user gets a concrete
  // example of the kind of brief that lands well on the current setup.
  const adaptivePlaceholder = useMemo(() => {
    const audPart =
      audience === "Chemical process engineers"
        ? "A chemical process engineer's gloved hand inspecting an EPDM gasket on a stainless reactor flange"
        : audience === "Pharma / GMP engineers"
          ? "A pharma operator in clean garments checking a sanitary seal on stainless GMP piping"
          : audience === "Food & beverage engineers"
            ? "A food-grade clean stainless CIP line with sanitary fittings, operator hand near a tri-clamp"
            : audience === "Maintenance engineers"
              ? "A maintenance engineer's gloved hand replacing an O-ring on a hydraulic cylinder, side view, soft daylight"
              : audience === "Plant managers"
                ? "Wide elevated overview of a production line with the floor manager observing"
                : audience === "Hydraulics & pneumatics specialists"
                  ? "Hydraulic power unit with pneumatic cylinders and pressure gauges, technician adjusting a valve"
                  : "A maintenance engineer's gloved hand replacing an O-ring on a hydraulic cylinder";
    const catPart =
      category === "Engineering Plastics Technology"
        ? " near a CNC mill — PEEK or POM stock visible on the workbench"
        : category === "Drive Technology"
          ? " on a real drive train with timing belts and pulleys"
          : category === "Antivibration Technology"
            ? " with vibration mounts installed on a motor frame"
            : category === "Fluid Handling Technology"
              ? " on a fluid circuit with pressure gauge in frame"
              : "";
    return `${audPart}${catPart}, soft natural daylight from a workshop window.`;
  }, [audience, category]);

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

  async function generate(briefOverride?: string, parentId?: string) {
    const finalBrief = (briefOverride ?? brief).trim();
    if (!finalBrief) {
      setError("Add a brief — what should the photo show?");
      return;
    }
    setError(null);
    setBusy(true);
    const id = crypto.randomUUID();
    setResults((cur) => [{ id, url: "", brief: finalBrief, pending: true }, ...cur]);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalBrief,
          aspect,
          filters: filterContext,
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
        // Persist to the page archive (IndexedDB) and the cross-app gallery (localStorage).
        await archivePhoto({
          url: data.imageUrl,
          brief: finalBrief,
          audience: audience || undefined,
          category: category || undefined,
          aspect,
          source: "studio",
          parentId,
        });
        pushToGallery({ url: data.imageUrl, brief: finalBrief, source: "composer" });
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
    const seeds = [
      "",
      " (alternative angle: closer macro detail)",
      " (alternative angle: wider establishing shot)",
    ];
    setBusy(true);
    setError(null);
    try {
      await Promise.all(seeds.map((suffix) => generate(`${brief}${suffix}`)));
    } finally {
      setBusy(false);
    }
  }

  function downloadUrl(url: string, label: string) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `apso-${label}.png`;
    a.click();
  }

  function removeResult(id: string) {
    setResults((cur) => cur.filter((r) => r.id !== id));
  }

  // Retouch: load the source image as a reference, prefill the brief with a
  // "modify" prefix, scroll the brief into view. Triggers a new generation cycle.
  function retouchFromArchive(p: ArchivedPhoto) {
    setRefs((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        dataUrl: p.url,
        note: "Retouch this image — keep composition, modify per brief.",
      },
    ]);
    setBrief(`Retouch the reference image: ${p.brief}. Modify: `);
    if (p.audience) setAudience(p.audience);
    if (p.category) setCategory(p.category);
    if (p.aspect) setAspect(p.aspect as Aspect);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function setFeedback(p: ArchivedPhoto, fb: "like" | "dislike") {
    const next = p.feedback === fb ? undefined : fb;
    setArchive((cur) => cur.map((x) => (x.id === p.id ? { ...x, feedback: next } : x)));
    await updateArchive(p.id, { feedback: next });
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "380px 1fr" }, gap: 2.5 }}>
      {/* ── Left controls ─────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1.5 }}>
            Brief
          </Typography>
          <TextField
            placeholder={adaptivePlaceholder}
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
              <InputLabel>Content type</InputLabel>
              <Select
                label="Content type"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ContentType)}
              >
                {CONTENT_TYPES.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Framework</InputLabel>
              <Select
                label="Framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value as Framework)}
              >
                {FRAMEWORKS.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#5f6368" }}>
                  Creativity
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#1a3a4c", fontWeight: 700 }}>
                  {creativity}
                </Typography>
              </Box>
              <Slider
                size="small"
                value={creativity}
                min={0}
                max={100}
                step={5}
                onChange={(_, v) => setCreativity(v as number)}
                sx={{ color: "#ed1b2f" }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#5f6368", mb: 0.5 }}>
                Emphasize tones (max 4)
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {toneAdjectives.map((t) => {
                  const active = selectedTones.includes(t);
                  return (
                    <Chip
                      key={t}
                      label={t}
                      size="small"
                      onClick={() =>
                        setSelectedTones((cur) =>
                          cur.includes(t)
                            ? cur.filter((x) => x !== t)
                            : cur.length >= 4
                              ? cur
                              : [...cur, t]
                        )
                      }
                      sx={{
                        height: 22,
                        fontSize: 11,
                        bgcolor: active ? "#274e64" : "#f1f3f4",
                        color: active ? "#fff" : "#3c4043",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        "&:hover": { bgcolor: active ? "#1a3a4c" : "#e8eaed" },
                      }}
                    />
                  );
                })}
              </Box>
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
              model uses them as style anchors. The Retouch action on archive items also lands
              here.
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
            onClick={() => generate()}
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

      {/* ── Right results + archive ───────────────────────────────── */}
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
                p: 0,
                borderRadius: 2,
                borderStyle: "dashed",
                bgcolor: "#fafbfc",
                width: "100%",
                aspectRatio: aspectRatioCss(aspect),
                maxHeight: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#5f6368",
              }}
            >
              <Box sx={{ textAlign: "center", px: 3 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#274e64", letterSpacing: "0.06em", textTransform: "uppercase", mb: 0.5 }}>
                  {aspect} canvas
                </Typography>
                <Typography sx={{ fontSize: 13 }}>
                  Write a brief, optionally pick filters, click <b>Generate</b>.
                </Typography>
              </Box>
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
                        <IconButton size="small" disabled={!r.url} onClick={() => downloadUrl(r.url, r.id)}>
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
              Archive
            </Typography>
            <Chip
              label={`${archive.length} / ${PHOTO_ARCHIVE_CAP}`}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
            {archive.length > 0 && (
              <Tooltip title="Clear archive">
                <IconButton
                  size="small"
                  onClick={async () => {
                    await clearArchive();
                    setArchive([]);
                  }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: "#9aa0a6", mb: 1.25 }}>
            Browser-local (IndexedDB), survives reload. Like / dislike to teach the model. Retouch
            sends the image back into the references and prefills the brief. Phase 2 (AWS) will
            move this to a persistent gold-image library.
          </Typography>
          {archiveLoading ? (
            <LinearProgress />
          ) : archive.length === 0 ? (
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
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                  lg: "repeat(5, 1fr)",
                },
                gap: 1.25,
              }}
            >
              {archive.map((p) => (
                <ArchiveTile
                  key={p.id}
                  photo={p}
                  onLike={() => setFeedback(p, "like")}
                  onDislike={() => setFeedback(p, "dislike")}
                  onDownload={() => downloadUrl(p.url, `archive-${p.createdAt}`)}
                  onRetouch={() => retouchFromArchive(p)}
                  onDelete={async () => {
                    await deleteArchive(p.id);
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function ArchiveTile({
  photo,
  onLike,
  onDislike,
  onDownload,
  onRetouch,
  onDelete,
}: {
  photo: ArchivedPhoto;
  onLike: () => void;
  onDislike: () => void;
  onDownload: () => void;
  onRetouch: () => void;
  onDelete: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative",
        borderRadius: 1.5,
        overflow: "hidden",
        borderColor:
          photo.feedback === "like"
            ? "#34a853"
            : photo.feedback === "dislike"
              ? "#ed1b2f"
              : "#dde1e6",
        "&:hover .archive-actions": { opacity: 1 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          aspectRatio: photo.aspect ? photo.aspect.replace(":", " / ") : "1 / 1",
          bgcolor: "#eceff1",
        }}
      >
        <Box
          component="img"
          src={photo.url}
          alt={photo.brief}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Box>
      <Box
        className="archive-actions"
        sx={{
          position: "absolute",
          top: 6,
          right: 6,
          display: "flex",
          gap: 0.25,
          opacity: 0,
          transition: "opacity 0.2s",
        }}
      >
        <ActionIcon title="Like" active={photo.feedback === "like"} onClick={onLike} color="#34a853">
          {photo.feedback === "like" ? (
            <ThumbUpIcon sx={{ fontSize: 14 }} />
          ) : (
            <ThumbUpOffAltIcon sx={{ fontSize: 14 }} />
          )}
        </ActionIcon>
        <ActionIcon
          title="Dislike"
          active={photo.feedback === "dislike"}
          onClick={onDislike}
          color="#ed1b2f"
        >
          {photo.feedback === "dislike" ? (
            <ThumbDownIcon sx={{ fontSize: 14 }} />
          ) : (
            <ThumbDownOffAltIcon sx={{ fontSize: 14 }} />
          )}
        </ActionIcon>
        <ActionIcon title="Retouch" onClick={onRetouch} color="#274e64">
          <EditNoteIcon sx={{ fontSize: 14 }} />
        </ActionIcon>
        <ActionIcon title="Download" onClick={onDownload} color="#274e64">
          <DownloadIcon sx={{ fontSize: 14 }} />
        </ActionIcon>
        <ActionIcon title="Delete" onClick={onDelete} color="#5f6368">
          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
        </ActionIcon>
      </Box>
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: "rgba(0,0,0,0.55)",
          color: "#fff",
          px: 0.75,
          py: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <Typography sx={{ fontSize: 10, flex: 1, minWidth: 0 }} noWrap title={photo.brief}>
          {photo.brief}
        </Typography>
        {photo.aspect && (
          <Chip
            label={photo.aspect}
            size="small"
            sx={{ height: 14, fontSize: 8, bgcolor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700 }}
          />
        )}
      </Box>
    </Paper>
  );
}

function ActionIcon({
  title,
  active,
  color,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: 24,
          height: 24,
          bgcolor: active ? color : "rgba(255,255,255,0.92)",
          color: active ? "#fff" : color,
          "&:hover": { bgcolor: active ? color : "#fff" },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

function aspectRatioCss(a: Aspect): string {
  return a.replace(":", " / ");
}