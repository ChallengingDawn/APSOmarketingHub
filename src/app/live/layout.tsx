// Live is the Website app's: it is the site's own traffic, now.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("website");
  return <>{children}</>;
}
