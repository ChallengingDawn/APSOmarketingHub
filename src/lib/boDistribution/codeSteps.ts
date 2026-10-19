// BACK OFFICE DISTRIBUTION - the code steps of "SARCLA | BACK OFFICE MAIN ROUTING" the hub takes over when that
// workflow is switched off (SARCLA 19.10.2026: "I want to migrate them"). Each is ported from the workflow's own code
// (specs: the session's spec_step50.md / spec_step75.md / spec_step67.md), with the same constants and the same writes,
// and with the workflow's bugs that write something wrong left out - each such difference is named where it is.
//
// The HubSpot calls go through `call` (the engine's retrying client), so this file holds no token and is testable.

export type Call = <T>(path: string, method?: "GET" | "POST" | "PATCH" | "PUT", body?: unknown) => Promise<T>;
export type StepResult = { ok: boolean; what: string; ownerId?: string | null; error?: string };

const GQS = "1726786775";
/** GQS stage "Waiting on APSO" as step #50 writes it after a merge. */
export const GQS_WAITING_APSO = "2338266316";

/** Step #50's O number: the leftmost O2x.xxxxxxxx in the subject, upper-cased (no word boundaries, as the code). */
export function oNumber(subject: string | null | undefined): string | null {
  const m = subject ? subject.match(/O2\d\.\d{8}/i) : null;
  return m ? m[0].toUpperCase() : null;
}

export const NOTE_NO_O = [
  "⚠️ NO O NUMBER FOUND", "", "No O number (O2X.XXXXXXXX) was found in the ticket title.", "", "Action Required:",
  "- Check if this should be linked to a GQS task", "- If yes, merge manually with the correct GQS task",
  "- If no, pass to the correct colleague or handle as needed", "", "---", "Auto-checked by APSOhub (GQS Task Update)",
].join("\n");
export const noteNoMatch = (o: string) => [
  "⚠️ NO MATCHING GQS TASK FOUND", "", `O Number: ${o}`, "", "Action Required:", `- Check if a GQS task exists for O number: ${o}`,
  "- If yes, merge this ticket manually", "- If no, handle as appropriate", "", "---", "Auto-checked by APSOhub (GQS Task Update)",
].join("\n");
export const noteMerged = (o: string, stageSet: boolean, ownerCopied: boolean) => [
  "📋 TASK STATUS UPDATE MERGED", "", `O Number: ${o}`, "",
  "A status update email was received in Back Office and has been merged into this GQS task.",
  // the code always says "owner preserved", also when there was no owner to copy (spec 7)
  ownerCopied ? "GQS task owner preserved." : "The GQS task had no owner.",
  stageSet ? "Stage set to: Waiting on APSO" : "⚠️ Could not set the stage to Waiting on APSO — please set it by hand.",
  "", "---", "Auto-merged by APSOhub (GQS Task Update)",
].join("\n");

export async function note(call: Call, ticketId: string, text: string): Promise<void> {
  await call("/crm/v3/objects/notes", "POST", {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: text.split("\n").join("<br>") },
    associations: [{ to: { id: ticketId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 228 }] }],
  }).catch(() => null);
}

/** Step #50's GQS task for an O number: newest first, any stage (a closed task is a match), not the ticket itself.
 *  undefined = the search failed (the code took that for "no match" and wrote a false note - the hub leaves it). */
export async function gqsTaskFor(call: Call, o: string, selfId: string): Promise<{ id: string; ownerId: string | null; stage: string | null } | null | undefined> {
  try {
    const r = await call<{ results?: { id: string; properties: Record<string, string | null> }[] }>("/crm/v3/objects/tickets/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "hs_pipeline", operator: "EQ", value: GQS }, { propertyName: "o_number", operator: "EQ", value: o }] }],
      properties: ["subject", "createdate", "hubspot_owner_id", "hs_pipeline_stage", "hs_pipeline", "o_number"],
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }], limit: 100,
    });
    const hit = (r.results ?? []).find((x) => String(x.id) !== String(selfId));
    return hit ? { id: String(hit.id), ownerId: hit.properties.hubspot_owner_id || null, stage: hit.properties.hs_pipeline_stage ?? null } : null;
  } catch { return undefined; }
}

/**
 * Step #50 "GQS EXCLUSION AND MAILS" (Task Status Report e-mails), the merge branch: the Back Office ticket takes the
 * GQS task's owner, is merged INTO the GQS task (GQS = primary), the task goes to Waiting on APSO with its owner, and
 * gets a note. The no-O-number / no-match branches are the caller's: a note, then the least busy of the team.
 */
export async function mergeIntoGqs(call: Call, boId: string, o: string, task: { id: string; ownerId: string | null }): Promise<StepResult> {
  if (task.ownerId) await call(`/crm/v3/objects/tickets/${boId}`, "PATCH", { properties: { hubspot_owner_id: task.ownerId } }).catch(() => null);
  let mergedId: string;
  try {
    const m = await call<{ id?: string | number }>("/crm/v3/objects/tickets/merge", "POST", { primaryObjectId: task.id, objectIdToMerge: boId });
    mergedId = String(m?.id ?? task.id);
  } catch (e) {
    return { ok: false, what: `merge into GQS task ${task.id} failed`, error: (e as Error).message.slice(0, 200) };
  }
  const props: Record<string, string> = { hs_pipeline: GQS, hs_pipeline_stage: GQS_WAITING_APSO, ...(task.ownerId ? { hubspot_owner_id: task.ownerId } : {}) };
  let stageSet = false;
  for (let i = 0; i < 3 && !stageSet; i++) {
    await call(`/crm/v3/objects/tickets/${mergedId}`, "PATCH", { properties: props }).catch(() => null);
    await new Promise((r) => setTimeout(r, 2000));
    const t = await call<{ properties?: Record<string, string | null> }>(`/crm/v3/objects/tickets/${mergedId}?properties=hs_pipeline,hs_pipeline_stage,hubspot_owner_id`).catch(() => null);
    stageSet = t?.properties?.hs_pipeline_stage === GQS_WAITING_APSO;
  }
  await note(call, mergedId, noteMerged(o, stageSet, !!task.ownerId));
  return { ok: true, what: `merged into GQS task ${mergedId}${stageSet ? ", Waiting on APSO" : " - stage NOT set"}`, ownerId: task.ownerId };
}

/* ── step #67 "ANYSEALS": the supplier's daily stock CSV into the File Manager folder APSOPricingHub reads ── */

/** The folder APSOPricingHub's Anyseals sync reads (anyseals.service.ts) - it downloads the file's URL without a token,
 *  so the copy must stay PUBLIC_NOT_INDEXABLE, as the code wrote it. */
export const ANYSEALS_FOLDER = "397778236611";
const ANYSEALS_OPTIONS = { access: "PUBLIC_NOT_INDEXABLE", overwrite: true, duplicateValidationStrategy: "NONE", duplicateValidationScope: "EXACT_FOLDER" };

type Found = { name: string; url: string | null; fileId: string | null; how: string };

/**
 * Step #67, ported. The code copies the CSV byte for byte (it parses nothing); after it the workflow resolves the
 * ticket whatever happened, and so does the caller. The file is looked for (1) on the ticket's own e-mail thread -
 * the code's path 0b - then (2) in the File Manager, newest "Anyseals_Stock*" not already in the folder - the code's
 * path 0, which ran FIRST and took any day's file; here only one created from 12 hours before the ticket on. Two of the
 * code's faults are left out: a failed download is never uploaded as the CSV (the code overwrote the real file with an
 * error page), and its paths 1-3 are dropped (they test ".csv" on File Manager names, which have no extension).
 */
export async function anysealsToFolder(call: Call, token: string, ticketId: string): Promise<StepResult> {
  const t = await call<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${ticketId}?properties=hs_conversations_originating_thread_id,createdate`);
  const created = Date.parse(t.properties.createdate ?? "") || Date.now();
  let found: Found | null = null;
  const thread = t.properties.hs_conversations_originating_thread_id;
  if (thread) {
    const m = await call<{ results?: { attachments?: { name?: string; url?: string; fileId?: string | number; id?: string | number }[] }[] }>(
      `/conversations/v3/conversations/threads/${thread}/messages?limit=20`).catch(() => null);
    for (const msg of m?.results ?? []) {
      const a = (msg.attachments ?? []).find((x) => /\.csv$/i.test(x.name ?? "") && (x.fileId || x.id));
      if (a) { found = { name: a.name!, url: a.url ?? null, fileId: String(a.fileId ?? a.id), how: `e-mail thread ${thread}` }; break; }
    }
  }
  if (!found) {
    const s = await call<{ results?: { id: string; name?: string; extension?: string; createdAt?: string; parentFolderId?: string | number }[] }>(
      "/files/v3/files/search?sort=-createdAt&limit=50").catch(() => null);
    const f = (s?.results ?? [])
      .filter((x) => /^Anyseals_Stock/i.test(x.name ?? "") && (/\.csv$/i.test(x.name ?? "") || (x.extension ?? "").toLowerCase() === "csv"))
      .filter((x) => String(x.parentFolderId ?? "") !== ANYSEALS_FOLDER && (Date.parse(x.createdAt ?? "") || 0) >= created - 12 * 3600_000)
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
    if (f) found = { name: (f.name ?? "Anyseals_Stock").endsWith(".csv") ? f.name! : `${f.name}.csv`, url: null, fileId: String(f.id), how: "File Manager search" };
  }
  if (!found) return { ok: false, what: "no Anyseals stock CSV found on the e-mail or in the File Manager - nothing copied" };
  let url = found.url;
  if (!url && found.fileId) url = (await call<{ url?: string }>(`/files/v3/files/${found.fileId}/signed-url`).catch(() => null))?.url ?? null;
  if (!url) return { ok: false, what: `${found.name}: no download link`, error: "signed-url failed" };
  const res = await fetch(url, { redirect: "follow" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || /text\/html|application\/json/i.test(type)) return { ok: false, what: `${found.name}: download failed (${res.status}) - the folder keeps the previous file`, error: `download ${res.status} ${type}` };
  const bytes = await res.arrayBuffer();
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "text/csv" }), found.name);
  fd.append("folderId", ANYSEALS_FOLDER);
  fd.append("options", JSON.stringify(ANYSEALS_OPTIONS));
  const up = await fetch("https://api.hubapi.com/files/v3/files", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!up.ok) return { ok: false, what: `${found.name}: upload failed`, error: `upload ${up.status} ${(await up.text()).slice(0, 200)}` };
  return { ok: true, what: `${found.name} (${Math.round(bytes.byteLength / 1024)} KB, from the ${found.how}) copied to the Anyseals folder` };
}

/* ── step #75 "Sales ticket Split": a sales rep forwarded a customer's e-mail to the Back Office ── */

const ESO_PIPELINE = "1726599376", ESO_NEW = "2338232556";
/** The code's own gate (the workflow's branch before it lets only SALES_SPLIT_SENDERS through - all of them are here). */
export const SALES_REPS = [
  "yani.alioua@apsoparts.com", "jeremy.borey@apsoparts.com", "paulina.bozek@apsoparts.com", "adem.can@apsoparts.com",
  "lunabianca.falk@apsoparts.com", "luca.fantasia@angst-pfister.com", "marc.frech@apsoparts.com", "marzena.gustak@apsoparts.com",
  "hans-peter.hoehn@apsoparts.com", "sandra.kuridza@apsoparts.com", "christoph.lange@apsoparts.com", "raffaello.lonardi@apsoparts.com",
  "tamara.mandl@apsoparts.com", "benjamin.nitschke@apsoparts.com", "nancy.pielock@apsoparts.com", "bernd.rausmann@apsoparts.com",
  "claudio.saraiva@apsoparts.com", "denis.schawlochow@apsoparts.com", "christopher.stahl@apsoparts.com", "katja.storm@apsoparts.com",
  "nigel.vanderloo@apsoparts.com", "simone.vitale@apsoparts.com", "stefan.wieneber@apsoparts.com",
];
const QUOTE_KW = ["quote", "quotation", "rfq", "request for quotation", "price", "pricing", "offer", "pls offer", "best price", "best offer", "price list",
  "devis", "demande de devis", "prix", "tarif", "offre", "cotation", "angebot", "preis", "preisliste", "preisanfrage", "kostenvoranschlag", "preventivo",
  "prezzo", "offerta", "listino"];
// 58 entries: "tolerance" twice, as in the code - it counts twice
const TECH_KW = ["datasheet", "data sheet", "tds", "specification", "spec", "drawing", "cad", "3d model", "step file", "iges", "material", "hardness",
  "tolerance", "compound", "shore", "fkm", "nbr", "epdm", "technical", "tech question", "application", "temperature range", "chemical resistance",
  "certificate", "certification", "conformity", "fiche technique", "caracteristiques", "caractéristique", "plan", "matiere", "matière", "dureté",
  "tolerance", "tolérance", "technique", "certificat", "conformite", "conformité", "datenblatt", "datenblätter", "zeichnung", "spezifikation", "werkstoff",
  "haerte", "härte", "toleranz", "technisch", "zertifikat", "konformität", "scheda tecnica", "specifica", "disegno", "materiale", "durezza", "tolleranza",
  "tecnico", "certificato"];
// Python's \w on str is Unicode: letters, numbers and "_"
const EMAIL_RE = /[\p{L}\p{N}_.+\-]+@[\p{L}\p{N}_.\-]+\.[a-zA-Z]{2,}/gu;
const FWD_HEADER_RE = /(?:^|\n)\s*(?:from|de|von|da|de la part de)\s*:\s*([^\n\r]+)/gi; // no m flag, as the code
const isInternal = (e: string) => /(angst-pfister\.com|apsoparts\.com|apso-parts\.com)$/.test(e.toLowerCase());

/** The code's classify(): each keyword once, substring match; a tie goes to Product Price; no hit = "". */
export function salesCategory(text: string): "" | "Product Price" | "Product Information" {
  const t = (text || "").toLowerCase();
  const q = QUOTE_KW.filter((k) => t.includes(k)).length, s = TECH_KW.filter((k) => t.includes(k)).length;
  if (!q && !s) return "";
  return q >= s ? "Product Price" : "Product Information";
}

/** The code's extract_customer_email(): the first outside address on a forwarded From:/De:/Von:/Da: line, else anywhere. */
export function customerEmail(body: string, forwarder: string): string {
  if (!body) return "";
  const ok = (e: string) => e !== forwarder.toLowerCase() && !isInternal(e);
  for (const h of body.matchAll(FWD_HEADER_RE)) for (const e of h[1].match(EMAIL_RE) ?? []) if (ok(e.toLowerCase())) return e.toLowerCase();
  for (const e of body.match(EMAIL_RE) ?? []) if (ok(e.toLowerCase())) return e.toLowerCase();
  return "";
}

type Msg = { direction?: string; subject?: string; text?: string; richText?: string; senders?: { deliveryIdentifier?: { value?: string } }[] };

/**
 * Step #75, ported: the sender of the newest e-mail (else the first incoming conversation message) must be a sales rep;
 * then the ticket goes to ESO / New (checked), the rep becomes its owner (a separate write, as the code), the
 * customer's contact and that contact's first company are linked when the contact exists, and the category is set
 * from the keywords. Left out of the code: one batch read of more than 100 e-mails (it failed) - chunked here.
 */
export async function salesSplit(call: Call, ticketId: string): Promise<StepResult> {
  const t = await call<{ properties: Record<string, string | null> }>(`/crm/v3/objects/tickets/${ticketId}?properties=subject,content`);
  let subject = t.properties.subject ?? "", body = t.properties.content ?? "", forwarder = "";
  const ea = await call<{ results?: { toObjectId: number | string }[] }>(`/crm/v4/objects/tickets/${ticketId}/associations/emails`).catch(() => null);
  const ids = (ea?.results ?? []).map((x) => String(x.toObjectId)).filter(Boolean);
  const emails: Record<string, string | null>[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const b = await call<{ results?: { properties: Record<string, string | null> }[] }>("/crm/v3/objects/emails/batch/read", "POST", {
      properties: ["hs_email_from_email", "hs_email_to_email", "hs_email_subject", "hs_email_text", "hs_email_html", "hs_timestamp"], inputs: ids.slice(i, i + 100).map((id) => ({ id })),
    }).catch(() => null);
    emails.push(...(b?.results ?? []).map((x) => x.properties));
  }
  if (emails.length) {
    const e = emails.slice().sort((a, b) => String(b.hs_timestamp ?? "").localeCompare(String(a.hs_timestamp ?? "")))[0]; // stable, newest first
    forwarder = String(e.hs_email_from_email ?? "").trim().toLowerCase();
    subject = e.hs_email_subject || subject;
    body = e.hs_email_text || e.hs_email_html || body;
  }
  if (!forwarder) {
    const ca = await call<{ results?: { toObjectId: number | string }[] }>(`/crm/v4/objects/tickets/${ticketId}/associations/conversations`).catch(() => null);
    for (const r of ca?.results ?? []) {
      const m = await call<{ results?: Msg[] }>(`/conversations/v3/conversations/threads/${r.toObjectId}/messages`).catch(() => null);
      const msgs = m?.results ?? [];
      const incoming = msgs.filter((x) => (x.direction ?? "").toUpperCase() === "INCOMING");
      const first = (incoming.length ? incoming : msgs)[0];
      if (!first) continue;
      forwarder = (first.senders ?? []).map((s) => String(s.deliveryIdentifier?.value ?? "").trim().toLowerCase()).find(Boolean) ?? "";
      subject = first.subject || subject;
      body = first.text || first.richText || body;
      if (forwarder) break;
    }
  }
  if (!forwarder) return { ok: false, what: "sales split: sender not detected - nothing written" };
  if (!SALES_REPS.includes(forwarder)) return { ok: false, what: `sales split: ${forwarder} is not a mapped sales rep - nothing written` };
  try {
    await call(`/crm/v3/objects/tickets/${ticketId}`, "PATCH", { properties: { hs_pipeline: ESO_PIPELINE, hs_pipeline_stage: ESO_NEW } });
  } catch (e) { return { ok: false, what: "sales split: the move to ESO failed", error: (e as Error).message.slice(0, 200) }; }
  const own = await call<{ results?: { id: string }[] }>(`/crm/v3/owners/?email=${encodeURIComponent(forwarder)}`).catch(() => null);
  const ownerId = own?.results?.[0]?.id ? String(own.results[0].id) : null;
  if (ownerId) await call(`/crm/v3/objects/tickets/${ticketId}`, "PATCH", { properties: { hubspot_owner_id: ownerId } }).catch(() => null);
  const cust = customerEmail(body, forwarder);
  let linked = "";
  if (cust) {
    const c = await call<{ results?: { id: string }[] }>("/crm/v3/objects/contacts/search", "POST", {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: cust }] }], properties: ["email"], limit: 1,
    }).catch(() => null);
    const contactId = c?.results?.[0]?.id;
    if (contactId) {
      await call(`/crm/v4/objects/tickets/${ticketId}/associations/default/contacts/${contactId}`, "PUT").catch(() => null);
      const co = await call<{ results?: { toObjectId: number | string }[] }>(`/crm/v4/objects/contacts/${contactId}/associations/companies`).catch(() => null);
      const companyId = co?.results?.[0]?.toObjectId;
      if (companyId) await call(`/crm/v4/objects/tickets/${ticketId}/associations/default/companies/${companyId}`, "PUT").catch(() => null);
      linked = ` · linked ${cust}${companyId ? " and its company" : ""}`;
    }
  }
  const cat = salesCategory(`${subject} ${body}`);
  if (cat) {
    const props = cat === "Product Price"
      ? { enquiry_category: cat, enquiry_sub_category___price_1: "Request for quotation" }
      : { enquiry_category: cat, enquiry_sub_category___product_information___1: "Technical question on a product" };
    await call(`/crm/v3/objects/tickets/${ticketId}`, "PATCH", { properties: props }).catch(() => null);
  }
  return { ok: true, what: `sales split: to ESO / New, forwarded by ${forwarder}${ownerId ? "" : " (no owner found for that address)"}${linked}${cat ? ` · ${cat}` : ""}`, ownerId };
}
