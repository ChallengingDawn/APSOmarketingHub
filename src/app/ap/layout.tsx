// THE ANGST+PFISTER HUB (SARCLA 10.11.2026) - the people of Angst+Pfister land here after signing in (cross access,
// src/lib/auth/access.ts). Only they: anybody else - an admin of the APSOparts hub without the mark too - is sent home
// with the reason (SARCLA 10.11.2026, on Bernd seeing it: "only cross people"; an admin who looks after it is marked
// Cross-admin).
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { asCross } from "@/lib/auth/access";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  if (asCross(u.cross_access) === null) redirect("/?denied=ap");
  return <>{children}</>;
}
