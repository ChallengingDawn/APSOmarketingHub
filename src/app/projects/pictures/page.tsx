import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import Gallery from "./Gallery";

export const dynamic = "force-dynamic";

/** The pictures made and uploaded in the hub - yours, everyone's, the logos (SARCLA 08.11.2026: "a gallery of the photos that I've generated"). */
export default function PicturesPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title="Pictures" subtitle="Every picture made or uploaded in the hub - a click shows it large and where it is used" />
      <Gallery />
    </Box>
  );
}
