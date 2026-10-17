// AI ANSWERS (AEO) - pure: what the hub keeps of HubSpot's AEO runs, and the sums the
// AEO sub-app and the Reach KPI R10 draw (SARCLA 17.10: "integrate the AEO, then bring
// the GEO positions to the reports").
//
// HubSpot's AEO tool asks ChatGPT, Gemini and Claude the questions (prompts) set up in
// it, again and again. Each answer is a run: whether it named APSO (owned mentions),
// named competitors, and which pages it cited. The API keeps them for a while; the hub
// keeps every run it has read, so the months build up (SARCLA: "have the data in our
// database moving forward").

export type AeoPrompt = { id: string; prompt: string; language: string | null; phase: string | null; assistants: string[]; createdAt: string | null };
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
};
export type AeoRecommendation = {
  id: string; promptIds: string[]; engine: string | null; type: string | null; action: string | null; channel: string | null;
  contentType: string | null; topic: string | null; domain: string | null; url: string | null; priority: string | null;
  status: string | null; summary: string | null; justification: string | null; startDate: string | null; endDate: string | null;
};
export type AeoData = {
  generatedAt: string;
  prompts: AeoPrompt[];
  runs: AeoRun[];
  recommendations: AeoRecommendation[];
  /** the first answer the hub kept */
  since: string | null;
  /** answers whose citations are still to be read (read a few hundred at a time) */
  pendingDetails: number;
};

/** Our own domains: an answer citing one of them cites us. */
export const OWN_DOMAINS = ["apsoparts.com", "angst-pfister.com"];
export function isOwnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return OWN_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch { return false; }
}

export const ASSISTANTS = ["CHATGPT", "GEMINI", "CLAUDE"] as const;
export const ASSISTANT_NAME: Record<string, string> = { CHATGPT: "ChatGPT", GEMINI: "Gemini", CLAUDE: "Claude" };
export const assistantName = (m: string) => ASSISTANT_NAME[m?.toUpperCase()] ?? m;

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
