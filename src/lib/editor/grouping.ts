// GROUPING (canvas list 25).
//
// A headline, its kicker and the button under it are one thing. Without
// grouping, moving that thing means selecting three objects every time and
// nudging them together - and the first time somebody misses one, the layout
// is quietly broken in a way they will not see until it is printed.
//
// A group is a SHARED ID ON THE NODES, not a nested tree. The nodes stay a
// flat list, so everything that already works on a node - the layer list,
// align, lock, hide, find-and-replace, the z-order buttons, the document
// schema - keeps working without learning about a hierarchy. The cost is
// that groups cannot nest, which nobody in a marketing layout has asked for.

export type Groupable = {
  id: string;
  groupId?: string;
  x: number;
  y: number;
  locked?: boolean;
};

/** Every member of every group represented in the selection. */
export function expandSelection<T extends Groupable>(nodes: T[], ids: string[]): string[] {
  const groups = new Set<string>();
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (n?.groupId) groups.add(n.groupId);
  }
  if (groups.size === 0) return ids;

  const out = new Set(ids);
  for (const n of nodes) {
    if (n.groupId && groups.has(n.groupId)) out.add(n.id);
  }
  // Document order, so the selection reads the same way the layer list does.
  return nodes.filter((n) => out.has(n.id)).map((n) => n.id);
}

/**
 * Put the selected nodes in one group.
 *
 * A node that was already in another group LEAVES it: a node in two groups is
 * a tree, and this is deliberately not one. Grouping fewer than two nodes is
 * a no-op rather than a group of one, which would be invisible and would
 * surprise the next person who tried to move its neighbour.
 */
export function groupNodes<T extends Groupable>(nodes: T[], ids: string[], groupId: string): T[] {
  const members = new Set(expandSelection(nodes, ids));
  if (members.size < 2) return nodes;
  return nodes.map((n) => (members.has(n.id) ? { ...n, groupId } : n));
}

/** Take the selection out of its groups. */
export function ungroupNodes<T extends Groupable>(nodes: T[], ids: string[]): T[] {
  const members = new Set(expandSelection(nodes, ids));
  return nodes.map((n) => {
    if (!members.has(n.id) || !n.groupId) return n;
    const next = { ...n };
    delete next.groupId;
    return next;
  });
}

/** The other members of the dragged node's group. */
export function groupSiblings<T extends Groupable>(nodes: T[], id: string): T[] {
  const me = nodes.find((n) => n.id === id);
  if (!me?.groupId) return [];
  return nodes.filter((n) => n.id !== id && n.groupId === me.groupId);
}

/**
 * Move a whole group by the distance one of its members has travelled.
 *
 * A LOCKED member does not move. Lock means "do not let me move this by
 * accident", and a lock that a group can override is not a lock.
 */
export function moveGroup<T extends Groupable>(nodes: T[], id: string, dx: number, dy: number): T[] {
  if (!dx && !dy) return nodes;
  const siblings = new Set(groupSiblings(nodes, id).filter((n) => !n.locked).map((n) => n.id));
  if (siblings.size === 0) return nodes;
  return nodes.map((n) => (siblings.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n));
}

/** Is this selection one whole group and nothing else? */
export function isWholeGroup<T extends Groupable>(nodes: T[], ids: string[]): string | null {
  if (ids.length < 2) return null;
  const first = nodes.find((n) => n.id === ids[0])?.groupId;
  if (!first) return null;
  const members = nodes.filter((n) => n.groupId === first).map((n) => n.id);
  if (members.length !== ids.length) return null;
  return ids.every((id) => members.includes(id)) ? first : null;
}

/**
 * How many groups the document holds, for the label on the button.
 *
 * Counted from the nodes rather than kept in a separate list, so a group
 * whose last two members were deleted stops existing by itself.
 */
export function groupCount<T extends Groupable>(nodes: T[]): number {
  const seen = new Set<string>();
  for (const n of nodes) if (n.groupId) seen.add(n.groupId);
  return seen.size;
}
