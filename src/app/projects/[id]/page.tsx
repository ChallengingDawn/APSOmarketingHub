import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import ProjectBoard from "../ProjectBoard";
import ProjectNav from "../ProjectNav";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const ok = Number.isFinite(id) && id > 0;

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      {/* Navigation first, above the title: you could reach a project and
          then be stuck in it - no way back to the list, none across to the
          next one, none to the calendar. */}
      {ok && <ProjectNav id={id} />}
      <PageHeader title="Content project" subtitle="One brief, every variation, and the conversation about them" />
      {ok ? (
        <ProjectBoard id={id} />
      ) : (
        <Box sx={{ fontSize: "0.9rem", color: "#5d6b85" }}>That is not a project id.</Box>
      )}
    </Box>
  );
}
