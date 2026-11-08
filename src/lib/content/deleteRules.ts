// DELETING A CONTENT PROJECT: THE RULES (SARCLA 08.11.2026: "I should be able to delete projects"). Pure, no database -
// the route asks these, the page shows what they say, and tests/content-delete.test.ts holds them.
//
//   who deletes      the project's owner, or an admin - an editor or a commenter does not (they can leave it, not end it)
//   who brings back  an admin, from "Deleted projects" (Content > Projects, at the foot of the board)
//   what it is       a soft delete: the project, its to-dos and their studio documents are hidden everywhere (the board,
//                    the calendar, Ideas, what waits for whom, every studio) and kept, so an admin can bring it all back
//   what stays       its HubSpot tickets - never touched, they stay as they are in HubSpot - and the versions already in
//                    the Content Library

export type Who = { username: string; role: string };

/** The owner, or an admin. */
export function mayDelete(project: { createdBy: string | null }, me: Who): boolean {
  if (me.role === "admin") return true;
  return !!project.createdBy && project.createdBy === me.username;
}

/** Bringing a deleted project back is an admin's. */
export const mayRestore = (me: Who): boolean => me.role === "admin";

/** The status a project goes back to when it is brought back: what it was before, else open. */
export function restoredStatus(before: string | null | undefined): "open" | "decided" | "archived" {
  return before === "decided" || before === "archived" ? before : "open";
}

export type DeleteCounts = { todos: number; documents: number; tickets: number; versions: number };

/** What the confirm says: what goes with the project, and what stays - in plain words. */
export function deleteSummary(c: DeleteCounts): { goes: string[]; stays: string[] } {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const goes = [
    c.todos ? `its ${n(c.todos, "to-do", "to-dos")}` : "the project itself (it has no to-do)",
    ...(c.documents ? [`what was made in ${c.documents === 1 ? "its studio" : `their ${c.documents} studios`} (pages, posts, mails, banners, films)`] : []),
  ];
  const stays = [
    c.tickets ? `its ${n(c.tickets, "HubSpot ticket", "HubSpot tickets")} - not touched, ${c.tickets === 1 ? "it stays" : "they stay"} as ${c.tickets === 1 ? "it is" : "they are"} in HubSpot`
      : "HubSpot - no ticket is touched",
    ...(c.versions ? [`${n(c.versions, "version", "versions")} kept in the Content Library`] : []),
  ];
  return { goes, stays };
}
