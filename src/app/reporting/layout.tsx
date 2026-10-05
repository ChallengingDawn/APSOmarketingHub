// Advanced reporting is an app like any other, even while it is empty: the
// guard goes on now so the first report added here inherits it.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("reporting");
  return <>{children}</>;
}
