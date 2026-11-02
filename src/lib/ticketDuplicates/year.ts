// DUPLICATES & MERGES - the last 365 days (SARCLA 02.11.2026: "we need the last 365 days"). The live check only sees the
// tickets entering Back Office from the day it runs; this builds the year at once, from bulk reads instead of a search per
// ticket:
//   1. every ticket created from 395 days ago to now, in every pipeline (two weeks a search, a page of 100 at a time) -
//      the candidates; those that entered Back Office "New" in the last 365 days are the entries;
//   2. each entry's sender: its first contact (associations, 1000 a call) and the contact's e-mail (100 a call);
//   3. the rules (types.ts) over them, as the live check: the order's tickets and the sender's of the hours before;
//   4. for the same request twice, the first e-mail of both read: the same text = 100% sure (at most 800 pairs a build);
//   5. a row per entry, stored with the live ones (a ticket the live check saw keeps the live row) - marked "backfill":
//      the tickets as they are today, not as they were. What became of it: merged (others merged into it), closed, open.
// Merged-away tickets are gone from HubSpot's search, so a pair merged by people is counted as the ticket that lives on.
// Built once after a deploy (state version), again when asked from the page; one copy at a time (advisory lock 4107237).

import { kvGet, kvSet } from "@/lib/db/init";
import { hubspotRetry } from "@/lib/connectors/steps/hs";
import { ownerNames } from "@/lib/integrations/erosion";
import { extractKeys, fmtKeys } from "./rules";
import type { Row } from "./model";
import { decide, makeSure, sameText, type Cand } from "./types";
import { BO, BO_NEW, PROPS, archivedOwners, firstText, infoOf, locked, toCand, type Raw } from "./reads";
import { day, daysBetween, rowsBetween, saveDay } from "./store";
import type { Settings } from "./engine";

const LOCK = 4_107_237;
const VERSION = 1;
const KV_YEAR = "ticketDup:year";
const DAYS = 365, LEAD_DAYS = 30, SLICE_DAYS = 14;
const MAX_TEXT_PAIRS = 800;

export type YearState = {
  version: number; startedAt: string; at: string | null; done: boolean; step: string;
  tickets: number; entries: number; built: number; twice: number; sure: number;
  /** a rebuild asked from the page */
  asked?: string | null; by?: string | null; error?: string;
};
export const yearState = async () => (await kvGet<YearState>(KV_YEAR)) ?? null;
/** Due: never built in this version, a rebuild asked, or a build that stopped half-way more than 3 hours ago. */
export async function yearDue(): Promise<boolean> {
  const s = await yearState();
  if (!s || s.version !== VERSION || s.asked) return true;
  return !s.done && Date.now() - Date.parse(s.startedAt) > 3 * 3600_000;
}
/** "Build the year again" (Settings): the next run builds it. */
export async function askYear(by: string): Promise<YearState> {
  const s = (await yearState()) ?? { version: VERSION, startedAt: new Date(0).toISOString(), at: null, done: false, step: "asked", tickets: 0, entries: 0, built: 0, twice: 0, sure: 0 };
  const next = { ...s, asked: by };
  await kvSet(KV_YEAR, next);
  return next;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const prop = `hs_v2_date_entered_${BO_NEW}`;

/** Every ticket created between two moments - a page of 100 at a time. */
async function created(fromMs: number, toMs: number): Promise<Raw[]> {
  const out: Raw[] = [];
  let after: string | undefined;
  for (let page = 0; page < 100; page++) {
    const r = await hubspotRetry<{ results?: Raw[]; paging?: { next?: { after?: string } } }>({ path: "/crm/v3/objects/tickets/search", method: "POST", body: {
      filterGroups: [{ filters: [{ propertyName: "createdate", operator: "GTE", value: String(fromMs) }, { propertyName: "createdate", operator: "LT", value: String(toMs) }] }],
      properties: [...PROPS, "hs_merged_object_ids", prop], sorts: [{ propertyName: "createdate", direction: "ASCENDING" }], limit: 100, ...(after ? { after } : {}),
    } });
    out.push(...(r.results ?? []));
    after = r.paging?.next?.after;
    if (!after) break;
    await sleep(250);
  }
  return out;
}

export async function buildYear(settings: Settings): Promise<YearState | null> {
  return locked(LOCK, async () => {
    const now = Date.now();
    const st: YearState = { version: VERSION, startedAt: new Date(now).toISOString(), at: null, done: false, step: "reading the tickets", tickets: 0, entries: 0, built: 0, twice: 0, sure: 0, asked: null, by: (await yearState())?.asked ?? "after a deploy" };
    const save = () => kvSet(KV_YEAR, st);
    await save();
    try {
      // 1. the tickets
      const from = now - (DAYS + LEAD_DAYS) * 86400_000, entryFrom = now - DAYS * 86400_000, until = now - 20 * 60_000;
      const all: Raw[] = [];
      for (let t = from; t < until; t += SLICE_DAYS * 86400_000) {
        all.push(...(await created(t, Math.min(until, t + SLICE_DAYS * 86400_000))));
        st.tickets = all.length;
        await save();
      }
      const cand = new Map<string, Cand>(all.map((r) => [String(r.id), toCand(r)]));
      const raw = new Map(all.map((r) => [String(r.id), r]));
      const entries = all.filter((r) => { const e = Date.parse(r.properties[prop] ?? ""); return e >= entryFrom && e <= until; });
      st.entries = entries.length; st.step = "reading the senders"; await save();

      // 2. the senders
      const firstContact = new Map<string, string>();
      for (let i = 0; i < entries.length; i += 1000) {
        const r = await hubspotRetry<{ results?: { from: { id: string }; to?: { toObjectId: string | number }[] }[] }>({ path: "/crm/v4/associations/tickets/contacts/batch/read", method: "POST", body: { inputs: entries.slice(i, i + 1000).map((x) => ({ id: String(x.id) })) } });
        for (const x of r.results ?? []) if (x.to?.[0]) firstContact.set(String(x.from.id), String(x.to[0].toObjectId));
        await sleep(250);
      }
      const contactIds = [...new Set(firstContact.values())];
      const contact = new Map<string, { domain: string | null; name: string | null }>();
      for (let i = 0; i < contactIds.length; i += 100) {
        const r = await hubspotRetry<{ results?: Raw[] }>({ path: "/crm/v3/objects/contacts/batch/read", method: "POST", body: { inputs: contactIds.slice(i, i + 100).map((id) => ({ id })), properties: ["email", "firstname", "lastname"] } });
        for (const c of r.results ?? []) {
          const email = String(c.properties.email ?? "");
          contact.set(String(c.id), { domain: email.includes("@") ? email.split("@").pop()!.toLowerCase() : null, name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(" ") || null });
        }
        await sleep(200);
      }

      // 3. the rules: the order's tickets (by core), the sender's (entries by contact)
      st.step = "checking the tickets"; await save();
      const byCore = new Map<string, Cand[]>();
      for (const c of cand.values()) for (const k of new Set([...extractKeys(c.subject), ...extractKeys(c.orderNumber)].map((x) => x.core))) (byCore.get(k) ?? byCore.set(k, []).get(k)!).push(c);
      const byContact = new Map<string, Cand[]>();
      for (const e of entries) { const c = firstContact.get(String(e.id)); if (c) (byContact.get(c) ?? byContact.set(c, []).get(c)!).push(cand.get(String(e.id))!); }
      const [archived, names] = await Promise.all([archivedOwners(), ownerNames()]);
      const types = settings.types;
      const live = new Set((await rowsBetween(day(new Date(entryFrom).toISOString()), day(new Date(now).toISOString()))).filter((r) => !r.backfill).map((r) => r.key));
      const byDay = new Map<string, Row[]>();
      let pairs = 0;
      for (const e of entries) {
        const id = String(e.id), enteredAt = new Date(Date.parse(e.properties[prop]!)).toISOString();
        const key = `${id}:${enteredAt}`;
        if (live.has(key)) continue;
        // as it was when it entered Back Office: compared within Back Office
        const me = { ...cand.get(id)!, pipeline: BO };
        const cid = firstContact.get(id);
        const sender = cid ? { id: cid, ...(contact.get(cid) ?? { domain: null, name: null }) } : null;
        const near = new Map<string, Cand>();
        for (const k of new Set([...extractKeys(me.subject), ...extractKeys(me.orderNumber)].map((x) => x.core))) for (const c of byCore.get(k) ?? []) near.set(c.id, c);
        const mine = Date.parse(me.createdate ?? enteredAt);
        if (cid) for (const c of byContact.get(cid) ?? []) {
          const t = Date.parse(c.createdate ?? "");
          if (t <= mine && mine - t <= types.twice.withinHours * 3600_000) near.set(c.id, { ...(near.get(c.id) ?? c), sameSender: true });
        }
        let v = decide({ ...me, sender }, [...near.values()], types, archived, (o) => names.get(o) ?? o);
        if (v.type === "twice") {
          st.twice++;
          if (pairs < MAX_TEXT_PAIRS) {
            pairs++;
            const [a, b] = await Promise.all([firstText(e.properties.hs_conversations_originating_thread_id).catch(() => ""), firstText(raw.get(v.of[0])?.properties.hs_conversations_originating_thread_id).catch(() => "")]);
            if (sameText(a, b)) { v = makeSure(v, sender?.domain ?? null); st.sure++; }
          }
        }
        const mergedIn = String(e.properties.hs_merged_object_ids ?? "").split(";").map((x) => x.trim()).filter((x) => x && x !== id);
        const row: Row = {
          key, ticketId: id, enteredAt, seenAt: new Date().toISOString(), subject: me.subject.slice(0, 200), orderNumber: me.orderNumber,
          keys: fmtKeys([...extractKeys(me.subject), ...extractKeys(me.orderNumber)]), pipeline: me.pipeline, sender: sender?.domain ?? null,
          ownerNames: {}, ownerAtCheck: me.owner, v, dups: infoOf(v, cand), backfill: true,
          ...(mergedIn.length ? { mergedIn } : {}),
          merge: { state: mergedIn.length ? "merged" : me.closed ? "closed" : "open", checkedAt: new Date().toISOString(), checks: 1, final: true },
        };
        for (const o of [v.ownerChange?.ownerId, me.owner, ...Object.values(row.dups ?? {}).map((d) => d.owner)]) if (o) row.ownerNames[o] = names.get(o) ?? o;
        (byDay.get(day(enteredAt)) ?? byDay.set(day(enteredAt), []).get(day(enteredAt))!).push(row);
        st.built++;
        if (st.built % 500 === 0) await save();
      }

      // 5. stored beside the live rows: a day keeps its live rows, its year rows are replaced
      st.step = "saving"; await save();
      const stored = new Map((await rowsBetween(day(new Date(entryFrom).toISOString()), day(new Date(now).toISOString()))).map((r) => [r.key, r]));
      for (const d of daysBetween(day(new Date(entryFrom).toISOString()), day(new Date(now).toISOString()))) {
        const mine = byDay.get(d) ?? [];
        const keep = [...stored.values()].filter((r) => day(r.enteredAt) === d && !r.backfill);
        if (!mine.length && !keep.length) continue;
        await saveDay(d, [...keep, ...mine.filter((r) => !keep.some((k) => k.key === r.key))]);
      }
      st.done = true; st.at = new Date().toISOString(); st.step = "done";
      await save();
      console.log(`[ticket-duplicates] year built: ${st.tickets} tickets read, ${st.entries} entries, ${st.built} rows, ${st.twice} twice (${st.sure} 100% sure)`);
      return st;
    } catch (e) {
      st.error = (e as Error).message.slice(0, 300); st.step = "stopped";
      await save();
      throw e;
    }
  });
}
