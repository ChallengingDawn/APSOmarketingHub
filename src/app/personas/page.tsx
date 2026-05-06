import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readBrain } from "@/lib/brain";
import PersonaGenerator from "./PersonaGenerator";

export const dynamic = "force-dynamic";

export default async function PersonasPage() {
  const brain = await readBrain();
  const personas = brain.personas ?? [];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: 28,
              fontWeight: 700,
              color: "#1a3a4c",
              letterSpacing: "-0.01em",
            }}
          >
            Personas
          </Typography>
          <Chip
            label="Phase 1"
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={`${personas.length} archetypes`}
            size="small"
            sx={{ bgcolor: "#ede7f9", color: "#5b21b6", fontWeight: 600 }}
          />
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 760 }}>
          Pick a persona, choose a channel, and generate content written directly for
          that buyer. The persona&apos;s goals, challenges, and demographics are
          injected into the system prompt — Claude and Gemini answer in that
          persona&apos;s voice and pain points, not the generic APSOparts default.
        </Typography>
      </Box>
      <PersonaGenerator brain={brain} personas={personas} />
    </Box>
  );
}
