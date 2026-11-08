import { Suspense } from "react";
import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import NewProject from "./NewProject";

export const dynamic = "force-dynamic";

/** A new content project: what and why, what it makes (each line its owner), its place in the plan and its tickets. */
export default function NewProjectPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title="New project" subtitle="What it should achieve, what it makes and who does each part - each line an action of the plan with its ticket" />
      <Suspense><NewProject /></Suspense>
    </Box>
  );
}
