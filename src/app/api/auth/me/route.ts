import { NextResponse } from 'next/server';
import { getOptionalUser } from '@/lib/auth/guard';
import { asRole, mfaRequired } from '@/lib/auth/access';
import { editsSomewhere } from '@/lib/auth/appAccess';

export const runtime = 'nodejs';

export async function GET() {
  const u = await getOptionalUser();
  if (!u) return NextResponse.json({ user: null }, { status: 401 });
  const { password_hash: _ph, totp_secret: _ts, ...safe } = u;
  void _ph; void _ts;
  // the role as it is today (a viewer of before is a user), and whether they must carry a second factor
  const role = asRole(u.role);
  return NextResponse.json({ user: { ...safe, role, mfa_required: mfaRequired(role, false, await editsSomewhere(u.id)) } });
}
