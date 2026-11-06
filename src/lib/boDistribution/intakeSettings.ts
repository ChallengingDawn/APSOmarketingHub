// THE WAY IN - what can be steered on Back Office distribution > Way in (SARCLA 06.11.2026: "the logic of ticket
// creation for me should be on back office distribution, a new tab that we can steer as well"). Kept in kv
// boDist:intake:settings. Until set here, the mail switch and its people are the ones Certificates > Console had
// (certificates:settings mails.created / teamTo), so nothing changes by the move.

import { kvGet, kvSet } from "@/lib/db/init";
import { INBOX_OWNERS } from "@/lib/notify/teamRecipients";
import { BO_CREATORS, TEAMS } from "./intake";

export type Team = { team: string; from: string[] };
export type IntakeSettings = {
  /** "❗Back Office Ticket Created" on / off, and who gets it (never an inbox) */
  mail: boolean; to: string[];
  /** the sender -> the team in the subject, first match wins */
  teams: Team[];
  /** the HubSpot users whose tickets count as the Back Office's own ("CREATED BY BO") */
  creators: string[];
  /** seconds after entry before the hub writes; seconds an e-mail ticket waits for its e-mail; minutes after which a ticket not taken in is left alone */
  waitS: number; emailWaitS: number; maxAgeMin: number;
  /** what was set here (the rest follows the defaults) */
  own: { mail?: boolean; to?: boolean };
  by?: string; at?: string;
};
export const INTAKE_BOUNDS = { waitS: [10, 300], emailWaitS: [0, 900], maxAgeMin: [5, 240] } as const;
export const DEFAULT_INTAKE = { waitS: 20, emailWaitS: 180, maxAgeMin: 30 } as const;
const KV = "boDist:intake:settings";
type Stored = Partial<Omit<IntakeSettings, "own">> & { own?: IntakeSettings["own"] };

export async function getIntakeSettings(): Promise<IntakeSettings> {
  const [s, c] = await Promise.all([kvGet<Stored>(KV), kvGet<{ mails?: { created?: boolean }; teamTo?: string[] }>("certificates:settings")]);
  const own = s?.own ?? {};
  return {
    mail: own.mail ? s?.mail !== false : c?.mails?.created !== false,
    to: (own.to ? s?.to ?? [] : c?.teamTo ?? []).filter((id) => !INBOX_OWNERS.has(id)),
    teams: s?.teams?.length ? s.teams : TEAMS.map((t) => ({ team: t.team, from: [...t.from] })),
    creators: s?.creators?.length ? s.creators : [...BO_CREATORS],
    waitS: s?.waitS ?? DEFAULT_INTAKE.waitS, emailWaitS: s?.emailWaitS ?? DEFAULT_INTAKE.emailWaitS, maxAgeMin: s?.maxAgeMin ?? DEFAULT_INTAKE.maxAgeMin,
    own, by: s?.by, at: s?.at,
  };
}

export type IntakePatch = Partial<Pick<IntakeSettings, "mail" | "to" | "teams" | "creators" | "waitS" | "emailWaitS" | "maxAgeMin">> & { reset?: "teams" | "creators" | "waits" };

/** null = fine; else what is wrong, in words. */
export function intakeProblem(p: IntakePatch): string | null {
  if (p.mail !== undefined && typeof p.mail !== "boolean") return "the mail: on or off";
  const ids = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && /^\d+$/.test(x));
  if (p.to !== undefined) {
    if (!ids(p.to, 12)) return "who gets the mail: up to 12 owners";
    if (p.to.some((x) => INBOX_OWNERS.has(x))) return "not a queue user - its address is a HubSpot inbox, a mail there comes back as a ticket";
  }
  if (p.creators !== undefined && (!ids(p.creators, 40) || !p.creators.length)) return "the Back Office's people: 1 to 40 users";
  if (p.teams !== undefined) {
    if (!Array.isArray(p.teams) || !p.teams.length || p.teams.length > 60) return "the teams: 1 to 60";
    const seen = new Set<string>();
    for (const t of p.teams) {
      if (!t || typeof t.team !== "string" || !t.team.trim() || t.team.length > 60) return "each team needs a name (up to 60 characters)";
      if (!Array.isArray(t.from) || !t.from.length || t.from.length > 20) return `${t.team}: 1 to 20 sender addresses`;
      for (const a of t.from) {
        if (typeof a !== "string" || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a.trim())) return `${t.team}: "${a}" is not an e-mail address`;
        if (seen.has(a.trim().toLowerCase())) return `"${a}" is under two teams - the first would always win`;
        seen.add(a.trim().toLowerCase());
      }
    }
  }
  for (const k of ["waitS", "emailWaitS", "maxAgeMin"] as const) {
    const v = p[k];
    if (v === undefined) continue;
    const [lo, hi] = INTAKE_BOUNDS[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) return `${k}: a whole number from ${lo} to ${hi}`;
  }
  return null;
}

export async function saveIntakeSettings(p: IntakePatch, by: string): Promise<IntakeSettings> {
  const cur = await getIntakeSettings();
  const s = (await kvGet<Stored>(KV)) ?? {};
  const own = { ...(s.own ?? {}) };
  if (p.mail !== undefined) own.mail = true;
  if (p.to !== undefined) own.to = true;
  const next: Stored = {
    ...s,
    mail: p.mail ?? cur.mail, to: (p.to ?? cur.to).filter((id) => !INBOX_OWNERS.has(id)),
    teams: p.reset === "teams" ? undefined : p.teams ? p.teams.map((t) => ({ team: t.team.trim().toUpperCase(), from: t.from.map((a) => a.trim().toLowerCase()) })) : s.teams,
    creators: p.reset === "creators" ? undefined : p.creators ?? s.creators,
    waitS: p.reset === "waits" ? undefined : p.waitS ?? s.waitS, emailWaitS: p.reset === "waits" ? undefined : p.emailWaitS ?? s.emailWaitS,
    maxAgeMin: p.reset === "waits" ? undefined : p.maxAgeMin ?? s.maxAgeMin,
    own, by, at: new Date().toISOString(),
  };
  await kvSet(KV, next);
  return getIntakeSettings();
}
