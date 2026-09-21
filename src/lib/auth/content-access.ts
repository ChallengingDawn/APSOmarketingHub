import { NextResponse } from "next/server";
import { getOptionalUser } from "./guard";
import { ensureSchema } from "../db/init";
import { canEditContent } from "../content-edit";

// The existing APSO library is a single internal workspace. Re-read the user's
// active status/role from the database instead of trusting a stale JWT role.
export async function contentAccess(write = false) {
  await ensureSchema();
  const user = await getOptionalUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to access the shared library" }, { status: 401 }) };
  if (write && !canEditContent(user.role)) {
    return { response: NextResponse.json({ error: "Your account has read-only access" }, { status: 403 }) };
  }
  return { user };
}
