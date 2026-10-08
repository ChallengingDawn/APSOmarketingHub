// THE FILE STEPS, moved from the Compass connector into the hub - the loaders for the
// files the ERP and the shop leave on the SFTP folder (../sftp.ts pulls them):
//   magentoStamp          export.xml        web orders get their A-number, the buyer, the buyer's company
//   customerAgents        dim_customer.csv  the sales agent and the SAE on the company
//   articleLoad           dim_article.csv   the article master into Products & Pricing, update only
//   articleCreateMissing  dim_article.csv   shop-standard articles HubSpot lacks - by hand only
// Each runs as a PREVIEW (reads, reports what it would write, writes nothing) or LIVE.
// Rules in ./filesRules.ts, tested; this file is the I/O, ported from
// service/magento_ingest.py, customer_load.py and article_load.py.

import { createReadStream } from "node:fs";
import { query } from "@/lib/db/client";
import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { IntegrationError } from "@/lib/integrations/status";
import type { StepResult } from "./companyFacts";
import {
  BestArticles, ENUM_MAP, MagentoExportParser, PP_OBJECT, PP_PROPS, PyCsvReader,
  agentColumns, agentDecision, agentIndex, agentRow, articleKeys, domainProves, enumValue, matchArticle,
  payloadFor, payloadHash, pyStrip, sameAsCurrent, stampName, topUnknown, withKnownOptions,
  type AgentSource, type MagentoExport,
} from "./filesRules";

type Beat = () => Promise<void>;
type Props = Record<string, string | null | undefined>;
type Obj = { id: string; properties?: Props };
type Page = { results?: Obj[]; total?: number; paging?: { next?: { after?: string } } };
type Req = Parameters<typeof hubspotFetchJson>[0];
type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };
type BatchOut = { results?: { id: string | number }[]; numErrors?: number; errors?: { message?: string; context?: { ids?: string[] } }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown): string => String((e as Error)?.message ?? e).slice(0, 200);
const status = (e: unknown): number | null => (e instanceof IntegrationError ? e.status : null);

/**
 * hubspotFetchJson, tried again when a second try can help: a dropped connection, a 5xx,
 * a 429 that outlasted hubspotFetchJson's own waits. A 4xx (and a missing token) is an
 * answer, not an accident, and is thrown at once. `tries: 1` for writes that must not repeat.
 */
async function hs<T>(req: Req, tries = 5): Promise<T> {
  for (let a = 1; ; a++) {
    try {
      return await hubspotFetchJson<T>(req);
    } catch (e) {
      const st = status(e);
      const again = !(e instanceof IntegrationError) || st === 429 || (st !== null && st >= 500);
      if (!again || a >= tries) throw e;
      await sleep(1500 * 2 ** (a - 1));
    }
  }
}

/** Every match of a search, by an id cursor - HubSpot's search stops at 10,000 results. */
async function searchAll(obj: string, filters: Filter[], properties: string[]): Promise<Obj[]> {
  const out: Obj[] = [];
  let cursor = "0";
  for (;;) {
    const j = await hs<Page>({
      path: `/crm/v3/objects/${obj}/search`, method: "POST",
      body: {
        limit: 100, properties, sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        filterGroups: [{ filters: [...filters, { propertyName: "hs_object_id", operator: "GT", value: cursor }] }],
      },
    });
    const res = j.results ?? [];
    if (!res.length) return out;
    out.push(...res);
    cursor = res[res.length - 1].id;
  }
}

const searchOne = async (obj: string, filter: Filter, properties: string[] = []): Promise<Obj | null> => {
  const j = await hs<Page>({ path: `/crm/v3/objects/${obj}/search`, method: "POST", body: { filterGroups: [{ filters: [filter] }], properties, limit: 1 } });
  return j.results?.[0] ?? null;
};

/** Batch update, 100 at a time; a failing batch is counted and the rest still go. */
async function batchUpdate(obj: string, rows: { id: string; properties: Record<string, string> }[]): Promise<{ written: number; failed: number; errors: string[] }> {
  let written = 0, failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    try {
      const j = await hs<BatchOut>({ path: `/crm/v3/objects/${obj}/batch/update`, method: "POST", body: { inputs: chunk } });
      const bad = Number(j.numErrors ?? 0);
      written += chunk.length - bad;
      failed += bad;
      if (bad && errors.length < 3) errors.push(String(j.errors?.[0]?.message ?? "partial failure").slice(0, 160));
    } catch (e) {
      failed += chunk.length;
      if (errors.length < 3) errors.push(msg(e));
    }
  }
  return { written, failed, errors };
}

/** Every row of a ';' CSV as Python's csv.reader gives it, streamed (dim_article is ~300 MB). */
async function eachCsvRow(file: string, fatal: boolean, beat: Beat, onRow: (r: string[]) => void): Promise<void> {
  // utf-8-sig: TextDecoder drops the BOM; fatal = strict decoding, else U+FFFD (errors="replace")
  const dec = new TextDecoder("utf-8", { fatal });
  const csv = new PyCsvReader(";");
  const rows: string[][] = [];
  const flush = () => { for (const r of rows) onRow(r); rows.length = 0; };
  let bytes = 0, next = 64 << 20;
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    csv.push(dec.decode(chunk as Buffer, { stream: true }), rows);
    flush();
    bytes += (chunk as Buffer).length;
    if (bytes >= next) { next += 64 << 20; await beat(); }
  }
  csv.push(dec.decode(), rows);
  csv.end(rows);
  flush();
}

/* ── web orders get their A-number (export.xml) ────────────────────────── */

/** The encoding an XML file declares (a BOM first, then <?xml ... encoding="..."?>), as a TextDecoder label. */
function xmlEncoding(head: Buffer): string {
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return "utf-8";
  if (head[0] === 0xff && head[1] === 0xfe) return "utf-16le";
  if (head[0] === 0xfe && head[1] === 0xff) return "utf-16be";
  const decl = /^<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head.subarray(0, 300).toString("latin1"));
  return decl ? decl[1].toLowerCase() : "utf-8";
}

export async function readMagentoExport(file: string): Promise<MagentoExport> {
  const p = new MagentoExportParser();
  let dec: TextDecoder | null = null;
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    dec ??= new TextDecoder(xmlEncoding(chunk as Buffer), { fatal: true });
    p.write(dec.decode(chunk as Buffer, { stream: true }));
  }
  if (dec) p.write(dec.decode());
  return p.close();
}

/** The orders carrying each A-number: {A-number: [order ids]}. */
async function ordersByNumber(nums: string[], beat: Beat): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < nums.length; i += 100) {
    for (const o of await searchAll("orders", [{ propertyName: "order_order_number", operator: "IN", values: nums.slice(i, i + 100) }], ["order_order_number"])) {
      const n = pyStrip(o.properties?.order_order_number ?? "");
      const list = out.get(n);
      if (list) list.push(o.id); else out.set(n, [o.id]);
    }
    if ((i / 100) % 10 === 9) await beat();
  }
  return out;
}

/** The companies a contact is associated with (every page). */
async function contactCompanies(cid: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  for (;;) {
    const j = await hs<{ results?: { toObjectId: string | number }[]; paging?: { next?: { after?: string } } }>({
      path: `/crm/v4/objects/contacts/${cid}/associations/companies?limit=500${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    ids.push(...(j.results ?? []).map((t) => String(t.toObjectId)));
    after = j.paging?.next?.after;
    if (!after) return ids;
  }
}

/**
 * Shop orders the ERP has taken over (Status Transferred in the Magento export) get their
 * A-number: every order in order_reconcile_state=web_provisional whose
 * hs_external_order_id is a row of the export is stamped (order_order_number,
 * hs_order_name "A# | Company", erp_linked), linked to the existing contact with the
 * row's email, and that contact's company is corrected when the email domain proves it.
 *
 * FIX against the connector: an A-number already on another order is not stamped a
 * second time (reported for a merge); the true company is linked FIRST and the wrong
 * ones removed only when that worked - the connector deleted first, unchecked, and could
 * leave a contact with no company; dropped connections and 5xx are retried.
 */
export async function magentoStamp(live: boolean, beat: Beat, opts: { file: string }): Promise<StepResult> {
  const t0 = Date.now();
  const exp = await readMagentoExport(opts.file);
  const n = {
    export_rows: exp.orders.size, provisionals: 0, stamped: 0, contacts_associated: 0,
    company_mismatch_fixed: 0, company_mismatch_flagged: 0,
    // the connector's name: provisional orders the export has no Transferred row for
    skipped_no_provisional: 0,
    skipped_a_number_taken: 0, stamp_failed: 0, contact_not_found: 0, contact_assoc_failed: 0,
    company_not_found: 0, company_fix_failed: 0, company_fix_partial: 0, lookup_failed: 0,
  };
  const out: StepResult = {};
  if (!exp.columns.has("email")) {
    // Loud on purpose: without the column no contact can be linked, and the run would
    // otherwise look green. Switch "Customer Email" on in the admin grid and export again.
    out.WARNING = "the export has no Customer Email column, so NO contact can be associated - switch it on in the admin grid and export again";
    out.columns_found = [...exp.columns].sort();
  }
  const provs = await searchAll("orders", [{ propertyName: "order_reconcile_state", operator: "EQ", value: "web_provisional" }], ["hs_external_order_id", "order_customer_name"]);
  n.provisionals = provs.length;
  await beat();
  const cands = provs.flatMap((o) => {
    const inc = o.properties?.hs_external_order_id;
    const hit = inc != null ? exp.orders.get(inc) : undefined;
    if (!hit) { n.skipped_no_provisional += 1; return []; }
    return [{ o, inc: inc!, hit }];
  });
  const holders = await ordersByNumber([...new Set(cands.map((c) => c.hit.apo))], beat);
  const claimed = new Map<string, string>();
  const examples: Record<string, unknown>[] = [], taken: unknown[] = [], flagged: unknown[] = [], errors: string[] = [];
  let k = 0;
  for (const { o, inc, hit } of cands) {
    if (++k % 20 === 0) await beat();
    const { apo, apc, email, comp } = hit;
    const others = (holders.get(apo) ?? []).filter((id) => id !== o.id);
    const mine = claimed.get(apo);
    if (others.length || (mine && mine !== o.id)) {
      n.skipped_a_number_taken += 1;
      if (taken.length < 10) taken.push({ order: o.id, inc, a_number: apo, already_on: others.length ? others : [mine] });
      continue;
    }
    claimed.set(apo, o.id);
    const name = stampName(apo, comp, o.properties?.order_customer_name);
    if (live) {
      try {
        await hs({ path: `/crm/v3/objects/orders/${o.id}`, method: "PATCH", body: { properties: { order_order_number: apo, hs_order_name: name, order_reconcile_state: "erp_linked" } } });
      } catch (e) {
        n.stamp_failed += 1;
        if (errors.length < 5) errors.push(`stamp ${o.id}: ${msg(e)}`);
        continue;
      }
    }
    n.stamped += 1;
    const ex: Record<string, unknown> = { order: o.id, inc, a_number: apo, name };
    if (examples.length < 10) examples.push(ex);
    if (!email) continue;
    // 2nd pass: the buyer and the buyer's company - a lookup that fails skips this order's pass, not the run
    try {
      const contact = await searchOne("contacts", { propertyName: "email", operator: "EQ", value: email });
      if (!contact) { n.contact_not_found += 1; continue; }
      const cid = contact.id;
      ex.contact = cid;
      if (live) {
        try {
          await hs({ path: `/crm/v4/objects/orders/${o.id}/associations/default/contacts/${cid}`, method: "PUT" });
          n.contacts_associated += 1;
        } catch (e) {
          n.contact_assoc_failed += 1;
          if (errors.length < 5) errors.push(`order ${o.id} -> contact ${cid}: ${msg(e)}`);
        }
      } else n.contacts_associated += 1;
      if (!apc) continue;
      const company = await searchOne("companies", { propertyName: "erp_customer_id", operator: "EQ", value: apc }, ["name"]);
      if (!company) { n.company_not_found += 1; continue; }
      const trueId = String(company.id), trueName = company.properties?.name ?? "";
      const curr = await contactCompanies(cid);
      if (!curr.length || curr.includes(trueId)) continue;
      if (!domainProves(email, trueName)) {
        n.company_mismatch_flagged += 1;
        if (flagged.length < 10) flagged.push({ contact: cid, email_domain: email.split("@").pop(), erp_company: trueId, erp_company_name: trueName, linked_to: curr });
        continue;
      }
      ex.company_fix = { contact: cid, from: curr, to: trueId };
      if (live) {
        // the true company first (279 + Primary 1); the wrong links go only once it stands
        try {
          const j = await hs<BatchOut>({
            path: "/crm/v4/associations/contacts/companies/batch/create", method: "POST",
            body: { inputs: [{ from: { id: cid }, to: { id: trueId }, types: [
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 },
              { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
            ] }] },
          });
          if (Number(j.numErrors ?? 0) > 0) throw new Error(String(j.errors?.[0]?.message ?? "association not created"));
        } catch (e) {
          n.company_fix_failed += 1;
          if (errors.length < 5) errors.push(`contact ${cid} -> company ${trueId}: ${msg(e)}`);
          continue;
        }
        try {
          await hs({ path: "/crm/v4/associations/contacts/companies/batch/archive", method: "POST", body: { inputs: [{ from: { id: cid }, to: curr.map((id) => ({ id })) }] } });
        } catch (e) {
          // the contact keeps the old links beside the true (primary) one - nothing lost
          n.company_fix_partial += 1;
          if (errors.length < 5) errors.push(`contact ${cid}: old company links not removed: ${msg(e)}`);
        }
      }
      n.company_mismatch_fixed += 1;
    } catch (e) {
      n.lookup_failed += 1;
      if (errors.length < 5) errors.push(`order ${o.id} 2nd pass: ${msg(e)}`);
    }
  }
  return {
    ...n, ...out, examples,
    ...(taken.length ? { a_number_taken: taken } : {}),
    ...(flagged.length ? { flagged } : {}),
    ...(errors.length ? { errors } : {}),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

/* ── the sales agent from the ERP (dim_customer.csv) ───────────────────── */

/**
 * Each company's sa__sales_agent and sae_performis from dim_customer (key:
 * CustomerNumberUnique = company_unique_number). The agent is one of the dropdown's
 * existing options, matched by its set of name words; a name with no option is reported,
 * never invented; an empty or junk SA ('.', 'Unknown', 'Sales-Support', ...) never clears.
 * Unlike the connector, every company carrying the key is updated (it took one at random).
 */
export async function customerAgents(live: boolean, beat: Beat, opts: { file: string }): Promise<StepResult> {
  const t0 = Date.now();
  const st: { header?: string[]; cols?: ReturnType<typeof agentColumns>; rows: number } = { rows: 0 };
  const src = new Map<string, AgentSource>();
  await eachCsvRow(opts.file, true, beat, (r) => {
    if (!st.header) { st.header = r; st.cols = agentColumns(r); return; }
    st.rows += 1;
    if (!st.cols) return;
    const e = agentRow(r, st.cols);
    if (e) src.set(e[0], e[1]);
  });
  if (!st.header) return { rows: 0 };
  if (!st.cols) throw new Error("dim_customer without SA/CustomerNumberUnique columns");
  if (!src.size) return { rows: 0 };
  const def = await hs<{ options?: { value: string }[] }>({ path: "/crm/v3/properties/companies/sa__sales_agent" });
  const index = agentIndex((def.options ?? []).map((o) => o.value));
  const uns = [...src.keys()].sort();
  const comp = new Map<string, Obj[]>();
  for (let i = 0; i < uns.length; i += 100) {
    const res = await searchAll("companies", [{ propertyName: "company_unique_number", operator: "IN", values: uns.slice(i, i + 100) }], ["company_unique_number", "sa__sales_agent", "sae_performis"]);
    for (const c of res) {
      const key = c.properties?.company_unique_number;
      if (key == null) continue;
      const list = comp.get(key);
      if (list) list.push(c); else comp.set(key, [c]);
    }
    if ((i / 100) % 20 === 19) await beat();
  }
  const inputs: { id: string; properties: Record<string, string> }[] = [];
  const unknown = new Map<string, number>();
  const examples: unknown[] = [];
  let junk = 0, dupKeys = 0, companies = 0;
  for (const [un, s] of src) {
    const cs = comp.get(un);
    if (!cs?.length) continue;
    if (cs.length > 1) dupKeys += 1;
    companies += cs.length;
    cs.forEach((c, j) => {
      const p = c.properties ?? {};
      const d = agentDecision(s, { sa: p.sa__sales_agent, sae: p.sae_performis }, index);
      if (j === 0) {
        if (d.junk) junk += 1;
        if (d.unknown !== null) unknown.set(d.unknown, (unknown.get(d.unknown) ?? 0) + 1);
      }
      if (!Object.keys(d.props).length) return;
      inputs.push({ id: c.id, properties: d.props });
      if (examples.length < 10) examples.push({ company: c.id, key: un, was: { sa__sales_agent: p.sa__sales_agent ?? "", sae_performis: p.sae_performis ?? "" }, now: d.props });
    });
  }
  const out: StepResult = {
    rows: st.rows, matched: [...src.keys()].filter((u) => comp.has(u)).length, companies, planned: inputs.length,
    junk_skipped: junk, unknown_agent_names: topUnknown(unknown), duplicate_keys: dupKeys,
    ...(st.cols.sae === null ? { note: "no SAE column - sae_performis left as it is" } : {}),
    examples,
  };
  if (live && inputs.length) Object.assign(out, await batchUpdate("companies", inputs));
  return { ...out, seconds: Math.round((Date.now() - t0) / 1000) };
}

/* ── the article master into Products & Pricing (dim_article.csv) ──────── */

const HASH_TABLE = "apsomh_cx_article_hash";
let hashTable: Promise<void> | null = null;

/** The change cache: the payload last written to each P&P record. Created on first use. */
function ensureHashTable(): Promise<void> {
  hashTable ??= query(
    `CREATE TABLE IF NOT EXISTS ${HASH_TABLE} (
       pp_id      text PRIMARY KEY,
       hash       text NOT NULL,
       article    text,
       updated_at timestamptz NOT NULL DEFAULT now()
     )`,
  ).then(() => undefined).catch((e) => { hashTable = null; throw e; });
  return hashTable;
}

async function loadHashes(): Promise<Map<string, string>> {
  await ensureHashTable();
  const r = await query<{ pp_id: string; hash: string }>(`SELECT pp_id, hash FROM ${HASH_TABLE}`);
  return new Map(r.rows.map((x) => [x.pp_id, x.hash]));
}

async function saveHashes(rows: { id: string; hash: string; art: string }[]): Promise<void> {
  if (!rows.length) return;
  await ensureHashTable();
  await query(
    `INSERT INTO ${HASH_TABLE} (pp_id, hash, article)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
     ON CONFLICT (pp_id) DO UPDATE SET hash = EXCLUDED.hash, article = EXCLUDED.article, updated_at = now()`,
    [rows.map((r) => r.id), rows.map((r) => r.hash), rows.map((r) => r.art)],
  );
}

/** Every Products & Pricing record, page by page. */
async function listPP(props: string[], beat: Beat, each: (o: Obj) => void): Promise<number> {
  let after: string | undefined;
  let seen = 0, pages = 0;
  for (;;) {
    const j = await hs<Page>({ path: `/crm/v3/objects/${PP_OBJECT}?limit=100&archived=false&properties=${props.join(",")}${after ? `&after=${encodeURIComponent(after)}` : ""}` });
    for (const o of j.results ?? []) { each(o); seen += 1; }
    after = j.paging?.next?.after;
    if (++pages % 50 === 0) await beat();
    if (!after) return seen;
  }
}

type OptionDef = { label?: string; value: string; displayOrder?: number; hidden?: boolean };

/**
 * The enum options of the properties a payload writes, and the values the file needs that
 * are not among them. Adding them takes crm.schemas.custom.write - only with addOptions,
 * only live; otherwise the unknown values are left out of the payload (one unknown option
 * fails HubSpot's whole batch of 100).
 */
async function enumOptions(want: Map<string, Set<string>>, add: boolean): Promise<{ options: Map<string, Set<string>>; missing: Record<string, string[]>; added: Record<string, string[]>; error?: string }> {
  const options = new Map<string, Set<string>>();
  const missing: Record<string, string[]> = {}, added: Record<string, string[]> = {};
  let error: string | undefined;
  for (const prop of Object.values(ENUM_MAP)) {
    let cur: OptionDef[];
    try {
      cur = (await hs<{ options?: OptionDef[] }>({ path: `/crm/v3/properties/${PP_OBJECT}/${prop}` })).options ?? [];
    } catch (e) {
      if (status(e) === 404) continue; // no such property here: the connector skipped it too
      throw e;
    }
    const have = new Set(cur.map((o) => o.value));
    const need = [...(want.get(prop) ?? [])].filter((v) => !have.has(v)).sort();
    if (need.length && add) {
      try {
        await hs({ path: `/crm/v3/properties/${PP_OBJECT}/${prop}`, method: "PATCH", body: { options: [...cur, ...need.map((v) => ({ label: v, value: v, displayOrder: -1, hidden: false }))] } });
        for (const v of need) have.add(v);
        added[prop] = need;
      } catch (e) {
        error ??= `adding options to ${prop}: ${msg(e)}`;
        missing[prop] = need;
      }
    } else if (need.length) missing[prop] = need;
    options.set(prop, have);
  }
  return { options, missing, added, ...(error ? { error } : {}) };
}

/** The enum values a set of best rows would write, per property. */
function enumWants(rows: Iterable<Record<string, string>>): Map<string, Set<string>> {
  const want = new Map<string, Set<string>>();
  for (const d of rows) {
    for (const [col, prop] of Object.entries(ENUM_MAP)) {
      const v = pyStrip(d[col] ?? "");
      if (!v) continue;
      const s = want.get(prop) ?? new Set<string>();
      s.add(enumValue(prop, v));
      want.set(prop, s);
    }
  }
  return want;
}

const countInto = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/**
 * Updates every Products & Pricing record whose article is in dim_article (matched by
 * article_number as is, without leading zeros, or padded to ten digits) with the best row's
 * description, material, groups, units, origin and profit centre. Never creates a record;
 * an empty source value never clears one. Only what changed since the last successful
 * write is sent: the change cache (apsomh_cx_article_hash) - FIX: recorded only once
 * HubSpot has taken the batch; the connector recorded it before, so a failed batch was
 * never sent again.
 *
 * compare: also read the records' current values and send only what differs, recording
 * the rest as current - for the first run, when the cache is empty and every record
 * would otherwise be rewritten.
 */
export async function articleLoad(live: boolean, beat: Beat, opts: { file: string; addOptions?: boolean; compare?: boolean }): Promise<StepResult> {
  const t0 = Date.now();
  // 1. every record's article number - two short strings per record for ~226,000 records
  const ids: string[] = [], ans: string[] = [];
  await listPP(["article_number"], beat, (o) => { ids.push(o.id); ans.push(pyStrip(o.properties?.article_number ?? "")); });
  const wanted = new Set<string>();
  for (const an of ans) for (const k of articleKeys(an)) wanted.add(k);
  await beat();
  // 2. the best row per article, held only for articles a record can take (the file is ~300 MB)
  const st: { best?: BestArticles } = {};
  await eachCsvRow(opts.file, false, beat, (r) => {
    if (!st.best) { st.best = new BestArticles(r, "update", (a) => wanted.has(a)); return; }
    st.best.add(r);
  });
  const best = st.best;
  if (!best) throw new Error("dim_article.csv is empty");
  if (!best.seen.size) return { articles_in_file: 0, rows_in_file: best.rows, pp_seen: ids.length, note: "no usable row in the file - nothing to write", seconds: Math.round((Date.now() - t0) / 1000) };
  const keyOf = ans.map((an) => matchArticle(an, (k) => best.best.has(k)));
  await beat();
  // 3. enum options for the values the matched rows carry
  const used = new Set(keyOf.filter((k): k is string => !!k));
  const opt = await enumOptions(enumWants((function* () { for (const k of used) yield best.get(k)!; })()), !!opts.addOptions && live);
  // 4. what changed since the last write, 100 records at a time
  const cache = await loadHashes();
  const dropped = new Map<string, number>();
  const examples: unknown[] = [];
  const errors: string[] = [];
  let miss = 0, unchanged = 0, toUpdate = 0, already = 0, updated = 0, failed = 0, isolated = 0, batches = 0;
  let batch: { id: string; art: string; payload: Record<string, string>; hash: string }[] = [];

  const write = async (send: typeof batch): Promise<typeof batch> => {
    try {
      const j = await hs<BatchOut>({ path: `/crm/v3/objects/${PP_OBJECT}/batch/update`, method: "POST", body: { inputs: send.map((b) => ({ id: b.id, properties: b.payload })) } });
      const okIds = j.results ? new Set(j.results.map((r) => String(r.id))) : new Set(send.map((b) => b.id));
      const bad = send.filter((b) => !okIds.has(b.id));
      failed += bad.length;
      if (bad.length && errors.length < 5) errors.push(String(j.errors?.[0]?.message ?? "partial failure").slice(0, 200));
      return send.filter((b) => okIds.has(b.id));
    } catch (e) {
      const st4 = status(e);
      // a 4xx fails all 100 for one bad record: the first few such batches are retried one by one
      if (st4 !== null && st4 >= 400 && st4 < 500 && st4 !== 429 && send.length > 1 && isolated < 3) {
        isolated += 1;
        const ok: typeof batch = [];
        for (const b of send) ok.push(...(await write([b])));
        return ok;
      }
      failed += send.length;
      if (errors.length < 5) errors.push(`${send.length === 1 ? `${send[0].id} (${send[0].art})` : `batch of ${send.length}`}: ${msg(e)}`);
      return [];
    }
  };

  const flush = async () => {
    if (!batch.length) return;
    let send = batch;
    const current: typeof batch = [];
    if (opts.compare) {
      const j = await hs<{ results?: Obj[] }>({ path: `/crm/v3/objects/${PP_OBJECT}/batch/read`, method: "POST", body: { inputs: batch.map((b) => ({ id: b.id })), properties: PP_PROPS } });
      const cur = new Map((j.results ?? []).map((o) => [String(o.id), o.properties ?? {}]));
      send = [];
      for (const b of batch) {
        const c = cur.get(b.id);
        if (!c) continue; // gone since the listing
        if (sameAsCurrent(b.payload, c)) { already += 1; current.push(b); } else send.push(b);
      }
    }
    toUpdate += send.length;
    for (const b of send) if (examples.length < 10) examples.push({ id: b.id, article: b.art, properties: b.payload });
    if (live) {
      const ok = send.length ? await write(send) : [];
      updated += ok.length;
      await saveHashes([...ok, ...current]);
    }
    batch = [];
    if (++batches % 20 === 0) await beat();
  };

  for (let i = 0; i < ids.length; i++) {
    const key = keyOf[i];
    if (!key) { miss += 1; continue; }
    const { payload, dropped: dr } = withKnownOptions(payloadFor(best.get(key)!), opt.options);
    for (const [p, v] of dr) countInto(dropped, `${p}=${v}`);
    const hash = payloadHash(payload);
    if (cache.get(ids[i]) === hash) { unchanged += 1; continue; }
    batch.push({ id: ids[i], art: key, payload, hash });
    if (batch.length >= 100) await flush();
  }
  await flush();

  return {
    articles_in_file: best.seen.size, rows_in_file: best.rows, pp_seen: ids.length, matched: ids.length - miss,
    unchanged, to_update: toUpdate, ...(opts.compare ? { already_current: already } : {}),
    ...(live ? { updated, errors: failed } : {}), no_match: miss,
    ...(Object.keys(opt.missing).length ? { missing_options: opt.missing } : {}),
    ...(Object.keys(opt.added).length ? { options_added: opt.added } : {}),
    ...(opt.error ? { options_error: opt.error } : {}),
    ...(dropped.size ? { values_left_out: Object.fromEntries([...dropped].sort((a, b) => b[1] - a[1]).slice(0, 10)) } : {}),
    ...(errors.length ? { error_messages: errors } : {}),
    examples, seconds: Math.round((Date.now() - t0) / 1000),
  };
}

const CREATE_MANDANT = "M100 & M110";

function createCap(): number {
  const v = (process.env.ARTICLE_CREATE_CAP ?? "").trim();
  return /^[+-]?\d+$/.test(v) ? Number(v) : 6000;
}

/**
 * Creates Products & Pricing records for the shop-standard articles of dim_article (ten
 * digits, "Standard", active, with a text) that HubSpot does not have - born with the same
 * fields as the daily update plus article_number, article_hs_id and mandant "M100 & M110".
 * By hand only, never in the chain; capped (ARTICLE_CREATE_CAP, 6000) against a feed
 * glitch. FIX: an article counts as existing under any key the update matches it by (as is,
 * without leading zeros, padded) - the connector compared exactly and could create a twin
 * of a record the update already maintains.
 */
export async function articleCreateMissing(live: boolean, beat: Beat, opts: { file: string; cap?: number; addOptions?: boolean }): Promise<StepResult> {
  const t0 = Date.now();
  const cap = opts.cap ?? createCap();
  const st: { best?: BestArticles } = {};
  await eachCsvRow(opts.file, false, beat, (r) => {
    if (!st.best) { st.best = new BestArticles(r, "create"); return; }
    st.best.add(r);
  });
  const best = st.best;
  if (!best) throw new Error("dim_article.csv is empty");
  if (!best.best.size) return { candidates: 0, created: 0, dry: !live };
  const have = new Set<string>();
  await listPP(["article_number"], beat, (o) => {
    const an = pyStrip(o.properties?.article_number ?? "");
    if (an) for (const k of articleKeys(an)) if (k) have.add(k);
  });
  const missing = [...best.best.keys()].filter((a) => !have.has(a)).sort();
  const capped = missing.length > cap;
  const todo = missing.slice(0, Math.max(0, cap));
  const rows = new Map(todo.map((a) => [a, best.get(a)!]));
  const opt = await enumOptions(enumWants(rows.values()), !!opts.addOptions && live);
  // the record's mandant must be an option, or every batch fails
  const mdef = await hs<{ options?: OptionDef[] }>({ path: `/crm/v3/properties/${PP_OBJECT}/mandant` });
  const mandantOk = !mdef.options?.length || mdef.options.some((o) => o.value === CREATE_MANDANT);
  const dropped = new Map<string, number>();
  const inputs = todo.map((art) => {
    const { payload, dropped: dr } = withKnownOptions(payloadFor(rows.get(art)!), opt.options);
    for (const [p, v] of dr) countInto(dropped, `${p}=${v}`);
    return { properties: { ...payload, article_number: art, article_hs_id: art, mandant: CREATE_MANDANT } };
  });
  let created = 0, err = 0;
  const errors: string[] = [];
  if (live && !mandantOk) throw new Error(`the P&P mandant property has no option "${CREATE_MANDANT}" - nothing created`);
  if (live) {
    for (let k = 0; k < inputs.length; k += 100) {
      const chunk = inputs.slice(k, k + 100);
      try {
        // never retried: a create that went through before the connection dropped would be made twice
        const j = await hs<BatchOut>({ path: `/crm/v3/objects/${PP_OBJECT}/batch/create`, method: "POST", body: { inputs: chunk } }, 1);
        const ok = j.results ? j.results.length : chunk.length;
        created += ok;
        err += chunk.length - ok;
      } catch (e) {
        err += chunk.length;
        if (errors.length < 3) errors.push(msg(e));
      }
      if ((k / 100) % 10 === 9) await beat();
    }
  }
  return {
    shop_standard_in_file: best.best.size, already_in_hubspot: best.best.size - missing.length,
    missing: missing.length, capped_at: capped ? cap : null, created, errors: err, dry: !live,
    ...(mandantOk ? {} : { WARNING: `the mandant property has no option "${CREATE_MANDANT}"` }),
    ...(Object.keys(opt.missing).length ? { missing_options: opt.missing } : {}),
    ...(Object.keys(opt.added).length ? { options_added: opt.added } : {}),
    ...(opt.error ? { options_error: opt.error } : {}),
    ...(dropped.size ? { values_left_out: Object.fromEntries([...dropped].sort((a, b) => b[1] - a[1]).slice(0, 10)) } : {}),
    ...(errors.length ? { error_messages: errors } : {}),
    samples: todo.slice(0, 5).map((a) => ({ article: a, text: (rows.get(a)!.ArticleText ?? "").slice(0, 60) })),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
