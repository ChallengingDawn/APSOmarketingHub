// The audit log says who did what, which is itself privileged. Admins only.
import { requireAdmin } from "@/lib/auth/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
