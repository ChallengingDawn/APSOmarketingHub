import Box from "@mui/material/Box";
import ContentBoard from "./ContentBoard";

export const dynamic = "force-dynamic";

/**
 * Content > Projects: the team's board (SARCLA 07.11.2026: "this should look like a collaborative project") - every
 * project by stage, and what waits for the person looking. The guard is the folder's layout (Marketing).
 */
export default function ProjectsPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <ContentBoard />
    </Box>
  );
}
