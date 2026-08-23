import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { readBrain } from "@/lib/brain";
import { readLogs } from "@/lib/logs";
import ComposerAndProposals from "@/app/content-generation/ComposerAndProposals";

export const dynamic = "force-dynamic";

export default async function LinkedInPage() {
  const [brain, logs] = await Promise.all([readBrain(), readLogs()]);
  const currentBatch =
    logs.currentBatch && logs.currentBatch.channel === "linkedin" ? logs.currentBatch : null;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="LinkedIn Content Manager"
        subtitle="Generate LinkedIn posts grounded in the Personality brain"
        badge="AI"
      />
      <ComposerAndProposals brain={brain} initialBatch={currentBatch} lockedChannel="linkedin" />
    </Box>
  );
}
