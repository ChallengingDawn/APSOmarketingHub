import { NextResponse } from "next/server";
import { getOptionalUser } from "./guard";
import { ensureSchema } from "../db/init";
import { canEditContent } from "../content-edit";
import { asRole } from "./access";
import { myAccess } from "./appAccess";

// The existing APSO library is a single internal workspace. Re-read the user's
// active status/role from the database instead of trusting a stale JWT role.
export async function contentAccess(write = false) {
  await ensureSchema();
  const user = await getOptionalUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in to access the shared library" }, { status: 401 }) };
  // Edit on Marketing & Content - or on the sub-app this request is for (Create Studio, Content Library: appAccess.ts)
  const access = write ? await myAccess() : null;
  if (write && !canEditContent(asRole(user.role), access?.canWrite("marketing") ? "write" : "none")) {
    return { response: NextResponse.json({ error: "Your account has read-only access" }, { status: 403 }) };
  }
  return { user };
}
