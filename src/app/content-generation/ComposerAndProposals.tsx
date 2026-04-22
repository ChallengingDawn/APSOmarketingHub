"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Avatar from "@mui/material/Avatar";
import Slider from "@mui/material/Slider";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ArticleIcon from "@mui/icons-material/Article";
import CampaignIcon from "@mui/icons-material/Campaign";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ImageIcon from "@mui/icons-material/Image";
import EditIcon from "@mui/icons-material/EditOutlined";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import CheckIcon from "@mui/icons-material/Check";
import PublicIcon from "@mui/icons-material/Public";
import TuneIcon from "@mui/icons-material/Tune";
import Skeleton from "@mui/material/Skeleton";
import type { Brain } from "@/lib/brain";
import type { CurrentBatch } from "@/lib/logs";
import { pushToGallery } from "@/lib/imageGallery";

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
  imagePending?: boolean;
  feedback?: "like" | "dislike";
  correction?: string;
};

type ContentType = "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
type Framework = "auto" | "ican" | "ease" | "recognition";
type Length = "short" | "medium" | "long";

const CONTENT_TYPES: { id: ContentType; label: string; icon: React.ReactNode; withImage: boolean }[] = [
  { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon fontSize="small" />, withImage: true },
  { id: "newsletter", label: "Newsletter", icon: <NewspaperIcon fontSize="small" />, withImage: true },
  { id: "blog", label: "Blog", icon: <ArticleIcon fontSize="small" />, withImage: true },
  { id: "ad", label: "Paid ad", icon: <CampaignIcon fontSize="small" />, withImage: true },
  { id: "product", label: "Product", icon: <ShoppingCartIcon fontSize="small" />, withImage: false },
  { id: "seo", label: "SEO", icon: <TravelExploreIcon fontSize="small" />, withImage: false },
];

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "ican", label: "I can do this now" },
  { id: "ease", label: "Ease / feature" },
  { id: "recognition", label: "We've already met" },
];

const AUDIENCES = [
  "Maintenance engineers",
  "Procurement / buyers",
  "Design engineers",
  "R&D engineers",
  "Plant managers",
  "Production / operations",
  "Quality assurance",
  "Automation engineers",
  "Facility managers",
  "MRO / aftermarket technicians",
  "OEM product managers",
  "Food & beverage engineers",
  "Chemical process engineers",
  "Pharma / GMP engineers",
  "Hydraulics & pneumatics specialists",
  "Distributors / resellers",
  "C-level / technical directors",
];

export default function ComposerAndProposals({
  brain,
  initialBatch,
}: {
  brain: Brain;
  initialBatch: CurrentBatch | null;
}) {
  const [composer, setComposer] = useState("");
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState<ContentType>("linkedin");
  const [framework, setFramework] = useState<Framework>("auto");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [category, setCategory] = useState<string>("");
  const [length, setLength] = useState<Length>("short");
  const [creativity, setCreativity] = useState<number>(70);
  const [selectedTones, setSelectedTones] = useState<string[]>(
    brain.brandVoice.toneAdjectives.slice(0, 2)
  );
  const [selectedPhrases, setSelectedPhrases] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>(
    (initialBatch?.proposals ?? []) as Proposal[]
  );
  const imageFetchedRef = useRef<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerImage, setComposerImage] = useState<{
    url: string;
    source: "gemini" | "fallback";
    error?: string;
    prompt?: string;
    pending?: boolean;
  } | null>(null);
  const [composerFeedback, setComposerFeedback] = useState<"like" | "dislike" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");

  const activeType = useMemo(
    () => CONTENT_TYPES.find((c) => c.id === contentType)!,
    [contentType]
  );

  const channelForApi = contentType;

  const filterContext = useMemo(
    () => ({
      contentType,
      language: "EN",
      framework,
      audience,
      category,
      length,
      creativity,
      emphasizeTones: selectedTones,
      emphasizePhrases: selectedPhrases,
      wantsImage: activeType.withImage,
    }),
    [contentType, framework, audience, category, length, creativity, selectedTones, selectedPhrases, activeType.withImage]
  );

  const toggleTone = (t: string) =>
    setSelectedTones((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 4 ? cur : [...cur, t]
    );

  const togglePhrase = (p: string) =>
    setSelectedPhrases((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : cur.length >= 3 ? cur : [...cur, p]
    );

  const resetFilters = () => {
    setFramework("auto");
    setAudience(AUDIENCES[0]);
    setCategory("");
    setLength("short");
    setCreativity(70);
    setSelectedTones(brain.brandVoice.toneAdjectives.slice(0, 2));
    setSelectedPhrases([]);
  };

  async function composeFromScratch() {
    if (!composer.trim()) return;
    setComposerLoading(true);
    setError(null);
    setComposerImage(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelForApi,
          prompt: composer,
          model: "claude",
          context: filterContext,
          withImage: activeType.withImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      } else {
        setComposer(data.content ?? composer);
        if (data.imageUrl) {
          setComposerImage({
            url: data.imageUrl,
            source: data.imageSource ?? "fallback",
            error: data.imageError,
            prompt: data.imageBrief ?? "",
          });
          pushToGallery({
            url: data.imageUrl,
            brief: data.imageBrief ?? composer.slice(0, 80),
            source: "composer",
          });
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setComposerLoading(false);
    }
  }

  async function fetchImageFor(index: number, prompt: string, force = false) {
    if (!force && imageFetchedRef.current.has(index)) return;
    imageFetchedRef.current.add(index);
    try {
      const res = await fetch("/api/propose/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, imagePrompt: prompt, filters: filterContext }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        pushToGallery({ url: data.imageUrl, brief: prompt, source: "proposal" });
      }
      setProposals((cur) =>
        cur.map((p, i) =>
          i === index
            ? {
                ...p,
                imageUrl: data.imageUrl ?? p.imageUrl,
                imageSource: data.imageSource ?? p.imageSource,
                imageError: data.imageError ?? p.imageError,
                imagePending: false,
              }
            : p
        )
      );
    } catch (err) {
      setProposals((cur) =>
        cur.map((p, i) =>
          i === index ? { ...p, imagePending: false, imageError: String(err) } : p
        )
      );
    }
  }

  async function repromptComposerImage(newPrompt: string) {
    setComposerImage((cur) =>
      cur ? { ...cur, pending: true, error: undefined, prompt: newPrompt } : cur
    );
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newPrompt, filters: filterContext }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        pushToGallery({ url: data.imageUrl, brief: newPrompt, source: "composer" });
      }
      setComposerImage((cur) =>
        cur
          ? {
              ...cur,
              url: data.imageUrl ?? cur.url,
              source: data.imageSource ?? cur.source,
              error: data.imageError,
              pending: false,
            }
          : cur
      );
    } catch (err) {
      setComposerImage((cur) =>
        cur ? { ...cur, pending: false, error: String(err) } : cur
      );
    }
  }

  function repromptProposalImage(index: number, newPrompt: string) {
    setProposals((cur) =>
      cur.map((p, i) =>
        i === index
          ? { ...p, imagePrompt: newPrompt, imagePending: true, imageError: undefined }
          : p
      )
    );
    fetchImageFor(index, newPrompt, true);
  }

  useEffect(() => {
    proposals.forEach((p, i) => {
      if (p.imagePending && p.imagePrompt && !imageFetchedRef.current.has(i)) {
        fetchImageFor(i, p.imagePrompt);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals]);

  async function propose() {
    setGenerating(true);
    setError(null);
    setProposals([]);
    imageFetchedRef.current.clear();
    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelForApi,
          topic,
          filters: filterContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Proposal generation failed");
      } else {
        setProposals(data.proposals ?? []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copyProposal(p: Proposal) {
    try {
      await navigator.clipboard.writeText(`${p.headline}\n\n${p.body}`);
    } catch {
      // silent
    }
  }

  function downloadImage(p: Proposal, index: number) {
    const a = document.createElement("a");
    a.href = p.imageUrl;
    a.download = `apso-${contentType}-${index + 1}.png`;
    a.click();
  }

  function sendToComposer(p: Proposal) {
    setComposer(`${p.headline}\n\n${p.body}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logComposer(action: "like" | "dislike", correction?: string) {
    if (!composer.trim()) return;
    setComposerFeedback(action);
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action,
          channel: channelForApi,
          body: composer,
          filters: filterContext,
          correction,
        }),
      });
    } catch {
      // silent
    }
  }

  async function logComposerComment() {
    if (!composer.trim() || !commentText.trim()) return;
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "comment",
          channel: channelForApi,
          body: composer,
          filters: filterContext,
          note: commentText.trim(),
        }),
      });
      setCommentText("");
      setShowComment(false);
    } catch {
      // silent
    }
  }

  async function logProposal(
    p: Proposal,
    index: number,
    action: "like" | "dislike",
    correction?: string
  ) {
    setProposals((cur) =>
      cur.map((x, i) => (i === index ? { ...x, feedback: action, correction } : x))
    );
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action,
          channel: channelForApi,
          headline: p.headline,
          body: p.body,
          prompt: topic,
          filters: filterContext,
          correction,
        }),
      });
    } catch {
      // silent
    }
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "320px 1fr" },
        gap: 2.5,
        alignItems: "start",
      }}
    >
      <FilterPanel
        brain={brain}
        contentType={contentType}
        setContentType={setContentType}
        framework={framework}
        setFramework={setFramework}
        audience={audience}
        setAudience={setAudience}
        category={category}
        setCategory={setCategory}
        length={length}
        setLength={setLength}
        creativity={creativity}
        setCreativity={setCreativity}
        selectedTones={selectedTones}
        toggleTone={toggleTone}
        selectedPhrases={selectedPhrases}
        togglePhrase={togglePhrase}
        onReset={resetFilters}
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
        <ComposerCard
          contentType={contentType}
          activeTypeLabel={activeType.label}
          composer={composer}
          setComposer={setComposer}
          loading={composerLoading}
          onEnhance={composeFromScratch}
          brainStrapline={brain.brandVoice.strapline}
          brainStoryline={brain.brandVoice.storyline}
          image={composerImage}
          onClearImage={() => setComposerImage(null)}
          onRepromptImage={repromptComposerImage}
          onLike={() => logComposer("like")}
          onDislike={() => logComposer("dislike")}
          composerFeedback={composerFeedback}
          showComment={showComment}
          commentText={commentText}
          setCommentText={setCommentText}
          toggleComment={() => setShowComment((v) => !v)}
          submitComment={logComposerComment}
        />

        <ProposalsSection
          generating={generating}
          topic={topic}
          setTopic={setTopic}
          onPropose={propose}
          proposals={proposals}
          error={error}
          wantsImage={activeType.withImage}
          contentTypeLabel={activeType.label}
          onCopy={copyProposal}
          onDownload={downloadImage}
          onSend={sendToComposer}
          onFeedback={logProposal}
          onRepromptImage={repromptProposalImage}
        />
      </Box>
    </Box>
  );
}

function FilterPanel(props: {
  brain: Brain;
  contentType: ContentType;
  setContentType: (v: ContentType) => void;
  framework: Framework;
  setFramework: (v: Framework) => void;
  audience: string;
  setAudience: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  length: Length;
  setLength: (v: Length) => void;
  creativity: number;
  setCreativity: (v: number) => void;
  selectedTones: string[];
  toggleTone: (t: string) => void;
  selectedPhrases: string[];
  togglePhrase: (t: string) => void;
  onReset: () => void;
}) {
  const { brain } = props;
  return (
    <Paper
      elevation={0}
      sx={{
        position: { lg: "sticky" },
        top: { lg: 16 },
        borderRadius: 3,
        border: "1px solid #dde1e6",
        bgcolor: "#ffffff",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TuneIcon sx={{ color: "#274e64", fontSize: 20 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a3a4c" }}>
            Filters
          </Typography>
        </Box>
        <Tooltip title="Reset filters">
          <IconButton size="small" onClick={props.onReset} sx={{ color: "#5f6368" }}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Section label="Content type">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
          {CONTENT_TYPES.map((t) => {
            const active = props.contentType === t.id;
            return (
              <Box
                key={t.id}
                role="button"
                onClick={() => props.setContentType(t.id)}
                sx={{
                  py: 1,
                  px: 0.5,
                  borderRadius: 1.5,
                  border: `1.5px solid ${active ? "#ed1b2f" : "#dde1e6"}`,
                  bgcolor: active ? "#fdebed" : "#fafbfc",
                  color: active ? "#ed1b2f" : "#3c4043",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.35,
                  transition: "all 0.15s ease",
                  "&:hover": {
                    borderColor: "#ed1b2f",
                    bgcolor: "#fdebed",
                  },
                }}
              >
                {t.icon}
                <Typography sx={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1 }}>
                  {t.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Section>

      <Section label="Framework">
        <ChipGroup
          value={props.framework}
          options={FRAMEWORKS}
          onChange={(v) => props.setFramework(v as Framework)}
        />
      </Section>

      <Section label="Category">
        <FormControl size="small" fullWidth>
          <InputLabel>Top-level</InputLabel>
          <Select
            value={props.category}
            label="Top-level"
            onChange={(e) => props.setCategory(String(e.target.value))}
          >
            <MenuItem value="">
              <em>Any</em>
            </MenuItem>
            {brain.categoryIntelligence.topLevel.map((c) => (
              <MenuItem key={c.code} value={c.en}>
                {c.en} · {c.de}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Section>

      <Section label="Audience">
        <FormControl size="small" fullWidth>
          <Select value={props.audience} onChange={(e) => props.setAudience(String(e.target.value))}>
            {AUDIENCES.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Section>

      <Section label="Length">
        <ChipGroup
          value={props.length}
          options={[
            { id: "short", label: "Short" },
            { id: "medium", label: "Medium" },
            { id: "long", label: "Long" },
          ]}
          onChange={(v) => props.setLength(v as Length)}
        />
      </Section>

      <Section
        label="Creativity"
        right={
          <Typography sx={{ fontSize: 11, color: "#5f6368", fontWeight: 600 }}>
            {props.creativity}%
          </Typography>
        }
      >
        <Slider
          value={props.creativity}
          min={20}
          max={100}
          onChange={(_, v) => props.setCreativity(v as number)}
          sx={{
            color: "#ed1b2f",
            mt: 0.5,
            "& .MuiSlider-track": { border: "none" },
            "& .MuiSlider-thumb": {
              width: 14,
              height: 14,
              "&:focus, &:hover, &.Mui-active": {
                boxShadow: "0 0 0 6px rgba(237,27,47,0.16)",
              },
            },
          }}
        />
      </Section>

      <Divider />

      <Section label="Emphasize tone (from Brain)">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {brain.brandVoice.toneAdjectives.map((t) => {
            const active = props.selectedTones.includes(t);
            return (
              <Chip
                key={t}
                label={t}
                size="small"
                onClick={() => props.toggleTone(t)}
                sx={{
                  height: 24,
                  fontSize: 11,
                  cursor: "pointer",
                  bgcolor: active ? "#e8f0f4" : "#fafbfc",
                  color: active ? "#274e64" : "#5f6368",
                  border: `1px solid ${active ? "#274e64" : "#dde1e6"}`,
                  fontWeight: active ? 700 : 500,
                }}
              />
            );
          })}
        </Box>
      </Section>

      <Section label="Force-include phrase">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {brain.brandVoice.signaturePhrases.map((p) => {
            const active = props.selectedPhrases.includes(p);
            return (
              <Box
                key={p}
                onClick={() => props.togglePhrase(p)}
                sx={{
                  p: 0.75,
                  px: 1,
                  borderRadius: 1,
                  border: `1px solid ${active ? "#ed1b2f" : "#ececec"}`,
                  bgcolor: active ? "#fdebed" : "#fafbfc",
                  color: active ? "#ed1b2f" : "#3c4043",
                  cursor: "pointer",
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  fontWeight: active ? 600 : 500,
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: "#ed1b2f" },
                }}
              >
                {p}
              </Box>
            );
          })}
        </Box>
      </Section>

    </Paper>
  );
}

function ComposerCard(props: {
  contentType: ContentType;
  activeTypeLabel: string;
  composer: string;
  setComposer: (v: string) => void;
  loading: boolean;
  onEnhance: () => void;
  brainStrapline: string;
  brainStoryline: string;
  image: {
    url: string;
    source: "gemini" | "fallback";
    error?: string;
    prompt?: string;
    pending?: boolean;
  } | null;
  onClearImage: () => void;
  onRepromptImage: (newPrompt: string) => void;
  onLike: () => void;
  onDislike: () => void;
  composerFeedback: "like" | "dislike" | null;
  showComment: boolean;
  commentText: string;
  setCommentText: (v: string) => void;
  toggleComment: () => void;
  submitComment: () => void;
}) {
  const [editingImage, setEditingImage] = useState(false);
  const [draftImagePrompt, setDraftImagePrompt] = useState(props.image?.prompt ?? "");
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #dde1e6",
        bgcolor: "#ffffff",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Avatar
          sx={{ bgcolor: "#ed1b2f", width: 48, height: 48, fontWeight: 800, fontSize: 20 }}
        >
          A
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a3a4c" }}>
            APSOparts
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: "#5f6368" }}>Marketing</Typography>
            <Typography sx={{ fontSize: 12, color: "#5f6368" }}>·</Typography>
            <PublicIcon sx={{ fontSize: 12, color: "#5f6368" }} />
            <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
              {props.activeTypeLabel} · Public draft
            </Typography>
          </Box>
        </Box>
        <Chip
          label="Brain-informed"
          size="small"
          icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
          sx={{
            bgcolor: "#fdebed",
            color: "#ed1b2f",
            fontWeight: 600,
            height: 24,
            "& .MuiChip-icon": { color: "#ed1b2f" },
          }}
        />
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, py: 2 }}>
        <TextField
          multiline
          minRows={6}
          maxRows={18}
          fullWidth
          placeholder={`What do you want to create? (e.g. "FFKM demand is up 6× — let customers know we stock it")\n\nPersonality context: "${props.brainStrapline}" · "${props.brainStoryline}"`}
          value={props.composer}
          onChange={(e) => props.setComposer(e.target.value)}
          variant="standard"
          slotProps={{
            input: {
              disableUnderline: true,
              sx: { fontSize: 15, lineHeight: 1.55, color: "#1f1f1f" },
            },
          }}
        />
        {props.loading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
      </Box>
      {props.image && (
        <>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              bgcolor: "#eceff1",
              borderTop: "1px solid #ececec",
              borderBottom: "1px solid #ececec",
            }}
          >
            {props.image.pending ? (
              <Skeleton
                variant="rectangular"
                animation="wave"
                width="100%"
                height="100%"
                sx={{ bgcolor: "rgba(237,27,47,0.08)" }}
              />
            ) : (
              <Image
                src={props.image.url}
                alt="Generated image"
                fill
                sizes="(min-width: 900px) 800px, 100vw"
                style={{ objectFit: "cover" }}
                unoptimized={props.image.url.startsWith("data:")}
              />
            )}
            <Chip
              label={
                props.image.pending
                  ? "Rendering…"
                  : props.image.source === "gemini"
                    ? "Gemini image"
                    : "Mood library"
              }
              size="small"
              icon={<ImageIcon sx={{ fontSize: 12 }} />}
              sx={{
                position: "absolute",
                top: 10,
                left: 10,
                bgcolor: props.image.pending
                  ? "rgba(39,78,100,0.9)"
                  : props.image.source === "gemini"
                    ? "rgba(237,27,47,0.9)"
                    : "rgba(15,20,26,0.78)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
                height: 22,
                "& .MuiChip-icon": { color: "#fff" },
              }}
            />
            <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 0.5 }}>
              <Tooltip title="Reprompt image">
                <IconButton
                  size="small"
                  disabled={props.image.pending}
                  onClick={() => {
                    setDraftImagePrompt(props.image?.prompt ?? "");
                    setEditingImage((v) => !v);
                  }}
                  sx={{
                    bgcolor: "rgba(15,20,26,0.72)",
                    color: "#fff",
                    "&:hover": { bgcolor: "rgba(237,27,47,0.9)" },
                  }}
                >
                  <AutoFixHighIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove image">
                <IconButton
                  size="small"
                  onClick={props.onClearImage}
                  sx={{
                    bgcolor: "rgba(15,20,26,0.7)",
                    color: "#fff",
                    "&:hover": { bgcolor: "rgba(15,20,26,0.9)" },
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {props.image.error && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 10,
                  left: 10,
                  right: 10,
                  bgcolor: "rgba(255,255,255,0.9)",
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography sx={{ fontSize: 10.5, color: "#ed1b2f", fontStyle: "italic" }}>
                  {props.image.error}
                </Typography>
              </Box>
            )}
          </Box>
          {editingImage && (
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: "#f7f9fc", borderBottom: "1px dashed #ed1b2f" }}>
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "#ed1b2f",
                  mb: 0.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Image brief
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                size="small"
                value={draftImagePrompt}
                onChange={(e) => setDraftImagePrompt(e.target.value)}
                placeholder="Describe the image you want — hands, components, context…"
              />
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AutoFixHighIcon fontSize="small" />}
                  onClick={() => {
                    if (!draftImagePrompt.trim()) return;
                    props.onRepromptImage(draftImagePrompt.trim());
                    setEditingImage(false);
                  }}
                  sx={{
                    bgcolor: "#ed1b2f",
                    textTransform: "none",
                    fontWeight: 600,
                    "&:hover": { bgcolor: "#c91528" },
                  }}
                >
                  Regenerate image
                </Button>
                <Button
                  size="small"
                  onClick={() => setEditingImage(false)}
                  sx={{ textTransform: "none", color: "#5f6368" }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}
      {props.showComment && (
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: "#fafbfc", borderTop: "1px solid #ececec" }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#5f6368", mb: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Note / comment (saved to logs)
          </Typography>
          <TextField
            multiline
            minRows={2}
            fullWidth
            size="small"
            placeholder="Add context for future generations — e.g. 'this angle works for Q3'"
            value={props.commentText}
            onChange={(e) => props.setCommentText(e.target.value)}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              size="small"
              onClick={props.submitComment}
              disabled={!props.commentText.trim()}
              variant="contained"
              sx={{ bgcolor: "#274e64", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#1a3a4c" } }}
            >
              Save note
            </Button>
            <Button
              size="small"
              onClick={props.toggleComment}
              sx={{ textTransform: "none", color: "#5f6368" }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
      <Divider />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.25,
          bgcolor: "#fafbfc",
        }}
      >
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <FeedbackButton
            icon={<ThumbUpOffAltIcon fontSize="small" />}
            activeIcon={<ThumbUpIcon fontSize="small" />}
            label="Like"
            color="#2e7d32"
            active={props.composerFeedback === "like"}
            onClick={props.onLike}
            disabled={!props.composer.trim()}
          />
          <FeedbackButton
            icon={<ThumbDownIcon fontSize="small" sx={{ opacity: 0.65 }} />}
            activeIcon={<ThumbDownIcon fontSize="small" />}
            label="Dislike"
            color="#ed1b2f"
            active={props.composerFeedback === "dislike"}
            onClick={props.onDislike}
            disabled={!props.composer.trim()}
          />
          <FeedbackButton
            icon={<ChatBubbleOutlineIcon fontSize="small" />}
            activeIcon={<ChatBubbleOutlineIcon fontSize="small" />}
            label="Comment"
            color="#274e64"
            active={props.showComment}
            onClick={props.toggleComment}
            disabled={!props.composer.trim()}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={props.onEnhance}
            disabled={props.loading || !props.composer.trim()}
            startIcon={<AutoAwesomeIcon />}
            sx={{
              textTransform: "none",
              color: "#274e64",
              fontWeight: 600,
              "&:hover": { bgcolor: "#e8f0f4" },
            }}
          >
            Enhance with AI
          </Button>
          <Button
            onClick={() => navigator.clipboard.writeText(props.composer)}
            disabled={!props.composer.trim()}
            startIcon={<ContentCopyIcon />}
            sx={{ textTransform: "none", color: "#3c4043" }}
          >
            Copy
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

function ProposalsSection(props: {
  generating: boolean;
  topic: string;
  setTopic: (v: string) => void;
  onPropose: () => void;
  proposals: Proposal[];
  error: string | null;
  wantsImage: boolean;
  contentTypeLabel: string;
  onCopy: (p: Proposal) => void;
  onDownload: (p: Proposal, i: number) => void;
  onSend: (p: Proposal) => void;
  onFeedback: (p: Proposal, i: number, action: "like" | "dislike", correction?: string) => void;
  onRepromptImage: (i: number, newPrompt: string) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: "1px solid #dde1e6",
        bgcolor: "#ffffff",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <AutoAwesomeIcon sx={{ color: "#ed1b2f" }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#1a3a4c", flex: 1, minWidth: 220 }}>
          3 AI proposals {props.wantsImage ? "(text + image)" : "(text)"}
        </Typography>
        <TextField
          size="small"
          placeholder="Topic (optional)"
          value={props.topic}
          onChange={(e) => props.setTopic(e.target.value)}
          sx={{ flex: 1, minWidth: 200, maxWidth: 320 }}
        />
        <Button
          variant="contained"
          onClick={props.onPropose}
          disabled={props.generating}
          startIcon={<AutoAwesomeIcon />}
          sx={{
            bgcolor: "#ed1b2f",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { bgcolor: "#c91528" },
          }}
        >
          {props.generating
            ? "Generating…"
            : props.proposals.length > 0
              ? "Repropose 3"
              : "Propose 3"}
        </Button>
      </Box>
      {props.generating && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {props.error && (
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1,
            bgcolor: "#fdebed",
            border: "1px solid #ed1b2f",
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: 12, color: "#ed1b2f" }}>{props.error}</Typography>
        </Box>
      )}

      {props.proposals.length === 0 && !props.generating && (
        <Box
          sx={{
            py: 6,
            textAlign: "center",
            border: "1.5px dashed #dde1e6",
            borderRadius: 2,
            bgcolor: "#fafbfc",
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 32, color: "#b0b6be", mb: 1 }} />
          <Typography sx={{ fontSize: 13, color: "#5f6368" }}>
            Click <strong>Propose 3</strong> to generate three {props.contentTypeLabel} drafts
            {props.wantsImage ? " with matching images" : ""} — all grounded in the Personality brain
            and filters.
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {props.proposals.map((p, i) => (
          <ProposalCard
            key={i}
            proposal={p}
            index={i}
            wantsImage={props.wantsImage}
            onCopy={props.onCopy}
            onDownload={props.onDownload}
            onSend={props.onSend}
            onFeedback={props.onFeedback}
            onRepromptImage={props.onRepromptImage}
          />
        ))}
      </Box>
    </Paper>
  );
}

function ProposalCard({
  proposal: p,
  index: i,
  wantsImage,
  onCopy,
  onDownload,
  onSend,
  onFeedback,
  onRepromptImage,
}: {
  proposal: Proposal;
  index: number;
  wantsImage: boolean;
  onCopy: (p: Proposal) => void;
  onDownload: (p: Proposal, i: number) => void;
  onSend: (p: Proposal) => void;
  onFeedback: (p: Proposal, i: number, action: "like" | "dislike", correction?: string) => void;
  onRepromptImage: (i: number, newPrompt: string) => void;
}) {
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [editingImage, setEditingImage] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(p.imagePrompt);

  const submitDislike = () => {
    if (!correction.trim()) return;
    onFeedback(p, i, "dislike", correction.trim());
    setShowCorrection(false);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#ffffff",
        borderColor:
          p.feedback === "like"
            ? "#2e7d32"
            : p.feedback === "dislike"
              ? "#ed1b2f"
              : "#dde1e6",
        transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
        },
      }}
    >
      {wantsImage && (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            bgcolor: "#eceff1",
          }}
        >
          {p.imagePending ? (
            <Skeleton
              variant="rectangular"
              animation="wave"
              width="100%"
              height="100%"
              sx={{ bgcolor: "rgba(237,27,47,0.08)" }}
            />
          ) : (
            <Image
              src={p.imageUrl}
              alt={p.headline}
              fill
              sizes="(min-width: 900px) 280px, 90vw"
              style={{ objectFit: "cover" }}
              unoptimized={p.imageUrl.startsWith("data:")}
            />
          )}
          <Chip
            label={
              p.imagePending
                ? "Rendering…"
                : p.imageSource === "gemini"
                  ? "Gemini"
                  : "Mood library"
            }
            size="small"
            icon={<ImageIcon sx={{ fontSize: 12 }} />}
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: p.imagePending
                ? "rgba(39,78,100,0.9)"
                : p.imageSource === "gemini"
                  ? "rgba(237,27,47,0.9)"
                  : "rgba(15,20,26,0.78)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              height: 22,
              "& .MuiChip-icon": { color: "#fff" },
            }}
          />
          <Tooltip title="Reprompt image">
            <IconButton
              size="small"
              onClick={() => {
                setDraftPrompt(p.imagePrompt);
                setEditingImage((v) => !v);
              }}
              disabled={p.imagePending}
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                bgcolor: "rgba(15,20,26,0.72)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(237,27,47,0.9)" },
              }}
            >
              <AutoFixHighIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {editingImage && wantsImage && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: "#f7f9fc", borderTop: "1px dashed #ed1b2f" }}>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#ed1b2f",
              mb: 0.5,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Image brief
          </Typography>
          <TextField
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AutoFixHighIcon fontSize="small" />}
              onClick={() => {
                if (!draftPrompt.trim()) return;
                onRepromptImage(i, draftPrompt.trim());
                setEditingImage(false);
              }}
              sx={{
                bgcolor: "#ed1b2f",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { bgcolor: "#c91528" },
              }}
            >
              Regenerate image
            </Button>
            <Button
              size="small"
              onClick={() => setEditingImage(false)}
              sx={{ textTransform: "none", color: "#5f6368" }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
      <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1a3a4c", lineHeight: 1.3 }}>
          {p.headline}
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: "#3c4043",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            flex: 1,
          }}
        >
          {p.body}
        </Typography>
        {p.imagePrompt && wantsImage && (
          <Typography
            sx={{
              fontSize: 11,
              color: "#5f6368",
              fontStyle: "italic",
              mt: 0.5,
              borderTop: "1px dashed #ececec",
              pt: 1,
            }}
          >
            Image brief: {p.imagePrompt}
          </Typography>
        )}
        {p.imageError && (
          <Typography sx={{ fontSize: 10.5, color: "#ed1b2f", fontStyle: "italic" }}>
            Image gen: {p.imageError}
          </Typography>
        )}
      </Box>

      {showCorrection && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: "#fff5f5", borderTop: "1px dashed #ed1b2f" }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#ed1b2f", mb: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            What would you have preferred?
          </Typography>
          <TextField
            multiline
            minRows={2}
            fullWidth
            size="small"
            placeholder="e.g. 'too long, aim for 80 words' or 'don't mention competitors'"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
          />
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              size="small"
              onClick={submitDislike}
              disabled={!correction.trim()}
              variant="contained"
              startIcon={<CheckIcon fontSize="small" />}
              sx={{ bgcolor: "#ed1b2f", textTransform: "none", fontWeight: 600, "&:hover": { bgcolor: "#c91528" } }}
            >
              Save correction
            </Button>
            <Button
              size="small"
              onClick={() => setShowCorrection(false)}
              sx={{ textTransform: "none", color: "#5f6368" }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      <Divider />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, bgcolor: "#fafbfc" }}>
        <Tooltip title={p.feedback === "like" ? "Liked — saved to logs" : "Like (save as good example)"}>
          <IconButton
            size="small"
            onClick={() => onFeedback(p, i, "like")}
            sx={{
              color: "#2e7d32",
              bgcolor: p.feedback === "like" ? "rgba(46,125,50,0.14)" : "transparent",
              "&:hover": { bgcolor: "rgba(46,125,50,0.12)" },
            }}
          >
            {p.feedback === "like" ? (
              <ThumbUpIcon fontSize="small" />
            ) : (
              <ThumbUpOffAltIcon fontSize="small" sx={{ opacity: 0.8 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={p.feedback === "dislike" ? "Disliked — correction saved" : "Dislike (add correction)"}>
          <IconButton
            size="small"
            onClick={() => setShowCorrection(true)}
            sx={{
              color: "#ed1b2f",
              bgcolor: p.feedback === "dislike" ? "rgba(237,27,47,0.14)" : "transparent",
              "&:hover": { bgcolor: "rgba(237,27,47,0.12)" },
            }}
          >
            <ThumbDownIcon
              fontSize="small"
              sx={{ opacity: p.feedback === "dislike" ? 1 : 0.8 }}
            />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
        <Tooltip title="Send to composer">
          <IconButton size="small" onClick={() => onSend(p)} sx={{ color: "#274e64" }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Copy text">
          <IconButton size="small" onClick={() => onCopy(p)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {wantsImage && (
          <Tooltip title="Download image">
            <IconButton size="small" onClick={() => onDownload(p, i)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`#${i + 1}`}
          size="small"
          sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 700, height: 20 }}
        />
      </Box>
    </Paper>
  );
}

function Section({
  label,
  children,
  right,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
        <Typography
          sx={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "#5f6368",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

function ChipGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <Chip
            key={o.id}
            label={o.label}
            size="small"
            onClick={() => onChange(o.id)}
            sx={{
              height: 26,
              fontSize: 11.5,
              cursor: "pointer",
              bgcolor: active ? "#274e64" : "#fafbfc",
              color: active ? "#fff" : "#3c4043",
              border: `1px solid ${active ? "#274e64" : "#dde1e6"}`,
              fontWeight: active ? 700 : 500,
              "&:hover": {
                bgcolor: active ? "#1a3a4c" : "#e8f0f4",
              },
            }}
          />
        );
      })}
    </Box>
  );
}

function FeedbackButton({
  icon,
  activeIcon,
  label,
  color,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.25,
        py: 0.6,
        borderRadius: 1.5,
        color: active ? color : "#5f6368",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background-color 0.15s ease, color 0.15s ease",
        bgcolor: active ? `${color}15` : "transparent",
        "&:hover": disabled
          ? undefined
          : {
              bgcolor: `${color}18`,
              color,
            },
      }}
    >
      {active ? activeIcon : icon}
      <Typography sx={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{label}</Typography>
    </Box>
  );
}