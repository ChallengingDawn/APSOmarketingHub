"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import IconButton from "@mui/material/IconButton";
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
import dynamic from "next/dynamic";
import BrushIcon from "@mui/icons-material/Brush";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupsIcon from "@mui/icons-material/Groups";
import TitleIcon from "@mui/icons-material/Title";
import type { SeedText } from "../editor/EditorCanvas";

// Konva is client-only
const EditorCanvas = dynamic(() => import("../editor/EditorCanvas"), { ssr: false });
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

/** Sidebar accordion sections. */
type SectionKey = "setup" | "personas" | "tools" | "intel";

const SIDEBAR_W = 300;
const SIDEBAR_COLLAPSED_W = 44;

/** Seed the canvas with the generated copy: headline always, body for short channels. */
function seedTextsFor(channel: string, content: string): SeedText[] {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0)?.replace(/^#+\s*/, "") ?? "";
  const seeds: SeedText[] = [{ text: firstLine.slice(0, 120), role: "headline" }];
  if (channel === "linkedin" || channel === "ad") {
    const rest = content.slice(content.indexOf(firstLine) + firstLine.length).trim();
    if (rest) seeds.push({ text: rest.slice(0, 500), role: "body" });
  }
  return seeds;
}


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
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [seedSignal, setSeedSignal] = useState(0);
  const [designing, setDesigning] = useState<null | { target: "scratch" } | { target: "draft" } | { target: "concept"; idx: number }>({ target: "scratch" });

  /* layout: collapsible sidebar, accordion sections, content panel */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({ setup: true, personas: false, tools: true, intel: false });
  const [contentOpen, setContentOpen] = useState(true);
  /* host element the canvas tools portal renders into (must exist before EditorCanvas mounts) */
  const toolsHostRef = useRef<HTMLDivElement | null>(null);
  const [toolsEl, setToolsEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolsEl(toolsHostRef.current);
  }, []);

  const toggleSection = (key: SectionKey) => setOpenSections((cur) => ({ ...cur, [key]: !cur[key] }));
  const expandSection = (key: SectionKey) => {
    setSidebarCollapsed(false);
    setOpenSections((cur) => ({ ...cur, [key]: true }));
  };

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
      .then((b) => {
        // Only accept a real brain — a 500 {error} payload must not blank the studio.
        if (b && !b.error && b.brandVoice) setBrain(b);
      })
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
          setDesigning({ target: "draft" });
          // Adobe-Express-style pipeline: the image paints itself, no extra click
          if (withImage && data.imageBrief) paintDraft(data.imageBrief);
        }
      } else {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, topic: topic.trim(), filters, personaIds: personaIds.length ? personaIds : undefined }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error ?? "Generation failed");
        else {
          const list: Concept[] = (data.proposals ?? []).map((p: Concept, i: number) => ({ ...p, expanded: i === 0, imageUrl: p.imageUrl && !p.imageUrl.startsWith("/mood/") ? p.imageUrl : undefined }));
          setConcepts(list);
          setConceptFb({});
          setDesigning({ target: "concept", idx: 0 });
          if (withImage) {
            list.forEach((p, i) => {
              if (p.imagePrompt) paintConcept(i, p.imagePrompt);
            });
          }
        }
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

  const paintDraft = async (promptStr: string) => {
    if (imageBusy || !promptStr.trim()) return;
    setImageBusy(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptStr.trim(), filters }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setDraft((d) => {
          if (d?.draftId) {
            fetch(`/api/content/${d.draftId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: data.imageUrl }),
            }).catch(() => {});
          }
          return d ? { ...d, imageUrl: data.imageUrl } : d;
        });
      } else setError(data.imageError ?? "Image generation failed");
    } catch {
      setError("Network error during image generation");
    } finally {
      setImageBusy(false);
    }
  };

  const createImage = () => {
    if (!draft) return;
    paintDraft(briefText.trim() || draft.content.slice(0, 280));
  };

  const paintConcept = async (idx: number, promptStr: string) => {
    if (!promptStr.trim()) return;
    setConcepts((cur) => cur.map((x, i) => (i === idx ? { ...x, imageBusy: true } : x)));
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptStr.trim(), filters }),
      });
      const data = await res.json();
      setConcepts((cur) =>
        cur.map((x, i) => (i === idx ? { ...x, imageBusy: false, imageUrl: data.imageUrl ?? x.imageUrl } : x))
      );
    } catch {
      setConcepts((cur) => cur.map((x, i) => (i === idx ? { ...x, imageBusy: false } : x)));
    }
  };

  const createConceptImage = (idx: number) => {
    const c = concepts[idx];
    if (!c || c.imageBusy) return;
    paintConcept(idx, c.imagePrompt || c.body.slice(0, 280));
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

  const sectionHeader = (key: SectionKey, label: string, icon: ReactNode) => (
    <Box
      onClick={() => toggleSection(key)}
      sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, cursor: "pointer", borderTop: "1px solid #f0f1f3", "&:hover": { bgcolor: "#fafbfc" } }}
    >
      {icon}
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#1a1d21", flex: 1 }}>{label}</Typography>
      <ChevronRightIcon sx={{ fontSize: 18, color: "#c7ccd2", transform: openSections[key] ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
    </Box>
  );

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
        <Box sx={{ display: "flex", gap: 1 }}>
          {!designing && (
            <Button onClick={() => setDesigning({ target: "scratch" })} startIcon={<BrushIcon />} sx={{ fontWeight: 700, color: "#ed1b2f" }}>
              Design canvas
            </Button>
          )}
          <Button component={Link} href="/library" startIcon={<LibraryBooksIcon />} sx={{ fontWeight: 600, color: NAVY }}>
            Library
          </Button>
        </Box>
      </Box>

      {/* ── top brief bar ── */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, flexWrap: "wrap" }}>
            <TextField
              select
              size="small"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              sx={{ width: 160, flexShrink: 0 }}
            >
              {CHANNELS.map((c) => (
                <MenuItem key={c.key} value={c.key}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {c.icon}
                    {c.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField
              multiline
              minRows={1}
              maxRows={briefExpanded ? 24 : 3}
              size="small"
              placeholder={`What are we creating? A topic is enough — "Enhance" turns it into a full brief.\ne.g. "Why FFKM o-rings when FKM fails — chemical processing"`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              sx={{ flex: 1, minWidth: 260, "& .MuiOutlinedInput-root": { fontSize: 13.5, lineHeight: 1.6 } }}
            />
            <Tooltip title={briefExpanded ? "Collapse the brief" : "Show the full brief"}>
              <IconButton size="small" onClick={() => setBriefExpanded((v) => !v)} sx={{ mt: 0.5 }}>
                <ChevronRightIcon sx={{ fontSize: 20, color: "#5b6470", transform: briefExpanded ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.2s" }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Expand your topic into a sharp brief using the brain's demand and persona context">
              <span>
                <Button
                  onClick={enhanceBrief}
                  disabled={enhancing || !topic.trim()}
                  startIcon={enhancing ? <CircularProgress size={14} /> : <BoltIcon />}
                  sx={{ fontWeight: 700, color: NAVY, flexShrink: 0 }}
                >
                  {enhancing ? "Enhancing…" : "Enhance brief"}
                </Button>
              </span>
            </Tooltip>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} sx={{ flexShrink: 0 }}>
              <ToggleButton value="draft" sx={{ px: 1.5, fontSize: 12, fontWeight: 700 }}>Single draft</ToggleButton>
              <ToggleButton value="concepts" sx={{ px: 1.5, fontSize: 12, fontWeight: 700 }}>3 concepts</ToggleButton>
            </ToggleButtonGroup>
            <Button
              onClick={generate}
              disabled={busy || !topic.trim()}
              variant="contained"
              startIcon={busy ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <AutoAwesomeIcon />}
              sx={{ bgcolor: RED, px: 3.5, fontWeight: 700, flexShrink: 0, "&:hover": { bgcolor: "#d81528" } }}
            >
              {busy ? (mode === "draft" ? "Writing…" : "Creating 3 concepts…") : "Generate"}
            </Button>
          </Box>
          {/* slim second row: demand chips + setup summary */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.25, flexWrap: "wrap" }}>
            {trends.length > 0 && (
              <>
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
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              </>
            )}
            <Typography sx={{ fontSize: 11.5, color: "#5b6470" }}>
              {activePersonas.length ? `Writing for ${activePersonas.map((p) => p.code).join(" + ")}` : "General audience"}
              {` · ${language} · ${length}`}
              {category ? ` · ${category}` : ""}
              {audience ? ` · ${audience}` : ""}
              {primaryKeyword.trim() ? ` · keyword "${primaryKeyword.trim()}"` : ""}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── sidebar + stage ── */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        {/* ── LEFT: collapsible sidebar ── */}
        <Box sx={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W, flexShrink: 0, transition: "width 0.2s ease" }}>
          <Card>
            <Box sx={{ display: "flex", justifyContent: sidebarCollapsed ? "center" : "flex-end", p: 0.5 }}>
              <Tooltip title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
                <IconButton size="small" onClick={() => setSidebarCollapsed((v) => !v)}>
                  {sidebarCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
            {sidebarCollapsed && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, pb: 1 }}>
                <Tooltip title="Generate setup" placement="right">
                  <IconButton size="small" onClick={() => expandSection("setup")}>
                    <TuneIcon sx={{ fontSize: 19, color: NAVY }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Personas" placement="right">
                  <IconButton size="small" onClick={() => expandSection("personas")}>
                    <GroupsIcon sx={{ fontSize: 19, color: NAVY }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Canvas tools" placement="right">
                  <IconButton size="small" onClick={() => expandSection("tools")}>
                    <BrushIcon sx={{ fontSize: 19, color: RED }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Engine intelligence" placement="right">
                  <IconButton size="small" onClick={() => expandSection("intel")}>
                    <PsychologyIcon sx={{ fontSize: 19, color: RED }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {/* sections stay mounted while collapsed so the canvas-tools portal target survives */}
            <Box sx={{ display: sidebarCollapsed ? "none" : "block" }}>
              {/* ── section: Generate setup ── */}
              {sectionHeader("setup", "Generate setup", <TuneIcon sx={{ fontSize: 18, color: NAVY }} />)}
              <Collapse in={openSections.setup}>
                <Box sx={{ px: 2, pb: 2 }}>


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
                            { k: "recognition", l: "We’ve already met" },
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
                </Box>
              </Collapse>

              {/* ── section: Canvas tools (EditorCanvas portals its tools panel here) ── */}
              {sectionHeader("personas", `Personas${personaIds.length ? ` · ${personaIds.length}` : ""}`, <GroupsIcon sx={{ fontSize: 18, color: NAVY }} />)}
              <Collapse in={openSections.personas}>
                <Box sx={{ px: 2, pb: 2 }}>

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
                              {on ? "✓" : p.code}
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

                </Box>
              </Collapse>

              {sectionHeader("tools", "Canvas tools", <BrushIcon sx={{ fontSize: 18, color: RED }} />)}
              <Collapse in={openSections.tools}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <div ref={toolsHostRef} />
                  {busy && (
                    <Typography sx={{ fontSize: 12, color: "#5b6470" }}>
                      The canvas tools return here as soon as generation finishes.
                    </Typography>
                  )}
                </Box>
              </Collapse>

              {/* ── section: Engine intelligence ── */}
              {sectionHeader("intel", "Engine intelligence", <PsychologyIcon sx={{ fontSize: 18, color: RED }} />)}
              <Collapse in={openSections.intel}>
                <Box sx={{ px: 2, pb: 2 }}>
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
                      No persona selected — pure brand voice. Pick one in Generate setup for vocabulary, pain points and CTA matched to a real buyer type.
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
                </Box>
              </Collapse>
            </Box>
          </Card>
        </Box>

        {/* ── MAIN: canvas stage + content panel ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {busy && (
            <Box aria-hidden="true">
              {mode === "draft" ? (
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                      <Box className="shimmer" sx={{ width: 140, height: 24 }} />
                      <Box className="shimmer" sx={{ width: 200, height: 24 }} />
                    </Box>
                    {withImage && <Box className="shimmer" sx={{ width: "100%", maxWidth: 640, aspectRatio: "16/9", mb: 2 }} />}
                    <Box className="shimmer" sx={{ width: "55%", height: 26, mb: 1.5 }} />
                    {[92, 100, 97, 88, 100, 94, 60].map((w, i) => (
                      <Box key={i} className="shimmer" sx={{ width: `${w}%`, height: 13, mb: 1 }} />
                    ))}
                    <Box className="shimmer" sx={{ width: "40%", height: 22, mt: 2, mb: 1 }} />
                    {[95, 90, 70].map((w, i) => (
                      <Box key={i} className="shimmer" sx={{ width: `${w}%`, height: 13, mb: 1 }} />
                    ))}
                    <Typography sx={{ fontSize: 12, color: "#5b6470", mt: 2 }}>
                      Opus 5 is writing{withImage ? " — the image follows automatically" : ""}…
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <Grid container spacing={2}>
                  {[0, 1, 2].map((i) => (
                    <Grid key={i} size={{ xs: 12, md: 4 }}>
                      <Card sx={{ height: "100%" }}>
                        <Box className="shimmer" sx={{ width: "100%", aspectRatio: "16/10", borderRadius: 0 }} />
                        <CardContent sx={{ p: 2 }}>
                          <Box className="shimmer" sx={{ width: "85%", height: 18, mb: 1.5 }} />
                          {[100, 95, 98, 90, 55].map((w, j) => (
                            <Box key={j} className="shimmer" sx={{ width: `${w}%`, height: 12, mb: 0.9 }} />
                          ))}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
          {!busy && designing && (
            <Box className="fade-in-result">
              {/* ── Canvas hero — everything happens here ── */}
              <Card>
                <Box sx={{ p: 2, borderBottom: "1px solid #e6e8ec", display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <BrushIcon sx={{ fontSize: 20, color: "#ed1b2f" }} />
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a1d21" }}>
                    {designing.target === "draft"
                      ? `Canvas — your draft${draft?.draftId ? ` (#${draft.draftId})` : ""}`
                      : designing.target === "concept"
                        ? `Canvas — concept ${designing.idx + 1} of ${concepts.length}`
                        : "Canvas — blank"}
                  </Typography>
                  {designing.target === "concept" && concepts.length > 1 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => setDesigning({ target: "concept", idx: (designing.idx + concepts.length - 1) % concepts.length })}
                        sx={{ border: "1px solid #e6e8ec" }}
                      >
                        <ChevronLeftIcon fontSize="small" />
                      </IconButton>
                      {concepts.map((_, i) => (
                        <Box
                          key={i}
                          onClick={() => setDesigning({ target: "concept", idx: i })}
                          sx={{ width: 8, height: 8, borderRadius: "50%", cursor: "pointer", bgcolor: i === designing.idx ? "#ed1b2f" : "#d5d9df" }}
                        />
                      ))}
                      <IconButton
                        size="small"
                        onClick={() => setDesigning({ target: "concept", idx: (designing.idx + 1) % concepts.length })}
                        sx={{ border: "1px solid #e6e8ec" }}
                      >
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                  <Box sx={{ flex: 1 }} />
                  {((designing.target === "draft" && draft) || designing.target === "concept") && (
                    <Tooltip title="Place the generated headline and copy onto the canvas as editable text (with readable pills)">
                      <Button size="small" onClick={() => setSeedSignal((v) => v + 1)} startIcon={<TitleIcon sx={{ fontSize: 15 }} />} sx={{ fontWeight: 700, color: NAVY }}>
                        Insert text
                      </Button>
                    </Tooltip>
                  )}
                  {draft && designing.target !== "draft" && (
                    <Button size="small" onClick={() => setDesigning({ target: "draft" })} sx={{ fontWeight: 700, color: NAVY }}>
                      Back to draft
                    </Button>
                  )}
                  {concepts.length > 0 && designing.target !== "concept" && (
                    <Button size="small" onClick={() => setDesigning({ target: "concept", idx: 0 })} sx={{ fontWeight: 700, color: NAVY }}>
                      Concepts
                    </Button>
                  )}
                </Box>
                <Box sx={{ p: 2 }}>
                  <EditorCanvas
                    key={
                      designing.target === "draft"
                        ? `draft-${draft?.draftId ?? "x"}-${draft?.imageUrl ? "img" : "noimg"}`
                        : designing.target === "concept"
                          ? `concept-${designing.idx}-${concepts[designing.idx]?.imageUrl ? "img" : "noimg"}`
                          : "scratch"
                    }
                    itemId={designing.target === "draft" ? draft?.draftId : undefined}
                    toolsContainer={toolsEl}
                    initialImage={
                      designing.target === "draft"
                        ? draft?.imageUrl ?? null
                        : designing.target === "concept"
                          ? concepts[designing.idx]?.imageUrl ?? null
                          : null
                    }
                    seedSignal={seedSignal}
                initialTexts={
                      designing.target === "draft" && draft
                        ? seedTextsFor(channel, draft.content)
                        : designing.target === "concept" && concepts[designing.idx]
                          ? [
                              { text: concepts[designing.idx].headline, role: "headline" as const },
                              ...(channel === "linkedin" || channel === "ad"
                                ? [{ text: concepts[designing.idx].body.slice(0, 400), role: "body" as const }]
                                : []),
                            ]
                        : undefined
                    }
                    painting={
                      designing.target === "draft"
                        ? imageBusy && !draft?.imageUrl
                        : designing.target === "concept"
                          ? Boolean(concepts[designing.idx]?.imageBusy) && !concepts[designing.idx]?.imageUrl
                          : false
                    }
                    onExported={(url) => {
                      if (designing.target === "draft") {
                        setDraft((d) => (d ? { ...d, imageUrl: url } : d));
                      } else if (designing.target === "concept") {
                        const idx = designing.idx;
                        setConcepts((cur) => cur.map((x, j) => (j === idx ? { ...x, imageUrl: url } : x)));
                      }
                    }}
                  />
                  {(designing.target === "draft" ? imageBusy : concepts[designing.target === "concept" ? designing.idx : 0]?.imageBusy) && (
                    <Typography sx={{ fontSize: 12, color: "#5b6470", mt: 1 }}>
                      Painting the background image — it will appear on the canvas when ready (switch views to refresh)…
                    </Typography>
                  )}
                </Box>
              </Card>

              {/* ── Content & refine — collapsible panel below the canvas ── */}
              {((designing.target === "draft" && Boolean(draft)) || (designing.target === "concept" && Boolean(concepts[designing.idx]))) && (
                <Card sx={{ mt: 2 }}>
                  <Box
                    onClick={() => setContentOpen((v) => !v)}
                    sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, py: 1.5, cursor: "pointer", borderBottom: contentOpen ? "1px solid #e6e8ec" : "none", "&:hover": { bgcolor: "#fafbfc" } }}
                  >
                    <ArticleIcon sx={{ fontSize: 18, color: NAVY }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a1d21", flex: 1 }}>Content & refine</Typography>
                    <ChevronRightIcon sx={{ fontSize: 18, color: "#c7ccd2", transform: contentOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                  </Box>
                  <Collapse in={contentOpen}>
                    {/* ── Draft text panel ── */}
                    {designing.target === "draft" && draft && (
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
                          <Tooltip title="Not this — a refine instruction below becomes the correction">
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

                        {withImage && (
                          <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: "#fafbfc", border: "1px solid #f1f3f4" }}>
                            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#5b6470", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                              Image brief — edit and repaint the canvas background
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
                              {imageBusy ? "Painting…" : draft.imageUrl ? "Repaint background" : "Paint background"}
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    )}

                    {/* ── Concept text panel ── */}
                    {designing.target === "concept" && concepts[designing.idx] && (
                      <CardContent sx={{ p: 2.5 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a1d21", mb: 1 }}>
                          {concepts[designing.idx].headline}
                        </Typography>
                        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.65, color: "#1a1d21", mb: 1.5 }}>
                          {concepts[designing.idx].body}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} onClick={() => copy(concepts[designing.idx].body, `c${designing.idx}`)} sx={{ fontWeight: 600 }}>
                            {copied === `c${designing.idx}` ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            size="small"
                            startIcon={concepts[designing.idx].imageBusy ? <CircularProgress size={12} /> : <ReplayIcon sx={{ fontSize: 14 }} />}
                            disabled={concepts[designing.idx].imageBusy}
                            onClick={() => createConceptImage(designing.idx)}
                            sx={{ fontWeight: 600, color: NAVY }}
                          >
                            New background
                          </Button>
                          <Box sx={{ flexBasis: "100%", display: "flex", gap: 1, mt: 1 }}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              maxRows={4}
                              placeholder="Reprompt the image — describe the scene you want instead"
                              value={concepts[designing.idx].imagePrompt}
                              onChange={(e) => {
                                const idx = designing.idx;
                                setConcepts((cur) => cur.map((x, j) => (j === idx ? { ...x, imagePrompt: e.target.value } : x)));
                              }}
                              sx={{ "& .MuiOutlinedInput-root": { fontSize: 12.5 } }}
                            />
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={concepts[designing.idx].imageBusy || !concepts[designing.idx].imagePrompt.trim()}
                              onClick={() => paintConcept(designing.idx, concepts[designing.idx].imagePrompt)}
                              sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                            >
                              Repaint
                            </Button>
                          </Box>
                          <Button
                            size="small"
                            startIcon={<ThumbUpIcon sx={{ fontSize: 13 }} />}
                            onClick={() => sendFeedback("like", { headline: concepts[designing.idx].headline, body: concepts[designing.idx].body }, () => setConceptFb((cur) => ({ ...cur, [designing.idx]: "like" })))}
                            sx={{ fontWeight: 700, color: conceptFb[designing.idx] === "like" ? "#fff" : "#1e7e45", bgcolor: conceptFb[designing.idx] === "like" ? "#1e7e45" : "transparent" }}
                          >
                            {conceptFb[designing.idx] === "like" ? "Learned ✓" : "Like"}
                          </Button>
                          <Button
                            size="small"
                            startIcon={<ThumbDownIcon sx={{ fontSize: 13 }} />}
                            onClick={() => sendFeedback("dislike", { headline: concepts[designing.idx].headline, body: concepts[designing.idx].body }, () => setConceptFb((cur) => ({ ...cur, [designing.idx]: "dislike" })))}
                            sx={{ fontWeight: 700, color: conceptFb[designing.idx] === "dislike" ? "#fff" : "#c5221f", bgcolor: conceptFb[designing.idx] === "dislike" ? "#c5221f" : "transparent" }}
                          >
                            {conceptFb[designing.idx] === "dislike" ? "Noted ✓" : "Dislike"}
                          </Button>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, color: "#5b6470", mt: 1.5 }}>
                          All three concepts are saved in the Library as drafts. Canvas edits stay with this view — click "Use design" on the canvas toolbar to bake them onto this concept's image.
                        </Typography>
                      </CardContent>
                    )}
                  </Collapse>
                </Card>
              )}
            </Box>
          )}
        </Box>
      </Box>

    </Box>
  );
}
