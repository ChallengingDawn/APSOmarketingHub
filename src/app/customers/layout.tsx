// Everything under /customers belongs to Customer Journey & KPIs.
//
// The guard runs on the server and the chrome below is a client component, so
// the chrome moved into CustomersChrome.tsx and this wraps it. A sub-page that
// let you in when the tile said no access is the hole this closes.
import { requireApp } from "@/lib/auth/appAccess";
import CustomersChrome from "./CustomersChrome";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("journey");
  return <CustomersChrome>{children}</CustomersChrome>;
}
