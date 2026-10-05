// Mission Control draws the content calendar and the library, which are the
// Marketing app's. The guard goes where the data comes from, not where the name
// suggests — otherwise a viewer with one app walks in through a page that
// sounds like it belongs to everybody.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("marketing");
  return <>{children}</>;
}
