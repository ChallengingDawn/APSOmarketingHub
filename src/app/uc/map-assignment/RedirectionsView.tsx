"use client";

// MAP ASSIGNMENT - Redirections: Owner redirection, inside Map assignment since 19.10.2026 (SARCLA: "Owner redirection
// is now a part of Map assignment, so it should be taken out as a sub-app"). The board is Owner redirection's own
// (src/app/uc/owner-redirection/OwnerRedirection.tsx) with its own data and API - its rules (France -> Jeremy Borey,
// Sandra Kuridza -> James Koeremez), its HubSpot function and its 15-minute check run unchanged; only the place moved.
// Above it, the one thing the two apps must agree on: France.

import { OwnerRedirectionView } from "@/app/uc/owner-redirection/OwnerRedirection";
import { Notice } from "@/app/uc/report/ui";
import { Info } from "@/app/connectors/parts";
import type { StoredRule } from "@/lib/ownerRules/store";

const isFrance = (v: string) => /^(fr|france|frankreich)$/i.test(v.trim());
const ZONE = "France in Map assignment = Jeremy Borey's zone, Auvergne-Rhône-Alpes + Bourgogne-Franche-Comté; the rest of France goes to TSA Team.";

/** The France note: Map assignment gives Jeremy Auvergne-Rhône-Alpes + Bourgogne-Franche-Comté only, the country rule here all of France. */
export function FranceNote({ rules, frLive, name }: { rules: StoredRule[]; frLive: boolean | null; name: (id: string) => string }) {
  const i = rules.findIndex((r) => r.kind === "country" && [...r.countries, ...r.customCountries].some(isFrance));
  if (i < 0) return <Info>{ZONE} No rule here names France.</Info>;
  const rule = rules[i];
  const n = i + 1;
  const who = name(rule.toOwner);
  if (!rule.enabled) return <Info>{ZONE} Rule {n} (France) is off here{frLive ? "" : " - until France goes live in Map assignment, the HubSpot workflows keep deciding France"}.</Info>;
  if (frLive) return <Notice tone="bad">France is LIVE in Map assignment, and rule {n} here still gives {who} ALL of France - the two write over each other. Switch rule {n} off.</Notice>;
  return <Info>{ZONE} Rule {n} here gives {who} ALL of France: switch rule {n} off before France goes live in Map assignment.</Info>;
}

export function RedirectionsView({ frLive }: {
  /** France live in Map assignment; null while the map data is not there */
  frLive: boolean | null;
}) {
  return <OwnerRedirectionView intro={(rules, name) => <FranceNote key="france" rules={rules} frLive={frLive} name={name} />} />;
}
