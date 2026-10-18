// AI ANSWERS (AEO) - pure: what the hub keeps of HubSpot's AEO runs, and the sums the
// AEO sub-app and the Reach KPI R10 draw (SARCLA 17.10: "integrate the AEO, then bring
// the GEO positions to the reports").
//
// HubSpot's AEO tool asks the AI assistants (ChatGPT, Gemini, Perplexity) the questions set up in
// it, again and again. Each answer is a run: whether it named APSO (owned mentions),
// named competitors, and which pages it cited. The API keeps them for a while; the hub
// keeps every run it has read, so the months build up (SARCLA: "have the data in our
// database moving forward").

export type AeoPrompt = {
  id: string; prompt: string; language: string | null; phase: string | null; assistants: string[]; createdAt: string | null;
  /** HubSpot's own visibility score for the prompt, 0-1 ("0.05" in the API) */
  visibility: number | null;
};
export type AeoRun = {
  id: string;
  promptId: string;
  /** CHATGPT, GEMINI, CLAUDE */
  model: string;
  /** when the answer came, ISO */
  at: string;
  owned: number;
  competitor: number;
  citations: number;
  /** the answer's citations that are our own pages; null while its detail has not been read */
  ownCited: number | null;
  /** the sites the answer cited, once each (www. dropped) - who the assistants rely on (SARCLA 17.10: "a graph with the competitors") */
  domains?: string[];
};
export type AeoRecommendation = {
  id: string; promptIds: string[]; engine: string | null; type: string | null; action: string | null; channel: string | null;
  contentType: string | null; topic: string | null; domain: string | null; url: string | null; priority: string | null;
  status: string | null; summary: string | null; justification: string | null; startDate: string | null; endDate: string | null;
  /** the pages that shaped the recommendation - the ones to beat */
  influencing: string[];
  /** our page the recommendation is about, when HubSpot names one */
  associatedUrl: string | null;
};
/** Bumped when the read gains fields: a stored read of an older shape is read again at once. */
export const AEO_SHAPE = 2;
export type AeoData = {
  shape?: number;
  generatedAt: string;
  prompts: AeoPrompt[];
  runs: AeoRun[];
  recommendations: AeoRecommendation[];
  /** the first answer the hub kept */
  since: string | null;
  /** answers whose citations are still to be read (read a few hundred at a time) */
  pendingDetails: number;
};

/** A URL's site, without "www." - null when it is not a URL. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

/** Our own domains: an answer citing one of them cites us. */
export const OWN_DOMAINS = ["apsoparts.com", "angst-pfister.com"];
export function isOwnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return OWN_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch { return false; }
}

/** The assistants in the order the pages show them; any other HubSpot adds comes after. */
export const ASSISTANTS = ["CHATGPT", "GEMINI", "PERPLEXITY", "CLAUDE"] as const;
export const ASSISTANT_NAME: Record<string, string> = { CHATGPT: "ChatGPT", GEMINI: "Gemini", PERPLEXITY: "Perplexity", CLAUDE: "Claude" };
export const assistantName = (m: string) => ASSISTANT_NAME[m?.toUpperCase()] ?? m.charAt(0) + m.slice(1).toLowerCase();
/** The assistants that answered (SARCLA 17.10: the prompts run on Perplexity too). */
export function assistantsIn(runs: AeoRun[]): string[] {
  const seen = new Set(runs.map((r) => r.model).filter(Boolean));
  return [...ASSISTANTS.filter((a) => seen.has(a)), ...[...seen].filter((m) => !(ASSISTANTS as readonly string[]).includes(m)).sort()];
}
/** "ChatGPT, Gemini and Perplexity" */
export function namesIn(runs: AeoRun[]): string {
  const n = assistantsIn(runs).map(assistantName);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0] ?? "the AI assistants";
}

/** HubSpot's run, as the hub keeps it. */
export function runOf(r: Record<string, unknown>, ownCited: number | null = null): AeoRun | null {
  const id = typeof r.id === "string" ? r.id : null;
  const at = (r.completedAt ?? r.createdAt) as string | undefined;
  if (!id || !at) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    id, promptId: String(r.promptId ?? ""), model: String(r.aiModel ?? r.answerEngine ?? "").toUpperCase(), at,
    owned: n(r.ownedMentions), competitor: n(r.competitorMentions), citations: n(r.totalCitations), ownCited,
  };
}

export type Sums = { answers: number; mentioned: number; owned: number; competitor: number; cited: number; citedKnown: number };
const zero = (): Sums => ({ answers: 0, mentioned: 0, owned: 0, competitor: 0, cited: 0, citedKnown: 0 });
const add = (s: Sums, r: AeoRun) => {
  s.answers += 1;
  if (r.owned > 0) s.mentioned += 1;
  s.owned += r.owned; s.competitor += r.competitor;
  if (r.ownCited != null) { s.citedKnown += 1; if (r.ownCited > 0) s.cited += 1; }
};
/** The share of answers that named APSO. */
export const mentionRate = (s: Sums) => (s.answers ? s.mentioned / s.answers : null);
/** APSO's mentions against everyone's - the share of voice. */
export const shareOfVoice = (s: Sums) => (s.owned + s.competitor ? s.owned / (s.owned + s.competitor) : null);
/** The share of answers (whose citations are read) that cited our own pages. */
export const citeRate = (s: Sums) => (s.citedKnown ? s.cited / s.citedKnown : null);

/** The runs between two instants (ISO, `from` included, `to` excluded), all assistants and each. */
export function sumsBetween(runs: AeoRun[], from: string, to: string): { all: Sums; by: Record<string, Sums> } {
  const all = zero(), by: Record<string, Sums> = {};
  for (const r of runs) {
    if (r.at < from || r.at >= to) continue;
    add(all, r);
    add((by[r.model] ??= zero()), r);
  }
  return { all, by };
}

/** Month by month, "YYYY-MM" -> all assistants and each. */
export function byMonth(runs: AeoRun[]): Record<string, { all: Sums; by: Record<string, Sums> }> {
  const out: Record<string, { all: Sums; by: Record<string, Sums> }> = {};
  for (const r of runs) {
    const m = (out[r.at.slice(0, 7)] ??= { all: zero(), by: {} });
    add(m.all, r);
    add((m.by[r.model] ??= zero()), r);
  }
  return out;
}

/** Each prompt's latest answer from each assistant. */
export function latestByPrompt(runs: AeoRun[]): Map<string, Map<string, AeoRun>> {
  const out = new Map<string, Map<string, AeoRun>>();
  for (const r of runs) {
    let m = out.get(r.promptId);
    if (!m) { m = new Map(); out.set(r.promptId, m); }
    const cur = m.get(r.model);
    if (!cur || r.at > cur.at) m.set(r.model, r);
  }
  return out;
}

/** The share of answers naming APSO per month of a year - the Reach KPI R10, "AI search visibility (GEO)". */
export function mentionSeries(runs: AeoRun[], year: number): (number | null)[] {
  const m = byMonth(runs);
  return Array.from({ length: 12 }, (_, i) => {
    const s = m[`${year}-${String(i + 1).padStart(2, "0")}`]?.all;
    return s ? mentionRate(s) : null;
  });
}

type Monthly = { months: (number | null)[]; py: (number | null)[] };
/**
 * The Reach KPI R10 "AI search visibility (GEO)" for a year and the one before: per
 * month the answers, those naming APSO, and the share. Worked out when the KPI page
 * asks, from the answers the hub keeps - so it is as current as the AEO read.
 */
export function r10Series(runs: AeoRun[], year: number): { R10: Monthly; R10N: Monthly; R10D: Monthly } {
  const empty = (): Monthly => ({ months: Array(12).fill(null), py: Array(12).fill(null) });
  const named = empty(), all = empty(), share = empty();
  for (const r of runs) {
    const y = Number(r.at.slice(0, 4)), m = Number(r.at.slice(5, 7)) - 1;
    const side = y === year ? "months" : y === year - 1 ? "py" : null;
    if (!side || !(m >= 0 && m < 12)) continue;
    all[side][m] = (all[side][m] ?? 0) + 1;
    named[side][m] = (named[side][m] ?? 0) + (r.owned > 0 ? 1 : 0);
  }
  for (const side of ["months", "py"] as const) share[side] = all[side].map((n, i) => (n ? (named[side][i] ?? 0) / n : null));
  return { R10: share, R10N: named, R10D: all };
}

export type CitedSite = { domain: string; answers: number; share: number; own: boolean; /** 1 = the most cited */ rank: number };
/**
 * Who the assistants cite between two instants: per site, the answers citing it and
 * their share of the answers whose sources are read - our own sites marked. The
 * competitors as the assistants see them.
 */
export function citedSites(runs: AeoRun[], from: string, to: string, model?: string): { sites: CitedSite[]; read: number } {
  const count = new Map<string, number>();
  let read = 0;
  for (const r of runs) {
    if (r.at < from || r.at >= to || !r.domains || (model && r.model !== model)) continue;
    read += 1;
    for (const d of new Set(r.domains)) count.set(d, (count.get(d) ?? 0) + 1);
  }
  const sites = [...count.entries()].map(([domain, answers]) => ({ domain, answers, share: read ? answers / read : 0, own: isOwnUrl(`https://${domain}/`), rank: 0 }))
    .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain));
  // the same count, the same place
  sites.forEach((x, i) => { x.rank = i && sites[i - 1].answers === x.answers ? sites[i - 1].rank : i + 1; });
  return { sites, read };
}

/** The Content Studio type a recommendation is best made as. */
export function contentTypeFor(r: AeoRecommendation): string | null {
  if (r.action === "UPDATE_CONTENT") return "page-refresh";
  if (r.action !== "CREATE_CONTENT") return null;
  if (/PRODUCT/i.test(r.contentType ?? "")) return "product-page";
  if (/LANDING|COMPARISON|COMMERCIAL/i.test(r.contentType ?? "")) return "landing-page";
  return "blog-article";
}

/** The line a project made from a recommendation carries, so the page finds it again. */
export const recMarker = (id: string) => `[AEO recommendation ${id}]`;
/**
 * A Content Studio project from a recommendation (SARCLA 17.10: "create the advised
 * point directly"): the topic as its title, and a brief with what to do, why, the
 * questions the content must answer and the pages the assistants cite today - kept
 * well under the hub's 8 KB request body.
 */
export function projectFor(r: AeoRecommendation, prompts: AeoPrompt[]): { title: string; brief: string; contentType: string | null } {
  const asked = r.promptIds.map((id) => prompts.find((p) => p.id === id)?.prompt).filter((x): x is string => !!x).slice(0, 10);
  const lines = [
    `Recommended by HubSpot's AEO${r.priority ? ` (${r.priority.toLowerCase()} priority)` : ""}: content the AI assistants (ChatGPT, Gemini, Perplexity) should find and cite when buyers ask them.`,
    r.topic ? `Topic: ${r.topic}` : null,
    r.summary ? `What to do: ${r.summary}` : null,
    r.justification ? `Why: ${r.justification}` : null,
    asked.length ? `The questions it must answer:\n${asked.map((q) => `- ${q}`).join("\n")}` : null,
    r.influencing.length ? `The pages the assistants cite today - do better than these:\n${r.influencing.slice(0, 12).map((u) => `- ${u}`).join("\n")}` : null,
    r.associatedUrl || r.url ? `Our page this is about: ${r.associatedUrl ?? r.url}` : null,
    recMarker(r.id),
  ].filter(Boolean) as string[];
  let brief = lines.join("\n\n");
  if (brief.length > 6000) brief = `${brief.slice(0, 5900 - recMarker(r.id).length)}…\n\n${recMarker(r.id)}`;
  const title = (r.topic ?? r.summary ?? "AEO recommendation").replace(/\s+/g, " ").trim().slice(0, 200);
  return { title, brief, contentType: contentTypeFor(r) };
}

/** Prompt by prompt between two instants (ISO, `from` included, `to` excluded). */
export function byPrompt(runs: AeoRun[], from: string, to: string): Record<string, Sums> {
  const out: Record<string, Sums> = {};
  for (const r of runs) {
    if (r.at < from || r.at >= to) continue;
    add((out[r.promptId] ??= zero()), r);
  }
  return out;
}

export type AssistantWindows = { cur: Record<string, Sums>; prev: Record<string, Sums>; models: string[]; since: string | null };
/** Each assistant over the last 30 days and the 30 before - the "By assistant" table on AI answers and on Reach. */
export function assistantWindows(runs: AeoRun[], now: Date): AssistantWindows {
  const to = now.toISOString(), from = new Date(now.getTime() - 30 * 86_400_000).toISOString(), before = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const since = runs.reduce<string | null>((a, r) => (!a || r.at < a ? r.at : a), null);
  return { cur: sumsBetween(runs, from, to).by, prev: sumsBetween(runs, before, from).by, models: assistantsIn(runs), since };
}

export type CitedWindow = { sites: CitedSite[]; read: number; /** every site cited, not only those kept */ total: number };
export type CitedData = { models: string[]; all: CitedWindow; by: Record<string, CitedWindow> };
/**
 * Who the assistants cite over the last 30 days, all assistants and each - the first
 * `keep` sites and our own wherever they stand (SARCLA 18.10: "the AI answers tab should
 * also show competitor positioning"). Small enough to send with the KPI page.
 */
export function citedWindows(runs: AeoRun[], now: Date, keep = 15): CitedData {
  const to = now.toISOString(), from = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const cut = (w: { sites: CitedSite[]; read: number }): CitedWindow => ({
    sites: w.sites.filter((x, i) => i < keep || x.own), read: w.read, total: w.sites.length,
  });
  const models = assistantsIn(runs);
  return { models, all: cut(citedSites(runs, from, to)), by: Object.fromEntries(models.map((m) => [m, cut(citedSites(runs, from, to, m))])) };
}
