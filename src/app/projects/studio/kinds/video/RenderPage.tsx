"use client";
// THE FILM ALONE ON A PAGE OF THE HUB (08.11.2026), for rendering from a hub that runs on the render laptop
// (`npm run sandbox`): scripts/content-video/render.mjs --url=<this page> puts the exported spec in
// window.__VIDEO_SPEC__ and drives window.engine. Opened by a person, it reads the to-do's film itself and shows
// ?frame=N (?format=9:16, ?scale=0.5) - a still to look at.
// The page route that mounts it is not added here (it lives outside the studio's folders):
//   src/app/projects/[id]/pieces/[pieceId]/render/page.tsx -> <RenderPage pieceId={...} />
import { useEffect, useState } from "react";
import RenderStage from "@/lib/content/studio/kinds/video/film/RenderStage";
import { FORMATS, fromSpec, toSpec, type Format, type VideoSpec } from "@/lib/content/studio/kinds/video/model";

export default function RenderPage({ pieceId }: { pieceId: number }) {
  const [spec, setSpec] = useState<VideoSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q] = useState(() => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)));
  const scale = Number(q.get("scale")) > 0 ? Number(q.get("scale")) : undefined;

  useEffect(() => {
    const given = fromSpec(window.__VIDEO_SPEC__);
    if (given) { setSpec(given); return; }
    const format = (FORMATS as readonly string[]).includes(q.get("format") ?? "") ? (q.get("format") as Format) : undefined;
    void fetch(`/api/content/pieces/${pieceId}`).then((r) => r.json()).then((j: { ok: boolean; error?: string; doc?: unknown; piece?: { title: string } }) => {
      if (!j.ok) { setError(j.error ?? "This to-do could not be read."); return; }
      setSpec(toSpec(j.doc, { title: j.piece?.title ?? "", pieceId, at: new Date().toISOString(), format }));
    }).catch((e) => setError(String(e)));
  }, [pieceId, q]);

  // a person looking: the frame asked for
  useEffect(() => {
    if (!spec || window.__VIDEO_SPEC__) return;
    const n = Number(q.get("frame"));
    if (!Number.isFinite(n) || n <= 0) return;
    const t = setTimeout(() => { void window.engine?.ready().then(() => window.engine?.seek(n)); }, 50);
    return () => clearTimeout(t);
  }, [spec, q]);

  if (error) return <div style={{ font: "16px system-ui", padding: 24, color: "#c5221f" }}>{error}</div>;
  if (!spec) return null;
  return <RenderStage spec={spec} scale={scale} />;
}
