// THE ANGST+PFISTER HUB (SARCLA 10.11.2026) - the people of Angst+Pfister land here after signing in (cross access,
// src/lib/auth/access.ts), and the admins come to look after it. Nobody else: an APSOparts user is sent home with the
// reason, the way an app they were not given turns them away.
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { asCross } from "@/lib/auth/access";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (asCross(u.cross_access) === null && u.role !== "admin") redirect("/?denied=ap");
  return <>{children}</>;
}
