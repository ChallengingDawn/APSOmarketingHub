// CHAT STEERING - where the settings live and what the topic tabs show (rules: steeringRules.ts). The master copy is
// the hub's kv "chat:steering"; every save keeps what was there before under "chat:steering:log:<time>". The figures
// come from the hub's own filing of every chat (topics.ts, apsomh_chat_filing: Enquiry Category + sub-categories
// from the whole chat) and, for the hand-overs, the ticket's state in HubSpot now.

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { ownerNames } from "@/lib/integrations/erosion";
import { definitions } from "./topics";
import { NO_REQUEST } from "./shape";
import { DEFAULT_STEERING, STEERING_TOPICS, cleanSteering, routeFor, todayRoute, type Route, type Steering } from "./steeringRules";

const KV = "chat:steering";

export async function getSteering(): Promise<Steering> {
  const s = await kvGet<Steering>(KV).catch(() => undefined);
  return s?.topics ? s : DEFAULT_STEERING;
}

/** HubSpot's sub-category options of each topic (level 1 and 2), read live. */
export async function topicOptions(): Promise<Record<string, { sub1: string[]; sub2: string[] }>> {
  const defs = await definitions();
  return Object.fromEntries(STEERING_TOPICS.map((t) => {
    const d = defs.find((x) => x.value === t);
    return [t, { sub1: d?.sub1?.options ?? [], sub2: d?.sub2?.options ?? [] }];
  }));
}

export async function saveSteering(input: unknown, by: string): Promise<Steering> {
  const prev = await getSteering();
  const next = { ...cleanSteering(input, await topicOptions(), prev), by, at: new Date().toISOString() };
  await kvSet(`${KV}:log:${next.at}`, prev);               // what was there before - the change can be put back
  await kvSet(KV, next);
  figuresCache.clear();
  return next;
}

/* ── the figures ─────────────────────────────────────────────────────────────────────────────────── */

export type SubFigures = { level: 1 | 2; value: string; chats: number; aiAlone: number; tsa: number; bo: number };
export type OpenHandover = { ticketId: string; summary: string; handedAt: string | null; owner: string | null; stage: string | null; today: Route; steering: Route | null };
export type TopicFigures = {
  topic: string; chats: number; aiAlone: number; tsa: number; bo: number;
  /** hand-overs the topic's routes would have sent elsewhere than the chat did */
  elsewhere: number;
  subs: SubFigures[]; open: OpenHandover[]; openTotal: number;
};
export type SteeringData = { steering: Steering; options: Record<string, { sub1: string[]; sub2: string[] }>; topics: TopicFigures[]; noRequest: number; from: string; openRead: boolean };

const figuresCache = new Map<string, { at: number; d: SteeringData }>();
type Row = { category: string; sub1: string | null; sub2: string | null; handed: boolean; team: string | null; ticket_id: string | null; summary: string; last_at: string | null };
type Ticket = { id: string; properties: Record<string, string | null> };

let stagesCache: { at: number; m: Map<string, string> } | null = null;
async function stageNames(): Promise<Map<string, string>> {
  if (stagesCache && Date.now() - stagesCache.at < 60 * 60_000) return stagesCache.m;
  const m = new Map<string, string>();
  const r = await hubspotFetchJson<{ results?: { label: string; stages: { id: string; label: string }[] }[] }>({ path: "/crm/v3/pipelines/tickets" });
  for (const p of r.results ?? []) for (const s of p.stages) m.set(s.id, `${p.label} · ${s.label.trim()}`);
  stagesCache = { at: Date.now(), m };
  return m;
}

/** The handed-over chats' tickets as they are in HubSpot now - the open ones (no close date). 300 at most, newest first. */
async function openTickets(ids: string[]): Promise<Map<string, Ticket> | null> {
  const out = new Map<string, Ticket>();
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const r = await hubspotFetchJson<{ results?: Ticket[] }>({
        path: "/crm/v3/objects/tickets/batch/read", method: "POST",
        body: { inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: ["hs_pipeline", "hs_pipeline_stage", "hubspot_owner_id", "closed_date", "createdate"] },
      });
      for (const t of r.results ?? []) if (!t.properties.closed_date) out.set(String(t.id), t);
    }
    return out;
  } catch (e) {
    console.warn(`[chat-steering] open tickets not read: ${(e as Error).message}`);
    return null;
  }
}

/** channel: "hs" = HubSpot's chat (the shop's bubble and the www chatflow, each with a ticket), "bar" = the search
 *  bar's AI chat (no ticket, no hand-over) - the page's master switch (SARCLA 27.10.2026). */
export type Channel = "hs" | "bar";
export async function steeringData(fromIso: string, channel: Channel = "hs"): Promise<SteeringData> {
  const ck = `${channel}:${fromIso.slice(0, 13)}`;
  const hit = figuresCache.get(ck);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.d;
  const [steering, options] = await Promise.all([getSteering(), topicOptions()]);
  const rows = (await query<Row>(
    `SELECT category, sub1, sub2, handed, team, ticket_id, summary, last_at FROM apsomh_chat_filing
      WHERE source = $2 AND started_at >= $1 ORDER BY last_at DESC NULLS LAST`, [fromIso, channel === "bar" ? "searchbar" : "chat"])).rows;
  const handedIds = [...new Set(rows.filter((r) => r.handed && r.ticket_id && (STEERING_TOPICS as readonly string[]).includes(r.category)).map((r) => String(r.ticket_id)))].slice(0, 300);
  const [open, stages, names] = await Promise.all([
    openTickets(handedIds),
    stageNames().catch(() => new Map<string, string>()),
    ownerNames().catch(() => new Map<string, string>()),
  ]);
  const topics: TopicFigures[] = STEERING_TOPICS.map((topic) => {
    const mine = rows.filter((r) => r.category === topic);
    const count = (list: Row[]) => ({
      chats: list.length, aiAlone: list.filter((r) => !r.handed).length,
      tsa: list.filter((r) => r.handed && todayRoute(r.team) === "tsa").length, bo: list.filter((r) => r.handed && todayRoute(r.team) === "bo").length,
    });
    // the shop bug goes through the Back Office's stage today: E-Commerce counts as the Back Office here
    const same = (a: Route | null, b: Route) => (a === "ecom" ? "bo" : a) === b;
    const subs: SubFigures[] = [
      ...options[topic].sub1.map((value) => ({ level: 1 as const, value, ...count(mine.filter((r) => r.sub1 === value)) })),
      ...options[topic].sub2.map((value) => ({ level: 2 as const, value, ...count(mine.filter((r) => r.sub2 === value)) })),
    ];
    const openList = mine.filter((r) => r.handed && r.ticket_id && open?.has(String(r.ticket_id))).map((r): OpenHandover => {
      const t = open!.get(String(r.ticket_id))!;
      return {
        ticketId: String(r.ticket_id), summary: r.summary, handedAt: t.properties.createdate ?? r.last_at,
        owner: t.properties.hubspot_owner_id ? names.get(t.properties.hubspot_owner_id) ?? t.properties.hubspot_owner_id : null,
        stage: t.properties.hs_pipeline_stage ? stages.get(t.properties.hs_pipeline_stage) ?? t.properties.hs_pipeline_stage : null,
        today: todayRoute(r.team), steering: routeFor(steering, topic, r.sub1, r.sub2),
      };
    });
    return {
      topic, ...count(mine),
      elsewhere: mine.filter((r) => r.handed && !same(routeFor(steering, topic, r.sub1, r.sub2), todayRoute(r.team))).length,
      subs, open: openList.slice(0, 50), openTotal: openList.length,
    };
  });
  const d: SteeringData = { steering, options, topics, noRequest: rows.filter((r) => r.category === NO_REQUEST).length, from: fromIso, openRead: open !== null };
  figuresCache.set(ck, { at: Date.now(), d });
  return d;
}
