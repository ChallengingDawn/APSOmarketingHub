import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readBrain } from "@/lib/brain";
import PhotoStudio from "./PhotoStudio";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const brain = await readBrain();
  const g = brain.photoGuidelines;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: 28,
              fontWeight: 700,
              color: "#1a3a4c",
              letterSpacing: "-0.01em",
            }}
          >
            Image Studio
          </Typography>
          <Chip
            label="Brain photo DNA"
            size="small"
            sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }}
          />
          <Chip label="Phase 1" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          {g ? (
            <Chip
              label={`${g.sceneRules.length} scene rules · ${g.hardNo.length} hard no`}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, color: "#5f6368" }}
            />
          ) : (
            <Chip
              label="No photoGuidelines in brain"
              size="small"
              sx={{ bgcolor: "#fdebed", color: "#ed1b2f", fontWeight: 700 }}
            />
          )}
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 820 }}>
          Generate brand-consistent APSOparts photography. Every prompt is layered with the
          brain&apos;s image DNA, audience &amp; category scene rules, and realism guards (so
          plastic stock never gets cut with a hand cutter). Upload reference photos to nudge the
          model toward a specific style — Phase 2 will pipe these into a persistent gold library.
        </Typography>
      </Box>
      <PhotoStudio
        audiences={Object.keys(g?.audienceSceneHints ?? {})}
        categories={Object.keys(g?.categorySceneHints ?? {})}
      />
    </Box>
  );
}