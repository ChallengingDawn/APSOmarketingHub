// NEWSLETTER - THE PAGE BUILDER'S PAGES, READ FOR ITS LINK PICKER (11.11.2026; ./pageLinks.ts says what a row is).
//
// ONE query, only what the rows need: the page to-dos' documents of a new page (source "new") in the projects this person
// may open - the Content rules (src/lib/content/sharing.ts): their own, the ones shared with them, every one for an admin;
// a deleted project never. Of each document only its store views, its URL keys and titles, and what was written into
// Magento - not its words, modules or pictures (a page's document is large). Nothing is written.

import { query } from "@/lib/db/client";
import { ensureSharing } from "@/lib/content/sharing";
import { ensureStudio } from "../../store";
import { pageLinkRows, pageLinksQuery, type PageLinkRow, type PageLinksDbRow } from "./pageLinks";

/** The Page builder's new pages this person may see, newest first - each with its address per language store view. */
export async function pageLinksFor(me: { username: string; admin: boolean }): Promise<PageLinkRow[]> {
  await Promise.all([ensureStudio(), ensureSharing()]);
  const r = await query<PageLinksDbRow>(pageLinksQuery(me.admin), [me.username]);
  return pageLinkRows(r.rows);
}
