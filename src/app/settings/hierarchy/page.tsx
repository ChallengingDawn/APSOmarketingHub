// Settings > Hierarchy - who reports to whom (SARCLA 01.11.2026). Admin only, enforced here and again by its API.
import { requireAdmin } from "@/lib/auth/guard";
import HierarchyPage from "./Hierarchy";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin();
  return <HierarchyPage />;
}
