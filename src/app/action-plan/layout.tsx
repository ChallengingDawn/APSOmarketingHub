// The action plan: an application of its own where Mission Control was, for admins only (SARCLA 01.11.2026: "this
// should be only visible to admin"; "it's not advanced reporting, it's on the previous mission control"). The list of
// admin pages (src/lib/auth/access.ts ADMIN_PATHS) keeps it out of everyone else's menus; this is the guard that
// refuses, and the API holds the same rule (src/app/api/action-plan/guard.ts).
import { redirect } from "next/navigation";
import { myAccess } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const access = await myAccess();
  if (!access) redirect("/signin");
  if (access.role !== "admin") redirect("/");
  return <>{children}</>;
}
