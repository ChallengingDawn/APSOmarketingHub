import Box from "@mui/material/Box";
import ProjectWorkspace from "../ProjectWorkspace";

export const dynamic = "force-dynamic";

/** One content project as the team's work: brief, pieces, to-dos, conversation (07.11.2026). Versions: ./versions. */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const ok = Number.isFinite(id) && id > 0;
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      {ok ? <ProjectWorkspace id={id} /> : <Box sx={{ fontSize: "0.9rem", color: "#5d6b85" }}>That is not a project id.</Box>}
    </Box>
  );
}
