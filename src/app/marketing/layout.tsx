// Marketing & Content's front page and its sections' doorways: the app's own grant, as every other page of it.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("marketing");
  return <>{children}</>;
}
