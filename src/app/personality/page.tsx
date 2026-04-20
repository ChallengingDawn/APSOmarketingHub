import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readBrain } from "@/lib/brain";
import PersonalityEditor from "./PersonalityEditor";

export const dynamic = "force-dynamic";

export default async function PersonalityPage() {
  const brain = await readBrain();

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: "#1a3a4c", letterSpacing: "-0.01em" }}>
            Personality
          </Typography>
          <Chip
            label="Phase 1 · Central brain"
            size="small"
            sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }}
          />
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 780 }}>
          The bot's personality is defined here. Every generated content piece reads from this central brain —
          brand voice, positioning guard, signature phrases, gold examples, and ingested intelligence. Edit any
          node and press <strong>Save Brain</strong> to update Claude and Gemini context for the next generation.
        </Typography>
      </Box>
      <PersonalityEditor initial={brain} />
    </Box>
  );
}