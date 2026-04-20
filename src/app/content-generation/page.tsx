import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readBrain } from "@/lib/brain";
import ComposerAndProposals from "./ComposerAndProposals";

export const dynamic = "force-dynamic";

export default async function ContentGenerationPage() {
  const brain = await readBrain();

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: "#1a3a4c", letterSpacing: "-0.01em" }}>
            Content Generation
          </Typography>
          <Chip
            label="Public content only"
            size="small"
            sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }}
          />
          <Chip
            label="Phase 1"
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 740 }}>
          Compose a LinkedIn post with the full Personality brain as context, or click{" "}
          <strong>Propose 3</strong> to get three AI drafts — each with text + image — that you can
          copy, download, or send to the composer for editing.
        </Typography>
      </Box>
      <ComposerAndProposals
        strapline={brain.brandVoice.strapline}
        storyline={brain.brandVoice.storyline}
      />
    </Box>
  );
}