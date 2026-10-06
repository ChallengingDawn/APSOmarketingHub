// Everything under this path belongs to Connectors & Integration, so the guard
// goes here rather than on each page.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("connectors");
  return <>{children}</>;
}
