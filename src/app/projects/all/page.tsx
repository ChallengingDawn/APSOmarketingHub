import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import ProjectList from "../ProjectList";

export const dynamic = "force-dynamic";

/** Everything, with the scope tabs, search and paging. The home screen is for
 *  starting something; this is for finding something. */
export default async function AllProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const initial = scope === "shared" || scope === "all" ? scope : "mine";

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader
        title="All projects"
        subtitle="Yours, the ones shared with you, and what is in each"
      />
      <ProjectList initialScope={initial} />
    </Box>
  );
}
