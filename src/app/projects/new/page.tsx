import { Suspense } from "react";
import { redirect } from "next/navigation";
import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import NewProject from "./NewProject";
import { MAKE_KINDS, makeHref } from "../make/makeKinds";

export const dynamic = "force-dynamic";

/** A new content project: what and why, what it makes, each line with its owner. One thing alone: Make (/projects/make). */
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // an old "Make" link (?type=<kind>) makes that one thing (SARCLA 08.11.2026: "the Makes really don't work")
  const sp = await searchParams;
  const type = sp.type;
  if (typeof type === "string" && MAKE_KINDS.some((k) => k.key === type)) redirect(makeHref(type));
  // a new form for each way in: the ideas brought from Ideas never stay on a blank "New project"
  const from = typeof sp.from === "string" ? sp.from : "blank";
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title="New project" subtitle="What it should achieve, what it makes and who does each part" />
      <Suspense><NewProject key={from} /></Suspense>
    </Box>
  );
}
