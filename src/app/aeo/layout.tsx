// AI answers (AEO) belong to Marketing & Content, after GEO (SARCLA 17.10) - the same grant.
import Box from "@mui/material/Box";
import { requireApp } from "@/lib/auth/appAccess";
import { GUTTER } from "@/app/analytics/Shell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("marketing");
  return <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>{children}</Box>;
}
