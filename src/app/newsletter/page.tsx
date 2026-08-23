import Box from "@mui/material/Box";
import PageHeader from "@/app/PageHeader";
import { readBrain } from "@/lib/brain";
import { readLogs } from "@/lib/logs";
import ComposerAndProposals from "@/app/content-generation/ComposerAndProposals";

export const dynamic = "force-dynamic";

export default async function NewsletterPage() {
  const [brain, logs] = await Promise.all([readBrain(), readLogs()]);
  const currentBatch =
    logs.currentBatch && logs.currentBatch.channel === "newsletter" ? logs.currentBatch : null;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Newsletter Content Manager"
        subtitle="Generate email newsletters grounded in the Personality brain"
        badge="AI"
      />
      <ComposerAndProposals brain={brain} initialBatch={currentBatch} lockedChannel="newsletter" />
    </Box>
  );
}
