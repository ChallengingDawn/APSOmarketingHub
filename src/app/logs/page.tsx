import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { readLogs } from "@/lib/logs";
import LogsClient from "./LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const file = await readLogs();

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: "#1a3a4c", letterSpacing: "-0.01em" }}>
            Logs
          </Typography>
          <Chip label="Feedback & learning" size="small" sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }} />
          <Chip label="Phase 1" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 780 }}>
          Every <strong>like</strong> is saved as a good example the AI should imitate. Every{" "}
          <strong>dislike</strong> lets you write a correction — what you'd prefer next time. Your user
          defaults below get merged into every generation prompt.
        </Typography>
      </Box>
      <LogsClient initial={file} />
    </Box>
  );
}