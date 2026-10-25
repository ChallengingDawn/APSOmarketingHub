// MAP ASSIGNMENT - the differences by topic, from the database: ONE read of the differing companies (about 10,000 at
// most), classified in JS by topics.ts (pure, tested); the OK answers in kv "mapAssign:topicsOk" -> {[topic]: {at, by,
// companies}}. Used by GET ?topics=1 and PUT {topicOk} (src/app/api/uc/map-assignment/route.ts).

import { query } from "@/lib/db/client";
import { kvGet, kvSet } from "@/lib/db/init";
import { NO_COUNTRY, ensureMapAssign, lastRun } from "./engine";
import { buildTopics, cleanOks, topicCounts, type TopicId, type TopicRow, type TopicsData } from "./topics";

const KV_OK = "mapAssign:topicsOk";

type DbRow = {
  company_id: string; name: string | null; country: string | null; zip: string | null; sae: string | null;
  owner_now: string | null; region_now: string | null; owner_decided: string; via: string; flags: string[] | null;
  contacts_off: number | null; revenue: number | null;
};

/** Every company that differs from the rules, as the engine's Differences count them (also what a Fix picks from). */
export async function differingRows(): Promise<TopicRow[]> {
  await ensureMapAssign();
  // revenue only to pick telling examples: this year's, as the map's layers read it (a row read before New Year holds last year's)
  const r = await query<DbRow>(
    `SELECT company_id, name, country, zip, sae, owner_now, region_now, owner_decided, via, flags, contacts_off,
       CASE WHEN revenue_year = EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Europe/Zurich'))::int THEN revenue_cy END AS revenue
     FROM apsomh_map_assign
     WHERE owner_now IS DISTINCT FROM owner_decided OR region_now IS DISTINCT FROM owner_decided OR contacts_off > 0`,
  );
  return r.rows.map((x) => ({
    id: String(x.company_id), name: x.name, country: x.country, zip: x.zip, sae: x.sae,
    ownerNow: x.owner_now === null ? null : String(x.owner_now), regionNow: x.region_now === null ? null : String(x.region_now),
    decided: String(x.owner_decided), via: String(x.via ?? ""), flags: Array.isArray(x.flags) ? x.flags : [],
    contactsOff: x.contacts_off === null ? null : Number(x.contacts_off),
    revenue: x.revenue === null ? null : Number(x.revenue),
  }));
}

export async function topicOks() {
  return cleanOks(await kvGet<unknown>(KV_OK));
}

/** GET ?topics=1[&country=CC]: the topics in one country ("??" = no country) or in all (null). */
export async function topicsData(country: string | null): Promise<TopicsData> {
  const rows = await differingRows();
  const last = await lastRun();
  return buildTopics(rows, { country: country === NO_COUNTRY ? NO_COUNTRY : country, oks: await topicOks(), at: last?.at ?? null });
}

/** PUT {topicOk}: an OK for the topic as it is now (its companies in every country kept with it), or taken back. */
export async function answerTopic(topic: TopicId, ok: boolean, by: string): Promise<void> {
  const all = await topicOks();
  if (ok) {
    const counts = topicCounts(await differingRows());
    all[topic] = { at: new Date().toISOString(), by, companies: counts[topic] ?? 0 };
  } else {
    delete all[topic];
  }
  await kvSet(KV_OK, all);
}
