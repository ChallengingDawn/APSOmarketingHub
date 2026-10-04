// Roles & access — everyone against every app. Admin only: who can see what is
// itself privileged information.
import { requireAdmin } from "@/lib/auth/guard";
import RolesGrid from "./RolesGrid";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireAdmin();
  return <RolesGrid />;
}
