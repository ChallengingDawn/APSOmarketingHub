// Live belongs to Advanced reporting, and is its first sub-app.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("reporting");
  return <>{children}</>;
}
