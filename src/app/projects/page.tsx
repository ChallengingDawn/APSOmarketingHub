import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import ProjectList from "./ProjectList";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="Content projects"
        subtitle="One brief, every variation under it, and the conversation beside them"
      />
      <ProjectList />
    </Box>
  );
}
