// THE SANDBOX APP'S DATA - the sandboxes' relays on Railway, what waits in each (the reads their pages could not answer, the CLI's
// asks), and the three buttons: Bring data, Bring requested data, Delete all (SARCLA 26.10.2026: the hub is the front
// end for pulling data). What waits is shown as WHICH read (a HubSpot path, a table), never as data. A person sees the
// sandboxes that name them in SANDBOX_PEOPLE; an admin sees all. Every press is in the audit log.
// 404 on a sandbox copy itself - this is the hub's page.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { isSandbox } from "@/lib/sandbox/mode";
import { tablesIn } from "@/lib/sandbox/canon";
import type { Asked } from "@/lib/sandbox/link";
import { approveCli, bring, deleteAllIn, readSandbox } from "@/lib/sandboxFeed/feed";
import { sandboxTargetList } from "@/lib/sandboxFeed/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type SandboxRead = { key: string; kind: "hs" | "sql"; what: string; since: string | null; hits: number };
export type SandboxAsk = { id: number; by: string; reason: string; what: string; at: string | null };
/** `slug`: its name on the hub; `cli`: its relay on Railway - where its CLI signs in and its computer pulls data. */
export type SandboxCard = {
  slug: string; cli: string; title: string; people: { name: string; email: string; role: string }[];
  error?: string;
  state?: { missing: number; refused: number; brought: number; wouldWrite: number; asks: number };
  reads: SandboxRead[]; asks: SandboxAsk[]; reviewsWaiting: number;
};
export type SandboxActivity = { at: string; who: string; action: string; sandbox: string; line: string };
export type SandboxData = { sandboxes: SandboxCard[]; activity: SandboxActivity[]; canAct: boolean };

/** A read as a person can recognise it - never its data. */
function describe(kind: string, request: unknown): string {
  const r = (request ?? {}) as { method?: string; url?: string; text?: string };
  if (kind === "hs") return `HubSpot ${String(r.method ?? "GET")} ${String(r.url ?? "").split("?")[0]}`;
  const tables = tablesIn(String(r.text ?? ""));
  return `Database: ${tables.length ? tables.join(", ") : "a read"}`;
}

function titleOf(people: { name: string; role: string }[]): string {
  const builders = people.filter((p) => p.role === "user").map((p) => p.name);
  if (builders.length === 1) return `${builders[0]}'s sandbox`;
  if (builders.length > 1) return "Shared sandbox";
  return "Sandbox";
}

async function who() {
  const access = await myAccess();
  if (!access) return null;
  const r = await query<{ email: string | null; username: string }>(`SELECT email, username FROM apsomh_users WHERE id = $1`, [access.userId]);
  return { access, email: (r.rows[0]?.email ?? "").toLowerCase(), username: r.rows[0]?.username ?? String(access.userId) };
}

const mayUse = (asked: Asked | null, me: { access: { role: string }; email: string }) =>
  me.access.role === "admin" || !!asked?.people?.some((p) => p.email.toLowerCase() === me.email);

function config() {
  const targets = sandboxTargetList(process.env.SANDBOX_URLS);
  const key = process.env.SANDBOX_LINK_KEY;
  return targets.length && key ? { targets, key } : null;
}

export async function GET() {
  if (isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = await who();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.access.canOpen("sandbox")) return NextResponse.json({ error: "No access" }, { status: 403 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ configured: false, missing: ["SANDBOX_URLS", "SANDBOX_LINK_KEY"] });

  const sandboxes: SandboxCard[] = [];
  for (const t of cfg.targets) {
    const asked = await readSandbox(t.base, cfg.key).catch((e: Error) => ({ error: e.message }) as const);
    if ("error" in asked) {
      if (me.access.role === "admin") sandboxes.push({ slug: t.slug, cli: t.base, title: t.slug, people: [], error: asked.error, reads: [], asks: [], reviewsWaiting: 0 });
      continue;
    }
    if (!mayUse(asked, me)) continue;
    const people = asked.people ?? [];
    sandboxes.push({
      slug: t.slug, cli: t.base, title: titleOf(people), people, state: asked.state,
      reads: asked.misses.map((m) => ({ key: m.key, kind: m.kind as "hs" | "sql", what: describe(m.kind, m.request), since: m.first_at ?? null, hits: Number(m.hits ?? 1) })),
      asks: asked.asks.map((a) => {
        const spec = (a.spec ?? {}) as { kind?: string; request?: unknown };
        return { id: a.id, by: a.by, reason: a.reason, what: describe(String(spec.kind ?? ""), spec.request), at: a.at ?? null };
      }),
      reviewsWaiting: asked.reviews?.length ?? 0,
    });
  }
  // the log names a sandbox by its slug (before 27.10.2026: by its Railway host)
  const names = new Map<string, string>();
  for (const t of cfg.targets) if (sandboxes.some((s) => s.slug === t.slug)) { names.set(t.slug, t.slug); names.set(new URL(t.origin).host, t.slug); }
  const log = await query<{ at: string; actor: string; action: string; detail: { sandbox?: string; host?: string; line?: string } }>(
    `SELECT created_at AS at, actor, action, detail FROM apsomh_audit WHERE action LIKE 'sandbox.%' ORDER BY created_at DESC LIMIT 60`,
  ).catch(() => ({ rows: [] as { at: string; actor: string; action: string; detail: { sandbox?: string; host?: string; line?: string } }[] }));
  const activity = log.rows
    .map((r) => ({ at: new Date(r.at).toISOString(), who: r.actor, action: r.action.replace(/^sandbox\./, ""), sandbox: names.get(r.detail?.sandbox ?? r.detail?.host ?? "") ?? "", line: r.detail?.line ?? "" }))
    .filter((a) => a.sandbox)
    .slice(0, 30);
  const data: SandboxData = { sandboxes, activity, canAct: me.access.canWrite("sandbox") };
  return NextResponse.json({ configured: true, ok: true, data });
}

export async function POST(req: NextRequest) {
  if (isSandbox()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const me = await who();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { sandbox?: string; action?: string; keys?: string[]; ids?: number[]; code?: string };
  // letting the CLI in needs the app; letting data in or out needs Edit on it
  const entering = b.action === "cli-approve";
  if (!(entering ? me.access.canOpen("sandbox") : me.access.canWrite("sandbox"))) {
    return NextResponse.json({ error: entering ? "No access to the Sandbox app" : "View only - ask for Edit on the Sandbox app" }, { status: 403 });
  }
  const cfg = config();
  if (!cfg) return NextResponse.json({ error: "No sandboxes are set up on the hub" }, { status: 409 });
  const t = cfg.targets.find((x) => x.slug === b.sandbox);
  if (!t) return NextResponse.json({ error: "No such sandbox" }, { status: 404 });
  const url = t.base;
  const asked = await readSandbox(url, cfg.key).catch(() => null);
  if (!mayUse(asked, me)) return NextResponse.json({ error: "Not your sandbox" }, { status: 403 });

  const log = (action: string, detail: Record<string, unknown>) =>
    query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`, [me.username, action, JSON.stringify({ sandbox: t.slug, ...detail })])
      .catch(() => { /* never fail the press because the log did */ });
  try {
    if (b.action === "cli-approve") {
      const code = String(b.code ?? "").trim().toUpperCase();
      if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) return NextResponse.json({ error: "Not a code from npm run sbx -- login" }, { status: 400 });
      await approveCli(url, cfg.key, code, me.email);
      await log("sandbox.cli", { line: `${t.slug}: the CLI let in (code ${code})` });
      return NextResponse.json({ ok: true, line: "The CLI is in - go back to your terminal." });
    }
    if (b.action === "bring" || b.action === "bring-requested") {
      const which = b.action === "bring" ? "reads" : "asks";
      const only = Array.isArray(b.keys) ? { keys: b.keys.map(String) } : Array.isArray(b.ids) ? { ids: b.ids.map(Number) } : undefined;
      const r = await bring(url, cfg.key, which, only);
      await log(`sandbox.${b.action}`, { line: r.line, answered: r.answered, refused: r.refused, left: r.left, reasons: r.reasons });
      console.log(`[sandbox-feed] ${me.username} ${b.action}: ${r.line}`);
      return NextResponse.json({ ok: true, line: r.line, answered: r.answered, refused: r.refused, left: r.left });
    }
    if (b.action === "delete-all") {
      const r = await deleteAllIn(url, cfg.key);
      const line = `${t.slug}: everything but the logins deleted (${r.tables} tables emptied)`;
      await log("sandbox.delete-all", { line, tables: r.tables });
      return NextResponse.json({ ok: true, line });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
