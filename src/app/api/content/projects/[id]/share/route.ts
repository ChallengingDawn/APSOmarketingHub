// Sharing a content project (src/lib/content/sharing.ts): who is in it, and
// inviting, re-roling, removing and handing over. Inviting sends each person
// the hub's invitation email (src/lib/content/shareMail.ts); a mail that fails
// does not undo the share - the panel says it failed, and the owner can resend.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { mailConfigured, sendHubMail } from "@/lib/notify/mailer";
import { getProject } from "@/lib/content/projects";
import {
  accessFor, isShareRole, membersOf, personByUsername, recordMail, removeMember, setRole, share, shareCandidates, transferOwner,
} from "@/lib/content/sharing";
import { renderInviteMail } from "@/lib/content/shareMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idOf(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  const access = await accessFor(id, me);
  if (!access) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });
  return NextResponse.json({
    ok: true, access, members: await membersOf(id),
    candidates: access.canShare ? await shareCandidates() : [],
    mailReady: mailConfigured(),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = idOf((await ctx.params).id);
  if (id === null) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
  const access = await accessFor(id, me);
  if (!access) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const username = typeof body.username === "string" ? body.username : "";

  // Leaving is yours to do; everything else is the owner's (or an admin's).
  if (action === "remove" && username === me.username && access.role !== "owner") {
    await removeMember(id, username);
    return NextResponse.json({ ok: true });
  }
  if (!access.canShare) return NextResponse.json({ ok: false, error: "Only the owner can share this project." }, { status: 403 });

  if (action === "invite" || action === "resend") {
    const role = isShareRole(body.role) ? body.role : "editor";
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
    const wanted = Array.isArray(body.usernames) ? body.usernames.filter((u): u is string => typeof u === "string") : [];
    if (!wanted.length) return NextResponse.json({ ok: false, error: "Who should it be shared with?" }, { status: 400 });
    const allowed = new Set((await shareCandidates()).map((p) => p.username));
    const refused = wanted.filter((u) => !allowed.has(u));
    if (refused.length) {
      return NextResponse.json({ ok: false, error: `No access to Marketing & Content: ${refused.join(", ")}. An admin can grant it.` }, { status: 400 });
    }
    const found = await getProject(id);
    if (!found) return NextResponse.json({ ok: false, error: "No such project." }, { status: 404 });

    const added = await share(id, me.username, wanted, role, message);
    const inviterName = me.full_name || me.username;
    const results: { username: string; mailed: boolean; error?: string }[] = [];
    for (const u of added) {
      const p = await personByUsername(u);
      if (!p?.email) {
        await recordMail(id, u, "No email address on this account.");
        results.push({ username: u, mailed: false, error: "No email address on this account." });
        continue;
      }
      try {
        const mail = renderInviteMail({
          inviterName, inviteeName: p.name.split(" ")[0] || p.name, projectId: id,
          projectTitle: found.project.title, brief: found.project.brief, message, role,
        });
        await sendHubMail({ to: p.email, ...mail, fromName: `${inviterName} via APSOhub`, replyTo: me.email ?? undefined });
        await recordMail(id, u, null);
        results.push({ username: u, mailed: true });
      } catch (e) {
        const error = String((e as Error)?.message ?? e);
        await recordMail(id, u, error);
        results.push({ username: u, mailed: false, error });
      }
    }
    return NextResponse.json({ ok: true, results, members: await membersOf(id) });
  }

  if (action === "role") {
    if (!isShareRole(body.role)) return NextResponse.json({ ok: false, error: "Can edit or can comment?" }, { status: 400 });
    await setRole(id, username, body.role);
    return NextResponse.json({ ok: true, members: await membersOf(id) });
  }

  if (action === "remove") {
    await removeMember(id, username);
    return NextResponse.json({ ok: true, members: await membersOf(id) });
  }

  if (action === "owner") {
    if (access.role !== "owner" && access.role !== "admin") {
      return NextResponse.json({ ok: false, error: "Only the owner can hand the project over." }, { status: 403 });
    }
    const members = await membersOf(id);
    if (!members.some((m) => m.username === username && m.role !== "owner")) {
      return NextResponse.json({ ok: false, error: "Share it with them first, then make them the owner." }, { status: 400 });
    }
    await transferOwner(id, username);
    return NextResponse.json({ ok: true, members: await membersOf(id) });
  }

  return NextResponse.json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
}
