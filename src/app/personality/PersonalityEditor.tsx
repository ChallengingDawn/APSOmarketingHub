"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Divider from "@mui/material/Divider";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import BrainGraph from "./BrainGraph";
import type { Brain } from "@/lib/brain";

const SECTIONS = [
  { id: "voice", label: "Brand Voice" },
  { id: "guard", label: "Positioning Guard" },
  { id: "phrases", label: "Signature Phrases" },
  { id: "product", label: "Product Rules" },
  { id: "social", label: "Social Rules" },
  { id: "gold", label: "Gold Examples" },
  { id: "category", label: "Category Intel" },
  { id: "keywords", label: "Keyword Signals" },
];

export default function PersonalityEditor({ initial }: { initial: Brain }) {
  const [brain, setBrain] = useState<Brain>(initial);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>(
    { open: false, msg: "", severity: "success" }
  );

  const active = SECTIONS[tab].id;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brain),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = (await res.json()) as Brain;
      setBrain(saved);
      setToast({ open: true, msg: "Brain updated", severity: "success" });
    } catch (err) {
      setToast({ open: true, msg: `Save failed: ${String(err)}`, severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  const updateList = (
    section: keyof Brain,
    field: string,
    next: string[]
  ) => {
    setBrain((b) => ({
      ...b,
      [section]: { ...(b[section] as Record<string, unknown>), [field]: next },
    }));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5, color: "#1a3a4c" }}>
          Neuro-linked brain
        </Typography>
        <BrainGraph activeId={active} />
      </Paper>

      <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ "& .MuiTab-root": { textTransform: "none", fontSize: 13, minHeight: 42 } }}
          >
            {SECTIONS.map((s) => (
              <Tab key={s.id} label={s.label} />
            ))}
          </Tabs>
          <Button
            onClick={save}
            disabled={saving}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: "#274e64",
              textTransform: "none",
              "&:hover": { bgcolor: "#1a3a4c" },
            }}
          >
            {saving ? "Saving…" : "Save Brain"}
          </Button>
        </Box>
        <Divider />
        <Box sx={{ p: 2.5 }}>
          {active === "voice" && (
            <VoiceTab
              brain={brain}
              onChange={(patch) =>
                setBrain((b) => ({ ...b, brandVoice: { ...b.brandVoice, ...patch } }))
              }
              onListChange={(field, next) => updateList("brandVoice", field, next)}
            />
          )}
          {active === "guard" && (
            <GuardTab
              brain={brain}
              onChange={(patch) =>
                setBrain((b) => ({
                  ...b,
                  positioningGuard: { ...b.positioningGuard, ...patch },
                }))
              }
            />
          )}
          {active === "phrases" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
                Short expressions the bot should reuse naturally across channels.
              </Typography>
              <ListEditor
                label="Signature Phrases"
                items={brain.brandVoice.signaturePhrases}
                onChange={(next: string[]) => updateList("brandVoice", "signaturePhrases", next)}
              />
            </Box>
          )}
          {active === "product" && (
            <ProductRulesTab
              brain={brain}
              onListChange={(field, next) => updateList("productContentRules", field, next)}
            />
          )}
          {active === "social" && (
            <SocialRulesTab
              brain={brain}
              onChange={(patch) =>
                setBrain((b) => ({
                  ...b,
                  socialMediaRules: { ...b.socialMediaRules, ...patch },
                }))
              }
              onListChange={(field, next) => updateList("socialMediaRules", field, next)}
            />
          )}
          {active === "gold" && (
            <GoldTab
              brain={brain}
              onChange={(next) => setBrain((b) => ({ ...b, goldExamples: next }))}
            />
          )}
          {active === "category" && <CategoryTab brain={brain} />}
          {active === "keywords" && <KeywordsTab brain={brain} />}
        </Box>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function VoiceTab({
  brain,
  onChange,
  onListChange,
}: {
  brain: Brain;
  onChange: (p: Partial<Brain["brandVoice"]>) => void;
  onListChange: (field: string, next: string[]) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        label="Strapline"
        value={brain.brandVoice.strapline}
        onChange={(e) => onChange({ strapline: e.target.value })}
        size="small"
        fullWidth
      />
      <TextField
        label="Storyline"
        value={brain.brandVoice.storyline}
        onChange={(e) => onChange({ storyline: e.target.value })}
        size="small"
        fullWidth
      />
      <TextField
        label="Series framework"
        value={brain.brandVoice.seriesFramework}
        onChange={(e) => onChange({ seriesFramework: e.target.value })}
        size="small"
        fullWidth
      />
      <TextField
        label="Audience"
        value={brain.brandVoice.audience}
        onChange={(e) => onChange({ audience: e.target.value })}
        size="small"
        fullWidth
        multiline
        rows={2}
      />
      <ChipListEditor
        label="Tone adjectives"
        items={brain.brandVoice.toneAdjectives}
        onChange={(next) => onListChange("toneAdjectives", next)}
      />
      <ListEditor
        label="Messaging pillars"
        items={brain.brandVoice.messagingPillars}
        onChange={(next) => onListChange("messagingPillars", next)}
      />
      <ListEditor
        label="Do"
        items={brain.brandVoice.dos}
        onChange={(next) => onListChange("dos", next)}
      />
      <ListEditor
        label="Do not"
        items={brain.brandVoice.donts}
        onChange={(next) => onListChange("donts", next)}
      />
    </Box>
  );
}

function GuardTab({
  brain,
  onChange,
}: {
  brain: Brain;
  onChange: (p: Partial<Brain["positioningGuard"]>) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        label="APSOparts lane"
        value={brain.positioningGuard.apsoparts}
        onChange={(e) => onChange({ apsoparts: e.target.value })}
        size="small"
        fullWidth
        multiline
        rows={2}
      />
      <TextField
        label="Angst+Pfister parent lane"
        value={brain.positioningGuard.angstPfisterParent}
        onChange={(e) => onChange({ angstPfisterParent: e.target.value })}
        size="small"
        fullWidth
        multiline
        rows={2}
      />
      <TextField
        label="Rule"
        value={brain.positioningGuard.rule}
        onChange={(e) => onChange({ rule: e.target.value })}
        size="small"
        fullWidth
        multiline
        rows={4}
      />
    </Box>
  );
}

function ProductRulesTab({
  brain,
  onListChange,
}: {
  brain: Brain;
  onListChange: (field: string, next: string[]) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ListEditor
        label="Page structure (ordered)"
        items={brain.productContentRules.pageStructure}
        onChange={(next) => onListChange("pageStructure", next)}
      />
      <ListEditor
        label="Style rules"
        items={brain.productContentRules.styleRules}
        onChange={(next) => onListChange("styleRules", next)}
      />
    </Box>
  );
}

function SocialRulesTab({
  brain,
  onChange,
  onListChange,
}: {
  brain: Brain;
  onChange: (p: Partial<Brain["socialMediaRules"]>) => void;
  onListChange: (field: string, next: string[]) => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        label="Primary channel"
        value={brain.socialMediaRules.primaryChannel}
        onChange={(e) => onChange({ primaryChannel: e.target.value })}
        size="small"
        fullWidth
      />
      <TextField
        label="Length guidance"
        value={brain.socialMediaRules.lengthGuidance}
        onChange={(e) => onChange({ lengthGuidance: e.target.value })}
        size="small"
        fullWidth
        multiline
        rows={2}
      />
      <ListEditor
        label="Post template (ordered)"
        items={brain.socialMediaRules.postTemplate}
        onChange={(next) => onListChange("postTemplate", next)}
      />
      <ListEditor
        label="Visual rules"
        items={brain.socialMediaRules.visualRules}
        onChange={(next) => onListChange("visualRules", next)}
      />
    </Box>
  );
}

function GoldTab({
  brain,
  onChange,
}: {
  brain: Brain;
  onChange: (next: Brain["goldExamples"]) => void;
}) {
  const posts = brain.goldExamples.linkedinPosts;
  const ads = brain.goldExamples.paidAds;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>LinkedIn post drafts</Typography>
        {posts.map((p, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
            <TextField
              size="small"
              label="Title"
              value={p.title}
              onChange={(e) => {
                const next = [...posts];
                next[i] = { ...next[i], title: e.target.value };
                onChange({ ...brain.goldExamples, linkedinPosts: next });
              }}
              sx={{ flex: 2 }}
            />
            <TextField
              size="small"
              label="Framework"
              value={p.framework}
              onChange={(e) => {
                const next = [...posts];
                next[i] = { ...next[i], framework: e.target.value };
                onChange({ ...brain.goldExamples, linkedinPosts: next });
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Category"
              value={p.category}
              onChange={(e) => {
                const next = [...posts];
                next[i] = { ...next[i], category: e.target.value };
                onChange({ ...brain.goldExamples, linkedinPosts: next });
              }}
              sx={{ flex: 1 }}
            />
            <Button
              size="small"
              color="error"
              onClick={() =>
                onChange({
                  ...brain.goldExamples,
                  linkedinPosts: posts.filter((_, j) => j !== i),
                })
              }
            >
              <DeleteIcon fontSize="small" />
            </Button>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            onChange({
              ...brain.goldExamples,
              linkedinPosts: [...posts, { title: "", framework: "I can do this now", category: "" }],
            })
          }
          sx={{ textTransform: "none" }}
        >
          Add post
        </Button>
      </Box>
      <Divider />
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Approved ad variants</Typography>
        {ads.map((a, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
            <TextField
              size="small"
              label="Headline"
              value={a.headline}
              onChange={(e) => {
                const next = [...ads];
                next[i] = { ...next[i], headline: e.target.value };
                onChange({ ...brain.goldExamples, paidAds: next });
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Body"
              value={a.body}
              onChange={(e) => {
                const next = [...ads];
                next[i] = { ...next[i], body: e.target.value };
                onChange({ ...brain.goldExamples, paidAds: next });
              }}
              sx={{ flex: 3 }}
              multiline
            />
            <Button
              size="small"
              color="error"
              onClick={() =>
                onChange({
                  ...brain.goldExamples,
                  paidAds: ads.filter((_, j) => j !== i),
                })
              }
            >
              <DeleteIcon fontSize="small" />
            </Button>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            onChange({
              ...brain.goldExamples,
              paidAds: [...ads, { headline: "", body: "" }],
            })
          }
          sx={{ textTransform: "none" }}
        >
          Add ad
        </Button>
      </Box>
    </Box>
  );
}

function CategoryTab({ brain }: { brain: Brain }) {
  const ci = brain.categoryIntelligence;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
        Ingested from H1_CategoryStructure files (EN + DE). Read-only in Phase 1.
      </Typography>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Stat label="Leaf categories" value={ci.totalLeafCategories.toString()} />
        <Stat label="With SEO text" value={ci.categoriesWithSeoText.toString()} />
        <Stat
          label="Content gap"
          value={`${ci.totalLeafCategories - ci.categoriesWithSeoText} (${Math.round(
            ((ci.totalLeafCategories - ci.categoriesWithSeoText) / ci.totalLeafCategories) * 100
          )}%)`}
          highlight
        />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Top-level taxonomy</Typography>
        {ci.topLevel.map((t) => (
          <Box
            key={t.code}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 0.75,
              px: 1.5,
              mb: 0.5,
              bgcolor: "#fafbfc",
              borderRadius: 1,
            }}
          >
            <Chip
              label={t.code}
              size="small"
              sx={{ bgcolor: "#274e64", color: "#fff", fontWeight: 700, minWidth: 56 }}
            />
            <Typography sx={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{t.en}</Typography>
            <Typography sx={{ fontSize: 12, color: "#5f6368" }}>{t.de}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: 12, color: "#ed1b2f", mt: 1 }}>{ci.contentGap}</Typography>
    </Box>
  );
}

function KeywordsTab({ brain }: { brain: Brain }) {
  const ks = brain.keywordSignals;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography sx={{ fontSize: 12, color: "#5f6368" }}>
        Signals from internal Magento search + external keyword list. Read-only in Phase 1.
      </Typography>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>Internal search trends</Typography>
        {ks.internalSearchTrends.map((t) => (
          <Box key={t.term} sx={{ display: "flex", gap: 1.5, py: 0.75, alignItems: "flex-start" }}>
            <Chip
              label={t.term}
              size="small"
              sx={{ bgcolor: "#fef7e6", color: "#b8860b", fontWeight: 700, minWidth: 80 }}
            />
            <Typography sx={{ fontSize: 12, color: "#3c4043" }}>{t.signal}</Typography>
          </Box>
        ))}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>
          Brand terms without landing pages
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {ks.brandTermsMissingLandingPages.map((b) => (
            <Chip key={b} label={b} size="small" variant="outlined" />
          ))}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: "#5f6368", fontStyle: "italic" }}>
        {ks.externalListGaps}
      </Typography>
    </Box>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        p: 1.5,
        border: `1px solid ${highlight ? "#ed1b2f" : "#ececec"}`,
        borderRadius: 2,
        bgcolor: highlight ? "#fdebed" : "#fff",
      }}
    >
      <Typography sx={{ fontSize: 11, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: highlight ? "#ed1b2f" : "#1a3a4c" }}>
        {value}
      </Typography>
    </Box>
  );
}

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#3c4043", mb: 0.75 }}>{label}</Typography>
      {items.map((item, i) => (
        <Box key={i} sx={{ display: "flex", gap: 1, mb: 0.75 }}>
          <TextField
            size="small"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            fullWidth
          />
          <Button size="small" color="error" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <DeleteIcon fontSize="small" />
          </Button>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange([...items, ""])}
        sx={{ textTransform: "none" }}
      >
        Add
      </Button>
    </Box>
  );
}

function ChipListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#3c4043", mb: 0.75 }}>{label}</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
        {items.map((item, i) => (
          <Chip
            key={i}
            label={item}
            size="small"
            onDelete={() => onChange(items.filter((_, j) => j !== i))}
          />
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          size="small"
          placeholder="Add…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              onChange([...items, input.trim()]);
              setInput("");
            }
          }}
          sx={{ flex: 1 }}
        />
        <Button
          size="small"
          onClick={() => {
            if (input.trim()) {
              onChange([...items, input.trim()]);
              setInput("");
            }
          }}
          sx={{ textTransform: "none" }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}