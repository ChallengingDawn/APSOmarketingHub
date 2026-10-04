// Everything under this path belongs to Website & Intelligence, so the guard goes
// here rather than on each page: a sub-page that lets you in when the tile said
// no access is exactly the hole this closes.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("website");
  return <>{children}</>;
}
