import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { TEMPLATES } from "@/data/templates";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
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
            Templates
          </Typography>
          <Chip
            label="Brand kit"
            size="small"
            sx={{ bgcolor: "#e8f0f4", color: "#274e64", fontWeight: 600 }}
          />
          <Chip label="Phase 1" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        </Box>
        <Typography sx={{ fontSize: 13, color: "#5f6368", maxWidth: 780 }}>
          Exact APSOparts templates — pick one, let the brain fill the text, drop a generated
          image in the photo slot, tweak, and download the final PNG. The template design never
          moves.
        </Typography>
      </Box>
      <TemplatesClient templates={TEMPLATES} />
    </Box>
  );
}