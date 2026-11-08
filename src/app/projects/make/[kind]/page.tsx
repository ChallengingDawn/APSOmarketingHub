import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import QuickMake from "./QuickMake";
import { MAKE_KINDS } from "../makeKinds";

export const dynamic = "force-dynamic";

/**
 * Content > Make > <kind> (SARCLA 08.11.2026: "the Makes really don't work"): one short screen - what it is about and its
 * language - and Start opens its studio at once. A whole project with several lines is /projects/new.
 */
export default async function MakePage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!MAKE_KINDS.some((k) => k.key === kind)) redirect("/projects/new");
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      {/* a new one for every kind: nothing typed for a post stays on the page of a video */}
      <QuickMake key={kind} kind={kind} />
    </Box>
  );
}
