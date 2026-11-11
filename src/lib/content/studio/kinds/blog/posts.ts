// BLOG POST - EVERY POST OF THE HUB, FOR THE BLOG'S HOME (server, 08.11.2026). Every to-do of type blog-article in the
// projects this person may open (an admin: all of them), with what the home's card needs from its studio document -
// read field by field, never the posts' whole text.
// cv17 (12.11.2026): a post's other languages (doc.langs, each a tab of the studio) are cards of their own, in their own
// store view - the French home lists the French posts.
import { query } from "@/lib/db/client";
import { ensureStudio } from "../../store";
import { blogDoc, cardOf, sortCards, type BlogCard } from "./model";

type Row = {
  id: number; project_id: number; status: string; language: string | null; title: string; due: string | null;
  d_title: string | null; slug: string | null; excerpt: string | null; hero: unknown; publish_at: string | null; tags: unknown;
  d_language: string | null; store: string | null; words: string | null; author: string | null;
  /** cv17: per other language, what its card needs */
  langs: Record<string, { title?: unknown; slug?: unknown; excerpt?: unknown; heroAlt?: unknown; tags?: unknown; store?: unknown; words?: unknown }> | null;
};

export async function blogCards(me: { username: string; admin: boolean }): Promise<BlogCard[]> {
  await ensureStudio();
  const r = await query<Row>(
    `SELECT pc.id, pc.project_id, pc.status, pc.language, pc.title, TO_CHAR(pc.due_date, 'YYYY-MM-DD') AS due,
            d.doc->>'title' AS d_title, d.doc->>'slug' AS slug, d.doc->>'excerpt' AS excerpt, d.doc->'hero' AS hero,
            d.doc->>'publishAt' AS publish_at, d.doc->'tags' AS tags, d.doc->>'language' AS d_language, d.doc->>'store' AS store, d.doc->>'author' AS author,
            (SELECT STRING_AGG(COALESCE(s->>'body', ''), ' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.doc->'sections') = 'array' THEN d.doc->'sections' ELSE '[]'::jsonb END) s) AS words,
            (SELECT jsonb_object_agg(l.key, jsonb_build_object('title', l.value->'title', 'slug', l.value->'slug', 'excerpt', l.value->'excerpt', 'heroAlt', l.value#>'{hero,alt}',
                      'tags', l.value->'tags', 'store', l.value->'store',
                      'words', (SELECT STRING_AGG(COALESCE(s->>'body', ''), ' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.value->'sections') = 'array' THEN l.value->'sections' ELSE '[]'::jsonb END) s)))
               FROM jsonb_each(CASE WHEN jsonb_typeof(d.doc->'langs') = 'object' THEN d.doc->'langs' ELSE '{}'::jsonb END) l
              WHERE jsonb_typeof(l.value) = 'object' AND l.key ~ '^[A-Z]{2}$') AS langs
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
  return sortCards(r.rows.flatMap((x) => {
    const d = blogDoc({
      // a post not titled yet goes by its to-do's name
      title: x.d_title || undefined, slug: x.slug || undefined, excerpt: x.excerpt ?? "", hero: x.hero, publishAt: x.publish_at ?? "",
      tags: x.tags, language: x.d_language ?? x.language ?? undefined, store: x.store ?? undefined, author: x.author ?? "",
      // the reading time counts the sections' words
      sections: x.words ? [{ id: "w", heading: "", body: x.words }] : [],
    }, { language: x.language, title: x.title });
    const at = { pieceId: x.id, projectId: x.project_id, status: x.status, due: x.due };
    // each other language: its own words, the post's picture, day and author (cv17)
    const others = Object.entries(x.langs ?? {}).filter(([k]) => k !== d.language).map(([k, v]) => cardOf(blogDoc({
      title: v.title, slug: v.slug, excerpt: v.excerpt ?? "", hero: { url: d.hero.url, alt: typeof v.heroAlt === "string" ? v.heroAlt : d.hero.alt }, publishAt: d.publishAt,
      tags: v.tags, language: k, store: v.store, author: d.author,
      sections: typeof v.words === "string" && v.words ? [{ id: "w", heading: "", body: v.words }] : [],
    }), at));
    return [cardOf(d, at), ...others];
  }));
}
