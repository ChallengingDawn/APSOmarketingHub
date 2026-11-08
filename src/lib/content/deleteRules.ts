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
  const goes = [
    c.todos === 0 ? "the project itself (it has no to-do)" : c.todos === 1 ? "its to-do" : `its ${c.todos} to-dos`,
    ...(c.documents ? [c.documents === 1 ? "what was made in its studio" : `what was made in their ${c.documents} studios`] : []),
  ];
  const stays = [
    c.tickets === 0 ? "HubSpot - no ticket is touched"
      : c.tickets === 1 ? "its HubSpot ticket - not touched, it stays as it is in HubSpot"
        : `its ${c.tickets} HubSpot tickets - not touched, they stay as they are in HubSpot`,
    ...(c.versions ? [`${c.versions} version${c.versions === 1 ? "" : "s"} kept in the Content Library`] : []),
  ];
  return { goes, stays };
}
