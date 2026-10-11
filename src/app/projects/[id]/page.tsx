import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import ProjectBoard from "../ProjectBoard";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title="Content project" subtitle="One brief, every variation, and the conversation about them" />
      {Number.isFinite(id) && id > 0 ? (
        <ProjectBoard id={id} />
      ) : (
        <Box sx={{ fontSize: "0.9rem", color: "#5d6b85" }}>That is not a project id.</Box>
      )}
    </Box>
  );
}
