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

export default function NewsletterPage() {
  const [topic, setTopic] = useState("");
  const [sections, setSections] = useState("3");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "newsletter", topic, sections, language }),
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
        Drive Newsletter Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create compelling newsletter content for distribution
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <TextField
          label="Newsletter Theme / Topics"
          multiline
          rows={3}
          fullWidth
          placeholder="e.g. Q1 product highlights, new sealing solutions, upcoming trade shows..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          sx={{ mb: 3 }}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <TextField select label="Number of Sections" fullWidth value={sections} onChange={(e) => setSections(e.target.value)} size="small">
            <MenuItem value="2">2 Sections</MenuItem>
            <MenuItem value="3">3 Sections</MenuItem>
            <MenuItem value="4">4 Sections</MenuItem>
            <MenuItem value="5">5 Sections</MenuItem>
          </TextField>
          <TextField select label="Language" fullWidth value={language} onChange={(e) => setLanguage(e.target.value)} size="small">
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="de">Deutsch</MenuItem>
            <MenuItem value="fr">Francais</MenuItem>
            <MenuItem value="it">Italiano</MenuItem>
            <MenuItem value="nl">Nederlands</MenuItem>
            <MenuItem value="pl">Polski</MenuItem>
          </TextField>
        </Stack>

        <Button
          variant="contained"
          color="secondary"
          onClick={generate}
          disabled={!topic || loading}
        >
          {loading ? "Generating..." : "Generate Newsletter"}
        </Button>
      </Paper>

      {result && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>Generated Newsletter</Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(result)} color="primary">
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
