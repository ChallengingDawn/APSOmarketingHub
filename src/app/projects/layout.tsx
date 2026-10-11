// Content projects belong to Marketing & Content, so the guard is the same
// one the rest of that app uses rather than a second idea of who may look.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("marketing");
  return <>{children}</>;
}
