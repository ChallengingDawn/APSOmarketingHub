// LINKING THE PLAN'S EXISTING ROWS TO A KPI (SARCLA 05.11.2026: "you should also [be able] to associate an existing
// action, and if a Digital Growth ticket on the KPI is defined we should be able also to track the one or the multiple
// actions for this KPI"). On a KPI's Actions page the plan's table takes ticks: several actions and sub-actions at once,
// saved together. Pure - the page and its tests share it.
//
// A row is named as the plan's table names it: "i<id>" an action, "s<id>" a sub-action.

/** What saving the ticks does: the newly ticked track the KPI, the unticked that tracked it stop. */
export function linkChanges(ticked: ReadonlySet<string>, tracking: ReadonlySet<string>): { add: string[]; drop: string[] } {
  return {
    add: [...ticked].filter((k) => !tracking.has(k)).sort(),
    drop: [...tracking].filter((k) => !ticked.has(k)).sort(),
  };
}

/** A row's key, split: an action or a sub-action, and its id; null when it is neither. */
export function rowOf(key: string): { kind: "item" | "sub"; id: number } | null {
  const m = /^([is])(\d+)$/.exec(key);
  return m ? { kind: m[1] === "i" ? "item" : "sub", id: Number(m[2]) } : null;
}

/**
 * The plan's rows behind the KPI's Digital Growth tickets: an action or a sub-action holding one of the tickets the KPI
 * is linked to, and a sub-action made on the KPI itself. Only actions - a category holds no ticket.
 */
export function carriersOf(
  items: { id: number; kind: string }[],
  subs: { id: number; ticketIds?: string[]; kpiTile?: string }[],
  own: Record<string, string[] | undefined> | undefined,
  tickets: string[],
  key: string,
): Set<string> {
  const mine = new Set(tickets.map(String));
  const out = new Set<string>();
  for (const i of items) if (i.kind === "action" && (own?.[String(i.id)] ?? []).some((t) => mine.has(String(t)))) out.add(`i${i.id}`);
  for (const s of subs) if (s.kpiTile === key || (s.ticketIds ?? []).some((t) => mine.has(String(t)))) out.add(`s${s.id}`);
  return out;
}
