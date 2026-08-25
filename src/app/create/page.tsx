import CreateStudio from "./CreateStudio";

/**
 * The SEO and GEO cockpits deep-link into the studio carrying the work they
 * found: a query worth writing about, or a piece plus the GEO checks it failed.
 * Forwarding these is what makes those "Create content" buttons more than a
 * navigation shortcut.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string;
    topic?: string;
    geoPieceId?: string;
    geoScore?: string;
    geoChecks?: string;
    geoFixes?: string;
  }>;
}) {
  const { channel, topic, geoScore, geoChecks, geoFixes } = await searchParams;

  const geoBrief = geoFixes
    ? [
        geoScore ? `Rewrite this piece to raise its GEO readiness score (currently ${geoScore}/100).` : "Rewrite this piece to raise its GEO readiness.",
        geoChecks ? `Failing checks: ${geoChecks}.` : "",
        `Apply these fixes:\n${geoFixes}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : undefined;

  return <CreateStudio initialChannel={channel} initialTopic={topic} initialBrief={geoBrief} />;
}
