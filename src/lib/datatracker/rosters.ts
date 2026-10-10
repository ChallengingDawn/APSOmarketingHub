// Who gets the ticket.
//
// These mirror the rosters in the connector's erosion_load.py, confirmed by
// SARCLA on 21.08.2026. They are data, not rules - kept here rather than read
// from HubSpot because a company owner who is on neither roster must produce a
// VISIBLE skip, not a ticket routed somewhere plausible.
//
// An owner outside both lists gets no ticket and is named in the run report.

export const ESO_OWNERS: Record<string, string> = {
  "29117550": "Jeremy Borey",
  "33688321": "Raffaello Lonardi",
  "32984810": "Christopher Stahl",
  "1229976033": "Claudio Saraiva",
  "1229976027": "Hans Peter Höhn",
  "1229976034": "Benjamin Nitschke",
  "1229976035": "Stefan Wieneber",
  "1229976036": "Tamara Mandl",
  "1229998585": "Adem Can",
  "1229998779": "Katja Storm",
  "1229998780": "Christoph Lange",
  "1229999587": "Luca Fantasia",
  "1230006208": "Nigel van der Loo",
  "1255191254": "Simone Vitale",
  "32968527": "Yani Alioua",
  "817647087": "Bernd Rausmann",
};

export const TSA_OWNERS: Record<string, string> = {
  "30052119": "Sandra Kuridza",
  "1229976026": "Nancy Pielock",
  "1229976029": "Maya Marzena Gustak",
  "1229976031": "Luna Bianca Falk",
  "1229999295": "Denis Schawlochow",
  "1202569408": "TSA Team",
  "817497321": "Marc Frech",
};

/** Pipeline and the existing "New" stage. There is no dedicated price-check
 *  stage, and there should not be - cards key on ids, labels move. */
export const PIPE_STAGE: Record<"ESO" | "TSA", { pipeline: string; stage: string }> = {
  ESO: { pipeline: "1726599376", stage: "2338232556" },
  TSA: { pipeline: "1726599377", stage: "2338232560" },
};

/**
 * Owners we know by NAME but not yet by id - matched against HubSpot's owners
 * when a run reads them, exactly and whole-name only, and from then on routed
 * like everyone else. SARCLA, 10.10: "Jan Kalt · off roster ... look for the
 * off roster, my guess is that is Jan Kalt" - he is ESO (Performis "ESO CH
 * GER", same team as Claudio, Yani and Jeremy). The id is logged when found, so
 * it can be written into ESO_OWNERS and this list emptied.
 * (1694460619, added first on a guess, is NOT him - his rows stayed off roster.)
 */
export const ESO_BY_NAME = ["Jan Kalt"];
export const TSA_BY_NAME: string[] = [];

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const adopted = new Set<string>();

/** Put the named owners on their roster under the id HubSpot gives them. */
export function adoptNamedOwners(owners: Map<string, string>): void {
  const want = new Map<string, Record<string, string>>([
    ...ESO_BY_NAME.map((n) => [norm(n), ESO_OWNERS] as [string, Record<string, string>]),
    ...TSA_BY_NAME.map((n) => [norm(n), TSA_OWNERS] as [string, Record<string, string>]),
  ]);
  if (!want.size) return;
  const hits = new Map<string, string[]>();
  for (const [id, name] of owners) {
    const k = norm(name ?? "");
    if (want.has(k)) hits.set(k, [...(hits.get(k) ?? []), id]);
  }
  for (const [k, ids] of hits) {
    // two owners with the same name: route neither - a guess is what the
    // roster exists to prevent
    if (ids.length !== 1) {
      if (!adopted.has(`dup:${k}`)) { adopted.add(`dup:${k}`); console.warn(`[rosters] "${k}" matches ${ids.length} owners (${ids.join(", ")}) - not routed`); }
      continue;
    }
    const [id] = ids;
    if (ESO_OWNERS[id] || TSA_OWNERS[id]) continue;
    const roster = want.get(k)!;
    roster[id] = owners.get(id) ?? k;
    if (!adopted.has(id)) {
      adopted.add(id);
      console.log(`[rosters] ${roster[id]} is owner ${id} -> ${roster === ESO_OWNERS ? "ESO" : "TSA"}`);
    }
  }
}

export function teamOf(ownerId: string | null | undefined): "ESO" | "TSA" | null {
  const id = (ownerId ?? "").trim();
  if (!id) return null;
  if (ESO_OWNERS[id]) return "ESO";
  if (TSA_OWNERS[id]) return "TSA";
  return null;
}

export function ownerName(ownerId: string | null | undefined): string {
  const id = (ownerId ?? "").trim();
  return ESO_OWNERS[id] ?? TSA_OWNERS[id] ?? id ?? "";
}
