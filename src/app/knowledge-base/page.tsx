import { permanentRedirect } from "next/navigation";

/**
 * Retired. "Knowledge Base" was a document manager with no document store
 * behind it — the app has no uploads table, no bucket and no file records, so
 * every row it displayed was invented. The knowledge that actually drives
 * generation (brand voice, positioning guard, content rules, gold examples,
 * keyword signals, category intelligence, photo guidelines, personas) lives in
 * the brain and is already surfaced — and editable — at /personality.
 * This route is kept only so old links and bookmarks resolve.
 */
export default function KnowledgeBaseRedirectPage(): never {
  permanentRedirect("/personality");
}
