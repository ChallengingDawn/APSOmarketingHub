// The layout every sign-in page of the hub shares: in a sandbox it shows that there is nothing to sign in to (the
// sandbox runs for the one person on whose computer it runs); on the hub it is invisible.
import { isSandbox } from "@/lib/sandbox/mode";
import SandboxDoor from "./SandboxDoor";

export default function SandboxDoorLayout({ children }: { children: React.ReactNode }) {
  if (!isSandbox()) return <>{children}</>;
  return <SandboxDoor />;
}
