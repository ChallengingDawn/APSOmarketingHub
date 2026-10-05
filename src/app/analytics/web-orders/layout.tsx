// /analytics splits across two apps, so the guard cannot sit on the shared
// layout above: it goes on each tree. This one belongs to website.
//
// Nothing enforced these before \u2014 appForPath knew which app they belonged to and
// no layout ever asked.
import { requireApp } from "@/lib/auth/appAccess";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("website");
  return <>{children}</>;
}
