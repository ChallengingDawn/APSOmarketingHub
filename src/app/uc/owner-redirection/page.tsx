"use client";

// OWNER REDIRECTION - out of the menu since 19.10.2026 (a view of Map assignment) and out of Map assignment since
// 20.10.2026 (SARCLA: "the redirection tab should not be needed as you can redirect on the map"). Its rules (France ->
// Jeremy Borey, Sandra Kuridza -> James Koeremez), API and HubSpot function still run until switched off here - this
// address keeps the board reachable for that. The board itself is OwnerRedirection.tsx.

import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { GUTTER } from "@/app/analytics/Shell";
import { OwnerRedirectionView } from "./OwnerRedirection";

export default function OwnerRedirectionPage() {
  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Owner redirection" subtitle="The old redirection rules - Map assignment redirects on the map now; switch these off when its countries go live" />
      <OwnerRedirectionView />
    </Box>
  );
}
