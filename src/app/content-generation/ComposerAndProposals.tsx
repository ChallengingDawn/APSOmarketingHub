"use client";
import { useMemo, useState } from "react";
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
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import RepeatIcon from "@mui/icons-material/Repeat";
import SendIcon from "@mui/icons-material/SendOutlined";
import PublicIcon from "@mui/icons-material/Public";
import TuneIcon from "@mui/icons-material/Tune";
import type { Brain } from "@/lib/brain";

type Proposal = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl: string;
  imageSource: "gemini" | "fallback";
  imageError?: string;
};

type ContentType = "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
type Language = "EN" | "DE";
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
  "Plant managers",
];

export default function ComposerAndProposals({ brain }: { brain: Brain }) {
  const [composer, setComposer] = useState("");
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState<ContentType>("linkedin");
  const [language, setLanguage] = useState<Language>("EN");
  const [framework, setFramework] = useState<Framework>("auto");
  const [audience, setAudience] = useState<string>(AUDIENCES[0]);
  const [category, setCategory] = useState<string>("");
  const [length, setLength] = useState<Length>("short");
  const [creativity, setCreativity] = useState<number>(70);
  const [model, setModel] = useState<"claude" | "gemini">("claude");
  const [selectedTones, setSelectedTones] = useState<string[]>(
    brain.brandVoice.toneAdjectives.slice(0, 2)
  );
  const [selectedPhrases, setSelectedPhrases] = useState<string[]>([]);

  const [generating, setGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composerLoading, setComposerLoading] = useState(false);

  const activeType = useMemo(
    () => CONTENT_TYPES.find((c) => c.id === contentType)!,
    [contentType]
  );

  const channelForApi =
    contentType === "ad" ? "linkedin" : contentType === "seo" ? "seo" : contentType;

  const filterContext = useMemo(
    () => ({
      contentType,
      language,
      framework,
      audience,
      category,
      length,
      creativity,
      emphasizeTones: selectedTones,
      emphasizePhrases: selectedPhrases,
      wantsImage: activeType.withImage,
    }),
    [contentType, language, framework, audience, category, length, creativity, selectedTones, selectedPhrases, activeType.withImage]
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
    setLanguage("EN");
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
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channelForApi,
          prompt: composer,
          model,
          context: filterContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      } else {
        setComposer(data.content ?? composer);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setComposerLoading(false);
    }
  }

  async function propose() {
    setGenerating(true);
    setError(null);
    setProposals([]);
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
        language={language}
        setLanguage={setLanguage}
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
        model={model}
        setModel={setModel}
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
        />
      </Box>
    </Box>
  );
}

function FilterPanel(props: {
  brain: Brain;
  contentType: ContentType;
  setContentType: (v: ContentType) => void;
  language: Language;
  setLanguage: (v: Language) => void;
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
  model: "claude" | "gemini";
  setModel: (v: "claude" | "gemini") => void;
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

      <Section label="Language">
        <ChipGroup
          value={props.language}
          options={[
            { id: "EN", label: "English" },
            { id: "DE", label: "Deutsch" },
          ]}
          onChange={(v) => props.setLanguage(v as Language)}
        />
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

      <Divider />

      <Section label="Model">
        <ChipGroup
          value={props.model}
          options={[
            { id: "claude", label: "Claude" },
            { id: "gemini", label: "Gemini" },
          ]}
          onChange={(v) => props.setModel(v as "claude" | "gemini")}
        />
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
}) {
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
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <ActionIcon icon={<ThumbUpOffAltIcon fontSize="small" />} label="Like" />
          <ActionIcon icon={<ChatBubbleOutlineIcon fontSize="small" />} label="Comment" />
          <ActionIcon icon={<RepeatIcon fontSize="small" />} label="Repost" />
          <ActionIcon icon={<SendIcon fontSize="small" />} label="Send" />
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
          {props.generating ? "Generating…" : "Propose 3"}
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
          <Paper
            key={i}
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              bgcolor: "#ffffff",
              borderColor: "#dde1e6",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
              },
            }}
          >
            {props.wantsImage && (
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  bgcolor: "#eceff1",
                }}
              >
                <Image
                  src={p.imageUrl}
                  alt={p.headline}
                  fill
                  sizes="(min-width: 900px) 280px, 90vw"
                  style={{ objectFit: "cover" }}
                  unoptimized={p.imageUrl.startsWith("data:")}
                />
                <Chip
                  label={p.imageSource === "gemini" ? "Gemini" : "Mood library"}
                  size="small"
                  icon={<ImageIcon sx={{ fontSize: 12 }} />}
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    bgcolor: p.imageSource === "gemini" ? "rgba(237,27,47,0.9)" : "rgba(15,20,26,0.78)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    height: 22,
                    "& .MuiChip-icon": { color: "#fff" },
                  }}
                />
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
              {p.imagePrompt && props.wantsImage && (
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
            <Divider />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, bgcolor: "#fafbfc" }}>
              <Tooltip title="Send to composer">
                <IconButton size="small" onClick={() => props.onSend(p)} sx={{ color: "#274e64" }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy text">
                <IconButton size="small" onClick={() => props.onCopy(p)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {props.wantsImage && (
                <Tooltip title="Download image">
                  <IconButton size="small" onClick={() => props.onDownload(p, i)}>
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
        ))}
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

function ActionIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        color: "#5f6368",
        cursor: "default",
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{label}</Typography>
    </Box>
  );
}