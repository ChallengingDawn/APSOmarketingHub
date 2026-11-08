// BLOG POST - EVERY POST OF THE HUB, FOR THE BLOG'S HOME (server, 08.11.2026). Every to-do of type blog-article in the
// projects this person may open (an admin: all of them), with what the home's card needs from its studio document -
// read field by field, never the posts' whole text.
import { query } from "@/lib/db/client";
import { ensureStudio } from "../../store";
import { blogDoc, cardOf, sortCards, type BlogCard } from "./model";

type Row = {
  id: number; project_id: number; status: string; language: string | null; title: string; due: string | null;
  d_title: string | null; slug: string | null; excerpt: string | null; hero: unknown; publish_at: string | null; tags: unknown;
  d_language: string | null; store: string | null; words: string | null; author: string | null;
};

export async function blogCards(me: { username: string; admin: boolean }): Promise<BlogCard[]> {
  await ensureStudio();
  const r = await query<Row>(
    `SELECT pc.id, pc.project_id, pc.status, pc.language, pc.title, TO_CHAR(pc.due_date, 'YYYY-MM-DD') AS due,
            d.doc->>'title' AS d_title, d.doc->>'slug' AS slug, d.doc->>'excerpt' AS excerpt, d.doc->'hero' AS hero,
            d.doc->>'publishAt' AS publish_at, d.doc->'tags' AS tags, d.doc->>'language' AS d_language, d.doc->>'store' AS store, d.doc->>'author' AS author,
            (SELECT STRING_AGG(COALESCE(s->>'body', ''), ' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.doc->'sections') = 'array' THEN d.doc->'sections' ELSE '[]'::jsonb END) s) AS words
       FROM apsomh_content_pieces pc
       JOIN apsomh_content_projects p ON p.id = pc.project_id
       LEFT JOIN apsomh_content_piece_docs d ON d.piece_id = pc.id AND d.kind = 'blog'
      WHERE pc.content_type = 'blog-article' AND p.status <> 'archived'
        AND ($2::boolean OR p.created_by = $1
             OR EXISTS (SELECT 1 FROM apsomh_content_project_members m WHERE m.project_id = p.id AND m.username = $1))
      ORDER BY pc.id DESC
      LIMIT 300`,
    [me.username, me.admin],
  );
  return sortCards(r.rows.map((x) => {
    const d = blogDoc({
      // a post not titled yet goes by its to-do's name
      title: x.d_title || undefined, slug: x.slug || undefined, excerpt: x.excerpt ?? "", hero: x.hero, publishAt: x.publish_at ?? "",
      tags: x.tags, language: x.d_language ?? x.language ?? undefined, store: x.store ?? undefined, author: x.author ?? "",
      // the reading time counts the sections' words
      sections: x.words ? [{ id: "w", heading: "", body: x.words }] : [],
    }, { language: x.language, title: x.title });
    return cardOf(d, { pieceId: x.id, projectId: x.project_id, status: x.status, due: x.due });
  }));
}
