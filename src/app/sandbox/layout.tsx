// Everything under this path belongs to the Sandbox app, so the guard goes here rather than on each page. A sandbox
// copy has no such app - it is the hub's door to the sandboxes, not one of them.
import { notFound } from "next/navigation";
import { requireApp } from "@/lib/auth/appAccess";
import { isSandbox } from "@/lib/sandbox/mode";

export default async function Layout({ children }: { children: React.ReactNode }) {
  if (isSandbox()) notFound();
  await requireApp("sandbox");
  return <>{children}</>;
}
