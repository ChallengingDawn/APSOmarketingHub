// SMART SUB-TICKET - THE CREATE FORM: the draft (kv), HubSpot's catalogue, publishing to HubDB. The design itself -
// types, BUILT_IN, the checks - is in formDesign.ts.

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { BUILT_IN, GQS_LOCKED, SECTIONS, problems, type Catalog, type Field, type Section, type SmartForm } from "./formDesign";

export * from "./formDesign";

/* ── what HubSpot has, to check the design against ─────────────────────── */

const hs = <T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: unknown) => hubspotRetry<T>({ path, method: method as "GET" | "POST" | "PATCH" | "PUT", body });

let catalogCache: { at: number; c: Catalog } | null = null;
export async function catalog(): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < 10 * 60_000) return catalogCache.c;
  const [props, pipes, owners] = await Promise.all([
    hs<{ results?: { name: string; label: string; type: string; fieldType: string; hidden?: boolean; options?: { value: string }[] }[] }>("/crm/v3/properties/tickets"),
    hs<{ results?: { id: string; label: string; stages?: { id: string; label: string }[] }[] }>("/crm/v3/pipelines/tickets"),
    ownerNames().catch(() => new Map<string, string>()),
  ]);
  const c: Catalog = {
    properties: (props.results ?? []).filter((p) => !p.hidden).map((p) => ({ name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, options: (p.options ?? []).map((o) => o.value) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    pipelines: (pipes.results ?? []).map((p) => ({ id: p.id, label: p.label, stages: (p.stages ?? []).map((s) => ({ id: s.id, label: s.label })) })),
    owners: [...owners].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
  catalogCache = { at: Date.now(), c };
  return c;
}

/* ── the draft, the published design, HubDB ────────────────────────────── */

const KV = { draft: "smartTickets:form:draft", published: "smartTickets:form:published", history: "smartTickets:form:history" };
export const HUBDB_TABLE = "apsomh_smart_ticket_form";
export type Published = { version: number; at: string; by: string; form: SmartForm } | null;

export async function getDraft(): Promise<SmartForm> {
  const d = await kvGet<SmartForm>(KV.draft);
  if (d) return d;
  const p = await kvGet<Published>(KV.published);
  return structuredClone(p?.form ?? BUILT_IN);
}
export const getPublished = async (): Promise<Published> => (await kvGet<Published>(KV.published)) ?? null;

/** One piece of the draft changed: a section, or one form of gqsForms / pmForms. */
export async function saveDraftPiece(section: Section, key: string | null, value: unknown): Promise<SmartForm> {
  if (!SECTIONS.includes(section)) throw new Error(`unknown section ${section}`);
  const d = await getDraft();
  if (section === "gqsForms" || section === "pmForms") {
    if (!key) throw new Error("which form?");
    const forms = { ...(d[section] as Record<string, Field[]>) };
    if (value === null) delete forms[key];
    else forms[key] = (value as Field[]).map(clean);
    (d as Record<string, unknown>)[section] = forms;
  } else {
    (d as Record<string, unknown>)[section] = value;
  }
  await kvSet(KV.draft, d);
  return d;
}
const clean = (x: Field): Field => ({
  f: String(x.f ?? "").trim(), l: String(x.l ?? "").trim(), t: x.t,
  ...(x.t === "select" ? { opts: (x.opts ?? []).map((o) => String(o).trim()).filter(Boolean) } : {}),
  ...(x.req || GQS_LOCKED.includes(String(x.f)) ? { req: true } : {}),
  ...(x.autofill === "customer" ? { autofill: "customer" as const } : {}),
});

export async function discardDraft(): Promise<void> { await kvSet(KV.draft, null); }
export async function draftToBuiltIn(): Promise<void> { await kvSet(KV.draft, structuredClone(BUILT_IN)); }

type HubdbRow = { id: string; values?: { section?: string; json?: string } };
async function tableExists(): Promise<boolean> {
  try { await hs(`/cms/v3/hubdb/tables/${HUBDB_TABLE}/draft`); return true; } catch { return false; }
}

/** Validate the draft and write it to HubDB (one row per section), then publish the table. */
export async function publishDraft(by: string): Promise<{ ok: boolean; problems: string[]; version?: number }> {
  const d = await getDraft();
  const issues = problems(d, await catalog());
  if (issues.length) return { ok: false, problems: issues };
  if (!(await tableExists())) {
    await hs("/cms/v3/hubdb/tables", "POST", {
      name: HUBDB_TABLE, label: "APSOhub - Smart Sub-Ticket form", useForPages: false, allowPublicApiAccess: false,
      columns: [{ name: "section", label: "Section", type: "TEXT" }, { name: "json", label: "JSON", type: "TEXT" }],
    });
  }
  const prev = await getPublished();
  const version = (prev?.version ?? 0) + 1;
  const at = new Date().toISOString();
  const rows = [...SECTIONS.map((s) => ({ section: s, json: JSON.stringify(d[s]) })), { section: "meta", json: JSON.stringify({ version, at, by }) }];
  const existing = await hs<{ results?: HubdbRow[] }>(`/cms/v3/hubdb/tables/${HUBDB_TABLE}/rows/draft?limit=100`);
  const ids = (existing.results ?? []).map((r) => r.id);
  if (ids.length) await hs(`/cms/v3/hubdb/tables/${HUBDB_TABLE}/rows/draft/batch/purge`, "POST", { inputs: ids });
  await hs(`/cms/v3/hubdb/tables/${HUBDB_TABLE}/rows/draft/batch/create`, "POST", { inputs: rows.map((values) => ({ values })) });
  await hs(`/cms/v3/hubdb/tables/${HUBDB_TABLE}/draft/publish`, "POST");
  const pub: Published = { version, at, by, form: d };
  await kvSet(KV.published, pub);
  const hist = (await kvGet<NonNullable<Published>[]>(KV.history)) ?? [];
  await kvSet(KV.history, [pub!, ...hist].slice(0, 10));
  await kvSet(KV.draft, null);
  return { ok: true, problems: [], version };
}

export async function history(): Promise<{ version: number; at: string; by: string }[]> {
  return ((await kvGet<NonNullable<Published>[]>(KV.history)) ?? []).map((h) => ({ version: h.version, at: h.at, by: h.by }));
}

