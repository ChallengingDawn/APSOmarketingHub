"use client";
import { useState } from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Stack from "@mui/material/Stack";

export default function LinkedInPage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("engineers");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "linkedin", topic, tone, language, audience }),
      });
      const data = await res.json();
      setResult(data.content || data.error || "No content generated");
    } catch {
      setResult("Error connecting to generation service");
    }
    setLoading(false);
  };

  return (
    <>
      <Typography variant="h5" gutterBottom>
        LinkedIn Post Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create engaging posts for Angst+Pfister LinkedIn pages
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <TextField
          label="Topic / Key Message"
          multiline
          rows={3}
          fullWidth
          placeholder="e.g. New EPDM o-ring range for food & beverage industry..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <TextField select label="Tone" fullWidth value={tone} onChange={(e) => setTone(e.target.value)} size="small">
            <MenuItem value="professional">Professional</MenuItem>
            <MenuItem value="casual">Casual</MenuItem>
            <MenuItem value="technical">Technical</MenuItem>
            <MenuItem value="inspiring">Inspiring</MenuItem>
          </TextField>
          <TextField select label="Language" fullWidth value={language} onChange={(e) => setLanguage(e.target.value)} size="small">
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="de">Deutsch</MenuItem>
            <MenuItem value="fr">Francais</MenuItem>
            <MenuItem value="it">Italiano</MenuItem>
            <MenuItem value="nl">Nederlands</MenuItem>
            <MenuItem value="pl">Polski</MenuItem>
          </TextField>
          <TextField select label="Target Audience" fullWidth value={audience} onChange={(e) => setAudience(e.target.value)} size="small">
            <MenuItem value="engineers">Engineers</MenuItem>
            <MenuItem value="procurement">Procurement</MenuItem>
            <MenuItem value="management">Management</MenuItem>
            <MenuItem value="general">General</MenuItem>
          </TextField>
        </Stack>

        <Button
          variant="contained"
          color="primary"
          onClick={generate}
          disabled={!topic || loading}
        >
          {loading ? "Generating..." : "Generate Post"}
        </Button>
      </Paper>

      {result && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Generated Post</Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(result)} color="secondary">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ whiteSpace: "pre-wrap", fontSize: 14, bgcolor: "background.default", borderRadius: 1, p: 2 }}>
            {result}
          </Box>
        </Paper>
      )}
    </>
  );
}
