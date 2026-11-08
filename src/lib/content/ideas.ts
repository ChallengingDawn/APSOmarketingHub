// IDEAS FROM EVERY APP (SARCLA 08.11.2026: "Ideas is missing - we should be able to review ideas from multiple apps and
// then create a project"). The hub already finds them - each app in its own place; this reads them into one list. Every
// idea says EXACTLY where it comes from, by the name the hub's menus give that app and page (ideaOrigins.ts - SARCLA
// 08.11.2026: "if it comes from AI Personalization, call it like that"):
//
//   convert  AI testing & personalization · Insights - the AI's page ideas (apsomh_convert_ideas, prod, proposed/approved,
//            ranked impact x confidence / effort)
//   buyers   AI testing & personalization · What stops buyers - the themes of the newest apsomh_convert_briefs row
//   aeo      AEO & LLM Optimizer · Recommendations (HubSpot's) and · Prompts and answers (the questions the AI assistants
//            answer without citing us) - read from the stored read only (kv slow_report:aeo:read:v1), never a rebuild
//   seo      SEO · Quick wins / Decay - the work queue worked out from Search Console - live, slow, kept 6 h in this process
//   search   Search bar · Gaps - what people searched in the shop and found nothing (the smart-bar gateway, 30 days)
//   chat     APSOassistant Chat · Filing - what customers ask in the chat (apsomh_chat_filing, 90 days)
//   brand    Personality · Keyword Signals - brand terms with no landing page, internal search trends
//   team     Own ideas - written here by a person (apsomh_content_ideas), "Write it with AI" from a few words (writeIdea)
// The Action plan's Idea box is NOT a source (SARCLA 08.11.2026: "Action plan should not be visible here") - the plan is
// reached from a to-do's "Plan & ticket" only.
// Each idea has a stable key (source:id); "Not now" and "made into a project" are kept per key (apsomh_content_idea_marks)
// so a dismissed idea stays dismissed and a used one points at its project - unless that project was deleted: then the
// idea is back in the list. Each source answers alone: one that fails says why and the others still show.

import { query } from "@/lib/db/client";
import { kvGet } from "@/lib/db/init";
import { brandSystemPrompt, readBrain } from "@/lib/brain";
import { claudeText, getAnthropic } from "@/lib/ai/claude";
import { OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { ensureSharing } from "@/lib/content/sharing";
import { PLACE_ORIGIN, SOURCE_ORIGIN, sourceLabel, type IdeaSource, type Origin } from "@/lib/content/ideaOrigins";

export type { IdeaSource, Origin };
export const SOURCES: { key: IdeaSource; label: string; app: "website" | "marketing"; slow?: boolean; note: string }[] = (
  [
    { key: "team", app: "marketing" },
    { key: "convert", app: "website" },
    { key: "buyers", app: "website" },
    { key: "aeo", app: "marketing" },
    { key: "seo", app: "marketing", slow: true },
    { key: "search", app: "website" },
    { key: "chat", app: "website" },
    { key: "brand", app: "marketing" },
  ] as { key: IdeaSource; app: "website" | "marketing"; slow?: boolean }[]
).map((x) => ({ ...x, label: sourceLabel(x.key), note: SOURCE_ORIGIN[x.key].note }));

export type Idea = {
  key: string; source: IdeaSource; title: string; why: string;
  /** the content type that fits it best (a key of contentTypes.ts), or "task" for an action */
  kind: string | null;
  /** every content type it would make (an own idea can name several); kind is the first */
  kinds: string[];
  /** where exactly it comes from: the app and the page, as the menus name them, and the link to that page */
  origin: Origin;
  /** the page, the query, the term it is about */
  target: string | null;
  /** 0-100 within its source */
  score: number;
  /** where to read this very idea in its own app (more precise than the origin's page, when there is such a place) */
  href: string | null;
  at: string | null; by: string | null;
  mark: { status: "dismissed" | "project"; projectId: number | null; by: string | null; at: string } | null;
};

let ready: Promise<void> | null = null;
export function ensureIdeas(): Promise<void> {
  ready ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_ideas (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        why TEXT NOT NULL DEFAULT '',
        kind VARCHAR(48),
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    // an own idea names every kind of content it would make (08.11.2026 - "Write it with AI" offers several)
    await query(`ALTER TABLE apsomh_content_ideas ADD COLUMN IF NOT EXISTS kinds TEXT[]`);
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_idea_marks (
        key VARCHAR(300) PRIMARY KEY,
        status VARCHAR(16) NOT NULL,
        project_id INTEGER,
        by_whom VARCHAR(255),
        at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
type Draft = Omit<Idea, "mark" | "at" | "by" | "kinds" | "origin"> & Partial<Pick<Idea, "at" | "by" | "kinds" | "origin">>;
const idea = (x: Draft): Idea => ({ at: null, by: null, kinds: x.kind ? [x.kind] : [], origin: SOURCE_ORIGIN[x.source], ...x, mark: null });
/** A table that is not there yet (an app never opened on this hub) is an empty source, not an error. */
const missing = (e: unknown) => /does not exist|relation .* not found/i.test(e instanceof Error ? e.message : String(e));

async function fromConvert(): Promise<Idea[]> {
  try {
    const r = await query<{ id: string; path: string; kind: string; title: string; why: string; change: string; status: string; impact: number | null; confidence: number | null; effort: number | null; created_at: Date }>(
      `SELECT id, path, kind, title, why, change, status, impact, confidence, effort, created_at FROM apsomh_convert_ideas
        WHERE env = 'prod' AND status IN ('proposed', 'approved')
        ORDER BY (COALESCE(impact, 3) * COALESCE(confidence, 3))::float / GREATEST(COALESCE(effort, 3), 1) DESC, created_at DESC LIMIT 60`);
    const best = Math.max(1, ...r.rows.map((x) => ((x.impact ?? 3) * (x.confidence ?? 3)) / Math.max(x.effort ?? 3, 1)));
    return r.rows.map((x) => idea({
      key: `convert:${x.id}`, source: "convert", title: clip(x.title, 160), why: clip(x.why || x.change, 400), kind: "page-refresh", target: x.path,
      score: Math.round((100 * ((x.impact ?? 3) * (x.confidence ?? 3)) / Math.max(x.effort ?? 3, 1)) / best),
      href: `/website/ai-personalization/preview?env=prod&path=${encodeURIComponent(x.path)}&idea=${x.id}`, at: new Date(x.created_at).toISOString(),
    }));
  } catch (e) { if (missing(e)) return []; throw e; }
}

async function fromBuyers(): Promise<Idea[]> {
  try {
    const r = await query<{ win: string; data: { themes?: { title: string; why: string; test?: string; keys?: string[] }[] }; at: Date }>(
      `SELECT win, data, at FROM apsomh_convert_briefs ORDER BY at DESC LIMIT 1`);
    const row = r.rows[0];
    if (!row) return [];
    const themes = row.data?.themes ?? [];
    return themes.map((t, i) => idea({
      key: `buyers:${row.win}:${i}`, source: "buyers", title: clip(t.title, 160), why: clip([t.why, t.test && `Test first: ${t.test}`].filter(Boolean).join(" "), 500),
      kind: "landing-page", target: t.keys?.length ? `${t.keys.length} page${t.keys.length === 1 ? "" : "s"}` : null,
      score: Math.round(100 - (i * 100) / Math.max(themes.length, 1)), href: "/website/ai-personalization/problems", at: new Date(row.at).toISOString(),
    }));
  } catch (e) { if (missing(e)) return []; throw e; }
}

type AeoStored = { value?: { recommendations?: { id: string; action: string | null; contentType: string | null; topic: string | null; url: string | null; priority: string | null; status: string | null; summary: string | null; justification: string | null; associatedUrl: string | null }[]; prompts?: { id: string; prompt: string; language: string | null; visibility: number | null }[] } };

async function fromAeo(): Promise<Idea[]> {
  const stored = await kvGet<AeoStored>("slow_report:aeo:read:v1").catch(() => undefined);
  const v = stored?.value;
  if (!v) return [];
  const PRI: Record<string, number> = { HIGH: 100, MEDIUM: 66, LOW: 33 };
  const recs = (v.recommendations ?? []).filter((r) => !/DONE|DISMISS|COMPLETE/i.test(r.status ?? "")).map((r) => idea({
    key: `aeo:${r.id}`, source: "aeo", title: clip(r.summary || r.topic || "An AI-answer recommendation", 160), why: clip(r.justification, 500),
    kind: r.action === "UPDATE_CONTENT" ? "page-refresh" : /BLOG/i.test(r.contentType ?? "") ? "blog-article" : "landing-page",
    target: r.associatedUrl || r.url || r.topic, score: PRI[(r.priority ?? "").toUpperCase()] ?? 50, href: "/aeo/recommendations", origin: PLACE_ORIGIN.aeoRecommendation,
  }));
  const asks = (v.prompts ?? []).filter((p) => p.visibility != null && p.visibility < 0.2).sort((a, b) => (a.visibility ?? 0) - (b.visibility ?? 0)).slice(0, 25).map((p) => idea({
    key: `aeo-q:${p.id}`, source: "aeo", title: clip(`Answer: “${p.prompt}”`, 160),
    why: `The AI assistants answer this question but show APSOparts in ${Math.round((p.visibility ?? 0) * 100)}% of their answers - a page or a post that answers it plainly can change that.`,
    kind: "blog-article", target: p.language, score: Math.round(60 * (1 - (p.visibility ?? 0))), href: "/aeo/prompts", origin: PLACE_ORIGIN.aeoPrompt,
  }));
  return [...recs, ...asks];
}

let seoCache: { at: number; ideas: Idea[] } | null = null;
async function fromSeo(): Promise<Idea[]> {
  if (seoCache && Date.now() - seoCache.at < 6 * 3600_000) return seoCache.ideas;
  const [{ fetchGscQueries, fetchGscQueryPagePairs }, { quickWinsOf, decayOf, cannibalisationOf }, { buildWorkQueue }] = await Promise.all([
    import("@/lib/integrations/gsc"), import("@/app/seo/analysis"), import("@/app/seo/queue"),
  ]);
  const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
  const to = day(3);
  const [q, p, ext, pairs] = await Promise.all([
    fetchGscQueries({ dimension: "query", from: day(31), to }), fetchGscQueries({ dimension: "page", from: day(31), to }),
    fetchGscQueries({ dimension: "page", from: day(59), to }), fetchGscQueryPagePairs({ from: day(31), to }).catch(() => ({ rows: [] })),
  ]);
  const { items } = buildWorkQueue(
    { ok: true, rows: quickWinsOf(q.rows) },
    { ok: true, rows: cannibalisationOf(pairs.rows as Parameters<typeof cannibalisationOf>[0]) },
    { ok: true, rows: decayOf(p.rows, ext.rows).rows },
  );
  // the findings someone already acts on (SEO > Did it work) are not ideas any more
  let started = new Set<string>();
  try {
    const r = await query<{ item_id: string }>(`SELECT item_id FROM apsomh_seo_actions WHERE dropped_at IS NULL`);
    started = new Set(r.rows.map((x) => x.item_id));
  } catch { /* SEO actions never used here */ }
  const ideas = items.filter((w) => w.source !== "cannibalisation" && !started.has(w.id)).slice(0, 40).map((w) => idea({
    key: `seo:${w.id}`, source: "seo", title: clip(`${w.action}: ${w.subject}`, 160),
    why: clip(w.source === "quick-win" ? `Close to page one on Google for “${w.subject}” - ${w.impressions.toLocaleString("en")} impressions a month; a deeper page can take the clicks.` : `This page is losing clicks from Google (${w.impressions.toLocaleString("en")} impressions) - a refresh brings it back.`, 400),
    kind: w.source === "decay" ? "page-refresh" : "landing-page", target: w.subject, score: Math.round(w.priority),
    href: w.source === "decay" ? "/seo/decay" : "/seo/quick-wins", origin: w.source === "decay" ? PLACE_ORIGIN.seoDecay : PLACE_ORIGIN.seoQuickWin,
  }));
  seoCache = { at: Date.now(), ideas };
  return ideas;
}

async function fromSearch(): Promise<Idea[]> {
  const { gateway } = await import("@/lib/searchbar/gateway");
  type Gaps = { gaps: { query_norm: string; count: number; last_seen: string; reason?: string; locale?: string }[] };
  const g = await gateway<Gaps>("/api/smart-bar/gaps?window=30d", { timeoutMs: 8000 });
  const top = (g.gaps ?? []).filter((x) => x.query_norm && x.query_norm.length > 2).sort((a, b) => b.count - a.count).slice(0, 30);
  const most = Math.max(1, ...top.map((x) => x.count));
  return top.map((x) => idea({
    key: `search:${x.query_norm}`, source: "search", title: clip(`A page for “${x.query_norm}”`, 160),
    why: `Searched ${x.count} time${x.count === 1 ? "" : "s"} in the shop in 30 days${x.locale ? ` (${x.locale})` : ""} and found nothing${x.reason ? ` - ${x.reason}` : ""}.`,
    kind: "landing-page", target: x.query_norm, score: Math.round((100 * x.count) / most), href: "/website/search-bar#gaps", at: x.last_seen,
  }));
}

async function fromChat(): Promise<Idea[]> {
  const { topicSummary } = await import("@/lib/chat/topics");
  const from = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { rows } = await topicSummary(from);
  const subs = rows.flatMap((c) => c.subs.filter((s) => s.sub1).map((s) => ({ category: c.category, sub: s.sub1, chats: s.chats })))
    .sort((a, b) => b.chats - a.chats).slice(0, 20);
  const most = Math.max(1, ...subs.map((x) => x.chats));
  return subs.map((x) => idea({
    key: `chat:${x.category}:${x.sub}`, source: "chat", title: clip(`Customers ask about ${x.sub}`, 160),
    why: `${x.chats} chat${x.chats === 1 ? "" : "s"} in 90 days on “${x.sub}” (${x.category}) - a blog post or a FAQ answers them before they ask.`,
    kind: "blog-article", target: x.category, score: Math.round((100 * x.chats) / most), href: "/website/chat#topics",
  }));
}

async function fromBrand(): Promise<Idea[]> {
  const brain = await readBrain();
  const k = brain.keywordSignals;
  const terms = (k?.brandTermsMissingLandingPages ?? []).map((t, i, all) => idea({
    key: `brand:term:${t.toLowerCase()}`, source: "brand", title: clip(`A landing page for ${t}`, 160),
    why: `Customers search for “${t}” and the shop has no landing page for it (the brain's keyword signals).`,
    kind: "landing-page", target: t, score: Math.round(90 - (i * 40) / Math.max(all.length, 1)), href: "/personality",
  }));
  const trends = (k?.internalSearchTrends ?? []).map((t, i) => idea({
    key: `brand:trend:${t.term.toLowerCase()}`, source: "brand", title: clip(`“${t.term}” is rising in the shop's search`, 160),
    why: clip(`${t.signal} - a post or a page while the interest is there.`, 300),
    kind: "blog-article", target: t.term, score: Math.max(30, 80 - i * 10), href: "/personality",
  }));
  return [...terms, ...trends];
}

async function fromTeam(): Promise<Idea[]> {
  await ensureIdeas();
  const r = await query<{ id: number; title: string; why: string; kind: string | null; kinds: string[] | null; created_by: string | null; created_at: Date }>(
    `SELECT i.id, i.title, i.why, i.kind, i.kinds, COALESCE(NULLIF(u.full_name, ''), i.created_by) AS created_by, i.created_at
       FROM apsomh_content_ideas i LEFT JOIN apsomh_users u ON u.username = i.created_by ORDER BY i.created_at DESC LIMIT 200`);
  return r.rows.map((x) => {
    const kinds = x.kinds?.length ? x.kinds : x.kind ? [x.kind] : [];
    return idea({
      key: `team:${x.id}`, source: "team", title: x.title, why: x.why, kind: kinds[0] ?? null, kinds, target: null, score: 70, href: null,
      at: new Date(x.created_at).toISOString(), by: x.created_by,
    });
  });
}

const READERS: Record<IdeaSource, () => Promise<Idea[]>> = {
  convert: fromConvert, buyers: fromBuyers, aeo: fromAeo, seo: fromSeo, search: fromSearch, chat: fromChat, brand: fromBrand, team: fromTeam,
};

/** One source's ideas, each with what the team did with it. */
export async function ideasFrom(source: IdeaSource): Promise<Idea[]> {
  await ensureIdeas();
  const ideas = await READERS[source]();
  if (!ideas.length) return ideas;
  await ensureSharing();
  // an idea made into a project that was deleted since is an idea to look at again (the mark is kept: a project brought
  // back takes its ideas back)
  const marks = await query<{ key: string; status: "dismissed" | "project"; project_id: number | null; by_whom: string | null; at: Date }>(
    `SELECT m.key, m.status, m.project_id, m.by_whom, m.at FROM apsomh_content_idea_marks m
       LEFT JOIN apsomh_content_projects p ON p.id = m.project_id
      WHERE m.key = ANY($1::text[]) AND NOT (m.status = 'project' AND p.deleted_at IS NOT NULL)`, [ideas.map((i) => i.key)]);
  const by = new Map(marks.rows.map((m) => [m.key, m]));
  return ideas.map((i) => {
    const m = by.get(i.key);
    return m ? { ...i, mark: { status: m.status, projectId: m.project_id, by: m.by_whom, at: new Date(m.at).toISOString() } } : i;
  });
}

export async function addTeamIdea(p: { title: string; why: string; kinds: string[]; by: string }): Promise<number> {
  await ensureIdeas();
  const kinds = cleanKinds(p.kinds);
  const r = await query<{ id: number }>(`INSERT INTO apsomh_content_ideas (title, why, kind, kinds, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [clip(p.title, 200), clip(p.why, 1500), kinds[0] ?? null, kinds, p.by]);
  return r.rows[0].id;
}

const OFFERED = OFFERED_CONTENT_TYPES.map((t) => t.key);
/** Kinds as kept: offered ones only, each once, at most 6. */
export const cleanKinds = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).map(String).filter((k) => OFFERED.includes(k)))].slice(0, 6);

export type WrittenIdea = { title: string; why: string; kinds: string[]; facts: string[] };

/**
 * "Write it with AI" (SARCLA 08.11.2026: "Ideas should have + Idea - not of ours - and then create with AI"): a few words
 * of a person -> a whole idea: a title, why it matters (for whom, what it changes), the content to make (of the kinds
 * offered), and the brain's facts it leans on. Facts only from the brand brain; what the brain does not say is not said.
 * Null when the AI is not set up.
 */
export async function writeIdea(words: string): Promise<WrittenIdea | null> {
  const client = getAnthropic();
  if (!client) return null;
  const brain = await readBrain();
  const kinds = OFFERED_CONTENT_TYPES.map((t) => `${t.key}: ${t.label} - ${t.blurb}`).join("\n");
  const schema = {
    type: "object", additionalProperties: false, required: ["title", "why", "kinds", "facts"],
    properties: {
      title: { type: "string" }, why: { type: "string" },
      kinds: { type: "array", items: { type: "string", enum: OFFERED } },
      facts: { type: "array", items: { type: "string" } },
    },
  };
  const r = await claudeText({
    client,
    system: [{ type: "text", text: `${brandSystemPrompt(brain)}

You turn a marketer's few words into ONE content idea for the APSOparts team. Write:
- title: the idea itself, short and concrete (at most 12 words) - what we would publish or change, not its type.
- why: 2-3 plain sentences - for whom, what it changes for them and for APSOparts. Say only what the words and the brand brain support.
- kinds: 1 to 3 content types from the list that would carry it best, the best first.
- facts: the facts from the brand brain above that the idea leans on, each one short line - or none. Only facts written above.
Never invent product facts, figures, prices, stock, delivery times or certificates; never a discount value; never name Chemours. If the words need a fact the brain does not hold, write the idea without it. English, plain words, no slogans, no emojis.

Content types:
${kinds}` }],
    user: `The words: ${words}`,
    budget: { maxTokens: 1200, effort: "low" },
    outputFormat: { type: "json_schema", schema },
  });
  if (!r.ok) throw new Error(r.failure.error);
  const out = JSON.parse(r.text) as WrittenIdea;
  return {
    title: clip(out.title, 160), why: clip(out.why, 900),
    kinds: cleanKinds(out.kinds).slice(0, 3), facts: (Array.isArray(out.facts) ? out.facts : []).map((f) => clip(f, 200)).filter(Boolean).slice(0, 5),
  };
}

export async function removeTeamIdea(id: number, who: { username: string; admin: boolean }): Promise<boolean> {
  await ensureIdeas();
  const r = await query<{ id: number }>(`DELETE FROM apsomh_content_ideas WHERE id = $1 AND ($2::boolean OR created_by = $3) RETURNING id`, [id, who.admin, who.username]);
  return r.rows.length > 0;
}

export async function markIdeas(keys: string[], status: "dismissed" | "project" | null, by: string, projectId: number | null = null): Promise<void> {
  await ensureIdeas();
  const clean = keys.map((k) => String(k).slice(0, 300)).filter(Boolean).slice(0, 50);
  if (!clean.length) return;
  if (status === null) { await query(`DELETE FROM apsomh_content_idea_marks WHERE key = ANY($1::text[])`, [clean]); return; }
  for (const k of clean) {
    await query(
      `INSERT INTO apsomh_content_idea_marks (key, status, project_id, by_whom) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET status = EXCLUDED.status, project_id = EXCLUDED.project_id, by_whom = EXCLUDED.by_whom, at = NOW()`,
      [k, status, projectId, by]);
  }
}
