import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/content/sharing";
import { getPiece } from "@/lib/content/workflow";
import { studioKindOf } from "@/lib/content/studio/kinds";
import PieceStudio from "../../../studio/PieceStudio";

export const dynamic = "force-dynamic";

/** A to-do opened: the studio for its kind of content (08.11.2026), or Create Studio for a kind without its own. */
export default async function PiecePage({ params }: { params: Promise<{ id: string; pieceId: string }> }) {
  const p = await params;
  const id = Number.parseInt(p.id, 10);
  const pieceId = Number.parseInt(p.pieceId, 10);
  const me = await requireUser();
  const piece = Number.isFinite(pieceId) ? await getPiece(pieceId) : null;
  if (!piece || piece.projectId !== id || !(await accessFor(id, me))) redirect(`/projects/${Number.isFinite(id) ? id : ""}`);
  if (!studioKindOf(piece.contentType)) redirect(`/create?project=${id}&piece=${pieceId}${piece.contentType ? `&type=${encodeURIComponent(piece.contentType)}` : ""}`);
  return <PieceStudio pieceId={pieceId} />;
}
