"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Avatar from "@mui/material/Avatar";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Snackbar from "@mui/material/Snackbar";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ImageIcon from "@mui/icons-material/Image";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PageHeader from "@/app/PageHeader";

export type ChannelKind = "LinkedIn" | "Newsletter" | "Blog";

interface ChannelConfig {
  channel: ChannelKind;
  title: string;
  subtitle: string;
  accentColor: string;
  topicPlaceholder: string;
  fields: { label: string; key: string; options: string[] }[];
  samplePost: string;
  recent: { title: string; date: string; status: string }[];
}

interface Props {
  config: ChannelConfig;
}

export default function ChannelComposer({ config }: Props) {
  const [topic, setTopic] = useState("");
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map((f) => [f.key, f.options[0]]))
  );
  const [generated, setGenerated] = useState<string>(config.samplePost);
  const [photo, setPhoto] = useState<{ url: string; prompt: string } | null>(null);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState("");
  const [snack, setSnack] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!topic.trim()) {
      setSnack("Enter a topic first");
      return;
    }
    setGenerated(
      `[AI generated for "${topic.trim()}" — ${fields[config.fields[0].key]}]\n\n${config.samplePost}`
    );
    setSnack("Content generated");
  };

  const handleAddPhoto = () => {
    if (!photoPrompt.trim()) {
      setPhotoDialog(false);
      return;
    }
    // Mock: pick a deterministic Unsplash photo based on prompt
    const seed = encodeURIComponent(photoPrompt.trim());
    setPhoto({
      url: `https://source.unsplash.com/800x500/?${seed}`,
      prompt: photoPrompt.trim(),
    });
    setPhotoDialog(false);
    setPhotoPrompt("");
    setSnack("Photo added");
  };

  return (
    <Box>
      <PageHeader title={config.title} subtitle={config.subtitle} badge="AI" />

      <Grid container spacing={2.5}>
        {/* ── Composer ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 4, border: "1px solid #ececec", borderTop: `3px solid ${config.accentColor}` }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: config.accentColor }} />
                <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                  Post Composer
                </Typography>
              </Box>

              <TextField
                label="Topic / Key Message"
                placeholder={config.topicPlaceholder}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                sx={{ mb: 2 }}
              />

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {config.fields.map((f) => (
                  <Grid key={f.key} size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label={f.label}
                      value={fields[f.key]}
                      onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {f.options.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button
                  onClick={handleGenerate}
                  startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    flex: 1,
                    minWidth: 180,
                    bgcolor: config.accentColor,
                    color: "#fff",
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    py: 1.1,
                    boxShadow: "none",
                    "&:hover": { bgcolor: config.accentColor, opacity: 0.9, boxShadow: "none" },
                  }}
                >
                  Generate with AI
                </Button>
                <Button
                  onClick={() => setPhotoDialog(true)}
                  startIcon={<ImageIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    flex: 1,
                    minWidth: 180,
                    bgcolor: "#fff",
                    color: config.accentColor,
                    border: `1px dashed ${config.accentColor}66`,
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    py: 1.05,
                    "&:hover": { bgcolor: `${config.accentColor}10`, borderColor: config.accentColor },
                  }}
                >
                  {photo ? "Change Photo" : "Generate Photo with AI"}
                </Button>
              </Box>

              {photo && (
                <Box sx={{ mt: 2, p: 1.25, bgcolor: "#fafbfc", border: "1px solid #ececec", borderRadius: 2, display: "flex", alignItems: "center", gap: 1.25 }}>
                  <ImageIcon sx={{ fontSize: 18, color: config.accentColor }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#1f1f1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Photo: {photo.prompt}
                    </Typography>
                  </Box>
                  <Button
                    onClick={() => setPhoto(null)}
                    size="small"
                    sx={{ fontSize: "0.65rem", color: "#ea4335", textTransform: "none", minWidth: 0, fontWeight: 600 }}
                  >
                    Remove
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Preview ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 4, border: "1px solid #ececec", borderTop: `3px solid ${config.accentColor}` }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
                <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: config.accentColor }} />
                <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                  Live Preview
                </Typography>
              </Box>

              <Box sx={{ border: "1px solid #ececec", borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}>
                {/* Header strip */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 2, borderBottom: "1px solid #f1f3f4" }}>
                  <Avatar sx={{ width: 44, height: 44, bgcolor: "#ed1b2f", color: "#fff", fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.02em" }}>
                    APSO
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f1f1f" }}>
                      APSOparts
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
                      Sealings &amp; Plastics · apsoparts.com
                    </Typography>
                  </Box>
                </Box>

                {/* Photo */}
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.prompt}
                    style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}

                {/* Body */}
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontSize: "0.82rem", lineHeight: 1.6, color: "#3c4043", whiteSpace: "pre-line" }}>
                    {generated}
                  </Typography>
                </Box>
              </Box>

              {/* Brand tone check */}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: "#e6f4ea", border: "1px solid #34a85333", borderRadius: 2 }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e8e3e", mb: 0.5 }}>
                  Brand Tone Check
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  {["Professional", "On-brand", "Compliant"].map((c) => (
                    <Box key={c} sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <CheckCircleIcon sx={{ fontSize: 13, color: "#1e8e3e" }} />
                      <Typography sx={{ fontSize: "0.7rem", color: "#1e8e3e", fontWeight: 600 }}>
                        {c}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Edit + Schedule actions under preview */}
              <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                <Button
                  onClick={() => setSnack("Edit mode (mock)")}
                  startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    flex: 1,
                    bgcolor: "#fff",
                    color: "#3c4043",
                    border: "1px solid #ececec",
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    py: 1.05,
                    "&:hover": { bgcolor: "#f1f3f4", borderColor: "#dadce0" },
                  }}
                >
                  Edit
                </Button>
                <Button
                  onClick={() => setSnack("Scheduled (mock)")}
                  startIcon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    flex: 1,
                    bgcolor: "#34a853",
                    color: "#fff",
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    py: 1.1,
                    boxShadow: "none",
                    "&:hover": { bgcolor: "#1e8e3e", boxShadow: "none" },
                  }}
                >
                  Schedule Post
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Recent posts ── */}
      <Card sx={{ mt: 3, borderRadius: 4, border: "1px solid #ececec" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2 }}>
            <Box sx={{ width: 4, height: 18, borderRadius: 4, bgcolor: config.accentColor }} />
            <Typography sx={{ fontSize: "1rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
              Recent {config.channel} Posts
            </Typography>
          </Box>
          {config.recent.map((r, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ my: 1.25 }} />}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#1f1f1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: "#5f6368" }}>
                    {r.date}
                  </Typography>
                </Box>
                <Chip
                  label={r.status}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    bgcolor: r.status === "Published" ? "#e6f4ea" : "#fef7e0",
                    color: r.status === "Published" ? "#1e8e3e" : "#b06000",
                    border: "none",
                  }}
                />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* ── Photo Dialog ── */}
      <Dialog open={photoDialog} onClose={() => setPhotoDialog(false)} PaperProps={{ sx: { borderRadius: 4, minWidth: 440 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${config.accentColor}22`, color: config.accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ImageIcon />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: "1.15rem", fontWeight: 500, color: "#1f1f1f", letterSpacing: "-0.01em" }}>
                Find or generate a photo
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
                Describe the photo you want — we&apos;ll fetch a matching image
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField
            autoFocus
            multiline
            minRows={3}
            fullWidth
            placeholder="e.g. close-up of black FFKM o-rings on a white background, industrial product photography"
            value={photoPrompt}
            onChange={(e) => setPhotoPrompt(e.target.value)}
            sx={{ "& .MuiInputBase-input": { fontSize: "0.85rem", lineHeight: 1.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1.5, gap: 1 }}>
          <Button
            onClick={() => setPhotoDialog(false)}
            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 600, color: "#5f6368", "&:hover": { bgcolor: "#f1f3f4" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddPhoto}
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 600,
              bgcolor: config.accentColor,
              boxShadow: "none",
              "&:hover": { bgcolor: config.accentColor, opacity: 0.9, boxShadow: "none" },
            }}
          >
            Generate &amp; insert
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
