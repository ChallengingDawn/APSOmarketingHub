// Everything under this path belongs to Customer Journey & KPIs.
//
// The guard has to run on the server, and the shell below is a client component
// — so the shell moved into JourneyShell.tsx and this wraps it. A sub-page
// that let you in when the tile said no access is the hole this closes.
import { requireApp } from "@/lib/auth/appAccess";
import JourneyShell from "./JourneyShell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("journey");
  return <JourneyShell>{children}</JourneyShell>;
}
