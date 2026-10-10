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
  // SARCLA, 10.10: owner 1694460619 showed "off roster"; Jan Klat, ESO.
  "1694460619": "Jan Klat",
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
