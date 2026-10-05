import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/client';
import type { UserRow } from '@/lib/db/init';
import { generateSecret, totpQrDataUrl, verifyTotp } from '@/lib/auth/totp';
import { clearPre2faCookie, readPre2fa } from '@/lib/auth/session';
import { beginSession } from '@/lib/auth/sessions';
import { checkRateLimit, clientKey, recordFailure, recordSuccess } from '@/lib/auth/rateLimit';
import { mfaRequired, type Role } from '@/lib/auth/access';
import { getOptionalUser } from '@/lib/auth/guard';

/**
 * Who is enrolling: somebody in the middle of signing in, or somebody already
 * signed in who has come from Settings -> Security to turn it on. Both are the
 * same act; only the cookie differs. A viewer never passes through the login
 * half any more, so without this the button in Settings led nowhere.
 */
async function enrollingUser(): Promise<number | null> {
  const pre = await readPre2fa();
  if (pre) return pre.uid;
  const u = await getOptionalUser();
  return u?.id ?? null;
}

export const runtime = 'nodejs';

export async function GET() {
  const uid = await enrollingUser();
  if (!uid) return NextResponse.json({ error: 'No pending login' }, { status: 401 });

  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [uid]);
  const u = r.rows[0];
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (u.totp_enrolled) {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 400 });
  }

  let secret = u.totp_secret;
  if (!secret) {
    secret = generateSecret();
    await query(`UPDATE apsomh_users SET totp_secret = $1 WHERE id = $2`, [secret, u.id]);
  }
  const qr = await totpQrDataUrl(secret, u.username);
  // A viewer reads; a second factor is offered, not demanded. Anyone who can
  // change something carries one, and the page must know which it is looking at
  // before it draws a way past.
  return NextResponse.json({ qr, secret, maySkip: !mfaRequired(u.role as Role) });
}

const PostBody = z.union([
  z.object({ code: z.string().regex(/^\d{6}$/) }),
  /** A role that does not have to carry one, saying not now. */
  z.object({ skip: z.literal(true) }),
]);

export async function POST(req: Request) {
  const rlKey = clientKey(req, 'enroll');
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const uid = await enrollingUser();
  if (!uid) return NextResponse.json({ error: 'No pending login' }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const r = await query<UserRow>(`SELECT * FROM apsomh_users WHERE id = $1 LIMIT 1`, [uid]);
  const u = r.rows[0];
  if (!u) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Skipping: allowed by role, never by asking. The secret stays on the row
  // unused, so the offer is made again at the next sign-in.
  if ('skip' in parsed.data) {
    if (mfaRequired(u.role as Role)) {
      return NextResponse.json(
        { error: 'Your role has to carry a second factor.' },
        { status: 403 },
      );
    }
    recordSuccess(rlKey);
    await query(`UPDATE apsomh_users SET last_login = NOW() WHERE id = $1`, [u.id]);
    await clearPre2faCookie();
    await beginSession(u, req);
    return NextResponse.json({ next: u.must_change_password ? '/change-password' : '/' });
  }

  if (!u.totp_secret) {
    return NextResponse.json({ error: 'No secret pending' }, { status: 400 });
  }
  if (!verifyTotp(u.totp_secret, parsed.data.code)) {
    recordFailure(rlKey);
    return NextResponse.json({ error: 'Wrong code' }, { status: 401 });
  }

  recordSuccess(rlKey);
  await query(
    `UPDATE apsomh_users SET totp_enrolled = TRUE, last_login = NOW() WHERE id = $1`,
    [u.id],
  );
  await clearPre2faCookie();
  await beginSession(u, req);
  // The front door, not the brain. Landing on Personality is a leftover from
  // when this was the marketing app; now it is one app of five, and most people
  // signing in cannot even open it.
  return NextResponse.json({ next: u.must_change_password ? '/change-password' : '/' });
}
