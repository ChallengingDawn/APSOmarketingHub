// AI ANSWERS (AEO) - the read: HubSpot's AEO API (beta, marketing.aeo.read) - the
// prompts set up in HubSpot's AEO tool, every answer (run) to them, and the content
// recommendations. Every answer read is kept in the hub (kv aeo:runs:v1), so the months
// build up whatever HubSpot keeps. An answer's citations come from its own detail call,
// read once and kept - a few hundred per read, the rest the next time.
// Read every 6 hours; the pages show the last read while a new one runs.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { reportProgress, slowReport, type SlowState } from "@/lib/integrations/slowReport";
import { kvGet, kvSet } from "@/lib/db/init";
import { AEO_SHAPE, hostOf, isOwnUrl, runOf, type AeoData, type AeoPrompt, type AeoRecommendation, type AeoRun } from "./model";

const KEY = "aeo:read:v1";
const RUNS_KEY = "aeo:runs:v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const BASE = "/marketing/aeo/2027-03-beta";
/** Detail calls per read - the citations of the newest answers first. */
const DETAILS_PER_READ = 600;

export function aeoData(): Promise<SlowState<AeoData>> {
  return slowReport(KEY, (v: AeoData) => (v?.shape !== AEO_SHAPE ? 0 : TTL_MS), build);
}

type Page = { results?: Record<string, unknown>[]; paging?: { next?: { after?: string } } };
async function listAll(path: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let after: string | undefined;
  for (let i = 0; i < 200; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await hubspotFetchJson<Page>({ path: `${path}${sep}limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}` });
    out.push(...(r.results ?? []));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return out;
}

const s = (v: unknown) => (typeof v === "string" && v ? v : null);

/** One answer's own detail: the text, the citations, the search queries - for the Prompts page. */
export async function aeoRunDetail(runUuid: string): Promise<{ responseText: string | null; citations: { url: string; title: string | null }[]; searchQueries: string[] }> {
  const r = await hubspotFetchJson<Record<string, unknown>>({ path: `${BASE}/prompt-runs/${encodeURIComponent(runUuid)}` });
  const cites = Array.isArray(r.citations) ? (r.citations as Record<string, unknown>[]) : [];
  return {
    responseText: s(r.responseText),
    citations: cites.flatMap((c) => (s(c.url) ? [{ url: s(c.url)!, title: s(c.title) }] : [])),
    searchQueries: Array.isArray(r.searchQueries) ? (r.searchQueries as unknown[]).map(String) : [],
  };
}

async function build(): Promise<AeoData> {
  reportProgress(KEY, "reading the prompts");
  const prompts: AeoPrompt[] = (await listAll(`${BASE}/prompts`)).map((p) => ({
    id: String(p.id ?? ""), prompt: String(p.prompt ?? ""), language: s(p.language), phase: s(p.buyingJourneyPhase),
    assistants: Array.isArray(p.aiAssistants) ? (p.aiAssistants as unknown[]).map((x) => String(x).toUpperCase()) : [],
    createdAt: s(p.createdAt), visibility: null,
  })).filter((p) => p.id);
  // HubSpot's own visibility score comes with each prompt read on its own
  for (const p of prompts) {
    try {
      const one = await hubspotFetchJson<Record<string, unknown>>({ path: `${BASE}/prompts/${encodeURIComponent(p.id)}` });
      const v = Number(one.visibility);
      p.visibility = Number.isFinite(v) ? v : null;
    } catch { /* the score stays empty */ }
  }

  // every answer the hub has kept, then the new ones
  let kept: Record<string, AeoRun> = {};
  try { kept = (await kvGet<Record<string, AeoRun>>(RUNS_KEY)) ?? {}; } catch { /* no database here: this read only */ }
  let i = 0;
  for (const p of prompts) {
    reportProgress(KEY, `reading the answers: prompt ${++i} of ${prompts.length}`);
    for (const r of await listAll(`${BASE}/prompts/${encodeURIComponent(p.id)}/runs`)) {
      const run = runOf({ promptId: p.id, ...r });
      if (!run || !r.completedAt) continue;
      const before = kept[run.id];
      kept[run.id] = { ...run, ownCited: before?.ownCited ?? null, ...(before?.domains ? { domains: before.domains } : {}) };
    }
  }
  // the citations: the newest answers first, a few hundred per read
  const todo = Object.values(kept).filter((r) => r.ownCited == null || !r.domains).sort((a, b) => (a.at < b.at ? 1 : -1));
  let n = 0;
  for (const r of todo.slice(0, DETAILS_PER_READ)) {
    if (++n % 25 === 0) reportProgress(KEY, `reading the answers' citations: ${n} of ${Math.min(todo.length, DETAILS_PER_READ)}`);
    try {
      const d = await aeoRunDetail(r.id);
      kept[r.id] = { ...r, ownCited: d.citations.filter((c) => isOwnUrl(c.url)).length, domains: [...new Set(d.citations.map((c) => hostOf(c.url)).filter((x): x is string => !!x))] };
    } catch { /* read again next time */ }
  }
  try { await kvSet(RUNS_KEY, kept); } catch { /* kept next time */ }

  reportProgress(KEY, "reading the recommendations");
  const recommendations: AeoRecommendation[] = (await listAll(`${BASE}/recommendations`)).map((x) => ({
    id: String(x.id ?? ""), promptIds: Array.isArray(x.promptIds) ? (x.promptIds as unknown[]).map(String) : [],
    engine: s(x.answerEngine), type: s(x.recommendationType), action: s(x.actionCategory), channel: s(x.actionChannel),
    contentType: s(x.contentType), topic: s(x.contentTopic), domain: s(x.domain), url: s(x.url), priority: s(x.priority),
    status: s(x.status), summary: s(x.recommendationSummary), justification: s(x.justification), startDate: s(x.startDate), endDate: s(x.endDate),
    influencing: Array.isArray(x.influencingCitations) ? [...new Set((x.influencingCitations as unknown[]).map(String))] : [],
    associatedUrl: s(x.associatedContentUrl),
  }));

  const runs = Object.values(kept).sort((a, b) => (a.at < b.at ? -1 : 1));
  return {
    shape: AEO_SHAPE, generatedAt: new Date().toISOString(), prompts, runs, recommendations,
    since: runs[0]?.at ?? null, pendingDetails: Math.max(0, todo.length - DETAILS_PER_READ),
  };
}
