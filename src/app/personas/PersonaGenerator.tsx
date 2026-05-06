"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import ArticleIcon from "@mui/icons-material/Article";
import CampaignIcon from "@mui/icons-material/Campaign";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GroupsIcon from "@mui/icons-material/Groups";
import CheckIcon from "@mui/icons-material/Check";
import type { Brain, Persona } from "@/lib/brain";

type ContentType = "linkedin" | "newsletter" | "blog" | "ad" | "product" | "seo";
type Length = "short" | "medium" | "long";
type Lang = "auto" | "EN" | "DE" | "FR" | "IT";

const CONTENT_TYPES: { id: ContentType; label: string; icon: React.ReactNode; withImage: boolean }[] = [
  { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon fontSize="small" />, withImage: true },
  { id: "newsletter", label: "Newsletter", icon: <NewspaperIcon fontSize="small" />, withImage: false },
  { id: "blog", label: "Blog", icon: <ArticleIcon fontSize="small" />, withImage: false },
  { id: "ad", label: "Paid ad", icon: <CampaignIcon fontSize="small" />, withImage: true },
  { id: "product", label: "Product", icon: <ShoppingCartIcon fontSize="small" />, withImage: false },
  { id: "seo", label: "SEO", icon: <TravelExploreIcon fontSize="small" />, withImage: false },
];

// Persona → suggested default language (matches the persona's region).
const PERSONA_DEFAULT_LANG: Record<string, Lang> = {
  p1_dach_oem_purchaser: "DE",
  p2_digital_purchaser: "DE",
  p3_italy: "IT",
  p4_kmu_owner: "DE",
  p5_c2s: "DE",
  p6_mro: "DE",
  p7_engineer: "DE",
  p8_reseller: "EN",
};

export default function PersonaGenerator({
  brain,
  personas,
}: {
  brain: Brain;
  personas: Persona[];
}) {
  const [selectedId, setSelectedId] = useState<string>(personas[0]?.id ?? "");
  const [contentType, setContentType] = useState<ContentType>("linkedin");
  const [topic, setTopic] = useState<string>("");
  const [length, setLength] = useState<Length>("short");
  const [creativity, setCreativity] = useState<number>(70);
  const [lang, setLang] = useState<Lang>("auto");
  const [output, setOutput] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageError, setImageError] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>("");

  const selected = personas.find((p) => p.id === selectedId) ?? personas[0];
  const activeType = CONTENT_TYPES.find((c) => c.id === contentType)!;

  const effectiveLang =
    lang !== "auto" ? lang : PERSONA_DEFAULT_LANG[selectedId] ?? "EN";

  async function handleGenerate() {
    if (!selected) return;
    setError("");
    setOutput("");
    setImageUrl("");
    setImageError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: contentType,
          prompt:
            topic.trim() ||
            `Write a ${activeType.label} for persona ${selected.code} ${selected.name} about a topic naturally relevant to their day-to-day buying needs.`,
          model: "claude",
          personaId: selected.id,
          withImage: activeType.withImage,
          context: {
            contentType,
            language: effectiveLang,
            length,
            creativity,
            audience: `${selected.code} — ${selected.name} (${selected.role})`,
          },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        content: string;
        imageUrl?: string;
        imageError?: string;
      };
      setOutput(data.content);
      if (data.imageUrl) setImageUrl(data.imageUrl);
      if (data.imageError) setImageError(data.imageError);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (!personas.length) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography sx={{ color: "#5f6368" }}>
          No personas defined yet. Open the <strong>Personality</strong> brain and
          add personas in the Personas node first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2 }}>
      {/* ── LEFT: persona picker ── */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1px solid #e4e7eb",
          maxHeight: 720,
          overflowY: "auto",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, px: 0.5 }}>
          <GroupsIcon sx={{ fontSize: 18, color: "#7c3aed" }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#1a3a4c", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Choose persona
          </Typography>
        </Box>
        {personas.map((p) => {
          const active = p.id === selectedId;
          return (
            <Box
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedId(p.id);
              }}
              sx={{
                p: 1.25,
                mb: 0.5,
                borderRadius: 1.5,
                cursor: "pointer",
                bgcolor: active ? "#ede7f9" : "transparent",
                border: active ? "1px solid #7c3aed" : "1px solid transparent",
                transition: "background-color 0.15s ease, border-color 0.15s ease",
                "&:hover": { bgcolor: active ? "#ede7f9" : "#f6f7f9" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                <Chip
                  label={p.code}
                  size="small"
                  sx={{
                    bgcolor: active ? "#7c3aed" : "#5f6368",
                    color: "#fff",
                    fontWeight: 700,
                    height: 20,
                    minWidth: 32,
                  }}
                />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1a3a4c" }}>
                  {p.name}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: "#5f6368", lineHeight: 1.35 }}>
                {p.role}
              </Typography>
            </Box>
          );
        })}
      </Paper>

      {/* ── RIGHT: composer + output ── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Persona summary card */}
        {selected && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid #e4e7eb",
              bgcolor: "#fafbfc",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, mb: 1 }}>
              <Chip
                label={selected.code}
                size="small"
                sx={{ bgcolor: "#7c3aed", color: "#fff", fontWeight: 700 }}
              />
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1a3a4c" }}>
                {selected.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
                · {selected.role}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 13, color: "#3c4043", mb: 1 }}>
              {selected.description}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
              <Box>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.25 }}>
                  Goals
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#3c4043" }}>{selected.goals}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#ed1b2f", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.25 }}>
                  Challenges
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#3c4043" }}>{selected.challenges}</Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Composer */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid #e4e7eb" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            {CONTENT_TYPES.map((c) => {
              const active = c.id === contentType;
              return (
                <Chip
                  key={c.id}
                  label={c.label}
                  icon={c.icon as React.ReactElement}
                  onClick={() => setContentType(c.id)}
                  sx={{
                    bgcolor: active ? "#7c3aed" : "#f3f4f6",
                    color: active ? "#fff" : "#3c4043",
                    fontWeight: 600,
                    "& .MuiChip-icon": { color: active ? "#fff" : "#5f6368" },
                    "&:hover": { bgcolor: active ? "#6b2fd8" : "#e4e7eb" },
                  }}
                />
              );
            })}
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            label={`Topic / angle (optional — ${activeType.label})`}
            placeholder={
              `e.g. ${
                contentType === "linkedin"
                  ? "Why a 48h second source matters when an audited supplier slips a delivery"
                  : contentType === "newsletter"
                  ? "Quarterly stock-availability digest with one DirectCUT highlight"
                  : contentType === "ad"
                  ? "Drop-in replacement for a competitor part — ATEX-certified"
                  : "Choose an angle that this persona would actually click on"
              }`
            }
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }, gap: 1.5, mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Length</InputLabel>
              <Select
                label="Length"
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
              >
                <MenuItem value="short">Short</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="long">Long</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Language</InputLabel>
              <Select
                label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
              >
                <MenuItem value="auto">Auto (per persona)</MenuItem>
                <MenuItem value="EN">English</MenuItem>
                <MenuItem value="DE">German</MenuItem>
                <MenuItem value="FR">French</MenuItem>
                <MenuItem value="IT">Italian</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 2" } }}>
              <Typography sx={{ fontSize: 11, color: "#5f6368", mb: 0.25 }}>
                Creativity ({creativity})
              </Typography>
              <Slider
                size="small"
                value={creativity}
                min={20}
                max={100}
                step={5}
                onChange={(_, v) => setCreativity(v as number)}
                sx={{ color: "#7c3aed" }}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={generating || !selected}
              sx={{
                bgcolor: "#7c3aed",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { bgcolor: "#6b2fd8" },
              }}
            >
              {generating ? "Generating…" : `Generate for ${selected?.code ?? ""}`}
            </Button>
            {effectiveLang !== "EN" && (
              <Chip
                label={`Output: ${effectiveLang}`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, borderColor: "#7c3aed", color: "#7c3aed" }}
              />
            )}
            <Box sx={{ flex: 1 }} />
            {brain.brandVoice.strapline && (
              <Tooltip title="Brand strapline (the brain ensures it stays in voice)">
                <Typography sx={{ fontSize: 11, color: "#9aa0a6", fontStyle: "italic" }}>
                  {brain.brandVoice.strapline}
                </Typography>
              </Tooltip>
            )}
          </Box>
          {generating && <LinearProgress sx={{ mt: 1.25, "& .MuiLinearProgress-bar": { bgcolor: "#7c3aed" } }} />}
          {error && (
            <Typography sx={{ fontSize: 12, color: "#ed1b2f", mt: 1 }}>
              {error}
            </Typography>
          )}
        </Paper>

        {/* Output */}
        {(output || generating) && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px solid #e4e7eb" }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#1a3a4c", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Generated content
              </Typography>
              <Box sx={{ flex: 1 }} />
              {output && (
                <IconButton size="small" onClick={copyOutput}>
                  {copied ? <CheckIcon fontSize="small" sx={{ color: "#2e7d4f" }} /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              )}
            </Box>
            {output && (
              <Box
                sx={{
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "#1a3a4c",
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                {output}
              </Box>
            )}
            {imageUrl && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 11, color: "#5f6368", mb: 0.5 }}>
                  Image draft (Gemini)
                </Typography>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Generated"
                  style={{ width: "100%", maxWidth: 720, borderRadius: 8, border: "1px solid #e4e7eb" }}
                />
                {imageError && (
                  <Typography sx={{ fontSize: 11, color: "#ed1b2f", mt: 0.5 }}>
                    Image fallback used: {imageError}
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
