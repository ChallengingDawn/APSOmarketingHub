import PageHeader from "@/app/PageHeader";
import Box from "@mui/material/Box";
import Ideas from "./Ideas";

export const dynamic = "force-dynamic";

/** Every app's ideas in one place, to look at and make into projects (SARCLA 08.11.2026). */
export default function IdeasPage() {
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}>
      <PageHeader title="Ideas" subtitle="What the hub's apps found worth doing - pick the good ones and make a project of them" />
      <Ideas />
    </Box>
  );
}
