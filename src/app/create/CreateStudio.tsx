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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ReplayIcon from "@mui/icons-material/Replay";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import PaletteIcon from "@mui/icons-material/Palette";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import MarkdownPreview from "./MarkdownPreview";
import dynamic from "next/dynamic";
import BrushIcon from "@mui/icons-material/Brush";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupsIcon from "@mui/icons-material/Groups";
import TitleIcon from "@mui/icons-material/Title";
import type { SeedText } from "../editor/EditorCanvas";
import TypePicker from "./TypePicker";
import SaveToProject from "./SaveToProject";
import VariationStrip, { type StripVariant } from "./VariationStrip";
import FloatingAssistant from "@/app/projects/FloatingAssistant";
import StudioChrome from "./StudioChrome";
import { CONTENT_BY_KEY, CONTENT_TYPES } from "@/lib/content/contentTypes";

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
  revision?: number;
  designDocument?: import("@/lib/design-document").DesignDocument;
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
type SectionKey = "setup" | "personas" | "add" | "style" | "templates" | "intel";

const SIDEBAR_W = 344;

/**
 * The rail. Every tool the editor has, visible without opening anything, each
 * with its word underneath — an icon column with no labels is a quiz.
 */
const RAIL: { key: SectionKey; label: string; icon: ReactNode }[] = [
  { key: "setup", label: "Brief", icon: <TuneIcon /> },
  { key: "personas", label: "Who for", icon: <GroupsIcon /> },
  { key: "add", label: "Add", icon: <AddPhotoAlternateIcon /> },
  { key: "style", label: "Style", icon: <PaletteIcon /> },
  { key: "templates", label: "Templates", icon: <DashboardCustomizeIcon /> },
  { key: "intel", label: "Brain", icon: <PsychologyIcon /> },
];

const MD_FENCE = /```[\s\S]*?```/g;
const LABEL = /^(subject|preheader|headline|body|cta|h1|meta title|meta description|intro paragraph|title)\s*:\s*/i;

const TOPIC_TAGS: { re: RegExp; tag: string }[] = [
  { re: /\b(o-?rings?|seals?|sealing|gaskets?|ffkm|fkm|nbr|epdm|vmq|quad-?ring)\b/i, tag: "SEALING TECHNOLOGY" },
  { re: /\b(hoses?|tubes?|tubing|fittings?|couplings?|fluid|hydraulic|pneumatic)\b/i, tag: "FLUID HANDLING" },
  { re: /\b(vibration|damper|damping|mounts?|isolators?|bellows?)\b/i, tag: "ANTIVIBRATION" },
  { re: /\b(belts?|drives?|pulleys?|chains?|bearings?)\b/i, tag: "DRIVE TECHNOLOGY" },
  { re: /\b(filters?|filtration|membranes?)\b/i, tag: "FILTRATION" },
  { re: /\b(polymers?|plastics?|elastomers?|ptfe|peek|pom|compounds?)\b/i, tag: "POLYMER SOLUTIONS" },
];

const CHANNEL_TAGS: Record<string, string> = {
  linkedin: "INDUSTRIAL PARTS",
  blog: "TECHNICAL INSIGHT",
  newsletter: "PRODUCT NEWS",
  ad: "INDUSTRIAL PARTS",
  product: "PRODUCT DETAIL",
  seo: "TECHNICAL INSIGHT",
};

const CHANNEL_CTAS: Record<string, string> = {
  linkedin: "Discover more on apsoparts.com",
  blog: "Discover more on apsoparts.com",
  seo: "Discover more on apsoparts.com",
  ad: "Shop the range",
  product: "Shop the range",
  newsletter: "Read the full story",
};

function stripMarkdown(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s{0,3}>\s+/, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/\*\*|__|~~|\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hard cap that cuts at a word boundary and never leaves dangling punctuation. */
function clampWords(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const sp = cut.lastIndexOf(" ");
  const out = sp > Math.floor(max * 0.5) ? cut.slice(0, sp) : cut.slice(0, max);
  return out.replace(/[\s,;:.·–—-]+$/, "").trim();
}

function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Clean, markdown-free content lines, junk (hashtags, tables, rules, sign-off) dropped. */
function contentLines(content: string): { text: string; heading: boolean }[] {
  return content
    .replace(MD_FENCE, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^#\S/.test(l))
    .filter((l) => !/^\|/.test(l))
    .filter((l) => !/^[-*_\s]{3,}$/.test(l))
    .filter((l) => !/^[—-]\s*APSOparts/i.test(l))
    .map((l) => ({ heading: /^#{1,6}\s+/.test(l), text: stripMarkdown(l.replace(LABEL, "")) }))
    .filter((l) => l.text.length > 0);
}

/**
 * The chosen TYPE as blocks, for a canvas nobody has written into yet.
 *
 * "Canvas - blank" was the first thing the studio showed, every time. A blank
 * rectangle is the least useful possible answer to "I want an SEO landing
 * page": the shape of that page is already decided - hero, what it is, the
 * options, six proofs, a customer, one ask - and making somebody rebuild it
 * from an empty page is the tool keeping what it knows to itself.
 *
 * So the canvas arrives carrying the structure, each section a block holding
 * the job it has to do. It is a scaffold to type over, not content: nothing
 * here pretends to be written, and generating replaces it outright.
 */
function seedTypeSkeleton(typeKey: string): SeedText[] {
  const type = CONTENT_BY_KEY[typeKey];
  if (!type) return [];

  const seeds: SeedText[] = [{ text: type.label.toUpperCase(), role: "kicker" }];
  type.sections.forEach((section, i) => {
    seeds.push({
      text: i === 0 ? section.heading : section.heading + " - " + section.job,
      role: i === 0 ? "headline" : i === type.sections.length - 1 ? "cta" : "body",
    });
  });
  return seeds;
}

/** Seed the canvas with a poster-ready set: kicker, headline, supporting line, CTA. */
function seedTextsFor(channel: string, content: string): SeedText[] {
  const lines = contentLines(content);
  if (lines.length === 0) return [];

  const headingIdx = lines.findIndex((l) => l.heading);
  const headlineIdx = headingIdx >= 0 ? headingIdx : 0;
  const headlineSrc = lines[headlineIdx].text;
  const headline = clampWords(sentencesOf(headlineSrc)[0] ?? headlineSrc, 64);

  const candidates: string[] = [];
  lines.forEach((l, i) => {
    if (i === headlineIdx || l.heading) return;
    for (const s of sentencesOf(l.text)) {
      if (s.length < 30) continue;
      if (headlineSrc.toLowerCase().startsWith(s.slice(0, 24).toLowerCase())) continue;
      candidates.push(s);
    }
  });
  const support =
    candidates.find((s) => s.length >= 60 && s.length <= 140) ??
    candidates.find((s) => s.length >= 40) ??
    candidates[0] ??
    "";
  const body = support ? clampWords(support, 140) : "";

  const haystack = `${headlineSrc} ${lines.map((l) => l.text).join(" ")}`;
  const tag = TOPIC_TAGS.find((t) => t.re.test(haystack))?.tag ?? CHANNEL_TAGS[channel] ?? "INDUSTRIAL PARTS";
  const kicker = clampWords(`APSOPARTS · ${tag}`.toUpperCase(), 32);
  const cta = clampWords(CHANNEL_CTAS[channel] ?? "Discover more on apsoparts.com", 32);

  return ([
    { text: kicker, role: "kicker" },
    { text: headline, role: "headline" },
    { text: body, role: "body" },
    { text: cta, role: "cta" },
  ] as SeedText[]).filter((s) => s.text.trim().length > 0);
}

/** Concept cards carry headline + body separately; seed them as one document. */
const conceptContent = (c: Concept) => [c.headline, c.body].filter(Boolean).join("\n\n");


/* ── page ── */

const VALID_CHANNELS = new Set(CHANNELS.map((c) => c.key));

export default function CreateStudio({
  initialChannel,
  initialTopic,
  initialBrief,
  projectId,
  projectTitle,
  initialType,
}: {
  initialChannel?: string;
  /** Prefilled from a SEO quick win or a decayed page worth refreshing. */
  initialTopic?: string;
  /** Prefilled from a GEO audit: the checks that failed and how to fix them. */
  initialBrief?: string;
  /** Set when the studio was opened from a project board. */
  projectId?: number;
  projectTitle?: string;
  /** Chosen on the home screen, so the studio opens on the right shape. */
  initialType?: string;
}) {
  const [brain, setBrain] = useState<Brain | null>(null);

  /* setup state */
  // The TYPE is what is being made and owns the structure. The channel still
  // exists because tone, length budget and the output validators key on it —
  // it is now derived from the type rather than chosen separately, so the two
  // cannot contradict each other.
  const [contentType, setContentType] = useState(() => {
    // What the home screen chose wins: somebody pressed a tile saying "SEO
    // landing page" and the studio opening on a LinkedIn post would be the
    // tool forgetting the only thing they told it.
    if (initialType && CONTENT_BY_KEY[initialType]) return initialType;
    const byChannel = CONTENT_TYPES.find((t) => t.channel === initialChannel);
    return byChannel?.key ?? "linkedin-post";
  });
  const channel = CONTENT_BY_KEY[contentType]?.channel ?? "linkedin";
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
  const [topic, setTopic] = useState(initialTopic ?? "");
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
  // Remount key for the draft canvas. Bumped only when something outside the
  // editor changes the stored piece (a regenerated background), never on a save
  // the canvas itself made — remounting then would throw away its undo history.
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [copied, setCopied] = useState("");
  const [draftFb, setDraftFb] = useState<"" | "like" | "dislike">("");
  const [conceptFb, setConceptFb] = useState<Record<number, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [briefText, setBriefText] = useState(initialBrief ?? "");
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [seedSignal, setSeedSignal] = useState(0);
  // Canvas types open on the artboard because the picture is the work.
  // Document types do not: the artboard in front of an unwritten landing page
  // is furniture, and "Canvas - blank" is a worse first screen than the
  // outline of what you are about to write.
  const [designing, setDesigning] = useState<null | { target: "scratch" } | { target: "draft" } | { target: "concept"; idx: number }>(
    () => {
      const t = initialType && CONTENT_BY_KEY[initialType] ? CONTENT_BY_KEY[initialType] : null;
      return t?.surface === "canvas" ? { target: "scratch" } : null;
    },
  );

  /* layout: collapsible sidebar, accordion sections, content panel */
  // Exactly one panel, or none. Null is a real state — it gives the canvas
  // the whole width, which is what you want once the writing is done.
  const [activePanel, setActivePanel] = useState<SectionKey | null>("setup");
  // Bumped when a version is saved, so the strip shows it without a reload.
  const [stripKey, setStripKey] = useState(0);
  const openSections: Record<SectionKey, boolean> = {
    setup: activePanel === "setup",
    personas: activePanel === "personas",
    add: activePanel === "add",
    style: activePanel === "style",
    templates: activePanel === "templates",
    intel: activePanel === "intel",
  };
  const [contentOpen, setContentOpen] = useState(true);
  /* host element the canvas tools portal renders into (must exist before EditorCanvas mounts) */
  // One host per panel. They must exist before EditorCanvas mounts, and they
  // stay mounted whichever panel is showing — the canvas portals into them,
  // and unmounting a target takes its tools with it.
  const addHostRef = useRef<HTMLDivElement | null>(null);
  const styleHostRef = useRef<HTMLDivElement | null>(null);
  const templatesHostRef = useRef<HTMLDivElement | null>(null);
  const [toolHosts, setToolHosts] = useState<{
    insert: HTMLElement | null; canvas: HTMLElement | null; templates: HTMLElement | null;
  }>({ insert: null, canvas: null, templates: null });
  useEffect(() => {
    setToolHosts({
      insert: addHostRef.current,
      canvas: styleHostRef.current,
      templates: templatesHostRef.current,
    });
  }, []);

  const toggleSection = (key: SectionKey) => setActivePanel((cur) => (cur === key ? null : key));
  /** Anything that wants a panel open names it; the rail shows which. */
  const expandSection = (key: SectionKey) => setActivePanel(key);

  const mdChannel = channel === "blog" || channel === "product";

  /* feedback loop -> /api/logs (teaches the engine; non-blocking) */
  const sendFeedback = (kind: "like" | "dislike", payload: { headline?: string; body: string }, done?: () => void) => {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind, channel, contentType, prompt: topic.slice(0, 500), ...payload }),
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

  /* text the ACTIVE canvas target can seed — drives both the button and initialTexts */
  const activeSeeds = useMemo<SeedText[]>(() => {
    if (!designing) return [];
    // Written content wins. With nothing written the type is still known, and
    // its shape beats an empty rectangle.
    if (designing.target === "draft") {
      return draft ? seedTextsFor(channel, draft.content) : seedTypeSkeleton(contentType);
    }
    if (designing.target === "concept") {
      const c = concepts[designing.idx];
      return c ? seedTextsFor(channel, conceptContent(c)) : [];
    }
    return [];
  }, [designing, draft, concepts, channel, contentType]);

  /* ── actions ── */

  const enhanceBrief = async () => {
    if (!topic.trim() || enhancing) return;
    setEnhancing(true);
    setError("");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, contentType, topic: topic.trim(), personaIds: personaIds.length ? personaIds : undefined, filters }),
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
          setDraft({ content: data.content, draftId: data.draftId, revision: data.draftRevision, quality: data.quality, imageBrief: data.imageBrief });
          setDraftFb("");
          setEditMode(false);
          setShowRaw(false);
          setBriefText(data.imageBrief ?? "");
          // Only a canvas type jumps to the artboard once there are words.
          // A document shows the words.
          setDesigning(CONTENT_BY_KEY[contentType]?.surface === "canvas" ? { target: "draft" } : null);
          // Adobe-Express-style pipeline: the image paints itself, no extra click
          if (withImage && data.imageBrief) paintDraft(data.imageBrief, { content: data.content, draftId: data.draftId, revision: data.draftRevision });
        }
      } else {
        const res = await fetch("/api/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, contentType, topic: topic.trim(), filters, personaIds: personaIds.length ? personaIds : undefined }),
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
        setDraft({ content: data.content, draftId: data.draftId, revision: data.draftRevision, quality: data.quality, imageBrief: draft.imageBrief, imageUrl: draft.imageUrl });
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

  const paintDraft = async (promptStr: string, target: DraftResult | null = draft) => {
    if (imageBusy || !promptStr.trim()) return;
    setImageBusy(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptStr.trim(), filters, overlaySpace: true }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        // Capture the item before the async image call; never update a different
        // draft that the user generated while this request was in flight.
        let savedRevision = target?.revision;
        // Regenerating the background must not discard saved layers: keep the
        // editable document and swap only the image behind them.
        const nextDocument = target?.designDocument
          ? { ...target.designDocument, background: { ...target.designDocument.background, src: data.imageUrl } }
          : undefined;
        if (target?.draftId) {
          const result = await fetch(`/api/content/${target.draftId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedRevision: target.revision, imageUrl: data.imageUrl,
              ...(nextDocument ? { designDocument: nextDocument } : {}),
            }),
          });
          const saved = await result.json();
          if (!result.ok) throw new Error(saved.error ?? "Image generated but could not be saved");
          savedRevision = saved.item.revision;
        }
        setDraft((d) => d && d.draftId === target?.draftId
          ? { ...d, imageUrl: data.imageUrl, revision: savedRevision, designDocument: nextDocument } : d);
        setCanvasEpoch((n) => n + 1);
      } else setError(data.imageError ?? "Image generation failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during image generation");
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
        body: JSON.stringify({ prompt: promptStr.trim(), filters, overlaySpace: true }),
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
      let revision = draft.revision;
      if (draft.draftId) {
        const res = await fetch(`/api/content/${draft.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: next, expectedRevision: draft.revision }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Saving the edit failed");
          setSavingEdit(false);
          return;
        }
        revision = (await res.json()).item.revision;
      }
      setDraft((d) => (d && d.draftId === draft.draftId ? { ...d, content: next, revision } : d));
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed; your edits are still here");
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

  /**
   * The header of the ONE open panel.
   *
   * It used to render for all seven, which turned the column into a list of
   * things you had NOT chosen — while the rail above it had already chosen.
   * A panel that is not open now renders no header; its content stays mounted
   * and hidden, because the canvas portals its tools into that tree and
   * unmounting the target takes the toolbar with it.
   */
  const sectionHeader = (key: SectionKey, label: string, icon: ReactNode) => {
    if (activePanel !== key) return null;
    return (
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5,
        borderBottom: "1px solid #eceef1",
      }}>
        {icon}
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#15223a", flex: 1 }}>{label}</Typography>
        <IconButton size="small" onClick={() => setActivePanel(null)} aria-label="Close this panel">
          <CloseIcon sx={{ fontSize: 17, color: "#8b97ac" }} />
        </IconButton>
      </Box>
    );
  };

  return (
    <Box sx={{
      // The editor owns the window. One scroll per column, never one for the
      // page: an artboard that slides away when you reach for a tool is the
      // single thing that makes a canvas feel like a web page.
      height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      bgcolor: "#eef1f5",
    }}>
      <StudioChrome
        projectId={projectId}
        projectTitle={projectTitle}
        typeLabel={CONTENT_BY_KEY[contentType]?.label ?? "Draft"}
        right={
          <SaveToProject
            onDark
            draftId={draft?.draftId ?? null}
            defaultLabel={`${CONTENT_BY_KEY[contentType]?.label ?? "Draft"}${language === "EN" ? "" : ` (${language})`}`}
            projectId={projectId}
            projectTitle={projectTitle}
            onSaved={() => setStripKey((n) => n + 1)}
          />
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", p: 1.25, gap: 1.25 }}>
      {/* The brief bar is gone. SARCLA: "the agent itself should generate the
          image and everything — the top bar where it generated before, we can
          take it out". It was a box, a Generate button, an Enhance button, a
          draft/concepts switch and a row of demand chips, all to start one
          piece of work. The agent does that now, from a window you can put
          anywhere, and the editor gets the height back. */}
      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ── rail · panel · canvas · versions ── */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 1.25, alignItems: "stretch" }}>
        {/* ── LEFT: the rail, always there ── */}
        <Box sx={{
          width: 76, flexShrink: 0, display: "flex", flexDirection: "column", gap: 0.5,
          p: 0.75, borderRadius: "16px", bgcolor: "#fff", border: "1px solid rgba(21,34,58,.10)",
          overflowY: "auto",
        }}>
          {RAIL.map((r) => {
            const on = activePanel === r.key;
            return (
              <Box
                key={r.key}
                component="button"
                type="button"
                onClick={() => toggleSection(r.key)}
                aria-pressed={on}
                sx={{
                  border: 0, cursor: "pointer", fontFamily: "inherit", width: "100%",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 0.3,
                  py: 1, borderRadius: "11px",
                  bgcolor: on ? "#eef3ff" : "transparent",
                  color: on ? "#2459d1" : "#5b6470",
                  "&:hover": { bgcolor: on ? "#eef3ff" : "#f5f6f8" },
                  "& svg": { fontSize: 20 },
                }}
              >
                {r.icon}
                <Typography sx={{ fontSize: 10.5, fontWeight: on ? 700 : 500, lineHeight: 1.2, color: "inherit" }}>
                  {r.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* ── the one open panel ── */}
        <Box sx={{ width: activePanel ? SIDEBAR_W : 0, flexShrink: 0, transition: "width 0.2s ease", overflow: "hidden" }}>
          <Card>
            {/* Every section stays mounted whatever is showing: the canvas
                tools portal into this tree, and unmounting the target takes
                the canvas's own toolbar with it. */}
            <Box>
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

              {sectionHeader("add", "Add to the canvas", <AddPhotoAlternateIcon sx={{ fontSize: 18, color: RED }} />)}
              <Collapse in={openSections.add}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <div ref={addHostRef} />
                  {busy && (
                    <Typography sx={{ fontSize: 12, color: "#5b6470" }}>
                      The canvas tools return here as soon as generation finishes.
                    </Typography>
                  )}
                </Box>
              </Collapse>

              {sectionHeader("style", "Size, colour and background", <PaletteIcon sx={{ fontSize: 18, color: RED }} />)}
              <Collapse in={openSections.style}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <div ref={styleHostRef} />
                </Box>
              </Collapse>

              {sectionHeader("templates", "Start from a template", <DashboardCustomizeIcon sx={{ fontSize: 18, color: RED }} />)}
              <Collapse in={openSections.templates}>
                <Box sx={{ px: 2, pb: 2 }}>
                  <div ref={templatesHostRef} />
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
          {/* A document type with nothing written yet shows what it is about
              to be: the sections, and what each one has to do. The old answer
              here was an empty artboard, which told you nothing and invited
              you to design a poster instead of writing a page. */}
          {!busy && !designing && !draft && concepts.length === 0 && (() => {
            const t = CONTENT_BY_KEY[contentType];
            if (!t) return null;
            return (
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#8b97ac", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {t.label}
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-outfit)", fontSize: 20, fontWeight: 700, color: "#15223a", mt: 0.5, mb: 0.5 }}>
                    {t.sections.length} sections, about {t.sections.reduce((n, x) => n + x.words, 0)} words
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#5d6b85", mb: 2.5, maxWidth: 620, lineHeight: 1.6 }}>
                    {t.blurb} Write a line in the brief above and press Generate, or press a section to start it yourself.
                  </Typography>

                  {t.sections.map((sec, i) => (
                    <Box
                      key={sec.heading}
                      sx={{
                        display: "flex", gap: 2, py: 1.5,
                        borderTop: i === 0 ? "none" : "1px solid rgba(21,34,58,.08)",
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#c7ccd2", width: 22, flexShrink: 0 }}>
                        {i + 1}
                      </Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#15223a" }}>
                          {sec.heading}
                          <Box component="span" sx={{ fontSize: 11.5, fontWeight: 600, color: "#8b97ac", ml: 1 }}>
                            ~{sec.words} words
                          </Box>
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#5d6b85", lineHeight: 1.6 }}>{sec.job}</Typography>
                      </Box>
                    </Box>
                  ))}

                  {t.constraints?.length ? (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: "12px", bgcolor: "#fdf0e3" }}>
                      {t.constraints.map((c) => (
                        <Typography key={c} sx={{ fontSize: 12.5, color: "#a96a12", lineHeight: 1.6 }}>
                          {c}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </CardContent>
              </Card>
            );
          })()}

          {!busy && designing && (
            <Box className="fade-in-result" sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* The artboard sits bare on the grey. Its name and type are in
                  the chrome already; a title row here repeated the top bar and
                  cost a strip of height, and the Card around it put a second
                  white frame around a white page. */}
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flexShrink: 0,
                  alignSelf: "center", mb: 1,
                  px: 1, py: 0.5, borderRadius: "999px",
                  bgcolor: "#fff", border: "1px solid rgba(21,34,58,.10)",
                  boxShadow: "0 1px 3px rgba(21,34,58,.10)",
                }}>
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
                  {activeSeeds.length > 0 && (
                    <Tooltip title="Place the generated kicker, headline, supporting line and CTA onto the canvas as editable text (with readable pills)">
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
                <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <EditorCanvas
                    key={
                      designing.target === "draft"
                        ? `draft-${draft?.draftId ?? "x"}-${canvasEpoch}`
                        : designing.target === "concept"
                          ? `concept-${designing.idx}-${concepts[designing.idx]?.imageUrl ? "img" : "noimg"}`
                          : "scratch"
                    }
                    itemId={designing.target === "draft" ? draft?.draftId : undefined}
                    initialRevision={designing.target === "draft" ? draft?.revision : undefined}
                    initialDocument={designing.target === "draft" ? draft?.designDocument : undefined}
                    onSaved={(revision, designDocument) => {
                      if (designing.target === "draft") setDraft((d) => d ? { ...d, revision, designDocument } : d);
                    }}
                    toolsContainers={toolHosts}
                    contentTypeKey={contentType}
                    initialImage={
                      designing.target === "draft"
                        ? draft?.imageUrl ?? null
                        : designing.target === "concept"
                          ? concepts[designing.idx]?.imageUrl ?? null
                          : null
                    }
                    seedSignal={seedSignal}
                    initialTexts={activeSeeds.length ? activeSeeds : undefined}
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
              </Box>

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
                          {/* Where a finished draft goes is the project, not a
                              library page that is no longer in the menu. */}
                          <Button
                            component={Link}
                            href={projectId ? `/projects/${projectId}` : "/projects"}
                            startIcon={<FolderOpenIcon />}
                            sx={{ fontWeight: 600, color: "#5b6470" }}
                          >
                            {projectId ? "The project" : "Projects"}
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

        {/* ── RIGHT: the project's other versions ── */}
        {projectId && (
          <VariationStrip
            projectId={projectId}
            activeId={draft?.draftId ?? null}
            refreshKey={stripKey}
            onOpen={(v: StripVariant) => {
              // Opening another version does not lose this one: it is already
              // saved under the project, which is what saving there is for.
              setDraft({ content: v.body, draftId: v.id, revision: 1 });
              setDesigning(null);
            }}
          />
        )}
      </Box>
      </Box>

      {projectId && (
        <FloatingAssistant
          projectId={projectId}
          onApplied={() => setStripKey((n) => n + 1)}
        />
      )}
    </Box>
  );
}
