// YOUR PREFERENCES.
//
// Per ACCOUNT, not per browser. A quick link you added on the laptop has to be
// there on the desk machine, or it is not personalisation, it is a bookmark.
//
// Stored in apsomh_kv under `prefs:<user id>` — the table already exists and
// these are small, so this needs no migration and no new table to keep in step.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/guard";
import { ensureSchema } from "@/lib/db/init";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A link somebody added themselves. `href` is checked rather than trusted: a
 * stored `javascript:` URL would run the moment anyone clicked their own quick
 * link, so only http, https and same-origin paths are allowed in.
 */
const Link = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(500).refine(
    (v) => /^https?:\/\//i.test(v) || /^\/[^/\\]/.test(v),
    "A link must start with http://, https:// or /",
  ),
});

const Prefs = z.object({
  /** Built-in quick links the person has switched off. */
  hiddenQuickLinks: z.array(z.string().max(60)).max(40).optional(),
  /** Links of their own, in the order they put them. */
  customQuickLinks: z.array(Link).max(12).optional(),
});

export type Prefs = z.infer<typeof Prefs>;

const keyFor = (id: number) => `prefs:${id}`;

export async function GET() {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const r = await query<{ v: Prefs }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [keyFor(user.id)]);
  // An absent row is not an error: it is somebody who has not changed anything.
  return NextResponse.json({ ok: true, prefs: r.rows[0]?.v ?? {} });
}

export async function PUT(req: NextRequest) {
  const user = await getOptionalUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Prefs.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Those preferences are not valid.",
    }, { status: 400 });
  }

  await ensureSchema();
  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [keyFor(user.id), JSON.stringify(parsed.data)],
  );
  return NextResponse.json({ ok: true, prefs: parsed.data });
}
