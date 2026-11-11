// OUR E-MAILS IN HUBSPOT, AS A NEWSLETTER STARTS FROM THEM (SARCLA 08.11.2026: "look at the latest we sent, but we should
// be able to select more and bring more different options"). Read-only - the reading itself is pure, in ourEmails.ts.
//   ourEmails    the e-mails we sent (workflow e-mails and batch ones), newest first, one group per campaign across its
//                languages, each language with its subject, figures and public web version (campaigns.apsoparts.com)
//   emailParts   one e-mail read in the order it shows
// HubSpot's own e-mails are AUTOMATED_EMAIL (sent by workflows) since 2024; the last BATCH_EMAIL is from 2023.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { hubspotToken } from "@/lib/integrations/status";
import { assetBytes } from "@/lib/content/assets";
import type { NewsletterDoc } from "./model";
import { fileNameOf, groupEmails, readEmail, type EmailGroup, type RawEmail, type RawEmailFull, type ReadEmail } from "./ourEmails";
import { makeDraft, type DraftMade } from "./drafts";

export { blocksFrom, digestOf } from "./ourEmails";
export type { EmailGroup, EmailPart, EmailVariant } from "./ourEmails";

let cache: { at: number; groups: EmailGroup[] } | null = null;

/** The e-mails we sent, grouped by campaign, newest first. Kept 10 minutes. */
export async function ourEmails(): Promise<EmailGroup[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.groups;
  const rows: RawEmail[] = [];
  let after: string | undefined;
  for (let page = 0; page < 3; page++) {
    const j = await hubspotFetchJson<{ results?: RawEmail[]; paging?: { next?: { after?: string } } }>({
      path: `/marketing/v3/emails?limit=100&includeStats=true&sort=-publishDate&archived=false${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    });
    rows.push(...(j.results ?? []));
    after = j.paging?.next?.after;
    if (!after) break;
  }
  const groups = groupEmails(rows);
  cache = { at: Date.now(), groups };
  return groups;
}

/** One e-mail, read in the order it shows. */
export async function emailParts(id: string): Promise<ReadEmail> {
  return readEmail(await hubspotFetchJson<RawEmailFull>({ path: `/marketing/v3/emails/${encodeURIComponent(id)}` }));
}

/* ── a draft in HubSpot (SARCLA 08.11.2026: "go") ───────────────────────────────────────────────────────────────── */

const PORTAL = "26492587";
export const draftUrl = (id: string) => `https://app-eu1.hubspot.com/email/${PORTAL}/edit/${id}/content`;

/** A picture kept in the hub, into HubSpot's files (public, not indexed) - its address there. */
async function toHubspotFiles(url: string, alt = ""): Promise<string | null> {
  const m = /\/api\/content\/picture\/(\d+)-([a-f0-9]{18})/.exec(url);
  const found = m ? await assetBytes(Number(m[1]), m[2]) : null;
  const token = hubspotToken();
  if (!found || !token) return null;
  const fd = new FormData();
  const ext = found.mime === "image/png" ? "png" : "jpg";
  fd.append("file", new Blob([new Uint8Array(found.data)], { type: found.mime }), fileNameOf(alt, m![1], ext));
  fd.append("folderPath", "/APSOhub/newsletters");
  fd.append("options", JSON.stringify({ access: "PUBLIC_NOT_INDEXABLE", overwrite: false, duplicateValidationStrategy: "RETURN_EXISTING", duplicateValidationScope: "EXACT_FOLDER" }));
  const r = await fetch("https://api.hubapi.com/files/v3/files", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!r.ok) return null;
  return ((await r.json()) as { url?: string }).url ?? null;
}

/** The newsletter's language as a DRAFT in HubSpot (./drafts.ts makeDraft, cv17): made from that language's own e-mail of
 *  the campaign when HubSpot has it (else the one it was started from), its draft made before updated in place while it
 *  still is a draft there. Nothing is sent - a person schedules it in HubSpot. */
export async function draftInHubspot(doc: NewsletterDoc, name: string): Promise<DraftMade> {
  return makeDraft(hubspotFetchJson, doc, name, { groups: ourEmails, upload: toHubspotFiles, urlOf: draftUrl });
}
