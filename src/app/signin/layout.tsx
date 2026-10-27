// On a sandbox copy this page is the door to the hub (src/app/sandboxDoorLayout.tsx); on the hub, the page itself.
import SandboxDoorLayout from "@/app/sandboxDoorLayout";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SandboxDoorLayout>{children}</SandboxDoorLayout>;
}
