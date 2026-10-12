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
    /** Arrived from a project board: work saves back there, brief comes from it. */
    project?: string;
    /** A content type chosen on the home screen, before the studio opened. */
    type?: string;
    geoPieceId?: string;
    geoScore?: string;
    geoChecks?: string;
    geoFixes?: string;
  }>;
}) {
  const { channel, topic, project, type, geoScore, geoChecks, geoFixes } = await searchParams;

  // The project's own brief, fetched server-side so the studio opens with the
  // box already filled. Retyping a brief that is on the screen next door is
  // exactly the friction that kept work out of projects.
  const projectId = project ? Number.parseInt(project, 10) : NaN;
  let projectTitle: string | null = null;
  let projectBrief: string | null = null;
  let projectType: string | null = null;
  if (Number.isFinite(projectId) && projectId > 0) {
    const { getProject } = await import("@/lib/content/projects");
    const found = await getProject(projectId);
    if (found) {
      projectTitle = found.project.title;
      projectBrief = found.project.brief;
      projectType = found.project.contentType;
    }
  }

  const geoBrief = geoFixes
    ? [
        geoScore ? `Rewrite this piece to raise its GEO readiness score (currently ${geoScore}/100).` : "Rewrite this piece to raise its GEO readiness.",
        geoChecks ? `Failing checks: ${geoChecks}.` : "",
        `Apply these fixes:\n${geoFixes}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : undefined;

  return (
    <CreateStudio
      initialChannel={channel}
      initialTopic={topic ?? projectBrief ?? undefined}
      initialBrief={geoBrief}
      projectId={Number.isFinite(projectId) && projectId > 0 ? projectId : undefined}
      projectTitle={projectTitle ?? undefined}
      // The URL wins only when it says something; otherwise the project does.
      // A project called "Untitled seo landing page" opening the studio on a
      // LinkedIn post is the tool forgetting what it was asked for.
      initialType={type ?? projectType ?? undefined}
    />
  );
}
