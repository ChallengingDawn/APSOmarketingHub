// THE CONTENT LIBRARY, READ (11.11.2026; ./library.ts says what a piece of it is and runs the rules). ONE query over the
// studio documents of the projects this person may open - the Content rules (./sharing.ts accessFor: their own, shared
// with them, every one for an admin; never a deleted project) - then the names of the people the pieces name. Nothing
// is written; no table or column is added.

import { query } from "@/lib/db/client";
import { ensureSharing } from "@/lib/content/sharing";
import { ensureStudio } from "@/lib/content/studio/store";
import { PICTURE_RE, libraryItems, libraryQuery, peopleIn, type LibraryDbRow, type LibraryItem } from "./library";

export async function libraryFor(me: { username: string; admin: boolean }): Promise<{ items: LibraryItem[]; people: Record<string, string> }> {
  await Promise.all([ensureStudio(), ensureSharing()]);
  const r = await query<LibraryDbRow>(libraryQuery(me.admin), [me.username, PICTURE_RE]);
  const items = libraryItems(r.rows);
  const names = peopleIn(items);
  const people: Record<string, string> = {};
  if (names.length) {
    const u = await query<{ username: string; full_name: string | null }>(
      `SELECT username, full_name FROM apsomh_users WHERE username = ANY($1::text[])`, [names]);
    for (const x of u.rows) people[x.username] = x.full_name || x.username;
  }
  return { items, people };
}
