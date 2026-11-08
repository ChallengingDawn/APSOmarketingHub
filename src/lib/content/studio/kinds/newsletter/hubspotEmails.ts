// OUR E-MAILS IN HUBSPOT, AS A NEWSLETTER STARTS FROM THEM (SARCLA 08.11.2026: "look at the latest we sent, but we should
// be able to select more and bring more different options"). Read-only - the reading itself is pure, in ourEmails.ts.
//   ourEmails    the e-mails we sent (workflow e-mails and batch ones), newest first, one group per campaign across its
//                languages, each language with its subject, figures and public web version (campaigns.apsoparts.com)
//   emailParts   one e-mail read in the order it shows
// HubSpot's own e-mails are AUTOMATED_EMAIL (sent by workflows) since 2024; the last BATCH_EMAIL is from 2023.

import { hubspotFetchJson } from "@/lib/integrations/hubspot";
import { groupEmails, readEmail, type EmailGroup, type RawEmail, type RawEmailFull, type ReadEmail } from "./ourEmails";

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
