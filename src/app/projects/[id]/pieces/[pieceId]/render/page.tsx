import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import RenderPage from "@/app/projects/studio/kinds/video/RenderPage";

export const dynamic = "force-dynamic";

/** A video to-do's film, one frame at a time - for the render script on a laptop (?frame=120&format=9:16). */
export default async function VideoRender({ params }: { params: Promise<{ id: string; pieceId: string }> }) {
  const p = await params;
  const id = Number.parseInt(p.id, 10);
  const pieceId = Number.parseInt(p.pieceId, 10);
  const me = await requireUser();
  const piece = Number.isFinite(pieceId) ? await getPiece(pieceId) : null;
  if (!piece || piece.projectId !== id || piece.contentType !== "video" || !(await accessFor(id, me))) redirect(`/projects/${Number.isFinite(id) ? id : ""}`);
  return <RenderPage pieceId={pieceId} />;
}
