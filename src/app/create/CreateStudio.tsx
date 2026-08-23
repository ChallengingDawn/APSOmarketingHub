"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Collapse from "@mui/material/Collapse";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ImageIcon from "@mui/icons-material/Image";
import TuneIcon from "@mui/icons-material/Tune";
import PsychologyIcon from "@mui/icons-material/Psychology";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BoltIcon from "@mui/icons-material/Bolt";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ArticleIcon from "@mui/icons-material/Article";
import CampaignIcon from "@mui/icons-material/Campaign";
import InventoryIcon from "@mui/icons-material/Inventory";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import ReplayIcon from "@mui/icons-material/Replay";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import MarkdownPreview from "./MarkdownPreview";
import Link from "next/link";

/* ── types ── */

type Persona = {
  id: string;
  code: string;
  name: string;
  role: string;
  description: string;
};

type Brain = {
  brandVoice?: { audiences?: string[]; signaturePhrases?: string[]; toneAdjectives?: string[] };
  personas?: Persona[];
  keywordSignals?: { internalSearchTrends?: { term: string; signal: string }[] };
  categoryIntelligence?: {
    topLevel?: { en: string }[];
    totalLeafCategories?: number;
    categoriesWithSeoText?: number;
  };
  goldExamples?: { linkedinPosts?: unknown[]; paidAds?: unknown[] };
};

type Quality = { violationsFound: string[]; revised: boolean };

type DraftResult = {
  content: string;
  draftId?: number;
  quality?: Quality;
  imageBrief?: string;
  imageUrl?: string;
};

type Concept = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl?: string;
  imageBusy?: boolean;
  expanded?: boolean;
};

const CHANNELS = [
  { key: "linkedin", label: "LinkedIn", icon: <LinkedInIcon fontSize="small" /> },
  { key: "blog", label: "Blog", icon: <ArticleIcon fontSize="small" /> },
  { key: "newsletter", label: "Newsletter", icon: <NewspaperIcon fontSize="small" /> },
  { key: "ad", label: "Ad", icon: <CampaignIcon fontSize="small" /> },
  { key: "product", label: "Product", icon: <InventoryIcon fontSize="small" /> },
  { key: "seo", label: "SEO", icon: <TravelExploreIcon fontSize="small" /> },
];

const LANGS = ["EN", "DE", "FR", "IT", "NL", "PL", "ES"];
const NAVY = "#274e64";
const RED = "#ed1b2f";

const geoChannels = new Set(["blog", "seo"]);

/* ── page ── */

const VALID_CHANNELS = new Set(CHANNELS.map((c) => c.key));

export default function CreateStudio({ initialChannel }: { initialChannel?: string }) {
  const [brain, setBrain] = useState<Brain | null>(null);

  /* setup state */
  const [channel, setChannel] = useState(
    initialChannel && VALID_CHANNELS.has(initialChannel) ? initialChannel : "linkedin"
  );
  const [personaIds, setPersonaIds] = useState<string[]>([]);
  const [framework, setFramework] = useState("auto");
  const [tones, setTones] = useState<string[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [language, setLanguage] = useState("EN");
  const [audience, setAudience] = useState("");
  const [category, setCategory] = useState("");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [creativity, setCreativity] = useState(70);
  const [length, setLength] = useState("medium");
  const [withImage, setWithImage] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* brief + mode */
  const [topic, setTopic] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [mode, setMode] = useState<"draft" | "concepts">("draft");

  /* results */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [draftFb, setDraftFb] = useState<"" | "like" | "dislike">("");
  const [conceptFb, setConceptFb] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [briefText, setBriefText] = useState("");

  const mdChannel = channel === "blog" || channel === "product";

  /* feedback loop -> /api/logs (teaches the engine; non-blocking) */
  const sendFeedback = (kind: "like" | "dislike", payload: { headline?: string; body: string }, done?: () => void) => {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind, channel, prompt: topic.slice(0, 500), ...payload }),
    }).catch(() => {});
    done?.();
  };

  useEffect(() => {
    fetch("/api/personality")
      .then((r) => r.json())
      .then(setBrain)
      .catch(() => {});
  }, []);

  const personas = brain?.personas ?? [];
  const audiences = brain?.brandVoice?.audiences ?? [];
  const categories = (brain?.categoryIntelligence?.topLevel ?? []).map((c) => c.en);
  const trends = brain?.keywordSignals?.internalSearchTrends ?? [];
  const activePersonas = personas.filter((p) => personaIds.includes(p.id));
  const toneOptions = brain?.brandVoice?.toneAdjectives ?? [];
  const phraseOptions = brain?.brandVoice?.signaturePhrases ?? [];

  const togglePersona = (id: string) =>
    setPersonaIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleTone = (v: string) =>
    setTones((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const togglePhrase = (v: string) =>
    setPhrases((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const filters = useMemo(
    () => ({
      language,
      ...(audience ? { audience } : {}),
      ...(category ? { category } : {}),
      ...(primaryKeyword.trim() ? { primaryKeyword: primaryKeyword.trim() } : {}),
      ...(secondaryKeywords.trim()
        ? { secondaryKeywords: secondaryKeywords.split(",").map((s) => s.trim()).filter(Boolean) }
        : {}),
      creativity,
      length,
      wantsImage: withImage,
      ...(framework !== "auto" ? { framework } : {}),
      ...(tones.length ? { emphasizeTones: tones } : {}),
      ...(phrases.length ? { emphasizePhrases: phrases } : {}),
    }),
    [language, audience, category, primaryKeyword, secondaryKeywords, creativity, length, withImage, framework, tones, phrases]
  );

  /* ── actions ── */

  const enhanceBrief = async () => {
    if (!topic.trim() || enhancing) return;
    setEnhancing(true);
    setError("");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, topic: topic.trim(), personaIds: personaIds.length ? personaIds : undefined, filters }),
      });
      const data = await res.json();
      if (res.ok && data.brief) setTopic(data.brief);
      else setError(data.error ?? "Brief enhancement failed");
    } catch {
      setError("Network error during brief enhancement");
    } finally {
      setEnhancing(false);
    }
  };

  const generate = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError("");
    setDraft(null);
    setConcepts([]);
    try {
      if (mode === "draft") {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel,
            prompt: topic.trim(),
            context: filters,
            personaIds: personaIds.length ? personaIds : undefined,
            wantBrief: withImage,
          }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Generation failed");
        else {
          setDraft({ content: data.content, draftId: data.draftId, quality: data.quality, imageBrief: data.imageBrief });
          setDraftFb("");
          setEditMode(false);
          setShowRaw(false);
          setBriefText(data.imageBrief ?? "");
        }
      } else {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, topic: topic.trim(), filters, personaIds: personaIds.length ? personaIds : undefined }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Generation failed");
        else
          setConcepts(
            (data.proposals ?? []).map((p: Concept, i: number) => ({ ...p, expanded: i === 0 }))
          );
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  };

  const refine = async () => {
    if (!draft || !refineText.trim() || refining) return;
    setRefining(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          prompt:
            `Refine the following ${channel} content. Instruction from the marketer: ${refineText.trim()}\n\n` +
            `<current-content>\n${draft.content}\n</current-content>\n\n` +
            `Apply the instruction while keeping everything that already works. Return ONLY the full refined content.`,
          context: filters,
          personaIds: personaIds.length ? personaIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Refinement failed");
      else {
        setDraft({ content: data.content, draftId: data.draftId, quality: data.quality, imageBrief: draft.imageBrief, imageUrl: draft.imageUrl });
        setRefineText("");
        setDraftFb("");
        setEditMode(false);
      }
    } catch {
      setError("Network error during refinement");
    } finally {
      setRefining(false);
    }
  };

  const createImage = async () => {
    if (!draft || imageBusy) return;
    setImageBusy(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: briefText.trim() || draft.content.slice(0, 280), filters }),
      });
      const data = await res.json();
      if (data.imageUrl) setDraft((d) => (d ? { ...d, imageUrl: data.imageUrl } : d));
      else setError(data.imageError ?? "Image generation failed");
    } catch {
      setError("Network error during image generation");
    } finally {
      setImageBusy(false);
    }
  };

  const createConceptImage = async (idx: number) => {
    const c = concepts[idx];
    if (!c || c.imageBusy) return;
    setConcepts((cur) => cur.map((x, i) => (i === idx ? { ...x, imageBusy: true } : x)));
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: c.imagePrompt || c.body.slice(0, 280), filters }),
      });
      const data = await res.json();
      setConcepts((cur) =>
        cur.map((x, i) => (i === idx ? { ...x, imageBusy: false, imageUrl: data.imageUrl ?? x.imageUrl } : x))
      );
    } catch {
      setConcepts((cur) => cur.map((x, i) => (i === idx ? { ...x, imageBusy: false } : x)));
    }
  };

  const saveEdit = async () => {
    if (!draft || savingEdit) return;
    const next = editText.trim();
    if (!next) return;
    setSavingEdit(true);
    try {
      if (draft.draftId) {
        const res = await fetch(`/api/content/${draft.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: next }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Saving the edit failed");
          setSavingEdit(false);
          return;
        }
      }
      setDraft((d) => (d ? { ...d, content: next } : d));
      setEditMode(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  /* ── render ── */

  return (
    <Box sx={{ p: 1 }}>
      {/* header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 26, fontWeight: 700, color: "#1a1d21", letterSpacing: "-0.02em" }}>
            Create Studio
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#5b6470" }}>
            One place for everything — persona, keywords, GEO structure and imagery, powered by the brain.
          </Typography>
        </Box>
        <Button component={Link} href="/library" startIcon={<LibraryBooksIcon />} sx={{ fontWeight: 600, color: NAVY }}>
          Library
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {/* ── LEFT: setup ── */}
        <Grid size={{ xs: 12, md: 3.5 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                Channel
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2.5 }}>
                {CHANNELS.map((c) => (
                  <Chip
                    key={c.key}
                    icon={c.icon}
                    label={c.label}
                    onClick={() => setChannel(c.key)}
                    sx={{
                      fontWeight: 600,
                      bgcolor: channel === c.key ? NAVY : "#f0f1f3",
                      color: channel === c.key ? "#fff" : "#3c4043",
                      "& .MuiChip-icon": { color: channel === c.key ? "#fff" : "#5b6470" },
                      "&:hover": { bgcolor: channel === c.key ? "#1a3a4c" : "#e6e8ec" },
                    }}
                  />
                ))}
              </Box>

              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                Write for
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>
                <Box
                  onClick={() => setPersonaIds([])}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: `1.5px solid ${personaIds.length === 0 ? NAVY : "#e6e8ec"}`,
                    bgcolor: personaIds.length === 0 ? "#e8f0f4" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1a1d21" }}>General audience</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>Brand voice — or select one or MORE personas below</Typography>
                </Box>
                {personas.map((p) => {
                  const on = personaIds.includes(p.id);
                  return (
                    <Box
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: `1.5px solid ${on ? NAVY : "#e6e8ec"}`,
                        bgcolor: on ? "#e8f0f4" : "#fff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: NAVY },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: on ? NAVY : "#f0f1f3", color: on ? "#fff" : "#5b6470", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>
                          {on ? "\u2713" : p.code}
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: "#1a1d21" }}>{p.name}</Typography>
                          <Typography noWrap sx={{ fontSize: 11, color: "#5b6470" }}>{p.role}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                {personaIds.length > 1 && (
                  <Typography sx={{ fontSize: 11.5, color: NAVY, fontWeight: 600, px: 0.5 }}>
                    {personaIds.length} personas selected — the engine writes to their shared ground.
                  </Typography>
                )}
              </Box>

              <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
                <Grid size={6}>
                  <TextField select fullWidth size="small" label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGS.map((l) => (
                      <MenuItem key={l} value={l}>{l}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={6}>
                  <TextField select fullWidth size="small" label="Length" value={length} onChange={(e) => setLength(e.target.value)}>
                    <MenuItem value="short">Short</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="long">Long</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={12}>
                  <TextField select fullWidth size="small" label="Product category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <MenuItem value="">Any</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={12}>
                  <TextField select fullWidth size="small" label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                    <MenuItem value="">Any</MenuItem>
                    {audiences.map((a) => (
                      <MenuItem key={a} value={a}>{a}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Button onClick={() => setShowAdvanced(!showAdvanced)} startIcon={<TuneIcon />} size="small" sx={{ color: "#5b6470", fontWeight: 600, mb: 0.5 }}>
                {showAdvanced ? "Hide" : "Show"} SEO & style
              </Button>
              <Collapse in={showAdvanced}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 0.5 }}>
                  <TextField fullWidth size="small" label="Primary keyword" placeholder="e.g. ffkm o-ring" value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} />
                  <TextField fullWidth size="small" label="Secondary keywords (comma-separated)" placeholder="fkm vs ffkm, chemical resistance" value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} />
                  <Box sx={{ px: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: "#5b6470", mb: 0.5 }}>
                      Creativity: <strong>{creativity <= 30 ? "conservative" : creativity <= 60 ? "balanced" : creativity <= 85 ? "fresh" : "bold"}</strong>
                    </Typography>
                    <Slider size="small" value={creativity} onChange={(_, v) => setCreativity(v as number)} sx={{ color: RED }} />
                  </Box>
                  <FormControlLabel
                    control={<Switch checked={withImage} onChange={(e) => setWithImage(e.target.checked)} size="small" />}
                    label={<Typography sx={{ fontSize: 13 }}>Prepare an image brief</Typography>}
                  />
                  <Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                      Framework
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {[
                        { k: "auto", l: "Auto" },
                        { k: "ican", l: "I can do this now" },
                        { k: "ease", l: "Ease / feature" },
                        { k: "recognition", l: "We\u2019ve already met" },
                      ].map((f) => (
                        <Chip
                          key={f.k}
                          label={f.l}
                          size="small"
                          onClick={() => setFramework(f.k)}
                          sx={{ fontWeight: 600, fontSize: 11, bgcolor: framework === f.k ? NAVY : "#f0f1f3", color: framework === f.k ? "#fff" : "#3c4043" }}
                        />
                      ))}
                    </Box>
                  </Box>
                  {toneOptions.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                        Emphasize tone (from brain)
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {toneOptions.map((t) => (
                          <Chip
                            key={t}
                            label={t}
                            size="small"
                            onClick={() => toggleTone(t)}
                            sx={{ fontWeight: 600, fontSize: 11, bgcolor: tones.includes(t) ? RED : "#f0f1f3", color: tones.includes(t) ? "#fff" : "#3c4043" }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {phraseOptions.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                        Signature phrases (force-include)
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {phraseOptions.map((ph) => (
                          <Chip
                            key={ph}
                            label={ph}
                            size="small"
                            onClick={() => togglePhrase(ph)}
                            sx={{ fontWeight: 600, fontSize: 11, justifyContent: "flex-start", bgcolor: phrases.includes(ph) ? NAVY : "#f0f1f3", color: phrases.includes(ph) ? "#fff" : "#3c4043" }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </CardContent>
          </Card>
        </Grid>

        {/* ── CENTER: brief + results ── */}
        <Grid size={{ xs: 12, md: 5.5 }}>
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  The brief
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
                  <ToggleButton value="draft" sx={{ px: 1.5, fontSize: 12, fontWeight: 700 }}>Single draft</ToggleButton>
                  <ToggleButton value="concepts" sx={{ px: 1.5, fontSize: 12, fontWeight: 700 }}>3 concepts</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={14}
                placeholder={`What are we creating? A topic is enough — "Enhance" turns it into a full brief.\ne.g. "Why FFKM o-rings when FKM fails — chemical processing"`}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { fontSize: 13.5, lineHeight: 1.6 } }}
              />
              {trends.length > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.25, flexWrap: "wrap" }}>
                  <TrendingUpIcon sx={{ fontSize: 15, color: RED }} />
                  <Typography sx={{ fontSize: 11.5, color: "#5b6470", fontWeight: 600 }}>Hot demand:</Typography>
                  {trends.slice(0, 4).map((t) => (
                    <Chip
                      key={t.term}
                      label={t.term}
                      size="small"
                      onClick={() => setTopic((cur) => (cur ? `${cur} — target the search term "${t.term}"` : `Content targeting the hot search term "${t.term}" (${t.signal})`))}
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: "#fdebed", color: RED, "&:hover": { bgcolor: "#fbd8dc" } }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: "flex", gap: 1.25, mt: 2 }}>
                <Tooltip title="Expand your topic into a sharp brief using the brain's demand and persona context">
                  <span>
                    <Button
                      onClick={enhanceBrief}
                      disabled={enhancing || !topic.trim()}
                      startIcon={enhancing ? <CircularProgress size={14} /> : <BoltIcon />}
                      sx={{ fontWeight: 700, color: NAVY }}
                    >
                      {enhancing ? "Enhancing…" : "Enhance brief"}
                    </Button>
                  </span>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Button
                  onClick={generate}
                  disabled={busy || !topic.trim()}
                  variant="contained"
                  size="large"
                  startIcon={busy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon />}
                  sx={{ bgcolor: RED, px: 4, fontWeight: 700, "&:hover": { bgcolor: "#d81528" } }}
                >
                  {busy ? (mode === "draft" ? "Writing…" : "Creating 3 concepts…") : "Generate"}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          {/* single draft result */}
          {draft && (
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
                  {draft.draftId && (
                    <Chip icon={<CheckCircleIcon sx={{ fontSize: 15 }} />} label={`Saved · draft #${draft.draftId}`} size="small" sx={{ fontWeight: 700, bgcolor: "#e5f3ea", color: "#1e7e45" }} />
                  )}
                  {draft.quality && draft.quality.violationsFound.length === 0 && (
                    <Chip label="All channel & GEO checks passed" size="small" sx={{ fontWeight: 600, bgcolor: "#e3edf7", color: "#2563a8" }} />
                  )}
                  {draft.quality?.revised && (
                    <Chip label="Auto-refined once ✓" size="small" sx={{ fontWeight: 600, bgcolor: "#fdf6ec", color: "#c77700" }} />
                  )}
                </Box>

                {draft.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 14 }} />
                )}

                {editMode ? (
                  <TextField
                    fullWidth
                    multiline
                    minRows={10}
                    maxRows={30}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { fontSize: 13.5, lineHeight: 1.7, fontFamily: "inherit" } }}
                  />
                ) : mdChannel && !showRaw ? (
                  <MarkdownPreview text={draft.content} />
                ) : (
                  <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.7, color: "#1a1d21" }}>
                    {draft.content}
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Tooltip title="Good one — the engine learns from this">
                    <Button
                      startIcon={<ThumbUpIcon sx={{ fontSize: 16 }} />}
                      onClick={() => sendFeedback("like", { body: draft.content }, () => setDraftFb("like"))}
                      sx={{ fontWeight: 700, color: draftFb === "like" ? "#fff" : "#1e7e45", bgcolor: draftFb === "like" ? "#1e7e45" : "transparent", "&:hover": { bgcolor: draftFb === "like" ? "#17643a" : "#e5f3ea" } }}
                    >
                      {draftFb === "like" ? "Learned ✓" : "Like"}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Not this — type a refine instruction too and it becomes the correction">
                    <Button
                      startIcon={<ThumbDownIcon sx={{ fontSize: 16 }} />}
                      onClick={() => {
                        fetch("/api/logs", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "dislike", channel, prompt: topic.slice(0, 500), body: draft.content, correction: refineText.trim() || undefined }),
                        }).catch(() => {});
                        setDraftFb("dislike");
                      }}
                      sx={{ fontWeight: 700, color: draftFb === "dislike" ? "#fff" : "#c5221f", bgcolor: draftFb === "dislike" ? "#c5221f" : "transparent", "&:hover": { bgcolor: draftFb === "dislike" ? "#a51b1a" : "#fdebed" } }}
                    >
                      {draftFb === "dislike" ? "Noted ✓" : "Dislike"}
                    </Button>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  {editMode ? (
                    <Button startIcon={savingEdit ? <CircularProgress size={14} /> : <SaveIcon />} onClick={saveEdit} disabled={savingEdit} variant="contained" sx={{ bgcolor: NAVY, fontWeight: 700 }}>
                      {savingEdit ? "Saving…" : "Save edit"}
                    </Button>
                  ) : (
                    <Button startIcon={<EditIcon />} onClick={() => { setEditText(draft.content); setEditMode(true); }} sx={{ fontWeight: 600, color: NAVY }}>
                      Edit
                    </Button>
                  )}
                  {mdChannel && !editMode && (
                    <Button onClick={() => setShowRaw((v) => !v)} sx={{ fontWeight: 600, color: "#5b6470" }}>
                      {showRaw ? "Preview" : "Raw markdown"}
                    </Button>
                  )}
                  <Button startIcon={<ContentCopyIcon />} onClick={() => copy(draft.content, "draft")} sx={{ fontWeight: 600 }}>
                    {copied === "draft" ? "Copied!" : "Copy"}
                  </Button>
                  <Button component={Link} href="/library" startIcon={<LibraryBooksIcon />} sx={{ fontWeight: 600, color: "#5b6470" }}>
                    Library
                  </Button>
                </Box>

                {withImage && (
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: "#fafbfc", border: "1px solid #f1f3f4" }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                      Image brief — edit before painting
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      size="small"
                      placeholder="Describe the scene — subject, setting, lighting, camera angle"
                      value={briefText}
                      onChange={(e) => setBriefText(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { fontSize: 12.5, bgcolor: "#fff" } }}
                    />
                    <Button
                      startIcon={imageBusy ? <CircularProgress size={14} /> : <ImageIcon />}
                      onClick={createImage}
                      disabled={imageBusy || !briefText.trim()}
                      sx={{ mt: 1, fontWeight: 700, color: NAVY }}
                    >
                      {imageBusy ? "Painting…" : draft.imageUrl ? "Regenerate image" : "Create image"}
                    </Button>
                  </Box>
                )}

                {/* refine loop */}
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder='Refine it — "shorter", "more technical", "open with the 991-session FFKM spike"…'
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") refine();
                    }}
                  />
                  <Button onClick={refine} disabled={refining || !refineText.trim()} startIcon={refining ? <CircularProgress size={14} /> : <ReplayIcon />} variant="outlined" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {refining ? "Refining…" : "Refine"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* 3 concepts */}
          {concepts.map((c, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, mt: 0.25 }}>
                    {i + 1}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a1d21", cursor: "pointer" }} onClick={() => setConcepts((cur) => cur.map((x, j) => (j === i ? { ...x, expanded: !x.expanded } : x)))}>
                      {c.headline}
                    </Typography>
                    <Collapse in={c.expanded}>
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, margin: "10px 0" }} />
                      )}
                      <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.65, color: "#1a1d21", mt: 1 }}>
                        {c.body}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                        <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} onClick={() => copy(c.body, `c${i}`)} sx={{ fontWeight: 600 }}>
                          {copied === `c${i}` ? "Copied!" : "Copy"}
                        </Button>
                        {c.imagePrompt && !c.imageUrl && (
                          <Button size="small" startIcon={c.imageBusy ? <CircularProgress size={12} /> : <ImageIcon sx={{ fontSize: 14 }} />} disabled={c.imageBusy} onClick={() => createConceptImage(i)} sx={{ fontWeight: 600, color: NAVY }}>
                            {c.imageBusy ? "Painting…" : "Create image"}
                          </Button>
                        )}
                        <Button
                          size="small"
                          startIcon={<ThumbUpIcon sx={{ fontSize: 13 }} />}
                          onClick={() => sendFeedback("like", { headline: c.headline, body: c.body }, () => setConceptFb((cur) => ({ ...cur, [i]: "like" })))}
                          sx={{ fontWeight: 700, color: conceptFb[i] === "like" ? "#fff" : "#1e7e45", bgcolor: conceptFb[i] === "like" ? "#1e7e45" : "transparent" }}
                        >
                          {conceptFb[i] === "like" ? "✓" : "Like"}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ThumbDownIcon sx={{ fontSize: 13 }} />}
                          onClick={() => sendFeedback("dislike", { headline: c.headline, body: c.body }, () => setConceptFb((cur) => ({ ...cur, [i]: "dislike" })))}
                          sx={{ fontWeight: 700, color: conceptFb[i] === "dislike" ? "#fff" : "#c5221f", bgcolor: conceptFb[i] === "dislike" ? "#c5221f" : "transparent" }}
                        >
                          {conceptFb[i] === "dislike" ? "✓" : "Dislike"}
                        </Button>
                      </Box>
                    </Collapse>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
          {concepts.length > 0 && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              All three concepts are saved in the Library as drafts.
            </Alert>
          )}
        </Grid>

        {/* ── RIGHT: engine intelligence ── */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ position: { md: "sticky" }, top: { md: 16 } }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <PsychologyIcon sx={{ fontSize: 20, color: RED }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a1d21" }}>Engine intelligence</Typography>
              </Box>

              {activePersonas.length > 0 ? (
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "#e8f0f4", mb: 1.5 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>
                    Writing for {activePersonas.map((p) => p.code).join(" + ")}
                  </Typography>
                  {activePersonas.map((p) => (
                    <Typography key={p.id} sx={{ fontSize: 11.5, color: "#3c4043", mt: 0.5, lineHeight: 1.5 }}>
                      <strong>{p.name}</strong> — {p.role}
                    </Typography>
                  ))}
                  {activePersonas.length > 1 && (
                    <Typography sx={{ fontSize: 11, color: "#5b6470", mt: 0.75 }}>
                      Multi-reader mode: shared pain points, one CTA that fits all.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 12, color: "#5b6470", mb: 1.5 }}>
                  No persona selected — pure brand voice. Pick one on the left for vocabulary, pain points and CTA matched to a real buyer type.
                </Typography>
              )}

              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                Feeding this generation
              </Typography>
              {[
                { label: `${trends.length} live demand signals`, on: trends.length > 0 },
                { label: `${brain?.categoryIntelligence?.totalLeafCategories ?? "—"} categories mapped (${(brain?.categoryIntelligence?.totalLeafCategories ?? 0) - (brain?.categoryIntelligence?.categoriesWithSeoText ?? 0)} content gaps)`, on: Boolean(brain) },
                { label: `${brain?.brandVoice?.signaturePhrases?.length ?? 0} signature phrases`, on: Boolean(brain?.brandVoice?.signaturePhrases?.length) },
                { label: `${(brain?.goldExamples?.linkedinPosts?.length ?? 0) + (brain?.goldExamples?.paidAds?.length ?? 0)} gold examples`, on: Boolean(brain?.goldExamples) },
                { label: "Anti-fabrication guard (no invented specs)", on: true },
                { label: "Like/dislike learning loop", on: true },
              ].map((f) => (
                <Box key={f.label} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                  <CheckCircleIcon sx={{ fontSize: 15, color: f.on ? "#1e7e45" : "#c7c7cc" }} />
                  <Typography sx={{ fontSize: 12, color: "#3c4043", lineHeight: 1.4 }}>{f.label}</Typography>
                </Box>
              ))}

              {geoChannels.has(channel) && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 1 }}>
                    GEO mode active
                  </Typography>
                  {[
                    "Direct answers open every section",
                    "40–60-word extractable blocks",
                    "Customer-phrased FAQ",
                    "Article + FAQPage JSON-LD",
                    "Verifiable facts only",
                  ].map((r) => (
                    <Box key={r} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.6 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 13, color: RED }} />
                      <Typography sx={{ fontSize: 12, color: "#3c4043" }}>{r}</Typography>
                    </Box>
                  ))}
                  <Typography sx={{ fontSize: 11, color: "#5b6470", mt: 1, lineHeight: 1.5 }}>
                    Written so ChatGPT, Perplexity and Google AI can quote it — structure, FAQ and schema included automatically.
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
