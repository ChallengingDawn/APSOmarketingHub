import Link from "next/link";
import Box from "@mui/material/Box";
import ProjectBoard from "../../ProjectBoard";
import ProjectNav from "../../ProjectNav";

export const dynamic = "force-dynamic";

/**
 * A project's versions, side by side, with the studio, export and translation (the project page before 07.11.2026).
 * Opened from a piece (?piece=), that piece's versions only.
 */
export default async function ProjectVersionsPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ piece?: string }>;
}) {
  const id = Number.parseInt((await params).id, 10);
  const piece = Number.parseInt((await searchParams).piece ?? "", 10);
  const ok = Number.isFinite(id) && id > 0;
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      {ok && (
        <Box component={Link} href={`/projects/${id}`} sx={{ display: "inline-block", mb: 1.5, color: "#5d6b85", fontSize: "0.86rem", fontWeight: 600, textDecoration: "none" }}>
          ‹ Back to the project
        </Box>
      )}
      {ok && <ProjectNav id={id} />}
      {ok ? <ProjectBoard id={id} pieceId={Number.isFinite(piece) && piece > 0 ? piece : null} /> : <Box sx={{ fontSize: "0.9rem", color: "#5d6b85" }}>That is not a project id.</Box>}
    </Box>
  );
}
