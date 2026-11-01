// The action plan sits where Mission Control was (SARCLA 01.11.2026: "it's not advanced reporting, it's on the
// previous mission control"): open to whoever has Marketing - Mission Control's own app - or Advanced reporting,
// whose KPI tiles' tasks are its sub-actions. The API answers by the same rule (src/app/api/action-plan/guard.ts).
import { redirect } from "next/navigation";
import { myAccess } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const access = await myAccess();
  if (!access) redirect("/signin");
  if (!access.canOpen("marketing") && !access.canOpen("reporting")) redirect("/?denied=marketing");
  return <>{children}</>;
}
