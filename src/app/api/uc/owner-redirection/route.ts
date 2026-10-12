// OWNER REDIRECTION - the HubSpot app that gives a company (and its contacts, open
// tickets and open tasks) to the right owner: by country (France -> Jeremy Borey, the
// old sarcla-france-owner app) or by person (someone left: their companies go to
// someone else). The rules are kept here and PUBLISHED to HubSpot on every save; the
// HubSpot app function applies them the moment a company changes, and the hub's sweep
// (owner_rules, every 15 minutes, under the live/preview switch) catches what it missed.
//
//   GET     anyone who may open UC & HubSpot Apps: the rules, people, publish state, runs
//   POST    admins: add a rule {rule} | test run, switch on/off, publish {action}
//   PUT     admins: change a rule {rule} | move one {id, dir: "up"|"down"}
//   DELETE  admins: ?id=<rule id>
// Every change is checked as a whole list (no two rules may hand companies back and
// forth), saved, then published - all under one lock, so two saves cannot interleave.

import { NextRequest, NextResponse } from "next/server";
import { myAccess } from "@/lib/auth/appAccess";
import { query } from "@/lib/db/client";
import { busy, lastRun, liveSteps, setLive, startStep } from "@/lib/connectors/steps/run";
import { describeIntegrationError } from "@/lib/integrations/status";
import { checkRule, publishedRules, ruleSetProblems, rulesHash, type Rule } from "@/lib/ownerRules/rules";
import { freshRuleId, listRules, recentCorrections, saveRules, type StoredRule } from "@/lib/ownerRules/store";
import { lastPublishError, publishRules, publishState, readOwners, underPublishLock, type Owner } from "@/lib/ownerRules/hubspot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "owner_rules";

/** A stored rule without its who/when - what is checked, saved and published. */
const bare = (r: StoredRule): Rule => {
  const rule = { ...r } as Partial<StoredRule>;
  delete rule.updatedAt;
  delete rule.updatedBy;
  return rule as Rule;
};

export async function GET() {
  const access = await myAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.canOpen("uc")) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const [rules, live, run, preview, b, published, publishError, corrections] = await Promise.all([
      listRules(), liveSteps(), lastRun("live", KEY), lastRun("preview", KEY), busy("sweep"),
      publishState(), lastPublishError(), recentCorrections(100),
    ]);
    let owners: Owner[] | null = null;
    let ownersError: string | null = null;
    try {
      owners = await readOwners();
    } catch (e) {
      ownersError = describeIntegrationError(e).error;
    }
    const savedHash = rulesHash(publishedRules(rules.map(bare)));
    return NextResponse.json({ configured: true, ok: true, data: {
      rules, owners, ownersError, problems: ruleSetProblems(rules.map(bare)),
      published, publishError, inSync: published?.hash === savedHash,
      live: live.has(KEY), run, preview, running: b?.key === KEY ? b : null, otherRunning: !!b && b.key !== KEY,
      admin: access.role === "admin", corrections,
    } });
  } catch (err) {
    return NextResponse.json({ configured: true, ok: false, ...describeIntegrationError(err) });
  }
}

type Body = { action?: string; rule?: unknown; id?: unknown; dir?: unknown };

async function admin(): Promise<{ by: string; userId: number } | NextResponse> {
  const access = await myAccess();
  if (!access) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (access.role !== "admin") return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  return { by: `user ${access.userId}`, userId: access.userId };
}

/**
 * Check the people a rule names against HubSpot's owners: the new owner must be an active
 * owner; the person whose companies move may have left (a deactivated owner) but must exist.
 * A rule being switched OFF is not checked - it must stay possible to stop a rule whose
 * owner has left.
 */
async function checkOwners(touched: Rule | null): Promise<string | null> {
  if (!touched || !touched.enabled) return null;
  let owners = await readOwners();
  const need = [touched.toOwner, ...(touched.kind === "owner" ? [touched.fromOwner] : [])];
  if (need.some((id) => !owners.some((o) => o.id === id))) owners = await readOwners(true);
  const byId = new Map(owners.map((o) => [o.id, o]));
  const to = byId.get(touched.toOwner);
  if (!to) return `Owner ${touched.toOwner} is not a HubSpot owner.`;
  if (!to.active) return `${to.name} is deactivated in HubSpot - companies cannot go to them.`;
  if (touched.kind === "owner" && !byId.has(touched.fromOwner)) return `Owner ${touched.fromOwner} is not a HubSpot owner.`;
  return null;
}

/** Change the list, check it as a whole, save it, publish it - one lock around all of it. */
async function change(by: string, userId: number, what: string, edit: (rules: Rule[]) => { rules: Rule[]; touched: Rule | null } | string): Promise<NextResponse> {
  try {
    return await underPublishLock(async () => {
      const before = (await listRules()).map(bare);
      const r = edit(before.map((x) => ({ ...x })));
      if (typeof r === "string") return NextResponse.json({ ok: false, error: r }, { status: 400 });
      const problems = ruleSetProblems(r.rules);
      if (problems.errors.length) return NextResponse.json({ ok: false, error: problems.errors.join(" ") }, { status: 400 });
      const ownerError = await checkOwners(r.touched);
      if (ownerError) return NextResponse.json({ ok: false, error: ownerError }, { status: 400 });
      await saveRules(r.rules, by);
      await query(`INSERT INTO apsomh_audit (actor, action, detail) VALUES ($1, $2, $3)`, [
        String(userId), "owner_rules.save", JSON.stringify({ what, rule: r.touched, count: r.rules.length }),
      ]).catch(() => {});
      const pub = await publishRules(r.rules, by);
      return NextResponse.json(pub.ok
        ? { ok: true, data: { note: `Saved. ${pub.note}`, published: true } }
        : { ok: true, data: { note: `Saved in the hub, but NOT published to HubSpot - HubSpot keeps running the rules it had. ${pub.error}`, published: false } });
    });
  } catch (err) {
    return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  const b = (await req.json().catch(() => ({}))) as Body;
  if (b.action === "preview") return NextResponse.json({ ok: true, data: await startStep(KEY, "preview", who.by) });
  if (b.action === "live-on" || b.action === "live-off") {
    const r = await setLive(KEY, b.action === "live-on");
    return NextResponse.json({ ok: r.ok, data: r, error: r.ok ? undefined : r.note }, { status: r.ok ? 200 : 409 });
  }
  if (b.action === "publish") {
    try {
      const pub = await underPublishLock(async () => publishRules((await listRules()).map(bare), who.by));
      return NextResponse.json(pub.ok ? { ok: true, data: { note: pub.note, published: true } } : { ok: false, error: pub.error }, { status: pub.ok ? 200 : 502 });
    } catch (err) {
      return NextResponse.json({ ok: false, ...describeIntegrationError(err) }, { status: 500 });
    }
  }
  if (b.action === "add") {
    return change(who.by, who.userId, "add", (rules) => {
      const id = freshRuleId(rules.map((x) => x.id));
      const c = checkRule({ ...(b.rule as object), id });
      if (!c.ok) return c.error;
      return { rules: [...rules, c.rule], touched: c.rule };
    });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  const b = (await req.json().catch(() => ({}))) as Body;
  if (b.dir === "up" || b.dir === "down") {
    const id = String(b.id ?? "");
    return change(who.by, who.userId, `move ${b.dir}`, (rules) => {
      const i = rules.findIndex((x) => x.id === id);
      if (i < 0) return "That rule no longer exists.";
      const j = b.dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= rules.length) return "The rule is already at that end.";
      [rules[i], rules[j]] = [rules[j], rules[i]];
      return { rules, touched: null };
    });
  }
  const c = checkRule(b.rule);
  if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 400 });
  return change(who.by, who.userId, "edit", (rules) => {
    const i = rules.findIndex((x) => x.id === c.rule.id);
    if (i < 0) return "That rule no longer exists.";
    rules[i] = c.rule;
    return { rules, touched: c.rule };
  });
}

export async function DELETE(req: NextRequest) {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  return change(who.by, who.userId, `delete ${id}`, (rules) => {
    const left = rules.filter((x) => x.id !== id);
    if (left.length === rules.length) return "That rule no longer exists.";
    return { rules: left, touched: null };
  });
}
