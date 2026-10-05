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

/**
 * A profile photo, inline.
 *
 * Downscaled in the browser before it gets here, so this is a small square, not
 * whatever came off the phone. Capped at 192 KB of base64 and restricted to
 * image types: a data URI is rendered straight into an <img>, and `data:text/html`
 * in that field would be a stored script running under this origin.
 */
const Avatar = z.string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "That is not an image.")
  // 6 KB, not 192: there is an 8 KB request-body rule in front of this app, and a
  // body over it is refused with a bare 403 that never reaches the route. The
  // browser shrinks the picture until it fits before sending it.
  .max(6 * 1024, "That picture is too large. It is shrunk before upload, so this should not happen.");

const Prefs = z.object({
  /** Built-in quick links the person has switched off. */
  hiddenQuickLinks: z.array(z.string().max(60)).max(40).optional(),
  /** Links of their own, in the order they put them. */
  customQuickLinks: z.array(Link).max(12).optional(),
  /** Their picture, or absent for initials. */
  avatar: Avatar.optional(),
  /**
   * An icon they picked, by name.
   *
   * Five bytes rather than a painted image. The icons used to be drawn to a
   * canvas and sent as base64, which put a 40-pixel circle into a 15 KB request
   * body and ran straight into the 8 KB body rule in front of this app: 403, no
   * message. A name costs nothing and renders sharper at every size.
   */
  avatarIcon: z.string().trim().max(24).optional(),
  /**
   * Their home screen: which panels they want on it, and the order their apps
   * sit in. Hiding is by name, so a panel that is removed later simply stops
   * being matched rather than leaving a dead entry behind.
   */
  /** What the hub may write to you about. Off unless asked for. */
  notify: z.object({
    priceChecks: z.boolean().optional(),
  }).optional(),
  home: z.object({
    hiddenPanels: z.array(z.string().max(40)).max(20).optional(),
    appOrder: z.array(z.string().max(40)).max(20).optional(),
  }).optional(),
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
  // MERGED, not replaced: the quick-links editor and the profile page each send
  // only their own keys, and a straight overwrite would have one wipe the other.
  const existing = await query<{ v: Prefs }>(`SELECT v FROM apsomh_kv WHERE k = $1 LIMIT 1`, [keyFor(user.id)]);
  const merged = { ...(existing.rows[0]?.v ?? {}), ...parsed.data };

  await query(
    `INSERT INTO apsomh_kv (k, v, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
    [keyFor(user.id), JSON.stringify(merged)],
  );
  return NextResponse.json({ ok: true, prefs: merged });
}
