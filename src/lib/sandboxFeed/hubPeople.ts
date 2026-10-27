// THE SANDBOX'S BUILDERS ON THE HUB - SANDBOX_HUB_PEOPLE="diana.fehr@apsoparts.com|Diana Fehr; ..." (SARCLA 27.10.2026:
// "Sandbox: Edit only. Every new account gets Datatracker (read) by default, which shows real data, so take that away.
// If they already have hub accounts, just add the Sandbox grant and check what else they hold.")
//
// Once per start of the hub, under the sandbox feeder's lock:
//  - no account yet: created without a password and with ONLY the Sandbox grant (Edit) - none of the starter grants -
//    and the one-time link mailed by the hub; they set their own password and TOTP from it
//  - an account already: the Sandbox grant (Edit) added; whatever else it holds is written to the log and the audit,
//    and left as it is - taking anything away is the admin's call

import { randomBytes } from "node:crypto";
import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";
import { hashPassword } from "@/lib/auth/password";
import { createInvite, INVITE_HOURS } from "@/lib/auth/invite";
import { esc, sendHubMail, wrap } from "@/lib/notify/mailer";
import { hubPublicUrl } from "@/lib/content/shareMail";

export type HubPerson = { email: string; name: string };

/** "email|name" separated by ";" - an entry without an address is skipped. */
export function parseHubPeople(raw: string | undefined): HubPerson[] {
  return (raw ?? "").split(";").map((s) => s.trim()).filter(Boolean).map((part) => {
    const [email, name] = part.split("|").map((x) => x.trim());
    return { email: (email ?? "").toLowerCase(), name: name || (email ?? "").split("@")[0] };
  }).filter((p) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p.email));
}

async function audit(action: string, detail: Record<string, unknown>) {
  await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ('sandbox-setup', $1, $2)`, [action, JSON.stringify(detail)])
    .catch(() => { /* never fail the setup because the log did */ });
}

function inviteMail(p: HubPerson, url: string) {
  const hub = hubPublicUrl();
  const rows = `<p style="margin:0 0 10px;font-size:14px;line-height:1.5">Your APSOhub account opens the <b>Sandbox</b> app: there you bring coded data to your sandbox and see what you sent to review.</p>
    <p style="margin:0;font-size:13px;color:#5d6b85;line-height:1.5">Set your password and add the hub to your authenticator app from the button - once, within ${INVITE_HOURS} hours.</p>`;
  return {
    subject: "Your APSOhub account",
    html: wrap({ heading: `Hello ${esc(p.name.split(" ")[0])}`, intro: "An account on APSOhub, for your sandbox.", rows,
      cta: { label: "Set up my access", href: url }, hubUrl: hub,
      footer: "This link works once. If it has run out, ask for a new one." }),
    text: `An account on APSOhub, for your sandbox (the Sandbox app).\nSet your password and your authenticator, once, within ${INVITE_HOURS} hours: ${url}\n`,
  };
}

/** Make sure each person has a hub account with the Sandbox grant. Returns one line per person, for the log. */
export async function ensureHubPeople(raw: string | undefined): Promise<string[]> {
  const people = parseHubPeople(raw);
  if (!people.length) return [];
  await ensureSchema();
  const lines: string[] = [];
  for (const p of people) {
    const local = p.email.split("@")[0];
    const found = await query<{ id: number; role: string; awaiting_setup: boolean }>(
      `SELECT id, role, awaiting_setup FROM apsomh_users WHERE lower(email) = $1 OR username = $2 ORDER BY (lower(email) = $1) DESC LIMIT 1`,
      [p.email, local]);
    let id = found.rows[0]?.id;
    if (!id) {
      const r = await query<{ id: number }>(
        `INSERT INTO apsomh_users (username, email, full_name, password_hash, role, is_active, must_change_password, awaiting_setup)
         VALUES ($1, $2, $3, $4, 'user', TRUE, TRUE, TRUE) ON CONFLICT (username) DO NOTHING RETURNING id`,
        [local, p.email, p.name, await hashPassword(randomBytes(32).toString("base64url"))]);
      id = r.rows[0]?.id;
      if (!id) { lines.push(`${p.email}: the username ${local} is taken by another account - not created`); continue; }
      await query(`INSERT INTO apsomh_user_app_access (user_id, app_key, level) VALUES ($1, 'sandbox', 'write')
        ON CONFLICT (user_id, app_key) DO UPDATE SET level = 'write'`, [id]);
      const token = await createInvite(id);
      const m = inviteMail(p, `${hubPublicUrl()}/invite/${token}`);
      // the account exists from here on, so a failed mail must say so - the next start will not try again
      const mailed = await sendHubMail({ to: p.email, subject: m.subject, html: m.html, text: m.text })
        .then(() => null).catch((e: Error) => e.message.slice(0, 160));
      await audit("user.create", { userId: id, email: p.email, grants: { sandbox: "write" }, invited: !mailed });
      lines.push(`${p.email}: account created with only Sandbox (Edit); ${mailed
        ? `the sign-up link could NOT be mailed (${mailed}) - make a new one on Settings > People`
        : "the sign-up link is mailed"}`);
      continue;
    }
    await query(`INSERT INTO apsomh_user_app_access (user_id, app_key, level) VALUES ($1, 'sandbox', 'write')
      ON CONFLICT (user_id, app_key) DO UPDATE SET level = 'write'`, [id]);
    const held = await query<{ app_key: string; level: string }>(
      `SELECT app_key, level FROM apsomh_user_app_access WHERE user_id = $1 AND app_key <> 'sandbox' AND level <> 'none' ORDER BY app_key`, [id]);
    const others = held.rows.map((g) => `${g.app_key} ${g.level === "write" ? "Edit" : "View"}`);
    const role = found.rows[0].role;
    await audit("sandbox.grant", { userId: id, email: p.email, role, alsoHolds: others });
    lines.push(`${p.email}: had an account (${role}${found.rows[0].awaiting_setup ? ", not set up yet" : ""}) - Sandbox (Edit) added; `
      + `${role === "admin" ? "an admin opens every app" : others.length ? `also holds ${others.join(", ")}` : "holds nothing else"}`);
  }
  return lines;
}
