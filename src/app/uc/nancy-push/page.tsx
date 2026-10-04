// Nancy CH Push (reactivation batch 2) - a one-shot action under UC & HubSpot Apps.
import { ReactivationBoard } from "@/app/uc/oneshot/ReactivationBoard";

export default function NancyPushPage() {
  return <ReactivationBoard campaign="nancy" />;
}
