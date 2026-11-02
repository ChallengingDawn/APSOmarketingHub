// MY SALES REPORTS' AND SALES LEADER REPORTS' READS: each person's targets as kept (one key per person and year, so two
// people saving at once never overwrite each other), and who is asking - or, for an admin previewing someone (View as,
// ?as=<hub user id>), that person: their email, their role.

import { getOptionalUser } from "@/lib/auth/guard";
import { asRole } from "@/lib/auth/access";
import type { MyAccess } from "@/lib/auth/appAccess";
import { kvGet } from "@/lib/db/init";
import { query } from "@/lib/db/client";
import { cleanAll, type PersonTargets } from "./mySalesRules";

export const targetsKey = (year: number, owner: string) => `mySales:targets:${year}:${owner}`;

export async function readTargets(year: number, owner: string): Promise<PersonTargets> {
  return cleanAll({ [owner]: (await kvGet<unknown>(targetsKey(year, owner))) ?? {} })[owner] ?? {};
}

/** Several people's targets, ten reads at a time. */
export async function readManyTargets(year: number, owners: string[]): Promise<Record<string, PersonTargets>> {
  const out: Record<string, PersonTargets> = {};
  const ids = [...new Set(owners)];
  for (let i = 0; i < ids.length; i += 10) {
    const part = ids.slice(i, i + 10);
    const got = await Promise.all(part.map((id) => readTargets(year, id)));
    part.forEach((id, k) => { out[id] = got[k]; });
  }
  return out;
}

/** The person asking - or, for an admin previewing someone, that person: their email and their role. */
export async function asking(access: MyAccess, as: string | null) {
  const u = await getOptionalUser();
  if (access.role === "admin" && as && /^\d+$/.test(as)) {
    const r = await query<{ email: string | null; role: string; username: string }>(`SELECT email, role, username FROM apsomh_users WHERE id = $1`, [Number(as)]);
    if (r.rows[0]) return { email: r.rows[0].email, role: asRole(r.rows[0].role), username: r.rows[0].username, previewing: true };
  }
  return { email: u?.email ?? null, role: access.role, username: u?.username ?? "", previewing: false };
}
