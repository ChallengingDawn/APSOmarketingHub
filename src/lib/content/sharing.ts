// WHO A CONTENT PROJECT BELONGS TO, AND WHO ELSE IS IN IT.
//
// SARCLA, 11.10.2026: projects the way Adobe Express has them - you start one
// and you are its owner; you share it with somebody, with a message, and they
// get an email from the hub; each person "can edit" or "can comment".
//
//   owner      the person who started it (apsomh_content_projects.created_by).
//              Shares, changes roles, removes people, hands the project over.
//   editor     saves variations, chooses one, comments.
//   commenter  reads and comments, changes nothing.
//   admin      sees and does everything, like everywhere else in the hub.
//
// A project nobody shared is its owner's alone. The members table is created
// here on first use, after ensureSchema has finished - never from inside it.

import { query } from "@/lib/db/client";
import { ensureSchema } from "@/lib/db/init";

export type ShareRole = "editor" | "commenter";
export type ProjectRole = "owner" | ShareRole | "admin";

export type Access = { role: ProjectRole; canEdit: boolean; canComment: boolean; canShare: boolean };

export type Person = { username: string; name: string; email: string | null };

export type Member = Person & {
  role: "owner" | ShareRole;
  invitedBy: string | null;
  invitedAt: string | null;
  message: string | null;
  mailedAt: string | null;
  mailError: string | null;
};

type Me = { username: string; role: string };

let ready: Promise<void> | null = null;

/** The members table, once per process. A failure is retried on the next call. */
export function ensureSharing(): Promise<void> {
  ready ??= (async () => {
    await ensureSchema();
    await query(`
      CREATE TABLE IF NOT EXISTS apsomh_content_project_members (
        project_id INTEGER NOT NULL REFERENCES apsomh_content_projects(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'editor',
        invited_by VARCHAR(255),
        message TEXT,
        invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        mailed_at TIMESTAMPTZ,
        mail_error TEXT,
        PRIMARY KEY (project_id, username)
      )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_apsomh_content_members_user ON apsomh_content_project_members(username)`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export const isShareRole = (r: unknown): r is ShareRole => r === "editor" || r === "commenter";

/** What this person may do in this project; null when it is not theirs to see. */
export async function accessFor(projectId: number, me: Me): Promise<Access | null> {
  await ensureSharing();
  const r = await query<{ created_by: string | null; role: string | null }>(
    `SELECT p.created_by, m.role
       FROM apsomh_content_projects p
       LEFT JOIN apsomh_content_project_members m ON m.project_id = p.id AND m.username = $2
      WHERE p.id = $1`,
    [projectId, me.username],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.created_by === me.username) return { role: "owner", canEdit: true, canComment: true, canShare: true };
  if (me.role === "admin") return { role: "admin", canEdit: true, canComment: true, canShare: true };
  if (row.role === "editor") return { role: "editor", canEdit: true, canComment: true, canShare: false };
  if (row.role === "commenter") return { role: "commenter", canEdit: false, canComment: true, canShare: false };
  return null;
}

type PersonRow = { username: string; full_name: string | null; email: string | null };
const person = (r: PersonRow): Person => ({ username: r.username, name: r.full_name || r.username, email: r.email });

/** The owner first, then everyone the project was shared with, oldest first. */
export async function membersOf(projectId: number): Promise<Member[]> {
  await ensureSharing();
  const owner = await query<PersonRow & { created_at: Date }>(
    `SELECT p.created_by AS username, u.full_name, u.email, p.created_at
       FROM apsomh_content_projects p LEFT JOIN apsomh_users u ON u.username = p.created_by
      WHERE p.id = $1`,
    [projectId],
  );
  const rows = await query<PersonRow & { role: string; invited_by: string | null; invited_at: Date; message: string | null; mailed_at: Date | null; mail_error: string | null }>(
    `SELECT m.username, u.full_name, u.email, m.role, m.invited_by, m.invited_at, m.message, m.mailed_at, m.mail_error
       FROM apsomh_content_project_members m LEFT JOIN apsomh_users u ON u.username = m.username
      WHERE m.project_id = $1
      ORDER BY m.invited_at ASC`,
    [projectId],
  );
  const out: Member[] = [];
  const o = owner.rows[0];
  if (o?.username) out.push({ ...person(o), role: "owner", invitedBy: null, invitedAt: null, message: null, mailedAt: null, mailError: null });
  for (const m of rows.rows) {
    out.push({
      ...person(m), role: m.role === "commenter" ? "commenter" : "editor",
      invitedBy: m.invited_by, invitedAt: m.invited_at ? new Date(m.invited_at).toISOString() : null,
      message: m.message, mailedAt: m.mailed_at ? new Date(m.mailed_at).toISOString() : null, mailError: m.mail_error,
    });
  }
  return out;
}

/**
 * The people a project can be shared with: active accounts that may open
 * Marketing & Content, where projects live. Somebody without that app would
 * get an invitation to a door that refuses them.
 */
export async function shareCandidates(): Promise<Person[]> {
  await ensureSchema();
  const r = await query<PersonRow>(
    `SELECT u.username, u.full_name, u.email
       FROM apsomh_users u
      WHERE u.is_active
        AND (u.role = 'admin' OR EXISTS (
              SELECT 1 FROM apsomh_user_app_access a
               WHERE a.user_id = u.id AND a.app_key = 'marketing' AND a.level IN ('read', 'write')))
      ORDER BY COALESCE(NULLIF(u.full_name, ''), u.username)`,
  );
  return r.rows.map(person);
}

export async function personByUsername(username: string): Promise<Person | null> {
  await ensureSchema();
  const r = await query<PersonRow>(`SELECT username, full_name, email FROM apsomh_users WHERE username = $1`, [username]);
  return r.rows[0] ? person(r.rows[0]) : null;
}

/**
 * Add people, or change the role and message of people already in. The owner
 * is never added as a member of their own project.
 */
export async function share(projectId: number, by: string, usernames: string[], role: ShareRole, message: string | null): Promise<string[]> {
  await ensureSharing();
  const owner = (await query<{ created_by: string | null }>(`SELECT created_by FROM apsomh_content_projects WHERE id = $1`, [projectId])).rows[0]?.created_by;
  const added: string[] = [];
  for (const u of [...new Set(usernames)]) {
    if (!u || u === owner) continue;
    await query(
      `INSERT INTO apsomh_content_project_members (project_id, username, role, invited_by, message, invited_at, mailed_at, mail_error)
       VALUES ($1, $2, $3, $4, $5, NOW(), NULL, NULL)
       ON CONFLICT (project_id, username) DO UPDATE
         SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, message = EXCLUDED.message,
             invited_at = NOW(), mailed_at = NULL, mail_error = NULL`,
      [projectId, u, role, by, message ? message.slice(0, 2000) : null],
    );
    added.push(u);
  }
  await query(`UPDATE apsomh_content_projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
  return added;
}

/** Whether the invitation email went out, kept so the share panel can say so. */
export async function recordMail(projectId: number, username: string, error: string | null): Promise<void> {
  await query(
    `UPDATE apsomh_content_project_members SET mailed_at = CASE WHEN $3::text IS NULL THEN NOW() ELSE NULL END, mail_error = $3
      WHERE project_id = $1 AND username = $2`,
    [projectId, username, error ? error.slice(0, 500) : null],
  );
}

export async function setRole(projectId: number, username: string, role: ShareRole): Promise<void> {
  await ensureSharing();
  await query(`UPDATE apsomh_content_project_members SET role = $3 WHERE project_id = $1 AND username = $2`, [projectId, username, role]);
}

export async function removeMember(projectId: number, username: string): Promise<void> {
  await ensureSharing();
  await query(`DELETE FROM apsomh_content_project_members WHERE project_id = $1 AND username = $2`, [projectId, username]);
}

/** Hand the project over. The old owner stays in it, as an editor. */
export async function transferOwner(projectId: number, to: string): Promise<void> {
  await ensureSharing();
  const from = (await query<{ created_by: string | null }>(`SELECT created_by FROM apsomh_content_projects WHERE id = $1`, [projectId])).rows[0]?.created_by;
  if (!from || from === to) return;
  await query(`UPDATE apsomh_content_projects SET created_by = $2, updated_at = NOW() WHERE id = $1`, [projectId, to]);
  await query(`DELETE FROM apsomh_content_project_members WHERE project_id = $1 AND username = $2`, [projectId, to]);
  await query(
    `INSERT INTO apsomh_content_project_members (project_id, username, role, invited_by)
     VALUES ($1, $2, 'editor', $2) ON CONFLICT (project_id, username) DO UPDATE SET role = 'editor'`,
    [projectId, from],
  );
}

export type ListedProject = {
  id: number; title: string; brief: string | null; status: string; chosenVariantId: number | null;
  createdBy: string | null; ownerName: string | null; updatedAt: string;
  variantCount: number; commentCount: number; languages: string[];
  myRole: ProjectRole; members: { username: string; name: string }[];
  /** The folder it is filed under, or null for the ones nobody has filed. */
  folder: string | null;
  /** Starred by the person asking - not by anyone else. */
  starred: boolean;
  /** "YYYY-MM-DD" or null. A string, deliberately: see src/lib/content/calendar.ts. */
  dueDate: string | null;
  /**
   * The version LABELS and TITLES, joined, so searching the list finds a
   * project by what is inside it: "shorter hero" lands on the project that
   * holds that version. Bodies are left out on purpose - shipping every
   * draft's full text to the browser to power a search box is a page weight
   * nobody agreed to.
   */
  variantText: string;
};

// "visible" is everything this person may open, theirs and shared alike. The
// calendar needs it: a content plan with your own projects missing from half
// the squares is not a plan.
export type ProjectScope = "mine" | "shared" | "all" | "editable" | "starred" | "archived" | "visible";

/**
 * The projects this person may open: "mine" they own, "shared" were shared
 * with them, "all" is every project and only for admins. "starred" and
 * "archived" cut across those - an archived project is still yours, or still
 * shared with you - so both are expressed over everything this person may
 * open rather than over one of the tabs.
 */
export async function listProjectsFor(me: Me, scope: ProjectScope): Promise<ListedProject[]> {
  await ensureSharing();
  const member = "EXISTS (SELECT 1 FROM apsomh_content_project_members x WHERE x.project_id = p.id AND x.username = $1)";
  // Everything this person may open at all. An admin may open all of it.
  const visible = me.role === "admin" ? "TRUE" : `(p.created_by = $1 OR ${member})`;
  const where =
    scope === "all" && me.role === "admin" ? "TRUE"
      : scope === "shared" ? member
        : scope === "editable" ? "(p.created_by = $1 OR EXISTS (SELECT 1 FROM apsomh_content_project_members x WHERE x.project_id = p.id AND x.username = $1 AND x.role = 'editor'))"
          : scope === "starred"
            ? `${visible} AND EXISTS (SELECT 1 FROM apsomh_content_project_stars s WHERE s.project_id = p.id AND s.username = $1)`
            : scope === "archived" || scope === "visible" ? visible
              : "p.created_by = $1";
  // Archived is its own view. Every other view hides them, which is the whole
  // point of putting one away.
  const statusWhere = scope === "archived" ? "p.status = 'archived'" : "p.status <> 'archived'";
  const r = await query<{
    id: number; title: string; brief: string | null; status: string; chosen_variant_id: number | null; created_by: string | null;
    owner_name: string | null; updated_at: Date; variant_count: string; comment_count: string; languages: (string | null)[] | null;
    my_role: string | null; members: { username: string; name: string }[] | null;
    folder: string | null; starred: boolean; variant_text: string | null; due_date: string | null;
  }>(
    `SELECT p.id, p.title, p.brief, p.status, p.chosen_variant_id, p.created_by, p.updated_at, p.folder,
            ou.full_name AS owner_name,
            EXISTS (SELECT 1 FROM apsomh_content_project_stars s WHERE s.project_id = p.id AND s.username = $1) AS starred,
            -- TO_CHAR, not the DATE itself: a DATE read back as a Date lands
            -- at midnight UTC and reads as the previous day in Zurich.
            TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date,
            (SELECT STRING_AGG(CONCAT_WS(' ', c.label, c.title), ' ') FROM apsomh_content c WHERE c.project_id = p.id) AS variant_text,
            (SELECT COUNT(*) FROM apsomh_content c WHERE c.project_id = p.id) AS variant_count,
            (SELECT COUNT(*) FROM apsomh_content_comments k WHERE k.project_id = p.id) AS comment_count,
            (SELECT ARRAY_AGG(DISTINCT c.language) FROM apsomh_content c WHERE c.project_id = p.id) AS languages,
            (SELECT m.role FROM apsomh_content_project_members m WHERE m.project_id = p.id AND m.username = $1) AS my_role,
            (SELECT JSON_AGG(JSON_BUILD_OBJECT('username', m.username, 'name', COALESCE(NULLIF(u.full_name, ''), m.username)) ORDER BY m.invited_at)
               FROM apsomh_content_project_members m LEFT JOIN apsomh_users u ON u.username = m.username
              WHERE m.project_id = p.id) AS members
       FROM apsomh_content_projects p
       LEFT JOIN apsomh_users ou ON ou.username = p.created_by
      WHERE ${statusWhere} AND ${where}
      ORDER BY p.updated_at DESC
      LIMIT 200`,
    [me.username],
  );
  return r.rows.map((p) => ({
    id: p.id, title: p.title, brief: p.brief, status: p.status, chosenVariantId: p.chosen_variant_id,
    createdBy: p.created_by, ownerName: p.owner_name || p.created_by, updatedAt: new Date(p.updated_at).toISOString(),
    variantCount: Number(p.variant_count), commentCount: Number(p.comment_count),
    languages: (p.languages ?? []).filter((l): l is string => !!l),
    folder: p.folder,
    starred: !!p.starred,
    dueDate: p.due_date ?? null,
    variantText: p.variant_text ?? "",
    myRole: p.created_by === me.username ? "owner" : p.my_role === "commenter" ? "commenter" : p.my_role === "editor" ? "editor" : "admin",
    members: p.members ?? [],
  }));
}
