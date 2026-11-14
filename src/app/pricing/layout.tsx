// Everything under this path belongs to Pricing (the PricingHub's pages, moved into the hub - SARCLA 13.11.2026), so
// the guard goes here rather than on each page. Its data is read and changed through /api/pricing/api/*, which checks
// the same access per call (src/app/api/pricing/api/[...path]/route.ts). Every page wears the hub's look (PricingLook).
import { requireApp } from "@/lib/auth/appAccess";
import PricingLook from "./PricingLook";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireApp("pricing");
  return <PricingLook>{children}</PricingLook>;
}
