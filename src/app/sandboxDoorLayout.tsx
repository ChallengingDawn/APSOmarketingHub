// The layout every sign-in page of the hub shares: on a sandbox copy it draws the door to the hub instead of the
// page (there is nothing to sign in to there); on the hub it is invisible.
import { isSandbox } from "@/lib/sandbox/mode";
import SandboxDoor from "./SandboxDoor";

export default function SandboxDoorLayout({ children }: { children: React.ReactNode }) {
  if (!isSandbox()) return <>{children}</>;
  const hub = process.env.SANDBOX_HUB_URL ? `${process.env.SANDBOX_HUB_URL.replace(/\/+$/, "")}/sandbox` : null;
  return <SandboxDoor hub={hub} />;
}
