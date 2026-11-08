// IDEAS FROM EVERY APP (SARCLA 08.11.2026: "Ideas is missing - we should be able to review ideas from multiple apps and
// then create a project"). The hub already finds them - each app in its own place; this reads them into one list:
//
//   convert  APSOconvert's page ideas (apsomh_convert_ideas, prod, proposed/approved, ranked impact x confidence / effort)
//   buyers   APSOconvert's "What stops buyers" themes (the newest apsomh_convert_briefs row - made on a person's click)
//   aeo      AEO: HubSpot's recommendations, and the questions the AI assistants answer without citing us - read from
//            the stored read only (kv slow_report:aeo:read:v1), never a rebuild
//   seo      SEO: the work queue (quick wins, decay) worked out from Search Console - live, slow, kept 6 h in this process
//   search   the shop's search bar: what people searched and found nothing (the smart-bar gateway, 30 days)
//   chat     what customers ask in the chat (apsomh_chat_filing, 90 days) - FAQ and blog material
//   brand    the brain: brand terms with no landing page, internal search trends
//   plan     the Action plan's Idea box (admins, as the plan is)
//   team     ideas a person of the team wrote here (apsomh_content_ideas)
// Each idea has a stable key (source:id); "Not now" and "made into a project" are kept per key (apsomh_content_idea_marks)
// so a dismissed idea stays dismissed and a used one points at its project. Each source answers alone: one that fails
// says why and the others still show.

import { query } from "@/lib/db/client";
import { kvGet } from "@/lib/db/init";
import { readBrain } from "@/lib/brain";
import { TASK_KIND } from "@/lib/content/pieceRules";

export type IdeaSource = "convert" | "buyers" | "aeo" | "seo" | "search" | "chat" | "brand" | "plan" | "team";
export const SOURCES: { key: IdeaSource; label: string; app: "website" | "marketing" | "admin"; slow?: boolean; note: string }[] = [
  { key: "team", label: "Ours", app: "marketing", note: "Written here by the team" },
  { key: "convert", label: "Page ideas", app: "website", note: "APSOconvert - what would sell more on a shop page" },
  { key: "buyers", label: "What stops buyers", app: "website", note: "APSOconvert's themes across the shop" },
  { key: "aeo", label: "AI answers", app: "marketing", note: "AEO - what ChatGPT, Gemini & co. answer without us" },
  { key: "seo", label: "SEO", app: "marketing", slow: true, note: "Search Console - pages close to page one, pages losing clicks" },
  { key: "search", label: "Shop search", app: "website", note: "What people searched in the shop and found nothing" },
  { key: "chat", label: "Customers ask", app: "website", note: "What customers ask in the chat" },
  { key: "brand", label: "Brand", app: "marketing", note: "The brain - brand terms with no page, search trends" },
  { key: "plan", label: "Action plan", app: "admin", note: "The plan's Idea box" },
];

export type Idea = {
  key: string; source: IdeaSource; title: string; why: string;
  /** the content type that fits it best (a key of contentTypes.ts), or "task" for an action */
  kind: string | null;
  /** the page, the query, the term it is about */
  target: string | null;
  /** 0-100 within its source */
  score: number;
  /** where to read it in its own app */
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
const idea = (x: Omit<Idea, "mark" | "at" | "by"> & Partial<Pick<Idea, "at" | "by">>): Idea => ({ at: null, by: null, ...x, mark: null });
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
      href: `/website/ai-personalization/preview?path=${encodeURIComponent(x.path)}`, at: new Date(x.created_at).toISOString(),
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
    target: r.associatedUrl || r.url || r.topic, score: PRI[(r.priority ?? "").toUpperCase()] ?? 50, href: "/aeo/recommendations",
  }));
  const asks = (v.prompts ?? []).filter((p) => p.visibility != null && p.visibility < 0.2).sort((a, b) => (a.visibility ?? 0) - (b.visibility ?? 0)).slice(0, 25).map((p) => idea({
    key: `aeo-q:${p.id}`, source: "aeo", title: clip(`Answer: “${p.prompt}”`, 160),
    why: `The AI assistants answer this question but show APSOparts in ${Math.round((p.visibility ?? 0) * 100)}% of their answers - a page or a post that answers it plainly can change that.`,
    kind: "blog-article", target: p.language, score: Math.round(60 * (1 - (p.visibility ?? 0))), href: "/aeo/prompts",
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
    href: w.source === "decay" ? "/seo/decay" : "/seo/quick-wins",
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
    kind: "landing-page", target: x.query_norm, score: Math.round((100 * x.count) / most), href: "/website/search-bar", at: x.last_seen,
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
    kind: "blog-article", target: x.category, score: Math.round((100 * x.chats) / most), href: "/website/chat",
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

async function fromPlan(): Promise<Idea[]> {
  try {
    const r = await query<{ id: number; title: string; detail: string | null; channel: string | null; updated_at: Date }>(
      `SELECT id, title, detail, channel, updated_at FROM apsomh_action_plan WHERE kind = 'action' AND stage = '6161860807' ORDER BY updated_at DESC LIMIT 40`);
    return r.rows.map((x, i) => idea({
      key: `plan:${x.id}`, source: "plan", title: clip(x.title, 160), why: clip(x.detail || (x.channel ? `In the plan's Idea box - ${x.channel}.` : "In the plan's Idea box."), 400),
      kind: /newsletter/i.test(x.channel ?? "") ? "newsletter" : /linkedin|social/i.test(x.channel ?? "") ? "social-post" : /seo|website/i.test(x.channel ?? "") ? "landing-page" : TASK_KIND,
      target: x.channel, score: Math.max(20, 80 - i * 3), href: "/action-plan", at: new Date(x.updated_at).toISOString(),
    }));
  } catch (e) { if (missing(e)) return []; throw e; }
}

async function fromTeam(): Promise<Idea[]> {
  await ensureIdeas();
  const r = await query<{ id: number; title: string; why: string; kind: string | null; created_by: string | null; created_at: Date }>(
    `SELECT id, title, why, kind, created_by, created_at FROM apsomh_content_ideas ORDER BY created_at DESC LIMIT 200`);
  return r.rows.map((x) => idea({
    key: `team:${x.id}`, source: "team", title: x.title, why: x.why, kind: x.kind, target: null, score: 70, href: null,
    at: new Date(x.created_at).toISOString(), by: x.created_by,
  }));
}

const READERS: Record<IdeaSource, () => Promise<Idea[]>> = {
  convert: fromConvert, buyers: fromBuyers, aeo: fromAeo, seo: fromSeo, search: fromSearch, chat: fromChat, brand: fromBrand, plan: fromPlan, team: fromTeam,
};

/** One source's ideas, each with what the team did with it. */
export async function ideasFrom(source: IdeaSource): Promise<Idea[]> {
  await ensureIdeas();
  const ideas = await READERS[source]();
  if (!ideas.length) return ideas;
  const marks = await query<{ key: string; status: "dismissed" | "project"; project_id: number | null; by_whom: string | null; at: Date }>(
    `SELECT key, status, project_id, by_whom, at FROM apsomh_content_idea_marks WHERE key = ANY($1::text[])`, [ideas.map((i) => i.key)]);
  const by = new Map(marks.rows.map((m) => [m.key, m]));
  return ideas.map((i) => {
    const m = by.get(i.key);
    return m ? { ...i, mark: { status: m.status, projectId: m.project_id, by: m.by_whom, at: new Date(m.at).toISOString() } } : i;
  });
}

export async function addTeamIdea(p: { title: string; why: string; kind: string | null; by: string }): Promise<number> {
  await ensureIdeas();
  const r = await query<{ id: number }>(`INSERT INTO apsomh_content_ideas (title, why, kind, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [clip(p.title, 200), clip(p.why, 1500), p.kind, p.by]);
  return r.rows[0].id;
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
