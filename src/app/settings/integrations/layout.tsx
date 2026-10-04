// Integrations is the hub's own configuration: tokens, what is connected, what
// is missing. Admins only — a viewer could read which services hold our data.
import { requireAdmin } from "@/lib/auth/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
