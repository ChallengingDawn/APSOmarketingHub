// A/B TESTING > the record of every test (model.ts says what one is). One row per test; what its source says is refreshed
// by the sync (sync.ts), what a person says is theirs and only they change it - every change written in the log.
// Tables: apsomh_experiments, apsomh_experiment_log.

import { getPool, query } from "@/lib/db/client";
import type { Arm, Category, Decision, Experiment, Ice, PersonFields, Source, Status } from "./model";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS apsomh_experiments (
  key text PRIMARY KEY,
  source text NOT NULL, category text NOT NULL, service text, host text, surface text NOT NULL DEFAULT '',
  name text NOT NULL, metric text NOT NULL DEFAULT '', status text NOT NULL,
  started_at timestamptz, ended_at timestamptz,
  arms jsonb NOT NULL DEFAULT '[]', secondary jsonb, verdict text, link text, changes jsonb NOT NULL DEFAULT '[]',
  hypothesis text NOT NULL DEFAULT '', decision text, learning text NOT NULL DEFAULT '', owner text, ice jsonb,
  notes text NOT NULL DEFAULT '', reported text NOT NULL DEFAULT '',
  decided_by text, decided_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz, gone boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS apsomh_experiments_status ON apsomh_experiments (status) WHERE NOT gone;
CREATE SEQUENCE IF NOT EXISTS apsomh_experiments_manual;
CREATE TABLE IF NOT EXISTS apsomh_experiment_log (
  id bigserial PRIMARY KEY, key text NOT NULL, at timestamptz NOT NULL DEFAULT now(), by_whom text, action text NOT NULL, detail text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS apsomh_experiment_log_key ON apsomh_experiment_log (key, at DESC);
`;

let ready: Promise<void> | null = null;
export function ensureExperiments(): Promise<void> {
  ready ??= getPool().query(SCHEMA).then(() => undefined).catch((e) => { ready = null; throw e; });
  return ready;
}

type Row = {
  key: string; source: Source; category: Category; service: string | null; host: string | null; surface: string; name: string; metric: string;
  status: Status; started_at: Date | null; ended_at: Date | null; arms: Arm[]; secondary: Experiment["secondary"]; verdict: string | null; link: string | null;
  changes: string[]; hypothesis: string; decision: Decision | null; learning: string; owner: string | null; ice: Ice | null; notes: string; reported: string;
  decided_by: string | null; decided_at: Date | null; created_by: string | null; created_at: Date; updated_by: string | null; updated_at: Date; synced_at: Date | null;
};
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const toExp = (r: Row): Experiment => ({
  key: r.key, source: r.source, category: r.category, service: r.service, host: r.host, surface: r.surface, name: r.name, hypothesis: r.hypothesis ?? "",
  metric: r.metric, status: r.status, startedAt: iso(r.started_at), endedAt: iso(r.ended_at), arms: Array.isArray(r.arms) ? r.arms : [], secondary: r.secondary ?? null,
  verdict: r.verdict, link: r.link, changes: Array.isArray(r.changes) ? r.changes : [], decision: r.decision, learning: r.learning ?? "", owner: r.owner,
  ice: r.ice ?? null, notes: r.notes ?? "", reported: r.reported ?? "", decidedBy: r.decided_by, decidedAt: iso(r.decided_at),
  createdBy: r.created_by, createdAt: iso(r.created_at)!, updatedBy: r.updated_by, updatedAt: iso(r.updated_at)!, syncedAt: iso(r.synced_at),
});

export async function listExperiments(): Promise<Experiment[]> {
  await ensureExperiments();
  const r = await query<Row>(`SELECT * FROM apsomh_experiments WHERE NOT gone ORDER BY COALESCE(started_at, created_at) DESC`);
  return r.rows.map(toExp);
}
export async function experimentByKey(key: string): Promise<Experiment | null> {
  await ensureExperiments();
  const r = await query<Row>(`SELECT * FROM apsomh_experiments WHERE key = $1 AND NOT gone`, [key]);
  return r.rows[0] ? toExp(r.rows[0]) : null;
}

export type FromSource = Omit<Experiment, PersonFields> & { hypothesis?: string; decision?: Decision | null; decidedBy?: string | null; decidedAt?: string | null };

/** The sources' word: written over each sync; a person's fields only filled when still empty. */
export async function upsertFromSource(list: FromSource[]): Promise<number> {
  if (!list.length) return 0;
  await ensureExperiments();
  const client = await getPool().connect();
  try {
    for (const e of list) {
      await client.query(
        `INSERT INTO apsomh_experiments (key, source, category, service, host, surface, name, metric, status, started_at, ended_at, arms, secondary,
            verdict, link, changes, hypothesis, decision, decided_by, decided_at, created_by, synced_at, gone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb, $17, $18, $19, $20, 'sync', now(), false)
         ON CONFLICT (key) DO UPDATE SET source = EXCLUDED.source, category = EXCLUDED.category, service = EXCLUDED.service, host = EXCLUDED.host,
           surface = EXCLUDED.surface, name = EXCLUDED.name, metric = EXCLUDED.metric, status = EXCLUDED.status, started_at = EXCLUDED.started_at,
           ended_at = EXCLUDED.ended_at, arms = EXCLUDED.arms, secondary = EXCLUDED.secondary, verdict = EXCLUDED.verdict, link = EXCLUDED.link,
           changes = EXCLUDED.changes, synced_at = now(), gone = false,
           hypothesis = CASE WHEN apsomh_experiments.hypothesis = '' THEN EXCLUDED.hypothesis ELSE apsomh_experiments.hypothesis END,
           decision = COALESCE(apsomh_experiments.decision, EXCLUDED.decision),
           decided_by = CASE WHEN apsomh_experiments.decision IS NULL THEN EXCLUDED.decided_by ELSE apsomh_experiments.decided_by END,
           decided_at = CASE WHEN apsomh_experiments.decision IS NULL THEN EXCLUDED.decided_at ELSE apsomh_experiments.decided_at END`,
        [e.key, e.source, e.category, e.service, e.host, e.surface, e.name, e.metric, e.status, e.startedAt, e.endedAt, JSON.stringify(e.arms),
          e.secondary ? JSON.stringify(e.secondary) : null, e.verdict, e.link, JSON.stringify(e.changes), e.hypothesis ?? "", e.decision ?? null,
          e.decision ? e.decidedBy ?? null : null, e.decision ? e.decidedAt ?? null : null]);
    }
  } finally {
    client.release();
  }
  return list.length;
}

/** A source no longer has these (a deleted draft): hidden, unless something was decided or learned on it. */
export async function hideMissing(source: Source, keep: string[]): Promise<void> {
  await ensureExperiments();
  await query(`UPDATE apsomh_experiments SET gone = true WHERE source = $1 AND NOT gone AND NOT (key = ANY($2::text[]))
                 AND status IN ('idea', 'planned') AND decision IS NULL AND learning = ''`, [source, keep]);
}

export async function log(key: string, by: string | null, action: string, detail = ""): Promise<void> {
  await query(`INSERT INTO apsomh_experiment_log (key, by_whom, action, detail) VALUES ($1, $2, $3, $4)`, [key, by, action, detail.slice(0, 2000)]);
}
export async function logOf(key: string): Promise<{ at: string; by: string | null; action: string; detail: string }[]> {
  await ensureExperiments();
  const r = await query<{ at: Date; by_whom: string | null; action: string; detail: string }>(
    `SELECT at, by_whom, action, detail FROM apsomh_experiment_log WHERE key = $1 ORDER BY at DESC LIMIT 100`, [key]);
  return r.rows.map((x) => ({ at: new Date(x.at).toISOString(), by: x.by_whom, action: x.action, detail: x.detail }));
}

/* ── a person's word ── */
const DECISIONS: Decision[] = ["ship", "keep-control", "iterate", "inconclusive"];
const STATUSES: Status[] = ["idea", "planned", "running", "paused", "ended"];
const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : null);
const dayOrNull = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const ice = (v: unknown): Ice | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => Math.min(10, Math.max(1, Math.round(Number(x) || 0)));
  return Number(o.impact) && Number(o.confidence) && Number(o.ease) ? { impact: n(o.impact), confidence: n(o.confidence), ease: n(o.ease) } : null;
};
const arms = (v: unknown): Arm[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v.slice(0, 6).map((a, i) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return { key: str(o.key, 20) || String.fromCharCode(97 + i), name: str(o.name, 80) || (i ? `Version ${String.fromCharCode(65 + i)}` : "Control"),
      control: i === 0, visitors: Math.max(0, Math.round(Number(o.visitors) || 0)), conversions: Math.max(0, Math.round(Number(o.conversions) || 0)) };
  });
  if (out.some((a) => a.conversions > a.visitors)) throw new Error("A version cannot have more conversions than visitors.");
  return out;
};

export class ExpError extends Error { constructor(m: string, public status = 400) { super(m); } }

/** What anyone with the write level may change; on a test typed in by hand, the rest too. */
export async function savePerson(key: string, patch: Record<string, unknown>, by: string): Promise<Experiment> {
  const e = await experimentByKey(key);
  if (!e) throw new ExpError("No such test.", 404);
  const set: string[] = [], args: unknown[] = [key];
  const put = (col: string, v: unknown, cast = "") => { args.push(v); set.push(`${col} = $${args.length}${cast}`); };
  const said: string[] = [];
  if ("hypothesis" in patch) { put("hypothesis", str(patch.hypothesis, 2000) ?? ""); said.push("hypothesis"); }
  if ("learning" in patch) { put("learning", str(patch.learning, 4000) ?? ""); said.push("what we learned"); }
  if ("notes" in patch) { put("notes", str(patch.notes, 4000) ?? ""); said.push("notes"); }
  if ("reported" in patch) { put("reported", str(patch.reported, 1000) ?? ""); said.push("the result another tool reported"); }
  if ("owner" in patch) { put("owner", str(patch.owner, 120) || null); said.push("owner"); }
  if ("ice" in patch) { put("ice", JSON.stringify(ice(patch.ice)), "::jsonb"); said.push("score"); }
  if ("decision" in patch) {
    const d = patch.decision === null || patch.decision === "" ? null : DECISIONS.includes(patch.decision as Decision) ? (patch.decision as Decision) : undefined;
    if (d === undefined) throw new ExpError("Which decision?");
    put("decision", d); put("decided_by", d ? by : null); put("decided_at", d ? new Date().toISOString() : null);
    said.push(d ? `decision: ${d}` : "decision taken back");
  }
  if (e.source === "manual") {
    if ("name" in patch) { const n = str(patch.name, 200); if (!n) throw new ExpError("A name, please."); put("name", n); said.push("name"); }
    if ("surface" in patch) { put("surface", str(patch.surface, 300) ?? ""); said.push("where"); }
    if ("host" in patch) { put("host", str(patch.host, 100) || null); }
    if ("metric" in patch) { put("metric", str(patch.metric, 200) ?? ""); said.push("metric"); }
    if ("category" in patch) { if (patch.category !== "page" && patch.category !== "microservice") throw new ExpError("Page or microservice?"); put("category", patch.category); }
    if ("service" in patch) { put("service", str(patch.service, 40) || null); }
    if ("status" in patch) { if (!STATUSES.includes(patch.status as Status)) throw new ExpError("Which status?"); put("status", patch.status); said.push(`status: ${patch.status}`); }
    if ("startedAt" in patch) { put("started_at", dayOrNull(patch.startedAt)); said.push("start"); }
    if ("endedAt" in patch) { put("ended_at", dayOrNull(patch.endedAt)); said.push("end"); }
    if ("arms" in patch) { put("arms", JSON.stringify(arms(patch.arms) ?? []), "::jsonb"); said.push("figures"); }
    if ("changes" in patch) { put("changes", JSON.stringify(Array.isArray(patch.changes) ? patch.changes.map((c) => String(c).slice(0, 200)).slice(0, 20) : []), "::jsonb"); }
  }
  if (!set.length) return e;
  put("updated_by", by); set.push("updated_at = now()");
  await query(`UPDATE apsomh_experiments SET ${set.join(", ")} WHERE key = $1`, args);
  await log(key, by, "changed", said.join(", "));
  return (await experimentByKey(key))!;
}

/** An idea, a planned test, or a past one (another tool's, an earlier one) - typed in. */
export async function createManual(input: Record<string, unknown>, by: string): Promise<Experiment> {
  await ensureExperiments();
  const name = str(input.name, 200);
  if (!name) throw new ExpError("A name, please.");
  const category: Category = input.category === "microservice" ? "microservice" : "page";
  const status: Status = STATUSES.includes(input.status as Status) ? (input.status as Status) : "idea";
  const n = (await query<{ n: string }>(`SELECT nextval('apsomh_experiments_manual') AS n`)).rows[0].n;
  const key = `manual-${n}`;
  await query(
    `INSERT INTO apsomh_experiments (key, source, category, service, host, surface, name, metric, status, started_at, ended_at, arms, hypothesis, ice, owner, created_by, updated_by)
     VALUES ($1, 'manual', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14, $15, $15)`,
    [key, category, category === "microservice" ? str(input.service, 40) || null : null, str(input.host, 100) || null, str(input.surface, 300) ?? "", name,
      str(input.metric, 200) || (category === "page" ? "Put something in the cart, per visitor of the page" : ""), status,
      dayOrNull(input.startedAt), dayOrNull(input.endedAt), JSON.stringify(arms(input.arms) ?? []), str(input.hypothesis, 2000) ?? "",
      JSON.stringify(ice(input.ice)), str(input.owner, 120) || null, by]);
  await log(key, by, "recorded", `${status}: ${name}`);
  return (await experimentByKey(key))!;
}

/** A test typed in by hand can be taken out (kept in the table, hidden); a source's test cannot. */
export async function removeManual(key: string, by: string): Promise<void> {
  const e = await experimentByKey(key);
  if (!e) throw new ExpError("No such test.", 404);
  if (e.source !== "manual") throw new ExpError("Only a test typed in here can be taken out - the others belong to their tool.");
  await query(`UPDATE apsomh_experiments SET gone = true, updated_by = $2, updated_at = now() WHERE key = $1`, [key, by]);
  await log(key, by, "taken out");
}
