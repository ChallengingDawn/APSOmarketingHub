import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readBrain } from "@/lib/brain";
import PersonalityEditor from "./PersonalityEditor";

export const dynamic = "force-dynamic";

export default async function PersonalityPage() {
  const brain = await readBrain();

  return (
    <Box
      sx={{
        p: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.25,
          borderBottom: "1px solid #e4e7eb",
          bgcolor: "#ffffff",
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            color: "#1a3a4c",
            letterSpacing: "-0.01em",
          }}
        >
          Personality
        </Typography>
        <Chip
          label="Phase 1 · Central brain"
          size="small"
          sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600, height: 22 }}
        />
        <Typography
          sx={{
            fontSize: 12,
            color: "#5f6368",
            flex: 1,
            minWidth: 0,
            ml: 1.5,
            display: { xs: "none", md: "block" },
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Edit any node and press <strong>Save Brain</strong> to update Claude and Gemini for the
          next generation.
        </Typography>
      </Box>
      <PersonalityEditor initial={brain} />
    </Box>
  );
}
