import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { libraryKindBySlug } from "@/lib/content/library";
import Library from "../Library";

export const dynamic = "force-dynamic";

/** The content library, one page per kind of content (SARCLA 11.11.2026: "one page per type of content"): /projects/
 * library/pages, /banners, /blog, /newsletters, /social, /videos. Under /projects, so the Projects grant answers for it
 * (src/app/projects/layout.tsx); the pieces are the projects this person may open (lib/content/libraryRead.ts). */
export default async function LibraryKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: slug } = await params;
  const kind = libraryKindBySlug(slug);
  if (!kind) notFound();
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 }, minWidth: 0 }}>
      <PageHeader title={kind.label} subtitle={kind.note} badge="Content library" />
      <Library slug={kind.slug} />
    </Box>
  );
}
